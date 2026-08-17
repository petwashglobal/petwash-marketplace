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
 * isolated in parseCortinaRequest / cortinaApprove / cortinaDecline. The field
 * names are now PRE-ALIGNED to the verified Cortina Static-QR spec (Nayax dev
 * portal, read via the Nayax MCP 2026-06-29): the nested shape
 * BasicInfo{Amount, CurrencyCode, TransactionId} / MachineInfo{Id} /
 * DeviceInfo{HwSerial}, with the legacy flat keys kept as fallbacks. Machine
 * identity keys on MachineInfo.Id (the stable virtual-machine id), NOT
 * DeviceInfo.HwSerial (changes on a device swap). Confirm exact casing against
 * the first live sandbox payload before flipping to production. The PetWash-side
 * logic (resolve → verify → reserve → debit → release/void) is final.
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db, pool } from '../db';
import { stationBays, walletAccounts } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { verifyQrRedeemToken } from '../lib/passTokens';

/**
 * Resolve the customer's userId from the DYNAMIC QR the bay reader scanned.
 *
 * ANTI-FRAUD (CEO rule 2026-07-06 "dynamic not static, no leak, no fraud"): the
 * redemption/money path accepts ONLY the short-lived (45s) `qr-redeem` token that
 * the app/dashboard/wallet rotates per redemption. We deliberately DO NOT accept
 * the durable `wallet-barcode` (365d) or `wallet-link` (72h) tokens here — those
 * are printed openly on the member pass ("Scan to identify") and could be
 * screenshotted and replayed by a third party to burn the victim's prepaid credit.
 * A rotating 45s QR can't be replayed. Identity-only lookups (staff) keep using
 * the durable barcode via server/routes/pass-redeem.ts; that flow moves no money.
 */
function resolveUserIdFromDynamicQr(code: string): string {
  return verifyQrRedeemToken(code).userId; // throws on any non-dynamic / expired QR
}
import { authorizeRedemption, closeBaySession, completeMemberRedemptionHold, type K9000RedemptionType } from '../services/K9000RedemptionService';
import { logger } from '../lib/logger';

const router = Router();

const RESERVATION_TTL_SECONDS = 120; // QR redemption window (matches the short-lived token)

function cortinaEnabled(): boolean {
  return (process.env.NAYAX_CORTINA_ENABLED || '').trim().toLowerCase() === 'true';
}

const isUniqueViolation = (e: any) => e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message));

/* ──────────────────────────────────────────────────────────────────────────────
   INBOUND CALLER AUTHENTICATION  (added 2026-08-17)

   These handlers are mounted under /api/webhooks/, which the global CSRF gate
   skips on the stated grounds that "HMAC-verified webhooks are authenticated
   out-of-band" (server/index.ts). That is true of server/routes/nayax-webhooks.ts
   (it runs validateNayaxSignature) — it was NOT true here: nothing verified the
   caller at all. With NAYAX_CORTINA_ENABLED=true, anyone on the internet who
   guessed a bay's Nayax TerminalId (they are printed on the hardware; ours are
   182443 / 182462) could POST /settlement and commit whichever reservation was
   open on that bay — debiting a real member's pre-paid credit and opening a bay
   session — or POST /void to cancel a paying member's hold, or spam /refund to
   flood the ops reconciliation queue.

   The guard is a constant-time shared-secret check. Nayax sends the operator's
   64-char Cortina Secret Token; we accept it on the documented body field
   (`SecretToken`) or, for proxies that strip bodies, on an Authorization: Bearer
   / X-Nayax-Secret header.

   FAIL-CLOSED ON MISCONFIGURATION: when Cortina is ENABLED but no inbound secret
   is configured, every callback is declined. Flipping the feature flag can
   therefore never, by itself, expose an anonymous money endpoint — the operator
   must set NAYAX_CORTINA_INBOUND_SECRET (defaults to NAYAX_CORTINA_SECRET_TOKEN,
   which is the same operator token) as a deliberate second step.
   ────────────────────────────────────────────────────────────────────────── */
function inboundSecret(): string {
  return (
    process.env.NAYAX_CORTINA_INBOUND_SECRET?.trim() ||
    process.env.NAYAX_CORTINA_SECRET_TOKEN?.trim() ||
    ''
  );
}

function timingSafeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function presentedSecret(req: Request): string {
  const b: any = req.body ?? {};
  const header =
    (req.headers['x-nayax-secret'] as string | undefined) ??
    (req.headers['x-cortina-secret'] as string | undefined) ??
    ((req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, ''));
  return String(
    b.SecretToken ?? b.secretToken ?? b.Secret ?? b.secret ??
    b.BasicInfo?.SecretToken ?? b.basicInfo?.secretToken ??
    header ?? '',
  ).trim();
}

/**
 * Returns null when the caller is authenticated, or the Cortina decline body to
 * send back when it is not. Decline code 5 = "suspected fraud" per the verified
 * StaticQR decline list — the correct signal for an unauthenticated caller.
 */
function rejectUnauthenticatedCaller(req: Request): Record<string, unknown> | null {
  const expected = inboundSecret();
  if (!expected) {
    logger.error('[Cortina] REFUSING callback — NAYAX_CORTINA_ENABLED=true but no inbound secret configured. Set NAYAX_CORTINA_INBOUND_SECRET.');
    return cortinaDecline(6, 'inbound_secret_not_configured'); // 6 = general system failure
  }
  if (!timingSafeEquals(presentedSecret(req), expected)) {
    logger.warn('[Cortina] REFUSING callback — bad or missing inbound secret', {
      path: req.path,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    });
    return cortinaDecline(5, 'unauthenticated_caller'); // 5 = suspected fraud
  }
  return null;
}

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
interface CortinaRequest {
  terminalId: string;       // resolves to a bay (matches nayaxTerminalId / nayaxQrReaderId)
  machineId?: string;       // verified spec: MachineInfo.Id (stable virtual-machine id)
  code: string;             // the scanned PetWash QR (signed pass-link token)
  transactionId?: string;   // Nayax txn id — idempotency anchor
  vended?: boolean;         // Settlement: did the product actually dispense?
  amount?: number;          // BasicInfo.Amount (for logging/validation; we debit our own price)
  currency?: string;        // BasicInfo.CurrencyCode (expected ILS)
  hwSerial?: string;        // DeviceInfo.HwSerial (log only — do NOT key identity on it)
}
function parseCortinaRequest(body: any): CortinaRequest {
  const b = body ?? {};
  // Verified Cortina Static-QR shape is nested; legacy flat keys kept as fallbacks.
  const basic   = b.BasicInfo   ?? b.basicInfo   ?? {};
  const machine = b.MachineInfo ?? b.machineInfo ?? {};
  const device  = b.DeviceInfo  ?? b.deviceInfo  ?? {};
  const machineId = String(machine.Id ?? machine.id ?? '') || undefined;
  // Verified StaticQR payloads put the operator-defined terminal id on
  // MachineInfo.TerminalId (spec: "Terminal identifier. Contact Nayax TPOC to
  // define") — that's what maps to a PetWash bay. Prefer it, then MachineInfo.Id
  // (stable virtual-machine id), then any flat/UniQR fallbacks. Never key on
  // DeviceInfo.HwSerial (it changes on a device swap).
  const machineTerminalId = String(machine.TerminalId ?? machine.terminalId ?? '') || undefined;
  return {
    terminalId: String(
      machineTerminalId ??
      b.TerminalId ?? b.terminalId ?? b.UniQR ?? b.uniqr ??
      basic.TerminalId ?? basic.terminalId ?? machineId ?? '',
    ),
    machineId,
    code:       String(b.Code ?? b.code ?? b.Data ?? b.qr ?? basic.Code ?? basic.code ?? ''),
    transactionId: b.TransactionId ?? b.transactionId ?? basic.TransactionId ?? basic.transactionId,
    vended: b.Vended ?? b.vended ?? b.Success ?? b.success,
    amount:   typeof basic.Amount === 'number' ? basic.Amount : undefined,
    currency: basic.CurrencyCode ?? basic.currencyCode ?? undefined,
    hwSerial: device.HwSerial ?? device.hwSerial ?? undefined,
  };
}
// Verified Cortina StaticQR RESPONSE contract (Nayax dev portal, all callbacks):
//   { Status: { Verdict: 'Approved'|'Declined', Code?: <decline code>, StatusMessage } }
// StatusMessage is the spec's documented "free text / additional varying data"
// field, so our internal refs (reservationRef, sessionId, …) ride there without
// polluting the contract. (Earlier drafts emitted {Result,Approved} — Nayax does
// not read that shape; it would break every approve/decline.)
// Decline codes are the verified StaticQR list: 1=insufficient funds, 2=txn id
// unknown, 5=suspected fraud, 6=general failure, 50=unknown machine id,
// 992=timeout, 999=general exception.
const cortinaApprove = (extra: Record<string, unknown> = {}) =>
  ({ Status: { Verdict: 'Approved', StatusMessage: Object.keys(extra).length ? JSON.stringify(extra) : 'approved' } });
const cortinaDecline = (code: number, reason: string) =>
  ({ Status: { Verdict: 'Declined', Code: code, StatusMessage: reason } });

// Nayax asks: may this scan get a wash here? (RESERVE, no debit yet.)
// PreAuthorization flow calls /Authorization; PreSelection flow calls /Sale.
// Same PetWash logic (verify credit → reserve → approve → the machine vends),
// so we answer BOTH, in the spec's PascalCase and our lowercase, so either
// Cortina machine configuration works without a code change.
router.post(['/authorize', '/sale', '/Authorization', '/Sale', '/staticqr/authorization', '/staticqr/sale'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  const unauth = rejectUnauthenticatedCaller(req);
  if (unauth) return res.status(401).json(unauth);
  try {
    const { terminalId, code } = parseCortinaRequest(req.body);
    const bay = await resolveBay(terminalId);
    if (!bay) return res.json(cortinaDecline(50, 'bay_not_found')); // 50 = Unknown machine Id (NOT 5=fraud)
    if (bay.status !== 'ready') return res.json(cortinaDecline(6, `bay_${bay.status}`));

    let userId: string;
    try { userId = resolveUserIdFromDynamicQr(code); }
    catch { return res.json(cortinaDecline(2, 'invalid_or_expired_qr')); } // 2 = Transaction ID unknown

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
    return res.json(cortinaDecline(999, 'internal_error')); // 999 = General exception
  }
});

// POST /api/nayax/cortina/settlement — Nayax confirms the product vended → COMMIT.
// Nayax confirms the product vended → COMMIT (debit the pre-paid ledger, open
// the bay session). PreAuthorization calls /Settlement; PreSelection calls the
// /Sale End Notification. Same commit logic serves both.
router.post(['/settlement', '/sale-end-notification', '/saleend', '/Settlement', '/SaleEndNotification', '/staticqr/settlement', '/staticqr/saleendnotification'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  const unauth = rejectUnauthenticatedCaller(req);
  if (unauth) return res.status(401).json(unauth);
  const { terminalId, code, transactionId, vended } = parseCortinaRequest(req.body);
  try {
    // If Nayax reports the product did NOT vend, take no money (reservation TTL-expires).
    if (vended === false) return res.json(cortinaApprove({ note: 'no_vend_no_charge' }));

    const bay = await resolveBay(terminalId);
    if (!bay) return res.json(cortinaDecline(50, 'bay_not_found')); // 50 = Unknown machine Id (NOT 5=fraud)

    // NOTE: we do NOT re-verify the scanned QR here. The dynamic (45s) redeem token
    // may already have expired between /authorize and this /settlement, which is
    // normal. Identity was bound at /authorize onto the reservation row; settlement
    // reads the userId back from that row, so the debit can't be pinned on the wrong
    // person and a late settlement can't fail on an expired token.
    const idemKey = `cortina:${terminalId}:${transactionId ?? code}`;
    // EXACTLY-ONCE: a replayed/late Settlement (same Nayax txn) finds the
    // reservation already committed → Approved, NO re-debit.
    const replay = await pool.query(
      `SELECT status, session_id FROM k9000_redemption_reservations WHERE idempotency_key = $1 LIMIT 1`,
      [idemKey],
    );
    if (replay.rows[0]?.status === 'committed') {
      return res.json(cortinaApprove({ replay: true, sessionId: replay.rows[0].session_id }));
    }

    // CLAIM the one active reservation for this bay (atomic flip reserved→committed).
    // The partial-unique index guarantees at most one 'reserved' row per bay, so
    // bay_id alone identifies it; we read the reserving user back from the row.
    let claimed;
    try {
      claimed = await pool.query(
        `UPDATE k9000_redemption_reservations
           SET status='committed', idempotency_key=$1, nayax_transaction_id=$2, committed_at=NOW(), updated_at=NOW()
         WHERE bay_id=$3 AND status='reserved'
         RETURNING id, reservation_ref, redemption_type, user_id`,
        [idemKey, transactionId ?? null, bay.bayId],
      );
    } catch (e: any) {
      if (isUniqueViolation(e)) return res.json(cortinaApprove({ replay: true })); // concurrent same-key settlement
      throw e;
    }
    if ((claimed.rowCount ?? 0) === 0) return res.json(cortinaDecline(992, 'no_active_reservation')); // 992 = Timeout (reservation TTL-expired)

    const resv = claimed.rows[0];
    try {
      // COMMIT the money: atomic ledger debit + open bay session (NO card charge).
      // userId comes from the reservation row bound at /authorize — never from a
      // (possibly expired) settlement token.
      const result = await authorizeRedemption({
        userId: resv.user_id,
        redemptionType: resv.redemption_type as K9000RedemptionType,
        kioskId: bay.stationId,
        side: bay.side,
        correlationId: `cortina:${resv.reservation_ref}`,
      });
      await pool.query(`UPDATE k9000_redemption_reservations SET session_id=$1, updated_at=NOW() WHERE id=$2`, [result.sessionId, resv.id]);
      // Settle the member's on-screen redeem hold so the app leaves the "show your
      // QR" step and refreshes the balance. Fail-soft, status-only — see
      // completeMemberRedemptionHold(). Without it the member sees no confirmation
      // of a wash they just paid for, and may re-present a rotated QR at the other bay.
      void completeMemberRedemptionHold({ userId: resv.user_id, baySessionId: result.sessionId, correlationId: `cortina:${resv.reservation_ref}` });
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
    return res.json(cortinaDecline(999, 'internal_error')); // 999 = General exception
  }
});

// POST /api/nayax/cortina/{void,cancel} — Nayax cancels a transaction → RELEASE.
// Verified Cortina Static-QR callbacks (Nayax dev portal). The SAME release logic
// serves both: /void is the PreSelection failure callback, /cancel is its
// PreAuthorization equivalent (auth-fail / vend-fail / no-response-timeout). Our
// authorise→settlement flow is PreAuthorization, so Nayax will call /cancel; we
// register /void too so either Cortina configuration works. Money-safe by case:
//   • still-RESERVED hold (NO debit happened) → flip to 'cancelled'. Trivial.
//   • already-COMMITTED redemption (money already left the pre-paid ledger) → a
//     refund, and the automated customer-refund rail is a KNOWN GAP
//     ([[refund-rail-gap-2026-06-22]]). We do NOT invent refund math here: we log
//     a CRITICAL reconciliation break for an operator and ACK.
//   • nothing matching → release any active reserve on the bay, then idempotent ACK.
// Ack-on-error is deliberate: a reserved hold TTL-expires via the sweep regardless,
// and a committed mismatch is caught by daily reconciliation — far safer than a
// decline that triggers a Nayax retry storm.
router.post(['/void', '/cancel', '/Void', '/Cancel', '/staticqr/void', '/staticqr/cancel'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  const unauth = rejectUnauthenticatedCaller(req);
  if (unauth) return res.status(401).json(unauth);
  const { terminalId, transactionId } = parseCortinaRequest(req.body);
  try {
    if (!transactionId) return res.json(cortinaApprove({ note: 'no_transaction_id_nothing_to_void' }));

    const found = await pool.query(
      `SELECT id, status, bay_id, station_id, session_id, reservation_ref
         FROM k9000_redemption_reservations
        WHERE nayax_transaction_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [transactionId],
    );
    const r = found.rows[0];

    if (!r) {
      // Void for a txn we never committed → release any active reserve on the bay, ack.
      const bay = await resolveBay(terminalId);
      if (bay) {
        await pool.query(
          `UPDATE k9000_redemption_reservations SET status='cancelled', updated_at=NOW()
             WHERE bay_id=$1 AND status='reserved'`,
          [bay.bayId],
        ).catch(() => {});
      }
      return res.json(cortinaApprove({ note: 'no_committed_txn_released_or_noop' }));
    }

    if (r.status === 'reserved') {
      await pool.query(`UPDATE k9000_redemption_reservations SET status='cancelled', updated_at=NOW() WHERE id=$1`, [r.id]);
      logger.info('[Cortina] void — released un-debited reservation', { transactionId, reservationRef: r.reservation_ref });
      return res.json(cortinaApprove({ released: true }));
    }

    if (r.status === 'committed') {
      // Money already debited — refund rail is a known gap. Flag, do NOT auto-refund.
      await pool.query(
        `INSERT INTO k9000_reconciliation_breaks
           (recon_date, break_type, bay_id, station_id, nayax_ref, petwash_session_id, severity, status, observed_json)
         VALUES (CURRENT_DATE, 'void_after_commit', $1, $2, $3, $4, 'critical', 'open', $5::jsonb)`,
        [r.bay_id, r.station_id, transactionId, r.session_id,
         JSON.stringify({ reservationRef: r.reservation_ref, reason: 'nayax_void_after_prepaid_debit_needs_manual_refund' })],
      ).catch((e: any) => logger.error('[Cortina] void recon-break insert failed', { err: e?.message }));
      logger.warn('[Cortina] void AFTER commit — flagged for manual refund (refund-rail gap)', { transactionId, reservationRef: r.reservation_ref });
      return res.json(cortinaApprove({ flaggedForRefund: true }));
    }

    return res.json(cortinaApprove({ idempotent: true, status: r.status })); // already cancelled/expired
  } catch (err: any) {
    logger.error('[Cortina] void/cancel error', { err: err?.message });
    return res.json(cortinaApprove({ note: 'void_ack_despite_error' }));
  }
});

// POST /api/nayax/cortina/refund — Nayax-initiated refund of a SETTLED transaction
// (triggered by Nayax's Dynamic Transaction Monitor or the Lynx Refund command).
// This is the legitimate refund of money already debited. The automated customer-
// refund rail is a KNOWN GAP ([[refund-rail-gap-2026-06-22]]) and this path is
// unverifiable without a live sandbox, so we do NOT execute blind refund math: we
// record a CRITICAL reconciliation break (break_type 'refund_requested') for an
// operator to action, and ACK. Wiring the real credit-back belongs in the audited
// refund rail, not here. Idempotent + ack-on-error (same rationale as void).
router.post(['/refund', '/Refund', '/staticqr/refund'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled'));
  const unauth = rejectUnauthenticatedCaller(req);
  if (unauth) return res.status(401).json(unauth);
  const { terminalId, transactionId, amount } = parseCortinaRequest(req.body);
  try {
    if (!transactionId) return res.json(cortinaApprove({ note: 'no_transaction_id_nothing_to_refund' }));

    const found = await pool.query(
      `SELECT id, status, bay_id, station_id, session_id, reservation_ref
         FROM k9000_redemption_reservations
        WHERE nayax_transaction_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [transactionId],
    );
    const r = found.rows[0];

    await pool.query(
      `INSERT INTO k9000_reconciliation_breaks
         (recon_date, break_type, bay_id, station_id, nayax_ref, petwash_session_id, severity, status, observed_json)
       VALUES (CURRENT_DATE, 'refund_requested', $1, $2, $3, $4, 'critical', 'open', $5::jsonb)`,
      [r?.bay_id ?? null, r?.station_id ?? null, transactionId, r?.session_id ?? null,
       JSON.stringify({ reservationRef: r?.reservation_ref ?? null, amount: amount ?? null, terminalId,
         reason: 'nayax_initiated_refund_needs_manual_credit_back' })],
    ).catch((e: any) => logger.error('[Cortina] refund recon-break insert failed', { err: e?.message }));

    logger.warn('[Cortina] refund requested — flagged for manual credit-back (refund-rail gap)', { transactionId, amount });
    return res.json(cortinaApprove({ flaggedForRefund: true }));
  } catch (err: any) {
    logger.error('[Cortina] refund error', { err: err?.message });
    return res.json(cortinaApprove({ note: 'refund_ack_despite_error' }));
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
