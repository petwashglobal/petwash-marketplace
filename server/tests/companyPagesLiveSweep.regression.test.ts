import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Live sweep of the company pages on petwash.co.il (2026-09-17), signed in as
 * the CEO. Two defects a visitor could see or hear:
 *
 *  1. /careers and /contact each fired GET /api/google-forms/config/<type>,
 *     which answered 404 when no Google Form is configured — a normal state.
 *     Every visitor's console showed a red [API Error] on an ordinary page.
 *  2. /story was English-only on a Hebrew-first site.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('an unconfigured form is not an error', () => {
  const src = R('server/routes/google-forms.ts');
  it('answers 200 with enabled:false instead of 404', () => {
    expect(src).toContain("return res.json({ formType, enabled: false, formUrl: null, formTitle: null, formTitleHe: null, height: null });");
    expect(src).not.toContain("return res.status(404).json({ error: 'Form not configured or disabled' });");
  });
  it('the embed still shows its fallback for a disabled form', () => {
    expect(R('client/src/components/GoogleFormEmbed.tsx')).toContain('if (isError || !formConfig || !formConfig.enabled) {');
  });
});

describe('Our Story speaks Hebrew', () => {
  const src = R('client/src/pages/Story.tsx');
  it('uses the language store and flips direction', () => {
    expect(src).toContain("import { useLanguage } from '@/lib/languageStore';");
    expect(src).toMatch(/dir=\{isHe \? 'rtl' : 'ltr'\}/);
  });
  it('every visible string has a Hebrew half', () => {
    expect(src).toContain("{L('הסיפור והייעוד שלנו', 'Our Story & Mission')}");
    expect(src).toContain("{L('החזון', 'The Vision')}");
    expect(src).toContain("{L('התרחבות עולמית', 'Global Expansion')}");
    expect(src).toContain("{L('הקהילה שלנו', 'Our Community')}");
    expect(src).toContain("{L('הצטרפו למסע', 'Join Our Journey')}");
  });
});
