import type { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../lib/logger";

const ADMIN_APPROVER_EMAIL = "nir.h@petwash.co.il";

type PostLoginDecision = {
  redirectTo: string;
  reason: string;
  toast?: string;
};

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
      return res.json({ redirectTo: "/blocked", reason: "USER_BLOCKED" });
    }

    const emailVerified = !!(user as any).emailVerified;
    const hasEmail = !!user.email;

    if (hasEmail && !emailVerified && (user as any).authProvider === 'email') {
      return res.json({ redirectTo: "/verify-email", reason: "EMAIL_NOT_VERIFIED" });
    }

    const profileComplete = !!(user.firstName && user.lastName && (user.phone || user.email));

    if (!profileComplete) {
      return res.json({ redirectTo: "/complete-profile", reason: "PROFILE_INCOMPLETE" });
    }

    const userRole = (user as any).role || 'customer';

    if (userRole === 'provider') {
      const app = await storage.getProviderApplicationByUser(userId);
      const decision = routeProvider(app);
      logger.info(`[PostLogin] Provider routing for ${userId}: ${decision.reason}`);
      return res.json(decision);
    }

    if (userRole === 'staff') {
      const staffReq = await storage.getStaffAccessRequestByUser(userId);
      if (!staffReq || staffReq.status !== 'approved') {
        if (staffReq?.status === 'rejected') {
          return res.json({ redirectTo: "/staff/rejected", reason: "STAFF_REJECTED" });
        }
        return res.json({ redirectTo: "/staff/pending", reason: "STAFF_NOT_APPROVED" });
      }
      return res.json({ redirectTo: "/admin/dashboard", reason: "STAFF_READY" });
    }

    if (userRole === 'admin' || userRole === 'management' || userRole === 'super_admin') {
      const isApproved = !!(user as any).approvedAt && !!(user as any).approvedBy;
      if (!isApproved) {
        return res.json({ redirectTo: "/staff/pending", reason: "ADMIN_NOT_APPROVED" });
      }
      return res.json({ redirectTo: "/admin/dashboard", reason: "ADMIN_READY" });
    }

    const providerApp = await storage.getProviderApplicationByUser(userId);
    if (providerApp) {
      const decision = routeProvider(providerApp);
      logger.info(`[PostLogin] Customer with provider app for ${userId}: ${decision.reason}`);
      return res.json(decision);
    }

    const staffReq = await storage.getStaffAccessRequestByUser(userId);
    if (staffReq) {
      const decision = routeStaffRequest(staffReq);
      logger.info(`[PostLogin] Customer with staff request for ${userId}: ${decision.reason}`);
      return res.json(decision);
    }

    return res.json({ redirectTo: "/home", reason: "CUSTOMER_READY" });

  } catch (error: any) {
    logger.error(`[PostLogin] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

function routeProvider(app: any): PostLoginDecision {
  if (!app) {
    return { redirectTo: "/choose-role", reason: "PROVIDER_NO_APP" };
  }

  if (app.status === "draft") {
    return { redirectTo: "/provider-onboarding", reason: "PROVIDER_DRAFT" };
  }
  if (app.status === "pending" || app.status === "pending_review" || app.status === "under_review") {
    return { redirectTo: "/provider/pending", reason: "PROVIDER_PENDING_REVIEW" };
  }
  if (app.status === "rejected") {
    return { redirectTo: "/provider/rejected", reason: "PROVIDER_REJECTED" };
  }

  if (!app.onboardingComplete) {
    return { redirectTo: "/provider-onboarding", reason: "PROVIDER_SETUP_REQUIRED" };
  }
  return { redirectTo: "/provider/dashboard", reason: "PROVIDER_APPROVED" };
}

function routeStaffRequest(reqRow: any): PostLoginDecision {
  if (!reqRow) {
    return { redirectTo: "/choose-role", reason: "NO_STAFF_REQUEST" };
  }
  if (reqRow.status === "pending") {
    return { redirectTo: "/staff/pending", reason: "STAFF_REQUEST_PENDING" };
  }
  if (reqRow.status === "rejected") {
    return { redirectTo: "/staff/rejected", reason: "STAFF_REQUEST_REJECTED" };
  }
  return { redirectTo: "/admin/dashboard", reason: "STAFF_REQUEST_APPROVED" };
}

export async function chooseRole(req: Request, res: Response) {
  try {
    const userId = (req as any).userId || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const { intent } = req.body || {};

    if (intent === "customer") {
      await storage.updateUser(userId, { role: "customer", accessLevel: 1 } as any);
      return res.json({ ok: true, redirectTo: "/home" });
    }

    if (intent === "provider") {
      await storage.updateUser(userId, { role: "provider", accessLevel: 2 } as any);
      const user = await storage.getUser(userId);
      await storage.createProviderApplicationDraft(userId, {
        email: user?.email || '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phoneNumber: user?.phone || '',
        city: user?.city || '',
        country: user?.country || 'IL',
      } as any);
      return res.json({ ok: true, redirectTo: "/provider-onboarding" });
    }

    if (intent === "staff_request") {
      await storage.createStaffAccessRequest({
        userId,
        requestedRole: "admin",
        status: "pending",
      });
      return res.json({ ok: true, redirectTo: "/staff/pending" });
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
    if (!phone) {
      return res.status(400).json({ error: "PHONE_REQUIRED" });
    }

    const now = new Date();
    const updates: Record<string, any> = {
      firstName,
      lastName,
      phone,
      address: address || null,
      city: city || null,
      postalCode: postalCode || null,
      country: country || "IL",
      profileCompletedAt: now,
      updatedAt: now,
    };

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
