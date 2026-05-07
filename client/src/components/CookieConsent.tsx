import { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { 
  hasConsentPreferences, 
  saveConsentPreferences, 
  createAcceptAllConsent, 
  createRejectAllConsent 
} from '@/lib/consent';

interface CookieConsentProps {
  language: Language;
  onOpenManager?: () => void;
}

export function CookieConsent({ language, onOpenManager }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (!hasConsentPreferences()) {
      // Delay past the entry popup auto-dismiss (3 000 ms) so they never overlap
      setTimeout(() => setIsVisible(true), 4500);
    }
  }, []);

  // Issue #166: while the consent panel is visible, signal the rest of the
  // app (specifically FloatingStack at z-9050) to step out of the way so its
  // WhatsApp / accessibility / AI buttons cannot cover the consent buttons
  // on iPhone. The CSS rule lives in `client/src/styles/floating-stack.css`
  // (`body[data-cookie-consent-active="true"] .pw-float-stack`).
  useEffect(() => {
    if (!isVisible) return;
    document.body.setAttribute('data-cookie-consent-active', 'true');
    return () => {
      document.body.removeAttribute('data-cookie-consent-active');
    };
  }, [isVisible]);

  const handleAcceptAll = async () => {
    await saveConsentPreferences(createAcceptAllConsent());
    setIsAnimatingOut(true);
    setTimeout(() => setIsVisible(false), 400);
  };

  const handleRejectAll = async () => {
    await saveConsentPreferences(createRejectAllConsent());
    setIsAnimatingOut(true);
    setTimeout(() => setIsVisible(false), 400);
  };

  const handleManagePreferences = () => {
    // Immediately call onOpenManager so modal can render
    onOpenManager?.();
    // Then animate banner out
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 400);
  };

  if (!isVisible) return null;

  const text = {
    en: {
      title: 'Your Privacy Choices',
      message: 'We use cookies for essential functions, analytics, and personalized offers. Non-essential cookies are only activated with your explicit consent. You may reject all non-essential cookies without affecting core service functionality.',
      policy: 'Read our',
      privacyPolicy: 'Privacy Policy',
      acceptAll: 'Accept All',
      rejectAll: 'Reject Non-Essential',
      manage: 'Manage Preferences',
    },
    he: {
      title: 'העדפות פרטיות',
      message: 'אנו משתמשים בעוגיות לצורכי תפעול חיוני, אנליטיקה ומבצעים מותאמים. עוגיות שאינן הכרחיות מופעלות רק בהסכמתך המפורשת. ניתן לדחות עוגיות לא-הכרחיות ללא פגיעה בפונקציונליות הבסיסית של השירות.',
      policy: 'קרא את',
      privacyPolicy: 'מדיניות הפרטיות',
      acceptAll: 'אישור הכל',
      rejectAll: 'דחיית לא-הכרחיות',
      manage: 'ניהול העדפות',
    },
    ar: {
      title: 'خيارات الخصوصية',
      message: 'نستخدم ملفات تعريف الارتباط للوظائف الأساسية والتحليلات والعروض المخصصة. لا يتم تفعيل ملفات تعريف الارتباط غير الضرورية إلا بموافقتك الصريحة.',
      policy: 'اقرأ',
      privacyPolicy: 'سياسة الخصوصية',
      acceptAll: 'قبول الكل',
      rejectAll: 'رفض غير الضروري',
      manage: 'إدارة التفضيلات',
    },
    ru: {
      title: 'Настройки конфиденциальности',
      message: 'Мы используем cookies для основных функций, аналитики и персонализации. Необязательные cookies активируются только с вашего явного согласия.',
      policy: 'Ознакомьтесь с',
      privacyPolicy: 'Политикой конфиденциальности',
      acceptAll: 'Принять все',
      rejectAll: 'Отклонить необязательные',
      manage: 'Настроить',
    },
    fr: {
      title: 'Vos choix de confidentialité',
      message: 'Nous utilisons des cookies pour les fonctions essentielles, l\'analyse et les offres personnalisées. Les cookies non essentiels ne sont activés qu\'avec votre consentement explicite.',
      policy: 'Lire notre',
      privacyPolicy: 'Politique de confidentialité',
      acceptAll: 'Tout accepter',
      rejectAll: 'Refuser les non-essentiels',
      manage: 'Gérer les préférences',
    },
    es: {
      title: 'Sus opciones de privacidad',
      message: 'Usamos cookies para funciones esenciales, análisis y ofertas personalizadas. Las cookies no esenciales solo se activan con su consentimiento explícito.',
      policy: 'Lea nuestra',
      privacyPolicy: 'Política de privacidad',
      acceptAll: 'Aceptar todo',
      rejectAll: 'Rechazar no esenciales',
      manage: 'Gestionar preferencias',
    },
  };

  const t = text[language];

  // RTL languages: Hebrew and Arabic
  const isRTL = language === 'he' || language === 'ar';
  
  return (
    <div
      data-testid="cookie-consent-banner"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto sm:max-w-md z-[9100] transition-all duration-400 ${
        isAnimatingOut ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
      style={{
        animation: isAnimatingOut ? 'none' : 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        // Issue #166: keep the panel fully visible above iPhone home indicator
        // by adding the safe-area inset; cap height so long copy doesn't push
        // the action buttons offscreen (panel scrolls internally instead).
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="backdrop-blur-xl rounded-2xl p-5 shadow-2xl overflow-y-auto"
        style={{
          background: '#FFFFFF',
          border: '1px solid #000000',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          // Issue #166: cap the inner panel height to the viewport minus
          // safe-area inset and external padding so the Accept / Reject /
          // Manage buttons are always visible without zooming on iPhone.
          maxHeight: 'calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex gap-4">
          <div 
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: '#000000',
            }}
          >
            <Cookie className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold text-gray-900 mb-1"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
            >
              {t.title}
            </p>
            <p 
              className="text-sm text-gray-700 mb-3 leading-relaxed"
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontWeight: 300,
              }}
            >
              {t.message}
            </p>
            
            <p 
              className="text-xs text-gray-500 mb-4"
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontWeight: 300,
              }}
            >
              {t.policy}{' '}
              <a 
                href="/privacy-policy" 
                className="inline-flex items-center hover:opacity-80 transition-opacity"
                style={{
                  color: '#000000',
                  fontWeight: 500,
                  textDecoration: 'underline',
                }}
              >
                {t.privacyPolicy}
              </a>
            </p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleAcceptAll}
                className="btn-gucci-black w-full hover:opacity-90 transition-all duration-200 px-4 py-2.5 text-sm rounded-xl shadow-lg"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  fontWeight: 500,
                }}
                data-testid="button-accept-all-cookies"
              >
                {t.acceptAll}
              </button>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleRejectAll}
                  className="flex-1 bg-white hover:bg-white text-black border border-black transition-all duration-200 px-4 py-2.5 text-sm rounded-xl"
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    fontWeight: 400,
                  }}
                  data-testid="button-reject-all-cookies"
                >
                  {t.rejectAll}
                </button>

                <button
                  onClick={handleManagePreferences}
                  className="flex-1 bg-white hover:bg-white text-black border border-black transition-all duration-200 px-4 py-2.5 text-sm rounded-xl"
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    fontWeight: 400,
                  }}
                  data-testid="button-manage-cookies"
                >
                  {t.manage}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
