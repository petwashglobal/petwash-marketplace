import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/languageStore';

interface PromoAdConfig {
  id: string;
  imageUrl?: string;
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
  id: 'petwash-launch-2026',
  title: 'Welcome to Pet Wash™',
  titleHe: 'ברוכים הבאים ל-Pet Wash™',
  subtitle: 'Premium Pet Care Services',
  subtitleHe: 'שירותי טיפוח פרימיום לחיות מחמד',
  ctaText: 'Explore Now',
  ctaTextHe: 'גלה עכשיו',
  ctaUrl: '/sitter-suite',
  backgroundColor: 'from-amber-500 via-orange-500 to-amber-600',
  enabled: true,
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
            className={`relative w-full h-full md:w-[90%] md:max-w-lg md:h-auto md:max-h-[90vh] md:rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br ${config.backgroundColor}`}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all"
              data-testid="button-close-promo"
            >
              <X className="w-6 h-6" />
            </button>

            {config.imageUrl ? (
              <div className="w-full h-full flex flex-col">
                <img 
                  src={config.imageUrl} 
                  alt={title}
                  className="w-full flex-1 object-cover"
                />
                <div className="p-6 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 right-0">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{title}</h2>
                  {subtitle && <p className="text-white/90 text-lg mb-4">{subtitle}</p>}
                  <button
                    onClick={handleCtaClick}
                    className="w-full py-4 rounded-2xl bg-white text-gray-900 font-bold text-lg hover:bg-gray-100 transition-all shadow-xl"
                    data-testid="button-promo-cta"
                  >
                    {ctaText} &gt;&gt;
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[70vh] md:min-h-[500px] flex flex-col items-center justify-center p-8 text-center text-white">
                <div className="mb-8">
                  <img 
                    src="/brand/petwash-logo-official.png" 
                    alt="Pet Wash™" 
                    className="w-32 h-32 object-contain mx-auto drop-shadow-2xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-lg">{title}</h2>
                {subtitle && <p className="text-xl text-white/90 mb-8 drop-shadow">{subtitle}</p>}
                
                <button
                  onClick={handleCtaClick}
                  className="px-12 py-4 rounded-2xl bg-white text-gray-900 font-bold text-lg hover:bg-gray-100 transition-all shadow-xl hover:scale-105"
                  data-testid="button-promo-cta"
                >
                  {ctaText} &gt;&gt;
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PromoAdPopup;
export type { PromoAdConfig };
