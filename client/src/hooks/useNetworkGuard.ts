import { useState, useEffect, useCallback } from 'react';

export interface NetworkGuardState {
  isOnline: boolean;
  isGpsAvailable: boolean;
  isChecking: boolean;
  lastCheckedAt: Date | null;
}

/**
 * useNetworkGuard — real-time connectivity + GPS availability guard for booking flows.
 *
 * Monitors:
 *  - navigator.onLine (offline/online events)
 *  - navigator.geolocation availability
 *  - Periodic connectivity ping to server
 *
 * Usage:
 *  const { isOnline, isGpsAvailable, assertConnected } = useNetworkGuard();
 *  // Call assertConnected() before submitting a booking — throws if offline.
 */
export function useNetworkGuard() {
  const [state, setState] = useState<NetworkGuardState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isGpsAvailable: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    isChecking: false,
    lastCheckedAt: null,
  });

  useEffect(() => {
    const handleOnline = () => setState(s => ({ ...s, isOnline: true }));
    const handleOffline = () => setState(s => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Performs a lightweight HEAD ping to verify actual connectivity.
   * Returns true if connected, false if not.
   */
  const pingServer = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('/api/health', { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }, []);

  /**
   * Asserts that the device is online before proceeding.
   * Throws an error with a user-friendly Hebrew/English message if offline.
   * Call this at the START of any booking submission handler.
   */
  const assertConnected = useCallback(async (language: 'he' | 'en' = 'he'): Promise<void> => {
    setState(s => ({ ...s, isChecking: true }));
    try {
      const browserOnline = navigator.onLine;
      if (!browserOnline) {
        throw new Error(
          language === 'he'
            ? 'אין חיבור לאינטרנט. אנא בדוק את החיבור ונסה שוב.'
            : 'No internet connection. Please check your connection and try again.'
        );
      }

      const serverReachable = await pingServer();
      setState(s => ({ ...s, isOnline: serverReachable, lastCheckedAt: new Date() }));

      if (!serverReachable) {
        throw new Error(
          language === 'he'
            ? 'לא ניתן להגיע לשרת PetWash. ייתכן שיש הפרעה זמנית — נסה שוב בעוד מספר שניות.'
            : 'Cannot reach PetWash servers. There may be a temporary outage — please try again in a few seconds.'
        );
      }
    } finally {
      setState(s => ({ ...s, isChecking: false }));
    }
  }, [pingServer]);

  /**
   * Request GPS position with a timeout.
   * Returns coordinates or throws a user-friendly error.
   */
  const requestGps = useCallback((language: 'he' | 'en' = 'he'): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(
          language === 'he'
            ? 'מיקום GPS אינו נתמך בדפדפן זה.'
            : 'GPS location is not supported in this browser.'
        ));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(
          language === 'he'
            ? 'זמן הגישה למיקום GPS פג. אנא אפשר גישה למיקום ונסה שוב.'
            : 'GPS location timed out. Please allow location access and try again.'
        ));
      }, 8000);

      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timeoutId); resolve(pos.coords); },
        (err) => {
          clearTimeout(timeoutId);
          const msgs: Record<number, { he: string; en: string }> = {
            1: { he: 'גישה למיקום נדחתה. אנא אפשר גישה למיקום בהגדרות הדפדפן.', en: 'Location access denied. Please enable location in browser settings.' },
            2: { he: 'המיקום אינו זמין כרגע. אנא נסה שוב.', en: 'Location unavailable. Please try again.' },
            3: { he: 'זמן הגישה למיקום GPS פג.', en: 'GPS location timed out.' },
          };
          const msg = msgs[err.code] || { he: 'שגיאת GPS לא ידועה.', en: 'Unknown GPS error.' };
          reject(new Error(language === 'he' ? msg.he : msg.en));
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
      );
    });
  }, []);

  return {
    ...state,
    assertConnected,
    requestGps,
    pingServer,
  };
}
