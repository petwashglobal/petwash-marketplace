/**
 * Apple Wallet Routes
 * 
 * Endpoints for generating and managing Apple Wallet passes:
 * - VIP loyalty cards
 * - E-vouchers
 * - Pass updates
 * - Email delivery
 */

import express from 'express';
import { AppleWalletService } from '../appleWallet';
import { logger } from '../lib/logger';
import { db } from '../lib/firebase-admin';
import { walletFraudProtection, WalletFraudDetection } from '../middleware/fraudDetection';
import { WalletTelemetryService } from '../services/WalletTelemetryService';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

const router = express.Router();

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ✅ SECURITY: HMAC secret MUST be provided via environment variable (no fallback)
// This prevents attackers from forging wallet links with a known default
const WALLET_LINK_SECRET = process.env.WALLET_LINK_SECRET;

if (!WALLET_LINK_SECRET) {
  logger.error('[SECURITY] WALLET_LINK_SECRET environment variable is not set! Wallet link generation disabled.');
}

/**
 * Generate secure, time-limited wallet pass link
 * Similar to how Apple Card and cinema apps work
 */
function generateSecureWalletLink(params: {
  userId: string;
  passType: 'vip' | 'business' | 'voucher';
  voucherId?: string;
  expiresInMinutes?: number;
}): { linkId: string; token: string; expiresAt: Date; fullUrl: string } | null {
  // ✅ SECURITY: Fail-safe - reject link generation if secret is missing
  if (!WALLET_LINK_SECRET) {
    logger.error('[SECURITY] Cannot generate wallet link - WALLET_LINK_SECRET not configured');
    return null;
  }
  
  const linkId = nanoid(32); // Unique opaque ID
  const expiresAt = new Date(Date.now() + (params.expiresInMinutes || 15) * 60 * 1000);
  
  // Create HMAC token: HMAC(linkId|userId|passType|expires)
  const payload = `${linkId}|${params.userId}|${params.passType}|${expiresAt.getTime()}`;
  const token = crypto
    .createHmac('sha256', WALLET_LINK_SECRET)
    .update(payload)
    .digest('base64url');
  
  const baseUrl = process.env.BASE_URL || 'https://petwash.co.il';
  const fullUrl = `${baseUrl}/api/wallet/pass/${linkId}?token=${token}`;
  
  return { linkId, token, expiresAt, fullUrl };
}

// Apply fraud detection to all wallet endpoints
router.use(walletFraudProtection);

// Middleware to verify Firebase authentication
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    // Check if user is authenticated via session
    const session = req.session as any;
    if (!session?.user?.uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  } catch (error) {
    logger.error('[Wallet API] Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * POST /api/wallet/vip-card/prepare
 * Prepare VIP card download (creates telemetry session)
 * 🔒 Requires authentication
 * Returns telemetry token for client-side tracking
 */
router.post('/vip-card/prepare', requireAuth, async (req, res) => {
  try {
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Create telemetry session
    const telemetryToken = await WalletTelemetryService.createSession({
      userId,
      passType: 'vip',
      platform: 'apple'
    });

    res.json({ 
      success: true,
      telemetryToken,
      downloadUrl: `/api/wallet/vip-card?t=${telemetryToken}`
    });

  } catch (error) {
    logger.error('[Wallet API] Error preparing VIP card:', error);
    res.status(500).json({ 
      error: 'Failed to prepare VIP card' 
    });
  }
});

/**
 * POST /api/wallet/vip-card
 * Generate VIP loyalty card for Apple Wallet
 * 🔒 Requires authentication
 */
router.post('/vip-card', requireAuth, async (req, res) => {
  try {
    // Get authenticated user from session (ignore userId from body for security)
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Load authoritative loyalty data from Firestore (never trust client)
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Get loyalty data from trusted server storage only
    const tier = userData?.loyaltyTier || 'new';
    const points = userData?.loyaltyPoints || 0;
    const discountPercent = userData?.loyaltyDiscountPercent || 0;
    const memberSince = userData?.loyaltyMemberSince?.toDate() || userData?.createdAt?.toDate() || new Date();
    const userName = userData?.displayName || userData?.name || 'VIP Member';
    const userEmail = userData?.email || '';

    // Check if certificates are configured
    if (!AppleWalletService.hasValidCertificates()) {
      return res.status(503).json({ 
        error: 'Apple Wallet is not configured. Please contact support.',
        message: 'Missing Apple Developer certificates'
      });
    }

    // Generate VIP card with server-validated data
    const passBuffer = await AppleWalletService.generateVIPCard({
      userId,
      userName,
      userEmail,
      tier,
      points,
      discountPercent,
      memberSince
    });

    // Log wallet download for fraud detection
    await WalletFraudDetection.logWalletDownload(
      userId,
      userEmail,
      'vip_card',
      req.ip || 'unknown',
      req.headers['user-agent'] || 'unknown'
    );

    // AI-assisted telemetry: record download with UA detection
    const telemetryToken = req.query.t as string;
    if (telemetryToken) {
      await WalletTelemetryService.recordDownload({
        kind: 'apple',
        token: telemetryToken,
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      });
    }

    // Send pass file with inline disposition (opens directly in Apple Wallet on iOS - instant add!)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_VIP_${tier.toUpperCase()}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);

    logger.info('[Wallet API] VIP card generated', { userId, tier });

  } catch (error) {
    logger.error('[Wallet API] Error generating VIP card:', error);
    res.status(500).json({ 
      error: 'Failed to generate VIP card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wallet/e-voucher
 * Generate e-voucher for Apple Wallet
 * 🔒 Requires authentication
 */
router.post('/e-voucher', requireAuth, async (req, res) => {
  try {
    // Get authenticated user from session
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { voucherId } = req.body;

    // Validate voucherId
    if (!voucherId) {
      return res.status(400).json({ error: 'Missing voucherId' });
    }

    // Load authoritative voucher data from Firestore (never trust client)
    const voucherDoc = await db.collection('vouchers').doc(voucherId).get();
    
    if (!voucherDoc.exists) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const voucherData = voucherDoc.data();
    
    // Verify voucher belongs to authenticated user
    if (voucherData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this voucher' });
    }

    // Get user data for display name
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.displayName || userData?.name || 'VIP Member';

    // Get voucher data from trusted server storage only
    const amount = voucherData?.amount || 0;
    const currency = voucherData?.currency || 'ILS';
    const expiryDate = voucherData?.expiryDate?.toDate() || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const qrCode = voucherData?.qrCode || '';
    const description = voucherData?.description || `₪${amount} Pet Wash Voucher`;

    // Check if certificates are configured
    if (!AppleWalletService.hasValidCertificates()) {
      return res.status(503).json({ 
        error: 'Apple Wallet is not configured. Please contact support.' 
      });
    }

    // Generate e-voucher with server-validated data
    const passBuffer = await AppleWalletService.generateEVoucher({
      voucherId,
      userId,
      userName,
      amount,
      currency,
      expiryDate,
      qrCode,
      description
    });

    // AI-assisted telemetry: record download with UA detection
    const telemetryToken = req.query.t as string || await WalletTelemetryService.createSession({
      userId,
      passType: 'voucher',
      platform: 'apple'
    });
    
    await WalletTelemetryService.recordDownload({
      kind: 'apple',
      token: telemetryToken,
      timestamp: new Date(),
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    // Send pass file with inline disposition (opens directly in Apple Wallet on iOS - instant add!)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_Voucher_${voucherId}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);

    logger.info('[Wallet API] E-Voucher generated', { voucherId, userId, amount });

  } catch (error) {
    logger.error('[Wallet API] Error generating E-Voucher:', error);
    res.status(500).json({ 
      error: 'Failed to generate E-Voucher',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wallet/update-vip
 * Update VIP card (points, tier)
 * 🔒 Requires authentication
 */
router.post('/update-vip', requireAuth, async (req, res) => {
  try {
    // Get authenticated user from session
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Load authoritative loyalty data from Firestore (never trust client)
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Get current loyalty data for update
    const points = userData?.loyaltyPoints || 0;
    const tier = userData?.loyaltyTier || 'new';
    const discountPercent = userData?.loyaltyDiscountPercent || 0;

    // Update pass with server-validated current data
    await AppleWalletService.updateVIPCard(userId, {
      points,
      tier,
      discountPercent
    });

    res.json({ success: true, message: 'VIP card updated' });

    logger.info('[Wallet API] VIP card updated', { userId, points, tier });

  } catch (error) {
    logger.error('[Wallet API] Error updating VIP card:', error);
    res.status(500).json({ 
      error: 'Failed to update VIP card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wallet/my-business-card
 * Generate authenticated user's personal business card
 * 🔒 Requires authentication
 */
router.post('/my-business-card', requireAuth, async (req, res) => {
  try {
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Load user data from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    const { customBusinessCard } = req.body;

    // Use custom data if provided, otherwise use user's profile
    const cardData = {
      name: customBusinessCard?.name || userData?.displayName || userData?.name || 'VIP Member',
      title: customBusinessCard?.title || userData?.title || 'VIP Member',
      company: 'Pet Wash™ Ltd',
      email: userData?.email || '',
      phone: customBusinessCard?.phone || userData?.phone || '',
      mobile: customBusinessCard?.mobile || userData?.mobile,
      website: 'https://petwash.co.il',
      socialMedia: customBusinessCard?.socialMedia || {
        tiktok: '@petwash',
        instagram: '@petwash',
        facebook: 'PetWashOfficial'
      }
    };

    if (!AppleWalletService.hasValidCertificates()) {
      return res.status(503).json({ 
        error: 'Apple Wallet is not configured. Please contact support.' 
      });
    }

    const passBuffer = await AppleWalletService.generateBusinessCard(cardData);

    // Send pass file with inline disposition (opens directly in Apple Wallet on iOS - instant add!)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_${cardData.name.replace(/\s+/g, '_')}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);

    logger.info('[Wallet API] Personal business card generated', { userId, name: cardData.name });

  } catch (error) {
    logger.error('[Wallet API] Error generating personal business card:', error);
    res.status(500).json({ 
      error: 'Failed to generate business card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wallet/business-card
 * Generate digital business card for Apple Wallet
 * 🔓 Public endpoint (for team business card sharing)
 */
router.post('/business-card', async (req, res) => {
  try {
    const { name, title, company, email, phone, mobile, website, socialMedia, photoUrl } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, email, phone' 
      });
    }

    if (!AppleWalletService.hasValidCertificates()) {
      return res.status(503).json({ 
        error: 'Apple Wallet is not configured. Please contact support.' 
      });
    }

    const passBuffer = await AppleWalletService.generateBusinessCard({
      name,
      title: title || '',
      company: 'Pet Wash™ Ltd',
      email,
      phone,
      mobile,
      website: website || 'https://petwash.co.il',
      socialMedia: socialMedia || {},
      photoUrl
    });

    // Send pass file with inline disposition (opens directly in Apple Wallet on iOS - instant add!)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="PetWash_${name.replace(/\s+/g, '_')}.pkpass"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);

    logger.info('[Wallet API] Business card generated', { name, email });

  } catch (error) {
    logger.error('[Wallet API] Error generating business card:', error);
    res.status(500).json({ 
      error: 'Failed to generate business card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/wallet/pass/:linkId
 * Direct download link for Apple Wallet passes
 * 🔓 Public endpoint with token validation
 * Opens directly in Apple Wallet when tapped on iOS
 */
router.get('/pass/:linkId', async (req, res) => {
  try {
    // ✅ SECURITY: Ensure wallet link secret is configured
    if (!WALLET_LINK_SECRET) {
      return res.status(503).json({ 
        error: 'Wallet service is not configured',
        message: 'WALLET_LINK_SECRET environment variable is missing'
      });
    }
    
    const { linkId } = req.params;
    const { token } = req.query;
    
    if (!linkId || !token) {
      return res.status(400).json({ error: 'Missing linkId or token' });
    }
    
    // Load link metadata from Firestore
    const linkDoc = await db.collection('wallet_links').doc(linkId).get();
    
    if (!linkDoc.exists) {
      return res.status(404).json({ error: 'Wallet link not found or expired' });
    }
    
    const linkData = linkDoc.data();
    
    if (!linkData) {
      return res.status(404).json({ error: 'Invalid wallet link' });
    }
    
    // Verify link hasn't expired
    const expiresAt = linkData.expiresAt?.toDate();
    if (!expiresAt || expiresAt < new Date()) {
      await db.collection('wallet_links').doc(linkId).delete();
      return res.status(410).json({ error: 'Link expired' });
    }
    
    // Verify token HMAC
    const payload = `${linkId}|${linkData.userId}|${linkData.passType}|${expiresAt.getTime()}`;
    const expectedToken = crypto
      .createHmac('sha256', WALLET_LINK_SECRET)
      .update(payload)
      .digest('base64url');
    
    if (token !== expectedToken) {
      logger.warn('[Wallet API] Invalid token for link', { linkId });
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Check remaining uses (default: single-use)
    const remainingUses = linkData.remainingUses || 0;
    if (remainingUses <= 0) {
      return res.status(410).json({ error: 'Link already used' });
    }
    
    // Load user data from Firestore
    const userDoc = await db.collection('users').doc(linkData.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const userName = userData?.displayName || userData?.name || 'VIP Member';
    const userEmail = userData?.email || '';
    
    // Generate the appropriate pass
    let passBuffer: Buffer;
    let filename: string;
    
    if (linkData.passType === 'vip') {
      const tier = userData?.loyaltyTier || 'new';
      const points = userData?.loyaltyPoints || 0;
      const discountPercent = userData?.loyaltyDiscountPercent || 0;
      const memberSince = userData?.loyaltyMemberSince?.toDate() || userData?.createdAt?.toDate() || new Date();
      
      passBuffer = await AppleWalletService.generateVIPCard({
        userId: linkData.userId,
        userName,
        userEmail,
        tier,
        points,
        discountPercent,
        memberSince
      });
      
      filename = `PetWash_VIP_${tier.toUpperCase()}.pkpass`;
      
    } else if (linkData.passType === 'business') {
      const cardData = {
        name: userName,
        title: userData?.displayName === 'Nir Hadad' ? 'CEO & Founder' : 'VIP Member',
        company: 'Pet Wash™ Ltd',
        email: userEmail,
        phone: userData?.displayName === 'Nir Hadad' ? '+972 549 833 355' : userData?.phone || '',
        mobile: userData?.mobile,
        website: 'https://petwash.co.il',
        socialMedia: {
          tiktok: '@petwash',
          instagram: '@petwash',
          facebook: 'PetWashOfficial'
        }
      };
      
      passBuffer = await AppleWalletService.generateBusinessCard(cardData);
      filename = `PetWash_${userName.replace(/\s+/g, '_')}.pkpass`;
      
    } else {
      return res.status(400).json({ error: 'Unsupported pass type' });
    }
    
    // Decrement remaining uses
    await db.collection('wallet_links').doc(linkId).update({
      remainingUses: remainingUses - 1,
      lastAccessedAt: new Date(),
      lastAccessIp: req.ip,
      lastAccessUserAgent: req.headers['user-agent']
    });
    
    // Log access for fraud detection
    await WalletFraudDetection.logWalletDownload(
      linkData.userId,
      userEmail,
      linkData.passType,
      req.ip || 'unknown',
      req.headers['user-agent'] || 'unknown'
    );
    
    // Serve .pkpass file with inline disposition (opens directly in Wallet on iOS)
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(passBuffer);
    
    logger.info('[Wallet API] Direct pass link accessed', { 
      linkId, 
      userId: linkData.userId, 
      passType: linkData.passType,
      remainingUses: remainingUses - 1
    });
    
  } catch (error) {
    logger.error('[Wallet API] Error serving direct pass link:', error);
    res.status(500).json({ 
      error: 'Failed to generate pass',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wallet/email-cards
 * Email both VIP loyalty card and business card to user
 * 🔒 Requires authentication
 */
router.post('/email-cards', requireAuth, async (req, res) => {
  try {
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Load user data from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    const userEmail = userData?.email || '';
    const userName = userData?.displayName || userData?.name || 'VIP Member';
    
    // CEO override: send to nir.h@petwash.co.il
    const targetEmail = req.body.email || userEmail;
    
    if (!targetEmail) {
      return res.status(400).json({ error: 'No email address available' });
    }

    // Check SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(503).json({ error: 'Email service not configured' });
    }

    if (!AppleWalletService.hasValidCertificates()) {
      return res.status(503).json({ error: 'Apple Wallet is not configured' });
    }

    const tier = userData?.loyaltyTier || 'new';
    const points = userData?.loyaltyPoints || 0;
    const discountPercent = userData?.loyaltyDiscountPercent || 0;

    // Generate secure direct links for VIP and Business cards
    const vipLink = generateSecureWalletLink({
      userId,
      passType: 'vip',
      expiresInMinutes: 60 // 1 hour for email links
    });
    
    const businessLink = generateSecureWalletLink({
      userId,
      passType: 'business',
      expiresInMinutes: 60
    });
    
    // ✅ SECURITY: Ensure wallet links were generated successfully
    if (!vipLink || !businessLink) {
      return res.status(503).json({ 
        error: 'Wallet link generation is not configured',
        message: 'WALLET_LINK_SECRET environment variable is missing'
      });
    }
    
    // Store link metadata in Firestore
    await db.collection('wallet_links').doc(vipLink.linkId).set({
      userId,
      passType: 'vip',
      expiresAt: vipLink.expiresAt,
      remainingUses: 3, // Allow 3 taps (in case user needs to retry)
      createdAt: new Date(),
      createdFor: targetEmail
    });
    
    await db.collection('wallet_links').doc(businessLink.linkId).set({
      userId,
      passType: 'business',
      expiresAt: businessLink.expiresAt,
      remainingUses: 3,
      createdAt: new Date(),
      createdFor: targetEmail
    });

    // Prepare email with direct links (Apple Card style)
    const msg = {
      to: targetEmail,
      from: 'noreply@petwash.co.il',
      subject: `${userName} - Your Premium Pet Wash™ Wallet Cards`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #7C3AED; font-size: 32px; margin-bottom: 10px;">🐾 Premium Wallet Cards</h1>
              <p style="color: #666; font-size: 18px;">Exclusive • Trusted • Beloved</p>
            </div>
            
            <!-- Welcome -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; padding: 30px; color: white; margin-bottom: 30px;">
              <h2 style="margin-top: 0;">Dear ${userName},</h2>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 0;">
                Your premium wallet cards are ready! Tap the buttons below to add them directly to your Apple Wallet.
              </p>
            </div>

            <!-- VIP Card Button -->
            <div style="background: #f8f9fa; border-radius: 15px; padding: 25px; margin-bottom: 20px; text-align: center;">
              <div style="margin-bottom: 15px;">
                <div style="font-size: 24px; margin-bottom: 5px;">💎</div>
                <h3 style="color: #7C3AED; margin: 0 0 5px 0;">VIP ${tier.charAt(0).toUpperCase() + tier.slice(1)} Loyalty Card</h3>
                <p style="color: #666; margin: 0; font-size: 14px;">${discountPercent}% discount • ${points.toLocaleString()} points</p>
              </div>
              <a href="${vipLink.fullUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 10px;">
                ➕ Add VIP Card to Wallet
              </a>
            </div>

            <!-- Business Card Button -->
            <div style="background: #f8f9fa; border-radius: 15px; padding: 25px; margin-bottom: 30px; text-align: center;">
              <div style="margin-bottom: 15px;">
                <div style="font-size: 24px; margin-bottom: 5px;">💼</div>
                <h3 style="color: #EC4899; margin: 0 0 5px 0;">Digital Business Card</h3>
                <p style="color: #666; margin: 0; font-size: 14px;">Share via AirDrop • NFC • QR code</p>
              </div>
              <a href="${businessLink.fullUrl}" style="display: inline-block; background: linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 10px;">
                ➕ Add Business Card to Wallet
              </a>
            </div>

            <!-- Instructions -->
            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #333; margin-top: 0; font-size: 18px;">📱 How It Works:</h3>
              <ol style="line-height: 1.8; color: #666; margin-bottom: 0; padding-left: 20px;">
                <li>Open this email on your iPhone</li>
                <li>Tap the button above</li>
                <li>Apple Wallet opens automatically</li>
                <li>Tap "Add" to save your card!</li>
              </ol>
            </div>

            <!-- Features -->
            <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <h4 style="margin-top: 0; color: #92400E;">✨ Why You'll Love It:</h4>
              <ul style="line-height: 1.8; color: #92400E; margin-bottom: 0; padding-left: 20px;">
                <li>Instant access from Lock Screen</li>
                <li>Auto-updates when you earn points</li>
                <li>Works at all Pet Wash stations</li>
                <li>No app download required!</li>
              </ul>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 14px; margin: 0 0 10px 0;">
                Questions? Contact us at <a href="mailto:Support@PetWash.co.il" style="color: #7C3AED;">Support@PetWash.co.il</a>
              </p>
              <p style="color: #999; font-size: 12px; margin: 0;">
                Pet Wash™ Ltd • Premium Organic Pet Care • Israel
              </p>
              <p style="color: #ccc; font-size: 11px; margin: 15px 0 0 0;">
                Links expire in 1 hour for your security
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Send email via SendGrid
    await sgMail.send(msg);

    logger.info('[Wallet API] Direct wallet links emailed', { 
      userId, 
      targetEmail,
      tier,
      userName,
      vipLinkId: vipLink.linkId,
      businessLinkId: businessLink.linkId
    });

    res.json({ 
      success: true, 
      message: `Direct wallet links sent to ${targetEmail}`,
      email: targetEmail,
      vipLink: vipLink.fullUrl,
      businessLink: businessLink.fullUrl
    });

  } catch (error) {
    logger.error('[Wallet API] Error emailing wallet links:', error);
    res.status(500).json({ 
      error: 'Failed to email wallet links',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/wallet/status
 * Check if Apple Wallet is configured
 */
router.get('/status', (req, res) => {
  const configured = AppleWalletService.hasValidCertificates();
  
  res.json({ 
    configured,
    message: configured 
      ? 'Apple Wallet is ready' 
      : 'Apple Wallet requires configuration'
  });
});

/**
 * GET /api/wallet/user-passes/:userId
 * Get all wallet passes for a user
 * 🔒 Requires authentication - can only view own passes
 */
router.get('/user-passes/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const session = req.session as any;
    const authenticatedUserId = session?.user?.uid;

    // Ensure users can only access their own passes
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const passesSnapshot = await db
      .collection('apple_wallet_passes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const passes = passesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ passes });

  } catch (error) {
    logger.error('[Wallet API] Error fetching user passes:', error);
    res.status(500).json({ error: 'Failed to fetch passes' });
  }
});

/**
 * Apple Wallet Web Service Protocol Implementation
 * Required for dynamic pass updates
 * Docs: https://developer.apple.com/documentation/walletpasses/adding_a_web_service_to_update_passes
 */

/**
 * POST /v1/devices/:deviceID/registrations/:passTypeID/:serialNumber
 * Register device for pass updates
 */
router.post('/v1/devices/:deviceID/registrations/:passTypeID/:serialNumber', async (req, res) => {
  try {
    const { deviceID, passTypeID, serialNumber } = req.params;
    const { pushToken } = req.body;
    const authToken = req.headers.authorization?.replace('ApplePass ', '');

    // Validate pushToken is provided
    if (!pushToken) {
      return res.status(400).json({ error: 'pushToken required' });
    }

    if (!authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify auth token matches the pass
    const passSnapshot = await db
      .collection('apple_wallet_passes')
      .where('serialNumber', '==', serialNumber)
      .limit(1)
      .get();

    if (passSnapshot.empty) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    const passData = passSnapshot.docs[0].data();
    
    // Verify authentication token
    if (passData.authenticationToken !== authToken) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if device is already registered (deduplication)
    const existingRegistration = await db
      .collection('wallet_device_registrations')
      .where('deviceID', '==', deviceID)
      .where('serialNumber', '==', serialNumber)
      .limit(1)
      .get();

    if (!existingRegistration.empty) {
      // Update existing registration
      await existingRegistration.docs[0].ref.update({
        pushToken,
        updatedAt: new Date()
      });
      logger.info('[Wallet Web Service] Device registration updated', { deviceID, serialNumber });
      res.status(200).send();
      return;
    }

    // Store new device registration
    await db.collection('wallet_device_registrations').add({
      deviceID,
      passTypeID,
      serialNumber,
      pushToken,
      registeredAt: new Date(),
      updatedAt: new Date()
    });

    logger.info('[Wallet Web Service] Device registered', { deviceID, serialNumber });
    res.status(201).send();

  } catch (error) {
    logger.error('[Wallet Web Service] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * GET /v1/passes/:passTypeID/:serialNumber
 * Serve updated pass
 */
router.get('/v1/passes/:passTypeID/:serialNumber', async (req, res) => {
  try {
    const { passTypeID, serialNumber } = req.params;
    const authToken = req.headers.authorization?.replace('ApplePass ', '');

    if (!authToken) {
      return res.status(401).send();
    }

    // Get pass metadata
    const passSnapshot = await db
      .collection('apple_wallet_passes')
      .where('serialNumber', '==', serialNumber)
      .limit(1)
      .get();

    if (passSnapshot.empty) {
      return res.status(404).send();
    }

    const passData = passSnapshot.docs[0].data();

    // Verify authentication token
    if (passData.authenticationToken !== authToken) {
      logger.warn('[Wallet Web Service] Invalid auth token', { serialNumber });
      return res.status(401).send();
    }

    // Check if pass has been modified since last update
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince && passData.updatedAt) {
      const lastModified = new Date(passData.updatedAt.toDate());
      const requestDate = new Date(ifModifiedSince);
      
      if (lastModified <= requestDate) {
        return res.status(304).send(); // Not modified
      }
    }

    // Regenerate pass with updated data
    if (passData.type === 'vip_card') {
      const passBuffer = await AppleWalletService.generateVIPCard({
        userId: passData.userId,
        userName: passData.userName || 'VIP Member',
        userEmail: passData.userEmail || '',
        tier: passData.tier,
        points: passData.points || 0,
        discountPercent: passData.discountPercent || 0,
        memberSince: passData.memberSince?.toDate() || new Date()
      });

      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.send(passBuffer);
    } else {
      res.status(404).send();
    }

  } catch (error) {
    logger.error('[Wallet Web Service] Pass retrieval error:', error);
    res.status(500).send();
  }
});

/**
 * DELETE /v1/devices/:deviceID/registrations/:passTypeID/:serialNumber
 * Unregister device
 */
router.delete('/v1/devices/:deviceID/registrations/:passTypeID/:serialNumber', async (req, res) => {
  try {
    const { deviceID, passTypeID, serialNumber } = req.params;
    const authToken = req.headers.authorization?.replace('ApplePass ', '');

    if (!authToken) {
      return res.status(401).send();
    }

    // Verify auth token
    const passSnapshot = await db
      .collection('apple_wallet_passes')
      .where('serialNumber', '==', serialNumber)
      .limit(1)
      .get();

    if (passSnapshot.empty) {
      return res.status(404).send();
    }

    const passData = passSnapshot.docs[0].data();
    if (passData.authenticationToken !== authToken) {
      return res.status(401).send();
    }

    // Remove device registration
    const registrations = await db
      .collection('wallet_device_registrations')
      .where('deviceID', '==', deviceID)
      .where('serialNumber', '==', serialNumber)
      .get();

    const deletePromises = registrations.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    logger.info('[Wallet Web Service] Device unregistered', { deviceID, serialNumber });
    res.status(200).send();

  } catch (error) {
    logger.error('[Wallet Web Service] Unregistration error:', error);
    res.status(500).send();
  }
});

/**
 * POST /api/wallet/nayax/redeem-loyalty
 * Nayax terminal endpoint to scan and validate loyalty QR codes
 * 🔓 Public endpoint - authenticated by terminal secret
 */
router.post('/nayax/redeem-loyalty', async (req, res) => {
  try {
    const { qrData, terminalId, stationId } = req.body;

    // Validate terminal authentication
    const terminalSecret = req.headers['x-terminal-secret'];
    if (terminalSecret !== process.env.NAYAX_TERMINAL_SECRET) {
      return res.status(401).json({ error: 'Invalid terminal authentication' });
    }

    // Parse QR code data
    let loyaltyData;
    try {
      loyaltyData = JSON.parse(qrData);
    } catch {
      return res.status(400).json({ 
        error: 'Invalid QR code format',
        message: 'Unable to parse QR data'
      });
    }

    // Validate QR code structure
    if (loyaltyData.type !== 'PETWASH_VIP_LOYALTY') {
      return res.status(400).json({ 
        error: 'Invalid loyalty card',
        message: 'This QR code is not a Pet Wash VIP loyalty card'
      });
    }

    // Verify user exists and get latest loyalty data
    const userDoc = await db.collection('users').doc(loyaltyData.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'This loyalty card is no longer valid'
      });
    }

    const userData = userDoc.data();
    const currentTier = userData?.loyaltyTier || 'new';
    const currentPoints = userData?.loyaltyPoints || 0;
    const currentDiscount = userData?.loyaltyDiscountPercent || 0;

    // Log the redemption attempt
    await db.collection('loyalty_redemptions').add({
      userId: loyaltyData.userId,
      userEmail: loyaltyData.userEmail,
      terminalId,
      stationId,
      tier: currentTier,
      discountApplied: currentDiscount,
      points: currentPoints,
      timestamp: new Date(),
      qrTimestamp: loyaltyData.timestamp,
      success: true
    });

    logger.info('[Nayax] Loyalty redemption successful', {
      userId: loyaltyData.userId,
      terminalId,
      stationId,
      discount: currentDiscount
    });

    // Return discount information to Nayax terminal
    res.json({
      success: true,
      loyalty: {
        tier: currentTier,
        discountPercent: currentDiscount,
        points: currentPoints,
        userName: userData?.displayName || userData?.name || 'VIP Member'
      },
      message: `${currentDiscount}% VIP discount applied`
    });

  } catch (error) {
    logger.error('[Nayax] Loyalty redemption failed:', error);
    res.status(500).json({ 
      error: 'Redemption failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/wallet/nayax/verify-loyalty
 * Quick verification endpoint for Nayax terminals
 */
router.get('/nayax/verify-loyalty/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const terminalSecret = req.headers['x-terminal-secret'];

    if (terminalSecret !== process.env.NAYAX_TERMINAL_SECRET) {
      return res.status(401).json({ error: 'Invalid terminal authentication' });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    res.json({
      userId,
      tier: userData?.loyaltyTier || 'new',
      discountPercent: userData?.loyaltyDiscountPercent || 0,
      points: userData?.loyaltyPoints || 0,
      active: true
    });

  } catch (error) {
    logger.error('[Nayax] Verification failed:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
