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

  it('composer runs the abandoned-journey probe last on the pet-parent path (Phase 2 wire)', () => {
    // The probe fails-CLOSED to [] when the checkpoint store is
    // empty (in-memory default) so its presence in the pipe is
    // always safe. When PgCheckpointStore lands it activates.
    expect(SRC).toMatch(/\.\.\.await petParentAbandonedJourneyItems\(userId, he\),/);
  });

  it('abandoned-journey probe reads via getDefaultCheckpointStore and filters to a 7-day window', () => {
    expect(SRC).toContain('getDefaultCheckpointStore()');
    // The 7-day window is doctrine, not incidental. A refactor that
    // silently changed it to 30 days would flood the user's feed.
    expect(SRC).toMatch(/sevenDaysMs\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    // Covers the four pet-parent wizard families.
    for (const kind of ['CHECKOUT', 'SHOP_CART', 'EGIFT_PURCHASE', 'BOOKING_REQUEST']) {
      expect(SRC).toContain(kind);
    }
  });

  it('composer concatenates the booking + payout + doc-expiry + application-status probes on the provider path', () => {
    expect(SRC).toMatch(/\.\.\.await providerBookingItems\(userId, he\),\s*\n\s*\.\.\.await providerPayoutItems\(userId, he\),\s*\n\s*\.\.\.await providerDocExpiryItems\(userId, he\),\s*\n\s*\.\.\.await providerApplicationStatusItems\(userId, he\),/);
  });

  it('provider application-status probe reads the most-recent row by userId + branches on status', () => {
    // Ownership: MUST filter by userId — a shared query would leak
    // a stranger's application status.
    expect(SRC).toMatch(/eq\(providerApplications\.userId, userId\)/);
    // Most recent wins.
    expect(SRC).toMatch(/orderBy\(desc\(providerApplications\.createdAt\)\)\s*\.limit\(1\)/);
    // Approved / withdrawn → no item (empty feed for happy path).
    expect(SRC).toMatch(/if \(status === 'approved' \|\| status === 'withdrawn'\) return \[\];/);
    // Priorities: suspended + rejected → urgent, changes_requested / documents_required → due_soon,
    // under_review / draft → informational.
    expect(SRC).toContain("case 'suspended'");
    expect(SRC).toContain("case 'rejected'");
    expect(SRC).toContain("case 'changes_requested'");
    expect(SRC).toContain("case 'documents_required'");
    expect(SRC).toContain("case 'under_review'");
    expect(SRC).toContain("case 'draft'");
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
    // visibility on the customer home. Adjacency check: Wallet lives
    // directly before Prestige.
    expect(SRC).toMatch(/\.\.\.await petParentWalletItems\(userId, he\),\s*\n\s*\.\.\.await petParentPrestigeItems\(userId, he\),/);
  });

  it('KYA-stale probe treats NULL medical_consent_updated_at as maximally stale', () => {
    // A pet with a NULL review timestamp has NEVER been reviewed — that
    // is more urgent than a 100-day-old review, not less. Pin the
    // ordering rule.
    expect(SRC).toMatch(/const stale = !r\.medicalConsentUpdatedAt \|\| \(nowMs - ts\) > STALE_MS;/);
    // NULL → ts=0 → sorts oldest, so it wins the reason copy.
    expect(SRC).toMatch(/const ts = r\.medicalConsentUpdatedAt \? new Date\(r\.medicalConsentUpdatedAt\)\.getTime\(\) : 0;/);
  });

  it('KYA-stale probe emits ONE consolidated item (CEO §59 frequency control)', () => {
    // Regression: an earlier draft emitted one item per pet. A user
    // with 4 stale pets would then see 4 identical cards. Pin the
    // single-item shape by asserting the function returns an array
    // containing exactly one literal object.
    expect(SRC).toMatch(/return \[\{\s*\n\s*id: `pet_passport:kya_stale:\$\{userId\}`/);
    // And the domain contract matches AttentionDomain.
    expect(SRC).toMatch(/domain: 'pet_passport'/);
  });

  it('KYA-stale probe fails-CLOSED on DB error', () => {
    expect(SRC).toMatch(/\[AttentionFeed\] pet-parent kya-stale probe failed/);
    expect(SRC).toMatch(/logger\.warn\('\[AttentionFeed\] pet-parent kya-stale probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
  });

  it('composer concatenates the KYA-stale probe on the pet-parent branch', () => {
    expect(SRC).toMatch(/\.\.\.await petParentPrestigeItems\(userId, he\),\s*\n\s*\.\.\.await petParentKyaStaleItems\(userId, he\),/);
  });

  it('Wallet probe reads canonical wallet_accounts by user_id — never invents balance (CEO §46)', () => {
    // Ownership: user_id must equal the caller. Balance fields read
    // DIRECTLY off the row — no arithmetic, no invented value.
    expect(SRC).toMatch(/eq\(walletAccounts\.userId, userId\)/);
    expect(SRC).toMatch(/const cashCents = Number\(r\.cashWalletBalanceCents \?\? 0\);/);
    expect(SRC).toMatch(/const washCredits = Number\(r\.washPackageCredits \?\? 0\);/);
    // Signal threshold: zero + zero → no item.
    expect(SRC).toMatch(/if \(!hasCash && !hasPackages\) return \[\];/);
    // AttentionItem uses the wallet domain contract.
    expect(SRC).toMatch(/domain: 'wallet'/);
  });

  it('Wallet probe surfaces cash balance via moneySummary only when cashCents > 0', () => {
    // The card's moneySummary carries the amount in CENTS. A wallet
    // with only wash-package credits must not fabricate a cash number.
    expect(SRC).toMatch(/moneySummary: hasCash\s*\n\s*\? \{ amountCents: cashCents, currency: 'ILS', label:[^}]+\}\s*\n\s*: undefined,/);
  });

  it('Wallet probe fails-CLOSED on DB error', () => {
    expect(SRC).toMatch(/\[AttentionFeed\] pet-parent wallet probe failed/);
    expect(SRC).toMatch(/logger\.warn\('\[AttentionFeed\] pet-parent wallet probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
  });

  it('composer concatenates the Wallet probe between eGift and Prestige on the pet-parent branch', () => {
    expect(SRC).toMatch(/\.\.\.await petParentEgiftItems\(userId, he\),\s*\n\s*\.\.\.await petParentWalletItems\(userId, he\),\s*\n\s*\.\.\.await petParentPrestigeItems\(userId, he\),/);
  });

  it('provider payout probe reads canonical provider_payout_entries WHERE status=earned + unpaid — never mutates', () => {
    // Ownership: provider_uid must equal the caller. Status filter:
    // only 'earned' (not 'paid' or 'held' or 'reversed'). The sum is
    // computed server-side from netCents. A refactor that started
    // writing to this table reintroduces the whole class of CEO §46
    // "AI never edits the ledger" bugs.
    expect(SRC).toMatch(/eq\(providerPayoutEntries\.providerUid, userId\)/);
    expect(SRC).toMatch(/eq\(providerPayoutEntries\.status, 'earned'\)/);
    // Aggregation is defensive: non-finite / non-positive net drops
    // instead of throwing.
    expect(SRC).toMatch(/if \(Number\.isFinite\(c\) && c > 0\) sum \+= c;/);
    expect(SRC).toMatch(/if \(sum <= 0\) return \[\];/);
    // Domain contract.
    expect(SRC).toMatch(/domain: 'wallet',\s*\n\s*entityId: userId,\s*\n\s*priority: 'informational',/);
  });

  it('provider payout probe fails-CLOSED on DB error', () => {
    expect(SRC).toMatch(/\[AttentionFeed\] provider payout probe failed/);
    expect(SRC).toMatch(/logger\.warn\('\[AttentionFeed\] provider payout probe failed'[\s\S]*?return \[\];\s*\n\s*\}/);
  });

  it('provider payout destination is /provider/earnings (mounted client route)', () => {
    expect(SRC).toContain("destination: '/provider/earnings'");
  });
});
