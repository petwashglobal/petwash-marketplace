/**
 * Premium platform grid (PR-PREMIUM-CARDS-1).
 *
 * Renders the 6-platform "PetWash Platform Universe" section
 * on the homepage. Replaces the legacy PetWashDivisions colored-
 * block component when the VITE_PREMIUM_PLATFORM_CARDS_ENABLED
 * feature flag is on.
 *
 * Layout (CEO direction 2026-05-15):
 *   • Phone, iPad portrait, iPad landscape, small laptop (<1280px):
 *     1 column. Each card stands alone, scrolling down. Cards must
 *     never be cramped next to each other on tablets or small screens.
 *   • Desktop / large laptop (≥xl, 1280px+): 3 columns. Real desktop
 *     width is the only place cards have room to breathe side-by-side.
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
      className="bg-[#fbfbf7] pt-[clamp(40px,8vw,96px)] pb-[calc(clamp(56px,10vw,96px)_+_env(safe-area-inset-bottom))]"
      data-pr-premium-grid="true"
      aria-labelledby="petwash-platform-universe-heading"
    >
      {/* Container width: min(92%, 1560px) — 4% breathing room on
          each side of the card column on every viewport, capped at
          1560px on large desktops so 3 cards at xl get a real
          editorial width (~480px each at 1560px ÷ 3 col − gaps)
          instead of the cramped ~430px the older 1400px cap produced.
          No horizontal padding on the inner container; the 92% width
          creates the margin. */}
      <div className="mx-auto w-[min(92%,1560px)]">
        <header className="mb-[clamp(28px,5vw,56px)] text-center">
          <h2
            id="petwash-platform-universe-heading"
            className="text-[clamp(28px,5vw,48px)] font-light tracking-tight text-[#07140d]"
          >
            {PLATFORM_UNIVERSE_HEADING[heading]}
          </h2>
        </header>
        {/* Column logic — CEO direction 2026-05-15 (reverses earlier
            2026-05-14 multi-column rule): platform cards must NEVER appear
            next to each other on phones, tablets, or large tablets. They are
            designed as premium poster-framed cards that read best one per
            screen, scrolling down. Each card is its own standalone idea, not
            a cell in a 2-up grid that crops them.
            - default through lg (≤1279px): 1 column, full container width.
              Covers every iPhone (any orientation), iPad portrait, iPad
              landscape, small laptops.
            - xl (≥1280px): 3 columns — only true desktop / large laptop,
              where the cards have room to breathe side-by-side without
              cropping or text overflow. */}
        {/* Gap: clamp(32px,5vw,72px) — larger inter-card gap so each
            card reads as its own standalone surface on large laptops
            (≥xl, 3-col layout), where white-on-cream card-vs-shell
            contrast is otherwise too low for a small gap to register
            visually. On 1-col layouts the same gap becomes vertical
            rhythm between stacked cards. */}
        <div className="grid grid-cols-1 gap-[clamp(32px,5vw,72px)] xl:grid-cols-3">
          {PLATFORM_CARDS.map((card) => (
            <PremiumPlatformCard key={card.id} card={card} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
