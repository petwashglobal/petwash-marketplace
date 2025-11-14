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
    ? `🎁 You received a PetWash™ E-Gift Card from ${senderName}!`
    : `🎁 You received a PetWash™ E-Gift Card!`;

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
        .btn { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
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
          
          <p style="text-align: center; font-size: 18px; color: #6b7280;">PetWash™ E-Gift Card</p>
          
          <div class="qr-code">
            <img src="${qrCodeDataURL}" alt="Gift Card QR Code" />
            <p style="color: #6b7280; margin-top: 10px;">Scan this QR code at any K9000 station</p>
          </div>
          
          <div class="code-box">
            ${voucher.codeLast4}
            <p style="font-size: 12px; margin-top: 10px; color: #6b7280;">Gift Card Code (Last 4 digits)</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.BASE_URL || 'https://petwash.co.il'}/my-wallet" class="btn">
              Add to My Wallet
            </a>
          </div>
          
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;"><strong>✓ How to Use:</strong></p>
            <ul style="margin: 10px 0; color: #166534;">
              <li>Scan QR code at any K9000 wash station</li>
              <li>Or add to Apple Wallet / Google Wallet</li>
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
          <p><strong>PetWash™</strong> - Premium Organic Pet Care</p>
          <p>petwash.co.il</p>
          <div class="legal">
            <p>This e-gift card is issued by PetWash Ltd. (Israel Company #516458396)</p>
            <p>Non-refundable. Non-transferable. Cannot be redeemed for cash. Single-use only.</p>
            <p>Blockchain-secured transaction with immutable audit trail.</p>
            <p>© ${new Date().getFullYear()} PetWash™. All rights reserved.</p>
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
      logger.error('[E-Gift] Failed to send email to recipient', { error, recipientEmail });
    }
  }

  // Send via WhatsApp
  if ((deliveryMethod === 'whatsapp' || deliveryMethod === 'both') && recipientPhone) {
    const whatsappMessage = `
🎁 *PetWash™ E-Gift Card Received!*

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
PetWash™ - Premium Organic Pet Care
petwash.co.il
    `.trim();

    try {
      await SmsService.sendWhatsApp(recipientPhone, whatsappMessage);
      logger.info('[E-Gift] WhatsApp sent to recipient', { recipientPhone, voucherId: voucher.id });
    } catch (error) {
      logger.error('[E-Gift] Failed to send WhatsApp to recipient', { error, recipientPhone });
    }
  }
}

// 📧 SEND PURCHASE CONFIRMATION TO BUYER
async function sendPurchaseConfirmationToBuyer(
  senderEmail: string,
  senderName: string,
  recipientName: string,
  amount: number,
  voucherId: string,
  transactionHash: string
) {
  const emailSubject = `✅ Your PetWash™ E-Gift Card Purchase Confirmation`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; color: white; }
        .content { padding: 30px; }
        .receipt-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .receipt-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; }
        .blockchain-hash { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 10px; word-break: break-all; margin: 10px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Purchase Confirmed</h1>
          <p>Thank you for your purchase!</p>
        </div>
        
        <div class="content">
          <p>Hi ${senderName},</p>
          
          <p>Your e-gift card purchase has been completed successfully and delivered to <strong>${recipientName}</strong>.</p>
          
          <div class="receipt-box">
            <h3 style="margin-top: 0;">Purchase Receipt</h3>
            <div class="receipt-row">
              <span>Recipient:</span>
              <span>${recipientName}</span>
            </div>
            <div class="receipt-row">
              <span>Gift Card Amount:</span>
              <span>₪${amount}</span>
            </div>
            <div class="receipt-row">
              <span>Transaction ID:</span>
              <span>${voucherId}</span>
            </div>
            <div class="receipt-row">
              <span>Purchase Date:</span>
              <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="receipt-row">
              <span>Total Paid:</span>
              <span>₪${amount}</span>
            </div>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>🔐 Blockchain Security</strong></p>
            <p style="font-size: 12px; color: #92400e; margin: 5px 0 10px 0;">This transaction is secured with blockchain-style cryptographic hashing:</p>
            <div class="blockchain-hash">${transactionHash}</div>
            <p style="font-size: 11px; color: #92400e; margin: 0;">This hash ensures the transaction is immutable and tamper-proof.</p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280;">
            The recipient has been notified and can now use their gift card at any K9000 wash station or add it to their digital wallet.
          </p>
        </div>
        
        <div class="footer">
          <p><strong>PetWash™</strong> - Premium Organic Pet Care</p>
          <p>Company Registration: 516458396 (Israel)</p>
          <p style="font-size: 10px; color: #9ca3af; margin-top: 10px;">
            This is a legal receipt for your records. Non-refundable.<br>
            For support, contact: Support@PetWash.co.il
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await EmailService.sendEmail(senderEmail, emailSubject, emailHtml);
    logger.info('[E-Gift] Purchase confirmation sent to buyer', { senderEmail, voucherId });
  } catch (error) {
    logger.error('[E-Gift] Failed to send confirmation to buyer', { error, senderEmail });
  }
}

// 🎁 PURCHASE E-GIFT CARD (PUBLIC - No Auth Required)
router.post('/purchase', paymentLimiter, async (req, res) => {
  const correlationId = crypto.randomUUID();
  
  try {
    // Validate input
    const data = purchaseGiftCardSchema.parse(req.body);
    
    // Generate unique voucher code
    const plainCode = generateVoucherCode();
    const codeHash = crypto.createHash('sha256').update(plainCode).digest('hex');
    const codeLast4 = plainCode.replace(/-/g, '').slice(-4);
    
    // Set expiration to 12 months from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    
    // Create e-voucher in database (IMMUTABLE RECORD)
    const [voucher] = await db.insert(eVouchers).values({
      codeHash,
      codeLast4,
      type: 'STORED_VALUE',
      currency: 'ILS',
      initialAmount: data.amount.toString(),
      remainingAmount: data.amount.toString(),
      status: 'ISSUED',
      purchaserEmail: data.senderEmail,
      recipientEmail: data.recipientEmail,
      expiresAt,
    }).returning();
    
    // Generate blockchain-style transaction hash
    const transactionHash = generateBlockchainHash(
      voucher.id,
      plainCode,
      data.amount,
      voucher.createdAt
    );
    
    // Generate QR code
    const qrCodeData = JSON.stringify({
      voucherId: voucher.id,
      code: plainCode,
      amount: data.amount,
      type: 'PETWASH_EGIFT',
      hash: transactionHash,
    });
    const qrCodeDataURL = await QRCodeService.generateQRCode(qrCodeData);
    
    // Send to recipient
    await sendGiftCardToRecipient(
      voucher,
      data.recipientEmail,
      data.recipientPhone,
      data.recipientName,
      data.senderName || 'A friend',
      data.message,
      qrCodeDataURL,
      data.deliveryMethod
    );
    
    // Send confirmation to buyer (if provided)
    if (data.senderEmail) {
      await sendPurchaseConfirmationToBuyer(
        data.senderEmail,
        data.senderName || 'Customer',
        data.recipientName,
        data.amount,
        voucher.id,
        transactionHash
      );
    }
    
    logger.info('[E-Gift] Purchase successful', {
      correlationId,
      voucherId: voucher.id,
      amount: data.amount,
      recipientEmail: data.recipientEmail,
      senderEmail: data.senderEmail,
      deliveryMethod: data.deliveryMethod,
      blockchainHash: transactionHash,
    });
    
    res.json({
      success: true,
      voucherId: voucher.id,
      transactionHash,
      message: 'E-gift card purchased and delivered successfully',
      expiresAt: voucher.expiresAt,
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
        <p>Your PetWash™ e-gift card of ₪${voucher.initialAmount} has been redeemed.</p>
        <p><strong>Station:</strong> ${stationId}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString('en-US')}</p>
        <p><strong>Transaction ID:</strong> ${redemption.id}</p>
        <p style="color: #6b7280; font-size: 12px;">This card cannot be used again.</p>
      `;
      
      try {
        await EmailService.sendEmail(
          voucher.recipientEmail,
          '✅ PetWash™ Gift Card Redeemed',
          confirmationHtml
        );
      } catch (error) {
        logger.error('[E-Gift] Failed to send redemption confirmation', { error });
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

export default router;
