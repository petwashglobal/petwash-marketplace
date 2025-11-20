/**
 * Luxury Compact Language Switcher - 7-Star Design
 * Replaces the old language bar with a glassy dropdown
 */

import { useState, useEffect, useRef } from 'react';
import { Globe } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface LuxuryLanguageSwitcherProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  className?: string;
}

const LANGUAGES = [
  { code: 'en' as Language, label: 'EN', name: 'English' },
  { code: 'he' as Language, label: 'HE', name: 'עברית' },
  { code: 'ar' as Language, label: 'AR', name: 'العربية' },
  { code: 'ru' as Language, label: 'RU', name: 'Русский' },
  { code: 'fr' as Language, label: 'FR', name: 'Français' },
  { code: 'es' as Language, label: 'ES', name: 'Español' },
];

export function LuxuryLanguageSwitcher({
  language,
  onLanguageChange,
  className = '',
}: LuxuryLanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const handleLanguageChange = (newLanguage: Language) => {
    onLanguageChange(newLanguage);
    setIsOpen(false);
    
    // Store in localStorage
    localStorage.setItem('language', newLanguage);
    
    // Trigger storage event for cross-component sync
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'language',
        newValue: newLanguage,
        oldValue: language,
      })
    );

    // Update HTML attributes
    document.documentElement.lang = newLanguage;
    document.documentElement.dir = ['he', 'ar'].includes(newLanguage) ? 'rtl' : 'ltr';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button - Glassy Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-1.5 px-3 py-1.5
          bg-white/10 dark:bg-black/10
          border border-white/20 dark:border-white/10
          rounded-full
          backdrop-blur-md
          shadow-[0_2px_8px_rgba(0,0,0,0.08)]
          hover:bg-white/20 dark:hover:bg-black/20
          hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]
          transition-all duration-200
          outline-none
          focus:ring-2 focus:ring-purple-400/50 dark:focus:ring-purple-500/50
          focus:ring-offset-0
        "
        aria-label="Change language"
        data-testid="language-switcher-button"
        type="button"
      >
        <Globe className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
          {currentLang.label}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute top-full right-0 mt-2
            w-48
            bg-white/95 dark:bg-gray-900/95
            backdrop-blur-xl
            border border-gray-200/50 dark:border-gray-700/50
            rounded-2xl
            shadow-[0_8px_32px_rgba(0,0,0,0.12)]
            overflow-hidden
            z-[100]
          "
          data-testid="language-dropdown"
        >
          <div className="p-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5
                  rounded-xl
                  transition-all duration-150
                  outline-none
                  focus:ring-2 focus:ring-purple-400/50 dark:focus:ring-purple-500/50
                  ${
                    language === lang.code
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                  }
                `}
                aria-pressed={language === lang.code}
                aria-label={`Switch to ${lang.name}`}
                data-testid={`language-option-${lang.code}`}
                type="button"
              >
                <span className="text-xs font-bold uppercase min-w-[28px]">
                  {lang.label}
                </span>
                <span className="text-sm flex-1 text-left">
                  {lang.name}
                </span>
                {language === lang.code && (
                  <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
