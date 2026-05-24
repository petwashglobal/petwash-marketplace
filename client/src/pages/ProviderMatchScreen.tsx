/**
 * ProviderMatchScreen — Premium PetWash "Finding your perfect provider" flow
 *
 * Owner intent (per spec):
 *   PetWash is personally finding a trusted provider for the customer.
 *   Feels luxury, smart, calm, alive — not "loading a page".
 *
 * UX flow:
 *   idle      → "Get matched" CTA + service chips
 *   searching → 4 progressive labelled phases (location / nearby / matching / availability)
 *   matched   → provider card + "Continue booking" CTA + trust pills
 *   no_match  → graceful empty state with retry
 *   error     → graceful connection-failed state with retry
 *
 * Hero asset:
 *   Uses /brand/hero-dog-lux.jpg today. When the canonical
 *   PETWASH MATCHING PROCESS.PNG is dropped at
 *   client/public/brand/petwash-matching-process.png the component
 *   prefers it via the <picture> source below — no code change needed.
 *
 * Logo:
 *   /brand/petwash-logo-official.png — used exactly as supplied.
 *   Never recoloured / cropped / stretched (brand rule).
 *
 * Backend safety (per spec):
 *   - Only PUBLIC trust wording shown ("Verified by PetWash", "Top rated",
 *     "Pet-friendly"). No background-check / KYC / risk-score fields.
 *   - The "Continue booking" CTA routes to the existing safest intake
 *     (BookingConfirmation) and does NOT call any booking-confirm /
 *     payment endpoint directly — that lives downstream in the existing
 *     /api/booking-requests/:id/confirm path the BookingConfirmation
 *     page already owns.
 *
 * Performance:
 *   - All animations are transform/opacity only (GPU composited).
 *   - prefers-reduced-motion: pulses + phase-text crossfades are
 *     disabled, content still progresses through states.
 *   - Hero image uses fetchpriority="high" so first paint isn't slow.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, MapPin, Clock, Star, Check } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import {
  useMatchingEngine,
  type ServiceType,
  type ProviderMatch,
} from '@/hooks/useMatchingEngine';

// ── Brand tokens ─────────────────────────────────────────────────────────────
const CREAM = '#FAF8F4';
const INK = '#0B0B0B';
const INK_SOFT = '#5C5C5C';
const INK_MUTED = '#9A958C';
const GOLD = '#C5A55A';
const GOLD_SOFT = 'rgba(197,165,90,0.08)';
const GOLD_LINE = 'rgba(197,165,90,0.35)';
const LOGO_SRC = '/brand/petwash-logo-official.png';
const HERO_PRIMARY = '/brand/petwash-matching-process.png';
const HERO_FALLBACK = '/brand/hero-dog-lux.jpg';

// ── Copy (EN + HE) ───────────────────────────────────────────────────────────
const COPY = {
  en: {
    back: 'Back',
    headline: 'Finding your perfect provider',
    sub: 'Walk, wash or sit — we’re matching you with a trusted PetWash provider near you.',
    idleCard: 'Ready to find your provider',
    cta: 'Get matched',
    smartLine: 'Smart matching based on location, service, availability and provider quality.',
    services: { grooming: 'Grooming', walking: 'Dog walking', k9000: 'K9000 self-wash' },
    phases: [
      { title: 'Checking nearby providers', body: 'Scanning trusted PetWash providers around you.' },
      { title: 'Reviewing availability', body: 'Comparing your time window with provider calendars.' },
      { title: 'Matching with your pet’s needs', body: 'Service, distance and provider fit.' },
      { title: 'Provider found', body: 'A verified PetWash provider is ready for your booking.' },
    ],
    searchingTitle: 'Searching nearby',
    searchingBody: 'We’re finding the best PetWash provider for you.',
    cancel: 'Cancel',
    trust: { verified: 'Verified', topRated: 'Top rated', petFriendly: 'Pet-friendly' },
    continue: 'Continue booking',
    searchAgain: 'Search again',
    noMatchTitle: 'No provider available for that time',
    noMatchBody: 'Try another time, expand the radius, or request a callback.',
    errorTitle: 'Connection unavailable',
    errorBody: 'We couldn’t reach the matching service. Check your connection and try again.',
    retry: 'Try again',
    heroAlt: 'A PetWash customer walking happily with their dog on a Tel Aviv street',
    logoAlt: 'PetWash',
  },
  he: {
    back: 'חזרה',
    headline: 'מוצאים לך את הספק המושלם',
    sub: 'טיול, שטיפה או שמרטף חיות — אנחנו מתאימים לך ספק PetWash מהימן בקרבת מקום.',
    idleCard: 'מוכנים למצוא לך ספק',
    cta: 'התאם לי ספק',
    smartLine: 'התאמה חכמה לפי מיקום, שירות, זמינות ואיכות הספק.',
    services: { grooming: 'טיפוח', walking: 'הליכת כלבים', k9000: 'שטיפה עצמית K9000' },
    phases: [
      { title: 'מאתרים ספקים בקרבת מקום', body: 'סורקים ספקי PetWash מהימנים סביבך.' },
      { title: 'בודקים זמינות', body: 'מצליבים את חלון הזמן שלך עם יומני הספקים.' },
      { title: 'מתאימים לצרכי חיית המחמד', body: 'שירות, מרחק והתאמת ספק.' },
      { title: 'נמצא ספק', body: 'ספק PetWash מאומת מוכן להזמנה.' },
    ],
    searchingTitle: 'מחפשים בקרבת מקום',
    searchingBody: 'אנחנו מוצאים עבורך את ספק PetWash הטוב ביותר.',
    cancel: 'ביטול',
    trust: { verified: 'מאומת', topRated: 'מדורג מצוין', petFriendly: 'ידידותי לחיות' },
    continue: 'המשך להזמנה',
    searchAgain: 'חיפוש חוזר',
    noMatchTitle: 'אין ספק זמין לזמן זה',
    noMatchBody: 'נסה זמן אחר, הרחב את הרדיוס או בקש שיחה חוזרת.',
    errorTitle: 'בעיית חיבור',
    errorBody: 'לא הצלחנו להגיע לשירות ההתאמה. בדוק את החיבור ונסה שוב.',
    retry: 'נסה שוב',
    heroAlt: 'לקוח PetWash מטייל עם כלבו ברחוב בתל אביב',
    logoAlt: 'PetWash',
  },
};

// Shared shape used by child component props — typed off COPY.en
// AFTER `as const` was removed (above) so values widen to plain
// strings. EN and HE then share an identical structural shape and
// the union of the two narrows cleanly when passed as a prop.
type Copy = typeof COPY['en'];

const SERVICES: { key: ServiceType }[] = [
  { key: 'grooming' },
  { key: 'walking' },
  { key: 'k9000' },
];

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ProviderMatchScreen() {
  const { language } = useLanguage();
  const t = COPY[language === 'he' ? 'he' : 'en'];
  const isRtl = language === 'he';
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();

  const [service, setService] = useState<ServiceType>('grooming');
  const { state, match, start, cancel } = useMatchingEngine('demo', service);

  // ── Phase ticker — runs only during `searching` ──────────────────────────
  // Splits the demo's ~2.4s search into 3 narrated phases. The 4th phase
  // ("Provider found") is rendered when state === 'matched'. Phases stop
  // ticking on cancel / unmount via cleanup.
  const [phaseIdx, setPhaseIdx] = useState(0);
  useEffect(() => {
    if (state !== 'searching') {
      setPhaseIdx(0);
      return;
    }
    if (reducedMotion) {
      setPhaseIdx(2); // jump to the final pre-match phase, no flicker
      return;
    }
    const timers = [
      setTimeout(() => setPhaseIdx(1), 800),
      setTimeout(() => setPhaseIdx(2), 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [state, reducedMotion]);

  const visiblePhase =
    state === 'matched'
      ? t.phases[3]
      : t.phases[Math.min(phaseIdx, t.phases.length - 2)];

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="select-none"
      style={{
        backgroundColor: CREAM,
        minHeight: '100dvh',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* ── Header: official logo, never recoloured ─────────────────────── */}
      <header
        className="flex items-center justify-between px-5"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: 14,
        }}
      >
        <Link href="/">
          <button
            aria-label={t.back}
            className="flex items-center gap-1 transition-colors"
            style={{ color: INK_MUTED, touchAction: 'manipulation' }}
          >
            <ChevronLeft
              size={18}
              strokeWidth={1.6}
              style={{ transform: isRtl ? 'scaleX(-1)' : undefined }}
            />
            <span
              className="text-[12px]"
              style={{ letterSpacing: '0.04em' }}
            >
              {t.back}
            </span>
          </button>
        </Link>

        <img
          src={LOGO_SRC}
          alt={t.logoAlt}
          width={108}
          height={28}
          decoding="async"
          loading="eager"
          style={{
            height: 28,
            width: 'auto',
            objectFit: 'contain',
            // Brand rule: never recolour / filter / transform the logo
          }}
        />

        <div style={{ width: 64 }} aria-hidden />
      </header>

      {/* ── Layout: hero left (≥md) or top (mobile), content right/below ── */}
      <main
        className="grid w-full mx-auto"
        style={{
          maxWidth: 1280,
          paddingInline: 'max(env(safe-area-inset-left, 0px), 20px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 28px)',
          gap: 28,
          // Responsive: 1 column < md, 2 columns ≥ md.
          gridTemplateColumns: 'minmax(0, 1fr)',
        }}
      >
        <style>{`
          @media (min-width: 880px) {
            main.pw-match-main {
              grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) !important;
              align-items: center;
              gap: 56px !important;
            }
          }
        `}</style>
        <div className="hidden" />

        {/* this wrapper lets us target the grid via media query */}
        <Hero alt={t.heroAlt} />

        <section
          className="flex flex-col justify-center w-full mx-auto"
          style={{ maxWidth: 460 }}
        >
          {/* Headline + sub */}
          <div className="mb-7">
            <h1
              style={{
                color: INK,
                fontWeight: 300,
                fontSize: 'clamp(28px, 4.2vw, 40px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.08,
              }}
            >
              {/* Render "perfect" / "המושלם" in serif gold for the brand accent */}
              {language === 'he' ? (
                <>
                  מוצאים לך את{' '}
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                      fontStyle: 'italic',
                      color: GOLD,
                      fontWeight: 400,
                    }}
                  >
                    הספק המושלם
                  </span>
                </>
              ) : (
                <>
                  Finding your{' '}
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                      fontStyle: 'italic',
                      color: GOLD,
                      fontWeight: 400,
                    }}
                  >
                    perfect
                  </span>{' '}
                  provider
                </>
              )}
            </h1>
            <div
              style={{
                width: 36,
                height: 1,
                backgroundColor: GOLD,
                marginTop: 14,
                marginBottom: 16,
              }}
            />
            <p
              style={{
                color: INK_SOFT,
                fontSize: 14,
                lineHeight: 1.55,
                letterSpacing: '0.01em',
                maxWidth: 380,
              }}
            >
              {t.sub}
            </p>
          </div>

          {/* State-driven content */}
          <AnimatePresence mode="wait">
            {state === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <IdleCard
                  t={t}
                  service={service}
                  setService={setService}
                  onStart={start}
                />
              </motion.div>
            )}

            {state === 'searching' && (
              <motion.div
                key="searching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SearchingCard
                  t={t}
                  phase={visiblePhase}
                  phaseIdx={Math.min(phaseIdx, 2)}
                  reducedMotion={!!reducedMotion}
                  onCancel={cancel}
                />
              </motion.div>
            )}

            {state === 'matched' && match && (
              <motion.div
                key="matched"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <MatchedCard
                  t={t}
                  match={match}
                  onContinue={() => {
                    // Route to existing safest intake. BookingConfirmation
                    // owns the actual /api/booking-requests/:id/confirm call —
                    // we never confirm here. If the route requires an existing
                    // request id, navigate user to the booking flow instead.
                    navigate('/booking');
                  }}
                  onSearchAgain={cancel}
                />
              </motion.div>
            )}

            {(state === 'no_match' || state === 'error') && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <EmptyStateCard
                  t={t}
                  variant={state}
                  onRetry={cancel}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Smart-matching reassurance line — idle only */}
          {state === 'idle' && (
            <p
              style={{
                color: INK_MUTED,
                fontSize: 11,
                marginTop: 18,
                letterSpacing: '0.02em',
                lineHeight: 1.45,
              }}
            >
              {t.smartLine}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
const Hero = memo(function Hero({ alt }: { alt: string }) {
  return (
    <div
      className="relative w-full"
      style={{
        // Mobile: comfortable hero height. Desktop overrides via media query.
        aspectRatio: '4 / 3',
        maxHeight: 520,
        borderRadius: 20,
        overflow: 'hidden',
        // Subtle warm tint that matches the cream background and avoids the
        // hero feeling like a stuck-on rectangle.
        backgroundColor: '#EFEAE0',
      }}
    >
      {/* <picture> lets the canonical asset take over the moment it lands. */}
      <picture>
        <source srcSet={HERO_PRIMARY} type="image/png" />
        <img
          src={HERO_FALLBACK}
          alt={alt}
          loading="eager"
          decoding="async"
          // @ts-expect-error — fetchpriority is valid HTML, TS DOM lib lags
          fetchpriority="high"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            display: 'block',
          }}
        />
      </picture>

      {/* Soft cream wash from bottom-left so headline doesn't fight image. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(250,248,244,0) 55%, rgba(250,248,244,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Map-route motif: thin animated dotted path top-left */}
      <RouteMotif />
    </div>
  );
});

// ── Animated route / pin motif ───────────────────────────────────────────────
const RouteMotif = memo(function RouteMotif() {
  const reduced = useReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 120"
      style={{
        position: 'absolute',
        bottom: 14,
        insetInlineStart: 14,
        width: 'min(46%, 220px)',
        height: 'auto',
        opacity: 0.95,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="pw-route" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
          <stop offset="40%" stopColor={GOLD} stopOpacity="0.95" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Dotted route */}
      <path
        d="M10 90 Q 70 30, 150 70 T 290 50"
        fill="none"
        stroke="url(#pw-route)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2 7"
      />

      {/* Start pin */}
      <g transform="translate(10, 90)">
        <circle r={5} fill="white" stroke={GOLD} strokeWidth={1.5} />
        <circle r={2} fill={GOLD} />
      </g>

      {/* Pulsing match pin at end */}
      <g transform="translate(290, 50)">
        {!reduced && (
          <motion.circle
            r={9}
            fill={GOLD}
            opacity={0.25}
            animate={{ r: [9, 18], opacity: [0.25, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            style={{ willChange: 'r, opacity' }}
          />
        )}
        <circle r={6} fill="white" stroke={GOLD} strokeWidth={1.5} />
        <circle r={3} fill={GOLD} />
      </g>
    </svg>
  );
});

// ── Idle card: service chips + Get matched CTA ───────────────────────────────
function IdleCard({
  t,
  service,
  setService,
  onStart,
}: {
  t: Copy;
  service: ServiceType;
  setService: (s: ServiceType) => void;
  onStart: () => void;
}) {
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 20,
        padding: 22,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.02), 0 12px 32px rgba(11,11,11,0.06)',
      }}
    >
      <p
        style={{
          color: INK,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          marginBottom: 14,
        }}
      >
        {t.idleCard}
      </p>

      <div
        role="radiogroup"
        aria-label="Service"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}
      >
        {SERVICES.map((s) => {
          const active = service === s.key;
          return (
            <button
              key={s.key}
              role="radio"
              aria-checked={active}
              onClick={() => setService(s.key)}
              style={{
                touchAction: 'manipulation',
                paddingInline: 14,
                paddingBlock: 9,
                borderRadius: 999,
                fontSize: 12,
                letterSpacing: '0.02em',
                color: active ? INK : INK_SOFT,
                backgroundColor: active ? GOLD_SOFT : 'transparent',
                border: `1px solid ${active ? GOLD_LINE : 'rgba(0,0,0,0.08)'}`,
                transition: 'all 140ms ease',
              }}
            >
              {t.services[s.key]}
            </button>
          );
        })}
      </div>

      <button
        onClick={onStart}
        style={{
          touchAction: 'manipulation',
          width: '100%',
          paddingBlock: 15,
          backgroundColor: INK,
          color: 'white',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderRadius: 14,
          transition: 'transform 100ms ease, background-color 100ms ease',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
        onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {t.cta}
      </button>
    </div>
  );
}

// ── Searching card: 4-phase narration + radar ────────────────────────────────
function SearchingCard({
  t,
  phase,
  phaseIdx,
  reducedMotion,
  onCancel,
}: {
  t: Copy;
  phase: Copy['phases'][number];
  phaseIdx: number;
  reducedMotion: boolean;
  onCancel: () => void;
}) {
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 20,
        padding: 22,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.02), 0 12px 32px rgba(11,11,11,0.06)',
      }}
    >
      <div className="flex items-center" style={{ gap: 16 }}>
        <RadarPulse reducedMotion={reducedMotion} />
        <div className="flex-1 min-w-0">
          <p
            style={{
              color: INK_MUTED,
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {t.searchingTitle}
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={phase.title}
              initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28 }}
              style={{
                color: INK,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                lineHeight: 1.4,
              }}
            >
              {phase.title}
            </motion.p>
          </AnimatePresence>
          <p
            style={{
              color: INK_SOFT,
              fontSize: 12,
              lineHeight: 1.5,
              marginTop: 4,
            }}
          >
            {phase.body}
          </p>
        </div>
      </div>

      {/* Phase progress dots — three intermediate phases, then match */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 18,
          marginBottom: 14,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 2,
              borderRadius: 2,
              backgroundColor: i <= phaseIdx ? GOLD : 'rgba(0,0,0,0.06)',
              transition: 'background-color 240ms ease',
            }}
          />
        ))}
      </div>

      <button
        onClick={onCancel}
        style={{
          touchAction: 'manipulation',
          fontSize: 11,
          color: INK_MUTED,
          letterSpacing: '0.04em',
          textDecoration: 'underline',
          textUnderlineOffset: 4,
        }}
      >
        {t.cancel}
      </button>
    </div>
  );
}

// ── Radar pulse — small, GPU composited, motion-respecting ───────────────────
const RadarPulse = memo(function RadarPulse({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: 56, height: 56 }}
      aria-hidden
    >
      {!reducedMotion &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `1px solid ${GOLD_LINE}`,
              willChange: 'transform, opacity',
            }}
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.7,
              ease: 'easeOut',
            }}
          />
        ))}
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          backgroundColor: GOLD,
          border: '3px solid white',
          boxShadow: '0 1px 4px rgba(197,165,90,0.35)',
        }}
      />
    </div>
  );
});

// ── Matched card: provider + trust pills + Continue booking ──────────────────
function MatchedCard({
  t,
  match,
  onContinue,
  onSearchAgain,
}: {
  t: Copy;
  match: ProviderMatch;
  onContinue: () => void;
  onSearchAgain: () => void;
}) {
  return (
    <div
      className="w-full"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 20,
        padding: 22,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.02), 0 16px 40px rgba(11,11,11,0.08)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          paddingInline: 10,
          paddingBlock: 4,
          borderRadius: 999,
          backgroundColor: GOLD_SOFT,
          color: GOLD,
          border: `1px solid ${GOLD_LINE}`,
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        <Check size={11} strokeWidth={2.4} />
        {t.phases[3].title}
      </div>

      <p
        style={{
          color: INK,
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
          marginBottom: 4,
        }}
      >
        {match.name}
      </p>
      <p
        style={{
          color: INK_MUTED,
          fontSize: 12,
          letterSpacing: '0.02em',
          marginBottom: 16,
        }}
      >
        {match.tagline}
      </p>

      {/* Inline stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 18,
          color: INK_SOFT,
          fontSize: 12,
        }}
      >
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Star size={12} style={{ fill: GOLD, color: GOLD }} />
          <span style={{ color: INK, fontWeight: 500 }}>
            {match.rating.toFixed(1)}
          </span>
          <span style={{ color: INK_MUTED }}>({match.reviewCount})</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={12} />
          {match.distance}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Clock size={12} />
          {match.etaMinutes} min
        </span>
      </div>

      {/* Trust pills — PUBLIC wording only, per spec */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 18,
        }}
      >
        {[t.trust.verified, t.trust.topRated, t.trust.petFriendly].map(
          (label) => (
            <span
              key={label}
              style={{
                paddingInline: 10,
                paddingBlock: 5,
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: '0.02em',
                color: INK_SOFT,
                backgroundColor: '#F4F1EB',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
            >
              {label}
            </span>
          ),
        )}
      </div>

      <p
        style={{
          color: INK_SOFT,
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        {t.phases[3].body}
      </p>

      <button
        onClick={onContinue}
        style={{
          touchAction: 'manipulation',
          width: '100%',
          paddingBlock: 15,
          backgroundColor: INK,
          color: 'white',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderRadius: 14,
          marginBottom: 10,
          transition: 'transform 100ms ease',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
        onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {t.continue}
      </button>

      <button
        onClick={onSearchAgain}
        style={{
          touchAction: 'manipulation',
          width: '100%',
          fontSize: 11,
          color: INK_MUTED,
          letterSpacing: '0.04em',
          textDecoration: 'underline',
          textUnderlineOffset: 4,
        }}
      >
        {t.searchAgain}
      </button>
    </div>
  );
}

// ── Empty state: no_match OR error ───────────────────────────────────────────
function EmptyStateCard({
  t,
  variant,
  onRetry,
}: {
  t: Copy;
  variant: 'no_match' | 'error';
  onRetry: () => void;
}) {
  const title = variant === 'error' ? t.errorTitle : t.noMatchTitle;
  const body = variant === 'error' ? t.errorBody : t.noMatchBody;
  return (
    <div
      className="w-full text-center"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 20,
        padding: '28px 22px',
      }}
    >
      <div
        style={{
          width: 32,
          height: 1,
          backgroundColor: GOLD,
          margin: '0 auto 18px',
        }}
      />
      <p
        style={{
          color: INK,
          fontSize: 15,
          fontWeight: 400,
          marginBottom: 8,
        }}
      >
        {title}
      </p>
      <p
        style={{
          color: INK_SOFT,
          fontSize: 12,
          lineHeight: 1.55,
          marginBottom: 18,
        }}
      >
        {body}
      </p>
      <button
        onClick={onRetry}
        style={{
          touchAction: 'manipulation',
          paddingInline: 28,
          paddingBlock: 12,
          backgroundColor: INK,
          color: 'white',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderRadius: 12,
        }}
      >
        {t.retry}
      </button>
    </div>
  );
}
