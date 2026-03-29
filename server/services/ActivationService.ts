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
import { loyaltyProfiles } from '../../shared/schema-loyalty';
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
  if (mobileVerifiedAt && emailVerifiedAt) return 'active';
  if (mobileVerifiedAt && !emailVerifiedAt) return 'mobile_verified';
  if (!mobileVerifiedAt && emailVerifiedAt) return 'email_verified';
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

  if (user.mobileVerifiedAt) {
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

  if (user.emailVerifiedAt) {
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
  const isFullyActive = user.activationStatus === 'active';

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
      await db.insert(loyaltyProfiles).values({
        userId,
        tier: 'bronze',
        tierSince: new Date(),
        tierProgress: 0,
        tierThreshold: 1000,
        points: 0,
        lifetimePoints: 0,
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
      logger.info('[Activation] Loyalty profile seeded', { userId });

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
