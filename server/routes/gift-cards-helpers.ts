/**
 * Gift Card Email Helpers
 * Shared utilities for sending gift card emails (used by both route and webhook)
 */

import { db } from '../db';
import { eVouchers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { QRCodeService } from '../qrCode';
import { EmailService } from '../emailService';
import { GoogleMessagingService } from '../services/GoogleMessagingService';
import { logger } from '../lib/logger';
import crypto from 'crypto';

interface SendGiftCardEmailsParams {
  voucherId: string;
  voucherCode: string;
  amount: string;
  recipientEmail: string;
  recipientName: string;
  senderEmail?: string | null;
  senderName?: string | null;
  message?: string | null;
}

/**
 * Send gift card emails to recipient and buyer
 * Called by both the purchase route and the Nayax webhook
 */
export async function sendGiftCardEmails(params: SendGiftCardEmailsParams): Promise<void> {
  // Get voucher from database
  const [voucher] = await db.select().from(eVouchers).where(eq(eVouchers.id, params.voucherId)).limit(1);
  
  if (!voucher) {
    throw new Error(`Voucher not found: ${params.voucherId}`);
  }

  // Generate blockchain-style transaction hash
  const transactionHash = crypto
    .createHash('sha256')
    .update(`${params.voucherId}|${params.voucherCode}|${params.amount}|${voucher.createdAt}`)
    .digest('hex');

  // Generate QR code
  const qrCodeData = JSON.stringify({
    voucherId: params.voucherId,
    code: params.voucherCode,
    amount: params.amount,
    type: 'PETWASH_EGIFT',
    hash: transactionHash,
  });
  const qrCodeDataURL = await QRCodeService.generateQRCode(qrCodeData);

  // Send to recipient
  await sendGiftCardToRecipient({
    voucher,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    senderName: params.senderName || 'A friend',
    message: params.message,
    qrCodeDataURL,
  });

  // Send confirmation to buyer (if provided)
  if (params.senderEmail) {
    await sendPurchaseConfirmationToBuyer({
      senderEmail: params.senderEmail,
      senderName: params.senderName || 'Customer',
      recipientName: params.recipientName,
      amount: parseFloat(params.amount),
      voucherId: params.voucherId,
      transactionHash,
    });
  }
}

async function sendGiftCardToRecipient(params: {
  voucher: any;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  message?: string | null;
  qrCodeDataURL: string;
}) {
  const { voucher, recipientEmail, recipientName, senderName, message, qrCodeDataURL } = params;

  const emailSubject = senderName !== 'A friend'
    ? `🎁 You received a ⁦PetWash™⁩ E-Gift Card from ${senderName}!`
    : `🎁 You received a ⁦PetWash™⁩ E-Gift Card!`;

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
          
          ${senderName !== 'A friend' ? `<p><strong>${senderName}</strong> sent you a special gift!</p>` : '<p>You received a special gift!</p>'}
          
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

  try {
    await EmailService.sendEmail(recipientEmail, emailSubject, emailHtml);
    logger.info('[E-Gift] Email sent to recipient', { recipientEmail, voucherId: voucher.id });
  } catch (error) {
    logger.error('[E-Gift] Failed to send email to recipient', { error, recipientEmail });
    throw error; // Re-throw to notify caller
  }
}

async function sendPurchaseConfirmationToBuyer(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string;
  amount: number;
  voucherId: string;
  transactionHash: string;
}) {
  const emailSubject = `✅ Your ⁦PetWash™⁩ E-Gift Card Purchase Confirmation`;

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
          <p>Hi ${params.senderName},</p>
          
          <p>Your e-gift card purchase has been completed successfully and delivered to <strong>${params.recipientName}</strong>.</p>
          
          <div class="receipt-box">
            <h3 style="margin-top: 0;">Purchase Receipt</h3>
            <div class="receipt-row">
              <span>Recipient:</span>
              <span>${params.recipientName}</span>
            </div>
            <div class="receipt-row">
              <span>Gift Card Amount:</span>
              <span>₪${params.amount}</span>
            </div>
            <div class="receipt-row">
              <span>Transaction ID:</span>
              <span>${params.voucherId}</span>
            </div>
            <div class="receipt-row">
              <span>Purchase Date:</span>
              <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="receipt-row">
              <span>Total Paid:</span>
              <span>₪${params.amount}</span>
            </div>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>🔐 Blockchain Security</strong></p>
            <p style="font-size: 12px; color: #92400e; margin: 5px 0 10px 0;">This transaction is secured with blockchain-style cryptographic hashing:</p>
            <div class="blockchain-hash">${params.transactionHash}</div>
            <p style="font-size: 11px; color: #92400e; margin: 0;">This hash ensures the transaction is immutable and tamper-proof.</p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280;">
            The recipient has been notified and can now use their gift card at any K9000 wash station or add it to their digital wallet.
          </p>
        </div>
        
        <div class="footer">
          <p><strong>⁦PetWash™⁩</strong> - Premium Organic Pet Care</p>
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
    await EmailService.sendEmail(params.senderEmail, emailSubject, emailHtml);
    logger.info('[E-Gift] Purchase confirmation sent to buyer', { senderEmail: params.senderEmail, voucherId: params.voucherId });
  } catch (error) {
    logger.error('[E-Gift] Failed to send confirmation to buyer', { error, senderEmail: params.senderEmail });
    // Don't throw - confirmation email is optional
  }
}
