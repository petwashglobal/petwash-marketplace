/**
 * useBookingEvents — real-time booking lifecycle events via WebSocket
 *
 * Subscribes to provider.accepted, provider.arriving, matching.started
 * by extending the /ws/match channel with SUBSCRIBE_BOOKING.
 *
 * Usage:
 *   const { arrivals, acceptedAt } = useBookingEvents(requestId);
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface ProviderArrivingEvent {
  requestId: string;
  providerId: string;
  eta: string | null;
  timestamp: string;
}

export interface ProviderAcceptedEvent {
  requestId: string;
  providerId: string;
  newStatus: string;
  timestamp: string;
}

interface BookingEventsState {
  arriving: ProviderArrivingEvent | null;
  accepted: ProviderAcceptedEvent | null;
  matchingStarted: boolean;
  connected: boolean;
}

export function useBookingEvents(requestId?: string): BookingEventsState {
  const [state, setState] = useState<BookingEventsState>({
    arriving: null,
    accepted: null,
    matchingStarted: false,
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const activeRef = useRef(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState < WebSocket.CLOSING) wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!requestId) return;

    cleanup();
    activeRef.current = true;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/match`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!activeRef.current) { ws.close(); return; }
      setState(s => ({ ...s, connected: true }));
      ws.send(JSON.stringify({ type: 'SUBSCRIBE_BOOKING', requestId }));
    };

    ws.onmessage = (event) => {
      if (!activeRef.current) return;
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'SEARCHING') {
          setState(s => ({ ...s, matchingStarted: true }));
        }

        if (msg.type === 'PROVIDER_ACCEPTED') {
          setState(s => ({
            ...s,
            accepted: {
              requestId: msg.requestId,
              providerId: msg.providerId,
              newStatus: msg.newStatus,
              timestamp: msg.timestamp ?? new Date().toISOString(),
            },
          }));
        }

        if (msg.type === 'PROVIDER_ARRIVING') {
          setState(s => ({
            ...s,
            arriving: {
              requestId: msg.requestId,
              providerId: msg.providerId,
              eta: msg.eta ?? null,
              timestamp: msg.timestamp ?? new Date().toISOString(),
            },
          }));
        }
      } catch { /* malformed — ignore */ }
    };

    ws.onclose = () => {
      if (!activeRef.current) return;
      setState(s => ({ ...s, connected: false }));
    };

    return cleanup;
  }, [requestId, cleanup]);

  return state;
}
