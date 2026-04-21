import { useState, useEffect, useRef, useCallback } from 'react';
import { Accessibility } from 'lucide-react';
import { AccessibilityMenu } from './AccessibilityMenu';
import { Language, t } from '@/lib/i18n';
import { useAnalytics } from '@/hooks/useAnalytics';
import { whatsappUrl, SUPPORT_WHATSAPP_URL } from '@/lib/support-contact';

interface FloatingStackProps {
  language: Language;
  onAIClick: () => void;
}

export function FloatingStack({ language, onAIClick }: FloatingStackProps) {
  const [isAccessibilityMenuOpen, setIsAccessibilityMenuOpen] = useState(false);
  const { trackWhatsAppClick } = useAnalytics();
  const stackRef = useRef<HTMLDivElement>(null);

  const handleWhatsAppClick = useCallback(() => {
    try {
      trackWhatsAppClick(language);
      const message = t('whatsapp.initialMessage', language);
      window.open(whatsappUrl(message), '_blank', 'noopener,noreferrer');
    } catch (error) {
      window.location.href = SUPPORT_WHATSAPP_URL;
    }
  }, [language, trackWhatsAppClick]);

  const handleAccessibilityClick = useCallback(() => {
    setIsAccessibilityMenuOpen(true);
  }, []);

  const handleAIClick = useCallback(() => {
    onAIClick();
  }, [onAIClick]);

  useEffect(() => {
    if ((window as any).__PW_FLOAT_STACK_LOADED__) {
      return;
    }
    (window as any).__PW_FLOAT_STACK_LOADED__ = true;

    const stack = stackRef.current;

    function adjustForKeyboard() {
      if (!window.visualViewport || !stack) return;
      
      const vv = window.visualViewport;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
      const extraOffset = keyboardHeight > 120 ? keyboardHeight - 8 : 0;
      
      const buttons = stack.querySelectorAll('.pw-float');
      buttons.forEach((btn: Element) => {
        const htmlBtn = btn as HTMLElement;
        const baseBottom = parseInt(htmlBtn.getAttribute('data-base-bottom') || '0');
        htmlBtn.style.bottom = `${baseBottom + extraOffset}px`;
      });
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', adjustForKeyboard);
      window.visualViewport.addEventListener('scroll', adjustForKeyboard);
      adjustForKeyboard();
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (stack && (e.target as HTMLElement).matches('input, select, textarea')) {
        stack.style.opacity = '0.4';
        stack.style.pointerEvents = 'auto';
      }
    };

    const handleFocusOut = () => {
      if (stack) {
        stack.style.opacity = '1';
        stack.style.pointerEvents = '';
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        window.visualViewport.removeEventListener('scroll', adjustForKeyboard);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const aiLabel = t('fab.aiLabel', language);
  const whatsappLabel = 'WhatsApp';
  const accessibilityLabel = t('fab.accessibility', language);

  return (
    <>
      <div ref={stackRef} className="pw-float-stack" dir="ltr">
        <button
          id="pw-a11y"
          className="pw-float"
          type="button"
          data-base-bottom="160"
          aria-label={accessibilityLabel}
          aria-expanded={isAccessibilityMenuOpen}
          aria-controls="pw-accessibility-menu"
          onClick={handleAccessibilityClick}
          data-testid="fab-accessibility"
        >
          <Accessibility className="h-6 w-6" aria-hidden="true" />
        </button>

        <button
          id="pw-wa"
          className="pw-float"
          type="button"
          data-base-bottom="88"
          aria-label={whatsappLabel}
          onClick={handleWhatsAppClick}
          data-testid="fab-whatsapp"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </button>

        <button
          id="pw-ai"
          className="pw-float pw-ai-btn"
          type="button"
          data-base-bottom="16"
          aria-label={aiLabel}
          onClick={handleAIClick}
          data-testid="fab-ai"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 3c4.4 0 8 2.9 8 6.6 0 3.7-3.6 6.6-8 6.6-.8 0-1.6-.1-2.3-.3l-3.3 2c-.5.3-1.1-.2-1-.8l.5-2.9C5 11.9 4 10.3 4 9.6 4 5.9 7.6 3 12 3z"/>
            <path fill="currentColor" d="M18.2 2.2l.4 1.4 1.4.4-1.4.4-.4 1.4-.4-1.4-1.4-.4 1.4-.4.4-1.4z"/>
          </svg>
        </button>
      </div>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:ring-4 focus:ring-blue-500"
      >
        {language === 'he' ? 'דלג לתוכן הראשי' : 'Skip to main content'}
      </a>

      <AccessibilityMenu
        language={language}
        isOpen={isAccessibilityMenuOpen}
        onClose={() => setIsAccessibilityMenuOpen(false)}
      />
    </>
  );
}
