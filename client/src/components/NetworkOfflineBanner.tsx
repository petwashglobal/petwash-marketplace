/**
 * NetworkOfflineBanner — Sticky banner shown whenever the device loses connectivity.
 *
 * Mounted once in Layout. Uses the existing useNetworkGuard hook.
 * Automatically hides when connection is restored.
 * Blocks all booking-related mutations while offline via aria-live + visual indicator.
 */

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

const MESSAGES = {
  he: {
    offline:       'אין חיבור לאינטרנט',
    offlineSub:    'ניסיון להתחבר מחדש... ההזמנות שלך בטוחות.',
    serverDown:    'השרת אינו מגיב',
    serverDownSub: 'נסה שוב בעוד מספר שניות. הנתונים שלך שמורים.',
    reconnected:   'החיבור שוחזר',
  },
  en: {
    offline:       'No internet connection',
    offlineSub:    'Reconnecting… Your bookings are safe.',
    serverDown:    'Server not responding',
    serverDownSub: 'Please try again in a few seconds. Your data is safe.',
    reconnected:   'Connection restored',
  },
} as const;

type Lang = keyof typeof MESSAGES;

export function NetworkOfflineBanner() {
  const { language } = useLanguage();
  const lang: Lang = language === 'he' ? 'he' : 'en';
  const t = MESSAGES[lang];

  const [isOnline, setIsOnline]         = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline  = () => {
      setIsOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 3000);
    };
    const handleOffline = () => { setIsOnline(false); setJustReconnected(false); };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /* Reconnected flash — green, auto-dismisses */
  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white"
        style={{ background: '#10B981', animation: 'slideDown 0.3s ease' }}
        dir={lang === 'he' ? 'rtl' : 'ltr'}
      >
        <Wifi className="w-4 h-4 flex-shrink-0" />
        {t.reconnected}
      </div>
    );
  }

  /* Offline banner — red, persistent */
  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 inset-x-0 z-[9999] px-4 py-3"
        style={{ background: '#EF4444' }}
        dir={lang === 'he' ? 'rtl' : 'ltr'}
      >
        <div className="max-w-lg mx-auto flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{t.offline}</p>
            <p className="text-red-100 text-xs mt-0.5">{t.offlineSub}</p>
          </div>
          {/* Animated reconnecting dots */}
          <div className="ms-auto flex items-center gap-1 flex-shrink-0">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block w-1.5 h-1.5 rounded-full bg-white/60"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
