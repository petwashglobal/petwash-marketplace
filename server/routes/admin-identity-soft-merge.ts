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
    return res.status(501).json({
      error: 'NOT_YET_IMPLEMENTED',
      phase: '6.b',
      note: [
        'Preview will project both uids and return:',
        '  identity: verified email/phone/id_number on each',
        '  money:    wallet balance / loyalty balance / any confirmed bookings',
        '  links:    identity_accounts rows on each',
        '  warnings: whether both have money (merge NOT recommended)',
      ].join('\n'),
    });
  },
);

const MergeBody = z.object({
  primaryUid: z.string().min(1),
  secondaryUid: z.string().min(1),
  reason: z.string().min(10).max(1000),
  confirmedPreviewAt: z.string(), // ISO8601 — must be within the last 10 min
});

router.post(
  '/soft-merge',
  validateFirebaseToken,
  requireSuperAdmin,
  requireStepUp('admin_dangerous_action'),
  async (req: Request, res: Response) => {
    const body = MergeBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: {
          primaryUid: '<uid>',
          secondaryUid: '<uid>',
          reason: '<explanation, 10-1000 chars>',
          confirmedPreviewAt: '<ISO8601 timestamp of the /preview call>',
        },
      });
    }
    return res.status(501).json({
      error: 'NOT_YET_IMPLEMENTED',
      phase: '6.b',
      note: [
        'Full write flow will:',
        '  1. Re-run the preview and compare against confirmedPreviewAt',
        '     (must be within 10 min AND unchanged)',
        '  2. Write users.merged_into_uid = primaryUid on the secondary',
        '  3. Emit IDENTITY_SOFT_MERGED audit event with before/after',
        '  4. Return the merge id (reversible via /soft-merge/unmerge)',
        'Money/tax/booking rows are NEVER re-parented (soft-merge).',
      ].join('\n'),
    });
  },
);

export default router;
