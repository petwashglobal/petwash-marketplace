import { Router } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { requireAuth } from '../customAuth';
import { logAuditEvent } from '../middleware/auditLog';

const router = Router();

// P0-FIX: Super-admin email list must not be hardcoded in source.
// Set SUPER_ADMIN_EMAILS as a comma-separated list in environment variables.
// Example: SUPER_ADMIN_EMAILS=ceo@company.com,cfo@company.com
function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: SUPER_ADMIN_EMAILS environment variable is required in production');
    }
    console.warn('[access-requests] WARNING: SUPER_ADMIN_EMAILS not set — all super-admin access will be denied');
    return [];
  }
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Strict super-admin check.
 *
 * PR-A P0-3: Now requires Firebase to have verified the email
 * (`req.firebaseUser.email_verified === true`) before passing the
 * allowlist check. Without this gate an attacker who registers an
 * account with an email matching SUPER_ADMIN_EMAILS but who never
 * verifies it could approve their own staff access request.
 */
function isSuperAdmin(req: { firebaseUser?: { email?: string; email_verified?: boolean } }): boolean {
  const fu = req.firebaseUser;
  if (!fu) return false;
  if (fu.email_verified !== true) return false;
  const email = fu.email;
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
}

// PR-ACCESS-REQUESTS-MINE-PROJECTION (2026-08-15) — fire-order item 104.
// storage.getStaffAccessRequestByUser returns the full staff_access_requests
// row via bare db.select(), which includes:
//   decidedBy      — admin uid that made the decision (internal only)
//   approvalScope  — internal jsonb metadata (approver-level scoping)
//   userId         — redundant with the caller's authenticated uid
//   id             — internal db serial; the applicant does not need it
// Reason is INTENTIONALLY kept — the applicant is entitled to see why
// their request was rejected. Fresh columns added to the schema in the
// future do NOT leak automatically; the author must consciously add
// them to this projection.
type SafeAccessRequestView = {
  requestedRole: string;
  department: string | null;
  departmentCode: string | null;
  justification: string | null;
  managerName: string | null;
  status: string;
  reason: string | null;
  requestedAt: Date | string | null;
  decidedAt: Date | string | null;
};
function toSafeAccessRequestView(r: any): SafeAccessRequestView {
  return {
    requestedRole: r.requestedRole,
    department: r.department ?? null,
    departmentCode: r.departmentCode ?? null,
    justification: r.justification ?? null,
    managerName: r.managerName ?? null,
    status: r.status,
    reason: r.reason ?? null,
    requestedAt: r.requestedAt ?? null,
    decidedAt: r.decidedAt ?? null,
  };
}

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const request = await storage.getStaffAccessRequestByUser(userId);
    res.json({ request: request ? toSafeAccessRequestView(request) : null });
  } catch (error) {
    logger.error('[Access Requests] Error fetching user request', { error });
    res.status(500).json({ error: 'Failed to fetch access request' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.firebaseUser?.uid;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { requestedRole, department, justification, managerName } = req.body;

    if (requestedRole === 'admin' || requestedRole === 'management' || requestedRole === 'super_admin') {
      return res.status(403).json({ error: 'Cannot request privileged role from public interface' });
    }

    if (requestedRole !== 'staff') {
      return res.status(400).json({ error: 'Only staff role can be requested' });
    }

    const existing = await storage.getStaffAccessRequestByUser(userId);
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ error: 'You already have a pending access request', request: existing });
    }

    const request = await storage.createStaffAccessRequest({
      userId,
      requestedRole,
      department: department || null,
      justification: justification || null,
      managerName: managerName || null,
      status: 'pending',
    });

    await storage.updateUser(userId, {
      signupIntent: 'staff_request',
      userStatus: 'staff_pending_approval',
    } as any);

    await logAuditEvent({
      actorUserId: userId,
      actionType: 'STAFF_ACCESS_REQUEST',
      targetType: 'staff_access_request',
      targetId: String(request.id),
      ip: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
      traceId: (req as any).traceId,
      metadata: { requestedRole, department },
    });

    logger.info('[Access Requests] New staff access request created', { userId, requestedRole, department });
    res.status(201).json({ request });
  } catch (error) {
    logger.error('[Access Requests] Error creating request', { error });
    res.status(500).json({ error: 'Failed to create access request' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const requests = await storage.getAllStaffAccessRequests();
    res.json({ requests });
  } catch (error) {
    logger.error('[Access Requests] Error listing requests', { error });
    res.status(500).json({ error: 'Failed to list access requests' });
  }
});

router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    const email = req.firebaseUser?.email;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

    const updated = await storage.updateStaffAccessRequest(id, {
      status: 'approved',
      decidedAt: new Date(),
      decidedBy: email!,
    });

    const now = new Date();
    try {
      // Additive capabilities (PR-AUTH-MULTIROLE-5): approving a staff
      // request adds a staff capability to the account — it does NOT
      // replace the base customer / loyalty / provider identity. The staff
      // capability is derived by server/lib/userCapabilities.ts from
      // staff_access_requests.status='approved' (written above at line 132),
      // so writing users.role='staff' here would clobber the account's
      // other capabilities without adding anything the aggregator can't
      // already see. Left in place: accessLevel + approvedBy + approvedAt +
      // userStatus + staffApprovedAt + mfaRequired, which are staff-side
      // audit / MFA settings that are additive by shape.
      await storage.updateUser(updated.userId, {
        accessLevel: 4,
        approvedBy: email!,
        approvedAt: now,
        userStatus: 'staff_active',
        staffApprovedAt: now,
        mfaRequired: true,
      } as any);
    } catch (userErr) {
      logger.error('[Access Requests] Failed to update user record after staff approval', { userErr, userId: updated.userId });
    }

    // PR-3 P0-2: Sync Firebase customClaims so the user's ID token reflects
    // the new 'staff' role on the next request — without this, rbac
    // middleware sees the old role until the token refreshes (~1 hour) and
    // newly-approved staff are locked out of admin pages.
    // Pattern mirrored from server/routes/post-login.ts:807-821.
    // Non-blocking on Firebase failures: approval has already succeeded.
    try {
      const { syncFirebaseClaims } = await import('../lib/syncFirebaseClaims');
      await syncFirebaseClaims(updated.userId, {
        role: 'staff',
        accountType: 'internal',
        staffApprovedAt: now.toISOString(),
      });
    } catch (claimsErr: any) {
      logger.warn('[Access Requests] Firebase claims sync failed (non-blocking)', {
        userId: updated.userId,
        error: claimsErr?.message,
      });
    }

    await logAuditEvent({
      actorUserId: req.firebaseUser?.uid,
      actorRole: 'super_admin',
      actionType: 'STAFF_APPROVE',
      targetType: 'user',
      targetId: updated.userId,
      ip: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
      traceId: (req as any).traceId,
      metadata: { requestId: id, approvedRole: 'staff', mfaRequired: true },
    });

    logger.info('[Access Requests] Request approved - user_status set to staff_active, mfa_required=true', { id, decidedBy: email, userId: updated.userId });
    res.json({ request: updated });
  } catch (error) {
    logger.error('[Access Requests] Error approving request', { error });
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.post('/:id/deny', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    const email = req.firebaseUser?.email;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid request ID' });

    const { reason } = req.body || {};

    const updated = await storage.updateStaffAccessRequest(id, {
      status: 'rejected',
      decidedAt: new Date(),
      decidedBy: email!,
      reason: reason || null,
    });

    await logAuditEvent({
      actorUserId: req.firebaseUser?.uid,
      actorRole: 'super_admin',
      actionType: 'STAFF_DENY',
      targetType: 'user',
      targetId: updated.userId,
      ip: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
      traceId: (req as any).traceId,
      metadata: { requestId: id, reason },
    });

    logger.info('[Access Requests] Request denied', { id, decidedBy: email, reason });
    res.json({ request: updated });
  } catch (error) {
    logger.error('[Access Requests] Error denying request', { error });
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

export default router;
