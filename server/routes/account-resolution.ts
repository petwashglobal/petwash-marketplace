/**
 * Lane A — server-authoritative account-resolution endpoint.
 *
 * CEO FLY MODE II — AUTH CONVERSION P0 (2026-08-29).
 *
 *   GET /api/auth/account-resolution
 *
 * The ONE surface the progressive signup client calls after a
 * successful auth exchange. Returns the strict shape the client's
 * state machine (client/src/lib/progressiveSignupState.ts) consumes:
 *
 *   {
 *     isNewUser: boolean,
 *     profileState: 'complete' | 'incomplete',
 *     requiredActions: RequiredAction[],
 *     destination: string
 *   }
 *
 * Rules (CEO §9):
 *   • The client MUST NOT guess isNewUser from a missing field, a
 *     Firebase error string, or whether a password worked. It waits
 *     on this response.
 *   • The order of requiredActions is authoritative — the client
 *     renders each screen in the returned order.
 *   • The destination is server-owned. Post-login navigation on the
 *     client reads this value.
 */
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../shared/schema';
import { logger } from '../lib/logger';

export type RequiredAction =
  | 'mobile_verification'
  | 'email_verification'
  | 'first_name'
  | 'last_name'
  | 'date_of_birth'
  | 'terms_acceptance';

export interface AccountResolutionDTO {
  isNewUser: boolean;
  profileState: 'complete' | 'incomplete';
  requiredActions: RequiredAction[];
  destination: string;
}

/**
 * Derive the ordered required-actions list from a users row snapshot.
 *
 * Order matters — it's the sequence the client renders. Verification
 * comes first (identity), then names, then DOB, then terms. If a
 * caller changes this order, the client's "1 of N" step numbering
 * changes with it — that is intentional.
 */
export function computeRequiredActions(row: {
  emailVerified: boolean | null;
  phoneVerified: boolean | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  termsAcceptedAt: Date | null;
  email: string | null;
  phoneE164: string | null;
}): RequiredAction[] {
  const actions: RequiredAction[] = [];

  // Verification — must confirm both contacts before touching profile.
  if (!row.phoneVerified) actions.push('mobile_verification');
  if (row.email && !row.emailVerified) actions.push('email_verification');

  // Name — only ask if MISSING. Google/Apple usually supply this.
  const first = (row.firstName ?? '').trim();
  const last = (row.lastName ?? '').trim();
  if (first.length < 2) actions.push('first_name');
  if (last.length < 2) actions.push('last_name');

  // DOB — required for age gating. Sentinel '0001-01-01' means "not
  // yet set" (matches the provider-applicants draft convention).
  const dob = (row.dateOfBirth ?? '').trim();
  if (!dob || dob === '0001-01-01') actions.push('date_of_birth');

  // Terms — required once. The Israeli §17a discipline: cannot store
  // an implicit acceptance.
  if (!row.termsAcceptedAt) actions.push('terms_acceptance');

  return actions;
}

const router = Router();

router.get('/account-resolution', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [row] = await db
      .select({
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        firstName: users.firstName,
        lastName: users.lastName,
        dateOfBirth: users.dateOfBirth,
        termsAcceptedAt: users.termsAcceptedAt,
        email: users.email,
        phoneE164: users.phoneE164,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    if (!row) {
      // The Firebase user exists but no PetWash users row — treat
      // as new. Client will render the METHOD → PROFILE_COMPLETION
      // flow with all fields missing. The upsert typically runs
      // during the session exchange, so this is rare; we handle it
      // anyway for robustness.
      const dto: AccountResolutionDTO = {
        isNewUser: true,
        profileState: 'incomplete',
        requiredActions: [
          'mobile_verification',
          'first_name',
          'last_name',
          'date_of_birth',
          'terms_acceptance',
        ],
        destination: '/pet-parent/home',
      };
      return res.json(dto);
    }

    // "New" = created less than 10 minutes ago AND still missing
    // profile fields. This distinguishes a returning-user who never
    // finished their profile (their re-arrival IS new-user-shaped
    // for the UX but should NOT stamp isNewUser:true and re-run all
    // greetings). A stricter definition is welcome once the server
    // stamps its own signupCompletedAt column.
    const now = Date.now();
    const created = row.createdAt ? new Date(row.createdAt as any).getTime() : 0;
    const withinFirstMinutes = created && (now - created) < 10 * 60 * 1000;
    const requiredActions = computeRequiredActions(row as any);
    const profileState = requiredActions.length === 0 ? 'complete' : 'incomplete';

    const dto: AccountResolutionDTO = {
      isNewUser: !!withinFirstMinutes && profileState === 'incomplete',
      profileState,
      requiredActions,
      // Placeholder — the canonical customer destination. In a
      // multi-role expansion, the same helper post-login uses would
      // land here, keyed by capability.
      destination: '/pet-parent/home',
    };
    return res.json(dto);
  } catch (err: any) {
    logger.error('[AccountResolution] handler failed', { error: err?.message });
    return res.status(500).json({ error: 'Failed to resolve account state' });
  }
});

export default router;
