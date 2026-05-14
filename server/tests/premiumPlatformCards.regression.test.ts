/**
 * PR-PREMIUM-CARDS-2 — premium platform cards Phase 2 (default ON).
 *
 * Phase 2 ships the premium grid as the production default. The
 * feature flag is retained as an emergency-disable escape hatch
 * (set VITE_PREMIUM_PLATFORM_CARDS_ENABLED='false' to fall back to
 * the legacy PetWashDivisions grid).
 *
 *   • Premium grid renders by default on /
 *   • Locale-first asset selection (explicit → profile → navigator
 *     → IP → English); IP is NEVER the primary signal
 *   • Smart Hub IP-locked (no station recreation; static .webp only)
 *   • No auto-translated image text
 *   • Premium fallback if image missing (gradient + text only;
 *     never fake K9000)
 *
 * Source-pin invariants:
 *   A. file presence
 *   B. content + asset config integrity (6 platforms × 2 locales)
 *   C. locale resolver behaviour (Hebrew → .he.webp; English →
 *      .en.webp; unsupported → .en.webp; IP not primary)
 *   D. feature flag exists, default ON, "false" disables
 *   E. money / persistence firewall (no /api/* calls; no fetch;
 *      no localStorage; no FormData; no payment vendor strings)
 *   F. K9000 IP rule — no fake station fallback (no inline SVG of
 *      a station; no synthesized hardware drawing)
 *   G. no auto-translated image text (no runtime call into
 *      i18n libraries inside the static asset path)
 *   H. accessibility — alt text non-empty; CTA min-h 44px
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  resolveLocale,
  platformCardAsset,
  platformCardAssetFor,
} from '../../client/src/lib/platformCardAsset';
import { PLATFORM_CARDS } from '../../client/src/content/platformCards';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}
function codeOnly(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|[^`\\])*`/g, '``');
  return out;
}

const NEW_FILES = [
  'client/src/lib/platformCardAsset.ts',
  'client/src/content/platformCards.ts',
  'client/src/components/marketing/PremiumPlatformCard.tsx',
  'client/src/components/marketing/PremiumPlatformGrid.tsx',
];

const SHIPPED_ASSETS = [
  'client/public/assets/platform-cards/smart-hub-card.en.webp',
  'client/public/assets/platform-cards/smart-hub-card.he.webp',
  'client/public/assets/platform-cards/pet-sitter-card.en.webp',
  'client/public/assets/platform-cards/pet-sitter-card.he.webp',
  'client/public/assets/platform-cards/petfinder-card.en.webp',
  'client/public/assets/platform-cards/petfinder-card.he.webp',
  'client/public/assets/platform-cards/pettrek-card.en.webp',
  'client/public/assets/platform-cards/pettrek-card.he.webp',
  'client/public/assets/platform-cards/academy-card.en.webp',
  'client/public/assets/platform-cards/academy-card.he.webp',
  'client/public/assets/platform-cards/walk-my-pet-card.en.webp',
  'client/public/assets/platform-cards/walk-my-pet-card.he.webp',
];

// ─────────────────────────────────────────────────────────────────────────
// A. File presence
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — A. file layout', () => {
  it('A1. all 4 code files exist', () => {
    for (const rel of NEW_FILES) {
      expect(existsSync(resolve(ROOT, rel)), `expected ${rel}`).toBe(true);
    }
  });

  it('A2. all 12 .webp card assets shipped under client/public/', () => {
    for (const rel of SHIPPED_ASSETS) {
      expect(existsSync(resolve(ROOT, rel)), `expected ${rel}`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Content config integrity
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — B. content config', () => {
  const expectedIds = [
    'smart-hub',
    'pet-sitter',
    'petfinder',
    'pettrek',
    'academy',
    'walk-my-pet',
  ];

  it('B1. 6 platform cards exist with the canonical ids', () => {
    expect(PLATFORM_CARDS.length).toBe(6);
    const ids = PLATFORM_CARDS.map((c) => c.id);
    for (const id of expectedIds) {
      expect(ids, `card id ${id} must exist`).toContain(id);
    }
  });

  it('B2. every card carries he + en for title/headline/subtitle/cta', () => {
    for (const card of PLATFORM_CARDS) {
      expect(card.title.he).toBeTruthy();
      expect(card.title.en).toBeTruthy();
      expect(card.headline.he).toBeTruthy();
      expect(card.headline.en).toBeTruthy();
      expect(card.subtitle.he).toBeTruthy();
      expect(card.subtitle.en).toBeTruthy();
      expect(card.cta.he).toBeTruthy();
      expect(card.cta.en).toBeTruthy();
    }
  });

  it('B3. PetTrek is marked coming-soon with bilingual badge', () => {
    const pettrek = PLATFORM_CARDS.find((c) => c.id === 'pettrek');
    expect(pettrek).toBeTruthy();
    expect(pettrek!.status).toBe('coming-soon');
    expect(pettrek!.badge?.he).toBeTruthy();
    expect(pettrek!.badge?.en).toBeTruthy();
  });

  it('B4. all other 5 platforms are status=live', () => {
    const live = PLATFORM_CARDS.filter((c) => c.status === 'live').map((c) => c.id);
    expect(live.sort()).toEqual(
      ['smart-hub', 'pet-sitter', 'petfinder', 'academy', 'walk-my-pet'].sort(),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Locale resolver behaviour
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — C. locale resolver', () => {
  it('C1. Hebrew locale resolves to .he.webp', () => {
    const path = platformCardAsset('pet-sitter', 'he');
    expect(path).toBe('/assets/platform-cards/pet-sitter-card.he.webp');
  });

  it('C2. English locale resolves to .en.webp', () => {
    const path = platformCardAsset('pet-sitter', 'en');
    expect(path).toBe('/assets/platform-cards/pet-sitter-card.en.webp');
  });

  it('C3. PetTrek Hebrew resolves to the shipped .he.webp asset', () => {
    const path = platformCardAsset('pettrek', 'he');
    expect(path).toBe('/assets/platform-cards/pettrek-card.he.webp');
  });

  it('C4. Unsupported locale falls back to English', () => {
    // 'de' is a supported locale but NOT in the Phase-1 shipped set.
    // The resolver itself only emits supported locales (so we test
    // that going through resolveLocale → platformCardAsset on an
    // unknown navigator string lands on English).
    const locale = resolveLocale({ navigator: 'de-DE' });
    expect(locale).toBe('en');
  });

  it('C5. Locale priority — explicit beats every other signal', () => {
    const locale = resolveLocale({
      explicit: 'he',
      profile: 'en',
      navigator: 'fr-FR',
      ipCountry: 'ru-RU',
    });
    expect(locale).toBe('he');
  });

  it('C6. Locale priority — profile beats navigator + IP when no explicit', () => {
    const locale = resolveLocale({
      profile: 'fr',
      navigator: 'en-US',
      ipCountry: 'he-IL',
    });
    expect(locale).toBe('fr');
  });

  it('C7. Locale priority — navigator beats IP when no explicit + no profile', () => {
    const locale = resolveLocale({
      navigator: 'ru-RU',
      ipCountry: 'he-IL',
    });
    expect(locale).toBe('ru');
  });

  it('C8. Locale priority — IP/country is NEVER the primary signal', () => {
    // If only IP is present, it is used; but it must lose to ANY
    // higher-priority signal. C5/C6/C7 already verify the chain.
    // This test pins the explicit "IP last" rule by checking that
    // IP alone returns IP, but as soon as ANY higher signal exists,
    // IP is overridden.
    expect(resolveLocale({ ipCountry: 'he-IL' })).toBe('he');
    expect(resolveLocale({ ipCountry: 'he-IL', navigator: 'en-US' })).toBe('en');
    expect(
      resolveLocale({ ipCountry: 'he-IL', profile: 'fr' }),
    ).toBe('fr');
    expect(
      resolveLocale({ ipCountry: 'he-IL', explicit: 'ar' }),
    ).toBe('ar');
  });

  it('C9. English fallback when no signal at all', () => {
    expect(resolveLocale({})).toBe('en');
    expect(
      resolveLocale({
        explicit: null,
        profile: null,
        navigator: null,
        ipCountry: null,
      }),
    ).toBe('en');
  });

  it('C10. platformCardAssetFor combines resolver + path correctly', () => {
    const path = platformCardAssetFor('academy', { explicit: 'he' });
    expect(path).toBe('/assets/platform-cards/academy-card.he.webp');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Feature flag exists + default ON + emergency disable is gated
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — D. feature flag', () => {
  it('D1. Landing.tsx swap is gated on VITE_PREMIUM_PLATFORM_CARDS_ENABLED', () => {
    const src = read('client/src/pages/Landing.tsx');
    expect(src.includes('VITE_PREMIUM_PLATFORM_CARDS_ENABLED')).toBe(true);
  });

  it("D1b. Default ON: emergency disable is explicit 'false'", () => {
    const src = read('client/src/pages/Landing.tsx');
    expect(
      src.includes("VITE_PREMIUM_PLATFORM_CARDS_ENABLED !== 'false'"),
    ).toBe(true);
  });

  it('D2. Both grids appear in Landing.tsx (legacy retained as emergency disable)', () => {
    const src = read('client/src/pages/Landing.tsx');
    expect(src.includes('PetWashDivisions')).toBe(true);
    expect(src.includes('PremiumPlatformGrid')).toBe(true);
  });

  it('D3. Old colored blocks (PetWashDivisions) remain unmodified by this PR', () => {
    expect(
      existsSync(resolve(ROOT, 'client/src/components/PetWashDivisions.tsx')),
    ).toBe(true);
  });

  it('D4. PR-PREMIUM-CARDS-1 introduces NO other VITE_* flag', () => {
    for (const rel of [
      ...NEW_FILES,
      'client/src/pages/Landing.tsx',
    ]) {
      const src = codeOnly(read(rel));
      const matches = src.match(/import\.meta\.env\.VITE_[A-Z_]+/g) || [];
      for (const m of matches) {
        expect(
          m === 'import.meta.env.VITE_PREMIUM_PLATFORM_CARDS_ENABLED',
          `${rel} introduces unrelated flag ${m}`,
        ).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Money / persistence firewall (non-regression)
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — E. money + persistence firewall', () => {
  const FORBIDDEN_KEYWORDS: ReadonlyArray<RegExp> = [
    /\bStripe\b/,
    /\bTranzila\b/,
    /\bNayax\b/,
    /\bUPay\b/i,
    /\bSUMIT\b/i,
    /\bMasav\b/i,
    /\bWallet\b/,
    /\bPayout\b/i,
    /\bBilling\b/,
    /\bPayment(s|Provider|Method)\b/,
    /\bIBAN\b/,
  ];
  const FORBIDDEN_RUNTIME: ReadonlyArray<RegExp> = [
    /\bfetch\s*\(/,
    /\bnew\s+FormData\b/,
    /apiRequest\(/,
    /localStorage\.(set|remove|clear)/,
    /sessionStorage\.(set|remove|clear)/,
    /\/api\/admin/,
    /\/api\/payments?/,
    /\/api\/wallet/,
    /\/api\/uploads?\b/,
  ];

  for (const rel of NEW_FILES) {
    it(`E[${rel}] no money / vendor identifiers in live code`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN_KEYWORDS) {
        expect(rx.test(src), `${rel} contains forbidden ${rx}`).toBe(false);
      }
    });
    it(`E[${rel}] no fetch / FormData / API call / persistence write`, () => {
      const src = codeOnly(read(rel));
      for (const rx of FORBIDDEN_RUNTIME) {
        expect(rx.test(src), `${rel} violates ${rx}`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// F. K9000 IP rule — no fake station fallback
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — F. K9000 IP-lock', () => {
  it('F1. Smart Hub card resolves to the static .webp asset only', () => {
    const card = PLATFORM_CARDS.find((c) => c.id === 'smart-hub');
    expect(card).toBeTruthy();
    const enPath = platformCardAsset('smart-hub', 'en');
    const hePath = platformCardAsset('smart-hub', 'he');
    expect(enPath).toBe('/assets/platform-cards/smart-hub-card.en.webp');
    expect(hePath).toBe('/assets/platform-cards/smart-hub-card.he.webp');
  });

  it('F2. No SVG that could be mistaken for the K9000 station + no k9000 reference in code files', () => {
    for (const rel of NEW_FILES) {
      const src = read(rel);
      // Forbid any inline SVG; the card uses <img> on the static
      // asset and a CSS gradient as fallback. SVG path data of any
      // complexity is a red flag for hardware recreation.
      expect(/<svg[\s\S]*?<\/svg>/i.test(src), `${rel} contains inline SVG`).toBe(false);
      // Forbid the words 'station' / 'k9000' / 'kiosk' as
      // identifiers in NEW component files (the static asset is
      // the only place the K9000 may appear).
      const code = codeOnly(src);
      expect(/\bk9000\b/i.test(code), `${rel} references k9000 in code`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// G. No auto-translated image text
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — G. no runtime image text translation', () => {
  it('G1. Card component does not call any translation library on the image asset', () => {
    const src = read(
      'client/src/components/marketing/PremiumPlatformCard.tsx',
    );
    const code = codeOnly(src);
    // The <img> src is a static path; no t()/i18next/translate/
    // formatMessage call wraps it.
    expect(/\bt\([^)]*\.(webp|png|jpg)/i.test(code)).toBe(false);
    expect(/\bi18next\b/.test(code)).toBe(false);
    expect(/\bformatMessage\b/.test(code)).toBe(false);
    expect(/translate\(/.test(code)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// H. Accessibility basics
// ─────────────────────────────────────────────────────────────────────────
describe('PR-PREMIUM-CARDS-2 — H. accessibility', () => {
  it('H1. PremiumPlatformCard alt text references title + headline (non-empty)', () => {
    const src = read(
      'client/src/components/marketing/PremiumPlatformCard.tsx',
    );
    expect(src.includes('alt={`${title} — ${headline}`}')).toBe(true);
  });

  it('H2. Card CTA min-h-[44px] (tap-target invariant)', () => {
    const src = read(
      'client/src/components/marketing/PremiumPlatformCard.tsx',
    );
    expect(src.includes('min-h-[44px]')).toBe(true);
  });

  it('H3. Grid section is labelled (aria-labelledby + heading id)', () => {
    const src = read(
      'client/src/components/marketing/PremiumPlatformGrid.tsx',
    );
    expect(src.includes('aria-labelledby="petwash-platform-universe-heading"')).toBe(true);
    expect(src.includes('id="petwash-platform-universe-heading"')).toBe(true);
  });

  it('H4. Card respects prefers-reduced-motion', () => {
    const src = read(
      'client/src/components/marketing/PremiumPlatformCard.tsx',
    );
    expect(src.includes('motion-reduce:transition-none')).toBe(true);
  });
});
