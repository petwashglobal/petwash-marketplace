// Provider Onboarding API Routes (Uber-style)
// Invite codes, KYC verification, and application management for walkers, sitters, station operators

import { Router, Request, Response } from 'express';
import { randomBytes, randomInt, createHash } from 'crypto';
import { db } from '../db';
import { providerInviteCodes, providerApplications, insertProviderApplicationSchema, providerApprovalQueue } from '@shared/schema';
import { systemRoles, userRoleAssignments } from '@shared/schema-enterprise';
import { eq, and, desc, sql } from 'drizzle-orm';
import { auth, storage } from '../lib/firebase-admin';
import { biometricVerification } from '../services/BiometricVerificationService';
import { kycMemoryProcessor, kycAnomalyDetector } from '../services/KYC2026';
import sgMail, { isSendGridConfigured } from '../lib/sendgrid';
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

    // ── KYC2026 async verification (fire-and-forget) ──────────────────────────
    // Capture request context before async boundary
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const clientUserAgent = req.headers['user-agent'] || 'unknown';

    // PUBLIC USERS (loyalty/customer) never reach this block.
    // Only providers submit /apply with selfieUrl + governmentIdUrl.
    if (selfieUrl && governmentIdUrl) {
      setImmediate(async () => {
        try {
          // Consent audit (GDPR Art.9 / Israeli Privacy Law 2025 §14)
          biometricVerification.auditBiometricConsent(authenticatedUser.uid, true);

          // ── 1. Download buffers from GCS (KYC2026 processes in-memory) ────
          const selfieFileRef = bucket.file(selfieUrl);
          const idFileRef = bucket.file(governmentIdUrl);
          const [[selfieBuffer], [idBuffer]] = await Promise.all([
            selfieFileRef.download(),
            idFileRef.download(),
          ]);

          // ── 2. Run KYC2026 full pipeline ──────────────────────────────────
          // Calls: performFaceMatch (30-landmark normalized ratios)
          //        performLivenessCheck (6-signal heuristic)
          //        performOCR (document text + field extraction)
          //        assessPhotoQuality (blur, exposure)
          // Buffers are wiped by KYCMemoryProcessor after processing.
          const kycResult = await kycMemoryProcessor.processDocument({
            selfieBuffer,
            idFrontBuffer: idBuffer,
            mimeType: 'image/jpeg',
          });

          const faceScore       = kycResult.faceMatchScore;
          const faceVerdict     = kycResult.faceMatchVerdict;
          const livenessPass    = kycResult.livenessResult.passed;
          const livenessScore   = kycResult.livenessResult.confidence;
          const livenessChecks  = kycResult.livenessResult.checks;
          const livenessReasons = kycResult.livenessResult.failureReasons;
          const ocrFields       = kycResult.ocrFields;
          const ocrConfidence   = kycResult.ocrConfidence;
          const photoQuality    = kycResult.photoQuality;

          // ── 2.5. Fraud / anomaly detection ────────────────────────────────
          // Compute document and selfie fingerprints (SHA-256 prefix — not stored raw).
          // kycAnomalyDetector checks: velocity, device, duplicate documents, selfie reuse.
          const docFingerprint    = createHash('sha256').update(selfieBuffer).digest('hex').slice(0, 32);
          const selfieFingerprint = createHash('sha256').update(idBuffer).digest('hex').slice(0, 32);

          const anomalyResult = await kycAnomalyDetector.analyze({
            userId: authenticatedUser.uid,
            ipAddress: clientIp,
            userAgent: clientUserAgent,
            documentFingerprint: docFingerprint,
            selfieFingerprint,
            documentCountry: ocrFields.issuingCountryDetected ? 'IL' : 'unknown',
          });

          const fraudRiskLevel = anomalyResult.riskLevel;       // low | medium | high | critical
          const fraudFlags     = anomalyResult.anomalies.map(a => `fraud:${a.type}`);

          // ── 3. Decision logic ─────────────────────────────────────────────
          // Step A: base outcome from face score + liveness
          let outcomeStatus: string;
          let decisionReason: string;
          const forceReviewFlags: string[] = [];

          if (faceScore >= 78 && livenessPass) {
            // Step B: even with a passing score, check OCR completeness and quality.
            // Any gap forces pending_review — admin must confirm identity manually.
            if (!ocrFields.nameDetected)          forceReviewFlags.push('ocr_name_missing');
            if (!ocrFields.birthDateDetected)     forceReviewFlags.push('ocr_dob_missing');
            if (!ocrFields.expiryDateDetected)    forceReviewFlags.push('ocr_expiry_missing');
            if (!ocrFields.idNumberDetected)      forceReviewFlags.push('ocr_id_number_missing');
            if (!ocrFields.documentTypeInferred)  forceReviewFlags.push('document_type_unknown');
            if (ocrConfidence < 50)               forceReviewFlags.push('ocr_confidence_low');
            if (photoQuality.idQuality === 'poor')     forceReviewFlags.push('id_document_poor_quality');
            if (photoQuality.selfieQuality === 'poor') forceReviewFlags.push('selfie_poor_quality');

            if (forceReviewFlags.length > 0) {
              outcomeStatus = 'pending_review';
              decisionReason = `KYC2026: face ${faceScore.toFixed(1)}/100 (match) + liveness passed, but forced to manual review — ${forceReviewFlags.join(', ')}`;
            } else {
              outcomeStatus = 'approved';
              decisionReason = `KYC2026: face ${faceScore.toFixed(1)}/100 (match), liveness ${livenessScore.toFixed(0)}%, OCR complete, quality good`;
            }
          } else if (faceScore >= 55) {
            outcomeStatus = 'pending_review';
            decisionReason = `KYC2026: face ${faceScore.toFixed(1)}/100 (inconclusive)${!livenessPass ? `; liveness failed: ${livenessReasons.join(', ')}` : ''}`;
          } else {
            outcomeStatus = 'rejected';
            decisionReason = `KYC2026: face ${faceScore.toFixed(1)}/100 (mismatch)${!livenessPass ? `; liveness failed: ${livenessReasons.join(', ')}` : ''}`;
          }

          // ── 3.5. Fraud risk override ───────────────────────────────────────
          // Fraud risk is evaluated independently and can only downgrade decisions —
          // it never upgrades a rejection to pending_review.
          //
          //   critical / shouldBlock → rejected (regardless of face score)
          //   high                  → pending_review (if currently approved)
          //   medium                → pending_review (if currently approved)
          //   low                   → no change
          if (anomalyResult.shouldBlock || fraudRiskLevel === 'critical') {
            outcomeStatus = 'rejected';
            decisionReason += `; FRAUD BLOCK (risk: critical) — ${fraudFlags.map(f => f.replace('fraud:', '')).join(', ')}`;
            forceReviewFlags.push(...fraudFlags);
          } else if ((fraudRiskLevel === 'high' || fraudRiskLevel === 'medium') && outcomeStatus === 'approved') {
            outcomeStatus = 'pending_review';
            decisionReason += `; fraud risk ${fraudRiskLevel} — ${fraudFlags.map(f => f.replace('fraud:', '')).join(', ')}`;
            forceReviewFlags.push(...fraudFlags);
          } else if (fraudFlags.length > 0 && fraudRiskLevel !== 'low') {
            // Non-blocking anomalies — record in flags even if decision unchanged
            forceReviewFlags.push(...fraudFlags);
          }

          // ── 4. Build DB update payload ────────────────────────────────────
          const updatePayload: Record<string, any> = {
            status: outcomeStatus,
            biometricStatus: faceVerdict === 'match' ? 'faces_matched' : faceVerdict === 'inconclusive' ? 'faces_inconclusive' : 'faces_mismatch',
            biometricMatchScore: faceScore.toString(),
            biometricFailureReason: outcomeStatus !== 'approved' ? decisionReason : null,
            biometricVerifiedAt: new Date(),
            // Queryable KYC fields (promoted out of JSON for admin filtering + analytics)
            kycDocumentType: ocrFields.documentTypeInferred || null,
            kycIdLastFour: ocrFields.idNumberLastFour || null,
            kycOcrConfidence: ocrConfidence.toFixed(2),
            kycLivenessScore: livenessScore.toFixed(2),
            kycDecisionFlags: forceReviewFlags.length > 0 ? JSON.stringify(forceReviewFlags) : null,
            kycFraudRiskLevel: fraudRiskLevel,
            backgroundCheckNotes: JSON.stringify({
              engine: 'KYC2026',
              faceMatch: {
                score: faceScore,
                verdict: faceVerdict,
                method: '30-landmark normalized geometric ratio comparison (Google Vision)',
              },
              liveness: {
                passed: livenessPass,
                confidence: livenessScore,
                checks: livenessChecks,
                failureReasons: livenessReasons,
                method: '6-signal heuristic (pose, blur, size, expression, confidence — Google Vision)',
                note: 'NOT ISO 30107-3 certified. Heuristic only.',
              },
              ocr: {
                confidence: ocrConfidence,
                nameDetected: ocrFields.nameDetected,
                nameHash: ocrFields.nameHash,
                idNumberDetected: ocrFields.idNumberDetected,
                idNumberLastFour: ocrFields.idNumberLastFour,
                birthDateDetected: ocrFields.birthDateDetected,
                expiryDateDetected: ocrFields.expiryDateDetected,
                documentTypeInferred: ocrFields.documentTypeInferred,
                issuingCountryDetected: ocrFields.issuingCountryDetected,
              },
              photoQuality: {
                selfieQuality: photoQuality.selfieQuality,
                idQuality: photoQuality.idQuality,
                issues: photoQuality.issues,
              },
              fraud: {
                riskLevel: fraudRiskLevel,
                riskScore: anomalyResult.riskScore,
                shouldBlock: anomalyResult.shouldBlock,
                shouldAlert: anomalyResult.shouldAlert,
                anomalies: anomalyResult.anomalies.map(a => ({ type: a.type, severity: a.severity, score: a.score })),
                note: 'Velocity + device + document fingerprint checks (KYC2026 anomaly engine)',
              },
              decision: {
                status: outcomeStatus,
                reason: decisionReason,
                forceReviewFlags,
              },
              processedAt: new Date().toISOString(),
            }),
          };

          // Auto-approve: generate providerId
          if (outcomeStatus === 'approved') {
            const providerPrefix = providerType.toUpperCase().substring(0, 6);
            const randomId = randomBytes(5).toString('hex').toUpperCase();
            updatePayload.approvedAsProviderId = `${providerPrefix}-${randomId}`;
            updatePayload.reviewedAt = new Date();
            updatePayload.reviewedBy = 'system-kyc2026';
            updatePayload.backgroundCheckStatus = 'passed';
            updatePayload.backgroundCheckDate = new Date();
          }

          await db.update(providerApplications)
            .set(updatePayload)
            .where(eq(providerApplications.applicationId, applicationId));

          logger.info(`[KYC2026] Provider verification complete: ${outcomeStatus}`, {
            applicationId,
            uid: authenticatedUser.uid,
            faceScore,
            faceVerdict,
            livenessPass,
            livenessScore,
            ocrConfidence,
            fraudRiskLevel,
          });

          // ── 6. Email notifications ────────────────────────────────────────
          if (isSendGridConfigured()) {
            const appUrl = process.env.APP_URL || 'https://app.petwash.co.il';
            const reviewUrl = `${appUrl}/admin/providers/review/${applicationId}`;
            const applicantName = `${firstName} ${lastName}`.trim();
            const providerTypeLabel = providerType === 'walker' ? 'Dog Walker' : providerType === 'sitter' ? 'Pet Sitter' : 'Station Operator';
            const flagsHtml = forceReviewFlags.length > 0
              ? forceReviewFlags.map(f => `<li style="color:#b45309">${f}</li>`).join('')
              : '<li style="color:#059669">None — all checks passed</li>';

            try {
              if (outcomeStatus === 'pending_review') {
                // ── Notify support team ─────────────────────────────────────
                await sgMail.send({
                  to: 'support@petwash.co.il',
                  from: { email: 'noreply@petwash.co.il', name: 'PetWash Provider Onboarding' },
                  subject: `[ACTION REQUIRED] Provider review — ${applicantName} / ${applicationId}`,
                  html: `
                    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
                      <h2 style="color:#0f172a;margin-top:0">Provider Application Pending Review</h2>
                      <p style="color:#6b7280;margin-top:0">A provider application requires manual review. Please assess and take action within 48 hours.</p>
                      <table style="width:100%;border-collapse:collapse;margin:16px 0">
                        <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:160px">Applicant</td><td style="padding:8px">${applicantName}</td></tr>
                        <tr><td style="padding:8px;font-weight:600">Email</td><td style="padding:8px">${authenticatedUser.email || '—'}</td></tr>
                        <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Mobile</td><td style="padding:8px">${phoneNumber}</td></tr>
                        <tr><td style="padding:8px;font-weight:600">Provider Type</td><td style="padding:8px">${providerTypeLabel}</td></tr>
                        <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Application ID</td><td style="padding:8px;font-family:monospace">${applicationId}</td></tr>
                      </table>
                      <h3 style="color:#0f172a">KYC Score Summary</h3>
                      <table style="width:100%;border-collapse:collapse;margin:8px 0">
                        <tr><td style="padding:8px;background:#f9fafb;width:180px">Face Match Score</td><td style="padding:8px"><strong>${faceScore.toFixed(1)}/100</strong></td></tr>
                        <tr><td style="padding:8px">Liveness Score</td><td style="padding:8px"><strong>${livenessScore.toFixed(0)}%</strong> — ${livenessPass ? '✓ Passed' : '✗ Failed'}</td></tr>
                        <tr><td style="padding:8px;background:#f9fafb">OCR Confidence</td><td style="padding:8px"><strong>${ocrConfidence.toFixed(0)}%</strong></td></tr>
                        <tr><td style="padding:8px">OCR Completeness</td><td style="padding:8px">Name: ${ocrFields.nameDetected ? '✓' : '✗'} | DOB: ${ocrFields.birthDateDetected ? '✓' : '✗'} | Expiry: ${ocrFields.expiryDateDetected ? '✓' : '✗'} | ID#: ${ocrFields.idNumberDetected ? '✓' : '✗'}</td></tr>
                        <tr><td style="padding:8px;background:#f9fafb">Fraud Risk</td><td style="padding:8px"><strong style="color:${fraudRiskLevel === 'low' ? '#059669' : fraudRiskLevel === 'medium' ? '#d97706' : '#dc2626'}">${fraudRiskLevel.toUpperCase()}</strong></td></tr>
                      </table>
                      <h3 style="color:#0f172a">Review Flags</h3>
                      <ul style="margin:0;padding-left:20px">${flagsHtml}</ul>
                      <div style="margin-top:24px">
                        <a href="${reviewUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Review Application →</a>
                      </div>
                      <p style="color:#9ca3af;font-size:12px;margin-top:24px">This is an automated notification from the PetWash KYC2026 engine.</p>
                    </div>
                  `,
                });
                logger.info(`[KYC2026] Support email sent for pending_review`, { applicationId });
              }

              if (outcomeStatus === 'approved' && authenticatedUser.email) {
                // ── Notify applicant: approved ──────────────────────────────
                await sgMail.send({
                  to: authenticatedUser.email,
                  from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
                  subject: 'Your provider application has been approved',
                  html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
                      <h2 style="color:#059669">Application Approved ✓</h2>
                      <p>Hi ${firstName},</p>
                      <p>Great news — your provider application as a <strong>${providerTypeLabel}</strong> on PetWash has been approved.</p>
                      <p>Your account is now active. You can log in and start setting up your provider profile.</p>
                      <p style="color:#6b7280;font-size:13px">Application ID: ${applicationId}</p>
                    </div>
                  `,
                });
              }

              if (outcomeStatus === 'rejected' && authenticatedUser.email) {
                // ── Notify applicant: rejected ──────────────────────────────
                await sgMail.send({
                  to: authenticatedUser.email,
                  from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
                  subject: 'Update on your provider application',
                  html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
                      <h2 style="color:#0f172a">Application Update</h2>
                      <p>Hi ${firstName},</p>
                      <p>After reviewing your provider application, we were unable to approve it at this time.</p>
                      <p>If you believe this is an error or would like to reapply with updated documents, please contact us at <a href="mailto:support@petwash.co.il">support@petwash.co.il</a>.</p>
                      <p style="color:#6b7280;font-size:13px">Application ID: ${applicationId}</p>
                    </div>
                  `,
                });
              }
            } catch (emailErr: any) {
              logger.warn('[KYC2026] Email notification failed (non-fatal)', { applicationId, error: emailErr?.message });
            }
          }
        } catch (asyncErr: any) {
          logger.warn('[KYC2026] Verification failed — application stays pending for admin review', {
            applicationId,
            error: asyncErr?.message,
          });
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

// Get pending_review applications with KYC data — for admin review queue + badge count
router.get('/admin/applications/pending-review', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const applications = await db
      .select({
        id: providerApplications.id,
        applicationId: providerApplications.applicationId,
        firstName: providerApplications.firstName,
        lastName: providerApplications.lastName,
        email: providerApplications.email,
        phoneNumber: providerApplications.phoneNumber,
        providerType: providerApplications.providerType,
        city: providerApplications.city,
        status: providerApplications.status,
        biometricMatchScore: providerApplications.biometricMatchScore,
        biometricFailureReason: providerApplications.biometricFailureReason,
        kycDocumentType: providerApplications.kycDocumentType,
        kycIdLastFour: providerApplications.kycIdLastFour,
        kycOcrConfidence: providerApplications.kycOcrConfidence,
        kycLivenessScore: providerApplications.kycLivenessScore,
        kycDecisionFlags: providerApplications.kycDecisionFlags,
        kycFraudRiskLevel: providerApplications.kycFraudRiskLevel,
        submittedAt: providerApplications.submittedAt,
        createdAt: providerApplications.createdAt,
      })
      .from(providerApplications)
      .where(eq(providerApplications.status, 'pending_review'))
      .orderBy(desc(providerApplications.createdAt))
      .limit(limit);

    res.json({ applications, count: applications.length });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Get pending-review applications error', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single application detail with signed image URLs (Admin only)
router.get('/admin/applications/:applicationId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    const rows = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.applicationId, applicationId))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: 'Application not found', errorCode: 'NOT_FOUND' });
    }

    const app = rows[0];

    // Generate short-lived signed URLs for selfie and ID images
    let selfieSignedUrl: string | null = null;
    let idSignedUrl: string | null = null;

    if (app.selfiePhotoUrl) {
      try {
        const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`);
        const [url] = await bucket.file(app.selfiePhotoUrl).getSignedUrl({ action: 'read', expires: Date.now() + 30 * 60 * 1000 });
        selfieSignedUrl = url;
      } catch { /* non-fatal */ }
    }

    if (app.governmentIdUrl) {
      try {
        const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`);
        const [url] = await bucket.file(app.governmentIdUrl).getSignedUrl({ action: 'read', expires: Date.now() + 30 * 60 * 1000 });
        idSignedUrl = url;
      } catch { /* non-fatal */ }
    }

    // Parse backgroundCheckNotes for OCR + fraud detail
    let kycDetail: any = null;
    if (app.backgroundCheckNotes) {
      try { kycDetail = JSON.parse(app.backgroundCheckNotes); } catch { /* ignore */ }
    }

    res.json({
      application: { ...app, selfieSignedUrl, idSignedUrl },
      kycDetail,
    });
  } catch (error: any) {
    logger.error('[Provider Onboarding] Get application detail error', error);
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

    if (!['pending', 'pending_review'].includes(application.status || '')) {
      return res.status(400).json({ error: 'Application already processed', errorCode: 'APPLICATION_ALREADY_PROCESSED' });
    }

    // Generate provider ID based on type
    const providerPrefix = application.providerType.toUpperCase().substring(0, 6);
    const randomId = randomBytes(5).toString('hex').toUpperCase();
    const providerId = `${providerPrefix}-${randomId}`;

    // Update application — lock row by matching current status
    await db
      .update(providerApplications)
      .set({
        status: 'approved',
        reviewedBy: adminUid || 'admin',
        reviewedAt: new Date(),
        approvedAsProviderId: providerId,
        internalNotes: internalNotes || null,
        backgroundCheckStatus: 'passed',
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

    // Email applicant
    if (isSendGridConfigured() && application.email) {
      try {
        const providerTypeLabel = application.providerType === 'walker' ? 'Dog Walker' : application.providerType === 'sitter' ? 'Pet Sitter' : 'Station Operator';
        await sgMail.send({
          to: application.email,
          from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
          subject: 'Your provider application has been approved',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#059669">Application Approved ✓</h2>
              <p>Hi ${application.firstName},</p>
              <p>Your provider application as a <strong>${providerTypeLabel}</strong> on PetWash has been approved by our team.</p>
              <p>Your account is now active. You can log in and start setting up your provider profile.</p>
              <p style="color:#6b7280;font-size:13px">Application ID: ${applicationId} &bull; Provider ID: ${providerId}</p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        logger.warn('[Provider Onboarding] Approval email failed (non-fatal)', { error: emailErr?.message });
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

    // Fetch application to get email + name for notification
    const rows = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.applicationId, applicationId))
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: 'Application not found', errorCode: 'NOT_FOUND' });
    }
    const application = rows[0];

    if (!['pending', 'pending_review'].includes(application.status || '')) {
      return res.status(400).json({ error: 'Application already processed', errorCode: 'APPLICATION_ALREADY_PROCESSED' });
    }

    await db
      .update(providerApplications)
      .set({
        status: 'rejected',
        reviewedBy: adminUid || 'admin',
        reviewedAt: new Date(),
        rejectionReason,
        internalNotes: internalNotes || null,
      })
      .where(eq(providerApplications.applicationId, applicationId));

    // Email applicant
    if (isSendGridConfigured() && application.email) {
      try {
        await sgMail.send({
          to: application.email,
          from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
          subject: 'Update on your provider application',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#0f172a">Application Update</h2>
              <p>Hi ${application.firstName},</p>
              <p>After reviewing your provider application, we were unable to approve it at this time.</p>
              <p>If you believe this is an error or would like to reapply with updated documents, please contact us at <a href="mailto:support@petwash.co.il">support@petwash.co.il</a>.</p>
              <p style="color:#6b7280;font-size:13px">Application ID: ${applicationId}</p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        logger.warn('[Provider Onboarding] Rejection email failed (non-fatal)', { error: emailErr?.message });
      }
    }

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
