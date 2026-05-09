/**
 * Issue #153 PR-J — Wallet top-up Nayax verification.
 *
 * Forensic audit (PR #202) finding F-05:
 *   server/routes/credit-wallet.ts /topup trusted caller-supplied
 *   `nayaxTxId` and `amountCents` with no Nayax-side verification.
 *   Anyone could credit themselves any amount with any string.
 *   P0-illegal + fraud risk.
 *
 * Resolution: server/lib/wallet-topup-verify.ts cross-checks the
 * (userId, nayaxTxId, claimedAmountCents) tuple against the
 * locally-recorded nayaxTransactions row. Mirrors the K9000 wash
 * route verification pattern but adds amount + customerUid checks.
 *
 * Locked invariants this suite enforces:
 *
 *   A. The verifier returns ok:true ONLY when:
 *      • status ∈ {authorized, settled}
 *      • amount (decimal × 100) === claimedAmountCents
 *      • customerUid === userId
 *      • all inputs are non-empty / claimedAmountCents is positive int
 *      Any other state returns ok:false with a stable machine-readable
 *      reason ('not_found' | 'wrong_status' | 'wrong_amount' |
 *      'wrong_customer' | 'invalid_input').
 *
 *   B. The /topup route invokes verifyNayaxTopup BEFORE the
 *      idempotency-lock try-insert (so rejected txns don't burn
 *      idempotency rows that would later 409 the legitimate caller).
 *
 *   C. Non-admin caller without a verified Nayax record returns
 *      HTTP 402 with errorCode='PAYMENT_NOT_VERIFIED'.
 *
 *   D. Admin manual top-up path (no nayaxTxId) is preserved — it
 *      bypasses verification (existing audited support-correction
 *      path). The bypass condition in source remains intact.
 *
 *   E. The verifier is a pure read of nayaxTransactions. No vendor
 *      SDK / process.env / money mutation imports.
 *
 *   F. PR-W4 idempotency layer is unchanged (scope guard).
 *
 *   G. PR-J traceability marker present in helper + route.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  verifyNayaxTopup,
  type NayaxTransactionLookup,
} from '../lib/wallet-topup-verify';

const ROOT = resolve(__dirname, '..', '..');
const helperSrc = readFileSync(
  resolve(ROOT, 'server/lib/wallet-topup-verify.ts'),
  'utf8',
);
const routeSrc = readFileSync(
  resolve(ROOT, 'server/routes/credit-wallet.ts'),
  'utf8',
);

const helperCodeOnly = helperSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── Test fixtures (no DB) ─────────────────────────────────────────────────

const VALID_TXN_BASE = {
  id: 'NAYAX-VALID-001',
  status: 'authorized',
  amount: '15.00', // decimal(10,2) → cents = 1500
  currency: 'ILS',
  customerUid: 'firebase-user-A',
  // Other fields are not consulted by the verifier; left unset.
} as any;

const lookupFor = (rows: Record<string, any>): NayaxTransactionLookup => {
  return async (id: string) => rows[id];
};

// ── A. Verifier algorithmic correctness ──────────────────────────────────

describe('PR-J — verifyNayaxTopup helper', () => {
  it('1. accepts authorized + matching amount + matching customerUid', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-VALID-001', claimedAmountCents: 1500 },
      lookupFor({ 'NAYAX-VALID-001': VALID_TXN_BASE }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.txn.id).toBe('NAYAX-VALID-001');
  });

  it('2. accepts settled status as well (post-capture)', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-001', claimedAmountCents: 1500 },
      lookupFor({ 'NAYAX-001': { ...VALID_TXN_BASE, status: 'settled' } }),
    );
    expect(r.ok).toBe(true);
  });

  it('3. rejects unknown nayaxTxId → not_found', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-A', nayaxTxId: 'GHOST', claimedAmountCents: 1500 },
      lookupFor({}),
    );
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('4. rejects forbidden statuses → wrong_status', async () => {
    for (const status of ['initiated', 'vend_pending', 'vend_success', 'failed', 'voided', '']) {
      const r = await verifyNayaxTopup(
        { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-X', claimedAmountCents: 1500 },
        lookupFor({ 'NAYAX-X': { ...VALID_TXN_BASE, status } }),
      );
      expect(r).toEqual({ ok: false, reason: 'wrong_status' });
    }
  });

  it('5. rejects amount mismatch → wrong_amount', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-001', claimedAmountCents: 5000 },
      lookupFor({ 'NAYAX-001': VALID_TXN_BASE }), // amount = 15.00 → 1500 cents
    );
    expect(r).toEqual({ ok: false, reason: 'wrong_amount' });
  });

  it('6. rejects customerUid mismatch → wrong_customer', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-B', nayaxTxId: 'NAYAX-001', claimedAmountCents: 1500 },
      lookupFor({ 'NAYAX-001': VALID_TXN_BASE }), // customerUid = firebase-user-A
    );
    expect(r).toEqual({ ok: false, reason: 'wrong_customer' });
  });

  it('7. rejects null customerUid on the txn → wrong_customer', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-001', claimedAmountCents: 1500 },
      lookupFor({ 'NAYAX-001': { ...VALID_TXN_BASE, customerUid: null } }),
    );
    expect(r).toEqual({ ok: false, reason: 'wrong_customer' });
  });

  it('8. rejects empty/missing inputs → invalid_input', async () => {
    const lookup = lookupFor({ 'NAYAX-001': VALID_TXN_BASE });
    expect(
      await verifyNayaxTopup({ userId: '', nayaxTxId: 'NAYAX-001', claimedAmountCents: 1500 }, lookup),
    ).toEqual({ ok: false, reason: 'invalid_input' });
    expect(
      await verifyNayaxTopup({ userId: 'firebase-user-A', nayaxTxId: '', claimedAmountCents: 1500 }, lookup),
    ).toEqual({ ok: false, reason: 'invalid_input' });
    expect(
      await verifyNayaxTopup({ userId: 'firebase-user-A', nayaxTxId: 'NAYAX-001', claimedAmountCents: 0 }, lookup),
    ).toEqual({ ok: false, reason: 'invalid_input' });
    expect(
      await verifyNayaxTopup(
        { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-001', claimedAmountCents: -100 },
        lookup,
      ),
    ).toEqual({ ok: false, reason: 'invalid_input' });
    expect(
      await verifyNayaxTopup(
        { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-001', claimedAmountCents: 12.5 as any },
        lookup,
      ),
    ).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('9. exact-cent comparison (no float drift) — 0.30 → 30, not 29 or 31', async () => {
    const r = await verifyNayaxTopup(
      { userId: 'firebase-user-A', nayaxTxId: 'NAYAX-PENNY', claimedAmountCents: 30 },
      lookupFor({ 'NAYAX-PENNY': { ...VALID_TXN_BASE, id: 'NAYAX-PENNY', amount: '0.30' } }),
    );
    expect(r.ok).toBe(true);
  });
});

// ── B. Route wiring: verification BEFORE idempotency ────────────────────

describe('PR-J — /topup wiring', () => {
  it('10. credit-wallet imports verifyNayaxTopup', () => {
    expect(routeSrc).toMatch(
      /import\s*\{[^}]*verifyNayaxTopup[^}]*\}\s*from\s*['"][./]+lib\/wallet-topup-verify['"]/,
    );
  });

  it('11. verifyNayaxTopup is invoked BEFORE the idempotency-lock try-insert', () => {
    // Pin against the actual try-insert call site, not the bare import.
    const verifyIdx = routeSrc.indexOf('verifyNayaxTopup({');
    const idemInsertIdx = routeSrc.indexOf('db\n        .insert(walletIdempotencyKeys)');
    const idemFallbackIdx = routeSrc.indexOf('.insert(walletIdempotencyKeys)');
    const idemIdx = idemInsertIdx > 0 ? idemInsertIdx : idemFallbackIdx;
    expect(verifyIdx).toBeGreaterThan(0);
    expect(idemIdx).toBeGreaterThan(0);
    expect(verifyIdx).toBeLessThan(idemIdx);
  });

  it('12. non-admin verification failure returns HTTP 402 with PAYMENT_NOT_VERIFIED', () => {
    // Find the verification block and confirm both response code + errorCode.
    const guardIdx = routeSrc.indexOf('PR-J: Nayax verification');
    expect(guardIdx).toBeGreaterThan(0);
    const slice = routeSrc.slice(guardIdx, guardIdx + 1500);
    expect(slice).toMatch(/status\(402\)/);
    expect(slice).toMatch(/PAYMENT_NOT_VERIFIED/);
    expect(slice).toMatch(/errorCode/);
  });

  it('13. admin manual top-up path bypasses verification (preserved)', () => {
    // The verification gate explicitly checks `!isAdminUser && nayaxTxId`.
    expect(routeSrc).toMatch(/if\s*\(\s*!isAdminUser\s*&&\s*nayaxTxId\s*\)/);
    // And the admin-no-nayaxTxId warn block is preserved verbatim.
    expect(routeSrc).toMatch(/Super-admin manual top-up \(no Nayax txId\)/);
  });
});

// ── C. Helper purity + scope guards ──────────────────────────────────────

describe('PR-J — helper purity + scope guards', () => {
  it('14. helper imports zero vendor SDK / process.env / money mutation', () => {
    expect(helperCodeOnly).not.toMatch(/process\.env/);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*nayax-spark[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*tranzila[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*stripe[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*sumit[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/walletService/);
  });

  it('15. helper introduces no money-mutation keyword (defence-in-depth)', () => {
    expect(helperCodeOnly).not.toMatch(/(addCredits|deductCredits|charge|refund|payout|debit|capture|authorize)\s*\(/i);
  });

  it('16. PR-W4 idempotency layer is unchanged (scope guard — exact pattern preserved)', () => {
    // The try-insert/onConflictDoNothing pattern + the idempotency
    // try-insert against walletIdempotencyKeys must remain in the
    // route. We pin a known phrase from the original PR-W4 block.
    expect(routeSrc).toMatch(/PR-W4: idempotency guard/);
    expect(routeSrc).toMatch(/onConflictDoNothing\(\)/);
    expect(routeSrc).toMatch(/IDEMPOTENCY_IN_FLIGHT/);
  });
});

// ── D. Traceability ──────────────────────────────────────────────────────

describe('PR-J — traceability marker', () => {
  it('17. helper docstring mentions PR-J + finding F-05', () => {
    expect(helperSrc).toMatch(/PR-J/);
    expect(helperSrc).toMatch(/F-05/);
  });

  it('18. route mentions PR-J at the verification gate', () => {
    expect(routeSrc).toMatch(/PR-J: Nayax verification/);
  });
});
