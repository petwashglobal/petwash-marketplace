import Stripe from 'stripe';
import { db } from '../db';
import { providers, payouts } from '@shared/super-app-schema-v2';
import { contractorEarnings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

/**
 * Stripe Connect Service for Marketplace Payouts
 * 
 * Supports:
 * - Provider onboarding (Connect Express accounts)
 * - Account verification status checking
 * - Automated payouts to provider accounts
 * - Webhook handling for account/transfer events
 * 
 * Architecture:
 * - International providers: Stripe Connect (automatic payouts)
 * - Israeli providers: Bank transfer (separate flow)
 */

export interface CreateConnectAccountParams {
  providerId: number;
  email: string;
  businessName?: string;
  country: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface CreatePayoutParams {
  providerId: number;
  earningId: string;
  amount: number;
  currency: string;
  description: string;
}

/**
 * Create Stripe Connect Express account for provider
 */
export async function createConnectAccount(params: CreateConnectAccountParams) {
  try {
    const { providerId, email, businessName, country, returnUrl, refreshUrl } = params;

    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        providerId: providerId.toString(),
        platform: 'petwash-marketplace',
      },
    });

    await db
      .update(providers)
      .set({
        stripeConnectAccountId: account.id,
        stripeOnboardingComplete: false,
        payoutEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, providerId));

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    logger.info('[StripeConnect] Account created', {
      providerId,
      accountId: account.id,
      country,
    });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  } catch (error) {
    logger.error('[StripeConnect] Error creating account', { error });
    throw error;
  }
}

/**
 * Refresh onboarding link for incomplete account
 */
export async function refreshOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
) {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    logger.info('[StripeConnect] Onboarding link refreshed', { accountId });

    return {
      onboardingUrl: accountLink.url,
    };
  } catch (error) {
    logger.error('[StripeConnect] Error refreshing onboarding link', { error });
    throw error;
  }
}

/**
 * Check Stripe Connect account status
 */
export async function checkAccountStatus(accountId: string) {
  try {
    const account = await stripe.accounts.retrieve(accountId);

    const status = {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requiresAction: !account.details_submitted || !account.charges_enabled,
      requirements: account.requirements,
    };

    logger.info('[StripeConnect] Account status checked', {
      accountId,
      status,
    });

    return status;
  } catch (error) {
    logger.error('[StripeConnect] Error checking account status', { error });
    throw error;
  }
}

/**
 * Update provider record after successful onboarding
 */
export async function completeOnboarding(providerId: number) {
  try {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    if (!provider || !provider.stripeConnectAccountId) {
      throw new Error(`Provider ${providerId} not found or missing Stripe account`);
    }

    const accountStatus = await checkAccountStatus(provider.stripeConnectAccountId);

    if (!accountStatus.chargesEnabled || !accountStatus.payoutsEnabled) {
      throw new Error(
        `Provider ${providerId} Stripe account not fully enabled (charges: ${accountStatus.chargesEnabled}, payouts: ${accountStatus.payoutsEnabled})`
      );
    }

    await db
      .update(providers)
      .set({
        stripeOnboardingComplete: true,
        payoutEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, providerId));

    logger.info('[StripeConnect] Onboarding completed', {
      providerId,
      accountId: provider.stripeConnectAccountId,
    });

    return true;
  } catch (error) {
    logger.error('[StripeConnect] Error completing onboarding', { error });
    throw error;
  }
}

/**
 * Create payout to provider via Stripe Connect
 */
export async function createPayout(params: CreatePayoutParams) {
  try {
    const { providerId, earningId, amount, currency, description } = params;

    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (!provider.stripeConnectAccountId) {
      throw new Error(`Provider ${providerId} missing Stripe Connect account`);
    }

    if (!provider.stripeOnboardingComplete || !provider.payoutEnabled) {
      throw new Error(
        `Provider ${providerId} Stripe account not ready (onboarding: ${provider.stripeOnboardingComplete}, payouts: ${provider.payoutEnabled})`
      );
    }

    const amountCents = Math.round(amount * 100);

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      destination: provider.stripeConnectAccountId,
      description,
      metadata: {
        providerId: providerId.toString(),
        earningId,
        platform: 'petwash-marketplace',
      },
    });

    // Get booking ID from contractorEarnings
    const [earning] = await db
      .select()
      .from(contractorEarnings)
      .where(eq(contractorEarnings.earningId, earningId))
      .limit(1);

    if (!earning || !earning.bookingId) {
      throw new Error(`Earning ${earningId} not found or missing bookingId`);
    }

    const [payout] = await db
      .insert(payouts)
      .values({
        earningId,
        providerId,
        bookingId: earning.bookingId,
        payoutMethod: 'stripe_connect',
        stripeTransferId: transfer.id,
        amount: amount.toString(),
        platformFee: '0', // Already deducted in contractorEarnings
        netAmount: amount.toString(),
        currency,
        status: 'pending',
        processedAt: new Date(),
        metadata: {
          platform: 'petwash-marketplace',
          transferId: transfer.id,
        },
      })
      .returning();

    logger.info('[StripeConnect] Payout created', {
      providerId,
      earningId,
      amount,
      currency,
      transferId: transfer.id,
    });

    return {
      payoutId: payout.id,
      transferId: transfer.id,
      status: transfer.status,
    };
  } catch (error) {
    logger.error('[StripeConnect] Error creating payout', { error });
    throw error;
  }
}

/**
 * Handle Stripe Connect webhook events
 */
export async function handleWebhook(event: Stripe.Event) {
  try {
    logger.info('[StripeConnect] Webhook received', {
      type: event.type,
      id: event.id,
    });

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case 'transfer.created':
      case 'transfer.updated': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferEvent(transfer);
        break;
      }

      case 'transfer.failed': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferFailed(transfer);
        break;
      }

      default:
        logger.info('[StripeConnect] Unhandled webhook type', { type: event.type });
    }

    return { received: true };
  } catch (error) {
    logger.error('[StripeConnect] Error handling webhook', { error });
    throw error;
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  try {
    const providerId = account.metadata?.providerId;
    if (!providerId) {
      logger.warn('[StripeConnect] Account updated webhook missing providerId', {
        accountId: account.id,
      });
      return;
    }

    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;
    const detailsSubmitted = account.details_submitted || false;

    await db
      .update(providers)
      .set({
        stripeOnboardingComplete: detailsSubmitted,
        payoutEnabled: chargesEnabled && payoutsEnabled,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, parseInt(providerId)));

    logger.info('[StripeConnect] Account status updated', {
      providerId,
      accountId: account.id,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
    });
  } catch (error) {
    logger.error('[StripeConnect] Error handling account updated', { error });
    throw error;
  }
}

async function handleTransferEvent(transfer: Stripe.Transfer) {
  try {
    const earningId = transfer.metadata?.earningId;
    if (!earningId) {
      logger.warn('[StripeConnect] Transfer event missing earningId', {
        transferId: transfer.id,
      });
      return;
    }

    const statusMap: Record<string, string> = {
      pending: 'pending',
      in_transit: 'processing',
      paid: 'completed',
      failed: 'failed',
      canceled: 'cancelled',
    };

    const payoutStatus = statusMap[transfer.status] || 'pending';

    await db
      .update(payouts)
      .set({
        status: payoutStatus,
        updatedAt: new Date(),
      })
      .where(eq(payouts.stripeTransferId, transfer.id));

    logger.info('[StripeConnect] Transfer status updated', {
      transferId: transfer.id,
      earningId,
      status: transfer.status,
      payoutStatus,
    });
  } catch (error) {
    logger.error('[StripeConnect] Error handling transfer event', { error });
    throw error;
  }
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
  try {
    const earningId = transfer.metadata?.earningId;
    if (!earningId) {
      logger.warn('[StripeConnect] Transfer failed event missing earningId', {
        transferId: transfer.id,
      });
      return;
    }

    await db
      .update(payouts)
      .set({
        status: 'failed',
        failureReason: transfer.failure_message || 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(payouts.stripeTransferId, transfer.id));

    logger.error('[StripeConnect] Transfer failed', {
      transferId: transfer.id,
      earningId,
      failureMessage: transfer.failure_message,
    });
  } catch (error) {
    logger.error('[StripeConnect] Error handling transfer failed', { error });
    throw error;
  }
}
