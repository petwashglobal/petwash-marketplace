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
    const decodedToken = await auth.verifyIdToken(token);
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
 * Download certificate as PDF
 */
router.get('/certificate/:certificateId/pdf', async (req, res) => {
  try {
    const { certificateId } = req.params;

    const verification = await providerTrainingService.verifyCertificate(certificateId);

    if (!verification.valid || !verification.certificate) {
      return res.status(404).json({ error: 'התעודה לא נמצאה' });
    }

    // TODO: Generate actual PDF using PDFKit
    // For now, return placeholder
    res.json({
      message: 'PDF generation will be implemented with PDFKit',
      certificateId,
      providerName: verification.certificate.providerName,
      platform: verification.certificate.platform,
      issuedAt: verification.certificate.issuedAt,
      expiresAt: verification.certificate.expiresAt,
    });
  } catch (error) {
    logger.error('[Provider Training] Error generating PDF', error);
    res.status(500).json({ error: 'שגיאה ביצירת הקובץ' });
  }
});

export default router;
