import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { t as translate, isRTL, Language } from './i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const validLanguages: Language[] = ['en', 'he', 'ar', 'ru', 'fr', 'es'];
    const saved = (localStorage.getItem('pw_lang') || localStorage.getItem('language')) as Language;
    if (saved && validLanguages.includes(saved)) {
      setLanguageState(saved);
    }

    const interval = setInterval(() => {
      const current = (localStorage.getItem('pw_lang') || localStorage.getItem('language')) as Language;
      if (current && validLanguages.includes(current)) {
        setLanguageState(prev => prev !== current ? current : prev);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    localStorage.setItem('pw_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
  };

  const t = (key: string) => translate(key, language);
  const dir = isRTL(language) ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
