/**
 * Gift-card art wired (2026-09-13).
 *
 * The CEO's four physical gift-card designs (pink ₪100, green ₪250, black
 * ₪500, gold ₪1000) sat in attached_assets referenced by nothing; the buy page
 * offered 50/100/200/500/1000 with no card visual. The amounts now match the
 * cards, the chosen amount previews its card, and the art ships from
 * client/public (CDN), not from the attached_assets static mount.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('gift-card art', () => {
  it('the four designs ship with the client', () => {
    for (const f of ['pink-100', 'green-250', 'black-500', 'gold-1000']) {
      expect(existsSync(resolve(__dirname, '..', '..', `client/public/brand/gift-cards/${f}.jpg`)), f).toBe(true);
    }
  });
  it('the buy page offers the card denominations and previews the chosen card', () => {
    const src = R('client/src/pages/BuyGiftCard.tsx');
    expect(src).toContain('const predefinedAmounts = [50, 100, 250, 500, 1000];');
    expect(src).toContain('data-testid="gift-card-art"');
    expect(src).toContain("'/brand/gift-cards/gold-1000.jpg'");
    expect(src).toContain("'/brand/gift-cards/pink-100.jpg'");
  });
  it('the soft-launch (coming soon) screen shows the four designs too', () => {
    const src = R('client/src/pages/BuyGiftCard.tsx');
    expect(src).toContain('data-testid="gift-card-art-preview"');
    expect(src.indexOf('data-testid="gift-card-art-preview"')).toBeLessThan(src.indexOf('Back to Home'));
  });
});
