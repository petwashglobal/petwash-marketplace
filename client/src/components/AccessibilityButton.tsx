import { useState } from 'react';
import { Accessibility } from 'lucide-react';
import { AccessibilityMenu } from './AccessibilityMenu';
import type { Language } from '@/lib/i18n';

interface AccessibilityButtonProps {
  language: Language;
}

export function AccessibilityButton({ language }: AccessibilityButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Toggle accessibility menu
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const buttonText = language === 'he' ? 'נגישות' : 'Accessibility';
  const buttonAriaLabel = language === 'he' 
    ? 'פתח תפריט נגישות להתאמת האתר לצרכים שלך'
    : 'Open accessibility menu to customize the site to your needs';

  return (
    <>
      {/* Floating Accessibility Button */}
      <button
        onClick={toggleMenu}
        className="floating-button-accessibility bg-black text-white rounded-full p-3 sm:p-4 shadow-lg hover:bg-gray-800 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 min-w-[48px] min-h-[48px] flex items-center justify-center"
        aria-label={buttonAriaLabel}
        title={buttonText}
        tabIndex={0}
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <Accessibility className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          <span className="hidden sm:inline text-xs sm:text-sm font-medium whitespace-nowrap">{buttonText}</span>
        </div>
      </button>

      {/* Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:ring-4 focus:ring-blue-500"
      >
        {language === 'he' ? 'דלג לתוכן הראשי' : 'Skip to main content'}
      </a>

      {/* Accessibility Menu */}
      <AccessibilityMenu
        language={language}
        isOpen={isMenuOpen}
        onClose={closeMenu}
      />
    </>
  );
}