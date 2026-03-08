import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { 
  providerApplicants, 
  providerDocuments, 
  providerBackgroundChecks,
  providerOnboardingTasks,
  providerStageTransitions,
  providerApplicationFormSchema,
  insertProviderApplicantSchema,
  insertProviderDocumentSchema,
  insertProviderStageTransitionSchema
} from '@shared/schema-enterprise';
import { eq, desc, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { sendProviderEnrollmentConfirmation } from '../email/luxury-email-service';
import { logProviderApplication } from '../services/googleSheetsIntegration';
import { twilioSMSService } from '../services/TwilioSMSService';
import { assignProviderMembership } from '../services/MembershipService';
import { auth as firebaseAuth } from '../lib/firebase-admin';

const submissionRateMap = new Map<string, { count: number; resetAt: number }>();
const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 3;

function checkSubmissionRate(ip: string): boolean {
  const now = Date.now();
  const entry = submissionRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    submissionRateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) {
    logger.warn('[ProviderApplication] Rate limit hit', { ip: ip.slice(0, 8) + '***' });
    return false;
  }
  entry.count++;
  return true;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'galleryPhotos', maxCount: 5 },
]);

const router = Router();

// Helper: Generate SHA-256 hash
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

// Helper: Generate secure token
function generateToken(): string {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 64);
}

// Helper: Get required documents based on service types
function getRequiredDocuments(serviceTypes: string[]): string[] {
  const required = ['national_id', 'profile_photo'];
  
  if (serviceTypes.includes('pet_transport') || serviceTypes.includes('dog_walking')) {
    required.push('drivers_license', 'vehicle_registration', 'vehicle_insurance');
  }
  if (serviceTypes.includes('pet_sitting')) {
    required.push('home_photos');
  }
  if (serviceTypes.includes('grooming')) {
    required.push('grooming_cert');
  }
  if (serviceTypes.includes('veterinary_house_calls')) {
    required.push('veterinary_cert');
  }
  
  // Always require these
  required.push('criminal_background', 'insurance_policy', 'tax_registration', 'bank_details');
  
  return [...new Set(required)];
}

// Helper: Create onboarding tasks for applicant
async function createOnboardingTasks(applicantId: number, serviceTypes: string[]) {
  const requiredDocs = getRequiredDocuments(serviceTypes);
  
  const tasks = [
    { taskKey: 'SUBMIT_APPLICATION', taskName: 'Submit Application', taskNameHe: 'הגש מועמדות', stage: 'application_submitted', sortOrder: 1, isRequired: true },
    
    ...requiredDocs.map((docType, idx) => ({
      taskKey: `UPLOAD_${docType.toUpperCase()}`,
      taskName: `Upload ${docType.replace(/_/g, ' ')}`,
      taskNameHe: getHebrewDocName(docType),
      stage: 'documents_pending',
      sortOrder: idx + 1,
      isRequired: true,
    })),
    
    { taskKey: 'CRIMINAL_CHECK', taskName: 'Criminal Background Check', taskNameHe: 'בדיקת רקע פלילי', stage: 'background_check_pending', sortOrder: 1, isRequired: true },
    { taskKey: 'REFERENCE_CHECK', taskName: 'Reference Verification', taskNameHe: 'אימות המלצות', stage: 'background_check_pending', sortOrder: 2, isRequired: true },
  ];
  
  for (const task of tasks) {
    await db.insert(providerOnboardingTasks).values({
      applicantId,
      ...task,
      status: task.taskKey === 'SUBMIT_APPLICATION' ? 'completed' : 'pending',
      completedAt: task.taskKey === 'SUBMIT_APPLICATION' ? new Date() : null
    });
  }
}

function getHebrewDocName(docType: string): string {
  const names: Record<string, string> = {
    national_id: 'תעודת זהות',
    drivers_license: 'רישיון נהיגה',
    criminal_background: 'אישור משטרה',
    pet_first_aid_cert: 'תעודת עזרה ראשונה לחיות',
    grooming_cert: 'תעודת טיפוח',
    veterinary_cert: 'רישיון וטרינרי',
    insurance_policy: 'פוליסת ביטוח',
    vehicle_registration: 'רישיון רכב',
    vehicle_insurance: 'ביטוח רכב',
    home_photos: 'תמונות הבית',
    profile_photo: 'תמונת פרופיל',
    tax_registration: 'רישום מס',
    bank_details: 'פרטי בנק',
    references: 'המלצות'
  };
  return names[docType] || docType;
}

// Helper: Record stage transition with hash chain
async function recordStageTransition(
  applicantId: number, 
  fromStage: string | null, 
  toStage: string,
  triggeredByUid: string | null,
  reason: string,
  metadata: any = {},
  req: Request
) {
  // Get previous hash for chain
  const lastTransition = await db.select()
    .from(providerStageTransitions)
    .where(eq(providerStageTransitions.applicantId, applicantId))
    .orderBy(desc(providerStageTransitions.createdAt))
    .limit(1);
  
  const previousHash = lastTransition[0]?.transitionHash || null;
  
  // Create transition hash
  const transitionData = JSON.stringify({
    applicantId,
    fromStage,
    toStage,
    triggeredByUid,
    reason,
    timestamp: new Date().toISOString(),
    previousHash
  });
  const transitionHash = sha256(transitionData);
  
  await db.insert(providerStageTransitions).values({
    applicantId,
    fromStage,
    toStage,
    transitionReason: reason,
    triggeredByUid,
    triggeredBySystem: !triggeredByUid,
    metadata,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
    userAgent: req.headers['user-agent'] || null,
    previousHash,
    transitionHash
  });
  
  logger.info('[ProviderApplication] Stage transition recorded', {
    applicantId,
    fromStage,
    toStage,
    transitionHash: transitionHash.substring(0, 16) + '...'
  });
}

// =================== PUBLIC ROUTES (Authenticated Users) ===================

// POST /api/provider-applications - Submit new application
router.post('/', uploadFields, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!checkSubmissionRate(clientIp)) {
      return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Too many applications submitted. Please wait an hour before trying again.' });
    }
    
    let bodyData = req.body;
    if (req.body.applicationData) {
      try {
        bodyData = JSON.parse(req.body.applicationData);
      } catch {
        return res.status(400).json({ error: 'Invalid application data format' });
      }
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const profilePhotoFile = files?.profilePhoto?.[0];
    const galleryPhotoFiles = files?.galleryPhotos || [];
    
    // Validate form data
    const validationResult = providerApplicationFormSchema.safeParse(bodyData);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.flatten() 
      });
    }
    
    const formData = validationResult.data;
    
    // Check for existing application
    const existing = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.userId, userId))
      .limit(1);
    
    if (existing.length > 0) {
      const status = existing[0].status;
      if (status === 'pending') {
        return res.status(409).json({ 
          error: 'You already have a pending application',
          applicationId: existing[0].id,
          stage: existing[0].stage
        });
      }
      if (status === 'approved') {
        return res.status(409).json({ 
          error: 'You are already an approved provider'
        });
      }
    }
    
    // Create content hash for integrity
    const contentHash = sha256(JSON.stringify(formData));
    
    // Get client IP for privacy compliance (reuse clientIp from rate limit check above)
    
    // Insert application first (membership assigned after insert)
    const [application] = await db.insert(providerApplicants).values({
      userId,
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      dateOfBirth: formData.dateOfBirth,
      nationalId: formData.nationalId || null,
      gender: formData.gender || null,
      streetAddress: formData.streetAddress,
      city: formData.city,
      postalCode: formData.postalCode || null,
      countryCode: 'IL',
      serviceTypes: formData.serviceTypes,
      yearsExperience: formData.yearsExperience,
      certifications: formData.certifications || [],
      biography: formData.biography,
      languages: formData.languages,
      serviceRadius: formData.serviceRadius,
      maxPetsAtOnce: formData.maxPetsAtOnce,
      petTypesAccepted: formData.petTypesAccepted,
      hasOwnVehicle: formData.hasOwnVehicle,
      hasHomeSpace: formData.hasHomeSpace,
      emergencyContactName: formData.emergencyContactName,
      emergencyContactPhone: formData.emergencyContactPhone,
      emergencyContactRelation: formData.emergencyContactRelation,
      stage: 'documents_pending',
      status: 'pending',
      privacyConsentAt: new Date(),
      privacyConsentIp: clientIp,
      marketingConsentAt: formData.marketingConsent ? new Date() : null,
      dataRetentionAcknowledgedAt: new Date(),
      contentHash
    }).returning();
    
    // Create onboarding tasks
    await createOnboardingTasks(application.id, formData.serviceTypes);
    
    // Record stage transition
    await recordStageTransition(
      application.id,
      'application_submitted',
      'documents_pending',
      userId,
      'Application submitted, awaiting document uploads',
      { submittedFrom: 'web' },
      req
    );
    
    if (profilePhotoFile) {
      try {
        const photoBase64 = profilePhotoFile.buffer.toString('base64');
        await db.insert(providerDocuments).values({
          applicantId: application.id,
          documentType: 'profile_photo',
          fileName: profilePhotoFile.originalname,
          fileSize: profilePhotoFile.size,
          mimeType: profilePhotoFile.mimetype,
          status: 'pending_review',
          uploadedBy: userId,
          metadata: { photoBase64Length: photoBase64.length },
        });
        logger.info('[ProviderApplication] Profile photo uploaded', {
          applicationId: application.id,
          fileName: profilePhotoFile.originalname,
          fileSize: profilePhotoFile.size,
        });
      } catch (photoError) {
        logger.error('[ProviderApplication] Failed to store profile photo', { photoError, applicationId: application.id });
      }
    }

    // Store gallery photos
    if (galleryPhotoFiles.length > 0) {
      for (let i = 0; i < galleryPhotoFiles.length; i++) {
        const gFile = galleryPhotoFiles[i];
        try {
          const gBase64 = gFile.buffer.toString('base64');
          await db.insert(providerDocuments).values({
            applicantId: application.id,
            documentType: 'gallery_photo',
            fileName: gFile.originalname,
            fileSize: gFile.size,
            mimeType: gFile.mimetype,
            status: 'approved',
            uploadedBy: userId,
            metadata: { sortOrder: i + 1, photoBase64Length: gBase64.length },
          });
        } catch (gError) {
          logger.error('[ProviderApplication] Failed to store gallery photo', { gError, applicationId: application.id, index: i });
        }
      }
      logger.info('[ProviderApplication] Gallery photos uploaded', {
        applicationId: application.id,
        count: galleryPhotoFiles.length,
      });
    }

    const membershipNumber = await assignProviderMembership(application.id);
    
    logger.info('[ProviderApplication] New application submitted', {
      applicationId: application.id,
      userId,
      membershipNumber,
      serviceTypes: formData.serviceTypes
    });
    
    // Log to Google Sheets for external backup (legal compliance)
    try {
      await logProviderApplication({
        applicationId: String(application.id),
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phoneNumber,
        providerType: Array.isArray(formData.serviceTypes) ? formData.serviceTypes.join(', ') : formData.serviceTypes,
        city: formData.city,
        country: 'Israel',
        selfiePhotoUrl: '',
        governmentIdUrl: '',
        biometricStatus: 'pending',
        biometricScore: '0',
        applicationStatus: 'Pending Review',
      });
      logger.info('[ProviderApplication] Logged to Google Sheets', { applicationId: application.id });
    } catch (sheetsError) {
      logger.error('[ProviderApplication] Failed to log to Google Sheets', { sheetsError, applicationId: application.id });
    }
    
    // Send confirmation email
    try {
      const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';
      await sendProviderEnrollmentConfirmation(
        formData.email,
        formData.firstName,
        formData.lastName,
        formData.serviceTypes,
        application.id,
        language
      );
      logger.info('[ProviderApplication] Confirmation email sent', { email: formData.email, applicationId: application.id });
    } catch (emailError) {
      logger.error('[ProviderApplication] Failed to send confirmation email', { emailError, applicationId: application.id });
    }
    
    // Send confirmation SMS with membership number
    try {
      const isHebrew = req.headers['accept-language']?.includes('he');
      const smsBody = isHebrew
        ? `Pet Wash™ - ברוכים הבאים! 🐾\n\nשלום ${formData.firstName},\nהבקשה שלך התקבלה בהצלחה.\n\nמספר חברות: ${membershipNumber}\n\nהצוות שלנו יבדוק את הבקשה ויחזור אליך תוך 48 שעות.\n\nPet Wash™ - Premium Pet Care`
        : `Pet Wash™ - Welcome! 🐾\n\nHi ${formData.firstName},\nYour application has been received.\n\nMembership #: ${membershipNumber}\n\nOur team will review your application and get back to you within 48 hours.\n\nPet Wash™ - Premium Pet Care`;
      
      const smsResult = await twilioSMSService.sendSMS(formData.phoneNumber, smsBody);
      if (smsResult.success) {
        logger.info('[ProviderApplication] Confirmation SMS sent', { phone: formData.phoneNumber.slice(0, 6) + '****', applicationId: application.id });
      } else {
        logger.warn('[ProviderApplication] SMS send returned failure', { error: smsResult.error, applicationId: application.id });
      }
    } catch (smsError) {
      logger.error('[ProviderApplication] Failed to send confirmation SMS', { smsError, applicationId: application.id });
    }
    
    res.status(201).json({
      success: true,
      applicationId: application.id,
      membershipNumber,
      stage: 'documents_pending',
      message: 'Application submitted successfully. Please upload required documents.',
      requiredDocuments: getRequiredDocuments(formData.serviceTypes)
    });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Submit error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to submit application', traceId });
  }
});

// GET /api/provider-applications/my - Get current user's application
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.userId, userId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'No application found' });
    }
    
    // Get documents
    const documents = await db.select()
      .from(providerDocuments)
      .where(eq(providerDocuments.applicantId, application.id))
      .orderBy(desc(providerDocuments.uploadedAt));
    
    // Get tasks
    const tasks = await db.select()
      .from(providerOnboardingTasks)
      .where(eq(providerOnboardingTasks.applicantId, application.id))
      .orderBy(providerOnboardingTasks.stage, providerOnboardingTasks.sortOrder);
    
    // Get background checks
    const backgroundChecks = await db.select({
      id: providerBackgroundChecks.id,
      checkType: providerBackgroundChecks.checkType,
      status: providerBackgroundChecks.status,
      resultStatus: providerBackgroundChecks.resultStatus,
      initiatedAt: providerBackgroundChecks.initiatedAt,
      completedAt: providerBackgroundChecks.completedAt
    })
      .from(providerBackgroundChecks)
      .where(eq(providerBackgroundChecks.applicantId, application.id));
    
    // Calculate progress
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    res.json({
      application: {
        id: application.id,
        stage: application.stage,
        status: application.status,
        rejectionReason: application.rejectionReason,
        submittedAt: application.submittedAt,
        lastUpdatedAt: application.lastUpdatedAt,
        invitationSentAt: application.invitationSentAt,
        onboardingCompletedAt: application.onboardingCompletedAt
      },
      documents: documents.map(d => ({
        id: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        verificationStatus: d.status || 'pending',
        rejectionReason: d.rejectionReason,
        uploadedAt: d.uploadedAt
      })),
      tasks,
      backgroundChecks,
      progress,
      requiredDocuments: getRequiredDocuments(application.serviceTypes)
    });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Get my application error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch application', traceId });
  }
});

// GET /api/provider-applications/stages - Get all stage information
router.get('/stages', (_req: Request, res: Response) => {
  const stages = [
    {
      id: 'application_submitted',
      name: 'Application Submitted',
      nameHe: 'מועמדות הוגשה',
      description: 'Your application has been received',
      descriptionHe: 'המועמדות שלך התקבלה',
      order: 1
    },
    {
      id: 'documents_pending',
      name: 'Documents Required',
      nameHe: 'נדרשים מסמכים',
      description: 'Please upload all required documents',
      descriptionHe: 'אנא העלה את כל המסמכים הנדרשים',
      order: 2
    },
    {
      id: 'documents_under_review',
      name: 'Documents Under Review',
      nameHe: 'מסמכים בבדיקה',
      description: 'Our team is reviewing your documents',
      descriptionHe: 'הצוות שלנו בודק את המסמכים שלך',
      order: 3
    },
    {
      id: 'background_check_pending',
      name: 'Background Check',
      nameHe: 'בדיקת רקע',
      description: 'Background verification in progress',
      descriptionHe: 'בדיקת רקע מתבצעת',
      order: 4
    },
    {
      id: 'background_check_complete',
      name: 'Background Check Complete',
      nameHe: 'בדיקת רקע הושלמה',
      description: 'Background check has been completed',
      descriptionHe: 'בדיקת הרקע הושלמה',
      order: 5
    },
    {
      id: 'admin_final_review',
      name: 'Final Review',
      nameHe: 'בדיקה סופית',
      description: 'Your application is under final review',
      descriptionHe: 'המועמדות שלך בבדיקה סופית',
      order: 6
    },
    {
      id: 'approved',
      name: 'Approved',
      nameHe: 'אושר',
      description: 'Congratulations! You have been approved',
      descriptionHe: 'מזל טוב! אושרת',
      order: 7
    },
    {
      id: 'rejected',
      name: 'Not Approved',
      nameHe: 'לא אושר',
      description: 'Unfortunately your application was not approved',
      descriptionHe: 'לצערנו המועמדות שלך לא אושרה',
      order: 8
    }
  ];
  
  res.json(stages);
});

// POST /api/provider-applications/withdraw - Withdraw application
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.userId, userId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'No application found' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot withdraw a processed application' });
    }
    
    const previousStage = application.stage;
    
    await db.update(providerApplicants)
      .set({ 
        stage: 'withdrawn', 
        status: 'withdrawn',
        lastUpdatedAt: new Date(),
        stageChangedAt: new Date()
      })
      .where(eq(providerApplicants.id, application.id));
    
    await recordStageTransition(
      application.id,
      previousStage,
      'withdrawn',
      userId,
      'Applicant withdrew their application',
      { reason: req.body.reason || 'User requested' },
      req
    );
    
    res.json({ success: true, message: 'Application withdrawn' });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Withdraw error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to withdraw application', traceId });
  }
});

// =================== ADMIN ROUTES ===================

// GET /api/provider-applications/admin/list - List all applications (admin only)
router.get('/admin/list', async (req: Request, res: Response) => {
  try {
    // Check admin access
    const user = (req as any).firebaseUser;
    if (!user?.accountType || !['internal', 'admin'].includes(user.accountType)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { stage, status, limit = 50, offset = 0 } = req.query;
    
    let query = db.select({
      id: providerApplicants.id,
      firebaseUid: providerApplicants.userId,
      email: providerApplicants.email,
      firstName: providerApplicants.firstName,
      lastName: providerApplicants.lastName,
      phone: providerApplicants.phoneNumber,
      city: providerApplicants.city,
      serviceTypes: providerApplicants.serviceTypes,
      stage: providerApplicants.stage,
      status: providerApplicants.status,
      assignedReviewerId: providerApplicants.assignedReviewerId,
      submittedAt: providerApplicants.submittedAt,
      lastUpdatedAt: providerApplicants.lastUpdatedAt
    }).from(providerApplicants);
    
    const conditions = [];
    if (stage && stage !== 'all') {
      conditions.push(eq(providerApplicants.stage, stage as string));
    }
    if (status && status !== 'all') {
      conditions.push(eq(providerApplicants.status, status as string));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const applications = await query
      .orderBy(desc(providerApplicants.submittedAt))
      .limit(Number(limit))
      .offset(Number(offset));
    
    // Get counts by stage
    const stageCounts = await db.select({
      stage: providerApplicants.stage,
      count: sql<number>`count(*)`
    })
      .from(providerApplicants)
      .where(eq(providerApplicants.status, 'pending'))
      .groupBy(providerApplicants.stage);
    
    res.json({
      applications,
      counts: stageCounts.reduce((acc, s) => ({ ...acc, [s.stage]: Number(s.count) }), {}),
      pagination: { limit: Number(limit), offset: Number(offset) }
    });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Admin list error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch applications', traceId });
  }
});

// GET /api/provider-applications/admin/:id - Get full application details (admin)
router.get('/admin/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    if (!user?.accountType || !['internal', 'admin'].includes(user.accountType)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const applicationId = parseInt(req.params.id);
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.id, applicationId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Get all related data
    const [documents, tasks, backgroundChecks, transitions] = await Promise.all([
      db.select().from(providerDocuments).where(eq(providerDocuments.applicantId, applicationId)),
      db.select().from(providerOnboardingTasks).where(eq(providerOnboardingTasks.applicantId, applicationId)),
      db.select().from(providerBackgroundChecks).where(eq(providerBackgroundChecks.applicantId, applicationId)),
      db.select().from(providerStageTransitions)
        .where(eq(providerStageTransitions.applicantId, applicationId))
        .orderBy(desc(providerStageTransitions.createdAt))
    ]);
    
    res.json({
      id: application.id,
      firebaseUid: application.userId,
      email: application.email,
      firstName: application.firstName,
      lastName: application.lastName,
      phone: application.phoneNumber,
      city: application.city,
      serviceTypes: application.serviceTypes,
      stage: application.stage,
      status: application.status,
      submittedAt: application.submittedAt,
      lastUpdatedAt: application.lastUpdatedAt,
      dateOfBirth: application.dateOfBirth,
      nationalId: application.nationalId,
      streetAddress: application.streetAddress,
      postalCode: application.postalCode,
      preferredPetTypes: application.petTypesAccepted || [],
      languagesSpoken: application.languages || [],
      yearsExperience: application.yearsExperience || 0,
      bio: application.biography || '',
      serviceRadius: application.serviceRadius || 0,
      maxPetsAtOnce: application.maxPetsAtOnce || 1,
      hasTransportation: application.hasOwnVehicle || false,
      emergencyContactName: application.emergencyContactName,
      emergencyContactPhone: application.emergencyContactPhone,
      emergencyContactRelation: application.emergencyContactRelation,
      rejectionReason: application.rejectionReason,
      documents: documents.map(d => ({
        id: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        fileUrl: d.fileUrl || '',
        verificationStatus: d.status || 'pending',
        rejectionReason: d.rejectionReason,
        uploadedAt: d.uploadedAt
      })),
      backgroundChecks: backgroundChecks.map(bc => ({
        id: bc.id,
        checkType: bc.checkType,
        status: bc.status,
        resultStatus: bc.resultStatus,
        notes: bc.notes || '',
        initiatedAt: bc.initiatedAt,
        completedAt: bc.completedAt
      })),
      stageTransitions: transitions.map(t => ({
        id: t.id,
        fromStage: t.fromStage,
        toStage: t.toStage,
        transitionedAt: t.createdAt,
        performedBy: t.triggeredByUid || 'system',
        notes: t.transitionReason || ''
      })),
      tasks,
      requiredDocuments: getRequiredDocuments(application.serviceTypes)
    });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Admin get error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch application', traceId });
  }
});

// POST /api/provider-applications/admin/:id/approve - Approve application
router.post('/admin/:id/approve', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    if (!user?.accountType || !['internal', 'admin'].includes(user.accountType)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const applicationId = parseInt(req.params.id);
    const { notes } = req.body;
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.id, applicationId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application already processed' });
    }
    
    // Generate invitation token
    const invitationToken = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry
    
    const previousStage = application.stage;
    
    await db.update(providerApplicants)
      .set({
        stage: 'approved',
        status: 'approved',
        reviewerNotes: notes || null,
        approvedAt: new Date(),
        invitationToken,
        invitationSentAt: new Date(),
        invitationExpiresAt: expiresAt,
        lastUpdatedAt: new Date(),
        stageChangedAt: new Date()
      })
      .where(eq(providerApplicants.id, applicationId));

    // Set Firebase custom claims so the provider can access /provider/dashboard
    if (application.userId) {
      try {
        await firebaseAuth.setCustomUserClaims(application.userId, {
          role: 'provider',
          accountType: 'provider',
          providerApprovedAt: new Date().toISOString(),
        });
        logger.info('[ProviderApplication] Firebase claims set for approved provider', { userId: application.userId });
      } catch (claimsErr) {
        logger.warn('[ProviderApplication] Could not set Firebase claims (non-fatal)', { claimsErr, userId: application.userId });
      }
    }
    
    await recordStageTransition(
      applicationId,
      previousStage,
      'approved',
      user.uid,
      `Approved by admin: ${notes || 'No notes'}`,
      { approvedBy: user.email },
      req
    );
    
    const invitationUrl = `${process.env.APP_URL || 'https://petwash.co.il'}/provider/onboard?token=${invitationToken}`;
    
    // Send invitation email
    try {
      const { EmailService } = await import('../emailService');
      await EmailService.send({
        to: application.email,
        subject: application.preferredLanguage === 'he' 
          ? '!ברוכים הבאים למשפחת ⁦Pet Wash™⁩ - הזמנה להצטרפות'
          : 'Welcome to ⁦Pet Wash™⁩ - Your Provider Invitation',
        html: application.preferredLanguage === 'he' 
          ? `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
              <h1 style="color: #7c3aed;">מזל טוב, ${application.firstName}!</h1>
              <p style="font-size: 16px; line-height: 1.6;">
                אנו שמחים לעדכן אותך שבקשתך להצטרף לצוות ⁦Pet Wash™⁩ <strong>אושרה!</strong>
              </p>
              <p style="font-size: 16px; line-height: 1.6;">
                כדי להשלים את תהליך ההצטרפות שלך, לחץ על הכפתור למטה:
              </p>
              <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                השלם הצטרפות
              </a>
              <p style="font-size: 14px; color: #666;">
                הקישור תקף ל-7 ימים ויפוג בתאריך ${expiresAt.toLocaleDateString('he-IL')}.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">
                ⁦Pet Wash™⁩ - טיפוח פרימיום לחיית המחמד שלך
              </p>
            </div>
          `
          : `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #7c3aed;">Congratulations, ${application.firstName}!</h1>
              <p style="font-size: 16px; line-height: 1.6;">
                We're excited to let you know that your application to join the ⁦Pet Wash™⁩ team has been <strong>approved!</strong>
              </p>
              <p style="font-size: 16px; line-height: 1.6;">
                To complete your onboarding, please click the button below:
              </p>
              <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                Complete Onboarding
              </a>
              <p style="font-size: 14px; color: #666;">
                This link is valid for 7 days and will expire on ${expiresAt.toLocaleDateString('en-US')}.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">
                ⁦Pet Wash™⁩ - Premium care for your furry friends
              </p>
            </div>
          `
      });
      logger.info('[ProviderApplication] Invitation email sent', { email: application.email });
    } catch (emailError) {
      logger.error('[ProviderApplication] Failed to send invitation email', { emailError });
    }
    
    logger.info('[ProviderApplication] Application approved', {
      applicationId,
      approvedBy: user.uid,
      invitationToken: invitationToken.substring(0, 8) + '...'
    });
    
    res.json({
      success: true,
      message: 'Application approved',
      invitationUrl,
      invitationExpiresAt: expiresAt,
      emailSent: true
    });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Approve error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to approve application', traceId });
  }
});

// POST /api/provider-applications/admin/:id/reject - Reject application
router.post('/admin/:id/reject', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    if (!user?.accountType || !['internal', 'admin'].includes(user.accountType)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const applicationId = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (!reason || reason.length < 10) {
      return res.status(400).json({ error: 'Rejection reason required (min 10 characters)' });
    }
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.id, applicationId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application already processed' });
    }
    
    const previousStage = application.stage;
    
    await db.update(providerApplicants)
      .set({
        stage: 'rejected',
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
        lastUpdatedAt: new Date(),
        stageChangedAt: new Date()
      })
      .where(eq(providerApplicants.id, applicationId));
    
    await recordStageTransition(
      applicationId,
      previousStage,
      'rejected',
      user.uid,
      `Rejected: ${reason}`,
      { rejectedBy: user.email },
      req
    );
    
    // TODO: Send rejection email
    
    logger.info('[ProviderApplication] Application rejected', {
      applicationId,
      rejectedBy: user.uid,
      reason
    });
    
    res.json({ success: true, message: 'Application rejected' });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Reject error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reject application', traceId });
  }
});

// POST /api/provider-applications/admin/:id/advance-stage - Move to next stage
router.post('/admin/:id/advance-stage', async (req: Request, res: Response) => {
  try {
    const user = (req as any).firebaseUser;
    if (!user?.accountType || !['internal', 'admin'].includes(user.accountType)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const applicationId = parseInt(req.params.id);
    const { targetStage, notes } = req.body;
    
    const stageOrder = [
      'application_submitted',
      'documents_pending',
      'documents_under_review',
      'background_check_pending',
      'background_check_complete',
      'admin_final_review'
    ];
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.id, applicationId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    let nextStage = targetStage;
    if (!nextStage) {
      const currentIdx = stageOrder.indexOf(application.stage);
      if (currentIdx === -1 || currentIdx >= stageOrder.length - 1) {
        return res.status(400).json({ error: 'Cannot advance further. Use approve or reject.' });
      }
      nextStage = stageOrder[currentIdx + 1];
    }
    
    const validStages = [
      'documents_under_review',
      'background_check_pending',
      'background_check_complete',
      'admin_final_review'
    ];
    
    if (!validStages.includes(nextStage)) {
      return res.status(400).json({ error: 'Invalid target stage' });
    }
    
    const previousStage = application.stage;
    
    await db.update(providerApplicants)
      .set({
        stage: nextStage,
        reviewerNotes: notes || application.reviewerNotes,
        assignedReviewerId: user.uid,
        lastUpdatedAt: new Date(),
        stageChangedAt: new Date()
      })
      .where(eq(providerApplicants.id, applicationId));
    
    await recordStageTransition(
      applicationId,
      previousStage,
      nextStage,
      user.uid,
      notes || `Stage advanced by admin`,
      {},
      req
    );
    
    res.json({ success: true, message: `Application moved to ${nextStage}`, newStage: nextStage });
    
  } catch (error) {
    const traceId = req.traceId || '';
    logger.error('[ProviderApplication] Advance stage error', { error, traceId });
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to advance stage', traceId });
  }
});

export default router;
