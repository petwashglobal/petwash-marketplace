/**
 * JOB WATCHDOG — every hour, cross-examine recently completed provider jobs and
 * put anything suspicious in front of a Pet Wash admin (/admin/alerts).
 *
 * READ-ONLY. It never holds, releases or changes money or a booking: the payout
 * itself is already human-only (payoutHumanApproval.ts). It makes sure the human
 * sees the evidence problems without having to go looking.
 *
 * Noise rule: a walk is not alerted only because it has no customer confirmation
 * (walks have no confirm step today) — alerts fire on a block, or on any other warning.
 */
import { pool } from '../db';
import { logger } from '../lib/logger';
import { evaluateJobEvidence, type EvidenceReport } from './jobEvidence';

export function shouldAlert(r: EvidenceReport): boolean {
  if (r.verdict === 'blocked') return true;
  return r.findings.some((f) => f.severity === 'warn' && f.code !== 'NO_CUSTOMER_CONFIRMATION')
    || (r.kind === 'booking_request' && r.findings.some((f) => f.code === 'NO_CUSTOMER_CONFIRMATION'));
}

export async function runJobEvidenceWatchdog(opts: { days?: number; limit?: number } = {}): Promise<{
  checked: number; alerted: number; blocked: number;
}> {
  const days = opts.days ?? 7;
  const limit = Math.min(opts.limit ?? 300, 1000);
  const { loadWalkEvidence, loadBookingRequestEvidence } = await import('./jobEvidenceLoader');
  const { createOrUpdateAlert, resolveClearedByPrefix } = await import('./AlertEngine');

  const jobs: string[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT request_id AS id FROM booking_requests
        WHERE status IN ('provider_marked_complete', 'completed')
          AND updated_at > now() - ($1 || ' days')::interval
        ORDER BY updated_at DESC LIMIT $2`, [String(days), limit]);
    jobs.push(...rows.map((r: any) => String(r.id)));
  } catch (e) {
    logger.warn('[JobWatchdog] booking_requests scan failed', { err: (e as Error).message });
  }
  try {
    const { rows } = await pool.query(
      `SELECT booking_id AS id FROM walk_bookings
        WHERE status = 'completed' AND actual_end_time > now() - ($1 || ' days')::interval
        ORDER BY actual_end_time DESC LIMIT $2`, [String(days), limit]);
    jobs.push(...rows.map((r: any) => String(r.id)));
  } catch (e) {
    logger.warn('[JobWatchdog] walk_bookings scan failed', { err: (e as Error).message });
  }

  const keys: string[] = [];
  let alerted = 0;
  let blocked = 0;
  for (const id of jobs) {
    try {
      const ev = /^WALK-/i.test(id) ? await loadWalkEvidence(id) : await loadBookingRequestEvidence(id);
      if (!ev) continue;
      const r = evaluateJobEvidence(ev);
      if (r.verdict === 'blocked') blocked++;
      if (!shouldAlert(r)) continue;
      const dedupeKey = `job_evidence:${id}`;
      keys.push(dedupeKey);
      alerted++;
      await createOrUpdateAlert({
        dedupeKey,
        category: 'provider',
        severity: r.verdict === 'blocked' ? 'critical' : 'warning',
        title: r.verdict === 'blocked' ? 'Provider job evidence BLOCKS payout' : 'Provider job needs a closer look',
        message: `${r.kind} ${id}: ${r.findings.map((f) => `${f.code} — ${f.detail}`).join(' · ')}`.slice(0, 1800),
        linkedEntityType: r.kind,
        linkedEntityId: id,
        source: 'auto_sweep',
        metadata: { verdict: r.verdict, codes: r.findings.map((f) => f.code), measured: r.measured },
      });
    } catch (e) {
      logger.warn('[JobWatchdog] job check failed', { id, err: (e as Error).message });
    }
  }
  await resolveClearedByPrefix('job_evidence:', keys);
  logger.info('[JobWatchdog] sweep done', { checked: jobs.length, alerted, blocked });
  return { checked: jobs.length, alerted, blocked };
}
