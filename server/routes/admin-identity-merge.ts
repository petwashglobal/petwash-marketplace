/**
 * Admin Identity Merge — SHADOW / READ-ONLY.
 *
 * GET /api/admin/identity-merge-candidates
 *
 * Lists groups of DIFFERENT user ids that share the SAME verified email or the
 * SAME verified phone — i.e. the accounts the unified-identity flag WOULD merge
 * if it were ever enabled. This endpoint is purely observational:
 *   - it performs ONLY SELECTs over `users` (+ optional identity_accounts read),
 *   - it NEVER merges, links, mutates, or flips any flag,
 *   - PII is MASKED (email → first char + domain; phone → last 2 digits).
 *
 * Mounted under /api/admin → already gated by the global admin middleware stack
 * (requireRole(ADMIN_ROLES) + requireStaffApproved + requireMfaEnrolled in
 * routes.ts). We ALSO attach loadUserRole + checkAccessLevel here as
 * defense-in-depth, matching the admin-suppliers pattern.
 */
import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

const requireAdmin = [validateFirebaseToken, loadUserRole, checkAccessLevel(6)];

const MAX_GROUPS = 200;

type MatchedOn = 'email' | 'phone';

interface CandidateGroup {
  matchedOn: MatchedOn;
  /** Masked representation of the shared value — never the raw PII. */
  value: string;
  userIds: string[];
  count: number;
}

/** Mask an email: keep first char + domain. e.g. n***@gmail.com */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

/** Mask a phone: show only the last 2 digits. e.g. ******72 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return '**';
  return `${'*'.repeat(Math.max(2, digits.length - 2))}${digits.slice(-2)}`;
}

/**
 * GET /api/admin/identity-merge-candidates
 * Optional query: ?limit=<1..200>
 */
router.get('/identity-merge-candidates', ...requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : MAX_GROUPS, 1), MAX_GROUPS);

    // Verified email shared across >1 distinct user id.
    // Pure SELECT + GROUP BY. NO writes.
    const emailRows = await db.execute(sql`
      SELECT email AS value,
             array_agg(DISTINCT id) AS user_ids
      FROM users
      WHERE email IS NOT NULL
        AND email <> ''
        AND email_verified = true
      GROUP BY email
      HAVING COUNT(DISTINCT id) > 1
      LIMIT ${limit}
    `);

    // Verified phone shared across >1 distinct user id.
    const phoneRows = await db.execute(sql`
      SELECT phone AS value,
             array_agg(DISTINCT id) AS user_ids
      FROM users
      WHERE phone IS NOT NULL
        AND phone <> ''
        AND phone_verified = true
      GROUP BY phone
      HAVING COUNT(DISTINCT id) > 1
      LIMIT ${limit}
    `);

    const toGroups = (rows: any, matchedOn: MatchedOn): CandidateGroup[] => {
      // drizzle execute() returns either { rows: [...] } (pg) or an array.
      const list: any[] = Array.isArray(rows) ? rows : (rows?.rows ?? []);
      return list.map((r) => {
        const userIds: string[] = Array.isArray(r.user_ids)
          ? r.user_ids.map(String)
          : String(r.user_ids || '').replace(/[{}]/g, '').split(',').filter(Boolean);
        const rawValue = String(r.value ?? '');
        return {
          matchedOn,
          value: matchedOn === 'email' ? maskEmail(rawValue) : maskPhone(rawValue),
          userIds,
          count: userIds.length,
        };
      });
    };

    const groups: CandidateGroup[] = [
      ...toGroups(emailRows, 'email'),
      ...toGroups(phoneRows, 'phone'),
    ]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return res.json({
      mode: 'shadow',
      note: 'Read-only. These groups WOULD merge if unified-identity were enabled. Nothing is merged automatically.',
      totalGroups: groups.length,
      limit,
      groups,
    });
  } catch (err) {
    logger.error('[AdminIdentityMerge] candidate scan failed', err);
    return res.status(500).json({ error: 'Scan failed' });
  }
});

export default router;
