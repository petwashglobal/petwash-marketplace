/**
 * Admin Provider Review Queue API Routes - ⁦Pet Wash™⁩
 * 
 * Provider approval workflow, checklist management, and statistics
 * Hebrew-dominant with English brand touches
 */

import { Router } from 'express';
import { adminProviderReviewService, type ApprovalStatus, type PriorityLevel } from '../services/AdminProviderReviewService';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { z } from 'zod';

const router = Router();

// Admin auth middleware
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    const adminEmails = [
      'admin@petwash.co.il',
      'hr@petwash.co.il',
      'compliance@petwash.co.il',
      'operations@petwash.co.il',
    ];
    
    if (!adminEmails.includes(decodedToken.email || '')) {
      return res.status(403).json({ error: 'הרשאות מנהל נדרשות' });
    }

    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error) {
    logger.error('[Admin Review Routes] Auth error', error);
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

// Provider auth middleware
async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'נדרשת התחברות' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error) {
    logger.error('[Admin Review Routes] Auth error', error);
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

// Validation schemas
const createApplicationSchema = z.object({
  platform: z.enum(['sitter_suite', 'walk_my_pet', 'pettrek', 'k9000']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const updateChecklistSchema = z.object({
  itemKey: z.enum([
    'photoApproved', 
    'certificateApproved', 
    'idVerified', 
    'addressVerified', 
    'policeCheckApproved', 
    'insuranceVerified', 
    'pricingApproved'
  ]),
  approved: z.boolean(),
});

const approveSchema = z.object({
  reviewNotes: z.string().optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().min(1, 'נדרשת סיבת דחייה'),
});

const holdSchema = z.object({
  reason: z.string().min(1, 'נדרשת סיבה'),
});

// ============ PROVIDER ROUTES ============

/**
 * POST /api/provider-review/apply
 * Provider submits application for a platform
 */
router.post('/apply', requireAuth, async (req: any, res) => {
  try {
    const validation = createApplicationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.error.errors[0]?.message || 'נתונים לא תקינים' 
      });
    }

    const { platform, priority } = validation.data;

    const application = await adminProviderReviewService.createApplication(
      req.userId,
      platform,
      priority || 'normal'
    );

    res.json({
      success: true,
      application,
      messageHe: 'הבקשה הוגשה בהצלחה! היא תיבדק תוך 24-48 שעות.',
      messageEn: 'Application submitted successfully! It will be reviewed within 24-48 hours.',
    });
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error creating application', error);
    res.status(500).json({ 
      error: 'שגיאה בהגשת הבקשה' 
    });
  }
});

/**
 * GET /api/provider-review/my-status/:platform
 * Get provider's application status for a platform
 */
router.get('/my-status/:platform', requireAuth, async (req: any, res) => {
  try {
    const { platform } = req.params;
    const isApproved = await adminProviderReviewService.isProviderApproved(req.userId, platform);

    res.json({
      providerId: req.userId,
      platform,
      isApproved,
      messageHe: isApproved 
        ? 'מאושר לעבודה בפלטפורמה זו ✓' 
        : 'טרם אושרת לעבודה בפלטפורמה זו',
      messageEn: isApproved 
        ? 'Approved to work on this platform ✓' 
        : 'Not yet approved for this platform',
    });
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error getting status', error);
    res.status(500).json({ 
      error: 'שגיאה בטעינת הסטטוס' 
    });
  }
});

// ============ ADMIN ROUTES ============

/**
 * GET /api/provider-review/admin/queue
 * Get approval queue with filters
 */
router.get('/admin/queue', requireAdmin, async (req: any, res) => {
  try {
    const { status, platform, limit } = req.query;
    
    const queue = await adminProviderReviewService.getQueue(
      status as ApprovalStatus | undefined,
      platform as string | undefined,
      parseInt(limit as string) || 50
    );

    res.json({
      queue,
      count: queue.length,
      filters: { status, platform },
    });
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error getting queue', error);
    res.status(500).json({ 
      error: 'שגיאה בטעינת התור' 
    });
  }
});

/**
 * GET /api/provider-review/admin/statistics
 * Get queue statistics for dashboard
 */
router.get('/admin/statistics', requireAdmin, async (req: any, res) => {
  try {
    const stats = await adminProviderReviewService.getQueueStatistics();

    res.json({
      ...stats,
      messageHe: `${stats.pending} בקשות ממתינות, ${stats.approved} אושרו`,
      messageEn: `${stats.pending} pending, ${stats.approved} approved`,
    });
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error getting statistics', error);
    res.status(500).json({ 
      error: 'שגיאה בטעינת הסטטיסטיקות' 
    });
  }
});

/**
 * GET /api/provider-review/admin/application/:id
 * Get full application details with checklist
 */
router.get('/admin/application/:id', requireAdmin, async (req: any, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
    }

    const review = await adminProviderReviewService.getApplicationReview(applicationId);

    if (!review) {
      return res.status(404).json({ error: 'הבקשה לא נמצאה' });
    }

    res.json(review);
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error getting application', error);
    res.status(500).json({ 
      error: 'שגיאה בטעינת הבקשה' 
    });
  }
});

/**
 * POST /api/provider-review/admin/assign/:id
 * Assign application to reviewer
 */
router.post('/admin/assign/:id', requireAdmin, async (req: any, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
    }

    const result = await adminProviderReviewService.assignToReviewer(
      applicationId,
      req.userId
    );

    res.json(result);
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error assigning application', error);
    res.status(500).json({ 
      error: 'שגיאה בהקצאת הבקשה' 
    });
  }
});

/**
 * PATCH /api/provider-review/admin/checklist/:id
 * Update a checklist item
 */
router.patch('/admin/checklist/:id', requireAdmin, async (req: any, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
    }

    const validation = updateChecklistSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.error.errors[0]?.message || 'נתונים לא תקינים' 
      });
    }

    const { itemKey, approved } = validation.data;

    const result = await adminProviderReviewService.updateChecklistItem(
      applicationId,
      itemKey,
      approved,
      req.userId
    );

    res.json({
      ...result,
      messageHe: approved ? `${itemKey} אושר ✓` : `${itemKey} סומן כלא אושר`,
      messageEn: approved ? `${itemKey} approved ✓` : `${itemKey} marked as not approved`,
    });
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error updating checklist', error);
    res.status(500).json({ 
      error: 'שגיאה בעדכון הרשימה' 
    });
  }
});

/**
 * POST /api/provider-review/admin/approve/:id
 * Approve provider application
 */
router.post('/admin/approve/:id', requireAdmin, async (req: any, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
    }

    const validation = approveSchema.safeParse(req.body);
    const reviewNotes = validation.success ? validation.data.reviewNotes : undefined;

    const result = await adminProviderReviewService.approveApplication(
      applicationId,
      req.userId,
      reviewNotes
    );

    try {
      const { logAuditEvent } = await import('../middleware/auditLog');
      await logAuditEvent({
        actorUserId: req.userId,
        actorRole: 'admin',
        actionType: 'PROVIDER_APPROVE',
        targetType: 'provider_application',
        targetId: String(applicationId),
        ip: req.ip || req.headers?.['x-forwarded-for'],
        userAgent: req.headers?.['user-agent'],
        traceId: req.traceId,
        metadata: { reviewNotes },
      });
    } catch (auditErr) {
      logger.warn('[Admin Review] Audit log failed', auditErr);
    }

    res.json(result);
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error approving application', error);
    res.status(500).json({ 
      error: 'שגיאה באישור הבקשה' 
    });
  }
});

/**
 * POST /api/provider-review/admin/reject/:id
 * Reject provider application
 */
router.post('/admin/reject/:id', requireAdmin, async (req: any, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
    }

    const validation = rejectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.error.errors[0]?.message || 'נדרשת סיבת דחייה' 
      });
    }

    const result = await adminProviderReviewService.rejectApplication(
      applicationId,
      req.userId,
      validation.data.rejectionReason
    );

    res.json(result);
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error rejecting application', error);
    res.status(500).json({ 
      error: 'שגיאה בדחיית הבקשה' 
    });
  }
});

/**
 * POST /api/provider-review/admin/hold/:id
 * Put application on hold
 */
router.post('/admin/hold/:id', requireAdmin, async (req: any, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
    }

    const validation = holdSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.error.errors[0]?.message || 'נדרשת סיבה' 
      });
    }

    const result = await adminProviderReviewService.putOnHold(
      applicationId,
      req.userId,
      validation.data.reason
    );

    res.json(result);
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error putting on hold', error);
    res.status(500).json({ 
      error: 'שגיאה בהעברה להמתנה' 
    });
  }
});

/**
 * GET /api/provider-review/admin/approved/:platform
 * Get all approved providers for a platform
 */
router.get('/admin/approved/:platform', requireAdmin, async (req: any, res) => {
  try {
    const { platform } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const providers = await adminProviderReviewService.getApprovedProviders(platform, limit);

    res.json({
      providers,
      count: providers.length,
      platform,
      messageHe: `${providers.length} ספקים מאושרים לפלטפורמת ${platform}`,
      messageEn: `${providers.length} approved providers for ${platform}`,
    });
  } catch (error: any) {
    logger.error('[Admin Review Routes] Error getting approved providers', error);
    res.status(500).json({ 
      error: 'שגיאה בטעינת הספקים' 
    });
  }
});

export default router;
