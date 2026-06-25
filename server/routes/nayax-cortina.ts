/**
 * Nayax Cortina (StaticQR) redemption — PRE-PAID wash at the K9000 bay.
 *
 * The rail (CEO + deep-research 2026-06-24, cited Nayax dev docs): the DOT QR
 * reader is INPUT-only and can't start a vend; "start the wash" comes from Nayax
 * cloud. We register PetWash AS a Cortina payment method, so Nayax calls US:
 *
 *   1. AUTHORISE  — customer scans their app QR at a bay; Nayax asks us to
 *      authorise on that bay's TerminalId. We resolve the bay (left/right),
 *      verify the user's PRE-PAID credit, and approve/decline. NO debit yet.
 *   2. SETTLEMENT — Nayax confirms the product vended on that TerminalId. We
 *      atomically DEBIT our own pre-paid ledger (wash-package / eGift / cash),
 *      open the bay session, and answer Approved (or Declined+code). The card
 *      is NEVER charged — this is the "already paid, wash free" path. Public
 *      walk-up card stays plain Nayax (Nayax charges).
 *
 * Which side: each bay carries its own nayaxQrReaderId + nayaxTerminalId, so the
 * scanning reader maps to (stationId, side).
 *
 * DARK until NAYAX_CORTINA_ENABLED=true (needs Nayax Cortina creds + per-bay
 * TerminalId mapping + "PreSelection Enabled = Yes"). The Nayax wire-format is
 * isolated in parseCortinaRequest / cortinaApprove / cortinaDecline — FINALISE
 * those field names against the live Cortina StaticQR spec when creds arrive; the
 * PetWash-side logic (resolve → verify → debit → release) is final.
 */
import { Router, type Request, type Response } from 'express';
import { db, pool } from '../db';
import { stationBays, walletAccounts } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { verifyPassLinkToken } from '../lib/passTokens';
import { authorizeRedemption, closeBaySession, type K9000RedemptionType } from '../services/K9000RedemptionService';
import { logger } from '../lib/logger';

const router = Router();

const RESERVATION_TTL_SECONDS = 120; // QR redemption window (matches the short-lived token)

function cortinaEnabled(): boolean {
  return (process.env.NAYAX_CORTINA_ENABLED || '').trim().toLowerCase() === 'true';
}

const isUniqueViolation = (e: any) => e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message));

/** Resolve which physical bay a Nayax TerminalId / DOT reader maps to. */
async function resolveBay(terminalId: string): Promise<{ stationId: string; side: 'left' | 'right'; bayId: string; status: string } | null> {
  if (!terminalId) return null;
  const [bay] = await db
    .select({ id: stationBays.id, stationId: stationBays.stationId, side: stationBays.side, status: stationBays.status })
    .from(stationBays)
    .where(or(eq(stationBays.nayaxQrReaderId, terminalId), eq(stationBays.nayaxTerminalId, terminalId)))
    .limit(1);
  if (!bay) return null;
  return { stationId: bay.stationId, side: bay.side as 'left' | 'right', bayId: bay.id, status: bay.status };
}

/** Pick the pre-paid credit to spend: package units first, then eGift, then cash. */
async function pickRedemptionType(userId: string): Promise<K9000RedemptionType | null> {
  const [w] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
  if (!w) return null;
  // Engine literals (K9000RedemptionType): gift_credit = eGift, wallet_balance = cash.
  if ((w.washPackageCredits ?? 0) >= 1) return 'wash_package';
  if ((w.egiftBalanceCents ?? 0) > 0) return 'gift_credit';
  if ((w.cashWalletBalanceCents ?? 0) > 0) return 'wallet_balance';
  return null;
}

/**
 * Nayax wire-format adapter (ISOLATED — finalise field names vs Cortina spec).
 * Cortina StaticQR posts the scanned code + the device's TerminalId/UniQR.
 */
function parseCortinaRequest(body: any): { terminalId: string; code: string; transactionId?: string; vended?: boolean } {
  const b = body ?? {};
  return {
    terminalId: String(b.TerminalId ?? b.terminalId ?? b.UniQR ?? b.uniqr ?? ''),
    code:       String(b.Code ?? b.code ?? b.Data ?? b.qr ?? ''),
    transactionId: b.TransactionId ?? b.transactionId,
    vended: b.Vended ?? b.vended ?? b.Success ?? b.success,
  };
}
const cortinaApprove = (extra: Record<string, unknown> = {}) => ({ Result: 'Approved', Approved: true, ...extra });
const cortinaDecline = (code: number, reason: string) => ({ Result: 'Declined', Approved: false, DeclineCode: code, reason });

// POST /api/nayax/cortina/authorize — Nayax asks: may this scan get a wash here?
router.post('/authorize', async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(992, 'cortina_disabled'));
  try {
    const { terminalId, code } = parseCortinaRequest(req.body);
    const bay = await resolveBay(terminalId);
    if (!bay) return res.json(cortinaDecline(5, 'bay_not_found'));
    if (bay.status !== 'ready') return res.json(cortinaDecline(6, `bay_${bay.status}`));

    let userId: string;
    try { userId = verifyPassLinkToken(code).userId; }
    catch { return res.json(cortinaDecline(1, 'invalid_or_expired_qr')); }

    const type = await pickRedemptionType(userId);
    if (!type) return res.json(cortinaDecline(1, 'no_prepaid_credit'));

    // RESERVE (TCC "Try"): hold the bay for this user. NO debit yet — SETTLEMENT
    // commits the money once Nayax confirms the vend. The two partial unique
    // indexes (one reserved per bay; one per user+station) make a dual-bay
    // double-scan impossible at the DB level.
    const reservationRef = `RES-${Date.now().toString(36)}-${nanoid(8)}`;
    try {
      await pool.query(
        `INSERT INTO k9000_redemption_reservations
           (reservation_ref, user_id, bay_id, station_id, side, redemption_type, idempotency_key,
            nayax_terminal_id, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'reserved', NOW() + ($9 || ' seconds')::interval)`,
        [reservationRef, userId, bay.bayId, bay.stationId, bay.side, type,
         `auth:${reservationRef}`, terminalId, String(RESERVATION_TTL_SECONDS)],
      );
    } catch (e: any) {
      if (isUniqueViolation(e)) return res.json(cortinaDecline(6, 'bay_or_user_already_reserved'));
      throw e;
    }

    logger.info('[Cortina] authorise OK — reserved', { terminalId, stationId: bay.stationId, side: bay.side, type, reservationRef });
    return res.json(cortinaApprove({ side: bay.side, reservationRef }));
  } catch (err: any) {
    logger.error('[Cortina] authorise error', { err: err?.message });
    return res.json(cortinaDecline(992, 'internal_error'));
  }
});

// POST /api/nayax/cortina/settlement — Nayax confirms the product vended → COMMIT.
router.post('/settlement', async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(992, 'cortina_disabled'));
  const { terminalId, code, transactionId, vended } = parseCortinaRequest(req.body);
  try {
    // If Nayax reports the product did NOT vend, take no money (reservation TTL-expires).
    if (vended === false) return res.json(cortinaApprove({ note: 'no_vend_no_charge' }));

    const bay = await resolveBay(terminalId);
    if (!bay) return res.json(cortinaDecline(5, 'bay_not_found'));

    let userId: string;
    try { userId = verifyPassLinkToken(code).userId; }
    catch { return res.json(cortinaDecline(1, 'invalid_or_expired_qr')); }

    // EXACTLY-ONCE: a replayed/late Settlement (same Nayax txn) finds the
    // reservation already committed → Approved, NO re-debit.
    const idemKey = `cortina:${terminalId}:${transactionId ?? code}`;
    const replay = await pool.query(
      `SELECT status, session_id FROM k9000_redemption_reservations WHERE idempotency_key = $1 LIMIT 1`,
      [idemKey],
    );
    if (replay.rows[0]?.status === 'committed') {
      return res.json(cortinaApprove({ replay: true, sessionId: replay.rows[0].session_id }));
    }

    // CLAIM the active reservation for this bay+user (atomic flip reserved→committed).
    let claimed;
    try {
      claimed = await pool.query(
        `UPDATE k9000_redemption_reservations
           SET status='committed', idempotency_key=$1, nayax_transaction_id=$2, committed_at=NOW(), updated_at=NOW()
         WHERE bay_id=$3 AND user_id=$4 AND status='reserved'
         RETURNING id, reservation_ref, redemption_type`,
        [idemKey, transactionId ?? null, bay.bayId, userId],
      );
    } catch (e: any) {
      if (isUniqueViolation(e)) return res.json(cortinaApprove({ replay: true })); // concurrent same-key settlement
      throw e;
    }
    if ((claimed.rowCount ?? 0) === 0) return res.json(cortinaDecline(1, 'no_active_reservation')); // expired / none

    const resv = claimed.rows[0];
    try {
      // COMMIT the money: atomic ledger debit + open bay session (NO card charge).
      const result = await authorizeRedemption({
        userId,
        redemptionType: resv.redemption_type as K9000RedemptionType,
        kioskId: bay.stationId,
        side: bay.side,
        correlationId: `cortina:${resv.reservation_ref}`,
      });
      await pool.query(`UPDATE k9000_redemption_reservations SET session_id=$1, updated_at=NOW() WHERE id=$2`, [result.sessionId, resv.id]);
      logger.info('[Cortina] committed — pre-paid wash debited', { terminalId, stationId: bay.stationId, side: bay.side, reservationRef: resv.reservation_ref, sessionId: result.sessionId });
      return res.json(cortinaApprove({ sessionId: result.sessionId, remaining: result.remainingBalance }));
    } catch (err: any) {
      // Debit failed AFTER claim (balance gone / bay busy) → roll the reservation
      // back so nothing hangs, and Nayax must NOT report a paid wash.
      await pool.query(`UPDATE k9000_redemption_reservations SET status='cancelled', updated_at=NOW() WHERE id=$1`, [resv.id]).catch(() => {});
      logger.warn('[Cortina] settlement debit declined', { terminalId, code: err?.code, err: err?.message });
      return res.json(cortinaDecline(1, err?.code || 'redemption_failed'));
    }
  } catch (err: any) {
    logger.error('[Cortina] settlement error', { err: err?.message });
    return res.json(cortinaDecline(992, 'internal_error'));
  }
});

/**
 * Release sweep (cron) — the RELEASE half of commit/release. The K9000 emits NO
 * "wash finished" signal, so we never wait for one:
 *   • reserved past TTL → 'expired' (no debit happened → nothing to compensate).
 *   • committed past the bay's max_wash_seconds ceiling → close the bay session
 *     so a bay can never hang 'busy'.
 */
export async function releaseStaleCortinaReservations(): Promise<{ expired: number; released: number }> {
  let expired = 0, released = 0;
  try {
    const e = await pool.query(
      `UPDATE k9000_redemption_reservations SET status='expired', updated_at=NOW() WHERE status='reserved' AND expires_at < NOW() RETURNING id`,
    );
    expired = e.rowCount ?? 0;
    const hung = await pool.query(
      `SELECT r.id, r.session_id FROM k9000_redemption_reservations r
         JOIN station_bays b ON b.id = r.bay_id
        WHERE r.status='committed' AND r.session_id IS NOT NULL
          AND r.committed_at < NOW() - (COALESCE(b.max_wash_seconds, 600) || ' seconds')::interval`,
    );
    for (const row of hung.rows) {
      try { await closeBaySession(row.session_id, 'timed_out'); released++; }
      catch (err: any) { logger.warn('[Cortina] release sweep: closeBaySession failed', { sessionId: row.session_id, err: err?.message }); }
    }
  } catch (err: any) {
    logger.error('[Cortina] release sweep error', { err: err?.message });
  }
  return { expired, released };
}

export default router;
