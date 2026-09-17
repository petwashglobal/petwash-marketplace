import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-17 — the page a customer sees straight after paying spoke Hebrew and
 * English only (`labels[language === 'he' ? 'he' : 'en']`), so Arabic and
 * Russian speakers read their booking, their money and their cancellation
 * terms in English. Arabic also got a left-to-right layout.
 *
 * All four label sets now carry the same keys, and Arabic is right-to-left.
 */
const SRC = fs.readFileSync(path.resolve(__dirname, 'BookingConfirmation.tsx'), 'utf8');

function labelKeys(tag: 'he' | 'en' | 'ar' | 'ru'): string[] {
  const all = SRC.slice(SRC.indexOf('const labels = {'));
  const start = all.indexOf(`  ${tag}: {`);
  expect(start, `label set missing: ${tag}`).toBeGreaterThan(-1);
  const block = all.slice(start, all.indexOf('\n  },', start));
  return [...block.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
}

function labelValues(tag: 'he' | 'en' | 'ar' | 'ru'): Record<string, string> {
  const all = SRC.slice(SRC.indexOf('const labels = {'));
  const start = all.indexOf(`  ${tag}: {`);
  const block = all.slice(start, all.indexOf('\n  },', start));
  const out: Record<string, string> = {};
  // [^'\\] excludes the backslash so the two alternatives cannot match the same
  // text — an ambiguous alternation here is catastrophic backtracking (js/redos).
  for (const m of block.matchAll(/^\s{4}(\w+):\s*'((?:\\.|[^'\\])*)',\s*$/gm)) out[m[1]] = m[2];
  return out;
}

describe('the booking confirmation speaks Arabic and Russian', () => {
  it('all four label sets carry exactly the same keys', () => {
    const en = labelKeys('en');
    expect(en.length).toBeGreaterThan(80);
    for (const tag of ['he', 'ar', 'ru'] as const) {
      expect(labelKeys(tag).slice().sort(), `${tag} keys differ from en`).toEqual(en.slice().sort());
    }
  });

  it('no Arabic or Russian label was left as the English text', () => {
    const en = labelValues('en');
    // Words that are the same in the target language, or brand/technical text.
    const SAME_IS_CORRECT = new Set(['emailPlaceholder', 'phonePlaceholder', 'heroAddToApple', 'heroAddToGoogle']);
    for (const tag of ['ar', 'ru'] as const) {
      const v = labelValues(tag);
      for (const [k, text] of Object.entries(en)) {
        expect(v[k]?.trim(), `${tag}.${k} is empty`).toBeTruthy();
        if (!SAME_IS_CORRECT.has(k)) {
          expect(v[k], `${tag}.${k} is still English`).not.toBe(text);
        }
      }
    }
  });

  it('the money and policy lines are translated, not left in English', () => {
    for (const tag of ['ar', 'ru'] as const) {
      const v = labelValues(tag);
      for (const k of ['fee', 'total', 'subtotal', 'escrow', 'payoutNote', 'refund', 'paymentSuccessSub', 'cancelConfirm']) {
        expect(v[k], `${tag}.${k} missing`).toBeTruthy();
      }
    }
  });

  it('placeholders survive translation', () => {
    for (const tag of ['ar', 'ru'] as const) {
      const v = labelValues(tag);
      expect(v.heroThankYouTemplate).toContain('{name}');
      expect(v.heroThankYouTemplate).toContain('{email}');
      expect(v.heroThankYouNoEmail).toContain('{name}');
    }
  });

  it('the page picks the reader language and gives Arabic right-to-left', () => {
    expect(SRC).toContain("labels[(language === 'he' || language === 'ar' || language === 'ru') ? language : 'en']");
    expect(SRC).toContain("const isRTL          = language === 'he' || language === 'ar';");
  });

  it('per-service notes exist for Arabic and Russian and fall back per service', () => {
    expect(SRC).toContain('const IMPORTANT_INFO_AR');
    expect(SRC).toContain('const IMPORTANT_INFO_RU');
    // spread over the English map, so a service with no translation still shows text
    expect(SRC).toContain('{ ...IMPORTANT_INFO_EN, ...IMPORTANT_INFO_AR }');
    expect(SRC).toContain('{ ...IMPORTANT_INFO_EN, ...IMPORTANT_INFO_RU }');
  });

  it('the K9000 notes are NOT translated while they still say "vehicle"', () => {
    // Hebrew and English both describe washing a VEHICLE on a dog-wash service.
    // Translating that into two more languages would multiply the mistake.
    const arBlock = SRC.slice(SRC.indexOf('const IMPORTANT_INFO_AR'), SRC.indexOf('const IMPORTANT_INFO_RU'));
    expect(arBlock).not.toContain('k9000_wash');
    expect(SRC, 'the wrong copy was silently rewritten instead of reported')
      .toContain('Your vehicle will be washed with pet-safe K9000 technology.');
  });

  it('brand names stay English in every language', () => {
    for (const tag of ['ar', 'ru'] as const) {
      const joined = Object.values(labelValues(tag)).join(' ');
      expect(joined).not.toMatch(/بيت ?واش|Пет ?Вош|Петвош/i);
    }
  });
});
