/**
 * Admin Provider Control Tower — READ-ONLY list endpoint.
 * Mounted at /api/admin/provider-control (under the /api/admin/ middleware stack).
 *
 *   GET /api/admin/provider-control   — list every provider_services row joined to
 *                                       the provider's identity (provider_applicants)
 *                                       and reconfirmation status, so the admin UI
 *                                       can drive the per-service approval ladder.
 *
 * THIS ROUTER ADDS NO MUTATIONS. The per-service approval ladder
 * (waitlist → profile → booking → payout) is already owned by the EXISTING,
 * audited endpoint:
 *
 *     POST /api/provider-applications/admin/:applicationId/service/:serviceType/approve
 *          body: { level: 'waitlist'|'profile'|'booking'|'payout', reason }
 *
 * The UI calls THAT endpoint for all transitions (advance, demote/block by
 * setting a lower level). To make that callable, each row in this list exposes
 * BOTH the provider's Firebase UID (provider_services.provider_id) AND the
 * applicationId (provider_applicants.id) the approve endpoint is keyed by.
 *
 * requireAdmin (isSuperAdmin) guards the whole router.
 */
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { providerServices } from '../../shared/schema-provider-services';
import { reconfirmationRecords } from '../../shared/schema-provider-services';
import { providerApplicants } from '../../shared/schema-enterprise';
import { and, eq, desc, sql, ilike, or, gt, isNull } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const email = (req.firebaseUser?.email || '').toLowerCase();
  if (!isSuperAdmin(email)) {
    return res.status(403).json({ error: 'Full admin access required' });
  }
  next();
}
router.use(requireAdmin);

// The ladder statuses, lowest → highest. Used only for client-side ordering hints.
const LADDER_STATUSES = [
  'not_started',
  'draft',
  'submitted',
  'needs_more_info',
  'approved_for_waitlist',
  'approved_for_profile_display',
  'approved_for_booking',
  'approved_for_payout',
  'suspended',
  'rejected',
  'needs_reconfirmation',
] as const;

// GET /api/admin/provider-control?status=&serviceType=&q=&limit=&offset=
router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'all'
    ? req.query.status : undefined;
  const serviceType = typeof req.query.serviceType === 'string' && req.query.serviceType !== 'all'
    ? req.query.serviceType : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  try {
    const conds: any[] = [];
    if (status) conds.push(eq(providerServices.serviceStatus, status));
    if (serviceType) conds.push(eq(providerServices.serviceType, serviceType));
    if (q) {
      const like = `%${q}%`;
      conds.push(
        or(
          ilike(providerApplicants.firstName, like),
          ilike(providerApplicants.lastName, like),
          ilike(providerApplicants.email, like),
          ilike(providerServices.providerId, like),
          // numeric application id exact-ish match
          /^\d+$/.test(q) ? eq(providerApplicants.id, parseInt(q, 10)) : sql`false`,
        ),
      );
    }

    // Earliest pending reconfirmation due-date per provider (NULL when none open).
    const reconfDue = db
      .select({
        providerId: reconfirmationRecords.providerId,
        dueAt: sql<Date>`min(${reconfirmationRecords.dueAt})`.as('recon_due_at'),
      })
      .from(reconfirmationRecords)
      .where(
        and(
          eq(reconfirmationRecords.status, 'pending'),
          isNull(reconfirmationRecords.completedAt),
        ),
      )
      .groupBy(reconfirmationRecords.providerId)
      .as('reconf_due');

    const rows = await db
      .select({
        serviceId: providerServices.id,
        providerId: providerServices.providerId,
        applicationId: providerApplicants.id,
        firstName: providerApplicants.firstName,
        lastName: providerApplicants.lastName,
        email: providerApplicants.email,
        phone: providerApplicants.phoneNumber,
        serviceType: providerServices.serviceType,
        serviceStatus: providerServices.serviceStatus,
        profileVisible: providerServices.profileVisible,
        bookingEnabled: providerServices.bookingEnabled,
        payoutEnabled: providerServices.payoutEnabled,
        pausedByAdmin: providerServices.pausedByAdmin,
        pausedByProvider: providerServices.pausedByProvider,
        reconfirmationDue: reconfDue.dueAt,
        createdAt: providerServices.createdAt,
        updatedAt: providerServices.updatedAt,
      })
      .from(providerServices)
      .leftJoin(providerApplicants, eq(providerApplicants.userId, providerServices.providerId))
      .leftJoin(reconfDue, eq(reconfDue.providerId, providerServices.providerId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(providerServices.updatedAt))
      .limit(limit)
      .offset(offset);

    let unlinkedCount = 0;
    const services = rows.map((r) => {
      const providerName =
        [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || null;
      // Derived blocked-payout reason (no dedicated column exists): a service
      // that is booking-enabled but NOT payout-enabled is held at the payout gate.
      let blockPayoutReason: string | null = null;
      if (r.pausedByAdmin) blockPayoutReason = 'paused_by_admin';
      else if (r.serviceStatus === 'suspended') blockPayoutReason = 'suspended';
      else if (r.serviceStatus === 'needs_reconfirmation') blockPayoutReason = 'needs_reconfirmation';
      else if (r.bookingEnabled && !r.payoutEnabled) blockPayoutReason = 'awaiting_payout_approval';

      // Data-quality signal: provider_services row exists but the leftJoin
      // to provider_applicants returned NULL because the applicant record
      // was never bound to this Firebase UID. Without this signal the row
      // shows in the admin table with no name/email/phone/applicationId and
      // reads as a broken row — the ladder mutation immediately throws
      // "no linked application" (audit CRIT: dead-row on unlinked cohort).
      const noLinkedApplication = r.applicationId == null;
      if (noLinkedApplication) unlinkedCount += 1;

      return {
        serviceId: r.serviceId,
        providerId: r.providerId,
        // applicationId is REQUIRED by the UI to call the existing approve endpoint.
        applicationId: r.applicationId ?? null,
        providerName,
        email: r.email ?? null,
        phone: r.phone ?? null,
        serviceType: r.serviceType,
        serviceStatus: r.serviceStatus,
        profileVisible: r.profileVisible,
        bookingEnabled: r.bookingEnabled,
        payoutEnabled: r.payoutEnabled,
        pausedByAdmin: r.pausedByAdmin,
        pausedByProvider: r.pausedByProvider,
        blockPayoutReason,
        reconfirmationDue: r.reconfirmationDue ?? null,
        // Explicit data-quality flag so the UI can render a "link applicant"
        // hint instead of a silent unactionable row.
        dataQualityIssue: noLinkedApplication ? 'no_linked_application' : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return res.json({
      ok: true,
      services,
      ladder: LADDER_STATUSES,
      pagination: { limit, offset },
      dataQuality: { unlinkedApplications: unlinkedCount },
    });
  } catch (err: any) {
    logger.error('[AdminProviderControl] list failed', { err: err?.message });
    return res.status(500).json({ error: 'provider_control_list_failed' });
  }
});

export default router;
