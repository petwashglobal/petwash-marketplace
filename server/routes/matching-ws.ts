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
import type { Server, IncomingMessage } from 'http';
import { logger } from '../lib/logger';
import { pool, db } from '../db';
import { eventBus } from '../services/EventBus';
import { verifySessionCookie, SESSION_COOKIE_NAME } from '../lib/sessionCookies';
import { isSuperAdmin } from '../middleware/rbac';
import { bookingRequests } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Per-socket identity attached by verifyClient. Never trust client-supplied
// uid/email — this object is set from the verified Firebase session cookie
// on the WS upgrade, before any message is processed.
type AuthedSocket = WebSocket & {
  uid?: string;
  email?: string;
  emailVerified?: boolean;
};

function parseSessionCookieFromHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

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
        SELECT id::text,
               name,
               COALESCE(ranking_score, 0)  AS ranking_score,
               COALESCE(total_washes, 0)   AS total_washes,
               photo_urls
        FROM stations
        WHERE is_active = true
          AND status NOT IN ('offline','maintenance')
        ORDER BY ranking_score DESC NULLS LAST, total_washes DESC NULLS LAST
        LIMIT 1
      `);
      const r = rows.rows[0];
      if (!r) return null;
      const rawRanking = parseFloat(r.ranking_score ?? '0');
      const rating = rawRanking > 0
        ? Math.min(5, Math.max(1, parseFloat((rawRanking / 20).toFixed(1))))
        : 4.5;
      const photos: string[] = Array.isArray(r.photo_urls) ? r.photo_urls : [];
      return {
        id:          r.id,
        name:        `K9000 — ${r.name}`,
        rating,
        reviewCount: parseInt(r.total_washes ?? '0'),
        distance:    '— km',
        etaMinutes:  5,
        image:       photos[0] || '/brand/petwash-logo-official.png',
        service:     'K9000 Self-Wash',
        tagline:     'Smart wash station · open now',
      };
    }
  } catch (err: any) {
    logger.error('[MatchingWS] DB provider lookup failed', { service, error: err.message });
  }
  return null;
}

// ── Booking event subscriptions ────────────────────────────────────────────
// Map: requestId → Set of connected WebSocket clients watching that booking
const bookingWatchers = new Map<string, Set<WebSocket>>();
// Admin clients that receive all marketplace events
const adminWatchers = new Set<WebSocket>();

function addWatcher(requestId: string, ws: WebSocket) {
  if (!bookingWatchers.has(requestId)) {
    bookingWatchers.set(requestId, new Set());
  }
  bookingWatchers.get(requestId)!.add(ws);
}

function removeWatcher(requestId: string, ws: WebSocket) {
  bookingWatchers.get(requestId)?.delete(ws);
  if (bookingWatchers.get(requestId)?.size === 0) {
    bookingWatchers.delete(requestId);
  }
}

function broadcastToWatchers(requestId: string, data: object) {
  const watchers = bookingWatchers.get(requestId);
  if (!watchers) return;
  for (const ws of watchers) send(ws, data);
}

function broadcastToAdmins(data: object) {
  for (const ws of adminWatchers) send(ws, data);
}

// Subscribe to EventBus intelligence events and forward to watching clients
function wireBookingEventForwarding() {
  eventBus.subscribe('provider.accepted', (event) => {
    const requestId = event.data?.requestId as string | undefined;
    const payload = {
      type: 'PROVIDER_ACCEPTED',
      requestId,
      providerId:  event.data?.providerId,
      ownerId:     event.data?.ownerId,
      newStatus:   event.data?.newStatus,
      serviceType: event.data?.serviceType,
      timestamp:   event.timestamp,
    };
    if (requestId) {
      broadcastToWatchers(requestId, payload);
      logger.info('[MatchingWS] Forwarded provider.accepted', { requestId });
    }
    broadcastToAdmins(payload);
  });

  eventBus.subscribe('provider.arriving', (event) => {
    const requestId = event.data?.requestId as string | undefined;
    const payload = {
      type: 'PROVIDER_ARRIVING',
      requestId,
      providerId:  event.data?.providerId,
      ownerId:     event.data?.ownerId,
      eta:         event.data?.eta ?? null,
      serviceType: event.data?.serviceType,
      timestamp:   event.timestamp,
    };
    if (requestId) {
      broadcastToWatchers(requestId, payload);
      logger.info('[MatchingWS] Forwarded provider.arriving', { requestId });
    }
    broadcastToAdmins(payload);
  });

  eventBus.subscribe('matching.started', (event) => {
    const payload = {
      type: 'MATCHING_STARTED',
      serviceType:     event.data?.serviceType,
      totalCandidates: event.data?.totalCandidates ?? 0,
      timestamp:       event.timestamp,
    };
    broadcastToAdmins(payload);
  });
}

export function setupMatchingWebSocket(server: Server): void {
  // AUTH (LANE E CONFIRMED P0 / CEO 2026-08-17): the WebSocket handshake now
  // requires a valid pw_session HttpOnly cookie. verifyClient runs on the
  // Upgrade request BEFORE `connection` fires; a missing / invalid session
  // returns 401 and the socket never opens. The verified uid+email are
  // attached to the socket for downstream authorization (SUBSCRIBE_ADMIN,
  // SUBSCRIBE_BOOKING) — those message handlers now check the socket's
  // identity, not the client-supplied one.
  //
  // Rationale: previously any internet caller could open ws://…/ws/match,
  // send { type: "SUBSCRIBE_ADMIN" }, and receive the admin live event feed
  // (provider.accepted, provider.arriving, matching.started with real
  // requestId / providerId / ownerId payloads). SUBSCRIBE_BOOKING was
  // similarly wide open — any requestId string received the booking's live
  // events. Both are cross-tenant PII leaks.
  const wss = new WebSocketServer({
    server,
    path: '/ws/match',
    verifyClient: async (info: { req: IncomingMessage }, cb: (ok: boolean, code?: number, message?: string) => void) => {
      try {
        const cookie = parseSessionCookieFromHeader(info.req.headers.cookie);
        if (!cookie) return cb(false, 401, 'Unauthorized');
        const decoded = await verifySessionCookie(cookie, true);
        // Stash on req; picked up in `connection` handler below.
        (info.req as any)._pwAuth = {
          uid: decoded.uid,
          email: (decoded.email || '').toLowerCase(),
          emailVerified: decoded.email_verified === true,
        };
        cb(true);
      } catch (err) {
        logger.warn('[MatchingWS] Rejected unauthenticated WS upgrade');
        cb(false, 401, 'Unauthorized');
      }
    },
  });

  // Wire EventBus → WS forwarding once
  wireBookingEventForwarding();

  wss.on('connection', (wsRaw: WebSocket, req) => {
    const ws = wsRaw as AuthedSocket;
    const auth = (req as any)._pwAuth as { uid: string; email: string; emailVerified: boolean } | undefined;
    // Belt-and-braces: if verifyClient didn't run for some reason, close now.
    if (!auth?.uid) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    ws.uid = auth.uid;
    ws.email = auth.email;
    ws.emailVerified = auth.emailVerified;

    const ip = req.socket.remoteAddress;
    logger.info('[MatchingWS] Client connected', { ip, uid: auth.uid });

    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    let subscribedBookings: string[] = [];

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

        // ── Booking event subscription (intelligence layer) ──────────────────
        // AUTHZ: the socket may subscribe to a booking's live events only
        // if it is a party to that booking (customerId==uid OR providerId==uid).
        // Verified super-admins may subscribe to any booking. Anyone else
        // gets a FORBIDDEN response and no watcher added — closing the
        // pre-fix cross-tenant leak.
        if (msg.type === 'SUBSCRIBE_BOOKING') {
          const requestId = msg.requestId as string;
          if (!requestId || subscribedBookings.includes(requestId)) return;
          (async () => {
            const isAdmin = !!ws.uid && !!ws.email && ws.emailVerified === true && isSuperAdmin(ws.email);
            let party = false;
            if (!isAdmin) {
              try {
                const [row] = await db
                  .select({ ownerId: bookingRequests.ownerId, providerId: bookingRequests.providerId })
                  .from(bookingRequests)
                  .where(eq(bookingRequests.requestId, requestId))
                  .limit(1);
                if (row && (row.ownerId === ws.uid || row.providerId === ws.uid)) party = true;
              } catch (err: any) {
                logger.warn('[MatchingWS] booking party lookup failed', { requestId, error: err.message });
              }
            }
            if (!isAdmin && !party) {
              send(ws, { type: 'FORBIDDEN', requestId });
              logger.warn('[MatchingWS] Rejected SUBSCRIBE_BOOKING — not party', { requestId, uid: ws.uid });
              return;
            }
            subscribedBookings.push(requestId);
            addWatcher(requestId, ws);
            send(ws, { type: 'SUBSCRIBED', requestId });
            logger.info('[MatchingWS] Client subscribed to booking', { requestId, uid: ws.uid, viaAdmin: isAdmin });
          })().catch((err) => logger.error('[MatchingWS] SUBSCRIBE_BOOKING handler error', { error: err.message }));
        }

        if (msg.type === 'UNSUBSCRIBE_BOOKING') {
          const requestId = msg.requestId as string;
          if (requestId) {
            removeWatcher(requestId, ws);
            subscribedBookings = subscribedBookings.filter(id => id !== requestId);
          }
        }

        // ── Admin live feed subscription ──────────────────────────────────
        // AUTHZ: only VERIFIED super-admins (SUPER_ADMIN_EMAILS +
        // email_verified) receive the cross-marketplace event stream.
        // Every other authenticated user is rejected. Was fully open before.
        if (msg.type === 'SUBSCRIBE_ADMIN') {
          const isAdmin = !!ws.email && ws.emailVerified === true && isSuperAdmin(ws.email);
          if (!isAdmin) {
            send(ws, { type: 'FORBIDDEN', scope: 'admin' });
            logger.warn('[MatchingWS] Rejected SUBSCRIBE_ADMIN — not super-admin', { uid: ws.uid, email: ws.email });
            return;
          }
          adminWatchers.add(ws);
          send(ws, { type: 'SUBSCRIBED', scope: 'admin' });
          logger.info('[MatchingWS] Admin subscribed to live event feed', { uid: ws.uid });
        }
      } catch (err) {
        logger.warn('[MatchingWS] Bad message', { raw: raw.toString() });
      }
    });

    ws.on('close', () => {
      if (searchTimer) clearTimeout(searchTimer);
      for (const id of subscribedBookings) removeWatcher(id, ws);
      adminWatchers.delete(ws);
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
