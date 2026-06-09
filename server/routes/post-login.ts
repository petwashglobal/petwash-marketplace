import type { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../lib/logger";
import { ALLOWED_INTENTS, type UserStatus, type UserRole } from "@shared/schema";
import { logAuditEvent } from "../middleware/auditLog";
import { EmailService } from "../emailService";
import { isSuperAdmin } from "../middleware/rbac";
import { isAdminRole } from "@shared/adminRoles";
import { recordLoginEvent } from "../services/AuthEventService";
import { getClientIP } from "../services/alerts";

const ADMIN_APPROVER_EMAIL = process.env.ADMIN_APPROVER_EMAIL || '';
if (!process.env.ADMIN_APPROVER_EMAIL) {
  logger.warn('[PostLogin] ADMIN_APPROVER_EMAIL env var is not set — approval emails will be skipped');
}

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

// Accept an already-fetched providerApp to avoid a redundant DB query when the caller
// has already loaded the application record (which is the case for postLoginDecider).
// Pass `null` to indicate the DB was already checked and no record exists (skips re-query).
// Pass `undefined` (or omit the argument) to have this function perform the DB lookup itself.
async function computeUserStatus(user: any, userId: string, cachedProviderApp?: any | null): Promise<UserStatus> {
  const role = user.role || 'customer';

  if (!user.role || user.role === 'new') {
    return 'new';
  }

  const missing = getMissingFields(user, role);
  if (missing.length > 0) {
    return 'profile_incomplete';
  }

  // Use the cached record if provided; otherwise query the DB (e.g. standalone callers).
  const providerApp = cachedProviderApp !== undefined
    ? cachedProviderApp
    : await storage.getProviderApplicationByUser(userId);
  if (providerApp) {
    if (providerApp.status === 'approved') {
      return 'provider_active';
    }
    if (providerApp.status === 'pending' || providerApp.status === 'pending_review' || providerApp.status === 'under_review') {
      return 'provider_pending_approval';
    }
    if (providerApp.status === 'pending_resubmission') {
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
    return { nextUrl: '/home', reason: 'OK', profileStatus: 'complete', role, userStatus };
  }

  if (providerApp) {
    if (providerApp.status === 'draft') {
      return { nextUrl: '/provider-onboarding', reason: 'KYC_REQUIRED', profileStatus: 'incomplete', role, userStatus };
    }
    if (providerApp.status === 'pending' || providerApp.status === 'pending_review' || providerApp.status === 'under_review') {
      return { nextUrl: '/provider/pending', reason: 'PROVIDER_APPROVAL_REQUIRED', profileStatus: 'pending_review', role, userStatus };
    }
    if (providerApp.status === 'pending_resubmission') {
      return { nextUrl: '/provider-application/status', reason: 'RESUBMISSION_REQUIRED', profileStatus: 'pending_review', role, userStatus };
    }
    if (providerApp.status === 'rejected') {
      return { nextUrl: '/provider/rejected', reason: 'PROVIDER_REJECTED', profileStatus: 'rejected', role, userStatus };
    }
    if (providerApp.status === 'approved') {
      // postLoginDecider auto-upgrades effectiveRole to 'provider' when userStatus='provider_active'.
      // If role is still not 'provider' here, fall through to the default routing rather than
      // directing a non-provider user to the provider dashboard.
      if (role === 'provider') {
        return { nextUrl: '/provider-os', reason: 'OK', profileStatus: 'approved', role, userStatus };
      }
      // Role mismatch — data inconsistency; route to home and let post-login re-sync on next call.
      return { nextUrl: '/home', reason: 'ROLE_SYNC_PENDING', profileStatus: 'pending_review', role, userStatus };
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

  if (role === 'franchise_owner') {
    return { nextUrl: '/franchise/dashboard', reason: 'OK', profileStatus: 'approved', role, userStatus };
  }

  if (isAdminRole(role)) {
    // super_admin users have implicit approval via the isSuperAdmin() guard.
    // staff role goes through the staffReq approval flow handled above.
    // All other admin roles (admin, management, ops, hr, finance, ceo) require
    // an explicit admin-panel approval (approvedAt + approvedBy in the DB),
    // unless the user's email is in the SUPER_ADMIN_EMAILS list.
    const requiresApproval = role !== 'super_admin' && role !== 'staff';
    if (requiresApproval) {
      const isApproved = !!(user as any).approvedAt && !!(user as any).approvedBy;
      const superAdminEmail = (user as any).email ? isSuperAdmin((user as any).email) : false;
      if (!isApproved && !superAdminEmail) {
        return { nextUrl: '/access-pending', reason: 'STAFF_APPROVAL_REQUIRED', profileStatus: 'pending_review', role, userStatus };
      }
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

    let user = await storage.getUser(userId);

    // Unified identity resolution — SDD: docs/design/2026-05-25-smart-identity-routing.md.
    // FLAG-GATED, default OFF (env IDENTITY_UNIFIED_ENABLED !== 'true' → block skipped,
    // live login byte-for-byte unchanged). When enabled, resolve a Firebase login to its
    // canonical PetWash user via identity_accounts/loginOrLink — this is what fixes the
    // founder-001 slug-vs-uid orphan (Firebase uid !== the seeded 'founder-001-nir-hadad'
    // row id) and merges Google/Apple logins into one account. Non-blocking on error.
    if (!user && process.env.IDENTITY_UNIFIED_ENABLED === 'true') {
      try {
        const { loginOrLink } = await import('../identity/loginOrLink');
        const fbAdminModule = await import('../lib/firebase-admin');
        const fbAuth = fbAdminModule.auth;
        if (fbAuth) {
          const fbUser = await fbAuth.getUser(userId);
          const providerId = fbUser.providerData?.[0]?.providerId || 'password';
          const resolved = await loginOrLink({
            provider: providerId,
            providerAccountId: fbUser.uid,
            email: fbUser.email ?? null,
            emailVerified: fbUser.emailVerified,
            displayName: fbUser.displayName ?? null,
          });
          if (resolved.userId && resolved.userId !== userId) {
            const linkedUser = await storage.getUser(resolved.userId);
            if (linkedUser) {
              user = linkedUser as any;
              logger.info('[PostLogin] identity resolved to canonical user', {
                from: userId, to: resolved.userId, action: resolved.action,
              });
            }
          }
        }
      } catch (idErr) {
        logger.warn('[PostLogin] unified identity resolution failed (non-blocking)', { userId, error: String(idErr) });
      }
    }

    if (!user) {
      // Race condition: session cookie set before background ensureUserInPostgres completed.
      // Attempt synchronous recovery for social/phone users before giving up.
      try {
        const { authService } = await import('../services/AuthService');
        const fbAdminModule = await import('../lib/firebase-admin');
        const fbAuth = fbAdminModule.auth;
        if (fbAuth) {
          const fbUser = await fbAuth.getUser(userId);
          const syncResult = await authService.ensureUserInPostgres(fbUser.uid, fbUser.email || undefined, {
            firstName: (fbUser.displayName || '').split(' ')[0] || undefined,
            lastName: (fbUser.displayName || '').split(' ').slice(1).join(' ') || undefined,
            phone: fbUser.phoneNumber || undefined,
            profileImageUrl: fbUser.photoURL || undefined,
          });
          if (syncResult?.user) {
            user = syncResult.user as any;
            logger.info('[PostLogin] ✅ Race-condition recovery: user created synchronously', { userId });
          }
        }
      } catch (recoveryErr) {
        logger.warn('[PostLogin] Race-condition recovery failed', { userId, error: String(recoveryErr) });
      }
      if (!user) {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
    }

    // PR-Z1.6: Server-side identity validation (defense in depth).
    // Fires only when the signup form actually submits these fields; returning
    // post-login calls with empty body skip these checks.
    //
    // 1) 18+ age check — CEO directive 2026-05-16 "הרשמה מגיל 18 בלבד".
    //    Client also validates (PR-Z1.5), but server enforcement is the
    //    real gate. Reject under-18 with 400 UNDERAGE.
    //
    // 2) Identity dedup on (idNumber, dateOfBirth) — EL AL frequent-flyer
    //    pattern. Prevents one person from creating multiple accounts under
    //    the same identity (loyalty farming, KYC dodging, double-claim of
    //    referral bonuses, etc.). Reject with 409 DUPLICATE_IDENTITY.
    const z16Body = req.body || {};
    const z16Dob = typeof z16Body.dateOfBirth === 'string' ? z16Body.dateOfBirth : null;
    const z16IdNumber = typeof z16Body.idNumber === 'string' ? z16Body.idNumber.trim() : null;

    if (z16Dob) {
      const dobDate = new Date(z16Dob);
      if (!isNaN(dobDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
          age--;
        }
        if (age < 18) {
          logger.warn('[PostLogin] UNDERAGE rejected', { userId, age });
          return res.status(400).json({
            error: 'UNDERAGE',
            message: 'Registration is restricted to users aged 18 and over.',
          });
        }
      }
    }

    if (z16IdNumber && z16Dob && z16IdNumber.length >= 5) {
      try {
        const matches = await storage.findUsersByIdAndDob(z16IdNumber, z16Dob);
        const conflict = matches.find((u: any) => u.id !== userId);
        if (conflict) {
          // Privacy-respecting: never reveal the conflicting account's email
          // or any other PII. Just say "an account exists" + recovery path.
          logger.warn('[PostLogin] DUPLICATE_IDENTITY detected', {
            attemptingUserId: userId,
            // Do NOT log the conflict's email or full ID number.
          });
          return res.status(409).json({
            error: 'DUPLICATE_IDENTITY',
            message: 'An account already exists with this identity. Please sign in to your existing account, or use the password-recovery flow.',
          });
        }
      } catch (dedupErr) {
        // Fail-soft: dedup errors should not block legitimate signups.
        // Log + continue. A small window of duplicate accounts is preferable
        // to a hard outage on signup.
        logger.error('[PostLogin] Identity dedup query failed (non-blocking)', { error: String(dedupErr) });
      }
    }

    // Canonical cross-store sync: if termsAcceptedAt is missing in PostgreSQL,
    // check Firestore for acceptedTerms/consentTimestamp (set during registration)
    // and backfill the PostgreSQL field. This covers all sign-in entry methods.
    if (!(user as any).termsAcceptedAt) {
      try {
        const fbAdminModule = await import('../lib/firebase-admin');
        const firestoreDb = fbAdminModule.db;
        if (firestoreDb) {
          const profileSnap = await firestoreDb
            .collection('users')
            .doc(userId)
            .collection('profile')
            .doc('data')
            .get();
          if (profileSnap.exists) {
            const fsData = profileSnap.data() as Record<string, any>;
            if (fsData?.acceptedTerms === true && fsData?.consentTimestamp) {
              const consentDate = typeof fsData.consentTimestamp?.toDate === 'function'
                ? fsData.consentTimestamp.toDate()
                : new Date(fsData.consentTimestamp as string | number);
              await storage.updateUser(userId, { termsAcceptedAt: consentDate });
              (user as any).termsAcceptedAt = consentDate;
              logger.info('[PostLogin] Backfilled termsAcceptedAt from Firestore acceptedTerms', { userId });
            }
          }
        }
      } catch (fsErr) {
        logger.warn('[PostLogin] Could not sync termsAcceptedAt from Firestore (non-fatal)', { userId, error: String(fsErr) });
      }
    }

    // Social OAuth users (Google, Apple, Facebook) never write acceptedTerms to
    // Firestore because they bypass the signup form. If termsAcceptedAt is still
    // missing after the Firestore sync above, check Firebase Auth provider data
    // and stamp it here — synchronously, before the routing decision runs.
    if (!(user as any).termsAcceptedAt) {
      try {
        const fbAdminModule = await import('../lib/firebase-admin');
        const fbAuth = fbAdminModule.auth;
        if (fbAuth) {
          const firebaseUser = await fbAuth.getUser(userId);
          const socialProviders = ['google.com', 'apple.com', 'facebook.com', 'github.com'];
          const isSocial = firebaseUser.providerData?.some(
            (p) => socialProviders.includes(p.providerId)
          );
          if (isSocial) {
            const consentNow = new Date();
            await storage.updateUser(userId, {
              termsAcceptedAt: consentNow,
              privacyAcceptedAt: consentNow,
            });
            (user as any).termsAcceptedAt = consentNow;
            (user as any).privacyAcceptedAt = consentNow;
            logger.info('[PostLogin] ✅ termsAcceptedAt stamped for social user (synchronous)', {
              userId,
              providers: firebaseUser.providerData?.map((p) => p.providerId),
            });
          }
        }
      } catch (socialTermsErr) {
        logger.warn('[PostLogin] Failed to stamp social terms (non-blocking)', { userId, error: String(socialTermsErr) });
      }
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

    // Phase A — fall back to the HttpOnly cookie (set by /api/auth/seed-intent
    // BEFORE the Firebase OAuth redirect) when the body intent is missing.
    // This survives Safari ITP and slow OAuth roundtrips that wipe localStorage.
    // Body intent (if present) still wins — explicit caller intent is canonical.
    const bodyIntent = (req.body || {}).intent;
    const cookieIntent = (req as any).cookies?.pw_signup_intent;
    const intent = bodyIntent || cookieIntent || undefined;
    if (!bodyIntent && cookieIntent) {
      logger.info('[PostLogin] Intent recovered from HttpOnly cookie (Phase A)', {
        userId: (user as any).id,
        intent: cookieIntent,
      });
      // Clear the cookie now that it has been consumed.
      try { (res as any).clearCookie('pw_signup_intent', { path: '/' }); } catch { /* non-fatal */ }
    }
    let userRole = (user as any).role || null;

    if (intent && REJECTED_INTENTS.includes(intent)) {
      return res.status(403).json({
        error: "INTENT_REJECTED",
        message: `Role '${intent}' cannot be requested via public intent`,
      });
    }

    if (!userRole || userRole === 'new') {
      // ── Smart social-auth shortcut ─────────────────────────────────────────
      // Google / Apple / Facebook users already proved their identity via OAuth.
      // If no explicit intent was sent but we have a social provider, auto-assign
      // them as 'customer' and seed their name from Firebase — skipping ChooseRole
      // entirely. A real human using Google is almost always a customer, not staff.
      if (!intent) {
        try {
          const fbAdminModule = await import('../lib/firebase-admin');
          const fbAuth = fbAdminModule.auth;
          if (fbAuth) {
            const firebaseUser = await fbAuth.getUser(userId);
            const socialProviders = ['google.com', 'apple.com', 'facebook.com', 'github.com', 'phone'];
            const isSocial = firebaseUser.providerData?.some(p => socialProviders.includes(p.providerId));
            if (isSocial) {
              const nameParts = (firebaseUser.displayName || '').trim().split(/\s+/);
              const derivedFirst = (user as any).firstName || nameParts[0] || '';
              const derivedLast = (user as any).lastName || nameParts.slice(1).join(' ') || '';
              const now = new Date();
              const updatePayload: Record<string, any> = {
                role: 'customer',
                signupIntent: 'customer',
                accessLevel: 1,
                userStatus: 'profile_incomplete',
                termsAcceptedAt: now,
                privacyAcceptedAt: now,
              };
              if (derivedFirst && !(user as any).firstName) updatePayload.firstName = derivedFirst;
              if (derivedLast && !(user as any).lastName)   updatePayload.lastName  = derivedLast;
              if (firebaseUser.phoneNumber && !(user as any).phone) updatePayload.phone = firebaseUser.phoneNumber;
              await storage.updateUser(userId, updatePayload as any);
              userRole = 'customer';
              logger.info('[PostLogin] ✅ Social user auto-assigned customer role + seeded name', {
                userId,
                provider: firebaseUser.providerData?.map(p => p.providerId),
                derivedFirst,
                derivedLast,
              });
            }
          }
        } catch (socialAutoErr) {
          logger.warn('[PostLogin] Social auto-assign failed (non-blocking)', { userId, error: String(socialAutoErr) });
        }
      }

      const safeIntent = (intent && (ALLOWED_INTENTS as readonly string[]).includes(intent)) ? intent : null;

      if (userRole && userRole !== 'new') {
        // Social auto-assign succeeded above — skip the role-assignment
        // branch below. BUT: a returning customer who explicitly declared
        // signup_intent='provider' (e.g. by tapping the Become Provider
        // CTA on /sign-in) must still have their intent persisted, so the
        // hoisted provider-draft block below + buildRoutingResponse at
        // line 508 see it and route to /provider-onboarding instead of
        // /home (Issue #153 PR-BPV-2 — closes diagnostic V3 root cause).
        // We DO NOT change role assignment here. Only signupIntent.
        if (safeIntent === 'provider') {
          await storage.updateUser(userId, { signupIntent: 'provider' } as any)
            .catch((err: any) => logger.warn(
              '[PostLogin] PR-BPV-2 signupIntent persist failed (non-blocking)',
              { userId, error: String(err) },
            ));
        }
      } else if (safeIntent) {
        const assignedRole = intentToRole(safeIntent);
        await storage.updateUser(userId, {
          role: assignedRole,
          signupIntent: safeIntent,
          accessLevel: 1,
          userStatus: 'profile_incomplete',
        } as any);
        userRole = assignedRole;

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

      // Issue #153 PR-BPV-2: HOISTED provider-draft + welcome-email block.
      // Previously this lived inside the `else if (safeIntent)` arm above,
      // which meant a returning customer (userRole !== 'new') with
      // signup_intent='provider' got the entire intent block skipped — no
      // draft created, buildRoutingResponse fell through to /home, the
      // visible Become-Provider flash. By hoisting it here and gating
      // ONLY on `safeIntent === 'provider' && !existingApp`, the draft
      // path runs for BOTH branches (new user just-assigned + returning
      // customer keeping their existing role). Role assignment stays in
      // the `else if` branch above — not touched.
      if (safeIntent === 'provider') {
        const existingApp = await storage.getProviderApplicationByUser(userId);
        if (!existingApp) {
          try {
            await storage.createProviderApplicationDraft(userId, {
              email: user?.email || '',
              firstName: user?.firstName || '',
              lastName: user?.lastName || '',
              phoneNumber: user?.phone || '',
              city: (user as any)?.city || '',
              country: (user as any)?.country || 'IL',
            } as any);
          } catch (draftErr: any) {
            logger.error('[PostLogin] Failed to create provider application draft', { userId, error: String(draftErr) });
            // Return a clean error — do NOT fall through to the outer catch which would return 500
            // and cause the client to silently navigate to /home.
            return res.status(500).json({
              error: 'PROVIDER_DRAFT_FAILED',
              nextUrl: '/provider-onboarding',
              message: 'Unable to start provider registration. Please try again.',
            });
          }

          // Send provider welcome email
          const providerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'שותף חדש';
          const providerEmail = user?.email;
          if (providerEmail) {
            const welcomeHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#000;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;">
                <tr><td align="center" style="padding:32px 20px;">
                  <table width="520" cellpadding="0" cellspacing="0">
                    <tr><td style="text-align:center;padding-bottom:28px;">
                      <h1 style="color:#E7C978;font-size:28px;font-weight:300;letter-spacing:0.15em;margin:0;">🐾 PetWash™</h1>
                      <p style="color:#666;font-size:12px;letter-spacing:0.1em;margin:6px 0 0;">PROVIDER NETWORK</p>
                    </td></tr>
                    <tr><td style="background:linear-gradient(135deg,#1a1a1a,#0d0d0d);border:1px solid #2a2a2a;border-radius:16px;padding:32px;">
                      <p style="color:#ccc;font-size:15px;margin:0 0 8px;">Hi <strong style="color:#fff;">${providerName}</strong>,</p>
                      <p style="color:#888;font-size:13px;margin:0 0 24px;" dir="rtl">ברוך הבא לרשת הספקים של PetWash™ — תודה שנרשמת!</p>
                      <div style="background:#111;border-radius:12px;padding:20px;margin-bottom:24px;">
                        <p style="color:#E7C978;font-size:13px;font-weight:600;margin:0 0 12px;letter-spacing:0.05em;">📋 הצעדים הבאים שלך:</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr><td style="padding:6px 0;"><span style="color:#00C851;font-weight:700;">✅</span> <span style="color:#ccc;font-size:13px;">נרשמת בהצלחה</span></td></tr>
                          <tr><td style="padding:6px 0;"><span style="color:#E7C978;font-weight:700;">📱</span> <span style="color:#ccc;font-size:13px;">אמת את מספר הטלפון שלך (SMS)</span></td></tr>
                          <tr><td style="padding:6px 0;"><span style="color:#E7C978;font-weight:700;">📄</span> <span style="color:#ccc;font-size:13px;">השלם את פרופיל הספק שלך</span></td></tr>
                          <tr><td style="padding:6px 0;"><span style="color:#E7C978;font-weight:700;">🪪</span> <span style="color:#ccc;font-size:13px;">העלה תעודת זהות ואישורים</span></td></tr>
                          <tr><td style="padding:6px 0;"><span style="color:#C6A35B;font-weight:700;">⏳</span> <span style="color:#888;font-size:13px;">המתן לאישור הצוות שלנו (24–48 שעות)</span></td></tr>
                        </table>
                      </div>
                      <p style="text-align:center;">
                        <a href="https://petwash.co.il/provider-onboarding" style="background:linear-gradient(135deg,#C6A35B,#E7C978);color:#000;font-weight:700;padding:14px 32px;border-radius:24px;text-decoration:none;display:inline-block;font-size:14px;">השלם את הפרופיל שלך ←</a>
                      </p>
                      <p style="color:#555;font-size:12px;text-align:center;margin:20px 0 0;">שאלות? שלח מייל ל-<a href="mailto:providers@petwash.co.il" style="color:#C6A35B;">providers@petwash.co.il</a> או התקשר ל-1-800-PETWASH</p>
                    </td></tr>
                    <tr><td style="text-align:center;padding-top:20px;">
                      <p style="color:#333;font-size:11px;margin:0;">PetWash™ Ltd · 1 Rothschild Blvd, Tel Aviv · petwash.co.il</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body></html>`;

            EmailService.send({
              to: providerEmail,
              subject: `🐾 ברוך הבא לרשת הספקים של PetWash™, ${providerName}!`,
              html: welcomeHtml,
            }).catch(err => logger.warn('[PostLogin] Provider welcome email failed', { err: String(err), providerEmail }));
          }
        }
      }
    }

    const refreshedUser = await storage.getUser(userId);
    const u = refreshedUser || user;
    let effectiveRole = (u as any).role || userRole || 'customer';
    const missingFields = getMissingFields(u, effectiveRole);

    let providerApp: any = null;
    let staffReq: any = null;

    if ((u as any).signupIntent === 'provider' || effectiveRole === 'provider') {
      providerApp = await storage.getProviderApplicationByUser(userId);
    }

    if ((u as any).signupIntent === 'staff_request' || effectiveRole === 'staff') {
      staffReq = await storage.getStaffAccessRequestByUser(userId);
    }

    if (effectiveRole === 'customer' && !providerApp) {
      providerApp = await storage.getProviderApplicationByUser(userId);
      // Only fetch staffReq here if it hasn't been fetched yet AND no provider app exists.
      if (!staffReq && !providerApp) {
        staffReq = await storage.getStaffAccessRequestByUser(userId);
      }
    }

    const userStatus = await computeUserStatus(u, userId, providerApp);
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
      const previousRole = effectiveRole;
      updates.role = 'provider';
      updates.providerApprovedAt = new Date();
      effectiveRole = 'provider';

      // Sync Firebase custom claims so the client picks up the new role on
      // its next token refresh — otherwise the user has to log out + back
      // in to see their approved-provider state. Best-effort + audited.
      // PR-CLAIMS-SYNC: also write `accountType: 'provider'` so the client
      // ID token + RBAC middleware (provider-applications.ts:1015-1023)
      // both see a consistent shape. Lane B-B audit found this gap caused
      // 403s and stale UI for hours after server-side approval.
      let claimsWritten = false;
      try {
        const fbAdminModule = await import('../lib/firebase-admin');
        const fbAuth = fbAdminModule.auth;
        if (fbAuth) {
          const userRec = await fbAuth.getUser(userId);
          const existingClaims = (userRec.customClaims || {}) as Record<string, any>;
          const needsUpdate = existingClaims.role !== 'provider'
            || existingClaims.accountType !== 'provider';
          if (needsUpdate) {
            await fbAuth.setCustomUserClaims(userId, {
              ...existingClaims,
              role: 'provider',
              accountType: 'provider',
            });
            claimsWritten = true;
            logger.info('[PostLogin] ✅ Firebase claims synced to role=provider, accountType=provider', {
              userId,
              previousRole,
              previousAccountType: existingClaims.accountType,
            });
          }
        }
      } catch (claimsErr) {
        logger.warn('[PostLogin] Failed to sync Firebase claims to provider (non-blocking)', {
          userId,
          error: String(claimsErr),
        });
      }

      // PR-CLAIMS-SYNC: push force_token_refresh notification so the
      // client refreshes its ID token within ~100ms instead of waiting
      // for the natural Firebase ~1h refresh window. Closes the
      // visible "approved on server but UI still shows customer" gap.
      // Fail-soft: notification helper swallows errors internally.
      if (claimsWritten) {
        try {
          const { sendForceTokenRefreshNotification } = await import('../lib/sendForceTokenRefresh');
          await sendForceTokenRefreshNotification({
            userId,
            reason: 'provider_approved',
            actionUrl: '/provider/dashboard',
            preferredLanguage: (u as any)?.preferredLanguage,
          });
        } catch (notifErr) {
          logger.warn('[PostLogin] force_token_refresh notification failed (non-blocking)', {
            userId,
            error: String(notifErr),
          });
        }
      }

      // Audit-log the silent role escalation. Drift between providerApp.status
      // and users.role had been auto-fixed but never recorded — that gap
      // hid real provider-onboarding outcomes from the audit trail.
      try {
        await logAuditEvent({
          actorUserId: userId,
          actorRole: 'provider',
          actionType: 'POST_LOGIN_ROLE_UPGRADE',
          targetType: 'user',
          targetId: userId,
          ip: getClientIP(req) || req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          traceId: (req as any).traceId || '',
          metadata: {
            from: previousRole,
            to: 'provider',
            reason: 'provider_application_approved',
            providerApplicationId: providerApp?.id ?? null,
          },
        });
      } catch (auditErr) {
        logger.warn('[PostLogin] Failed to audit-log role upgrade (non-blocking)', {
          userId,
          error: String(auditErr),
        });
      }
    }

    // NOTE: Removed automatic staff role escalation that was here.
    // A user must have an explicit role assignment in the database (via admin approval)
    // before their role is set to 'staff'. Silent escalation based on userStatus alone
    // bypassed the approval workflow and is a security risk.

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

    // Record auth event for new-login alert & recent-login security log.
    // Fire-and-forget — never block the auth response.
    recordLoginEvent({
      userId,
      email: (u as any).email || undefined,
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'] || '',
    }).catch((err) => {
      logger.warn('[PostLogin] recordLoginEvent failed (non-fatal)', { error: String(err) });
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
      isSuperAdmin: isSuperAdmin((user.email || '').toLowerCase()),
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

    // Phase I — for the customer / loyalty paths (no secondary table to
    // create), delegate to the canonical post-login decider so the
    // returned nextUrl is computed by ONE function. Provider + staff
    // paths above already return their own canonical destinations
    // (the secondary tables they create only make sense from this
    // handler).
    return await postLoginDecider(req, res);
  } catch (error: any) {
    logger.error(`[ChooseRole] Error: ${error.message}`, { error });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function approveAccess(req: Request, res: Response) {
  try {
    const approverEmail = ((req as any).userEmail || '').toLowerCase();

    if (approverEmail !== ADMIN_APPROVER_EMAIL.toLowerCase() && !isSuperAdmin(approverEmail)) {
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

    // Phase B — sync Firebase customClaims so rbac.ts middleware reads
    // the correct role on the next request without the user having to
    // re-login. Non-blocking on Firebase failures.
    let staffClaimsWritten = false;
    try {
      const { syncFirebaseClaims } = await import('../lib/syncFirebaseClaims');
      await syncFirebaseClaims(targetUserId, {
        role,
        accountType: 'internal',
        staffApprovedAt: now.toISOString(),
      });
      staffClaimsWritten = true;
    } catch (claimsErr: any) {
      logger.warn('[AdminApproval] Firebase claims sync failed (non-blocking)', {
        targetUserId, error: claimsErr?.message,
      });
    }

    // PR-CLAIMS-SYNC: push force_token_refresh notification so the
    // freshly-approved staff member sees their new role within ~100ms
    // instead of waiting for the natural Firebase token refresh.
    // Lane B-B audit P1 #3 closes this gap.
    if (staffClaimsWritten) {
      try {
        const { sendForceTokenRefreshNotification } = await import('../lib/sendForceTokenRefresh');
        await sendForceTokenRefreshNotification({
          userId: targetUserId,
          reason: 'staff_approved',
          actionUrl: '/admin/dashboard',
        });
      } catch (notifErr) {
        logger.warn('[AdminApproval] force_token_refresh notification failed (non-blocking)', {
          targetUserId, error: String(notifErr),
        });
      }
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

/**
 * Phase A — Seed signup intent in a server-set HttpOnly cookie BEFORE
 * the Firebase OAuth redirect.
 *
 * The only pre-login intent storage today is `localStorage.signup_intent`.
 * Safari ITP + slow mobile networks can wipe it during the OAuth
 * roundtrip — user lands on /home instead of /provider-onboarding.
 *
 * This endpoint writes the intent to an HttpOnly cookie that survives
 * the redirect. postLoginDecider reads `req.cookies.pw_signup_intent`
 * as a FALLBACK when no body intent is provided.
 *
 * Public — no auth required (the user is not yet signed in).
 */
export async function seedIntent(req: Request, res: Response) {
  try {
    const intent = String(((req as any).body || {}).intent || '').trim();
    if (!ALLOWED_INTENTS.includes(intent as any)) {
      return res.status(400).json({
        error: 'INVALID_INTENT',
        allowed: ALLOWED_INTENTS,
      });
    }
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('pw_signup_intent', intent, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000,
      path: '/',
    });
    logger.info('[SeedIntent] Intent cookie set', { intent, ip: getClientIP(req) });
    return res.json({ ok: true, intent });
  } catch (error: any) {
    logger.error(`[SeedIntent] Error: ${error.message}`, { error });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
