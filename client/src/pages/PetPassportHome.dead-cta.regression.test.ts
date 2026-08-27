import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PetPassportHome.tsx'), 'utf8');

/**
 * 2026-08-27 wire-only sweep: the earlier discipline was "unmapped tiles show
 * an honest toast, never bait-and-switch to /pets". That was the right
 * transitional stance. This turn we finish the job: every tile that had no
 * real destination is REMOVED entirely, so no user ever clicks into nothing.
 *
 * Insurance tile and Clinics quick-action are GONE. This test pins that they
 * stay gone until real destinations ship.
 */
describe('PetPassportHome.tsx CTA wiring — every visible tile lands on a real screen', () => {
  it('Vaccines tile navigates to /pets (real PetHealthPanel is there)', () => {
    expect(SRC).toMatch(/label=\{tr\('חיסונים', 'Vaccines'\)\}\s*onClick=\{\(\) => navigate\(['"]\/pets['"]\)\}/);
  });

  it('Reminders quick-action navigates to /pets (real reminder engine is there)', () => {
    expect(SRC).toMatch(/label=\{tr\('תזכורות', 'Reminders'\)\}\s*onClick=\{\(\) => navigate\(['"]\/pets['"]\)\}/);
  });

  it('Vet quick-action navigates to /pets (real vet-visit events are there)', () => {
    expect(SRC).toMatch(/label=\{tr\('וטרינר', 'Vet'\)\}\s*onClick=\{\(\) => navigate\(['"]\/pets['"]\)\}/);
  });

  it('Medical records tile navigates to /documents (real document vault)', () => {
    expect(SRC).toMatch(/label=\{tr\('רשומות רפואיות', 'Medical records'\)\}\s*onClick=\{\(\) => navigate\(['"]\/documents['"]\)\}/);
  });

  it('Shop quick-action navigates to /shop (real store)', () => {
    expect(SRC).toMatch(/label=\{tr\('חנות', 'Shop'\)\}\s*onClick=\{\(\) => navigate\(['"]\/shop['"]\)\}/);
  });

  // ── Anti-regression: the deleted tiles must not come back as toast-gated
  //    dead-ends. If either returns, it must return with a real navigate().
  it('Insurance tile is removed (no dead notReady/coming-soon)', () => {
    expect(SRC).not.toMatch(/label=\{tr\('ביטוחים', 'Insurance'\)\}/);
  });

  it('Clinics quick-action is removed (no dead notReady/coming-soon)', () => {
    expect(SRC).not.toMatch(/label=\{tr\('בתי חולים', 'Clinics'\)\}/);
  });

  it('No notReady helper survives — every tile must go somewhere real', () => {
    // The helper function definition and every call site are gone. Comments
    // in-file may still reference the word to explain the deletion; only
    // executable syntax (a `const notReady =`, `function notReady`, or an
    // `onClick={... => notReady(`) is banned.
    expect(SRC).not.toMatch(/const\s+notReady\s*=/);
    expect(SRC).not.toMatch(/function\s+notReady\b/);
    expect(SRC).not.toMatch(/onClick=\{[^}]*notReady\s*\(/);
    expect(SRC).not.toMatch(/description:\s*tr\(['"]בקרוב/);
  });
});
