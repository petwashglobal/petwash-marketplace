import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MapPin, Clock, Phone, ChevronLeft, Zap } from 'lucide-react';
import { Link } from 'wouter';
import { useMatchingEngine, ServiceType } from '@/hooks/useMatchingEngine';

const SERVICES: { key: ServiceType; label: string; labelHe: string; icon: string; desc: string }[] = [
  { key: 'grooming',  label: 'Grooming',    labelHe: 'טיפוח',    icon: '✂️', desc: 'Premium mobile grooming' },
  { key: 'walking',   label: 'Dog Walking', labelHe: 'הליכות',   icon: '🐕', desc: 'GPS-tracked walks' },
  { key: 'k9000',     label: 'K9000 Wash',  labelHe: 'רחצה',     icon: '🚿', desc: 'Smart wash stations' },
];

// Preload an image so no flash when match reveals
function preloadImage(src: string) {
  const img = new window.Image();
  img.src = src;
}

export default function ProviderMatchScreen() {
  const [service, setService] = useState<ServiceType>('grooming');
  const [mode] = useState<'demo' | 'live'>('demo');
  const { state, match, start, cancel } = useMatchingEngine(mode, service);

  // Preload match image before animation fires
  useEffect(() => {
    if (match?.image) preloadImage(match.image);
  }, [match?.image]);

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-safe-top pt-5 pb-4 border-b border-gray-100">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
        </Link>
        <div className="text-center">
          <p className="text-xs tracking-[0.15em] text-gray-400 uppercase">PetWash™</p>
          <p className="text-sm font-medium text-gray-800">Find a Provider</p>
        </div>
        <div className="w-12" />
      </header>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <AnimatePresence mode="wait">

          {/* ── IDLE: Service selection + CTA ─────────────────── */}
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-light text-gray-900 mb-2">
                  What do you need today?
                </h1>
                <p className="text-sm text-gray-400 tracking-wide">
                  We'll find the best match near you
                </p>
              </div>

              {/* Service pills */}
              <div className="space-y-3 mb-10">
                {SERVICES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setService(s.key)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all duration-200"
                    style={{
                      borderColor: service === s.key ? '#D4AF37' : '#f0f0f0',
                      backgroundColor: service === s.key ? 'rgba(212,175,55,0.04)' : 'white',
                    }}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{s.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                    </div>
                    {service === s.key && (
                      <motion.div
                        layoutId="service-check"
                        className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#D4AF37' }}
                      >
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>

              {/* Find button */}
              <button
                onClick={start}
                className="w-full py-4 rounded-2xl text-white font-medium tracking-wide transition-all duration-200 active:scale-95"
                style={{ backgroundColor: '#1a1a1a' }}
              >
                Find My {SERVICES.find(s => s.key === service)?.label}
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                Usually matches within seconds
              </p>
            </motion.div>
          )}

          {/* ── SEARCHING: Radar + pulsing ring ───────────────── */}
          {state === 'searching' && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6"
            >
              <RadarAnimation />

              <div className="text-center">
                <motion.p
                  className="text-base font-light text-gray-800 tracking-wide"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  Finding the perfect match
                </motion.p>
                <p className="text-xs text-gray-400 mt-1.5 tracking-wider uppercase">
                  {SERVICES.find(s => s.key === service)?.label}
                </p>
              </div>

              <motion.div
                className="flex gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#D4AF37' }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                  />
                ))}
              </motion.div>

              <button
                onClick={cancel}
                className="text-xs text-gray-400 underline-offset-2 underline mt-4"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {/* ── MATCHED: Provider card reveal ─────────────────── */}
          {state === 'matched' && match && (
            <motion.div
              key="matched"
              initial={{ opacity: 0, y: 60, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm"
            >
              {/* Match badge */}
              <motion.div
                className="flex justify-center mb-6"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.3, ease: 'backOut' }}
              >
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium tracking-widest uppercase"
                  style={{ backgroundColor: 'rgba(212,175,55,0.1)', color: '#B8961E' }}
                >
                  <Zap size={11} fill="#B8961E" />
                  Match Found
                </div>
              </motion.div>

              {/* Provider card */}
              <div
                className="bg-white rounded-3xl overflow-hidden"
                style={{ boxShadow: '0 4px 40px rgba(0,0,0,0.10)' }}
              >
                {/* Image area */}
                <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={match.image}
                    alt={match.name}
                    className="w-32 h-32 object-contain"
                  />
                  {/* Gold line top */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }}
                  />
                  {/* Service badge */}
                  <div
                    className="absolute bottom-3 right-3 px-3 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                  >
                    {match.service}
                  </div>
                </div>

                {/* Info */}
                <div className="px-6 pt-5 pb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-1">{match.name}</h2>
                  <p className="text-xs text-gray-400 mb-4">{match.tagline}</p>

                  <div className="flex items-center gap-5 mb-6">
                    <div className="flex items-center gap-1.5">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span className="text-sm font-medium text-gray-800">{match.rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({match.reviewCount})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <MapPin size={12} />
                      <span className="text-xs">{match.distance}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock size={12} />
                      <span className="text-xs">{match.etaMinutes} min</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <button
                    className="w-full py-3.5 rounded-xl text-white text-sm font-medium tracking-wide transition-all active:scale-95 mb-3"
                    style={{ backgroundColor: '#1a1a1a' }}
                  >
                    Book Now
                  </button>

                  {match.phone && (
                    <a
                      href={`tel:${match.phone}`}
                      className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-700 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Phone size={14} />
                      Call Provider
                    </a>
                  )}
                </div>
              </div>

              {/* Search again */}
              <button
                onClick={() => { cancel(); }}
                className="w-full text-center text-xs text-gray-400 mt-5 underline underline-offset-2"
              >
                Search again
              </button>
            </motion.div>
          )}

          {/* ── NO MATCH ──────────────────────────────────────── */}
          {state === 'no_match' && (
            <motion.div
              key="no_match"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center max-w-xs"
            >
              <p className="text-4xl mb-5">🐾</p>
              <h2 className="text-lg font-light text-gray-800 mb-2">No providers nearby</h2>
              <p className="text-sm text-gray-400 mb-8">
                All providers in your area are busy right now. Try again in a few minutes.
              </p>
              <button
                onClick={cancel}
                className="px-8 py-3 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: '#1a1a1a' }}
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

// ── Radar animation component ────────────────────────────────────────────────
function RadarAnimation() {
  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      {/* Pulsing rings — pure CSS via Framer Motion */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: 'rgba(212,175,55,0.4)' }}
          animate={{ scale: [1, 1.6 + i * 0.3], opacity: [0.6, 0] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Center dot */}
      <motion.div
        className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
        style={{ backgroundColor: '#1a1a1a' }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-2xl">🐾</span>
      </motion.div>

      {/* Gold sweep line */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent 70%, rgba(212,175,55,0.35) 100%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}
