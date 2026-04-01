/**
 * Provider Training API Routes - ⁦Pet Wash™⁩
 * 
 * Training modules, quizzes, and certificate management
 * Hebrew-dominant with English brand touches
 */

import { Router } from 'express';
import { providerTrainingService, type TrainingPlatform } from '../services/ProviderTrainingService';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';

const router = Router();

// Auth middleware for providers
async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'נדרשת התחברות' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token, true);
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error) {
    logger.error('[Provider Training] Auth error', error);
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

/**
 * GET /api/provider-training/modules/:platform
 * Get all training modules for a platform
 */
router.get('/modules/:platform', async (req, res) => {
  try {
    const platform = req.params.platform as TrainingPlatform;
    
    const validPlatforms = ['sitter_suite', 'walk_my_pet', 'pettrek', 'k9000', 'general'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: 'פלטפורמה לא תקינה' });
    }

    const modules = await providerTrainingService.getModulesForPlatform(platform);
    
    // Return modules without quiz answers for security
    const safeModules = modules.map(m => ({
      id: m.id,
      platform: m.platform,
      moduleNumber: m.moduleNumber,
      titleHe: m.titleHe,
      titleEn: m.titleEn,
      descriptionHe: m.descriptionHe,
      descriptionEn: m.descriptionEn,
      videoUrl: m.videoUrl,
      durationMinutes: m.durationMinutes,
      requiredForCertification: m.requiredForCertification,
      content: m.content,
      quizQuestionCount: m.quiz.questions.length,
      passingScore: m.quiz.passingScore,
      maxAttempts: m.quiz.maxAttempts,
    }));

    res.json({
      platform,
      modules: safeModules,
      totalModules: safeModules.length,
    });
  } catch (error) {
    logger.error('[Provider Training] Error fetching modules', error);
    res.status(500).json({ error: 'שגיאה בטעינת המודולים' });
  }
});

/**
 * GET /api/provider-training/module/:moduleId
 * Get a specific training module
 */
router.get('/module/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const module = await providerTrainingService.getModule(moduleId);

    if (!module) {
      return res.status(404).json({ error: 'מודול לא נמצא' });
    }

    // Return module without quiz answers
    const safeModule = {
      id: module.id,
      platform: module.platform,
      moduleNumber: module.moduleNumber,
      titleHe: module.titleHe,
      titleEn: module.titleEn,
      descriptionHe: module.descriptionHe,
      descriptionEn: module.descriptionEn,
      videoUrl: module.videoUrl,
      durationMinutes: module.durationMinutes,
      requiredForCertification: module.requiredForCertification,
      content: module.content,
      quiz: {
        questions: module.quiz.questions.map(q => ({
          id: q.id,
          questionHe: q.questionHe,
          questionEn: q.questionEn,
          options: q.options.map(o => ({
            id: o.id,
            textHe: o.textHe,
            textEn: o.textEn,
            // Don't expose isCorrect!
          })),
        })),
        passingScore: module.quiz.passingScore,
        maxAttempts: module.quiz.maxAttempts,
      },
    };

    res.json(safeModule);
  } catch (error) {
    logger.error('[Provider Training] Error fetching module', error);
    res.status(500).json({ error: 'שגיאה בטעינת המודול' });
  }
});

/**
 * GET /api/provider-training/progress/:platform
 * Get provider's training progress
 */
router.get('/progress/:platform', requireAuth, async (req: any, res) => {
  try {
    const platform = req.params.platform as TrainingPlatform;
    const providerId = req.userId;

    const progress = await providerTrainingService.getProviderProgress(providerId, platform);

    res.json({
      providerId,
      platform,
      ...progress,
    });
  } catch (error) {
    logger.error('[Provider Training] Error fetching progress', error);
    res.status(500).json({ error: 'שגיאה בטעינת ההתקדמות' });
  }
});

/**
 * POST /api/provider-training/complete-module
 * Mark a module as completed (watched)
 */
router.post('/complete-module', requireAuth, async (req: any, res) => {
  try {
    const { moduleId, platform } = req.body;
    const providerId = req.userId;

    if (!moduleId || !platform) {
      return res.status(400).json({ error: 'חסרים פרטים' });
    }

    await providerTrainingService.markModuleCompleted(providerId, moduleId, platform);

    logger.info('[Provider Training] Module completed', { providerId, moduleId });

    res.json({
      success: true,
      message: 'המודול הושלם בהצלחה',
    });
  } catch (error: any) {
    logger.error('[Provider Training] Error completing module', error);
    res.status(500).json({ error: error.message || 'שגיאה בסימון המודול' });
  }
});

/**
 * POST /api/provider-training/submit-quiz
 * Submit quiz answers for grading
 */
router.post('/submit-quiz', requireAuth, async (req: any, res) => {
  try {
    const { moduleId, answers } = req.body;
    const providerId = req.userId;

    if (!moduleId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'חסרות תשובות' });
    }

    const result = await providerTrainingService.submitQuiz(providerId, {
      moduleId,
      answers,
    });

    const responseMessage = result.passed
      ? 'כל הכבוד! עברת את המבחן בהצלחה 🎉'
      : `לא עברת את המבחן. ציון: ${result.score}%. נדרש: 100%`;

    res.json({
      ...result,
      messageHe: responseMessage,
      messageEn: result.passed
        ? 'Congratulations! You passed the quiz! 🎉'
        : `Quiz not passed. Score: ${result.score}%. Required: 100%`,
    });
  } catch (error: any) {
    logger.error('[Provider Training] Error submitting quiz', error);
    res.status(500).json({ error: error.message || 'שגיאה בהגשת המבחן' });
  }
});

/**
 * POST /api/provider-training/generate-certificate
 * Generate certificate after completing all training
 */
router.post('/generate-certificate', requireAuth, async (req: any, res) => {
  try {
    const { platform, providerName } = req.body;
    const providerId = req.userId;

    if (!platform || !providerName) {
      return res.status(400).json({ error: 'חסרים פרטים' });
    }

    const certificate = await providerTrainingService.generateCertificate(
      providerId,
      platform,
      providerName
    );

    logger.info('[Provider Training] Certificate generated', {
      providerId,
      certificateId: certificate.certificateId,
    });

    res.json({
      success: true,
      certificate,
      messageHe: 'התעודה הופקה בהצלחה! כעת ניתן להוריד אותה.',
      messageEn: 'Certificate generated successfully! You can now download it.',
    });
  } catch (error: any) {
    logger.error('[Provider Training] Error generating certificate', error);
    res.status(500).json({ error: error.message || 'שגיאה בהפקת התעודה' });
  }
});

/**
 * GET /api/provider-training/certificate/:certificateId
 * Verify a certificate (public endpoint)
 */
router.get('/certificate/:certificateId', async (req, res) => {
  try {
    const { certificateId } = req.params;

    const verification = await providerTrainingService.verifyCertificate(certificateId);

    if (!verification.valid) {
      return res.status(404).json({
        valid: false,
        reasonHe: 'התעודה לא נמצאה או לא בתוקף',
        reasonEn: verification.reason || 'Certificate not found or invalid',
      });
    }

    res.json({
      valid: true,
      certificate: verification.certificate,
      messageHe: 'התעודה תקינה ובתוקף ✓',
      messageEn: 'Certificate is valid ✓',
    });
  } catch (error) {
    logger.error('[Provider Training] Error verifying certificate', error);
    res.status(500).json({ error: 'שגיאה באימות התעודה' });
  }
});

/**
 * GET /api/provider-training/certificate/:certificateId/pdf
 * Download certificate as PDF using PDFKit
 */
router.get('/certificate/:certificateId/pdf', async (req, res) => {
  try {
    const { certificateId } = req.params;

    const verification = await providerTrainingService.verifyCertificate(certificateId);

    if (!verification.valid || !verification.certificate) {
      return res.status(404).json({ error: 'התעודה לא נמצאה' });
    }

    const cert = verification.certificate;
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificateId}.pdf"`);
    doc.pipe(res);

    // ── Background ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f5ff');
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
       .stroke('#7c3aed').lineWidth(3);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fillColor('#7c3aed')
       .fontSize(32).font('Helvetica-Bold')
       .text('PetWash™', 0, 50, { align: 'center' });

    doc.fillColor('#4b5563')
       .fontSize(16).font('Helvetica')
       .text('תעודת הכשרה מקצועית — Professional Training Certificate', 0, 95, { align: 'center' });

    // ── Divider ─────────────────────────────────────────────────────────────
    doc.moveTo(80, 130).lineTo(doc.page.width - 80, 130).stroke('#c4b5fd').lineWidth(1);

    // ── Body ────────────────────────────────────────────────────────────────
    const cy = 155;
    doc.fillColor('#111827')
       .fontSize(14).font('Helvetica')
       .text('This is to certify that', 0, cy, { align: 'center' });

    doc.fillColor('#7c3aed')
       .fontSize(28).font('Helvetica-Bold')
       .text(cert.providerName, 0, cy + 25, { align: 'center' });

    doc.fillColor('#111827')
       .fontSize(14).font('Helvetica')
       .text(`has successfully completed the`, 0, cy + 65, { align: 'center' });

    doc.fillColor('#1d4ed8')
       .fontSize(20).font('Helvetica-Bold')
       .text(`${cert.platform.toUpperCase()} Provider Training Program`, 0, cy + 90, { align: 'center' });

    // ── Dates ────────────────────────────────────────────────────────────────
    const issuedStr = new Date(cert.issuedAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
    const expiresStr = cert.expiresAt
      ? new Date(cert.expiresAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'ללא תאריך תפוגה';

    doc.fillColor('#374151')
       .fontSize(11).font('Helvetica')
       .text(`תאריך הנפקה: ${issuedStr}    |    תוקף עד: ${expiresStr}`, 0, cy + 130, { align: 'center' });

    // ── Certificate ID ───────────────────────────────────────────────────────
    doc.fillColor('#9ca3af')
       .fontSize(9).font('Helvetica')
       .text(`Certificate ID: ${certificateId}`, 0, cy + 155, { align: 'center' });

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.moveTo(80, doc.page.height - 70).lineTo(doc.page.width - 80, doc.page.height - 70)
       .stroke('#c4b5fd').lineWidth(1);

    doc.fillColor('#6b7280')
       .fontSize(9).font('Helvetica')
       .text('פט וואש בע"מ  ·  ח.פ. 517145033  ·  PET WASH LTD  ·  www.petwash.co.il',
             0, doc.page.height - 55, { align: 'center' });

    doc.end();
  } catch (error) {
    logger.error('[Provider Training] Error generating PDF', error);
    if (!res.headersSent) res.status(500).json({ error: 'שגיאה ביצירת הקובץ' });
  }
});

export default router;
