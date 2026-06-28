/**
 * Nayax Cortina StaticQR — OUTBOUND Start call (we → Nayax).
 *
 * When a pre-paid customer scans the bay's on-screen QR (or enters the machine
 * number) in the app, OUR backend calls Nayax's StaticQR Start to wake the device
 * and open a vending session. Nayax then calls our inbound /sale|/settlement|/void
 * callbacks (server/routes/nayax-cortina.ts) to authorise + settle against the
 * customer's pre-paid balance — the card is never charged.
 *
 *   POST {base}/payment/v2/transactions/cortina/{integratorName}/start
 *   body: AppUserID, (TerminalId | UniQR), TransactionId(>=8), SecretToken(64), Balance, Products?
 *   resp: { Status: { Verdict: 'Approved'|'Declined', Code?, StatusMessage } }
 *
 * Source: Nayax dev portal → Cortina → StaticQR → Start (verified). The SecretToken
 * is sent PLAINTEXT here (the AES handshake in server/lib/cortinaStartSession.ts is
 * the SEPARATE Start Session security layer, used only if Nayax enables it).
 *
 * GATING (mirrors SumitClient/LynxClient): a safe no-op unless
 * NAYAX_CORTINA_ENABLED=true AND the integrator name + 64-char SecretToken are set.
 * Ships DARK. The SecretToken is read from env and NEVER logged or returned.
 *
 * MONEY NOTE: Start only WAKES the device + opens the session — it moves NO money.
 * The debit happens later, exactly-once, in the inbound /settlement handler via the
 * audited authorizeRedemption path. This client never touches the ledger.
 */
import { logger } from '../lib/logger';

const DEFAULT_TIMEOUT_MS = 12_000;

export interface CortinaConfig {
  enabled: boolean;
  baseUrl: string;
  integratorName?: string;
  secretToken?: string;
  sandbox: boolean;
}

function readEnv(): CortinaConfig {
  const sandbox = (process.env.NAYAX_CORTINA_SANDBOX || '').trim().toLowerCase() !== 'false';
  const baseUrl =
    process.env.NAYAX_CORTINA_BASE_URL?.trim() ||
    (sandbox ? 'https://qa-lynx.nayax.com' : 'https://lynx.nayax.com');
  return {
    enabled: (process.env.NAYAX_CORTINA_ENABLED || '').trim().toLowerCase() === 'true',
    baseUrl: baseUrl.replace(/\/+$/, ''),
    integratorName: process.env.NAYAX_CORTINA_INTEGRATOR_NAME?.trim() || undefined,
    secretToken: process.env.NAYAX_CORTINA_SECRET_TOKEN?.trim() || undefined,
    sandbox,
  };
}

/** Wired only when enabled AND integrator name + a 64-char secret token are present. */
function isWired(): boolean {
  const e = readEnv();
  return e.enabled && Boolean(e.integratorName) && (e.secretToken?.length ?? 0) >= 32;
}

export interface CortinaHealth {
  wired: boolean;
  reason: string;
  baseUrl: string;
  sandbox: boolean;
  integratorConfigured: boolean;
  secretConfigured: boolean;        // boolean only — never the token
}

export function health(): CortinaHealth {
  const e = readEnv();
  const wired = isWired();
  return {
    wired,
    reason: wired
      ? 'Cortina Start wired (enabled + integrator + token).'
      : !e.enabled ? 'Dark: NAYAX_CORTINA_ENABLED is not "true".'
      : !e.integratorName ? 'Dark: NAYAX_CORTINA_INTEGRATOR_NAME missing.'
      : 'Dark: NAYAX_CORTINA_SECRET_TOKEN missing/short.',
    baseUrl: e.baseUrl,
    sandbox: e.sandbox,
    integratorConfigured: Boolean(e.integratorName),
    secretConfigured: Boolean(e.secretToken),
  };
}

export interface StartProduct {
  Code?: number;            // MDB/Marshall product code (Remote Vend)
  PulseLineNumber?: number; // Pulse machines
  Name?: string;
  Price?: number;
}
export interface StartParams {
  appUserId: string;        // our customer id (<=40)
  transactionId: string;    // our id, echoed everywhere (>=8 chars)
  balance: number;          // the customer's pre-paid balance (decimal, <=3dp)
  terminalId?: string;      // the bay device HW-serial — TerminalId OR uniQr required
  uniQr?: string;
  products?: StartProduct[]; // optional (Remote Vend / PreSelection)
}

export interface StartResult {
  ok: boolean;              // true only when Verdict === 'Approved'
  wired: boolean;
  httpStatus: number;       // 0 = not attempted
  verdict?: 'Approved' | 'Declined' | string;
  code?: number;            // decline code if any
  message?: string;
  error?: string;
}

/** Build the verified Start request body. Exposed for unit tests (no secret in tests). */
export function buildStartBody(p: StartParams, secretToken: string) {
  const body: Record<string, unknown> = {
    AppUserID: String(p.appUserId).slice(0, 40),
    TransactionId: p.transactionId,
    SecretToken: secretToken,
    Balance: p.balance,
  };
  if (p.terminalId) body.TerminalId = p.terminalId;
  else if (p.uniQr) body.UniQR = p.uniQr;
  if (p.products?.length) body.Products = p.products;
  return body;
}

/**
 * Call Nayax StaticQR Start to wake the device + open the session.
 * Safe no-op (httpStatus 0) while unwired. Never logs the SecretToken.
 */
export async function startStaticQr(p: StartParams): Promise<StartResult> {
  const e = readEnv();
  if (!isWired()) return { ok: false, wired: false, httpStatus: 0, error: 'cortina_not_wired' };
  if (!p.transactionId || p.transactionId.length < 8) {
    return { ok: false, wired: true, httpStatus: 0, error: 'transaction_id_too_short' };
  }
  if (!p.terminalId && !p.uniQr) {
    return { ok: false, wired: true, httpStatus: 0, error: 'terminal_or_uniqr_required' };
  }

  const url = `${e.baseUrl}/payment/v2/transactions/cortina/${encodeURIComponent(e.integratorName!)}/start`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildStartBody(p, e.secretToken!)),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any;
    if (text) { try { data = JSON.parse(text); } catch { /* non-JSON */ } }
    const verdict = data?.Status?.Verdict;
    const ok = res.ok && verdict === 'Approved';
    if (!ok) {
      logger.warn('[Cortina/Start] not approved', { httpStatus: res.status, verdict, code: data?.Status?.Code, txn: p.transactionId });
    }
    return {
      ok, wired: true, httpStatus: res.status,
      verdict, code: data?.Status?.Code, message: data?.Status?.StatusMessage,
      error: ok ? undefined : (verdict ? `declined_${data?.Status?.Code ?? ''}` : `http_${res.status}`),
    };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    logger.error('[Cortina/Start] request failed', { aborted, err: err?.message, txn: p.transactionId });
    return { ok: false, wired: true, httpStatus: 0, error: aborted ? 'timeout' : (err?.message || 'network_error') };
  } finally {
    clearTimeout(timer);
  }
}

export const NayaxCortinaClient = { isWired, health, startStaticQr, buildStartBody };
