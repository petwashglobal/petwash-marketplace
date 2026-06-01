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
      className="relative isolate overflow-hidden rounded-[clamp(22px,3vw,34px)] bg-white border border-black/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.045),0_22px_60px_rgba(0,0,0,0.055)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06),0_28px_72px_rgba(0,0,0,0.07)] motion-reduce:transition-none focus-within:shadow-[0_12px_32px_rgba(0,0,0,0.06),0_28px_72px_rgba(0,0,0,0.07)]"
      data-pr-premium-card="true"
      data-platform-id={card.id}
    >
      {/* Image surface (static asset; CSS gradient fallback if both
          .webp variants are missing). Mobile + tablet + landscape
          phones use object-contain so every pixel of editorial
          artwork (incl. baked-in headline text) stays visible — the
          poster framing the CEO directive of 2026-05-14 calls for.
          Only ≥lg (1024px desktop) reverts to object-cover for the
          immersive layout. White background fills the contain
          letterbox space. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white">
        <img
          src={assetSrc}
          alt={`${title} — ${headline}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain lg:object-cover"
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
          Padding, font sizes and inter-block margins all use clamp()
          so the card scales smoothly from 320px iPhone SE up to
          1400px desktop without per-breakpoint hand-tuning. Per CEO
          directive 2026-05-14: luxury editorial poster framing on
          mobile; readable, calm, intentional on desktop. */}
      <div className="px-[clamp(18px,4vw,36px)] py-[clamp(18px,3vw,32px)] text-start">
        <h3 className="text-[clamp(22px,4vw,32px)] font-light leading-[1.15] tracking-tight text-[#07140d]">
          {title}
        </h3>
        <p className="mt-[clamp(12px,2vw,20px)] text-[clamp(18px,3vw,22px)] font-medium leading-snug text-emerald-800">
          {headline}
        </p>
        <p className="mt-[clamp(10px,2vw,16px)] text-[clamp(14px,2vw,16px)] leading-relaxed text-slate-600">
          {subtitle}
        </p>
        <div className="mt-[clamp(18px,3vw,28px)]">
          <Link
            href={card.href}
            className="inline-flex w-full min-h-[44px] sm:min-h-[54px] items-center justify-center rounded-2xl bg-emerald-700 px-6 text-base font-[650] text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transition-none"
            data-pr-premium-card-cta="true"
          >
            {cta}
          </Link>
        </div>
      </div>
    </article>
  );
}
