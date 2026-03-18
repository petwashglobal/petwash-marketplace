/**
 * ProviderMatchScreen — Luxury provider matching flow
 *
 * Three states: idle (service select) → searching (radar) → matched (card reveal)
 * Also handles: no_match and connection error with graceful empty states.
 *
 * Performance notes:
 * - All animations use transform/opacity only (GPU composited, no layout paint)
 * - RadarAnimation is React.memo — zero re-renders during searching state
 * - Conic-gradient replaced with static linear-gradient + overflow:hidden + rotation
 * - Image is fully preloaded in the hook before state transitions to "matched"
 * - touch-action:manipulation on all buttons removes 300ms iOS tap delay
 * - will-change:transform declared only on actively animated elements
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MapPin, Clock, Phone, ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useMatchingEngine, ServiceType, ProviderMatch } from '@/hooks/useMatchingEngine';

// ── Constants ────────────────────────────────────────────────────────────────
const GOLD = '#C5A55A';
const GOLD_BG = 'rgba(197,165,90,0.08)';
const GOLD_BORDER = 'rgba(197,165,90,0.35)';

const SERVICES: { key: ServiceType; label: string; icon: string; desc: string }[] = [
  { key: 'grooming', label: 'Grooming',    icon: '✂️', desc: 'Premium mobile grooming' },
  { key: 'walking',  label: 'Dog Walking', icon: '🐕', desc: 'GPS-tracked walks' },
  { key: 'k9000',    label: 'K9000 Wash',  icon: '🚿', desc: 'Smart wash stations' },
];

// ── Spring used for all card reveals — no overshoot ─────────────────────────
const REVEAL_TRANSITION = { duration: 0.36, ease: [0.25, 0.46, 0.45, 0.94] } as const;

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ProviderMatchScreen() {
  const [service, setService] = useState<ServiceType>('grooming');
  const { state, match, start, cancel } = useMatchingEngine('demo', service);

  return (
    <div
      className="min-h-screen bg-white flex flex-col select-none"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif", WebkitTapHighlightColor: 'transparent' }}
    >
      {/* ── Header — respects iOS notch ──────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 pb-4 border-b border-gray-100"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)' }}
      >
        <Link href="/">
          <button
            className="flex items-center gap-1 text-gray-400 active:text-gray-700 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ChevronLeft size={17} strokeWidth={1.8} />
            <span className="text-[13px] tracking-wide">Back</span>
          </button>
        </Link>

        <div className="text-center">
          <p className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-0.5">PetWash™</p>
          <p className="text-[13px] font-medium text-gray-800 tracking-wide">Find a Provider</p>
        </div>

        <div className="w-14" />
      </header>

      {/* ── Content ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <AnimatePresence mode="wait">

          {/* IDLE ─────────────────────────────────────────────── */}
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={REVEAL_TRANSITION}
              className="w-full max-w-[340px]"
            >
              <div className="text-center mb-9">
                <h1 className="text-[22px] font-light text-gray-900 tracking-[-0.02em] mb-2">
                  What do you need today?
                </h1>
                <p className="text-[13px] text-gray-400 tracking-[0.02em]">
                  We'll find the best match near you
                </p>
              </div>

              {/* Service selection */}
              <div className="space-y-2.5 mb-10">
                {SERVICES.map((s) => {
                  const active = service === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setService(s.key)}
                      style={{
                        touchAction: 'manipulation',
                        borderColor: active ? GOLD : '#ebebeb',
                        backgroundColor: active ? GOLD_BG : 'white',
                      }}
                      className="w-full flex items-center gap-4 px-5 py-[14px] rounded-2xl border-2 transition-all duration-150 text-left"
                    >
                      <span className="text-xl leading-none">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 leading-tight">{s.label}</p>
                        <p className="text-[11px] text-gray-400 mt-[3px] leading-tight">{s.desc}</p>
                      </div>
                      {/* Selection indicator */}
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150"
                        style={{
                          borderColor: active ? GOLD : '#d0d0d0',
                          backgroundColor: active ? GOLD : 'transparent',
                        }}
                      >
                        {active && (
                          <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                            <path d="M1 3L2.8 4.8L6 1" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* CTA */}
              <button
                onClick={start}
                style={{ touchAction: 'manipulation', backgroundColor: '#111' }}
                className="w-full py-[15px] rounded-2xl text-white text-[12px] font-medium tracking-[0.08em] uppercase transition-all duration-100 active:scale-[0.98]"
              >
                Find My {SERVICES.find(s => s.key === service)?.label}
              </button>

              <p className="text-center text-[11px] text-gray-300 mt-4 tracking-wide">
                Usually matches within seconds
              </p>
            </motion.div>
          )}

          {/* SEARCHING ────────────────────────────────────────── */}
          {state === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
              style={{ gap: '32px' }}
            >
              <RadarAnimation />

              <div className="text-center" style={{ gap: '8px' }}>
                <motion.p
                  className="text-[15px] font-light text-gray-700 tracking-[0.02em]"
                  animate={{ opacity: [1, 0.45, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ willChange: 'opacity' }}
                >
                  Finding the perfect match
                </motion.p>
                <p className="text-[10px] text-gray-400 tracking-[0.18em] uppercase mt-2">
                  {SERVICES.find(s => s.key === service)?.label}
                </p>
              </div>

              {/* Gold dots */}
              <div className="flex gap-[6px]">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-[5px] h-[5px] rounded-full"
                    style={{ backgroundColor: GOLD, willChange: 'opacity' }}
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                  />
                ))}
              </div>

              <button
                onClick={cancel}
                style={{ touchAction: 'manipulation' }}
                className="text-[11px] text-gray-300 tracking-wide underline underline-offset-4 active:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* MATCHED ──────────────────────────────────────────── */}
          {state === 'matched' && match && (
            <motion.div
              key="matched"
              initial={{ opacity: 0, y: 44 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={REVEAL_TRANSITION}
              className="w-full max-w-[340px]"
              style={{ willChange: 'transform, opacity' }}
            >
              {/* Match label */}
              <motion.div
                className="flex justify-center mb-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, ...REVEAL_TRANSITION }}
              >
                <div
                  className="px-4 py-[5px] rounded-full text-[10px] font-medium tracking-[0.18em] uppercase"
                  style={{ backgroundColor: GOLD_BG, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}
                >
                  Match Found
                </div>
              </motion.div>

              {/* Card */}
              <MatchCard match={match} onSearchAgain={cancel} />
            </motion.div>
          )}

          {/* NO MATCH ──────────────────────────────────────────── */}
          {(state === 'no_match' || state === 'error') && (
            <motion.div
              key="no_match"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={REVEAL_TRANSITION}
              className="text-center max-w-[280px]"
            >
              {/* Thin gold line decoration */}
              <div
                className="w-8 h-px mx-auto mb-7"
                style={{ backgroundColor: GOLD }}
              />

              <h2 className="text-[16px] font-light text-gray-800 tracking-[-0.01em] mb-3">
                {state === 'error' ? 'Connection unavailable' : 'No providers nearby'}
              </h2>
              <p className="text-[12px] text-gray-400 leading-relaxed mb-9">
                {state === 'error'
                  ? 'We could not reach the matching service. Please check your connection and try again.'
                  : 'All providers in your area are occupied right now. Try again in a few minutes.'}
              </p>

              <button
                onClick={cancel}
                style={{ touchAction: 'manipulation', backgroundColor: '#111' }}
                className="px-9 py-3 rounded-xl text-[12px] font-medium text-white tracking-[0.08em] uppercase active:scale-95 transition-all"
              >
                Try Again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Radar animation — memoized, zero re-renders during searching ─────────────
const RadarAnimation = memo(function RadarAnimation() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 176, height: 176 }}>

      {/* Pulsing rings — scale+opacity only, GPU composited */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: GOLD_BORDER,
            willChange: 'transform, opacity',
          }}
          animate={{ scale: [1, 1.55 + i * 0.28], opacity: [0.55, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: i * 0.65,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Sweep — static gradient that rotates (no conic-gradient repaint) */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ overflow: 'hidden' }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${GOLD_BORDER} 50%)`,
            willChange: 'transform',
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Center button — no box-shadow on animated element */}
      <div
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          backgroundColor: '#111',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <motion.span
          className="text-[24px] leading-none"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ willChange: 'transform' }}
        >
          🐾
        </motion.span>
      </div>
    </div>
  );
});

// ── Match card — memoized to prevent unnecessary re-renders ──────────────────
const MatchCard = memo(function MatchCard({
  match,
  onSearchAgain,
}: {
  match: ProviderMatch;
  onSearchAgain: () => void;
}) {
  return (
    <>
      <div
        className="bg-white rounded-3xl overflow-hidden"
        style={{
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 6px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Image area */}
        <div
          className="relative flex items-center justify-center"
          style={{ height: 172, backgroundColor: '#fafafa' }}
        >
          {/* Gold accent line — top */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent 10%, ${GOLD} 50%, transparent 90%)`,
            }}
          />

          <img
            src={match.image}
            alt={match.name}
            className="object-contain"
            style={{ width: 112, height: 112 }}
            loading="eager"
            decoding="sync"
          />

          {/* Service pill */}
          <div
            className="absolute bottom-3 right-3 px-3 py-[5px] rounded-full text-[10px] tracking-[0.1em]"
            style={{ backgroundColor: 'rgba(17,17,17,0.72)', color: 'rgba(255,255,255,0.9)' }}
          >
            {match.service}
          </div>
        </div>

        {/* Details */}
        <div className="px-6 pt-5 pb-6">
          <h2
            className="text-gray-900 mb-1 leading-tight"
            style={{ fontSize: 16, fontWeight: 300, letterSpacing: '-0.01em' }}
          >
            {match.name}
          </h2>
          <p className="text-[11px] tracking-[0.04em] mb-5" style={{ color: '#aaa' }}>
            {match.tagline}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-5 mb-6">
            <div className="flex items-center gap-1.5">
              <Star size={12} style={{ fill: GOLD, color: GOLD }} />
              <span className="text-[13px] font-medium text-gray-800">{match.rating.toFixed(1)}</span>
              <span className="text-[11px]" style={{ color: '#bbb' }}>({match.reviewCount})</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: '#999' }}>
              <MapPin size={11} />
              <span className="text-[11px]">{match.distance}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: '#999' }}>
              <Clock size={11} />
              <span className="text-[11px]">{match.etaMinutes} min</span>
            </div>
          </div>

          {/* Primary action */}
          <button
            style={{ touchAction: 'manipulation', backgroundColor: '#111', paddingTop: 14, paddingBottom: 14 }}
            className="w-full rounded-xl text-white text-[12px] font-medium tracking-[0.1em] uppercase transition-all active:scale-[0.98] mb-2.5"
          >
            Book Now
          </button>

          {/* Secondary action — only if phone available */}
          {match.phone && (
            <a
              href={`tel:${match.phone}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl text-[12px] tracking-[0.06em] transition-all active:scale-[0.98]"
              style={{
                touchAction: 'manipulation',
                border: '1px solid #ebebeb',
                color: '#555',
                paddingTop: 11,
                paddingBottom: 11,
              }}
            >
              <Phone size={13} />
              Call Provider
            </a>
          )}
        </div>
      </div>

      {/* Search again */}
      <button
        onClick={onSearchAgain}
        style={{ touchAction: 'manipulation' }}
        className="w-full text-center text-[11px] text-gray-300 mt-5 tracking-wide underline underline-offset-4 active:text-gray-600 transition-colors"
      >
        Search again
      </button>
    </>
  );
});
