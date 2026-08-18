/**
 * PR-I18N-URL-LANG-OVERRIDE — ?lang=<code> in the URL wins over stored
 * pw_lang on first render.
 *
 * Fire-order item 2. Production bug: https://petwash.co.il/?lang=en
 * rendered as Hebrew. Root cause: LanguageProvider read ONLY
 * localStorage.pw_lang; the URL param was never inspected. Fix:
 * readUrlLanguage() runs BEFORE readSavedLanguage() in the useState
 * initializer, is persisted so a refresh (that may drop the query
 * string) preserves the choice, and accepts:
 *   - `?lang=` and `?hl=`
 *   - a locale prefix (`?lang=en-US` → `en`)
 * Values outside VALID_LANGUAGES are ignored.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const STORE = 'client/src/lib/languageStore.tsx';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

describe('PR-I18N-URL-LANG-OVERRIDE', () => {
  const src = read(STORE);
  const code = codeOnly(src);

  it('A1. languageStore.tsx exists', () => {
    expect(existsSync(resolve(ROOT, STORE))).toBe(true);
  });

  it('A2. readUrlLanguage() is defined', () => {
    expect(/function\s+readUrlLanguage\s*\(\s*\)\s*:\s*Language\s*\|\s*null/.test(code)).toBe(true);
  });

  it('A3. reads window.location.search via URLSearchParams', () => {
    expect(/new\s+URLSearchParams\(\s*window\.location\.search\s*\)/.test(code)).toBe(true);
  });

  it('A4. accepts both `?lang=` and `?hl=` as sources', () => {
    expect(/params\.get\(\s*['"]lang['"]\s*\)[\s\S]{0,30}params\.get\(\s*['"]hl['"]\s*\)/.test(code)).toBe(true);
  });

  it('A5. accepts a locale prefix (`?lang=en-US` → `en`) by splitting on `-` or `_`', () => {
    expect(/split\(\s*\/\[-_\]\/\s*\)/.test(code)).toBe(true);
  });

  it('A6. validates the parsed code against VALID_LANGUAGES before returning it', () => {
    // The URL is caller-supplied — anything not in the allow-list must
    // return null (fall through to storage/default), never render
    // untranslated content.
    expect(/VALID_LANGUAGES\.includes\(\s*short\s*\)/.test(code)).toBe(true);
  });

  it('A7. persists the URL choice to pw_lang so a refresh (which may drop the query string) preserves it', () => {
    // The whole point of persisting: page refresh may lose the query
    // string; the language must not silently revert.
    expect(/localStorage\.setItem\(\s*['"]pw_lang['"]\s*,\s*short\s*\)/.test(code)).toBe(true);
  });

  it('A8. URL is checked BEFORE storage in the useState initializer (this is the actual fix)', () => {
    // Extract the state initializer arrow function; readUrlLanguage()
    // must be called before readSavedLanguage() — the stored pw_lang
    // must NOT win over an explicit URL choice.
    const init = code.match(/useState<Language>\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;/)?.[1] || '';
    expect(init.length).toBeGreaterThan(0);
    const urlIdx = init.indexOf('readUrlLanguage');
    const savedIdx = init.indexOf('readSavedLanguage');
    expect(urlIdx).toBeGreaterThan(-1);
    expect(savedIdx).toBeGreaterThan(-1);
    expect(urlIdx).toBeLessThan(savedIdx);
  });

  it('A9. SSR-safe: guards against `typeof window === "undefined"`', () => {
    // The state initializer runs during first render. If SSR ever
    // renders this file, accessing window would throw. Cheap early
    // return covers it.
    expect(/typeof\s+window\s*===\s*['"]undefined['"]/.test(code)).toBe(true);
  });
});
