/**
 * ActivationService — Customer account activation state machine
 *
 * States:
 *   draft → mobile_verified → active   (if email already verified)
 *   draft → email_verified  → active   (if mobile already verified)
 *   draft → mobile_verified | email_verified → active (both required)
 *
 * Active requires BOTH:
 *   - mobileVerifiedAt is set
 *   - emailVerifiedAt is set
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

function computeStatus(
  mobileVerifiedAt: Date | null,
  emailVerifiedAt: Date | null,
  currentStatus: string
): ActivationStatus {
  if (currentStatus === 'suspended' || currentStatus === 'deleted') {
    return currentStatus as ActivationStatus;
  }
  // ONE verified contact is enough to activate. This matches the CEO "one contact
  // is enough" signup rule (SignUpLuxury contactMode is phone-OR-email). Requiring
  // BOTH permanently locked out every normal signup — a phone-only user sat at
  // 'mobile_verified' forever with no way to reach the product. The unverified
  // second channel is now an optional post-signup nudge, not a gate. (2026-07-31)
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
  // Usable = at least ONE verified contact, and not suspended/deleted. Derived
  // from the actual verified timestamps (not the stored status string) so it
  // AUTO-HEALS the users who were frozen at 'mobile_verified'/'email_verified'
  // by the old both-required rule — no backfill migration needed. Matches the
  // "one contact is enough" rule now in computeStatus. (2026-07-31)
  const suspended = user.activationStatus === 'suspended' || user.activationStatus === 'deleted';
  const isFullyActive = !suspended && (mobileVerifiedAt != null || emailVerifiedAt != null);

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

  // 4. Sync to SUMIT (fire-and-forget, feature-flagged, per CEO 2026-08-16
  // SUMIT full-service adoption plan — docs/design/2026-08-16-sumit-full-
  // service-adoption.md). Signup MUST NOT slow down or fail here. The sync
  // uses SUMIT's SearchMode:"Automatic" so a retry cannot duplicate the
  // customer. Feature flag SUMIT_CUSTOMER_SYNC_ENABLED gates the call —
  // defaults to OFF; when off the function is inert.
  try {
    const { fireAndForgetSync } = await import('./SumitCustomerService');
    // Read minimal identity for the SUMIT customer record. Fall back to
    // conservative defaults — SUMIT accepts them and the record can be
    // enriched later. Never send national-id / bank / tax fields here.
    const [profile] = await db.select({
      email: users.email,
      phone: users.phone,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(eq(users.id, userId)).limit(1);
    const displayName = [profile?.firstName, profile?.lastName]
      .filter(Boolean).join(' ').trim() || 'PetWash Member';
    fireAndForgetSync(userId, {
      name: displayName,
      email: profile?.email ?? email,
      phone: profile?.phone ?? undefined,
    }, 'signup');
  } catch (err: any) {
    // Belt-and-braces: the fire-and-forget wrapper is designed not to throw,
    // but we still catch here so a bug in the sync module can never break
    // activation for a real user.
    logger.warn('[Activation] SUMIT customer sync dispatch failed (non-blocking)', {
      userId, error: err?.message,
    });
  }

  logger.info('[Activation] Full activation complete ✅', { userId });
}
