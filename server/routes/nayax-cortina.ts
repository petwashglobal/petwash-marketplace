/**
 * Nayax Cortina EXTERNAL PREPAID — the PetWash pre-paid wash at the K9000 bay.
 *
 * The rail: the black DOT reader at the bay scans the member's rotating QR and
 * hands it to the VPOS; Nayax then calls US, because PetWash is registered as
 * the (external prepaid) payment provider behind that reader. Every callback
 * below is Nayax → PetWash. We never charge a card here — we spend the
 * customer's OWN pre-paid credit (wash-package units, eGift, cash wallet).
 *
 * Verified against the Nayax Developer Zone on 2026-09-12
 * (devzone.nayax.com → Cortina → Prepaid Card → flows / Sale / Authorization /
 * Settlement / Void / Cancel / Sale End Notification / Start Session → auth):
 *
 *   PRE-SELECTION (how the K9000s are configured: "02 PreSelection Enabled")
 *     StartSession → /PrePaid/Sale (THE money call) → [optional] /SaleEndNotification
 *     vend fails / user cancels / Sale timeout → /PrePaid/Void  (reverse the charge)
 *
 *   PRE-AUTHORIZATION (answered too, so a config change on Nayax's side can't
 *   strand us)
 *     StartSession → /PrePaid/Authorization (hold) → /PrePaid/Settlement (commit)
 *     failure → /PrePaid/Cancel (release the hold)
 *
 * Money model (unchanged, migration 0076): a reservation row per scan with two
 * partial-unique indexes (one active per bay, one active per user+station) and
 * a unique idempotency key. Authorization = reserve (no debit). Sale = reserve
 * AND debit in the same request (there is no later commit call in
 * PreSelection). Settlement = debit an Authorization hold. Void/Cancel of a
 * still-reserved row = release; of a freshly-debited row = automatic,
 * idempotent compensation through autoCompensateSession (the same audited path
 * that refunds a START_PUMP failure). A cron sweep expires stale reservations
 * and closes hung bays.
 *
 * Callback authentication (spec-correct as of this file):
 *   1. IP allowlist — Nayax Israel production + QA addresses by default,
 *      overridable with NAYAX_CORTINA_ALLOWED_IPS. Fail-closed.
 *   2. StartSession — Nayax sends TokenId + 27-char RandomNumber; we answer with
 *      a 36-digit TransactionId encrypted under the shared secret (TranIDCipher).
 *      That id is stateless-signed (HMAC) and must come back on /Authorization
 *      and /Sale within 10 minutes (CORTINA_REQUIRE_START_SESSION, default on).
 *      The secret itself is NEVER in a request body — an earlier version of this
 *      file demanded body.SecretToken and would have declined every real call.
 *   3. The scanned QR is our own 45-second signed redeem token (verifyQrRedeemToken).
 *
 * URL to give Nayax as the integrator base:
 *   https://petwash.co.il/api/webhooks/nayax/cortina
 * Nayax appends /Cortina/StartSession, /Cortina/PrePaid/{Sale,Authorization,
 * Settlement,Void,Cancel,Refund} and /Cortina/SaleEndNotification; all of those
 * are registered below alongside the older short aliases.
 *
 * DARK until NAYAX_CORTINA_ENABLED=true (plus NAYAX_CORTINA_SECRET_TOKEN and the
 * per-bay nayaxTerminalId / nayaxQrReaderId mapping on station_bays).
 */
import express, { Router, type Request, type Response } from 'express';
import { db, pool } from '../db';
import { stationBays, walletAccounts } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { verifyQrRedeemToken } from '../lib/passTokens';
import { createIPAllowlist } from '../middleware/ipAllowlist';
import {
  encryptStartSession,
  issueStartSessionTransactionId,
  verifyStartSessionTransactionId,
} from '../lib/cortinaStartSession';
import {
  authorizeRedemption,
  autoCompensateSession,
  closeBaySession,
  type K9000RedemptionType,
  type RedemptionResult,
} from '../services/K9000RedemptionService';
import { logger } from '../lib/logger';
import {
  claimEvent as claimInboxEvent,
  markProcessing as markInboxProcessing,
  markCompleted as markInboxCompleted,
  markFailedRetryable as markInboxFailedRetryable,
} from '../lib/nayaxWebhookDedup';

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

const router = Router();

const RESERVATION_TTL_SECONDS = 120; // QR redemption window (matches the short-lived token)
/** A Void/Cancel that lands this soon after a debit is a failed vend → auto-compensate. Later = manual. */
const AUTO_COMPENSATE_WINDOW_MINUTES = 30;

function cortinaEnabled(): boolean {
  return (process.env.NAYAX_CORTINA_ENABLED || '').trim().toLowerCase() === 'true';
}
function cortinaSecret(): string {
  return (process.env.NAYAX_CORTINA_SECRET_TOKEN || '').trim();
}
/** Default ON: /Authorization and /Sale must carry a TransactionId we minted in /StartSession. */
function startSessionRequired(): boolean {
  const v = (process.env.CORTINA_REQUIRE_START_SESSION || 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'off';
}

// ── Body parsing ─────────────────────────────────────────────────────────────
// server/index.ts deliberately skips the global express.json() for everything
// under /api/webhooks/nayax/ (the raw-body webhook families verify HMACs over
// the exact bytes). Cortina is plain JSON with no body signature, so this
// router MUST parse its own body — before this line every callback arrived
// with req.body undefined and would have declined with "missing parameters".
router.use(express.json({ limit: '256kb', type: () => true }));

// ── Network allowlist ────────────────────────────────────────────────────────
// Nayax Israel production + QA servers (devzone.nayax.com → Cortina → Network
// requirements, read 2026-09-12). Override with NAYAX_CORTINA_ALLOWED_IPS
// (comma-separated IPs/CIDRs) once Nayax confirms the exact callback sources.
// createIPAllowlist is fail-closed: empty list → 503, unknown IP → 403.
export const CORTINA_DEFAULT_NAYAX_IPS = [
  '185.159.232.2', '84.110.125.194', '82.102.172.206', '212.179.76.198', // IL production
  '31.154.55.2',                                                          // QA / sandbox
].join(',');
if (!(process.env.NAYAX_CORTINA_ALLOWED_IPS || '').trim()) {
  process.env.NAYAX_CORTINA_ALLOWED_IPS = CORTINA_DEFAULT_NAYAX_IPS;
}
router.use(createIPAllowlist('NAYAX_CORTINA_ALLOWED_IPS', 'Cortina'));

const isUniqueViolation = (e: any) => e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message));
const violatedConstraint = (e: any): string => String(e?.constraint || '');

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
 * Nayax wire-format adapter. Verified Cortina Prepaid request shape:
 *   BasicInfo{TransactionId, NayaxTransactionId, Amount (MAJOR units), CurrencyCode, IsProductSelected}
 *   MachineInfo{Id, TerminalId, Name} · DeviceInfo{HwSerial} · CardData{CardNumber, EntryMode}
 *   PaymentInfo{SrvTranId}
 * Legacy flat keys are kept as fallbacks so an older sandbox payload still parses.
 */
interface CortinaRequest {
  terminalId: string;           // resolves to a bay (matches nayaxTerminalId / nayaxQrReaderId)
  machineId?: string;           // MachineInfo.Id (stable virtual-machine id)
  code: string;                 // the scanned PetWash QR (signed 45s redeem token)
  transactionId?: string;       // BasicInfo.TransactionId — our StartSession id when used
  nayaxTransactionId?: string;  // BasicInfo.NayaxTransactionId (int64) — Nayax's own reference
  srvTranId?: string;           // PaymentInfo.SrvTranId — our reservationRef echoed back
  amount?: number;              // BasicInfo.Amount, MAJOR units (5.5 = ₪5.50); we debit our own price
  currency?: string;            // BasicInfo.CurrencyCode (expected ILS / 376)
  hwSerial?: string;            // DeviceInfo.HwSerial (log only — do NOT key identity on it)
}
function parseCortinaRequest(body: any): CortinaRequest {
  const b = body ?? {};
  // Verified Cortina shape is nested; legacy flat keys kept as fallbacks.
  const basic   = b.BasicInfo   ?? b.basicInfo   ?? {};
  const machine = b.MachineInfo ?? b.machineInfo ?? {};
  const device  = b.DeviceInfo  ?? b.deviceInfo  ?? {};
  const payment = b.PaymentInfo ?? b.paymentInfo ?? {};
  const machineId = String(machine.Id ?? machine.id ?? '') || undefined;
  // MachineInfo.TerminalId is the operator-defined terminal id ("Contact Nayax
  // TPOC to define") — that's what maps to a PetWash bay. Prefer it, then
  // MachineInfo.Id (stable virtual-machine id), then any flat/UniQR fallbacks.
  // Never key on DeviceInfo.HwSerial (it changes on a device swap).
  const machineTerminalId = String(machine.TerminalId ?? machine.terminalId ?? '') || undefined;
  // VERIFIED against the Nayax dev portal (Cortina External Prepaid, 2026-08-12):
  // when the DOT reader scans a QR, the scanned content arrives as
  // CardData.CardNumber with CardData.EntryMode === "QR" ("Card number read from a
  // QR by the DOT" — /reference/cortina/cortina-prepaid/cortina-prepaid-sale). Our
  // earlier flat b.Code/b.qr guesses never appear in the real payload, so `code`
  // resolved to '' and EVERY redemption declined (code 2). Read CardData first; the
  // old keys stay only as belt-and-suspenders fallbacks.
  const cardData = b.CardData ?? b.cardData ?? {};
  const entryMode = String(cardData.EntryMode ?? cardData.entryMode ?? '').toUpperCase();
  const qrFromCard = entryMode === 'QR' ? (cardData.CardNumber ?? cardData.cardNumber) : undefined;
  const rawAmount = basic.Amount ?? basic.amount;
  return {
    terminalId: String(
      machineTerminalId ??
      b.TerminalId ?? b.terminalId ?? b.UniQR ?? b.uniqr ??
      basic.TerminalId ?? basic.terminalId ?? machineId ?? '',
    ),
    machineId,
    code:       String(qrFromCard ?? cardData.CardNumber ?? cardData.cardNumber ?? b.Code ?? b.code ?? b.Data ?? b.qr ?? basic.Code ?? basic.code ?? ''),
    transactionId: strOrUndef(b.TransactionId ?? b.transactionId ?? basic.TransactionId ?? basic.transactionId),
    nayaxTransactionId: strOrUndef(basic.NayaxTransactionId ?? basic.nayaxTransactionId ?? b.NayaxTransactionId),
    srvTranId: strOrUndef(payment.SrvTranId ?? payment.srvTranId),
    amount:   typeof rawAmount === 'number' ? rawAmount : (rawAmount != null && rawAmount !== '' && !Number.isNaN(Number(rawAmount)) ? Number(rawAmount) : undefined),
    currency: basic.CurrencyCode ?? basic.currencyCode ?? undefined,
    hwSerial: device.HwSerial ?? device.hwSerial ?? undefined,
  };
}
function strOrUndef(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

// ── Response contract (verified: every callback answers {Status:{Verdict,Code,StatusMessage,CustomDeclineCode}}) ──
// Approvals may also carry PaymentInfo.SrvTranId (our reference — mandatory when
// StartSession is not used, harmless otherwise) and Balance (what the customer
// has left: RegularCreditType 0 = counted in transactions/washes, 1 = amount).
// Decline codes are the verified Prepaid list: 1 insufficient funds, 2 transaction
// id unknown, 5 suspected fraud, 6 general system failure, 7 invalid amount,
// 9 not allowed to cardholder, 992 timeout, 996 StartSession id unknown/duplicate,
// 997 missing mandatory parameters, 999 general exception. (50 "unknown machine"
// exists only in the StaticQR product — NOT valid here; bay lookup failures are 6.)
type CortinaBalance = { RegularCreditType: 0 | 1; RegularCredit: number };
const cortinaApprove = (extra: Record<string, unknown> = {}, opts: { srvTranId?: string; balance?: CortinaBalance } = {}) => ({
  Status: { Verdict: 'Approved', StatusMessage: Object.keys(extra).length ? JSON.stringify(extra).slice(0, 255) : 'approved' },
  ...(opts.srvTranId ? { PaymentInfo: { SrvTranId: opts.srvTranId } } : {}),
  ...(opts.balance ? { Balance: opts.balance } : {}),
});
const cortinaDecline = (code: number, reason: string) =>
  ({ Status: { Verdict: 'Declined', Code: code, StatusMessage: reason, CustomDeclineCode: reason } });

function balanceFromResult(r: RedemptionResult): CortinaBalance {
  return r.remainingUnit === 'washes'
    ? { RegularCreditType: 0, RegularCredit: r.remainingBalance }
    : { RegularCreditType: 1, RegularCredit: Math.round(r.remainingBalance) / 100 }; // agorot → ₪ (major units, like BasicInfo.Amount)
}

/** Map an authorizeRedemption failure onto the Cortina decline list. */
function declineCodeForDebitError(err: any): number {
  const code = String(err?.code || err?.name || '');
  if (/^INSUFFICIENT_/.test(code)) return 1;
  if (code === 'WALLET_NOT_FOUND' || code === 'WALLET_SUSPENDED') return 9;
  return 6; // BAY_*, RACE_CONDITION, BayAlreadyBusyError, anything else = system-side
}

// Nayax may quote the currency as ISO alpha-3 ('ILS') or as ISO-4217 numeric
// ('376' as string or number). PetWash operates on the Israel Shekel only and
// every K9000 SKU price is denominated in agorot — a callback quoting USD
// would silently pass through settlement math as if it were ILS. Accept only
// ILS/376/empty; refuse anything else. Empty is allowed because some Cortina
// callback types legitimately omit currency; the real authoritative price is
// our own WASH_PRICE_ILS_CENTS. (Lane B audit 2026-08-22.)
function isIlsCurrency(currency: unknown): boolean {
  if (currency === undefined || currency === null || currency === '') return true;
  const s = String(currency).trim().toUpperCase();
  return s === 'ILS' || s === '376';
}

/**
 * How old a TransactionId may be on a CLOSING callback.
 *
 * NOT the session TTL. START_SESSION_TXN_TTL_MS is 10 minutes because the spec
 * caps how long a scan may sit unused before /Authorization. Settlement arrives
 * when the WASH ENDS, and a wash routinely runs longer than ten minutes, so
 * reusing the session TTL here would decline legitimate settlements — the exact
 * failure #2396 fixed. The MAC is what authenticates; age is only a replay
 * bound, and one day is far inside the reservation lifetime.
 */
const CORTINA_CALLBACK_TXN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Origin check for the calls that CLOSE a transaction (/Settlement, /Void,
 * /Refund).
 *
 * WHY THIS EXISTS (2026-09-12). These three were guarded by cortinaEnabled()
 * alone — an env flag, not authentication. /Settlement resolves a bay from the
 * terminal id (a number printed on the machine), claims the one active
 * reservation on it, and performs a real ledger DEBIT via authorizeRedemption.
 * So anyone who could reach the endpoint while a customer had a live
 * reservation could spend that customer's credit and open the bay. /Void can
 * release a live reservation; /Refund can raise unlimited critical
 * recon-breaks.
 *
 * A pin written in the 2026-08-20 audit said exactly this — "anyone reaching
 * /settlement could trigger a real ledger DEBIT against a live reservation" —
 * and it had been red since #2396 narrowed the guard to the two opening calls.
 * Nobody saw it, because no CI job ran that file until the fiscal gate started
 * matching it by pattern.
 *
 * The TransactionId is not a bare identifier: /StartSession mints it as
 * timestamp + nonce + HMAC under NAYAX_CORTINA_SECRET_TOKEN. Verifying the MAC
 * proves the caller is replaying an id WE issued, which a forger cannot produce
 * without the secret — and a genuine Nayax callback always carries it.
 */
function assertCortinaCallbackOrigin(
  parsed: CortinaRequest,
  body: any,
): ReturnType<typeof cortinaDecline> | null {
  const secret = cortinaSecret();
  if (!secret) {
    logger.error('[Cortina] NAYAX_CORTINA_SECRET_TOKEN not set while NAYAX_CORTINA_ENABLED=true — refusing (fail-closed)');
    return cortinaDecline(6, 'secret_not_configured');
  }
  const echoed = strOrUndef(body?.SecretToken ?? body?.secretToken);
  if (echoed !== undefined) {
    const a = Buffer.from(echoed, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto') as typeof import('crypto');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logger.warn('[Cortina] closing callback rejected — SecretToken echoed but wrong');
      return cortinaDecline(5, 'bad_secret');
    }
  }
  if (startSessionRequired()) {
    const v = verifyStartSessionTransactionId(
      secret, parsed.transactionId || '', Date.now(), CORTINA_CALLBACK_TXN_MAX_AGE_MS,
    );
    if (!v.ok) {
      logger.warn('[Cortina] closing callback rejected — TransactionId not one we minted', {
        reason: v.reason, terminalId: parsed.terminalId,
      });
      return cortinaDecline(996, `transaction_id_${v.reason}`);
    }
  }
  return null;
}

/**
 * Session authentication for the two calls that START a transaction
 * (/Authorization, /Sale). Spec: "validate that the Transaction ID ... was
 * created in a previous Start Session request and is still valid".
 * Returns a decline body, or null when the caller is accepted.
 *
 * Also honours an OPTIONAL body.SecretToken echo: not part of the spec, but if
 * a sandbox configuration sends it, a WRONG value is still refused (5).
 */
function assertCortinaSession(parsed: CortinaRequest, body: any): ReturnType<typeof cortinaDecline> | null {
  const secret = cortinaSecret();
  if (!secret) {
    logger.error('[Cortina] NAYAX_CORTINA_SECRET_TOKEN not set while NAYAX_CORTINA_ENABLED=true — refusing (fail-closed)');
    return cortinaDecline(6, 'secret_not_configured');
  }
  const echoed = strOrUndef(body?.SecretToken ?? body?.secretToken);
  if (echoed !== undefined) {
    const a = Buffer.from(echoed, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto') as typeof import('crypto');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logger.warn('[Cortina] inbound rejected — SecretToken echoed but wrong');
      return cortinaDecline(5, 'bad_secret');
    }
  }
  if (startSessionRequired()) {
    const v = verifyStartSessionTransactionId(secret, parsed.transactionId || '');
    if (!v.ok) {
      logger.warn('[Cortina] inbound rejected — TransactionId not from a live StartSession', { reason: v.reason, terminalId: parsed.terminalId });
      return cortinaDecline(996, `transaction_id_${v.reason}`);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/StartSession — the authentication handshake.
// Nayax: {TokenId, RandomNumber(27)} → us: {TranIDCipher, Status:{Verdict}}.
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/StartSession', '/start-session', '/Cortina/StartSession'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json({ TranIDCipher: '', ...cortinaDecline(6, 'cortina_disabled') });
  try {
    const b = req.body ?? {};
    const tokenId = strOrUndef(b.TokenId ?? b.tokenId ?? b.TokenID);
    const random = strOrUndef(b.RandomNumber ?? b.randomNumber ?? b.RandomString ?? b.randomString);
    if (!tokenId || !random || random.length !== 27) {
      return res.json({ TranIDCipher: '', ...cortinaDecline(997, 'missing_or_invalid_parameters') });
    }
    const secret = cortinaSecret();
    if (!secret) {
      logger.error('[Cortina] StartSession refused — NAYAX_CORTINA_SECRET_TOKEN not set (fail-closed)');
      return res.status(503).json({ TranIDCipher: '', ...cortinaDecline(6, 'secret_not_configured') });
    }
    const transactionId = issueStartSessionTransactionId(secret);
    const TranIDCipher = encryptStartSession({ secretToken: secret, transactionId, randomString: random });
    logger.info('[Cortina] StartSession issued', { tokenId, txnPrefix: transactionId.slice(0, 10) }); // never the cipher or the full id
    return res.json({ TranIDCipher, Status: { Verdict: 'Approved', StatusMessage: 'ok' } });
  } catch (err: any) {
    logger.error('[Cortina] StartSession error', { err: err?.message });
    return res.json({ TranIDCipher: '', ...cortinaDecline(999, 'internal_error') });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/PrePaid/Authorization — PRE-AUTHORIZATION flow: may this scan
// get a wash here? RESERVE only; /Settlement commits, /Cancel releases.
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/authorize', '/Authorization', '/Cortina/PrePaid/Authorization', '/staticqr/authorization'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  try {
    const parsed = parseCortinaRequest(req.body);
    const { terminalId, code } = parsed;
    if (!terminalId || !code) return res.json(cortinaDecline(997, 'missing_terminal_or_card_data'));
    const sessionReject = assertCortinaSession(parsed, req.body);
    if (sessionReject) return res.json(sessionReject);
    if (!isIlsCurrency(parsed.currency)) {
      logger.warn('[Cortina] authorise refused — non-ILS currency', { terminalId, currency: parsed.currency });
      return res.json(cortinaDecline(7, 'currency_not_ils'));
    }
    const bay = await resolveBay(terminalId);
    if (!bay) return res.json(cortinaDecline(6, 'bay_not_found')); // unknown terminal — 50 is NOT a Prepaid code
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
            nayax_terminal_id, nayax_transaction_id, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved', NOW() + ($10 || ' seconds')::interval)`,
        [reservationRef, userId, bay.bayId, bay.stationId, bay.side, type,
         `auth:${reservationRef}`, terminalId, parsed.transactionId ?? null, String(RESERVATION_TTL_SECONDS)],
      );
    } catch (e: any) {
      if (isUniqueViolation(e)) return res.json(cortinaDecline(6, 'bay_or_user_already_reserved'));
      throw e;
    }

    logger.info('[Cortina] authorise OK — reserved', { terminalId, stationId: bay.stationId, side: bay.side, type, reservationRef, nayaxTransactionId: parsed.nayaxTransactionId });
    return res.json(cortinaApprove({ side: bay.side, reservationRef }, { srvTranId: reservationRef }));
  } catch (err: any) {
    logger.error('[Cortina] authorise error', { err: err?.message });
    return res.json(cortinaDecline(999, 'internal_error')); // 999 = General exception
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/PrePaid/Sale — PRE-SELECTION flow: THE money call.
// The customer already picked the wash on the K9000; Nayax asks us once. There
// is no later commit (/SaleEndNotification is optional reporting), so this
// handler reserves AND debits in the same request. Exactly-once on the Nayax
// TransactionId; a replay answers Approved without a second debit.
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/sale', '/Sale', '/Cortina/PrePaid/Sale', '/staticqr/sale'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  const parsed = parseCortinaRequest(req.body);
  const { terminalId, code, transactionId } = parsed;
  if (!terminalId || !code || !transactionId) return res.json(cortinaDecline(997, 'missing_terminal_card_or_transaction_id'));
  const sessionReject = assertCortinaSession(parsed, req.body);
  if (sessionReject) return res.json(sessionReject);
  if (!isIlsCurrency(parsed.currency)) {
    logger.warn('[Cortina] sale refused — non-ILS currency', { terminalId, transactionId, currency: parsed.currency });
    return res.json(cortinaDecline(7, 'currency_not_ils'));
  }

  // Webhook-inbox audit + state machine (RECEIVED → COMPLETED) so a handler
  // exception can't quietly drop the one money call of the PreSelection flow.
  const inboxEventId = `cortina-sale:${terminalId}:${transactionId}`;
  const idemKey = `cortina:${terminalId}:${transactionId}`;
  try {
    const decision = await claimInboxEvent({ eventId: inboxEventId, sourceRoute: req.originalUrl || req.url });
    if (decision.decision === 'dedup') {
      const prior = await pool.query(`SELECT status, session_id, reservation_ref FROM k9000_redemption_reservations WHERE idempotency_key = $1 LIMIT 1`, [idemKey]);
      const p = prior.rows[0];
      if (p?.status === 'committed') return res.json(cortinaApprove({ replay: true, sessionId: p.session_id }, { srvTranId: p.reservation_ref }));
      return res.json(cortinaDecline(6, 'replayed_sale_was_not_approved'));
    }
    if (decision.decision === 'conflict') {
      return res.status(503).json(cortinaDecline(6, 'inbox_in_flight')); // Nayax retries; a decline would read as fraud
    }
    await markInboxProcessing(inboxEventId);
  } catch (inboxErr: any) {
    logger.error('[Cortina] sale inbox claim failed — failing closed', { err: inboxErr?.message });
    return res.status(503).json(cortinaDecline(6, 'inbox_unavailable'));
  }
  const markInboxDone = async () => { try { await markInboxCompleted(inboxEventId); } catch { /* non-fatal */ } };
  const markInboxRetry = async (c: string) => { try { await markInboxFailedRetryable(inboxEventId, c); } catch { /* non-fatal */ } };

  try {
    const bay = await resolveBay(terminalId);
    if (!bay) { await markInboxDone(); return res.json(cortinaDecline(6, 'bay_not_found')); }
    if (bay.status !== 'ready') { await markInboxDone(); return res.json(cortinaDecline(6, `bay_${bay.status}`)); }

    let userId: string;
    try { userId = resolveUserIdFromDynamicQr(code); }
    catch { await markInboxDone(); return res.json(cortinaDecline(2, 'invalid_or_expired_qr')); }

    const type = await pickRedemptionType(userId);
    if (!type) { await markInboxDone(); return res.json(cortinaDecline(1, 'no_prepaid_credit')); }

    // EXACTLY-ONCE on the Nayax TransactionId: a late/duplicate Sale finds the
    // reservation already committed → Approved, NO re-debit.
    const replay = await pool.query(`SELECT status, session_id, reservation_ref FROM k9000_redemption_reservations WHERE idempotency_key = $1 LIMIT 1`, [idemKey]);
    if (replay.rows[0]?.status === 'committed') {
      await markInboxDone();
      return res.json(cortinaApprove({ replay: true, sessionId: replay.rows[0].session_id }, { srvTranId: replay.rows[0].reservation_ref }));
    }

    // RESERVE first (the partial-unique indexes block a concurrent dual-bay
    // double-scan and a second scanner on the same bay), keyed on the Nayax
    // TransactionId so the SAME Sale can never insert twice.
    const reservationRef = `RES-${Date.now().toString(36)}-${nanoid(8)}`;
    let rowId: string;
    try {
      const ins = await pool.query(
        `INSERT INTO k9000_redemption_reservations
           (reservation_ref, user_id, bay_id, station_id, side, redemption_type, idempotency_key,
            nayax_terminal_id, nayax_transaction_id, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved', NOW() + ($10 || ' seconds')::interval)
         RETURNING id`,
        [reservationRef, userId, bay.bayId, bay.stationId, bay.side, type, idemKey, terminalId, transactionId, String(RESERVATION_TTL_SECONDS)],
      );
      rowId = ins.rows[0].id;
    } catch (e: any) {
      if (isUniqueViolation(e)) {
        await markInboxDone();
        if (violatedConstraint(e) === 'uq_k9res_idempotency') return res.json(cortinaDecline(6, 'sale_in_flight')); // same txn racing itself
        return res.json(cortinaDecline(6, 'bay_or_user_already_reserved'));
      }
      throw e;
    }

    // COMMIT in the same request: flip reserved→committed (guarded on status so
    // the sweep can't race us), then the atomic ledger debit + bay session.
    const claimed = await pool.query(
      `UPDATE k9000_redemption_reservations
         SET status='committed', committed_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND status='reserved'
       RETURNING id, reservation_ref, redemption_type, user_id`,
      [rowId],
    );
    if ((claimed.rowCount ?? 0) === 0) { await markInboxDone(); return res.json(cortinaDecline(992, 'reservation_lost_before_commit')); }
    const resv = claimed.rows[0];
    try {
      const result = await authorizeRedemption({
        userId: resv.user_id,
        redemptionType: resv.redemption_type as K9000RedemptionType,
        kioskId: bay.stationId,
        side: bay.side,
        correlationId: `cortina-sale:${resv.reservation_ref}`,
      });
      await pool.query(`UPDATE k9000_redemption_reservations SET session_id=$1, updated_at=NOW() WHERE id=$2`, [result.sessionId, resv.id]);
      logger.info('[Cortina] SALE committed — pre-paid wash debited', {
        terminalId, transactionId, nayaxTransactionId: parsed.nayaxTransactionId,
        stationId: bay.stationId, side: bay.side, reservationRef: resv.reservation_ref, sessionId: result.sessionId,
      });
      await markInboxDone();
      return res.json(cortinaApprove({ sessionId: result.sessionId }, { srvTranId: resv.reservation_ref, balance: balanceFromResult(result) }));
    } catch (err: any) {
      // Debit failed AFTER claim (balance gone / bay busy) → roll the reservation
      // back so nothing hangs, and Nayax must NOT vend.
      await pool.query(`UPDATE k9000_redemption_reservations SET status='cancelled', updated_at=NOW() WHERE id=$1`, [resv.id]).catch(() => {});
      logger.warn('[Cortina] sale debit declined', { terminalId, transactionId, code: err?.code, err: err?.message });
      await markInboxDone(); // business decline — a retry can't help
      return res.json(cortinaDecline(declineCodeForDebitError(err), err?.code || 'redemption_failed'));
    }
  } catch (err: any) {
    logger.error('[Cortina] sale error', { err: err?.message });
    await markInboxRetry('cortina_sale_exception');
    return res.json(cortinaDecline(999, 'internal_error')); // 999 = General exception
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/PrePaid/Settlement — PRE-AUTHORIZATION flow: Nayax confirms
// the product vended → COMMIT the hold (debit the pre-paid ledger, open the bay
// session). Exactly-once on the Nayax TransactionId.
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/settlement', '/Settlement', '/Cortina/PrePaid/Settlement', '/staticqr/settlement'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  const parsedSettle = parseCortinaRequest(req.body);
  const { terminalId, code, transactionId } = parsedSettle;
  if (!terminalId) return res.json(cortinaDecline(997, 'missing_terminal_id'));
  // Before ANY reservation is touched: this call commits a ledger debit.
  const settleReject = assertCortinaCallbackOrigin(parsedSettle, req.body);
  if (settleReject) return res.json(settleReject);
  if (!isIlsCurrency(parsedSettle.currency)) {
    logger.warn('[Cortina] settlement refused — non-ILS currency', { terminalId, transactionId, currency: parsedSettle.currency });
    return res.json(cortinaDecline(7, 'currency_not_ils'));
  }

  // Webhook-inbox audit + state machine (P0-A, 2026-08-20). The k9000
  // reservation table already guarantees exactly-once for the money debit;
  // this second-layer inbox captures the *event* itself (RECEIVED → COMPLETED)
  // so that a handler exception can't quietly drop a settlement callback.
  // Only wired when Nayax gave us a transactionId — replay-tolerant.
  let inboxEventId: string | null = null;
  if (transactionId) {
    inboxEventId = `cortina-settlement:${terminalId ?? ''}:${transactionId}`;
    try {
      const decision = await claimInboxEvent({ eventId: inboxEventId, sourceRoute: req.originalUrl || req.url });
      if (decision.decision === 'dedup') {
        return res.json(cortinaApprove({ replay: true, inbox: 'completed' }));
      }
      if (decision.decision === 'conflict') {
        // Fresh concurrent processing — Nayax retries later. Cortina spec
        // treats 5xx as "no response" (timeout code 992 will fire on the
        // retry side); a decline here would be misinterpreted as fraud.
        return res.status(503).json(cortinaDecline(6, 'inbox_in_flight'));
      }
      await markInboxProcessing(inboxEventId);
    } catch (inboxErr: any) {
      logger.error('[Cortina] inbox claim failed — failing closed', { err: inboxErr?.message });
      return res.status(503).json(cortinaDecline(6, 'inbox_unavailable'));
    }
  }

  const markInboxDone = async () => { if (inboxEventId) { try { await markInboxCompleted(inboxEventId); } catch { /* non-fatal */ } } };
  const markInboxRetry = async (c: string) => { if (inboxEventId) { try { await markInboxFailedRetryable(inboxEventId, c); } catch { /* non-fatal */ } } };

  try {
    const bay = await resolveBay(terminalId);
    if (!bay) { await markInboxDone(); return res.json(cortinaDecline(6, 'bay_not_found')); }

    // NOTE: we do NOT re-verify the scanned QR here. The dynamic (45s) redeem token
    // may already have expired between /Authorization and this /Settlement, which is
    // normal. Identity was bound at /Authorization onto the reservation row; settlement
    // reads the userId back from that row, so the debit can't be pinned on the wrong
    // person and a late settlement can't fail on an expired token.
    const idemKey = `cortina:${terminalId}:${transactionId ?? code}`;
    // EXACTLY-ONCE: a replayed/late Settlement (same Nayax txn) finds the
    // reservation already committed → Approved, NO re-debit.
    const replay = await pool.query(
      `SELECT status, session_id, reservation_ref FROM k9000_redemption_reservations WHERE idempotency_key = $1 LIMIT 1`,
      [idemKey],
    );
    if (replay.rows[0]?.status === 'committed') {
      await markInboxDone();
      return res.json(cortinaApprove({ replay: true, sessionId: replay.rows[0].session_id }, { srvTranId: replay.rows[0].reservation_ref }));
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
      if (isUniqueViolation(e)) { await markInboxDone(); return res.json(cortinaApprove({ replay: true })); } // concurrent same-key settlement
      throw e;
    }
    if ((claimed.rowCount ?? 0) === 0) { await markInboxDone(); return res.json(cortinaDecline(992, 'no_active_reservation')); } // 992 = Timeout (reservation TTL-expired)

    const resv = claimed.rows[0];
    try {
      // COMMIT the money: atomic ledger debit + open bay session (NO card charge).
      // userId comes from the reservation row bound at /Authorization — never from a
      // (possibly expired) settlement token.
      const result = await authorizeRedemption({
        userId: resv.user_id,
        redemptionType: resv.redemption_type as K9000RedemptionType,
        kioskId: bay.stationId,
        side: bay.side,
        correlationId: `cortina:${resv.reservation_ref}`,
      });
      await pool.query(`UPDATE k9000_redemption_reservations SET session_id=$1, updated_at=NOW() WHERE id=$2`, [result.sessionId, resv.id]);
      logger.info('[Cortina] committed — pre-paid wash debited', { terminalId, stationId: bay.stationId, side: bay.side, reservationRef: resv.reservation_ref, sessionId: result.sessionId });
      await markInboxDone();
      return res.json(cortinaApprove({ sessionId: result.sessionId }, { srvTranId: resv.reservation_ref, balance: balanceFromResult(result) }));
    } catch (err: any) {
      // Debit failed AFTER claim (balance gone / bay busy) → roll the reservation
      // back so nothing hangs, and Nayax must NOT report a paid wash.
      await pool.query(`UPDATE k9000_redemption_reservations SET status='cancelled', updated_at=NOW() WHERE id=$1`, [resv.id]).catch(() => {});
      logger.warn('[Cortina] settlement debit declined', { terminalId, code: err?.code, err: err?.message });
      // Debit failure is a business decline — no retry helps. Mark COMPLETED.
      await markInboxDone();
      return res.json(cortinaDecline(declineCodeForDebitError(err), err?.code || 'redemption_failed'));
    }
  } catch (err: any) {
    logger.error('[Cortina] settlement error', { err: err?.message });
    await markInboxRetry('cortina_settlement_exception');
    return res.json(cortinaDecline(999, 'internal_error')); // 999 = General exception
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/SaleEndNotification — OPTIONAL reporting after a PreSelection
// Sale. Carries BasicInfo/PaymentInfo only (NO MachineInfo, NO CardData), so it
// must never resolve a bay and must never move money: the debit already
// happened in /Sale. Always acknowledged Approved; a decline here would only
// confuse Nayax's reporting.
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/sale-end-notification', '/saleend', '/SaleEndNotification', '/Cortina/SaleEndNotification', '/staticqr/saleendnotification'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled'));
  const parsed = parseCortinaRequest(req.body);
  try {
    if (parsed.transactionId) {
      const touched = await pool.query(
        `UPDATE k9000_redemption_reservations SET updated_at=NOW() WHERE nayax_transaction_id=$1 AND status='committed' RETURNING reservation_ref`,
        [parsed.transactionId],
      );
      logger.info('[Cortina] SaleEndNotification', {
        transactionId: parsed.transactionId, nayaxTransactionId: parsed.nayaxTransactionId,
        amount: parsed.amount, matchedReservation: touched.rows[0]?.reservation_ref ?? null,
      });
    } else {
      logger.info('[Cortina] SaleEndNotification without TransactionId — acknowledged');
    }
  } catch (err: any) {
    logger.warn('[Cortina] SaleEndNotification bookkeeping failed (acknowledged anyway)', { err: err?.message });
  }
  return res.json(cortinaApprove({ acknowledged: true }));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/PrePaid/{Void,Cancel} — Nayax reverses a transaction.
// /Void is the PreSelection callback (vend failed / user cancelled / Sale
// timeout), /Cancel its PreAuthorization equivalent. One handler serves both.
// Money-safe by case:
//   • still-RESERVED hold (NO debit happened) → flip to 'cancelled'.
//   • COMMITTED within the last 30 minutes with a bay session → the vend
//     failed right after we debited → autoCompensateSession(): the same
//     idempotent, audited credit-back the START_PUMP failure path uses.
//     The reservation flips to 'cancelled' and an INFO recon row records it.
//   • COMMITTED long ago / no session / compensation threw → CRITICAL open
//     recon break for an operator. We never invent refund math here.
//   • nothing matching → release any active reserve on the bay, idempotent ACK.
// Ack-on-error is deliberate: a reserved hold TTL-expires via the sweep
// regardless, and a committed mismatch is caught by daily reconciliation — far
// safer than a decline that triggers a Nayax retry storm.
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/void', '/cancel', '/Void', '/Cancel', '/Cortina/PrePaid/Void', '/Cortina/PrePaid/Cancel', '/staticqr/void', '/staticqr/cancel'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled')); // 6 = General system failure
  const parsed = parseCortinaRequest(req.body);
  const { terminalId, transactionId } = parsed;
  try {
    if (!transactionId) return res.json(cortinaApprove({ note: 'no_transaction_id_nothing_to_void' }));
    // Placed AFTER the no-op above: that path touches nothing, and declining it
    // would change a harmless ack into a failure for no security gain.
    const voidReject = assertCortinaCallbackOrigin(parsed, req.body);
    if (voidReject) return res.json(voidReject);

    const found = await pool.query(
      `SELECT id, status, bay_id, station_id, session_id, reservation_ref,
              (committed_at IS NOT NULL AND committed_at > NOW() - ($2 || ' minutes')::interval) AS fresh_commit
         FROM k9000_redemption_reservations
        WHERE nayax_transaction_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [transactionId, String(AUTO_COMPENSATE_WINDOW_MINUTES)],
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
      // Money already left the pre-paid ledger.
      if (r.fresh_commit && r.session_id) {
        try {
          await autoCompensateSession(r.session_id); // idempotent + audited credit-back, bay released
          await pool.query(`UPDATE k9000_redemption_reservations SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status='committed'`, [r.id]);
          await pool.query(
            `INSERT INTO k9000_reconciliation_breaks
               (recon_date, break_type, bay_id, station_id, nayax_ref, petwash_session_id, severity, status, observed_json)
             VALUES (CURRENT_DATE, 'void_after_commit', $1, $2, $3, $4, 'info', 'resolved', $5::jsonb)`,
            [r.bay_id, r.station_id, transactionId, r.session_id,
             JSON.stringify({ reservationRef: r.reservation_ref, nayaxTransactionId: parsed.nayaxTransactionId ?? null, reason: 'vend_failed_auto_compensated' })],
          ).catch((e: any) => logger.error('[Cortina] void recon-row insert failed', { err: e?.message }));
          logger.info('[Cortina] void AFTER commit — auto-compensated (credit returned)', { transactionId, reservationRef: r.reservation_ref, sessionId: r.session_id });
          return res.json(cortinaApprove({ compensated: true }));
        } catch (compErr: any) {
          logger.error('[Cortina] void after commit — auto-compensation failed, flagging for manual refund', { transactionId, err: compErr?.message });
        }
      }
      // Old commit, no session, or compensation failed → operator queue. No blind refund math.
      await pool.query(
        `INSERT INTO k9000_reconciliation_breaks
           (recon_date, break_type, bay_id, station_id, nayax_ref, petwash_session_id, severity, status, observed_json)
         VALUES (CURRENT_DATE, 'void_after_commit', $1, $2, $3, $4, 'critical', 'open', $5::jsonb)`,
        [r.bay_id, r.station_id, transactionId, r.session_id,
         JSON.stringify({ reservationRef: r.reservation_ref, nayaxTransactionId: parsed.nayaxTransactionId ?? null, freshCommit: !!r.fresh_commit, reason: 'nayax_void_after_prepaid_debit_needs_manual_refund' })],
      ).catch((e: any) => logger.error('[Cortina] void recon-break insert failed', { err: e?.message }));
      logger.warn('[Cortina] void AFTER commit — flagged for manual refund', { transactionId, reservationRef: r.reservation_ref });
      return res.json(cortinaApprove({ flaggedForRefund: true }));
    }

    return res.json(cortinaApprove({ idempotent: true, status: r.status })); // already cancelled/expired
  } catch (err: any) {
    logger.error('[Cortina] void/cancel error', { err: err?.message });
    return res.json(cortinaApprove({ note: 'void_ack_despite_error' }));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST …/Cortina/PrePaid/Refund — Nayax-initiated refund of a SETTLED
// transaction (Nayax Core / Lynx). This is a legitimate refund of money already
// debited, hours or days later. The automated customer-refund rail is a KNOWN
// GAP ([[refund-rail-gap-2026-06-22]]), so we do NOT execute blind refund math:
// we record a CRITICAL reconciliation break ('refund_requested') for an
// operator to action, and ACK. Idempotent + ack-on-error (same rationale as void).
// ─────────────────────────────────────────────────────────────────────────────
router.post(['/refund', '/Refund', '/Cortina/PrePaid/Refund', '/staticqr/refund'], async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(6, 'cortina_disabled'));
  const parsedRefund = parseCortinaRequest(req.body);
  const { terminalId, transactionId, amount } = parsedRefund;
  if (!isIlsCurrency(parsedRefund.currency)) {
    logger.warn('[Cortina] refund refused — non-ILS currency', { terminalId, transactionId, currency: parsedRefund.currency });
    return res.json(cortinaDecline(7, 'currency_not_ils'));
  }
  try {
    if (!transactionId) return res.json(cortinaApprove({ note: 'no_transaction_id_nothing_to_refund' }));
    const refundReject = assertCortinaCallbackOrigin(parsedRefund, req.body);
    if (refundReject) return res.json(refundReject);

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
         nayaxTransactionId: parsedRefund.nayaxTransactionId ?? null, reason: 'nayax_initiated_refund_needs_manual_credit_back' })],
    ).catch((e: any) => logger.error('[Cortina] refund recon-break insert failed', { err: e?.message }));

    logger.warn('[Cortina] refund requested — flagged for manual credit-back (refund-rail gap)', { transactionId, amount });
    return res.json(cortinaApprove({ flaggedForRefund: true }));
  } catch (err: any) {
    logger.error('[Cortina] refund error', { err: err?.message });
    return res.json(cortinaApprove({ note: 'refund_ack_despite_error' }));
  }
});

/**
 * Release sweep (cron, every minute — server/backgroundJobs.ts) — the RELEASE
 * half of commit/release. The K9000 emits NO "wash finished" signal, so we never
 * wait for one:
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
