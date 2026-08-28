/**
 * GET /api/admin/approved-provider-recon
 *
 * READ-ONLY diagnostic for CEO §21 "historical approved-but-broken
 * providers". Detects the specific failure mode where a provider
 * application landed in status='approved' but the corresponding
 * per-vertical profile row (sitter_profiles / walker_profiles / etc.)
 * does NOT exist for that Firebase UID. Result: the applicant sees
 * "approved" everywhere but their provider workspace is empty, they
 * are invisible to search, and Meet & Greet / bookings cannot reach
 * them.
 *
 * DISCIPLINE
 *   • READ-ONLY. Never mutates provider_applications, never creates
 *     profile rows, never flips capabilities. §21 explicitly forbids
 *     mass-repair without CEO approval.
 *   • Admin-only (isSuperAdmin gate). A provider can't run this on
 *     their own row — the diagnostic reads across all approved
 *     applications and would leak PII.
 *   • Per-vertical counts + a bounded sample of orphan (applicationId,
 *     userIdTail, reviewedAt) triples so an on-call can chase the
 *     specific rows down.
 *   • The repair path is a separate follow-up PR (dry-run first,
 *     then explicit CEO approval). This endpoint returns
 *     `repairPlan: 'PENDING-CEO'` as a stable pointer.
 *
 * Missing coverage today (surfaced honestly in the response):
 *   • trainer/academy — no `trainer_profiles` table in the current
 *     schema; the /academy pipeline uses trainer_bookings only. An
 *     approved application with providerType='trainer' therefore
 *     always looks "orphan" here. The response labels this
 *     `notApplicable: true` on that vertical so an ops user doesn't
 *     act on false positives.
 *   • station_operator — similar; no queryable profile mirror today.
 *
 * Design note: pairs with the legal-reconciliation endpoint
 * (server/routes/legal-reconciliation.ts) — both are READ-ONLY
 * divergence measurers, never fixers.
 */
import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

const MAX_SAMPLES = 20;

router.get('/approved-provider-recon', async (req: Request, res: Response) => {
  const callerEmail = (req as any).firebaseUser?.email || '';
  if (!isSuperAdmin(callerEmail)) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  try {
    // Approved applications by provider_type — the population we care about.
    const totalsRes = await pool.query(`
      SELECT provider_type, COUNT(*)::int AS n
        FROM provider_applications
       WHERE status = 'approved'
       GROUP BY provider_type
       ORDER BY provider_type
    `);
    const totals: Record<string, number> = {};
    for (const r of totalsRes.rows) totals[String(r.provider_type)] = Number(r.n);

    // ── Sitter orphans ───────────────────────────────────────────────
    // Approved sitter application whose Firebase UID has NO row in
    // sitter_profiles. Small LEFT JOIN — no writes.
    const sitterOrphans = await pool.query(`
      SELECT pa.application_id AS application_id,
             pa.user_id       AS user_id,
             pa.reviewed_at   AS reviewed_at
        FROM provider_applications pa
        LEFT JOIN sitter_profiles sp ON sp.user_id = pa.user_id
       WHERE pa.status = 'approved'
         AND pa.provider_type = 'sitter'
         AND sp.id IS NULL
       ORDER BY pa.reviewed_at DESC NULLS LAST
       LIMIT ${MAX_SAMPLES}
    `);
    const sitterOrphanCountRes = await pool.query(`
      SELECT COUNT(*)::int AS n
        FROM provider_applications pa
        LEFT JOIN sitter_profiles sp ON sp.user_id = pa.user_id
       WHERE pa.status = 'approved'
         AND pa.provider_type = 'sitter'
         AND sp.id IS NULL
    `);

    // ── Walker orphans ───────────────────────────────────────────────
    const walkerOrphans = await pool.query(`
      SELECT pa.application_id AS application_id,
             pa.user_id        AS user_id,
             pa.reviewed_at    AS reviewed_at
        FROM provider_applications pa
        LEFT JOIN walker_profiles wp ON wp.user_id = pa.user_id
       WHERE pa.status = 'approved'
         AND pa.provider_type = 'walker'
         AND wp.id IS NULL
       ORDER BY pa.reviewed_at DESC NULLS LAST
       LIMIT ${MAX_SAMPLES}
    `);
    const walkerOrphanCountRes = await pool.query(`
      SELECT COUNT(*)::int AS n
        FROM provider_applications pa
        LEFT JOIN walker_profiles wp ON wp.user_id = pa.user_id
       WHERE pa.status = 'approved'
         AND pa.provider_type = 'walker'
         AND wp.id IS NULL
    `);

    // Non-PII: userId truncated to the last 6 chars for log-search
    // discipline. Full row lookup is available via the admin
    // customer-detail endpoint. reviewed_at + application_id are
    // sufficient to chase a specific row down.
    const truncateUid = (raw: unknown) => (typeof raw === 'string' ? raw.slice(-6) : null);
    const mapOrphan = (r: any) => ({
      applicationId: r.application_id,
      userIdTail: truncateUid(r.user_id),
      reviewedAt: r.reviewed_at,
    });

    logger.info('[AdminProviderRecon] recon read', {
      caller: callerEmail,
      sitterOrphans: sitterOrphanCountRes.rows[0]?.n ?? 0,
      walkerOrphans: walkerOrphanCountRes.rows[0]?.n ?? 0,
    });

    return res.json({
      ok: true,
      composedAt: new Date().toISOString(),
      totals,
      verticals: {
        sitter: {
          approvedTotal: totals.sitter ?? 0,
          orphanCount: sitterOrphanCountRes.rows[0]?.n ?? 0,
          orphanSamples: sitterOrphans.rows.map(mapOrphan),
        },
        walker: {
          approvedTotal: totals.walker ?? 0,
          orphanCount: walkerOrphanCountRes.rows[0]?.n ?? 0,
          orphanSamples: walkerOrphans.rows.map(mapOrphan),
        },
        trainer: {
          approvedTotal: totals.trainer ?? 0,
          notApplicable: true,
          reason: 'No trainer_profiles mirror today — academy pipeline uses trainer_bookings only.',
        },
        station_operator: {
          approvedTotal: totals.station_operator ?? 0,
          notApplicable: true,
          reason: 'No queryable station-operator profile mirror today.',
        },
      },
      repairPlan: 'PENDING-CEO',
      repairPlanNote:
        'READ-ONLY diagnostic. Repair (creating missing profile rows from provider_applications) is a separate CEO-approved dry-run/apply command; do not act on this endpoint alone.',
    });
  } catch (err: any) {
    // Table might not exist in fresh envs — return a friendly 200 so
    // the admin dashboard renders a "migration pending" banner rather
    // than 500ing.
    if (err?.code === '42P01') {
      return res.json({
        ok: true, migrationPending: true,
        composedAt: new Date().toISOString(),
        reason: 'One of provider_applications / sitter_profiles / walker_profiles is missing in this environment.',
      });
    }
    logger.error('[AdminProviderRecon] query failed', { error: err?.message });
    return res.status(500).json({ ok: false, error: 'Recon query failed' });
  }
});

export default router;
