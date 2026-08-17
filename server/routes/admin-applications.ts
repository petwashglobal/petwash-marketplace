/**
 * Smart Admin Panel — unified Applications Dashboard (spec §1, §4, §7, §24).
 * Mounted at /api/admin/applications (admin-guarded).
 *
 *   GET /api/admin/applications/dashboard
 *     → summary cards + a single risk-scored, priority-sorted queue across BOTH
 *       provider onboarding and senior/disability discount applications.
 *
 * Advisory only: the risk engine populates scores/flags; humans still decide.
 * Sensitive IDs are never returned here (the queue shows no ID numbers).
 */
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { desc, inArray, ne, sql } from 'drizzle-orm';
import { users, providerApplications } from '../../shared/schema';
import { memberDiscountApplications } from '../../shared/schema';
import { isSuperAdmin, isSuperAdminVerified } from '../middleware/rbac';
import { computeRiskFlags, scoreFromFlags, ageFromDob, type RiskLevel } from '../services/applicationRiskEngine';
import { logger } from '../lib/logger';

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  // Canonical super-admin gate (allowlist + email_verified).
  if (!isSuperAdminVerified(req)) return res.status(403).json({ error: 'Full admin access required' });
  next();
}
router.use(requireAdmin);

const SCORE_RANK: Record<RiskLevel, number> = { critical: 3, high: 2, medium: 1, low: 0 };
const ACTIVE_PROVIDER_STATUSES = ['draft', 'submitted', 'pending_review', 'under_review', 'needs_more_info'];
const ACTIVE_DISCOUNT_STATUSES = ['submitted', 'pending_review', 'needs_more_info'];

interface QueueItem {
  appKind: 'provider' | 'discount';
  id: number;
  applicationId: string | null;
  userId: string;
  name: string;
  type: string;
  status: string;
  riskScore: RiskLevel;
  flags: { code: string; severity: string; message: string }[];
  submittedAt: string | null;
  daysPending: number;
}

// GET /api/admin/applications/dashboard
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    // ── Pull active applications from both streams ───────────────────────────
    const provApps = await db
      .select({
        id: providerApplications.id,
        applicationId: providerApplications.applicationId,
        userId: providerApplications.userId,
        firstName: providerApplications.firstName,
        lastName: providerApplications.lastName,
        email: providerApplications.email,
        phoneNumber: providerApplications.phoneNumber,
        providerType: providerApplications.providerType,
        status: providerApplications.status,
        taxStatus: providerApplications.taxStatus,
        dateOfBirth: providerApplications.dateOfBirth,
        submittedAt: providerApplications.submittedAt,
        createdAt: providerApplications.createdAt,
      })
      .from(providerApplications)
      .where(inArray(providerApplications.status, ACTIVE_PROVIDER_STATUSES))
      .orderBy(desc(providerApplications.createdAt))
      .limit(300);

    const discApps = await db
      .select({
        id: memberDiscountApplications.id,
        userId: memberDiscountApplications.userId,
        discountType: memberDiscountApplications.discountType,
        status: memberDiscountApplications.status,
        dateOfBirth: memberDiscountApplications.dateOfBirth,
        submittedAt: memberDiscountApplications.submittedAt,
        idHash: memberDiscountApplications.idHash,
      })
      .from(memberDiscountApplications)
      .where(inArray(memberDiscountApplications.status, ACTIVE_DISCOUNT_STATUSES))
      .orderBy(desc(memberDiscountApplications.id))
      .limit(300);

    // ── Bulk duplicate-contact detection (emails/phones on >1 account) ───────
    const dupEmails = new Set<string>();
    const dupPhones = new Set<string>();
    try {
      const er = await db.execute(sql`SELECT lower(email) AS v FROM users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1`);
      for (const row of (er as any).rows ?? er ?? []) if (row.v) dupEmails.add(String(row.v));
      const pr = await db.execute(sql`SELECT phone AS v FROM users WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1`);
      for (const row of (pr as any).rows ?? pr ?? []) if (row.v) dupPhones.add(String(row.v));
    } catch (e: any) {
      logger.warn('[AdminApplications] duplicate bulk scan failed', { err: e?.message });
    }

    // Bulk DUPLICATE-ID: id_hash blind-indexes appearing on >1 DISTINCT account.
    const dupIdHashes = new Set<string>();
    try {
      const ir = await db.execute(sql`SELECT id_hash AS v FROM member_discount_applications WHERE id_hash IS NOT NULL GROUP BY id_hash HAVING count(distinct user_id) > 1`);
      for (const row of (ir as any).rows ?? ir ?? []) if (row.v) dupIdHashes.add(String(row.v));
    } catch (e: any) {
      logger.warn('[AdminApplications] duplicate-ID bulk scan failed', { err: e?.message });
    }

    // Names for discount applicants (provider apps already carry names).
    const discUserIds = Array.from(new Set(discApps.map((d) => d.userId).filter(Boolean)));
    const nameByUser = new Map<string, { name: string; email: string | null; phone: string | null }>();
    if (discUserIds.length) {
      const urows = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, phone: users.phone })
        .from(users)
        .where(inArray(users.id, discUserIds));
      for (const u of urows) {
        nameByUser.set(u.id, {
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id,
          email: u.email ?? null,
          phone: u.phone ?? null,
        });
      }
    }

    const queue: QueueItem[] = [];

    for (const a of provApps) {
      const flags = computeRiskFlags({
        kind: 'provider',
        status: a.status,
        age: ageFromDob(a.dateOfBirth as any),
        taxStatus: a.taxStatus,
        wantsPayout: true,
        submittedAt: a.submittedAt ?? a.createdAt ?? null,
        duplicateEmailCount: a.email && dupEmails.has(a.email.toLowerCase()) ? 1 : 0,
        duplicatePhoneCount: a.phoneNumber && dupPhones.has(a.phoneNumber) ? 1 : 0,
      });
      const submitted = a.submittedAt ?? a.createdAt ?? null;
      queue.push({
        appKind: 'provider',
        id: a.id,
        applicationId: a.applicationId,
        userId: a.userId,
        name: [a.firstName, a.lastName].filter(Boolean).join(' ') || a.userId,
        type: `Provider · ${a.providerType ?? ''}`.trim(),
        status: a.status ?? 'unknown',
        riskScore: scoreFromFlags(flags),
        flags,
        submittedAt: submitted ? new Date(submitted).toISOString() : null,
        daysPending: submitted ? Math.floor((Date.now() - new Date(submitted).getTime()) / 86_400_000) : 0,
      });
    }

    for (const d of discApps) {
      const u = nameByUser.get(d.userId);
      const flags = computeRiskFlags({
        kind: 'discount',
        status: d.status,
        discountType: d.discountType,
        age: ageFromDob(d.dateOfBirth as any),
        submittedAt: d.submittedAt ?? null,
        duplicateEmailCount: u?.email && dupEmails.has(u.email.toLowerCase()) ? 1 : 0,
        duplicatePhoneCount: u?.phone && dupPhones.has(u.phone) ? 1 : 0,
        duplicateIdCount: d.idHash && dupIdHashes.has(d.idHash) ? 1 : 0,
      });
      queue.push({
        appKind: 'discount',
        id: d.id,
        applicationId: null,
        userId: d.userId,
        name: u?.name ?? d.userId,
        type: d.discountType === 'senior' ? 'Senior 65+ discount' : 'Disability discount',
        status: d.status ?? 'unknown',
        riskScore: scoreFromFlags(flags),
        flags,
        submittedAt: d.submittedAt ? new Date(d.submittedAt).toISOString() : null,
        daysPending: d.submittedAt ? Math.floor((Date.now() - new Date(d.submittedAt).getTime()) / 86_400_000) : 0,
      });
    }

    // Priority sort: risk desc, then days-pending desc (§7 smart review queue).
    queue.sort((a, b) => SCORE_RANK[b.riskScore] - SCORE_RANK[a.riskScore] || b.daysPending - a.daysPending);

    // ── Summary cards (§24) ──────────────────────────────────────────────────
    const cards = {
      pendingApplications: queue.length,
      providerPending: queue.filter((q) => q.appKind === 'provider').length,
      discountPending: queue.filter((q) => q.appKind === 'discount').length,
      highRisk: queue.filter((q) => q.riskScore === 'high' || q.riskScore === 'critical').length,
      critical: queue.filter((q) => q.riskScore === 'critical').length,
      overdue: queue.filter((q) => q.flags.some((f) => f.code === 'PENDING_TOO_LONG')).length,
      needsMoreInfo: queue.filter((q) => q.status === 'needs_more_info').length,
      duplicateContact: queue.filter((q) => q.flags.some((f) => f.code === 'DUPLICATE_EMAIL' || f.code === 'DUPLICATE_PHONE' || f.code === 'DUPLICATE_ID')).length,
    };

    return res.json({ ok: true, cards, queue, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    logger.error('[AdminApplications] dashboard failed', { err: err?.message });
    return res.status(500).json({ error: 'dashboard_failed' });
  }
});

export default router;
