import { Router } from 'express';
import { petWashOrchestrator } from '../services/PetWashOperationsOrchestrator';
import { providerIntakeService } from '../services/ProviderIntakeService';
import { requireAuth } from '../customAuth';
import { requireAdmin } from '../middleware/rbac';
import { db } from '../db';
import { providerIntakeQueue, biometricCertificateVerifications } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { createHash, randomUUID } from 'crypto';
import { sendProviderEnrollmentConfirmation } from '../email/luxury-email-service';
import { logProviderApplication } from '../services/googleSheetsIntegration';

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
 * GET /api/provider-intake/stats
 * Get intake queue statistics for management dashboard (PUBLIC - no auth)
 */
router.get('/stats', async (req, res) => {
  try {
    const allRecords = await db
      .select()
      .from(providerIntakeQueue);
    
    const newCount = allRecords.filter(r => r.status === 'new').length;
    const pendingCount = allRecords.filter(r => r.status === 'pending_review' || r.status === 'interview_scheduled' || r.status === 'reviewing').length;
    const approvedCount = allRecords.filter(r => r.status === 'approved').length;
    const totalCount = allRecords.length;
    
    res.json({
      success: true,
      newCount,
      pendingCount,
      approvedCount,
      totalCount,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[Provider Intake] Stats fetch failed:', error);
    res.json({
      success: true,
      newCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      totalCount: 0,
      updatedAt: new Date().toISOString()
    });
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

    const intake = await db.query.providerIntakeQueue.findFirst({
      where: eq(providerIntakeQueue.intakeId, intakeId),
    }).catch(() => null);

    res.json({
      success: true,
      message: 'Applicant approved and invited',
      inviteCode: result.inviteCode
    });

    setImmediate(() => petWashOrchestrator.handleOnboardingApproved({
      applicationId: intakeId,
      platform: (intake as any)?.platform || 'PetWash',
      firstName: (intake as any)?.firstName || '',
      lastName: (intake as any)?.lastName || '',
      email: (intake as any)?.email || '',
      phone: (intake as any)?.phone || '',
      city: (intake as any)?.city,
      idNumber: (intake as any)?.idNumber,
      vatNumber: (intake as any)?.vatNumber,
      businessName: (intake as any)?.businessName,
      inviteCode: result.inviteCode,
      approvedBy: adminId,
      notes,
    }).catch(e => logger.warn('[ProviderIntake] Orchestrator hook error', e)));
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

/**
 * POST /api/provider-intake/submit
 * Public submission endpoint for in-app luxury application form
 * No auth required - form is public facing
 */
const submitApplicationSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email required'),
  phoneNumber: z.string().min(9, 'Valid phone number required'),
  idNumber: z.string().optional(),
  streetAddress: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  providerType: z.string().min(1, 'Provider type is required'),
  selectedPlatforms: z.array(z.string()).optional().default([]),
  intendedPricing: z.record(z.object({
    baseRate: z.number(),
    additionalPet: z.number()
  })).optional().default({}),
  yearsExperience: z.string().optional(),
  hasOwnTransport: z.boolean().default(false),
  hasPetFirstAid: z.boolean().default(false),
  hasInsurance: z.boolean().default(false),
  availabilityNotes: z.string().optional(),
  aboutMe: z.string().min(20, 'Please tell us about yourself'),
  whyJoinPetWash: z.string().min(20, 'Please tell us why you want to join'),
  referralSource: z.string().optional(),
  profilePhotoBase64: z.string().optional(),
  idDocumentFrontBase64: z.string().optional(),
  idDocumentBackBase64: z.string().optional(),
  selfieDocBase64: z.string().optional(),
  drivingLicenseBase64: z.string().optional(),
  firebaseUid: z.string().optional(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
  agreeToPrivacy: z.boolean().refine(val => val === true, 'You must agree to the privacy policy'),
  agreeToContractorStatus: z.boolean().refine(val => val === true, 'You must acknowledge independent contractor status'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  captchaToken: z.string().optional(),
});

router.post('/submit', async (req, res) => {
  try {
    const data = submitApplicationSchema.parse(req.body);
    
    const intakeId = `INTAKE-${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()}`;
    
    // AUTO-APPROVAL: Applications are automatically accepted when users 
    // meet requirements. They proceed to biometric verification next.
    const [record] = await db
      .insert(providerIntakeQueue)
      .values({
        intakeId,
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        providerType: data.providerType,
        selectedPlatforms: data.selectedPlatforms || [],
        intendedPricing: data.intendedPricing || {},
        city: data.city,
        country: 'IL',
        latitude: data.latitude != null ? String(data.latitude) : null,
        longitude: data.longitude != null ? String(data.longitude) : null,
        yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience.split('-')[0]) || 0 : 0,
        hasOwnTransport: data.hasOwnTransport,
        hasPetFirstAid: data.hasPetFirstAid,
        hasInsurance: data.hasInsurance,
        availabilityNotes: data.availabilityNotes || null,
        aboutMe: data.aboutMe,
        whyJoinPetWash: data.whyJoinPetWash,
        referralSource: data.referralSource || null,
        profilePhotoUrl: data.profilePhotoBase64 || null,
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    const contentHash = createHash('sha256').update(JSON.stringify({
      intakeId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      providerType: data.providerType,
      selectedPlatforms: data.selectedPlatforms,
      city: data.city,
      submittedAt: new Date().toISOString()
    })).digest('hex');
    
    logger.info('[Provider Intake] Application accepted:', { 
      intakeId, 
      email: data.email, 
      providerType: data.providerType,
      selectedPlatforms: data.selectedPlatforms,
      platformCount: data.selectedPlatforms?.length || 0,
      contentHash: contentHash.substring(0, 16) + '...'
    });

    try {
      const { geminiPlatformMonitor } = await import('../services/GeminiPlatformSecurityMonitor');
      geminiPlatformMonitor.recordRegistration('provider');
    } catch {}

    // Create biometric verification record if documents were uploaded
    let biometricRecordCreated = false;
    const hasDocuments = data.firebaseUid && data.idDocumentFrontBase64 && data.selfieDocBase64;
    if (hasDocuments) {
      try {
        await db.insert(biometricCertificateVerifications).values({
          userId: data.firebaseUid!,
          documentType: 'national_id',
          documentCountry: 'IL',
          documentNumber: data.idNumber || undefined,
          documentFrontUrl: data.idDocumentFrontBase64!,
          documentBackUrl: data.idDocumentBackBase64 || undefined,
          selfiePhotoUrl: data.selfieDocBase64!,
          biometricMatchStatus: 'pending',
          verificationStatus: 'pending',
          verificationMethod: 'automatic',
          ipAddress: req.ip || undefined,
          userAgent: req.headers['user-agent'] || undefined,
        });
        biometricRecordCreated = true;
        logger.info('[Provider Intake] Biometric verification record created', { intakeId, firebaseUid: data.firebaseUid });

        // Also store driving license as a separate record if provided
        if (data.drivingLicenseBase64) {
          await db.insert(biometricCertificateVerifications).values({
            userId: data.firebaseUid!,
            documentType: 'drivers_license',
            documentCountry: 'IL',
            documentFrontUrl: data.drivingLicenseBase64,
            selfiePhotoUrl: data.selfieDocBase64!,
            biometricMatchStatus: 'pending',
            verificationStatus: 'pending',
            verificationMethod: 'automatic',
            ipAddress: req.ip || undefined,
            userAgent: req.headers['user-agent'] || undefined,
          });
          logger.info('[Provider Intake] Driving license record created', { intakeId });
        }
      } catch (biometricError) {
        logger.error('[Provider Intake] Failed to create biometric record (non-blocking):', { biometricError, intakeId });
      }
    }

    
    try {
      const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';
      await sendProviderEnrollmentConfirmation(
        data.email.toLowerCase(),
        data.firstName,
        data.lastName,
        data.selectedPlatforms || [data.providerType],
        record.id,
        language
      );
      logger.info('[Provider Intake] Confirmation email sent', { email: data.email, intakeId });
    } catch (emailError) {
      logger.error('[Provider Intake] Failed to send confirmation email (non-blocking)', { emailError, intakeId });
    }
    
    try {
      await logProviderApplication({
        applicationId: intakeId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phoneNumber,
        idNumber: data.idNumber || '',
        providerType: data.providerType,
        selectedPlatforms: (data.selectedPlatforms || []).join(', '),
        city: data.city,
        country: 'Israel',
        languages: '',
        yearsOfExperience: data.yearsExperience || '',
        availability: data.availabilityNotes || '',
        hasVehicle: data.hasOwnTransport ? 'Yes' : 'No',
        selfiePhotoUrl: '',
        governmentIdUrl: '',
        biometricStatus: 'pending',
        biometricScore: '0',
        applicationStatus: 'Accepted - Pending Verification',
      });
      logger.info('[Provider Intake] Logged to Google Sheets', { intakeId });
    } catch (sheetsError) {
      logger.error('[Provider Intake] Failed to log to Google Sheets (non-blocking)', { sheetsError, intakeId });
    }
    
    res.json({
      success: true,
      message: 'Application accepted! Please complete identity verification to start.',
      intakeId,
      status: 'accepted',
      contentHash: contentHash.substring(0, 16),
      biometricRecordCreated,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      logger.warn('[Provider Intake] Validation failed on submit:', {
        fields: error.errors.map((e: any) => ({ path: e.path.join('.'), message: e.message }))
      });
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logger.error('[Provider Intake] Submit failed:', error);
    res.status(500).json({ 
      error: 'Failed to submit application',
      message: error.message 
    });
  }
});

/**
 * POST /api/provider-intake/submit-documents
 * Submit identity documents after application is accepted
 * Called from success screen when user uploads their documents post-submission
 */
const submitDocumentsSchema = z.object({
  intakeId: z.string().optional(),
  firebaseUid: z.string().min(1, 'Firebase UID required'),
  idDocumentFrontBase64: z.string().min(1, 'ID document front is required'),
  idDocumentBackBase64: z.string().optional(),
  selfieDocBase64: z.string().min(1, 'Selfie is required'),
  drivingLicenseBase64: z.string().optional(),
});

router.post('/submit-documents', async (req, res) => {
  try {
    const data = submitDocumentsSchema.parse(req.body);

    // Create national ID biometric record
    await db.insert(biometricCertificateVerifications).values({
      userId: data.firebaseUid,
      documentType: 'national_id',
      documentCountry: 'IL',
      documentFrontUrl: data.idDocumentFrontBase64,
      documentBackUrl: data.idDocumentBackBase64 || undefined,
      selfiePhotoUrl: data.selfieDocBase64,
      biometricMatchStatus: 'pending',
      verificationStatus: 'pending',
      verificationMethod: 'automatic',
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    });

    // Create driving license record if provided
    if (data.drivingLicenseBase64) {
      await db.insert(biometricCertificateVerifications).values({
        userId: data.firebaseUid,
        documentType: 'drivers_license',
        documentCountry: 'IL',
        documentFrontUrl: data.drivingLicenseBase64,
        selfiePhotoUrl: data.selfieDocBase64,
        biometricMatchStatus: 'pending',
        verificationStatus: 'pending',
        verificationMethod: 'automatic',
        ipAddress: req.ip || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      });
    }

    // Update intake status to 'reviewing' if intakeId provided
    if (data.intakeId) {
      await db
        .update(providerIntakeQueue)
        .set({ status: 'reviewing', updatedAt: new Date() })
        .where(eq(providerIntakeQueue.intakeId, data.intakeId));
    }

    logger.info('[Provider Intake] Documents submitted post-application', {
      intakeId: data.intakeId,
      firebaseUid: data.firebaseUid,
      hasDrivingLicense: !!data.drivingLicenseBase64,
    });

    res.json({
      success: true,
      message: 'Documents submitted for verification',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('[Provider Intake] Document submission failed:', error);
    res.status(500).json({ error: 'Failed to submit documents', message: error.message });
  }
});

export default router;
