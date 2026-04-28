import { useState, useEffect, useCallback } from 'react';
import { X, Star, Crown, Gift, Award, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/lib/languageStore';

type PopupTemplate = 'fullscreen' | 'split-rewards' | 'split-app' | 'membership-tiers' | 'poster' | 'smart-hub';

interface PromoAdConfig {
  id: string;
  template: PopupTemplate;
  imageUrl?: string;
  logoUrl?: string;
  title: string;
  titleHe?: string;
  subtitle?: string;
  subtitleHe?: string;
  ctaText: string;
  ctaTextHe?: string;
  ctaUrl: string;
  backgroundColor?: string;
  enabled: boolean;
}

// ── Safety guard ──────────────────────────────────────────────────────────────
// Block any image whose URL contains developer/backend keywords from being
// shown in a public-facing popup.
const BLOCKED_PUBLIC_IMAGE_WORDS = [
  'github', 'replit', 'backend', 'admin', 'screenshot',
  'merge', 'pull-request', 'repository', 'attached_assets',
];

function isPublicSafePromoImage(src: string): boolean {
  const lower = src.toLowerCase();
  return !BLOCKED_PUBLIC_IMAGE_WORDS.some((word) => lower.includes(word));
}
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROMO: PromoAdConfig = {
  id: 'petwash-platform-2026',
  template: 'smart-hub',
  // imageUrl intentionally omitted — the smart-hub template renders its own
  // coded visual so the popup is never dependent on a single image file.
  title: 'PetWash™',
  titleHe: 'PetWash™',
  subtitle: 'ONE WORLD. EVERY PET.',
  subtitleHe: 'עולם אחד. כל חיית מחמד.',
  ctaText: 'Explore Platforms',
  ctaTextHe: 'גלה את הפלטפורמות',
  ctaUrl: '/divisions',
  enabled: true,
};

interface PromoAdPopupProps {
  config?: PromoAdConfig;
  showOnce?: boolean;
  delayMs?: number;
}

// How long until auto-dismiss (ms)
const AUTO_DISMISS_MS = 3000;
// localStorage key stores the timestamp of last display; skip if < 24 h ago
const SUPPRESS_DURATION_MS = 24 * 60 * 60 * 1000;

/** Returns the sessionStorage key for a given popup id. */
function sessionKey(id: string) {
  return `promo-session-seen-${id}`;
}

export function PromoAdPopup({ 
  config = DEFAULT_PROMO, 
  showOnce = true,
  delayMs = 500 
}: PromoAdPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const prefersReducedMotion = useReducedMotion();

  // Decide whether to show based on session suppression + 24 h localStorage suppression
  useEffect(() => {
    if (!config.enabled) return;

    // Never show twice in the same tab session
    if (sessionStorage.getItem(sessionKey(config.id))) return;

    const storageKey = `promo-last-seen-${config.id}`;
    if (showOnce) {
      const lastSeen = localStorage.getItem(storageKey);
      if (lastSeen && Date.now() - parseInt(lastSeen, 10) < SUPPRESS_DURATION_MS) return;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [config.id, config.enabled, showOnce, delayMs]);

  const handleClose = useCallback((source: 'user' | 'auto' = 'user') => {
    setIsVisible(false);
    // Always suppress for the rest of this tab session (prevents re-show on re-render)
    sessionStorage.setItem(sessionKey(config.id), '1');
    // Only stamp the 24 h localStorage suppression when the USER actively closes the popup.
    // Auto-dismiss does NOT stamp it — so the popup can still appear in the next tab/session.
    if (showOnce && source === 'user') {
      localStorage.setItem(`promo-last-seen-${config.id}`, String(Date.now()));
    }
  }, [config.id, showOnce]);

  // Escape key, auto-dismiss, scroll lock — all active while popup is visible
  useEffect(() => {
    if (!isVisible) return;

    // Prevent page scroll while popup is open
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Auto-dismiss — passes 'auto' so the 24 h localStorage stamp is NOT set
    const autoDismiss = setTimeout(() => handleClose('auto'), AUTO_DISMISS_MS);

    // Keyboard escape — counts as user dismissal
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose('user');
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      clearTimeout(autoDismiss);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isVisible, handleClose]);

  const handleCtaClick = () => {
    handleClose();
    window.location.href = config.ctaUrl;
  };

  const title = isHebrew && config.titleHe ? config.titleHe : config.title;
  const subtitle = isHebrew && config.subtitleHe ? config.subtitleHe : config.subtitle;
  const ctaText = isHebrew && config.ctaTextHe ? config.ctaTextHe : config.ctaText;

  const renderTemplate = () => {
    switch (config.template) {
      case 'split-rewards':
        return <SplitRewardsTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
      case 'split-app':
        return <SplitAppTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
      case 'membership-tiers':
        return <MembershipTiersTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
      case 'poster':
        return <PosterTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
      case 'smart-hub':
        return <SmartHubTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
      default:
        return <FullscreenTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
    }
  };

  // Framer motion variants — softer when reduced motion is preferred
  const backdropVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const cardVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.95, opacity: 0 } };
  const transitionDuration = prefersReducedMotion ? 0.15 : 0.3;
  const cardTransitionDelay = prefersReducedMotion ? 0 : 0.08;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          {...backdropVariants}
          transition={{ duration: transitionDuration }}
          // Use inset-0 + fixed for true full-screen on all browsers/devices.
          // 100dvh is set inline to properly handle Safari dynamic toolbar.
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
          data-testid="promo-ad-popup"
          aria-modal="true"
          role="dialog"
          aria-label="PetWash welcome"
        >
          {/* Backdrop — tap to close */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          {/* Card — full-screen on mobile, floating card on md+ */}
          <motion.div
            {...cardVariants}
            transition={{ duration: transitionDuration, delay: cardTransitionDelay }}
            // On mobile: fill the entire visual viewport.
            // On md+: float as a rounded card.
            // overflow-y-auto ensures content is reachable in landscape without clipping.
            className="relative w-full h-full md:w-[95%] md:max-w-4xl md:rounded-3xl overflow-y-auto overflow-x-hidden shadow-2xl"
            style={{ maxHeight: '100dvh' }}
          >
            {/* Close button — safe-area aware so it's always tappable */}
            <button
              onClick={handleClose}
              className="absolute z-20 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
              style={{
                top: 'max(1rem, env(safe-area-inset-top, 1rem))',
                right: 'max(1rem, env(safe-area-inset-right, 1rem))',
              }}
              data-testid="button-close-promo"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            {renderTemplate()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface TemplateProps {
  config: PromoAdConfig;
  title: string;
  subtitle?: string;
  ctaText: string;
  onCta: () => void;
}

function FullscreenTemplate({ config, title, subtitle, ctaText, onCta }: TemplateProps) {
  return (
    <div className={`w-full h-full min-h-[70vh] md:min-h-[500px] flex flex-col items-center justify-center p-8 text-center text-white bg-gradient-to-br ${config.backgroundColor || 'from-amber-500 to-orange-600'}`}>
      {config.logoUrl && (
        <img src={config.logoUrl} alt="" className="w-32 h-32 object-contain mx-auto mb-8 drop-shadow-2xl" />
      )}
      {title && <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">{title}</h2>}
      {subtitle && <p className="text-xl text-white/90 mb-8 drop-shadow">{subtitle}</p>}
      {ctaText && (
        <button
          onClick={onCta}
          className="px-12 py-4 rounded-2xl bg-white text-gray-900 font-bold text-lg hover:bg-white transition-all shadow-xl hover:scale-105"
          data-testid="button-promo-cta"
        >
          {ctaText}
        </button>
      )}
    </div>
  );
}

function SplitRewardsTemplate({ config, title, subtitle, ctaText, onCta }: TemplateProps) {
  return (
    <div className="w-full h-full md:h-auto flex flex-col md:flex-row bg-[#c4b5a0]">
      <div className="w-full md:w-1/2 h-64 md:h-auto relative">
        {config.imageUrl ? (
          <img src={config.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-400 to-stone-500 flex items-center justify-center">
            <Crown className="w-24 h-24 text-white/40" />
          </div>
        )}
        {config.logoUrl && (
          <div className="absolute bottom-8 left-8">
            <img src={config.logoUrl} alt="" className="h-16 object-contain" />
          </div>
        )}
      </div>
      
      <div className="w-full md:w-1/2 bg-white p-6 md:p-8 flex flex-col justify-center">
        {title && <h2 className="text-2xl font-bold text-gray-800 mb-6 uppercase tracking-wider">{title}</h2>}
        
        <div className="space-y-3 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="h-3 bg-white rounded w-32" />
              <div className="flex gap-8">
                <span className="w-3 h-3 rounded-full bg-gray-800" />
                <span className="w-3 h-3 rounded-full bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
        
        {ctaText && (
          <button
            onClick={onCta}
            className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all"
            data-testid="button-promo-cta"
          >
            {ctaText}
          </button>
        )}
      </div>
    </div>
  );
}

function SplitAppTemplate({ config, title, subtitle, ctaText, onCta }: TemplateProps) {
  return (
    <div className="w-full h-full md:h-auto flex flex-col md:flex-row bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-800">
      <div className="w-full md:w-1/2 p-8 flex flex-col justify-center items-center text-white">
        {config.logoUrl ? (
          <img src={config.logoUrl} alt="" className="w-24 h-24 object-contain mb-6 rounded-2xl shadow-xl" />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-6 shadow-xl">
            <Star className="w-12 h-12 text-white" />
          </div>
        )}
        {title && <h2 className="text-3xl font-bold mb-2 text-center">{title}</h2>}
        {subtitle && <p className="text-white/80 text-center">{subtitle}</p>}
      </div>
      
      <div className="w-full md:w-1/2 p-8 flex items-center justify-center">
        <div className="w-64 bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b">
            <div className="h-4 bg-white rounded w-24 mb-2" />
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold text-gray-800">278</span>
            </div>
          </div>
          
          <div className="p-4 space-y-3">
            {[25, 50, 150, 200].map((points) => (
              <div key={points} className="flex items-center gap-3">
                <span className="text-sm font-bold text-amber-600">{points}<Star className="w-3 h-3 inline ml-0.5" /></span>
                <div className="h-2 bg-white rounded flex-1" />
              </div>
            ))}
          </div>
          
          {ctaText && (
            <div className="p-4 border-t">
              <button
                onClick={onCta}
                className="w-full py-2 bg-emerald-600 text-white font-semibold rounded-full text-sm hover:bg-emerald-700 transition-all"
                data-testid="button-promo-cta"
              >
                {ctaText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MembershipTiersTemplate({ config, title, subtitle, ctaText, onCta }: TemplateProps) {
  return (
    <div className="w-full h-full md:h-auto flex flex-col md:flex-row bg-black">
      <div className="w-full md:w-1/2 h-64 md:h-auto relative">
        {config.imageUrl ? (
          <img src={config.imageUrl} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-900 to-black flex items-center justify-center">
            <Award className="w-24 h-24 text-white/30" />
          </div>
        )}
        {config.logoUrl ? (
          <div className="absolute bottom-8 left-8">
            <img src={config.logoUrl} alt="" className="h-12 object-contain" />
          </div>
        ) : (
          <div className="absolute bottom-8 left-8 text-white text-4xl font-black tracking-tight">
            <Sparkles className="w-8 h-8 inline mr-2" />
          </div>
        )}
      </div>
      
      <div className="w-full md:w-1/2 p-8 flex items-center justify-center bg-black">
        <div className="w-72 bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b text-center">
            {title && <p className="text-xs text-gray-500 uppercase tracking-wider">{title}</p>}
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-lg font-light text-gray-800">Level</span>
              <span className="text-3xl font-bold text-gray-800">4</span>
              <div className="flex items-center gap-1 ml-2">
                <Gift className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">38,192</span>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Trade points for voucher</p>
            <div className="flex gap-2">
              {[20, 25, 30].map((discount, i) => (
                <div key={i} className={`flex-1 p-2 rounded-lg text-center ${i === 2 ? 'bg-amber-400' : i === 1 ? 'bg-blue-500 text-white' : 'bg-white'}`}>
                  <p className="text-xs font-bold">{discount}% OFF</p>
                  <p className="text-[10px] mt-1 opacity-70">{(i + 1) * 2500}</p>
                </div>
              ))}
            </div>
          </div>
          
          {ctaText && (
            <div className="p-4 border-t">
              <button
                onClick={onCta}
                className="w-full py-3 bg-black text-white font-semibold rounded-lg text-sm hover:bg-gray-900 transition-all"
                data-testid="button-promo-cta"
              >
                {ctaText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PosterTemplate — full-bleed approved brand ad image.
 * Shows the image filling the entire popup area with an optional CTA button
 * pinned to the bottom. If the image fails to load or is not public-safe,
 * falls back to a minimal branded card so nothing is blank.
 */
function PosterTemplate({ config, ctaText, onCta }: TemplateProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Safety guard: block any image that looks like a backend/dev screenshot
  const imageIsSafe = !!(config.imageUrl && isPublicSafePromoImage(config.imageUrl));
  const showImage = config.imageUrl && imageIsSafe && !imgFailed;

  if (!imageIsSafe && config.imageUrl) {
    console.warn('[PromoAdPopup] Blocked unsafe image URL from public popup:', config.imageUrl);
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-white">
      {/* Full-bleed poster image */}
      {showImage ? (
        <img
          src={config.imageUrl}
          alt="Pet Wash™"
          className="w-full flex-1 object-contain"
          style={{ minHeight: 0 }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        /* Fallback: branded gradient card */
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-indigo-700 to-sky-600 p-8 text-white text-center">
          <img
            src="/brand/petwash-logo-white-bg.png"
            alt="Pet Wash™"
            className="h-16 object-contain mb-6"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <h2 className="text-2xl font-bold mb-2">ONE WORLD. EVERY PET.</h2>
          <p className="text-lg opacity-80 mb-2">⁦Pet Wash™⁩</p>
          <p className="text-sm opacity-60">www.PetWash.co.il</p>
        </div>
      )}

      {/* CTA pinned to bottom, safe-area aware */}
      {ctaText && (
        <div
          className="px-6 py-4 bg-white"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
        >
          <button
            onClick={onCta}
            className="w-full py-4 bg-black text-white font-semibold text-base rounded-2xl tracking-wide hover:bg-gray-900 active:scale-[0.98] transition-all"
            data-testid="button-promo-cta"
          >
            {ctaText}
          </button>
          <button
            onClick={onCta}
            className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Continue to Site →
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * SmartHubTemplate — the official PetWash 2026 entry popup.
 * Renders a fully coded Smart Hub visual:
 *   "ONE WORLD. EVERY PET."  /  PetWash™
 *   Central hub with 5 platform badges
 *   CTA: Explore Platforms + Continue to Site
 *
 * This template never uses an image file so it cannot accidentally show
 * a backend/developer screenshot. It is the authoritative public popup.
 */
function SmartHubTemplate({ config, title, subtitle, ctaText, onCta }: TemplateProps) {
  return (
    <div className="relative w-full h-full flex flex-col bg-white overflow-y-auto">
      {/* ── Header ── */}
      <div className="flex-shrink-0 pt-10 pb-4 px-6 text-center">
        <p className="text-xs font-bold tracking-[0.25em] text-gray-400 uppercase mb-1">www.PetWash.co.il</p>
        <h1 className="text-2xl md:text-3xl font-black tracking-wide text-gray-900 leading-tight">
          {subtitle || 'ONE WORLD. EVERY PET.'}
        </h1>
        <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-none mt-1">
          {title || 'PetWash™'}
        </h2>
      </div>

      {/* ── Hub diagram ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <div className="relative w-full max-w-xs mx-auto" style={{ aspectRatio: '1 / 1.1' }}>
          {/* Central hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-yellow-300"
              style={{ background: 'radial-gradient(circle at 35% 35%, #5adc3c, #2e8a10)' }}>
              <img
                src="/brand/petwash-logo-white-bg.png"
                alt="PetWash™"
                className="w-16 h-10 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span className="text-white text-[10px] font-bold tracking-wider mt-1">SMART HUB</span>
            </div>
          </div>

          {/* Top-left: PetSitter */}
          <PlatformBadge
            label="PetSitter for All Pets"
            emoji="🐾"
            colorClass="from-pink-500 to-rose-600"
            style={{ top: '2%', left: '0%' }}
          />
          {/* Top-right: Walk My Pet */}
          <PlatformBadge
            label="Walk My Pet"
            emoji="🐕"
            colorClass="from-sky-400 to-blue-600"
            style={{ top: '2%', right: '0%' }}
          />
          {/* Bottom-left: Pet Wash Academy */}
          <PlatformBadge
            label="Pet Wash Academy"
            emoji="🎓"
            colorClass="from-violet-500 to-purple-700"
            style={{ bottom: '18%', left: '0%' }}
          />
          {/* Bottom-right: Pet Finder */}
          <PlatformBadge
            label="Pet Finder – Free"
            emoji="📍"
            colorClass="from-amber-400 to-yellow-500"
            style={{ bottom: '18%', right: '0%' }}
          />
          {/* Bottom-center: PetTrek */}
          <PlatformBadge
            label="PetTrek"
            emoji="🚗"
            colorClass="from-slate-500 to-slate-700"
            style={{ bottom: '0%', left: '50%', transform: 'translateX(-50%)' }}
          />
        </div>
      </div>

      {/* ── CTA ── */}
      <div
        className="flex-shrink-0 px-6 pb-6 pt-2 bg-white"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
      >
        <button
          onClick={onCta}
          className="w-full py-4 bg-black text-white font-bold text-base rounded-2xl tracking-wide hover:bg-gray-900 active:scale-[0.98] transition-all shadow-lg"
          data-testid="button-promo-cta"
        >
          {ctaText || 'Explore Platforms'}
        </button>
        <button
          onClick={onCta}
          className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          Continue to Site →
        </button>
      </div>
    </div>
  );
}

interface PlatformBadgeProps {
  label: string;
  emoji: string;
  colorClass: string;
  style?: React.CSSProperties;
}

function PlatformBadge({ label, emoji, colorClass, style }: PlatformBadgeProps) {
  return (
    <div
      className={`absolute w-[38%] aspect-square rounded-2xl bg-gradient-to-br ${colorClass} flex flex-col items-center justify-center shadow-xl border-2 border-white/40 p-1 text-white text-center`}
      style={style}
    >
      <span className="text-2xl mb-0.5">{emoji}</span>
      <span className="text-[10px] font-bold leading-tight px-1">{label}</span>
    </div>
  );
}

export default PromoAdPopup;
export type { PromoAdConfig, PopupTemplate };
