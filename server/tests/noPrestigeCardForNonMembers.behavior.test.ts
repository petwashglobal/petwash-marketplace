/**
 * CEO 2026-09-12, from his own screenshot of /pet-parent/home.
 *
 * nir.h@petwash.co.il is NOT enrolled in Prestige and every balance is zero.
 * The page showed him:
 *
 *   [ הצטרפו ל-Prestige  ]        ← "JOIN Prestige"
 *   ┌──────────────────────────┐
 *   │ 👑            PRESTIGE   │   ← crown + wordmark he has not earned
 *   │ [QR]   מספר חבר PW·YYXF  │   ← a live redeem QR
 *   │        הצג/י בעמדה למימוש │   ← "show at the bay to redeem"
 *   └──────────────────────────┘
 *   0 wash credits · 0 points · ₪0.00 wallet · ₪0.00 gift
 *
 * "no logic for me sorry" — correct. Join it, and also redeem it. With nothing.
 *
 * PrestigeHome's own header comment already promised the opposite:
 * "...only render when the user is actually enrolled ... instead of stolen
 * valor". The tier chip honoured that. The card never did.
 *
 * The money rail was never at risk — /token/redeem goes through
 * applySmartRedemption, which deducts from a real balance — so this is a trust
 * and coherence bug, not a money bug. It did burn a signed token and a
 * Firestore prestige_qr_tokens write every 110 seconds per idle non-member tab.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

async function loadRule() {
  const esbuild = await import('esbuild');
  const js = esbuild.transformSync(R('client/src/lib/redeemCardVisibility.ts'), {
    loader: 'ts',
    format: 'cjs',
  }).code;
  const module = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', js)(module, module.exports, require);
  return module.exports as typeof import('../../client/src/lib/redeemCardVisibility');
}

describe('the redeem card only appears when there is something to redeem', () => {
  it("the CEO's exact account — not enrolled, all balances zero — gets no card", async () => {
    const { redeemCardDecision } = await loadRule();
    const d = redeemCardDecision({
      prestigeEnrolled: false,
      washCredits: 0,
      cashCents: 0,
      giftCents: 0,
    });
    expect(d.show).toBe(false);
    expect(d.crowned).toBe(false);
  });

  it('an enrolled member always gets the card, and gets the crown', async () => {
    const { redeemCardDecision } = await loadRule();
    // Membership itself is redeemable at the bay (member pricing), so zero
    // balances must NOT hide the card from an actual member.
    const d = redeemCardDecision({ prestigeEnrolled: true, washCredits: 0, cashCents: 0, giftCents: 0 });
    expect(d.show).toBe(true);
    expect(d.crowned).toBe(true);
  });

  it('a non-member WITH value gets the card but never the crown', async () => {
    const { redeemCardDecision } = await loadRule();
    for (const bal of [
      { washCredits: 1 },
      { cashCents: 50 },
      { giftCents: 100 },
    ]) {
      const d = redeemCardDecision({ prestigeEnrolled: false, washCredits: 0, cashCents: 0, giftCents: 0, ...bal });
      expect(d.show, `${JSON.stringify(bal)} should show the card`).toBe(true);
      expect(d.crowned, `${JSON.stringify(bal)} must NOT be crowned`).toBe(false);
    }
  });

  it('junk balances are not credit', async () => {
    const { redeemCardDecision } = await loadRule();
    // normalizeSummary runs everything through Number(... ?? 0), so a malformed
    // field arrives as NaN. Neither NaN nor a negative balance is something to
    // offer at a bay.
    // +Infinity is the one the `> 0` comparison alone would let through, so it
    // is the value that actually pins the Number.isFinite guard.
    for (const bad of [NaN, -1, -0, null, undefined, -Infinity, Infinity]) {
      const d = redeemCardDecision({ prestigeEnrolled: false, washCredits: bad as any, cashCents: bad as any, giftCents: bad as any });
      expect(d.show, `${String(bad)} must not unlock the card`).toBe(false);
    }
    // ...but a real positive value still does, including a fractional credit.
    expect(redeemCardDecision({ prestigeEnrolled: false, cashCents: 0.5 }).show).toBe(true);
  });
});

describe('PrestigeHome actually applies the rule', () => {
  const page = () => R('client/src/pages/PrestigeHome.tsx');

  it('the card is rendered behind the gate', () => {
    const src = page();
    expect(src).toContain('redeemCardDecision');
    expect(src, 'card must be conditional').toMatch(/\{redeemCard\.show && \(/);
  });

  it('the crown and the PRESTIGE wordmark are behind the enrolment gate', () => {
    const src = page();
    const at = src.indexOf('data-testid="prestige-redeem-card"');
    expect(at, 'redeem card not found').toBeGreaterThan(-1);
    const card = src.slice(at, at + 1400);
    // Every PRESTIGE wordmark and every Crown inside the card must be guarded.
    const wordmarks = [...card.matchAll(/>PRESTIGE</g)];
    expect(wordmarks.length, 'expected the wordmark inside the card').toBe(1);
    expect(card).toMatch(/redeemCard\.crowned && \(\s*<span[^>]*>\s*PRESTIGE/s);
    expect(card).toMatch(/\{redeemCard\.crowned && <Crown/);
  });

  it('no QR token is minted for an account that cannot redeem', () => {
    const src = page();
    const at = src.indexOf("'/api/prestige-pass/token/generate'");
    expect(at).toBeGreaterThan(-1);
    // The FIRST `enabled:` after the token/generate marker is that query's own
    // (slicing to the next '});' catches the `{}` in the apiRequest call).
    const enabledAt = src.indexOf('enabled:', at);
    expect(enabledAt).toBeGreaterThan(-1);
    const line = src.slice(enabledAt, src.indexOf('\n', enabledAt));
    expect(line, 'the QR query still runs for everyone — it writes a Firestore doc every 110s')
      .toMatch(/enabled:\s*!!user\s*&&\s*redeemCard\.show/);
  });

  it('the decision is computed before the QR query, not after it', () => {
    const src = page();
    const decidedAt = src.indexOf('const redeemCard = redeemCardDecision(');
    const queryAt = src.indexOf("'/api/prestige-pass/token/generate'");
    expect(decidedAt).toBeGreaterThan(-1);
    expect(decidedAt, 'redeemCard must be in scope where the query is declared').toBeLessThan(queryAt);
  });

  it('normalizeSummary is still called exactly once', () => {
    // The decision needed `s` earlier in the component; a leftover second call
    // would be dead work on every render.
    expect(page().match(/normalizeSummary\(me, sum\)/g)?.length).toBe(1);
  });
});
