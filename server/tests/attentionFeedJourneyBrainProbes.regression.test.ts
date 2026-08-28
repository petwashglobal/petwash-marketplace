/**
 * CEO MASTER DIRECTIVE — Journey Brain 2026-08-28 §2 + §80 Phase 1.
 *
 * The attention composer is the ONE contract every home surface reads.
 * Phase 1 expands it beyond bookings into eGift + provider document
 * expiry. Each new probe must:
 *   * read canonical truth (never invent balance / expiry)
 *   * fail-CLOSED (returns [] on any error, never crashes composer)
 *   * emit a well-formed AttentionItem with a mounted destination
 *
 * This pin catches a refactor that drops a probe, that starts emitting
 * partial rows, or that reads the wrong ownership column and leaks
 * another user's balance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'attentionFeed.ts'),
  'utf8',
);

describe('attentionFeed — Journey Brain Phase 1 probes (CEO §2 + §80)', () => {
  it('composer concatenates BOTH the booking probe AND the eGift probe on the pet-parent path', () => {
    // Regression: a re-ordering that dropped one probe would silently
    // hide a whole domain from the customer's home feed. Pin both
    // reads on the same actor branch.
    expect(SRC).toMatch(/\.\.\.await petParentBookingItems\(userId, he\),\s*\n\s*\.\.\.await petParentEgiftItems\(userId, he\),/);
  });

  it('composer concatenates BOTH the booking probe AND the doc-expiry probe on the provider path', () => {
    expect(SRC).toMatch(/\.\.\.await providerBookingItems\(userId, he\),\s*\n\s*\.\.\.await providerDocExpiryItems\(userId, he\),/);
  });

  it('eGift probe reads owner_uid + status IN (CLAIMED, ACTIVE) + remaining > 0 — never invents balance', () => {
    // Ownership: owner_uid must match the caller. Any change that
    // dropped this WHERE would cross-user leak an unrelated voucher.
    expect(SRC).toMatch(/eq\(eVouchers\.ownerUid, userId\)/);
    // Only claimed / active voucher status count.
    expect(SRC).toMatch(/inArray\(eVouchers\.status, \['CLAIMED', 'ACTIVE'\] as any\)/);
    // Non-zero remaining. A NULL / '0' row must NOT emit.
    expect(SRC).toMatch(/gt\(eVouchers\.remainingAmount, '0' as any\)/);
    // Extra defense-in-depth: mapper drops any non-finite / <=0 row.
    expect(SRC).toMatch(/if \(!Number\.isFinite\(remainingIls\) \|\| remainingIls <= 0\) return null;/);
  });

  it('eGift probe upgrades priority to due_soon when the voucher expires within 30 days', () => {
    // The customer's home should surface the expiry BEFORE the
    // voucher becomes worthless. 30 days is the CEO §80 phase-1
    // budget.
    expect(SRC).toMatch(/30 \* 24 \* 60 \* 60 \* 1000/);
    expect(SRC).toMatch(/const priority: AttentionItem\['priority'\] = expiringSoon \? 'due_soon' : 'informational';/);
  });

  it('doc-expiry probe emits ONE application row and iterates BOTH insurance + KYC-document expiry', () => {
    // Reads the most-recent provider_applications row for this user
    // (a resubmission does not double-alert).
    expect(SRC).toMatch(/\.where\(eq\(providerApplications\.userId, userId\)\)\s*\n\s*\.orderBy\(desc\(providerApplications\.createdAt\)\)\s*\n\s*\.limit\(1\)/);
    expect(SRC).toMatch(/emitExpiry\('insurance', r\.insuranceExpiresAt as any\);/);
    expect(SRC).toMatch(/emitExpiry\('kyc_document', r\.kycDocumentExpiry as any\);/);
  });

  it('doc-expiry probe flips priority to URGENT once already expired', () => {
    // 30-day due_soon window turns URGENT once the date is in the
    // past. A refactor that lost this distinction would let a
    // provider work while their insurance was already lapsed.
    expect(SRC).toMatch(/priority: isExpired \? 'urgent' : 'due_soon'/);
  });

  it('both probes are wrapped in try/catch that returns [] on ANY DB error (fail-CLOSED)', () => {
    // A partial DB outage must never nuke the whole feed. Each probe
    // must silently degrade to zero items.
    expect(SRC).toMatch(/\[AttentionFeed\] pet-parent egift probe failed/);
    expect(SRC).toMatch(/\[AttentionFeed\] provider doc-expiry probe failed/);
    // The catch bodies both return [].
    expect(SRC).toMatch(/logger\.warn\('\[AttentionFeed\] pet-parent egift probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
    expect(SRC).toMatch(/logger\.warn\('\[AttentionFeed\] provider doc-expiry probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
  });

  it('every emitted destination is a mounted client route (no dead taps)', () => {
    // Structural sanity — the eGift probe uses /egift/… which mounts
    // under /egift, and the doc-expiry probe uses
    // /provider-application/status which is mounted.
    expect(SRC).toContain("destination: `/egift/balance/${r.id}`");
    expect(SRC).toContain("destination: '/provider-application/status'");
    expect(SRC).toContain("destination: '/loyalty/dashboard'");
    // Guard against the legacy /provider/application/status typo the
    // destination validator caught during this cycle.
    expect(SRC).not.toMatch(/destination:\s*'\/provider\/application\/status'/);
  });

  it('Prestige probe reads canonical privilege_members — firebase_uid + status active — never invents a benefit', () => {
    // CEO §47: NEVER invent a benefit / discount / voucher. The probe
    // must only nudge to the loyalty dashboard where the redemption
    // engine speaks. Ownership: firebase_uid must equal userId. Status
    // filter: only active members surface.
    expect(SRC).toMatch(/eq\(privilegeMembers\.firebaseUid, userId\)/);
    expect(SRC).toMatch(/eq\(privilegeMembers\.status, 'active'\)/);
    // Skip signal: bronze + zero points → no home spam.
    expect(SRC).toMatch(/const hasSignal = \(tierRaw !== 'bronze'\) \|\| \(Number\.isFinite\(points\) && points > 0\);/);
    expect(SRC).toMatch(/if \(!hasSignal\) return \[\];/);
    // AttentionItem uses the prestige domain contract.
    expect(SRC).toMatch(/domain: 'prestige'/);
  });

  it('Prestige probe is wrapped in try/catch that returns [] on DB error (fail-CLOSED)', () => {
    expect(SRC).toMatch(/\[AttentionFeed\] pet-parent prestige probe failed/);
    expect(SRC).toMatch(/logger\.warn\('\[AttentionFeed\] pet-parent prestige probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
  });

  it('composer concatenates the Prestige probe on the pet-parent branch', () => {
    // Guard: a re-order that dropped this probe silently kills Prestige
    // visibility on the customer home.
    expect(SRC).toMatch(/\.\.\.await petParentBookingItems\(userId, he\),\s*\n\s*\.\.\.await petParentEgiftItems\(userId, he\),\s*\n\s*\.\.\.await petParentPrestigeItems\(userId, he\),/);
  });
});
