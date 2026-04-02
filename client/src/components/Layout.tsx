import { useEffect, useState } from 'react';
import { PetWashHeader } from './PetWashHeader';
import { Footer } from './Footer';
import { NetworkOfflineBanner } from './NetworkOfflineBanner';
import { type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';
import { usePaymentStatus } from '@/hooks/use-payment-status';
import { X, Rocket } from 'lucide-react';

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
    
    localStorage.setItem('language', language);
  }, [language]);


  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Pre-launch soft-launch banner — shown until payments are live, dismissible */}
      {!paymentsEnabled && !bannerDismissed && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white text-center py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium z-50 relative"
        >
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
