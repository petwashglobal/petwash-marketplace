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
      {/* Announcement line — restrained luxury (replaced the violet 🎉 soft-launch
          banner, CEO 2026-06-11: shell looked dated). Shop is open to browse;
          purchases unlock at commerce launch. Dismissible; hidden on /egift. */}
      {!paymentsEnabled && !bannerDismissed && !isEgiftRoute && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-full bg-black text-white z-50 relative border-b border-amber-300/40"
        >
          <div className="flex items-center justify-center gap-3 py-2 px-4 text-xs sm:text-sm tracking-wide">
            <span className="text-amber-200">✦</span>
            <span>
              {isRTL
                ? 'החנות פתוחה לעיון — הרכישה אונליין תיפתח בקרוב'
                : 'The Shop is open to browse — online purchases opening soon'}
            </span>
            <Link
              href="/shop"
              className="underline underline-offset-4 decoration-amber-300/60 hover:decoration-amber-300 text-amber-100 shrink-0"
            >
              {isRTL ? 'לחנות' : 'Visit the Shop'}
            </Link>
            <button
              onClick={dismissBanner}
              aria-label="Close"
              className="ms-1 p-0.5 rounded hover:bg-white/15 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
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
