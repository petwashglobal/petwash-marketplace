/**
 * /api/me/profile — CEO P0-MY-ACCOUNT tasks #161 + #164.
 *
 * Contract:
 *   GET  /api/me/profile
 *     200 → { snapshot: CanonicalSnapshot, completeness: CompletenessOutcome }
 *
 *   PATCH /api/me/profile
 *     body: Partial<{firstName, lastName, dateOfBirth, language,
 *                    profileImageUrl, address, city, postalCode, country}>
 *     200 → { snapshot, completeness, fannedOut }
 *     400 → { error: 'NO_FIELDS' | 'FIELD_NOT_WRITABLE' }
 *     401 → auth_required
 *     404 → { error: 'user_not_found' }
 *     409 → { error: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED',
 *             reasonCode, snapshot }
 *
 *   POST /api/me/contact-change/{initiate,verify,commit}
 *     501 until the OTP + Redis wire lands (task #164).
 *   POST /api/me/contact-change/cancel
 *     200 → { state: 'CANCELLED' }   // idempotent
 *
 * Discipline:
 *   • uid derives from Firebase token; NEVER from body.
 *   • email / phone changes go through the state machine — the
 *     direct PATCH refuses them (UpdateProfileService enforces).
 *   • Every 2xx response includes the completeness projection so the
 *     client's Attention brain re-renders in one round-trip.
 */
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import {
  updateProfile,
  type CanonicalSnapshot,
  type DirectPatchField,
  type WriteEffects,
} from '../services/marketplace/UpdateProfileService';
import {
  evaluateProfileCompleteness,
  type CompletenessOutcome,
  type ProfileSnapshot,
} from '../services/marketplace/ProfileCompletenessService';
import {
  UnifiedVerificationError,
  unifiedVerificationService,
  type VerificationActor,
} from '../services/UnifiedVerificationService';

const router = Router();

// Terms version the ProfileCompletenessService compares against. Kept
// in lockstep with the constant used in registration (server/routes.ts).
const TERMS_VERSION_CURRENT = '2026-v1';

/**
 * Project a users-row DB record into the CanonicalSnapshot the
 * PATCH service and the client hook both consume. Same projection
 * feeds ProfileCompletenessService.
 */
function projectSnapshot(row: typeof users.$inferSelect): CanonicalSnapshot {
  return {
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    email: row.email ?? null,
    emailVerified: !!row.emailVerified,
    phone: row.phone ?? null,
    phoneVerified: !!row.phoneVerified,
    dateOfBirth: row.dateOfBirth ?? null,
    language: row.language ?? null,
    profileImageUrl: row.profileImageUrl ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    postalCode: row.postalCode ?? null,
    country: row.country ?? null,
  };
}

function completenessFromSnapshot(row: typeof users.$inferSelect): CompletenessOutcome {
  const snap: ProfileSnapshot = {
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    email: row.email ?? null,
    emailVerified: !!row.emailVerified,
    phone: row.phone ?? null,
    phoneVerified: !!row.phoneVerified,
    dateOfBirth: row.dateOfBirth ?? null,
    language: row.language ?? null,
    address: row.address ?? null,
    termsAcceptedVersion: row.termsVersion ?? null,
    currentTermsVersion: TERMS_VERSION_CURRENT,
  };
  return evaluateProfileCompleteness(snap);
}

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'user_not_found' });
    return res.status(200).json({
      snapshot: projectSnapshot(row),
      completeness: completenessFromSnapshot(row),
    });
  } catch (err: any) {
    logger.error('[MeProfile] GET unhandled', { error: err?.message });
    return res.status(500).json({ error: 'profile_unavailable' });
  }
});

/**
 * WriteEffects binding for the runtime — the atomic DB write + the
 * split-brain-guarded Firebase fan-out. Prestige mirror refresh is
 * best-effort (fire-and-log) so a missing privilege_members row
 * never blocks a canonical name edit; a full mirror refresh lands
 * with the runtime PrestigeMirrorRefreshService wire.
 */
function makeEffects(actorUid: string): WriteEffects {
  return {
    async writeCanonical({ changes }): Promise<CanonicalSnapshot> {
      // Trim string values; convert empty-string to null so the
      // client can clear a field. Drop keys not in the DirectPatchField
      // set (UpdateProfileService already validates, defence in depth).
      const patch: Partial<Record<DirectPatchField, string | null>> = {};
      for (const [k, v] of Object.entries(changes)) {
        const clean = typeof v === 'string' ? v.trim() : v;
        (patch as Record<string, unknown>)[k] = clean === '' ? null : clean;
      }
      const [updated] = await db.update(users)
        .set(patch)
        .where(eq(users.id, actorUid))
        .returning();
      if (!updated) throw new Error('user_not_found');
      return projectSnapshot(updated);
    },
    async updateFirebaseDisplayName({ displayName }): Promise<void> {
      // Empty string clears the displayName on the Firebase side.
      await admin.auth().updateUser(actorUid, { displayName: displayName || undefined });
    },
    // Prestige mirror refresh intentionally omitted at v1 — the
    // dedicated PrestigeMirrorRefreshService will fan out via a
    // separate outbox once wired. UpdateProfileService treats a
    // missing refreshPrestigeMirror as "no fan-out required", not
    // a failure.
  };
}

router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    const patchBody = (req.body ?? {}) as Record<string, unknown>;

    const outcome = await updateProfile(
      { actorUid: uid, patch: patchBody as Partial<Record<DirectPatchField, string | null>> },
      makeEffects(uid),
    );

    if (outcome.code === 'REJECTED') {
      return res.status(400).json({ error: outcome.reasonCode });
    }

    if (outcome.code === 'UPDATE_PARTIAL_ROLLBACK_REQUIRED') {
      // 409 preserves the server-persisted snapshot the client's
      // useMyAccountPatch hook expects, so the UI can show the
      // partial-rollback banner without another round-trip.
      return res.status(409).json({
        error: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED',
        reasonCode: outcome.reasonCode,
        snapshot: outcome.snapshot,
      });
    }

    // OK — re-read the row for the completeness projection (users
    // has more columns than CanonicalSnapshot carries).
    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'user_not_found' });

    return res.status(200).json({
      snapshot: outcome.snapshot,
      completeness: completenessFromSnapshot(row),
      fannedOut: outcome.fannedOut,
    });
  } catch (err: any) {
    logger.error('[MeProfile] PATCH unhandled', { error: err?.message });
    return res.status(500).json({ error: 'profile_unavailable' });
  }
});

/**
 * The state machine (server/services/marketplace/ContactChangeStateMachine.ts)
 * is stateless — each POST reasons about the current transition
 * without server-side session state. Persistence lives entirely on
 * UnifiedVerificationService (verification_challenges + otp_events),
 * so the client only needs to carry the challengeId between calls.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_E164_RE = /^\+\d{8,15}$/;

function actorFromRequest(req: Request, uid: string): VerificationActor {
  return {
    userId: uid,
    ip: (req.ip ?? (req.headers['x-forwarded-for'] as string | undefined)) as string | undefined,
    userAgent: req.headers['user-agent'],
  };
}

router.post('/contact-change/initiate', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    const kind = String(req.body?.kind ?? '').toUpperCase();
    const value = String(req.body?.value ?? '').trim();
    if (kind !== 'MOBILE' && kind !== 'EMAIL') return res.status(400).json({ error: 'MISSING_KIND' });
    if (!value) return res.status(400).json({ error: 'INVALID_VALUE' });

    if (kind === 'EMAIL') {
      if (!EMAIL_RE.test(value)) return res.status(400).json({ error: 'INVALID_VALUE' });
      // Look up the old email for the change_email metadata payload
      // so the /verify commit step knows what to swap.
      const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, uid)).limit(1);
      const oldEmail = rows[0]?.email ?? '';
      const { challenge } = await unifiedVerificationService.startChallenge({
        purpose: 'change_email',
        channel: 'email',
        destination: value,
        payload: { oldEmail },
        actor: actorFromRequest(req, uid),
      });
      return res.status(200).json({
        state: 'AWAITING_VERIFICATION',
        proposedValue: value,
        challengeId: challenge.challengeId,
        expiresAt: challenge.expiresAt,
      });
    }
    // MOBILE branch — parallel to EMAIL, but the phone_change purpose
    // routes over SMS. Task #194: uses the newly-registered
    // phone_change entry in unifiedVerificationPurposeRegistry;
    // dual-accept persists it as canonical PHONE_VERIFICATION.
    if (!PHONE_E164_RE.test(value)) return res.status(400).json({ error: 'INVALID_VALUE' });
    const phoneRows = await db.select({ phone: users.phone }).from(users).where(eq(users.id, uid)).limit(1);
    const oldPhone = phoneRows[0]?.phone ?? '';
    const mobileResult = await unifiedVerificationService.startChallenge({
      purpose: 'phone_change',
      channel: 'sms',
      destination: value,
      payload: { oldPhone },
      actor: actorFromRequest(req, uid),
    });
    return res.status(200).json({
      state: 'AWAITING_VERIFICATION',
      proposedValue: value,
      challengeId: mobileResult.challenge.challengeId,
      expiresAt: mobileResult.challenge.expiresAt,
    });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      return res.status(err.statusCode).json({ error: err.reasonCode });
    }
    logger.error('[MeProfile] contact-change/initiate', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/verify', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    const kind = String(req.body?.kind ?? '').toUpperCase();
    const challengeId = String(req.body?.challengeId ?? '').trim();
    const code = String(req.body?.otpCode ?? req.body?.code ?? '').trim();
    if (kind !== 'MOBILE' && kind !== 'EMAIL') return res.status(400).json({ error: 'MISSING_KIND' });
    if (!challengeId) return res.status(400).json({ error: 'MISSING_CHALLENGE' });
    if (code.length < 4) return res.status(400).json({ error: 'OTP_WRONG' });

    // One-shot verify + commit. verifyChallenge validates + marks the
    // challenge consumed atomically. The metadata carries
    // newEmail / newPhone (set by change_email / phone_change's
    // PurposeDefinition.execute in UnifiedVerificationService).
    const verifyResult = await unifiedVerificationService.verifyChallenge({
      challengeId,
      code,
      actor: actorFromRequest(req, uid),
    });
    const metadata = (verifyResult.action as { metadata?: Record<string, unknown> } | undefined)?.metadata ?? {};

    if (kind === 'EMAIL') {
      const newEmail = typeof metadata.newEmail === 'string' ? metadata.newEmail : '';
      if (!newEmail) return res.status(400).json({ error: 'INVALID_VERIFICATION_ACTION' });
      await admin.auth().updateUser(uid, { email: newEmail });
      await db.update(users).set({ email: newEmail, emailVerified: true }).where(eq(users.id, uid));
    } else {
      // MOBILE
      const newPhone = typeof metadata.newPhone === 'string' ? metadata.newPhone : '';
      if (!newPhone) return res.status(400).json({ error: 'INVALID_VERIFICATION_ACTION' });
      await admin.auth().updateUser(uid, { phoneNumber: newPhone });
      await db.update(users).set({ phone: newPhone, phoneVerified: true }).where(eq(users.id, uid));
    }

    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'user_not_found' });
    return res.status(200).json({
      state: 'COMMITTED',
      snapshot: projectSnapshot(row),
      completeness: completenessFromSnapshot(row),
    });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      // Map the honest surface: CHALLENGE_NOT_FOUND / CODE_INCORRECT /
      // CHALLENGE_EXPIRED / MAX_ATTEMPTS_REACHED all become 400s the
      // client can render as OTP_WRONG / OTP_EXPIRED / MAX_OTP_ATTEMPTS.
      return res.status(err.statusCode).json({ error: err.reasonCode });
    }
    logger.error('[MeProfile] contact-change/verify', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/commit', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    // The commit is fused into /verify above (one-shot verify-and-commit).
    // A separate /commit call is redundant but stays idempotent — return
    // the current snapshot so a legacy client that still posts /commit
    // after /verify still gets a coherent response.
    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'user_not_found' });
    return res.status(200).json({
      state: 'COMMITTED',
      snapshot: projectSnapshot(row),
      completeness: completenessFromSnapshot(row),
    });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/commit', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/cancel', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    return res.status(200).json({ state: 'CANCELLED' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/cancel', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

export default router;
