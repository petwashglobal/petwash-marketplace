/**
 * attribution — CEO MASTER §A5 §4.1 §4.2 §4.3 (2026-08-29).
 *
 * Marketing / acquisition attribution — first touch AND last touch.
 * Written to localStorage on any visit that carries UTM / campaign /
 * referrer signals; preserved through OAuth redirects; reconciled
 * with the server once the user has a canonical PetWash session.
 *
 * DISCIPLINE
 *   * `firstTouch` is IMMUTABLE after the first write. A second visit
 *     with different UTMs updates `lastTouch` only. CEO §4.1.
 *   * NEVER stored — email, phone, password, OTP, ID number, bank
 *     details, Firebase token. Only the marketing signals below.
 *   * Empty / hostile values are ignored silently.
 *   * Length capped per field so a hostile referrer cannot fill
 *     localStorage.
 */

const LS_KEY = 'pw_touch_attribution';

export interface AttributionRecord {
  firstTouch: AttributionTouch | null;
  lastTouch: AttributionTouch | null;
}

export interface AttributionTouch {
  timestamp: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  campaignId?: string;
  referrer?: string;
  landingPath?: string;
}

const KEYS_TO_KEEP = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'campaignId', 'referrer', 'landingPath',
] as const;

function sanitizeString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.length === 0 || t.length > 512) return undefined;
  return t;
}

function readStore(): AttributionRecord {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return { firstTouch: null, lastTouch: null };
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { firstTouch: null, lastTouch: null };
    const parsed = JSON.parse(raw);
    return {
      firstTouch: parsed?.firstTouch ?? null,
      lastTouch: parsed?.lastTouch ?? null,
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}

function writeStore(rec: AttributionRecord): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(rec));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

/**
 * Build an AttributionTouch from a URL search string (usually
 * window.location.search) plus optional referrer + landingPath. All
 * fields sanitized + length-capped. Returns null if nothing usable
 * was extracted.
 */
export function buildTouchFromUrl(
  search: string | URLSearchParams | null | undefined,
  referrer?: string,
  landingPath?: string,
): AttributionTouch | null {
  if (!search) search = '';
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams((search as string).startsWith('?') ? (search as string).slice(1) : (search as string));
  const t: AttributionTouch = { timestamp: Date.now() };
  let seen = false;
  for (const k of KEYS_TO_KEEP) {
    if (k === 'referrer' || k === 'landingPath') continue;
    const v = sanitizeString(params.get(k));
    if (v) {
      t[k] = v;
      seen = true;
    }
  }
  const r = sanitizeString(referrer);
  if (r) { t.referrer = r; seen = true; }
  const p = sanitizeString(landingPath);
  if (p) { t.landingPath = p; }
  return seen ? t : null;
}

/**
 * Record a touch. `firstTouch` is written ONCE (subsequent calls do
 * not overwrite it). `lastTouch` is always updated. Silently no-op
 * if the touch is empty.
 */
export function recordTouch(touch: AttributionTouch | null): void {
  if (!touch) return;
  const store = readStore();
  if (!store.firstTouch) store.firstTouch = touch;
  store.lastTouch = touch;
  writeStore(store);
}

/** Convenience — read the current record. */
export function readAttribution(): AttributionRecord {
  return readStore();
}

/** For the sign-in bounce — encode the current touch as URL search params. */
export function currentTouchAsSearchParams(): URLSearchParams {
  const store = readStore();
  const t = store.lastTouch ?? store.firstTouch;
  const out = new URLSearchParams();
  if (!t) return out;
  for (const k of KEYS_TO_KEEP) {
    if (k === 'landingPath') continue;
    const v = t[k as keyof AttributionTouch];
    if (typeof v === 'string' && v.length > 0) out.set(k, v);
  }
  return out;
}

/**
 * Called on app init. Reads window.location.search + document.referrer
 * and records the current touch if anything usable is present.
 */
export function captureInitialTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    const touch = buildTouchFromUrl(
      window.location.search,
      typeof document !== 'undefined' ? document.referrer : undefined,
      window.location.pathname,
    );
    recordTouch(touch);
  } catch {
    /* non-fatal */
  }
}
