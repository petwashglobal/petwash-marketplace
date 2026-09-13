/**
 * Paw Finder™ Admin / Moderation Routes
 *
 * Issue #148 P5: this file's old docstring claimed protection by
 * "/api/admin/ middleware: requireRole + requireStaffApproved +
 * requireMfaEnrolled" — that was aspirational. The mount in routes.ts
 * only ran `validateFirebaseToken`, so any authenticated Firebase
 * user (customer, walker, sitter, etc.) could approve / reject /
 * archive paw-finder posts and read the full moderation queue.
 *
 * We now apply `requireAdmin` as router-level middleware so every
 * handler — list, mutation, and analytics — requires admin role
 * before it executes. Mutations (approve / reject / archive) also
 * emit canonical `audit_events` via `logAuditEvent` alongside the
 * existing `paw_finder_events` domain log.
 */

import { Router } from 'express';
import { pool } from '../db';
import { refreshMatchesForPost } from '../services/PawFinderMatchService';
import { notifyPawFinderOwner } from '../lib/pawFinderNotify';
import { logger } from '../lib/logger';
import { requireAdmin } from '../adminAuth';
import { logAuditEvent } from '../middleware/auditLog';

const router = Router();

// Issue #148 P5 — every handler below requires admin role.
router.use(requireAdmin);

function uid(req: any): string {
  return req.user?.uid || req.firebaseUser?.uid || '';
}

/** Emit canonical audit_events alongside the local paw_finder_events log. */
function emitPawFinderAdminAudit(params: {
  actionType: string;
  actorUserId: string | undefined;
  postId: number | string | null | undefined;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId || undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: 'paw_finder_post',
      targetId: params.postId != null ? String(params.postId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: params.metadata ?? {},
    }).catch(() => {});
  });
}

async function logEvent(
  postId: number,
  eventName: string,
  actorUserId: string,
  payload: Record<string, any> = {},
  severity: 'info' | 'warning' | 'critical' = 'info',
) {
  try {
    await pool.query(
      `INSERT INTO paw_finder_events (post_id, event_name, severity, actor_user_id, payload)
       VALUES ($1,$2,$3,$4,$5)`,
      [postId, eventName, severity, actorUserId, JSON.stringify(payload)],
    );
  } catch (err: any) {
    logger.warn('[AdminPawFinder] Event log write failed', { error: err.message });
  }
}

/** GET /api/admin/paw-finder/queue — moderation queue */
router.get('/queue', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              (SELECT m.file_path FROM paw_finder_media m WHERE m.post_id = p.id ORDER BY id LIMIT 1) AS primary_media,
              (SELECT json_agg(row_to_json(me.*) ORDER BY me.created_at DESC)
               FROM paw_finder_moderation_events me WHERE me.post_id = p.id) AS moderation_history
       FROM paw_finder_posts p
       WHERE p.status IN ('pending_review','draft')
          OR p.moderation_status IN ('flagged','blocked')
       ORDER BY p.updated_at DESC
       LIMIT 200`,
    );
    res.json({ rows, count: rows.length });
  } catch (err: any) {
    logger.error('[AdminPawFinder] GET /queue failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/paw-finder/posts — all posts with filters */
router.get('/posts', async (req, res) => {
  try {
    const status   = req.query.status   as string | undefined;
    const city     = req.query.city     as string | undefined;
    const postType = req.query.postType as string | undefined;
    const limit    = Math.min(Number(req.query.limit || 100), 500);

    const { rows } = await pool.query(
      `SELECT p.*,
              (SELECT m.file_path FROM paw_finder_media m WHERE m.post_id = p.id ORDER BY id LIMIT 1) AS primary_media
       FROM paw_finder_posts p
       WHERE ($1::text IS NULL OR p.status = $1)
         AND ($2::text IS NULL OR LOWER(p.city) = LOWER($2))
         AND ($3::text IS NULL OR p.post_type = $3)
       ORDER BY p.created_at DESC
       LIMIT $4`,
      [status || null, city || null, postType || null, limit],
    );
    res.json({ rows, count: rows.length });
  } catch (err: any) {
    logger.error('[AdminPawFinder] GET /posts failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/paw-finder/posts/:id/approve — manually approve */
router.post('/posts/:id/approve', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const actorId = uid(req);

    // RETURNING the owner so they are told (2026-09-13: approval was silent).
    // `wasPublished` stops a repeat click from re-notifying.
    const { rows: approved } = await pool.query(
      `UPDATE paw_finder_posts p
       SET status = 'published',
           moderation_status = 'approved',
           moderation_reason = COALESCE(p.moderation_reason, 'approved_by_support'),
           published_at = COALESCE(p.published_at, NOW()),
           updated_at = NOW()
       FROM (SELECT id, status AS prev_status FROM paw_finder_posts WHERE id = $1) prev
       WHERE p.id = prev.id
       RETURNING p.user_id, p.post_type, p.pet_name, prev.prev_status IN ('published','matched') AS was_published`,
      [id],
    );
    if (!approved.length) return res.status(404).json({ error: 'not_found' });

    await pool.query(
      `INSERT INTO paw_finder_moderation_events
       (post_id, stage, verdict, confidence, flags, raw_summary, actor_user_id)
       VALUES ($1,'manual_review','approved',100,'[]','{}', $2)`,
      [id, actorId],
    );

    await logEvent(id, 'paw_finder_post_approved_by_support', actorId);
    emitPawFinderAdminAudit({
      actionType: 'PAW_FINDER_POST_APPROVE',
      actorUserId: actorId,
      postId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    if (!approved[0].was_published) {
      await notifyPawFinderOwner(pool, { userId: approved[0].user_id, postId: id, event: 'post_approved', post: approved[0] });
    }
    setImmediate(() => refreshMatchesForPost(pool, id));

    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminPawFinder] approve failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/paw-finder/posts/:id/reject — manually reject */
router.post('/posts/:id/reject', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const actorId = uid(req);
    const reason = String(req.body?.reason || 'rejected_by_support').slice(0, 500);

    const { rows: rejected } = await pool.query(
      `UPDATE paw_finder_posts p
       SET status = 'rejected',
           moderation_status = 'blocked',
           moderation_reason = $2,
           updated_at = NOW()
       FROM (SELECT id, status AS prev_status FROM paw_finder_posts WHERE id = $1) prev
       WHERE p.id = prev.id
       RETURNING p.user_id, p.post_type, p.pet_name, prev.prev_status = 'rejected' AS was_rejected`,
      [id, reason],
    );
    if (!rejected.length) return res.status(404).json({ error: 'not_found' });

    await pool.query(
      `INSERT INTO paw_finder_moderation_events
       (post_id, stage, verdict, confidence, flags, raw_summary, actor_user_id)
       VALUES ($1,'manual_review','blocked',100,'[]',$2,$3)`,
      [id, JSON.stringify({ reason }), actorId],
    );

    await logEvent(id, 'paw_finder_post_rejected_by_support', actorId, { reason }, 'warning');
    emitPawFinderAdminAudit({
      actionType: 'PAW_FINDER_POST_REJECT',
      actorUserId: actorId,
      postId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { reasonLength: reason.length },
    });
    // The support reason is internal; the owner gets a neutral message.
    if (!rejected[0].was_rejected) {
      await notifyPawFinderOwner(pool, { userId: rejected[0].user_id, postId: id, event: 'post_rejected', post: rejected[0] });
    }
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminPawFinder] reject failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/paw-finder/posts/:id/archive — archive a post */
router.post('/posts/:id/archive', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const actorId = uid(req);

    await pool.query(
      `UPDATE paw_finder_posts
       SET status = 'archived', archived_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    await logEvent(id, 'paw_finder_post_archived', actorId);
    emitPawFinderAdminAudit({
      actionType: 'PAW_FINDER_POST_ARCHIVE',
      actorUserId: actorId,
      postId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminPawFinder] archive failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/admin/paw-finder/analytics — platform stats */
router.get('/analytics', async (_req, res) => {
  try {
    const [summary, matches, topCities, recentActivity] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                             AS total_posts,
          COUNT(*) FILTER (WHERE status = 'published')::int        AS published,
          COUNT(*) FILTER (WHERE status = 'matched')::int          AS matched,
          COUNT(*) FILTER (WHERE status = 'resolved')::int         AS resolved,
          COUNT(*) FILTER (WHERE status = 'pending_review')::int   AS pending_review,
          COUNT(*) FILTER (WHERE status = 'rejected')::int         AS rejected,
          COUNT(*) FILTER (WHERE post_type = 'lost')::int          AS lost_posts,
          COUNT(*) FILTER (WHERE post_type = 'found')::int         AS found_posts,
          COUNT(*) FILTER (WHERE moderation_status = 'flagged')::int AS flagged,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS posts_last_7d
        FROM paw_finder_posts
      `),
      pool.query(`
        SELECT
          COUNT(*)::int                                             AS total_matches,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int        AS confirmed_matches,
          COUNT(*) FILTER (WHERE status = 'resolved')::int         AS resolved_matches,
          ROUND(AVG(similarity_score), 1)                          AS avg_similarity_score
        FROM paw_finder_matches
      `),
      pool.query(`
        SELECT city, COUNT(*)::int AS post_count
        FROM paw_finder_posts WHERE status NOT IN ('rejected','archived')
        GROUP BY city ORDER BY post_count DESC LIMIT 10
      `),
      pool.query(`
        SELECT event_name, COUNT(*)::int AS cnt
        FROM paw_finder_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY event_name ORDER BY cnt DESC
      `),
    ]);

    res.json({
      summary: summary.rows[0],
      matches: matches.rows[0],
      topCities: topCities.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err: any) {
    logger.error('[AdminPawFinder] analytics failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
