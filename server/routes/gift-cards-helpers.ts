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
import { generateEGiftPurchaseConfirmation } from '../email/templates/egift-purchase-confirmation-2026';
import { buildWalletUrls } from '../lib/walletPassToken';

const BASE_URL = process.env.BASE_URL || 'https://petwash.co.il';

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
 * Send gift card emails to recipient and buyer.
 * Called by both the purchase route and the Nayax webhook.
 * Both emails include Apple Wallet + Google Wallet pass buttons with secure 72h tokens.
 */
export async function sendGiftCardEmails(params: SendGiftCardEmailsParams): Promise<void> {
  const [voucher] = await db.select().from(eVouchers).where(eq(eVouchers.id, params.voucherId)).limit(1);

  if (!voucher) {
    throw new Error(`Voucher not found: ${params.voucherId}`);
  }

  const transactionHash = crypto
    .createHash('sha256')
    .update(`${params.voucherId}|${params.voucherCode}|${params.amount}|${voucher.createdAt}`)
    .digest('hex');

  const qrCodeData = JSON.stringify({
    voucherId: params.voucherId,
    code: params.voucherCode,
    amount: params.amount,
    type: 'PETWASH_EGIFT',
    hash: transactionHash,
  });
  const qrCodeDataURL = await QRCodeService.generateQRCode(qrCodeData);

  // Generate secure wallet pass URLs (HMAC-signed, 72h expiry)
  const { appleWalletUrl, googleWalletUrl } = buildWalletUrls(params.voucherId, BASE_URL);

  // Email 1: recipient gets QR + wallet pass buttons
  await sendGiftCardToRecipient({
    voucher,
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    senderName: params.senderName || 'A friend',
    message: params.message,
    qrCodeDataURL,
    appleWalletUrl,
    googleWalletUrl,
  });

  // Email 2: buyer gets luxury purchase confirmation + wallet pass buttons
  if (params.senderEmail) {
    await sendPurchaseConfirmationToBuyer({
      senderEmail: params.senderEmail,
      senderName: params.senderName || 'Customer',
      recipientName: params.recipientName,
      amount: parseFloat(params.amount),
      voucherId: params.voucherId,
      transactionHash,
      appleWalletUrl,
      googleWalletUrl,
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
  appleWalletUrl: string | null;
  googleWalletUrl: string | null;
}) {
  const { voucher, recipientEmail, recipientName, senderName, message, qrCodeDataURL, appleWalletUrl, googleWalletUrl } = params;

  const emailSubject = senderName !== 'A friend'
    ? `🎁 You received a ⁦PetWash™⁩ E-Gift Card from ${senderName}!`
    : `🎁 You received a ⁦PetWash™⁩ E-Gift Card!`;

  // Wallet pass buttons block (shown only when passes are configured)
  const walletButtonsHtml = (appleWalletUrl || googleWalletUrl) ? `
    <div style="text-align:center;margin:28px 0 8px;padding:20px;background:#f8f8f8;border-radius:10px;">
      <p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0 0 6px;">📲 Save to your digital wallet</p>
      <p style="font-size:11px;color:#888;margin:0 0 18px;">One tap away — no app needed to redeem</p>
      <div style="display:inline-flex;gap:12px;flex-wrap:wrap;justify-content:center;align-items:center;">
        ${appleWalletUrl ? `<a href="${appleWalletUrl}" target="_blank" rel="noopener" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:13px 24px;border-radius:9px;font-size:13px;font-weight:600;letter-spacing:0.2px;">🍎 Add to Apple Wallet</a>` : ''}
        ${googleWalletUrl ? `<a href="${googleWalletUrl}" target="_blank" rel="noopener" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:13px 24px;border-radius:9px;font-size:13px;font-weight:600;letter-spacing:0.2px;">🔵 Add to Google Wallet</a>` : ''}
      </div>
      <p style="font-size:10px;color:#bbb;margin:14px 0 0;">Links valid for 72 hours · Use QR code below as backup anytime</p>
    </div>
  ` : '';

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
        .qr-code img { max-width: 220px; border: 3px solid #ec4899; border-radius: 12px; }
        .message-box { background: #fef2f2; border-left: 4px solid #ec4899; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .info-list { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { background: #1a1a1a; padding: 24px; text-align: center; color: white; }
        .footer p { margin: 4px 0; font-size: 12px; color: rgba(255,255,255,0.6); }
        .legal { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎁 You've received a gift!</h1>
          <p style="margin:8px 0 0;opacity:0.9;">${senderName} sent you a Pet Wash™ E-Gift Card</p>
        </div>

        <div class="content">
          <p style="font-size:16px;color:#333;">Hi <strong>${recipientName}</strong>,</p>
          <p style="color:#555;">You've received a Pet Wash™ E-Gift Card — premium organic pet care, whenever you need it.</p>

          <div class="gift-amount">₪${voucher.initialAmount || voucher.remainingAmount}</div>

          ${message ? `
          <div class="message-box">
            <p style="margin:0;font-style:italic;color:#666;">"${message}"</p>
            <p style="margin:6px 0 0;font-size:12px;color:#ec4899;">— ${senderName}</p>
          </div>` : ''}

          ${walletButtonsHtml}

          <div class="qr-code">
            <p style="font-size:14px;color:#666;margin-bottom:12px;">Scan at any K9000 wash station to redeem</p>
            <img src="${qrCodeDataURL}" alt="Gift Card QR Code" />
            <p style="font-size:11px;color:#999;margin-top:8px;">Code ending: <strong>****${voucher.codeLast4}</strong></p>
          </div>

          <div class="info-list">
            <p style="margin:0 0 8px;color:#166534;font-weight:600;">✓ How to use your gift card:</p>
            <ul style="margin:0;padding-left:20px;color:#166534;">
              <li>Save to Apple Wallet or Google Wallet above</li>
              <li>Or scan the QR code at any K9000 wash station</li>
              <li>Valid for 12 months from issue date</li>
              <li>Non-transferable &amp; single-use only</li>
            </ul>
          </div>

          <p style="font-size:12px;color:#9ca3af;text-align:center;">
            Issue Date: ${new Date(voucher.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
            Expires: ${new Date(voucher.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div class="footer">
          <p><strong>⁦PetWash™⁩</strong> — Premium Organic Pet Care</p>
          <p><a href="https://petwash.co.il" style="color:#d4af37;text-decoration:none;">petwash.co.il</a></p>
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
    logger.info('[E-Gift] Email sent to recipient', { recipientEmail, voucherId: voucher.id, hasWalletPasses: !!(appleWalletUrl || googleWalletUrl) });
  } catch (error) {
    logger.error('[E-Gift] Failed to send email to recipient', error, { recipientEmail });
    throw error;
  }
}

async function sendPurchaseConfirmationToBuyer(params: {
  senderEmail: string;
  senderName: string;
  recipientName: string;
  amount: number;
  voucherId: string;
  transactionHash: string;
  appleWalletUrl: string | null;
  googleWalletUrl: string | null;
}) {
  const { subject: emailSubject, html: emailHtml } = generateEGiftPurchaseConfirmation({
    buyerName: params.senderName,
    buyerEmail: params.senderEmail,
    recipientName: params.recipientName,
    giftValue: params.amount,
    currency: 'ILS',
    voucherId: params.voucherId,
    transactionHash: params.transactionHash,
    deliveryMethod: 'email',
    language: 'he',
    appleWalletUrl: params.appleWalletUrl,
    googleWalletUrl: params.googleWalletUrl,
  });

  try {
    await EmailService.sendEmail(params.senderEmail, emailSubject, emailHtml);
    logger.info('[E-Gift] Purchase confirmation with wallet passes sent to buyer', {
      senderEmail: params.senderEmail,
      voucherId: params.voucherId,
      hasAppleWallet: !!params.appleWalletUrl,
      hasGoogleWallet: !!params.googleWalletUrl,
    });
  } catch (error) {
    logger.error('[E-Gift] Failed to send confirmation to buyer', error, { senderEmail: params.senderEmail });
  }
}
