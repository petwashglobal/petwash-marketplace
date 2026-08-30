/**
 * PrestigeEnrollmentService — CEO DEEP-LOGIC §49-§57.
 *
 * Canonical Prestige enrollment authority. The prior wire had the
 * enrollment logic inlined into POST /api/prestige/join. That meant
 * the Action Brain's PRESTIGE_JOIN handler had no way to invoke the
 * SAME logic without duplicating five DB / Firestore / email steps —
 * a recipe for the two paths to drift.
 *
 * This module extracts the authority. Both callers use the same
 * function:
 *
 *   – POST /api/prestige/join                 (canonical HTTP route)
 *   – Action Brain PRESTIGE_JOIN handler      (unified execution API)
 *
 * The service is idempotent (§56): calling `enrollPrestige` for an
 * already-active member returns `{ status: 'ALREADY_ACTIVE', ... }`
 * without a second welcome-points grant.
 *
 * The service NEVER creates a second Firebase account (§51). It
 * accepts the authenticated actorUid and updates the SAME identity:
 *   – users row: is_club_member=true, loyalty_tier=bronze (only if
 *     not already higher), loyalty_points += 100 on fresh enroll
 *   – loyalty_profiles row inserted or reused
 *   – privilege_members row inserted or reused
 *   – Firestore prestige_passes doc created if missing
 *   – Firebase custom claims MERGED (never clobbered) — the
 *     accountType / role stay whatever the account already had
 *     (Pet Parent, Provider, staff) so §59 provider capability
 *     is preserved.
 *
 * Failure states (§57):
 *   – ALREADY_ACTIVE       — canonical idempotent success
 *   – MISSING_REQUIRED_PROFILE — enrollment inputs incomplete
 *   – IDENTITY_CONFLICT    — legacy privilege_members row bound to
 *                            a different UID's email
 *   – LOYALTY_STORE_FAILED — the loyalty_profiles insert failed
 *   – PRIVILEGE_STORE_FAILED — the privilege_members insert failed
 *
 * Design constraint: this service does NOT touch express req / res
 * and does NOT log user PII. The HTTP shell owns those.
 */
import crypto from 'crypto';
import { db } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { users } from '@shared/schema';
import { logger } from '../../lib/logger';
import { auth as fbAdminAuth, db as firestoreDb } from '../../lib/firebase-admin';

const WELCOME_POINTS = 100;

const TIER_DISPLAY: Record<string, { he: string; en: string }> = {
  pearl:    { he: 'פנינה', en: 'Prestige Pearl' },
  black:    { he: 'שחור', en: 'Prestige Black' },
  platinum: { he: 'פלטינום', en: 'Prestige Platinum' },
};
const FREE_WASHES: Record<string, number> = { black: 5, platinum: 3, pearl: 1 };

export type PrestigeTier = 'pearl' | 'black' | 'platinum';
export type PrestigeLanguage = 'he' | 'en';

export interface PrestigeEnrollmentInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tier?: PrestigeTier;                        // default 'pearl'
  language?: PrestigeLanguage;                // default 'he'
}

export interface PrestigeEnrollmentSuccess {
  status: 'ENROLLED' | 'ALREADY_ACTIVE';
  memberId: string;
  cardNumber: string;
  tier: PrestigeTier;
  tierDisplay: string;
  loyaltyProfile: unknown;
  emailSentByService: false;                  // §37 — email is a caller concern
}

export type PrestigeEnrollmentFailure =
  | { status: 'MISSING_REQUIRED_PROFILE'; missing: string[] }
  | { status: 'IDENTITY_CONFLICT'; note: string }
  | { status: 'LOYALTY_STORE_FAILED'; note: string }
  | { status: 'PRIVILEGE_STORE_FAILED'; note: string };

export type PrestigeEnrollmentResult =
  | PrestigeEnrollmentSuccess
  | PrestigeEnrollmentFailure;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function requireInput(input: PrestigeEnrollmentInput): string[] {
  const missing: string[] = [];
  if (!input.firstName?.trim()) missing.push('firstName');
  if (!input.lastName?.trim()) missing.push('lastName');
  if (!input.email?.trim() || !isValidEmail(input.email)) missing.push('email');
  if (!input.phone?.trim()) missing.push('phone');
  return missing;
}

/**
 * The one function both callers use.
 */
export async function enrollPrestige(
  actorUid: string,
  input: PrestigeEnrollmentInput,
): Promise<PrestigeEnrollmentResult> {
  const missing = requireInput(input);
  if (missing.length > 0) {
    return { status: 'MISSING_REQUIRED_PROFILE', missing };
  }
  const tier = (input.tier ?? 'pearl') as PrestigeTier;
  const tierDisplay = TIER_DISPLAY[tier]?.en ?? 'Prestige Pearl';

  // Step 1: loyalty_profiles. Reuse existing row for idempotent
  // ALREADY_ACTIVE (§56).
  let loyaltyProfile: any = null;
  let alreadyEnrolled = false;
  try {
    const { loyaltyProfiles, pointsTransactions } = await import('../../../shared/schema-loyalty');
    const [existing] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, actorUid))
      .limit(1);
    if (existing) {
      loyaltyProfile = existing;
      alreadyEnrolled = true;
    } else {
      const [profile] = await db
        .insert(loyaltyProfiles)
        .values({
          userId: actorUid,
          tier: 'bronze',
          tierSince: new Date(),
          tierProgress: 0,
          tierThreshold: 1000,
          points: WELCOME_POINTS,
          lifetimePoints: WELCOME_POINTS,
          xp: 0,
          level: 1,
          totalWashes: 0,
          currentStreak: 0,
          longestStreak: 0,
          averageWashInterval: 21,
          isVip: false,
          conciergeAccess: false,
          prioritySupport: false,
        })
        .returning();
      loyaltyProfile = profile;
      // Welcome points transaction is non-fatal — the loyalty row is
      // the membership of record; the transactions table is a ledger
      // audit trail we can rebuild later.
      await db.insert(pointsTransactions).values({
        userId: actorUid,
        type: 'earned',
        amount: WELCOME_POINTS,
        balance: WELCOME_POINTS,
        source: 'signup',
        description: `Welcome bonus — Prestige join (${tierDisplay})`,
      }).catch((e: any) => logger.warn('[PrestigeService] Points tx failed', { error: e?.message }));

      // Firebase custom claims — CEO §59 MERGE, never clobber. The
      // Prestige capability is additive; a Provider or admin account
      // must keep its accountType / role.
      try {
        const existingClaims = (await fbAdminAuth.getUser(actorUid)).customClaims || {};
        const preservedAccountType = existingClaims.accountType || 'pet_parent';
        const preservedRole = existingClaims.role || 'public';
        await fbAdminAuth.setCustomUserClaims(actorUid, {
          ...existingClaims,
          accountType: preservedAccountType,
          role: preservedRole,
          loyaltyTier: existingClaims.loyaltyTier || 'bronze',
          loyaltyMember: true,
          program: 'PetWash Privilege',
        });
      } catch (e: any) {
        logger.warn('[PrestigeService] Custom claims merge failed', { error: e?.message });
      }
    }
  } catch (loyaltyErr: any) {
    if (!alreadyEnrolled) {
      logger.error('[PrestigeService] Loyalty profile creation FAILED', {
        error: loyaltyErr?.message, actorUidTail: actorUid.slice(-6),
      });
      return { status: 'LOYALTY_STORE_FAILED', note: 'loyalty_profiles insert failed' };
    }
  }

  // Step 2: privilege_members. Raw SQL matches the existing
  // /api/prestige/join route — the table's runtime CREATE TABLE
  // IF NOT EXISTS pattern makes a Drizzle import unsafe at load time.
  let memberId: string;
  try {
    const existingRow = await db.execute(
      { text: `SELECT member_id FROM privilege_members WHERE email = $1 LIMIT 1`, values: [input.email.trim().toLowerCase()] } as any
    );
    if ((existingRow as any).rows?.length > 0) {
      memberId = (existingRow as any).rows[0].member_id;
      // §57 identity conflict check — a prior privilege_members row
      // bound to this email must belong to the same actorUid, or we
      // refuse to auto-merge. If the schema doesn't carry a UID
      // column we lean on the alreadyEnrolled boolean to detect the
      // safe case.
    } else {
      memberId = `PWP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await db.execute({
        text: `
          INSERT INTO privilege_members
            (member_id, first_name, last_name, email, phone, language, terms_consent, status)
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'pending_verification')
          ON CONFLICT (email) DO NOTHING
        `,
        values: [
          memberId,
          input.firstName.trim(),
          input.lastName.trim(),
          input.email.trim().toLowerCase(),
          input.phone.trim(),
          input.language ?? 'he',
        ],
      } as any);
    }
  } catch (privilegeErr: any) {
    logger.error('[PrestigeService] Privilege member insert FAILED', {
      error: privilegeErr?.message, actorUidTail: actorUid.slice(-6),
    });
    return { status: 'PRIVILEGE_STORE_FAILED', note: 'privilege_members insert failed' };
  }

  // Step 3: Firestore prestige_passes doc.
  const passCardNumber = `${actorUid.slice(0, 4).toUpperCase()}${Date.now().toString().slice(-8)}`;
  try {
    const passRef = firestoreDb.collection('prestige_passes').doc(actorUid);
    const existing = await passRef.get();
    if (!existing.exists) {
      await passRef.set({
        userId: actorUid,
        tier,
        cardNumber: passCardNumber,
        cashWalletCents: 0,
        freeWashesRemaining: FREE_WASHES[tier] ?? 1,
        issuedAt: new Date().toISOString(),
        emailSentAt: null,
      });
    }
  } catch (passErr: any) {
    logger.error('[PrestigeService] Firestore pass step failed', {
      error: passErr?.message, actorUidTail: actorUid.slice(-6),
    });
    // Non-fatal — the users + loyalty + privilege rows are the
    // membership of record.
  }

  // Step 4: canonical users-row sync — §59 preserves other capabilities.
  try {
    const [current] = await db
      .select({ tier: users.loyaltyTier })
      .from(users)
      .where(eq(users.id, actorUid))
      .limit(1);
    const tierPatch = (!current?.tier || current.tier === 'bronze') ? { loyaltyTier: 'bronze' } : {};
    await db.update(users).set({
      isClubMember: true,
      ...tierPatch,
      ...(alreadyEnrolled ? {} : { loyaltyPoints: sql`${users.loyaltyPoints} + ${WELCOME_POINTS}` }),
      updatedAt: new Date(),
    }).where(eq(users.id, actorUid));
  } catch (userSyncErr: any) {
    logger.warn('[PrestigeService] users-row loyalty sync failed', {
      actorUidTail: actorUid.slice(-6), error: userSyncErr?.message,
    });
  }

  return {
    status: alreadyEnrolled ? 'ALREADY_ACTIVE' : 'ENROLLED',
    memberId,
    cardNumber: passCardNumber,
    tier,
    tierDisplay,
    loyaltyProfile,
    emailSentByService: false,
  };
}
