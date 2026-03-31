// Provider Onboarding API Routes (Uber-style)
// Invite codes, KYC verification, and application management for walkers, sitters, station operators

import { Router, Request, Response } from 'express';
import { randomBytes, randomInt } from 'crypto';
import { db } from '../db';
import { providerInviteCodes, providerApplications, insertProviderApplicationSchema, providerApprovalQueue } from '@shared/schema';
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
      return res.status(401).json({ error: 'Unauthorized - No token provided', errorCode: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);
    const userEmail = decodedToken.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized - Email not found in token', errorCode: 'MISSING_EMAIL' });
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
    return res.status(403).json({ error: 'Forbidden - Admin access required', errorCode: 'ADMIN_REQUIRED' });
  } catch (error: any) {
    logger.error('Admin auth error', error, { code: error?.code });
    return res.status(401).json({ error: 'Unauthorized - Invalid token', errorCode: 'INVALID_TOKEN' });
  }
}

// =================== INVITE CODE MANAGEMENT ===================

// Generate invite code (Admin only)
router.post('/admin/invite-codes/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { providerType, maxUses, expiresAt, campaignName, referralBonus, notes } = req.body;
    const { adminUid } = req.body; // From middleware

    if (!providerType || !['walker', 'sitter', 'station_operator'].includes(providerType)) {
      return res.status(400).json({ error: 'Invalid provider type', errorCode: 'INVALID_PROVIDER_TYPE' });
    }

    // Generate unique invite code (e.g., WALKER-A8F3H9K2)
    const codePrefix = providerType.toUpperCase().substring(0, 6);
    const randomCode = randomBytes(5).toString('hex').toUpperCase();
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
    res.status(500).json({ error: error.message || 'Failed to generate invite code', errorCode: 'INVITE_CODE_FAILED' });
  }
});

// Validate invite code (Public)
router.post('/validate-invite-code', async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required', errorCode: 'MISSING_INVITE_CODE' });
    }

    const [code] = await db
      .select()
      .from(providerInviteCodes)
      .where(eq(providerInviteCodes.inviteCode, inviteCode))
      .limit(1);

    if (!code) {
      return res.status(404).json({ 
        valid: false, 
        error: 'Invalid invite code',
        errorCode: 'INVALID_INVITE_CODE'
      });
    }

    // Check if active
    if (!code.isActive) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This invite code is no longer active',
        errorCode: 'INVITE_CODE_INACTIVE'
      });
    }

    // Check if expired
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This invite code has expired',
        errorCode: 'INVITE_CODE_EXPIRED'
      });
    }

    // Check if max uses reached
    if (code.maxUses && code.currentUses >= code.maxUses) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This invite code has reached its maximum uses',
        errorCode: 'INVITE_CODE_EXHAUSTED'
      });
    }

    res.json({ 
      valid: true,
      providerType: code.providerType,
      referralBonus: code.referralBonus,
      campaignName: code.campaignName
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Validate invite code error', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to validate invite code', errorCode: 'VALIDATION_FAILED' });
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
      return res.status(401).json({ error: 'Unauthorized - Authentication required', errorCode: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split('Bearer ')[1];
    let authenticatedUser: any;
    
    try {
      authenticatedUser = await auth.verifyIdToken(token, true);
    } catch (authError: any) {
      logger.error('[Provider Onboarding] Auth error', authError, { code: authError?.code, traceId: req.body?.traceId });
      return res.status(401).json({ error: 'Unauthorized - Invalid token', errorCode: 'INVALID_TOKEN' });
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
      logger.warn('[Provider Onboarding] Missing required fields', { traceId, firstName: !!firstName, lastName: !!lastName, phoneNumber: !!phoneNumber, city: !!city, providerType: !!providerType });
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, phoneNumber, city, and providerType are required', errorCode: 'MISSING_FIELDS' });
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
      return res.status(409).json({ 
        error: 'You already have a pending application',
        errorCode: 'APPLICATION_EXISTS'
      });
    }

    // Upload files to Firebase Storage (use default bucket from initialization — no gs:// prefix)
    const bucket = storage.bucket();
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
      selfieUrl = selfieFileName; // Store path only — signed URLs generated on demand
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

    // Generate application ID — DB write happens first, biometric runs async after response
    const year = new Date().getFullYear();
    const randomNum = randomInt(0, 1000000).toString().padStart(6, '0');
    const applicationId = `APP-${year}-${randomNum}`;

    // All applications start as 'pending' with biometric in 'pending' state.
    // Biometric face-match runs asynchronously after the response is sent so that
    // network/Vision-API latency never blocks or times out the submission request.
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
      biometricMatchScore: '0',
      biometricStatus: 'pending',
      biometricFailureReason: null,
      biometricVerifiedAt: null,
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
      status: 'pending',
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

    // Create providerApprovalQueue entry so the admin review panel can see this application.
    const platformMap: Record<string, string> = {
      walker: 'walk_my_pet',
      sitter: 'sitter_suite',
      driver: 'pettrek',
      trainer: 'academy',
      station_operator: 'k9000',
    };
    const queuePlatform = platformMap[providerType] || providerType;
    try {
      const existing = await db.select({ id: providerApprovalQueue.id })
        .from(providerApprovalQueue)
        .where(and(
          eq(providerApprovalQueue.providerId, authenticatedUser.uid),
          eq(providerApprovalQueue.platform, queuePlatform)
        ))
        .limit(1);
      if (!existing.length) {
        await db.insert(providerApprovalQueue).values({
          providerId: authenticatedUser.uid,
          platform: queuePlatform,
          status: 'pending',
          priority: 'normal',
        });
        logger.info('[Provider Onboarding] Created providerApprovalQueue entry', { uid: authenticatedUser.uid, platform: queuePlatform });
      }
    } catch (queueErr: any) {
      logger.warn('[Provider Onboarding] Could not create queue entry (non-fatal)', { error: queueErr?.message });
    }

    logger.info(`[Provider Onboarding] Application submitted (biometric pending): ${applicationId} by ${authenticatedUser.uid}`, { traceId });

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
      biometricStatus: 'pending',
      biometricScore: '0',
      applicationStatus: 'Pending Review',
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
        autoApproved: false,
      });
      sendLuxuryEmail({
        to: authenticatedUser.email,
        subject: providerEmail.subject,
        html: providerEmail.html,
      }).catch(err => logger.error('[Provider Onboarding] Welcome email failed', err));
    }

    // Send response immediately — biometric check runs in background
    res.json({
      success: true,
      applicationId: application.applicationId,
      biometricStatus: 'pending',
      biometricMatchScore: 0,
      status: 'pending',
      message: 'Application submitted. Your documents are being reviewed - we will get back to you within 24 hours.',
    });

    // ── Async biometric check (fire-and-forget, never blocks the user) ─────────
    // Runs AFTER the response is sent. Updates the DB record and can auto-approve
    // if the face match passes the threshold.
    if (selfieUrl && governmentIdUrl) {
      setImmediate(async () => {
        try {
          biometricVerification.auditBiometricConsent(authenticatedUser.uid, true);
          const selfieFileRef = bucket.file(selfieUrl);
          const idFileRef = bucket.file(governmentIdUrl);
          const [selfieSignedUrl] = await selfieFileRef.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
          const [idSignedUrl] = await idFileRef.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
          const verificationResult = await biometricVerification.verifyIdentity(selfieSignedUrl, idSignedUrl);

          const matchStatus = verificationResult.isMatch ? 'verified' : 'failed';
          const matchScore = verificationResult.matchScore;
          const failureReason = verificationResult.isMatch ? null : (verificationResult.reason || 'Face match failed');

          const updatePayload: Record<string, any> = {
            biometricStatus: matchStatus,
            biometricMatchScore: matchScore.toString(),
            biometricFailureReason: failureReason,
            biometricVerifiedAt: verificationResult.isMatch ? new Date() : null,
          };

          if (verificationResult.isMatch) {
            // Auto-approve: biometric passed, documents uploaded
            const providerPrefix = providerType.toUpperCase().substring(0, 6);
            const randomId = randomBytes(5).toString('hex').toUpperCase();
            const newProviderId = `${providerPrefix}-${randomId}`;
            updatePayload.status = 'approved';
            updatePayload.reviewedAt = new Date();
            updatePayload.reviewedBy = 'system-auto-approval';
            updatePayload.approvedAsProviderId = newProviderId;
            updatePayload.backgroundCheckStatus = 'passed';
            updatePayload.backgroundCheckDate = new Date();
            logger.info('[Provider Onboarding] Async biometric PASSED — auto-approving', { applicationId, uid: authenticatedUser.uid, matchScore });
          } else {
            logger.info('[Provider Onboarding] Async biometric FAILED — staying pending', { applicationId, uid: authenticatedUser.uid, matchScore, failureReason });
          }

          await db.update(providerApplications)
            .set(updatePayload)
            .where(eq(providerApplications.applicationId, applicationId));

          logger.info('[Provider Onboarding] Async biometric update complete', { applicationId, matchStatus, matchScore });
        } catch (asyncBioErr: any) {
          logger.warn('[Provider Onboarding] Async biometric check failed (application stays pending for admin review)', { applicationId, error: asyncBioErr?.message });
        }
      });
    }
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
    const errorCode = error.code === '23505' ? 'APPLICATION_EXISTS' : error.code === '23503' ? 'INVALID_REFERENCE' : 'APPLICATION_FAILED';
    res.status(error.code === '23505' ? 409 : 500).json({ error: clientMessage, errorCode });
  }
});

// Get application status (User)
router.get('/application/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token, true);
    } catch (authErr: any) {
      return res.status(401).json({ error: 'Invalid token', errorCode: 'INVALID_TOKEN' });
    }

    const applications = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.userId, decodedToken.uid))
      .orderBy(desc(providerApplications.createdAt))
      .limit(10);

    res.json({ applications });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Get application status error', { error: error.message });
    res.status(500).json({ error: error.message, errorCode: 'STATUS_CHECK_FAILED' });
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
      return res.status(400).json({ error: 'Application ID required', errorCode: 'MISSING_APPLICATION_ID' });
    }

    const [application] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.applicationId, applicationId))
      .limit(1);

    if (!application) {
      return res.status(404).json({ error: 'Application not found', errorCode: 'APPLICATION_NOT_FOUND' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application already processed', errorCode: 'APPLICATION_ALREADY_PROCESSED' });
    }

    // Generate provider ID based on type
    const providerPrefix = application.providerType.toUpperCase().substring(0, 6);
    const randomId = randomBytes(5).toString('hex').toUpperCase();
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
          role: 'provider',
          accountType: 'provider',
          providerType: application.providerType,
          providerId,
          providerVerified: true,
          providerApprovedAt: new Date().toISOString(),
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
    logger.error('[Provider Onboarding] Approve application error', { error: error.message });
    res.status(500).json({ error: error.message, errorCode: 'APPROVAL_FAILED' });
  }
});

// Reject application (Admin only)
router.post('/admin/applications/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { applicationId, rejectionReason, internalNotes } = req.body;
    const { adminUid } = req.body; // From middleware

    if (!applicationId || !rejectionReason) {
      return res.status(400).json({ error: 'Application ID and rejection reason required', errorCode: 'MISSING_FIELDS' });
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
    logger.error('[Provider Onboarding] Reject application error', { error: error.message });
    res.status(500).json({ error: error.message, errorCode: 'REJECTION_FAILED' });
  }
});

export default router;
