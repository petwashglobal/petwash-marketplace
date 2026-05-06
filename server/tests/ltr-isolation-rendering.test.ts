/**
 * PR-W52 — Pin the LTR-isolation classes on every site that renders a
 * phone or email as visible text inside a Hebrew RTL container.
 *
 * If a future PR removes the `dir="ltr"` / `ltr-inline` annotation, this
 * test fails — preventing the regression where Hebrew page layout
 * reorders "+972 54-983-3355" into "972-54-983-3355+".
 *
 * Static source-pin only — no DOM, no DB.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

describe('PR-W52 — LTR isolation pinned on visible phone/email displays', () => {
  it('client/src/index.css declares the .ltr-inline utility', () => {
    const css = read('client/src/index.css');
    expect(css).toMatch(/\.ltr-inline\s*\{[^}]*direction:\s*ltr/);
    expect(css).toMatch(/\.ltr-inline\s*\{[^}]*unicode-bidi:\s*isolate/);
  });

  it('client/src/index.css applies unicode-bidi: isolate to tel:/mailto: anchors', () => {
    const css = read('client/src/index.css');
    expect(css).toMatch(
      /a\[href\^=\"tel:\"\]\s*,\s*a\[href\^=\"mailto:\"\]\s*\{[^}]*unicode-bidi:\s*isolate/,
    );
  });

  it('Ltr React component wraps content in dir="ltr" + .ltr-inline', () => {
    const tsx = read('client/src/components/ui/ltr.tsx');
    expect(tsx).toMatch(/dir=\"ltr\"/);
    expect(tsx).toMatch(/ltr-inline/);
    expect(tsx).toMatch(/unicode-bidi:\s*isolate/i);
  });

  describe('canonical support-contact lib', () => {
    const lib = read('client/src/lib/support-contact.ts');

    it('exports SUPPORT_PHONE_DISPLAY in canonical "+972 …" form', () => {
      expect(lib).toMatch(/export const SUPPORT_PHONE_DISPLAY = '\+972 54-983-3355'/);
    });

    it('exports formatIsraeliPhoneForDisplay()', () => {
      expect(lib).toMatch(/export function formatIsraeliPhoneForDisplay/);
    });

    it('exports SUPPORT_TEL_URL', () => {
      expect(lib).toMatch(/export const SUPPORT_TEL_URL/);
    });
  });

  describe('every visible phone display site applies .ltr-inline / dir="ltr"', () => {
    const sites: Array<{ file: string; contains: string[] }> = [
      {
        file: 'client/src/pages/ClaimVoucher.tsx',
        contains: [
          // The phone <a> AND its visible text are LTR-isolated.
          'dir="ltr"',
          'ltr-inline',
          '+972 54-983-3355',
        ],
      },
      {
        file: 'client/src/pages/AccessibilityStatement.tsx',
        contains: [
          'ltr-inline',
          '+972 50-123-4567',
        ],
      },
      {
        file: 'client/src/pages/MobileOpsHub.tsx',
        contains: [
          'ltr-inline',
          '+972 12-345-6789',
          '+972 98-765-4321',
        ],
      },
    ];

    for (const { file, contains } of sites) {
      it(`${file} renders phone with LTR isolation`, () => {
        const text = read(file);
        for (const needle of contains) {
          expect(text, `${file} missing "${needle}"`).toContain(needle);
        }
      });
    }
  });

  describe('regression guard — no reversed phone literal in source', () => {
    // The pre-PR display was "+972-54-983-3355" (only dashes, no space
    // between country code and national number). Hebrew RTL containers
    // reorder this. After PR-W52 the canonical form is "+972 54-…"
    // (space after the country code).
    //
    // We guard the explicit support phone — broader phone numbers may
    // legitimately use other formats elsewhere.
    const filesToGuard = [
      'client/src/pages/ClaimVoucher.tsx',
      'client/src/pages/AccessibilityStatement.tsx',
      'client/src/pages/MobileOpsHub.tsx',
    ];

    for (const f of filesToGuard) {
      it(`${f} does NOT contain the legacy reversed-prone "+972-54-983-3355" form`, () => {
        const text = read(f);
        expect(text).not.toContain('+972-54-983-3355');
      });
    }
  });
});
