import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { logger } from './logger';

/**
 * Attach a phone the caller has JUST PROVED they possess (OTP) to their
 * account — and, when the number is held by an orphan, reclaim it.
 *
 * Why (CEO, 2026-09-10): a phone sign-in months earlier had minted a
 * phone-only Firebase account (no email, no other provider, nothing attached).
 * Every later attempt to add that number to the real account answered
 * "already in use by another account" — a dead end the customer could not
 * resolve without an operator, because all three attach routes said
 * `in_use_by_other` without asking WHO the other was.
 *
 * Reclaim rule — safe by construction:
 *   the claimant proved possession of the number, and the number is the
 *   orphan's ONLY credential, so the claimant could already sign into the
 *   orphan; moving the number grants no access they did not have. The orphan
 *   is DISABLED, never deleted (an operator can still inspect it).
 *
 * An owner with an email, a password, or any non-phone provider is NOT an
 * orphan → `in_use_by_other`, exactly as before.
 */
export type PhoneClaimOutcome =
  | 'attached'
  | 'already_ours'
  | 'reclaimed_from_orphan'
  | 'in_use_by_other'
  | 'unresolved';

type MinimalAuth = {
  updateUser: (uid: string, props: Record<string, unknown>) => Promise<unknown>;
  getUserByPhoneNumber: (phone: string) => Promise<any>;
};

/**
 * Phone-only and e-mail-less, with POSITIVE evidence: a provider list that
 * exists, is non-empty, and contains only `phone`. Missing or empty evidence
 * is NOT an orphan — an unknown owner is refused, never reclaimed.
 */
export function isReclaimableOrphan(owner: any): boolean {
  if (!owner) return false;
  if (owner.email) return false;
  if (!Array.isArray(owner.providerData) || owner.providerData.length === 0) return false;
  const providers: string[] = owner.providerData.map((p: any) => p?.providerId).filter(Boolean);
  return providers.length === owner.providerData.length && providers.every((p) => p === 'phone');
}

export async function claimVerifiedPhone(
  auth: MinimalAuth,
  uid: string,
  phone: string,
  tag = '[PhoneClaim]',
): Promise<PhoneClaimOutcome> {
  try {
    await auth.updateUser(uid, { phoneNumber: phone });
    return 'attached';
  } catch (e: any) {
    if (e?.code !== 'auth/phone-number-already-exists') {
      logger.warn(`${tag} phone attach updateUser failed`, { uid, error: e?.message });
      return 'unresolved';
    }
  }

  let owner: any = null;
  try {
    owner = await auth.getUserByPhoneNumber(phone);
  } catch (probeErr: any) {
    logger.warn(`${tag} phone ownership probe unreadable`, { uid, error: probeErr?.message });
    return 'unresolved';
  }
  // The probe contradicts the error → nothing is established (retryable).
  if (!owner?.uid) return 'unresolved';
  if (owner.uid === uid) return 'already_ours';
  if (!isReclaimableOrphan(owner)) return 'in_use_by_other';

  // Reclaim: release from the orphan (both stores), disable it, attach to the claimant.
  try {
    await auth.updateUser(owner.uid, { phoneNumber: null });
    await auth.updateUser(owner.uid, { disabled: true });
  } catch (releaseErr: any) {
    logger.error(`${tag} could not release the number from the orphan`, {
      uid, orphanUid: owner.uid, error: releaseErr?.message,
    });
    return 'unresolved';
  }
  try {
    await db
      .update(users)
      .set({ phone: null, phoneHash: null, phoneVerified: false } as any)
      .where(eq(users.id, owner.uid));
  } catch (pgErr: any) {
    // Firebase owns phone identity; Postgres mirrors it. Loud, but not fatal.
    logger.error(`${tag} orphan row not cleared in Postgres`, { orphanUid: owner.uid, error: pgErr?.message });
  }
  try {
    await auth.updateUser(uid, { phoneNumber: phone });
  } catch (retryErr: any) {
    logger.error(`${tag} attach after reclaim failed`, { uid, orphanUid: owner.uid, error: retryErr?.message });
    return 'unresolved';
  }
  logger.warn(`${tag} phone reclaimed from a phone-only orphan account`, {
    uid,
    orphanUid: owner.uid,
    orphanCreated: owner.metadata?.creationTime ?? null,
    orphanDisabled: true,
  });
  return 'reclaimed_from_orphan';
}
