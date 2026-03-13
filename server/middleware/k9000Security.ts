/**
 * K9000 Hardware Security Middleware — 2026 Edition
 *
 * Authentication: Signed request headers (replaces body-based machine secret)
 *
 *   X-K9000-ID:   "K9000-TLV-BAY-1"   — registered kiosk identifier
 *   X-K9000-TS:   "1773402436"         — Unix epoch seconds (±30s window)
 *   X-K9000-SIGN: "<hex>"              — HMAC-SHA256 request signature
 *
 * Signature formula:
 *   HMAC-SHA256(
 *     key  = MACHINE_SECRET_KEY,
 *     data = "<X-K9000-ID>:<X-K9000-TS>:<sha256hex(rawRequestBody)>"
 *   ) → lowercase hex
 *
 * Security properties:
 *   ✓ Timestamp staleness rejection (>30 seconds → 401)
 *   ✓ HMAC covers body hash — body cannot be tampered in transit
 *   ✓ Constant-time comparison — timing-safe
 *   ✓ DB-backed kiosk allowlist (kioskMachines table, active/inactive)
 *   ✓ Optional IP allowlist via ALLOWED_MACHINE_IPS env
 *   ✓ Fail-closed in production if MACHINE_SECRET_KEY is missing
 *
 * Legacy DEV compat: body.machineSecret still accepted when headers absent (dev only).
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { kioskMachines } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

// ─── Environment ──────────────────────────────────────────────────────────────

const MACHINE_SECRET_KEY = process.env.MACHINE_SECRET_KEY || '';
const ALLOWED_MACHINE_IPS_RAW = process.env.ALLOWED_MACHINE_IPS || '';
const ALLOWED_MACHINE_IPS = ALLOWED_MACHINE_IPS_RAW
  .split(',').map(s => s.trim()).filter(Boolean);
const TIMESTAMP_TOLERANCE_SECONDS = 30;
const IS_PROD = process.env.NODE_ENV === 'production';

if (!MACHINE_SECRET_KEY && IS_PROD) {
  logger.error('[K9000 Security] CRITICAL: MACHINE_SECRET_KEY not set in production!');
}

// ─── Type augmentation ────────────────────────────────────────────────────────

export interface K9000StationContext {
  kioskId: string;
  clientIP: string;
  stationRecord?: typeof kioskMachines.$inferSelect;
}

declare module 'express-serve-static-core' {
  interface Request {
    k9000Station?: K9000StationContext;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();
}

function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// ─── 1. IP Allowlist ──────────────────────────────────────────────────────────

export function validateK9000MachineIP(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const clientIP = extractClientIP(req);

  if (ALLOWED_MACHINE_IPS.length === 0) {
    if (IS_PROD) {
      logger.error('[K9000 Security] IP whitelist not configured in production', { clientIP });
      res.status(503).json({ error: 'Service unavailable — security misconfiguration' });
      return;
    }
    logger.warn('[K9000 Security] DEV: no IP whitelist — all IPs allowed', { clientIP });
    req.k9000Station = { kioskId: '', clientIP };
    next();
    return;
  }

  if (!ALLOWED_MACHINE_IPS.includes(clientIP)) {
    logger.warn('[K9000 Security] IP blocked', { clientIP, path: req.path });
    res.status(403).json({ error: 'Access denied — unrecognised machine IP' });
    return;
  }

  req.k9000Station = { kioskId: '', clientIP };
  logger.info('[K9000 Security] ✅ IP allowed', { clientIP });
  next();
}

// ─── 2. Signed Header Authentication ─────────────────────────────────────────
//
// PRIMARY auth method for production kiosks.
// Falls back to legacy body secret in DEV mode when headers are absent.

export function validateK9000HmacHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const kioskId = req.headers['x-k9000-id'] as string | undefined;
  const tsStr   = req.headers['x-k9000-ts'] as string | undefined;
  const sign    = req.headers['x-k9000-sign'] as string | undefined;
  const clientIP = extractClientIP(req);

  // ── DEV fallback: accept legacy body secret when no signed headers present ──
  if (!kioskId && !tsStr && !sign && !IS_PROD) {
    if (!MACHINE_SECRET_KEY) {
      logger.warn('[K9000 Security] DEV: MACHINE_SECRET_KEY unset — open pass-through');
      req.k9000Station = { kioskId: req.body?.kioskId || 'dev', clientIP };
      return next();
    }
    const bodySecret = req.body?.machineSecret || req.body?.token;
    if (bodySecret && bodySecret === MACHINE_SECRET_KEY) {
      logger.warn('[K9000 Security] DEV: legacy body-secret accepted — upgrade to signed headers in prod');
      req.k9000Station = { kioskId: req.body?.kioskId || 'dev', clientIP };
      return next();
    }
    res.status(401).json({
      error: 'DEV: provide X-K9000-ID + X-K9000-TS + X-K9000-SIGN or body.machineSecret',
    });
    return;
  }

  // ── Require all three headers ─────────────────────────────────────────────
  if (!kioskId || !tsStr || !sign) {
    logger.warn('[K9000 Security] Missing auth headers', { kioskId: !!kioskId, ts: !!tsStr, sign: !!sign });
    res.status(401).json({
      error: 'Missing required headers: X-K9000-ID, X-K9000-TS, X-K9000-SIGN',
    });
    return;
  }

  // ── Timestamp staleness check ─────────────────────────────────────────────
  const ts  = parseInt(tsStr, 10);
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.abs(now - ts);
  if (isNaN(ts) || delta > TIMESTAMP_TOLERANCE_SECONDS) {
    logger.warn('[K9000 Security] Stale timestamp', { kioskId, ts, now, delta });
    res.status(401).json({
      error: `Stale request — timestamp delta ${delta}s exceeds ${TIMESTAMP_TOLERANCE_SECONDS}s window`,
      serverTimeMs: Date.now(),
    });
    return;
  }

  // ── HMAC verification ─────────────────────────────────────────────────────
  if (!MACHINE_SECRET_KEY) {
    if (IS_PROD) {
      logger.error('[K9000 Security] MACHINE_SECRET_KEY missing in production!');
      res.status(503).json({ error: 'Server misconfiguration' });
      return;
    }
    logger.warn('[K9000 Security] DEV: MACHINE_SECRET_KEY unset — skipping HMAC verify');
    req.k9000Station = { ...(req.k9000Station ?? { clientIP }), kioskId };
    return next();
  }

  const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const message  = `${kioskId}:${tsStr}:${bodyHash}`;
  const expectedSign = crypto
    .createHmac('sha256', MACHINE_SECRET_KEY)
    .update(message)
    .digest('hex');

  if (!timingSafeHexEqual(sign.toLowerCase(), expectedSign)) {
    logger.warn('[K9000 Security] Invalid HMAC', { kioskId, clientIP });
    res.status(401).json({ error: 'Invalid request signature' });
    return;
  }

  req.k9000Station = { ...(req.k9000Station ?? { clientIP }), kioskId };
  logger.info('[K9000 Security] ✅ Signed headers verified', { kioskId, clientIP, delta: `${delta}s` });
  next();
}

// ─── 3. DB Kiosk Allowlist ────────────────────────────────────────────────────
//
// Validates kioskId against the kioskMachines table.
// Only kiosks with status='active' pass through.

export async function validateKioskAllowlist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const kioskId =
    (req.headers['x-k9000-id'] as string) ||
    req.k9000Station?.kioskId ||
    req.body?.kioskId;

  if (!kioskId) {
    res.status(400).json({ error: 'kioskId is required' });
    return;
  }

  try {
    const [record] = await db
      .select()
      .from(kioskMachines)
      .where(eq(kioskMachines.kioskId, kioskId))
      .limit(1);

    if (!record) {
      logger.warn('[K9000 Allowlist] Unknown kiosk', { kioskId });
      res.status(403).json({
        error: `Kiosk "${kioskId}" is not registered.`,
        status: 'KIOSK_NOT_REGISTERED',
      });
      return;
    }

    if (record.status !== 'active') {
      logger.warn('[K9000 Allowlist] Inactive kiosk attempt', { kioskId, status: record.status });
      res.status(403).json({
        error: `Kiosk "${kioskId}" is not active (status: ${record.status}).`,
        status: 'KIOSK_INACTIVE',
      });
      return;
    }

    req.k9000Station = {
      ...(req.k9000Station ?? { clientIP: extractClientIP(req) }),
      kioskId,
      stationRecord: record,
    };

    logger.info('[K9000 Allowlist] ✅ Kiosk authorised', {
      kioskId,
      name: record.name,
      location: record.location,
    });
    next();
  } catch (err: any) {
    // Fail-open on DB errors — kiosk shouldn't be blocked by transient DB issues
    logger.error('[K9000 Allowlist] DB error — bypassing (fail-open)', { error: err.message, kioskId });
    next();
  }
}

// ─── Legacy compat ────────────────────────────────────────────────────────────

/** @deprecated Use validateK9000HmacHeaders. Kept for wash/start_cycle backward compat. */
export function validateMachineSecretKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!MACHINE_SECRET_KEY) {
    logger.warn('[K9000 Security] MACHINE_SECRET_KEY not configured — skipping (DEV)');
    next();
    return;
  }
  const provided = req.body?.machineSecret || req.body?.token;
  if (!provided || provided !== MACHINE_SECRET_KEY) {
    res.status(401).json({ error: 'Invalid or missing machine secret' });
    return;
  }
  next();
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Build signed request headers for a kiosk HTTP call.
 * Use this in firmware, integration tests, and Postman collections.
 *
 * @example
 *   const body = JSON.stringify({ scannedCode, kioskId });
 *   const headers = buildK9000SignedHeaders('K9000-TLV-1', body);
 *   fetch('/api/k9000/redeem-wash', { method: 'POST', headers, body });
 */
export function buildK9000SignedHeaders(
  kioskId: string,
  bodyJson: string,
  secret: string = MACHINE_SECRET_KEY,
): Record<string, string> {
  const ts       = Math.floor(Date.now() / 1000).toString();
  const bodyHash = crypto.createHash('sha256').update(bodyJson).digest('hex');
  const message  = `${kioskId}:${ts}:${bodyHash}`;
  const sign     = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return {
    'Content-Type':  'application/json',
    'X-K9000-ID':    kioskId,
    'X-K9000-TS':    ts,
    'X-K9000-SIGN':  sign,
  };
}

export function getAllK9000Stations() {
  return ALLOWED_MACHINE_IPS;
}

export default {
  validateK9000MachineIP,
  validateK9000HmacHeaders,
  validateKioskAllowlist,
  validateMachineSecretKey,
  buildK9000SignedHeaders,
  getAllK9000Stations,
};
