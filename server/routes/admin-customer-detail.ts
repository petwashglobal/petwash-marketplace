/**
 * Admin Customer Detail Routes
 * Mounted at /api/admin/customer-detail (under the /api/admin/ middleware stack).
 *
 *   GET /api/admin/customer-detail/:userId               — overview (profile + counts)
 *   GET /api/admin/customer-detail/:userId/consents      — consent ledger reads
 *   GET /api/admin/customer-detail/:userId/notifications — notification log reads
 *   GET /api/admin/customer-detail/:userId/payments      — unified pw_payments reads
 *
 * ADDITIVE & READ-ONLY. This router never mutates customer data. It is the
 * supplemental detail surface for the admin Customers experience — the existing
 * CustomerManagement list shows the roster; this exposes a single customer's
 * profile, member number, consents, notifications and payments in one place.
 *
 * Resilience: every sub-section runs in its own try/catch. A failing sub-query
 * never 500s the whole overview — instead it returns null for that section and
 * records the reason under `errors`, mirroring the pattern in
 * server/routes/pet-care-timeline.ts (reminder-preview).
 *
 * Privacy: viewing a customer profile is a sensitive read. The overview fetch is
 * audit-logged (actionType 'ADMIN_VIEW_CUSTOMER_DETAIL') so we always know who
 * looked at whom.
 *
 * requireAdmin (isSuperAdmin) guards the whole router.
 */
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  users,
  userConsents,
  notificationLogs,
  washHistory,
  walletAccounts,
} from '../../shared/schema';
import { pwPayments } from '../../shared/schema-payments';
import { and, eq, desc, sql } from 'drizzle-orm';
import { isSuperAdmin, isSuperAdminVerified } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  // Canonical super-admin gate: SUPER_ADMIN_EMAILS allowlist AND
  // Firebase-verified email. isSuperAdminVerified enforces both;
  // the plain isSuperAdmin(email) primitive is deprecated for gates.
  if (!isSuperAdminVerified(req)) {
return res.status(403).json({ error: 'Full admin access required' });
  
  }
  next();
}
router.use(requireAdmin);

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

// ============================================================================
// GET /:userId — overview (profile + counts). Audit-logged.
// ============================================================================
router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const errors: Record<string, string> = {};

  // ── Profile (the one query we cannot degrade — no user = 404) ──────────────
  let profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    emailVerified: boolean;
    phone: string | null;
    phoneVerified: boolean;
    membershipNumber: string | null;
    preferredLanguage: string | null;
    country: string | null;
    accountStatus: string | null;
    loyaltyTier: string | null;
    createdAt: string | null;
    lastLoginAt: string | null;
  } | null = null;

  try {
    const [row] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        emailVerified: users.emailVerified,
        phone: users.phone,
        phoneVerified: users.phoneVerified,
        membershipNumber: users.membershipNumber,
        language: users.language,
        country: users.country,
        userStatus: users.userStatus,
        activationStatus: users.activationStatus,
        loyaltyTier: users.loyaltyTier,
        blocked: users.blocked,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: 'customer_not_found' });
    }

    profile = {
      id: row.id,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      email: row.email ?? null,
      emailVerified: !!row.emailVerified,
      phone: row.phone ?? null,
      phoneVerified: !!row.phoneVerified,
      membershipNumber: row.membershipNumber ?? null,
      preferredLanguage: row.language ?? null,
      country: row.country ?? null,
      // Prefer the activation-state-machine status; fall back to legacy userStatus.
      accountStatus: row.blocked
        ? 'blocked'
        : row.activationStatus ?? row.userStatus ?? null,
      loyaltyTier: row.loyaltyTier ?? null,
      createdAt: iso(row.createdAt),
      lastLoginAt: iso(row.lastLoginAt),
    };
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] profile lookup failed', { userId, err: err?.message });
    return res.status(500).json({ error: 'customer_profile_read_failed' });
  }

  // ── Counts: orders (wash history rows) ─────────────────────────────────────
  let ordersCount: number | null = null;
  try {
    const [r] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(washHistory)
      .where(eq(washHistory.userId, userId));
    ordersCount = r?.c ?? 0;
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] orders count failed', { userId, err: err?.message });
    errors.ordersCount = 'query failed';
  }

  // ── Counts: payments (pw_payments rows) ────────────────────────────────────
  let paymentsCount: number | null = null;
  try {
    const [r] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(pwPayments)
      .where(eq(pwPayments.customerId, userId));
    paymentsCount = r?.c ?? 0;
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] payments count failed', { userId, err: err?.message });
    errors.paymentsCount = 'query failed';
  }

  // ── Wallet balance (cash wallet, in cents) ─────────────────────────────────
  let walletBalanceCents: number | null = null;
  try {
    const rows = await db
      .select({
        cash: walletAccounts.cashWalletBalanceCents,
        egift: walletAccounts.egiftBalanceCents,
        washCredits: walletAccounts.washPackageCredits,
      })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId));
    if (rows.length) {
      walletBalanceCents = rows.reduce((a, w) => a + (w.cash ?? 0), 0);
    }
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] wallet lookup failed', { userId, err: err?.message });
    errors.walletBalanceCents = 'query failed';
  }

  // ── Sensitive read — log who viewed this customer profile ──────────────────
  try {
    const adminId =
      (req as any).firebaseUser?.uid || (req as any).firebaseUser?.email || 'unknown_admin';
    await logAuditEvent({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'ADMIN_VIEW_CUSTOMER_DETAIL',
      targetType: 'user',
      targetId: userId,
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
      userAgent: req.headers['user-agent'],
      metadata: { adminEmail: (req as any).firebaseUser?.email, membershipNumber: profile?.membershipNumber },
      severity: 'info',
    });
  } catch (err: any) {
    // Never fail the read because the audit write failed; just note it.
    logger.error('[AdminCustomerDetail] audit log failed', { userId, err: err?.message });
  }

  return res.json({
    ok: true,
    profile,
    counts: {
      orders: ordersCount,
      payments: paymentsCount,
      walletBalanceCents,
    },
    errors,
  });
});

// ============================================================================
// GET /:userId/consents — consent ledger (read-only, newest first)
// ============================================================================
router.get('/:userId/consents', async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const rows = await db
      .select({
        id: userConsents.id,
        consentType: userConsents.consentType,
        consentVersion: userConsents.consentVersion,
        accepted: userConsents.accepted,
        acceptedAt: userConsents.acceptedAt,
        method: userConsents.method,
        source: userConsents.source,
        locale: userConsents.locale,
      })
      .from(userConsents)
      .where(eq(userConsents.userId, userId))
      .orderBy(desc(userConsents.acceptedAt))
      .limit(200);

    return res.json({
      ok: true,
      consents: rows.map((r) => ({ ...r, acceptedAt: iso(r.acceptedAt as any) })),
    });
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] consents read failed', { userId, err: err?.message });
    return res.status(500).json({ error: 'consents_read_failed' });
  }
});

// ============================================================================
// GET /:userId/notifications — notification log (read-only, newest first)
// ============================================================================
router.get('/:userId/notifications', async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const rows = await db
      .select({
        id: notificationLogs.id,
        templateKey: notificationLogs.templateKey,
        channel: notificationLogs.channel,
        status: notificationLogs.status,
        title: notificationLogs.title,
        body: notificationLogs.body,
        eventType: notificationLogs.eventType,
        sentAt: notificationLogs.sentAt,
        deliveredAt: notificationLogs.deliveredAt,
        failureReason: notificationLogs.failureReason,
        isRead: notificationLogs.isRead,
        createdAt: notificationLogs.createdAt,
      })
      .from(notificationLogs)
      .where(eq(notificationLogs.recipientUserId, userId))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(200);

    return res.json({
      ok: true,
      notifications: rows.map((r) => ({
        ...r,
        sentAt: iso(r.sentAt as any),
        deliveredAt: iso(r.deliveredAt as any),
        createdAt: iso(r.createdAt as any),
      })),
    });
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] notifications read failed', { userId, err: err?.message });
    return res.status(500).json({ error: 'notifications_read_failed' });
  }
});

// ============================================================================
// GET /:userId/payments — unified pw_payments (read-only, newest first)
// ============================================================================
router.get('/:userId/payments', async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const rows = await db
      .select({
        id: pwPayments.id,
        paymentId: pwPayments.paymentId,
        transactionType: pwPayments.transactionType,
        vertical: pwPayments.vertical,
        status: pwPayments.status,
        grossCents: pwPayments.grossCents,
        vatCents: pwPayments.vatCents,
        paymentMethod: pwPayments.paymentMethod,
        paymentProcessor: pwPayments.paymentProcessor,
        createdAt: pwPayments.createdAt,
        settledAt: pwPayments.settledAt,
      })
      .from(pwPayments)
      .where(eq(pwPayments.customerId, userId))
      .orderBy(desc(pwPayments.createdAt))
      .limit(200);

    return res.json({
      ok: true,
      payments: rows.map((r) => ({
        ...r,
        createdAt: iso(r.createdAt as any),
        settledAt: iso(r.settledAt as any),
      })),
    });
  } catch (err: any) {
    logger.error('[AdminCustomerDetail] payments read failed', { userId, err: err?.message });
    return res.status(500).json({ error: 'payments_read_failed' });
  }
});

export default router;
