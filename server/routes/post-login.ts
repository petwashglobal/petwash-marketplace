import type { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../lib/logger";

const ADMIN_APPROVER_EMAIL = "nir.h@petwash.co.il";

type ProfileStatus = 'incomplete' | 'complete' | 'pending_review' | 'approved' | 'rejected' | 'blocked';

type PostLoginResponse = {
  nextUrl: string;
  requiredStep?: string;
  profileStatus: ProfileStatus;
  role: string;
};

const REQUIRED_FIELDS_BY_ROLE: Record<string, string[]> = {
  customer: ['firstName', 'lastName', 'termsAcceptedAt'],
  loyalty: ['firstName', 'lastName', 'dateOfBirth', 'termsAcceptedAt'],
  provider: ['firstName', 'lastName', 'phone', 'termsAcceptedAt'],
  staff: ['firstName', 'lastName', 'termsAcceptedAt'],
};

function getMissingFields(user: any, role: string): string[] {
  const required = REQUIRED_FIELDS_BY_ROLE[role] || REQUIRED_FIELDS_BY_ROLE['customer'];
  return required.filter((field: string) => !user[field]);
}

function isProfileComplete(user: any, role: string): boolean {
  return getMissingFields(user, role).length === 0;
}

function routeProvider(app: any, role: string): PostLoginResponse {
  if (!app) {
    return { nextUrl: "/choose-role", requiredStep: 'provider_onboarding', profileStatus: 'incomplete', role };
  }

  if (app.status === "draft") {
    return { nextUrl: "/provider-onboarding", requiredStep: 'provider_onboarding', profileStatus: 'incomplete', role };
  }
  if (app.status === "pending" || app.status === "pending_review" || app.status === "under_review") {
    return { nextUrl: "/provider/pending", requiredStep: 'access_pending', profileStatus: 'pending_review', role };
  }
  if (app.status === "rejected") {
    return { nextUrl: "/provider/rejected", profileStatus: 'rejected', role };
  }

  if (!app.onboardingComplete) {
    return { nextUrl: "/provider-onboarding", requiredStep: 'provider_onboarding', profileStatus: 'approved', role };
  }
  return { nextUrl: "/provider/dashboard", profileStatus: 'approved', role };
}

function routeStaffRequest(reqRow: any, role: string): PostLoginResponse {
  if (!reqRow) {
    return { nextUrl: "/choose-role", requiredStep: 'access_pending', profileStatus: 'incomplete', role };
  }
  if (reqRow.status === "pending") {
    return { nextUrl: "/access-pending", requiredStep: 'access_pending', profileStatus: 'pending_review', role };
  }
  if (reqRow.status === "rejected") {
    return { nextUrl: "/staff/rejected", profileStatus: 'rejected', role };
  }
  return { nextUrl: "/admin/dashboard", profileStatus: 'approved', role };
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

    if (user.blocked) {
      return res.json({ nextUrl: "/blocked", profileStatus: 'blocked', role: (user as any).role || 'customer' } as PostLoginResponse);
    }

    const emailVerified = !!(user as any).emailVerified;
    const hasEmail = !!user.email;

    if (hasEmail && !emailVerified && (user as any).authProvider === 'email') {
      return res.json({
        nextUrl: "/verify-email",
        requiredStep: 'verify_email',
        profileStatus: 'incomplete',
        role: (user as any).role || 'customer',
      } as PostLoginResponse);
    }

    const { intent } = req.body || {};
    let userRole = (user as any).role || null;

    const ALLOWED_INTENTS = ['customer', 'loyalty', 'provider', 'staff'];
    const safeIntent = (intent && ALLOWED_INTENTS.includes(intent)) ? intent : null;

    if (intent === 'admin') {
      return res.status(403).json({ error: "ADMIN_INTENT_REJECTED", message: "Admin role cannot be requested via public intent" });
    }

    if (!userRole && safeIntent) {
      if (safeIntent === 'customer' || safeIntent === 'loyalty') {
        await storage.updateUser(userId, { role: safeIntent, accessLevel: 1 } as any);
        userRole = safeIntent;
      } else if (safeIntent === 'provider') {
        await storage.updateUser(userId, { role: 'customer', accessLevel: 1 } as any);
        userRole = 'customer';
        const existingApp = await storage.getProviderApplicationByUser(userId);
        if (!existingApp) {
          await storage.createProviderApplicationDraft(userId, {
            email: user?.email || '',
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            phoneNumber: user?.phone || '',
            city: user?.city || '',
            country: user?.country || 'IL',
          } as any);
        }
      } else if (safeIntent === 'staff') {
        await storage.updateUser(userId, { role: 'customer', accessLevel: 1 } as any);
        userRole = 'customer';
        const existingReq = await storage.getStaffAccessRequestByUser(userId);
        if (!existingReq) {
          await storage.createStaffAccessRequest({
            userId,
            requestedRole: 'staff',
            status: 'pending',
          });
        }
      }
    }

    const refreshedUser = await storage.getUser(userId);
    const effectiveRole = (refreshedUser as any)?.role || userRole || 'customer';
    const u = refreshedUser || user;

    if (!effectiveRole || effectiveRole === 'new') {
      return res.json({
        nextUrl: "/choose-role",
        requiredStep: 'complete_profile',
        profileStatus: 'incomplete',
        role: 'customer',
      } as PostLoginResponse);
    }

    const profileComplete = !!(u?.firstName && u?.lastName);

    if (!profileComplete) {
      return res.json({
        nextUrl: "/complete-profile",
        requiredStep: 'complete_profile',
        profileStatus: 'incomplete',
        role: effectiveRole,
      } as PostLoginResponse);
    }

    if (effectiveRole === 'provider') {
      const app = await storage.getProviderApplicationByUser(userId);
      const decision = routeProvider(app, effectiveRole);
      logger.info(`[PostLogin] Provider routing for ${userId}: ${decision.profileStatus}`);
      return res.json(decision);
    }

    if (effectiveRole === 'staff') {
      const staffReq = await storage.getStaffAccessRequestByUser(userId);
      if (!staffReq || staffReq.status !== 'approved') {
        if (staffReq?.status === 'rejected') {
          return res.json({ nextUrl: "/staff/rejected", profileStatus: 'rejected', role: effectiveRole } as PostLoginResponse);
        }
        return res.json({ nextUrl: "/access-pending", requiredStep: 'access_pending', profileStatus: 'pending_review', role: effectiveRole } as PostLoginResponse);
      }
      return res.json({ nextUrl: "/admin/dashboard", profileStatus: 'approved', role: effectiveRole } as PostLoginResponse);
    }

    if (effectiveRole === 'admin' || effectiveRole === 'management' || effectiveRole === 'super_admin') {
      const isApproved = !!(u as any).approvedAt && !!(u as any).approvedBy;
      if (!isApproved) {
        return res.json({ nextUrl: "/access-pending", requiredStep: 'access_pending', profileStatus: 'pending_review', role: effectiveRole } as PostLoginResponse);
      }
      return res.json({ nextUrl: "/admin/dashboard", profileStatus: 'approved', role: effectiveRole } as PostLoginResponse);
    }

    if (effectiveRole === 'loyalty') {
      const hasDateOfBirth = !!(refreshedUser as any)?.dateOfBirth;
      if (!hasDateOfBirth) {
        return res.json({
          nextUrl: "/complete-profile",
          requiredStep: 'complete_profile',
          profileStatus: 'incomplete',
          role: effectiveRole,
        } as PostLoginResponse);
      }
      return res.json({ nextUrl: "/home", profileStatus: 'complete', role: effectiveRole } as PostLoginResponse);
    }

    const providerApp = await storage.getProviderApplicationByUser(userId);
    if (providerApp) {
      const decision = routeProvider(providerApp, effectiveRole);
      logger.info(`[PostLogin] Customer with provider app for ${userId}: ${decision.profileStatus}`);
      return res.json(decision);
    }

    const staffReq = await storage.getStaffAccessRequestByUser(userId);
    if (staffReq) {
      const decision = routeStaffRequest(staffReq, effectiveRole);
      logger.info(`[PostLogin] Customer with staff request for ${userId}: ${decision.profileStatus}`);
      return res.json(decision);
    }

    return res.json({ nextUrl: "/home", profileStatus: 'complete', role: effectiveRole } as PostLoginResponse);

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
    const missingFields = getMissingFields(user, role);
    const profileStatus: ProfileStatus = missingFields.length === 0 ? 'complete' : 'incomplete';

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role,
        profilePictureUrl: (user as any).profileImageUrl || null,
      },
      profileStatus,
      requiredFields: missingFields,
      role,
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

    const { intent } = req.body || {};

    if (intent === 'admin') {
      return res.status(403).json({ error: "ADMIN_INTENT_REJECTED", message: "Admin role cannot be requested via public intent" });
    }

    if (intent === "customer" || intent === "loyalty") {
      await storage.updateUser(userId, { role: intent, accessLevel: 1 } as any);
      return res.json({ ok: true, nextUrl: "/home", role: intent });
    }

    if (intent === "provider") {
      await storage.updateUser(userId, { role: "customer", accessLevel: 1 } as any);
      const user = await storage.getUser(userId);
      const existingApp = await storage.getProviderApplicationByUser(userId);
      if (!existingApp) {
        await storage.createProviderApplicationDraft(userId, {
          email: user?.email || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          phoneNumber: user?.phone || '',
          city: user?.city || '',
          country: user?.country || 'IL',
        } as any);
      }
      return res.json({ ok: true, nextUrl: "/provider-onboarding", role: "customer" });
    }

    if (intent === "staff" || intent === "staff_request") {
      await storage.updateUser(userId, { role: "customer", accessLevel: 1 } as any);
      const existingReq = await storage.getStaffAccessRequestByUser(userId);
      if (!existingReq) {
        await storage.createStaffAccessRequest({
          userId,
          requestedRole: "staff",
          status: "pending",
        });
      }
      return res.json({ ok: true, nextUrl: "/access-pending", role: "customer" });
    }

    return res.status(400).json({ error: "INVALID_INTENT" });
  } catch (error: any) {
    logger.error(`[ChooseRole] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function approveAccess(req: Request, res: Response) {
  try {
    const approverEmail = ((req as any).userEmail || '').toLowerCase();
    if (approverEmail !== ADMIN_APPROVER_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Only nir.h@petwash.co.il can approve admin access" });
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

    await storage.updateUser(targetUserId, {
      role,
      accessLevel: accessLevelMap[role] || 1,
      approvedBy: ADMIN_APPROVER_EMAIL,
      approvedAt: new Date(),
    } as any);

    const staffReq = await storage.getStaffAccessRequestByUser(targetUserId);
    if (staffReq) {
      await storage.updateStaffAccessRequest(staffReq.id, {
        status: 'approved',
        decidedAt: new Date(),
        decidedBy: ADMIN_APPROVER_EMAIL,
      });
    }

    logger.info(`[AdminApproval] ${ADMIN_APPROVER_EMAIL} approved ${targetUserId} as ${role}`);

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
        return res.status(400).json({ error: "INVALID_PHONE_FORMAT", message: "Phone must be in E.164 format (e.g. +972501234567)" });
      }
    }

    const user = await storage.getUser(userId);
    const role = (user as any)?.role || 'customer';

    if (role === 'provider' && !phone) {
      return res.status(400).json({ error: "PHONE_REQUIRED", message: "Phone number is required for provider accounts" });
    }

    const now = new Date();
    const updates: Record<string, any> = {
      firstName,
      lastName,
      address: address || null,
      city: city || null,
      postalCode: postalCode || null,
      country: country || "IL",
      profileCompletedAt: now,
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

    await storage.updateUser(userId, updates);

    logger.info(`[CompleteProfile] Profile completed for ${userId}`);
    return res.json({ ok: true });
  } catch (error: any) {
    logger.error(`[CompleteProfile] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
