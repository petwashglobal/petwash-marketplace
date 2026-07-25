import { useEffect } from 'react';
import { PetWashHeader } from './PetWashHeader';
import { Footer } from './Footer';
import { NetworkOfflineBanner } from './NetworkOfflineBanner';
import { type Language } from '@/lib/i18n';
import { useLanguage } from '@/lib/languageStore';

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

  // LIVE LAUNCH (CEO 2026-07-25): the site-wide beta / testing strip was removed.
  // PetWash is a real, open business — the physical stations are open to the
  // public and the phone line is live — so the website must read as a live
  // business. A global "we're still building" label was the single loudest
  // "we're not real yet" signal to a walk-up customer, and it contradicted the
  // reality on the ground. Any genuinely half-ready flow must be gated or hidden
  // at ITS OWN surface — never by labelling the entire site as unfinished.

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
      {/* No site-wide announcement strip: PetWash is live (CEO 2026-07-25). The
          old beta / testing banner was removed — see the note in this component
          above. Feature-specific readiness is handled at each feature's own
          surface, not with a global label. */}

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
