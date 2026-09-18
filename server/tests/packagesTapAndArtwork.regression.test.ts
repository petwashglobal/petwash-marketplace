/**
 * Live walkthrough 2026-09-18, /packages on an iPhone:
 *  - tapping ESSENTIALS ₪55 opened PREMIUM ₪220, and the ₪150 card's centre was
 *    intercepted by the ₪400 one: each card was wrapped in <Button>, whose own
 *    h-10 px-4 box (173×56) does not match the card that is drawn
 *  - the ₪150 three-wash card carried the GIFT-CARD artwork, printed
 *    "Gift Card Value: 250 Shekel"
 *  - "Maison Collection" was machine-translated to "קולקציית מזון" — a ₪400
 *    wash package sold in Hebrew as a "Food Collection"
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const src = read('client/src/pages/Packages.tsx');

describe('the tap target is the card', () => {
  it('each package card is a plain full-width button, not a shadcn Button', () => {
    expect(src).toContain('className="group block w-full h-auto p-0 m-0 text-start bg-transparent border-0 transition-all duration-300"');
    const card = src.slice(src.indexOf('data-testid={`package-card-'), src.indexOf('data-testid={`package-card-') + 400);
    expect(card).not.toContain('<Button');
  });

  it('selecting still carries the id of the card that was tapped', () => {
    expect(src).toContain('onClick={() => setSelectedPackageId(pkg.id)}');
  });
});

describe('a wash package never wears a gift card', () => {
  it('the gift-card images are gone from this page', () => {
    expect(src).not.toContain('IMG_3094_1770832584882');
    expect(src).not.toContain('IMG_3091_1770832584882');
    expect(src).not.toContain('pinkCardFront');
    expect(src).not.toContain('greenCardFront');
  });

  it('a wash count with no artwork gets a branded panel, not someone else\'s card', () => {
    expect(src).toContain('const cardImage = cardImagesByWashCount[pkg.washCount];');
    expect(src).toContain('data-testid={`package-panel-${pkg.washCount}`}');
    expect(src).toContain('data-testid={`package-detail-panel-${selectedPackage.washCount}`}');
    expect(src).not.toMatch(/\?\? pinkCardFront/);
  });
});

describe('Hebrew', () => {
  it('Maison is the brand name, not food', () => {
    expect(src).toContain("he: 'קולקציית Maison'");
    expect(src).not.toContain('קולקציית מזון');
  });
});
