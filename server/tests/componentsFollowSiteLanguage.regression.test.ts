/**
 * 2026-09-19 Hebrew/RTL audit, backlog item 2.
 *
 * Two components shipped Hebrew to every customer regardless of the site
 * language: the address form (labels, placeholders, hints, all Hebrew; five
 * free-text boxes hard-wired `dir="rtl"`) and the Kenzo chat widget (opened in
 * Hebrew, `dir="rtl"` on the consent screen and the input, Hebrew aria-labels).
 * An English/Russian/French visitor booking a sitter got a Hebrew address form
 * with the caret on the wrong side.
 *
 * Both now read the site language from the language store. This pin keeps the
 * hard-wired direction and the Hebrew-only literals from coming back.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const HEBREW = /[א-ת]/;

function jsxLinesWithHebrew(src: string, tableName: string): string[] {
  // Hebrew is allowed inside the per-language copy table and in comments —
  // nowhere else in the markup.
  const out: string[] = [];
  let inTable = false;
  for (const line of src.split('\n')) {
    if (line.startsWith(`const ${tableName}`)) inTable = true;
    if (inTable) {
      if (line.startsWith('} as const;')) inTable = false;
      continue;
    }
    if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) continue;
    if (HEBREW.test(line)) out.push(line.trim());
  }
  return out;
}

describe('address form follows the site language', () => {
  const src = read('client/src/components/ui/google-places-autocomplete.tsx');

  it('reads the language store and has a Hebrew and an English copy table', () => {
    expect(src).toContain("import { useLanguage } from '@/lib/languageStore';");
    expect(src).toMatch(/const \{ language, dir \} = useLanguage\(\);/);
    expect(src).toMatch(/const ADDRESS_COPY = \{\s*he: \{/);
    expect(src).toMatch(/\n  en: \{/);
  });

  it('no free-text box is hard-wired right-to-left', () => {
    expect(src).not.toMatch(/dir="rtl"/);
    // the five text boxes follow the site; the two numeric ones stay LTR
    expect(src.match(/dir=\{dir\}/g)?.length).toBe(5);
    expect(src.match(/dir="ltr"/g)?.length).toBe(2);
  });

  it('no Hebrew literal outside the copy table', () => {
    expect(jsxLinesWithHebrew(src, 'ADDRESS_COPY')).toEqual([]);
  });

  it('the English copy is real English, not a placeholder', () => {
    for (const key of ['building', 'apartment', 'floor', 'entrance', 'city', 'postal', 'notes', 'noMatches', 'typeHint']) {
      expect(src, key).toMatch(new RegExp(`\\n    ${key}: '[A-Z][^']+',`));
    }
  });
});

describe('Kenzo chat widget follows the site language', () => {
  const src = read('client/src/components/AiChatWidget.tsx');

  it('opens in the site language and lets the toggle drive direction', () => {
    expect(src).toContain("import { useLanguage } from '@/lib/languageStore';");
    expect(src).toMatch(/useState<'he' \| 'en'>\(siteLanguage === 'he' \? 'he' : 'en'\)/);
    expect(src).toMatch(/const dir = language === 'he' \? 'rtl' : 'ltr';/);
    expect(src).not.toMatch(/dir="rtl"/);
    expect(src.match(/dir=\{dir\}/g)?.length).toBe(2);
  });

  it('aria-labels and placeholder come from the copy table', () => {
    expect(src).toContain('aria-label={copy.close}');
    expect(src).toContain('aria-label={copy.inputLabel}');
    expect(src).toContain('aria-label={copy.send}');
    expect(src).toContain('placeholder={copy.inputPlaceholder}');
  });

  it('no Hebrew literal outside the copy table (the language toggle label excepted)', () => {
    const left = jsxLinesWithHebrew(src, 'WIDGET_COPY').filter((l) => !l.includes("'עברית'"));
    expect(left).toEqual([]);
  });

  it('uses the gold accent, not indigo/violet (petwash-ui-ux: gold is the single accent)', () => {
    expect(src).not.toMatch(/#4F46E5|#7C3AED/i);
  });
});
