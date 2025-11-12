import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import type { Language } from "@/lib/i18n";
import { SUPPORTED_LANGUAGES } from "@shared/languages";

interface LanguageSwitcherProps {
  compact?: boolean; // Compact mode for header
  showFlag?: boolean; // Show country flags
}

export function LanguageSwitcher({ compact = false, showFlag = true }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Map of supported languages in the app
  // Using existing i18n system + new global languages
  const availableLanguages: Array<{
    code: Language;
    name: string;
    nativeName: string;
    flag: string;
  }> = [
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  ];

  const currentLang = availableLanguages.find(l => l.code === language) || availableLanguages[1]; // Default to English

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setIsOpen(false);
    
    // Store in localStorage
    localStorage.setItem('language', newLang);
    
    // Update HTML lang and dir attributes
    document.documentElement.lang = newLang;
    document.documentElement.dir = ['he', 'ar'].includes(newLang) ? 'rtl' : 'ltr';
  };

  if (compact) {
    // Compact mode for header/navbar
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:shadow-md transition-all"
          aria-label="Change language"
        >
          {showFlag && <span className="text-xl">{currentLang.flag}</span>}
          <span className="font-medium text-gray-900 dark:text-white hidden sm:inline">
            {currentLang.nativeName}
          </span>
          <Globe className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Choose Language
                </h3>
              </div>
              
              <div className="max-h-96 overflow-y-auto p-2">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      language === lang.code
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {showFlag && <span className="text-2xl">{lang.flag}</span>}
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{lang.nativeName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{lang.name}</p>
                    </div>
                    {language === lang.code && (
                      <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  Pet Wash Stay™ is available in {availableLanguages.length} languages
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full mode for settings page
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
          <Globe className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Language & Region
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose your preferred language
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {availableLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
              language === lang.code
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {showFlag && <span className="text-4xl">{lang.flag}</span>}
            <div className="flex-1 text-left">
              <p className="font-bold text-gray-900 dark:text-white">{lang.nativeName}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{lang.name}</p>
            </div>
            {language === lang.code && (
              <div className="p-2 bg-blue-600 rounded-full">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>Current:</strong> {currentLang.nativeName} ({currentLang.name})
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Language changes take effect immediately across the entire platform
        </p>
      </div>
    </div>
  );
}
