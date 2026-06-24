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
import { db } from '../db';
import { stationBays, walletAccounts } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassLinkToken } from '../lib/passTokens';
import { authorizeRedemption, type K9000RedemptionType } from '../services/K9000RedemptionService';
import { logger } from '../lib/logger';

const router = Router();

function cortinaEnabled(): boolean {
  return (process.env.NAYAX_CORTINA_ENABLED || '').trim().toLowerCase() === 'true';
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
  if ((w.washPackageCredits ?? 0) >= 1) return 'wash_package';
  if ((w.egiftBalanceCents ?? 0) > 0) return 'egift';
  if ((w.cashWalletBalanceCents ?? 0) > 0) return 'cash';
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

    logger.info('[Cortina] authorise OK', { terminalId, stationId: bay.stationId, side: bay.side, type });
    // Approve — do NOT debit here; the SETTLEMENT call debits after the vend.
    return res.json(cortinaApprove({ side: bay.side }));
  } catch (err: any) {
    logger.error('[Cortina] authorise error', { err: err?.message });
    return res.json(cortinaDecline(992, 'internal_error'));
  }
});

// POST /api/nayax/cortina/settlement — Nayax confirms the product vended.
router.post('/settlement', async (req: Request, res: Response) => {
  if (!cortinaEnabled()) return res.status(503).json(cortinaDecline(992, 'cortina_disabled'));
  const { terminalId, code, transactionId, vended } = parseCortinaRequest(req.body);
  try {
    // If Nayax reports the product did NOT vend, take no money.
    if (vended === false) return res.json(cortinaApprove({ note: 'no_vend_no_charge' }));

    const bay = await resolveBay(terminalId);
    if (!bay) return res.json(cortinaDecline(5, 'bay_not_found'));

    let userId: string;
    try { userId = verifyPassLinkToken(code).userId; }
    catch { return res.json(cortinaDecline(1, 'invalid_or_expired_qr')); }

    const type = await pickRedemptionType(userId);
    if (!type) return res.json(cortinaDecline(1, 'no_prepaid_credit'));

    // ATOMIC debit of our pre-paid ledger + bay session (no card charge).
    const result = await authorizeRedemption({
      userId,
      redemptionType: type,
      kioskId: bay.stationId,
      side: bay.side,
      correlationId: `cortina:${transactionId ?? terminalId}:${Date.now().toString(36)}`,
    });
    logger.info('[Cortina] settled — pre-paid wash debited', { terminalId, stationId: bay.stationId, side: bay.side, type, sessionId: result.sessionId });
    return res.json(cortinaApprove({ sessionId: result.sessionId, remaining: result.remainingBalance }));
  } catch (err: any) {
    // Balance gone / bay busy / velocity → decline; Nayax must NOT report a paid wash.
    logger.warn('[Cortina] settlement declined', { terminalId, code: err?.code, err: err?.message });
    return res.json(cortinaDecline(1, err?.code || 'redemption_failed'));
  }
});

export default router;
