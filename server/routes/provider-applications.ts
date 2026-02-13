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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

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
    // Stage 1: Application
    { taskCode: 'SUBMIT_APPLICATION', taskName: 'Submit Application', taskNameHe: 'הגש מועמדות', stage: 'application_submitted', sortOrder: 1, isRequired: true },
    
    // Stage 2: Documents
    ...requiredDocs.map((docType, idx) => ({
      taskCode: `UPLOAD_${docType.toUpperCase()}`,
      taskName: `Upload ${docType.replace(/_/g, ' ')}`,
      taskNameHe: getHebrewDocName(docType),
      stage: 'documents_pending',
      sortOrder: idx + 1,
      isRequired: true,
      requiredDocumentType: docType
    })),
    
    // Stage 4: Background Check
    { taskCode: 'CRIMINAL_CHECK', taskName: 'Criminal Background Check', taskNameHe: 'בדיקת רקע פלילי', stage: 'background_check_pending', sortOrder: 1, isRequired: true },
    { taskCode: 'REFERENCE_CHECK', taskName: 'Reference Verification', taskNameHe: 'אימות המלצות', stage: 'background_check_pending', sortOrder: 2, isRequired: true },
  ];
  
  for (const task of tasks) {
    await db.insert(providerOnboardingTasks).values({
      applicantId,
      ...task,
      status: task.taskCode === 'SUBMIT_APPLICATION' ? 'completed' : 'pending',
      completedAt: task.taskCode === 'SUBMIT_APPLICATION' ? new Date() : null
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
router.post('/', upload.single('profilePhoto'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    let bodyData = req.body;
    if (req.body.applicationData) {
      try {
        bodyData = JSON.parse(req.body.applicationData);
      } catch {
        return res.status(400).json({ error: 'Invalid application data format' });
      }
    }

    const profilePhotoFile = req.file;
    
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
    
    // Get client IP for privacy compliance
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    
    // Insert application
    const [application] = await db.insert(providerApplicants).values({
      userId,
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      dateOfBirth: formData.dateOfBirth,
      nationalId: formData.nationalId || null,
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

    logger.info('[ProviderApplication] New application submitted', {
      applicationId: application.id,
      userId,
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
      // Don't fail the request if email fails
    }
    
    res.status(201).json({
      success: true,
      applicationId: application.id,
      stage: 'documents_pending',
      message: 'Application submitted successfully. Please upload required documents.',
      requiredDocuments: getRequiredDocuments(formData.serviceTypes)
    });
    
  } catch (error) {
    logger.error('[ProviderApplication] Submit error', { error });
    res.status(500).json({ error: 'Failed to submit application' });
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
        verificationStatus: d.verificationStatus,
        rejectionReason: d.rejectionReason,
        uploadedAt: d.uploadedAt
      })),
      tasks,
      backgroundChecks,
      progress,
      requiredDocuments: getRequiredDocuments(application.serviceTypes)
    });
    
  } catch (error) {
    logger.error('[ProviderApplication] Get my application error', { error });
    res.status(500).json({ error: 'Failed to fetch application' });
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
    logger.error('[ProviderApplication] Withdraw error', { error });
    res.status(500).json({ error: 'Failed to withdraw application' });
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
      email: providerApplicants.email,
      firstName: providerApplicants.firstName,
      lastName: providerApplicants.lastName,
      phoneNumber: providerApplicants.phoneNumber,
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
    logger.error('[ProviderApplication] Admin list error', { error });
    res.status(500).json({ error: 'Failed to fetch applications' });
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
      application,
      documents,
      tasks,
      backgroundChecks,
      transitions,
      requiredDocuments: getRequiredDocuments(application.serviceTypes)
    });
    
  } catch (error) {
    logger.error('[ProviderApplication] Admin get error', { error });
    res.status(500).json({ error: 'Failed to fetch application' });
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
    logger.error('[ProviderApplication] Approve error', { error });
    res.status(500).json({ error: 'Failed to approve application' });
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
    logger.error('[ProviderApplication] Reject error', { error });
    res.status(500).json({ error: 'Failed to reject application' });
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
    
    const validStages = [
      'documents_under_review',
      'background_check_pending',
      'background_check_complete',
      'admin_final_review'
    ];
    
    if (!validStages.includes(targetStage)) {
      return res.status(400).json({ error: 'Invalid target stage' });
    }
    
    const [application] = await db.select()
      .from(providerApplicants)
      .where(eq(providerApplicants.id, applicationId))
      .limit(1);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const previousStage = application.stage;
    
    await db.update(providerApplicants)
      .set({
        stage: targetStage,
        reviewerNotes: notes || application.reviewerNotes,
        assignedReviewerId: user.uid,
        lastUpdatedAt: new Date(),
        stageChangedAt: new Date()
      })
      .where(eq(providerApplicants.id, applicationId));
    
    await recordStageTransition(
      applicationId,
      previousStage,
      targetStage,
      user.uid,
      notes || `Stage advanced by admin`,
      {},
      req
    );
    
    res.json({ success: true, message: `Application moved to ${targetStage}` });
    
  } catch (error) {
    logger.error('[ProviderApplication] Advance stage error', { error });
    res.status(500).json({ error: 'Failed to advance stage' });
  }
});

export default router;
