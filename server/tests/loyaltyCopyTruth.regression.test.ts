/**
 * PR-LOYALTY-COPY-TRUTH — fire-order items 38 + 39.
 *
 * (38) tier expiration: sourced from a grep across server/services and
 *      server/routes — NO tier expiration / downgrade / expiry timer
 *      logic exists. "Status never expires" (public /loyalty copy) is
 *      TRUE at source. VERIFIED-SOURCE, no code change needed on that
 *      item.
 *
 * (39) points on every service: backend awardLoyaltyPoints in
 *      server/services/loyaltyEarn.ts is called only from
 *        server/routes/booking-requests.ts:2918  (sitter / walker)
 *        server/routes/nayax-webhooks.ts:1096    (K9000 washes)
 *        server/routes/nayax-monyx-events.ts:372 (Nayax monyx card)
 *      There is NO call from the eGift purchase path. "Earn points on
 *      every service" was broader than truth. Scoped to "eligible
 *      services" in both i18n copy blocks.
 *
 * Bonus contradiction found while investigating (same class of "public
 * wording vs backend truth"):
 *
 *      LoyaltyTiers.tsx:253 said "10 points per ₪1 spent"
 *      loyaltyEarn.ts:22   POINTS_PER_SHEKEL = 1
 *      → UI over-promised the accrual rate 10x. Aligned display to
 *        "1 point per ₪1 spent" so the customer's ledger matches what
 *        they see.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-LOYALTY-COPY-TRUTH', () => {
  const i18n = read('client/src/lib/i18n.ts');
  const tiers = read('client/src/pages/LoyaltyTiers.tsx');
  const earn = read('server/services/loyaltyEarn.ts');

  it('A1. privilege.benefit2 says "eligible services" (not "every service")', () => {
    const line = i18n.split(/\r?\n/).find(l => l.includes("'privilege.benefit2'")) || '';
    expect(line.includes("Earn points on eligible services")).toBe(true);
    expect(line.includes("צבירת נקודות בשירותים מזכים")).toBe(true);
    expect(line.includes("Earn points on every service")).toBe(false);
    expect(line.includes("צבירת נקודות על כל שירות")).toBe(false);
  });

  it('A2. privilege.pillarRewardsDesc uses same "eligible" scope', () => {
    const line = i18n.split(/\r?\n/).find(l => l.includes("'privilege.pillarRewardsDesc'")) || '';
    expect(line.includes("on eligible services")).toBe(true);
    expect(line.includes("בשירותים מזכים")).toBe(true);
    expect(line.includes("Prestige Credits on every service")).toBe(false);
  });

  it('B1. LoyaltyTiers per-shekel rate matches backend POINTS_PER_SHEKEL', () => {
    // Backend authoritative rate.
    expect(/export\s+const\s+POINTS_PER_SHEKEL\s*=\s*1\b/.test(earn)).toBe(true);
    // Display: 1 point per ₪1 (matches backend).
    expect(tiers.includes('1 point per ₪1 spent')).toBe(true);
    expect(tiers.includes('נקודה אחת לכל ₪1')).toBe(true);
    // Anti-regression: the 10x over-promise must not reappear.
    expect(tiers.includes('10 points per ₪1 spent')).toBe(false);
    expect(tiers.includes('10 נקודות לכל ₪1')).toBe(false);
  });
});
