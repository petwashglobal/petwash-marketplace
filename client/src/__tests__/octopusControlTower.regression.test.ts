/**
 * Regression pin — control-tower consolidation (2026-07-26, task #3).
 *
 * The /admin (octopus) landing rendered a flat, hardcoded pile of quick links.
 * It now renders the shared executive-nav categorised into its canonical groups
 * (Command / Money / People / Operations / Governance) — one organised home for
 * the whole backend, not a scramble.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const oct = readFileSync(join(__dirname, '..', 'pages', 'AdminOctopus.tsx'), 'utf8');
const nav = readFileSync(join(__dirname, '..', 'components', 'dashboard', 'executive-nav.ts'), 'utf8');

describe('octopus control tower', () => {
  it('renders the shared executive-nav (not a hardcoded flat list)', () => {
    expect(oct).toMatch(/navForRole\('ceo'\)\.map/);
    expect(oct).toMatch(/grp\.items\.map/);
  });
  it('shows the canonical group structure', () => {
    for (const g of ['Command', 'Money', 'People', 'Operations', 'Governance']) {
      expect(nav).toMatch(new RegExp(`group: '${g}'`));
    }
  });
  it('links each dashboard by its executive-nav path with a description', () => {
    expect(oct).toMatch(/onClick=\{\(\) => go\(it\.path\)\}/);
    expect(oct).toMatch(/it\.hintHe \|\| it\.hint/);
  });
});
