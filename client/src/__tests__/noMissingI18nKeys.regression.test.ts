/**
 * A missing translation key renders AS TEXT (2026-09-17).
 *
 * `t()` in lib/i18n returns the key itself when it is not defined, so
 * `t('common.home') || 'Home'` never falls back — the live payment-success
 * button read "common.home", and the /our-service loyalty tab showed 14 raw
 * keys (plus tier discounts up to 50% against a 15% cap). This pin fails
 * when any file using the shared `t` calls a key that does not exist.
 *
 * STAFF_DEBT lists staff-only screens that already had missing keys; each
 * count may only go DOWN. Never add a customer-facing file to it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
const i18n = readFileSync(join(SRC, 'lib', 'i18n.ts'), 'utf8');
const KEYS = new Set([...i18n.matchAll(/^\s*'([A-Za-z0-9_.-]+)':\s*\{/gm)].map((m) => m[1]));

const STAFF_DEBT: Record<string, number> = {
  'pages/LeadManagement.tsx': 117,
  'pages/CustomerManagement.tsx': 33,
  'pages/CommunicationCenter.tsx': 27,
  'pages/AdminTeamInvitations.tsx': 4,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); continue; }
    if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function missingIn(src: string): string[] {
  const usesShared = /import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*['"](@\/lib\/i18n|\.\.?\/[^'"]*i18n)['"]/.test(src)
    || /useLanguage/.test(src);
  if (!usesShared) return [];
  if (/(function|const)\s+t\s*[=(]/.test(src)) return []; // file defines its own t
  return [...src.matchAll(/\bt\(\s*'([A-Za-z][A-Za-z0-9_]*\.[A-Za-z0-9_.]+)'/g)]
    .map((m) => m[1]).filter((k) => !KEYS.has(k));
}

describe('every shared t() key exists', () => {
  const files = walk(SRC).filter((p) => !p.endsWith(join('lib', 'i18n.ts')));

  it('no customer-facing file calls a missing key', () => {
    const bad: string[] = [];
    for (const p of files) {
      const rel = relative(SRC, p).split('\\').join('/');
      if (rel in STAFF_DEBT) continue;
      const miss = missingIn(readFileSync(p, 'utf8'));
      if (miss.length) bad.push(`${rel}: ${[...new Set(miss)].join(', ')}`);
    }
    expect(bad).toEqual([]);
  });

  it('staff-only debt can only shrink', () => {
    for (const [rel, max] of Object.entries(STAFF_DEBT)) {
      const n = missingIn(readFileSync(join(SRC, rel), 'utf8')).length;
      expect(n, rel).toBeLessThanOrEqual(max);
    }
  });

  it('the /our-service loyalty tab uses the authoritative table, not a hard-coded ladder', () => {
    const page = readFileSync(join(SRC, 'pages', 'OurService.tsx'), 'utf8');
    expect(page).toMatch(/from '@shared\/schema-loyalty'/);
    expect(page).toMatch(/MAX_DISCOUNT_CAP/);
    expect(page).not.toMatch(/<LoyaltyProgram|import \{ LoyaltyProgram/);
  });
});
