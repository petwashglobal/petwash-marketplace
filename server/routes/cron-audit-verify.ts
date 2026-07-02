/**
 * Cloud-Scheduler audit-chain verification (money-integrity audit, 2026-07-03).
 *
 * The audit_ledger is a hash-chained tamper-evidence log for money/loyalty/pass
 * events. It was WRITTEN but NEVER VERIFIED in production — so a broken chain (a
 * deleted row, a naively edited row, a reordering) would go unnoticed. This
 * endpoint walks the chain nightly and ALERTS on any break.
 *
 * What it checks (honest scope):
 *   - LINKAGE: every row's previousHash == the prior row's currentHash.
 *   - SEQUENCE: blockNumber is strictly contiguous (no gaps = no deleted rows;
 *     blockNumber is UNIQUE at write, so no forks).
 * What it does NOT do: recompute each row's content hash. The chain uses a plain
 * SHA-256 (no server secret), so a full-DB-access attacker who recomputes the
 * whole chain forward could evade even a content check — the real hardening is
 * to move the hash to an HMAC keyed by a Secret-Manager secret (follow-up).
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — same pattern
 * as cron-backup.ts / cron-compliance.ts. Read-only; writes no money. CSRF-exempt
 * via the /api/cron mount.
 *
 * Cloud Scheduler (ops, after deploy):
 *   gcloud scheduler jobs create http petwash-audit-verify \
 *     --location=me-west1 --schedule="0 4 * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/audit-verify" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { pool } from '../db';
import { alertManager } from '../lib/alerts';

const router = Router();

async function authorized(req: Request): Promise<boolean> {
  const provided = (req.headers['x-cron-secret'] as string) || '';
  const expected = process.env.CRON_SECRET || '';
  const { timingSafeEqual } = await import('crypto');
  const secretOk =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (secretOk) return true;
  const email = (req as any).firebaseUser?.email || (req as any).user?.email || '';
  return isSuperAdmin(email);
}

// POST /api/cron/audit-verify?limit=200000
router.post('/audit-verify', async (req: Request, res: Response) => {
  if (!(await authorized(req))) {
    logger.warn('[CronAuditVerify] Unauthorized trigger', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  // Bound the scan; if the ledger ever exceeds this, we LOG the cap (never a
  // silent truncation) and verify the most recent window.
  const limit = Math.min(1_000_000, Math.max(1000, parseInt(String(req.query.limit ?? '200000'), 10) || 200000));

  try {
    // Newest `limit` rows, then verify oldest→newest within the window.
    const { rows } = await pool.query(
      `SELECT id, block_number, previous_hash, current_hash
         FROM audit_ledger
        ORDER BY block_number DESC
        LIMIT $1`,
      [limit],
    );
    rows.reverse(); // now ascending by block_number

    const [{ rows: countRows }] = [await pool.query('SELECT COUNT(*)::int AS n FROM audit_ledger')];
    const total = countRows[0]?.n ?? rows.length;
    const capped = total > rows.length;

    const breaks: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      if (cur.previous_hash !== prev.current_hash) {
        breaks.push(`link break at block ${cur.block_number} (id ${cur.id}): previousHash != prior currentHash`);
      }
      if (Number(cur.block_number) !== Number(prev.block_number) + 1) {
        breaks.push(`sequence gap between block ${prev.block_number} and ${cur.block_number} (deleted/missing row?)`);
      }
      if (breaks.length >= 50) { breaks.push('… more breaks suppressed'); break; }
    }

    const ok = breaks.length === 0;
    logger.info('[CronAuditVerify] Chain verified', { scanned: rows.length, total, capped, ok, breakCount: breaks.length });

    if (!ok) {
      // A broken money-audit chain is a CRITICAL integrity event — page it.
      await alertManager.triggerAlert({
        name: 'AUDIT_CHAIN_INTEGRITY_BREAK',
        message: `audit_ledger chain verification found ${breaks.length} break(s). First: ${breaks[0]}`,
        severity: 'critical',
        timestamp: new Date(),
        metadata: { scanned: rows.length, total, capped, breaks: breaks.slice(0, 10) },
      }).catch((e: any) => logger.error('[CronAuditVerify] alert failed', { error: e?.message }));
    }

    return res.json({ success: true, ok, scanned: rows.length, total, capped, breakCount: breaks.length, breaks: breaks.slice(0, 10) });
  } catch (err: any) {
    logger.error('[CronAuditVerify] Verification failed', { error: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'verify_failed' });
  }
});

export default router;
