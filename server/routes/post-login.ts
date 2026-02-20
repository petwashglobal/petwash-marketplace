import type { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../lib/logger";
import { ALLOWED_INTENTS, type UserStatus, type UserRole } from "@shared/schema";
import { logAuditEvent } from "../middleware/auditLog";

const ADMIN_APPROVER_EMAIL = "nir.h@petwash.co.il";

const SUPER_ADMINS: string[] = [
  'nirhadad1@gmail.com',
  'nir.h@petwash.co.il',
  'ido.s@petwash.co.il',
  'idoshaka@gmail.com',
  'idoshakarzi110@gmail.com',
];

const REJECTED_INTENTS = ['admin', 'management', 'super_admin'];

type PostLoginResponse = {
  nextUrl: string;
  reason?: string;
  profileStatus: string;
  role: string;
  userStatus: string;
  missingFields?: string[];
  onboardingCaseId?: number | null;
  requiredActions?: string[];
};

const REQUIRED_FIELDS_BY_ROLE: Record<string, string[]> = {
  customer: ['firstName', 'lastName', 'termsAcceptedAt'],
  loyalty: ['firstName', 'lastName', 'dateOfBirth', 'termsAcceptedAt'],
  provider: ['firstName', 'lastName', 'phone', 'termsAcceptedAt'],
  staff: ['firstName', 'lastName', 'termsAcceptedAt'],
  admin: ['firstName', 'lastName', 'termsAcceptedAt'],
  management: ['firstName', 'lastName', 'termsAcceptedAt'],
};

function getMissingFields(user: any, role: string): string[] {
  const required = REQUIRED_FIELDS_BY_ROLE[role] || REQUIRED_FIELDS_BY_ROLE['customer'];
  return required.filter((field: string) => !user[field]);
}

function intentToRole(intent: string): string {
  switch (intent) {
    case 'customer': return 'customer';
    case 'loyalty': return 'loyalty';
    case 'provider': return 'customer';
    case 'staff_request': return 'customer';
    default: return 'customer';
  }
}

function buildRequiredActions(userStatus: string, role: string, user: any): string[] {
  const actions: string[] = [];
  if (userStatus === 'profile_incomplete') actions.push('COMPLETE_PROFILE');
  if (user.email && !user.emailVerified && user.authProvider === 'email') actions.push('VERIFY_EMAIL');
  if (['staff', 'management', 'admin', 'super_admin'].includes(role) && !user.mfaEnrolled) actions.push('ENROLL_MFA');
  if (userStatus === 'kyc_pending') actions.push('SUBMIT_KYC');
  if (userStatus === 'provider_pending_approval' || userStatus === 'staff_pending_approval') actions.push('WAIT_FOR_APPROVAL');
  if (!user.termsAcceptedAt) actions.push('ACCEPT_TERMS');
  if (!user.privacyAcceptedAt) actions.push('ACCEPT_PRIVACY');
  return actions;
}

async function computeUserStatus(user: any, userId: string): Promise<UserStatus> {
  const role = user.role || 'customer';

  if (!user.role || user.role === 'new') {
    return 'new';
  }

  const missing = getMissingFields(user, role);
  if (missing.length > 0) {
    return 'profile_incomplete';
  }

  const providerApp = await storage.getProviderApplicationByUser(userId);
  if (providerApp) {
    if (providerApp.status === 'approved') {
      return 'provider_active';
    }
    if (providerApp.status === 'pending' || providerApp.status === 'pending_review' || providerApp.status === 'under_review') {
      return 'provider_pending_approval';
    }
    if (providerApp.status === 'draft') {
      return 'kyc_pending';
    }
    if (providerApp.status === 'rejected') {
      return 'kyc_rejected';
    }
  }

  if (user.signupIntent === 'staff_request' || role === 'staff') {
    const staffReq = await storage.getStaffAccessRequestByUser(userId);
    if (staffReq) {
      if (staffReq.status === 'approved') {
        return 'staff_active';
      }
      if (staffReq.status === 'pending') {
        return 'staff_pending_approval';
      }
    }
  }

  return 'profile_complete';
}

function buildRoutingResponse(user: any, role: string, userStatus: string, missingFields: string[], providerApp?: any, staffReq?: any): PostLoginResponse {
  if (user.blocked) {
    return { nextUrl: '/blocked', reason: 'BLOCKED', profileStatus: 'blocked', role, userStatus };
  }

  const emailVerified = !!(user as any).emailVerified;
  const hasEmail = !!user.email;
  if (hasEmail && !emailVerified && (user as any).authProvider === 'email') {
    return { nextUrl: '/verify-email', reason: 'EMAIL_UNVERIFIED', profileStatus: 'incomplete', role, userStatus };
  }

  if (!role || role === 'new') {
    return { nextUrl: '/choose-role', reason: 'NO_ROLE', profileStatus: 'incomplete', role: 'customer', userStatus: 'new' };
  }

  if (missingFields.length > 0) {
    return { nextUrl: '/complete-profile', reason: 'PROFILE_INCOMPLETE', profileStatus: 'incomplete', role, userStatus, missingFields };
  }

  if (role === 'loyalty') {
    if (!user.dateOfBirth) {
      return { nextUrl: '/complete-profile', reason: 'PROFILE_INCOMPLETE', profileStatus: 'incomplete', role, userStatus, missingFields: ['dateOfBirth'] };
    }
    return { nextUrl: '/home', reason: 'OK', profileStatus: 'complete', role, userStatus };
  }

  if (providerApp) {
    if (providerApp.status === 'draft') {
      return { nextUrl: '/provider-onboarding', reason: 'KYC_REQUIRED', profileStatus: 'incomplete', role, userStatus };
    }
    if (providerApp.status === 'pending' || providerApp.status === 'pending_review' || providerApp.status === 'under_review') {
      return { nextUrl: '/provider/pending', reason: 'PROVIDER_APPROVAL_REQUIRED', profileStatus: 'pending_review', role, userStatus };
    }
    if (providerApp.status === 'rejected') {
      return { nextUrl: '/provider/rejected', reason: 'PROVIDER_REJECTED', profileStatus: 'rejected', role, userStatus };
    }
    if (providerApp.status === 'approved') {
      if (role === 'provider') {
        return { nextUrl: '/provider/dashboard', reason: 'OK', profileStatus: 'approved', role, userStatus };
      }
      return { nextUrl: '/provider/dashboard', reason: 'OK', profileStatus: 'approved', role, userStatus };
    }
  }

  if (staffReq) {
    if (staffReq.status === 'pending') {
      return { nextUrl: '/access-pending', reason: 'STAFF_APPROVAL_REQUIRED', profileStatus: 'pending_review', role, userStatus };
    }
    if (staffReq.status === 'rejected') {
      return { nextUrl: '/staff/rejected', reason: 'STAFF_REJECTED', profileStatus: 'rejected', role, userStatus };
    }
    if (staffReq.status === 'approved') {
      return { nextUrl: '/admin/dashboard', reason: 'OK', profileStatus: 'approved', role, userStatus };
    }
  }

  if (role === 'admin' || role === 'management' || role === 'super_admin' || role === 'staff') {
    const isApproved = !!(user as any).approvedAt && !!(user as any).approvedBy;
    if (!isApproved && role !== 'staff') {
      return { nextUrl: '/access-pending', reason: 'STAFF_APPROVAL_REQUIRED', profileStatus: 'pending_review', role, userStatus };
    }
    return { nextUrl: '/admin/dashboard', reason: 'OK', profileStatus: 'approved', role, userStatus };
  }

  return { nextUrl: '/home', reason: 'OK', profileStatus: 'complete', role, userStatus };
}

export async function postLoginDecider(req: Request, res: Response) {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    if ((user as any).blocked) {
      return res.json({
        nextUrl: '/blocked',
        reason: 'BLOCKED',
        profileStatus: 'blocked',
        role: (user as any).role || 'customer',
        userStatus: (user as any).userStatus || 'new',
      } as PostLoginResponse);
    }

    const emailVerified = !!(user as any).emailVerified;
    const hasEmail = !!user.email;
    if (hasEmail && !emailVerified && (user as any).authProvider === 'email') {
      return res.json({
        nextUrl: '/verify-email',
        reason: 'EMAIL_UNVERIFIED',
        profileStatus: 'incomplete',
        role: (user as any).role || 'customer',
        userStatus: (user as any).userStatus || 'new',
      } as PostLoginResponse);
    }

    const { intent } = req.body || {};
    let userRole = (user as any).role || null;

    if (intent && REJECTED_INTENTS.includes(intent)) {
      return res.status(403).json({
        error: "INTENT_REJECTED",
        message: `Role '${intent}' cannot be requested via public intent`,
      });
    }

    if (!userRole || userRole === 'new') {
      const safeIntent = (intent && (ALLOWED_INTENTS as readonly string[]).includes(intent)) ? intent : null;

      if (safeIntent) {
        const assignedRole = intentToRole(safeIntent);
        await storage.updateUser(userId, {
          role: assignedRole,
          signupIntent: safeIntent,
          accessLevel: 1,
          userStatus: 'profile_incomplete',
        } as any);
        userRole = assignedRole;

        if (safeIntent === 'provider') {
          const existingApp = await storage.getProviderApplicationByUser(userId);
          if (!existingApp) {
            await storage.createProviderApplicationDraft(userId, {
              email: user?.email || '',
              firstName: user?.firstName || '',
              lastName: user?.lastName || '',
              phoneNumber: user?.phone || '',
              city: (user as any)?.city || '',
              country: (user as any)?.country || 'IL',
            } as any);
          }
        }

        if (safeIntent === 'staff_request') {
          const existingReq = await storage.getStaffAccessRequestByUser(userId);
          if (!existingReq) {
            await storage.createStaffAccessRequest({
              userId,
              requestedRole: 'staff',
              status: 'pending',
            });
          }
        }
      } else {
        return res.json({
          nextUrl: '/choose-role',
          reason: 'NO_ROLE',
          profileStatus: 'incomplete',
          role: 'customer',
          userStatus: 'new',
        } as PostLoginResponse);
      }
    }

    const refreshedUser = await storage.getUser(userId);
    const u = refreshedUser || user;
    const effectiveRole = (u as any).role || userRole || 'customer';
    const missingFields = getMissingFields(u, effectiveRole);

    let providerApp: any = null;
    let staffReq: any = null;

    if ((u as any).signupIntent === 'provider' || effectiveRole === 'provider') {
      providerApp = await storage.getProviderApplicationByUser(userId);
    }

    if ((u as any).signupIntent === 'staff_request' || effectiveRole === 'staff') {
      staffReq = await storage.getStaffAccessRequestByUser(userId);
    }

    if (effectiveRole === 'customer' && !providerApp && !staffReq) {
      providerApp = await storage.getProviderApplicationByUser(userId);
      if (!providerApp) {
        staffReq = await storage.getStaffAccessRequestByUser(userId);
      }
    }

    const userStatus = await computeUserStatus(u, userId);
    const updates: Record<string, any> = {
      userStatus,
      lastLoginAt: new Date(),
    };

    const { deviceInfo } = req.body || {};
    const authProvider = (req as any).authProvider || (u as any).authProvider;
    if (authProvider && !(u as any).authProvider) {
      updates.authProvider = authProvider;
    }
    if (deviceInfo?.deviceId && !(u as any).deviceId) {
      updates.deviceId = deviceInfo.deviceId;
    }

    if (userStatus === 'provider_active' && effectiveRole !== 'provider') {
      updates.role = 'provider';
      updates.providerApprovedAt = new Date();
      effectiveRole = 'provider';
    }

    if (userStatus === 'staff_active' && !['staff', 'management', 'admin'].includes(effectiveRole)) {
      updates.role = 'staff';
      updates.staffApprovedAt = new Date();
      updates.mfaRequired = true;
      effectiveRole = 'staff';
    }

    await storage.updateUser(userId, updates as any);

    const onboardingContext = (u as any).signupIntent || effectiveRole;
    const validContexts = ['customer', 'loyalty', 'provider', 'staff'];
    const context = validContexts.includes(onboardingContext) ? onboardingContext : 'customer';
    let onboardingCaseId: number | null = null;
    const existingCase = await storage.getOnboardingCase(userId, context);
    if (!existingCase) {
      const newCase = await storage.createOnboardingCase({
        userId,
        context,
        status: userStatus === 'profile_complete' || userStatus === 'provider_active' || userStatus === 'staff_active' ? 'approved' : 'started',
        currentStep: userStatus === 'profile_incomplete' ? 'profile_required' : userStatus === 'kyc_pending' ? 'kyc_required' : userStatus,
      });
      onboardingCaseId = newCase?.id ?? null;
    } else {
      onboardingCaseId = existingCase.id;
      if (existingCase.status !== 'approved' && (userStatus === 'profile_complete' || userStatus === 'provider_active' || userStatus === 'staff_active')) {
        await storage.updateOnboardingCase(existingCase.id, {
          status: 'approved',
          currentStep: userStatus,
        });
      } else if (existingCase.currentStep !== userStatus) {
        await storage.updateOnboardingCase(existingCase.id, {
          currentStep: userStatus,
          status: userStatus === 'kyc_pending' ? 'kyc_required' : userStatus === 'provider_pending_approval' ? 'pending_review' : existingCase.status,
        });
      }
    }

    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString()?.split(',')[0] || '';
    const userAgent = req.headers['user-agent'] || '';
    const traceId = (req as any).traceId || '';

    await storage.logSecurityEvent({
      userId,
      eventType: 'login_success',
      ip: clientIp,
      userAgent,
      riskScore: 0,
      metadata: { role: effectiveRole, status: userStatus, traceId },
    });

    logAuditEvent({
      actorUserId: userId,
      actorRole: effectiveRole,
      actionType: 'POST_LOGIN',
      targetType: 'user',
      targetId: userId,
      ip: clientIp,
      userAgent,
      traceId,
      metadata: { userStatus, intent: (u as any).signupIntent, role: effectiveRole },
    });

    const response = buildRoutingResponse(u, effectiveRole, userStatus, missingFields, providerApp, staffReq);
    logger.info(`[PostLogin] User ${userId} → ${response.nextUrl} (role=${effectiveRole}, status=${userStatus}, reason=${response.reason})`);
    return res.json({
      ...response,
      onboardingCaseId,
      requiredActions: buildRequiredActions(userStatus, effectiveRole, u),
    });

  } catch (error: any) {
    logger.error(`[PostLogin] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function getWhoami(req: Request, res: Response) {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const role = (user as any).role || 'customer';
    const userStatus = (user as any).userStatus || 'new';
    const missingFields = getMissingFields(user, role);
    const profileStatus = missingFields.length === 0 ? 'complete' : 'incomplete';

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role,
        userStatus,
        profilePictureUrl: (user as any).profileImageUrl || null,
      },
      profileStatus,
      userStatus,
      role,
      missingFields,
    });
  } catch (error: any) {
    logger.error(`[Whoami] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function chooseRole(req: Request, res: Response) {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const { intent, department, justification } = req.body || {};

    if (!intent) {
      return res.status(400).json({ error: "INTENT_REQUIRED" });
    }

    if (REJECTED_INTENTS.includes(intent)) {
      return res.status(403).json({
        error: "INTENT_REJECTED",
        message: `Role '${intent}' cannot be requested via public intent`,
      });
    }

    if (!(ALLOWED_INTENTS as readonly string[]).includes(intent)) {
      return res.status(400).json({ error: "INVALID_INTENT" });
    }

    const assignedRole = intentToRole(intent);

    await storage.updateUser(userId, {
      role: assignedRole,
      signupIntent: intent,
      accessLevel: 1,
      userStatus: 'profile_incomplete',
    } as any);

    if (intent === 'provider') {
      const user = await storage.getUser(userId);
      const existingApp = await storage.getProviderApplicationByUser(userId);
      if (!existingApp) {
        await storage.createProviderApplicationDraft(userId, {
          email: user?.email || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          phoneNumber: user?.phone || '',
          city: (user as any)?.city || '',
          country: (user as any)?.country || 'IL',
        } as any);
      }
      return res.json({
        ok: true,
        nextUrl: '/provider-onboarding',
        role: assignedRole,
        userStatus: 'profile_incomplete',
        reason: 'KYC_REQUIRED',
      });
    }

    if (intent === 'staff_request') {
      const existingReq = await storage.getStaffAccessRequestByUser(userId);
      if (!existingReq) {
        await storage.createStaffAccessRequest({
          userId,
          requestedRole: 'staff',
          status: 'pending',
          department: department || null,
          justification: justification || null,
        } as any);
      }
      return res.json({
        ok: true,
        nextUrl: '/access-pending',
        role: assignedRole,
        userStatus: 'staff_pending_approval',
        reason: 'STAFF_APPROVAL_REQUIRED',
      });
    }

    const nextUrl = intent === 'loyalty' ? '/complete-profile' : '/home';
    return res.json({
      ok: true,
      nextUrl,
      role: assignedRole,
      userStatus: 'profile_incomplete',
      reason: 'OK',
    });
  } catch (error: any) {
    logger.error(`[ChooseRole] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function approveAccess(req: Request, res: Response) {
  try {
    const approverEmail = ((req as any).userEmail || '').toLowerCase();
    const isSuperAdmin = SUPER_ADMINS.map(e => e.toLowerCase()).includes(approverEmail);

    if (approverEmail !== ADMIN_APPROVER_EMAIL.toLowerCase() && !isSuperAdmin) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Only authorized admins can approve access",
      });
    }

    const { targetUserId, role } = req.body || {};
    if (!targetUserId || !role) {
      return res.status(400).json({ error: "TARGET_AND_ROLE_REQUIRED" });
    }

    const validRoles = ['staff', 'admin', 'management', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "INVALID_ROLE" });
    }

    const accessLevelMap: Record<string, number> = {
      staff: 4,
      admin: 6,
      management: 8,
      super_admin: 10,
    };

    const now = new Date();

    await storage.updateUser(targetUserId, {
      role,
      accessLevel: accessLevelMap[role] || 1,
      approvedBy: approverEmail,
      approvedAt: now,
      userStatus: 'staff_active' as UserStatus,
      staffApprovedAt: now,
      mfaRequired: true,
    } as any);

    const staffReq = await storage.getStaffAccessRequestByUser(targetUserId);
    if (staffReq) {
      await storage.updateStaffAccessRequest(staffReq.id, {
        status: 'approved',
        decidedAt: now,
        decidedBy: approverEmail,
      } as any);
    }

    logger.info(`[AdminApproval] ${approverEmail} approved ${targetUserId} as ${role} (userStatus→staff_active, mfaRequired→true)`);

    return res.json({ ok: true });
  } catch (error: any) {
    logger.error(`[AdminApproval] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function completeProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      address,
      city,
      postalCode,
      country,
      termsAccepted,
      privacyAccepted,
      marketingConsent,
    } = req.body || {};

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "NAME_REQUIRED" });
    }

    if (phone) {
      const e164Regex = /^\+[1-9]\d{6,14}$/;
      if (!e164Regex.test(phone)) {
        return res.status(400).json({
          error: "INVALID_PHONE_FORMAT",
          message: "Phone must be in E.164 format (e.g. +972501234567)",
        });
      }
    }

    const user = await storage.getUser(userId);
    const role = (user as any)?.role || 'customer';

    if (role === 'provider' && !phone) {
      return res.status(400).json({
        error: "PHONE_REQUIRED",
        message: "Phone number is required for provider accounts",
      });
    }

    const now = new Date();
    const updates: Record<string, any> = {
      firstName,
      lastName,
      address: address || null,
      city: city || null,
      postalCode: postalCode || null,
      country: country || "IL",
      updatedAt: now,
    };

    if (phone) {
      updates.phone = phone;
    }

    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (!isNaN(dob.getTime()) && dob < now) {
        updates.dateOfBirth = dateOfBirth;
      }
    }

    if (termsAccepted) {
      updates.termsAcceptedAt = now;
      updates.termsVersion = "2026-v1";
    }
    if (privacyAccepted) {
      updates.privacyAcceptedAt = now;
      updates.privacyVersion = "2026-v1";
    }
    if (marketingConsent !== undefined) {
      updates.marketingConsent = !!marketingConsent;
    }

    const pendingUser = { ...user, ...updates };
    const missingAfterUpdate = getMissingFields(pendingUser, role);

    if (missingAfterUpdate.length === 0) {
      updates.userStatus = 'profile_complete' as UserStatus;
      updates.profileCompletedAt = now;
    } else {
      updates.userStatus = 'profile_incomplete' as UserStatus;
    }

    await storage.updateUser(userId, updates);

    const newStatus = updates.userStatus || (user as any)?.userStatus || 'new';

    logger.info(`[CompleteProfile] Profile updated for ${userId} (status=${newStatus}, missing=${missingAfterUpdate.length})`);
    return res.json({
      ok: true,
      userStatus: newStatus,
      profileStatus: missingAfterUpdate.length === 0 ? 'complete' : 'incomplete',
      missingFields: missingAfterUpdate,
    });
  } catch (error: any) {
    logger.error(`[CompleteProfile] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
