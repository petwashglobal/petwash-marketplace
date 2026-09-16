import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SIGNUP_AR_RU } from './signupLuxury.i18n';

/**
 * 2026-09-14 — the sign-up page spoke only Hebrew and English.
 *
 * SignUpLuxury.tsx decided every string with `he ? '<Hebrew>' : '<English>'`,
 * about 200 times, and the page is the door to the whole product. Arabic and
 * Russian speakers — together roughly a third of Israel — were served the
 * English page, and the layout followed English left-to-right even though
 * Arabic is right-to-left.
 *
 * The page now calls L(hebrew, english): Hebrew and English are byte-identical
 * to before, Arabic and Russian come from SIGNUP_AR_RU, and anything not yet
 * translated still falls back to English.
 */
const SRC = fs.readFileSync(path.resolve(__dirname, 'SignUpLuxury.tsx'), 'utf8');
const BODY = SRC.slice(
  SRC.indexOf('export default function SignUpLuxury('),
  SRC.indexOf('\n// ============================================================\n// Sub-components'),
);

describe('the sign-up page speaks Arabic and Russian', () => {
  it('every English string the page shows has both translations, non-empty and different from the English', () => {
    const entries = Object.entries(SIGNUP_AR_RU);
    expect(entries.length).toBeGreaterThan(140);
    // A few words are the same word in the target language — "Email" is written
    // Email in Russian too. Anything else matching English is an untranslated string.
    const SAME_WORD_IS_CORRECT = new Set(['Email']);
    for (const [en, v] of entries) {
      expect(v.ar.trim(), `ar missing for: ${en}`).not.toBe('');
      expect(v.ru.trim(), `ru missing for: ${en}`).not.toBe('');
      expect(v.ar, `ar is still English for: ${en}`).not.toBe(en);
      if (!SAME_WORD_IS_CORRECT.has(en)) {
        expect(v.ru, `ru is still English for: ${en}`).not.toBe(en);
      }
    }
  });

  it('every L(...) call in the page has a translation entry', () => {
    const calls = [...BODY.matchAll(/\bL\((['"])((?:\\.|(?!\1).)*)\1,\s*(['"])((?:\\.|(?!\3).)*)\3\)/g)];
    expect(calls.length).toBeGreaterThan(180);
    const missing = calls.map((m) => m[4]).filter((en) => !(en in SIGNUP_AR_RU));
    expect(missing, `no Arabic/Russian for: ${missing.slice(0, 5).join(' | ')}`).toEqual([]);
  });

  it('Hebrew and English still win before any lookup', () => {
    expect(BODY).toContain("const L = (heText: string, enText: string): string =>");
    expect(BODY).toMatch(/he \? heText :/);
    expect(BODY).toContain("(language === 'ar' || language === 'ru')");
    expect(BODY).toContain('?? enText');
  });

  it('Arabic gets right-to-left layout, like Hebrew', () => {
    expect(BODY).toContain("const rtl = he || language === 'ar';");
    // dir, text alignment and the page CSS follow rtl, never `he`
    expect(BODY).toContain("dir={rtl ? 'rtl' : 'ltr'}");
    expect(BODY).toContain('<style>{styles(rtl)}</style>');
    expect(BODY, 'a textAlign still keyed on he').not.toMatch(/textAlign: he \?/);
  });

  it('product and brand names stay English in every language', () => {
    const all = Object.values(SIGNUP_AR_RU);
    const brandLines = all.filter((v) => /PetWash|K9000|Passkey|Google|Apple/.test(v.ar + v.ru));
    expect(brandLines.length).toBeGreaterThan(5);
    for (const v of all) {
      expect(v.ar, 'PetWash transliterated in Arabic').not.toMatch(/بيت ?واش/);
      expect(v.ru, 'PetWash transliterated in Russian').not.toMatch(/Пет ?Вош|Петвош/i);
    }
  });

  it('strings with a value inside them are translated inline, keeping the placeholder', () => {
    // e.g. the code-sent line and the passkey button
    expect(BODY).toContain("language === 'ar' ? `أدخل الرمز المرسل إلى ${phone}`");
    expect(BODY).toContain("language === 'ru' ? `Введите код, отправленный на ${phone}`");
    expect(BODY).toContain('Sign in with a passkey (${bioName})');
    const tpl = [...BODY.matchAll(/\bhe \? `[^`]*` : `[^`]*`/g)];
    expect(tpl, 'a template string pair was left Hebrew/English only').toEqual([]);
  });

  it('the consent lines are translated — these are the ones a member must understand', () => {
    for (const en of [
      'I confirm that I am 18 years of age or older (required).',
      'I have read and agree to the ',
      'Terms of Service',
      'Privacy Notice',
      'Send me PetWash news and offers by email/SMS (optional — you can unsubscribe anytime).',
    ]) {
      expect(SIGNUP_AR_RU[en], `consent line not translated: ${en}`).toBeTruthy();
    }
  });
});
