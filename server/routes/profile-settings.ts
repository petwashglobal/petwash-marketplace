import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { and, eq, ne } from 'drizzle-orm';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { phoneLookupHash } from '../lib/phoneHmac';
import { z } from 'zod';
import crypto from 'crypto';
import { hashOtpCode, verifyOtpCode } from '../lib/otpHmac';
import multer from 'multer';
import { authService } from '../services/AuthService';
import { isUnifiedVerificationChangeEmailEnabled } from '../lib/feature-flags/unifiedVerification';
import {
  UnifiedVerificationError,
  unifiedVerificationService,
  type VerificationActor,
} from '../services/UnifiedVerificationService';
import { sendVerificationEmailCode } from '../services/VerificationEmailDelivery';
import { normalizePhoneE164, isE164 } from '../lib/phoneE164';
import { revokeAllForUser } from '../services/SessionService';

const router = Router();
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

/**
 * Lower-cases + trims an address so `Nir@Example.COM` and `nir@example.com`
 * cannot become two rows under the `users.email` UNIQUE index, and so a
 * lookup-by-email from any other module finds the row.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Maps a raw firebase-admin auth error to a status + stable client code.
 * Raw Firebase errors must never reach the client: they leak whether an
 * address is registered, and their messages are not translatable.
 */
export function sanitizeFirebaseAuthError(
  error: any,
): { status: number; code: string; message: string } {
  switch (error?.code) {
    case 'auth/email-already-exists':
      return { status: 409, code: 'EMAIL_ALREADY_IN_USE', message: 'Email already in use' };
    case 'auth/invalid-email':
      return { status: 400, code: 'INVALID_EMAIL', message: 'Invalid email address' };
    case 'auth/phone-number-already-exists':
      return { status: 409, code: 'PHONE_ALREADY_IN_USE', message: 'Phone number already in use' };
    case 'auth/invalid-phone-number':
      return { status: 400, code: 'INVALID_PHONE', message: 'Invalid phone number' };
    case 'auth/user-not-found':
      return { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    case 'auth/too-many-requests':
      return { status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please wait and try again.' };
    default:
      return { status: 500, code: 'IDENTITY_UPDATE_FAILED', message: 'Failed to update identity' };
  }
}

const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  birthdate: z.string().optional(),
  preferredLanguage: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']).optional(),
});

const emailChangeRequestSchema = z.object({
  // .trim().toLowerCase() BEFORE .email() so `  Nir@Example.COM ` both
  // validates and is stored in exactly one canonical form.
  newEmail: z.string().trim().toLowerCase().pipe(z.string().email()),
});

const emailChangeConfirmSchema = z.object({
  verificationCode: z.string().length(6),
  verificationChallengeId: z.string().min(10).max(100).optional(),
});

function verificationActorFromRequest(req: any, uid: string): VerificationActor {
  return {
    userId: uid,
    ip: req.ip || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
  };
}

/**
 * `nirhadad@example.com` -> `ni••••••@example.com`. Used wherever a pending
 * change is echoed back, so a stolen session cannot be used to read an address
 * the attacker does not already know.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'\u2022'.repeat(Math.max(1, local.length - head.length))}${domain}`;
}

/** Max wrong OTP guesses before a pending email change is destroyed. */
const EMAIL_OTP_MAX_ATTEMPTS = 5;

/** Window, in seconds, within which a sign-in still counts as "recent". */
const RECENT_AUTH_WINDOW_SECONDS = 300;

/**
 * True when the caller signed in (or re-authenticated) within the recent-auth
 * window. Changing a contact identity is a credential change and must not be
 * possible from a long-lived session someone walked away from.
 *
 * BUG FIXED 2026-09-05: the previous inline check was
 *   `if (authTime < fiveMinutesAgo) deny`
 * with `authTime = decodedToken.auth_time`. When `auth_time` is absent from the
 * token (custom-token sign-ins and some SDK paths omit it) the comparison is
 * `undefined < number` === false, so the gate SILENTLY PASSED — the exact
 * opposite of fail-closed. A missing auth_time now denies.
 */
export function hasRecentAuth(
  decodedToken: { auth_time?: number } | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const authTime = decodedToken?.auth_time;
  if (typeof authTime !== 'number' || !Number.isFinite(authTime)) return false;
  return authTime >= nowSeconds - RECENT_AUTH_WINDOW_SECONDS;
}

interface ApplyEmailResult {
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
}

/**
 * THE single place a verified new email becomes canonical.
 *
 * Both the unified-verification path and the legacy pending-doc path call this,
 * so the two runtimes cannot drift. Ownership of `newEmail` MUST already have
 * been proven by the caller (an OTP delivered to that address) before this runs.
 *
 * Order matters, and it is the fix for two live defects:
 *
 *   1. `users.email` is UNIQUE. The old code updated Firebase FIRST and then ran
 *      an unguarded `db.update(users)`. If another PetWash row already held the
 *      address the UPDATE threw 23505, the generic catch returned a 500 — and
 *      Firebase had ALREADY been changed. Result: Firebase says the new address,
 *      the canonical PetWash row still says the old one, and the user is told the
 *      change failed. Identity split, silently. We now pre-check the canonical
 *      table and refuse BEFORE touching Firebase.
 *   2. `db.update().where()` that matches ZERO rows resolves without throwing.
 *      The generic profile PATCH was hardened against this (CRIT-5) but the email
 *      path was not, so a missing user row meant Firebase changed and the
 *      canonical row did not. `.returning()` + a row count, and a Firebase
 *      roll-back when the canonical write cannot land.
 *
 * Also sets `emailVerified: true`. `admin.auth().updateUser({ email })` resets
 * Firebase's emailVerified to false; the user just proved ownership by OTP, so
 * leaving it false made a verified member un-verified — which then flipped
 * `/settings/verification-status` to `canUploadPhoto: false`.
 */
export async function applyVerifiedEmailChange(params: {
  uid: string;
  newEmail: string;
  oldEmail: string;
}): Promise<ApplyEmailResult> {
  const { uid, oldEmail } = params;
  const newEmail = normalizeEmail(params.newEmail);

  if (!newEmail) {
    return { ok: false, status: 400, code: 'INVALID_EMAIL', message: 'Invalid email address' };
  }

  // (1) Canonical-table conflict check BEFORE Firebase is touched.
  const conflicting = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, newEmail), ne(users.id, uid)))
    .limit(1);
  if (conflicting.length > 0) {
    logger.warn('[ProfileSettings] Email change refused — address held by another PetWash user', { uid });
    return { ok: false, status: 409, code: 'EMAIL_ALREADY_IN_USE', message: 'Email already in use' };
  }

  // (2) Firebase identity.
  try {
    await admin.auth().updateUser(uid, { email: newEmail, emailVerified: true });
  } catch (error: any) {
    const sanitized = sanitizeFirebaseAuthError(error);
    logger.error('[ProfileSettings] Firebase email update failed', { uid, code: error?.code });
    return { ok: false, ...sanitized };
  }

  // (3) Canonical PetWash row — must actually match a row.
  let affected: Array<{ id: string }> = [];
  try {
    affected = await db
      .update(users)
      .set({ email: newEmail, emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, uid))
      .returning({ id: users.id });
  } catch (error: any) {
    // Roll Firebase back so the two stores cannot disagree.
    await admin.auth().updateUser(uid, { email: oldEmail || undefined }).catch((e: any) =>
      logger.error('[ProfileSettings] CRITICAL: Firebase rollback failed after canonical write error', {
        uid,
        error: e?.message,
      }),
    );
    if (error?.code === '23505') {
      return { ok: false, status: 409, code: 'EMAIL_ALREADY_IN_USE', message: 'Email already in use' };
    }
    logger.error('[ProfileSettings] Canonical email write failed', { uid, error: error?.message });
    return { ok: false, status: 500, code: 'IDENTITY_UPDATE_FAILED', message: 'Failed to update email' };
  }

  if (affected.length === 0) {
    await admin.auth().updateUser(uid, { email: oldEmail || undefined }).catch((e: any) =>
      logger.error('[ProfileSettings] CRITICAL: Firebase rollback failed after 0-row canonical write', {
        uid,
        error: e?.message,
      }),
    );
    logger.error('[ProfileSettings] Email change matched 0 canonical rows — NOT saved', { uid });
    return {
      ok: false,
      status: 404,
      code: 'CANONICAL_ROW_MISSING',
      message: 'User row not found; your email was NOT changed.',
    };
  }

  // (4) A credential changed — every other device holds a session minted
  //     against the previous identity. Fail-soft: the identity change already
  //     landed, so a revoke error must not turn a success into a 500.
  try {
    const revoked = await revokeAllForUser(uid, 'contact_change');
    logger.info('[ProfileSettings] Sessions revoked after email change', { uid, revoked });
  } catch (e: any) {
    logger.error('[ProfileSettings] Session revoke after email change failed (non-blocking)', {
      uid,
      error: e?.message,
    });
  }

  return { ok: true };
}


router.get('/settings/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (e) {
      return res.status(404).json({ error: 'User not found' });
    }

    let firestorePrefs: any = {};
    try {
      const firestore = admin.firestore();
      const userDoc = await firestore.collection('users').doc(uid).get();
      firestorePrefs = userDoc.data()?.notificationPreferences || {};
    } catch (e) {
      logger.warn('[ProfileSettings] Firestore fetch failed:', e);
    }

    const profile = {
      firstName: user?.firstName || firebaseUser.displayName?.split(' ')[0] || '',
      lastName: user?.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
      email: user?.email || firebaseUser.email || '',
      phone: user?.phone || firebaseUser.phoneNumber || '',
      address: firestorePrefs.address || '',
      city: firestorePrefs.city || '',
      birthdate: user?.dateOfBirth || '',
      photoURL: user?.profileImageUrl || firebaseUser.photoURL || '',
      preferredLanguage: user?.language || 'he',
      emailVerified: firebaseUser.emailVerified,
      createdAt: user?.createdAt || firebaseUser.metadata.creationTime,
      notificationPreferences: {
        pushEnabled: firestorePrefs.pushEnabled ?? false,
        emailEnabled: firestorePrefs.emailEnabled ?? false,
        smsEnabled: firestorePrefs.smsEnabled ?? false,
        marketingEnabled: firestorePrefs.marketingEnabled ?? false,
        reminderEnabled: firestorePrefs.reminderEnabled ?? false,
        birthdayOffersEnabled: firestorePrefs.birthdayOffersEnabled ?? false,
        loyaltyUpdatesEnabled: firestorePrefs.loyaltyUpdatesEnabled ?? false,
      },
    };

    res.json(profile);
  } catch (error: any) {
    logger.error('[ProfileSettings] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/settings/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const parseResult = profileUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    }

    const updates = parseResult.data;
    const [existingUser] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (e) {
      return res.status(404).json({ error: 'User not found' });
    }

    const changedFields: string[] = [];
    const previousValues: Record<string, any> = {};

    if (updates.firstName !== undefined && updates.firstName !== existingUser?.firstName) {
      changedFields.push('firstName');
      previousValues.firstName = existingUser?.firstName || '';
    }
    if (updates.lastName !== undefined && updates.lastName !== existingUser?.lastName) {
      changedFields.push('lastName');
      previousValues.lastName = existingUser?.lastName || '';
    }

    // ── MOBILE: a generic profile PATCH may NEVER *change* a mobile number ──
    // `users.phone` is UNIQUE and is the lookup key for SMS OTP login
    // (via users.phone_hash). Letting an unverified PATCH rewrite it means:
    //   * whoever holds a session can point the account's SMS OTP, booking
    //     confirmations and receipts at a number they never proved they own;
    //   * because the column is unique, an unverified write can squat a number
    //     that belongs to somebody else and block the real owner from ever
    //     registering it.
    // A verified mobile change goes through the SMS-OTP flow (Firebase
    // updatePhoneNumber -> POST /api/user/settings/phone/confirm-verification),
    // which is the only path that has actually proven possession of the handset.
    //
    // FIRST-SET is still allowed: /booking-contact writes a phone for users who
    // have none on file, and blocking that would break a live booking journey.
    // The value is normalised to E.164 and the HMAC lookup key is written with
    // it (previously the UPDATE path set `phone` but left `phone_hash` pointing
    // at the OLD number, so SMS login and the profile disagreed forever).
    if (updates.phone !== undefined) {
      const incomingPhone = normalizePhoneE164(updates.phone);
      const currentPhone = (existingUser?.phone || '').trim();

      if (!incomingPhone || !isE164(incomingPhone)) {
        return res.status(400).json({
          error: 'Invalid phone number. Use international format, e.g. +972541234567.',
          code: 'INVALID_PHONE',
        });
      }

      if (currentPhone && normalizePhoneE164(currentPhone) !== incomingPhone) {
        logger.warn('[ProfileSettings] Blocked unverified mobile CHANGE via generic PATCH', { uid });
        return res.status(400).json({
          error: 'Changing your mobile number requires SMS verification.',
          code: 'MOBILE_CHANGE_REQUIRES_VERIFICATION',
        });
      }

      if (!currentPhone) {
        updateData.phone = incomingPhone;
        updateData.phoneHash = phoneLookupHash(incomingPhone);
      }
      // else: same number, normalised — nothing to write.
    }

    const updateData: Record<string, any> = {};
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.birthdate !== undefined) updateData.dateOfBirth = updates.birthdate;
    if (updates.preferredLanguage !== undefined) updateData.language = updates.preferredLanguage;

    if (updates.address !== undefined || updates.city !== undefined) {
      try {
        const firestore = admin.firestore();
        const firestoreUpdate: Record<string, any> = {};
        if (updates.address !== undefined) firestoreUpdate.address = updates.address;
        if (updates.city !== undefined) firestoreUpdate.city = updates.city;
        await firestore.collection('users').doc(uid).set(firestoreUpdate, { merge: true });
      } catch (e) {
        logger.warn('[ProfileSettings] Failed to save address/city to Firestore:', e);
      }
    }

    if (Object.keys(updateData).length > 0) {
      if (existingUser) {
        // CRIT-5 (save-integrity audit 2026-08-24): guard against silent no-op.
        // A .update().where() that matches ZERO rows still resolves — no throw,
        // no diagnostic. This is exactly the "profile edit doesn't stick"
        // symptom users have reported: the row was raced-deleted or the uid
        // was miscomputed, so nothing changes, and the API responds success:true.
        // .returning() + rowsAffected check makes the failure visible.
        const affected = await db.update(users).set(updateData).where(eq(users.id, uid)).returning({ id: users.id });
        if (affected.length === 0) {
          logger.warn('[ProfileSettings] update matched 0 rows — user row disappeared between preflight and write', { uid });
          return res.status(404).json({ error: 'User row not found; profile change was NOT saved.' });
        }
      } else {
        {
          // AUDIT-SMS-14 (#225): mirror the phone into the HMAC lookup
          // column on first insert so hash-based queries hit immediately.
          const rawPhoneForInsert = updates.phone || firebaseUser.phoneNumber || '';
          const phoneForInsert = rawPhoneForInsert ? normalizePhoneE164(rawPhoneForInsert) : '';
          await db.insert(users).values({
            id: uid,
            email: firebaseUser.email || '',
            firstName: updates.firstName || firebaseUser.displayName?.split(' ')[0] || '',
            lastName: updates.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
            phone: phoneForInsert,
            phoneHash: phoneLookupHash(phoneForInsert),
            address: updates.address || '',
            city: updates.city || '',
            dateOfBirth: updates.birthdate || '',
            profileImageUrl: firebaseUser.photoURL || '',
            language: updates.preferredLanguage || 'he',
          });
        }
        // Ensure wallet and loyalty profile exist for newly-created user rows.
        // This is idempotent — silently skips creation if they already exist.
        authService.ensureWalletAccount(uid).catch((e: any) => logger.warn('[ProfileSettings:WalletAccount] ensureWalletAccount failed (non-blocking)', { uid, error: e?.message }));
        authService.ensureLoyaltyProfile(uid).catch((e: any) => logger.warn('[ProfileSettings:LoyaltyProfile] ensureLoyaltyProfile failed (non-blocking)', { uid, error: e?.message }));
      }
    }

    if (changedFields.includes('firstName') || changedFields.includes('lastName')) {
      try {
        const firestore = admin.firestore();
        await firestore.collection('profile_change_audit').add({
          userId: uid,
          changedFields,
          previousValues,
          newValues: {
            firstName: updates.firstName,
            lastName: updates.lastName,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          changeType: 'identity_update',
        });
        logger.info('[ProfileSettings] Identity change audit logged', { userId: uid, changedFields });
      } catch (auditError) {
        logger.error('[ProfileSettings] Failed to log audit:', auditError);
      }
    }

    if (updates.firstName || updates.lastName) {
      try {
        const newDisplayName = [updates.firstName || existingUser?.firstName, updates.lastName || existingUser?.lastName]
          .filter(Boolean)
          .join(' ');
        await admin.auth().updateUser(uid, { displayName: newDisplayName });
      } catch (e) {
        logger.warn('[ProfileSettings] Failed to update Firebase displayName:', e);
      }
    }

    logger.info('[ProfileSettings] Profile updated for user:', uid);
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      identityChangeLogged: changedFields.length > 0,
    });
  } catch (error: any) {
    if (error?.code === '23505' || error?.constraint === 'users_phone_unique') {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
    logger.error('[ProfileSettings] PATCH error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/settings/email/request-change', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    if (!hasRecentAuth(decodedToken)) {
      logger.warn('[ProfileSettings] Email change denied - session too old for user:', uid);
      return res.status(403).json({ 
        error: 'Re-authentication required',
        message: 'Please sign out and sign in again before changing your email address.',
        code: 'REAUTH_REQUIRED',
      });
    }

    const parseResult = emailChangeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    }

    const { newEmail } = parseResult.data;

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUser(uid);
    } catch (e) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (normalizeEmail(firebaseUser.email || '') === newEmail) {
      return res.status(400).json({
        error: 'That is already your email address',
        code: 'EMAIL_UNCHANGED',
      });
    }

    // Refuse up-front if the address is taken — in EITHER store. Checking only
    // Firebase let a legacy PetWash row holding the address slip through, and
    // the collision then surfaced as a 500 at confirm time, AFTER Firebase had
    // already been changed (see applyVerifiedEmailChange).
    try {
      const existingUser = await admin.auth().getUserByEmail(newEmail);
      if (existingUser && existingUser.uid !== uid) {
        return res.status(409).json({ error: 'Email already in use', code: 'EMAIL_ALREADY_IN_USE' });
      }
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    const canonicalConflict = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, newEmail), ne(users.id, uid)))
      .limit(1);
    if (canonicalConflict.length > 0) {
      return res.status(409).json({ error: 'Email already in use', code: 'EMAIL_ALREADY_IN_USE' });
    }

    const firestore = admin.firestore();

    if (isUnifiedVerificationChangeEmailEnabled()) {
      const challenge = await unifiedVerificationService.startChallenge({
        purpose: 'change_email',
        channel: 'email',
        destination: newEmail,
        payload: {
          oldEmail: firebaseUser.email || '',
        },
        actor: verificationActorFromRequest(req, uid),
      });

      await firestore.collection('email_change_audit').add({
        userId: uid,
        oldEmail: firebaseUser.email,
        newEmail,
        status: 'requested',
        runtime: 'unified_verification',
        challengeId: challenge.challenge.challengeId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      logger.info('[ProfileSettings] Unified email change requested', { userId: uid, newEmail });
      return res.json({
        success: true,
        message: 'Verification code sent to new email',
        runtime: 'unified_verification',
        verificationChallengeId: challenge.challenge.challengeId,
        expiresAt: challenge.challenge.expiresAt,
      });
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Persist ONLY the HMAC of the code — never the plaintext code at rest.
    await firestore.collection('pending_email_changes').doc(uid).set({
      newEmail,
      codeHmac: hashOtpCode(verificationCode),
      attempts: 0,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      oldEmail: firebaseUser.email || '',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    const sent = await sendVerificationEmailCode({
      to: newEmail,
      code: verificationCode,
      purpose: 'change_email',
    });
    if (!sent) {
      await firestore.collection('pending_email_changes').doc(uid).delete();
      return res.status(503).json({ error: 'Failed to send verification email' });
    }

    await firestore.collection('email_change_audit').add({
      userId: uid,
      oldEmail: firebaseUser.email,
      newEmail,
      status: 'requested',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    logger.info('[ProfileSettings] Email change requested', { userId: uid, newEmail });
    if (process.env.NODE_ENV === 'development') {
      logger.info('[ProfileSettings] Verification code (DEV ONLY):', verificationCode);
    }

    res.json({
      success: true,
      message: 'Verification code sent to new email',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof UnifiedVerificationError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.reasonCode });
    }
    logger.error('[ProfileSettings] Email change request error:', error);
    res.status(500).json({ error: 'Failed to initiate email change' });
  }
});

/**
 * GET /api/user/settings/email/pending-change
 *
 * Lets a half-finished email change SURVIVE A PAGE REFRESH.
 *
 * The client held `emailChangeStep` and `verificationChallengeId` in React
 * state only. Refresh the tab (or get backgrounded on iOS Safari and reloaded)
 * and the challenge id was gone: the code in the user's inbox was still valid
 * but there was no way to submit it, and re-requesting sent a second code —
 * which is exactly what makes people give up on a change-email flow.
 *
 * Server-derived UID only. The address is masked: this endpoint must not turn
 * a stolen session into an address-disclosure oracle.
 */
router.get('/settings/email/pending-change', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firestore = admin.firestore();
    const pendingDoc = await firestore.collection('pending_email_changes').doc(uid).get();

    if (!pendingDoc.exists) {
      return res.json({ pending: false });
    }

    const pending = pendingDoc.data() as any;
    const expiresAt: Date | null = pending?.expiresAt?.toDate?.() ?? null;

    if (!expiresAt || new Date() > expiresAt) {
      await firestore.collection('pending_email_changes').doc(uid).delete();
      return res.json({ pending: false });
    }

    return res.json({
      pending: true,
      maskedNewEmail: maskEmail(pending.newEmail || ''),
      expiresAt: expiresAt.toISOString(),
      attemptsRemaining: Math.max(
        0,
        EMAIL_OTP_MAX_ATTEMPTS - (typeof pending.attempts === 'number' ? pending.attempts : 0),
      ),
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Pending email change lookup error:', error);
    res.status(500).json({ error: 'Failed to read pending email change' });
  }
});

router.post('/settings/email/confirm-change', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const parseResult = emailChangeConfirmSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }

    const { verificationCode } = parseResult.data;
    const firestore = admin.firestore();

    if (isUnifiedVerificationChangeEmailEnabled()) {
      const { verificationChallengeId } = parseResult.data;
      if (!verificationChallengeId) {
        return res.status(400).json({
          error: 'Verification challenge is required',
          code: 'VERIFICATION_CHALLENGE_REQUIRED',
        });
      }

      const verificationResult = await unifiedVerificationService.verifyChallenge({
        challengeId: verificationChallengeId,
        code: verificationCode,
        actor: verificationActorFromRequest(req, uid),
      });

      const metadata = (verificationResult.action as any)?.metadata || {};
      const newEmail = typeof metadata.newEmail === 'string' ? metadata.newEmail : '';
      if (!newEmail) {
        return res.status(400).json({ error: 'Invalid verification challenge', code: 'INVALID_VERIFICATION_ACTION' });
      }

      let firebaseUser;
      try {
        firebaseUser = await admin.auth().getUser(uid);
      } catch (e) {
        return res.status(404).json({ error: 'User not found' });
      }

      const applied = await applyVerifiedEmailChange({
        uid,
        newEmail,
        oldEmail: metadata.oldEmail || firebaseUser.email || '',
      });
      if (!applied.ok) {
        await firestore.collection('email_change_audit').add({
          userId: uid,
          oldEmail: metadata.oldEmail || firebaseUser.email,
          newEmail,
          status: 'failed',
          failureCode: applied.code,
          runtime: 'unified_verification',
          challengeId: verificationChallengeId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        });
        return res.status(applied.status || 500).json({ error: applied.message, code: applied.code });
      }

      await firestore.collection('email_change_audit').add({
        userId: uid,
        oldEmail: metadata.oldEmail || firebaseUser.email,
        newEmail,
        status: 'completed',
        runtime: 'unified_verification',
        challengeId: verificationChallengeId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      });

      logger.info('[ProfileSettings] Unified email changed', { userId: uid, oldEmail: metadata.oldEmail || firebaseUser.email, newEmail });

      return res.json({
        success: true,
        message: 'Email updated successfully',
        runtime: 'unified_verification',
        newEmail,
        emailVerified: true,
        sessionsRevoked: true,
      });
    }

    const pendingDoc = await firestore.collection('pending_email_changes').doc(uid).get();

    if (!pendingDoc.exists) {
      return res.status(400).json({ error: 'No pending email change request' });
    }

    const pending = pendingDoc.data() as any;
    const expiresAt = pending.expiresAt.toDate();

    if (new Date() > expiresAt) {
      await firestore.collection('pending_email_changes').doc(uid).delete();
      return res.status(400).json({ error: 'Verification code expired', code: 'CODE_EXPIRED' });
    }

    // Attempt limiter — the pending doc previously accepted UNLIMITED guesses
    // against a 6-digit code for the whole 15-minute window. 1,000,000 codes vs
    // an unbounded guess budget is not a control. Five tries, then the pending
    // change is destroyed and the user must re-request.
    const attempts = typeof pending.attempts === 'number' ? pending.attempts : 0;
    if (attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
      await firestore.collection('pending_email_changes').doc(uid).delete();
      logger.warn('[ProfileSettings] Email change destroyed — attempt limit reached', { userId: uid });
      return res.status(429).json({
        error: 'Too many incorrect codes. Please request a new one.',
        code: 'TOO_MANY_ATTEMPTS',
      });
    }

    if (!verifyOtpCode(verificationCode, pending.codeHmac)) {
      await firestore
        .collection('pending_email_changes')
        .doc(uid)
        .update({ attempts: attempts + 1 })
        .catch((e: any) => logger.error('[ProfileSettings] attempt counter write failed', { uid, error: e?.message }));
      return res.status(400).json({
        error: 'Invalid verification code',
        code: 'INVALID_CODE',
        attemptsRemaining: Math.max(0, EMAIL_OTP_MAX_ATTEMPTS - (attempts + 1)),
      });
    }

    const applied = await applyVerifiedEmailChange({
      uid,
      newEmail: pending.newEmail,
      oldEmail: pending.oldEmail || '',
    });
    if (!applied.ok) {
      await firestore.collection('email_change_audit').add({
        userId: uid,
        oldEmail: pending.oldEmail,
        newEmail: pending.newEmail,
        status: 'failed',
        failureCode: applied.code,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      });
      return res.status(applied.status || 500).json({ error: applied.message, code: applied.code });
    }

    await firestore.collection('email_change_audit').add({
      userId: uid,
      oldEmail: pending.oldEmail,
      newEmail: pending.newEmail,
      status: 'completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    });

    await firestore.collection('pending_email_changes').doc(uid).delete();

    logger.info('[ProfileSettings] Email changed', { userId: uid, oldEmail: pending.oldEmail, newEmail: pending.newEmail });

    res.json({
      success: true,
      message: 'Email updated successfully',
      newEmail: pending.newEmail,
      emailVerified: true,
      sessionsRevoked: true,
    });
  } catch (error: any) {
    if (error instanceof UnifiedVerificationError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.reasonCode });
    }
    logger.error('[ProfileSettings] Email change confirm error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

router.patch('/settings/notifications', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const preferences = req.body;

    const firestore = admin.firestore();
    await firestore.collection('users').doc(uid).set({
      notificationPreferences: preferences,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.info('[ProfileSettings] Notification preferences updated for user:', uid);
    res.json({ success: true, message: 'Notification preferences updated' });
  } catch (error: any) {
    logger.error('[ProfileSettings] Notifications update error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

router.get('/settings/change-history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firestore = admin.firestore();
    
    const profileChanges = await firestore.collection('profile_change_audit')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const emailChanges = await firestore.collection('email_change_audit')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const history = [
      ...profileChanges.docs.map(doc => ({
        id: doc.id,
        type: 'profile',
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || null,
      })),
      ...emailChanges.docs.map(doc => ({
        id: doc.id,
        type: 'email',
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || null,
      })),
    ].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

    res.json({ history });
  } catch (error: any) {
    logger.error('[ProfileSettings] Change history error:', error);
    res.status(500).json({ error: 'Failed to fetch change history' });
  }
});

router.post('/settings/phone/confirm-verification', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firebaseUser = await admin.auth().getUser(uid);

    if (!firebaseUser.phoneNumber) {
      return res.status(400).json({
        error: 'No phone number linked to account',
        code: 'NO_PHONE_LINKED',
      });
    }

    // Firebase is the ownership oracle here: the client proved possession of the
    // handset via the Firebase SMS OTP (updatePhoneNumber), so whatever
    // firebaseUser.phoneNumber now says IS verified. The server never trusts a
    // number from the request body — the UID comes from the token and the number
    // comes from Firebase, so a caller cannot mirror somebody else's mobile.
    const verifiedPhone = normalizePhoneE164(firebaseUser.phoneNumber);
    const [existing] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    const previousPhone = existing?.phone || '';

    // Refuse if another PetWash row already holds the number. `users.phone` is
    // UNIQUE, so without this pre-check the UPDATE raises 23505 and the generic
    // catch returned an opaque 500 — the user was told "verification failed"
    // when in fact their handset verified fine and the collision was elsewhere.
    const phoneConflict = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, verifiedPhone), ne(users.id, uid)))
      .limit(1);
    if (phoneConflict.length > 0) {
      logger.warn('[ProfileSettings] Phone confirm refused — number held by another PetWash user', { uid });
      return res.status(409).json({
        error: 'That phone number is already linked to another PetWash account.',
        code: 'PHONE_ALREADY_IN_USE',
      });
    }

    // AUDIT-SMS-14 (#225): write both the raw phone (needed for the
    // sender path) and the HMAC lookup key so subsequent code can
    // query without touching the raw column.
    // 2026-09-05: `.returning()` + row count — an UPDATE matching ZERO rows
    // resolves silently, which used to report `verified: true` while the
    // canonical row still carried the old number.
    const affected = await db.update(users).set({
      phone: verifiedPhone,
      phoneHash: phoneLookupHash(verifiedPhone),
      phoneVerified: true,
      updatedAt: new Date(),
    }).where(eq(users.id, uid)).returning({ id: users.id });

    if (affected.length === 0) {
      logger.error('[ProfileSettings] Phone confirm matched 0 canonical rows — NOT saved', { uid });
      return res.status(404).json({
        error: 'User row not found; your mobile number was NOT saved.',
        code: 'CANONICAL_ROW_MISSING',
      });
    }

    const firestore = admin.firestore();
    await firestore.collection('phone_verification_audit').add({
      userId: uid,
      previousPhone: previousPhone || null,
      phone: verifiedPhone,
      changed: normalizePhoneE164(previousPhone || '') !== verifiedPhone,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    // A CHANGE of mobile (not a first-set) is a credential change — other
    // devices still hold sessions minted against the previous identity.
    let sessionsRevoked = false;
    if (previousPhone && normalizePhoneE164(previousPhone) !== verifiedPhone) {
      try {
        const count = await revokeAllForUser(uid, 'contact_change');
        sessionsRevoked = true;
        logger.info('[ProfileSettings] Sessions revoked after mobile change', { uid, count });
      } catch (e: any) {
        logger.error('[ProfileSettings] Session revoke after mobile change failed (non-blocking)', {
          uid,
          error: e?.message,
        });
      }
    }

    logger.info('[ProfileSettings] Phone verified', { userId: uid });

    res.json({
      success: true,
      phone: verifiedPhone,
      verified: true,
      sessionsRevoked,
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'That phone number is already linked to another PetWash account.',
        code: 'PHONE_ALREADY_IN_USE',
      });
    }
    logger.error('[ProfileSettings] Phone verification confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm phone verification' });
  }
});

router.get('/settings/phone/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firebaseUser = await admin.auth().getUser(uid);
    const [dbUser] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    // Truthfulness: the panel used to report ONLY Firebase. When the canonical
    // PetWash row disagreed (an unverified generic-PATCH write, or a canonical
    // write that silently matched 0 rows) the UI showed a number that receipts
    // and SMS were not actually going to. Report both, and say so when they
    // diverge, instead of picking one and calling it the truth.
    const firebasePhone = firebaseUser.phoneNumber ? normalizePhoneE164(firebaseUser.phoneNumber) : null;
    const canonicalPhone = dbUser?.phone ? normalizePhoneE164(dbUser.phone) : null;
    const inSync = firebasePhone === canonicalPhone;

    res.json({
      phone: firebasePhone,
      canonicalPhone,
      verified: !!firebasePhone,
      inSync,
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Phone status error:', error);
    res.status(500).json({ error: 'Failed to get phone status' });
  }
});

router.get('/settings/verification-status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firebaseUser = await admin.auth().getUser(uid);
    const [dbUser] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    const emailVerified = firebaseUser.emailVerified || dbUser?.emailVerified || false;
    const phoneVerified = !!firebaseUser.phoneNumber || dbUser?.phoneVerified || false;
    const isFullyVerified = emailVerified && phoneVerified;

    res.json({
      emailVerified,
      phoneVerified,
      isFullyVerified,
      canUploadPhoto: isFullyVerified,
      hasProfilePhoto: !!(dbUser?.profileImageUrl),
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Verification status error:', error);
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

router.post('/settings/profile/photo', (req, res, next) => {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Invalid file type' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const firebaseUser = await admin.auth().getUser(uid);
    const [dbUser] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    const emailVerified = firebaseUser.emailVerified || dbUser?.emailVerified || false;
    const phoneVerified = !!firebaseUser.phoneNumber || dbUser?.phoneVerified || false;

    if (!emailVerified || !phoneVerified) {
      return res.status(403).json({
        error: 'Verification required',
        message: 'You must verify both email and phone before uploading a profile photo',
        emailVerified,
        phoneVerified,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const bucket = admin.storage().bucket();
    const fileName = `profile-photos/${uid}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg'}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: uid,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    try {
      await file.makePublic();
    } catch (e) {
      logger.warn('[ProfileSettings] Could not make file public, using storage URL:', e);
    }

    if (dbUser) {
      await db.update(users).set({ profileImageUrl: publicUrl }).where(eq(users.id, uid));
    } else {
      await db.insert(users).values({
        id: uid,
        email: firebaseUser.email || '',
        firstName: firebaseUser.displayName?.split(' ')[0] || '',
        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: publicUrl,
      });
    }

    try {
      await admin.auth().updateUser(uid, { photoURL: publicUrl });
    } catch (e) {
      logger.warn('[ProfileSettings] Failed to update Firebase photoURL:', e);
    }

    try {
      const firestore = admin.firestore();
      await firestore.collection('profile_change_audit').add({
        userId: uid,
        changedFields: ['profilePhoto'],
        changeType: 'photo_upload',
        newPhotoUrl: publicUrl,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      });
    } catch (e) {
      logger.warn('[ProfileSettings] Failed to log photo audit:', e);
    }

    logger.info('[ProfileSettings] Profile photo uploaded for user:', uid);
    res.json({
      success: true,
      photoURL: publicUrl,
      message: 'Profile photo updated successfully',
    });
  } catch (error: any) {
    logger.error('[ProfileSettings] Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
});

router.delete('/settings/profile/photo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    const uid = decodedToken.uid;

    const [dbUser] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

    if (dbUser?.profileImageUrl) {
      try {
        const bucket = admin.storage().bucket();
        const urlParts = dbUser.profileImageUrl.split(`${bucket.name}/`);
        const relPath = urlParts[1];
        // Path-prefix guard: the DELETE key MUST live under this user's own
        // profile-photos/{uid}/ prefix. Without this a corrupted DB row (or
        // an SQL-injected profileImageUrl update elsewhere) would let an
        // authed request delete an arbitrary object anywhere in the bucket.
        const expectedPrefix = `profile-photos/${uid}/`;
        if (relPath && relPath.startsWith(expectedPrefix)) {
          await bucket.file(relPath).delete().catch(() => {});
        } else if (relPath) {
          logger.warn('[ProfileSettings] Refusing GCS delete outside user prefix', {
            uid, requested: relPath, expectedPrefix,
          });
        }
      } catch (e) {
        logger.warn('[ProfileSettings] Failed to delete old photo from storage:', e);
      }
    }

    await db.update(users).set({ profileImageUrl: null }).where(eq(users.id, uid));

    try {
      await admin.auth().updateUser(uid, { photoURL: '' });
    } catch (e) {
      logger.warn('[ProfileSettings] Failed to clear Firebase photoURL:', e);
    }

    logger.info('[ProfileSettings] Profile photo removed for user:', uid);
    res.json({ success: true, message: 'Profile photo removed' });
  } catch (error: any) {
    logger.error('[ProfileSettings] Photo delete error:', error);
    res.status(500).json({ error: 'Failed to remove profile photo' });
  }
});

export default router;
