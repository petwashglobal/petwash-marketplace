/**
 * Nayax station DEVICE credential auth — `x-station-key`.
 *
 * NOT to be confused with `stationAuth.ts` (requireStationRole), which
 * authenticates a HUMAN station operator via their Firebase identity.
 * This module authenticates the KIOSK DEVICE itself via the shared secret
 * provisioned onto it, exactly as the `/api/nayax/*` routes in routes.ts
 * already do through `validateStationKey()`.
 *
 * WHY THIS EXISTS (2026-09-05 wallet-money audit):
 * POST /api/credit-wallet/nayax/validate-code and .../nayax/acknowledge
 * read `x-station-key`, rejected only the EMPTY case, and then never
 * compared the value against anything. `x-station-key: anything` passed.
 * Since a redemption `code`/`sessionId` is a string the customer already
 * holds from their own /redemptions flow, any customer could POST
 * /nayax/acknowledge straight over HTTP and burn+confirm their own
 * hardware redemption as "completed" without ever standing at a K9000 —
 * skipping the wash while the wallet credit was spent. The sibling
 * routes in routes.ts were already hard; credit-wallet.ts was not.
 *
 * Security properties:
 *   ✓ Presented key is resolved against a REGISTERED credential
 *   ✓ Constant-time confirm of the stored secret (no timing oracle)
 *   ✓ Fail-CLOSED — any lookup error is 403, never next()
 *   ✓ Optional station binding: station A's key cannot drive station B
 *   ✓ Secrets are never logged (only a short non-reversible fingerprint)
 *
 * Registries checked, in the order the platform provisions them:
 *   1. Firestore `nayax_terminals`   — canonical, what routes.ts uses
 *   2. Postgres  `nayax_station_keys` — station-scoped keys (has stationId)
 *   3. Postgres  `nayax_terminals`    — Postgres mirror of (1)
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { nayaxStationKeys, nayaxTerminals } from '@shared/schema';
import { logger } from '../lib/logger';

export interface StationDeviceIdentity {
  /** Which registry the credential was found in. */
  source: 'firestore_terminal' | 'pg_station_key' | 'pg_terminal';
  /** Registry row id / terminal id, for audit trails. */
  terminalId: string;
  /** Station this credential is scoped to, when the registry records one. */
  stationId?: string;
  name?: string;
}

/**
 * Constant-time secret confirm. Length is compared first because
 * crypto.timingSafeEqual THROWS on differing buffer lengths — the same
 * guard already used in verifyWebhookSignature() and admin-secret.ts.
 * A length mismatch is simply "not equal", never a 500.
 */
function secretsMatch(presented: string, stored: string | null | undefined): boolean {
  if (!presented || !stored) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Non-reversible short fingerprint so rejected attempts are traceable without leaking the secret. */
function fingerprint(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

function normalizeStationId(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/**
 * Resolve a presented `x-station-key` to a registered station device.
 * Returns null when the key matches no ACTIVE credential in any registry.
 * Never throws — a registry outage resolves to null so callers fail closed.
 */
export async function resolveStationDevice(
  presentedKey: string,
): Promise<StationDeviceIdentity | null> {
  if (!presentedKey) return null;

  // 1. Firestore nayax_terminals — the canonical registry the existing
  //    /api/nayax/redeem, /session/start, /session/end and /heartbeat
  //    routes authenticate against. Dynamically imported to match those
  //    call sites and avoid pulling firebase-admin into this module's
  //    load order.
  try {
    const { validateStationKey } = await import('../nayaxFirestoreService');
    const terminal = await validateStationKey(presentedKey);
    // validateStationKey already filters isActive === true. The
    // constant-time confirm below is defence in depth: it pins the
    // invariant that the value we were handed IS the stored secret,
    // independent of how the datastore performed its own comparison.
    if (terminal && secretsMatch(presentedKey, (terminal as any).apiKey)) {
      return {
        source: 'firestore_terminal',
        terminalId: (terminal as any).id,
        stationId: (terminal as any).stationId || (terminal as any).location || undefined,
        name: (terminal as any).name,
      };
    }
  } catch (err: any) {
    logger.error('[StationDeviceAuth] Firestore terminal lookup failed', {
      error: err?.message,
      keyFingerprint: fingerprint(presentedKey),
    });
    // fall through to the Postgres registries — still fails closed if all miss
  }

  // 2. Postgres nayax_station_keys — station-scoped device keys.
  try {
    const [row] = await db
      .select()
      .from(nayaxStationKeys)
      .where(and(eq(nayaxStationKeys.apiKey, presentedKey), eq(nayaxStationKeys.isActive, true)))
      .limit(1);
    if (row && secretsMatch(presentedKey, row.apiKey)) {
      return {
        source: 'pg_station_key',
        terminalId: String(row.id),
        stationId: row.stationId || undefined,
        name: row.description || undefined,
      };
    }
  } catch (err: any) {
    logger.error('[StationDeviceAuth] nayax_station_keys lookup failed', {
      error: err?.message,
      keyFingerprint: fingerprint(presentedKey),
    });
  }

  // 3. Postgres nayax_terminals — mirror written by syncTerminalToPostgres.
  try {
    const [row] = await db
      .select()
      .from(nayaxTerminals)
      .where(and(eq(nayaxTerminals.apiKey, presentedKey), eq(nayaxTerminals.status, 'online')))
      .limit(1);
    if (row && secretsMatch(presentedKey, row.apiKey)) {
      return {
        source: 'pg_terminal',
        terminalId: row.terminalId || row.id,
        stationId: row.location || undefined,
        name: row.name,
      };
    }
  } catch (err: any) {
    logger.error('[StationDeviceAuth] nayax_terminals lookup failed', {
      error: err?.message,
      keyFingerprint: fingerprint(presentedKey),
    });
  }

  return null;
}

export interface StationDeviceAuthOptions {
  /**
   * When true, and the resolved credential records a stationId, the
   * request body's `stationId` must name that same station. Stops a
   * key provisioned for station A from validating/redeeming against
   * station B. Skipped when the registry row carries no stationId, so
   * terminals registered before station scoping keep working.
   */
  bindBodyStationId?: boolean;
  /** Route label used in warn logs. */
  route?: string;
}

/**
 * Express middleware: require a valid, registered station device credential.
 *
 * 401 — header absent/empty (client forgot to authenticate)
 * 403 — header present but not a registered active credential, or the
 *       credential is scoped to a different station than the request body
 */
export function requireNayaxStationDevice(options: StationDeviceAuthOptions = {}) {
  const { bindBodyStationId = false, route = '' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers['x-station-key'];
    const presentedKey = (Array.isArray(raw) ? raw[0] : raw ?? '').toString().trim();

    if (!presentedKey) {
      return res.status(401).json({
        success: false,
        error: 'Station API key required',
        code: 'STATION_KEY_REQUIRED',
      });
    }

    const device = await resolveStationDevice(presentedKey);

    if (!device) {
      logger.warn('[StationDeviceAuth] Rejected unregistered station key', {
        route,
        ip: req.ip,
        keyFingerprint: fingerprint(presentedKey),
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid station API key',
        code: 'STATION_KEY_INVALID',
      });
    }

    if (bindBodyStationId && device.stationId) {
      const requested = normalizeStationId((req.body as any)?.stationId);
      if (requested && requested !== normalizeStationId(device.stationId)) {
        logger.warn('[StationDeviceAuth] Station key used against a different station', {
          route,
          ip: req.ip,
          credentialStationId: device.stationId,
          requestedStationId: (req.body as any)?.stationId,
        });
        return res.status(403).json({
          success: false,
          error: 'Station API key is not valid for this station',
          code: 'STATION_KEY_STATION_MISMATCH',
        });
      }
    }

    (req as any).stationDevice = device;
    return next();
  };
}

export default requireNayaxStationDevice;
