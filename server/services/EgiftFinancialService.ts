import { db } from '../db';
import {
  egiftEvents,
  egiftRedeemAttempts,
  walletAccounts,
  creditTransactions,
  octopusLedger,
  octopusBookings,
  octopusWallets,
  octopusInvoices,
} from '@shared/schema';
import { eq, and, sql, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { logger } from '../lib/logger';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REDEEM_PER_EGIFT = 10;
const MAX_REDEEM_PER_STATION = 30;
const PLATFORM_FEE_RATE = 0.15;

function generateId(prefix: string): string {
  return `${prefix}-${nanoid(12).toUpperCase()}`;
}

function computeEventHash(data: Record<string, any>): string {
  const sorted = Object.keys(data).sort().reduce((acc: Record<string, any>, key) => {
    if (data[key] !== undefined && data[key] !== null) {
      acc[key] = data[key];
    }
    return acc;
  }, {});
  const payload = JSON.stringify(sorted);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface EgiftPurchaseInput {
  userId: string;
  egiftId: string;
  amountCents: number;
  currency?: string;
  paymentMethodRef?: string;
  recipientEmail?: string;
  recipientName?: string;
  senderName?: string;
  message?: string;
  idempotencyKey: string;
}

export interface EgiftPurchaseResult {
  egiftId: string;
  eventId: string;
  walletCredited: boolean;
  invoiceId: string;
  amountCents: number;
  idempotent: boolean;
}

export interface BrainRedeemInput {
  platform: string;
  product: string;
  stationId?: string;
  baySide?: string;
  egiftId: string;
  userId: string;
  amountCents: number;
  idempotencyKey: string;
  ipAddress?: string;
}

export interface BrainRedeemResult {
  bookingId: string;
  ledgerEntryId: string;
  walletEventId: string;
  receiptId: string | null;
  amountCents: number;
  remainingBalanceCents: number;
  idempotent: boolean;
}

class EgiftFinancialService {

  async purchaseEgift(input: EgiftPurchaseInput): Promise<EgiftPurchaseResult> {
    const purchaseIdempKey = `PURCHASE:${input.idempotencyKey}`;

    const eventId = generateId('EGE');
    const walletEventId = generateId('TXN');
    const ledgerEntryId = generateId('OL');
    const invoiceId = generateId('INV');

    const eventData = {
      amountCents: input.amountCents,
      currency: input.currency || 'ILS',
      egiftId: input.egiftId,
      eventId,
      eventType: 'PURCHASED',
      idempotencyKey: purchaseIdempKey,
      userId: input.userId,
    };
    const hash = computeEventHash(eventData);

    try {
      await db.transaction(async (tx) => {
        const insertResult = await tx.execute(sql`
          INSERT INTO egift_events (event_id, egift_id, event_type, user_id, amount_cents, currency, idempotency_key, invoice_id, sha256_hash, metadata)
          VALUES (${eventId}, ${input.egiftId}, 'PURCHASED', ${input.userId}, ${input.amountCents}, ${input.currency || 'ILS'}, ${purchaseIdempKey}, ${invoiceId}, ${hash}, ${JSON.stringify({
            paymentMethodRef: input.paymentMethodRef,
            recipientEmail: input.recipientEmail,
            recipientName: input.recipientName,
            senderName: input.senderName,
            message: input.message,
          })}::jsonb)
          ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
          RETURNING event_id
        `);

        if (insertResult.rows.length === 0) {
          throw { idempotent: true };
        }

        const [wallet] = await tx.select()
          .from(walletAccounts)
          .where(eq(walletAccounts.userId, input.userId))
          .limit(1);

        if (wallet) {
          await tx.update(walletAccounts)
            .set({
              egiftBalanceCents: sql`${walletAccounts.egiftBalanceCents} + ${input.amountCents}`,
              updatedAt: new Date(),
              lastActivityAt: new Date(),
            })
            .where(eq(walletAccounts.userId, input.userId));

          await tx.insert(creditTransactions).values({
            transactionId: walletEventId,
            walletId: wallet.walletId,
            creditType: 'egift',
            transactionType: 'purchase',
            amountCents: input.amountCents,
            balanceAfterCents: (wallet.egiftBalanceCents || 0) + input.amountCents,
            sourceType: 'purchase',
            sourceId: input.egiftId,
            platform: 'egift',
            description: `E-gift purchased: ${input.egiftId}`,
            initiatedBy: input.userId,
          });
        } else {
          const newWalletId = `WALLET-${nanoid(10).toUpperCase()}`;
          await tx.insert(walletAccounts).values({
            walletId: newWalletId,
            userId: input.userId,
            egiftBalanceCents: input.amountCents,
            washPackageCredits: 0,
            loyaltyPointsBalance: 0,
            promoBalanceCents: 0,
            referralBalanceCents: 0,
            loyaltyTier: 'bronze',
            tierPointsThisYear: 0,
            preferredCurrency: input.currency || 'ILS',
            autoApplyCredits: true,
            isActive: true,
          });

          await tx.insert(creditTransactions).values({
            transactionId: walletEventId,
            walletId: newWalletId,
            creditType: 'egift',
            transactionType: 'purchase',
            amountCents: input.amountCents,
            balanceAfterCents: input.amountCents,
            sourceType: 'purchase',
            sourceId: input.egiftId,
            platform: 'egift',
            description: `E-gift purchased: ${input.egiftId}`,
            initiatedBy: input.userId,
          });
        }

        const creditEventId = generateId('EGE');
        const creditHash = computeEventHash({
          amountCents: input.amountCents,
          creditEventId,
          currency: input.currency || 'ILS',
          egiftId: input.egiftId,
          eventType: 'CREDITED_TO_WALLET',
          userId: input.userId,
          walletEventId,
        });

        await tx.insert(egiftEvents).values({
          eventId: creditEventId,
          egiftId: input.egiftId,
          eventType: 'CREDITED_TO_WALLET',
          userId: input.userId,
          amountCents: input.amountCents,
          currency: input.currency || 'ILS',
          ledgerEntryId: walletEventId,
          sha256Hash: creditHash,
        });

        await tx.insert(octopusLedger).values({
          id: ledgerEntryId,
          type: 'EGIFT_PURCHASED',
          amount: input.amountCents,
          platform: 'EGIFT',
          metadata: {
            egiftId: input.egiftId,
            userId: input.userId,
            invoiceId,
            idempotencyKey: input.idempotencyKey,
          },
        });

        await tx.insert(octopusInvoices).values({
          id: invoiceId,
          bookingId: `EGIFT-${input.egiftId}`,
          docNumber: `PW-EGIFT-${Date.now().toString(36).toUpperCase()}`,
          allocationNumber: input.egiftId,
        });
      });

      logger.info('[EgiftFinancial] Purchase completed', {
        egiftId: input.egiftId,
        amountCents: input.amountCents,
        eventId,
        invoiceId,
        userId: input.userId,
      });

      return {
        egiftId: input.egiftId,
        eventId,
        walletCredited: true,
        invoiceId,
        amountCents: input.amountCents,
        idempotent: false,
      };

    } catch (error: any) {
      if (error?.idempotent) {
        const [existingEvent] = await db.select()
          .from(egiftEvents)
          .where(and(
            eq(egiftEvents.idempotencyKey, purchaseIdempKey),
            eq(egiftEvents.eventType, 'PURCHASED')
          ))
          .limit(1);

        if (existingEvent) {
          logger.info('[EgiftFinancial] Idempotent purchase return', { egiftId: input.egiftId, eventId: existingEvent.eventId });
          return {
            egiftId: input.egiftId,
            eventId: existingEvent.eventId,
            walletCredited: true,
            invoiceId: existingEvent.invoiceId || '',
            amountCents: existingEvent.amountCents || input.amountCents,
            idempotent: true,
          };
        }
      }
      throw error;
    }
  }

  async checkRedeemRateLimit(egiftId: string, stationId?: string, ipAddress?: string): Promise<{ allowed: boolean; reason?: string }> {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    const egiftAttempts = await db.select({ count: sql<number>`count(*)` })
      .from(egiftRedeemAttempts)
      .where(and(
        eq(egiftRedeemAttempts.egiftId, egiftId),
        gte(egiftRedeemAttempts.attemptedAt, windowStart)
      ));

    if ((egiftAttempts[0]?.count || 0) >= MAX_REDEEM_PER_EGIFT) {
      return { allowed: false, reason: `Rate limit exceeded: max ${MAX_REDEEM_PER_EGIFT} attempts per e-gift per ${RATE_LIMIT_WINDOW_MS / 60000} minutes` };
    }

    if (stationId) {
      const stationAttempts = await db.select({ count: sql<number>`count(*)` })
        .from(egiftRedeemAttempts)
        .where(and(
          eq(egiftRedeemAttempts.stationId, stationId),
          gte(egiftRedeemAttempts.attemptedAt, windowStart)
        ));

      if ((stationAttempts[0]?.count || 0) >= MAX_REDEEM_PER_STATION) {
        return { allowed: false, reason: `Rate limit exceeded: max ${MAX_REDEEM_PER_STATION} attempts per station per ${RATE_LIMIT_WINDOW_MS / 60000} minutes` };
      }
    }

    return { allowed: true };
  }

  async brainRedeem(input: BrainRedeemInput): Promise<BrainRedeemResult> {
    const redeemIdempKey = `REDEEM:${input.idempotencyKey}`;

    const [existingRedeem] = await db.select()
      .from(egiftEvents)
      .where(and(
        eq(egiftEvents.idempotencyKey, redeemIdempKey),
        eq(egiftEvents.eventType, 'REDEEMED')
      ))
      .limit(1);

    if (existingRedeem) {
      logger.info('[EgiftFinancial] Idempotent redeem return', { egiftId: input.egiftId, eventId: existingRedeem.eventId });
      const [wallet] = await db.select()
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, input.userId))
        .limit(1);

      const meta = existingRedeem.metadata as any;
      return {
        bookingId: existingRedeem.bookingId || '',
        ledgerEntryId: existingRedeem.ledgerEntryId || '',
        walletEventId: meta?.walletTxnId || existingRedeem.ledgerEntryId || '',
        receiptId: existingRedeem.invoiceId || null,
        amountCents: existingRedeem.amountCents || input.amountCents,
        remainingBalanceCents: wallet?.egiftBalanceCents || 0,
        idempotent: true,
      };
    }

    await db.insert(egiftRedeemAttempts).values({
      egiftId: input.egiftId,
      stationId: input.stationId,
      userId: input.userId,
      success: false,
      failureReason: 'pending',
      ipAddress: input.ipAddress,
    });

    const rateCheck = await this.checkRedeemRateLimit(input.egiftId, input.stationId, input.ipAddress);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.reason || 'Rate limit exceeded');
    }

    const redeemStartEventId = generateId('EGE');
    const startHash = computeEventHash({
      amountCents: input.amountCents,
      baySide: input.baySide,
      egiftId: input.egiftId,
      eventType: 'REDEEM_STARTED',
      platform: input.platform,
      product: input.product,
      redeemStartEventId,
      stationId: input.stationId,
      userId: input.userId,
    });

    await db.insert(egiftEvents).values({
      eventId: redeemStartEventId,
      egiftId: input.egiftId,
      eventType: 'REDEEM_STARTED',
      userId: input.userId,
      amountCents: input.amountCents,
      platform: input.platform,
      product: input.product,
      stationId: input.stationId,
      baySide: input.baySide,
      sha256Hash: startHash,
    });

    try {
      const result = await db.transaction(async (tx) => {
        const walletResult = await tx.execute(sql`
          SELECT * FROM wallet_accounts 
          WHERE user_id = ${input.userId}
          FOR UPDATE
        `);

        if (walletResult.rows.length === 0) {
          throw new Error('Wallet not found for user');
        }

        const wallet = walletResult.rows[0] as any;
        const currentEgiftBalance = wallet.egift_balance_cents || 0;

        if (currentEgiftBalance < input.amountCents) {
          throw new Error(`Insufficient e-gift balance: need ${input.amountCents}, have ${currentEgiftBalance}`);
        }

        const newBalance = currentEgiftBalance - input.amountCents;
        const bookingId = generateId('OB');
        const ledgerEntryId = generateId('OL');
        const walletTxnId = generateId('TXN');
        const redeemEventId = generateId('EGE');
        const receiptId = input.stationId ? generateId('INV') : null;

        await tx.execute(sql`
          UPDATE wallet_accounts 
          SET egift_balance_cents = ${newBalance},
              updated_at = NOW(),
              last_activity_at = NOW()
          WHERE user_id = ${input.userId}
        `);

        await tx.insert(creditTransactions).values({
          transactionId: walletTxnId,
          walletId: wallet.wallet_id,
          creditType: 'egift',
          transactionType: 'redeem',
          amountCents: -input.amountCents,
          balanceAfterCents: newBalance,
          sourceType: 'redeem',
          sourceId: input.egiftId,
          platform: input.platform,
          description: `E-gift redeemed: ${input.egiftId} on ${input.product}${input.stationId ? ` at station ${input.stationId}` : ''}`,
          initiatedBy: 'brain',
          redemptionSessionId: bookingId,
        });

        await tx.insert(octopusBookings).values({
          id: bookingId,
          userId: input.userId,
          platform: input.platform.toUpperCase(),
          price: input.amountCents,
          // K9000 is a direct PetWash-owned asset (not a marketplace provider).
          // Applying a provider split would create false P&L outflow on direct revenue.
          // All other platforms (sitter, walker, academy…) are true marketplace agents at 15%.
          platformFee: input.platform.toLowerCase() === 'k9000' ? 0 : Math.round(input.amountCents * PLATFORM_FEE_RATE),
          providerShare: input.platform.toLowerCase() === 'k9000' ? 0 : input.amountCents - Math.round(input.amountCents * PLATFORM_FEE_RATE),
          status: 'CONFIRMED',
          idempotencyKey: `BOOKING:${input.idempotencyKey}`,
        });

        await tx.insert(octopusLedger).values({
          id: ledgerEntryId,
          type: 'EGIFT_REDEEMED',
          bookingId,
          walletId: wallet.wallet_id,
          amount: input.amountCents,
          platform: input.platform.toUpperCase(),
          metadata: {
            egiftId: input.egiftId,
            product: input.product,
            stationId: input.stationId,
            baySide: input.baySide,
            idempotencyKey: input.idempotencyKey,
          },
        });

        if (receiptId) {
          await tx.insert(octopusInvoices).values({
            id: receiptId,
            bookingId,
            docNumber: `PW-KIOSK-${Date.now().toString(36).toUpperCase()}`,
            allocationNumber: input.egiftId,
          });
        }

        const redeemHash = computeEventHash({
          amountCents: input.amountCents,
          baySide: input.baySide,
          bookingId,
          egiftId: input.egiftId,
          eventType: 'REDEEMED',
          idempotencyKey: redeemIdempKey,
          ledgerEntryId,
          newBalance,
          platform: input.platform,
          previousBalance: currentEgiftBalance,
          product: input.product,
          redeemEventId,
          stationId: input.stationId,
          userId: input.userId,
          walletTxnId,
        });

        await tx.insert(egiftEvents).values({
          eventId: redeemEventId,
          egiftId: input.egiftId,
          eventType: 'REDEEMED',
          userId: input.userId,
          walletId: wallet.wallet_id,
          amountCents: input.amountCents,
          currency: 'ILS',
          platform: input.platform,
          product: input.product,
          stationId: input.stationId,
          baySide: input.baySide,
          bookingId,
          kioskTxnId: input.stationId ? bookingId : null,
          ledgerEntryId,
          invoiceId: receiptId,
          idempotencyKey: redeemIdempKey,
          sha256Hash: redeemHash,
          metadata: {
            previousBalance: currentEgiftBalance,
            newBalance,
            walletTxnId,
          },
        });

        return {
          bookingId,
          ledgerEntryId,
          walletEventId: walletTxnId,
          receiptId,
          amountCents: input.amountCents,
          remainingBalanceCents: newBalance,
          idempotent: false,
        };
      });

      await db.execute(sql`
        UPDATE egift_redeem_attempts 
        SET success = true, failure_reason = NULL
        WHERE id = (
          SELECT id FROM egift_redeem_attempts
          WHERE egift_id = ${input.egiftId} 
            AND user_id = ${input.userId}
            AND failure_reason = 'pending'
          ORDER BY attempted_at DESC
          LIMIT 1
        )
      `).catch(() => {});

      logger.info('[EgiftFinancial] Brain redeem completed', {
        egiftId: input.egiftId,
        bookingId: result.bookingId,
        amountCents: input.amountCents,
        platform: input.platform,
        product: input.product,
        stationId: input.stationId,
        remainingBalance: result.remainingBalanceCents,
      });

      return result;
    } catch (error: any) {
      const isUniqueViolation = error?.code === '23505' && error?.message?.includes('idempotency_key');
      if (isUniqueViolation) {
        const [existingRedeem] = await db.select()
          .from(egiftEvents)
          .where(and(
            eq(egiftEvents.idempotencyKey, redeemIdempKey),
            eq(egiftEvents.eventType, 'REDEEMED')
          ))
          .limit(1);

        if (existingRedeem) {
          logger.info('[EgiftFinancial] Concurrent idempotent redeem caught', { egiftId: input.egiftId });
          const [wallet] = await db.select()
            .from(walletAccounts)
            .where(eq(walletAccounts.userId, input.userId))
            .limit(1);

          const meta = existingRedeem.metadata as any;
          return {
            bookingId: existingRedeem.bookingId || '',
            ledgerEntryId: existingRedeem.ledgerEntryId || '',
            walletEventId: meta?.walletTxnId || existingRedeem.ledgerEntryId || '',
            receiptId: existingRedeem.invoiceId || null,
            amountCents: existingRedeem.amountCents || input.amountCents,
            remainingBalanceCents: wallet?.egiftBalanceCents || 0,
            idempotent: true,
          };
        }
      }

      const failEventId = generateId('EGE');
      await db.insert(egiftEvents).values({
        eventId: failEventId,
        egiftId: input.egiftId,
        eventType: 'REDEEM_FAILED',
        userId: input.userId,
        amountCents: input.amountCents,
        platform: input.platform,
        product: input.product,
        stationId: input.stationId,
        sha256Hash: computeEventHash({
          amountCents: input.amountCents,
          egiftId: input.egiftId,
          error: error.message,
          eventType: 'REDEEM_FAILED',
          failEventId,
          userId: input.userId,
        }),
        metadata: { error: error.message, idempotencyKey: input.idempotencyKey },
      }).catch(() => {});

      logger.error('[EgiftFinancial] Brain redeem failed', {
        egiftId: input.egiftId,
        error: error.message,
        platform: input.platform,
      });

      throw error;
    }
  }

  async getEgiftAuditTrail(egiftId: string): Promise<any[]> {
    return db.select()
      .from(egiftEvents)
      .where(eq(egiftEvents.egiftId, egiftId))
      .orderBy(egiftEvents.createdAt);
  }

  async getUserEgiftEvents(userId: string, limit = 50): Promise<any[]> {
    return db.select()
      .from(egiftEvents)
      .where(eq(egiftEvents.userId, userId))
      .orderBy(sql`${egiftEvents.createdAt} DESC`)
      .limit(limit);
  }
}

export const egiftFinancialService = new EgiftFinancialService();
