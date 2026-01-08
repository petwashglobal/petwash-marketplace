import { Router } from 'express';
import { providerIntakeService } from '../services/ProviderIntakeService';
import { requireAuth } from '../customAuth';
import { requireAdmin } from '../middleware/rbac';
import { db } from '../db';
import { providerIntakeQueue } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';

const router = Router();

/**
 * PROVIDER INTAKE QUEUE API
 * Management-assisted onboarding via Google Forms
 */

/**
 * GET /api/provider-intake
 * Get all intake queue records (admin only)
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    
    let query = db
      .select()
      .from(providerIntakeQueue)
      .orderBy(desc(providerIntakeQueue.createdAt));
    
    if (status) {
      query = query.where(eq(providerIntakeQueue.status, status)) as any;
    }
    
    const records = await query;
    
    res.json({
      success: true,
      records,
      total: records.length,
      statuses: {
        new: records.filter(r => r.status === 'new').length,
        reviewing: records.filter(r => r.status === 'reviewing').length,
        approved: records.filter(r => r.status === 'approved').length,
        invited: records.filter(r => r.status === 'invited').length,
        converted: records.filter(r => r.status === 'converted').length,
        rejected: records.filter(r => r.status === 'rejected').length,
      }
    });
  } catch (error: any) {
    logger.error('[Provider Intake] Failed to fetch queue:', error);
    res.status(500).json({ error: 'Failed to fetch intake queue' });
  }
});

/**
 * GET /api/provider-intake/:intakeId
 * Get single intake record details
 */
router.get('/:intakeId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { intakeId } = req.params;
    
    const [record] = await db
      .select()
      .from(providerIntakeQueue)
      .where(eq(providerIntakeQueue.intakeId, intakeId))
      .limit(1);
    
    if (!record) {
      return res.status(404).json({ error: 'Intake record not found' });
    }
    
    res.json({ success: true, record });
  } catch (error: any) {
    logger.error('[Provider Intake] Failed to fetch record:', error);
    res.status(500).json({ error: 'Failed to fetch intake record' });
  }
});

/**
 * POST /api/provider-intake/sync
 * Sync from Google Sheets (admin only)
 */
const syncSchema = z.object({
  sheetId: z.string().min(1, 'Google Sheet ID is required'),
  sheetName: z.string().optional().default('Form Responses 1')
});

router.post('/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sheetId, sheetName } = syncSchema.parse(req.body);
    
    logger.info('[Provider Intake] Starting sync from Google Sheet:', { sheetId, sheetName });
    
    const result = await providerIntakeService.syncFromGoogleSheet(sheetId, sheetName);
    
    res.json({
      success: true,
      message: `Synced ${result.newRecords} new records from Google Sheet`,
      result
    });
  } catch (error: any) {
    logger.error('[Provider Intake] Sync failed:', error);
    res.status(500).json({ 
      error: 'Failed to sync from Google Sheet',
      message: error.message 
    });
  }
});

/**
 * POST /api/provider-intake/:intakeId/approve
 * Approve and send invite code
 */
const approveSchema = z.object({
  sendVia: z.enum(['email', 'whatsapp', 'sms']).default('email'),
  notes: z.string().optional()
});

router.post('/:intakeId/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { intakeId } = req.params;
    const adminId = req.user!.uid;
    const { sendVia, notes } = approveSchema.parse(req.body);
    
    // Update notes if provided
    if (notes) {
      await db
        .update(providerIntakeQueue)
        .set({ reviewNotes: notes, updatedAt: new Date() })
        .where(eq(providerIntakeQueue.intakeId, intakeId));
    }
    
    const result = await providerIntakeService.approveAndInvite(intakeId, adminId, sendVia);
    
    res.json({
      success: true,
      message: 'Applicant approved and invited',
      inviteCode: result.inviteCode
    });
  } catch (error: any) {
    logger.error('[Provider Intake] Approval failed:', error);
    res.status(500).json({ 
      error: 'Failed to approve applicant',
      message: error.message 
    });
  }
});

/**
 * POST /api/provider-intake/:intakeId/reject
 * Reject applicant with reason
 */
const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required')
});

router.post('/:intakeId/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { intakeId } = req.params;
    const adminId = req.user!.uid;
    const { reason } = rejectSchema.parse(req.body);
    
    await providerIntakeService.rejectApplicant(intakeId, adminId, reason);
    
    res.json({
      success: true,
      message: 'Applicant rejected'
    });
  } catch (error: any) {
    logger.error('[Provider Intake] Rejection failed:', error);
    res.status(500).json({ 
      error: 'Failed to reject applicant',
      message: error.message 
    });
  }
});

/**
 * PATCH /api/provider-intake/:intakeId
 * Update intake record (add notes, change status to reviewing)
 */
const updateSchema = z.object({
  status: z.enum(['new', 'reviewing', 'approved', 'rejected', 'invited', 'converted']).optional(),
  reviewNotes: z.string().optional()
});

router.patch('/:intakeId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { intakeId } = req.params;
    const adminId = req.user!.uid;
    const updates = updateSchema.parse(req.body);
    
    await db
      .update(providerIntakeQueue)
      .set({
        ...updates,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(providerIntakeQueue.intakeId, intakeId));
    
    res.json({
      success: true,
      message: 'Intake record updated'
    });
  } catch (error: any) {
    logger.error('[Provider Intake] Update failed:', error);
    res.status(500).json({ 
      error: 'Failed to update intake record',
      message: error.message 
    });
  }
});

/**
 * GET /api/provider-intake/form-urls/public
 * Get Google Form URLs for public display (no auth required)
 */
router.get('/form-urls/public', async (req, res) => {
  res.json({
    success: true,
    forms: {
      walker: providerIntakeService.getGoogleFormUrl('walker'),
      sitter: providerIntakeService.getGoogleFormUrl('sitter'),
      driver: providerIntakeService.getGoogleFormUrl('driver'),
      groomer: providerIntakeService.getGoogleFormUrl('groomer'),
      trainer: providerIntakeService.getGoogleFormUrl('trainer'),
      station_operator: providerIntakeService.getGoogleFormUrl('station_operator'),
      general: providerIntakeService.getGoogleFormUrl('general')
    }
  });
});

export default router;
