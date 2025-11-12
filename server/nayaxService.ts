import { db } from "./db";
import { 
  pendingTransactions, 
  nayaxTransactions, 
  nayaxWebhookEvents, 
  nayaxTerminals,
  eVouchers,
  eVoucherRedemptions,
  washPackages 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { logger } from './lib/logger';

export interface NayaxPaymentRequest {
  packageId: number;
  customerEmail?: string;
  customerName?: string;
  amount: number;
  currency: string;
  returnUrl: string;
  webhookUrl: string;
  isGiftCard?: boolean;
  recipientEmail?: string;
  personalMessage?: string;
}

export interface NayaxPaymentResponse {
  success: boolean;
  transactionId: string;
  paymentUrl: string;
  voucherCode?: string;
  qrCode?: string;
  message: string;
}

export interface NayaxRedeemRequest {
  qrToken: string;
  stationId: string;
  terminalId: string;
}

export interface NayaxRedeemResponse {
  success: boolean;
  message: string;
  voucher?: {
    id: string;
    remainingAmount: string;
    type: string;
  };
}

export interface NayaxWebhookPayload {
  eventType: string;
  eventId: string;
  transactionId?: string;
  terminalId?: string;
  amount?: number;
  status?: string;
  timestamp: string;
}

export class NayaxPaymentService {
  private static readonly NAYAX_API_BASE = process.env.NAYAX_BASE_URL || 'https://sandbox.nayax.co.il/api/v1';
  private static readonly MERCHANT_ID = process.env.NAYAX_MERCHANT_ID || 'PETWASH_MERCHANT';
  private static readonly API_KEY = process.env.NAYAX_API_KEY || 'test_api_key';
  private static readonly NAYAX_SECRET = process.env.NAYAX_SECRET || 'test_secret';
  private static readonly WEBHOOK_SECRET = process.env.NAYAX_WEBHOOK_SECRET || 'webhook_secret';

  /**
   * Initiate payment with Nayax Israel - creates pending transaction and returns payment URL
   */
  static async initiatePayment(request: NayaxPaymentRequest): Promise<NayaxPaymentResponse> {
    try {
      const transactionId = nanoid(16);
      const voucherCode = this.generateVoucherCode();
      
      const [washPackage] = await db.select().from(washPackages).where(eq(washPackages.id, request.packageId)).limit(1);
      
      if (!washPackage) {
        throw new Error('Package not found');
      }

      await db.insert(pendingTransactions).values({
        id: transactionId,
        packageId: request.packageId,
        customerEmail: request.customerEmail,
        customerName: request.customerName,
        amount: request.amount.toString(),
        currency: request.currency,
        status: 'pending',
        voucherCode,
        isGiftCard: request.isGiftCard || false,
        recipientEmail: request.recipientEmail,
        personalMessage: request.personalMessage,
      });

      // Mock Nayax payment URL (will be real in production)
      const paymentUrl = this.buildNayaxPaymentUrl({
        transactionId,
        amount: request.amount,
        currency: request.currency,
        returnUrl: request.returnUrl,
        webhookUrl: request.webhookUrl,
        description: `Pet Wash - ${washPackage.name}`,
        customerEmail: request.customerEmail,
      });

      logger.info('Nayax payment initiated', { transactionId });

      return {
        success: true,
        transactionId,
        paymentUrl,
        voucherCode,
        message: 'Payment initiated successfully'
      };

    } catch (error) {
      logger.error('Nayax payment initiation failed', error);
      return {
        success: false,
        transactionId: '',
        paymentUrl: '',
        message: error instanceof Error ? error.message : 'Payment initiation failed'
      };
    }
  }

  /**
   * Handle QR voucher redemption at Nayax station
   */
  static async redeemVoucher(request: NayaxRedeemRequest): Promise<NayaxRedeemResponse> {
    try {
      // Verify QR token signature
      const voucherId = this.verifyQRToken(request.qrToken);
      if (!voucherId) {
        return { success: false, message: 'Invalid QR code' };
      }

      // Get voucher from database
      const [voucher] = await db.select().from(eVouchers).where(eq(eVouchers.id, voucherId)).limit(1);

      if (!voucher) {
        return { success: false, message: 'Voucher not found' };
      }

      // Validate voucher status
      if (voucher.status !== 'ACTIVE' && voucher.status !== 'ISSUED') {
        return { success: false, message: `Voucher is ${voucher.status.toLowerCase()}` };
      }

      // Check if expired
      if (voucher.expiresAt && voucher.expiresAt < new Date()) {
        await db.update(eVouchers).set({ status: 'EXPIRED' }).where(eq(eVouchers.id, voucherId));
        return { success: false, message: 'Voucher expired' };
      }

      // Check remaining amount
      const remaining = parseFloat(voucher.remainingAmount);
      if (remaining <= 0) {
        return { success: false, message: 'No remaining balance' };
      }

      logger.info('Voucher validated for redemption', { voucherId });

      return {
        success: true,
        message: 'Voucher validated successfully',
        voucher: {
          id: voucher.id,
          remainingAmount: voucher.remainingAmount,
          type: voucher.type
        }
      };

    } catch (error) {
      logger.error('Voucher redemption failed', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Redemption failed'
      };
    }
  }

  /**
   * Handle Nayax webhook events
   * @param payload - Parsed webhook payload
   * @param signature - Webhook signature from header
   * @param rawBody - Raw request body string for signature verification
   */
  static async handleWebhook(payload: NayaxWebhookPayload, signature: string, rawBody: string): Promise<boolean> {
    try {
      // Verify webhook signature using raw body
      if (!this.verifyWebhookSignature(rawBody, signature)) {
        logger.error('Invalid webhook signature');
        return false;
      }

      // Check for duplicate event (idempotency)
      const [existing] = await db.select()
        .from(nayaxWebhookEvents)
        .where(eq(nayaxWebhookEvents.eventId, payload.eventId))
        .limit(1);

      if (existing) {
        logger.info('Duplicate webhook event ignored', { eventId: payload.eventId });
        return true; // Already processed
      }

      // Store webhook event
      const [webhookEvent] = await db.insert(nayaxWebhookEvents).values({
        eventType: payload.eventType,
        eventId: payload.eventId,
        transactionId: payload.transactionId,
        terminalId: payload.terminalId,
        payload: payload as any,
        signature,
        processed: false,
      }).returning();

      // Process event based on type
      let processed = false;
      
      switch (payload.eventType) {
        case 'payment.approved':
          processed = await this.handlePaymentApproved(payload);
          break;
        case 'payment.declined':
          processed = await this.handlePaymentDeclined(payload);
          break;
        case 'payment.refunded':
          processed = await this.handlePaymentRefunded(payload);
          break;
        case 'session.started':
          processed = await this.handleSessionStarted(payload);
          break;
        case 'session.ended':
          processed = await this.handleSessionEnded(payload);
          break;
        case 'qr.scanned':
          processed = await this.handleQRScanned(payload);
          break;
        default:
          logger.warn('Unknown webhook event type', { eventType: payload.eventType });
          processed = true; // Mark as processed to avoid retries
      }

      // Update webhook event status
      await db.update(nayaxWebhookEvents)
        .set({ 
          processed, 
          processedAt: new Date(),
          error: processed ? null : 'Processing failed'
        })
        .where(eq(nayaxWebhookEvents.id, webhookEvent.id));

      return processed;

    } catch (error) {
      logger.error('Webhook handling failed', error);
      return false;
    }
  }

  /**
   * Validate station API key
   */
  static async validateStationKey(apiKey: string): Promise<boolean> {
    try {
      const [terminal] = await db.select()
        .from(nayaxTerminals)
        .where(and(
          eq(nayaxTerminals.apiKey, apiKey),
          eq(nayaxTerminals.status, 'online')
        ))
        .limit(1);

      return !!terminal;
    } catch (error) {
      logger.error('Station key validation failed', error);
      return false;
    }
  }

  /**
   * Generate secure QR token with HMAC SHA-256 signature
   */
  static generateQRToken(voucherId: string): string {
    const timestamp = Date.now();
    const data = `${voucherId}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(data)
      .digest('base64url');
    
    return `${data}:${signature}`;
  }

  /**
   * Verify QR token signature
   */
  static verifyQRToken(token: string): string | null {
    try {
      const parts = token.split(':');
      if (parts.length !== 3) return null;

      const [voucherId, timestamp, signature] = parts;
      const data = `${voucherId}:${timestamp}`;
      
      const expectedSignature = crypto
        .createHmac('sha256', this.WEBHOOK_SECRET)
        .update(data)
        .digest('base64url');

      if (signature !== expectedSignature) return null;

      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge > 24 * 60 * 60 * 1000) return null;

      return voucherId;
    } catch {
      return null;
    }
  }

  // Private helper methods

  private static generateVoucherCode(): string {
    return nanoid(8).toUpperCase();
  }

  private static buildNayaxPaymentUrl(params: {
    transactionId: string;
    amount: number;
    currency: string;
    returnUrl: string;
    webhookUrl: string;
    description: string;
    customerEmail?: string;
  }): string {
    // Mock URL for now - will be real Nayax API in production
    const baseUrl = `${this.NAYAX_API_BASE}/hosted-payment`;
    
    const queryParams = new URLSearchParams({
      merchant_id: this.MERCHANT_ID,
      transaction_id: params.transactionId,
      amount: params.amount.toString(),
      currency: params.currency,
      return_url: params.returnUrl,
      webhook_url: params.webhookUrl,
      description: params.description,
      language: 'he',
      country: 'IL',
      timezone: 'Asia/Jerusalem',
      ...(params.customerEmail && { customer_email: params.customerEmail }),
    });

    return `${baseUrl}?${queryParams.toString()}`;
  }

  private static verifyWebhookSignature(rawBody: string, signature: string): boolean {
    // CRITICAL: Must use raw body exactly as sent by Nayax
    // Do NOT use JSON.stringify() as it may change key ordering/whitespace
    const expectedSignature = crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private static async handlePaymentApproved(payload: NayaxWebhookPayload): Promise<boolean> {
    try {
      if (!payload.transactionId) return false;

      const [pending] = await db.select()
        .from(pendingTransactions)
        .where(eq(pendingTransactions.id, payload.transactionId))
        .limit(1);

      if (!pending) {
        logger.error('Pending transaction not found', { transactionId: payload.transactionId });
        return false;
      }

      // Create completed transaction
      await db.insert(nayaxTransactions).values({
        id: nanoid(16),
        pendingTransactionId: pending.id,
        terminalId: payload.terminalId,
        merchantId: this.MERCHANT_ID,
        amount: pending.amount,
        currency: pending.currency,
        status: 'approved',
        completedAt: new Date(),
      });

      // Create voucher
      const voucherId = nanoid(16);
      await db.insert(eVouchers).values({
        id: voucherId,
        codeHash: crypto.createHash('sha256').update(pending.voucherCode || '').digest('hex'),
        codeLast4: (pending.voucherCode || '').slice(-4),
        type: 'STORED_VALUE',
        currency: pending.currency,
        initialAmount: pending.amount,
        remainingAmount: pending.amount,
        status: 'ACTIVE',
        purchaserEmail: pending.customerEmail,
        recipientEmail: pending.recipientEmail || pending.customerEmail,
        nayaxTxId: pending.id,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      });

      // Update pending transaction
      await db.update(pendingTransactions)
        .set({ status: 'paid', paidAt: new Date() })
        .where(eq(pendingTransactions.id, pending.id));

      logger.info('Payment approved and voucher created', { transactionId: pending.id, voucherId });
      return true;
    } catch (error) {
      logger.error('Payment approval handling failed', error);
      return false;
    }
  }

  private static async handlePaymentDeclined(payload: NayaxWebhookPayload): Promise<boolean> {
    try {
      if (!payload.transactionId) return false;

      await db.update(pendingTransactions)
        .set({ status: 'failed' })
        .where(eq(pendingTransactions.id, payload.transactionId));

      logger.info('Payment declined', { transactionId: payload.transactionId });
      return true;
    } catch (error) {
      logger.error('Payment decline handling failed', error);
      return false;
    }
  }

  /**
   * Handle payment refund webhook - Cancel/deactivate associated voucher
   */
  private static async handlePaymentRefunded(payload: NayaxWebhookPayload): Promise<boolean> {
    try {
      if (!payload.transactionId) return false;

      // Find the pending transaction
      const [pending] = await db.select()
        .from(pendingTransactions)
        .where(eq(pendingTransactions.id, payload.transactionId))
        .limit(1);

      if (!pending) {
        logger.error('Pending transaction not found for refund', { transactionId: payload.transactionId });
        return false;
      }

      // Find and cancel the associated voucher
      const [voucher] = await db.select()
        .from(eVouchers)
        .where(eq(eVouchers.nayaxTxId, pending.id))
        .limit(1);

      if (voucher) {
        // Deactivate voucher and mark as refunded
        await db.update(eVouchers)
          .set({
            status: 'REFUNDED',
            remainingAmount: '0.00', // Zero out balance
          })
          .where(eq(eVouchers.id, voucher.id));

        logger.info('Voucher cancelled due to refund', { 
          transactionId: pending.id, 
          voucherId: voucher.id,
          originalAmount: voucher.initialAmount
        });
      } else {
        logger.warn('No voucher found for refunded transaction', { transactionId: pending.id });
      }

      // Update pending transaction status
      await db.update(pendingTransactions)
        .set({ status: 'refunded' })
        .where(eq(pendingTransactions.id, pending.id));

      // Update completed Nayax transaction if exists
      const [completedTx] = await db.select()
        .from(nayaxTransactions)
        .where(eq(nayaxTransactions.pendingTransactionId, pending.id))
        .limit(1);

      if (completedTx) {
        await db.update(nayaxTransactions)
          .set({ status: 'refunded' })
          .where(eq(nayaxTransactions.id, completedTx.id));
      }

      logger.info('Payment refund processed successfully', { transactionId: payload.transactionId });
      return true;
    } catch (error) {
      logger.error('Payment refund handling failed', error);
      return false;
    }
  }

  private static async handleSessionStarted(payload: NayaxWebhookPayload): Promise<boolean> {
    logger.info('Session started', { payload });
    return true;
  }

  private static async handleSessionEnded(payload: NayaxWebhookPayload): Promise<boolean> {
    try {
      // Mark voucher as redeemed when session ends
      if (payload.transactionId) {
        const [voucher] = await db.select()
          .from(eVouchers)
          .where(eq(eVouchers.nayaxTxId, payload.transactionId))
          .limit(1);

        if (voucher) {
          await db.update(eVouchers)
            .set({ 
              status: 'REDEEMED',
              remainingAmount: '0'
            })
            .where(eq(eVouchers.id, voucher.id));

          // Create redemption record
          await db.insert(eVoucherRedemptions).values({
            voucherId: voucher.id,
            amount: voucher.remainingAmount,
            locationId: payload.terminalId,
            nayaxSessionId: payload.transactionId,
          });

          logger.info('Session ended, voucher redeemed', { voucherId: voucher.id });
        }
      }
      return true;
    } catch (error) {
      logger.error('Session end handling failed', error);
      return false;
    }
  }

  private static async handleQRScanned(payload: NayaxWebhookPayload): Promise<boolean> {
    logger.info('QR code scanned', { payload });
    return true;
  }
}
