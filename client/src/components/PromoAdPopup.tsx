import { useState, useEffect, useCallback } from 'react';
import { X, Star, Crown, Gift, Award, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/lib/languageStore';

type PopupTemplate = 'fullscreen' | 'split-rewards' | 'split-app' | 'membership-tiers' | 'poster';

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
  id: 'petwash-platform-2026-image',
  template: 'poster',
  // Real Smart Hub hero image. PetTrek "Coming Soon" tag MUST be baked
  // into this image (the popup itself does not overlay any text on top).
  // File lives at: client/public/brand/petwash-smart-hub-2026.PNG
  // (uppercase .PNG matches the asset committed to main; case matters
  // on Linux/Cloud Run — do NOT change to .png unless the file is
  // also renamed.)
  // If the file is missing, PosterTemplate falls back to a clean branded
  // card so the popup never breaks.
  imageUrl: '/brand/petwash-smart-hub-2026.PNG',
  title: 'PetWash™',
  titleHe: 'PetWash™',
  subtitle: 'ONE WORLD. EVERY PET.',
  subtitleHe: 'עולם אחד. כל חיית מחמד.',
  ctaText: 'Explore Platforms',
  ctaTextHe: 'גלה את הפלטפורמות',
  ctaUrl: '/',
  enabled: true,
};

interface PromoAdPopupProps {
  config?: PromoAdConfig;
  showOnce?: boolean;
  delayMs?: number;
}

// How long until auto-dismiss (ms). Was 3 s — too short, customer barely
// saw the popup before it closed. Now 12 s with pause-on-hover so a user
// who is reading the popup never gets it yanked away.
const AUTO_DISMISS_MS = 12000;
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
  // Pause-on-hover — when the cursor or finger is over the popup card,
  // the auto-dismiss timer is suspended. Restarts when the pointer leaves.
  const [isHovered, setIsHovered] = useState(false);
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

  // Escape key, auto-dismiss (pause-on-hover), scroll lock — all active
  // while popup is visible. The auto-dismiss timer is REPLACED whenever
  // hover state changes, so hovering pauses and unhovering restarts.
  useEffect(() => {
    if (!isVisible) return;

    // Prevent page scroll while popup is open
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Auto-dismiss — passes 'auto' so the 24 h localStorage stamp is NOT set.
    // Skipped while user is hovering / touching the card (pause-on-hover).
    const autoDismiss = isHovered
      ? null
      : setTimeout(() => handleClose('auto'), AUTO_DISMISS_MS);

    // Keyboard escape — counts as user dismissal
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose('user');
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      if (autoDismiss) clearTimeout(autoDismiss);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isVisible, isHovered, handleClose]);

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
        return <PosterTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} onClose={handleClose} />;
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
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const transitionDuration = prefersReducedMotion ? 0.15 : 0.25;
  const cardTransitionDelay = 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          {...backdropVariants}
          transition={{ duration: transitionDuration }}
          // Issue #153 PR-WHITE-1 — Pure-white luxury popup shell.
          // Previously `bg-black` framed the brand artwork in a black
          // letterbox; on iPhone Safari that read as dirty grey instead
          // of luxury white. The four bg-black surfaces below (backdrop,
          // click-catcher, card, image panel) are now bg-white. Combined
          // with object-contain on the image, the artwork sits on
          // pure #FFFFFF on every device. 100dvh handles Safari toolbar.
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
          style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
          data-testid="promo-ad-popup"
          aria-modal="true"
          role="dialog"
          aria-label="PetWash welcome"
        >
          {/* Invisible click-catcher only. Pure white so any letterbox/
              pillarbox space around the artwork is luxury-clean and
              never reveals a grey or off-white frame. */}
          <div
            className="absolute inset-0 bg-white"
            onClick={() => handleClose('user')}
          />

          {/* Full-screen content layer. Poster template fills the viewport.
              Background is pure white so object-contain letterbox bars are
              brand-white instead of black. */}
          <motion.div
            {...cardVariants}
            transition={{ duration: transitionDuration, delay: cardTransitionDelay }}
            className="relative w-full h-full overflow-hidden bg-white"
            style={{ maxHeight: '100dvh' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setIsHovered(false)}
          >
            {/* Single floating close button. Dark-on-white glass treatment
                so the X is high-contrast against the new pure-white shell
                without painting a heavy dark blob on luxury artwork. */}
            <button
              onClick={() => handleClose('user')}
              className="absolute z-20 w-11 h-11 rounded-full flex items-center justify-center text-black bg-white/90 hover:bg-white backdrop-blur-md border border-black/10 shadow-sm transition-colors"
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

interface PosterTemplateProps extends TemplateProps {
  /** Close handler — kept on the prop type for backwards compat with the
   *  call site, even though this template no longer renders a secondary
   *  close button (the shell already provides the floating X). */
  onClose?: () => void;
}

/**
 * PosterTemplate — exact uploaded creative as full-screen artwork on a
 * pure-white luxury shell.
 *
 * Per CEO directive (Issue #153 PR-WHITE-1):
 *   - No outer padding, no card frame, no extra CTA, no bottom strip.
 *   - Background is pure #FFFFFF (the shell already paints white).
 *   - object-contain so the artwork is shown in full and any letterbox
 *     space reads as luxury white — never black or grey.
 *
 * Previous trade-off (object-cover + black shell) caused two problems on
 * iPhone Safari: (a) the cover crop ate into the artwork's own white
 * margin, exposing colored or textured pixels at the edges; (b) the
 * black shell read as a dirty grey frame around the artwork. Switching
 * to object-contain on a white shell solves both: the brand image is
 * presented exactly as designed, with pure-white pillarbox/letterbox.
 *
 * If the source artwork itself is not pure white at the edges, that is
 * an asset-side concern — the container is still pure-white, so any
 * tinted edge sits cleanly on a brand-white field instead of a black
 * frame. Pixel-level audit of the asset is intentionally separate.
 */
function PosterTemplate({ config, onClose: _onClose }: PosterTemplateProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Safety guard: block any image that looks like a backend/dev screenshot
  const imageIsSafe = !!(config.imageUrl && isPublicSafePromoImage(config.imageUrl));
  const showImage = config.imageUrl && imageIsSafe && !imgFailed;

  if (!imageIsSafe && config.imageUrl) {
    console.warn('[PromoAdPopup] Blocked unsafe image URL from public popup:', config.imageUrl);
  }

  if (showImage) {
    return (
      <div className="absolute inset-0 bg-white">
        <img
          src={config.imageUrl}
          alt="Pet Wash™ Smart Hub"
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  // Fallback: branded gradient card so the popup is never blank.
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-indigo-700 to-sky-600 p-8 text-white text-center">
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
  );
}

export default PromoAdPopup;
export type { PromoAdConfig, PopupTemplate };
