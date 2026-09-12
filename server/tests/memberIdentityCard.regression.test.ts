import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cardTierFromMemberTier, CARD_VALIDITY_YEARS } from '../services/MembershipCardService';

/**
 * Member-card identity audit 2026-09-12 (CEO's Platinum Privilege card design):
 *  - every card was issued "standard": the route read req.user.loyaltyTier,
 *    a field requireAuth never sets
 *  - VALID THRU had no writer; the dashboard invented an expiry client-side
 *  - every wallet pass carried the literal tier 'PREMIUM'
 *  - Google Wallet pointed at /logo.png instead of the official brand asset
 *  - "Membership card only — not a credit card" existed only as a code comment
 *  - /adopt (what the CEO types) was a 404; the page lives at /adoption
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('one tier bridge, card follows the member', () => {
  it('maps the canonical member tier onto the card tiers', () => {
    expect(cardTierFromMemberTier('platinum')).toBe('platinum');
    expect(cardTierFromMemberTier('gold')).toBe('gold');
    expect(cardTierFromMemberTier('black')).toBe('vip');
    expect(cardTierFromMemberTier('diamond')).toBe('vip');
    expect(cardTierFromMemberTier('new')).toBe('standard');
    expect(cardTierFromMemberTier(undefined)).toBe('standard');
  });
  it('the route resolves the tier from the user row + Prestige enrolment, and the service syncs it', () => {
    const r = R('server/routes/membership-cards.ts');
    expect(r).toContain('const memberTier = await resolveMemberTier(');
    expect(r).toContain('const tier = cardTierFromMemberTier(memberTier);');
    expect(r).not.toMatch(/user\?\.loyaltyTier as string/);
    const s = R('server/services/MembershipCardService.ts');
    expect(s).toContain('if (existing.tier !== tier) {');
    expect(s).toContain('.set({ tier })');
  });
});

describe('VALID THRU is real', () => {
  it('written at issue, 5 years, end of month', () => {
    expect(CARD_VALIDITY_YEARS).toBe(5);
    const s = R('server/services/MembershipCardService.ts');
    expect(s).toContain('const validUntil = new Date(validFrom.getFullYear() + CARD_VALIDITY_YEARS, validFrom.getMonth() + 1, 0, 23, 59, 59);');
    expect(s).toMatch(/cardStatus: "active", validFrom, validUntil \}/);
    const d = R('client/src/pages/Dashboard.tsx');
    expect(d).toContain("const fromCard = memberCard?.validUntil ? new Date(memberCard.validUntil) : null;");
  });
});

describe('the wallet pass tells the truth', () => {
  it('pass tier is the resolved member tier, not PREMIUM; Google logo is the official asset', () => {
    const pp = R('server/routes/prestige-pass.ts');
    expect(pp).not.toContain("tier: 'PREMIUM'");
    expect(pp).toContain('const passTier = tierLabel(await resolveMemberTier(');
    expect(pp).toContain('tier: passTier, appleSerialNumber, googleObjectId,');
    const g = R('server/services/GoogleWalletService.ts');
    expect(g).toContain("uri: 'https://petwash.co.il/brand/petwash-logo-official.png'");
    expect(g).not.toContain("uri: 'https://petwash.co.il/logo.png'");
  });
});

describe('card copy + entry routes', () => {
  it('the digital card carries the "membership card only" line in both languages', () => {
    const d = R('client/src/pages/Dashboard.tsx');
    expect(d).toContain('data-testid="text-card-legal"');
    expect(d).toContain('כרטיס חבר בלבד — לא כרטיס אשראי');
    expect(d).toContain('Membership card only — not a credit card');
  });
  it('/adopt and /adopt-pet redirect to /adoption', () => {
    const app = R('client/src/App.tsx');
    expect(app).toContain('<Route path="/adopt">{() => <Redirect to="/adoption" />}</Route>');
    expect(app).toContain('<Route path="/adopt-pet">{() => <Redirect to="/adoption" />}</Route>');
  });
});
