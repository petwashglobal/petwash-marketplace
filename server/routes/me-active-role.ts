/**
 * /api/me/active-role — Phase 5 activeRole read/write endpoint.
 *
 * CEO D5 (auth-rebuild directive 2026-09-01):
 *   activeRole is UX preference, never authority. Server verifies the
 *   requested role is in the user's authorized capabilities before
 *   writing. Writes `users.last_active_role` (survives session death;
 *   default for a fresh session). Per-session `sessions.active_role`
 *   ships in Phase 5.b once the Pet Wash session cookie is authoritative
 *   (Phase 3.c).
 *
 * Endpoints:
 *   GET  /api/me/active-role
 *     Returns { lastActiveRole, authorizedRoles }.
 *
 *   POST /api/me/active-role  body: { role: string }
 *     Verifies role ∈ authorizedRoles, updates users.last_active_role,
 *     emits ROLE_SWITCHED audit event. Rejects with 403 on unauthorized
 *     role. Emits 400 on unknown role.
 *
 * Guard rules (all enforced here):
 *   - The endpoint requires validateFirebaseToken — anonymous callers get 401.
 *   - The requested role is compared against a server-computed
 *     capabilities list; NEVER against a client-supplied hint.
 *   - The set of accepted role names is a FIXED allowlist (customer,
 *     provider, staff, admin). Any other value returns 400.
 *   - `super_admin` is intentionally NOT switchable — the elevated role
 *     is per-session and per-request, not a mode preference.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { isSuperAdminVerified } from '../middleware/rbac';
import { getUserCapabilities } from '../lib/userCapabilities';
import { rolesFromCapabilities } from '@shared/lib/userCapabilities';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';

const router = Router();

/** Closed allowlist. NEVER accept a role name from a random user input. */
const ACCEPTED_ROLES = ['customer', 'provider', 'staff', 'admin'] as const;
type AcceptedRole = (typeof ACCEPTED_ROLES)[number];

const SetActiveRoleBody = z.object({
  role: z.enum(ACCEPTED_ROLES),
});

router.get('/active-role', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  try {
    const [row] = await db
      .select({ lastActiveRole: users.lastActiveRole })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    const caps = await getUserCapabilities(uid, { superAdminVerified: isSuperAdminVerified(req) });
    const authorizedRoles = rolesFromCapabilities(caps);
    return res.json({
      lastActiveRole: row?.lastActiveRole ?? null,
      authorizedRoles,
    });
  } catch (err: any) {
    logger.error('[me/active-role] GET failed', { uid, error: err?.message });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.post('/active-role', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const body = SetActiveRoleBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      error: 'BAD_ROLE',
      message: `role must be one of: ${ACCEPTED_ROLES.join(', ')}`,
    });
  }
  const requested: AcceptedRole = body.data.role;

  try {
    const caps = await getUserCapabilities(uid, { superAdminVerified: isSuperAdminVerified(req) });
    const authorizedRoles = rolesFromCapabilities(caps);
    if (!authorizedRoles.includes(requested)) {
      // Never reveal WHICH other roles the user has — the client already
      // knows via GET /api/me/active-role. Simple 403 keeps the surface
      // narrow.
      logger.warn('[me/active-role] switch rejected — role not authorized', {
        uid,
        requested,
        // authorizedRoles omitted from the log context to avoid teaching
        // an attacker the shape of a compromised account.
      });
      return res.status(403).json({ error: 'ROLE_NOT_AUTHORIZED' });
    }

    await db
      .update(users)
      .set({ lastActiveRole: requested, updatedAt: new Date() })
      .where(eq(users.id, uid));

    await logAuditEvent({
      actorUserId: uid,
      actorRole: 'user',
      actionType: 'ROLE_SWITCHED',
      targetType: 'user',
      targetId: uid,
      severity: 'info',
      metadata: {
        to: requested,
        note: 'Phase 5 activeRole preference write (never grants authority).',
      },
    });

    return res.json({
      lastActiveRole: requested,
      authorizedRoles,
    });
  } catch (err: any) {
    logger.error('[me/active-role] POST failed', { uid, error: err?.message });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

export default router;
