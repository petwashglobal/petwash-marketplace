/**
 * Cloud-Scheduler Nayax → SUMIT fiscal automation — the hands-off bookkeeping rail.
 *
 * Runs the Nayax→SUMIT bridge for the whole K9000 fleet on a schedule: pull each
 * bay's settled public credit-card sales and issue a SUMIT חשבונית מס/קבלה for each,
 * so every live sale is documented automatically — the accounting firm and the ITA
 * just see clean, complete books. No manual step per sale, ever.
 *
 * Fleet: NAYAX_BRIDGE_MACHINE_IDS (comma-separated), default the two Kfar Saba bays
 * 182443 (ולד ימין / right) + 182462 (ולד שמאל / left).
 *
 * SAFE TO SCHEDULE NOW: the bridge is QUADRUPLE-dark — this cron is a complete
 * NO-OP until SUMIT is wired AND Lynx is wired AND NAYAX_SUMIT_BRIDGE_ENABLED=true
 * AND NAYAX_SUMIT_CUTOVER_AT is set. Prepaid member-redeems are never
 * re-documented.
 *
 * ON IDEMPOTENCY (corrected 2026-09-06). This comment used to claim the rail was
 * "idempotent (deterministic key per Nayax tx), so overlapping runs can never
 * double-issue a document". That was NOT true, and it mattered most for the one
 * thing that cannot be undone — a tax invoice:
 *
 *   - the deterministic key reached SUMIT only as an Idempotency-Key header and
 *     an ExternalReference, and SUMIT deduplicates on NEITHER. That is exactly
 *     why read-before-recreate (findDocumentByExternalReference) had to be built;
 *   - candidates were selected from the live Nayax feed alone, consulting nothing
 *     persisted, and nothing recorded the document afterwards.
 *
 * Run hourly over a rolling window, that would have issued a fresh invoice for
 * every eligible wash on every run. Idempotency is now REAL and comes from the
 * claim ledger (nayax_sale_issuance_attempts): its unique index on
 * (machine_id, nayax_transaction_id) means a second run cannot take the claim,
 * and a claim that cannot be taken is never a reason to create. Issuance without
 * that ledger refuses outright rather than falling back.
 *
 * THE CUTOVER IS NOT OPTIONAL (2026-09-06). Only transactions settled at or after
 * NAYAX_SUMIT_CUTOVER_AT are individually invoiced here. Everything settled before
 * it is withheld — this rail must never be what turns historical turnover into
 * per-transaction invoices, which is what a manual backfill did on 05/09/2026 with
 * the cutover set to 2026-01-01.
 *
 * Withholding is ALL this cron decides. Which historical treatment actually applies
 * to a withheld transaction — it already has an individual final document, it is
 * covered by a consolidated one, or it remains unresolved — is recorded from the
 * bookkeeper's direction and from what SUMIT is observed to contain. Not inferred
 * here, and not by whoever next edits this file.
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — identical to
 * cron-compliance.ts / cron-backup.ts. CSRF-exempt via the /api/cron mount.
 *
 * Cloud Scheduler setup (ops, after deploy — run hourly during trading hours):
 *   gcloud scheduler jobs create http petwash-nayax-sumit \
 *     --location=me-west1 --schedule="0 * * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/nayax-sumit-reconcile" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { isSuperAdminVerified } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { reconcileMachineToSumit, bridgeWired } from '../services/nayaxSumitBridge';
import { pgSaleIssuanceStore } from '../services/nayaxSaleIssuance';
import { pool } from '../db';
import { NAYAX_TERMINALS } from '../services/nayaxTerminals';

const router = Router();

// All FOUR live Kfar Saba bays. Override via NAYAX_BRIDGE_MACHINE_IDS.
//
// 2026-09-06 — this was hardcoded '182443,182462' (Wald only), while the Green
// Park 80 bays 182374/182403 have been taking money since July. Derived from the
// terminal registry instead, so the fleet and the station/bay labelling cannot
// drift apart: adding a bay in one place adds it in both.
const DEFAULT_MACHINE_IDS = Object.keys(NAYAX_TERMINALS).join(',');

function fleetMachineIds(): string[] {
  return (process.env.NAYAX_BRIDGE_MACHINE_IDS || DEFAULT_MACHINE_IDS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function authorized(req: Request): Promise<boolean> {
  const provided = (req.headers['x-cron-secret'] as string) || '';
  const expected = process.env.CRON_SECRET || '';
  const { timingSafeEqual } = await import('crypto');
  const secretOk =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (secretOk) return true;
  // #240 migration: allowlist + email_verified. Cron secret handled above; UID path is the only one that can bypass without a shared secret.
  return isSuperAdminVerified(req as any);
}

// POST /api/cron/nayax-sumit-reconcile[?dryRun=true]
// Runs the bridge for every fleet machine. Live issuance requires the bridge to be
// fully wired (the reconcile call itself enforces that); dryRun=true forces preview.
router.post('/nayax-sumit-reconcile', async (req: Request, res: Response) => {
  if (!(await authorized(req))) {
    logger.warn('[CronNayaxSumit] Unauthorized trigger', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const forceDryRun = String(req.query.dryRun ?? '') === 'true';
  const machineIds = fleetMachineIds();
  const wired = bridgeWired();

  const perMachine: Array<Record<string, unknown>> = [];
  let totalCandidates = 0;
  let totalIssued = 0;
  let totalFailed = 0;

  for (const machineId of machineIds) {
    try {
      const r = await reconcileMachineToSumit(machineId, {
        dryRun: forceDryRun ? true : false,
        claimStore: pgSaleIssuanceStore(pool),
      });
      totalCandidates += r.candidateCount;
      totalIssued += r.issued;
      totalFailed += r.failed;
      perMachine.push({
        machineId, ok: r.ok, dryRun: r.dryRun,
        candidateCount: r.candidateCount, issued: r.issued, failed: r.failed,
        error: r.error, status: r.status,
      });
    } catch (err: any) {
      logger.error('[CronNayaxSumit] machine failed', { machineId, err: err?.message });
      perMachine.push({ machineId, ok: false, error: 'exception' });
    }
  }

  const summary = {
    success: true,
    wired,                       // shows what's still needed to go live (booleans only)
    machineCount: machineIds.length,
    totalCandidates, totalIssued, totalFailed,
    perMachine,
  };
  logger.info('[CronNayaxSumit] run complete', {
    machineCount: machineIds.length, canIssue: wired.canIssue,
    totalCandidates, totalIssued, totalFailed,
  });
  return res.json(summary);
});

export default router;
