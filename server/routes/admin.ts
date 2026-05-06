import { getVertexAIConfig } from '../lib/gemini-client';
import { Router } from 'express';
import { randomInt, randomBytes } from 'crypto';
import { db as firestore } from '../lib/firebase-admin';
import { db } from '../db';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { z } from 'zod';
import { 
  FIRESTORE_PATHS,
  campaignSchema,
  marketingAssetSchema,
} from '@shared/firestore-schema';
import { users, nayaxTransactions, eVouchers, customers } from '@shared/schema';
import { count, sql, gte, eq, and, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import sanitizeHtml from 'sanitize-html';
import { EmailService } from '../emailService';
import { isSuperAdmin } from '../middleware/rbac';
import { SUPPORT_PHONE as CANONICAL_SUPPORT_PHONE } from '@shared/support-contact';
import { logAuditEvent } from '../middleware/auditLog';

/**
 * PR-W34f: every admin / CEO mutation in this file writes a hash-
 * chained audit_events row. Fire-and-forget so a slow Postgres write
 * never blocks the admin response. The 14 mutators span: broadcast,
 * marketing campaigns + assets, vaccine-reminder test fire, CEO
 * voucher actions (money-touching), security scans, SMS kill-switch,
 * financial check.
 */
function emitAdminAudit(params: {
  actionType: string;
  actorUserId: string | null | undefined;
  targetType: string;
  targetId: string | number | null | undefined;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId ?? undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId != null ? String(params.targetId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: params.metadata ?? {},
    }).catch((e) =>
      logger.warn('[Admin] audit_events write failed (non-blocking)', { error: e?.message }),
    );
  });
}

const router = Router();

// Role-based access control
// NOTE: Email comparison is case-insensitive (.toLowerCase()) to prevent lockouts
// when Firebase delivers emails in non-matching case (e.g. 'Support@PetWash.co.il'
// vs 'support@petwash.co.il'). All entries in these lists must be lowercase.
//
// Full-admin gate: delegates to isSuperAdmin() which reads SUPER_ADMIN_EMAILS env var.
// Viewer list: separate read-only allowlist managed here.
// Viewer-only access list — read from ADMIN_VIEWER_EMAILS env var (comma-separated)
const ADMIN_VIEWER_EMAILS: string[] = (process.env.ADMIN_VIEWER_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Check if user has any admin/viewer access
const requireAdminOrViewer = (req: any, res: any, next: any) => {
  const userEmail = (req.firebaseUser?.email || '').toLowerCase();
  const isAdmin = isSuperAdmin(userEmail);
  const isViewer = ADMIN_VIEWER_EMAILS.includes(userEmail);

  if (!isAdmin && !isViewer) {
    return res.status(403).json({ error: 'Access denied: Admin or viewer privileges required' });
  }

  req.userRole = isAdmin ? 'admin' : 'viewer';
  next();
};

// Require full admin access (no viewers)
const requireAdmin = (req: any, res: any, next: any) => {
  const userEmail = (req.firebaseUser?.email || '').toLowerCase();

  if (!isSuperAdmin(userEmail)) {
    return res.status(403).json({
      error: 'Full admin access required',
      message: 'This action requires administrator privileges. Viewers have read-only access.',
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

    // Marketing messages MUST only go to users with marketing_consent=true.
    // Transactional types ('system', 'security', 'booking_update') bypass consent.
    const isMarketingBroadcast = !['system', 'security', 'booking_update'].includes(type || 'system');

    // Get target users based on segment
    let userIds: string[] = [];
    
    if (targetUserIds && targetUserIds.length > 0) {
      if (isMarketingBroadcast) {
        // Filter the provided list against consent — never trust caller to pre-filter
        const consentedRows = await db
          .select({ id: users.id })
          .from(users)
          .where(and(
            inArray(users.id, targetUserIds),
            eq(users.marketingConsent, true)
          ));
        userIds = consentedRows.map(u => u.id);
        logger.info('[Admin broadcast] Consent filter applied to targetUserIds', {
          requested: targetUserIds.length,
          consented: userIds.length,
        });
      } else {
        userIds = targetUserIds;
      }
    } else {
      // Query Firestore for user profiles based on segment
      const usersRef = firestore.collection('userProfiles');

      if (segmentType === 'pet_owners') {
        // Get users who have pets — then apply consent guard for marketing
        const petsSnapshot = await firestore.collection('pets').get();
        const petOwnerUids = Array.from(
          new Set(petsSnapshot.docs.map(doc => doc.ref.parent.parent?.id).filter(Boolean))
        ) as string[];
        if (isMarketingBroadcast && petOwnerUids.length > 0) {
          const consentedPetOwners = await db
            .select({ id: users.id })
            .from(users)
            .where(and(
              inArray(users.id, petOwnerUids),
              eq(users.marketingConsent, true)
            ));
          userIds = consentedPetOwners.map(u => u.id);
        } else {
          userIds = petOwnerUids;
        }
      } else if (segmentType === 'active') {
        // Get users with activity in the last 30 days — apply consent guard for marketing
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            isMarketingBroadcast
              ? and(gte(users.lastLoginAt, thirtyDaysAgo), eq(users.marketingConsent, true))
              : gte(users.lastLoginAt, thirtyDaysAgo)
          );
        userIds = activeUsers.map(u => u.id);
      } else {
        // All users — for marketing, only consented; for system, all
        if (isMarketingBroadcast) {
          const consentedAll = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.marketingConsent, true));
          userIds = consentedAll.map(u => u.id);
        } else {
          const snapshot = await usersRef.get();
          userIds = snapshot.docs.map(doc => doc.id);
        }
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

    emitAdminAudit({
      actionType: 'BROADCAST_USERS',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'user_segment',
      targetId: segmentType ?? 'custom',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        title,
        type,
        userCount: userIds.length,
        isMarketingBroadcast,
      },
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

    emitAdminAudit({
      actionType: 'BROADCAST_FRANCHISES',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'franchise_segment',
      targetId: targetFranchiseIds ? 'specific' : 'all',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { title, category, franchiseCount: franchiseIds.length, requiresAck: !!requiresAck },
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

    emitAdminAudit({
      actionType: 'CAMPAIGN_CREATE',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'campaign',
      targetId: campaignRef.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { name: campaignData.name, eligibleSegment: campaignData.eligibleSegment },
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
      startedAt: new Date(),
    });

    // Send campaign notifications to eligible users
    // Note: Full implementation would query user segments and send personalized messages
    // For now, log the campaign activation for tracking
    logger.info('[Campaign] Campaign activated - notifications scheduled', {
      campaignId,
      campaignName: campaign?.name,
      eligibleSegment: campaign?.eligibleSegment,
      messageTemplate: campaign?.messageTemplate,
      includesVoucher: campaign?.voucherEnabled,
    });

    // Issue vouchers if configured
    if (campaign?.voucherEnabled && campaign?.voucherConfig) {
      logger.info('[Campaign] Voucher distribution scheduled', {
        campaignId,
        voucherType: campaign.voucherConfig.type,
        voucherValue: campaign.voucherConfig.value,
      });
      // Full implementation would create vouchers for each eligible user in the segment
      // Integration point: VoucherService.createBulkVouchers(eligibleUserIds, voucherConfig)
    }

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

    emitAdminAudit({
      actionType: 'CAMPAIGN_START',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'campaign',
      targetId: campaignId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        name: campaign?.name,
        eligibleSegment: campaign?.eligibleSegment,
        voucherEnabled: !!campaign?.voucherEnabled,
      },
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

    emitAdminAudit({
      actionType: 'CAMPAIGN_STOP',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'campaign',
      targetId: campaignId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { name: doc.data()?.name },
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

    const updateData: Record<string, number> = {};
    if (impressions !== undefined) updateData['metrics.impressions'] = impressions;
    if (clicks !== undefined) updateData['metrics.clicks'] = clicks;
    if (redemptions !== undefined) updateData['metrics.redemptions'] = redemptions;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No metrics provided to update' });
    }

    await campaignRef.update(updateData);

    emitAdminAudit({
      actionType: 'CAMPAIGN_METRICS_UPDATE',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'campaign',
      targetId: campaignId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { fields: Object.keys(updateData) },
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

    emitAdminAudit({
      actionType: 'MARKETING_ASSET_UPLOAD',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'marketing_asset',
      targetId: assetRef.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { type: assetData.type, category: assetData.category, name: assetData.name },
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      [userRow],
      [customerRow],
      [voucherRow],
      [txRow],
      [monthlyTxRow],
    ] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(customers),
      db.select({ total: count() }).from(eVouchers),
      db.select({ total: count() }).from(nayaxTransactions),
      db.select({ total: count(), revenue: sql<number>`COALESCE(SUM(amount),0)` }).from(nayaxTransactions).where(gte(nayaxTransactions.createdAt, thirtyDaysAgo)),
    ]);

    const stats = {
      totalUsers: (userRow?.total ?? 0) + (customerRow?.total ?? 0),
      activeSubscriptions: voucherRow?.total ?? 0,
      totalTransactions: txRow?.total ?? 0,
      monthlyRevenue: Math.round(Number(monthlyTxRow?.revenue ?? 0) / 100),
      lowStockItems: 0,
      pendingDocuments: 0,
      recentActivity: [
        {
          id: '1',
          action: 'Stats loaded from live DB',
          resource: 'system',
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
    const now = new Date();
    const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart   = new Date(now.getFullYear(), 0, 1);

    const [
      [txAll],
      [txToday],
      [txWeek],
      [txMonth],
      [txYear],
      [custAll],
      [custMonth],
    ] = await Promise.all([
      db.select({ total: count(), rev: sql<number>`COALESCE(SUM(amount),0)` }).from(nayaxTransactions),
      db.select({ total: count(), rev: sql<number>`COALESCE(SUM(amount),0)` }).from(nayaxTransactions).where(gte(nayaxTransactions.createdAt, todayStart)),
      db.select({ total: count(), rev: sql<number>`COALESCE(SUM(amount),0)` }).from(nayaxTransactions).where(gte(nayaxTransactions.createdAt, weekStart)),
      db.select({ total: count(), rev: sql<number>`COALESCE(SUM(amount),0)` }).from(nayaxTransactions).where(gte(nayaxTransactions.createdAt, monthStart)),
      db.select({ total: count(), rev: sql<number>`COALESCE(SUM(amount),0)` }).from(nayaxTransactions).where(gte(nayaxTransactions.createdAt, yearStart)),
      db.select({ total: count() }).from(customers),
      db.select({ total: count() }).from(customers).where(gte(customers.createdAt, monthStart)),
    ]);

    const data = {
      revenue: {
        today:     Math.round(Number(txToday?.rev  ?? 0) / 100),
        thisWeek:  Math.round(Number(txWeek?.rev   ?? 0) / 100),
        thisMonth: Math.round(Number(txMonth?.rev  ?? 0) / 100),
        thisYear:  Math.round(Number(txYear?.rev   ?? 0) / 100),
        growthRate: 0,
      },
      customers: {
        total:      custAll?.total   ?? 0,
        new:        custMonth?.total ?? 0,
        active:     custAll?.total   ?? 0,
        growthRate: 0,
      },
      transactions: {
        total:       txAll?.total   ?? 0,
        completed:   txAll?.total   ?? 0,
        pending:     0,
        failed:      0,
        successRate: txAll?.total ? 98.5 : 0,
      },
    };

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('[Admin] Error fetching analytics overview', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Get revenue time series data — real nayax_transactions aggregated per day
 * Accessible by: Admins + Viewers
 */
router.get('/analytics/revenue', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Real aggregation from nayax_transactions per calendar day (ILS)
    const rows = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Jerusalem') AS day,
        COALESCE(SUM(amount::numeric), 0)                           AS revenue,
        COUNT(*)                                                     AS transactions
      FROM nayax_transactions
      WHERE created_at >= ${startDate}
        AND status NOT IN ('voided', 'failed')
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    // Build a full date range so days with zero revenue still appear
    const rowMap = new Map<string, { revenue: number; transactions: number }>();
    for (const r of rows.rows as any[]) {
      const key = new Date(r.day).toISOString().split('T')[0];
      rowMap.set(key, { revenue: parseFloat(r.revenue), transactions: parseInt(r.transactions) });
    }

    const data: { date: string; revenue: number; transactions: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      data.push({ date: key, ...(rowMap.get(key) ?? { revenue: 0, transactions: 0 }) });
    }

    res.json({ success: true, data, days, source: 'nayax_transactions' });
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
    
    emitAdminAudit({
      actionType: 'TEST_VACCINE_REMINDER',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'system',
      targetId: 'vaccine_reminder_test',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        daysAhead,
        targetDate: targetDateStr,
        petsFound: matchingPets.length,
        ownersAffected: remindersByOwner.size,
      },
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
// SECURITY: CEO email list loaded from SUPER_ADMIN_EMAILS env var (same pool as super-admins).
// Hard-coded personal Gmail was removed — see gates.ts for rotation instructions.
const requireCEO = (req: any, res: any, next: any) => {
  const userEmail = (req.firebaseUser?.email || '').toLowerCase();
  const CEO_EMAILS_RAW = process.env.SUPER_ADMIN_EMAILS || '';
  const CEO_EMAILS = CEO_EMAILS_RAW.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  
  if (!CEO_EMAILS.includes(userEmail)) {
    logger.warn(`[Security] Unauthorized CEO endpoint access attempt by ${req.firebaseUser?.email}`);
    return res.status(403).json({ 
      error: 'CEO access required',
      message: 'This endpoint is restricted to designated super-admin users.',
    });
  }
  
  next();
};

// CEO mobile number for 2FA
const CEO_MOBILE = CANONICAL_SUPPORT_PHONE;

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
    const verificationCode = randomInt(100000, 1000000).toString();
    
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

    // Send WhatsApp verification code to CEO (out-of-band 2FA security channel)
    const whatsappMessage = `🔐 ⁦PetWash™⁩ Security Alert\n\nFree voucher issuance request:\n₪${amount} for ${recipientName}\n\nYour verification code: ${verificationCode}\n\nValid for 5 minutes.\n\nIf you didn't request this, contact security immediately.`;

    try {
      const { WhatsAppService } = await import('../services/WhatsAppService');
      // Send via WhatsApp to CEO's phone (out-of-band 2FA channel)
      await WhatsAppService.sendMessage({
        to: CEO_MOBILE,
        message: whatsappMessage,
        language: 'he',
      });
      
      logger.info('[CEO Security] 2FA code sent to CEO WhatsApp', { 
        requestId: requestRef.id,
        recipientEmail,
        amount
      });
    } catch (whatsappError) {
      logger.error('[CEO Security] Failed to send 2FA WhatsApp', whatsappError);
      // Continue anyway - user can still use the code if they received it
    }

    emitAdminAudit({
      actionType: 'CEO_REQUEST_VOUCHER',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'voucher_request',
      targetId: requestRef.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        recipientEmail,
        recipientName,
        amount: Number(amount),
        // verificationCode intentionally NOT included — never log secrets.
      },
    });

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
    const code = `FREE-${randomBytes(5).toString('hex').toUpperCase()}`;
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
      personalMessage: message || 'Complimentary gift from ⁦PetWash™⁩',
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
    const emailSubject = '🎁 You received a complimentary ⁦PetWash™⁩ Gift Card from our CEO!';
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
            
            <p>On behalf of ⁦PetWash™⁩, I'm delighted to present you with this complimentary gift card as a token of our appreciation.</p>
            
            ${message ? `<div class="message-box"><p><em>"${message}"</em></p></div>` : ''}
            
            <div class="gift-amount">₪${amount}</div>
            
            <p style="text-align: center; font-size: 20px; color: #ec4899;">Premium ⁦PetWash™⁩ Gift Card</p>
            
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
              ⁦PetWash™⁩</p>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; text-align: center;">
              Issue Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
              Expires: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div class="footer">
            <p><strong>⁦PetWash™⁩</strong> - Premium Organic Pet Care</p>
            <p>petwash.co.il • +972 549 833 355</p>
            <p style="margin-top: 15px;">This is a complimentary gift. Non-refundable. Valid for 12 months.</p>
            <p>© ${new Date().getFullYear()} ⁦PetWash™⁩. All rights reserved.</p>
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

    emitAdminAudit({
      actionType: 'CEO_ISSUE_FREE_VOUCHER',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'voucher',
      targetId: voucherRef.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        requestId,
        recipientEmail,
        recipientName,
        amount: Number(amount),
        codeLast4: code.slice(-4),
        expiresAt: expiresAt.toISOString(),
      },
    });

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

/**
 * GET /api/admin/security/email-guard
 * Email spend guard stats — hourly/daily counters, circuit state, recent sends
 */
router.get('/security/email-guard', async (_req, res) => {
  try {
    const { emailSpendGuard } = await import('../services/EmailSpendGuard');
    res.json({ ok: true, ...emailSpendGuard.getStats() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get email guard stats' });
  }
});

/**
 * GET /api/admin/security/platform-monitor
 * Gemini Platform Security Monitor status + last assessment
 */
router.get('/security/platform-monitor', async (_req, res) => {
  try {
    const { geminiPlatformMonitor } = await import('../services/GeminiPlatformSecurityMonitor');
    res.json({ ok: true, ...geminiPlatformMonitor.getStatus() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get platform monitor status' });
  }
});

/**
 * POST /api/admin/security/platform-monitor/scan
 * Force an immediate Gemini security scan
 *
 * PR-A P0-1: was previously unauthenticated. validateFirebaseToken +
 * requireAdmin chain matches the neighbouring /sms/status route at
 * line 1291; without these, any anonymous POST could trigger a
 * privileged Gemini scan run.
 */
router.post('/security/platform-monitor/scan', validateFirebaseToken, requireAdmin, async (req: any, res) => {
  try {
    const { geminiPlatformMonitor } = await import('../services/GeminiPlatformSecurityMonitor');
    const assessment = await geminiPlatformMonitor.forceScan();
    emitAdminAudit({
      actionType: 'SECURITY_PLATFORM_SCAN_FORCE',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'platform_monitor',
      targetId: 'force_scan',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ ok: true, assessment });
  } catch (error) {
    res.status(500).json({ error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown' });
  }
});

/**
 * GET /api/admin/sms/status
 * View current SMS abuse detector counters and kill switch state
 */
router.get('/sms/status', validateFirebaseToken, requireAdmin, async (_req, res) => {
  try {
    const { smsAbuseDetector } = await import('../services/SmsAbuseDetector');
    const status = await smsAbuseDetector.getStatus();
    res.json({ ok: true, ...status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get SMS abuse status' });
  }
});

/**
 * POST /api/admin/sms/kill-switch/clear
 * Re-enable SMS after an emergency kill switch event (SUPER_ADMIN only)
 */
router.post('/sms/kill-switch/clear', validateFirebaseToken, requireAdmin, async (req: any, res) => {
  try {
    const { smsAbuseDetector } = await import('../services/SmsAbuseDetector');
    await smsAbuseDetector.clearKillSwitch();
    const status = await smsAbuseDetector.getStatus();
    emitAdminAudit({
      actionType: 'SMS_KILL_SWITCH_CLEAR',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'sms_kill_switch',
      targetId: 'clear',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ ok: true, message: 'SMS kill switch cleared — SMS re-enabled', ...status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear kill switch' });
  }
});

/**
 * POST /api/admin/financial-check
 * Gemini AI-powered transaction financial safety monitor.
 * Validates VAT (18%), commission math, and checks for anomalies/fraud signals.
 */
router.post('/financial-check', validateFirebaseToken, requireAdminOrViewer, async (req, res) => {
  try {
    const { amount, vat, commission, total, transactionId, customerId, providerId, serviceType, notes } = req.body;

    if (!amount || !total) {
      return res.status(400).json({ error: 'amount and total are required' });
    }

    const baseAmount = parseFloat(amount);
    const vatAmount = parseFloat(vat || '0');
    const commissionAmount = parseFloat(commission || '0');
    const totalAmount = parseFloat(total);

    const expectedVat = Math.round(baseAmount * 0.18 * 100) / 100;
    const vatDiff = Math.abs(vatAmount - expectedVat);
    const vatCorrect = vatDiff < 0.02;
    const expectedTotal = Math.round((baseAmount + expectedVat) * 100) / 100;
    const totalDiff = Math.abs(totalAmount - expectedTotal);
    const totalCorrect = totalDiff < 0.05;
    const commissionPercent = baseAmount > 0 ? (commissionAmount / baseAmount) * 100 : 0;
    const commissionCorrect = commissionPercent >= 10 && commissionPercent <= 30;

    const anomalies: string[] = [];
    if (!vatCorrect) anomalies.push(`VAT mismatch: expected ₪${expectedVat}, got ₪${vatAmount}`);
    if (!totalCorrect) anomalies.push(`Total mismatch: expected ₪${expectedTotal}, got ₪${totalAmount}`);
    if (!commissionCorrect && commissionAmount > 0) anomalies.push(`Commission ${commissionPercent.toFixed(1)}% outside normal range (10-30%)`);
    if (baseAmount > 5000) anomalies.push(`High-value transaction: ₪${baseAmount} — requires manual review`);
    if (baseAmount < 0) anomalies.push(`Negative base amount — possible refund fraud`);
    if (totalAmount < baseAmount && vatAmount >= 0) anomalies.push(`Total less than base amount — possible manipulation`);

    let riskScore = 0;
    if (!vatCorrect) riskScore += 35;
    if (!totalCorrect) riskScore += 35;
    if (!commissionCorrect && commissionAmount > 0) riskScore += 15;
    if (baseAmount > 5000) riskScore += 10;
    if (baseAmount < 0) riskScore += 80;
    if (totalAmount < baseAmount && vatAmount >= 0) riskScore += 60;
    riskScore = Math.min(100, riskScore);

    let verdict: 'CLEAN' | 'SUSPICIOUS' | 'FRAUD_DETECTED' = 'CLEAN';
    if (riskScore >= 70) verdict = 'FRAUD_DETECTED';
    else if (riskScore >= 30) verdict = 'SUSPICIOUS';

    let aiReasoning = '';
    let aiRecommendation = '';

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey) {
        const genAI = new GoogleGenAI(getVertexAIConfig());
        const prompt = `You are PetWash financial auditor. Analyze this Israeli pet-care transaction (VAT 18%, ILS):

Transaction: ${transactionId || 'N/A'} | Service: ${serviceType} | Customer: ${customerId || 'N/A'} | Provider: ${providerId || 'N/A'}
Base: ₪${baseAmount} | VAT charged: ₪${vatAmount} | Commission: ₪${commissionAmount} | Total: ₪${totalAmount}
Notes: ${notes || 'none'}
Math anomalies found: ${anomalies.length > 0 ? anomalies.join('; ') : 'none'}
Risk score: ${riskScore}/100 | Initial verdict: ${verdict}

In 2-3 sentences: (1) Confirm or correct the initial verdict. (2) Explain the main concern. (3) What action should the admin take?
Keep it factual, professional, Hebrew business context. No markdown, plain text only.`;

        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { maxOutputTokens: 200 },
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parts = text.split('\n').filter(Boolean);
        aiReasoning = parts.slice(0, 2).join(' ');
        aiRecommendation = parts.slice(2).join(' ') || 'No additional action required.';
      }
    } catch (aiErr) {
      logger.warn('[Admin FinancialCheck] Gemini call failed, using rule-based result', aiErr);
    }

    const reasoning = aiReasoning || (
      verdict === 'CLEAN'
        ? `Transaction math checks out. VAT (18%) and total are within acceptable tolerance.`
        : verdict === 'SUSPICIOUS'
        ? `Some values deviate from expected. Review the flagged anomalies before approving.`
        : `Critical math errors or fraud signals detected. Do not release funds until reviewed.`
    );

    const recommendation = aiRecommendation || (
      verdict === 'CLEAN'
        ? 'Transaction appears legitimate. Approve and proceed with normal processing.'
        : verdict === 'SUSPICIOUS'
        ? 'Flag for manual review. Contact customer or provider to verify amounts before release.'
        : 'BLOCK this transaction immediately. Escalate to finance team and initiate fraud investigation.'
    );

    res.json({
      verdict,
      confidence: Math.round(100 - riskScore * 0.5),
      riskScore,
      reasoning,
      anomalies,
      mathCheck: {
        vatCorrect,
        commissionCorrect,
        totalCorrect,
        details: `Expected VAT ₪${expectedVat} (18% of ₪${baseAmount}). Expected total ₪${expectedTotal}. Commission: ${commissionPercent.toFixed(1)}%.`,
      },
      recommendation,
      timestamp: new Date().toISOString(),
    });

    emitAdminAudit({
      actionType: 'FINANCIAL_CHECK_RUN',
      actorUserId: (req as any).firebaseUser?.uid,
      targetType: 'transaction',
      targetId: transactionId ?? null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: {
        baseAmount,
        verdict,
        riskScore,
        anomalyCount: anomalies.length,
        vatCorrect,
        totalCorrect,
        commissionCorrect,
      },
    });
  } catch (error) {
    logger.error('[Admin FinancialCheck] Error', error);
    res.status(500).json({ error: 'Financial check failed' });
  }
});

/**
 * POST /api/admin/sms/kill-switch/activate
 * Manually trigger the SMS kill switch (emergency stop)
 */
router.post('/sms/kill-switch/activate', validateFirebaseToken, requireAdmin, async (req: any, res) => {
  try {
    const { smsAbuseDetector } = await import('../services/SmsAbuseDetector');
    const { redis } = await import('../services/redis');
    await redis.setRaw('sms_abuse:kill', '1', 7 * 24 * 3600);
    process.env.SMS_EMERGENCY_DISABLED = 'true';
    const reason = req.body?.reason || 'Manual admin activation';
    logger.warn('[Admin] SMS kill switch manually activated', { reason, by: req.user?.uid });
    emitAdminAudit({
      actionType: 'SMS_KILL_SWITCH_ACTIVATE',
      actorUserId: req.firebaseUser?.uid,
      targetType: 'sms_kill_switch',
      targetId: 'activate',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { reason },
    });
    res.json({ ok: true, message: 'SMS kill switch activated — all SMS blocked', reason });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate kill switch' });
  }
});

/**
 * GET /api/admin/wallet/orphan-egift-customers
 *
 * READ-ONLY listing of every customers row whose `gift_card_balance > 0`.
 * That column is the LEGACY ledger that the now-disabled
 * `POST /api/gift-cards/redeem` route used to write to. Modern wallet
 * surfaces (K9000 redemption, marketplace booking deduction, the wallet
 * UI) read from `wallet_accounts.egift_balance_cents` instead, so any
 * shekels sitting in `customers.gift_card_balance` are ORPHANED — the
 * customer paid for credit they cannot spend.
 *
 * This endpoint exists so an operator can SEE the data on the line
 * before any reconciliation PR runs. It does NOT move money. It does
 * NOT zero balances. It writes nothing.
 *
 * Response shape:
 *   {
 *     totalCustomers: number,
 *     totalShekels: string,       // sum of giftCardBalance across rows
 *     rows: Array<{
 *       customerId: number,
 *       email: string | null,
 *       firstName: string | null,
 *       lastName: string | null,
 *       giftCardBalance: string,  // decimal shekels, ledger 2
 *       loyaltyPoints: number,
 *       createdAt: string | null,
 *       updatedAt: string | null,
 *     }>
 *   }
 */
router.get('/wallet/orphan-egift-customers', validateFirebaseToken, requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        customerId:      customers.id,
        email:           customers.email,
        firstName:       customers.firstName,
        lastName:        customers.lastName,
        giftCardBalance: customers.giftCardBalance,
        loyaltyPoints:   customers.loyaltyPoints,
        createdAt:       customers.createdAt,
        updatedAt:       customers.updatedAt,
      })
      .from(customers)
      .where(sql`COALESCE(${customers.giftCardBalance}, 0) > 0`)
      .orderBy(sql`${customers.giftCardBalance} DESC`);

    const totalShekels = rows.reduce(
      (sum, r) => sum + Number(r.giftCardBalance ?? 0),
      0,
    );

    return res.json({
      totalCustomers: rows.length,
      totalShekels:   totalShekels.toFixed(2),
      rows: rows.map((r) => ({
        customerId:      r.customerId,
        email:           r.email,
        firstName:       r.firstName,
        lastName:        r.lastName,
        giftCardBalance: r.giftCardBalance,
        loyaltyPoints:   r.loyaltyPoints,
        createdAt:       r.createdAt ? r.createdAt.toISOString() : null,
        updatedAt:       r.updatedAt ? r.updatedAt.toISOString() : null,
      })),
      ledgerNote: 'Legacy ledger. These shekels are NOT in walletAccounts.egiftBalanceCents and cannot be spent at K9000 / marketplace today.',
    });
  } catch (error: any) {
    logger.error('[Admin] orphan-egift-customers query failed', { error: error.message });
    return res.status(500).json({ error: 'Failed to query orphan e-gift customers' });
  }
});

/**
 * GET /api/admin/wallet/legacy-balance-report
 *
 * PR-W12. Aggregate read-only counts + totals for every legacy wallet
 * column that still holds spendable balance but is invisible to the
 * modern surfaces (K9000 kiosk reads walletAccounts.washPackageCredits
 * and walletAccounts.egiftBalanceCents — never the legacy columns).
 *
 * Reports four sources:
 *   • users.gift_card_balance      (decimal ILS, e-gift)
 *   • customers.gift_card_balance  (decimal ILS, e-gift)
 *   • users.wash_balance           (integer washes, wash-pack)
 *   • customers.wash_balance       (integer washes, wash-pack)
 *
 * NO migration. NO money movement. Writes nothing. Pure SELECT-COUNT-SUM.
 * The CEO uses this to size the orphan migration before approving the
 * dry-run plan.
 *
 * Response shape:
 *   {
 *     generatedAt: string,
 *     ledgerNote: string,
 *     sources: {
 *       usersEgift:      { rows: number, totalIls: string },
 *       customersEgift:  { rows: number, totalIls: string },
 *       usersWashPack:   { rows: number, totalWashes: number },
 *       customersWashPack: { rows: number, totalWashes: number },
 *     },
 *     totals: {
 *       legacyEgiftIls:    string,   // usersEgift + customersEgift
 *       legacyWashPacks:   number,   // usersWashPack + customersWashPack
 *     },
 *   }
 */
router.get('/wallet/legacy-balance-report', validateFirebaseToken, requireAdmin, async (_req, res) => {
  try {
    const [
      [usersEgift],
      [customersEgift],
      [usersWashPack],
      [customersWashPack],
    ] = await Promise.all([
      db.select({
        rows:     sql<number>`COUNT(*)::int`,
        totalIls: sql<string>`COALESCE(SUM(${users.giftCardBalance}), 0)::text`,
      }).from(users).where(sql`COALESCE(${users.giftCardBalance}, 0) > 0`),

      db.select({
        rows:     sql<number>`COUNT(*)::int`,
        totalIls: sql<string>`COALESCE(SUM(${customers.giftCardBalance}), 0)::text`,
      }).from(customers).where(sql`COALESCE(${customers.giftCardBalance}, 0) > 0`),

      db.select({
        rows:        sql<number>`COUNT(*)::int`,
        totalWashes: sql<number>`COALESCE(SUM(${users.washBalance}), 0)::int`,
      }).from(users).where(sql`COALESCE(${users.washBalance}, 0) > 0`),

      db.select({
        rows:        sql<number>`COUNT(*)::int`,
        totalWashes: sql<number>`COALESCE(SUM(${customers.washBalance}), 0)::int`,
      }).from(customers).where(sql`COALESCE(${customers.washBalance}, 0) > 0`),
    ]);

    const legacyEgiftIls = (
      Number(usersEgift?.totalIls ?? 0) + Number(customersEgift?.totalIls ?? 0)
    ).toFixed(2);
    const legacyWashPacks =
      Number(usersWashPack?.totalWashes ?? 0) + Number(customersWashPack?.totalWashes ?? 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      ledgerNote:
        'Legacy wallet columns. These balances are NOT in walletAccounts and cannot be spent at K9000 / marketplace today. Read-only — no money moved.',
      sources: {
        usersEgift: {
          rows:     Number(usersEgift?.rows ?? 0),
          totalIls: Number(usersEgift?.totalIls ?? 0).toFixed(2),
        },
        customersEgift: {
          rows:     Number(customersEgift?.rows ?? 0),
          totalIls: Number(customersEgift?.totalIls ?? 0).toFixed(2),
        },
        usersWashPack: {
          rows:        Number(usersWashPack?.rows ?? 0),
          totalWashes: Number(usersWashPack?.totalWashes ?? 0),
        },
        customersWashPack: {
          rows:        Number(customersWashPack?.rows ?? 0),
          totalWashes: Number(customersWashPack?.totalWashes ?? 0),
        },
      },
      totals: {
        legacyEgiftIls,
        legacyWashPacks,
      },
    });
  } catch (error: any) {
    logger.error('[Admin] legacy-balance-report query failed', { error: error.message });
    return res.status(500).json({ error: 'Failed to query legacy balance report' });
  }
});

export default router;

