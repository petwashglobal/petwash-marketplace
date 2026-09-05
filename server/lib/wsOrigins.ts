/**
 * Shared WebSocket origin allowlist.
 *
 * Extracted 2026-09-05 (realtime security lane). `/realtime`
 * (server/websocket.ts) enforced an origin allowlist from day one, but
 * `/ws/match` (server/routes/matching-ws.ts) was created with a bare
 * `new WebSocketServer({ server, path })` and enforced nothing — so the two
 * realtime endpoints on the same http server had opposite policies. Keeping
 * one list here stops them drifting apart again.
 *
 * NOTE: an origin check is NOT authentication. It only stops a page on an
 * unrelated site from opening a socket against us; it is a spam/abuse and
 * cross-site-WebSocket-hijack control. Per-message authorization
 * (verifyWsToken / handleMessagingAuth) is what protects tenant data.
 */

export const WS_ALLOWED_ORIGINS: readonly string[] = [
  'https://petwash.co.il',
  'https://www.petwash.co.il',
  'https://api.petwash.co.il',
  'https://hub.petwash.co.il',
  'https://status.petwash.co.il',
  'https://signinpetwash.web.app', // Firebase Hosting
  'http://localhost:5000',          // Development
  'http://127.0.0.1:5000',          // Development
];

/** Exact protocol+host match. No prefix matching — `petwash.co.il.evil.com` must fail. */
export function isWsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return WS_ALLOWED_ORIGINS.includes(`${url.protocol}//${url.host}`);
  } catch {
    return false;
  }
}
