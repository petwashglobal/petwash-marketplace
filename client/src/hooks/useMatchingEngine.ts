/**
 * useMatchingEngine — Provider matching state machine
 *
 * Demo mode: scripted simulation, no backend required.
 * Live mode:  WebSocket connection to /ws/match.
 *
 * Usage:
 *   const { state, match, start, cancel } = useMatchingEngine("demo", "grooming");
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type MatchState = 'idle' | 'searching' | 'matched' | 'no_match';
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

export function useMatchingEngine(mode: 'demo' | 'live', service: ServiceType = 'grooming') {
  const [state, setState] = useState<MatchState>('idle');
  const [match, setMatch] = useState<ProviderMatch | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  }, []);

  const cancel = useCallback(() => {
    cleanup();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CANCEL' }));
    }
    setState('idle');
    setMatch(null);
  }, [cleanup]);

  const start = useCallback(() => {
    cleanup();
    setState('searching');
    setMatch(null);

    if (mode === 'demo') {
      const delay = 2000 + Math.random() * 600;
      timerRef.current = setTimeout(() => {
        const found = DEMO_MATCHES[service];
        setMatch(found);
        setState('matched');
      }, delay);
      return;
    }

    // Live mode — WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/match`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'START_SEARCH', service }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'MATCH_FOUND') {
          setMatch(msg.payload);
          setState('matched');
        }
        if (msg.type === 'NO_MATCH') {
          setState('no_match');
        }
      } catch {}
    };

    ws.onerror = () => {
      setState('no_match');
    };
  }, [mode, service, cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { state, match, start, cancel };
}
