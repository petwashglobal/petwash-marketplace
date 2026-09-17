import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17: react-i18next was initialised with lng 'en' and never told
 * when the site language changed. 22 components read i18n.language — booking
 * search, provider search/filters/cards, How-it-works, Trust & Safety, the
 * contact form — so all of them were English on the Hebrew site, and
 * /marketplace itself had no Hebrew at all.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('react-i18next follows the site language', () => {
  it('starts in the site language (URL, saved choice, else Hebrew) — not English', () => {
    const init = R('lib/i18next-init.ts');
    expect(init).toContain('lng: initialLanguage(),');
    expect(init).not.toMatch(/lng:\s*'en'/);
    expect(init).toContain("return 'he';");
  });
  it('every language change goes through languageStore and updates i18next', () => {
    const store = R('lib/languageStore.tsx');
    const fn = store.slice(store.indexOf('function applyDirToDOM('), store.indexOf('export function LanguageProvider'));
    expect(fn).toContain('void i18next.changeLanguage(lang)');
  });
});

describe('/marketplace speaks Hebrew', () => {
  const page = R('pages/Marketplace.tsx');
  it('uses the site language for its copy', () => {
    expect(page).toContain("const { language } = useLanguage();");
    expect(page).toContain("L('Pet Services Marketplace', 'שירותים לחיות מחמד')");
    expect(page).toContain("L('No providers found', 'לא נמצאו נותני שירות')");
  });
  it('has no bare English UI sentence left in JSX', () => {
    for (const s of ['>\n            Pet Services Marketplace', 'Try adjusting your filters or search in a different city\n', '            Ranked by quality\n', "placeholder=\"Enter city...\""]) {
      expect(page).not.toContain(s);
    }
  });
});
