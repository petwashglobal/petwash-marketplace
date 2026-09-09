import session from 'express-session';

/**
 * NullSessionStore — express-session store that persists nothing.
 *
 * Why this exists (2026-09-09): the app mounts express-session with the
 * cookie name `pw.sid`, but Firebase Hosting forwards ONLY the `__session`
 * cookie to Cloud Run, so `pw.sid` never comes back and no session is ever
 * read across requests. The only writers (customAuth.requireAuth →
 * session.customerId, adminAuth → session.adminId) exist so that handlers in
 * the SAME request can read them; that still works because `req.session` is
 * a per-request object regardless of the store.
 *
 * Without a store, express-session fell back to MemoryStore and every write
 * created a 7-day-lived session object nobody would ever read — a slow leak
 * per container (prod logs: "MemoryStore is not designed for a production
 * environment"). This store accepts writes and forgets them.
 */
export class NullSessionStore extends session.Store {
  get(_sid: string, callback: (err: any, session?: session.SessionData | null) => void): void {
    callback(null, null);
  }

  set(_sid: string, _session: session.SessionData, callback?: (err?: any) => void): void {
    callback?.();
  }

  destroy(_sid: string, callback?: (err?: any) => void): void {
    callback?.();
  }

  touch(_sid: string, _session: session.SessionData, callback?: () => void): void {
    callback?.();
  }
}
