/**
 * M4 — refund-writer inventory pins (sprint/money-concurrency, 2026-08-17).
 *
 * Full inventory: docs/architecture/refund-writer-inventory-2026-08-17.md
 *
 * PetWash has no single refund rail. `RefundService` is the canonical one and it
 * is genuinely well-guarded — but it has exactly ONE caller in the whole server.
 * Every other backwards-money path was built separately, and four of them credit
 * `wallet_accounts.cash_wallet_balance_cents` with raw SQL that the hash-chained
 * wallet ledger never sees.
 *
 * This file does not fix those. It FREEZES them, so the known bypass list can
 * only shrink:
 *
 *   1. the canonical rails keep their idempotency guards;
 *   2. the set of files performing a raw-SQL wallet credit does not grow — a new
 *      bypass fails the build;
 *   3. the two `escrow_holdings` writers that were given a terminal-status guard
 *      keep it;
 *   4. `refund_transactions.idempotencyKey` stays UNIQUE NOT NULL — the index
 *      that makes the canonical rail race-proof.
 *
 * All source-introspection (VERIFIED-SOURCE): these are structural invariants,
 * not behaviour, and none of them needs a database to check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const SERVER = resolve(__dirname, '..');
const REPO = resolve(SERVER, '..');
const read = (...p: string[]) => readFileSync(resolve(SERVER, ...p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// 1. The canonical rails keep their guards
// ─────────────────────────────────────────────────────────────────────────────

describe('M4 — canonical refund rails keep their idempotency guards', () => {
  it('RefundService refuses to run without an idempotency key', () => {
    const src = read('services', 'RefundService.ts');
    expect(src).toMatch(/REFUND_REQUIRES_IDEMPOTENCY_KEY/);
    expect(src).toMatch(/eq\(refundTransactions\.idempotencyKey, idempotencyKey\)/);
  });

  it('WalletLedger.refundToWallet refuses without a key and locks the account row', () => {
    const src = read('services', 'WalletLedger.ts');
    expect(src).toMatch(/REFUND_REQUIRES_IDEMPOTENCY_KEY/);
    expect(src).toMatch(/RELEASE_REQUIRES_IDEMPOTENCY_KEY/);
    expect(src).toMatch(/FROM wallet_accounts[\s\S]{0,120}FOR UPDATE/);
  });

  it('EscrowService.refundEscrowPayment refunds only a held escrow, inside a transaction', () => {
    const src = read('services', 'EscrowService.ts');
    expect(src).toMatch(/runTransaction/);
    expect(src).toMatch(/Cannot refund escrow with status/);
  });

  it('ProviderPayoutService cancel-and-refund compare-and-sets on in_escrow', () => {
    const src = read('services', 'ProviderPayoutService.ts');
    expect(src).toMatch(/eq\(superAppPayouts\.status, 'in_escrow'\)/);
    expect(src).toMatch(/refund:escrow:\$\{payoutId\}/);
  });

  it('EscrowStateMachine compare-and-sets the from-status (M1)', () => {
    const src = read('services', 'EscrowStateMachine.ts');
    expect(src).toMatch(/eq\(billingRecords\.paymentFlowStatus, fromStatus\)/);
    expect(src).toMatch(/EscrowConcurrentTransitionError/);
  });

  it('refund_transactions.idempotencyKey stays UNIQUE NOT NULL', () => {
    const schema = readFileSync(resolve(REPO, 'shared', 'schema.ts'), 'utf8');
    expect(schema).toMatch(
      /idempotencyKey:\s*varchar\("idempotency_key",\s*\{\s*length:\s*255\s*\}\)\.unique\(\)\.notNull\(\)/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The bypass list may shrink, never grow
// ─────────────────────────────────────────────────────────────────────────────

/** Walk server/ collecting .ts files, skipping tests and node_modules. */
function serverSources(dir = SERVER, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) serverSources(full, acc);
    else if (name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

/**
 * Files allowed to add to `cash_wallet_balance_cents` in raw SQL.
 *
 * `WalletLedger.ts` is the canonical rail and belongs here permanently.
 * The other three are the KNOWN bypasses (B1–B4 in the inventory doc). They are
 * listed so that a NEW one fails this test — not because they are acceptable.
 */
const KNOWN_RAW_WALLET_CREDIT_FILES = new Set([
  'services/WalletLedger.ts',            // canonical rail — hash-chained, keyed, FOR UPDATE
  'services/BookingPolicyEngine.ts',     // B1 — dormant, no key/ledger/tx
  'routes/bookings.ts',                  // B3 — live, ON CONFLICT is not a dedupe
  'routes/disputes.ts',                  // B4 — transactional + escrow CAS, missing ledger row
  // B2 (routes/walk-my-pet.ts) was REMOVED from this list on 2026-09-05: main
  // fixed it independently while this branch was out (see the B2 test below).
]);

describe('M4 — no NEW raw-SQL wallet-credit bypass', () => {
  it('only the known files add to cash_wallet_balance_cents in raw SQL', () => {
    const offenders = new Set<string>();
    for (const file of serverSources()) {
      const src = readFileSync(file, 'utf8');
      // `SET cash_wallet_balance_cents = … + …` or an ON CONFLICT upsert of it.
      if (/cash_wallet_balance_cents\s*=\s*[^,;]*(\+|EXCLUDED)/.test(src)) {
        offenders.add(file.slice(SERVER.length + 1));
      }
    }
    const unexpected = [...offenders].filter((f) => !KNOWN_RAW_WALLET_CREDIT_FILES.has(f));
    expect(
      unexpected,
      'A new raw-SQL wallet credit was added. Route it through ' +
      'WalletLedger.refundToWallet (keyed, FOR UPDATE, hash-chained) instead, ' +
      'or add it to the inventory doc and this list with a written reason.',
    ).toEqual([]);
    // Re-verified against main 2026-09-05 (615 commits after this branch was
    // cut): still exactly these files — the 615 commits added NO new raw-SQL
    // wallet credit.
  }, 30_000); // walks + reads every server/**/*.ts; the default 5s now times out

  it('the remaining known bypasses are still named in the inventory doc', () => {
    // If one gets FIXED, delete it from the set above and mark it fixed in the
    // doc. This assertion keeps the doc and the code honest with each other.
    const doc = readFileSync(
      resolve(REPO, 'docs', 'architecture', 'refund-writer-inventory-2026-08-17.md'),
      'utf8',
    );
    for (const f of ['BookingPolicyEngine.ts', 'bookings.ts', 'disputes.ts']) {
      expect(doc).toContain(f);
    }
    // B2 must be recorded as fixed, not silently deleted.
    expect(doc).toContain('walk-my-pet.ts');
    expect(doc).toMatch(/B2[\s\S]{0,400}FIXED ON MAIN/);
  });

  it('B2 (walk-my-pet walker-decline) stays fixed — no raw wallet credit returns', () => {
    // Fixed on main by the 2026-08-20 evil-hunt: the old raw
    // `cash_wallet_balance_cents + totalCents` on a walker-decline of a PENDING
    // walk minted wallet credit from nothing (no money had been captured).
    const src = read('routes', 'walk-my-pet.ts');
    expect(src).not.toMatch(/cash_wallet_balance_cents\s*=\s*[^,;]*(\+|EXCLUDED)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. escrow_holdings terminal-status guards must stay
// ─────────────────────────────────────────────────────────────────────────────

describe('M4 — escrow_holdings terminal-status guards', () => {
  it('booking-expiry never voids a released or refunded holding (M3)', () => {
    const src = read('jobs', 'booking-expiry.ts');
    expect(src).toMatch(/notInArray\(escrowHoldings\.status, \[\.\.\.ESCROW_TERMINAL_STATUSES\]\)/);
  });

  it('disputes keeps the reference CAS on escrow_holdings', () => {
    const src = read('routes', 'disputes.ts');
    expect(src).toMatch(/status NOT IN \('refunded', 'released'\)/);
  });

  it('admin escrow reconciliation keeps its downgrade protection', () => {
    const src = read('routes', 'admin-escrow-reconciliation.ts');
    expect(src).toMatch(/DOWNGRADE_PROTECTED/);
    expect(src).toMatch(/'released'/);
    expect(src).toMatch(/'refunded'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Known-open items — pinned so a "fix" that only half-lands is visible
// ─────────────────────────────────────────────────────────────────────────────

describe('M4 — known-open bypasses are still where the doc says they are', () => {
  it('the nayax webhook escrow voids remain UNGUARDED (B5–B8) — documented, not fixed', () => {
    const src = read('routes', 'nayax-webhooks.ts');
    // Three drizzle voids with a bookingId-only WHERE. If someone guards them,
    // this count drops and the test fails LOUDLY so the doc gets updated.
    const unguarded = src.match(
      /\.update\(escrowHoldings\)\s*\n\s*\.set\(\{ status: 'refunded'[\s\S]{0,120}?\.where\(eq\(escrowHoldings\.bookingId/g,
    ) ?? [];
    expect(
      unguarded.length,
      'nayax-webhooks escrow voids changed. If you FIXED them (good), update ' +
      'docs/architecture/refund-writer-inventory-2026-08-17.md B5–B7 and this pin.',
    ).toBe(3);
  });

  it('the prestige-pass Date.now() keys are still present (B9–B11) — needs a finance decision', () => {
    const src = read('routes', 'prestige-pass.ts');
    const clockKeys = src.match(/idempotencyKey(Suffix)?[^\n]*\$\{Date\.now\(\)\}/g) ?? [];
    expect(
      clockKeys.length,
      'prestige-pass clock-derived idempotency keys changed. Fixing these is a ' +
      'finance decision (they exist to allow repeated partial refunds) — update ' +
      'the inventory doc B9–B11 with the decision.',
    ).toBe(1); // was 3 when this branch was cut; main fixed 2 of 3 — see below
  });

  it('B10 + B11 stay FIXED — main made two of the three keys deterministic', () => {
    // Fixed on main by #2115 "F3 over-refund cap + F4 deterministic idempotency
    // (3 sites)" while this branch was out. Pinned so they cannot regress to a
    // clock-derived key, which would make every retry a fresh refund.
    const src = read('routes', 'prestige-pass.ts');
    expect(src).toMatch(/wallet:support:refund:\$\{bookingType\}:\$\{booking\.booking_id\}:\$\{refundCents\}/);
    expect(src).toMatch(/wallet:approval:refund:\$\{bookingType\}:\$\{booking\.booking_id\}:\$\{approvalId\}/);
  });

  it('B12 — BookingLifecycleService.settleEscrowTerminal is still UNGUARDED (new, pre-existing)', () => {
    // Found 2026-09-05 while re-verifying this inventory against main. NOT
    // introduced by the 615 commits — it predates this branch and was simply
    // missed by the original sweep.
    //
    // settleEscrowTerminal reads the holding, decides in JS via
    // planEscrowOnTerminal(escrow.status), then issues an UNCONDITIONAL
    // `UPDATE escrow_holdings SET status='refunded' WHERE id = <id>`. That is
    // the exact M3/M1 defect shape: two concurrent terminal transitions both
    // read 'held', both pass the skip check, both write 'refunded' and both
    // append a BOOKING_ESCROW_REFUNDED audit row — and a holding that was
    // RELEASED between the read and the write is overwritten as refunded.
    //
    // Its sibling scheduleEscrowRelease in the SAME file already does it
    // correctly (CAS on status='held' + .returning()), which is what makes
    // this a gap rather than a deliberate design.
    //
    // Deliberately NOT fixed here: this branch is a rebase + re-verify, and a
    // new money write belongs in its own reviewed PR. Frozen so it cannot be
    // forgotten again.
    const src = read('services', 'BookingLifecycleService.ts');
    const settle = src.match(/private async settleEscrowTerminal\([\s\S]{0,2000}/)?.[0] ?? '';
    expect(settle, 'settleEscrowTerminal not found').not.toBe('');
    expect(settle).toMatch(/planEscrowOnTerminal\(escrow\.status\)/);
    expect(
      settle,
      'settleEscrowTerminal appears to have been GUARDED (good) — remove this ' +
      'pin and mark B12 fixed in the inventory doc.',
    ).toMatch(/\.where\(eq\(escrowHoldings\.id, escrow\.id\)\)/);
    // The correctly-guarded sibling, for contrast — it must not regress.
    expect(src).toMatch(/eq\(escrowHoldings\.bookingId, bookingId\), eq\(escrowHoldings\.status, 'held'\)/);
  });
});
