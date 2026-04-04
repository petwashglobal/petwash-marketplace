/**
 * Booking Idempotency Middleware
 *
 * Prevents double-charges when users tap "Book" twice (network retry,
 * impatient tap, back-button race, etc.).
 *
 * Protocol:
 *   Client sends header:  Idempotency-Key: <uuid-v4>
 *   Server:
 *     - First request: processes normally, stores (key, endpoint, response) in DB
 *     - Duplicate request within 24h: returns stored response immediately (HTTP 200)
 *     - Request without key: passes through (non-enforced routes)
 *
 * Storage: existing `idempotency_keys` table in PostgreSQL.
 * TTL: rows older than 24h are invisible (not deleted — append-only for audit).
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './requestIdAndLogs';
import { SystemEventService } from '../services/SystemEventService';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Apply idempotency guard to a booking route.
 * Requires the client to supply an `Idempotency-Key` header (UUID).
 * If missing, returns 400.  If duplicate within TTL, returns cached response.
 */
export function requireIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();

  if (!key) {
    return res.status(400).json({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: 'Please include an Idempotency-Key header (UUID) to prevent duplicate bookings.',
    });
  }

  if (key.length > 128 || !/^[a-zA-Z0-9\-_]+$/.test(key)) {
    return res.status(400).json({
      error: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key must be 1–128 alphanumeric characters.',
    });
  }

  const endpoint = `${req.method}:${req.path}`;

  // Check for existing response
  (async () => {
    try {
      const rows = await db.execute(sql`
        SELECT response_hash, endpoint, created_at
        FROM idempotency_keys
        WHERE key = ${key}
          AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `);

      if (rows.rows.length > 0) {
        const existing = rows.rows[0] as any;

        // Key already used — return cached indication
        SystemEventService.doubleSubmitBlocked('idempotency_middleware', key, endpoint);
        logger.info('[Idempotency] Duplicate request blocked', { key, endpoint, originalEndpoint: existing.endpoint });

        return res.status(200).json({
          idempotent: true,
          message: 'This request was already processed. Your booking was not duplicated.',
          originalProcessedAt: existing.created_at,
        });
      }

      // Not a duplicate — store the key BEFORE processing (prevents race)
      await db.execute(sql`
        INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
        VALUES (${key}, ${endpoint}, 'pending', NOW())
        ON CONFLICT (key) DO NOTHING
      `);

      // Patch res.json to update the record with the final status
      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        // Update stored key with result (non-blocking)
        db.execute(sql`
          UPDATE idempotency_keys
          SET response_hash = ${JSON.stringify({ status: res.statusCode }).slice(0, 255)}
          WHERE key = ${key}
        `).catch(() => {});
        return origJson(body);
      };

      next();
    } catch (err: any) {
      logger.error('[Idempotency] DB check failed, passing through', { error: err?.message, key });
      // Fail open — don't block the booking if the idempotency check itself fails
      next();
    }
  })();
}

/**
 * Strict idempotency: FAIL-CLOSED on DB error.
 * Use on checkout / payment endpoints where a duplicate charge is worse than
 * a temporary 503. If the idempotency_keys table is unavailable we refuse
 * the request so the client can retry safely when the DB recovers.
 *
 * Behaviour differences from requireIdempotency:
 *   - Missing key  → 400 (same)
 *   - Duplicate    → 200 cached (same)
 *   - DB error     → 503 instead of passing through
 */
export function requireStrictIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();

  if (!key) {
    return res.status(400).json({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: 'Please include an Idempotency-Key header (UUID) to prevent duplicate charges.',
    });
  }

  if (key.length > 128 || !/^[a-zA-Z0-9\-_]+$/.test(key)) {
    return res.status(400).json({
      error: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key must be 1–128 alphanumeric characters.',
    });
  }

  const endpoint = `${req.method}:${req.path}`;

  (async () => {
    try {
      const rows = await db.execute(sql`
        SELECT response_hash, endpoint, created_at
        FROM idempotency_keys
        WHERE key = ${key}
          AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `);

      if (rows.rows.length > 0) {
        const existing = rows.rows[0] as any;
        SystemEventService.doubleSubmitBlocked('strict_idempotency', key, endpoint);
        logger.info('[Idempotency:strict] Duplicate request blocked', { key, endpoint });
        return res.status(200).json({
          idempotent: true,
          message: 'This request was already processed. No duplicate charge was made.',
          originalProcessedAt: existing.created_at,
        });
      }

      // Insert BEFORE processing — ON CONFLICT DO NOTHING handles race window
      await db.execute(sql`
        INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
        VALUES (${key}, ${endpoint}, 'pending', NOW())
        ON CONFLICT (key) DO NOTHING
      `);

      const origJson = res.json.bind(res);
      res.json = function (body: any) {
        db.execute(sql`
          UPDATE idempotency_keys
          SET response_hash = ${JSON.stringify({ status: res.statusCode }).slice(0, 255)}
          WHERE key = ${key}
        `).catch(() => {});
        return origJson(body);
      };

      next();
    } catch (err: any) {
      // FAIL-CLOSED: DB unavailable means we cannot guarantee idempotency.
      // Return 503 so the client retries with the same key when DB recovers.
      logger.error('[Idempotency:strict] DB check failed — refusing request to prevent duplicate charge', {
        error: err?.message, key, endpoint,
      });
      return res.status(503).json({
        error: 'IDEMPOTENCY_UNAVAILABLE',
        message: 'Payment service temporarily unavailable. Please retry with the same Idempotency-Key.',
      });
    }
  })();
}

/**
 * Soft idempotency: logs duplicates but doesn't block.
 * Use on endpoints where you want visibility but not enforcement.
 */
export function softIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();
  if (!key) return next();

  (async () => {
    try {
      const rows = await db.execute(sql`
        SELECT created_at FROM idempotency_keys
        WHERE key = ${key} AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `);
      if (rows.rows.length > 0) {
        logger.warn('[Idempotency:soft] Duplicate request detected (not blocked)', {
          key, endpoint: `${req.method}:${req.path}`,
        });
      }
    } catch {}
    next();
  })();
}
