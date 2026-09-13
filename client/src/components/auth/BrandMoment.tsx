import { PetWashLogo } from '@/components/brand/PetWashLogo';

/**
 * BrandMoment — screen 6 of the CEO's "Returning User – Sign in with Google"
 * flow (2026-09-13): "The PetWash Experience — straight back to what they
 * love". A full-bleed, deep-green brand beat with the white logo, the slogan
 * and the dog, shown for a moment between Welcome Back and the member's home.
 *
 * It is deliberately short and skippable (a tap anywhere continues), because
 * the same flow promises "no extra forms or checkboxes". The caller owns the
 * timer and the navigation; this component only draws.
 *
 * Copy: the mockup's Hebrew lettering is image-generator text, not words, so
 * the screen uses the brand's real slogan — the same lines Welcome Back shows.
 * Photo: the founder-owned bandana dog. The towel photo in the mockup is not an
 * asset we own, and a generated one would not be the real brand.
 * Centred text is inline on purpose (Tailwind text-center is dead under
 * html[lang="he"]).
 */
export const BRAND_MOMENT_PHOTO = '/brand/hero-dog-lux.jpg';
export const BRAND_GREEN = '#0c4a33';

export function BrandMoment({ he, onSkip }: { he: boolean; onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      dir={he ? 'rtl' : 'ltr'}
      className="fixed inset-0 flex flex-col items-center overflow-hidden text-white pw-brand-moment"
      style={{ background: BRAND_GREEN, zIndex: 70, border: 0, padding: 0, cursor: 'pointer' }}
      aria-label={he ? 'המשך' : 'Continue'}
      data-testid="brand-moment"
    >
      <style>{`
        .pw-brand-moment { animation: pwBrandIn 360ms ease-out both; }
        .pw-brand-moment .pw-bm-photo { animation: pwBrandZoom 1600ms ease-out both; }
        @keyframes pwBrandIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pwBrandZoom { from { transform: scale(1.06) } to { transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) {
          .pw-brand-moment, .pw-brand-moment .pw-bm-photo { animation: none; }
        }
      `}</style>

      <img
        src={BRAND_MOMENT_PHOTO}
        alt=""
        className="pw-bm-photo absolute inset-0 w-full h-full object-cover object-top"
        loading="eager"
        decoding="async"
        draggable={false}
      />
      {/* Green wash so the white logo and slogan always read over the photo. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN}d9 34%, ${BRAND_GREEN}33 62%, ${BRAND_GREEN}cc 100%)` }}
        aria-hidden
      />

      <div className="relative pt-16">
        <PetWashLogo variant="white" size={48} priority />
      </div>

      <div className="relative mt-10 px-8" data-testid="brand-moment-slogan">
        <div className="leading-tight font-semibold" style={{ textAlign: 'center', fontSize: 34 }}>
          {he ? 'חיות נקיות' : 'Clean pets'}
        </div>
        <div className="leading-tight font-semibold" style={{ textAlign: 'center', fontSize: 34 }}>
          {he ? 'חיים שמחים ♡' : 'happier lives ♡'}
        </div>
      </div>

      <div
        className="relative mt-auto pb-10 opacity-90"
        dir="ltr"
        style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.22em' }}
      >
        CLEAN PETS. HAPPIER LIVES.
      </div>
    </button>
  );
}

export default BrandMoment;
