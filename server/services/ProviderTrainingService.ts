/**
 * Provider Training Service - ⁦Pet Wash™⁩
 * 
 * Training modules, quizzes, and certificate generation for:
 * - ⁦Sitter Suite™⁩ - Pet sitting providers
 * - ⁦Walk My Pet™⁩ - Dog walkers
 * - ⁦PetTrek™⁩ - Pet transport drivers
 * - ⁦K9000™⁩ - Station operators
 * 
 * Hebrew-dominant with English brand touches
 * Israeli Law 2025 compliance built-in
 */

import { db } from '../db';
import { 
  providerTrainingModules, 
  providerTrainingProgress, 
  providerTrainingQuizResults,
  providerCertificates,
  type InsertProviderTrainingProgress,
  type InsertProviderTrainingQuizResult,
  type InsertProviderCertificate,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// Training module types per platform
export type TrainingPlatform = 'sitter_suite' | 'walk_my_pet' | 'pettrek' | 'k9000' | 'general';

export interface TrainingModuleContent {
  id: string;
  platform: TrainingPlatform;
  moduleNumber: number;
  titleHe: string;
  titleEn: string;
  descriptionHe: string;
  descriptionEn: string;
  videoUrl?: string;
  durationMinutes: number;
  requiredForCertification: boolean;
  content: {
    sections: {
      titleHe: string;
      titleEn: string;
      contentHe: string;
      contentEn: string;
      imageUrl?: string;
    }[];
  };
  quiz: {
    questions: QuizQuestion[];
    passingScore: number; // 100% required
    maxAttempts: number;
  };
}

export interface QuizQuestion {
  id: string;
  questionHe: string;
  questionEn: string;
  options: {
    id: string;
    textHe: string;
    textEn: string;
    isCorrect: boolean;
  }[];
  explanation?: {
    he: string;
    en: string;
  };
}

export interface QuizSubmission {
  moduleId: string;
  answers: { questionId: string; selectedOptionId: string }[];
}

export interface QuizResult {
  passed: boolean;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectQuestions: {
    questionId: string;
    correctOptionId: string;
    selectedOptionId: string;
    explanationHe?: string;
    explanationEn?: string;
  }[];
}

// Pre-defined training modules (⁦Pet Wash™⁩ professional style)
const TRAINING_MODULES: TrainingModuleContent[] = [
  // GENERAL - Required for all platforms
  {
    id: 'gen-001',
    platform: 'general',
    moduleNumber: 1,
    titleHe: 'ברוכים הבאים ל-⁦Pet Wash™⁩',
    titleEn: 'Welcome to ⁦Pet Wash™⁩',
    descriptionHe: 'היכרות עם הפלטפורמה, הערכים שלנו והסטנדרטים שאנו מקפידים עליהם',
    descriptionEn: 'Introduction to our platform, values, and standards',
    durationMinutes: 15,
    requiredForCertification: true,
    content: {
      sections: [
        {
          titleHe: 'מי אנחנו',
          titleEn: 'Who We Are',
          contentHe: '⁦Pet Wash™⁩ הינה פלטפורמה יוקרתית לטיפול בחיות מחמד. אנו מחברים בין בעלי חיות מחמד לבין ספקי שירות מקצועיים ומוסמכים. החזון שלנו הוא להיות המובילים העולמיים בתחום טיפול יוקרתי בחיות מחמד.',
          contentEn: '⁦Pet Wash™⁩ is a premium pet care platform connecting pet owners with certified professional service providers. Our vision is to be the global leader in luxury pet care.',
        },
        {
          titleHe: 'הערכים שלנו',
          titleEn: 'Our Values',
          contentHe: '• בטיחות חיות המחמד תמיד קודמת\n• מקצועיות ואמינות\n• שקיפות מלאה\n• חוקיות והתאמה לחוקי ישראל 2025\n• שירות יוקרתי ברמה הגבוהה ביותר',
          contentEn: '• Pet safety always comes first\n• Professionalism and reliability\n• Complete transparency\n• Israeli Law 2025 compliance\n• Premium service at the highest level',
        },
        {
          titleHe: 'דרישות משפטיות - חוק עוסק עצמאי ישראל 2025',
          titleEn: 'Legal Requirements - Israeli Self-Employed Law 2025',
          contentHe: 'כספק שירות עצמאי בפלטפורמה, עליך לעמוד בדרישות הבאות:\n• רישום כעוסק פטור/מורשה או חברה בע"מ\n• דיווח למס הכנסה וביטוח לאומי\n• ביטוח אחריות מקצועית\n• תעודת יושר מהמשטרה\n• הסכם קבלן עצמאי חתום',
          contentEn: 'As an independent service provider on our platform, you must comply with:\n• Registration as Osek Patur/Murshe or Ltd company\n• Income tax and National Insurance reporting\n• Professional liability insurance\n• Police clearance certificate\n• Signed independent contractor agreement',
        },
      ],
    },
    quiz: {
      questions: [
        {
          id: 'gen-001-q1',
          questionHe: 'מה הערך החשוב ביותר ב-⁦Pet Wash™⁩?',
          questionEn: 'What is the most important value at ⁦Pet Wash™⁩?',
          options: [
            { id: 'a', textHe: 'רווחיות', textEn: 'Profitability', isCorrect: false },
            { id: 'b', textHe: 'בטיחות חיות המחמד', textEn: 'Pet safety', isCorrect: true },
            { id: 'c', textHe: 'מהירות השירות', textEn: 'Speed of service', isCorrect: false },
            { id: 'd', textHe: 'מספר הלקוחות', textEn: 'Number of clients', isCorrect: false },
          ],
          explanation: {
            he: 'בטיחות חיות המחמד תמיד קודמת לכל שיקול אחר',
            en: 'Pet safety always comes first before any other consideration',
          },
        },
        {
          id: 'gen-001-q2',
          questionHe: 'האם נדרש לדווח לביטוח לאומי כעצמאי?',
          questionEn: 'Is National Insurance reporting required as self-employed?',
          options: [
            { id: 'a', textHe: 'לא, זה אופציונלי', textEn: 'No, it\'s optional', isCorrect: false },
            { id: 'b', textHe: 'כן, זו דרישה חוקית', textEn: 'Yes, it\'s a legal requirement', isCorrect: true },
            { id: 'c', textHe: 'רק מעל סכום מסוים', textEn: 'Only above a certain amount', isCorrect: false },
            { id: 'd', textHe: 'רק לחברות בע"מ', textEn: 'Only for Ltd companies', isCorrect: false },
          ],
          explanation: {
            he: 'על פי חוק ישראלי 2025, כל עוסק עצמאי חייב לדווח לביטוח לאומי',
            en: 'Under Israeli Law 2025, all self-employed must report to National Insurance',
          },
        },
      ],
      passingScore: 100,
      maxAttempts: 3,
    },
  },
  
  // SITTER SUITE - Pet Sitting specific
  {
    id: 'sit-001',
    platform: 'sitter_suite',
    moduleNumber: 1,
    titleHe: 'יסודות השמרטפות על חיות מחמד',
    titleEn: 'Pet Sitting Fundamentals',
    descriptionHe: 'כל מה שצריך לדעת על שמרטפות מקצועית על חיות מחמד',
    descriptionEn: 'Everything you need to know about professional pet sitting',
    durationMinutes: 30,
    requiredForCertification: true,
    content: {
      sections: [
        {
          titleHe: 'הכנת הבית לאירוח',
          titleEn: 'Preparing Your Home for Hosting',
          contentHe: 'לפני שמתחילים לאירוח חיות מחמד, יש לוודא:\n• סביבה בטוחה ללא סכנות (צמחים רעילים, כבלים חשמליים)\n• אזור נפרד לכל חיה\n• ציוד בסיסי: קערות, מיטות, צעצועים\n• גישה לשירותי חירום וטרינריים',
          contentEn: 'Before hosting pets, ensure:\n• Safe environment (no toxic plants, electrical cables)\n• Separate area for each pet\n• Basic equipment: bowls, beds, toys\n• Access to emergency veterinary services',
        },
        {
          titleHe: 'תקשורת עם בעלי החיות',
          titleEn: 'Communication with Pet Owners',
          contentHe: '• עדכונים יומיים עם תמונות וסרטונים\n• דיווח מיידי על כל בעיה\n• שמירה על זמינות טלפונית\n• תיעוד מפורט של האכלה, טיולים וצרכים',
          contentEn: '• Daily updates with photos and videos\n• Immediate reporting of any issues\n• Phone availability\n• Detailed documentation of feeding, walks, and needs',
        },
        {
          titleHe: 'התנהגות חיות ושפת גוף',
          titleEn: 'Pet Behavior and Body Language',
          contentHe: 'הכרת סימנים של:\n• לחץ וחרדה\n• שמחה ורוגע\n• אגרסיביות או פחד\n• מחלה או כאב\n\nפעולה מיידית נדרשת בכל סימן חריג!',
          contentEn: 'Recognizing signs of:\n• Stress and anxiety\n• Happiness and calm\n• Aggression or fear\n• Illness or pain\n\nImmediate action required for any unusual signs!',
        },
      ],
    },
    quiz: {
      questions: [
        {
          id: 'sit-001-q1',
          questionHe: 'כמה עדכונים יש לשלוח לבעלי החיה ביום?',
          questionEn: 'How many updates should you send to pet owners daily?',
          options: [
            { id: 'a', textHe: 'אחד בסוף היום', textEn: 'One at the end of the day', isCorrect: false },
            { id: 'b', textHe: 'עדכונים יומיים עם תמונות וסרטונים', textEn: 'Daily updates with photos and videos', isCorrect: true },
            { id: 'c', textHe: 'רק אם יש בעיה', textEn: 'Only if there\'s a problem', isCorrect: false },
            { id: 'd', textHe: 'פעם בשבוע', textEn: 'Once a week', isCorrect: false },
          ],
        },
        {
          id: 'sit-001-q2',
          questionHe: 'מה לעשות אם החיה מראה סימני לחץ?',
          questionEn: 'What to do if a pet shows signs of stress?',
          options: [
            { id: 'a', textHe: 'להתעלם ולחכות שיעבור', textEn: 'Ignore and wait for it to pass', isCorrect: false },
            { id: 'b', textHe: 'לדווח לבעלים רק בסוף האירוח', textEn: 'Report to owner only at the end', isCorrect: false },
            { id: 'c', textHe: 'לנקוט פעולה מיידית ולדווח', textEn: 'Take immediate action and report', isCorrect: true },
            { id: 'd', textHe: 'להחזיר את החיה לבעלים', textEn: 'Return the pet immediately', isCorrect: false },
          ],
        },
        {
          id: 'sit-001-q3',
          questionHe: 'מה הכי חשוב לוודא לפני קבלת חיה לאירוח?',
          questionEn: 'What is most important to verify before hosting a pet?',
          options: [
            { id: 'a', textHe: 'שהחיה חמודה', textEn: 'That the pet is cute', isCorrect: false },
            { id: 'b', textHe: 'סביבה בטוחה ללא סכנות', textEn: 'Safe environment without hazards', isCorrect: true },
            { id: 'c', textHe: 'שיש מספיק מקום', textEn: 'That there\'s enough space', isCorrect: false },
            { id: 'd', textHe: 'שהמחיר סוכם', textEn: 'That the price is agreed', isCorrect: false },
          ],
        },
      ],
      passingScore: 100,
      maxAttempts: 3,
    },
  },

  // WALK MY PET - Dog Walking specific
  {
    id: 'walk-001',
    platform: 'walk_my_pet',
    moduleNumber: 1,
    titleHe: 'הולכת כלבים מקצועית',
    titleEn: 'Professional Dog Walking',
    descriptionHe: 'כל מה שצריך לדעת על הולכת כלבים בטוחה ומקצועית',
    descriptionEn: 'Everything you need to know about safe professional dog walking',
    durationMinutes: 25,
    requiredForCertification: true,
    content: {
      sections: [
        {
          titleHe: 'ציוד הולכת כלבים',
          titleEn: 'Dog Walking Equipment',
          contentHe: '• רצועה איכותית (לא נמתחת לכלבים גדולים)\n• שקיות לאיסוף צרכים\n• מים לשתייה\n• ממתקים לאילוף\n• טלפון טעון\n• כרטיס זיהוי ופרטי הכלב',
          contentEn: '• Quality leash (no retractable for large dogs)\n• Bags for waste pickup\n• Drinking water\n• Training treats\n• Charged phone\n• ID card and dog details',
        },
        {
          titleHe: 'בטיחות בטיול',
          titleEn: 'Walking Safety',
          contentHe: '• תמיד על רצועה באזורים ציבוריים\n• הימנעות מחום קיצוני (מעל 30°C)\n• בדיקת משטחים חמים\n• התרחקות מכלבים לא מוכרים\n• ידע במתן עזרה ראשונה לכלבים',
          contentEn: '• Always on leash in public areas\n• Avoid extreme heat (above 30°C)\n• Check for hot surfaces\n• Stay away from unfamiliar dogs\n• Knowledge of dog first aid',
        },
      ],
    },
    quiz: {
      questions: [
        {
          id: 'walk-001-q1',
          questionHe: 'באיזו טמפרטורה יש להימנע מהליכת כלבים?',
          questionEn: 'At what temperature should dog walking be avoided?',
          options: [
            { id: 'a', textHe: 'מעל 25°C', textEn: 'Above 25°C', isCorrect: false },
            { id: 'b', textHe: 'מעל 30°C', textEn: 'Above 30°C', isCorrect: true },
            { id: 'c', textHe: 'מעל 35°C', textEn: 'Above 35°C', isCorrect: false },
            { id: 'd', textHe: 'אין מגבלת טמפרטורה', textEn: 'No temperature limit', isCorrect: false },
          ],
        },
        {
          id: 'walk-001-q2',
          questionHe: 'מתי מותר להוריד את הכלב מהרצועה?',
          questionEn: 'When can a dog be off leash?',
          options: [
            { id: 'a', textHe: 'תמיד כשהכלב מאולף', textEn: 'Always when dog is trained', isCorrect: false },
            { id: 'b', textHe: 'רק בפארקי כלבים מאושרים', textEn: 'Only in approved dog parks', isCorrect: true },
            { id: 'c', textHe: 'כשאין אנשים בסביבה', textEn: 'When no people around', isCorrect: false },
            { id: 'd', textHe: 'אף פעם', textEn: 'Never', isCorrect: false },
          ],
        },
      ],
      passingScore: 100,
      maxAttempts: 3,
    },
  },

  // PETTREK - Pet Transport specific
  {
    id: 'trek-001',
    platform: 'pettrek',
    moduleNumber: 1,
    titleHe: 'הסעת חיות מחמד בטוחה',
    titleEn: 'Safe Pet Transport',
    descriptionHe: 'כללים ודרישות להסעת חיות מחמד ברכב',
    descriptionEn: 'Rules and requirements for transporting pets by vehicle',
    durationMinutes: 20,
    requiredForCertification: true,
    content: {
      sections: [
        {
          titleHe: 'דרישות רכב',
          titleEn: 'Vehicle Requirements',
          contentHe: '• רכב נקי ומאוורר\n• כלוב נשיאה מאובטח\n• מזגן תקין\n• ערכת עזרה ראשונה\n• מים וקערה\n• ביטוח רכב + כיסוי חיות',
          contentEn: '• Clean and ventilated vehicle\n• Secured carrier cage\n• Working A/C\n• First aid kit\n• Water and bowl\n• Vehicle insurance + pet coverage',
        },
        {
          titleHe: 'חוקי תעבורה והסעת בעלי חיים',
          titleEn: 'Traffic Laws and Pet Transport',
          contentHe: 'על פי חוק ישראלי:\n• חיה חייבת להיות בכלוב או רתומה\n• אסור להשאיר חיה לבד ברכב\n• חובת מזגן פעיל\n• עצירות להפסקה כל שעה לנסיעות ארוכות',
          contentEn: 'Under Israeli law:\n• Pet must be caged or harnessed\n• Never leave pet alone in vehicle\n• A/C must be active\n• Stops every hour for long trips',
        },
      ],
    },
    quiz: {
      questions: [
        {
          id: 'trek-001-q1',
          questionHe: 'כמה זמן מותר להשאיר חיה לבד ברכב?',
          questionEn: 'How long can a pet be left alone in a vehicle?',
          options: [
            { id: 'a', textHe: '5 דקות', textEn: '5 minutes', isCorrect: false },
            { id: 'b', textHe: '10 דקות', textEn: '10 minutes', isCorrect: false },
            { id: 'c', textHe: 'אסור בכלל', textEn: 'Never allowed', isCorrect: true },
            { id: 'd', textHe: 'עד שעה', textEn: 'Up to an hour', isCorrect: false },
          ],
        },
        {
          id: 'trek-001-q2',
          questionHe: 'מה חובה בנסיעות ארוכות?',
          questionEn: 'What is required for long trips?',
          options: [
            { id: 'a', textHe: 'עצירות להפסקה כל שעה', textEn: 'Stops every hour', isCorrect: true },
            { id: 'b', textHe: 'עצירות כל 3 שעות', textEn: 'Stops every 3 hours', isCorrect: false },
            { id: 'c', textHe: 'אין צורך בעצירות', textEn: 'No stops needed', isCorrect: false },
            { id: 'd', textHe: 'עצירה אחת באמצע', textEn: 'One stop in the middle', isCorrect: false },
          ],
        },
      ],
      passingScore: 100,
      maxAttempts: 3,
    },
  },
];

class ProviderTrainingService {
  
  /**
   * Get all training modules for a platform
   */
  async getModulesForPlatform(platform: TrainingPlatform): Promise<TrainingModuleContent[]> {
    // Always include general modules + platform-specific
    return TRAINING_MODULES.filter(
      m => m.platform === 'general' || m.platform === platform
    );
  }

  /**
   * Get a specific training module
   */
  async getModule(moduleId: string): Promise<TrainingModuleContent | null> {
    return TRAINING_MODULES.find(m => m.id === moduleId) || null;
  }

  /**
   * Get provider's training progress
   */
  async getProviderProgress(providerId: string, platform: TrainingPlatform): Promise<{
    completedModules: string[];
    passedQuizzes: string[];
    certificateId: string | null;
    isFullyTrained: boolean;
    totalModules: number;
    completedCount: number;
  }> {
    try {
      const progress = await db
        .select()
        .from(providerTrainingProgress)
        .where(
          and(
            eq(providerTrainingProgress.providerId, providerId),
            eq(providerTrainingProgress.platform, platform)
          )
        );

      const quizResults = await db
        .select()
        .from(providerTrainingQuizResults)
        .where(
          and(
            eq(providerTrainingQuizResults.providerId, providerId),
            eq(providerTrainingQuizResults.passed, true)
          )
        );

      const certificate = await db
        .select()
        .from(providerCertificates)
        .where(
          and(
            eq(providerCertificates.providerId, providerId),
            eq(providerCertificates.platform, platform),
            eq(providerCertificates.status, 'active')
          )
        )
        .limit(1);

      const requiredModules = TRAINING_MODULES.filter(
        m => (m.platform === 'general' || m.platform === platform) && m.requiredForCertification
      );

      const completedModules = progress
        .filter(p => p.completed)
        .map(p => p.moduleId);

      const passedQuizzes = quizResults.map(q => q.moduleId);

      const isFullyTrained = requiredModules.every(
        m => completedModules.includes(m.id) && passedQuizzes.includes(m.id)
      );

      return {
        completedModules,
        passedQuizzes,
        certificateId: certificate[0]?.certificateId || null,
        isFullyTrained,
        totalModules: requiredModules.length,
        completedCount: completedModules.length,
      };
    } catch (error) {
      logger.error('[ProviderTraining] Error getting progress', error, { providerId });
      throw error;
    }
  }

  /**
   * Mark a module as watched/completed
   */
  async markModuleCompleted(
    providerId: string, 
    moduleId: string, 
    platform: TrainingPlatform
  ): Promise<boolean> {
    try {
      const module = await this.getModule(moduleId);
      if (!module) {
        throw new Error('Module not found');
      }

      // Check if already completed
      const existing = await db
        .select()
        .from(providerTrainingProgress)
        .where(
          and(
            eq(providerTrainingProgress.providerId, providerId),
            eq(providerTrainingProgress.moduleId, moduleId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(providerTrainingProgress)
          .set({
            completed: true,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(providerTrainingProgress.id, existing[0].id));
      } else {
        // Create new record
        const progressData: InsertProviderTrainingProgress = {
          providerId,
          moduleId,
          platform,
          completed: true,
          completedAt: new Date(),
        };

        await db.insert(providerTrainingProgress).values(progressData);
      }

      logger.info('[ProviderTraining] Module completed', { providerId, moduleId });
      return true;
    } catch (error) {
      logger.error('[ProviderTraining] Error marking module complete', error);
      throw error;
    }
  }

  /**
   * Submit quiz answers and grade
   */
  async submitQuiz(
    providerId: string,
    submission: QuizSubmission
  ): Promise<QuizResult> {
    try {
      const module = await this.getModule(submission.moduleId);
      if (!module) {
        throw new Error('Module not found');
      }

      // Check attempt count
      const previousAttempts = await db
        .select()
        .from(providerTrainingQuizResults)
        .where(
          and(
            eq(providerTrainingQuizResults.providerId, providerId),
            eq(providerTrainingQuizResults.moduleId, submission.moduleId)
          )
        );

      if (previousAttempts.length >= module.quiz.maxAttempts) {
        throw new Error(`Maximum attempts (${module.quiz.maxAttempts}) reached. Please contact support.`);
      }

      // Grade the quiz
      const questions = module.quiz.questions;
      let correctAnswers = 0;
      const incorrectQuestions: QuizResult['incorrectQuestions'] = [];

      for (const question of questions) {
        const answer = submission.answers.find(a => a.questionId === question.id);
        const correctOption = question.options.find(o => o.isCorrect);

        if (answer && correctOption && answer.selectedOptionId === correctOption.id) {
          correctAnswers++;
        } else if (correctOption) {
          incorrectQuestions.push({
            questionId: question.id,
            correctOptionId: correctOption.id,
            selectedOptionId: answer?.selectedOptionId || '',
            explanationHe: question.explanation?.he,
            explanationEn: question.explanation?.en,
          });
        }
      }

      const score = Math.round((correctAnswers / questions.length) * 100);
      const passed = score >= module.quiz.passingScore;

      // Save result
      const quizResultData: InsertProviderTrainingQuizResult = {
        providerId,
        moduleId: submission.moduleId,
        score,
        passed,
        answers: submission.answers,
        incorrectQuestions,
        attemptNumber: previousAttempts.length + 1,
      };

      await db.insert(providerTrainingQuizResults).values(quizResultData);

      logger.info('[ProviderTraining] Quiz submitted', {
        providerId,
        moduleId: submission.moduleId,
        score,
        passed,
        attempt: previousAttempts.length + 1,
      });

      return {
        passed,
        score,
        totalQuestions: questions.length,
        correctAnswers,
        incorrectQuestions,
      };
    } catch (error) {
      logger.error('[ProviderTraining] Error submitting quiz', error);
      throw error;
    }
  }

  /**
   * Generate certificate when all training completed
   */
  async generateCertificate(
    providerId: string,
    platform: TrainingPlatform,
    providerName: string
  ): Promise<{
    certificateId: string;
    pdfUrl: string;
    qrCode: string;
    expiresAt: Date;
  }> {
    try {
      // Verify all training is complete
      const progress = await this.getProviderProgress(providerId, platform);
      
      if (!progress.isFullyTrained) {
        throw new Error('Training not complete. Please complete all modules and quizzes.');
      }

      // Check if certificate already exists
      if (progress.certificateId) {
        throw new Error('Certificate already exists');
      }

      // Generate unique certificate ID
      const certificateId = `CERT-${platform.toUpperCase()}-${nanoid(8)}`;
      
      // Generate verification hash
      const verificationHash = crypto
        .createHash('sha256')
        .update(`${certificateId}-${providerId}-${Date.now()}`)
        .digest('hex')
        .substring(0, 16);

      // Certificate valid for 2 years
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 2);

      // Platform names in Hebrew
      const platformNames: Record<TrainingPlatform, { he: string; en: string }> = {
        general: { he: 'כללי', en: 'General' },
        sitter_suite: { he: '⁦The Sitter Suite™⁩', en: '⁦The Sitter Suite™⁩' },
        walk_my_pet: { he: '⁦Walk My Pet™⁩', en: '⁦Walk My Pet™⁩' },
        pettrek: { he: '⁦PetTrek™⁩', en: '⁦PetTrek™⁩' },
        k9000: { he: '⁦K9000™⁩', en: '⁦K9000™⁩' },
      };

      // Save certificate record
      const certData: InsertProviderCertificate = {
        certificateId,
        providerId,
        platform,
        providerName,
        issuedAt: new Date(),
        expiresAt,
        verificationHash,
        verificationUrl: `https://petwash.com/verify/${certificateId}`,
        status: 'active',
      };

      await db.insert(providerCertificates).values(certData);

      logger.info('[ProviderTraining] Certificate generated', {
        certificateId,
        providerId,
        platform,
        expiresAt,
      });

      // In production, generate actual PDF and QR code
      // For now, return placeholder URLs
      return {
        certificateId,
        pdfUrl: `/api/provider-training/certificate/${certificateId}/pdf`,
        qrCode: `/api/provider-training/certificate/${certificateId}/qr`,
        expiresAt,
      };
    } catch (error) {
      logger.error('[ProviderTraining] Error generating certificate', error);
      throw error;
    }
  }

  /**
   * Verify a certificate is valid
   */
  async verifyCertificate(certificateId: string): Promise<{
    valid: boolean;
    certificate?: {
      providerName: string;
      platform: string;
      issuedAt: Date;
      expiresAt: Date | null;
      status: string;
    };
    reason?: string;
  }> {
    try {
      const [cert] = await db
        .select()
        .from(providerCertificates)
        .where(eq(providerCertificates.certificateId, certificateId))
        .limit(1);

      if (!cert) {
        return { valid: false, reason: 'Certificate not found' };
      }

      if (cert.status !== 'active') {
        return { valid: false, reason: `Certificate status: ${cert.status}` };
      }

      if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) {
        return { valid: false, reason: 'Certificate expired' };
      }

      return {
        valid: true,
        certificate: {
          providerName: cert.providerName,
          platform: cert.platform,
          issuedAt: cert.issuedAt!,
          expiresAt: cert.expiresAt,
          status: cert.status,
        },
      };
    } catch (error) {
      logger.error('[ProviderTraining] Error verifying certificate', error);
      throw error;
    }
  }
}

export const providerTrainingService = new ProviderTrainingService();
