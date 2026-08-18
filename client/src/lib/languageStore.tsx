import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { t as translate, isRTL, Language } from './i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const VALID_LANGUAGES: Language[] = ['en', 'he', 'ar', 'ru', 'fr', 'es'];

/**
 * PR-I18N-URL-LANG-OVERRIDE (2026-08-15) — fire-order item 2.
 * Read an explicit ?lang= from the URL and, if valid, return it AND
 * persist it. This must be checked BEFORE the localStorage-backed
 * `readSavedLanguage()`; otherwise `?lang=en` is ignored (the exact
 * bug on production — https://petwash.co.il/?lang=en rendered as
 * Hebrew because the stored pw_lang won). The CEO rule: "stored
 * language must not override an explicit URL language incorrectly."
 *
 * Persisting the URL choice into pw_lang means a refresh preserves
 * the selected language even after the query string is dropped
 * (e.g. clicking an internal link that has no ?lang=). Any language
 * switcher call to setLanguage() continues to overwrite pw_lang, so
 * this doesn't lock the user into the URL value.
 */
function readUrlLanguage(): Language | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    // Accept both `?lang=` and `?hl=` (common convention — Google, YouTube).
    const raw = (params.get('lang') || params.get('hl') || '').toLowerCase();
    if (!raw) return null;
    // Accept a locale prefix too — `?lang=en-US` → `en`.
    const short = raw.split(/[-_]/)[0] as Language;
    if (VALID_LANGUAGES.includes(short)) {
      // Persist so a refresh (which may drop the query string) still
      // shows the requested language.
      try { localStorage.setItem('pw_lang', short); } catch { /* private mode */ }
      return short;
    }
  } catch { /* malformed search string */ }
  return null;
}

/**
 * Read the saved language preference using the canonical key (pw_lang).
 * Falls back to legacy keys for one-time migration — writes pw_lang and returns the value.
 * Returns null if no valid saved preference exists.
 */
function readSavedLanguage(): Language | null {
  const canonical = localStorage.getItem('pw_lang') as Language;
  if (canonical && VALID_LANGUAGES.includes(canonical)) return canonical;

  // Migration: copy first valid legacy key into pw_lang, then use it
  const legacy = (localStorage.getItem('petwash_lang') || localStorage.getItem('language')) as Language;
  if (legacy && VALID_LANGUAGES.includes(legacy)) {
    localStorage.setItem('pw_lang', legacy);
    return legacy;
  }
  return null;
}

/**
 * Persist the user's language choice.
 * Writes ONLY to pw_lang — the canonical key. Never writes legacy keys.
 */
function saveLanguage(lang: Language): void {
  localStorage.setItem('pw_lang', lang);
}

function applyDirToDOM(lang: Language) {
  document.documentElement.lang = lang;
  document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // PR-I18N-URL-LANG-OVERRIDE: URL is authoritative when present.
    // `?lang=en` on a fresh visit MUST render English, even if the
    // stored pw_lang says he. Only fall back to storage when the URL
    // is silent on the matter.
    const url = readUrlLanguage();
    if (url) {
      applyDirToDOM(url);
      return url;
    }
    const saved = readSavedLanguage();
    if (saved) {
      applyDirToDOM(saved);
      return saved;
    }
    applyDirToDOM('he');
    return 'he';
  });

  useEffect(() => {
    applyDirToDOM(language);

    // Poll only the canonical key. Migration has already run in the useState
    // initializer, so pw_lang is always up-to-date by the time we get here.
    const interval = setInterval(() => {
      const current = localStorage.getItem('pw_lang') as Language;
      if (current && VALID_LANGUAGES.includes(current)) {
        setLanguageState(prev => {
          if (prev !== current) {
            applyDirToDOM(current);
            return current;
          }
          return prev;
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveLanguage(lang);
    applyDirToDOM(lang);
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
