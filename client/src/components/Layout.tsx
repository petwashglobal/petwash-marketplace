import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { PetWashHeader } from './PetWashHeader';
import { Footer } from './Footer';
import { NetworkOfflineBanner } from './NetworkOfflineBanner';
import { type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';
import { usePaymentStatus } from '@/hooks/use-payment-status';
import { X, Rocket, Briefcase, Star } from 'lucide-react';
import { Link } from 'wouter';
import { becomeProviderHref, setProviderSignupIntent } from '@/lib/becomeProvider';

interface LayoutProps {
  children: React.ReactNode;
  language?: Language;
  onLanguageChange?: (language: Language) => void;
}

export function Layout({ children, language: propLanguage, onLanguageChange: propOnLanguageChange }: LayoutProps) {
  const { language: contextLanguage, setLanguage: contextSetLanguage } = useLanguage();

  const language = propLanguage ?? contextLanguage;
  const onLanguageChange = propOnLanguageChange ?? contextSetLanguage;
  const isRTL = language === 'he' || language === 'ar';

  // Phase B2 direction correction (Decision D, Option A) — the violet/purple/
  // indigo pre-launch banner clashes with the luxury hero on /egift. Hide it
  // on that route only. All other pages continue to show the banner.
  const [location] = useLocation();
  const isEgiftRoute = location.startsWith('/egift');

  const { paymentsEnabled } = usePaymentStatus();
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem('petwash_prelaunch_banner_dismissed') === 'true'
  );

  const dismissBanner = () => {
    localStorage.setItem('petwash_prelaunch_banner_dismissed', 'true');
    setBannerDismissed(true);
  };

  useEffect(() => {
    if (!language) return;
    
    document.documentElement.lang = language;
    
    const rtl = language === 'he' || language === 'ar';
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    
    document.documentElement.setAttribute('data-language', language);
    document.documentElement.setAttribute('data-rtl', rtl ? 'true' : 'false');
    
    localStorage.setItem('pw_lang', language);
  }, [language]);


  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Pre-launch soft-launch banner — shown until payments are live, dismissible.
          Phase B2: suppressed on /egift to keep the luxury hero composition clean. */}
      {!paymentsEnabled && !bannerDismissed && !isEgiftRoute && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white z-50 relative"
        >
          {/* Top row — announcement */}
          <div className="flex items-center justify-center gap-3 py-2 px-4 text-sm font-medium">
            <Rocket className="w-4 h-4 shrink-0" />
            <span>
              {isRTL
                ? '🎉 PetWash™ בגרסת בטא — הצטרפות למועדון, ספקים ו-Paw Finder פעילים. תשלומים מקוונים יופעלו בקרוב!'
                : '🎉 PetWash™ soft launch — memberships, providers & Paw Finder are live. Online payments coming soon!'}
            </span>
            <button
              onClick={dismissBanner}
              aria-label="Close"
              className="ms-2 p-0.5 rounded hover:bg-white/20 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Bottom row — join CTAs */}
          <div className="flex items-center justify-center gap-2 pb-2 px-4 flex-wrap">
            <Link
              href={becomeProviderHref()}
              onClick={setProviderSignupIntent}
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1 text-xs font-semibold text-white"
            >
              <Briefcase className="w-3.5 h-3.5" />
              {isRTL ? 'הצטרף כספק 👷' : 'Join as Provider 👷'}
            </Link>
            <Link
              href="/loyalty/join"
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1 text-xs font-semibold text-white"
            >
              <Star className="w-3.5 h-3.5" />
              {isRTL ? 'הצטרף למועדון הפסטיג׳ 🐾' : 'Join Prestige Club 🐾'}
            </Link>
          </div>
        </div>
      )}

      {/* Offline / connectivity banner — always visible when network drops */}
      <NetworkOfflineBanner />

      {/* Skip to Content for Accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white border text-black px-4 py-2 rounded z-50"
      >
        Skip to content
      </a>
      
      <PetWashHeader language={language} onLanguageChange={onLanguageChange} />
      
      <main id="main-content" role="main" className="bg-white">
        {children}
      </main>
      
      <div className="pb-16 md:pb-0">
        <Footer language={language} />
      </div>
    </div>
  );
}
