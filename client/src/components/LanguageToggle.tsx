import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';

interface LanguageToggleProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export function LanguageToggle({ language, onLanguageChange }: LanguageToggleProps) {
  const handleLanguageChange = (newLanguage: Language) => {
    onLanguageChange(newLanguage);
    localStorage.setItem('language', newLanguage);
    // Trigger storage event for cross-component sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'language',
      newValue: newLanguage,
      oldValue: language
    }));
  };

  const languages = [
    { code: 'en' as Language, label: 'EN' },
    { code: 'he' as Language, label: 'HE' },
    { code: 'ar' as Language, label: 'AR' },
    { code: 'ru' as Language, label: 'RU' },
    { code: 'fr' as Language, label: 'FR' },
    { code: 'es' as Language, label: 'ES' },
  ];

  return (
    <div 
      className="flex items-center justify-center w-full" 
      role="group" 
      aria-label="Language selector"
    >
      <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 border-2 border-gradient-to-r from-blue-200/80 via-purple-200/80 to-pink-200/80 rounded-2xl bg-gradient-to-br from-white/98 via-blue-50/98 to-purple-50/98 dark:bg-gradient-to-br dark:from-gray-900/98 dark:via-blue-950/98 dark:to-purple-950/98 shadow-[0_6px_24px_rgba(0,0,0,0.12)] backdrop-blur-md">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`
              relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl
              transition-all duration-300 ease-in-out
              min-w-[46px] sm:min-w-[52px] text-center
              flex-shrink-0
              ${language === lang.code
                ? 'bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white shadow-[0_4px_20px_rgba(147,51,234,0.5)] scale-105 ring-2 ring-purple-300 dark:ring-purple-700' 
                : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gradient-to-br hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900 dark:hover:to-pink-900 hover:shadow-[0_2px_12px_rgba(147,51,234,0.3)] hover:scale-105'
              }
            `}
            aria-pressed={language === lang.code}
            aria-label={`Switch to ${lang.label}`}
            data-testid={`language-button-${lang.code}`}
            type="button"
          >
            <span className={language === lang.code ? 'text-white font-extrabold' : 'font-bold'}>
              {lang.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
