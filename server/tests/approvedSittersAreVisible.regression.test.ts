import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/**
 * 2026-09-13 — an approved sitter was invisible, and a dispute refund could not
 * complete. Both are the same shape: one side of the system writes a fact the
 * other side never reads.
 */

describe('approving a sitter makes them findable', () => {
  const seed = read('server/services/providerProfileSeed.ts');

  it('the sitter insert plan sets the status search reads', () => {
    // The plan object for sitter_suite must set verificationStatus, not only
    // verificationLevel. The column defaults to 'pending_id'.
    const at = seed.indexOf("} else if (platformId === 'sitter_suite') {");
    expect(at, 'sitter branch not found').toBeGreaterThan(-1);
    const end = seed.indexOf("} else if (platformId === 'academy')", at);
    const branch = seed.slice(at, end);
    expect(branch, 'sitter plan does not set verificationStatus').toContain("verificationStatus: 'active'");
  });

  it('the existing-sitter update sets it too', () => {
    const at = seed.indexOf('if (plan.sitter) {');
    expect(at).toBeGreaterThan(-1);
    const branch = seed.slice(at, seed.indexOf('if (plan.trainer) {', at));
    expect(branch).toContain("verificationStatus: 'active'");
    expect(branch).toContain('isActive: true');
  });

  it('every sibling platform still sets its own status — this was the tell', () => {
    expect(seed).toContain("verificationStatus: 'verified'"); // walker
    expect(seed).toContain("verificationStatus: 'approved'"); // trainer
  });

  it('all three readers still agree on the value the seed writes', () => {
    for (const f of [
      'server/routes/booking-search.ts',
      'server/services/SitterProximitySearch.ts',
      'server/jobs/booking-expiry.ts',
    ]) {
      expect(read(f), `${f} no longer filters on 'active'`).toContain(
        "eq(sitterProfiles.verificationStatus, 'active')",
      );
    }
  });

  it('search does not offer a sitter who has no rate card', () => {
    const src = read('server/routes/booking-search.ts');
    expect(src, 'unpriced sitters are still listed').toContain('gt(sitterProfiles.pricePerDayCents, 0)');
    expect(src, 'gt is not imported').toMatch(/import \{[^}]*\bgt\b[^}]*\} from 'drizzle-orm'/);
  });
});

describe('dispute refunds reach the wallet and the ledger', () => {
  const src = read('server/routes/disputes.ts');

  it('the wallet bootstrap conflicts on user_id, not wallet_id', () => {
    // wallet_id is minted differently here than in WalletService, and user_id
    // carries its own UNIQUE constraint — so conflicting on wallet_id let the
    // insert hit that index and abort the whole transaction.
    expect(src).not.toContain('ON CONFLICT (wallet_id) DO NOTHING');
    expect((src.match(/ON CONFLICT \(user_id\) DO NOTHING/g) || []).length).toBe(2);
  });

  it('both credit paths write a credit_transactions row', () => {
    expect((src.match(/writeDisputeLedgerRow\(client, \{/g) || []).length).toBe(2);
    expect(src).toContain('INSERT INTO credit_transactions');
  });

  it('the ledger row is written with the caller transaction client', () => {
    // Writing it outside the transaction would let it survive the rollback
    // that the conditional escrow UPDATE relies on.
    expect(src).toMatch(/async function writeDisputeLedgerRow\(\s*client:/);
    expect(src).toContain('await client.query(');
  });

  it('the ledger row is keyed by the dispute, so a retry cannot double-write', () => {
    expect(src).toContain('`TXN-DISPUTE-${args.disputeId}`');
    expect(src).toContain('ON CONFLICT (transaction_id) DO NOTHING');
  });

  it('a missing wallet row fails the transaction instead of being papered over', () => {
    expect(src).toContain('DISPUTE_REFUND_NO_WALLET');
  });

  it('every wallet credit returns the row the ledger entry is built from', () => {
    const credits = src.match(/SET cash_wallet_balance_cents = cash_wallet_balance_cents \+ \$1/g) || [];
    expect(credits.length, 'unexpected number of wallet credits in this file').toBe(2);
    const returning = src.match(/RETURNING wallet_id, cash_wallet_balance_cents/g) || [];
    expect(returning.length, 'a credit does not RETURNING its wallet row').toBe(2);
  });
});
