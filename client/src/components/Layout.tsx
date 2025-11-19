import { useState, useEffect } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { type Language } from '@/lib/i18n';

interface LayoutProps {
  children: React.ReactNode;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export function Layout({ children, language, onLanguageChange }: LayoutProps) {
  useEffect(() => {
    // Update document attributes when language changes
    document.documentElement.lang = language;
    
    // CRITICAL: Set proper text direction for RTL languages (Hebrew, Arabic)
    // Text flows RTL, but UI element positions remain FIXED via CSS logical properties
    const isRTL = language === 'he' || language === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    
    // Add data attribute for CSS targeting
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
      
      <Header language={language} onLanguageChange={onLanguageChange} />
      
      <main id="main-content" role="main" className="bg-white">
        {children}
      </main>
      
      <Footer language={language} />
    </div>
  );
}
