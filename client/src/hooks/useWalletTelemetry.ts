/**
 * Wallet Telemetry Hook
 * 
 * Client-side telemetry for AI-assisted wallet pass success detection:
 * - Tracks visibility changes (wallet app opening)
 * - Sends post-click beacons
 * - Detects popup blockers
 * - Uses navigator.sendBeacon() for reliable tracking
 */

import { useEffect, useRef } from 'react';

interface WalletTelemetryOptions {
  token?: string;
  platform: 'apple' | 'google';
  onSuccess?: () => void;
  onFailed?: () => void;
}

export function useWalletTelemetry(options: WalletTelemetryOptions) {
  const { token, platform, onSuccess, onFailed } = options;
  const clickTimestampRef = useRef<number>(0);
  const beaconSentRef = useRef<Set<string>>(new Set());

  const sendBeacon = (type: string, extra?: any) => {
    if (!token) return;
    
    // Prevent duplicate beacons
    const beaconKey = `${type}-${token}`;
    if (beaconSentRef.current.has(beaconKey)) return;
    beaconSentRef.current.add(beaconKey);

    const payload = {
      type,
      token,
      extra,
      ts: Date.now()
    };

    // Try sendBeacon first (more reliable for page unload)
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (navigator.sendBeacon('/api/wallet/telemetry/beacon', blob)) {
        return;
      }
    } catch (error) {
      console.warn('[WalletTelemetry] sendBeacon failed, falling back to fetch');
    }

    // Fallback to fetch with keepalive
    fetch('/api/wallet/telemetry/beacon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(err => {
      console.error('[WalletTelemetry] Beacon failed:', err);
    });
  };

  useEffect(() => {
    if (!token) return;

    // Visibility change detection (strong signal for wallet opened)
    const handleVisibilityChange = () => {
      if (document.hidden && clickTimestampRef.current > 0) {
        const timeSinceClick = Date.now() - clickTimestampRef.current;
        
        // If tab hidden within 5s of click -> likely wallet app opened
        if (timeSinceClick < 5000) {
          sendBeacon('visibility-hidden', { dt: timeSinceClick });
          
          // High confidence success - user likely adding to wallet
          if (timeSinceClick < 2000 && onSuccess) {
            onSuccess();
          }
        }
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, onSuccess]);

  const trackClick = () => {
    if (!token) return;
    
    clickTimestampRef.current = Date.now();
    const clickType = platform === 'apple' ? 'apple-click' : 'google-click';
    sendBeacon(clickType, {});

    // Send post-click beacon after 2s to confirm user still engaged
    setTimeout(() => {
      const postClickType = platform === 'apple' ? 'apple-post-2s' : 'google-post-2s';
      sendBeacon(postClickType, {});
    }, 2000);
  };

  const trackPopupBlocked = () => {
    if (!token) return;
    sendBeacon('popup-blocked', {});
    if (onFailed) {
      onFailed();
    }
  };

  return {
    trackClick,
    trackPopupBlocked,
    sendBeacon
  };
}
