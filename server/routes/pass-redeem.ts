/**
 * PetWash™ Pass Redemption Routes — 2026
 *
 * These routes handle redemption against the petwash_pass_accounts credit balance.
 * This is a separate system from the legacy WalletEngine / wallet_accounts system.
 *
 * Security layers (all mandatory per spec):
 *  1. Signed token verification (HMAC-SHA256): live QR or Wallet barcode
 *  2. Machine ID + Bay ID binding (if encoded in token)
 *  3. Token-version check against the active pass record for revocation
 *  4. Nonce atomic burn for live qr-redeem tokens (replay = 409)
 *  5. DB-level atomic debit via transaction (SELECT ... FOR UPDATE)
 *  6. Immutable ledger write to petwash_pass_transactions
 *  7. Google Wallet object push-update after debit
 *
 * Endpoints (mounted at /api/pass by routes.ts):
 *   POST /api/pass/redeem          — K9000 kiosk QR scan redemption (HMAC self-auth)
 *   POST /api/pass/redeem-online   — DISABLED (410) → use /api/prestige-pass/redeem-online
 *   POST /api/pass/topup           — DISABLED (410) → use /api/prestige-pass/admin/manual-credit
 *   GET  /api/pass/balance/:passId — DISABLED (410) → use authenticated /api/prestige-pass
 *   GET  /api/pass/ledger/:passId  — DISABLED (410) → use authenticated /api/prestige-pass
 *
 * topup/balance/ledger were unauthenticated (rate-limit only) and orphaned; removed
 * 2026-06-17. See the block above each stub for detail.
 */

import { Router, Request, Response } from 'express';
import { z }                          from 'zod';
import rateLimit                      from 'express-rate-limit';
import { db }                         from '../db';
import {
  petwashPassAccounts,
  petwashPassNonceRegistry,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger }       from '../lib/logger';
import {
  verifyQrRedeemToken,
  verifyWalletBarcodeToken,
  type PassTokenPayload,
} from '../lib/passTokens';
import { pushUpdate }   from '../services/GoogleWalletService';

const router = Router();

// ─── Rate limiters ───────────────────────────────────────────────────────────

const redeemLimiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  message:  'Too many redeem requests',
});

const adminLimiter = rateLimit({
  windowMs: 60_000,
  max:      100,
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const redeemSchema = z.object({
  scannedToken: z.string().min(10),
  kioskId:      z.string().min(1).max(100),
  bayId:        z.enum(['LEFT', 'RIGHT']).optional(),
  amountIls:    z.number().positive().max(10_000),
});

const redeemOnlineSchema = z.object({
  userId:      z.string().min(1).max(200),
  passId:      z.string().min(1).max(100),
  bookingId:   z.string().min(1).max(200),
  serviceType: z.enum(['SITTER', 'WALKER', 'ACADEMY', 'TRANSPORT', 'GROOMING', 'DAYCARE', 'VET', 'OTHER']),
  amountIls:   z.number().positive().max(50_000),
});

function verifyScannedPassToken(scannedToken: string): PassTokenPayload {
  try {
    return verifyQrRedeemToken(scannedToken);
  } catch (qrErr: any) {
    try {
      return verifyWalletBarcodeToken(scannedToken);
    } catch {
      throw qrErr;
    }
  }
}

// ─── Core atomic helpers ──────────────────────────────────────────────────────

/**
 * Atomically burn a nonce. Returns false if already used (replay attack).
 * Uses PostgreSQL's INSERT ... ON CONFLICT DO NOTHING (single atomic statement).
 */
async function burnNonce(
  nonce:        string,
  passId:       string,
  expiresAtUnix: number,
): Promise<boolean> {
  const expiresAt = new Date(expiresAtUnix * 1000);
  // Try to insert; if nonce exists already → 0 rows inserted → replay
  const result = await db.execute(sql`
    INSERT INTO petwash_pass_nonce_registry (nonce, pass_id, expires_at, used_at)
    VALUES (${nonce}, ${passId}, ${expiresAt}, NOW())
    ON CONFLICT (nonce) DO NOTHING
    RETURNING id
  `);
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Atomically debit or credit the pass balance inside a DB transaction.
 * Uses advisory locking via SELECT ... FOR UPDATE to prevent race conditions.
 * Writes an immutable row to petwash_pass_transactions.
 * Returns the ledger row id and new balance.
 */
async function atomicLedgerEntry(opts: {
  passId:      string;
  direction:   'DEBIT' | 'CREDIT';
  amountIls:   number;
  sourceType:  string;
  sourceRef?:  string;
  tokenVersion?: number;
  metadata?:   Record<string, unknown>;
}): Promise<{ txId: string; balanceBefore: number; balanceAfter: number }> {
  return await db.transaction(async (tx) => {
    // 1. Lock the pass row (FOR UPDATE = advisory lock in Postgres)
    const [pass] = await tx.execute(sql`
      SELECT id, user_id, available_credit_ils, status, valid_until, qr_token_version
      FROM petwash_pass_accounts
      WHERE pass_id = ${opts.passId}
      FOR UPDATE
    `).then(r => r.rows as any[]);

    if (!pass) throw Object.assign(new Error('PASS_NOT_FOUND'), { status: 404 });
    if (pass.status !== 'ACTIVE') throw Object.assign(new Error('PASS_NOT_ACTIVE'), { status: 403 });
    if (pass.valid_until && new Date(pass.valid_until) < new Date()) {
      throw Object.assign(new Error('PASS_EXPIRED'), { status: 403 });
    }
    if (opts.tokenVersion !== undefined && Number(pass.qr_token_version) !== opts.tokenVersion) {
      throw Object.assign(new Error('TOKEN_REVOKED'), { status: 403 });
    }

    const balanceBefore = parseFloat(pass.available_credit_ils);

    let balanceAfter: number;
    if (opts.direction === 'DEBIT') {
      if (balanceBefore < opts.amountIls) {
        throw Object.assign(new Error('INSUFFICIENT_BALANCE'), { status: 402 });
      }
      balanceAfter = +(balanceBefore - opts.amountIls).toFixed(2);
    } else {
      balanceAfter = +(balanceBefore + opts.amountIls).toFixed(2);
    }

    // 2. Write immutable ledger row
    const txRows = await tx.execute(sql`
      INSERT INTO petwash_pass_transactions
        (pass_id, user_id, source_type, source_ref, direction, amount_ils,
         balance_before_ils, balance_after_ils, metadata)
      VALUES
        (${opts.passId}, ${pass.user_id}, ${opts.sourceType}, ${opts.sourceRef ?? null},
         ${opts.direction}, ${opts.amountIls},
         ${balanceBefore}, ${balanceAfter},
         ${opts.metadata ? JSON.stringify(opts.metadata) : null})
      RETURNING id
    `);
    const txId = (txRows.rows?.[0] as any)?.id as string;

    // 3. Update balance on canonical pass record
    await tx.execute(sql`
      UPDATE petwash_pass_accounts
      SET available_credit_ils = ${balanceAfter},
          updated_at            = NOW()
      WHERE pass_id = ${opts.passId}
    `);

    return { txId, balanceBefore, balanceAfter };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pass/redeem — K9000 kiosk QR scan redemption
//
// Called by: K9000 kiosk after scanning a live QR token or Wallet barcode token.
// Authentication: Token self-authenticates via HMAC — no session required.
//                 Kiosks should additionally set K9000_MACHINE_SECRET in headers.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/redeem', redeemLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_INPUT', details: parsed.error.flatten() });
    }
    const { scannedToken, kioskId, bayId, amountIls } = parsed.data;

    // ── 0. Validate amountIls against known wash program prices ──────────────
    // Includes the CURRENT live bay prices: ₪48 (Kfar Saba) and ₪55 (VAT-incl,
    // next). These were missing → a member redeeming at the real price got
    // INVALID_WASH_AMOUNT. See memory live-bay-wash-prices-2026-06-30.
    const VALID_WASH_PRICES_ILS = [45, 48, 55, 65, 80, 120, 150, 180, 200];
    if (!VALID_WASH_PRICES_ILS.includes(amountIls)) {
      logger.warn('[PassRedeem] Invalid wash amount rejected', { amountIls, kioskId });
      return res.status(400).json({ ok: false, error: 'INVALID_WASH_AMOUNT', valid: VALID_WASH_PRICES_ILS });
    }

    // ── 1. Verify token (signature + expiry + purpose) ────────────────────────
    let payload: PassTokenPayload;
    try {
      payload = verifyScannedPassToken(scannedToken);
    } catch (err: any) {
      const msg = err?.message || 'INVALID_TOKEN';
      if (msg === 'TOKEN_EXPIRED')   return res.status(401).json({ ok: false, error: 'TOKEN_EXPIRED — scan again' });
      if (msg === 'INVALID_SIGNATURE') return res.status(403).json({ ok: false, error: 'INVALID_SIGNATURE' });
      return res.status(400).json({ ok: false, error: msg });
    }

    // ── 1b. DYNAMIC-TOKEN-ONLY GATE (CEO 2026-07-03) ──────────────────────────
    // The redemption credential must be DYNAMIC, UNIQUE and TRACED — never a
    // static barcode a screenshot can reuse. Only the live 45-second qr-redeem
    // token (fresh id + single-use nonce every scan) may DEBIT a wash. The
    // long-lived wallet-barcode baked into an Apple/Google pass identifies the
    // member but can NOT spend on its own, so a photo of it is worthless at the
    // reader. Members redeem with the live QR the app rotates on screen.
    if (payload.purpose !== 'qr-redeem') {
      logger.warn('[PassRedeem] Static/non-dynamic token refused at debit', {
        purpose: payload.purpose, passId: payload.passId, kioskId,
      });
      return res.status(403).json({
        ok: false,
        error: 'DYNAMIC_TOKEN_REQUIRED',
        message: 'Open the PetWash app and scan the live pass QR to redeem.',
      });
    }

    // ── 2. Machine binding check ──────────────────────────────────────────────
    if (payload.machineId && payload.machineId !== kioskId) {
      logger.warn('[PassRedeem] Machine mismatch', { tokenMachine: payload.machineId, kioskId });
      return res.status(403).json({ ok: false, error: 'TOKEN_MACHINE_MISMATCH' });
    }

    // ── 3. Bay binding check ──────────────────────────────────────────────────
    if (payload.bayId && bayId && payload.bayId !== bayId) {
      logger.warn('[PassRedeem] Bay mismatch', { tokenBay: payload.bayId, bayId });
      return res.status(403).json({ ok: false, error: 'TOKEN_BAY_MISMATCH' });
    }

    // ── 4. Burn nonce for live QR tokens (replay protection) ──────────────────
    if (payload.purpose === 'qr-redeem') {
      const nonceConsumed = await burnNonce(payload.nonce, payload.passId, payload.expiresAt);
      if (!nonceConsumed) {
        logger.warn('[PassRedeem] REPLAY ATTACK — nonce already used', { nonce: payload.nonce, passId: payload.passId });
        // Open a review-required TRUST case so repeated replay abuse is visible
        // (the redemption is already refused below). Fire-and-forget, non-blocking;
        // single-use 45s tokens make this naturally rare, so no de-dupe needed.
        void import('../lib/trustBridge')
          .then(({ openTrustCase }) => openTrustCase({
            type: 'pass_replay_attempt', severity: 'medium',
            description: `A single-use redeem token was replayed after being burned. passId=${payload.passId}, kiosk=${kioskId}, nonce=${payload.nonce}.`,
            stationId: kioskId,
          }))
          .catch(() => { /* trust bridge is best-effort */ });
        return res.status(409).json({ ok: false, error: 'TOKEN_ALREADY_USED — replay rejected' });
      }
    }

    // ── 5–7. Atomic debit + ledger ────────────────────────────────────────────
    const { txId, balanceBefore, balanceAfter } = await atomicLedgerEntry({
      passId:    payload.passId,
      direction: 'DEBIT',
      amountIls,
      sourceType: 'K9000',
      sourceRef:  kioskId,
      tokenVersion: payload.tokenVersion,
      metadata: {
        kioskId,
        bayId:          bayId   ?? null,
        tokenMachineId: payload.machineId ?? null,
        tokenBayId:     payload.bayId     ?? null,
        nonce:          payload.nonce,
        tokenVersion:   payload.tokenVersion,
        tokenPurpose:   payload.purpose,
      },
    });

    logger.info('[PassRedeem] ✅ K9000 redemption', {
      passId: payload.passId, kioskId, bayId, amountIls,
      balanceBefore, balanceAfter, txId,
    });

    // ── 8. Push Google Wallet live update (non-blocking) ─────────────────────
    setImmediate(async () => {
      try {
        const [pass] = await db
          .select()
          .from(petwashPassAccounts)
          .where(eq(petwashPassAccounts.passId, payload.passId))
          .limit(1);
        if (pass) {
          await pushUpdate({
            passId:             pass.passId,
            userId:             pass.userId,
            ownerName:          pass.ownerName,
            primaryPetName:     pass.primaryPetName ?? undefined,
            tier:               pass.tier,
            availableCreditIls: balanceAfter,
            validUntil:         pass.validUntil?.toISOString().split('T')[0],
            qrTokenVersion:     pass.qrTokenVersion,
          });
        }
      } catch (e) {
        logger.warn('[PassRedeem] Google Wallet update failed (non-fatal)', { err: e });
      }
    });

    return res.json({
      ok:            true,
      passId:        payload.passId,
      txId,
      kioskId,
      bayId:         bayId ?? null,
      amountIls,
      balanceBefore,
      balanceAfterIls: balanceAfter,
      washAuthorized: true,
    });

  } catch (err: any) {
    const status = err?.status || 500;
    const msg    = err?.message || 'REDEEM_FAILED';
    if (status < 500) return res.status(status).json({ ok: false, error: msg });
    logger.error('[PassRedeem] /redeem unexpected error', { err });
    return res.status(500).json({ ok: false, error: 'REDEEM_FAILED' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pass/redeem-online — Online booking server-side deduction
//
// No QR token needed — server debits directly when online booking is confirmed.
// Called from booking checkout when user selects "Pay with Prestige Pass".
// ─────────────────────────────────────────────────────────────────────────────
router.post('/redeem-online', redeemLimiter, async (req: Request, res: Response) => {
  // ⛔ SECURITY (2026-06): DISABLED. This was an UNAUTHENTICATED duplicate of
  // /api/prestige-pass/redeem-online — it trusted a client-supplied `userId`
  // (so the "ownership" check was spoofable) AND a client-supplied `amountIls`,
  // letting anyone debit ANY prestige pass by ANY amount, or under-charge their
  // own. It had ZERO callers (the app uses the canonical, session-authenticated
  // /api/prestige-pass/redeem-online). Returning 410 closes the hole safely.
  return res.status(410).json({
    ok: false,
    error: 'ENDPOINT_DISABLED',
    use: 'POST /api/prestige-pass/redeem-online',
  });

  /* eslint-disable no-unreachable */
  try {
    const parsed = redeemOnlineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_INPUT', details: parsed.error.flatten() });
    }
    const { userId, passId, bookingId, serviceType, amountIls } = parsed.data;

    // Ownership check from DB (no token needed — server-to-server call)
    const [pass] = await db
      .select()
      .from(petwashPassAccounts)
      .where(eq(petwashPassAccounts.passId, passId))
      .limit(1);

    if (!pass)              return res.status(404).json({ ok: false, error: 'PASS_NOT_FOUND' });
    if (pass.userId !== userId) return res.status(403).json({ ok: false, error: 'PASS_USER_MISMATCH' });

    const { txId, balanceBefore, balanceAfter } = await atomicLedgerEntry({
      passId,
      direction: 'DEBIT',
      amountIls,
      sourceType: 'ONLINE_BOOKING',
      sourceRef:  bookingId,
      metadata: { bookingId, serviceType },
    });

    logger.info('[PassRedeem] ✅ Online redemption', {
      passId, userId, bookingId, serviceType, amountIls, balanceBefore, balanceAfter, txId,
    });

    // Non-blocking Google Wallet update
    setImmediate(async () => {
      try {
        await pushUpdate({
          passId, userId, ownerName: pass.ownerName,
          primaryPetName: pass.primaryPetName ?? undefined,
          tier: pass.tier, availableCreditIls: balanceAfter,
          validUntil: pass.validUntil?.toISOString().split('T')[0],
          qrTokenVersion: pass.qrTokenVersion,
        });
      } catch { /* non-fatal */ }
    });

    return res.json({
      ok:             true,
      txId,
      passId,
      bookingId,
      serviceType,
      amountIls,
      balanceBefore,
      balanceAfterIls: balanceAfter,
    });

  } catch (err: any) {
    const status = err?.status || 500;
    const msg    = err?.message || 'REDEEM_FAILED';
    if (status < 500) return res.status(status).json({ ok: false, error: msg });
    logger.error('[PassRedeem] /redeem-online unexpected error', { err });
    return res.status(500).json({ ok: false, error: 'REDEEM_FAILED' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pass/topup · GET /api/pass/balance/:passId · GET /api/pass/ledger/:passId
//
// ⛔ SECURITY (2026-06-17): REMOVED. These three were mounted at /api/pass with only
// a rate limiter (`adminLimiter` is NOT auth) — i.e. fully UNAUTHENTICATED and
// internet-reachable:
//   • /topup           credited ANY passId by up to ₪100,000 with no caller identity.
//   • /balance/:passId leaked any pass's balance + tier + owner name by passId.
//   • /ledger/:passId  leaked any pass's full transaction history by passId.
// They had ZERO callers (client + server + tests). The canonical, authenticated
// equivalents live in /api/prestige-pass: /topup checks the session uid;
// /admin/manual-credit and /revoke-pass check customClaims.admin. Returning 410
// closes the hole safely. Do NOT re-enable without that session/admin auth.
// (The kiosk /redeem flow above is unaffected — it self-authenticates via HMAC.)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/topup', adminLimiter, (_req: Request, res: Response) =>
  res.status(410).json({ ok: false, error: 'ENDPOINT_DISABLED', use: 'POST /api/prestige-pass/admin/manual-credit' }),
);

router.get('/balance/:passId', adminLimiter, (_req: Request, res: Response) =>
  res.status(410).json({ ok: false, error: 'ENDPOINT_DISABLED', use: 'GET /api/prestige-pass (authenticated)' }),
);

router.get('/ledger/:passId', adminLimiter, (_req: Request, res: Response) =>
  res.status(410).json({ ok: false, error: 'ENDPOINT_DISABLED', use: 'GET /api/prestige-pass (authenticated)' }),
);

export default router;
