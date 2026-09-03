/**
 * Post-release 2026-09-03 (backlog P1): fiscal outbox admin surface.
 *
 * The drainer + retry loop already ship in the release. Ops needed a
 * read + action surface so `failed_needs_review` rows the drainer
 * flags don't sit invisibly forever. This router is deliberately
 * minimal:
 *
 *   GET  /api/admin/fiscal-outbox               — list rows (paged),
 *                                                  filter ?status,?kind.
 *   GET  /api/admin/fiscal-outbox/:id           — one row's full detail.
 *   POST /api/admin/fiscal-outbox/:id/force-retry
 *                                               — reset attempts, set
 *                                                 next_attempt_at=now(),
 *                                                 status=pending. Drainer
 *                                                 will pick it up next tick.
 *   POST /api/admin/fiscal-outbox/:id/mark-reviewed
 *                                               — human ackowledged a
 *                                                 permanent failure; row
 *                                                 stays failed_needs_review
 *                                                 but is stamped with
 *                                                 reviewed_at/actor for
 *                                                 the audit chain.
 *
 * Auth: mounted under `/api/admin/*` which already carries adminLimiter
 * + Firebase + role guard + MFA + read-only mutations gates. The two
 * write endpoints add an extra `isSuperAdminVerified(req)` check so
 * only a verified super-admin can force-retry or mark-reviewed a
 * fiscal document — money-adjacent action, verified-email required
 * even beyond the admin role.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { logger } from '../lib/logger';
import { isSuperAdminVerified } from '../middleware/rbac';

const router = Router();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

/** GET /api/admin/fiscal-outbox — list rows (paged). */
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    );
    const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);

    const clauses: string[] = [];
    const params: any[] = [];
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    if (kind) {
      params.push(kind);
      clauses.push(`kind = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT id, kind, source_key, status, attempts, last_error,
              next_attempt_at, created_at, updated_at, succeeded_at
         FROM fiscal_document_outbox
         ${where}
         ORDER BY updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return res.json({
      rows: rows.rows,
      count: rows.rowCount,
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error('[AdminFiscalOutbox] list failed', { error: err?.message });
    return res.status(500).json({ error: 'fiscal_outbox_list_failed' });
  }
});

/** GET /api/admin/fiscal-outbox/:id — one row's full detail (incl. payload). */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id, kind, source_key, payload, status, attempts, last_error,
              next_attempt_at, created_at, updated_at, succeeded_at
         FROM fiscal_document_outbox
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ row: r.rows[0] });
  } catch (err: any) {
    logger.error('[AdminFiscalOutbox] detail failed', { error: err?.message });
    return res.status(500).json({ error: 'fiscal_outbox_detail_failed' });
  }
});

/**
 * POST /api/admin/fiscal-outbox/:id/force-retry
 * Requires super-admin. Resets attempts+next_attempt_at so the drainer
 * picks it up on the next tick. Safe: handlers are idempotent by
 * (kind, source_key), so re-running one that already succeeded elsewhere
 * is a no-op.
 */
router.post('/:id/force-retry', async (req: Request, res: Response) => {
  if (!isSuperAdminVerified(req)) {
    return res.status(403).json({ error: 'super_admin_required' });
  }
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE fiscal_document_outbox
          SET status = 'pending',
              attempts = 0,
              next_attempt_at = now(),
              last_error = 'force_retry:' || $2,
              updated_at = now()
        WHERE id = $1
          AND status IN ('failed_needs_review', 'pending')
        RETURNING id, status, next_attempt_at, attempts`,
      [id, (req.user as any)?.uid || 'unknown_admin'],
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'not_found_or_not_retryable' });
    }
    logger.info('[AdminFiscalOutbox] force-retry', {
      id,
      actor: (req.user as any)?.uid,
    });
    return res.json({ row: r.rows[0], ok: true });
  } catch (err: any) {
    logger.error('[AdminFiscalOutbox] force-retry failed', { error: err?.message });
    return res.status(500).json({ error: 'fiscal_outbox_force_retry_failed' });
  }
});

/**
 * POST /api/admin/fiscal-outbox/:id/mark-reviewed
 * Requires super-admin. Stamps a reviewed marker on a
 * failed_needs_review row so ops can see the failure has been
 * consciously acknowledged (and not just missed). Row stays in
 * failed_needs_review — the marker lives in last_error prefixed
 * with `reviewed_by:<uid>@<iso>`.
 */
router.post('/:id/mark-reviewed', async (req: Request, res: Response) => {
  if (!isSuperAdminVerified(req)) {
    return res.status(403).json({ error: 'super_admin_required' });
  }
  try {
    const { id } = req.params;
    const actor = (req.user as any)?.uid || 'unknown_admin';
    const stamp = new Date().toISOString();
    const r = await pool.query(
      `UPDATE fiscal_document_outbox
          SET last_error = 'reviewed_by:' || $2 || '@' || $3 || ' | ' || COALESCE(last_error, ''),
              updated_at = now()
        WHERE id = $1
          AND status = 'failed_needs_review'
        RETURNING id, status, last_error`,
      [id, actor, stamp],
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'not_found_or_not_reviewable' });
    }
    logger.info('[AdminFiscalOutbox] mark-reviewed', { id, actor });
    return res.json({ row: r.rows[0], ok: true });
  } catch (err: any) {
    logger.error('[AdminFiscalOutbox] mark-reviewed failed', { error: err?.message });
    return res.status(500).json({ error: 'fiscal_outbox_mark_reviewed_failed' });
  }
});

export default router;
