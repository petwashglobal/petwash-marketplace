/**
 * authJourney — CEO MASTER §B41 §1.2 (2026-08-29).
 *
 * ONE identifier that ties every stage of an authentication attempt
 * together. Generated on the first tap of an auth CTA; carried through:
 *   AUTH_METHOD_SELECTED
 *   → FIREBASE_STARTED
 *   → FIREBASE_SUCCESS / FIREBASE_FAILURE
 *   → SESSION_EXCHANGE_START
 *   → SESSION_EXCHANGE_SUCCESS / _FAILURE
 *   → BOOTSTRAP_SUCCESS / _FAILURE
 *   → POST_LOGIN_SUCCESS / _FAILURE
 *   → NAVIGATION_SUCCESS
 *
 * Purpose: turn "Google sign-in doesn't work" into a specific failure
 * stage the ops dashboard can point at, and let the customer-facing
 * error carry a reference (PW-ERR-<authJourneyId prefix>) that the
 * server can look up.
 *
 * DISCIPLINE
 *   * The id is opaque and non-guessable but not a secret. It travels
 *     in headers + client events. It NEVER carries PII, tokens,
 *     Firebase creds, OTP codes, passwords, bank details, or ID
 *     numbers. CEO §1.2 §B41.
 *   * A session storage key holds the current id + the stage timeline
 *     across an OAuth redirect (Google/Apple redirect flows lose the
 *     JS heap). Cleared once NAVIGATION_SUCCESS fires.
 *   * If sessionStorage is unavailable (private mode, quota) the
 *     helpers stay in-memory only — never throw, never break auth.
 */

const SS_KEY = 'pw_auth_journey';

export type AuthJourneyStage =
  | 'AUTH_PAGE_OPEN'
  | 'AUTH_METHOD_SELECTED'
  | 'FIREBASE_STARTED'
  | 'FIREBASE_POPUP_STARTED'
  | 'FIREBASE_POPUP_SUCCEEDED'
  | 'FIREBASE_POPUP_CANCELLED'
  | 'FIREBASE_POPUP_BLOCKED'
  | 'FIREBASE_REDIRECT_STARTED'
  | 'FIREBASE_REDIRECT_RETURNED'
  | 'FIREBASE_REDIRECT_RESULT_FOUND'
  | 'FIREBASE_REDIRECT_RESULT_MISSING'
  | 'FIREBASE_SUCCESS'
  | 'FIREBASE_FAILURE'
  | 'SESSION_EXCHANGE_START'
  | 'SESSION_EXCHANGE_SUCCESS'
  | 'SESSION_EXCHANGE_FAILURE'
  | 'BOOTSTRAP_SUCCESS'
  | 'BOOTSTRAP_FAILURE'
  | 'POST_LOGIN_SUCCESS'
  | 'POST_LOGIN_FAILURE'
  | 'NAVIGATION_SUCCESS';

export interface AuthJourneyRecord {
  id: string;
  createdAt: number;
  method?: 'google' | 'apple' | 'phone' | 'email' | 'passkey';
  stages: Array<{ stage: AuthJourneyStage; at: number; extra?: Record<string, string | number | boolean> }>;
}

/** Cheap opaque id: 16 hex chars (~64 bits of entropy). */
function makeId(): string {
  const buf = new Uint8Array(8);
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    }
  } catch {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readStore(): AuthJourneyRecord | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return memoryRecord;
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== 'string') return null;
    return parsed as AuthJourneyRecord;
  } catch {
    return memoryRecord;
  }
}

function writeStore(rec: AuthJourneyRecord): void {
  memoryRecord = rec;
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(rec));
  } catch {
    /* private mode / quota — memoryRecord is the fallback */
  }
}

let memoryRecord: AuthJourneyRecord | null = null;

/**
 * Start a new journey (or reuse the current one if a fresh
 * unfinished one exists within the last 20 minutes — covers the
 * OAuth-redirect round-trip). Returns the id.
 */
export function beginAuthJourney(method?: AuthJourneyRecord['method']): string {
  const existing = readStore();
  if (existing && Date.now() - existing.createdAt < 20 * 60 * 1000) {
    if (method) existing.method = method;
    writeStore(existing);
    return existing.id;
  }
  const rec: AuthJourneyRecord = {
    id: makeId(),
    createdAt: Date.now(),
    method,
    stages: [],
  };
  writeStore(rec);
  return rec.id;
}

/** Append a stage. Silently ignores empty/no-op calls. */
export function recordAuthJourneyStage(
  stage: AuthJourneyStage,
  extra?: Record<string, string | number | boolean>,
): void {
  let rec = readStore();
  if (!rec) rec = { id: makeId(), createdAt: Date.now(), stages: [] };
  rec.stages.push({ stage, at: Date.now(), extra });
  writeStore(rec);
}

/** Read the current journey id, or null if none has been started. */
export function currentAuthJourneyId(): string | null {
  return readStore()?.id ?? null;
}

/** Read the whole current journey record. */
export function currentAuthJourney(): AuthJourneyRecord | null {
  return readStore();
}

/**
 * Clear the journey. Call after NAVIGATION_SUCCESS so a subsequent
 * auth attempt starts fresh. Also emits the terminal stage.
 */
export function endAuthJourney(): void {
  try {
    memoryRecord = null;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(SS_KEY);
  } catch {
    /* non-fatal */
  }
}

/**
 * Header value for outbound API requests — includes the journey id
 * and (if known) the auth method. Both non-sensitive.
 */
export function authJourneyHeader(): string | null {
  const rec = readStore();
  if (!rec) return null;
  return rec.method ? `${rec.id};method=${rec.method}` : rec.id;
}

/**
 * Merge the X-Auth-Journey-Id header into a fetch init's headers if
 * a journey is active. Safe to call unconditionally; if there is no
 * journey the init is returned unchanged.
 *
 * Usage:
 *   const res = await fetch(url, withAuthJourneyHeader({
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   }));
 */
export function withAuthJourneyHeader(init: RequestInit = {}): RequestInit {
  const header = authJourneyHeader();
  if (!header) return init;
  const headers = new Headers(init.headers ?? undefined);
  headers.set('X-Auth-Journey-Id', header);
  return { ...init, headers };
}

/** User-visible error reference: PW-ERR-<first 8 chars of the id>. */
export function errorReference(): string {
  const rec = readStore();
  if (!rec) return 'PW-ERR-UNKNOWN';
  return `PW-ERR-${rec.id.slice(0, 8).toUpperCase()}`;
}
