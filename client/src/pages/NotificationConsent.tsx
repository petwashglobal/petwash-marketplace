import { useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, BellOff, Sparkles } from 'lucide-react';
import { useFCMNotifications } from '@/hooks/useFCMNotifications';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import type { Language } from '@/lib/i18n';

interface NotificationConsentProps {
  language?: Language;
}

export default function NotificationConsent({ language = 'he' }: NotificationConsentProps) {
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const { supported, vapidConfigured, loading, requestPermission } = useFCMNotifications(false);
  const [enabling, setEnabling] = useState(false);
  const [done, setDone] = useState(false);

  const isRTL = language === 'he' || language === 'ar';

  const text = {
    he: {
      title: 'הישאר מעודכן',
      subtitle: 'אפשר לנו לשלוח לך התראות על הזמנות, תשלומים ועדכונים חשובים.',
      benefits: [
        'אישורי הזמנות מיידיים',
        'תזכורות לסשן הרחיצה',
        'עדכוני הליכה חיים',
        'מבצעים ותגמולי נאמנות',
      ],
      enable: 'הפעל התראות',
      notNow: 'לא עכשיו',
      enabling: 'מפעיל...',
      notSupported: 'ההתראות אינן נתמכות בדפדפן זה',
    },
    en: {
      title: 'Stay Updated',
      subtitle: 'Allow us to send you notifications about bookings, payments, and important updates.',
      benefits: [
        'Instant booking confirmations',
        'Wash session reminders',
        'Live walk updates',
        'Loyalty rewards & offers',
      ],
      enable: 'ENABLE NOTIFICATIONS',
      notNow: 'NOT NOW',
      enabling: 'Enabling...',
      notSupported: 'Notifications not supported in this browser',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];

  const goNext = () => {
    localStorage.setItem('petwash_notification_consent_shown', 'true');
    navigate('/dashboard');
  };

  const handleEnable = async () => {
    if (!supported || !vapidConfigured || !user) {
      goNext();
      return;
    }
    setEnabling(true);
    try {
      await requestPermission();
    } finally {
      setEnabling(false);
      setDone(true);
      setTimeout(goNext, 800);
    }
  };

  const handleNotNow = () => {
    localStorage.setItem('petwash_notification_consent_shown', 'true');
    localStorage.setItem('notification_prompt_dismissed', Date.now().toString());
    navigate('/dashboard');
  };

  return (
    <div
      className="min-h-[100dvh] bg-white flex flex-col items-center justify-between px-6"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px))',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Top Illustration */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div className="relative mb-10">
          {/* Outer glow ring */}
          <div
            className="w-52 h-52 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#ffffff', border: '1.5px solid rgba(212,175,55,0.25)', borderRadius: '50%' }}
          >
            {/* Inner gold circle */}
            <div
              className="w-40 h-40 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <Bell className="w-20 h-20 text-white" strokeWidth={1.5} />
            </div>
          </div>
          {/* Sparkle badge */}
          <div
            className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          {t.title}
        </h1>

        {/* Subtitle */}
        <p className="text-base text-gray-500 text-center leading-relaxed mb-8">
          {t.subtitle}
        </p>

        {/* Benefits list */}
        <ul className="w-full space-y-3 mb-8">
          {t.benefits.map((benefit, i) => (
            <li key={i} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: '#D4AF37' }}
              >
                <svg viewBox="0 0 10 8" fill="none" className="w-3.5 h-3.5">
                  <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Not supported notice */}
        {(!supported || !vapidConfigured) && (
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <BellOff className="w-4 h-4" />
            <span>{t.notSupported}</span>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={handleEnable}
          disabled={enabling || loading || done}
          data-testid="button-enable-notifications"
          className="w-full h-14 rounded-2xl font-bold text-base tracking-wide text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#D4AF37' }}
        >
          {enabling || loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : done ? (
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 12 10" fill="none" className="w-4 h-4">
                <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t.enable}
            </div>
          ) : (
            <>
              <Bell className="w-5 h-5" />
              {t.enable}
            </>
          )}
        </button>

        <button
          onClick={handleNotNow}
          data-testid="button-not-now-notifications"
          className="w-full text-center text-sm font-bold underline min-h-[44px] flex items-center justify-center transition-opacity hover:opacity-70 tracking-wide"
          style={{ color: '#D4AF37' }}
        >
          {t.notNow}
        </button>
      </div>
    </div>
  );
}
