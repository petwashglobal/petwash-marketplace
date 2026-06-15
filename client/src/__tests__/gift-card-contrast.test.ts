/**
 * Gift-card text must stay readable (WCAG contrast — older customers, luxury feel).
 *
 * Regression guard: the E-Gift price was rendered in #F0EBE0 (near-white cream on
 * a white card → ~1.1:1, effectively invisible), and the homepage gift section used
 * #aaa / #999 text (~2.3–2.8:1). These must never come back on a white surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  path.join(ROOT, 'pages', 'EGift.tsx'),
  path.join(ROOT, 'components', 'GiftCards.tsx'),
];

describe('gift-card readability', () => {
  for (const f of FILES) {
    const src = fs.readFileSync(f, 'utf8');
    const name = path.basename(f);

    it(`${name}: no near-white cream text (#F0EBE0) on the card`, () => {
      expect(src).not.toMatch(/text-\[#F0EBE0\]/i);
    });

    it(`${name}: no sub-AA faded grays (#aaa / #999 / #888) as text`, () => {
      expect(src).not.toMatch(/text-\[#aaa\]/i);
      expect(src).not.toMatch(/text-\[#999\]/i);
      expect(src).not.toMatch(/text-\[#888\]/i);
    });
  }
});
