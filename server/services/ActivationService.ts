/**
 * ActivationService — Customer account activation state machine.
 *
 * PR-AUTH-IDENTITY-1 (MASTER AUTH CONTRACT): activation requires BOTH
 * verified contacts (phone + email). Behind an env flag for a safe
 * rollout so existing single-contact "active" users are not silently
 * demoted while PR-AUTH-SIGNUP-2 / PR-AUTH-CONTACTS-3 land the client
 * flows that guarantee both contacts every time.
 *
 *   AUTH_REQUIRE_BOTH_CONTACTS = 'true'  → STRICT: NEW activation
 *                                          requires phoneVerified AND
 *                                          emailVerified. Contract-
 *                                          compliant end state.
 *   (unset / any other value)            → LEGACY: EITHER contact
 *                                          is enough. Kept as the
 *                                          default so a deploy of
 *                                          just this PR does not
 *                                          strand users mid-flow.
 *
 * Regardless of the flag, existing rows already at `activationStatus =
 * 'active'` are NEVER demoted by a re-read — they were set active
 * legitimately under the old contract and remain grandfathered. Only
 * the FORWARD transition (draft/*_verified → active) is affected.
 *
 * States:
 *   draft → mobile_verified → active   (legacy: email-optional; strict: needs email too)
 *   draft → email_verified  → active   (legacy: phone-optional; strict: needs phone too)
 *
 * On activation:
 *   - accountActivatedAt written
 *   - wallet shell seeded (getOrCreateWallet)
 *   - loyalty profile seeded (insert if not exists)
 *   - ACCOUNT_ACTIVATED event published
 *   - LOYALTY_JOINED event published
 *   - WALLET_CREATED event published
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { users, verificationTokens } from '../../shared/schema';
import { loyaltyProfiles, pointsTransactions } from '../../shared/schema-loyalty';
import { walletService } from './WalletService';
import { eventPublisher } from './EventPublisher';
import { DomainEventType } from '../../shared/events';
import { logger } from '../lib/logger';

export type ActivationStatus =
  | 'draft'
  | 'mobile_verified'
  | 'email_verified'
  | 'active'
  | 'suspended'
  | 'deleted';

export interface ActivationState {
  userId: string;
  activationStatus: ActivationStatus;
  mobileVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  accountActivatedAt: Date | null;
  acceptedTermsAt: Date | null;
  missingSteps: ('mobile' | 'email')[];
  isFullyActive: boolean;
}

/**
 * Toggle: when true, activation requires BOTH verified contacts
 * (MASTER AUTH contract). When false (default), the pre-existing
 * one-of-two rule is preserved for a safe rollout.
 */
export function isBothContactsRequired(): boolean {
  return (process.env.AUTH_REQUIRE_BOTH_CONTACTS || '').toLowerCase() === 'true';
}

function computeStatus(
  mobileVerifiedAt: Date | null,
  emailVerifiedAt: Date | null,
  currentStatus: string
): ActivationStatus {
  if (currentStatus === 'suspended' || currentStatus === 'deleted') {
    return currentStatus as ActivationStatus;
  }

  // Grandfathering: an already-active row stays active regardless of the flag.
  // We NEVER demote existing users when the flag flips on; the intent is to
  // require both for NEW forward transitions only.
  if (currentStatus === 'active') return 'active';

  const strict = isBothContactsRequired();
  if (strict) {
    if (mobileVerifiedAt && emailVerifiedAt) return 'active';
    if (mobileVerifiedAt) return 'mobile_verified';
    if (emailVerifiedAt) return 'email_verified';
    return 'draft';
  }

  // Legacy pre-MASTER-AUTH-contract behaviour (default): ONE verified contact
  // is enough. Preserved so a solo deploy of PR-AUTH-IDENTITY-1 does not
  // strand every signup that hasn't yet completed the second contact.
  if (mobileVerifiedAt && emailVerifiedAt) return 'active';
  if (mobileVerifiedAt || emailVerifiedAt) return 'active';
  return 'draft';
}

/**
 * Mark mobile as verified for a user.
 * Writes mobileVerifiedAt and advances activationStatus.
 * If email is already verified → triggers full activation.
 */
export async function markMobileVerified(userId: string): Promise<ActivationState> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`[Activation] User not found: ${userId}`);

  // Short-circuit only when BOTH halves are already recorded. Checking the
  // timestamp alone let a drifted row (timestamp set, phone_verified boolean
  // false — from any bare write) stay unhealed forever: the login bounce reads
  // the boolean, the activation gate reads the timestamp, and they disagreed.
  if (user.mobileVerifiedAt && user.phoneVerified) {
    logger.info('[Activation] Mobile already verified — idempotent', { userId });
    return getActivationState(userId);
  }

  const now = new Date();
  const newStatus = computeStatus(now, user.emailVerifiedAt ?? null, user.activationStatus ?? 'draft');

  await db.update(users)
    .set({
      mobileVerifiedAt: now,
      phoneVerified: true,
      activationStatus: newStatus,
      ...(newStatus === 'active' ? { accountActivatedAt: now } : {}),
    })
    .where(eq(users.id, userId));

  logger.info('[Activation] Mobile verified', { userId, newStatus });

  await eventPublisher.publishEvent(DomainEventType.MOBILE_VERIFIED, { userId }, {
    aggregateType: 'user', aggregateId: userId, userId,
  });

  if (newStatus === 'active') {
    await _onFullActivation(userId, user.email ?? undefined);
  }

  return getActivationState(userId);
}

/**
 * Mark email as verified for a user.
 * Writes emailVerifiedAt and acceptedTermsAt, advances activationStatus.
 * If mobile is already verified → triggers full activation.
 */
export async function markEmailVerified(
  userId: string,
  opts: { acceptTerms?: boolean } = {}
): Promise<ActivationState> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`[Activation] User not found: ${userId}`);

  // Short-circuit only when BOTH halves are recorded (timestamp AND boolean) —
  // see markMobileVerified: a timestamp-only row must be allowed to heal its
  // email_verified boolean so the login bounce and the activation gate agree.
  if (user.emailVerifiedAt && user.emailVerified) {
    logger.info('[Activation] Email already verified — idempotent', { userId });
    return getActivationState(userId);
  }

  const now = new Date();
  const newStatus = computeStatus(user.mobileVerifiedAt ?? null, now, user.activationStatus ?? 'draft');

  await db.update(users)
    .set({
      emailVerifiedAt: now,
      emailVerified: true,
      ...(opts.acceptTerms ? { acceptedTermsAt: now } : {}),
      activationStatus: newStatus,
      ...(newStatus === 'active' ? { accountActivatedAt: now } : {}),
    })
    .where(eq(users.id, userId));

  logger.info('[Activation] Email verified', { userId, newStatus });

  await eventPublisher.publishEvent(DomainEventType.EMAIL_ACTIVATED, { userId }, {
    aggregateType: 'user', aggregateId: userId, userId,
  });

  if (newStatus === 'active') {
    await _onFullActivation(userId, user.email ?? undefined);
  }

  return getActivationState(userId);
}

/**
 * Get current activation state for a user.
 */
export async function getActivationState(userId: string): Promise<ActivationState> {
  const [user] = await db.select({
    activationStatus: users.activationStatus,
    mobileVerifiedAt: users.mobileVerifiedAt,
    emailVerifiedAt: users.emailVerifiedAt,
    accountActivatedAt: users.accountActivatedAt,
    acceptedTermsAt: users.acceptedTermsAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) throw new Error(`[Activation] User not found: ${userId}`);

  const mobileVerifiedAt = user.mobileVerifiedAt ?? null;
  const emailVerifiedAt = user.emailVerifiedAt ?? null;
  // PR-AUTH-IDENTITY-1: isFullyActive tracks computeStatus semantics.
  //   - suspended / deleted → always false.
  //   - existing 'active' rows (grandfathered) → always true.
  //   - STRICT mode → both contacts required.
  //   - LEGACY mode → either contact is enough.
  // The stored status is authoritative for grandfathering; the timestamps
  // drive the forward derivation for still-activating rows.
  const suspended = user.activationStatus === 'suspended' || user.activationStatus === 'deleted';
  const strict = isBothContactsRequired();
  const isFullyActive = suspended
    ? false
    : user.activationStatus === 'active'
      ? true
      : strict
        ? (mobileVerifiedAt != null && emailVerifiedAt != null)
        : (mobileVerifiedAt != null || emailVerifiedAt != null);

  const missingSteps: ('mobile' | 'email')[] = [];
  if (!mobileVerifiedAt) missingSteps.push('mobile');
  if (!emailVerifiedAt) missingSteps.push('email');

  return {
    userId,
    activationStatus: (user.activationStatus ?? 'draft') as ActivationStatus,
    mobileVerifiedAt,
    emailVerifiedAt,
    accountActivatedAt: user.accountActivatedAt ?? null,
    acceptedTermsAt: user.acceptedTermsAt ?? null,
    missingSteps,
    isFullyActive,
  };
}

/**
 * Internal: runs once when both mobile + email are confirmed.
 * Seeds wallet, seeds loyalty profile, publishes domain events.
 */
async function _onFullActivation(userId: string, email?: string): Promise<void> {
  logger.info('[Activation] Full activation triggered', { userId });

  // 1. Seed wallet (idempotent — getOrCreate)
  let wallet: { walletId: string } | null = null;
  try {
    wallet = await walletService.getOrCreateWallet(userId);
    logger.info('[Activation] Wallet seeded', { userId, walletId: wallet.walletId });
    await eventPublisher.publishEvent(DomainEventType.WALLET_CREATED, { userId, walletId: wallet.walletId }, {
      aggregateType: 'wallet', aggregateId: wallet.walletId, userId,
    });
  } catch (err: any) {
    logger.error('[Activation] Wallet seed failed — continuing activation', { userId, error: err.message });
  }

  // 2. Seed loyalty profile (idempotent — insert if not exists)
  try {
    const [existing] = await db.select({ userId: loyaltyProfiles.userId })
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);

    if (!existing) {
      const JOIN_BONUS_POINTS = 100;

      await db.insert(loyaltyProfiles).values({
        userId,
        tier: 'bronze',
        tierSince: new Date(),
        tierProgress: 0,
        tierThreshold: 1000,
        points: JOIN_BONUS_POINTS,
        lifetimePoints: JOIN_BONUS_POINTS,
        xp: 0,
        level: 1,
        totalWashes: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageWashInterval: 21,
        isVip: false,
        conciergeAccess: false,
        prioritySupport: false,
      });

      await db.insert(pointsTransactions).values({
        userId,
        type: 'earned',
        amount: JOIN_BONUS_POINTS,
        balance: JOIN_BONUS_POINTS,
        source: 'signup',
        description: 'Join bonus — welcome to PetWash™ loyalty program',
      });

      logger.info('[Activation] Loyalty profile seeded with join bonus', { userId, joinBonus: JOIN_BONUS_POINTS });

      await eventPublisher.publishEvent(DomainEventType.LOYALTY_JOINED, {
        userId,
        tier: 'bronze',
        joinedAt: new Date().toISOString(),
      }, {
        aggregateType: 'loyalty', aggregateId: userId, userId,
      });
    }
  } catch (err: any) {
    logger.error('[Activation] Loyalty seed failed — continuing activation', { userId, error: err.message });
  }

  // 3. Publish ACCOUNT_ACTIVATED
  await eventPublisher.publishEvent(DomainEventType.ACCOUNT_ACTIVATED, {
    userId,
    email,
    activatedAt: new Date().toISOString(),
  }, {
    aggregateType: 'user', aggregateId: userId, userId,
  });

  logger.info('[Activation] Full activation complete ✅', { userId });
}
