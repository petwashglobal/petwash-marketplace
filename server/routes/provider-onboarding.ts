// Provider Onboarding API Routes (Uber-style)
// Invite codes, KYC verification, and application management for walkers, sitters, station operators

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { providerInviteCodes, providerApplications, insertProviderApplicationSchema } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { auth, storage } from '../lib/firebase-admin';
import { biometricVerification } from '../services/BiometricVerificationService';
import { logger } from '../lib/logger';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Admin authentication middleware
async function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    if (decodedToken.email !== 'nirhadad1@gmail.com') { // Admin email
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    req.body.adminUid = decodedToken.uid;
    next();
  } catch (error) {
    logger.error('Admin auth error', error);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

// =================== INVITE CODE MANAGEMENT ===================

// Generate invite code (Admin only)
router.post('/admin/invite-codes/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { providerType, maxUses, expiresAt, campaignName, referralBonus, notes } = req.body;
    const { adminUid } = req.body; // From middleware

    if (!providerType || !['walker', 'sitter', 'station_operator'].includes(providerType)) {
      return res.status(400).json({ error: 'Invalid provider type' });
    }

    // Generate unique invite code (e.g., WALKER-A8F3H9K2)
    const codePrefix = providerType.toUpperCase().substring(0, 6);
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const inviteCode = `${codePrefix}-${randomCode}`;

    const [code] = await db.insert(providerInviteCodes).values({
      inviteCode,
      providerType,
      createdByAdminId: adminUid,
      maxUses: maxUses || 1,
      currentUses: 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      campaignName: campaignName || null,
      referralBonus: referralBonus || null,
      notes: notes || null,
      isActive: true,
    }).returning();

    logger.info(`[Provider Onboarding] Invite code generated: ${inviteCode} by admin ${adminUid}`);

    res.json({ 
      success: true, 
      inviteCode: code.inviteCode,
      providerType: code.providerType,
      expiresAt: code.expiresAt 
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Generate invite code error', error);
    res.status(500).json({ error: error.message || 'Failed to generate invite code' });
  }
});

// Validate invite code (Public)
router.post('/validate-invite-code', async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }

    const [code] = await db
      .select()
      .from(providerInviteCodes)
      .where(eq(providerInviteCodes.inviteCode, inviteCode))
      .limit(1);

    if (!code) {
      return res.status(404).json({ 
        valid: false, 
        error: 'Invalid invite code' 
      });
    }

    // Check if active
    if (!code.isActive) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This invite code is no longer active' 
      });
    }

    // Check if expired
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This invite code has expired' 
      });
    }

    // Check if max uses reached
    if (code.maxUses && code.currentUses >= code.maxUses) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This invite code has reached its maximum uses' 
      });
    }

    res.json({ 
      valid: true,
      providerType: code.providerType,
      referralBonus: code.referralBonus,
      campaignName: code.campaignName
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Validate invite code error', error);
    res.status(500).json({ error: error.message || 'Failed to validate invite code' });
  }
});

// =================== PROVIDER APPLICATION SUBMISSION ===================

// Submit provider application (with biometric KYC)
router.post('/apply', upload.fields([
  { name: 'selfiePhoto', maxCount: 1 },
  { name: 'governmentId', maxCount: 1 },
  { name: 'insuranceCert', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    // SECURITY: Verify Firebase authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    let authenticatedUser: any;
    
    try {
      authenticatedUser = await auth.verifyIdToken(token);
    } catch (authError) {
      logger.error('[Provider Onboarding] Auth error', authError);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    const {
      inviteCode,
      firstName,
      lastName,
      phoneNumber,
      city,
      country,
      providerType
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Validate required fields
    if (!inviteCode || !firstName || !lastName || !phoneNumber || !city || !providerType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate invite code
    const [code] = await db
      .select()
      .from(providerInviteCodes)
      .where(eq(providerInviteCodes.inviteCode, inviteCode))
      .limit(1);

    if (!code || !code.isActive) {
      return res.status(400).json({ error: 'Invalid or inactive invite code' });
    }

    if (code.providerType !== providerType) {
      return res.status(400).json({ 
        error: `This invite code is for ${code.providerType}, not ${providerType}` 
      });
    }

    // Check for existing application
    const existingApp = await db
      .select()
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.userId, authenticatedUser.uid),
          eq(providerApplications.status, 'pending')
        )
      )
      .limit(1);

    if (existingApp.length > 0) {
      return res.status(400).json({ 
        error: 'You already have a pending application' 
      });
    }

    // Upload files to Firebase Storage
    const bucket = storage.bucket('gs://signinpetwash.firebasestorage.app');
    let selfieUrl = '';
    let governmentIdUrl = '';
    let insuranceCertUrl = '';
    let businessLicenseUrl = '';

    // Upload selfie
    if (files.selfiePhoto && files.selfiePhoto[0]) {
      const selfieFile = files.selfiePhoto[0];
      const selfieFileName = `providers/${authenticatedUser.uid}/kyc/selfie_${Date.now()}.${selfieFile.mimetype.split('/')[1]}`;
      const selfieUpload = bucket.file(selfieFileName);
      await selfieUpload.save(selfieFile.buffer, {
        metadata: { contentType: selfieFile.mimetype },
      });
      const [url] = await selfieUpload.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      selfieUrl = selfieFileName; // Store path, not signed URL
    }

    // Upload government ID
    if (files.governmentId && files.governmentId[0]) {
      const idFile = files.governmentId[0];
      const idFileName = `providers/${authenticatedUser.uid}/kyc/government_id_${Date.now()}.${idFile.mimetype.split('/')[1]}`;
      const idUpload = bucket.file(idFileName);
      await idUpload.save(idFile.buffer, {
        metadata: { contentType: idFile.mimetype },
      });
      governmentIdUrl = idFileName;
    }

    // Upload insurance certificate (optional)
    if (files.insuranceCert && files.insuranceCert[0]) {
      const insuranceFile = files.insuranceCert[0];
      const insuranceFileName = `providers/${authenticatedUser.uid}/docs/insurance_${Date.now()}.${insuranceFile.mimetype.split('/')[1]}`;
      const insuranceUpload = bucket.file(insuranceFileName);
      await insuranceUpload.save(insuranceFile.buffer, {
        metadata: { contentType: insuranceFile.mimetype },
      });
      insuranceCertUrl = insuranceFileName;
    }

    // Upload business license (optional)
    if (files.businessLicense && files.businessLicense[0]) {
      const licenseFile = files.businessLicense[0];
      const licenseFileName = `providers/${authenticatedUser.uid}/docs/business_license_${Date.now()}.${licenseFile.mimetype.split('/')[1]}`;
      const licenseUpload = bucket.file(licenseFileName);
      await licenseUpload.save(licenseFile.buffer, {
        metadata: { contentType: licenseFile.mimetype },
      });
      businessLicenseUrl = licenseFileName;
    }

    // Perform biometric verification if both photos provided
    let biometricStatus = 'pending';
    let biometricMatchScore = 0;
    let biometricFailureReason = '';

    if (selfieUrl && governmentIdUrl) {
      try {
        // Get signed URLs for verification
        const selfieFileRef = bucket.file(selfieUrl);
        const idFileRef = bucket.file(governmentIdUrl);
        
        const [selfieSignedUrl] = await selfieFileRef.getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        });
        
        const [idSignedUrl] = await idFileRef.getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });

        const verificationResult = await biometricVerification.verifyIdentity(
          selfieSignedUrl,
          idSignedUrl
        );

        if (verificationResult.isMatch) {
          biometricStatus = 'verified';
          biometricMatchScore = verificationResult.matchScore;
        } else {
          biometricStatus = 'failed';
          biometricMatchScore = verificationResult.matchScore;
          biometricFailureReason = verificationResult.reason || 'Face match failed';
        }
      } catch (verifyError: any) {
        logger.error('[Provider Onboarding] Biometric verification error', verifyError);
        biometricStatus = 'pending';
        biometricFailureReason = 'Verification pending manual review';
      }
    }

    // Generate application ID
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const applicationId = `APP-${year}-${randomNum}`;

    // Create application
    const [application] = await db.insert(providerApplications).values({
      applicationId,
      userId: authenticatedUser.uid,
      email: authenticatedUser.email || '',
      firstName,
      lastName,
      phoneNumber,
      providerType,
      inviteCode,
      city,
      country: country || 'IL',
      selfiePhotoUrl: selfieUrl,
      governmentIdUrl,
      biometricMatchScore: biometricMatchScore.toString(),
      biometricStatus,
      biometricFailureReason: biometricFailureReason || null,
      biometricVerifiedAt: biometricStatus === 'verified' ? new Date() : null,
      insuranceCertUrl: insuranceCertUrl || null,
      businessLicenseUrl: businessLicenseUrl || null,
      status: 'pending',
    }).returning();

    // Increment invite code usage
    await db
      .update(providerInviteCodes)
      .set({ 
        currentUses: sql`${providerInviteCodes.currentUses} + 1`,
        updatedAt: new Date()
      })
      .where(eq(providerInviteCodes.inviteCode, inviteCode));

    logger.info(`[Provider Onboarding] Application submitted: ${applicationId} by ${authenticatedUser.uid}`);

    res.json({
      success: true,
      applicationId: application.applicationId,
      biometricStatus: application.biometricStatus,
      biometricMatchScore: parseFloat(application.biometricMatchScore || '0'),
      message: 'Application submitted successfully. We will review it within 24-48 hours.'
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Application submission error', error);
    res.status(500).json({ error: error.message || 'Failed to submit application' });
  }
});

// Get application status (User)
router.get('/application/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    const applications = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.userId, decodedToken.uid))
      .orderBy(desc(providerApplications.createdAt))
      .limit(10);

    res.json({ applications });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Get application status error', error);
    res.status(500).json({ error: error.message });
  }
});

// =================== ADMIN: APPLICATION REVIEW ===================

// Get pending applications (Admin only)
router.get('/admin/applications/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const applications = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.status, 'pending'))
      .orderBy(desc(providerApplications.createdAt))
      .limit(limit);

    res.json({ applications });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Get pending applications error', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve application (Admin only)
router.post('/admin/applications/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { applicationId, internalNotes } = req.body;
    const { adminUid } = req.body; // From middleware

    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID required' });
    }

    const [application] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.applicationId, applicationId))
      .limit(1);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application already processed' });
    }

    // Generate provider ID based on type
    const providerPrefix = application.providerType.toUpperCase().substring(0, 6);
    const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const providerId = `${providerPrefix}-${randomId}`;

    // Update application
    await db
      .update(providerApplications)
      .set({
        status: 'approved',
        reviewedBy: adminUid,
        reviewedAt: new Date(),
        approvedAsProviderId: providerId,
        internalNotes: internalNotes || null,
        backgroundCheckStatus: 'passed', // Simplified for MVP
        backgroundCheckDate: new Date(),
      })
      .where(eq(providerApplications.applicationId, applicationId));

    logger.info(`[Provider Onboarding] Application approved: ${applicationId} by admin ${adminUid}`);

    res.json({ 
      success: true, 
      message: 'Application approved successfully',
      providerId
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Approve application error', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject application (Admin only)
router.post('/admin/applications/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { applicationId, rejectionReason, internalNotes } = req.body;
    const { adminUid } = req.body; // From middleware

    if (!applicationId || !rejectionReason) {
      return res.status(400).json({ error: 'Application ID and rejection reason required' });
    }

    await db
      .update(providerApplications)
      .set({
        status: 'rejected',
        reviewedBy: adminUid,
        reviewedAt: new Date(),
        rejectionReason,
        internalNotes: internalNotes || null,
      })
      .where(eq(providerApplications.applicationId, applicationId));

    logger.info(`[Provider Onboarding] Application rejected: ${applicationId} by admin ${adminUid}`);

    res.json({ 
      success: true, 
      message: 'Application rejected'
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Reject application error', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
