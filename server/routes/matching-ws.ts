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
import { pool } from '../db';

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

// Real provider lookup — queries DB, sorted by rating descending
async function findBestProvider(service: string, location?: { lat: number; lng: number }): Promise<ProviderMatch | null> {
  try {
    if (service === 'walking') {
      const rows = await pool.query(`
        SELECT walker_id AS id,
               COALESCE(display_name, first_name || ' ' || last_name) AS name,
               COALESCE(average_rating, 0)   AS rating,
               COALESCE(total_reviews, 0)    AS review_count,
               profile_photo_url             AS image,
               city                          AS location_hint
        FROM walker_profiles
        WHERE verification_status = 'verified'
          AND is_accepting_bookings = true
        ORDER BY average_rating DESC NULLS LAST
        LIMIT 1
      `);
      const r = rows.rows[0];
      if (!r) return null;
      return {
        id:          r.id,
        name:        r.name,
        rating:      parseFloat(r.rating),
        reviewCount: parseInt(r.review_count),
        distance:    '— km',
        etaMinutes:  10,
        image:       r.image || '/brand/petwash-logo-official.png',
        service:     'Walking',
        tagline:     'Certified dog walker · GPS tracked',
      };
    }

    if (service === 'grooming') {
      const rows = await pool.query(`
        SELECT id::text,
               COALESCE(display_name, business_name, first_name || ' ' || last_name) AS name,
               COALESCE(average_rating, 0)  AS rating,
               COALESCE(total_reviews, 0)   AS review_count,
               profile_photo_url            AS image,
               city                         AS location_hint
        FROM sitter_profiles
        WHERE verification_status = 'verified'
          AND is_accepting_bookings = true
        ORDER BY average_rating DESC NULLS LAST
        LIMIT 1
      `);
      const r = rows.rows[0];
      if (!r) return null;
      return {
        id:          r.id,
        name:        r.name,
        rating:      parseFloat(r.rating),
        reviewCount: parseInt(r.review_count),
        distance:    '— km',
        etaMinutes:  12,
        image:       r.image || '/brand/petwash-logo-official.png',
        service:     'Grooming',
        tagline:     'Premium grooming · certified',
      };
    }

    if (service === 'k9000') {
      const rows = await pool.query(`
        SELECT station_id  AS id,
               location    AS name,
               4.8         AS rating,
               0           AS review_count,
               NULL        AS image
        FROM k9000_stations
        WHERE is_active = true
        ORDER BY station_id ASC
        LIMIT 1
      `);
      const r = rows.rows[0];
      if (!r) return null;
      return {
        id:          r.id,
        name:        `K9000 — ${r.name}`,
        rating:      4.8,
        reviewCount: parseInt(r.review_count ?? '0'),
        distance:    '— km',
        etaMinutes:  5,
        image:       '/brand/petwash-logo-official.png',
        service:     'K9000 Self-Wash',
        tagline:     'Smart wash station · open now',
      };
    }
  } catch (err: any) {
    logger.error('[MatchingWS] DB provider lookup failed', { service, error: err.message });
  }
  return null;
}

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

          // Real matching: DB lookup (2-3 s perceived delay for UX)
          const location = msg.location as { lat: number; lng: number } | undefined;
          searchTimer = setTimeout(async () => {
            try {
              const match = await findBestProvider(service, location);
              if (match) {
                send(ws, { type: 'MATCH_FOUND', payload: match });
                logger.info('[MatchingWS] Match found', { service, matchId: match.id });
              } else {
                send(ws, { type: 'NO_MATCH' });
                logger.info('[MatchingWS] No providers found', { service });
              }
            } catch (err: any) {
              logger.error('[MatchingWS] Match lookup error', { error: err.message });
              send(ws, { type: 'NO_MATCH' });
            }
          }, 2200);
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
