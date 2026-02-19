import { useEffect } from 'react';
import { PetWashHeader } from './PetWashHeader';
import { Footer } from './Footer';
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

  useEffect(() => {
    if (!language) return;
    
    document.documentElement.lang = language;
    
    const isRTL = language === 'he' || language === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    
    document.documentElement.setAttribute('data-language', language);
    document.documentElement.setAttribute('data-rtl', isRTL ? 'true' : 'false');
    
    localStorage.setItem('language', language);
  }, [language]);


  return (
    <div className="min-h-screen bg-white">
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
      
      <Footer language={language} />
    </div>
  );
}
