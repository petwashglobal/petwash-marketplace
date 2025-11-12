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
    // CRITICAL: ALWAYS FORCE LTR LAYOUT - Hebrew mode only changes text, not layout
    document.documentElement.dir = 'ltr';
    localStorage.setItem('language', language);
  }, [language]);

  return (
    <div className="min-h-screen">
      {/* Skip to Content for Accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white border text-black px-4 py-2 rounded z-50"
      >
        Skip to content
      </a>
      
      <Header language={language} onLanguageChange={onLanguageChange} />
      
      <main id="main-content" role="main">
        {children}
      </main>
      
      <Footer language={language} />
    </div>
  );
}
