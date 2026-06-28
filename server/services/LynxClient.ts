/**
 * Nayax Lynx API client — READ-FIRST operational data for the K9000 estate.
 *
 * Lynx (https://lynx.nayax.com, sandbox https://qa-lynx.nayax.com) is Nayax's
 * operator API: machines, devices, inventory (product groups / products /
 * machine planograms / pick lists), and reports. We use it to power station
 * health + CONSUMABLE restocking for the K9000 (shampoo / conditioner / tea-tree)
 * with REAL data instead of estimates, and to generate restock pick lists.
 *
 * AUTH: a per-user Bearer token (Account Settings → Security & Login → User
 * Tokens). The token is a SECRET — it is read from LYNX_USER_TOKEN, never logged,
 * never returned in any health/response payload.
 *
 * GATING (mirrors SumitClient): every call is a safe no-op unless
 * LYNX_ENABLED=true AND LYNX_USER_TOKEN is present. isWired() is the single gate,
 * so this ships DARK and is flipped on only after the token is set in QA.
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
    enabled: (process.env.LYNX_ENABLED || '').trim().toLowerCase() === 'true',
    sandbox,
    operatorId: process.env.LYNX_OPERATOR_ID?.trim() || undefined,
    testMachineId: process.env.LYNX_TEST_MACHINE_ID?.trim() || undefined,
  };
}

/** Wired only when LYNX_ENABLED=true AND a token is present. */
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
  operatorConfigured: boolean;
  testMachineConfigured: boolean;
}

export function health(): LynxHealth {
  const e = readEnv();
  const wired = isWired();
  return {
    wired,
    reason: wired
      ? 'Lynx wired (LYNX_ENABLED=true + token present).'
      : !e.enabled
        ? 'Dark: LYNX_ENABLED is not "true".'
        : 'Dark: LYNX_USER_TOKEN is missing.',
    baseUrl: e.baseUrl,
    sandbox: e.sandbox,
    tokenConfigured: Boolean(e.token),
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

/** Low-level authed request. Returns a structured result; never throws to caller. */
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${e.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${e.token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
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
  } finally {
    clearTimeout(timer);
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

export const LynxClient = {
  isWired,
  health,
  getMachineProducts,
  getDevice,
  generatePickList,
  connectionTest,
};
