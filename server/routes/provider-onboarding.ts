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
import { writeProviderAudit } from '../services/providerAudit';
import { emitProviderEvent } from '../services/providerMonitoring';
import { logProviderMessage } from '../services/providerMessageLog';
import { upsertReviewQueue, completeQueueItem, logSystemMessage, queuePriorityFromDecision as _queuePriority } from '../services/providerQueue';
import { decideProviderKyc } from '../services/providerDecisionEngine';
import { pool } from '../db';

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

// ──────────────────────────────────────────────────────────────────────────────
// ROLE MIDDLEWARE — explicit separation of Support vs Management vs Admin
//
// Role hierarchy for provider application routes:
//   requireSupport     → level >= 3 or support:applications
//                        can: view queue, view applications, send messages,
//                             request resubmission, assign reviewer
//                        cannot: approve, reject (those need requireAdmin)
//   requireAdmin       → level >= 5 or admin:providers / admin:applications
//                        can: everything Support can, PLUS approve and reject
//   requireManagement  → level >= 4 or management:view
//                        can: read-only aggregate analytics ONLY
//                        cannot: action individual applications at all
// ──────────────────────────────────────────────────────────────────────────────

async function requireSupport(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);
    const userEmail = decodedToken.email?.toLowerCase();
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized — email missing', errorCode: 'MISSING_EMAIL' });

    // Super admins always allowed
    if (isSuperAdmin(userEmail)) {
      req.body.adminUid = decodedToken.uid;
      req.body.adminEmail = userEmail;
      req.body.adminRole = 'super_admin';
      return next();
    }

    // Check DB roles
    const assignments = await db
      .select({ assignment: userRoleAssignments, role: systemRoles })
      .from(userRoleAssignments)
      .leftJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
      .where(and(eq(userRoleAssignments.userEmail, userEmail), eq(userRoleAssignments.isActive, true)))
      .limit(1);

    if (assignments.length > 0 && assignments[0].role) {
      const role = assignments[0].role;
      const permissions = role.permissions as string[];
      const hasAccess =
        role.accessLevel >= 3 ||
        permissions.includes('*') ||
        permissions.includes('support:applications') ||
        permissions.includes('admin:providers') ||
        permissions.includes('admin:applications');

      if (hasAccess) {
        req.body.adminUid = decodedToken.uid;
        req.body.adminEmail = userEmail;
        req.body.adminRole = role.roleCode;
        return next();
      }
    }

    logger.warn(`[ProviderOnboarding] Support access denied: ${userEmail}`);
    return res.status(403).json({ error: 'Forbidden — support role required', errorCode: 'SUPPORT_REQUIRED' });
  } catch (err: any) {
    return res.status(401).json({ error: 'Unauthorized — invalid token', errorCode: 'INVALID_TOKEN' });
  }
}

async function requireManagement(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', errorCode: 'AUTH_REQUIRED' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);
    const userEmail = decodedToken.email?.toLowerCase();
    if (!userEmail) return res.status(401).json({ error: 'Unauthorized — email missing', errorCode: 'MISSING_EMAIL' });

    if (isSuperAdmin(userEmail)) {
      req.body.adminUid = decodedToken.uid;
      req.body.adminEmail = userEmail;
      req.body.adminRole = 'super_admin';
      return next();
    }

    const assignments = await db
      .select({ assignment: userRoleAssignments, role: systemRoles })
      .from(userRoleAssignments)
      .leftJoin(systemRoles, eq(userRoleAssignments.roleId, systemRoles.id))
      .where(and(eq(userRoleAssignments.userEmail, userEmail), eq(userRoleAssignments.isActive, true)))
      .limit(1);

    if (assignments.length > 0 && assignments[0].role) {
      const role = assignments[0].role;
      const permissions = role.permissions as string[];
      const hasAccess =
        role.accessLevel >= 4 ||
        permissions.includes('*') ||
        permissions.includes('management:view') ||
        permissions.includes('admin:providers') ||
        permissions.includes('admin:applications');

      if (hasAccess) {
        req.body.adminUid = decodedToken.uid;
        req.body.adminEmail = userEmail;
        req.body.adminRole = role.roleCode;
        return next();
      }
    }

    logger.warn(`[ProviderOnboarding] Management access denied: ${userEmail}`);
    return res.status(403).json({ error: 'Forbidden — management role required', errorCode: 'MANAGEMENT_REQUIRED' });
  } catch (err: any) {
    return res.status(401).json({ error: 'Unauthorized — invalid token', errorCode: 'INVALID_TOKEN' });
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

          // ── 3.6. Resubmission escalation ───────────────────────────────────
          // If pending_review but the root cause is fixable image quality, prefer
          // pending_resubmission so the applicant can re-upload without a hard reject.
          const qualityIssues = forceReviewFlags.filter(f =>
            ['id_document_poor_quality', 'selfie_poor_quality', 'ocr_expiry_missing', 'ocr_document_number_missing'].includes(f)
          );
          if (outcomeStatus === 'pending_review' && qualityIssues.length >= 2 && faceScore >= 55) {
            outcomeStatus = 'pending_resubmission';
            decisionReason = `Image quality insufficient for automated decision: ${qualityIssues.join(', ')}`;
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

          // Update new schema columns not yet in Drizzle definition (raw SQL)
          pool.query(
            `UPDATE provider_applications
                SET fraud_flags = $1::jsonb,
                    sub_status = $2
              WHERE application_id = $3`,
            [
              JSON.stringify(fraudFlags),
              decisionReason.length > 200 ? decisionReason.slice(0, 200) : decisionReason,
              applicationId,
            ]
          ).catch(() => {});

          // ── 5. Audit + Queue + Monitoring (non-blocking, fire-and-forget) ─
          const dbAppRow = await pool.query(
            `SELECT id FROM provider_applications WHERE application_id = $1`,
            [applicationId]
          );
          const dbAppId: number | null = dbAppRow.rows[0]?.id ?? null;

          if (dbAppId) {
            // Write audit entry for the KYC decision
            writeProviderAudit({
              applicationId: dbAppId,
              eventType: `kyc_decision_${outcomeStatus}`,
              actorUserId: 'system-kyc2026',
              actorRole: 'system',
              payload: {
                faceScore,
                livenessScore,
                livenessPass,
                ocrConfidence,
                fraudRiskLevel,
                flags: forceReviewFlags,
                reason: decisionReason,
              },
            }).catch(() => {});

            // Emit monitoring event
            emitProviderEvent({
              applicationId: dbAppId,
              eventName: `provider_kyc_${outcomeStatus}`,
              severity: outcomeStatus === 'rejected' ? 'warning' : outcomeStatus === 'pending_review' || outcomeStatus === 'pending_resubmission' ? 'info' : 'info',
              payload: { faceScore, livenessPass, fraudRiskLevel, flags: forceReviewFlags },
            }).catch(() => {});

            // Push into review queue if human review is required
            if (outcomeStatus === 'pending_review' || outcomeStatus === 'pending_resubmission') {
              const queuePriority = fraudRiskLevel === 'high' ? 'urgent' : fraudRiskLevel === 'medium' ? 'high' : forceReviewFlags.length > 3 ? 'high' : 'normal';
              upsertReviewQueue({
                applicationId: dbAppId,
                priority: queuePriority as any,
                reviewReasons: forceReviewFlags,
                dueHours: outcomeStatus === 'pending_resubmission' ? 120 : 48,
              }).catch(() => {});

              // Log system message in the communication thread
              logSystemMessage({
                applicationId: dbAppId,
                body: outcomeStatus === 'pending_resubmission'
                  ? `KYC2026 automated decision: documents need re-upload. Reasons: ${forceReviewFlags.join(', ')}`
                  : `KYC2026 automated decision: pending manual review. Flags: ${forceReviewFlags.join(', ')}`,
                providerVisible: false,
              }).catch(() => {});
            } else if (outcomeStatus === 'approved') {
              completeQueueItem(dbAppId).catch(() => {});
            }
          }

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

              if (outcomeStatus === 'pending_resubmission' && authenticatedUser.email) {
                // ── Notify applicant: resubmission needed ───────────────────
                await sgMail.send({
                  to: authenticatedUser.email,
                  from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
                  subject: `Additional documents needed — Application ${applicationId}`,
                  html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
                      <h2 style="color:#d97706">We need better documents</h2>
                      <p>Hi ${firstName},</p>
                      <p>We were unable to process your provider application automatically because the uploaded images could not be read clearly.</p>
                      <p><strong>Issues detected:</strong> ${qualityIssues.join(', ')}</p>
                      <p>Please log back in to your provider dashboard and upload clearer photos of your ID document and selfie. Make sure:</p>
                      <ul>
                        <li>Lighting is good — no shadows or glare</li>
                        <li>Your full face is clearly visible in the selfie</li>
                        <li>The ID document is flat and all text is readable</li>
                      </ul>
                      <p>Your application ID: <strong style="font-family:monospace">${applicationId}</strong></p>
                      <p style="color:#6b7280;font-size:13px">Need help? Contact us at <a href="mailto:support@petwash.co.il">support@petwash.co.il</a></p>
                    </div>
                  `,
                });
                logger.info(`[KYC2026] Resubmission email sent`, { applicationId });
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
          logger.error('[KYC2026] Verification exception — rescuing application to pending_review', {
            applicationId,
            error: asyncErr?.message,
          });
          // CRITICAL RECOVERY: A KYC exception must never silently trap an application
          // in `processing` forever. Rescue it to pending_review so support can see it.
          try {
            await pool.query(
              `UPDATE provider_applications
                  SET status = 'pending_review',
                      sub_status = 'kyc_exception_rescued',
                      manual_decision_reason = $1
                WHERE application_id = $2
                  AND status = 'processing'`,
              [`KYC engine exception: ${asyncErr?.message?.slice(0, 200) || 'unknown error'}`, applicationId]
            );
            // Create queue entry so support can find it
            await pool.query(
              `INSERT INTO provider_review_queue
                 (application_id, status, priority, review_reasons, created_at)
               SELECT id, 'open', 'urgent',
                      $1::jsonb, NOW()
                 FROM provider_applications
                WHERE application_id = $2
               ON CONFLICT (application_id) DO NOTHING`,
              [JSON.stringify(['kyc_engine_exception']), applicationId]
            );
            // Emit critical monitoring event
            emitProviderEvent({
              applicationId: (application as any).id,
              eventName: 'kyc_exception_rescued',
              severity: 'critical',
              payload: { applicationId, error: asyncErr?.message?.slice(0, 500) },
            }).catch(() => {});
            // Write audit event
            writeProviderAudit({
              applicationId: (application as any).id,
              eventType: 'kyc_exception_rescued',
              actorUserId: 'system',
              actorRole: 'system',
              payload: { error: asyncErr?.message?.slice(0, 500) },
            }).catch(() => {});
          } catch (rescueErr: any) {
            logger.error('[KYC2026] Rescue to pending_review also failed', { applicationId, error: rescueErr?.message });
          }
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
router.get('/admin/applications/pending', requireSupport, async (req: Request, res: Response) => {
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
router.get('/admin/applications/pending-review', requireSupport, async (req: Request, res: Response) => {
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
router.get('/admin/applications/:applicationId', requireSupport, async (req: Request, res: Response) => {
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

    if (!['pending', 'pending_review', 'pending_resubmission'].includes(application.status || '')) {
      return res.status(400).json({ error: 'Application already processed', errorCode: 'APPLICATION_ALREADY_PROCESSED' });
    }

    // Generate provider ID based on type
    const providerPrefix = application.providerType.toUpperCase().substring(0, 6);
    const randomId = randomBytes(5).toString('hex').toUpperCase();
    const providerId = `${providerPrefix}-${randomId}`;

    // Atomic conditional UPDATE — only succeeds if status is still actionable.
    // This is optimistic concurrency control: no explicit lock needed because
    // the WHERE status clause makes this a no-op if another admin already acted.
    const approveResult = await pool.query(
      `UPDATE provider_applications
          SET status = 'approved',
              reviewed_by = $1,
              reviewed_at = NOW(),
              approved_as_provider_id = $2,
              internal_notes = $3,
              background_check_status = 'passed',
              background_check_date = NOW()
        WHERE application_id = $4
          AND status IN ('pending', 'pending_review', 'pending_resubmission')`,
      [adminUid || 'admin', providerId, internalNotes || null, applicationId]
    );

    if (approveResult.rowCount === 0) {
      return res.status(409).json({
        error: 'This application was already processed by another reviewer.',
        errorCode: 'CONCURRENT_ACTION_CONFLICT',
      });
    }

    // Audit + queue completion
    writeProviderAudit({
      applicationId: (application as any).id,
      eventType: 'admin_approved',
      actorUserId: adminUid || 'admin',
      actorRole: 'admin',
      payload: { applicationId, providerId, internalNotes: internalNotes || null },
    }).catch(() => {});
    completeQueueItem((application as any).id).catch(() => {});
    logSystemMessage({ applicationId: (application as any).id, body: `Application approved by admin. Provider ID: ${providerId}`, providerVisible: false }).catch(() => {});
    emitProviderEvent({ applicationId: (application as any).id, eventName: 'admin_approved', severity: 'info', payload: { adminUid, providerId } }).catch(() => {});

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

    if (!['pending', 'pending_review', 'pending_resubmission'].includes(application.status || '')) {
      return res.status(400).json({ error: 'Application already processed', errorCode: 'APPLICATION_ALREADY_PROCESSED' });
    }

    // Atomic conditional UPDATE — only succeeds if status is still actionable.
    // Same optimistic concurrency control as approve: status clause prevents double-processing.
    const rejectResult = await pool.query(
      `UPDATE provider_applications
          SET status = 'rejected',
              reviewed_by = $1,
              reviewed_at = NOW(),
              rejection_reason = $2,
              internal_notes = $3,
              manual_decision_reason = $4
        WHERE application_id = $5
          AND status IN ('pending', 'pending_review', 'pending_resubmission')`,
      [adminUid || 'admin', rejectionReason, internalNotes || null, rejectionReason, applicationId]
    );

    if (rejectResult.rowCount === 0) {
      return res.status(409).json({
        error: 'This application was already processed by another reviewer.',
        errorCode: 'CONCURRENT_ACTION_CONFLICT',
      });
    }

    // Audit + queue completion
    writeProviderAudit({
      applicationId: (application as any).id,
      eventType: 'admin_rejected',
      actorUserId: adminUid || 'admin',
      actorRole: 'admin',
      payload: { applicationId, rejectionReason, internalNotes: internalNotes || null },
    }).catch(() => {});
    completeQueueItem((application as any).id).catch(() => {});
    logSystemMessage({ applicationId: (application as any).id, body: `Application rejected. Reason: ${rejectionReason}`, providerVisible: false }).catch(() => {});
    emitProviderEvent({ applicationId: (application as any).id, eventName: 'admin_rejected', severity: 'warning', payload: { adminUid, rejectionReason } }).catch(() => {});

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

// ──────────────────────────────────────────────────────────────────────────────
// QUEUE MANAGEMENT ROUTES
// ──────────────────────────────────────────────────────────────────────────────

// GET /admin/applications/queue — full queue with filters + pagination
router.get('/admin/applications/queue', requireSupport, async (req: Request, res: Response) => {
  try {
    const { status = 'all', priority, assignedTo, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const { items, total } = await (await import('../services/providerQueue')).getQueueList({
      status,
      priority,
      assignedTo,
      limit: Math.min(parseInt(limit), 200),
      offset: parseInt(offset),
    });
    const { open, urgent } = await (await import('../services/providerQueue')).getQueueBadgeCount();
    res.json({ items, total, badge: { open, urgent } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/applications/:numericId/assign
router.post('/admin/applications/:numericId/assign', requireSupport, async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.numericId);
    const { assignedTo } = req.body;
    const { adminUid } = req.body;
    if (!assignedTo) return res.status(400).json({ error: 'assignedTo required' });
    await (await import('../services/providerQueue')).assignQueueItem({ applicationId, assignedTo });
    writeProviderAudit({ applicationId, eventType: 'queue_assigned', actorUserId: adminUid, actorRole: 'admin', payload: { assignedTo } }).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/applications/:numericId/resubmit-request — admin requests better files
router.post('/admin/applications/:numericId/resubmit-request', requireSupport, async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.numericId);
    const { reasons, adminUid, adminEmail } = req.body;
    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
      return res.status(400).json({ error: 'reasons array required' });
    }

    // Fetch application for email
    const appRow = await pool.query(
      `SELECT application_id, email, first_name, last_name, status, resubmission_count
         FROM provider_applications WHERE id = $1`,
      [applicationId]
    );
    if (!appRow.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = appRow.rows[0];

    if (!['pending_review', 'pending_resubmission'].includes(app.status)) {
      return res.status(400).json({ error: `Cannot request resubmission from status: ${app.status}` });
    }

    if (app.resubmission_count >= 3) {
      return res.status(400).json({ error: 'Maximum resubmission attempts reached (3). Reject the application instead.' });
    }

    // Generate secure token (URL-safe 32 bytes)
    const { randomBytes } = await import('crypto');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 24 * 3600 * 1000); // 5 days

    await pool.query(
      `INSERT INTO provider_application_resubmissions
         (application_id, requested_by, request_reasons, secure_token, expires_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [applicationId, adminUid || 'admin', JSON.stringify(reasons), token, expiresAt.toISOString()]
    );

    // Update application status + counter
    await pool.query(
      `UPDATE provider_applications
          SET status = 'pending_resubmission',
              resubmission_count = resubmission_count + 1,
              last_requested_resubmission_at = NOW(),
              sub_status = $1
        WHERE id = $2`,
      [`Resubmission requested: ${reasons.join(', ')}`, applicationId]
    );

    // Log audit + monitoring
    writeProviderAudit({ applicationId, eventType: 'resubmission_requested', actorUserId: adminUid, actorRole: 'admin', payload: { reasons, token: token.slice(0, 8) + '...' } }).catch(() => {});
    emitProviderEvent({ applicationId, eventName: 'resubmission_requested', severity: 'info', payload: { reasons } }).catch(() => {});

    // Log message in thread
    logProviderMessage({
      applicationId,
      direction: 'internal_note',
      channel: 'internal_note',
      body: `Admin requested resubmission. Reasons: ${reasons.join(', ')}`,
      sentBy: adminEmail || adminUid || 'admin',
      providerVisible: false,
    }).catch(() => {});

    // Email applicant
    const appUrl = process.env.APP_URL || 'https://app.petwash.co.il';
    const uploadUrl = `${appUrl}/provider-application/resubmit?token=${token}`;
    if (isSendGridConfigured() && app.email) {
      sgMail.send({
        to: app.email,
        from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
        subject: `We need updated documents — Application ${app.application_id}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
            <h2 style="color:#d97706">Updated documents needed</h2>
            <p>Hi ${app.first_name},</p>
            <p>Our team has reviewed your provider application and needs you to re-upload clearer files.</p>
            <p><strong>Reasons:</strong></p>
            <ul>${reasons.map((r: string) => `<li>${r}</li>`).join('')}</ul>
            <p>Please upload your updated documents using the link below. This link expires in 5 days.</p>
            <div style="margin:24px 0">
              <a href="${uploadUrl}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Upload Updated Documents →</a>
            </div>
            <p style="color:#6b7280;font-size:13px">Application ID: ${app.application_id} &bull; Questions? <a href="mailto:support@petwash.co.il">support@petwash.co.il</a></p>
          </div>
        `,
      }).catch(() => {});
    }

    res.json({ success: true, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    logger.error('[ProviderOnboarding] Resubmit request error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/applications/:numericId/audit — full audit trail for one application
router.get('/admin/applications/:numericId/audit', requireSupport, async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.numericId);
    const { getAuditTrail } = await import('../services/providerAudit');
    const events = await getAuditTrail(applicationId);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/applications/:numericId/messages — full thread (admin view, all messages)
router.get('/admin/applications/:numericId/messages', requireSupport, async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.numericId);
    const { getThreadMessages, clearUnreadCount } = await import('../services/providerMessageLog');
    const messages = await getThreadMessages(applicationId, true);
    clearUnreadCount(applicationId).catch(() => {});
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/applications/:numericId/message — send message or internal note
router.post('/admin/applications/:numericId/message', requireSupport, async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.numericId);
    const { body, direction = 'internal_note', channel = 'internal_note', providerVisible = false, adminUid, adminEmail } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body required' });

    // Fetch applicant email if sending outbound visible message
    let toAddress: string | null = null;
    if (direction === 'outbound' && providerVisible) {
      const appRow = await pool.query(`SELECT email FROM provider_applications WHERE id = $1`, [applicationId]);
      toAddress = appRow.rows[0]?.email || null;
    }

    await logProviderMessage({
      applicationId,
      direction: direction as any,
      channel: channel as any,
      body,
      fromAddress: adminEmail || 'support@petwash.co.il',
      toAddress,
      sentBy: adminEmail || adminUid || 'admin',
      deliveryStatus: 'sent',
      providerVisible: !!providerVisible,
    });

    // Emit outbound email if visible to provider
    if (direction === 'outbound' && providerVisible && toAddress && isSendGridConfigured()) {
      sgMail.send({
        to: toAddress,
        from: { email: 'noreply@petwash.co.il', name: 'PetWash Support' },
        subject: 'Update on your provider application',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px"><p>${body}</p><p style="color:#9ca3af;font-size:12px">PetWash Provider Onboarding Team</p></div>`,
      }).catch(() => {});
    }

    writeProviderAudit({ applicationId, eventType: 'message_sent', actorUserId: adminUid, actorRole: 'admin', payload: { direction, channel, providerVisible } }).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// APPLICANT-FACING ROUTES
// ──────────────────────────────────────────────────────────────────────────────

// GET /my/status — applicant checks their own application status
router.get('/my/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);

    const appRow = await pool.query(
      `SELECT id, application_id, status, sub_status, provider_type, first_name, last_name,
              biometric_status, biometric_match_score, biometric_verified_at,
              kyc_document_type, kyc_fraud_risk_level, kyc_decision_flags,
              resubmission_count, last_requested_resubmission_at, last_resubmitted_at,
              submitted_at, reviewed_at, reviewed_by, rejection_reason, approved_as_provider_id,
              created_at, updated_at
         FROM provider_applications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [decodedToken.uid]
    );

    if (!appRow.rows.length) return res.status(404).json({ error: 'No application found' });
    const app = appRow.rows[0];

    // Get pending resubmission token if any
    let resubmissionToken: string | null = null;
    if (app.status === 'pending_resubmission') {
      const tokenRow = await pool.query(
        `SELECT secure_token, expires_at, request_reasons
           FROM provider_application_resubmissions
          WHERE application_id = $1 AND fulfilled_at IS NULL AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1`,
        [app.id]
      );
      if (tokenRow.rows.length) {
        resubmissionToken = tokenRow.rows[0].secure_token;
      }
    }

    const appUrl = process.env.APP_URL || 'https://app.petwash.co.il';
    res.json({
      application: {
        ...app,
        kycDecisionFlags: (() => { try { return JSON.parse(app.kyc_decision_flags || '[]'); } catch { return []; } })(),
      },
      resubmissionToken,
      resubmitUrl: resubmissionToken ? `${appUrl}/provider-application/resubmit?token=${resubmissionToken}` : null,
    });
  } catch (err: any) {
    logger.error('[ProviderOnboarding] My status error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /my/messages — applicant reads their communication thread (provider-visible only)
router.get('/my/messages', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);

    const appRow = await pool.query(`SELECT id FROM provider_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [decodedToken.uid]);
    if (!appRow.rows.length) return res.status(404).json({ error: 'No application found' });

    const { getThreadMessages } = await import('../services/providerMessageLog');
    const messages = await getThreadMessages(appRow.rows[0].id, false);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC: POST /resubmit/:token — applicant uploads replacement files
//
// Auth: the secure token IS the credential (no Bearer required).
// Concurrency safety: the token row is atomically marked fulfilled_at = NOW()
// with a conditional UPDATE (WHERE fulfilled_at IS NULL). If rowCount = 0 the
// token was already used and the request is rejected 409.
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  '/resubmit/:token',
  upload.fields([
    { name: 'selfiePhoto', maxCount: 1 },
    { name: 'governmentId', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const { token } = req.params;
    if (!token || token.length < 20) {
      return res.status(400).json({ error: 'Invalid token', errorCode: 'INVALID_TOKEN' });
    }

    try {
      // ── 1. Atomically claim the token — prevents double-use ────────────────
      // The UPDATE only succeeds if fulfilled_at IS NULL and not yet expired.
      // Any concurrent request will see rowCount = 0 and get a 409.
      const claimResult = await pool.query(
        `UPDATE provider_application_resubmissions
            SET fulfilled_at = NOW()
          WHERE secure_token = $1
            AND fulfilled_at IS NULL
            AND expires_at > NOW()
          RETURNING id, application_id, request_reasons`,
        [token]
      );

      if ((claimResult.rowCount ?? 0) === 0) {
        // Either token is expired, already used, or doesn't exist
        const check = await pool.query(
          `SELECT fulfilled_at, expires_at FROM provider_application_resubmissions WHERE secure_token = $1`,
          [token]
        );
        if (!check.rows.length) {
          return res.status(404).json({ error: 'Token not found', errorCode: 'TOKEN_NOT_FOUND' });
        }
        if (check.rows[0].fulfilled_at) {
          return res.status(409).json({ error: 'This upload link has already been used.', errorCode: 'TOKEN_ALREADY_USED' });
        }
        return res.status(410).json({ error: 'This upload link has expired. Please contact support@petwash.co.il', errorCode: 'TOKEN_EXPIRED' });
      }

      const resubRow = claimResult.rows[0];
      const numericAppId: number = resubRow.application_id;
      const requestReasons: string[] = (() => {
        try { return JSON.parse(resubRow.request_reasons) || []; } catch { return []; }
      })();

      // ── 2. Load application record ─────────────────────────────────────────
      const appRow = await pool.query(
        `SELECT id, application_id, user_id, email, first_name, last_name,
                selfie_photo_url, government_id_url, status, resubmission_count
           FROM provider_applications
          WHERE id = $1`,
        [numericAppId]
      );
      if (!appRow.rows.length) {
        return res.status(404).json({ error: 'Application not found', errorCode: 'APPLICATION_NOT_FOUND' });
      }
      const app = appRow.rows[0];
      const applicationId: string = app.application_id;
      const userId: string = app.user_id;

      if (!['pending_resubmission'].includes(app.status)) {
        return res.status(400).json({
          error: `Application is in status '${app.status}' and cannot accept a resubmission.`,
          errorCode: 'INVALID_STATE_FOR_RESUBMISSION',
        });
      }

      // ── 3. Upload replacement files to Firebase Storage ────────────────────
      const bucket = storage.bucket();
      const files = req.files as Record<string, Express.Multer.File[]>;
      const version = (app.resubmission_count || 0) + 1;

      let newSelfieUrl: string = app.selfie_photo_url || '';
      let newGovIdUrl: string = app.government_id_url || '';
      let filesUploaded = 0;

      if (files?.selfiePhoto?.[0]) {
        const f = files.selfiePhoto[0];
        const ext = f.mimetype.split('/')[1] || 'jpg';
        const path = `providers/${userId}/kyc/resubmit_v${version}_selfie_${Date.now()}.${ext}`;
        await bucket.file(path).save(f.buffer, { metadata: { contentType: f.mimetype } });
        newSelfieUrl = path;
        filesUploaded++;

        // Record file version in provider_application_files
        await pool.query(
          `INSERT INTO provider_application_files
             (application_id, file_type, storage_path, mime_type, version, uploaded_at)
           VALUES ($1, 'selfie', $2, $3, $4, NOW())`,
          [numericAppId, path, f.mimetype, version]
        ).catch(() => {});
      }

      if (files?.governmentId?.[0]) {
        const f = files.governmentId[0];
        const ext = f.mimetype.split('/')[1] || 'jpg';
        const path = `providers/${userId}/kyc/resubmit_v${version}_gov_id_${Date.now()}.${ext}`;
        await bucket.file(path).save(f.buffer, { metadata: { contentType: f.mimetype } });
        newGovIdUrl = path;
        filesUploaded++;

        await pool.query(
          `INSERT INTO provider_application_files
             (application_id, file_type, storage_path, mime_type, version, uploaded_at)
           VALUES ($1, 'government_id', $2, $3, $4, NOW())`,
          [numericAppId, path, f.mimetype, version]
        ).catch(() => {});
      }

      if (filesUploaded === 0) {
        // Rollback token claim — no files means nothing happened
        await pool.query(
          `UPDATE provider_application_resubmissions SET fulfilled_at = NULL WHERE id = $1`,
          [resubRow.id]
        );
        return res.status(400).json({ error: 'At least one file (selfiePhoto or governmentId) is required.', errorCode: 'NO_FILES' });
      }

      // ── 4. Transition application → processing ────────────────────────────
      await pool.query(
        `UPDATE provider_applications
            SET status = 'processing',
                selfie_photo_url = $1,
                government_id_url = $2,
                last_resubmitted_at = NOW(),
                sub_status = 'resubmission_uploaded'
          WHERE id = $3`,
        [newSelfieUrl, newGovIdUrl, numericAppId]
      );

      // ── 5. Audit + message ────────────────────────────────────────────────
      writeProviderAudit({
        applicationId: numericAppId,
        eventType: 'resubmission_uploaded',
        actorUserId: userId,
        actorRole: 'provider',
        payload: {
          applicationId,
          version,
          filesUploaded,
          selfieReplaced: !!files?.selfiePhoto?.[0],
          govIdReplaced: !!files?.governmentId?.[0],
          requestReasons,
        },
      }).catch(() => {});

      emitProviderEvent({
        applicationId: numericAppId,
        eventName: 'resubmission_uploaded',
        severity: 'info',
        payload: { applicationId, version, filesUploaded },
      }).catch(() => {});

      logProviderMessage({
        applicationId: numericAppId,
        direction: 'inbound',
        channel: 'web',
        body: `Applicant uploaded replacement documents (v${version}). Files: ${[files?.selfiePhoto?.[0] && 'selfie', files?.governmentId?.[0] && 'government_id'].filter(Boolean).join(', ')}.`,
        sentBy: userId,
        providerVisible: false,
      }).catch(() => {});

      // ── 6. Send confirmation email to applicant ───────────────────────────
      if (isSendGridConfigured() && app.email) {
        sgMail.send({
          to: app.email,
          from: { email: 'noreply@petwash.co.il', name: 'PetWash' },
          subject: `Documents received — Application ${applicationId}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
              <h2 style="color:#0f172a">Documents received ✓</h2>
              <p>Hi ${app.first_name},</p>
              <p>We received your updated documents and have begun re-verifying your application. You will hear from us within 24 hours.</p>
              <p style="color:#6b7280;font-size:13px">Application ID: ${applicationId} &bull; Questions? <a href="mailto:support@petwash.co.il">support@petwash.co.il</a></p>
            </div>
          `,
        }).catch(() => {});
      }

      // ── 7. Respond before triggering async KYC ────────────────────────────
      res.json({
        success: true,
        applicationId,
        version,
        status: 'processing',
        message: 'Documents received. Re-verification has started.',
      });

      // ── 8. Re-trigger KYC pipeline async (same pattern as initial submit) ──
      if (newSelfieUrl && newGovIdUrl) {
        setImmediate(async () => {
          try {
            const selfieFileRef = bucket.file(newSelfieUrl);
            const idFileRef = bucket.file(newGovIdUrl);
            const [[selfieBuffer], [idBuffer]] = await Promise.all([
              selfieFileRef.download(),
              idFileRef.download(),
            ]);

            const kycResult = await kycMemoryProcessor.processDocument({
              selfieBuffer,
              idFrontBuffer: idBuffer,
              mimeType: 'image/jpeg',
            });

            const faceScore     = kycResult.faceMatchScore;
            const livenessPass  = kycResult.livenessResult.passed;
            const livenessScore = kycResult.livenessResult.confidence;
            const livenessReasons = kycResult.livenessResult.failureReasons;
            const ocrFields     = kycResult.ocrFields;
            const ocrConfidence = kycResult.ocrConfidence;
            const photoQuality  = kycResult.photoQuality;

            let outcomeStatus: string;
            let decisionReason: string;
            const forceReviewFlags: string[] = [];

            if (faceScore >= 78 && livenessPass) {
              if (!ocrFields.nameDetected)         forceReviewFlags.push('ocr_name_missing');
              if (!ocrFields.birthDateDetected)    forceReviewFlags.push('ocr_dob_missing');
              if (!ocrFields.expiryDateDetected)   forceReviewFlags.push('ocr_expiry_missing');
              if (!ocrFields.idNumberDetected)     forceReviewFlags.push('ocr_id_number_missing');
              if (ocrConfidence < 50)              forceReviewFlags.push('ocr_confidence_low');
              if (photoQuality.idQuality === 'poor')     forceReviewFlags.push('id_document_poor_quality');
              if (photoQuality.selfieQuality === 'poor') forceReviewFlags.push('selfie_poor_quality');

              if (forceReviewFlags.length > 0) {
                outcomeStatus = 'pending_review';
                decisionReason = `Resubmission KYC: face ${faceScore.toFixed(1)}/100 + liveness passed but flagged — ${forceReviewFlags.join(', ')}`;
              } else {
                outcomeStatus = 'approved';
                decisionReason = `Resubmission KYC: face ${faceScore.toFixed(1)}/100, liveness ${livenessScore.toFixed(0)}%, OCR complete`;
              }
            } else if (faceScore >= 55) {
              outcomeStatus = 'pending_review';
              decisionReason = `Resubmission KYC: face ${faceScore.toFixed(1)}/100 (inconclusive)${!livenessPass ? `; liveness failed: ${livenessReasons.join(', ')}` : ''}`;
            } else {
              // Repeated poor quality after resubmission → reject
              outcomeStatus = 'rejected';
              decisionReason = `Resubmission KYC: face ${faceScore.toFixed(1)}/100 (mismatch)${!livenessPass ? `; liveness failed: ${livenessReasons.join(', ')}` : ''}`;
            }

            // Update application with KYC outcome
            await pool.query(
              `UPDATE provider_applications
                  SET status = $1,
                      biometric_match_score = $2,
                      biometric_status = $3,
                      kyc_liveness_score = $4,
                      kyc_ocr_confidence = $5,
                      kyc_decision_flags = $6::jsonb,
                      manual_decision_reason = $7,
                      updated_at = NOW()
                WHERE id = $8`,
              [
                outcomeStatus,
                faceScore.toString(),
                livenessPass ? 'verified' : 'failed',
                Math.round(livenessScore),
                Math.round(ocrConfidence),
                JSON.stringify(forceReviewFlags),
                decisionReason.slice(0, 400),
                numericAppId,
              ]
            );

            writeProviderAudit({
              applicationId: numericAppId,
              eventType: `kyc_resubmission_decision_${outcomeStatus}`,
              actorUserId: 'system-kyc2026',
              actorRole: 'system',
              payload: { faceScore, livenessPass, ocrConfidence, flags: forceReviewFlags, reason: decisionReason, version },
            }).catch(() => {});

            emitProviderEvent({
              applicationId: numericAppId,
              eventName: `resubmission_kyc_${outcomeStatus}`,
              severity: outcomeStatus === 'rejected' ? 'warning' : 'info',
              payload: { faceScore, livenessPass, outcomeStatus, version },
            }).catch(() => {});

            if (outcomeStatus === 'pending_review') {
              const { upsertReviewQueue, logSystemMessage } = await import('../services/providerQueue');
              upsertReviewQueue({ applicationId: numericAppId, priority: 'high', reviewReasons: forceReviewFlags, dueHours: 24 }).catch(() => {});
              logSystemMessage({ applicationId: numericAppId, body: `Resubmission v${version} reviewed — pending manual review. Flags: ${forceReviewFlags.join(', ')}`, providerVisible: false }).catch(() => {});
            } else if (outcomeStatus === 'approved') {
              const { completeQueueItem } = await import('../services/providerQueue');
              completeQueueItem(numericAppId).catch(() => {});
            }

            logger.info(`[KYC2026] Resubmission KYC complete: ${outcomeStatus}`, { applicationId, version, faceScore, livenessPass });
          } catch (kycErr: any) {
            logger.error('[KYC2026] Resubmission KYC exception — rescuing to pending_review', { applicationId, error: kycErr?.message });
            try {
              await pool.query(
                `UPDATE provider_applications
                    SET status = 'pending_review', sub_status = 'resubmission_kyc_exception'
                  WHERE id = $1 AND status = 'processing'`,
                [numericAppId]
              );
              await pool.query(
                `INSERT INTO provider_review_queue
                   (application_id, status, priority, review_reasons, created_at)
                 VALUES ($1, 'open', 'urgent', $2::jsonb, NOW())
                 ON CONFLICT (application_id) DO NOTHING`,
                [numericAppId, JSON.stringify(['resubmission_kyc_exception'])]
              );
              emitProviderEvent({ applicationId: numericAppId, eventName: 'resubmission_kyc_exception', severity: 'critical', payload: { error: kycErr?.message?.slice(0, 400) } }).catch(() => {});
            } catch { /* last-ditch — already logged */ }
          }
        });
      }
    } catch (err: any) {
      logger.error('[ProviderOnboarding] Resubmit token upload error', { error: err.message });
      res.status(500).json({ error: err.message, errorCode: 'RESUBMIT_FAILED' });
    }
  }
);

export default router;

