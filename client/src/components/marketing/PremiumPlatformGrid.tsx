/**
 * Premium platform grid (PR-PREMIUM-CARDS-1).
 *
 * Renders the 6-platform "PetWash Platform Universe" section
 * on the homepage. Replaces the legacy PetWashDivisions colored-
 * block component when the VITE_PREMIUM_PLATFORM_CARDS_ENABLED
 * feature flag is on.
 *
 * Layout:
 *   • Mobile: single-column stack, premium spacing
 *   • Tablet (sm): 2 columns
 *   • Desktop (lg): 3 columns
 *
 * Locale resolution per the CEO directive: explicit prop first,
 * then navigator.language, then English fallback. IP/country is
 * NEVER the primary signal.
 */
import {
  PLATFORM_CARDS,
  PLATFORM_UNIVERSE_HEADING,
} from '../../content/platformCards';
import {
  resolveLocale,
  type SupportedLocale,
} from '../../lib/platformCardAsset';
import { PremiumPlatformCard } from './PremiumPlatformCard';
import type { Language } from '../../lib/i18n';

interface PremiumPlatformGridProps {
  /** Explicit app language from the page-level language store
   *  (highest-priority signal in the resolver chain). */
  language: Language;
}

export function PremiumPlatformGrid({ language }: PremiumPlatformGridProps) {
  const navigatorLanguage =
    typeof navigator !== 'undefined' ? navigator.language : null;

  const locale: SupportedLocale = resolveLocale({
    explicit: language,
    navigator: navigatorLanguage,
  });

  const heading: 'he' | 'en' = locale === 'he' ? 'he' : 'en';

  return (
    <section
      className="bg-[#fbfbf7] py-16 sm:py-20 lg:py-24"
      data-pr-premium-grid="true"
      aria-labelledby="petwash-platform-universe-heading"
    >
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12">
        <header className="mb-10 text-center sm:mb-14">
          <h2
            id="petwash-platform-universe-heading"
            className="text-3xl font-light tracking-tight text-[#07140d] sm:text-4xl lg:text-5xl"
          >
            {PLATFORM_UNIVERSE_HEADING[heading]}
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          {PLATFORM_CARDS.map((card) => (
            <PremiumPlatformCard key={card.id} card={card} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
