/**
 * Nayax Lynx API client — READ-FIRST operational data for the K9000 estate.
 *
 * Lynx (https://lynx.nayax.com, sandbox https://qa-lynx.nayax.com) is Nayax's
 * operator API: machines, devices, inventory (product groups / products /
 * machine planograms / pick lists), and reports. We use it to power station
 * health + CONSUMABLE restocking for the K9000 (shampoo / conditioner / tea-tree)
 * with REAL data instead of estimates, and to generate restock pick lists.
 *
 * AUTH — two modes, whichever is configured (token preferred):
 *   1. Bearer token (LYNX_USER_TOKEN) — a per-user API token from Account Settings
 *      → Security & Login → User Tokens. Cleanest, but must be created by Nayax.
 *   2. Login session (LYNX_USERNAME + LYNX_PASSWORD) — when no API token exists, we
 *      POST /operational/v1/signin to get a ~24h session cookie and reuse it,
 *      re-signing in automatically when it expires or a call returns 401. This lets
 *      the estate connect with the operator's own login when no scoped token is
 *      available. Credentials are SECRETS — read from env, never logged/returned.
 *
 * GATING (mirrors SumitClient): every call is a safe no-op unless LYNX_ENABLED=true
 * AND at least one auth mode is configured (token OR username+password). isWired()
 * is the single gate, so this ships DARK until credentials are set in QA.
 *
 * SCOPE: this client is READ + restock-ops only (machine products, device status,
 * reports, generate pick list). It NEVER touches customer money, balances,
 * refunds, payouts, or the wash redemption ledger — those stay in the audited
 * money services. Pick-list generation is an inventory/logistics action, not a
 * financial one.
 */
import { logger } from '../lib/logger';

const DEFAULT_TIMEOUT_MS = 12_000;

export interface LynxConfig {
  baseUrl: string;
  token?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  sandbox: boolean;
  operatorId?: string;
  testMachineId?: string;
}

function readEnv(): LynxConfig {
  // Sandbox is the default. Only the explicit string 'false' opts into prod.
  const sandbox = (process.env.LYNX_SANDBOX || '').trim().toLowerCase() !== 'false';
  const baseUrl =
    process.env.LYNX_BASE_URL?.trim() ||
    (sandbox ? 'https://qa-lynx.nayax.com' : 'https://lynx.nayax.com');
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token: process.env.LYNX_USER_TOKEN?.trim() || undefined,
    username: process.env.LYNX_USERNAME?.trim() || undefined,
    password: process.env.LYNX_PASSWORD || undefined,   // no trim — passwords may have edge whitespace
    enabled: (process.env.LYNX_ENABLED || '').trim().toLowerCase() === 'true',
    sandbox,
    operatorId: process.env.LYNX_OPERATOR_ID?.trim() || undefined,
    testMachineId: process.env.LYNX_TEST_MACHINE_ID?.trim() || undefined,
  };
}

/** True when credentials (username+password) are the configured auth mode. */
function hasCredentials(e: LynxConfig): boolean {
  return Boolean(e.username) && Boolean(e.password);
}

/** Wired ONLY when LYNX_ENABLED=true AND a real Bearer USER TOKEN is set.
 *  Username/password (operator login) is NOT a valid Lynx API auth method: the
 *  Lynx API is Bearer-token-only. Proven 2026-07-07 — POST /operational/v1/signin
 *  returns HTTP 500 with our creds, and Nayax's Security doc requires a User Token
 *  in the Authorization header. So credentials alone must NOT report "wired" — that
 *  was a false green. See memory lynx-auth-needs-user-token-2026-07-07. */
function isWired(): boolean {
  const e = readEnv();
  return e.enabled && Boolean(e.token);
}

export interface LynxHealth {
  wired: boolean;
  reason: string;
  baseUrl: string;
  sandbox: boolean;
  tokenConfigured: boolean;        // boolean only — never the token itself
  loginConfigured: boolean;        // username+password present (session mode)
  authMode: 'token' | 'login' | 'none';
  operatorConfigured: boolean;
  testMachineConfigured: boolean;
}

export function health(): LynxHealth {
  const e = readEnv();
  const wired = isWired();
  const authMode: 'token' | 'login' | 'none' = e.token ? 'token' : (hasCredentials(e) ? 'login' : 'none');
  return {
    wired,
    reason: wired
      ? 'Lynx wired (LYNX_ENABLED=true, Bearer User Token set).'
      : !e.enabled
        ? 'Dark: LYNX_ENABLED is not "true".'
        : hasCredentials(e)
          ? 'Dark: username/password is NOT a valid Lynx API auth method (Bearer-token-only). Set LYNX_USER_TOKEN — the API User Token from Nayax Core → Account Settings → Security & Login → User Tokens.'
          : 'Dark: set LYNX_USER_TOKEN (the API User Token from Nayax Core → Security & Login → User Tokens).',
    baseUrl: e.baseUrl,
    sandbox: e.sandbox,
    tokenConfigured: Boolean(e.token),
    loginConfigured: hasCredentials(e),
    authMode,
    operatorConfigured: Boolean(e.operatorId),
    testMachineConfigured: Boolean(e.testMachineId),
  };
}

export interface LynxResult<T = unknown> {
  ok: boolean;
  status: number;             // HTTP status (0 = not attempted / network)
  wired: boolean;
  data?: T;
  error?: string;
  endpoint: string;
}

// ── Login-session cache (mode 2) ──────────────────────────────────────────────
// When authenticating by login, POST /signin returns ~24h session cookies. We
// cache the cookie string in-process and refresh a little early, or on any 401.
let sessionCookie: string | null = null;
let sessionExpiresAt = 0;

/** Sign in with the operator login and cache the session cookie. Never logs creds. */
async function signInForSession(e: LynxConfig): Promise<boolean> {
  if (!hasCredentials(e)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${e.baseUrl}/operational/v1/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usr: e.username, pwd: e.password }),
      signal: controller.signal,
    });
    if (!res.ok) { logger.warn('[Lynx] signin non-2xx', { status: res.status }); return false; }
    // Collect Set-Cookie header(s) and keep only the name=value part of each.
    const raw: string[] = typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie()
      : [res.headers.get('set-cookie')].filter((v): v is string => Boolean(v));
    const pairs = raw.map((c) => c.split(';')[0]).filter(Boolean);
    if (!pairs.length) { logger.warn('[Lynx] signin ok but no session cookie returned'); return false; }
    sessionCookie = pairs.join('; ');
    sessionExpiresAt = Date.now() + 20 * 60 * 60 * 1000; // refresh ~4h before the ~24h expiry
    logger.info('[Lynx] session established via operator login');
    return true;
  } catch (err: any) {
    logger.error('[Lynx] signin failed', { err: err?.message });
    return false;
  } finally { clearTimeout(timer); }
}

/** Ensure a valid session cookie exists (login mode). */
async function ensureSession(e: LynxConfig): Promise<boolean> {
  if (sessionCookie && Date.now() < sessionExpiresAt) return true;
  return signInForSession(e);
}

/** Low-level authed request. Uses Bearer token if set, else a login session.
 *  Returns a structured result; never throws to caller. */
async function request<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<LynxResult<T>> {
  const e = readEnv();
  const endpoint = `${method} ${path}`;
  if (!isWired()) {
    return { ok: false, status: 0, wired: false, error: 'lynx_not_wired', endpoint };
  }
  const usingToken = Boolean(e.token);
  if (!usingToken && !(await ensureSession(e))) {
    return { ok: false, status: 401, wired: true, error: 'lynx_login_failed', endpoint };
  }

  const doFetch = (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    return fetch(`${e.baseUrl}${path}`, {
      method,
      headers: {
        ...(usingToken ? { Authorization: `Bearer ${e.token}` } : { Cookie: sessionCookie! }),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  };

  try {
    let res = await doFetch();
    // Login mode: a 401 usually means the session expired — re-login once and retry.
    if (res.status === 401 && !usingToken) {
      sessionCookie = null;
      if (await ensureSession(e)) res = await doFetch();
    }
    // Some Lynx endpoints return an empty body on success (documented pitfall).
    const text = await res.text();
    let data: T | undefined;
    if (text) { try { data = JSON.parse(text) as T; } catch { /* non-JSON body */ } }
    if (!res.ok) {
      logger.warn('[Lynx] non-2xx', { endpoint, status: res.status });
      return { ok: false, status: res.status, wired: true, error: `http_${res.status}`, endpoint, data };
    }
    return { ok: true, status: res.status, wired: true, data, endpoint };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    logger.error('[Lynx] request failed', { endpoint, aborted, err: err?.message });
    return { ok: false, status: 0, wired: true, error: aborted ? 'timeout' : (err?.message || 'network_error'), endpoint };
  }
}

// ── READ: machine planogram / consumable stock ───────────────────────────────
/** GET a machine's product map (planogram + stock fields like MissingStockByMDB). */
export function getMachineProducts(machineId: string): Promise<LynxResult> {
  return request('GET', `/operational/v1/machines/${encodeURIComponent(machineId)}/machineProducts`);
}

// ── READ: device status / live station health ────────────────────────────────
/** GET a device's status (StatusID / LastUpdated) — drives the station monitor. */
export function getDevice(deviceId: string): Promise<LynxResult> {
  return request('GET', `/operational/v1/devices/${encodeURIComponent(deviceId)}`);
}

// ── READ: the current user's actor hierarchy (discovers the operator ActorID) ─
/** GET the signed-in user's actor hierarchy — used to auto-discover the operator
 *  ActorID that issues cards, so LYNX_OPERATOR_ID need not be set by hand. */
export function getActorHierarchy(): Promise<LynxResult> {
  return request('GET', '/operational/v1/actors/hierarchy');
}

// ── OPS: generate a restock pick list for a machine (inventory action) ────────
/** POST a pick-list generation for a machine. Inventory/logistics, NOT money. */
export function generatePickList(machineId: string): Promise<LynxResult> {
  return request('POST', `/operational/v1/machines/${encodeURIComponent(machineId)}/pickLists`);
}

/**
 * Connection test — proves the token + base URL work end to end.
 * If LYNX_TEST_MACHINE_ID is set, does a real authed GET of its products;
 * otherwise reports wired status only (no machine to probe).
 */
export async function connectionTest(): Promise<LynxResult & { sandbox: boolean }> {
  const e = readEnv();
  if (!isWired()) {
    return { ok: false, status: 0, wired: false, error: 'lynx_not_wired', endpoint: 'connectionTest', sandbox: e.sandbox };
  }
  if (!e.testMachineId) {
    return { ok: true, status: 0, wired: true, endpoint: 'connectionTest', sandbox: e.sandbox,
      data: { note: 'wired; set LYNX_TEST_MACHINE_ID to run a live authed probe' } };
  }
  const r = await getMachineProducts(e.testMachineId);
  return { ...r, sandbox: e.sandbox };
}

// Expose the authed low-level request + wiring gate so money-adjacent services
// (LynxCardService) reuse the exact same token/login-session auth.
export { request as lynxRequest, isWired as lynxIsWired };

export const LynxClient = {
  isWired,
  health,
  getMachineProducts,
  getDevice,
  getActorHierarchy,
  generatePickList,
  connectionTest,
};
