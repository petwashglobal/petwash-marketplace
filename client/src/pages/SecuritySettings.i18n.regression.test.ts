/**
 * /settings/security rendered raw keys — `security.title`, `security.subtitle`,
 * `security.yourPasskeys`, `devices.subtitle` — in production (live QA
 * 2026-09-09) because none of the security.* / devices.* keys these pages
 * request existed in the dictionary. Pin: every key either page asks for
 * resolves in English and Hebrew.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { t } from '../lib/i18n';

const PAGES = ['SecuritySettings.tsx', 'DeviceManagement.tsx'];
const keys = new Set<string>();
for (const f of PAGES) {
  const src = fs.readFileSync(path.resolve(__dirname, f), 'utf8');
  for (const m of src.matchAll(/\bt\('([a-zA-Z]+\.[a-zA-Z]+)'/g)) keys.add(m[1]);
}

describe('security & devices i18n keys', () => {
  it('finds the keys the pages request', () => {
    expect(keys.size).toBeGreaterThan(30);
    expect(keys.has('security.title')).toBe(true);
    expect(keys.has('devices.subtitle')).toBe(true);
  });

  for (const key of [...keys].sort()) {
    it(`${key} resolves in en and he`, () => {
      expect(t(key, 'en')).not.toBe(key);
      expect(t(key, 'he')).not.toBe(key);
      expect(t(key, 'he')).not.toBe(t(key, 'en'));
    });
  }
});
