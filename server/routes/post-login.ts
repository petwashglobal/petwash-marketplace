import type { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../lib/logger";
import { ALLOWED_INTENTS, type UserStatus, type UserRole } from "@shared/schema";
import { logAuditEvent } from "../middleware/auditLog";
import { EmailService } from "../emailService";
import { isSuperAdmin, isSuperAdminVerified } from "../middleware/rbac";
import { isAdminRole } from "@shared/adminRoles";
import { MEMBER_REQUIRED_FIELDS } from "@shared/memberRequiredFields";
import { recordLoginEvent } from "../services/AuthEventService";
import { getClientIP } from "../services/alerts";
import { db } from "../db";
import { privilegeMembers } from "@shared/schema";
import { eq } from "drizzle-orm";

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

// Canonical BASE profile (CEO 2026-08-01): name + verified mobile + terms + privacy.
// NO DOB / gender / address / pet for a member — those are optional. Same contract as
// MEMBER_REQUIRED_FIELDS in server/middleware/onboardingGate.ts (keep in sync). The
// gate returns only the MISSING subset, so social users (name+email from Google/Apple)
// and email/mobile-OTP users are each asked only for what they haven't supplied.
// DOB + 18+ + KYC belong to the PROVIDER role only (separate ProviderOnboarding flow).
// MEMBER_REQUIRED_FIELDS now imported from @shared/memberRequiredFields (single source
// of truth shared with onboardingGate.ts, so the two gates cannot drift).
const REQUIRED_FIELDS_BY_ROLE: Record<string, string[]> = {
  customer: MEMBER_REQUIRED_FIELDS,
  loyalty: MEMBER_REQUIRED_FIELDS,
  // Provider is a member too; heavy KYC (ID/address/docs/bank/approval) is a
  // SEPARATE flow (ProviderOnboarding), not this base profile gate.
  provider: MEMBER_REQUIRED_FIELDS,
  staff: ['firstName', 'lastName', 'termsAcceptedAt'],
  admin: ['firstName', 'lastName', 'termsAcceptedAt'],
  management: ['firstName', 'lastName', 'termsAcceptedAt'],
  // super_admin is the platform owner (SUPER_ADMIN_EMAILS): never blocked by a
  // profile-completeness gate — they must reach the backend unconditionally.
  super_admin: [],
};

function getMissingFields(user: any, role: string): string[] {
  const required = REQUIRED_FIELDS_BY_ROLE[role] || REQUIRED_FIELDS_BY_ROLE['customer'];
  return required.filter((field: string) => !user[field]);
}

// intentToRole (deleted PR-AUTH-MULTIROLE-5): intent is no longer translated
// into a role write. The base account is always 'customer'; provider/staff
// capabilities are additive and sourced from provider_applications /
// staff_access_requests via server/lib/userCapabilities.ts. Keeping the
// helper alive as a comment so grep of prior PRs still finds this file.

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

function buildRoutingResponse(
  user: any,
  role: string,
  userStatus: string,
  missingFields: string[],
  providerApp?: any,
  staffReq?: any,
  intent?: string | null,
  // Kept in the signature for callers that still pass it — used ONLY by
  // downstream tile/badge rendering. Does NOT gate the picker (CEO
  // 2026-08-26 §1-3: every approved provider is also a Pet Parent).
  _hasPrestige?: boolean,
): PostLoginResponse {
  if (user.blocked) {
    return { nextUrl: '/blocked', reason: 'BLOCKED', profileStatus: 'blocked', role, userStatus };
  }

  // SUPER-ADMIN FAST PATH (fix #136-1, CEO 2026-07-25): the platform owner
  // always lands on the backend, no matter what status the row carries or
  // whether profile fields are filled. This is the guarantee behind "gmail
  // won't let me in" — a super-admin email auto-created as a customer used to
  // fall through to /home. We trust `role` here because the ONLY caller
  // (postLoginDecider) promotes effectiveRole to 'super_admin' exclusively via
  // isSuperAdminVerified (allowlist AND Firebase email_verified) — so the
  // verification gate lives in exactly one place and can't be bypassed by an
  // unverified impostor. Checked FIRST so nothing below (email-verify bounce,
  // missing-fields, provider/staff routing) can trap it.
  if (role === 'super_admin') {
    // MULTI-ROLE (CEO 2026-08-23): a super_admin account is ALSO a real
    // customer / member / (potential) provider — the CEO logs in from the
    // same email to test provider flows, loyalty flows, or admin flows,
    // and the previous unconditional fast-path forced /admin/dashboard
    // every time with no way to say "this session I want to see the
    // provider side" without losing the super_admin claim. Now:
    //   intent === 'provider' → /provider-os
    //   intent === 'loyalty' | 'customer' | 'member' → /prestige/home
    //   intent === 'admin' (or absent) → /admin/dashboard (default)
    // The super_admin CLAIM is untouched — the header mode-switch
    // (client/src/lib/uiMode.ts) still lets the user jump to any surface
    // mid-session. This just picks the LANDING surface honestly.
    const wantsProviderView = intent === 'provider';
    const wantsMemberView = intent === 'loyalty' || intent === 'customer' || intent === 'member';
    if (wantsProviderView) {
      return { nextUrl: '/provider-os', reason: 'OK', profileStatus: 'approved', role: 'super_admin', userStatus };
    }
    if (wantsMemberView) {
      return { nextUrl: '/prestige/home', reason: 'OK', profileStatus: 'approved', role: 'super_admin', userStatus };
    }
    return { nextUrl: '/admin/dashboard', reason: 'OK', profileStatus: 'approved', role: 'super_admin', userStatus };
  }

  const emailVerified = !!(user as any).emailVerified;
  const hasEmail = !!user.email;
  if (hasEmail && !emailVerified && (user as any).authProvider === 'email') {
    return { nextUrl: '/verify-email', reason: 'EMAIL_UNVERIFIED', profileStatus: 'incomplete', role, userStatus };
  }

  if (!role || role === 'new') {
    // /choose-role no longer exists — a role-less account behaves as a
    // customer completing their profile (providers enter via /become-provider).
    return { nextUrl: '/complete-profile', reason: 'NO_ROLE', profileStatus: 'incomplete', role: 'customer', userStatus: 'new' };
  }

  if (missingFields.length > 0) {
    return { nextUrl: '/complete-profile', reason: 'PROFILE_INCOMPLETE', profileStatus: 'incomplete', role, userStatus, missingFields };
  }

  if (role === 'loyalty') {
    // Canonical member home is /prestige/home (the purpose-built member
    // dashboard). /home renders the MARKETING page for signed-in web users —
    // a member who logged in used to land on the marketing site (audit 2026-07-24).
    return { nextUrl: '/prestige/home', reason: 'OK', profileStatus: 'complete', role, userStatus };
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
      // ROLE-MODE MODEL — CORRECTED (CEO 2026-08-26 §1-7):
      //
      // Prestige is NOT a workspace / role — it is an entitlement that
      // travels with the human account. The two workspaces are:
      //   • Pet Parent (customer) — always present for every human user
      //   • Provider (approved provider application)
      //
      // Every approved provider is ALSO a Pet Parent (they can own pets,
      // book other providers, buy from Shop, hold a wallet, redeem a
      // Prestige benefit if enrolled). So the picker shows for ANY
      // approved provider — not just provider+prestige. Prestige, when
      // present, surfaces inside the Pet Parent tile/home as a benefit
      // badge, never as an identity.
      //
      // Explicit intent still wins:
      //   • intent === 'provider'                           → /provider-os
      //   • intent === 'customer'|'pet_parent'|'loyalty'|'member'
      //                                                     → /prestige/home
      //   • no intent                                       → /mode picker
      const wantsProvider = intent === 'provider';
      const wantsCustomer =
        intent === 'customer' || intent === 'pet_parent' ||
        intent === 'loyalty' || intent === 'member';
      if (wantsProvider) {
        return { nextUrl: '/provider-os', reason: 'OK', profileStatus: 'approved', role, userStatus };
      }
      if (wantsCustomer) {
        return { nextUrl: '/prestige/home', reason: 'OK', profileStatus: 'approved', role, userStatus };
      }
      return { nextUrl: '/mode', reason: 'MULTI_ROLE_PICK', profileStatus: 'approved', role, userStatus };
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

  // Default member/customer → the canonical member dashboard (not marketing).
  return { nextUrl: '/prestige/home', reason: 'OK', profileStatus: 'complete', role, userStatus };
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
        // Intent is a ROUTING signal, not a role assignment. A signed-in body
        // saying `intent=provider` or `intent=staff_request` must NEVER grant
        // that capability — otherwise a customer request-body spoof could
        // walk into provider/staff state. The base account is always a
        // customer; the provider/staff capability is granted by the
        // per-capability tables (provider_applications.status='approved',
        // staff_access_requests.status='approved') which the aggregator in
        // server/lib/userCapabilities.ts reads. Signup intent is persisted
        // for later reference (routing, welcome-email steering) but does not
        // touch the users.role authority.
        await storage.updateUser(userId, {
          role: 'customer',
          signupIntent: safeIntent,
          accessLevel: 1,
          userStatus: 'profile_incomplete',
        } as any);
        userRole = 'customer';

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
        // No stored intent — default to customer. The /choose-role interstitial
        // is gone (CEO order 2026-07-04): providers pick their door explicitly
        // via /become-provider BEFORE signup, so an intent-less login is a
        // customer. Flow continues to buildRoutingResponse, which sends
        // incomplete profiles to /complete-profile.
        await storage.updateUser(userId, {
          role: 'customer',
          signupIntent: 'customer',
          accessLevel: 1,
          userStatus: 'profile_incomplete',
        } as any);
        userRole = 'customer';
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

    // ── SUPER-ADMIN PROMOTION (fix #136-1, CEO 2026-07-25) ─────────────────
    // A super-admin allowlisted email (SUPER_ADMIN_EMAILS) that signed in via
    // Google/OAuth is auto-created with role='customer' and was routed to /home
    // — locked out of the backend ("gmail won't let me in"). Promote it to
    // super_admin BEFORE any role-dependent logic (missingFields, provider/staff
    // fetch, status, routing) so the decider treats it as admin end-to-end. The
    // DB role + Firebase claims are synced below (updates.role) for durability;
    // buildRoutingResponse trusts the promoted role below. SECURITY: gate on
    // isSuperAdminVerified (allowlist AND Firebase email_verified) — the bare
    // isSuperAdmin(email) primitive would promote an UNVERIFIED account that
    // merely registered an allowlisted email. OAuth/Google logins are verified
    // by definition, so the CEO's Gmail passes; an unverified email/password
    // impostor does not.
    const isSuperAdminEmail = isSuperAdminVerified(req);
    if (isSuperAdminEmail && effectiveRole !== 'super_admin') {
      effectiveRole = 'super_admin';
    }

    const missingFields = getMissingFields(u, effectiveRole);

    // ── IDENTITY MERGE — SHADOW MODE (observational only) ──────────────────
    // Mission D shadow probe. The real user resolution above is UNCHANGED:
    // `u`/`userId` are exactly what the existing logic produced. This block
    // ONLY READS — it asks "given this Firebase identity, would the unified-
    // identity flag link this login to a DIFFERENT existing user (by verified
    // email or verified phone)?" If yes → log + record an audit breadcrumb.
    // It NEVER merges, NEVER calls loginOrLink/linkIdentity, NEVER flips the
    // IDENTITY_UNIFIED_ENABLED flag, NEVER mutates any row, and runs
    // regardless of the flag. Fully wrapped in try/catch — a shadow failure
    // can never affect login. Fire-and-forget so it never adds latency.
    try {
      const fbAdminModule = await import('../lib/firebase-admin');
      const fbAuth = fbAdminModule.auth;
      if (fbAuth) {
        const fbUser = await fbAuth.getUser(userId);
        const providerId = fbUser.providerData?.[0]?.providerId || (fbUser.email ? 'password' : 'unknown');
        const { runShadowMergeProbe } = await import('../identity/shadowMergeDetect');
        // Fire-and-forget: do not await — never delay the login response.
        void runShadowMergeProbe({
          currentUserId: userId,
          provider: providerId,
          email: fbUser.email ?? null,
          emailVerified: !!fbUser.emailVerified,
          phone: fbUser.phoneNumber ?? null,
          // A Firebase-provisioned phoneNumber is provider-verified by definition.
          phoneVerified: !!fbUser.phoneNumber,
          ip: getClientIP(req) || req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          traceId: (req as any).traceId || '',
        }).catch(() => { /* fail-soft — runShadowMergeProbe already swallows */ });
      }
    } catch (shadowErr) {
      logger.warn('[IdentityShadow] post-login shadow probe skipped (non-blocking)', {
        userId, error: String(shadowErr),
      });
    }

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
      // MULTI-ROLE CONTRACT (2026-08-20): DO NOT MUTATE users.role on
      // provider approval. The old code overwrote role='customer' →
      // 'provider' (and rewrote Firebase custom claims to match), which
      // silently DELETED the user's customer capability from every
      // downstream `role === 'customer'` check — the exact anti-pattern
      // that shared/lib/userCapabilities.ts:4-7 forbids ("ONE user.
      // Additive capabilities. No mutation of user.role on mode switch.")
      // and that .claude/skills/petwash-provider-onboarding/SKILL.md:8
      // requires ("separate status, separate permissions, separate risk").
      //
      // The additive capability aggregator (server/lib/userCapabilities.ts)
      // sources provider capability from provider_applications.status ===
      // 'approved' directly, so no cache-write is needed for the UI to see
      // the provider capability. `providerApprovedAt` is still stamped as
      // a display-convenience timestamp only. The role upgrade audit event
      // is preserved — it now records the CAPABILITY grant, not a
      // destructive role overwrite.
      const previousRole = effectiveRole;
      updates.providerApprovedAt = new Date();

      try {
        await logAuditEvent({
          actorUserId: userId,
          actorRole: previousRole || 'customer',
          actionType: 'PROVIDER_CAPABILITY_ACTIVATED',
          targetType: 'user',
          targetId: userId,
          ip: getClientIP(req) || req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          traceId: (req as any).traceId || '',
          metadata: {
            previousRole,
            reason: 'provider_application_approved',
            providerApplicationId: providerApp?.id ?? null,
            note: 'Additive capability grant — users.role NOT mutated (multi-role contract §4-7).',
          },
        });
      } catch (auditErr) {
        logger.warn('[PostLogin] Failed to audit-log provider capability activation (non-blocking)', {
          userId,
          error: String(auditErr),
        });
      }
    }

    // NOTE: Removed automatic staff role escalation that was here.
    // A user must have an explicit role assignment in the database (via admin approval)
    // before their role is set to 'staff'. Silent escalation based on userStatus alone
    // bypassed the approval workflow and is a security risk.

    // SUPER-ADMIN DURABILITY (fix #136-1): persist role=super_admin and sync
    // Firebase claims so the promotion sticks across sessions and the client's
    // RBAC/admin guards see a consistent shape immediately — not just this one
    // response. Unlike staff escalation above, this is NOT a silent privilege
    // grant: the email is on the hard-coded SUPER_ADMIN_EMAILS allowlist, which
    // IS the source of truth for super-admin. Best-effort + audited.
    if (isSuperAdminEmail && (u as any).role !== 'super_admin') {
      const previousRole = (u as any).role || 'customer';
      updates.role = 'super_admin';
      try {
        const fbAdminModule = await import('../lib/firebase-admin');
        const fbAuth = fbAdminModule.auth;
        if (fbAuth) {
          const userRec = await fbAuth.getUser(userId);
          const existingClaims = (userRec.customClaims || {}) as Record<string, any>;
          if (existingClaims.role !== 'super_admin' || existingClaims.accountType !== 'internal') {
            await fbAuth.setCustomUserClaims(userId, {
              ...existingClaims,
              role: 'super_admin',
              accountType: 'internal',
            });
            logger.info('[PostLogin] ✅ Firebase claims synced to role=super_admin', { userId, previousRole });
          }
        }
      } catch (claimsErr) {
        logger.warn('[PostLogin] Failed to sync super_admin Firebase claims (non-blocking)', {
          userId, error: String(claimsErr),
        });
      }
      try {
        await logAuditEvent({
          actorUserId: userId,
          actorRole: 'super_admin',
          actionType: 'POST_LOGIN_SUPER_ADMIN_SYNC',
          targetType: 'user',
          targetId: userId,
          ip: getClientIP(req) || req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          traceId: (req as any).traceId || '',
          metadata: { from: previousRole, to: 'super_admin', reason: 'super_admin_allowlist' },
        });
      } catch (auditErr) {
        logger.warn('[PostLogin] Failed to audit super_admin sync (non-blocking)', {
          userId, error: String(auditErr),
        });
      }
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

    // MULTI-ROLE (CEO 2026-08-23): pass the request intent through so the
    // super_admin branch can honor `intent=provider|loyalty|customer|member`
    // and land the same account on the surface it asked for this session.
    // Falls back to the stored signupIntent for a returning user who set
    // their preference at signup time.
    const routingIntent = (typeof intent === 'string' && intent) || (u as any)?.signupIntent || null;

    // Prestige membership signal — used ONLY for tile/badge rendering
    // (CEO 2026-08-26 role-model: Prestige is a membership, not a role).
    // Does NOT gate the picker — every approved provider is also a Pet
    // Parent, so the picker always fires for approved providers regardless
    // of Prestige. Fail-soft: a lookup blip treats prestige as absent so
    // we never render a "Prestige" badge for someone who isn't enrolled.
    let hasPrestige = false;
    if ((u as any).email) {
      try {
        const [prow] = await db
          .select({ status: privilegeMembers.status })
          .from(privilegeMembers)
          .where(eq(privilegeMembers.email, (u as any).email))
          .limit(1);
        hasPrestige = !!prow && (prow.status ?? 'active') === 'active';
      } catch (prestigeErr: any) {
        logger.warn('[PostLogin] prestige lookup failed (defaulting false)', {
          userId, error: String(prestigeErr?.message ?? prestigeErr),
        });
      }
    }

    const response = buildRoutingResponse(u, effectiveRole, userStatus, missingFields, providerApp, staffReq, routingIntent, hasPrestige);
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
        // dateOfBirth + city are prefilled by /complete-profile and
        // /provider-onboarding — omitting them forced users to re-enter the
        // birthday/city they already gave at signup. (2026-07-27)
        dateOfBirth: (user as any).dateOfBirth || null,
        city: (user as any).city || null,
        // phoneVerified lets /provider-onboarding trust a phone already verified at
        // signup instead of forcing a re-OTP (which dead-ends when Twilio is off).
        // (2026-07-27)
        phoneVerified: !!((user as any).phoneVerified || (user as any).mobileVerifiedAt),
        role,
        userStatus,
        profilePictureUrl: (user as any).profileImageUrl || null,
      },
      profileStatus,
      userStatus,
      role,
      missingFields,
      // requiredFields is the name /complete-profile reads; it was reading
      // undefined (missingFields was the only key) → rendered NO input fields →
      // a name-less phone/email signup got hard-stuck after OTP. Alias them.
      // (2026-07-27)
      requiredFields: missingFields,
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

    // Intent is a ROUTING signal, not a role assignment (see the identical
    // reasoning in postLoginDecider above). The base account is always a
    // customer; provider/staff capability is granted by the per-capability
    // tables (provider_applications, staff_access_requests) read by
    // server/lib/userCapabilities.ts. Persist signup intent for routing
    // steering; do NOT let a request body pick the role.
    const assignedRole = 'customer';

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
      gender,
      address,
      city,
      postalCode,
      country,
      termsAccepted,
      privacyAccepted,
      marketingConsent,
    } = req.body || {};

    // Fall back to the name already on the user row when the client doesn't
    // resend it. Google/Apple signups already HAVE a name (from displayName), so
    // it is NOT in `requiredFields` and the client (CompleteProfile.tsx) omits it —
    // the old hard check then 400'd NAME_REQUIRED and dead-ended EVERY social
    // signup at Complete-Profile (only `phone` was actually missing for them).
    // Reject only when neither the request nor the existing DB row has a name.
    // (2026-08-11)
    const existingUserRow = await storage.getUser(userId);
    const effectiveFirstName =
      (typeof firstName === "string" && firstName.trim()) ||
      (existingUserRow as any)?.firstName ||
      "";
    const effectiveLastName =
      (typeof lastName === "string" && lastName.trim()) ||
      (existingUserRow as any)?.lastName ||
      "";
    if (!effectiveFirstName || !effectiveLastName) {
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

    const user = existingUserRow;
    const role = (user as any)?.role || 'customer';

    if (role === 'provider' && !phone) {
      return res.status(400).json({
        error: "PHONE_REQUIRED",
        message: "Phone number is required for provider accounts",
      });
    }

    const now = new Date();
    const updates: Record<string, any> = {
      firstName: effectiveFirstName,
      lastName: effectiveLastName,
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
        // 18+ is a hard gate for PetWash membership (Prestige is over-18 only).
        // Enforce server-side from the DOB — not just the client checkbox.
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
        if (age < 18) {
          return res.status(400).json({
            error: "UNDER_18",
            message: "You must be 18 or older to join PetWash.",
          });
        }
        updates.dateOfBirth = dateOfBirth;
      }
    }

    // Sex/gender (optional) — male | female | other | prefer_not_to_say.
    if (typeof gender === 'string' && ['male', 'female', 'other', 'prefer_not_to_say'].includes(gender)) {
      updates.gender = gender;
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

    // Pin the enrol address into the reusable multi-address book (CEO 2026-07-09:
    // "address of the user gets saved when he enrols — pin it — or he might have
    // more than one address under profile"). The users-table write above keeps the
    // inline profile address; this ALSO seeds userAddresses (label 'home', default)
    // so shop delivery, bookings and proximity reuse a saved+pinned address instead
    // of re-asking, and the customer can add more addresses later. The full
    // multi-address book already existed (user-addresses.ts) but enrol never wrote
    // to it — this closes that gap. First-address-only + non-fatal: never dupes,
    // never blocks profile completion.
    if (address && String(address).trim()) {
      try {
        const { db } = await import('../db');
        const { userAddresses } = await import('../../shared/schema');
        const { eq } = await import('drizzle-orm');
        const existing = await db
          .select({ id: userAddresses.id })
          .from(userAddresses)
          .where(eq(userAddresses.userId, userId))
          .limit(1);
        if (existing.length === 0) {
          let latStr: string | undefined;
          let lngStr: string | undefined;
          try {
            const { geocodeAddress } = await import('../lib/geocode');
            const composed = [address, city, postalCode, country || 'Israel'].filter(Boolean).join(', ');
            const point = await geocodeAddress(composed);
            if (point) { latStr = point.lat.toString(); lngStr = point.lng.toString(); }
          } catch { /* geocode is best-effort — save the address regardless */ }
          await db.insert(userAddresses).values({
            userId,
            address: String(address),
            label: 'home',
            city: city || undefined,
            postalCode: postalCode || undefined,
            lat: latStr,
            lng: lngStr,
            isDefault: true,
          } as any);
          logger.info('[CompleteProfile] Pinned enrol address into userAddresses (home, default)', { userId });
        }
      } catch (addrErr: any) {
        logger.warn('[CompleteProfile] Could not pin enrol address (non-fatal)', { userId, error: String(addrErr) });
      }
    }

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
