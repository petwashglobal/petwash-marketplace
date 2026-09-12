/**
 * ONE member id (2026-09-12).
 *
 * Six "member numbers" were shown to the same human depending on the surface.
 * The canonical, for-life number is the membership-card id
 * (MembershipCardService, printed on the physical card). Every other surface
 * now DISPLAYS it; internal keys stay internal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('one member id', () => {
  it('server/lib/memberIdentity is the single resolver, issuing the card on first use', () => {
    const src = R('server/lib/memberIdentity.ts');
    expect(src).toContain('export async function findMemberIdentity(');
    expect(src).toContain('export async function ensureMemberIdentity(');
    expect(src).toContain('MembershipCardService.getOrCreateCard(userId, cardTierFromMemberTier(memberTier))');
  });
  it('Apple + Google passes show the card id as MEMBER ID (pass id only as fallback)', () => {
    expect(R('server/services/AppleWalletService.ts')).toContain("value: visual.memberId ?? visual.passId");
    expect(R('server/services/GoogleWalletService.ts')).toContain("body: visual.memberId ?? visual.passId");
  });
  it('the pass HTML page, the pass e-mail/SMS, and the live pass sync carry the card id', () => {
    const pu = R('server/routes/pass-universal.ts');
    expect(pu).toContain("<div class=\"id\">${escapeHtml(pass.memberId ?? pass.passId)}</div>");
    expect(pu).toContain("memberId: (await findMemberIdentity(pass.userId))?.memberId ?? null");
    const pt = R('server/lib/passTokens.ts');
    expect(pt).toContain('member_id:          record.memberId ?? record.passId');
    expect(pt).toContain('`Member ID: ${record.memberId ?? record.passId}`');
    const ws = R('server/services/walletPassSync.ts');
    expect(ws).toContain('memberId:           pass.memberId ?? undefined');
  });
  it('/api/prestige-pass/wallet returns the card id (not a serial tail) plus identity-only card data', () => {
    const src = R('server/routes/prestige-pass.ts');
    expect(src).toContain('const memberIdentity = await ensureMemberIdentity(userId, tier);');
    expect(src).toContain('const cardId      = memberIdentity?.memberId ?? `PW-${raw8}`;');
    expect(src).toContain('memberCard: memberIdentity ? {');
    // legacy Apple builder on this router carries it too
    expect(src.match(/memberId:\s+legacyMemberId,/g)?.length).toBe(2);
  });
  it('welcome messages name the card id, never a uid tail first', () => {
    expect(R('server/routes/loyalty.ts')).toContain("(await ensureMemberIdentity(userId, 'bronze'))?.memberId ??");
    expect(R('server/routes/prestige-join.ts')).toContain('(await ensureMemberIdentity(userId, tierKey))?.memberId ?? memberId ??');
  });
  it('the pass page shows one number everywhere and a separate "Scan to Identify" block', () => {
    const src = R('client/src/pages/PrestigePassWallet.tsx');
    expect(src).not.toMatch(/\{pass\.serialNumber\}/);
    expect(src.match(/canonicalMemberId\(walletData, pass\)/g)?.length).toBe(3);
    expect(src).toContain('data-testid="prestige-scan-to-identify"');
    expect(src).toContain("'Scan to Identify — membership card'");
    expect(src).toContain('<MemberCardBack');
  });
});
