/**
 * Issue #153 PR-AUDIT-CHAIN-VERIFY — wire EXISTING chain verifiers
 * into admin HTTP. Pure FINISHING work.
 *
 * Discovery (2026-05-08, the 7-class audit):
 *   FIVE chain-verifier functions had been implemented across the
 *   codebase; NONE were exposed via an admin endpoint. So an admin
 *   or regulator asking "prove your audit / wallet / KYC chain is
 *   intact" had no way to trigger them — the chain was tamper-
 *   evident only if a developer manually ran the function from a
 *   script. Classic half-built integrity system.
 *
 *   server/services/AuditLedgerService.ts:417       verifyChainIntegrity
 *   server/services/WalletLedger.ts:803             verifyChainIntegrity
 *   server/services/KYC2026/KYCAuditTrail.ts:177    verifyChain
 *   server/services/storage.ts:5522                  verifyLedgerChain
 *   server/services/ImmutableStampService.ts:305    verifyChain
 *
 * This PR adds 4 admin-only GET endpoints that call the EXISTING
 * verifiers. Pure read-only. No new chain logic. No money movement.
 *
 * Locked invariants (asserted below):
 *   • Every endpoint behind requireAdmin
 *   • No db.insert / db.update / db.delete in any handler
 *   • Handlers DELEGATE to the existing verifier — they do NOT
 *     re-implement chain logic (so a future fix to the verifier
 *     propagates to the endpoint automatically)
 *   • No reach into money / Nayax / K9000 / Tranzila / Masav
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

const ROUTES = {
  kyc:    '/api/admin/integrity/kyc-audit',
  audit:  '/api/admin/integrity/audit-ledger',
  wallet: '/api/admin/integrity/wallet-ledger',
  summary:'/api/admin/integrity/summary',
} as const;

function extractHandler(route: string): string {
  const startMarker = `app.get('${route}', requireAdmin, async`;
  const idx = routes.indexOf(startMarker);
  if (idx < 0) throw new Error(`Route ${route} not found in routes.ts`);
  return routes.slice(idx, idx + 5000);
}

// ── A. ROUTES REGISTERED + ADMIN-GATED ────────────────────────────────────

describe('PR-AUDIT-CHAIN-VERIFY — routes registered with requireAdmin', () => {
  for (const [label, route] of Object.entries(ROUTES)) {
    it(`registers ${route} (${label}) behind requireAdmin`, () => {
      const re = new RegExp(`app\\.get\\(\\s*['"]${route.replace(/[.\/]/g, m => '\\' + m)}['"]\\s*,\\s*requireAdmin\\s*,`);
      expect(routes).toMatch(re);
    });
  }
});

// ── B. EVERY HANDLER IS PURE READ ─────────────────────────────────────────

describe('PR-AUDIT-CHAIN-VERIFY — every handler is read-only', () => {
  for (const [label, route] of Object.entries(ROUTES)) {
    it(`${route} (${label}) handler contains no db.insert / db.update / db.delete`, () => {
      const handler = extractHandler(route).slice(0, 4000);
      expect(handler).not.toMatch(/db\.insert\(/);
      expect(handler).not.toMatch(/db\.update\(/);
      expect(handler).not.toMatch(/db\.delete\(/);
    });
  }

  it('no handler reaches into money / vendor / runtime surfaces', () => {
    for (const route of Object.values(ROUTES)) {
      const handler = extractHandler(route).slice(0, 4000);
      expect(handler).not.toMatch(/ProviderPayoutService/);
      expect(handler).not.toMatch(/NayaxPaymentService/);
      expect(handler).not.toMatch(/processIsraeliBankTransfer/);
      expect(handler).not.toMatch(/MasavGenerator|masav/i);
      expect(handler).not.toMatch(/Tranzila/);
      expect(handler).not.toMatch(/K9000RedemptionService|MachineCommandService/);
    }
  });
});

// ── C. EACH ENDPOINT DELEGATES TO ITS CANONICAL EXISTING VERIFIER ─────────

describe('PR-AUDIT-CHAIN-VERIFY — handlers delegate to existing verifiers', () => {
  it('kyc-audit endpoint calls kycAuditTrail.verifyChain()', () => {
    const handler = extractHandler(ROUTES.kyc);
    expect(handler).toMatch(/import\(\s*['"]\.\/services\/KYC2026\/KYCAuditTrail['"]\s*\)/);
    expect(handler).toMatch(/kycAuditTrail\.verifyChain\(\)/);
  });

  it('audit-ledger endpoint calls AuditLedgerService.verifyChainIntegrity', () => {
    const handler = extractHandler(ROUTES.audit);
    expect(handler).toMatch(/import\(\s*['"]\.\/services\/AuditLedgerService['"]\s*\)/);
    expect(handler).toMatch(/AuditLedgerService\.verifyChainIntegrity\(/);
  });

  it('wallet-ledger endpoint calls WalletLedger.verifyChainIntegrity(walletId)', () => {
    const handler = extractHandler(ROUTES.wallet);
    expect(handler).toMatch(/import\(\s*['"]\.\/services\/WalletLedger['"]\s*\)/);
    expect(handler).toMatch(/verifyChainIntegrity\(\s*walletId\s*\)/);
  });

  it('summary endpoint runs kyc + audit verifiers in parallel', () => {
    const handler = extractHandler(ROUTES.summary);
    expect(handler).toMatch(/Promise\.all\(/);
    expect(handler).toMatch(/kycAuditTrail\.verifyChain\(\)/);
    expect(handler).toMatch(/AuditLedgerService\.verifyChainIntegrity\(\)/);
  });
});

// ── D. SAFETY GUARDS ──────────────────────────────────────────────────────

describe('PR-AUDIT-CHAIN-VERIFY — safety guards', () => {
  it('wallet-ledger 400s when walletId query param is missing', () => {
    const handler = extractHandler(ROUTES.wallet);
    expect(handler).toMatch(/if\s*\(\s*!walletId\s*\)/);
    expect(handler).toMatch(/res\.status\(\s*400\s*\)/);
  });

  it('audit-ledger startBlock/endBlock are coerced via Number() and optional', () => {
    const handler = extractHandler(ROUTES.audit);
    expect(handler).toMatch(/Number\(req\.query\.startBlock\)/);
    expect(handler).toMatch(/Number\(req\.query\.endBlock\)/);
  });

  it('summary endpoint isolates each check (one broken chain does not deny the others)', () => {
    const handler = extractHandler(ROUTES.summary);
    // Each check goes through a `safe(...)` wrapper that catches errors
    // and returns { ok: false, error } so a single failure cannot mask
    // the other checks.
    expect(handler).toMatch(/safe\s*=\s*async\s*</);
    expect(handler).toMatch(/ok:\s*true\s+as\s+const/);
    expect(handler).toMatch(/ok:\s*false\s+as\s+const/);
  });
});

// ── E. EXISTING VERIFIER CONTRACTS ARE STILL IN PLACE ─────────────────────

describe('PR-AUDIT-CHAIN-VERIFY — underlying verifier signatures unchanged', () => {
  it('AuditLedgerService.verifyChainIntegrity signature preserved', () => {
    const src = readFileSync(resolve(ROOT, 'server/services/AuditLedgerService.ts'), 'utf8');
    expect(src).toMatch(/static\s+async\s+verifyChainIntegrity\(\s*startBlock\?:\s*number\s*,\s*endBlock\?:\s*number\s*\)/);
  });

  it('WalletLedger.verifyChainIntegrity signature preserved', () => {
    const src = readFileSync(resolve(ROOT, 'server/services/WalletLedger.ts'), 'utf8');
    expect(src).toMatch(/export\s+async\s+function\s+verifyChainIntegrity\(\s*walletId:\s*string\s*\)/);
  });

  it('KYCAuditTrail.verifyChain signature preserved', () => {
    const src = readFileSync(resolve(ROOT, 'server/services/KYC2026/KYCAuditTrail.ts'), 'utf8');
    expect(src).toMatch(/async\s+verifyChain\(\)\s*:\s*Promise<\{\s*valid:\s*boolean/);
  });
});
