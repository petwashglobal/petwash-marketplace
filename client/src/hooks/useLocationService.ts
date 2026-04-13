import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { getApiUrl } from '@/lib/apiConfig';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable' | 'requesting';

export interface LocationStamp {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
  source: 'device_gps' | 'typed_address';
}

const STORAGE_KEY = 'pw_location_stamp';
const STAMP_TTL_MS = 24 * 60 * 60 * 1000;

function loadStoredStamp(): LocationStamp | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stamp: LocationStamp = JSON.parse(raw);
    const age = Date.now() - new Date(stamp.timestamp).getTime();
    if (age > STAMP_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stamp;
  } catch {
    return null;
  }
}

async function sendStampToBackend(stamp: LocationStamp, role: 'customer' | 'provider') {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(getApiUrl('/api/gps/user-location'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: stamp.latitude,
        longitude: stamp.longitude,
        accuracy: stamp.accuracy,
        role,
      }),
      credentials: 'include',
    });
  } catch {
  }
}

export function useLocationService(role: 'customer' | 'provider' = 'customer') {
  const [permissionState, setPermissionState] = useState<LocationPermissionState>('unknown');
  const [stamp, setStamp] = useState<LocationStamp | null>(() => loadStoredStamp());
  const hasRequested = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionState('unavailable');
      return;
    }

    navigator.permissions?.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'granted') {
        setPermissionState('granted');
        if (!stamp) acquireLocation();
      } else if (result.state === 'denied') {
        setPermissionState('denied');
      }
      result.onchange = () => {
        if (result.state === 'granted') {
          setPermissionState('granted');
          acquireLocation();
        } else if (result.state === 'denied') {
          setPermissionState('denied');
        }
      };
    }).catch(() => {
      if (stamp) setPermissionState('granted');
    });
  }, []);

  const acquireLocation = useCallback(() => {
    if (!navigator.geolocation || hasRequested.current) return;
    hasRequested.current = true;
    setPermissionState('requesting');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newStamp: LocationStamp = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          timestamp: new Date().toISOString(),
          source: 'device_gps',
        };
        // Intentional: caches the GPS stamp (lat/lng, accuracy, timestamp, source) across
        // page reloads for up to 24 h (STAMP_TTL_MS). No auth tokens or secrets are stored here.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newStamp));
        setStamp(newStamp);
        setPermissionState('granted');
        await sendStampToBackend(newStamp, role);
        hasRequested.current = false;
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState('denied');
        } else {
          setPermissionState('unavailable');
        }
        hasRequested.current = false;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: STAMP_TTL_MS }
    );
  }, [role]);

  const setAddressLocation = useCallback(async (lat: number, lng: number) => {
    const newStamp: LocationStamp = {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: new Date().toISOString(),
      source: 'typed_address',
    };
    // Intentional: same as GPS stamp — caches typed-address location for UX persistence.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStamp));
    setStamp(newStamp);
    await sendStampToBackend(newStamp, role);
  }, [role]);

  const requestPermission = useCallback(() => {
    hasRequested.current = false;
    acquireLocation();
  }, [acquireLocation]);

  return {
    permissionState,
    stamp,
    requestPermission,
    setAddressLocation,
    hasGPS: permissionState === 'granted' && stamp?.source === 'device_gps',
    hasLocation: !!stamp,
  };
}
