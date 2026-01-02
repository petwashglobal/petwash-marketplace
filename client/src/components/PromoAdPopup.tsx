import { useState, useEffect } from 'react';
import { X, Star, Crown, Gift, Award, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/languageStore';

type PopupTemplate = 'fullscreen' | 'split-rewards' | 'split-app' | 'membership-tiers';

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

const DEFAULT_PROMO: PromoAdConfig = {
  id: 'petwash-promo-2026',
  template: 'fullscreen',
  title: '',
  ctaText: '',
  ctaUrl: '/loyalty',
  backgroundColor: 'from-amber-500 via-orange-500 to-amber-600',
  enabled: false,
};

interface PromoAdPopupProps {
  config?: PromoAdConfig;
  showOnce?: boolean;
  delayMs?: number;
}

export function PromoAdPopup({ 
  config = DEFAULT_PROMO, 
  showOnce = true,
  delayMs = 500 
}: PromoAdPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  useEffect(() => {
    if (!config.enabled) return;

    const storageKey = `promo-seen-${config.id}`;
    const hasSeenPromo = sessionStorage.getItem(storageKey);

    if (showOnce && hasSeenPromo) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [config.id, config.enabled, showOnce, delayMs]);

  const handleClose = () => {
    setIsVisible(false);
    if (showOnce) {
      sessionStorage.setItem(`promo-seen-${config.id}`, 'true');
    }
  };

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
      default:
        return <FullscreenTemplate config={config} title={title} subtitle={subtitle} ctaText={ctaText} onCta={handleCtaClick} />;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          data-testid="promo-ad-popup"
        >
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative w-full h-full md:w-[95%] md:max-w-4xl md:h-auto md:max-h-[90vh] md:rounded-3xl overflow-hidden shadow-2xl"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
              data-testid="button-close-promo"
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
          className="px-12 py-4 rounded-2xl bg-white text-gray-900 font-bold text-lg hover:bg-gray-100 transition-all shadow-xl hover:scale-105"
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
              <div className="h-3 bg-gray-200 rounded w-32" />
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
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold text-gray-800">278</span>
            </div>
          </div>
          
          <div className="p-4 space-y-3">
            {[25, 50, 150, 200].map((points) => (
              <div key={points} className="flex items-center gap-3">
                <span className="text-sm font-bold text-amber-600">{points}<Star className="w-3 h-3 inline ml-0.5" /></span>
                <div className="h-2 bg-gray-100 rounded flex-1" />
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
                <div key={i} className={`flex-1 p-2 rounded-lg text-center ${i === 2 ? 'bg-amber-400' : i === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
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

export default PromoAdPopup;
export type { PromoAdConfig, PopupTemplate };
