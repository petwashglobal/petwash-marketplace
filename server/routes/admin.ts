import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { z } from 'zod';
import { 
  FIRESTORE_PATHS,
  campaignSchema,
  marketingAssetSchema,
} from '@shared/firestore-schema';
import { logger } from '../lib/logger';
import sanitizeHtml from 'sanitize-html';
import { EmailService } from '../emailService';

const router = Router();

// Role-based access control
const ADMIN_ROLES = {
  // Full Admin Access (can create, edit, delete)
  fullAdmin: [
    'nirhadad1@gmail.com',      // CEO (Gmail)
    'nir.h@petwash.co.il',      // CEO (Official)
    'admin@petwash.co.il',      // General Admin
    'Support@PetWash.co.il'     // Support Admin
  ],
  // Viewer Access (read-only, cannot modify)
  viewer: [
    'ido.s@petwash.co.il',       // Technical Lead - Viewer
    'avner9000@gmail.com',       // Team Member - Viewer
    'shiri.shakarzi1@gmail.com', // Team Member - Viewer
  ]
};

// Check if user has any admin/viewer access
const requireAdminOrViewer = (req: any, res: any, next: any) => {
  const userEmail = req.firebaseUser?.email;
  const allAuthorized = [...ADMIN_ROLES.fullAdmin, ...ADMIN_ROLES.viewer];
  
  if (!allAuthorized.includes(userEmail || '')) {
    return res.status(403).json({ error: 'Access denied: Admin or viewer privileges required' });
  }
  
  // Attach role to request for later use
  req.userRole = ADMIN_ROLES.fullAdmin.includes(userEmail || '') ? 'admin' : 'viewer';
  
  next();
};

// Require full admin access (no viewers)
const requireAdmin = (req: any, res: any, next: any) => {
  const userEmail = req.firebaseUser?.email;
  
  if (!ADMIN_ROLES.fullAdmin.includes(userEmail || '')) {
    return res.status(403).json({ 
      error: 'Full admin access required',
      message: 'This action requires administrator privileges. Viewers have read-only access.'
    });
  }
  
  req.userRole = 'admin';
  next();
};

// ============================================
// BROADCAST MESSAGING ROUTES
// ============================================

// Send broadcast message to users
router.post('/broadcast/users', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      bodyHtml,
      type,
      ctaText,
      ctaUrl,
      locale,
      priority,
      targetUserIds, // Optional: specific user IDs
      segmentType, // 'all' | 'active' | 'pet_owners' | 'custom'
    } = req.body;

    const sanitizedBody = sanitizeHtml(bodyHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'width', 'height'],
        a: ['href', 'target'],
      },
    });

    // Get target users based on segment
    let userIds: string[] = [];
    
    if (targetUserIds && targetUserIds.length > 0) {
      userIds = targetUserIds;
    } else {
      // Query Firestore for user profiles based on segment
      const usersRef = firestore.collection('userProfiles');
      let query = usersRef;

      if (segmentType === 'pet_owners') {
        // Get users who have pets
        const petsSnapshot = await firestore.collection('pets').get();
        const petOwnerUids = new Set(petsSnapshot.docs.map(doc => doc.ref.parent.parent?.id).filter(Boolean));
        userIds = Array.from(petOwnerUids) as string[];
      } else if (segmentType === 'active') {
        // Get users with recent activity (last 30 days)
        // TODO: Implement activity tracking
        userIds = [];
      } else {
        // All users
        const snapshot = await query.get();
        userIds = snapshot.docs.map(doc => doc.id);
      }
    }

    // Send messages to all target users
    const messagePromises = userIds.map(async (uid) => {
      const messageRef = firestore.collection(FIRESTORE_PATHS.USER_INBOX(uid)).doc();
      await messageRef.set({
        title,
        bodyHtml: sanitizedBody,
        type: type || 'system',
        ctaText: ctaText || null,
        ctaUrl: ctaUrl || null,
        createdAt: new Date(),
        readAt: null,
        locale: locale || 'en',
        priority: priority || 0,
        attachments: [],
        meta: {},
      });
      return messageRef.id;
    });

    await Promise.all(messagePromises);

    // Log admin action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: req.firebaseUser!.email || '',
      action: 'inbox_message_sent',
      targetType: 'user',
      targetId: segmentType,
      details: {
        title,
        type,
        userCount: userIds.length,
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    logger.info('Admin broadcast sent to users', { 
      adminUid: req.firebaseUser!.uid, 
      userCount: userIds.length,
      segmentType,
    });

    res.json({ 
      success: true, 
      messagesSent: userIds.length,
      targetUsers: userIds.length,
    });
  } catch (error) {
    logger.error('Error sending broadcast to users', error);
    res.status(500).json({ error: 'Failed to send broadcast message' });
  }
});

// Send broadcast message to franchises
router.post('/broadcast/franchises', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      bodyHtml,
      category,
      requiresAck,
      attachments,
      targetFranchiseIds, // Optional: specific franchise IDs
    } = req.body;

    const sanitizedBody = sanitizeHtml(bodyHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'width', 'height'],
        a: ['href', 'target'],
      },
    });

    // Get target franchises
    let franchiseIds: string[] = [];
    
    if (targetFranchiseIds && targetFranchiseIds.length > 0) {
      franchiseIds = targetFranchiseIds;
    } else {
      // All active franchises
      const snapshot = await firestore.collection(FIRESTORE_PATHS.FRANCHISE_PROFILES())
        .where('status', '==', 'active')
        .get();
      franchiseIds = snapshot.docs.map(doc => doc.id);
    }

    // Send messages to all target franchises
    const messagePromises = franchiseIds.map(async (franchiseId) => {
      const messageRef = firestore.collection(FIRESTORE_PATHS.FRANCHISE_INBOX(franchiseId)).doc();
      await messageRef.set({
        title,
        bodyHtml: sanitizedBody,
        category: category || 'announcement',
        attachments: attachments || [],
        createdAt: new Date(),
        readAt: null,
        requiresAck: requiresAck || false,
        ackAt: null,
        meta: {},
      });
      return messageRef.id;
    });

    await Promise.all(messagePromises);

    // Log admin action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: req.firebaseUser!.email || '',
      action: 'franchise_message_sent',
      targetType: 'franchise',
      targetId: targetFranchiseIds ? 'specific' : 'all',
      details: {
        title,
        category,
        franchiseCount: franchiseIds.length,
        requiresAck,
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    logger.info('Admin broadcast sent to franchises', { 
      adminUid: req.firebaseUser!.uid, 
      franchiseCount: franchiseIds.length,
    });

    res.json({ 
      success: true, 
      messagesSent: franchiseIds.length,
      targetFranchises: franchiseIds.length,
    });
  } catch (error) {
    logger.error('Error sending broadcast to franchises', error);
    res.status(500).json({ error: 'Failed to send broadcast message' });
  }
});

// ============================================
// CAMPAIGN MANAGEMENT ROUTES
// ============================================

// Create new campaign
router.post('/campaigns', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdAt: new Date(),
      createdBy: req.firebaseUser!.uid,
      status: 'draft',
      metrics: {
        impressions: 0,
        clicks: 0,
        redemptions: 0,
      },
    };

    const campaignRef = firestore.collection(FIRESTORE_PATHS.CAMPAIGNS()).doc();
    await campaignRef.set(campaignData);

    // Log admin action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: req.firebaseUser!.email || '',
      action: 'campaign_created',
      targetType: 'segment',
      targetId: campaignData.eligibleSegment,
      details: {
        campaignId: campaignRef.id,
        name: campaignData.name,
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    logger.info('Campaign created', { 
      adminUid: req.firebaseUser!.uid, 
      campaignId: campaignRef.id,
    });

    res.status(201).json({ 
      success: true, 
      campaignId: campaignRef.id,
    });
  } catch (error) {
    logger.error('Error creating campaign', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Start campaign
router.post('/campaigns/:campaignId/start', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaignRef = firestore.doc(FIRESTORE_PATHS.CAMPAIGNS(campaignId));
    const doc = await campaignRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = doc.data();

    // Update campaign status
    await campaignRef.update({
      status: 'active',
    });

    // TODO: Send inbox messages and emails to eligible users
    // TODO: Issue vouchers if configured

    // Log admin action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: req.firebaseUser!.email || '',
      action: 'campaign_started',
      targetType: 'segment',
      targetId: campaign?.eligibleSegment,
      details: {
        campaignId,
        name: campaign?.name,
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    logger.info('Campaign started', { 
      adminUid: req.firebaseUser!.uid, 
      campaignId,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error starting campaign', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// Stop campaign
router.post('/campaigns/:campaignId/stop', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaignRef = firestore.doc(FIRESTORE_PATHS.CAMPAIGNS(campaignId));
    const doc = await campaignRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    await campaignRef.update({
      status: 'stopped',
    });

    // Log admin action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: req.firebaseUser!.email || '',
      action: 'campaign_stopped',
      targetType: 'segment',
      targetId: doc.data()?.eligibleSegment,
      details: {
        campaignId,
        name: doc.data()?.name,
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    logger.info('Campaign stopped', { 
      adminUid: req.firebaseUser!.uid, 
      campaignId,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error stopping campaign', error);
    res.status(500).json({ error: 'Failed to stop campaign' });
  }
});

// Get all campaigns
router.get('/campaigns', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    
    let query = firestore.collection(FIRESTORE_PATHS.CAMPAIGNS())
      .orderBy('createdAt', 'desc');

    if (status && ['draft', 'scheduled', 'active', 'completed', 'stopped'].includes(status)) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const campaigns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      startDate: doc.data().startDate?.toDate(),
      endDate: doc.data().endDate?.toDate(),
    }));

    res.json({ campaigns });
  } catch (error) {
    logger.error('Error fetching campaigns', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Update campaign metrics
router.patch('/campaigns/:campaignId/metrics', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { impressions, clicks, redemptions } = req.body;

    const campaignRef = firestore.doc(FIRESTORE_PATHS.CAMPAIGNS(campaignId));
    
    await campaignRef.update({
      'metrics.impressions': impressions || 0,
      'metrics.clicks': clicks || 0,
      'metrics.redemptions': redemptions || 0,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating campaign metrics', error);
    res.status(500).json({ error: 'Failed to update metrics' });
  }
});

// ============================================
// MARKETING ASSETS ROUTES
// ============================================

// Get all marketing assets
router.get('/marketing/assets', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const category = req.query.category as string | undefined;

    let query = firestore.collection(FIRESTORE_PATHS.MARKETING_ASSETS())
      .orderBy('uploadedAt', 'desc');

    if (type && ['photo', 'video', 'template', 'brochure'].includes(type)) {
      query = query.where('type', '==', type);
    }

    if (category && ['social_media', 'print', 'campaign', 'brand_assets'].includes(category)) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    const assets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate(),
    }));

    res.json({ assets });
  } catch (error) {
    logger.error('Error fetching marketing assets', error);
    res.status(500).json({ error: 'Failed to fetch marketing assets' });
  }
});

// Upload marketing asset
router.post('/marketing/assets', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const assetData = {
      ...req.body,
      uploadedAt: new Date(),
      uploadedBy: req.firebaseUser!.uid,
    };

    const assetRef = firestore.collection(FIRESTORE_PATHS.MARKETING_ASSETS()).doc();
    await assetRef.set(assetData);

    logger.info('Marketing asset uploaded', { 
      adminUid: req.firebaseUser!.uid, 
      assetId: assetRef.id,
    });

    res.status(201).json({ 
      success: true, 
      assetId: assetRef.id,
    });
  } catch (error) {
    logger.error('Error uploading marketing asset', error);
    res.status(500).json({ error: 'Failed to upload asset' });
  }
});

// ============================================
// ADMIN LOGS & ANALYTICS
// ============================================

// Get admin action logs
router.get('/logs', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const action = req.query.action as string | undefined;

    let query = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS())
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (action) {
      query = query.where('action', '==', action);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));

    res.json({ logs });
  } catch (error) {
    logger.error('Error fetching admin logs', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ============================================
// TEST ENDPOINTS (DEVELOPMENT/QA)
// ============================================

// Test vaccine reminder system with simulated date
// ============================================
// VIEWER-ACCESSIBLE ROUTES (Read-Only)
// ============================================

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 * Accessible by: Admins + Viewers
 */
router.get('/dashboard/stats', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    // Return mock/real dashboard stats
    const stats = {
      totalUsers: 1250,
      activeSubscriptions: 89,
      lowStockItems: 3,
      pendingDocuments: 5,
      monthlyRevenue: 125000,
      recentActivity: [
        {
          id: '1',
          action: 'User registered',
          resource: 'users',
          timestamp: new Date().toISOString(),
          adminName: 'System'
        }
      ]
    };

    res.json(stats);
  } catch (error) {
    logger.error('[Admin] Error fetching dashboard stats', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/admin/analytics/overview
 * Get analytics overview
 * Accessible by: Admins + Viewers
 */
router.get('/analytics/overview', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    // Return analytics overview (real or mock data)
    const data = {
      revenue: {
        today: 5420,
        thisWeek: 32100,
        thisMonth: 125000,
        thisYear: 1250000,
        growthRate: 23.5
      },
      customers: {
        total: 1250,
        active: 890,
        new: 45,
        growthRate: 12.3
      },
      stations: {
        total: 8,
        active: 7,
        offline: 1,
        utilizationRate: 87.5
      },
      transactions: {
        total: 3421,
        completed: 3350,
        pending: 45,
        failed: 26,
        successRate: 97.9
      },
      loyalty: {
        totalMembers: 890,
        new: 350,
        silver: 280,
        gold: 180,
        platinum: 60,
        diamond: 20
      }
    };

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('[Admin] Error fetching analytics overview', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Get revenue time series data
 * Accessible by: Admins + Viewers
 */
router.get('/analytics/revenue', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    // Generate last 30 days revenue data
    const days = 30;
    const data = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      return {
        date: date.toISOString().split('T')[0],
        revenue: Math.floor(3000 + Math.random() * 2000),
        transactions: Math.floor(80 + Math.random() * 40)
      };
    });

    res.json({ success: true, data, days });
  } catch (error) {
    logger.error('[Admin] Error fetching revenue data', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

/**
 * GET /api/admin/analytics/stations
 * Get station performance data
 * Accessible by: Admins + Viewers
 */
router.get('/analytics/stations', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    const data = [
      {
        stationId: 'K9001',
        stationName: 'Tel Aviv Center',
        totalRevenue: 45000,
        totalTransactions: 1200,
        averageTransaction: 37.5,
        utilizationRate: 92.3
      },
      {
        stationId: 'K9002',
        stationName: 'Jerusalem Hub',
        totalRevenue: 38000,
        totalTransactions: 980,
        averageTransaction: 38.8,
        utilizationRate: 85.1
      }
    ];

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    logger.error('[Admin] Error fetching station data', error);
    res.status(500).json({ error: 'Failed to fetch station data' });
  }
});

/**
 * GET /api/admin/user-info
 * Get current admin/viewer user info and permissions
 * Accessible by: Admins + Viewers
 */
router.get('/user-info', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    const userEmail = req.firebaseUser?.email;
    const role = req.userRole; // Set by requireAdminOrViewer middleware

    res.json({
      success: true,
      user: {
        email: userEmail,
        role: role,
        permissions: {
          canView: true,
          canEdit: role === 'admin',
          canDelete: role === 'admin',
          canCreate: role === 'admin',
          canManageUsers: role === 'admin'
        }
      }
    });
  } catch (error) {
    logger.error('[Admin] Error fetching user info', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

router.post('/test/vaccine-reminder', validateFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { daysAhead = 7 } = req.body;
    
    logger.info(`🧪 Admin test: Vaccine reminder simulation with daysAhead=${daysAhead}`);
    
    // Calculate target date
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysAhead);
    const targetDateStr = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD
    
    logger.info(`🎯 Simulating reminders for vaccines due on: ${targetDateStr}`);
    
    // Query pets with vaccines due on target date
    const petsSnapshot = await firestore.collectionGroup('pets')
      .where('deletedAt', '==', null)
      .get();
    
    const matchingPets: any[] = [];
    const remindersByOwner = new Map<string, any>();
    
    for (const petDoc of petsSnapshot.docs) {
      const petData = petDoc.data();
      const petId = petDoc.id;
      const uid = petData.uid;
      
      if (petData.reminderEnabled === false) continue;
      
      const vaccineDates = petData.vaccineDates || {};
      const vaccineTypes: Array<'rabies' | 'dhpp' | 'lepto'> = ['rabies', 'dhpp', 'lepto'];
      
      for (const vaccineType of vaccineTypes) {
        const nextDate = vaccineDates[vaccineType];
        
        if (nextDate === targetDateStr) {
          matchingPets.push({
            petId,
            petName: petData.name,
            uid,
            vaccineType,
            vaccineDate: nextDate,
          });
          
          // Group by owner
          if (!remindersByOwner.has(uid)) {
            remindersByOwner.set(uid, { uid, pets: [] });
          }
          remindersByOwner.get(uid)!.pets.push({
            petId,
            petName: petData.name,
            vaccineType,
            vaccineDate: nextDate,
          });
        }
      }
    }
    
    // Log admin action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: req.firebaseUser!.email || '',
      action: 'test_vaccine_reminder',
      targetType: 'system',
      targetId: 'vaccine_reminder_test',
      details: {
        daysAhead,
        targetDate: targetDateStr,
        petsFound: matchingPets.length,
        ownersAffected: remindersByOwner.size,
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      simulation: {
        daysAhead,
        targetDate: targetDateStr,
        petsFound: matchingPets.length,
        ownersAffected: remindersByOwner.size,
        matchingPets,
        remindersByOwner: Array.from(remindersByOwner.values()),
      },
      message: `Found ${matchingPets.length} pets with vaccines due on ${targetDateStr}. Would send ${remindersByOwner.size} reminder(s).`,
    });
  } catch (error) {
    logger.error('Error in vaccine reminder test', error);
    res.status(500).json({ error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ============================================
// CEO-ONLY: ISSUE FREE E-GIFT VOUCHERS
// ============================================

// CEO-only access middleware
const requireCEO = (req: any, res: any, next: any) => {
  const userEmail = req.firebaseUser?.email;
  const CEO_EMAILS = ['nirhadad1@gmail.com', 'nir.h@petwash.co.il'];
  
  if (!CEO_EMAILS.includes(userEmail || '')) {
    logger.warn(`[Security] Unauthorized CEO endpoint access attempt by ${userEmail}`);
    return res.status(403).json({ 
      error: 'CEO access required',
      message: 'Only the CEO (Nir Hadad) can access this endpoint',
      attemptedBy: userEmail
    });
  }
  
  next();
};

// CEO mobile number for 2FA
const CEO_MOBILE = '+972549833355';

/**
 * POST /api/admin/ceo/request-voucher
 * STEP 1: Request to issue free voucher - sends 2FA code to CEO's mobile
 * Accessible by: Nir Hadad (CEO) only
 * Security: requireCEO middleware + SMS 2FA
 */
router.post('/ceo/request-voucher', validateFirebaseToken, requireCEO, async (req, res) => {
  try {
    const userEmail = req.firebaseUser?.email;
    const { recipientEmail, recipientName, amount, message } = req.body;

    if (!recipientEmail || !recipientName || !amount) {
      return res.status(400).json({ error: 'Missing required fields: recipientEmail, recipientName, amount' });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store pending voucher request in Firestore (expires in 5 minutes)
    const requestRef = firestore.collection('ceo_voucher_requests').doc();
    await requestRef.set({
      id: requestRef.id,
      requestedBy: userEmail,
      recipientEmail,
      recipientName,
      amount: Number(amount),
      message: message || '',
      verificationCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      isVerified: false,
      ipAddress: req.ip
    });

    // Send SMS verification code to CEO's mobile
    const smsMessage = `🔐 PetWash™ Security Alert\n\nFree voucher issuance request:\n₪${amount} for ${recipientName}\n\nYour verification code: ${verificationCode}\n\nValid for 5 minutes.\n\nIf you didn't request this, contact security immediately.`;

    try {
      const { SmsService } = await import('../smsService');
      await SmsService.sendSMS(CEO_MOBILE, smsMessage);
      
      logger.info('[CEO Security] 2FA code sent to CEO mobile', { 
        requestId: requestRef.id,
        recipientEmail,
        amount
      });
    } catch (smsError) {
      logger.error('[CEO Security] Failed to send 2FA SMS', smsError);
      // Continue anyway - user can still use the code if they received it
    }

    res.json({
      success: true,
      requestId: requestRef.id,
      message: 'Verification code sent to your mobile phone (+972 549 833 355). Enter it to confirm issuance.',
      expiresIn: 300 // seconds
    });
  } catch (error) {
    logger.error('[CEO] Error requesting voucher 2FA', error);
    res.status(500).json({ error: 'Failed to send verification code', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/admin/ceo/issue-free-voucher
 * STEP 2: Verify 2FA code and issue the free voucher
 * Accessible by: Nir Hadad (CEO) only
 * Security: requireCEO middleware + SMS 2FA verification
 */
router.post('/ceo/issue-free-voucher', validateFirebaseToken, requireCEO, async (req, res) => {
  try {
    const userEmail = req.firebaseUser?.email;
    const { requestId, verificationCode } = req.body;

    if (!requestId || !verificationCode) {
      return res.status(400).json({ error: 'Missing requestId or verificationCode' });
    }

    // Fetch pending request
    const requestDoc = await firestore.collection('ceo_voucher_requests').doc(requestId).get();
    
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Request not found or expired' });
    }

    const request = requestDoc.data()!;

    // Verify code matches
    if (request.verificationCode !== verificationCode) {
      logger.warn('[CEO Security] Invalid verification code attempt', { 
        requestId,
        attemptedBy: userEmail,
        ipAddress: req.ip
      });
      return res.status(403).json({ error: 'Invalid verification code' });
    }

    // Check if expired (5 minutes)
    if (new Date() > request.expiresAt.toDate()) {
      return res.status(403).json({ error: 'Verification code expired. Please request a new one.' });
    }

    // Check if already used
    if (request.isVerified) {
      return res.status(403).json({ error: 'This verification code has already been used' });
    }

    // Mark request as verified
    await requestDoc.ref.update({ 
      isVerified: true,
      verifiedAt: new Date()
    });

    const { recipientEmail, recipientName, amount, message } = request;

    if (!recipientEmail || !recipientName || !amount) {
      return res.status(400).json({ error: 'Missing required fields: recipientEmail, recipientName, amount' });
    }

    // Generate voucher code
    const code = `FREE-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Valid for 1 year

    // Create voucher in Firestore
    const voucherRef = firestore.collection('e_vouchers').doc();
    const voucherData = {
      id: voucherRef.id,
      code,
      codeLast4: code.slice(-4),
      initialAmount: Number(amount),
      remainingAmount: Number(amount),
      recipientEmail,
      recipientName,
      senderName: 'Nir Hadad - PetWash CEO',
      personalMessage: message || 'Complimentary gift from PetWash™',
      isActive: true,
      isRedeemed: false,
      isFreeGift: true,
      issuedBy: userEmail,
      createdAt: new Date(),
      expiresAt,
      deliveryMethod: 'email',
    };

    await voucherRef.set(voucherData);

    // Send email to recipient
    const emailSubject = '🎁 You received a complimentary PetWash™ Gift Card from our CEO!';
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #000; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 16px; overflow: hidden; border: 2px solid #ec4899; }
          .header { background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 50px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 32px; }
          .crown { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px; color: white; }
          .gift-amount { text-align: center; font-size: 64px; font-weight: bold; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 30px 0; }
          .message-box { background: rgba(236, 72, 153, 0.1); border-left: 4px solid #ec4899; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .code-box { background: rgba(139, 92, 246, 0.1); border: 2px solid #8b5cf6; padding: 25px; text-align: center; font-family: monospace; font-size: 24px; font-weight: bold; margin: 30px 0; border-radius: 12px; letter-spacing: 2px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 20px 0; box-shadow: 0 4px 20px rgba(236, 72, 153, 0.4); }
          .footer { background: #1a1a1a; padding: 30px; text-align: center; font-size: 12px; color: #9ca3af; }
          .signature { font-size: 18px; font-style: italic; color: #ec4899; margin: 20px 0; text-align: right; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="crown">👑</div>
            <h1>Complimentary CEO Gift</h1>
            <p>Premium Organic Pet Care</p>
          </div>
          
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>On behalf of PetWash™, I'm delighted to present you with this complimentary gift card as a token of our appreciation.</p>
            
            ${message ? `<div class="message-box"><p><em>"${message}"</em></p></div>` : ''}
            
            <div class="gift-amount">₪${amount}</div>
            
            <p style="text-align: center; font-size: 20px; color: #ec4899;">Premium PetWash™ Gift Card</p>
            
            <div class="code-box">
              ${code}
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'https://petwash.co.il'}/claim-voucher?code=${code}" class="btn">
                Claim Your Gift
              </a>
            </div>
            
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 12px; padding: 20px; margin: 30px 0;">
              <p style="margin: 0; color: #10b981;"><strong>✓ How to Use:</strong></p>
              <ul style="margin: 10px 0; color: #10b981;">
                <li>Visit any K9000 wash station</li>
                <li>Present this gift code at checkout</li>
                <li>Valid for 12 months from issue date</li>
                <li>Transferable to friends & family</li>
              </ul>
            </div>
            
            <div class="signature">
              <p>Warm regards,<br>
              <strong>Nir Hadad</strong><br>
              Founder & CEO<br>
              PetWash™</p>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; text-align: center;">
              Issue Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
              Expires: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div class="footer">
            <p><strong>PetWash™</strong> - Premium Organic Pet Care</p>
            <p>petwash.co.il • +972 549 833 355</p>
            <p style="margin-top: 15px;">This is a complimentary gift. Non-refundable. Valid for 12 months.</p>
            <p>© ${new Date().getFullYear()} PetWash™. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await EmailService.sendEmail(recipientEmail, emailSubject, emailHtml);

    // Log CEO action
    const logRef = firestore.collection(FIRESTORE_PATHS.ADMIN_LOGS()).doc();
    await logRef.set({
      adminUid: req.firebaseUser!.uid,
      adminEmail: userEmail,
      action: 'issue_free_voucher',
      targetType: 'voucher',
      targetId: voucherRef.id,
      details: {
        recipientEmail,
        recipientName,
        amount,
        code,
        message: message || 'N/A'
      },
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    logger.info('[CEO] Free voucher issued', { voucherId: voucherRef.id, recipientEmail, amount });

    res.json({
      success: true,
      voucher: {
        id: voucherRef.id,
        code,
        amount,
        recipientEmail,
        expiresAt
      },
      message: `Complimentary ₪${amount} gift card sent to ${recipientEmail}`
    });
  } catch (error) {
    logger.error('[CEO] Error issuing free voucher', error);
    res.status(500).json({ error: 'Failed to issue voucher', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
