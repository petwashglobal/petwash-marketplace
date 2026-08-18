/**
 * PR-LOYALTY-COPY-7-TIERS — every customer-facing "N tiers" reference
 * matches the actual 7-tier Prestige structure.
 *
 * The tiers rendered on /loyalty are: Member, Silver, Gold, Platinum,
 * Diamond, Emerald, Black Reserve — SEVEN. Copy that said "five" was
 * a pre-launch pitch line that outlived the tier ladder it described.
 *
 * This regression guards against the wrong count silently reappearing
 * in any customer-facing surface (i18n table + any page-level notes).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'build') continue;
    const p = join(dir, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

const SELF = __filename;

describe('PR-LOYALTY-COPY-7-TIERS', () => {
  it('A1. no customer-facing string says "Five distinct tiers" any more', () => {
    // The exact pre-fix string from i18n.ts:2191, before the fix.
    const files = walk(resolve(ROOT, 'client/src'));
    const offenders: string[] = [];
    for (const f of files) {
      if (f === SELF) continue;
      const src = readFileSync(f, 'utf8');
      if (src.includes('Five distinct tiers')) offenders.push(f);
      if (src.includes('חמש דרגות ייחודיות')) offenders.push(f + ' (he)');
    }
    expect(offenders).toEqual([]);
  });

  it('A2. no customer-facing surface says "5 tiers" (English) any more', () => {
    // Grep the client tree for the literal "5 tiers" — the ServiceStatus
    // note was the second offender. Do NOT match "5 tiers" inside test
    // files (this one references it in prose).
    const files = walk(resolve(ROOT, 'client/src'));
    const offenders: string[] = [];
    for (const f of files) {
      if (f === SELF) continue;
      const src = readFileSync(f, 'utf8');
      if (/\b5\s+tiers\b/i.test(src)) offenders.push(f);
      if (/\b5\s+רמות\b/.test(src)) offenders.push(f + ' (he)');
    }
    expect(offenders).toEqual([]);
  });

  it('A3. i18n table for privilege.pillarStatusDesc says "Seven" (matches actual tier count)', () => {
    const src = readFileSync(resolve(ROOT, 'client/src/lib/i18n.ts'), 'utf8');
    const line = src.split(/\r?\n/).find(l => l.includes("'privilege.pillarStatusDesc'")) || '';
    expect(line.length).toBeGreaterThan(0);
    expect(line.includes('Seven distinct tiers')).toBe(true);
    expect(line.includes('שבע דרגות ייחודיות')).toBe(true);
    // Also pin absence of the pre-fix text on this specific line.
    expect(line.includes('Five distinct tiers')).toBe(false);
  });
});
