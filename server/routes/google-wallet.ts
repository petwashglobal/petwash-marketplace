/**
 * Google Wallet API Routes
 * 
 * Endpoints for generating Google Wallet passes:
 * - VIP Loyalty Cards (Android)
 * - E-Vouchers
 * - Digital Business Cards
 */

import express from 'express';
import { GoogleWalletService } from '../googleWallet';
import { logger } from '../lib/logger';
import { db } from '../lib/firebase-admin';

const router = express.Router();

// Middleware to verify Firebase authentication
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const session = req.session as any;
    if (!session?.user?.uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  } catch (error) {
    logger.error('[Google Wallet API] Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * POST /api/google-wallet/vip-card
 * Generate VIP loyalty card JWT for Google Wallet
 * 🔒 Requires authentication
 */
router.post('/vip-card', requireAuth, async (req, res) => {
  try {
    // Get authenticated user from session
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Load authoritative loyalty data from Firestore
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

    // Check if Google Wallet credentials are configured
    if (!GoogleWalletService.hasValidCredentials()) {
      return res.status(503).json({ 
        error: 'Google Wallet is not configured. Please contact support.',
        message: 'Missing Google Wallet credentials'
      });
    }

    // Generate JWT for Google Wallet
    const jwt = await GoogleWalletService.generateVIPCardJWT({
      userId,
      userName,
      userEmail,
      tier,
      points,
      discountPercent,
      memberSince
    });

    // Return JWT and save link
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    res.json({ 
      success: true,
      jwt,
      saveUrl
    });

    logger.info('[Google Wallet API] VIP card JWT generated', { userId, tier });

  } catch (error) {
    logger.error('[Google Wallet API] Error generating VIP card:', error);
    res.status(500).json({ 
      error: 'Failed to generate Google Wallet VIP card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/google-wallet/e-voucher
 * Generate e-voucher JWT for Google Wallet
 * 🔒 Requires authentication
 */
router.post('/e-voucher', requireAuth, async (req, res) => {
  try {
    const session = req.session as any;
    const userId = session?.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { voucherId } = req.body;

    if (!voucherId) {
      return res.status(400).json({ error: 'Missing voucherId' });
    }

    // Load authoritative voucher data from Firestore
    const voucherDoc = await db.collection('vouchers').doc(voucherId).get();
    
    if (!voucherDoc.exists) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const voucherData = voucherDoc.data();
    
    // Verify voucher belongs to authenticated user
    if (voucherData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied to this voucher' });
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.displayName || userData?.name || 'VIP Member';

    // Get voucher data from server storage
    const amount = voucherData?.amount || 0;
    const currency = voucherData?.currency || 'ILS';
    const expiryDate = voucherData?.expiryDate?.toDate() || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const qrCode = voucherData?.qrCode || '';
    const description = voucherData?.description || `₪${amount} Pet Wash Voucher`;

    if (!GoogleWalletService.hasValidCredentials()) {
      return res.status(503).json({ 
        error: 'Google Wallet is not configured. Please contact support.' 
      });
    }

    const jwt = await GoogleWalletService.generateEVoucherJWT({
      voucherId,
      userId,
      userName,
      amount,
      currency,
      expiryDate,
      qrCode,
      description
    });

    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    res.json({ 
      success: true,
      jwt,
      saveUrl
    });

    logger.info('[Google Wallet API] E-Voucher JWT generated', { voucherId, userId, amount });

  } catch (error) {
    logger.error('[Google Wallet API] Error generating E-Voucher:', error);
    res.status(500).json({ 
      error: 'Failed to generate Google Wallet voucher',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/google-wallet/business-card
 * Generate digital business card JWT for Google Wallet
 * 🔓 Public endpoint (for business card sharing)
 */
router.post('/business-card', async (req, res) => {
  try {
    const { name, title, company, email, phone, mobile, website, socialMedia, photoUrl } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, email, phone' 
      });
    }

    if (!GoogleWalletService.hasValidCredentials()) {
      return res.status(503).json({ 
        error: 'Google Wallet is not configured. Please contact support.' 
      });
    }

    const jwt = await GoogleWalletService.generateBusinessCardJWT({
      name,
      title: title || '',
      company: company || 'Pet Wash™ Ltd',
      email,
      phone,
      mobile,
      website: website || 'https://petwash.co.il',
      socialMedia: socialMedia || {},
      photoUrl
    });

    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    res.json({ 
      success: true,
      jwt,
      saveUrl
    });

    logger.info('[Google Wallet API] Business card JWT generated', { name, email });

  } catch (error) {
    logger.error('[Google Wallet API] Error generating business card:', error);
    res.status(500).json({ 
      error: 'Failed to generate Google Wallet business card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/google-wallet/status
 * Check if Google Wallet is configured
 */
router.get('/status', (req, res) => {
  const isConfigured = GoogleWalletService.hasValidCredentials();
  
  res.json({
    configured: isConfigured,
    message: isConfigured 
      ? 'Google Wallet is ready' 
      : 'Google Wallet requires configuration'
  });
});

export default router;
