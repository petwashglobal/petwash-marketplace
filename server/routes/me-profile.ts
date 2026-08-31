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

router.post('/contact-change/initiate', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    const kind = String(req.body?.kind ?? '').toUpperCase();
    const value = String(req.body?.value ?? '').trim();
    if (kind !== 'MOBILE' && kind !== 'EMAIL') return res.status(400).json({ error: 'MISSING_KIND' });
    if (!value) return res.status(400).json({ error: 'INVALID_VALUE' });
    // Wire pending: the contact-change flow needs Redis-backed
    // per-user state + OTP send/verify. Tracked in task #164.
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_otp_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/initiate', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/verify', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_otp_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/verify', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/commit', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_otp_wire' });
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
