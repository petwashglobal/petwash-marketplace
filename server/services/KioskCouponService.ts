/**
 * KioskCouponService — Priority 2
 * Short-lived pre-validation tokens for K9000 coupon redemptions.
 *
 * Flow:
 *   1. User scans coupon at kiosk or uses app before starting wash
 *   2. App calls POST /api/k9000/coupon-token/create
 *      → validates coupon, creates kiosk_coupon_tokens row (5-min TTL)
 *      → returns token (embedded in QR code or session)
 *   3. Kiosk/app confirms payment or session start
 *   4. System calls confirmKioskToken(token, sessionId)
 *      → atomically consume coupon (redeemAtomic)
 *      → mark token confirmed
 *   5. If session never starts, token expires; coupon is never burned.
 *
 * Safety guarantees:
 *   - Duplicate scan: UNIQUE idempotencyKey on kiosk_coupon_tokens prevents double-insert
 *   - Duplicate callback: confirmKioskToken is idempotent — already-confirmed token returns existing redemptionId
 *   - Network drop: token TTL = 5 min; if session starts before TTL, token is valid
 *   - User cancels: cancelKioskToken() marks cancelled, coupon freed
 *   - Machine failure: token expires; coupon freed after TTL
 *   - Double scan: second call with same idempotencyKey returns existing token
 */

import { pool } from '../db';
import { couponService } from './CouponService';
import { pricingService } from './UnifiedPricingService';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { createHmac } from 'crypto';

const TOKEN_TTL_MINUTES = 5;
const HMAC_SECRET = process.env.MACHINE_SECRET_KEY ?? 'kiosk-coupon-fallback-secret';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface KioskTokenInput {
  couponCode:         string;
  userId:             string;
  stationId?:         string;
  bayId?:             string;
  grossAmountCents?:  number;
  idempotencyKey?:    string; // client-side idempotency
  ipAddress?:         string;
}

export interface KioskTokenResult {
  token:               string;
  hmac:                string;   // signed for machine verification
  couponId:            number;
  discountAmountCents: number;
  expiresAt:           Date;
  idempotent?:         boolean;
}

export interface ConfirmTokenResult {
  redemptionId:   number;
  alreadyDone:    boolean;
  discountCents:  number;
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

export class KioskCouponService {

  /**
   * Create a pre-validation token at scan time.
   * Validates the coupon but does NOT consume it.
   * Returns a short-lived signed token (5 min TTL).
   */
  async createToken(input: KioskTokenInput): Promise<KioskTokenResult> {
    const { couponCode, userId, stationId, bayId, grossAmountCents = 0, idempotencyKey, ipAddress } = input;

    // Idempotency: same client key → return existing pending token
    if (idempotencyKey) {
      const existing = await pool.query(
        `SELECT * FROM kiosk_coupon_tokens WHERE idempotency_key = $1 AND status = 'pending' AND expires_at > NOW() LIMIT 1`,
        [idempotencyKey]
      );
      if (existing.rows.length) {
        const t = existing.rows[0];
        return {
          token:               t.token,
          hmac:                this.signToken(t.token, userId),
          couponId:            t.coupon_id,
          discountAmountCents: t.discount_amount_cents,
          expiresAt:           new Date(t.expires_at),
          idempotent:          true,
        };
      }
    }

    // Validate coupon
    const val = await couponService.validateCoupon({
      code:     couponCode,
      userId,
      orderType: 'kiosk_wash',
      amountCents: grossAmountCents,
      ipAddress,
      stationId,
    });

    if (!val.valid || !val.couponId) {
      throw Object.assign(
        new Error(val.error ?? 'COUPON_INVALID'),
        { code: val.errorCode ?? 'COUPON_INVALID', httpStatus: 400 }
      );
    }

    const token     = `KT-${nanoid(20)}`;
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO kiosk_coupon_tokens
         (token, coupon_id, issuance_id, user_id, station_id, bay_id,
          discount_amount_cents, gross_amount_cents, expires_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [token, val.couponId, val.issuanceId ?? null, userId,
       stationId ?? null, bayId ?? null,
       val.discountAmountCents, grossAmountCents, expiresAt,
       idempotencyKey ?? null]
    );

    logger.info('[KioskCoupon] ✅ Token created', {
      token, couponId: val.couponId, userId, stationId, discountCents: val.discountAmountCents,
    });

    return {
      token,
      hmac:                this.signToken(token, userId),
      couponId:            val.couponId,
      discountAmountCents: val.discountAmountCents ?? 0,
      expiresAt,
    };
  }

  /**
   * Confirm a kiosk token after payment/session confirmation.
   * Atomically consumes the coupon. Idempotent — safe to call on retry.
   */
  async confirmToken(token: string, sessionId: string): Promise<ConfirmTokenResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock token row
      const row = await client.query(
        `SELECT * FROM kiosk_coupon_tokens WHERE token = $1 FOR UPDATE`,
        [token]
      );
      if (!row.rows.length) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('TOKEN_NOT_FOUND'), { code: 'TOKEN_NOT_FOUND', httpStatus: 404 });
      }
      const t = row.rows[0];

      // Already confirmed — idempotent return
      if (t.status === 'confirmed') {
        await client.query('ROLLBACK');
        // Find the redemption
        const redemption = await pool.query(
          `SELECT id FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2 ORDER BY redeemed_at DESC LIMIT 1`,
          [t.coupon_id, t.user_id]
        );
        return {
          redemptionId: redemption.rows[0]?.id ?? 0,
          alreadyDone:  true,
          discountCents: t.discount_amount_cents,
        };
      }

      if (t.status === 'cancelled') {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('TOKEN_CANCELLED'), { code: 'TOKEN_CANCELLED', httpStatus: 409 });
      }

      if (new Date(t.expires_at) < new Date()) {
        await client.query(
          `UPDATE kiosk_coupon_tokens SET status = 'expired' WHERE token = $1`,
          [token]
        );
        await client.query('COMMIT');
        throw Object.assign(new Error('TOKEN_EXPIRED'), { code: 'TOKEN_EXPIRED', httpStatus: 410 });
      }

      // Mark token confirmed inside TX
      await client.query(
        `UPDATE kiosk_coupon_tokens SET status = 'confirmed', confirmed_at = NOW(), session_id = $1 WHERE token = $2`,
        [sessionId, token]
      );
      await client.query('COMMIT');

      // Now atomically consume coupon (its own TX)
      const idempotencyKey = `kiosk-${token}-${sessionId}`;
      const result = await couponService.redeemAtomic({
        couponId:            t.coupon_id,
        userId:              t.user_id,
        orderType:           'kiosk_wash',
        orderId:             sessionId,
        issuanceId:          t.issuance_id ?? undefined,
        amountBeforeCents:   t.gross_amount_cents ?? 0,
        discountAmountCents: t.discount_amount_cents,
        idempotencyKey,
      });

      logger.info('[KioskCoupon] ✅ Token confirmed + coupon consumed', {
        token, sessionId, redemptionId: result.redemptionId,
      });

      return {
        redemptionId:  result.redemptionId,
        alreadyDone:   result.alreadyRedeemed ?? false,
        discountCents: t.discount_amount_cents,
      };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a token (user cancels before wash starts, or machine failure).
   * Coupon is NOT burned — still available for reuse.
   */
  async cancelToken(token: string, reason: string): Promise<void> {
    await pool.query(
      `UPDATE kiosk_coupon_tokens
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE token = $1 AND status = 'pending'`,
      [token]
    );
    logger.info('[KioskCoupon] Token cancelled', { token, reason });
  }

  /**
   * Expire stale tokens (sweep job — run every few minutes).
   */
  async sweepExpiredTokens(): Promise<number> {
    const res = await pool.query(
      `UPDATE kiosk_coupon_tokens SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING id`
    );
    return res.rowCount ?? 0;
  }

  /**
   * Look up token status — used by kiosk hardware to verify before scan.
   */
  async getTokenStatus(token: string): Promise<{ status: string; discountCents: number; expiresAt: Date } | null> {
    const row = await pool.query(
      `SELECT status, discount_amount_cents, expires_at FROM kiosk_coupon_tokens WHERE token = $1`,
      [token]
    );
    if (!row.rows.length) return null;
    return {
      status:       row.rows[0].status,
      discountCents: row.rows[0].discount_amount_cents,
      expiresAt:    new Date(row.rows[0].expires_at),
    };
  }

  /** HMAC sign the token + userId for machine-level verification */
  private signToken(token: string, userId: string): string {
    return createHmac('sha256', HMAC_SECRET)
      .update(`${token}:${userId}`)
      .digest('hex');
  }
}

export const kioskCouponService = new KioskCouponService();
