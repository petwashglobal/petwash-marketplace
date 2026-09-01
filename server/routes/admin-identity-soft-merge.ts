/**
 * /api/admin/identity/soft-merge/* — Phase 6 legacy-duplicate soft-merge
 * tool (CEO D6, corrected).
 *
 * DISTINCT FROM admin-identity-merge.ts:
 *   - admin-identity-merge.ts     — READ-ONLY candidate scanner (live)
 *   - admin-identity-soft-merge.ts — the WRITE tool (scaffold today)
 *
 * ⚠️  SOFT-MERGE MODEL PER CEO D6:
 *
 *   Legacy duplicates are NOT resolved by destructively re-parenting
 *   history. Instead:
 *     - the SECONDARY user row gets `merged_into_uid = PRIMARY` set
 *     - identity resolution at login time follows merged_into_uid to
 *       return the PRIMARY user
 *     - historical financial / tax / audit / booking / receipt rows
 *       KEEP their original uid — they are immutable evidence
 *     - LOW-RISK profile data (marketing prefs, avatar, display name)
 *       may be migrated in a separate deliberate step, per domain
 *
 *   Merge is REVERSIBLE: clearing merged_into_uid restores the two
 *   separate identities.
 *
 * Required to execute a merge:
 *   * super-admin caller (isSuperAdminVerified)
 *   * step-up proof for purpose 'admin_dangerous_action'
 *   * a written `reason` (audit column)
 *   * a completed `preview` call earlier in the same session
 *
 * PHASE 6.a — SHIPPED HERE:
 *   * POST /api/admin/identity/soft-merge/preview — 501, contract only
 *   * POST /api/admin/identity/soft-merge        — 501, contract only
 *   * The namespace is CLAIMED so nobody invents a parallel path.
 *
 * PHASE 6.b — DELIVERS THE PREVIEW + WRITE:
 *   Depends on `users.merged_into_uid` column landing (migration TBD —
 *   deliberately not shipped in this session to avoid a schema slot
 *   sitting unused for months).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { isSuperAdminVerified } from '../middleware/rbac';
import { requireStepUp } from '../services/StepUpService';
import { previewMerge, validateMergeRequest } from '../services/SoftMergeService';
import { logger } from '../lib/logger';

const router = Router();

/** Only super-admins can even hit the preview. Regular admins cannot. */
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isSuperAdminVerified(req)) {
    logger.warn('[admin/identity/soft-merge] non-super-admin rejected', {
      uid: req.firebaseUser?.uid,
    });
    return res.status(403).json({ error: 'SUPER_ADMIN_REQUIRED' });
  }
  return next();
}

const PreviewBody = z.object({
  primaryUid: z.string().min(1),
  secondaryUid: z.string().min(1),
});

router.post(
  '/soft-merge/preview',
  validateFirebaseToken,
  requireSuperAdmin,
  requireStepUp('admin_dangerous_action'),
  async (req: Request, res: Response) => {
    const body = PreviewBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { primaryUid: '<uid>', secondaryUid: '<uid>' },
      });
    }
    const { primaryUid, secondaryUid } = body.data;

    if (primaryUid === secondaryUid) {
      return res.status(400).json({ error: 'SELF_MERGE', primaryUid });
    }

    try {
      const preview = await previewMerge(primaryUid, secondaryUid);
      logger.info('[admin/identity/soft-merge] preview generated', {
        caller: req.firebaseUser?.uid,
        primaryUid,
        secondaryUid,
        recommendation: preview.recommendation,
        conflictCodes: preview.conflicts.map((c) => c.code),
      });
      return res.json(preview);
    } catch (err: any) {
      logger.error('[admin/identity/soft-merge] preview failed', {
        caller: req.firebaseUser?.uid,
        primaryUid,
        secondaryUid,
        error: err?.message,
      });
      return res.status(500).json({ error: 'PREVIEW_FAILED' });
    }
  },
);

const MergeBody = z.object({
  primaryUid: z.string().min(1),
  secondaryUid: z.string().min(1),
  reason: z.string().min(10).max(1000),
  /** ISO8601 timestamp of the preview call the admin approved. Must be within 10 min. */
  confirmedPreviewAt: z.string(),
  /** Set true to proceed when preview.recommendation === 'REVIEW' (admin saw warnings). */
  ackWarnings: z.boolean().optional().default(false),
});

const PREVIEW_MAX_AGE_MS = 10 * 60 * 1000;

router.post(
  '/soft-merge',
  validateFirebaseToken,
  requireSuperAdmin,
  requireStepUp('admin_dangerous_action'),
  async (req: Request, res: Response) => {
    const parsed = MergeBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: {
          primaryUid: '<uid>',
          secondaryUid: '<uid>',
          reason: '<explanation, 10-1000 chars>',
          confirmedPreviewAt: '<ISO8601 timestamp of the /preview call>',
          ackWarnings: '<true when preview.recommendation === REVIEW>',
        },
      });
    }
    const { primaryUid, secondaryUid, reason, confirmedPreviewAt, ackWarnings } = parsed.data;
    const callerUid = req.firebaseUser?.uid;

    // 1. Freshness check on the preview timestamp — an admin cannot
    //    approve a preview and then drift for hours before writing.
    const previewMs = Date.parse(confirmedPreviewAt);
    if (!Number.isFinite(previewMs)) {
      return res.status(400).json({ error: 'BAD_CONFIRMED_PREVIEW_AT' });
    }
    const previewAgeMs = Date.now() - previewMs;
    if (previewAgeMs < 0 || previewAgeMs > PREVIEW_MAX_AGE_MS) {
      return res.status(400).json({
        error: 'PREVIEW_EXPIRED',
        detail: `Preview must be within ${PREVIEW_MAX_AGE_MS / 60000} minutes. Re-run /soft-merge/preview and retry.`,
      });
    }

    // 2. Structural validation (self-merge, existence, chain).
    const structural = await validateMergeRequest(primaryUid, secondaryUid);
    if (!structural.ok) {
      return res.status(409).json({ error: 'MERGE_INVALID', ...structural.error });
    }

    // 3. Re-run the preview and enforce the recommendation contract.
    const fresh = await previewMerge(primaryUid, secondaryUid);
    if (fresh.recommendation === 'REJECT') {
      logger.warn('[admin/identity/soft-merge] refused by preview', {
        callerUid,
        primaryUid,
        secondaryUid,
        conflictCodes: fresh.conflicts.map((c) => c.code),
      });
      return res.status(409).json({
        error: 'MERGE_REJECTED_BY_PREVIEW',
        conflicts: fresh.conflicts,
      });
    }
    if (fresh.recommendation === 'REVIEW' && !ackWarnings) {
      return res.status(409).json({
        error: 'REVIEW_WARNINGS_NOT_ACK',
        detail: 'Preview raised warnings. Re-submit with ackWarnings=true after human review.',
        conflicts: fresh.conflicts,
      });
    }

    // 4. Guarded write — only flip merged_into_uid on rows that are
    //    still not merged. Concurrency: two racing writes lose here.
    let mergeId: string;
    try {
      const { db } = await import('../db');
      const { users } = await import('@shared/schema');
      const { eq, and, isNull, sql: dsql } = await import('drizzle-orm');

      const updated = await db
        .update(users)
        .set({ mergedIntoUid: primaryUid })
        .where(and(eq(users.id, secondaryUid), isNull(users.mergedIntoUid)))
        .returning({ id: users.id });

      if (updated.length === 0) {
        // Race — someone merged this row between our preview and
        // this write. Refuse.
        return res.status(409).json({ error: 'SECONDARY_MERGED_RACE' });
      }
      mergeId = `sm_${Date.now().toString(36)}_${secondaryUid.slice(-6)}`;

      // Best-effort audit event via domain_events. Never blocks the
      // response — an audit-write failure gets logged, the merge still
      // stands (it is reversible).
      try {
        await db.execute(dsql`
          INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, created_at)
          VALUES (
            'user',
            ${secondaryUid},
            'IDENTITY_SOFT_MERGED',
            ${dsql.raw(`'${JSON.stringify({
              mergeId,
              primaryUid,
              secondaryUid,
              reason: reason.slice(0, 1000),
              callerUid,
              recommendation: fresh.recommendation,
              conflictCodes: fresh.conflicts.map((c) => c.code),
            }).replace(/'/g, "''")}'::jsonb`)},
            now()
          )
        `);
      } catch (auditErr: any) {
        logger.error('[admin/identity/soft-merge] audit write failed (merge stands)', {
          mergeId,
          error: auditErr?.message,
        });
      }
    } catch (err: any) {
      logger.error('[admin/identity/soft-merge] write failed', {
        callerUid,
        primaryUid,
        secondaryUid,
        error: err?.message,
      });
      return res.status(500).json({ error: 'MERGE_WRITE_FAILED' });
    }

    logger.warn('[admin/identity/soft-merge] IDENTITY_SOFT_MERGED', {
      mergeId,
      callerUid,
      primaryUid,
      secondaryUid,
      recommendation: fresh.recommendation,
    });

    return res.json({
      ok: true,
      mergeId,
      primaryUid,
      secondaryUid,
      recommendation: fresh.recommendation,
      reversible: true,
      unmergePath: '/api/admin/identity/soft-merge/unmerge',
    });
  },
);

// ─── UNMERGE — reversible restore ──────────────────────────────────

const UnmergeBody = z.object({
  secondaryUid: z.string().min(1),
  reason: z.string().min(10).max(1000),
});

router.post(
  '/soft-merge/unmerge',
  validateFirebaseToken,
  requireSuperAdmin,
  requireStepUp('admin_dangerous_action'),
  async (req: Request, res: Response) => {
    const parsed = UnmergeBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { secondaryUid: '<uid>', reason: '<explanation, 10-1000 chars>' },
      });
    }
    const { secondaryUid, reason } = parsed.data;
    const callerUid = req.firebaseUser?.uid;

    try {
      const { db } = await import('../db');
      const { users } = await import('@shared/schema');
      const { eq, and, isNotNull, sql: dsql } = await import('drizzle-orm');

      // Capture the previous target for audit.
      const [before] = await db
        .select({ mergedIntoUid: users.mergedIntoUid })
        .from(users)
        .where(eq(users.id, secondaryUid))
        .limit(1);

      if (!before) {
        return res.status(404).json({ error: 'SECONDARY_NOT_FOUND' });
      }
      if (!before.mergedIntoUid) {
        return res.status(409).json({ error: 'NOT_MERGED' });
      }
      const previousPrimary = before.mergedIntoUid;

      const updated = await db
        .update(users)
        .set({ mergedIntoUid: null })
        .where(and(eq(users.id, secondaryUid), isNotNull(users.mergedIntoUid)))
        .returning({ id: users.id });

      if (updated.length === 0) {
        return res.status(409).json({ error: 'RACE_ALREADY_UNMERGED' });
      }

      try {
        await db.execute(dsql`
          INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, created_at)
          VALUES (
            'user',
            ${secondaryUid},
            'IDENTITY_SOFT_UNMERGED',
            ${dsql.raw(`'${JSON.stringify({
              secondaryUid,
              previousPrimary,
              reason: reason.slice(0, 1000),
              callerUid,
            }).replace(/'/g, "''")}'::jsonb`)},
            now()
          )
        `);
      } catch (auditErr: any) {
        logger.error('[admin/identity/soft-merge/unmerge] audit write failed', {
          secondaryUid,
          error: auditErr?.message,
        });
      }

      logger.warn('[admin/identity/soft-merge] IDENTITY_SOFT_UNMERGED', {
        callerUid,
        secondaryUid,
        previousPrimary,
      });

      return res.json({ ok: true, secondaryUid, previousPrimary });
    } catch (err: any) {
      logger.error('[admin/identity/soft-merge/unmerge] failed', {
        callerUid,
        secondaryUid,
        error: err?.message,
      });
      return res.status(500).json({ error: 'UNMERGE_FAILED' });
    }
  },
);

export default router;
