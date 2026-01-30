/**
 * Police Check Badge API Routes - Israeli תעודת יושר
 *
 * Document upload, verification, and badge management
 * Hebrew-dominant with English brand touches
 */
import { Router } from 'express';
import { policeCheckService } from '../services/PoliceCheckService';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { z } from 'zod';
const router = Router();
// Auth middleware for providers
async function requireAuth(req, res, next) {
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
    }
    catch (error) {
        logger.error('[Police Check Routes] Auth error', error);
        return res.status(401).json({ error: 'טוקן לא תקין' });
    }
}
// Admin auth middleware
async function requireAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'נדרשת התחברות מנהל' });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        // Check for admin role (simplified - in production check database)
        const adminEmails = [
            'admin@petwash.co.il',
            'hr@petwash.co.il',
            'compliance@petwash.co.il',
        ];
        if (!adminEmails.includes(decodedToken.email || '')) {
            return res.status(403).json({ error: 'הרשאות מנהל נדרשות' });
        }
        req.userId = decodedToken.uid;
        req.userEmail = decodedToken.email;
        next();
    }
    catch (error) {
        logger.error('[Police Check Routes] Admin auth error', error);
        return res.status(401).json({ error: 'טוקן לא תקין' });
    }
}
// Validation schemas
const submitCheckSchema = z.object({
    documentUrl: z.string().url('כתובת URL לא תקינה'),
    documentFileName: z.string().min(1, 'שם קובץ חסר'),
    documentIssuedAt: z.string().datetime({ message: 'תאריך הנפקה לא תקין' }),
});
const approveCheckSchema = z.object({
    reviewNotes: z.string().optional(),
});
const rejectCheckSchema = z.object({
    rejectionReason: z.string().min(1, 'נדרשת סיבת דחייה'),
});
const biometricOnboardingSchema = z.object({
    policeCheckUrl: z.string().url('כתובת URL לא תקינה לתעודת יושר'),
    policeCheckFileName: z.string().min(1, 'שם קובץ תעודת יושר חסר'),
    policeCheckIssuedAt: z.string().datetime({ message: 'תאריך הנפקה לא תקין' }),
    idDocumentUrl: z.string().url('כתובת URL לא תקינה לתעודת זהות'),
    idDocumentFileName: z.string().min(1, 'שם קובץ תעודת זהות חסר'),
    selfieUrl: z.string().url('כתובת URL לא תקינה לסלפי'),
});
/**
 * POST /api/police-check/submit
 * Submit a police check document for verification
 */
router.post('/submit', requireAuth, async (req, res) => {
    try {
        const validation = submitCheckSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0]?.message || 'נתונים לא תקינים'
            });
        }
        const { documentUrl, documentFileName, documentIssuedAt } = validation.data;
        const result = await policeCheckService.submitPoliceCheck(req.userId, documentUrl, documentFileName, new Date(documentIssuedAt));
        res.json(result);
    }
    catch (error) {
        logger.error('[Police Check Routes] Error submitting check', error);
        res.status(500).json({
            error: error.message || 'שגיאה בהגשת תעודת היושר'
        });
    }
});
/**
 * POST /api/police-check/biometric-onboarding
 * Complete biometric onboarding for subcontractors
 *
 * Israeli Law 2025 compliance requires:
 * 1. תעודת יושר (Police Clearance) - from משטרת ישראל
 * 2. תעודת זהות ביומטרית (Biometric ID) - photo verification
 * 3. סלפי עדכני (Current Selfie) - matched against ID using AI
 *
 * Process:
 * - Upload all 3 documents
 * - AI performs face matching (selfie vs ID)
 * - If match successful → Ready for admin review
 * - If match fails → Reject with retry option
 */
router.post('/biometric-onboarding', requireAuth, async (req, res) => {
    try {
        const validation = biometricOnboardingSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0]?.message || 'נתונים לא תקינים',
                errorEn: 'Invalid data provided',
                details: validation.error.errors
            });
        }
        const { policeCheckUrl, policeCheckFileName, policeCheckIssuedAt, idDocumentUrl, idDocumentFileName, selfieUrl } = validation.data;
        const result = await policeCheckService.submitBiometricOnboarding(req.userId, {
            policeCheckUrl,
            policeCheckFileName,
            policeCheckIssuedAt: new Date(policeCheckIssuedAt),
            idDocumentUrl,
            idDocumentFileName,
            selfieUrl,
        });
        res.json(result);
    }
    catch (error) {
        logger.error('[Police Check Routes] Error in biometric onboarding', error);
        res.status(500).json({
            error: error.message || 'שגיאה בתהליך ההצטרפות הביומטרי',
            errorEn: 'Error in biometric onboarding process'
        });
    }
});
/**
 * GET /api/police-check/status
 * Get provider's police check status
 */
router.get('/status', requireAuth, async (req, res) => {
    try {
        const status = await policeCheckService.getProviderPoliceCheckStatus(req.userId);
        // Add Hebrew status messages
        let statusMessageHe = '';
        let statusMessageEn = '';
        // Check real-time expiry (even if DB status not yet updated)
        const isRealTimeExpired = status.expiresAt && status.expiresAt < new Date();
        if (!status.latestCheck) {
            statusMessageHe = 'לא הועלתה תעודת יושר. יש להעלות תעודה כדי להתחיל לעבוד.';
            statusMessageEn = 'No police check uploaded. Please upload a certificate to start working.';
        }
        else if (status.hasValidPoliceCheck && status.hasBadge) {
            // Valid and has badge - show days remaining
            if (status.daysUntilExpiry !== null && status.daysUntilExpiry <= 30) {
                // Expiring soon warning
                statusMessageHe = `⚠️ תעודת היושר בתוקף אך תפוג בעוד ${status.daysUntilExpiry} ימים. יש לחדש בהקדם!`;
                statusMessageEn = `⚠️ Police check valid but expiring in ${status.daysUntilExpiry} days. Please renew soon!`;
            }
            else {
                statusMessageHe = `תעודת היושר בתוקף ✓ נותרו ${status.daysUntilExpiry} ימים`;
                statusMessageEn = `Police check valid ✓ ${status.daysUntilExpiry} days remaining`;
            }
        }
        else if (isRealTimeExpired || status.latestCheck.status === 'expired') {
            // Real-time expiry check (handles case where DB not yet updated)
            statusMessageHe = 'תעודת היושר פגה תוקף. יש להעלות תעודה חדשה.';
            statusMessageEn = 'Police check expired. Please upload a new certificate.';
        }
        else if (status.latestCheck.status === 'pending') {
            statusMessageHe = 'תעודת היושר בבדיקה. תוצאות צפויות תוך 24-48 שעות.';
            statusMessageEn = 'Police check under review. Results expected within 24-48 hours.';
        }
        else if (status.latestCheck.status === 'under_review') {
            statusMessageHe = 'התעודה נבדקת על ידי צוות הביטחון שלנו.';
            statusMessageEn = 'Certificate is being reviewed by our security team.';
        }
        else if (status.latestCheck.status === 'rejected') {
            statusMessageHe = `התעודה נדחתה: ${status.latestCheck.rejectionReason || 'לא צוינה סיבה'}`;
            statusMessageEn = `Certificate rejected: ${status.latestCheck.rejectionReason || 'No reason specified'}`;
        }
        else if (status.latestCheck.status === 'approved' && !status.hasBadge) {
            // Approved but badge not yet issued
            statusMessageHe = 'התעודה אושרה, ממתין להנפקת תג אבטחה.';
            statusMessageEn = 'Certificate approved, waiting for badge issuance.';
        }
        res.json({
            ...status,
            statusMessageHe,
            statusMessageEn,
        });
    }
    catch (error) {
        logger.error('[Police Check Routes] Error getting status', error);
        res.status(500).json({
            error: error.message || 'שגיאה בטעינת סטטוס'
        });
    }
});
/**
 * GET /api/police-check/verify/:providerId
 * Public endpoint to verify a provider's badge
 */
router.get('/verify/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        if (!providerId) {
            return res.status(400).json({ error: 'מזהה ספק חסר' });
        }
        const verification = await policeCheckService.verifyProviderBadge(providerId);
        res.json(verification);
    }
    catch (error) {
        logger.error('[Police Check Routes] Error verifying badge', error);
        res.status(500).json({
            error: 'שגיאה באימות התג'
        });
    }
});
// ============ ADMIN ROUTES ============
/**
 * GET /api/police-check/admin/pending
 * Get all pending police checks for admin review
 */
router.get('/admin/pending', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const checks = await policeCheckService.getPendingChecks(limit);
        res.json({
            checks,
            count: checks.length,
            messageHe: `${checks.length} בקשות ממתינות לבדיקה`,
            messageEn: `${checks.length} checks pending review`,
        });
    }
    catch (error) {
        logger.error('[Police Check Routes] Error getting pending checks', error);
        res.status(500).json({
            error: 'שגיאה בטעינת הבקשות'
        });
    }
});
/**
 * GET /api/police-check/admin/expiring
 * Get checks expiring soon (for proactive renewal reminders)
 */
router.get('/admin/expiring', requireAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const checks = await policeCheckService.getExpiringChecks(days);
        res.json({
            checks,
            count: checks.length,
            daysThreshold: days,
            messageHe: `${checks.length} תעודות פגות בתוך ${days} יום`,
            messageEn: `${checks.length} certificates expiring within ${days} days`,
        });
    }
    catch (error) {
        logger.error('[Police Check Routes] Error getting expiring checks', error);
        res.status(500).json({
            error: 'שגיאה בטעינת הבקשות'
        });
    }
});
/**
 * POST /api/police-check/admin/approve/:checkId
 * Approve a police check and issue badge
 */
router.post('/admin/approve/:checkId', requireAdmin, async (req, res) => {
    try {
        const checkId = parseInt(req.params.checkId);
        if (isNaN(checkId)) {
            return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
        }
        const validation = approveCheckSchema.safeParse(req.body);
        const reviewNotes = validation.success ? validation.data.reviewNotes : undefined;
        const result = await policeCheckService.approvePoliceCheck(checkId, req.userId, reviewNotes);
        res.json(result);
    }
    catch (error) {
        logger.error('[Police Check Routes] Error approving check', error);
        res.status(500).json({
            error: 'שגיאה באישור הבקשה'
        });
    }
});
/**
 * POST /api/police-check/admin/reject/:checkId
 * Reject a police check
 */
router.post('/admin/reject/:checkId', requireAdmin, async (req, res) => {
    try {
        const checkId = parseInt(req.params.checkId);
        if (isNaN(checkId)) {
            return res.status(400).json({ error: 'מזהה בקשה לא תקין' });
        }
        const validation = rejectCheckSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: validation.error.errors[0]?.message || 'נדרשת סיבת דחייה'
            });
        }
        const result = await policeCheckService.rejectPoliceCheck(checkId, req.userId, validation.data.rejectionReason);
        res.json(result);
    }
    catch (error) {
        logger.error('[Police Check Routes] Error rejecting check', error);
        res.status(500).json({
            error: 'שגיאה בדחיית הבקשה'
        });
    }
});
/**
 * POST /api/police-check/admin/expire-checks
 * Manually trigger expiry check (also runs as cron)
 */
router.post('/admin/expire-checks', requireAdmin, async (req, res) => {
    try {
        const count = await policeCheckService.markExpiredChecks();
        res.json({
            success: true,
            expiredCount: count,
            messageHe: `${count} תעודות סומנו כפגות תוקף`,
            messageEn: `${count} certificates marked as expired`,
        });
    }
    catch (error) {
        logger.error('[Police Check Routes] Error expiring checks', error);
        res.status(500).json({
            error: 'שגיאה בעדכון תעודות פגות'
        });
    }
});
export default router;
