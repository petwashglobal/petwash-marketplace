import { useState } from 'react';
import { Accessibility } from 'lucide-react';
import { AccessibilityMenu } from './AccessibilityMenu';
import type { Language } from '@/lib/i18n';

interface AccessibilityButtonProps {
  language: Language;
}

const labels: Record<string, { text: string; aria: string; skip: string }> = {
  en: { text: 'Accessibility', aria: 'Open accessibility menu to customize the site to your needs', skip: 'Skip to main content' },
  he: { text: 'נגישות', aria: 'פתח תפריט נגישות להתאמת האתר לצרכים שלך', skip: 'דלג לתוכן הראשי' },
  ar: { text: 'إمكانية الوصول', aria: 'افتح قائمة إمكانية الوصول لتخصيص الموقع حسب احتياجاتك', skip: 'انتقل إلى المحتوى الرئيسي' },
  ru: { text: 'Доступность', aria: 'Открыть меню доступности для настройки сайта', skip: 'Перейти к основному содержимому' },
  fr: { text: 'Accessibilité', aria: 'Ouvrir le menu d\'accessibilité pour personnaliser le site', skip: 'Aller au contenu principal' },
  es: { text: 'Accesibilidad', aria: 'Abrir menú de accesibilidad para personalizar el sitio', skip: 'Ir al contenido principal' },
};

export function AccessibilityButton({ language }: AccessibilityButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const l = labels[language] || labels.en;

  return (
    <>
      <button
        onClick={toggleMenu}
        className="floating-button-accessibility bg-black text-white rounded-full p-3 sm:p-4 shadow-lg hover:bg-gray-800 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 min-w-[48px] min-h-[48px] flex items-center justify-center"
        aria-label={l.aria}
        title={l.text}
        tabIndex={0}
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <Accessibility className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          <span className="hidden sm:inline text-xs sm:text-sm font-medium whitespace-nowrap">{l.text}</span>
        </div>
      </button>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:ring-4 focus:ring-blue-500"
      >
        {l.skip}
      </a>

      <AccessibilityMenu
        language={language}
        isOpen={isMenuOpen}
        onClose={closeMenu}
      />
    </>
  );
}
