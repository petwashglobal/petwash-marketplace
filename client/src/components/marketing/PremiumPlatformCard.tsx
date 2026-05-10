/**
 * Premium platform card (PR-PREMIUM-CARDS-1).
 *
 * Single luxury card surface. White / soft-ivory background,
 * PetWash green accents, large readable typography, premium
 * editorial layout, big image, minimal icons, mobile-first.
 *
 * Hard rules (CEO directive 2026-05-10):
 *   • Image is a static .webp asset; never auto-translated.
 *   • Smart Hub image is IP-locked 1:1 K9000 station; never
 *     recreate or distort.
 *   • If both locale variants of the .webp are missing from
 *     the build, the card falls back to a luxury CSS gradient
 *     + headline; it never tries to fake the station, never
 *     paints fake hardware, never embeds an SVG that could be
 *     mistaken for the K9000.
 */
import { Link } from 'wouter';
import {
  platformCardAssetFor,
  type SupportedLocale,
} from '../../lib/platformCardAsset';
import type { PlatformCardContent } from '../../content/platformCards';

interface PremiumPlatformCardProps {
  card: PlatformCardContent;
  locale: SupportedLocale;
}

export function PremiumPlatformCard({ card, locale }: PremiumPlatformCardProps) {
  const lang: 'he' | 'en' = locale === 'he' ? 'he' : 'en';
  const assetSrc = platformCardAssetFor(card.id, { explicit: locale });

  const title = card.title[lang];
  const headline = card.headline[lang];
  const subtitle = card.subtitle[lang];
  const cta = card.cta[lang];
  const badgeLabel = card.badge?.[lang];
  const isComingSoon = card.status === 'coming-soon';

  return (
    <article
      className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_8px_24px_rgba(7,20,13,0.06)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(7,20,13,0.10)] motion-reduce:transition-none focus-within:shadow-[0_12px_32px_rgba(7,20,13,0.10)]"
      data-pr-premium-card="true"
      data-platform-id={card.id}
    >
      {/* Image surface (static asset; CSS gradient fallback if
          both .webp variants are missing). */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
        <img
          src={assetSrc}
          alt={`${title} — ${headline}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => {
            // Graceful: hide broken image; gradient fallback
            // shows through.
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />

        {isComingSoon && badgeLabel && (
          <span
            className="absolute end-4 top-4 inline-flex items-center rounded-full bg-emerald-700 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white shadow-sm"
            data-pr-premium-card-badge="true"
          >
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Editorial copy block (overlaid HTML; selectable; accessible).
          Mobile padding intentionally tighter than desktop —
          CEO directive 2026-05-10 ("less dead space; tighter mobile
          layout; more content visible; still clean"). Desktop keeps
          editorial breathing room. */}
      <div className="px-5 py-4 text-start sm:px-8 sm:py-8">
        <h3 className="text-2xl font-light leading-tight tracking-tight text-[#07140d] sm:text-3xl">
          {title}
        </h3>
        <p className="mt-2 text-lg font-medium leading-snug text-emerald-800 sm:mt-3 sm:text-xl">
          {headline}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:mt-3 sm:text-base">
          {subtitle}
        </p>
        <div className="mt-4 sm:mt-6">
          <Link
            href={card.href}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald-700 px-5 text-base font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transition-none sm:px-6"
            data-pr-premium-card-cta="true"
          >
            {cta}
          </Link>
        </div>
      </div>
    </article>
  );
}
