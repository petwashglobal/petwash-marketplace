/**
 * useMatchingEngine — Provider matching state machine
 *
 * Demo mode: scripted simulation, no backend required.
 * Live mode:  WebSocket connection to /ws/match with automatic reconnect (3 attempts).
 *
 * Image preloading: the hook preloads the provider image before transitioning
 * to "matched" state, so the card never flashes on reveal.
 *
 * Usage:
 *   const { state, match, start, cancel } = useMatchingEngine("demo", "grooming");
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type MatchState = 'idle' | 'searching' | 'matched' | 'no_match' | 'error';
export type ServiceType = 'grooming' | 'walking' | 'k9000';

export interface ProviderMatch {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  distance: string;
  etaMinutes: number;
  image: string;
  service: string;
  tagline: string;
  phone?: string;
}

const DEMO_MATCHES: Record<ServiceType, ProviderMatch> = {
  grooming: {
    id: 'g1',
    name: 'Salon du Chien — Tel Aviv',
    rating: 4.9,
    reviewCount: 312,
    distance: '0.4 km',
    etaMinutes: 8,
    image: '/brand/petwash-logo-official.png',
    service: 'Grooming',
    tagline: 'Premium grooming · certified',
  },
  walking: {
    id: 'w1',
    name: 'Tal Ben-David',
    rating: 5.0,
    reviewCount: 178,
    distance: '0.2 km',
    etaMinutes: 5,
    image: '/brand/petwash-logo-official.png',
    service: 'Dog Walking',
    tagline: 'Certified walker · GPS tracked',
  },
  k9000: {
    id: 'k1',
    name: 'K9000 — Dizengoff Square',
    rating: 4.8,
    reviewCount: 890,
    distance: '0.6 km',
    etaMinutes: 3,
    image: '/brand/petwash-logo-official.png',
    service: 'K9000 Self-Wash',
    tagline: 'Smart wash station · open now',
  },
};

/** Preload an image and resolve when ready (or after 3s timeout — never blocks reveal). */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = src;
    // Safety timeout — reveal regardless after 3s
    setTimeout(done, 3000);
  });
}

/** Reveal a match: preload image first, then update state atomically. */
function revealMatch(
  found: ProviderMatch,
  setMatch: (m: ProviderMatch) => void,
  setState: (s: MatchState) => void,
) {
  preloadImage(found.image).then(() => {
    setMatch(found);
    setState('matched');
  });
}

export function useMatchingEngine(mode: 'demo' | 'live', service: ServiceType = 'grooming') {
  const [state, setState] = useState<MatchState>('idle');
  const [match, setMatch] = useState<ProviderMatch | null>(null);

  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const activeRef  = useRef(false); // prevents stale callbacks after unmount/cancel

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState < WebSocket.CLOSING) wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    // Send CANCEL before cleanup (cleanup nulls wsRef)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CANCEL' }));
    }
    cleanup();
    setState('idle');
    setMatch(null);
  }, [cleanup]);

  const start = useCallback(() => {
    cleanup();
    activeRef.current = true;
    setState('searching');
    setMatch(null);

    if (mode === 'demo') {
      const delay = 2200 + Math.random() * 600;
      timerRef.current = setTimeout(() => {
        if (!activeRef.current) return;
        revealMatch(DEMO_MATCHES[service], setMatch, setState);
      }, delay);
      return;
    }

    // Live mode — WebSocket with reconnect
    let attempt = 0;
    const MAX_ATTEMPTS = 3;

    function connect() {
      if (!activeRef.current) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/match`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!activeRef.current) { ws.close(); return; }
        attempt = 0;
        ws.send(JSON.stringify({ type: 'START_SEARCH', service }));
      };

      ws.onmessage = (event) => {
        if (!activeRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'MATCH_FOUND') {
            revealMatch(msg.payload as ProviderMatch, setMatch, setState);
          }
          if (msg.type === 'NO_MATCH') {
            setState('no_match');
          }
        } catch { /* malformed message — ignore */ }
      };

      const retry = () => {
        if (!activeRef.current) return;
        if (attempt < MAX_ATTEMPTS) {
          attempt++;
          const backoff = Math.min(800 * attempt, 3000);
          timerRef.current = setTimeout(connect, backoff);
        } else {
          setState('error');
        }
      };

      ws.onerror = retry;
      ws.onclose = (e) => { if (!e.wasClean) retry(); };
    }

    connect();
  }, [mode, service, cleanup]);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return { state, match, start, cancel };
}
