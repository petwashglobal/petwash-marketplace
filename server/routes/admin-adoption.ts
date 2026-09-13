/**
 * Adopt a Pet — support review queue. /api/admin/adoption
 *
 * Every listing waits for a human before it is public (same rule as PawFinder).
 * Separate from /api/admin/paw-finder: different product, different statuses.
 */
import { Router } from 'express';
import { pool } from '../db';
import { logger } from '../lib/logger';
import { requireAdmin } from '../adminAuth';
import { logAuditEvent } from '../middleware/auditLog';
import { notifyAdoption } from '../services/AdoptionService';
import { ADOPTION_STATUSES } from '../lib/adoptionRules';

const router = Router();
router.use(requireAdmin);

function uid(req: any): string {
  return req.user?.uid || req.firebaseUser?.uid || '';
}

function audit(req: any, actionType: string, listingId: number, metadata: Record<string, unknown> = {}) {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: uid(req) || undefined,
      actorRole: 'admin',
      actionType,
      targetType: 'adoption_listing',
      targetId: String(listingId),
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata,
    }).catch(() => {});
  });
}

async function logEvent(listingId: number, eventName: string, actor: string, payload: Record<string, unknown> = {}) {
  await pool.query(
    `INSERT INTO adoption_events (listing_id, event_name, actor_user_id, payload) VALUES ($1,$2,$3,$4)`,
    [listingId, eventName, actor, JSON.stringify(payload)],
  ).catch((err: any) => logger.warn('[AdminAdoption] event log failed', { error: err?.message }));
}

const ADMIN_COLUMNS = `l.*,
  (SELECT m.file_path FROM adoption_listing_media m WHERE m.listing_id = l.id ORDER BY m.id LIMIT 1) AS primary_media`;

router.get('/queue', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${ADMIN_COLUMNS} FROM adoption_listings l WHERE l.status = 'pending_review' ORDER BY l.created_at ASC LIMIT 200`,
    );
    res.json({ rows, count: rows.length });
  } catch (err: any) {
    logger.error('[AdminAdoption] GET /queue failed', { error: err?.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const status = (ADOPTION_STATUSES as readonly string[]).includes(String(req.query.status)) ? String(req.query.status) : null;
    const { rows } = await pool.query(
      `SELECT ${ADMIN_COLUMNS} FROM adoption_listings l
        WHERE ($1::text IS NULL OR l.status = $1)
        ORDER BY l.created_at DESC LIMIT 300`,
      [status],
    );
    res.json({ rows, count: rows.length });
  } catch (err: any) {
    logger.error('[AdminAdoption] GET /listings failed', { error: err?.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** Approve → available. Only from review (or a reversed rejection); a live listing is untouched. */
router.post('/listings/:id/approve', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `UPDATE adoption_listings
          SET status = 'available', moderation_status = 'approved',
              published_at = COALESCE(published_at, NOW()), updated_at = NOW()
        WHERE id = $1 AND status IN ('pending_review','rejected')
        RETURNING id, user_id, pet_name`,
      [id],
    );
    if (!rows.length) return res.status(409).json({ error: 'not_reviewable' });
    await logEvent(id, 'adoption_listing_approved_by_support', uid(req));
    audit(req, 'ADOPTION_LISTING_APPROVE', id);
    await notifyAdoption(pool, { userId: rows[0].user_id, listingId: id, event: 'listing_approved', listing: rows[0] });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminAdoption] approve failed', { error: err?.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/listings/:id/reject', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || 'rejected_by_support').slice(0, 500);
    const { rows } = await pool.query(
      `UPDATE adoption_listings
          SET status = 'rejected', moderation_status = 'blocked', moderation_reason = $2, updated_at = NOW()
        WHERE id = $1 AND status IN ('pending_review','available','pending')
        RETURNING id, user_id, pet_name`,
      [id, reason],
    );
    if (!rows.length) return res.status(409).json({ error: 'not_rejectable' });
    await pool.query(
      `UPDATE adoption_enquiries SET status = 'declined', updated_at = NOW() WHERE listing_id = $1 AND status = 'pending'`,
      [id],
    );
    await logEvent(id, 'adoption_listing_rejected_by_support', uid(req), { reason });
    audit(req, 'ADOPTION_LISTING_REJECT', id, { reasonLength: reason.length });
    // The support reason is internal; the lister gets a neutral message.
    await notifyAdoption(pool, { userId: rows[0].user_id, listingId: id, event: 'listing_rejected', listing: rows[0] });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminAdoption] reject failed', { error: err?.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/listings/:id/archive', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `UPDATE adoption_listings SET status = 'archived', archived_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status <> 'archived' RETURNING id`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await logEvent(id, 'adoption_listing_archived_by_support', uid(req));
    audit(req, 'ADOPTION_LISTING_ARCHIVE', id);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminAdoption] archive failed', { error: err?.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
