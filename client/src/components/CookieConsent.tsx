import { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface CookieConsentProps {
  language: Language;
}

export function CookieConsent({ language }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('petwash_cookie_consent');
    if (!consent) {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      localStorage.setItem('petwash_cookie_consent', 'accepted');
      setIsVisible(false);
    }, 400);
  };

  if (!isVisible) return null;

  const text = {
    en: {
      message: 'We use cookies to improve your experience, secure your account, and personalize offers.',
      policy: 'By continuing, you agree to our',
      privacyPolicy: 'Privacy Policy',
      accept: 'Accept',
    },
    he: {
      message: 'אנו משתמשים בעוגיות לשיפור החוויה, אבטחת החשבון והתאמת מבצעים אישיים.',
      policy: 'בשימוש באתר אתה מסכים ל',
      privacyPolicy: 'מדיניות הפרטיות',
      accept: 'אישור',
    },
    ar: {
      message: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتأمين حسابك وتخصيص العروض.',
      policy: 'بالمتابعة، فإنك توافق على',
      privacyPolicy: 'سياسة الخصوصية',
      accept: 'قبول',
    },
    ru: {
      message: 'Мы используем файлы cookie для улучшения вашего опыта, защиты учетной записи и персонализации предложений.',
      policy: 'Продолжая, вы соглашаетесь с нашей',
      privacyPolicy: 'Политикой конфиденциальности',
      accept: 'Принять',
    },
    fr: {
      message: 'Nous utilisons des cookies pour améliorer votre expérience, sécuriser votre compte et personnaliser les offres.',
      policy: 'En continuant, vous acceptez notre',
      privacyPolicy: 'Politique de confidentialité',
      accept: 'Accepter',
    },
    es: {
      message: 'Utilizamos cookies para mejorar su experiencia, proteger su cuenta y personalizar las ofertas.',
      policy: 'Al continuar, acepta nuestra',
      privacyPolicy: 'Política de privacidad',
      accept: 'Aceptar',
    },
  };

  const t = text[language];

  // RTL languages: Hebrew and Arabic
  const isRTL = language === 'he' || language === 'ar';
  
  return (
    <div 
      className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-50 max-w-md transition-all duration-400 ${
        isAnimatingOut ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
      style={{
        animation: isAnimatingOut ? 'none' : 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div 
        className="backdrop-blur-xl rounded-2xl p-5 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 249, 240, 0.98) 100%)',
          border: '1px solid rgba(212, 175, 55, 0.15)',
          boxShadow: '0 20px 60px rgba(212, 175, 55, 0.2), 0 0 1px rgba(212, 175, 55, 0.3)',
        }}
      >
        <div className="flex gap-4">
          <div 
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
            }}
          >
            <Cookie className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
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
                href="/privacy" 
                className="inline-flex items-center hover:opacity-80 transition-opacity"
                style={{
                  color: '#d4af37',
                  fontWeight: 400,
                }}
              >
                {t.privacyPolicy}
              </a>
            </p>
            
            <button
              onClick={handleAccept}
              className="w-full text-white hover:opacity-90 transition-all duration-200 px-4 py-2.5 text-sm rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontWeight: 400,
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.25)',
              }}
              data-testid="button-accept-cookies"
            >
              {t.accept}
            </button>
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
