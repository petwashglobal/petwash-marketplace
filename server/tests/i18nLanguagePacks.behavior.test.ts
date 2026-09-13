import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { transformSync } from 'esbuild';
import { splitI18nSource, SECONDARY_LANGS, LOADER_MARKER } from '../../scripts/vite/i18nLanguagePacks';
import { translations as original } from '../../client/src/lib/i18n';

/**
 * Bundle audit 2026-09-13: client/src/lib/i18n.ts was 510 KB of the 1.19 MB main
 * App chunk (all six languages, every page). The build now keeps en+he inline
 * and ships ar/ru/fr/es as lazy packs. These tests run the REAL transform on the
 * REAL file and execute the output, so a lost or altered string fails here.
 */
const ROOT = resolve(__dirname, '..', '..');
const SOURCE = readFileSync(join(ROOT, 'client/src/lib/i18n.ts'), 'utf8');

type Mod = {
  translations: Record<string, Record<string, string>>;
  t: (k: string, l: string) => string;
  subscribeLanguagePacks: (fn: () => void) => () => void;
  getLanguagePackVersion: () => number;
};

let result: ReturnType<typeof splitI18nSource>;
let built: Mod;

beforeAll(async () => {
  result = splitI18nSource(SOURCE);
  // Execute the transformed module as the browser would, with each virtual pack
  // served from a file next to it.
  const dir = mkdtempSync(join(tmpdir(), 'pw-i18n-'));
  for (const lang of SECONDARY_LANGS) {
    writeFileSync(join(dir, `pack-${lang}.mjs`), `export default ${JSON.stringify(result.packs[lang])};`);
  }
  const js = transformSync(result.code, { loader: 'ts', format: 'esm' }).code
    .replace(/import\(["']virtual:pw-i18n-pack\/(\w+)["']\)/g, "import('./pack-$1.mjs')");
  writeFileSync(join(dir, 'i18n.mjs'), js);
  built = (await import(pathToFileURL(join(dir, 'i18n.mjs')).href)) as Mod;
}, 60_000);

describe('build transform', () => {
  it('strips every secondary-language string out of the main module', () => {
    expect(result.code.length).toBeLessThan(SOURCE.length * 0.5);
    for (const [key, entry] of Object.entries(built.translations)) {
      for (const lang of SECONDARY_LANGS) expect(entry[lang], `${key}.${lang}`).toBeUndefined();
    }
    expect(result.code).not.toContain(LOADER_MARKER);
    for (const lang of SECONDARY_LANGS) expect(result.code).toContain(`import('virtual:pw-i18n-pack/${lang}')`);
  });

  it('keeps en and he byte-identical, and every secondary string lands in its pack', () => {
    const keys = Object.keys(original);
    expect(Object.keys(built.translations)).toEqual(keys);
    for (const key of keys) {
      expect(built.translations[key].en, key).toBe(original[key].en);
      expect(built.translations[key].he, key).toBe(original[key].he);
      for (const lang of SECONDARY_LANGS) {
        expect(result.packs[lang][key], `${key}.${lang}`).toBe((original[key] as any)[lang]);
      }
    }
  });

  it('fails the build loudly if the file changes shape', () => {
    expect(() => splitI18nSource('export const other = {};')).toThrow(/translations/);
    expect(() => splitI18nSource(`export const translations = { 'a': { en: x } };\n${LOADER_MARKER}`)).toThrow(/non-literal/);
    expect(() => splitI18nSource(`export const translations = { 'a': { en: 'A' } };`)).toThrow(/marker/);
  });
});

describe('runtime', () => {
  it('shows English until the pack lands, then the chosen language — and tells the app to re-render', async () => {
    const before = built.getLanguagePackVersion();
    let notified = 0;
    const off = built.subscribeLanguagePacks(() => { notified += 1; });

    expect(built.t('nav.home', 'ru')).toBe(original['nav.home'].en); // fallback, triggers the load
    await new Promise((r) => setTimeout(r, 200));
    expect(built.t('nav.home', 'ru')).toBe(original['nav.home'].ru);
    expect(built.getLanguagePackVersion()).toBe(before + 1);
    expect(notified).toBe(1);

    // Loaded once: a key with no Russian translation never re-requests the pack.
    const missing = Object.keys(original).find((k) => (original[k] as any).ru === undefined)!;
    built.t(missing, 'ru');
    await new Promise((r) => setTimeout(r, 50));
    expect(built.getLanguagePackVersion()).toBe(before + 1);
    off();
  });

  it('Hebrew and English never load a pack', async () => {
    const v = built.getLanguagePackVersion();
    built.t('nav.home', 'he');
    built.t('nav.home', 'en');
    await new Promise((r) => setTimeout(r, 50));
    expect(built.getLanguagePackVersion()).toBe(v);
  });
});

describe('wiring', () => {
  it('the plugin runs in the production build and App re-renders on pack arrival', () => {
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(vite).toContain('i18nLanguagePacks(),');
    const app = readFileSync(join(ROOT, 'client/src/App.tsx'), 'utf8');
    expect(app).toContain('useSyncExternalStore(subscribeLanguagePacks, getLanguagePackVersion, getLanguagePackVersion);');
  });

  it('the Hebrew calendar is no longer statically imported by Landing (main bundle)', () => {
    const landing = readFileSync(join(ROOT, 'client/src/pages/Landing.tsx'), 'utf8');
    expect(landing).not.toMatch(/import \{ israelOccasion \} from '@\/lib\/israelOccasions'/);
    expect(landing).toContain("import('@/lib/israelOccasions')");
  });
});
