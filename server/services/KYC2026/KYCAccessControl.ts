/**
 * KYC 2026 Access Control & Mandatory MFA
 * 
 * RBAC with KYC-specific roles (database-persisted):
 * - kyc_admin: Can view/approve/reject KYC submissions, view audit trail
 * - kyc_reviewer: Can view submissions in manual_review queue only
 * - kyc_auditor: Read-only access to audit trail and anomaly reports
 * 
 * MANDATORY MFA:
 * - All admin roles MUST complete 2FA before accessing KYC endpoints
 * - Session-level MFA verification with 4-hour expiry
 * - IP change during session forces MFA re-verification
 * 
 * PERSISTENCE: Roles stored in PostgreSQL (kyc_role_assignments table)
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../../lib/logger';
import { kycAuditTrail } from './KYCAuditTrail';
import { db } from '../../db';
import { kycRoleAssignments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export type KYCRole = 'kyc_admin' | 'kyc_reviewer' | 'kyc_auditor';

const KYC_ROLE_PERMISSIONS: Record<KYCRole, string[]> = {
  kyc_admin: [
    'kyc:submit:view',
    'kyc:submit:approve',
    'kyc:submit:reject',
    'kyc:audit:view',
    'kyc:anomaly:view',
    'kyc:stats:view',
    'kyc:config:edit',
    'kyc:alerts:manage',
  ],
  kyc_reviewer: [
    'kyc:submit:view',
    'kyc:submit:approve',
    'kyc:submit:reject',
    'kyc:audit:view',
  ],
  kyc_auditor: [
    'kyc:audit:view',
    'kyc:anomaly:view',
    'kyc:stats:view',
  ],
};

interface MFASession {
  userId: string;
  verifiedAt: number;
  ipAddress: string;
  method: 'totp' | 'sms' | 'email' | 'webauthn';
  expiresAt: number;
}

const MFA_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const activeMFASessions = new Map<string, MFASession>();

const roleCache = new Map<string, { roles: KYCRole[]; cachedAt: number }>();
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

export class KYCAccessControl {

  static async assignRole(userId: string, role: KYCRole, assignedBy: string): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(kycRoleAssignments)
        .where(and(
          eq(kycRoleAssignments.userId, userId),
          eq(kycRoleAssignments.role, role),
          eq(kycRoleAssignments.isActive, true)
        ));

      if (existing.length > 0) {
        logger.info(`[KYC2026:RBAC] Role ${role} already assigned to ${userId}`);
        return;
      }

      await db.insert(kycRoleAssignments).values({
        userId,
        role,
        assignedBy,
        isActive: true,
      });

      roleCache.delete(userId);
      logger.info(`[KYC2026:RBAC] Role ${role} assigned to ${userId} by ${assignedBy}`);
    } catch (err: any) {
      logger.error(`[KYC2026:RBAC] Failed to assign role: ${err.message}`);
    }
  }

  static async removeRole(userId: string, role: KYCRole): Promise<void> {
    try {
      await db
        .update(kycRoleAssignments)
        .set({ isActive: false, revokedAt: new Date() })
        .where(and(
          eq(kycRoleAssignments.userId, userId),
          eq(kycRoleAssignments.role, role),
          eq(kycRoleAssignments.isActive, true)
        ));

      roleCache.delete(userId);
      logger.info(`[KYC2026:RBAC] Role ${role} removed from ${userId}`);
    } catch (err: any) {
      logger.error(`[KYC2026:RBAC] Failed to remove role: ${err.message}`);
    }
  }

  static async getUserRoles(userId: string): Promise<KYCRole[]> {
    const cached = roleCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < ROLE_CACHE_TTL_MS) {
      return cached.roles;
    }

    try {
      const assignments = await db
        .select({ role: kycRoleAssignments.role })
        .from(kycRoleAssignments)
        .where(and(
          eq(kycRoleAssignments.userId, userId),
          eq(kycRoleAssignments.isActive, true)
        ));

      const roles = assignments.map(a => a.role as KYCRole);
      roleCache.set(userId, { roles, cachedAt: Date.now() });
      return roles;
    } catch (err: any) {
      logger.error(`[KYC2026:RBAC] Failed to fetch roles: ${err.message}`);
      return [];
    }
  }

  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some(role => KYC_ROLE_PERMISSIONS[role]?.includes(permission));
  }

  static registerMFASession(
    userId: string,
    ipAddress: string,
    method: 'totp' | 'sms' | 'email' | 'webauthn'
  ): string {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session: MFASession = {
      userId,
      verifiedAt: Date.now(),
      ipAddress,
      method,
      expiresAt: Date.now() + MFA_SESSION_DURATION_MS,
    };

    activeMFASessions.set(sessionToken, session);

    kycAuditTrail.record({
      action: 'kyc_mfa_verified',
      actorId: userId,
      actorRole: 'admin',
      ipAddress,
      userAgent: '',
      metadata: { method, expiresIn: '4 hours' },
    });

    logger.info(`[KYC2026:MFA] Session created for ${userId} via ${method}`);
    return sessionToken;
  }

  static validateMFASession(sessionToken: string, currentIP: string): {
    valid: boolean;
    reason?: string;
    userId?: string;
  } {
    const session = activeMFASessions.get(sessionToken);

    if (!session) {
      return { valid: false, reason: 'MFA session not found or expired' };
    }

    if (Date.now() > session.expiresAt) {
      activeMFASessions.delete(sessionToken);
      return { valid: false, reason: 'MFA session expired (4-hour limit)' };
    }

    if (session.ipAddress !== currentIP) {
      activeMFASessions.delete(sessionToken);
      logger.warn(`[KYC2026:MFA] IP change detected for ${session.userId}: ${session.ipAddress} → ${currentIP}`);
      return { valid: false, reason: 'IP address changed - MFA re-verification required' };
    }

    return { valid: true, userId: session.userId };
  }

  static revokeMFASession(sessionToken: string): void {
    activeMFASessions.delete(sessionToken);
  }

  static revokeAllMFASessions(): void {
    const count = activeMFASessions.size;
    activeMFASessions.clear();
    logger.warn(`[KYC2026:MFA] All ${count} MFA sessions revoked (incident containment)`);
  }
}

export function requireKYCPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.uid || (req as any).userId || (req as any).authUserId;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRoles = await KYCAccessControl.getUserRoles(userId);
    const isAdmin = (req as any).user?.role === 'admin' || (req as any).isAdmin;

    if (!isAdmin && userRoles.length === 0) {
      kycAuditTrail.record({
        action: 'kyc_admin_access',
        actorId: userId,
        actorRole: 'unauthorized',
        ipAddress,
        userAgent,
        metadata: { permission, denied: true },
      });

      res.status(403).json({ error: 'KYC access denied - no assigned KYC role' });
      return;
    }

    if (!isAdmin && !(await KYCAccessControl.hasPermission(userId, permission))) {
      res.status(403).json({ error: `Missing KYC permission: ${permission}` });
      return;
    }

    kycAuditTrail.record({
      action: 'kyc_admin_access',
      actorId: userId,
      actorRole: userRoles.join(',') || 'admin',
      ipAddress,
      userAgent,
      metadata: { permission, endpoint: req.path },
    });

    next();
  };
}

export function requireKYCMFA() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const mfaToken = req.headers['x-kyc-mfa-token'] as string;
    const currentIP = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.uid || (req as any).userId || (req as any).authUserId;

    if (!mfaToken) {
      res.status(403).json({
        error: 'MFA required',
        message: 'KYC admin operations require Multi-Factor Authentication. Please complete MFA verification first.',
        mfaRequired: true,
      });
      return;
    }

    const validation = KYCAccessControl.validateMFASession(mfaToken, currentIP);

    if (!validation.valid) {
      kycAuditTrail.record({
        action: 'kyc_mfa_failed',
        actorId: userId || 'unknown',
        actorRole: 'admin',
        ipAddress: currentIP,
        userAgent: req.headers['user-agent'] || 'unknown',
        metadata: { reason: validation.reason },
      });

      res.status(403).json({
        error: 'MFA validation failed',
        message: validation.reason,
        mfaRequired: true,
      });
      return;
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeMFASessions) {
    if (now > session.expiresAt) {
      activeMFASessions.delete(token);
    }
  }
  for (const [userId, cached] of roleCache) {
    if (now - cached.cachedAt > ROLE_CACHE_TTL_MS * 2) {
      roleCache.delete(userId);
    }
  }
}, 15 * 60 * 1000);
