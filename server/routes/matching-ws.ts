/**
 * PROVIDER MATCHING — WebSocket Server
 *
 * Handles real-time provider match events for the luxury matching flow.
 *
 * Protocol:
 *   Client → { type: "START_SEARCH", service: "grooming"|"walking"|"k9000", location?: {lat,lng} }
 *   Server → { type: "SEARCHING" }
 *   Server → { type: "MATCH_FOUND", payload: ProviderMatch }
 *   Server → { type: "NO_MATCH" }
 *   Client → { type: "CANCEL" }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../lib/logger';

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

const DEMO_PROVIDERS: Record<string, ProviderMatch[]> = {
  grooming: [
    {
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
  ],
  walking: [
    {
      id: 'w1',
      name: 'Tal Ben-David',
      rating: 5.0,
      reviewCount: 178,
      distance: '0.2 km',
      etaMinutes: 5,
      image: '/brand/petwash-logo-official.png',
      service: 'Walking',
      tagline: 'Certified dog walker · GPS tracked',
    },
  ],
  k9000: [
    {
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
  ],
};

export function setupMatchingWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/match' });

  wss.on('connection', (ws: WebSocket, req) => {
    const ip = req.socket.remoteAddress;
    logger.info('[MatchingWS] Client connected', { ip });

    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'START_SEARCH') {
          const service: string = msg.service || 'grooming';
          logger.info('[MatchingWS] Search started', { service });

          send(ws, { type: 'SEARCHING', service });

          // Simulate real matching delay (2–3 s)
          const delay = 2000 + Math.random() * 800;
          searchTimer = setTimeout(() => {
            const pool = DEMO_PROVIDERS[service] ?? DEMO_PROVIDERS.grooming;
            const match = pool[Math.floor(Math.random() * pool.length)];

            if (match) {
              send(ws, { type: 'MATCH_FOUND', payload: match });
              logger.info('[MatchingWS] Match found', { service, matchId: match.id });
            } else {
              send(ws, { type: 'NO_MATCH' });
            }
          }, delay);
        }

        if (msg.type === 'CANCEL') {
          if (searchTimer) clearTimeout(searchTimer);
          logger.info('[MatchingWS] Search cancelled');
        }
      } catch (err) {
        logger.warn('[MatchingWS] Bad message', { raw: raw.toString() });
      }
    });

    ws.on('close', () => {
      if (searchTimer) clearTimeout(searchTimer);
      logger.info('[MatchingWS] Client disconnected');
    });

    ws.on('error', (err) => {
      logger.error('[MatchingWS] Socket error', { error: err.message });
    });
  });

  logger.info('[MatchingWS] WebSocket server ready at /ws/match');
}

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
