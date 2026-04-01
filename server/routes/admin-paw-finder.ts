/**
 * Paw Finder™ Admin / Moderation Routes
 * Protected by /api/admin/ middleware: requireRole + requireStaffApproved + requireMfaEnrolled
 */

import { Router } from 'express';
import { pool } from '../db';
import { refreshMatchesForPost } from '../services/PawFinderMatchService';
import { logger } from '../lib/logger';

const router = Router();

function uid(req: any): string {
  return req.user?.uid || req.firebaseUser?.uid || '';
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
router.post('/posts/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const actorId = uid(req);

    await pool.query(
      `UPDATE paw_finder_posts
       SET status = 'published',
           moderation_status = 'approved',
           moderation_reason = COALESCE(moderation_reason, 'approved_by_support'),
           published_at = COALESCE(published_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    await pool.query(
      `INSERT INTO paw_finder_moderation_events
       (post_id, stage, verdict, confidence, flags, raw_summary, actor_user_id)
       VALUES ($1,'manual_review','approved',100,'[]','{}', $2)`,
      [id, actorId],
    );

    await logEvent(id, 'paw_finder_post_approved_by_support', actorId);
    setImmediate(() => refreshMatchesForPost(pool, id));

    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminPawFinder] approve failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/paw-finder/posts/:id/reject — manually reject */
router.post('/posts/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const actorId = uid(req);
    const reason = String(req.body?.reason || 'rejected_by_support').slice(0, 500);

    await pool.query(
      `UPDATE paw_finder_posts
       SET status = 'rejected',
           moderation_status = 'blocked',
           moderation_reason = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, reason],
    );

    await pool.query(
      `INSERT INTO paw_finder_moderation_events
       (post_id, stage, verdict, confidence, flags, raw_summary, actor_user_id)
       VALUES ($1,'manual_review','blocked',100,'[]',$2,$3)`,
      [id, JSON.stringify({ reason }), actorId],
    );

    await logEvent(id, 'paw_finder_post_rejected_by_support', actorId, { reason }, 'warning');
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[AdminPawFinder] reject failed', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/admin/paw-finder/posts/:id/archive — archive a post */
router.post('/posts/:id/archive', async (req, res) => {
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
