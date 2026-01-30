import { Router } from 'express';
import { db } from '../db';
import { careerPositions, staffApplications, staffDocuments, applicationFraudSignals, applicationStepProgress, insertCareerPositionSchema, } from '@shared/schema';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { z } from 'zod';
import multer from 'multer';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
const router = Router();
const storage = new Storage();
const BUCKET_NAME = process.env.BIOMETRIC_BUCKET_NAME || 'signinpetwash.firebasestorage.app';
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG allowed.'));
        }
    },
});
// =================== PUBLIC CAREER POSITIONS API ===================
// Get all active career positions (public)
router.get('/positions', async (req, res) => {
    try {
        const { roleType, location, featured } = req.query;
        let conditions = [eq(careerPositions.isActive, true)];
        if (roleType && typeof roleType === 'string') {
            conditions.push(eq(careerPositions.roleType, roleType));
        }
        if (location && typeof location === 'string') {
            conditions.push(ilike(careerPositions.location, `%${location}%`));
        }
        if (featured === 'true') {
            conditions.push(eq(careerPositions.isFeatured, true));
        }
        const positions = await db
            .select()
            .from(careerPositions)
            .where(and(...conditions))
            .orderBy(desc(careerPositions.isFeatured), desc(careerPositions.createdAt));
        res.json(positions);
    }
    catch (error) {
        logger.error('[Careers] Failed to fetch positions', { error });
        res.status(500).json({ error: 'Failed to fetch career positions' });
    }
});
// Get position by slug or ID (public)
router.get('/positions/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const [position] = await db
            .select()
            .from(careerPositions)
            .where(or(eq(careerPositions.slug, identifier), eq(careerPositions.positionId, identifier)))
            .limit(1);
        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }
        // Increment view count
        await db
            .update(careerPositions)
            .set({ viewCount: sql `${careerPositions.viewCount} + 1` })
            .where(eq(careerPositions.id, position.id));
        res.json(position);
    }
    catch (error) {
        logger.error('[Careers] Failed to fetch position', { error });
        res.status(500).json({ error: 'Failed to fetch position details' });
    }
});
// =================== USER APPLICATIONS API ===================
// Get user's applications by email (for applicant dashboard)
router.get('/my-applications', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        // Get applications for this email with position details
        const applications = await db
            .select({
            id: staffApplications.id,
            applicationId: staffApplications.applicationId,
            positionId: staffApplications.positionId,
            firstName: staffApplications.firstName,
            lastName: staffApplications.lastName,
            email: staffApplications.email,
            status: staffApplications.status,
            reviewStage: staffApplications.reviewStage,
            createdAt: staffApplications.createdAt,
            submittedAt: staffApplications.submittedAt,
            positionTitle: careerPositions.titleEn,
            positionTitleHe: careerPositions.titleHe,
            roleType: careerPositions.roleType,
            location: careerPositions.location,
        })
            .from(staffApplications)
            .leftJoin(careerPositions, eq(staffApplications.positionId, careerPositions.positionId))
            .where(eq(staffApplications.email, email.toLowerCase()))
            .orderBy(desc(staffApplications.createdAt));
        // Get documents for each application
        const applicationIds = applications.map(a => a.id);
        let documents = [];
        if (applicationIds.length > 0) {
            documents = await db
                .select({
                applicationId: staffDocuments.applicationId,
                documentType: staffDocuments.documentType,
                fileName: staffDocuments.fileName,
                uploadedAt: staffDocuments.uploadedAt,
            })
                .from(staffDocuments)
                .where(sql `${staffDocuments.applicationId} IN (${sql.join(applicationIds.map(id => sql `${id}`), sql `, `)})`);
        }
        // Attach documents to applications
        const applicationsWithDocs = applications.map(app => ({
            ...app,
            documents: documents.filter(d => d.applicationId === app.id),
        }));
        res.json(applicationsWithDocs);
    }
    catch (error) {
        logger.error('[Careers] Failed to fetch user applications', { error });
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});
// Get single application details with all step progress
router.get('/my-applications/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { email } = req.query;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required for verification' });
        }
        const [application] = await db
            .select()
            .from(staffApplications)
            .where(and(eq(staffApplications.applicationId, applicationId), eq(staffApplications.email, email.toLowerCase())))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        // Get position details
        const [position] = await db
            .select()
            .from(careerPositions)
            .where(eq(careerPositions.positionId, application.positionId))
            .limit(1);
        // Get documents
        const documents = await db
            .select()
            .from(staffDocuments)
            .where(eq(staffDocuments.applicationId, application.id));
        // Get step progress
        const steps = await db
            .select()
            .from(applicationStepProgress)
            .where(eq(applicationStepProgress.applicationId, application.id))
            .orderBy(applicationStepProgress.stepNumber);
        res.json({
            application,
            position,
            documents,
            steps,
        });
    }
    catch (error) {
        logger.error('[Careers] Failed to fetch application details', { error });
        res.status(500).json({ error: 'Failed to fetch application details' });
    }
});
// =================== APPLICATION SUBMISSION API ===================
// Application submission schema (SEEK-inspired multi-step)
const applicationSchema = z.object({
    positionId: z.string().min(1),
    // Draft application ID (for updating existing drafts)
    applicationId: z.number().optional(),
    sessionId: z.string().optional(),
    // Personal Information
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().min(8, 'Valid phone number is required'),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    // Address
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    country: z.string().default('Israel'),
    postalCode: z.string().optional(),
    // Experience
    yearsExperience: z.number().min(0).max(50).optional(),
    previousEmployer: z.string().optional(),
    relevantSkills: z.array(z.string()).optional(),
    // Availability
    availableStartDate: z.string().optional(),
    availableHoursPerWeek: z.number().min(1).max(60).optional(),
    // Consents (SEEK-inspired legal compliance)
    consentDataProcessing: z.boolean().refine(v => v === true, 'You must consent to data processing'),
    consentBackgroundCheck: z.boolean().refine(v => v === true, 'You must consent to background checks'),
    consentTermsOfService: z.boolean().refine(v => v === true, 'You must accept terms of service'),
    consentPrivacyPolicy: z.boolean().refine(v => v === true, 'You must accept privacy policy'),
    // Marketing (optional)
    consentMarketing: z.boolean().optional(),
    // Referral
    referralSource: z.string().optional(),
    referralCode: z.string().optional(),
});
// Submit job application
router.post('/apply', async (req, res) => {
    const correlationId = crypto.randomUUID();
    try {
        // Get device fingerprint data
        const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'] || '';
        const deviceFingerprint = req.headers['x-device-fingerprint']?.toString() || '';
        // Validate input
        const validationResult = applicationSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten().fieldErrors
            });
        }
        const data = validationResult.data;
        // Check position exists and is active
        const [position] = await db
            .select()
            .from(careerPositions)
            .where(eq(careerPositions.positionId, data.positionId))
            .limit(1);
        if (!position || !position.isActive) {
            return res.status(400).json({ error: 'Position is no longer available' });
        }
        // Check if this is finalizing an existing draft
        let existingDraft = null;
        if (data.applicationId) {
            const [draft] = await db
                .select()
                .from(staffApplications)
                .where(and(eq(staffApplications.id, data.applicationId), eq(staffApplications.status, 'draft')))
                .limit(1);
            if (draft) {
                existingDraft = draft;
            }
        }
        // FRAUD PREVENTION: Check for duplicate applications (skip if updating own draft)
        const existingApplications = await db
            .select({ id: staffApplications.id, email: staffApplications.email, status: staffApplications.status })
            .from(staffApplications)
            .where(and(or(eq(staffApplications.email, data.email), eq(staffApplications.phone, data.phone)), existingDraft ? sql `${staffApplications.id} != ${existingDraft.id}` : sql `1=1`));
        const fraudSignals = [];
        // Duplicate email check (exclude current draft)
        const emailDuplicates = existingApplications.filter(a => a.email === data.email && a.status !== 'draft');
        if (emailDuplicates.length > 0) {
            const recentPending = emailDuplicates.filter(a => a.status === 'pending' || a.status === 'under_review');
            if (recentPending.length > 0) {
                return res.status(400).json({
                    error: 'You already have an active application. Please check your email for updates.',
                    applicationId: recentPending[0].id
                });
            }
            fraudSignals.push({
                signalType: 'duplicate',
                severity: emailDuplicates.length > 2 ? 'high' : 'low',
                confidence: 95,
                description: `Email ${data.email} has ${emailDuplicates.length} previous applications`,
                matchType: 'email',
                matchedIds: emailDuplicates.map(a => a.id)
            });
        }
        // FRAUD: Velocity check (multiple applications in short time)
        const recentFromIP = await db
            .select({ id: staffApplications.id })
            .from(staffApplications)
            .where(and(sql `${staffApplications.createdAt} > NOW() - INTERVAL '1 hour'`, sql `${staffApplications.notes} LIKE ${`%${ipAddress}%`}`, sql `${staffApplications.status} != 'draft'`));
        if (recentFromIP.length > 2) {
            fraudSignals.push({
                signalType: 'velocity',
                severity: 'high',
                confidence: 85,
                description: `${recentFromIP.length} applications from IP ${ipAddress} in last hour`,
            });
        }
        // Build notes JSON with all application data
        const notesData = {
            positionId: data.positionId,
            ipAddress,
            userAgent,
            deviceFingerprint,
            yearsExperience: data.yearsExperience,
            previousEmployer: data.previousEmployer,
            relevantSkills: data.relevantSkills,
            availableStartDate: data.availableStartDate,
            availableHoursPerWeek: data.availableHoursPerWeek,
            referralSource: data.referralSource,
            consents: {
                dataProcessing: data.consentDataProcessing,
                backgroundCheck: data.consentBackgroundCheck,
                termsOfService: data.consentTermsOfService,
                privacyPolicy: data.consentPrivacyPolicy,
                marketing: data.consentMarketing || false,
                timestamp: new Date().toISOString(),
            },
            submittedAt: new Date().toISOString(),
        };
        let application;
        // Update existing draft or create new application
        if (existingDraft) {
            // Finalize the draft by updating it to pending status
            const [updated] = await db
                .update(staffApplications)
                .set({
                applicationType: position.roleType,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth,
                address: data.address,
                city: data.city,
                country: data.country,
                postalCode: data.postalCode || null,
                status: 'pending',
                referralSource: data.referralSource || null,
                notes: JSON.stringify(notesData),
            })
                .where(eq(staffApplications.id, existingDraft.id))
                .returning();
            application = updated;
            // Update step progress to mark all steps as completed
            await db
                .update(applicationStepProgress)
                .set({ status: 'completed', completedAt: new Date() })
                .where(eq(applicationStepProgress.applicationId, existingDraft.id));
            logger.info('[Careers] Draft application finalized', {
                applicationId: application.id,
                positionId: data.positionId,
                correlationId,
            });
        }
        else {
            // Create new application
            const [created] = await db
                .insert(staffApplications)
                .values({
                applicationType: position.roleType,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth,
                address: data.address,
                city: data.city,
                country: data.country,
                postalCode: data.postalCode || null,
                status: 'pending',
                referralSource: data.referralSource || null,
                notes: JSON.stringify(notesData),
            })
                .returning();
            application = created;
        }
        // Record fraud signals
        if (fraudSignals.length > 0) {
            await db.insert(applicationFraudSignals).values(fraudSignals.map(signal => ({
                applicationId: application.id,
                signalType: signal.signalType,
                severity: signal.severity,
                confidence: signal.confidence.toString(),
                description: signal.description,
                ipAddress,
                userAgent,
                deviceFingerprint,
                matchType: signal.matchType || null,
                matchedApplicationIds: signal.matchedIds || [],
            })));
            logger.warn('[Careers] Fraud signals detected for application', {
                applicationId: application.id,
                signalCount: fraudSignals.length,
                correlationId,
            });
        }
        // Update position application count
        await db
            .update(careerPositions)
            .set({ applicationCount: sql `${careerPositions.applicationCount} + 1` })
            .where(eq(careerPositions.id, position.id));
        logger.info('[Careers] Application submitted', {
            applicationId: application.id,
            positionId: data.positionId,
            roleType: position.roleType,
            correlationId,
        });
        res.status(201).json({
            success: true,
            applicationId: application.id,
            message: 'Your application has been submitted successfully. We will review it and contact you within 3-5 business days.',
            nextSteps: [
                'Check your email for confirmation',
                'Upload your resume/CV',
                'Complete identity verification',
            ],
        });
    }
    catch (error) {
        logger.error('[Careers] Application submission failed', { error, correlationId });
        res.status(500).json({ error: 'Failed to submit application. Please try again.' });
    }
});
// Upload resume/document for application
router.post('/applications/:applicationId/documents', upload.single('document'), async (req, res) => {
    const correlationId = crypto.randomUUID();
    try {
        const { applicationId } = req.params;
        const { documentType = 'resume' } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Verify application exists
        const [application] = await db
            .select()
            .from(staffApplications)
            .where(eq(staffApplications.id, parseInt(applicationId)))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        // Upload to GCS
        const fileName = `careers/${applicationId}/${documentType}_${Date.now()}_${req.file.originalname}`;
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(fileName);
        await file.save(req.file.buffer, {
            contentType: req.file.mimetype,
            metadata: {
                applicationId,
                documentType,
                uploadedAt: new Date().toISOString(),
            },
        });
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        });
        // Save document record
        const [document] = await db
            .insert(staffDocuments)
            .values({
            applicationId: parseInt(applicationId),
            documentType,
            documentUrl: signedUrl,
            status: 'pending',
        })
            .returning();
        logger.info('[Careers] Document uploaded', {
            applicationId,
            documentId: document.id,
            documentType,
            correlationId,
        });
        res.json({
            success: true,
            documentId: document.id,
            message: 'Document uploaded successfully',
        });
    }
    catch (error) {
        logger.error('[Careers] Document upload failed', { error, correlationId });
        res.status(500).json({ error: 'Failed to upload document' });
    }
});
// =================== AUTOSAVE & STEP PROGRESS API ===================
// Start a new application session (creates draft)
router.post('/start-application', async (req, res) => {
    const correlationId = crypto.randomUUID();
    try {
        const { positionId, email } = req.body;
        const sessionId = crypto.randomUUID();
        const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'] || '';
        if (!positionId) {
            return res.status(400).json({ error: 'Position ID is required' });
        }
        // Check position exists
        const [position] = await db
            .select()
            .from(careerPositions)
            .where(eq(careerPositions.positionId, positionId))
            .limit(1);
        if (!position || !position.isActive) {
            return res.status(400).json({ error: 'Position is no longer available' });
        }
        // Create draft application
        const [application] = await db
            .insert(staffApplications)
            .values({
            applicationType: position.roleType,
            email: email || `draft_${sessionId}@pending.petwash.co.il`,
            status: 'draft',
            notes: JSON.stringify({
                positionId,
                sessionId,
                ipAddress,
                userAgent,
                startedAt: new Date().toISOString(),
            }),
        })
            .returning();
        // Create initial step progress records
        const steps = [
            { stepNumber: 1, stepName: 'personal_info' },
            { stepNumber: 2, stepName: 'experience' },
            { stepNumber: 3, stepName: 'consents' },
        ];
        await db.insert(applicationStepProgress).values(steps.map(step => ({
            applicationId: application.id,
            stepNumber: step.stepNumber,
            stepName: step.stepName,
            status: step.stepNumber === 1 ? 'in_progress' : 'pending',
            sessionId,
        })));
        logger.info('[Careers] Application session started', {
            applicationId: application.id,
            sessionId,
            positionId,
            correlationId,
        });
        res.status(201).json({
            success: true,
            applicationId: application.id,
            sessionId,
            positionId,
        });
    }
    catch (error) {
        logger.error('[Careers] Failed to start application', { error, correlationId });
        res.status(500).json({ error: 'Failed to start application' });
    }
});
// Autosave step progress
router.post('/applications/:applicationId/autosave', async (req, res) => {
    const correlationId = crypto.randomUUID();
    try {
        const { applicationId } = req.params;
        const { stepNumber, stepName, data, sessionId } = req.body;
        if (!stepNumber || !data) {
            return res.status(400).json({ error: 'Step number and data are required' });
        }
        // Verify application exists and is in draft status
        const [application] = await db
            .select()
            .from(staffApplications)
            .where(eq(staffApplications.id, parseInt(applicationId)))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        // Update or insert step progress
        const existingStep = await db
            .select()
            .from(applicationStepProgress)
            .where(and(eq(applicationStepProgress.applicationId, parseInt(applicationId)), eq(applicationStepProgress.stepNumber, stepNumber)))
            .limit(1);
        if (existingStep.length > 0) {
            await db
                .update(applicationStepProgress)
                .set({
                dataSnapshot: data,
                status: 'completed',
                completedAt: new Date(),
                lastUpdatedAt: new Date(),
            })
                .where(eq(applicationStepProgress.id, existingStep[0].id));
        }
        else {
            await db.insert(applicationStepProgress).values({
                applicationId: parseInt(applicationId),
                stepNumber,
                stepName: stepName || `step_${stepNumber}`,
                status: 'completed',
                dataSnapshot: data,
                completedAt: new Date(),
                sessionId,
            });
        }
        // Update the application record with the step data (merge into notes)
        const currentNotes = application.notes ? JSON.parse(application.notes) : {};
        const updatedNotes = {
            ...currentNotes,
            [`step${stepNumber}Data`]: data,
            lastSavedAt: new Date().toISOString(),
        };
        // Also update main application fields if step 1 (personal info)
        if (stepNumber === 1 && data) {
            await db
                .update(staffApplications)
                .set({
                firstName: data.firstName || application.firstName,
                lastName: data.lastName || application.lastName,
                email: data.email || application.email,
                phone: data.phone || application.phone,
                dateOfBirth: data.dateOfBirth || application.dateOfBirth,
                address: data.address || application.address,
                city: data.city || application.city,
                country: data.country || application.country,
                notes: JSON.stringify(updatedNotes),
            })
                .where(eq(staffApplications.id, parseInt(applicationId)));
        }
        else {
            await db
                .update(staffApplications)
                .set({ notes: JSON.stringify(updatedNotes) })
                .where(eq(staffApplications.id, parseInt(applicationId)));
        }
        // Mark next step as in_progress if applicable
        if (stepNumber < 3) {
            await db
                .update(applicationStepProgress)
                .set({ status: 'in_progress' })
                .where(and(eq(applicationStepProgress.applicationId, parseInt(applicationId)), eq(applicationStepProgress.stepNumber, stepNumber + 1)));
        }
        logger.info('[Careers] Step autosaved', {
            applicationId,
            stepNumber,
            correlationId,
        });
        res.json({
            success: true,
            stepNumber,
            savedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error('[Careers] Autosave failed', { error, correlationId });
        res.status(500).json({ error: 'Failed to save progress' });
    }
});
// Get step progress for an application
router.get('/applications/:applicationId/progress', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { sessionId } = req.query;
        const progress = await db
            .select()
            .from(applicationStepProgress)
            .where(eq(applicationStepProgress.applicationId, parseInt(applicationId)))
            .orderBy(applicationStepProgress.stepNumber);
        const [application] = await db
            .select()
            .from(staffApplications)
            .where(eq(staffApplications.id, parseInt(applicationId)))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json({
            applicationId: parseInt(applicationId),
            status: application.status,
            steps: progress.map(step => ({
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                status: step.status,
                completedAt: step.completedAt,
                data: step.dataSnapshot,
            })),
        });
    }
    catch (error) {
        logger.error('[Careers] Failed to get progress', { error });
        res.status(500).json({ error: 'Failed to get progress' });
    }
});
// Get application status (for applicant tracking)
router.get('/applications/:applicationId/status', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email verification required' });
        }
        const [application] = await db
            .select({
            id: staffApplications.id,
            status: staffApplications.status,
            applicationType: staffApplications.applicationType,
            submittedAt: staffApplications.submittedAt,
            reviewedAt: staffApplications.reviewedAt,
        })
            .from(staffApplications)
            .where(and(eq(staffApplications.id, parseInt(applicationId)), eq(staffApplications.email, email)))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        // Get documents
        const documents = await db
            .select({
            documentType: staffDocuments.documentType,
            status: staffDocuments.status,
        })
            .from(staffDocuments)
            .where(eq(staffDocuments.applicationId, parseInt(applicationId)));
        const statusMessages = {
            'pending': 'Your application is awaiting review',
            'documents_required': 'Please upload the required documents',
            'under_review': 'Your application is being reviewed by our team',
            'background_check': 'Background verification in progress',
            'approved': 'Congratulations! Your application has been approved',
            'rejected': 'Unfortunately, we cannot proceed with your application at this time',
        };
        res.json({
            applicationId: application.id,
            status: application.status,
            statusMessage: statusMessages[application.status || 'pending'] || 'Status unknown',
            roleType: application.applicationType,
            submittedAt: application.submittedAt,
            reviewedAt: application.reviewedAt,
            documents: documents.map(d => ({
                type: d.documentType,
                status: d.status,
            })),
        });
    }
    catch (error) {
        logger.error('[Careers] Status check failed', { error });
        res.status(500).json({ error: 'Failed to check application status' });
    }
});
// =================== ADMIN ENDPOINTS ===================
// Create new career position (admin)
router.post('/admin/positions', async (req, res) => {
    try {
        const validationResult = insertCareerPositionSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten().fieldErrors
            });
        }
        const data = validationResult.data;
        // Generate position ID and slug
        const positionId = `POS-${data.roleType.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${data.location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const [position] = await db
            .insert(careerPositions)
            .values({
            ...data,
            positionId,
            slug,
            publishedAt: new Date(),
        })
            .returning();
        logger.info('[Careers Admin] Position created', { positionId: position.positionId });
        res.status(201).json(position);
    }
    catch (error) {
        logger.error('[Careers Admin] Failed to create position', { error });
        res.status(500).json({ error: 'Failed to create position' });
    }
});
// Seed demo career positions
router.post('/admin/seed-positions', async (req, res) => {
    try {
        const demoPositions = [
            {
                positionId: 'POS-WALKER-001',
                title: 'Pet Walker',
                titleHe: 'מטייל כלבים',
                department: 'operations',
                roleType: 'walker',
                shortDescription: 'Join our team of professional pet walkers and help dogs stay happy and healthy.',
                shortDescriptionHe: 'הצטרפו לצוות המטיילים המקצועי שלנו ועזרו לכלבים להישאר שמחים ובריאים.',
                fullDescription: 'As a Pet Walker at Pet Wash™, you will provide daily exercise and companionship to dogs across Israel. You will be responsible for safe, enjoyable walks while building lasting relationships with pet owners. Our walkers use GPS tracking and real-time updates to keep owners informed.',
                fullDescriptionHe: 'כמטייל כלבים ב-Pet Wash™, תספק פעילות גופנית יומית וחברות לכלבים ברחבי ישראל. תהיה אחראי על טיולים בטוחים ומהנים תוך בניית קשרים ארוכי טווח עם בעלי חיות מחמד.',
                location: 'Nationwide Israel',
                locationType: 'field',
                employmentType: 'contractor',
                salaryRangeMin: '35',
                salaryRangeMax: '60',
                salaryCurrency: 'ILS',
                salaryPeriod: 'hourly',
                requirements: ['Love for animals', 'Physical fitness', 'Reliable transportation', 'Smartphone with GPS', 'Clean background check'],
                requiresBackgroundCheck: true,
                requiresDrivingLicense: false,
                isActive: true,
                isFeatured: true,
                urgencyLevel: 'urgent',
                openPositions: 15,
                slug: 'pet-walker-nationwide',
            },
            {
                positionId: 'POS-DRIVER-001',
                title: 'PetTrek™ Driver',
                titleHe: 'נהג PetTrek™',
                department: 'logistics',
                roleType: 'driver',
                shortDescription: 'Transport pets safely across Israel with our premium pet transport service.',
                shortDescriptionHe: 'העבר חיות מחמד בבטחה ברחבי ישראל עם שירות ההובלה הפרמיום שלנו.',
                fullDescription: 'PetTrek™ drivers provide safe, comfortable transportation for pets. You will use our climate-controlled vehicles and follow strict safety protocols. GPS-tracked journeys ensure peace of mind for pet owners.',
                fullDescriptionHe: 'נהגי PetTrek™ מספקים הובלה בטוחה ונוחה לחיות מחמד. תשתמש ברכבים ממוזגים שלנו ותעקוב אחר פרוטוקולי בטיחות קפדניים.',
                location: 'Tel Aviv, Jerusalem, Haifa',
                locationType: 'field',
                employmentType: 'contractor',
                salaryRangeMin: '45',
                salaryRangeMax: '80',
                salaryCurrency: 'ILS',
                salaryPeriod: 'hourly',
                requirements: ['Valid driving license (min 3 years)', 'Clean driving record', 'Pet handling experience', 'Smartphone with GPS', 'Clean background check'],
                requiresBackgroundCheck: true,
                requiresDrivingLicense: true,
                isActive: true,
                isFeatured: true,
                urgencyLevel: 'normal',
                openPositions: 8,
                slug: 'pettrek-driver-israel',
            },
            {
                positionId: 'POS-SITTER-001',
                title: 'Pet Sitter & Host',
                titleHe: 'פט סיטר ומארח',
                department: 'care',
                roleType: 'sitter',
                shortDescription: 'Provide loving care for pets in your home or the pet owner\'s home.',
                shortDescriptionHe: 'ספק טיפול אוהב לחיות מחמד בביתך או בבית בעל חיית המחמד.',
                fullDescription: 'As a Pet Sitter & Host, you will provide overnight care, feeding, and companionship. You can host pets in your home or visit pet owners\' homes. Our platform handles bookings, payments, and insurance.',
                fullDescriptionHe: 'כפט סיטר ומארח, תספק טיפול לילי, האכלה וחברות. תוכל לארח חיות מחמד בביתך או לבקר בבתי בעלי חיות מחמד.',
                location: 'All Major Cities',
                locationType: 'hybrid',
                employmentType: 'contractor',
                salaryRangeMin: '150',
                salaryRangeMax: '300',
                salaryCurrency: 'ILS',
                salaryPeriod: 'daily',
                requirements: ['Pet care experience', 'Pet-friendly home (for hosting)', 'References', 'First aid training (preferred)', 'Background check'],
                requiresBackgroundCheck: true,
                requiresDrivingLicense: false,
                isActive: true,
                isFeatured: false,
                urgencyLevel: 'normal',
                openPositions: 25,
                slug: 'pet-sitter-host-israel',
            },
            {
                positionId: 'POS-SUPPLIER-001',
                title: 'Organic Pet Products Supplier',
                titleHe: 'ספק מוצרי חיות מחמד אורגניים',
                department: 'operations',
                roleType: 'supplier',
                shortDescription: 'Partner with Pet Wash™ to supply premium organic pet care products.',
                shortDescriptionHe: 'שתף פעולה עם Pet Wash™ לאספקת מוצרי טיפוח אורגניים פרמיום לחיות מחמד.',
                fullDescription: 'We are looking for certified organic suppliers of shampoos, conditioners, and pet care products. Our K9000 stations use only the finest Australian Tea Tree Oil formulations. Become a trusted supplier partner.',
                fullDescriptionHe: 'אנו מחפשים ספקים אורגניים מוסמכים של שמפו, מרכך ומוצרי טיפוח. עמדות ה-K9000 שלנו משתמשות רק בפורמולציות שמן עץ התה האוסטרלי המשובחות ביותר.',
                location: 'Israel / International',
                locationType: 'remote',
                employmentType: 'contractor',
                requirements: ['Organic certification', 'Quality assurance standards', 'Minimum 1000L/month capacity', 'Israeli Tax Registration'],
                requiresBackgroundCheck: false,
                requiresDrivingLicense: false,
                isActive: true,
                isFeatured: false,
                urgencyLevel: 'normal',
                openPositions: 5,
                slug: 'organic-supplier-partner',
            },
        ];
        // Insert or update positions
        for (const position of demoPositions) {
            const existing = await db
                .select({ id: careerPositions.id })
                .from(careerPositions)
                .where(eq(careerPositions.positionId, position.positionId))
                .limit(1);
            if (existing.length === 0) {
                await db.insert(careerPositions).values({
                    ...position,
                    publishedAt: new Date(),
                });
            }
        }
        logger.info('[Careers Admin] Demo positions seeded');
        res.json({ success: true, message: 'Demo positions seeded successfully', count: demoPositions.length });
    }
    catch (error) {
        logger.error('[Careers Admin] Failed to seed positions', { error });
        res.status(500).json({ error: 'Failed to seed positions' });
    }
});
// =================== JOB ADVERTISEMENT MANAGEMENT ===================
// Get all job positions (admin view)
router.get('/admin/positions', async (req, res) => {
    try {
        const { isActive, roleType, limit = '50' } = req.query;
        let conditions = [];
        if (isActive !== undefined && isActive !== 'all') {
            conditions.push(eq(careerPositions.isActive, isActive === 'true'));
        }
        if (roleType && typeof roleType === 'string' && roleType !== 'all') {
            conditions.push(eq(careerPositions.roleType, roleType));
        }
        const positions = await db
            .select()
            .from(careerPositions)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(careerPositions.createdAt))
            .limit(parseInt(limit));
        res.json(positions);
    }
    catch (error) {
        logger.error('[Jobs Admin] Failed to fetch positions', { error });
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});
// Create new job position
router.post('/admin/positions', async (req, res) => {
    try {
        const validationResult = insertCareerPositionSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
        }
        const positionData = validationResult.data;
        // Generate unique position ID
        const rolePrefix = (positionData.roleType || 'GEN').toUpperCase().substring(0, 3);
        const counter = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const positionId = `POS-${rolePrefix}-${counter}`;
        // Generate slug
        const slug = `${positionData.title.toLowerCase().replace(/\s+/g, '-')}-${positionData.location?.toLowerCase().replace(/\s+/g, '-') || 'israel'}`;
        const [newPosition] = await db
            .insert(careerPositions)
            .values({
            ...positionData,
            positionId,
            slug,
            publishedAt: positionData.isActive ? new Date() : null,
        })
            .returning();
        logger.info('[Jobs Admin] Position created', { positionId: newPosition.positionId });
        res.status(201).json(newPosition);
    }
    catch (error) {
        logger.error('[Jobs Admin] Failed to create position', { error });
        res.status(500).json({ error: 'Failed to create position' });
    }
});
// Update job position
router.patch('/admin/positions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.positionId;
        delete updateData.createdAt;
        delete updateData.viewCount;
        delete updateData.applicationCount;
        // Update timestamp
        updateData.updatedAt = new Date();
        // If activating, set published date
        if (updateData.isActive === true) {
            const [existing] = await db
                .select({ publishedAt: careerPositions.publishedAt })
                .from(careerPositions)
                .where(eq(careerPositions.id, parseInt(id)))
                .limit(1);
            if (!existing?.publishedAt) {
                updateData.publishedAt = new Date();
            }
        }
        const [updated] = await db
            .update(careerPositions)
            .set(updateData)
            .where(eq(careerPositions.id, parseInt(id)))
            .returning();
        if (!updated) {
            return res.status(404).json({ error: 'Position not found' });
        }
        logger.info('[Jobs Admin] Position updated', { positionId: updated.positionId });
        res.json(updated);
    }
    catch (error) {
        logger.error('[Jobs Admin] Failed to update position', { error });
        res.status(500).json({ error: 'Failed to update position' });
    }
});
// Delete/archive job position
router.delete('/admin/positions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete - just deactivate
        const [archived] = await db
            .update(careerPositions)
            .set({
            isActive: false,
            updatedAt: new Date(),
            expiresAt: new Date(),
        })
            .where(eq(careerPositions.id, parseInt(id)))
            .returning();
        if (!archived) {
            return res.status(404).json({ error: 'Position not found' });
        }
        logger.info('[Jobs Admin] Position archived', { positionId: archived.positionId });
        res.json({ success: true, message: 'Position archived' });
    }
    catch (error) {
        logger.error('[Jobs Admin] Failed to archive position', { error });
        res.status(500).json({ error: 'Failed to archive position' });
    }
});
// =================== SMART SHORTLISTING ENGINE ===================
// Shortlisting criteria configuration
const SHORTLIST_CRITERIA = {
    // Automatic rejection criteria
    autoReject: {
        criminalBackground: {
            weight: 100,
            description: 'Criminal background detected',
            descriptionHe: 'רקע פלילי התגלה'
        },
        fraudRiskHigh: {
            weight: 80,
            threshold: 60,
            description: 'High fraud risk score',
            descriptionHe: 'ציון סיכון הונאה גבוה'
        },
        duplicateApplication: {
            weight: 70,
            description: 'Duplicate application detected',
            descriptionHe: 'מועמדות כפולה התגלתה'
        },
        underAge: {
            weight: 100,
            minAge: 18,
            description: 'Under minimum age requirement',
            descriptionHe: 'מתחת לגיל המינימלי'
        },
        missingMandatoryDocs: {
            weight: 50,
            description: 'Missing mandatory documents',
            descriptionHe: 'חסרים מסמכים חובה'
        },
    },
    // Scoring criteria (positive factors)
    scoring: {
        hasExperience: { weight: 20, description: 'Has relevant experience' },
        hasReferences: { weight: 15, description: 'Provided references' },
        hasResume: { weight: 10, description: 'Uploaded resume/CV' },
        hasLicense: { weight: 15, description: 'Has required license' },
        localCandidate: { weight: 10, description: 'Local candidate' },
        completedProfile: { weight: 10, description: 'Complete application profile' },
    },
    // Thresholds
    thresholds: {
        autoShortlist: 70, // Score >= 70 = auto shortlist
        autoReject: 30, // Score <= 30 = auto reject
        manualReview: [31, 69], // Score 31-69 = manual review
    }
};
// Calculate shortlist score for an application
function calculateShortlistScore(application, position, fraudSignals) {
    let score = 50; // Start at neutral
    const flags = [];
    // Check auto-rejection criteria
    // 1. Criminal background (from declaration)
    if (application.criminalRecord === true || application.hasCriminalBackground === true) {
        flags.push({
            type: 'criminal_background',
            reason: SHORTLIST_CRITERIA.autoReject.criminalBackground.description,
            reasonHe: SHORTLIST_CRITERIA.autoReject.criminalBackground.descriptionHe,
            weight: -SHORTLIST_CRITERIA.autoReject.criminalBackground.weight,
            isRejection: true,
        });
        score -= SHORTLIST_CRITERIA.autoReject.criminalBackground.weight;
    }
    // 2. High fraud risk score
    const fraudRiskScore = application.fraudRiskScore || 0;
    if (fraudRiskScore >= SHORTLIST_CRITERIA.autoReject.fraudRiskHigh.threshold) {
        flags.push({
            type: 'fraud_risk',
            reason: `${SHORTLIST_CRITERIA.autoReject.fraudRiskHigh.description} (${fraudRiskScore}%)`,
            reasonHe: `${SHORTLIST_CRITERIA.autoReject.fraudRiskHigh.descriptionHe} (${fraudRiskScore}%)`,
            weight: -SHORTLIST_CRITERIA.autoReject.fraudRiskHigh.weight,
            isRejection: true,
        });
        score -= SHORTLIST_CRITERIA.autoReject.fraudRiskHigh.weight;
    }
    // 3. Duplicate detection from fraud signals
    const duplicateSignals = fraudSignals.filter(s => s.signalType === 'duplicate');
    if (duplicateSignals.length > 0) {
        flags.push({
            type: 'duplicate',
            reason: SHORTLIST_CRITERIA.autoReject.duplicateApplication.description,
            reasonHe: SHORTLIST_CRITERIA.autoReject.duplicateApplication.descriptionHe,
            weight: -SHORTLIST_CRITERIA.autoReject.duplicateApplication.weight,
            isRejection: true,
        });
        score -= SHORTLIST_CRITERIA.autoReject.duplicateApplication.weight;
    }
    // 4. Age check
    if (application.dateOfBirth) {
        const birthDate = new Date(application.dateOfBirth);
        const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const minAge = position?.minimumAge || SHORTLIST_CRITERIA.autoReject.underAge.minAge;
        if (age < minAge) {
            flags.push({
                type: 'underage',
                reason: `${SHORTLIST_CRITERIA.autoReject.underAge.description} (${age} < ${minAge})`,
                reasonHe: `${SHORTLIST_CRITERIA.autoReject.underAge.descriptionHe} (${age} < ${minAge})`,
                weight: -SHORTLIST_CRITERIA.autoReject.underAge.weight,
                isRejection: true,
            });
            score -= SHORTLIST_CRITERIA.autoReject.underAge.weight;
        }
    }
    // 5. Competency/qualification issues
    if (position?.requiresDrivingLicense && !application.hasDrivingLicense) {
        flags.push({
            type: 'missing_license',
            reason: 'Missing required driving license',
            reasonHe: 'חסר רישיון נהיגה נדרש',
            weight: -30,
            isRejection: false,
        });
        score -= 30;
    }
    // Add positive scoring factors
    // Experience
    if (application.yearsOfExperience && application.yearsOfExperience > 0) {
        const expBonus = Math.min(application.yearsOfExperience * 5, 20);
        flags.push({
            type: 'experience',
            reason: `${application.yearsOfExperience} years of experience`,
            reasonHe: `${application.yearsOfExperience} שנות ניסיון`,
            weight: expBonus,
            isRejection: false,
        });
        score += expBonus;
    }
    // References provided
    if (application.references && Array.isArray(application.references) && application.references.length > 0) {
        flags.push({
            type: 'references',
            reason: SHORTLIST_CRITERIA.scoring.hasReferences.description,
            reasonHe: 'סיפק המלצות',
            weight: SHORTLIST_CRITERIA.scoring.hasReferences.weight,
            isRejection: false,
        });
        score += SHORTLIST_CRITERIA.scoring.hasReferences.weight;
    }
    // Complete profile (all required fields filled)
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'city'];
    const completedFields = requiredFields.filter(f => application[f] && application[f].toString().trim());
    if (completedFields.length === requiredFields.length) {
        flags.push({
            type: 'complete_profile',
            reason: SHORTLIST_CRITERIA.scoring.completedProfile.description,
            reasonHe: 'פרופיל מועמדות מלא',
            weight: SHORTLIST_CRITERIA.scoring.completedProfile.weight,
            isRejection: false,
        });
        score += SHORTLIST_CRITERIA.scoring.completedProfile.weight;
    }
    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));
    // Determine recommendation
    let recommendation;
    // Any hard rejection flag = auto reject
    const hasHardRejection = flags.some(f => f.isRejection && f.type === 'criminal_background');
    if (hasHardRejection || score <= SHORTLIST_CRITERIA.thresholds.autoReject) {
        recommendation = 'reject';
    }
    else if (score >= SHORTLIST_CRITERIA.thresholds.autoShortlist) {
        recommendation = 'shortlist';
    }
    else {
        recommendation = 'manual_review';
    }
    return { score, flags, recommendation };
}
// Run smart shortlisting on an application
router.post('/admin/applications/:id/shortlist', async (req, res) => {
    try {
        const { id } = req.params;
        // Get application
        const [application] = await db
            .select()
            .from(staffApplications)
            .where(eq(staffApplications.id, parseInt(id)))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        // Get position details
        const [position] = await db
            .select()
            .from(careerPositions)
            .where(eq(careerPositions.positionId, application.positionId))
            .limit(1);
        // Get fraud signals
        const fraudSignals = await db
            .select()
            .from(applicationFraudSignals)
            .where(eq(applicationFraudSignals.applicationId, application.id));
        // Calculate shortlist score
        const result = calculateShortlistScore(application, position, fraudSignals);
        // Update application with shortlist result
        const newStatus = result.recommendation === 'shortlist' ? 'under_review' :
            result.recommendation === 'reject' ? 'rejected' : 'pending';
        const [updated] = await db
            .update(staffApplications)
            .set({
            shortlistScore: result.score,
            shortlistRecommendation: result.recommendation,
            shortlistFlags: result.flags,
            status: newStatus,
            reviewedAt: new Date(),
        })
            .where(eq(staffApplications.id, parseInt(id)))
            .returning();
        logger.info('[Shortlist] Application processed', {
            applicationId: id,
            score: result.score,
            recommendation: result.recommendation,
            flagCount: result.flags.length,
        });
        res.json({
            applicationId: id,
            ...result,
            newStatus,
        });
    }
    catch (error) {
        logger.error('[Shortlist] Failed to process application', { error });
        res.status(500).json({ error: 'Failed to process shortlisting' });
    }
});
// Bulk shortlist all pending applications
router.post('/admin/applications/bulk-shortlist', async (req, res) => {
    try {
        // Get all pending/submitted applications
        const pendingApps = await db
            .select()
            .from(staffApplications)
            .where(and(eq(staffApplications.status, 'pending'), sql `${staffApplications.submittedAt} IS NOT NULL`))
            .limit(100);
        const results = {
            processed: 0,
            shortlisted: 0,
            rejected: 0,
            manualReview: 0,
            errors: 0,
        };
        for (const app of pendingApps) {
            try {
                // Get position and fraud signals
                const [position] = await db
                    .select()
                    .from(careerPositions)
                    .where(eq(careerPositions.positionId, app.positionId))
                    .limit(1);
                const fraudSignals = await db
                    .select()
                    .from(applicationFraudSignals)
                    .where(eq(applicationFraudSignals.applicationId, app.id));
                const result = calculateShortlistScore(app, position, fraudSignals);
                const newStatus = result.recommendation === 'shortlist' ? 'under_review' :
                    result.recommendation === 'reject' ? 'rejected' : 'pending';
                await db
                    .update(staffApplications)
                    .set({
                    shortlistScore: result.score,
                    shortlistRecommendation: result.recommendation,
                    shortlistFlags: result.flags,
                    status: newStatus,
                    reviewedAt: new Date(),
                })
                    .where(eq(staffApplications.id, app.id));
                results.processed++;
                if (result.recommendation === 'shortlist')
                    results.shortlisted++;
                else if (result.recommendation === 'reject')
                    results.rejected++;
                else
                    results.manualReview++;
            }
            catch (err) {
                results.errors++;
                logger.error('[Bulk Shortlist] Error processing application', { appId: app.id, error: err });
            }
        }
        logger.info('[Bulk Shortlist] Completed', results);
        res.json({
            success: true,
            ...results,
        });
    }
    catch (error) {
        logger.error('[Bulk Shortlist] Failed', { error });
        res.status(500).json({ error: 'Failed to run bulk shortlisting' });
    }
});
// =================== HR ADMIN DASHBOARD ===================
// Get all applications with filtering (HR Admin)
router.get('/admin/applications', async (req, res) => {
    try {
        const { status, roleType, positionId, search, limit = '50', offset = '0' } = req.query;
        // Build query conditions
        let conditions = [];
        if (status && typeof status === 'string' && status !== 'all') {
            conditions.push(eq(staffApplications.status, status));
        }
        if (roleType && typeof roleType === 'string' && roleType !== 'all') {
            conditions.push(eq(staffApplications.applicationType, roleType));
        }
        if (positionId && typeof positionId === 'string') {
            conditions.push(eq(staffApplications.positionId, positionId));
        }
        // Build the where clause
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        // Get applications with position details
        const applications = await db
            .select({
            id: staffApplications.id,
            applicationId: staffApplications.applicationId,
            positionId: staffApplications.positionId,
            firstName: staffApplications.firstName,
            lastName: staffApplications.lastName,
            email: staffApplications.email,
            phone: staffApplications.phone,
            city: staffApplications.city,
            applicationType: staffApplications.applicationType,
            status: staffApplications.status,
            reviewStage: staffApplications.reviewStage,
            fraudRiskScore: staffApplications.fraudRiskScore,
            createdAt: staffApplications.createdAt,
            submittedAt: staffApplications.submittedAt,
            reviewedAt: staffApplications.reviewedAt,
            positionTitle: careerPositions.titleEn,
            positionTitleHe: careerPositions.titleHe,
            positionLocation: careerPositions.location,
        })
            .from(staffApplications)
            .leftJoin(careerPositions, eq(staffApplications.positionId, careerPositions.positionId))
            .where(whereClause)
            .orderBy(desc(staffApplications.createdAt))
            .limit(parseInt(limit))
            .offset(parseInt(offset));
        // Get total count for pagination
        const [{ count }] = await db
            .select({ count: sql `count(*)::int` })
            .from(staffApplications)
            .where(whereClause);
        // Get status counts for dashboard
        const statusCounts = await db
            .select({
            status: staffApplications.status,
            count: sql `count(*)::int`,
        })
            .from(staffApplications)
            .groupBy(staffApplications.status);
        res.json({
            applications,
            total: count,
            statusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr.status || 'unknown'] = curr.count;
                return acc;
            }, {}),
        });
    }
    catch (error) {
        logger.error('[HR Admin] Failed to fetch applications', { error });
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});
// Get single application details (HR Admin)
router.get('/admin/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [application] = await db
            .select()
            .from(staffApplications)
            .where(eq(staffApplications.id, parseInt(id)))
            .limit(1);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }
        // Get position details
        const [position] = await db
            .select()
            .from(careerPositions)
            .where(eq(careerPositions.positionId, application.positionId))
            .limit(1);
        // Get documents
        const documents = await db
            .select()
            .from(staffDocuments)
            .where(eq(staffDocuments.applicationId, application.id));
        // Get fraud signals
        const fraudSignals = await db
            .select()
            .from(applicationFraudSignals)
            .where(eq(applicationFraudSignals.applicationId, application.id))
            .orderBy(desc(applicationFraudSignals.detectedAt));
        // Get step progress
        const steps = await db
            .select()
            .from(applicationStepProgress)
            .where(eq(applicationStepProgress.applicationId, application.id))
            .orderBy(applicationStepProgress.stepNumber);
        res.json({
            application,
            position,
            documents,
            fraudSignals,
            steps,
        });
    }
    catch (error) {
        logger.error('[HR Admin] Failed to fetch application details', { error });
        res.status(500).json({ error: 'Failed to fetch application details' });
    }
});
// Update application status (HR Admin)
router.patch('/admin/applications/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewStage, reviewerNotes } = req.body;
        const validStatuses = ['draft', 'pending', 'under_review', 'documents_required', 'background_check',
            'interview_scheduled', 'approved', 'rejected', 'withdrawn'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const updateData = {
            status,
            reviewedAt: new Date(),
        };
        if (reviewStage) {
            updateData.reviewStage = reviewStage;
        }
        if (reviewerNotes) {
            updateData.reviewerNotes = reviewerNotes;
        }
        const [updated] = await db
            .update(staffApplications)
            .set(updateData)
            .where(eq(staffApplications.id, parseInt(id)))
            .returning();
        if (!updated) {
            return res.status(404).json({ error: 'Application not found' });
        }
        logger.info('[HR Admin] Application status updated', {
            applicationId: updated.id,
            newStatus: status
        });
        res.json(updated);
    }
    catch (error) {
        logger.error('[HR Admin] Failed to update application status', { error });
        res.status(500).json({ error: 'Failed to update status' });
    }
});
// Get HR dashboard statistics
router.get('/admin/stats', async (req, res) => {
    try {
        // Total applications
        const [{ total }] = await db
            .select({ total: sql `count(*)::int` })
            .from(staffApplications);
        // Applications by status
        const statusCounts = await db
            .select({
            status: staffApplications.status,
            count: sql `count(*)::int`,
        })
            .from(staffApplications)
            .groupBy(staffApplications.status);
        // Applications by role type
        const roleTypeCounts = await db
            .select({
            roleType: staffApplications.applicationType,
            count: sql `count(*)::int`,
        })
            .from(staffApplications)
            .groupBy(staffApplications.applicationType);
        // Recent applications (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const [{ recentCount }] = await db
            .select({ recentCount: sql `count(*)::int` })
            .from(staffApplications)
            .where(sql `${staffApplications.createdAt} >= ${sevenDaysAgo}`);
        // High risk applications
        const [{ highRiskCount }] = await db
            .select({ highRiskCount: sql `count(*)::int` })
            .from(staffApplications)
            .where(sql `${staffApplications.fraudRiskScore} >= 50`);
        res.json({
            total,
            recentCount,
            highRiskCount,
            statusBreakdown: statusCounts.reduce((acc, curr) => {
                acc[curr.status || 'unknown'] = curr.count;
                return acc;
            }, {}),
            roleTypeBreakdown: roleTypeCounts.reduce((acc, curr) => {
                acc[curr.roleType || 'unknown'] = curr.count;
                return acc;
            }, {}),
        });
    }
    catch (error) {
        logger.error('[HR Admin] Failed to fetch stats', { error });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
export default router;
