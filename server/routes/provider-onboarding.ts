// Provider Onboarding API Routes (Uber-style)
// Invite codes, KYC verification, and application management for walkers, sitters, station operators

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { providerInviteCodes, providerApplications, insertProviderApplicationSchema } from '@shared/schema';
import { systemRoles, userRoleAssignments } from '@shared/schema-enterprise';
import { eq, and, desc, sql } from 'drizzle-orm';
import { auth, storage } from '../lib/firebase-admin';
import { biometricVerification } from '../services/BiometricVerificationService';
import { logger } from '../lib/logger';
import { isSuperAdmin } from '../middleware/rbac';
import { GoogleSheetsService } from '../services/googleSheetsIntegration';
import multer from 'multer';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { generateProviderWelcomeEmail } from '../email/templates/welcome-provider-signup-2026';

const router = Router();

// Allowed MIME types for document uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
];

// File size limits by type
const FILE_SIZE_LIMITS = {
  selfie: 5 * 1024 * 1024,      // 5MB for selfie photos
  document: 10 * 1024 * 1024,   // 10MB for documents/IDs
  certificate: 15 * 1024 * 1024 // 15MB for certificates
};

// Configure multer for file uploads with validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max (certificates)
  },
  fileFilter: (req, file, callback) => {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      logger.warn(`[Upload] Rejected file type: ${file.mimetype} for ${file.fieldname}`);
      return callback(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, HEIC, PDF`));
    }
    
    // Check file extension matches MIME type
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];
    if (!ext || !validExtensions.includes(ext)) {
      logger.warn(`[Upload] Rejected file extension: ${ext} for ${file.fieldname}`);
      return callback(new Error(`Invalid file extension. Allowed: ${validExtensions.join(', ')}`));
    }
    
    callback(null, true);
  }
});

// Admin authentication middleware - supports super admins and database role assignments
async function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userEmail = decodedToken.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized - Email not found in token' });
    }
    
    // Check super admin list first (CEO, Directors)
    if (isSuperAdmin(userEmail)) {
      req.body.adminUid = decodedToken.uid;
      req.body.adminEmail = userEmail;
      return next();
    }
    
    // Check database for admin role assignments
    const assignments = await db
      .select({
        assignment: userRoleAssignments,
        role: systemRoles
      })
      .from(userRoleAssignments)
      .leftJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userEmail, userEmail),
          eq(userRoleAssignments.isActive, true)
        )
      )
      .limit(1);

    if (assignments.length > 0 && assignments[0].role) {
      const role = assignments[0].role;
      // Check if role has admin-level access (level 5 or higher, or specific permissions)
      const permissions = role.permissions as string[];
      const hasAdminAccess = role.accessLevel >= 5 || 
        permissions.includes('*') || 
        permissions.includes('admin:providers') ||
        permissions.includes('admin:applications');
      
      if (hasAdminAccess) {
        req.body.adminUid = decodedToken.uid;
        req.body.adminEmail = userEmail;
        req.body.adminRole = role.roleCode;
        return next();
      }
    }
    
    logger.warn(`[Provider Onboarding] Admin access denied for: ${userEmail}`);
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
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
  { name: 'businessLicense', maxCount: 1 },
  { name: 'petFirstAidCert', maxCount: 1 },
  { name: 'drivingLicenseFile', maxCount: 1 }
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
      idNumber,
      city,
      country,
      providerType: rawProviderType,
      providerTypes: rawProviderTypes,
      residentialHistory: rawResidentialHistory,
      backgroundCheckConsent: rawBackgroundCheckConsent,
      declarations: rawDeclarations,
      insurancePolicyNumber,
      insuranceProvider: insuranceProviderName,
      insuranceExpiry,
      petFirstAidNumber,
      petFirstAidExpiry,
      drivingLicenseNumber,
      drivingLicenseClass,
      drivingLicenseExpiry,
      traceId,
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    let providerType = rawProviderType;
    if (!providerType && rawProviderTypes) {
      try {
        const typesArray = typeof rawProviderTypes === 'string' ? JSON.parse(rawProviderTypes) : rawProviderTypes;
        if (Array.isArray(typesArray) && typesArray.length > 0) {
          providerType = typesArray[0];
        }
      } catch {
        providerType = rawProviderTypes;
      }
    }

    let residentialHistory: string[] = [];
    try {
      residentialHistory = rawResidentialHistory ? (typeof rawResidentialHistory === 'string' ? JSON.parse(rawResidentialHistory) : rawResidentialHistory) : [];
    } catch { residentialHistory = []; }

    const backgroundCheckConsent = rawBackgroundCheckConsent === 'true' || rawBackgroundCheckConsent === true;

    let declarations: Record<string, boolean> = {};
    try {
      declarations = rawDeclarations ? (typeof rawDeclarations === 'string' ? JSON.parse(rawDeclarations) : rawDeclarations) : {};
    } catch { declarations = {}; }

    if (!firstName || !lastName || !phoneNumber || !city || !providerType) {
      logger.warn('[Provider Onboarding] Missing required fields', { firstName: !!firstName, lastName: !!lastName, phoneNumber: !!phoneNumber, city: !!city, providerType: !!providerType });
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, phoneNumber, city, and providerType are required' });
    }

    // AUTO-APPROVAL FLOW: No invite code required
    // Providers who upload required documents and pass biometric verification
    // are automatically approved without manual admin review
    let code = null;
    let referralBonus = null;
    
    // Optional invite code - still supported for referral tracking
    if (inviteCode && inviteCode.trim()) {
      const [foundCode] = await db
        .select()
        .from(providerInviteCodes)
        .where(eq(providerInviteCodes.inviteCode, inviteCode.trim()))
        .limit(1);

      if (foundCode && foundCode.isActive) {
        code = foundCode;
        referralBonus = foundCode.referralBonus;
      }
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

    // Upload selfie (with AI content moderation - relaxed, not harsh)
    if (files.selfiePhoto && files.selfiePhoto[0]) {
      const selfieFile = files.selfiePhoto[0];

      // AI moderation check on selfie/profile photo
      try {
        const { contentModerationService } = await import('../services/ContentModerationService');
        const moderationResult = await contentModerationService.moderateImage(
          selfieFile.buffer,
          selfieFile.mimetype,
          { userId: authenticatedUser.uid, uploadType: 'profile_photo', platform: 'provider-onboarding' }
        );
        if (!moderationResult.isApproved) {
          logger.warn('[Provider Onboarding] Selfie rejected by AI moderation', {
            userId: authenticatedUser.uid,
            flags: moderationResult.flags,
          });
          return res.status(400).json({
            error: 'התמונה לא עברה בדיקת תוכן. אנא העלה תמונת פרופיל מתאימה.',
            errorEn: 'Photo did not pass content review. Please upload an appropriate profile photo.',
            flags: moderationResult.flags,
          });
        }
      } catch (modErr) {
        logger.warn('[Provider Onboarding] Image moderation failed (allowing upload)', modErr);
      }

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

    // Upload pet first aid certificate (optional)
    let petFirstAidCertUrl = '';
    if (files.petFirstAidCert && files.petFirstAidCert[0]) {
      const certFile = files.petFirstAidCert[0];
      const certFileName = `providers/${authenticatedUser.uid}/docs/pet_first_aid_${Date.now()}.${certFile.mimetype.split('/')[1]}`;
      const certUpload = bucket.file(certFileName);
      await certUpload.save(certFile.buffer, {
        metadata: { contentType: certFile.mimetype },
      });
      petFirstAidCertUrl = certFileName;
    }

    // Upload driving license (optional - PetTrek drivers)
    let drivingRecordUrl = '';
    if (files.drivingLicenseFile && files.drivingLicenseFile[0]) {
      const dlFile = files.drivingLicenseFile[0];
      const dlFileName = `providers/${authenticatedUser.uid}/docs/driving_license_${Date.now()}.${dlFile.mimetype.split('/')[1]}`;
      const dlUpload = bucket.file(dlFileName);
      await dlUpload.save(dlFile.buffer, {
        metadata: { contentType: dlFile.mimetype },
      });
      drivingRecordUrl = dlFileName;
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

    // AUTO-APPROVAL: If biometric verification passed and required documents uploaded,
    // automatically approve the provider without manual admin review
    const autoApproved = biometricStatus === 'verified' && selfieUrl && governmentIdUrl;
    const applicationStatus = autoApproved ? 'approved' : 'pending';
    
    // Generate provider ID for auto-approved applications
    let providerId = null;
    if (autoApproved) {
      const providerPrefix = providerType.toUpperCase().substring(0, 6);
      const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
      providerId = `${providerPrefix}-${randomId}`;
    }

    // Create application - DB write FIRST (must succeed before any async side effects)
    const [application] = await db.insert(providerApplications).values({
      applicationId,
      userId: authenticatedUser.uid,
      email: authenticatedUser.email || '',
      firstName,
      lastName,
      phoneNumber,
      providerType,
      inviteCode: inviteCode || null,
      city,
      country: country || 'IL',
      selfiePhotoUrl: selfieUrl,
      governmentIdUrl,
      biometricMatchScore: biometricMatchScore.toString(),
      biometricStatus,
      biometricFailureReason: biometricFailureReason || null,
      biometricVerifiedAt: biometricStatus === 'verified' ? new Date() : null,
      residentialHistory: residentialHistory.length > 0 ? JSON.stringify(residentialHistory) : null,
      criminalCheckConsent: backgroundCheckConsent,
      criminalCheckConsentDate: backgroundCheckConsent ? new Date() : null,
      petFirstAidCertUrl: petFirstAidCertUrl || null,
      petFirstAidProvider: petFirstAidNumber || null,
      petFirstAidExpiresAt: petFirstAidExpiry ? new Date(petFirstAidExpiry) : null,
      drivingRecordUrl: drivingRecordUrl || null,
      drivingRecordNotes: drivingLicenseNumber ? JSON.stringify({ licenseNumber: drivingLicenseNumber, licenseClass: drivingLicenseClass, expiryDate: drivingLicenseExpiry }) : null,
      insuranceCertUrl: insuranceCertUrl || null,
      insurancePolicyNumber: insurancePolicyNumber || null,
      insuranceProvider: insuranceProviderName || null,
      insuranceExpiresAt: insuranceExpiry ? new Date(insuranceExpiry) : null,
      businessLicenseUrl: businessLicenseUrl || null,
      internalNotes: Object.keys(declarations).length > 0 ? JSON.stringify({ declarations, idNumber: idNumber || null, providerTypes: (() => { try { return rawProviderTypes ? (typeof rawProviderTypes === 'string' ? JSON.parse(rawProviderTypes) : rawProviderTypes) : [providerType]; } catch { return [providerType]; } })() }) : null,
      status: applicationStatus,
      ...(autoApproved ? {
        reviewedAt: new Date(),
        reviewedBy: 'system-auto-approval',
        approvedAsProviderId: providerId,
        backgroundCheckStatus: 'passed',
        backgroundCheckDate: new Date(),
      } : {}),
    }).returning();

    // Increment invite code usage only if a valid code was used
    if (code && inviteCode) {
      await db
        .update(providerInviteCodes)
        .set({ 
          currentUses: sql`${providerInviteCodes.currentUses} + 1`,
          updatedAt: new Date()
        })
        .where(eq(providerInviteCodes.inviteCode, inviteCode));
    }

    logger.info(`[Provider Onboarding] Application ${autoApproved ? 'AUTO-APPROVED' : 'submitted'}: ${applicationId} by ${authenticatedUser.uid}`, {
      traceId,
      biometricStatus,
      autoApproved,
      providerId
    });

    GoogleSheetsService.logProviderApplication({
      applicationId,
      firstName,
      lastName,
      email: authenticatedUser.email || '',
      phone: phoneNumber,
      providerType,
      city,
      country: country || 'IL',
      selfiePhotoUrl: selfieUrl || '',
      governmentIdUrl: governmentIdUrl || '',
      biometricStatus,
      biometricScore: biometricMatchScore.toString(),
      applicationStatus: autoApproved ? 'Auto-Approved' : 'Pending Review',
    }).catch(err => logger.error('[Provider Onboarding] Google Sheets logging failed - DB record saved', err));

    if (authenticatedUser.email) {
      const providerEmail = generateProviderWelcomeEmail({
        firstName,
        lastName,
        email: authenticatedUser.email,
        language: (country === 'IL' || country === 'Israel') ? 'he' : 'en',
        providerType,
        applicationId: applicationId.toString(),
        serviceTypes: (() => { try { return rawProviderTypes ? (typeof rawProviderTypes === 'string' ? JSON.parse(rawProviderTypes) : rawProviderTypes) : [providerType]; } catch { return [providerType]; } })(),
        autoApproved: autoApproved || false,
      });
      sendLuxuryEmail({
        to: authenticatedUser.email,
        subject: providerEmail.subject,
        html: providerEmail.html,
      }).catch(err => logger.error('[Provider Onboarding] Welcome email failed', err));
    }

    res.json({
      success: true,
      applicationId: application.applicationId,
      biometricStatus: application.biometricStatus,
      biometricMatchScore: parseFloat(application.biometricMatchScore || '0'),
      status: applicationStatus,
      providerId: providerId || undefined,
      message: autoApproved 
        ? 'Congratulations! Your application has been automatically approved. Welcome to ⁦Pet Wash™⁩!'
        : 'Application submitted. Your documents are being reviewed - we will get back to you shortly.'
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Application submission error', {
      traceId: req.body?.traceId,
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack?.substring(0, 500),
    });
    const clientMessage = error.code === '23505' 
      ? 'An application with these details already exists'
      : error.code === '23503'
      ? 'Invalid reference - please check your invite code'
      : error.message || 'Failed to submit application';
    res.status(500).json({ error: clientMessage });
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

    if (application.userId) {
      try {
        const existingClaims = (await auth.getUser(application.userId)).customClaims || {};
        await auth.setCustomUserClaims(application.userId, {
          ...existingClaims,
          accountType: 'provider',
          providerType: application.providerType,
          providerId,
          providerVerified: true,
        });
        logger.info(`[Provider Onboarding] Custom claims set for approved provider`, { userId: application.userId, providerType: application.providerType });
      } catch (claimsErr) {
        logger.warn('[Provider Onboarding] Failed to set custom claims', { claimsErr });
      }
    }

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
