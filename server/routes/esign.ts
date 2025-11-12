import { Router } from 'express';
import { docuSealService } from '../services/DocuSealService';
import { requireAuth } from '../customAuth';
import { db } from '../db';
import { signingSessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

/**
 * FREE E-SIGNATURE: Create Signing Session (DocuSeal)
 * Supports Hebrew, Arabic, and 14 languages
 * Works in mobile browsers (iOS/Android)
 * 
 * Request Body:
 * {
 *   "documentType": "waiver",
 *   "templateSlug": "pet-wash-waiver-2025",
 *   "signerEmail": "customer@example.com",
 *   "signerName": "ישראל ישראלי",
 *   "language": "he",
 *   "sendEmail": true
 * }
 * 
 * Response:
 * {
 *   "sessionId": 123,
 *   "submissionId": "abc123",
 *   "signingUrl": "https://app.docuseal.com/s/...",
 *   "embedCode": "<docuseal-form.../>",
 *   "status": "pending"
 * }
 */
router.post('/api/esign/create-session', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const {
      documentType,
      templateSlug,
      signerEmail,
      signerName,
      language,
      sendEmail
    } = req.body;

    // Validate required fields
    if (!documentType || !templateSlug || !signerEmail || !signerName) {
      return res.status(400).json({
        error: 'Missing required fields: documentType, templateSlug, signerEmail, signerName'
      });
    }

    // Create DocuSeal submission
    const submission = await docuSealService.createSubmission({
      templateSlug,
      signerEmail,
      signerName,
      language: language || 'he', // Default to Hebrew
      sendEmail: sendEmail !== false,
      expiresIn: 30, // 30 days
      metadata: {
        userId,
        documentType,
        platform: 'PetWash'
      }
    });

    // Get signing URL for mobile
    const signingUrl = docuSealService.getSigningUrl(submission, language);
    const embedCode = docuSealService.getEmbedCode(submission, language);

    // Save to database
    const [session] = await db.insert(signingSessions).values({
      userId,
      submissionId: submission.id,
      templateSlug,
      documentType,
      documentName: `Pet Wash™ ${documentType}`,
      language: language || 'he',
      status: submission.status,
      signerEmail,
      signerName,
      signingUrl,
      embedCode,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).returning();

    logger.info('[E-Sign] ✅ Signing session created:', {
      userId,
      submissionId: submission.id,
      language: language || 'he',
      documentType
    });

    res.json({
      success: true,
      sessionId: session.id,
      submissionId: submission.id,
      signingUrl,
      embedCode,
      status: submission.status,
      language: language || 'he',
      message: 'Signing session created successfully'
    });

  } catch (error: any) {
    logger.error('[E-Sign] ❌ Failed to create signing session:', error);
    res.status(500).json({
      error: 'Failed to create signing session',
      message: error.message
    });
  }
});

/**
 * Get signing session status
 */
router.get('/api/esign/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.uid;

    // Get from database
    const session = await db.query.signingSessions.findFirst({
      where: eq(signingSessions.id, parseInt(sessionId))
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get latest status from DocuSeal
    if (session.submissionId) {
      try {
        const submission = await docuSealService.getSubmission(session.submissionId);
        
        // Update database
        await db.update(signingSessions)
          .set({
            status: submission.status,
            openedAt: submission.submitters[0].status === 'opened' ? new Date() : session.openedAt,
            signedAt: submission.submitters[0].status === 'completed' ? new Date() : session.signedAt,
            completedAt: submission.status === 'completed' ? new Date() : session.completedAt,
            signedDocumentUrl: submission.documents[0]?.url || session.signedDocumentUrl,
            updatedAt: new Date()
          })
          .where(eq(signingSessions.id, parseInt(sessionId)));

        return res.json({
          success: true,
          session: {
            ...session,
            status: submission.status,
            signedDocumentUrl: submission.documents[0]?.url
          }
        });
      } catch (error) {
        logger.warn('[E-Sign] Could not fetch latest status from DocuSeal, returning cached data');
      }
    }

    res.json({
      success: true,
      session
    });

  } catch (error: any) {
    logger.error('[E-Sign] ❌ Failed to get session:', error);
    res.status(500).json({
      error: 'Failed to get session',
      message: error.message
    });
  }
});

/**
 * Get user's signing sessions
 */
router.get('/api/esign/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    const sessions = await db.query.signingSessions.findMany({
      where: eq(signingSessions.userId, userId),
      orderBy: (session, { desc }) => [desc(session.createdAt)]
    });

    res.json({
      success: true,
      sessions
    });

  } catch (error: any) {
    logger.error('[E-Sign] ❌ Failed to get sessions:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      message: error.message
    });
  }
});

/**
 * Webhook endpoint for DocuSeal events
 * Receives completion notifications
 */
router.post('/api/esign/webhook', async (req, res) => {
  try {
    const event = req.body;

    logger.info('[E-Sign Webhook] Received event:', {
      eventType: event.event_type,
      submissionId: event.data?.id
    });

    // Update session based on webhook event
    if (event.data?.id) {
      await db.update(signingSessions)
        .set({
          status: event.data.status,
          completedAt: event.event_type === 'submission.completed' ? new Date() : undefined,
          signedDocumentUrl: event.data.documents?.[0]?.url,
          updatedAt: new Date()
        })
        .where(eq(signingSessions.submissionId, event.data.id.toString()));
    }

    res.json({ received: true });

  } catch (error: any) {
    logger.error('[E-Sign Webhook] ❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
