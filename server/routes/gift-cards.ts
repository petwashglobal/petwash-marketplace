import { Router } from 'express';
import { db } from '../db';
import { eVouchers, eVoucherRedemptions } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { walletService } from '../services/WalletService';
import { runWithIdempotency } from '../lib/idempotency-helper';
import { QRCodeService } from '../qrCode';
import { EmailService } from '../emailService';
import { GoogleMessagingService } from '../services/GoogleMessagingService';
import { logger } from '../lib/logger';
import {
  parseEgiftDenomination,
  describeAllowedDenominations,
} from '../lib/egift-denominations';
import crypto from 'crypto';
import { z } from 'zod';
import { paymentLimiter } from '../middleware/rateLimiter';
import { AppleWalletService } from '../appleWallet';
import { GoogleWalletService } from '../googleWallet';
import rateLimit from 'express-rate-limit';
import { generateEGiftPurchaseConfirmation, type SeasonalTheme } from '../email/templates/egift-purchase-confirmation-2026';
import {
  generateWalletPassToken,
  verifyWalletPassToken,
} from '../lib/walletPassToken';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';

// Wallet pass download rate limiter (prevents brute-force token guessing)
const walletPassLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per IP
  message: { error: 'Too many wallet pass requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// 🎁 E-GIFT CARD PURCHASE SCHEMA
const purchaseGiftCardSchema = z.object({
  // Recipient details (REQUIRED)
  recipientName: z.string().min(1),
  recipientEmail: z.string().email(),
  recipientPhone: z.string().optional(),
  
  // Delivery location
  address: z.string().min(1),
  city: z.string().optional(),
  postcode: z.string().min(1),
  country: z.string().default('Israel'),
  
  // Gift details
  // PR-W6 P0 fix: e-gift purchases are restricted to the four CEO-confirmed
  // denominations advertised on petwash.co.il (Classic ₪100, Plus ₪250,
  // Premium ₪500, Mazon ₪1000). Free-form amounts were a
  // revenue-leak / accounting-drift vector. The single source of truth is
  // server/lib/egift-denominations.ts.
  amount: z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      const parsed = parseEgiftDenomination(v);
      if (parsed === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Amount must be one of ${describeAllowedDenominations()}.`,
        });
        return z.NEVER;
      }
      return parsed;
    }),
  message: z.string().max(500).optional(),
  deliveryDate: z.string().optional(),
  deliveryMethod: z.enum(['email', 'whatsapp', 'both']).default('email'),
  
  // Sender info (optional - can be anonymous)
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional(),
});

// 🔐 BLOCKCHAIN-STYLE HASH GENERATION
function generateBlockchainHash(voucherId: string, code: string, amount: number, timestamp: Date): string {
  const data = `${voucherId}|${code}|${amount}|${timestamp.toISOString()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 🎯 GENERATE UNIQUE VOUCHER CODE (16-char alphanumeric)
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0, O, I, 1)
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars[crypto.randomInt(chars.length)];
    if ((i + 1) % 4 === 0 && i !== 15) code += '-'; // Add dashes every 4 chars
  }
  return code;
}

// 📧 SEND E-GIFT TO RECIPIENT
async function sendGiftCardToRecipient(
  voucher: any,
  recipientEmail: string,
  recipientPhone: string | undefined,
  recipientName: string,
  senderName: string,
  message: string | undefined,
  qrCodeDataURL: string,
  deliveryMethod: string
) {
  const emailSubject = senderName 
    ? `🎁 You received a ⁦PetWash™⁩ E-Gift Card from ${senderName}!`
    : `🎁 You received a ⁦PetWash™⁩ E-Gift Card!`;

  // Generate secure wallet pass tokens (valid for 72 hours)
  // SECURITY: Will be null if secret not properly configured (fail closed)
  const tokenResult = generateWalletPassToken(voucher.id, 72);
  const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
  const appleWalletUrl = tokenResult ? `${baseUrl}/api/gift-cards/${voucher.id}/wallet/apple?token=${tokenResult.token}` : null;
  const googleWalletUrl = tokenResult ? `${baseUrl}/api/gift-cards/${voucher.id}/wallet/google?token=${tokenResult.token}` : null;
  const walletButtonsEnabled = Boolean(appleWalletUrl && googleWalletUrl);

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; }
        .gift-amount { text-align: center; font-size: 48px; font-weight: bold; color: #ec4899; margin: 20px 0; }
        .qr-code { text-align: center; margin: 30px 0; }
        .qr-code img { max-width: 300px; border: 3px solid #ec4899; border-radius: 12px; }
        .message-box { background: #fef2f2; border-left: 4px solid #ec4899; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .code-box { background: #f9fafb; border: 2px dashed #9ca3af; padding: 20px; text-align: center; font-family: monospace; font-size: 20px; font-weight: bold; margin: 20px 0; border-radius: 8px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 5px; }
        .wallet-btn { display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 8px; font-size: 14px; }
        .apple-btn { background: #000000; color: white; }
        .google-btn { background: #4285F4; color: white; }
        .wallet-section { text-align: center; background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
        .legal { font-size: 10px; color: #9ca3af; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎁 E-Gift Card Received!</h1>
          <p>Premium Organic Pet Care</p>
        </div>
        
        <div class="content">
          <p>Hi ${recipientName},</p>
          
          ${senderName ? `<p><strong>${senderName}</strong> sent you a special gift!</p>` : '<p>You received a special gift!</p>'}
          
          ${message ? `<div class="message-box"><p><em>"${message}"</em></p></div>` : ''}
          
          <div class="gift-amount">₪${voucher.initialAmount}</div>
          
          <p style="text-align: center; font-size: 18px; color: #6b7280;">⁦PetWash™⁩ E-Gift Card</p>
          
          <div class="qr-code">
            <img src="${qrCodeDataURL}" alt="Gift Card QR Code" />
            <p style="color: #6b7280; margin-top: 10px;">Scan this QR code at any K9000 station</p>
          </div>
          
          <div class="code-box">
            ${voucher.codeLast4}
            <p style="font-size: 12px; margin-top: 10px; color: #6b7280;">Gift Card Code (Last 4 digits)</p>
          </div>
          
          ${walletButtonsEnabled ? `
          <!-- 📱 MOBILE WALLET BUTTONS -->
          <div class="wallet-section">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #374151;">Add to Your Mobile Wallet</p>
            <p style="margin: 0 0 15px 0; font-size: 13px; color: #6b7280;">Keep your gift card handy - add it to your phone's wallet for easy access at any K9000 station</p>
            <div>
              <a href="${appleWalletUrl}" class="wallet-btn apple-btn" style="color: white;">
                 Add to Apple Wallet
              </a>
              <a href="${googleWalletUrl}" class="wallet-btn google-btn" style="color: white;">
                🤖 Add to Google Wallet
              </a>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #9ca3af;">Links expire in 72 hours. Open on your mobile device for best experience.</p>
          </div>
          ` : ''}
          
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>✓ How to Use:</strong></p>
            <ul style="margin: 10px 0; color: #166534;">
              <li>Scan QR code at any K9000 wash station</li>
              <li>Or add to Apple Wallet / Google Wallet above</li>
              <li>Valid for 12 months from issue date</li>
              <li>Non-transferable & single-use only</li>
            </ul>
          </div>
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Issue Date: ${new Date(voucher.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
            Expires: ${new Date(voucher.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <div class="footer">
          <p><strong>⁦PetWash™⁩</strong> - Premium Organic Pet Care</p>
          <p>petwash.co.il</p>
          <div class="legal">
            <p>This e-gift card is issued by PetWash Ltd. (Israel Company #516458396)</p>
            <p>Non-refundable. Non-transferable. Cannot be redeemed for cash. Single-use only.</p>
            <p>Blockchain-secured transaction with immutable audit trail.</p>
            <p>© ${new Date().getFullYear()} ⁦PetWash™⁩. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send via Email
  if (deliveryMethod === 'email' || deliveryMethod === 'both') {
    try {
      await EmailService.send({ to: recipientEmail, subject: emailSubject, html: emailHtml });
      logger.info('[E-Gift] Email sent to recipient', { recipientEmail, voucherId: voucher.id });
    } catch (error) {
      logger.error('[E-Gift] Failed to send email to recipient', error, { recipientEmail });
    }
  }

  // Send via WhatsApp
  if ((deliveryMethod === 'whatsapp' || deliveryMethod === 'both') && recipientPhone) {
    const whatsappMessage = `
🎁 *⁦PetWash™⁩ E-Gift Card Received!*

Hi ${recipientName}!

${senderName ? `${senderName} sent you a special gift!` : 'You received a special gift!'}

💰 *Amount:* ₪${voucher.initialAmount}

${message ? `💬 *Message:* "${message}"` : ''}

✅ *How to Use:*
1. Scan the QR code at any K9000 station
2. Or add to your digital wallet
3. Valid for 12 months

🔗 View your gift card:
${process.env.BASE_URL || 'https://petwash.co.il'}/my-wallet

📋 *Gift Card Code:* ${voucher.codeLast4}

⚠️ This card is non-transferable and can only be used once.

---
⁦PetWash™⁩ - Premium Organic Pet Care
petwash.co.il
    `.trim();

    try {
      await GoogleMessagingService.sendWhatsAppMessage(recipientPhone, whatsappMessage);
      logger.info('[E-Gift] WhatsApp sent to recipient', { recipientPhone, voucherId: voucher.id });
    } catch (error) {
      logger.error('[E-Gift] Failed to send WhatsApp to recipient', error, { recipientPhone });
    }
  }
}

// 📧 SEND LUXURY PURCHASE CONFIRMATION TO BUYER
async function sendPurchaseConfirmationToBuyer(
  senderEmail: string,
  senderName: string,
  recipientName: string,
  amount: number,
  voucherId: string,
  transactionHash: string,
  options?: {
    seasonalTheme?: SeasonalTheme;
    language?: 'he' | 'en';
    personalMessage?: string;
    deliveryMethod?: string;
    currency?: string;
  }
) {
  const { subject: emailSubject, html: emailHtml } = generateEGiftPurchaseConfirmation({
    buyerName: senderName,
    buyerEmail: senderEmail,
    recipientName,
    giftValue: amount,
    currency: options?.currency || 'ILS',
    voucherId,
    transactionHash,
    personalMessage: options?.personalMessage,
    deliveryMethod: options?.deliveryMethod || 'email',
    seasonalTheme: options?.seasonalTheme,
    language: options?.language || 'he',
  });

  try {
    await EmailService.send({ to: senderEmail, subject: emailSubject, html: emailHtml });
    logger.info('[E-Gift] Luxury purchase confirmation sent to buyer', { senderEmail, voucherId, theme: options?.seasonalTheme });
  } catch (error) {
    logger.error('[E-Gift] Failed to send confirmation to buyer', error, { senderEmail });
  }
}

// 🎁 PURCHASE E-GIFT CARD (PUBLIC - No Auth Required)
// SECURITY: Payment MUST complete via Nayax BEFORE voucher creation
// Vouchers are created by webhook after successful payment
//
// FREEZE FLAG (PR-W3 / CEO decision Gap 1, Option C):
// PETWASH_EGIFT_PURCHASE_ENABLED is the explicit kill switch for the
// e-gift purchase flow. It defaults to FALSE — purchase is OFF unless
// an operator opts in. Existing balances and webhook-driven flows are
// unaffected. This is a cleaner gate than the implicit "no Nayax keys
// → 503" check that follows: an operator may have keys configured for
// other Nayax flows (kiosk topup) yet still want to keep e-gift
// purchase frozen until the two-phase payment-confirmation pattern is
// fully verified end-to-end.
//
// To enable: set PETWASH_EGIFT_PURCHASE_ENABLED=true in env.
function isEgiftPurchaseEnabled(): boolean {
  const v = (process.env.PETWASH_EGIFT_PURCHASE_ENABLED || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

router.post('/purchase', paymentLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();

  try {
    // Kill-switch — explicit operator opt-in required.
    if (!isEgiftPurchaseEnabled()) {
      logger.info('[E-Gift] Purchase blocked by kill switch', { correlationId });
      return res.status(503).json({
        success: false,
        error: 'E-gift purchase is temporarily unavailable. Please try again later.',
        errorCode: 'EGIFT_PURCHASE_DISABLED',
      });
    }

    // Validate input
    const data = purchaseGiftCardSchema.parse(req.body);
    
    // TEMPORARY: Nayax disabled until API keys are provided
    // TODO: Remove this check once NAYAX_API_KEY is added to secrets
    const nayaxEnabled = process.env.NAYAX_API_KEY && process.env.NAYAX_MERCHANT_ID;
    
    if (!nayaxEnabled) {
      logger.warn('[E-Gift] Nayax payment disabled - API keys not configured');
      return res.status(503).json({
        success: false,
        error: 'Payment gateway temporarily unavailable. Please contact support.',
        developerNote: 'NAYAX_API_KEY and NAYAX_MERCHANT_ID required in environment variables',
      });
    }
    
    // Import Nayax service dynamically
    const { NayaxPaymentService } = await import('../nayaxService');
    
    // CRITICAL: Initiate Nayax payment FIRST (creates pending transaction)
    // Voucher will be created by webhook handler AFTER payment succeeds
    const paymentResult = await NayaxPaymentService.initiatePayment({
      packageId: 1, // E-Gift card package ID
      customerEmail: data.senderEmail || data.recipientEmail,
      customerName: data.senderName || 'Anonymous',
      amount: data.amount,
      currency: 'ILS',
      returnUrl: `${process.env.BASE_URL || 'https://petwash.co.il'}/payment-success`,
      webhookUrl: `${process.env.BASE_URL || 'https://petwash.co.il'}/api/nayax/webhook`,
      isGiftCard: true,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      personalMessage: data.message,
      deliveryMethod: data.deliveryMethod,
    });
    
    if (!paymentResult.success) {
      throw new Error(paymentResult.message || 'Payment initiation failed');
    }
    
    logger.info('[E-Gift] Payment initiated', {
      correlationId,
      transactionId: paymentResult.transactionId,
      amount: data.amount,
      recipientEmail: data.recipientEmail,
      senderEmail: data.senderEmail,
    });
    
    // CRITICAL: Return Nayax payment URL to frontend
    // User will complete payment on Nayax hosted page
    // Webhook will create voucher and send emails AFTER payment succeeds
    res.json({
      success: true,
      transactionId: paymentResult.transactionId,
      paymentUrl: paymentResult.paymentUrl,
      voucherCode: paymentResult.voucherCode,
      message: 'Payment initiated - please complete payment via Nayax',
    });
    
  } catch (error: any) {
    logger.error('[E-Gift] Purchase failed', { error: error.message, correlationId });
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to purchase e-gift card' 
    });
  }
});

// 🔓 REDEEM E-GIFT CARD AT K9000 STATION (ATOMIC SINGLE-USE ENFORCEMENT)
router.post('/redeem', paymentLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();
  
  try {
    const { qrCodeData, stationId, userId } = req.body;
    
    if (!qrCodeData || !stationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Parse QR code
    const qrData = JSON.parse(qrCodeData);
    const { voucherId, code, hash } = qrData;
    
    // Verify code hash
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    
    // 🔒 ATOMIC TRANSACTION: Prevents double-redemption race condition
    // CRITICAL: UPDATE and INSERT must be in same transaction for consistency
    const result = await db.transaction(async (tx) => {
      // ✅ ATOMIC REDEMPTION: Single UPDATE with WHERE conditions
      // Only updates if ALL conditions match (id, code, status='ISSUED', not expired)
      // If any condition fails, returns empty array → no redemption
      const updateResult = await tx
        .update(eVouchers)
        .set({ 
          status: 'REDEEMED',
          activatedAt: new Date(),
          ownerUid: userId || null,
        })
        .where(and(
          eq(eVouchers.id, voucherId),
          eq(eVouchers.codeHash, codeHash),
          eq(eVouchers.status, 'ISSUED'), // ← CRITICAL: Atomic status check
          sql`(${eVouchers.expiresAt} IS NULL OR ${eVouchers.expiresAt} > NOW())` // Handles both NULL (no expiry) and future dates
        ))
        .returning();
      
      // Check if update succeeded (only ONE request can succeed due to status check)
      if (updateResult.length === 0) {
        // Determine WHY redemption failed
        const [checkVoucher] = await tx
          .select({ 
            status: eVouchers.status, 
            expiresAt: eVouchers.expiresAt,
            codeHash: eVouchers.codeHash,
          })
          .from(eVouchers)
          .where(eq(eVouchers.id, voucherId));
        
        if (!checkVoucher) {
          return { 
            success: false, 
            errorCode: 'NOT_FOUND',
            error: 'Gift card not found or invalid code' 
          };
        }
        
        if (checkVoucher.codeHash !== codeHash) {
          return { 
            success: false, 
            errorCode: 'INVALID_CODE',
            error: 'Invalid gift card code' 
          };
        }
        
        if (checkVoucher.status === 'REDEEMED') {
          return { 
            success: false, 
            errorCode: 'ALREADY_REDEEMED',
            error: 'This gift card has already been redeemed',
            status: checkVoucher.status,
          };
        }
        
        if (checkVoucher.expiresAt && new Date(checkVoucher.expiresAt) < new Date()) {
          return { 
            success: false, 
            errorCode: 'EXPIRED',
            error: 'Gift card has expired' 
          };
        }
        
        return { 
          success: false, 
          errorCode: 'UNKNOWN',
          error: 'Gift card cannot be redeemed' 
        };
      }
      
      const [voucher] = updateResult;
      
      // Create immutable redemption record (audit trail) IN SAME TRANSACTION
      // This ensures status='REDEEMED' and redemption record are always consistent
      const [redemption] = await tx.insert(eVoucherRedemptions).values({
        voucherId,
        amount: voucher.remainingAmount,
        locationId: stationId,
        nayaxSessionId: correlationId,
      }).returning();
      
      return {
        success: true,
        voucher,
        redemption,
      };
    });
    
    // Transaction failed - return error to client
    if (!result.success) {
      logger.warn('[E-Gift] Redemption blocked', { 
        correlationId, 
        voucherId,
        errorCode: result.errorCode,
        error: result.error,
      });
      
      const statusCode = result.errorCode === 'NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({ 
        error: result.error,
        errorCode: result.errorCode,
      });
    }
    
    // Transaction succeeded - voucher redeemed atomically
    const { voucher, redemption } = result;
    
    logger.info('[E-Gift] Redemption successful', {
      correlationId,
      voucherId,
      redemptionId: redemption.id,
      stationId,
      amount: voucher.remainingAmount,
      userId,
    });

    eventPublisher.publishEvent(
      DomainEventType.GIFT_REDEEMED,
      {
        voucherId,
        userId: userId || null,
        amountCents: voucher.remainingAmount,
        stationId,
        redemptionId: redemption.id,
      },
      { source: 'gift-cards/redeem', correlationId },
    ).catch((err: any) =>
      logger.error('[E-Gift] GIFT_REDEEMED event publish failed', { error: err?.message, voucherId }),
    );
    
    // Send confirmation email to recipient
    if (voucher.recipientEmail) {
      const confirmationHtml = `
        <h2>✅ Gift Card Redeemed Successfully</h2>
        <p>Your ⁦PetWash™⁩ e-gift card of ₪${voucher.initialAmount} has been redeemed.</p>
        <p><strong>Station:</strong> ${stationId}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString('en-US')}</p>
        <p><strong>Transaction ID:</strong> ${redemption.id}</p>
        <p style="color: #6b7280; font-size: 12px;">This card cannot be used again.</p>
      `;
      
      try {
        await EmailService.send({
          to: voucher.recipientEmail,
          subject: '✅ PetWash™ Gift Card Redeemed',
          html: confirmationHtml,
        });
      } catch (error) {
        logger.error('[E-Gift] Failed to send redemption confirmation', error);
      }
    }
    
    res.json({
      success: true,
      redemptionId: redemption.id,
      amount: voucher.remainingAmount,
      message: 'Gift card redeemed successfully',
    });
    
  } catch (error: any) {
    logger.error('[E-Gift] Redemption error', { error: error.message, correlationId });
    res.status(500).json({ error: 'Failed to redeem gift card' });
  }
});

// 📊 GET VOUCHER STATUS (for scanning/verification)
router.get('/:voucherId/status', async (req, res) => {
  try {
    const { voucherId } = req.params;
    
    const [voucher] = await db
      .select({
        id: eVouchers.id,
        codeLast4: eVouchers.codeLast4,
        initialAmount: eVouchers.initialAmount,
        remainingAmount: eVouchers.remainingAmount,
        status: eVouchers.status,
        expiresAt: eVouchers.expiresAt,
        createdAt: eVouchers.createdAt,
      })
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));
    
    if (!voucher) {
      return res.status(404).json({ error: 'Gift card not found' });
    }
    
    res.json(voucher);
  } catch (error: any) {
    logger.error('[E-Gift] Status check error', { error: error.message });
    res.status(500).json({ error: 'Failed to check gift card status' });
  }
});

// ─── WALLET ERROR PAGE (HTML — shown when user clicks expired/invalid link) ───
function walletErrorPage(opts: {
  title: string;
  titleHe: string;
  body: string;
  bodyHe: string;
  code: number;
  icon: string;
}): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${opts.titleHe} — PetWash™</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{max-width:440px;width:100%;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:20px;
        padding:40px 36px;text-align:center;box-shadow:0 0 60px rgba(212,175,55,.08)}
  .icon{font-size:52px;margin-bottom:20px}
  .brand{font-size:10px;letter-spacing:5px;color:#D4AF37;text-transform:uppercase;margin-bottom:16px}
  h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:10px}
  p{font-size:13px;color:#777;line-height:1.7;margin-bottom:20px}
  .divider{width:40px;height:1px;background:#D4AF37;margin:0 auto 20px;opacity:.3}
  .hint{font-size:12px;color:#555;line-height:1.6;background:#111;border-radius:10px;padding:14px 16px;margin-bottom:24px}
  a.btn{display:inline-block;background:linear-gradient(135deg,#D4AF37,#B8941F);color:#000;
        font-size:12px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;
        letter-spacing:2px;text-transform:uppercase}
  .support{font-size:11px;color:#333;margin-top:20px}
  .support a{color:#555;text-decoration:none}
</style>
</head>
<body>
<div class="card">
  <div class="icon">${opts.icon}</div>
  <div class="brand">PetWash™ Prestige</div>
  <h1>${opts.titleHe}</h1>
  <p>${opts.bodyHe}</p>
  <div class="divider"></div>
  <div class="hint">
    🔑 הQR-קוד שבמייל המקורי תמיד פועל — הוא אינו תלוי בפג תוקף הקישור הזה.
    <br/>פשוט פתח את מייל קבלת הכרטיס ושמור את ה-QR.
  </div>
  <a class="btn" href="https://petwash.co.il/my-wallet">הארנק שלי</a>
  <div class="support">שאלות? <a href="mailto:${CANONICAL_SUPPORT_EMAIL}">${CANONICAL_SUPPORT_EMAIL}</a></div>
</div>
</body>
</html>`;
}

// 🍎 APPLE WALLET PASS FOR E-GIFT CARD
// Public endpoint - uses secure token from email link (no auth required)
router.get('/:voucherId/wallet/apple', walletPassLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();

  // UA detection — Android users who somehow land here get the Google pass instead
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (/android/.test(ua)) {
    const dest = `/api/gift-cards/${req.params.voucherId}/wallet/google${req.query.token ? `?token=${req.query.token}` : ''}`;
    logger.info('[E-Gift Wallet] UA=Android on /wallet/apple — redirecting to /wallet/google', { correlationId });
    return res.redirect(302, dest);
  }

  try {
    const { voucherId } = req.params;
    const { token } = req.query;
    
    // Verify secure token
    if (!token || typeof token !== 'string') {
      logger.warn('[E-Gift Wallet] Missing token', { voucherId, correlationId });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(walletErrorPage({
        title: 'Missing token', titleHe: 'קישור לא תקין',
        body: 'Token missing.', bodyHe: 'הקישור חסר פרמטר אבטחה. בקש קישור חדש מהמייל המקורי.',
        code: 401, icon: '🔒',
      }));
    }
    
    const verifiedVoucherId = verifyWalletPassToken(token);
    if (!verifiedVoucherId || verifiedVoucherId !== voucherId) {
      logger.warn('[E-Gift Wallet] Invalid/expired token', { voucherId, correlationId });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(walletErrorPage({
        title: 'Link expired', titleHe: 'קישור פג תוקף',
        body: 'Token invalid or expired.', bodyHe: 'קישור ה-Wallet פג תוקף (בתוקף 72 שעות). הQR-קוד במייל המקורי עדיין תקף — השתמש/י בו לממש.',
        code: 401, icon: '⏰',
      }));
    }
    
    // Fetch voucher from database
    const [voucher] = await db
      .select()
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));
    
    if (!voucher) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(walletErrorPage({
        title: 'Not found', titleHe: 'כרטיס לא נמצא',
        body: 'Gift card not found.', bodyHe: 'לא נמצא כרטיס מתנה עם מזהה זה. פנה לתמיכה.',
        code: 404, icon: '🎁',
      }));
    }
    
    // Check if voucher is still valid
    if (voucher.status === 'REDEEMED') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(walletErrorPage({
        title: 'Already redeemed', titleHe: 'כרטיס מומש',
        body: 'Already redeemed.', bodyHe: 'כרטיס המתנה כבר מומש. כל קנייה אחת — אחת בלבד.',
        code: 400, icon: '✅',
      }));
    }
    
    if (voucher.status === 'EXPIRED' || (voucher.expiresAt && new Date(voucher.expiresAt) < new Date())) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(walletErrorPage({
        title: 'Card expired', titleHe: 'כרטיס פג תוקף',
        body: 'Gift card expired.', bodyHe: 'כרטיס המתנה פג תוקפו. פנה לתמיכה לחידוש.',
        code: 400, icon: '📅',
      }));
    }
    
    // Check if Apple Wallet is configured
    if (!AppleWalletService.hasValidCertificates()) {
      logger.warn('[E-Gift Wallet] Apple Wallet not configured', { correlationId });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(503).send(walletErrorPage({
        title: 'Apple Wallet unavailable', titleHe: 'Apple Wallet אינו זמין כרגע',
        body: 'Apple Wallet temporarily unavailable.', bodyHe: 'Apple Wallet אינו זמין כרגע. השתמש/י בקוד QR מהמייל לממש ישירות בתחנת K9000.',
        code: 503, icon: '🍎',
      }));
    }
    
    // Generate QR code data for voucher redemption
    const qrData = JSON.stringify({
      type: 'PETWASH_EGIFT',
      voucherId: voucher.id,
      codeLast4: voucher.codeLast4,
      amount: voucher.remainingAmount,
      currency: voucher.currency,
      timestamp: Date.now()
    });
    
    // Generate Apple Wallet pass
    const passBuffer = await AppleWalletService.generateEVoucher({
      voucherId: voucher.id,
      userId: voucher.ownerUid || 'gift-recipient',
      userName: voucher.recipientName || 'Gift Recipient',
      amount: Number(voucher.remainingAmount),
      currency: voucher.currency,
      expiryDate: voucher.expiresAt ? new Date(voucher.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      qrCode: qrData,
      description: `₪${voucher.initialAmount} ⁦PetWash™⁩ E-Gift Card`
    });
    
    logger.info('[E-Gift Wallet] Apple pass generated', { 
      voucherId, 
      correlationId,
      amount: voucher.remainingAmount 
    });
    
    // Send pass file (opens directly in Apple Wallet on iOS)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_GiftCard_${voucher.codeLast4}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);
    
  } catch (error: any) {
    logger.error('[E-Gift Wallet] Apple pass error', { error: error.message, correlationId });
    res.status(500).json({ error: 'Failed to generate Apple Wallet pass' });
  }
});

// 🤖 GOOGLE WALLET PASS FOR E-GIFT CARD
// Public endpoint - uses secure token from email link (no auth required)
router.get('/:voucherId/wallet/google', walletPassLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();

  // UA detection — iPhone/iPad users get the Apple pass instead
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    const dest = `/api/gift-cards/${req.params.voucherId}/wallet/apple${req.query.token ? `?token=${req.query.token}` : ''}`;
    logger.info('[E-Gift Wallet] UA=iOS on /wallet/google — redirecting to /wallet/apple', { correlationId });
    return res.redirect(302, dest);
  }

  try {
    const { voucherId } = req.params;
    const { token } = req.query;
    
    // Verify secure token
    if (!token || typeof token !== 'string') {
      logger.warn('[E-Gift Wallet] Missing token', { voucherId, correlationId });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(walletErrorPage({
        title: 'Missing token', titleHe: 'קישור לא תקין',
        body: 'Token missing.', bodyHe: 'הקישור חסר פרמטר אבטחה. בקש קישור חדש מהמייל המקורי.',
        code: 401, icon: '🔒',
      }));
    }
    
    const verifiedVoucherId = verifyWalletPassToken(token);
    if (!verifiedVoucherId || verifiedVoucherId !== voucherId) {
      logger.warn('[E-Gift Wallet] Invalid/expired token', { voucherId, correlationId });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(walletErrorPage({
        title: 'Link expired', titleHe: 'קישור פג תוקף',
        body: 'Token invalid or expired.', bodyHe: 'קישור ה-Wallet פג תוקף (בתוקף 72 שעות). הQR-קוד במייל המקורי עדיין תקף — השתמש/י בו לממש.',
        code: 401, icon: '⏰',
      }));
    }
    
    // Fetch voucher from database
    const [voucher] = await db
      .select()
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));
    
    if (!voucher) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(walletErrorPage({
        title: 'Not found', titleHe: 'כרטיס לא נמצא',
        body: 'Gift card not found.', bodyHe: 'לא נמצא כרטיס מתנה עם מזהה זה. פנה לתמיכה.',
        code: 404, icon: '🎁',
      }));
    }
    
    // Check if voucher is still valid
    if (voucher.status === 'REDEEMED') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(walletErrorPage({
        title: 'Already redeemed', titleHe: 'כרטיס מומש',
        body: 'Already redeemed.', bodyHe: 'כרטיס המתנה כבר מומש. כל קנייה אחת — אחת בלבד.',
        code: 400, icon: '✅',
      }));
    }
    
    if (voucher.status === 'EXPIRED' || (voucher.expiresAt && new Date(voucher.expiresAt) < new Date())) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(walletErrorPage({
        title: 'Card expired', titleHe: 'כרטיס פג תוקף',
        body: 'Gift card expired.', bodyHe: 'כרטיס המתנה פג תוקפו. פנה לתמיכה לחידוש.',
        code: 400, icon: '📅',
      }));
    }
    
    // Check if Google Wallet is configured
    if (!GoogleWalletService.hasValidCredentials()) {
      logger.warn('[E-Gift Wallet] Google Wallet not configured', { correlationId });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(503).send(walletErrorPage({
        title: 'Google Wallet unavailable', titleHe: 'Google Wallet אינו זמין כרגע',
        body: 'Google Wallet temporarily unavailable.', bodyHe: 'Google Wallet אינו זמין כרגע. השתמש/י בקוד QR מהמייל לממש ישירות בתחנת K9000.',
        code: 503, icon: '🔵',
      }));
    }
    
    // Generate QR code data for voucher redemption
    const qrData = JSON.stringify({
      type: 'PETWASH_EGIFT',
      voucherId: voucher.id,
      codeLast4: voucher.codeLast4,
      amount: voucher.remainingAmount,
      currency: voucher.currency,
      timestamp: Date.now()
    });
    
    // Generate Google Wallet JWT
    const jwt = await GoogleWalletService.generateEVoucherJWT({
      voucherId: voucher.id,
      userId: voucher.ownerUid || 'gift-recipient',
      userName: voucher.recipientName || 'Gift Recipient',
      amount: Number(voucher.remainingAmount),
      currency: voucher.currency,
      expiryDate: voucher.expiresAt ? new Date(voucher.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      qrCode: qrData,
      description: `₪${voucher.initialAmount} ⁦PetWash™⁩ E-Gift Card`
    });
    
    // Construct Google Wallet save URL
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;
    
    logger.info('[E-Gift Wallet] Google pass generated', { 
      voucherId, 
      correlationId,
      amount: voucher.remainingAmount 
    });
    
    // Redirect to Google Wallet save URL
    res.redirect(saveUrl);
    
  } catch (error: any) {
    logger.error('[E-Gift Wallet] Google pass error', { error: error.message, correlationId });
    res.status(500).json({ error: 'Failed to generate Google Wallet pass' });
  }
});

// 🔗 GENERATE WALLET LINKS (for including in emails)
// Internal use - generates secure tokens for wallet pass URLs
router.post('/:voucherId/wallet-links', async (req, res) => {
  try {
    const { voucherId } = req.params;
    
    // Verify voucher exists
    const [voucher] = await db
      .select({ id: eVouchers.id, status: eVouchers.status })
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));
    
    if (!voucher) {
      return res.status(404).json({ error: 'Gift card not found' });
    }
    
    if (voucher.status === 'REDEEMED' || voucher.status === 'EXPIRED') {
      return res.status(400).json({ error: 'Gift card is no longer valid' });
    }
    
    // Generate secure tokens (valid for 72 hours)
    // SECURITY: Returns null if secret not configured (fail closed)
    const tokenResult = generateWalletPassToken(voucherId, 72);
    
    if (!tokenResult) {
      logger.error('[E-Gift Wallet] Cannot generate wallet links - WALLET_LINK_SECRET or COOKIE_SECRET not configured');
      return res.status(503).json({ 
        error: 'Wallet pass feature temporarily unavailable',
        message: 'Mobile wallet integration requires server configuration. Please use the QR code to redeem your gift card.'
      });
    }
    
    const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
    
    res.json({
      success: true,
      appleWalletUrl: `${baseUrl}/api/gift-cards/${voucherId}/wallet/apple?token=${tokenResult.token}`,
      googleWalletUrl: `${baseUrl}/api/gift-cards/${voucherId}/wallet/google?token=${tokenResult.token}`,
      expiresAt: new Date(tokenResult.expiresAt).toISOString(),
      validForHours: 72
    });
    
  } catch (error: any) {
    logger.error('[E-Gift Wallet] Link generation error', { error: error.message });
    res.status(500).json({ error: 'Failed to generate wallet links' });
  }
});

// ── T001: Gift info (public — called by GiftActivate page before auth) ────────
router.get('/:voucherId/info', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const [voucher] = await db
      .select({
        id:            eVouchers.id,
        codeLast4:     eVouchers.codeLast4,
        initialAmount: eVouchers.initialAmount,
        status:        eVouchers.status,
        expiresAt:     eVouchers.expiresAt,
        recipientEmail: eVouchers.recipientEmail,
      })
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));

    if (!voucher) return res.status(404).json({ error: 'Gift card not found' });

    const expired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
    res.json({
      id:            voucher.id,
      codeLast4:     voucher.codeLast4,
      amountIls:     parseFloat(voucher.initialAmount),
      status:        voucher.status,
      expired:       !!expired,
      recipientEmail: voucher.recipientEmail,
    });
  } catch (err: any) {
    logger.error('[E-Gift] info fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch gift info' });
  }
});

// ── T001: Activate gift → credit recipient's wallet ────────────────────────
router.post('/:voucherId/activate-wallet', async (req, res) => {
  const correlationId = crypto.randomUUID();
  try {
    // Require Firebase auth
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const idToken = authHeader.slice(7);
    const decoded = await auth.verifyIdToken(idToken);
    const userId = decoded.uid;

    const { voucherId } = req.params;

    // PR-W44: replay-safe via walletIdempotencyKeys.
    //
    // Pre-PR-W44, the atomic UPDATE-WHERE-status was the ONLY replay
    // protection. A network retry from a flaky mobile client hit the
    // empty-result branch and returned 400 "already activated" — even
    // though the wallet HAD been credited on the first request.
    //
    // The helper now caches the success payload so a retry within TTL
    // returns the same {success, amountIls, amountCents, message}.
    // First-time errors (not found / expired) still throw and bypass
    // the cache so legitimate failures are not memoised.
    //
    // Fingerprint = voucherId:userId. Same caller, same gift = same
    // cached row regardless of how many times mobile retries.
    const result = await runWithIdempotency({
      endpoint: 'gift-cards:activate-wallet',
      headerKey: req.headers['idempotency-key'],
      bodyFingerprint: ({ voucherId, userId }) => `${voucherId}:${userId}`,
      body: { voucherId, userId },
      logContext: { correlationId, voucherId, userId },
      operation: async () => {
        // Atomically mark as REDEEMED — PR-W11 keeps the inArray guard
        // (accepts both 'ISSUED' and 'ACTIVE' entry states).
        const updateResult = await db
          .update(eVouchers)
          .set({
            status:      'REDEEMED',
            ownerUid:    userId,
            activatedAt: new Date(),
          })
          .where(
            and(
              eq(eVouchers.id, voucherId),
              inArray(eVouchers.status, ['ISSUED', 'ACTIVE']),
              sql`(${eVouchers.expiresAt} IS NULL OR ${eVouchers.expiresAt} > NOW())`,
            ),
          )
          .returning({
            id:            eVouchers.id,
            initialAmount: eVouchers.initialAmount,
          });

        if (updateResult.length === 0) {
          // Look up actual state to give the operator a precise error.
          const [voucher] = await db
            .select({ status: eVouchers.status })
            .from(eVouchers)
            .where(eq(eVouchers.id, voucherId));
          const reason = !voucher
            ? 'Gift card not found'
            : voucher.status === 'REDEEMED'
            ? 'This gift card has already been activated'
            : 'Gift card is expired or invalid';
          // THROW so the helper rolls back the lock — first-call errors
          // must NOT be cached. A subsequent retry will re-evaluate the
          // voucher (possibly with a different outcome).
          throw Object.assign(new Error(reason), { statusCode: 400 });
        }

        const amountIls  = parseFloat(updateResult[0].initialAmount);
        const amountCents = Math.round(amountIls * 100);

        await walletService.addCredits(
          userId,
          'egift',
          amountCents,
          'gift_activation',
          voucherId,
          `Gift card #${updateResult[0].id} activated`,
        );

        logger.info('[E-Gift] Gift activated → wallet credited', {
          correlationId, voucherId, userId, amountIls,
        });

        return {
          success:    true,
          amountIls,
          amountCents,
          message:    `₪${amountIls.toFixed(2)} credited to your wallet`,
        };
      },
    });

    if (result.kind === 'in_flight') {
      return res.status(409).json({
        error: 'Activation already in progress',
        errorCode: 'IDEMPOTENCY_IN_FLIGHT',
      });
    }

    if (result.kind === 'replay') {
      // Mobile retry hit. Same payload as the original request.
      logger.info('[E-Gift] activate-wallet replay-cache hit (no double-credit)', {
        correlationId, voucherId, userId,
      });
    }

    res.json(result.response);
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('[E-Gift] activate-wallet error', { error: err.message, correlationId });
    res.status(500).json({ error: 'Failed to activate gift card' });
  }
});

export default router;

// Export token generator for use in email sending
export { generateWalletPassToken };
