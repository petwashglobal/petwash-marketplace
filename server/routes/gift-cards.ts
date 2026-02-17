import { Router } from 'express';
import { db } from '../db';
import { eVouchers, eVoucherRedemptions } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { QRCodeService } from '../qrCode';
import { EmailService } from '../emailService';
import { GoogleMessagingService } from '../services/GoogleMessagingService';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import { z } from 'zod';
import { paymentLimiter } from '../middleware/rateLimiter';
import { AppleWalletService } from '../appleWallet';
import { GoogleWalletService } from '../googleWallet';
import rateLimit from 'express-rate-limit';
import { generateEGiftPurchaseConfirmation, type SeasonalTheme } from '../email/templates/egift-purchase-confirmation-2026';

// Wallet pass download rate limiter (prevents brute-force token guessing)
const walletPassLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per IP
  message: { error: 'Too many wallet pass requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔐 WALLET PASS TOKEN SECRET (FAIL CLOSED - no fallback for security)
const WALLET_TOKEN_SECRET = process.env.WALLET_LINK_SECRET || process.env.COOKIE_SECRET;

/**
 * Check if wallet pass feature is properly configured
 * Returns false if secret is missing (fail closed)
 */
function isWalletPassConfigured(): boolean {
  return Boolean(WALLET_TOKEN_SECRET && WALLET_TOKEN_SECRET.length >= 32);
}

/**
 * Generate secure, time-limited wallet pass token
 * Uses HMAC to prevent tampering
 * SECURITY: Returns null if secret not configured (fail closed)
 */
function generateWalletPassToken(voucherId: string, expiresInHours = 72): { token: string; expiresAt: number } | null {
  // SECURITY: Fail closed - refuse to generate token without proper secret
  if (!isWalletPassConfigured()) {
    logger.error('[Wallet Token] Cannot generate token - WALLET_LINK_SECRET or COOKIE_SECRET not configured (min 32 chars required)');
    return null;
  }
  
  const expiresAt = Date.now() + (expiresInHours * 60 * 60 * 1000);
  const payload = `${voucherId}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', WALLET_TOKEN_SECRET!)
    .update(payload)
    .digest('base64url');
  
  return {
    token: `${Buffer.from(payload).toString('base64url')}.${signature}`,
    expiresAt
  };
}

/**
 * Verify wallet pass token
 * Returns voucherId if valid, null if invalid/expired
 * SECURITY: Returns null if secret not configured (fail closed)
 */
function verifyWalletPassToken(token: string): string | null {
  // SECURITY: Fail closed - refuse to verify without proper secret
  if (!isWalletPassConfigured()) {
    logger.error('[Wallet Token] Cannot verify token - WALLET_LINK_SECRET or COOKIE_SECRET not configured');
    return null;
  }
  
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;
    
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const [voucherId, expiresAtStr] = payload.split('|');
    const expiresAt = parseInt(expiresAtStr, 10);
    
    // Check expiration
    if (Date.now() > expiresAt) {
      logger.warn('[Wallet Token] Token expired', { voucherId });
      return null;
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', WALLET_TOKEN_SECRET!)
      .update(payload)
      .digest('base64url');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn('[Wallet Token] Invalid signature', { voucherId });
      return null;
    }
    
    return voucherId;
  } catch (error) {
    logger.error('[Wallet Token] Verification error', error);
    return null;
  }
}

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
  amount: z.string().or(z.number()).transform(val => Number(val)),
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
    code += chars.charAt(Math.floor(Math.random() * chars.length));
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
      await EmailService.sendEmail(recipientEmail, emailSubject, emailHtml);
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
    await EmailService.sendEmail(senderEmail, emailSubject, emailHtml);
    logger.info('[E-Gift] Luxury purchase confirmation sent to buyer', { senderEmail, voucherId, theme: options?.seasonalTheme });
  } catch (error) {
    logger.error('[E-Gift] Failed to send confirmation to buyer', error, { senderEmail });
  }
}

// 🎁 PURCHASE E-GIFT CARD (PUBLIC - No Auth Required)
// SECURITY: Payment MUST complete via Nayax BEFORE voucher creation
// Vouchers are created by webhook after successful payment
router.post('/purchase', paymentLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();
  
  try {
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
        await EmailService.sendEmail(
          voucher.recipientEmail,
          '✅ ⁦PetWash™⁩ Gift Card Redeemed',
          confirmationHtml
        );
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

// 🍎 APPLE WALLET PASS FOR E-GIFT CARD
// Public endpoint - uses secure token from email link (no auth required)
router.get('/:voucherId/wallet/apple', walletPassLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();
  
  try {
    const { voucherId } = req.params;
    const { token } = req.query;
    
    // Verify secure token
    if (!token || typeof token !== 'string') {
      logger.warn('[E-Gift Wallet] Missing token', { voucherId, correlationId });
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    
    const verifiedVoucherId = verifyWalletPassToken(token);
    if (!verifiedVoucherId || verifiedVoucherId !== voucherId) {
      logger.warn('[E-Gift Wallet] Invalid token', { voucherId, correlationId });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Fetch voucher from database
    const [voucher] = await db
      .select()
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));
    
    if (!voucher) {
      return res.status(404).json({ error: 'Gift card not found' });
    }
    
    // Check if voucher is still valid
    if (voucher.status === 'REDEEMED') {
      return res.status(400).json({ error: 'This gift card has already been redeemed' });
    }
    
    if (voucher.status === 'EXPIRED' || (voucher.expiresAt && new Date(voucher.expiresAt) < new Date())) {
      return res.status(400).json({ error: 'This gift card has expired' });
    }
    
    // Check if Apple Wallet is configured
    if (!AppleWalletService.hasValidCertificates()) {
      logger.warn('[E-Gift Wallet] Apple Wallet not configured', { correlationId });
      return res.status(503).json({ 
        error: 'Apple Wallet is temporarily unavailable',
        message: 'Please use the QR code to redeem your gift card at any K9000 station'
      });
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
  
  try {
    const { voucherId } = req.params;
    const { token } = req.query;
    
    // Verify secure token
    if (!token || typeof token !== 'string') {
      logger.warn('[E-Gift Wallet] Missing token', { voucherId, correlationId });
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    
    const verifiedVoucherId = verifyWalletPassToken(token);
    if (!verifiedVoucherId || verifiedVoucherId !== voucherId) {
      logger.warn('[E-Gift Wallet] Invalid token', { voucherId, correlationId });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Fetch voucher from database
    const [voucher] = await db
      .select()
      .from(eVouchers)
      .where(eq(eVouchers.id, voucherId));
    
    if (!voucher) {
      return res.status(404).json({ error: 'Gift card not found' });
    }
    
    // Check if voucher is still valid
    if (voucher.status === 'REDEEMED') {
      return res.status(400).json({ error: 'This gift card has already been redeemed' });
    }
    
    if (voucher.status === 'EXPIRED' || (voucher.expiresAt && new Date(voucher.expiresAt) < new Date())) {
      return res.status(400).json({ error: 'This gift card has expired' });
    }
    
    // Check if Google Wallet is configured
    if (!GoogleWalletService.hasValidCredentials()) {
      logger.warn('[E-Gift Wallet] Google Wallet not configured', { correlationId });
      return res.status(503).json({ 
        error: 'Google Wallet is temporarily unavailable',
        message: 'Please use the QR code to redeem your gift card at any K9000 station'
      });
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

export default router;

// Export token generator for use in email sending
export { generateWalletPassToken };
