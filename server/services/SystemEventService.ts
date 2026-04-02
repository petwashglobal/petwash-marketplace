/**
 * SystemEventService — Append-only black-box recorder for all platform anomalies.
 *
 * Every critical failure, unknown shutdown, circuit-open, quota-exhaustion, or
 * booking-state anomaly is stamped here so operators have a queryable record
 * long after log files have rotated.
 *
 * Design principles:
 *  - NEVER throws. Logging must never kill the calling request.
 *  - Fire-and-forget writes (non-blocking).
 *  - All fields are optional except event_type, source, message.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface SystemEventPayload {
  eventType:   string;
  severity?:   EventSeverity;
  source:      string;
  platform?:   string;
  message:     string;
  detail?:     Record<string, unknown>;
  bookingId?:  string;
  userUid?:    string;
  providerUid?: string;
}

class _SystemEventService {
  /**
   * Stamp a system event to the DB.  Never throws — all errors are swallowed
   * and logged so that callers are not affected.
   */
  stamp(payload: SystemEventPayload): void {
    const {
      eventType, severity = 'info', source, platform, message,
      detail, bookingId, userUid, providerUid,
    } = payload;

    // Fire and forget — do NOT await
    (async () => {
      try {
        await db.execute(sql`
          INSERT INTO system_events
            (event_type, severity, source, platform, message, detail,
             booking_id, user_uid, provider_uid, created_at)
          VALUES (
            ${eventType}, ${severity}, ${source}, ${platform ?? null},
            ${message},
            ${detail ? JSON.stringify(detail) : null}::jsonb,
            ${bookingId ?? null}, ${userUid ?? null}, ${providerUid ?? null},
            NOW()
          )
        `);
      } catch (err: any) {
        // Swallow silently — we must not crash callers
        logger.warn('[SystemEventService] Failed to stamp event', {
          eventType, source, error: err?.message,
        });
      }
    })();
  }

  /**
   * Mark a previously stamped event as resolved.
   */
  async resolve(eventId: number, resolvedBy = 'system'): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE system_events
        SET resolved = TRUE, resolved_at = NOW(), resolved_by = ${resolvedBy}
        WHERE id = ${eventId}
      `);
    } catch (err: any) {
      logger.warn('[SystemEventService] Failed to resolve event', { eventId, error: err?.message });
    }
  }

  /**
   * Convenience wrappers for common scenarios.
   */
  aiQuotaExhausted(source: string, model: string, retryAfterSec?: number) {
    this.stamp({
      eventType: 'ai_quota_exhausted',
      severity: 'warn',
      source,
      message: `AI quota exhausted on model ${model}${retryAfterSec ? ` — retry in ${retryAfterSec}s` : ''}`,
      detail: { model, retryAfterSec },
    });
  }

  externalApiFailure(source: string, api: string, statusCode: number, error: string) {
    this.stamp({
      eventType: 'external_api_failure',
      severity: statusCode >= 500 ? 'error' : 'warn',
      source,
      message: `${api} returned ${statusCode}: ${error.slice(0, 200)}`,
      detail: { api, statusCode, error: error.slice(0, 500) },
    });
  }

  circuitOpen(source: string, failures: number, resetInMs: number) {
    this.stamp({
      eventType: 'circuit_open',
      severity: 'error',
      source,
      message: `Circuit breaker OPEN after ${failures} failures — resets in ${Math.ceil(resetInMs / 1000)}s`,
      detail: { failures, resetInMs },
    });
  }

  bookingStuck(source: string, bookingId: string, state: string, ageMinutes: number) {
    this.stamp({
      eventType: 'booking_stuck',
      severity: 'warn',
      source,
      bookingId,
      message: `Booking ${bookingId} stuck in state "${state}" for ${ageMinutes}m`,
      detail: { state, ageMinutes },
    });
  }

  orphanedPaymentHold(source: string, bookingId: string, holdCents: number) {
    this.stamp({
      eventType: 'orphaned_payment_hold',
      severity: 'error',
      source,
      bookingId,
      message: `Orphaned wallet hold ₪${(holdCents / 100).toFixed(2)} for booking ${bookingId} — no matching booking row`,
      detail: { holdCents },
    });
  }

  doubleSubmitBlocked(source: string, idempotencyKey: string, endpoint: string) {
    this.stamp({
      eventType: 'double_submit_blocked',
      severity: 'info',
      source,
      message: `Duplicate request blocked: ${endpoint} (key: ${idempotencyKey})`,
      detail: { idempotencyKey, endpoint },
    });
  }

  providerGpsDropout(bookingId: string, providerUid: string, gapMinutes: number) {
    this.stamp({
      eventType: 'provider_gps_dropout',
      severity: 'warn',
      source: 'walk_my_pet',
      platform: 'walk-my-pet',
      bookingId,
      providerUid,
      message: `GPS signal lost for provider ${providerUid} during walk ${bookingId} (${gapMinutes}m gap)`,
      detail: { gapMinutes },
    });
  }

  dbConnectionFailure(error: string) {
    this.stamp({
      eventType: 'db_connection_failure',
      severity: 'critical',
      source: 'database',
      message: `Database connection failure: ${error.slice(0, 300)}`,
      detail: { error: error.slice(0, 500) },
    });
  }

  unknownShutdown(source: string, error: string, stack?: string) {
    this.stamp({
      eventType: 'unknown_shutdown',
      severity: 'critical',
      source,
      message: `Unexpected shutdown/crash: ${error.slice(0, 300)}`,
      detail: { error: error.slice(0, 500), stack: stack?.slice(0, 1000) },
    });
  }

  /**
   * Query recent unresolved events (for admin dashboard).
   */
  async getRecent(opts: {
    limit?: number;
    severity?: EventSeverity;
    source?: string;
    platform?: string;
    unresolved?: boolean;
  } = {}): Promise<any[]> {
    const { limit = 100, severity, source, platform, unresolved } = opts;
    try {
      const rows = await db.execute(sql`
        SELECT * FROM system_events
        WHERE
          (${severity ?? null}::text  IS NULL OR severity = ${severity ?? null})
          AND (${source ?? null}::text    IS NULL OR source   = ${source ?? null})
          AND (${platform ?? null}::text  IS NULL OR platform = ${platform ?? null})
          AND (${unresolved ? 'TRUE' : null}::text IS NULL OR resolved = FALSE)
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      return rows.rows as any[];
    } catch (err: any) {
      logger.error('[SystemEventService] getRecent failed', { error: err?.message });
      return [];
    }
  }
}

export const SystemEventService = new _SystemEventService();
