import { Router } from 'express';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { users } from '@shared/schema';
import { accountDeletionRequests, accountDeletionAuditLog } from '@shared/schema-enterprise';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { createHash } from 'crypto';
import { z } from 'zod';

const router = Router();

const CONSENT_TEXT_HE = 'אני מאשר/ת בזאת כי אני מבקש/ת למחוק את חשבוני לצמיתות. אני מבין/ה שפעולה זו אינה ניתנת לביטול ושכל הנתונים האישיים שלי יימחקו בהתאם לחוק הגנת הפרטיות הישראלי 2025. Pet Wash™ תשמור רישומים חוקיים של בקשה זו למשך 90 יום.';
const CONSENT_TEXT_EN = 'I hereby confirm that I am requesting permanent deletion of my account. I understand this action is irreversible and all my personal data will be deleted in accordance with the Israeli Privacy Protection Law 2025. Pet Wash™ will retain legal records of this request for 90 days.';

function computeHash(data: object, previousHash?: string): string {
  const payload = JSON.stringify({ ...data, previousHash: previousHash || 'GENESIS' });
  return createHash('sha256').update(payload).digest('hex');
}

async function getLastAuditHash(requestId: string): Promise<string | null> {
  const [last] = await db
    .select({ contentHash: accountDeletionAuditLog.contentHash })
    .from(accountDeletionAuditLog)
    .where(eq(accountDeletionAuditLog.requestId, requestId))
    .orderBy(desc(accountDeletionAuditLog.createdAt))
    .limit(1);
  return last?.contentHash || null;
}

async function appendAuditLog(entry: {
  requestId: string;
  userId: string;
  action: string;
  details?: any;
  dataCategory?: string;
  recordsAffected?: number;
  performedBy: string;
  ipAddress?: string;
}) {
  const previousHash = await getLastAuditHash(entry.requestId);
  const contentHash = computeHash({
    ...entry,
    timestamp: new Date().toISOString(),
  }, previousHash || undefined);

  await db.insert(accountDeletionAuditLog).values({
    requestId: entry.requestId,
    userId: entry.userId,
    action: entry.action,
    details: entry.details || {},
    dataCategory: entry.dataCategory || null,
    recordsAffected: entry.recordsAffected || 0,
    performedBy: entry.performedBy,
    ipAddress: entry.ipAddress || null,
    contentHash,
    previousHash: previousHash || 'GENESIS',
    createdAt: new Date(),
  });

  return contentHash;
}

const deleteAccountSchema = z.object({
  reason: z.string().optional(),
  consentCheckbox: z.boolean().refine(val => val === true, 'You must check the consent box to delete your account'),
  language: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']).default('he'),
});

router.post('/request', requireAuth, async (req: any, res) => {
  try {
    const data = deleteAccountSchema.parse(req.body);
    const userEmail = req.user?.email || (req as any).firebaseUser?.email;
    const userId: string = (req as any).userId || req.user?.uid;

    if (!userEmail || !userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [existingPending] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
      .orderBy(desc(accountDeletionRequests.createdAt))
      .limit(1);

    if (existingPending && ['pending', 'processing'].includes(existingPending.status)) {
      return res.status(409).json({
        error: 'A deletion request is already pending',
        requestId: existingPending.requestId,
        status: existingPending.status,
        createdAt: existingPending.createdAt,
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const requestId = `DEL-${Date.now()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    const consentText = data.language === 'he' ? CONSENT_TEXT_HE : CONSENT_TEXT_EN;
    const consentTimestamp = new Date();
    const hardDeleteDate = new Date();
    hardDeleteDate.setDate(hardDeleteDate.getDate() + 90);

    const requestData = {
      requestId,
      userId,
      userEmail: user.email,
      userFullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      userPhone: user.phone || null,
      userCountry: user.country || 'IL',
      userLoyaltyTier: user.loyaltyTier || 'bronze',
      userRegisteredAt: user.createdAt,
      reason: data.reason || null,
      consentText,
      consentLanguage: data.language,
      consentCheckbox: true,
      consentTimestamp,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null,
      userAgent: req.headers['user-agent'] || null,
      status: 'pending',
      hardDeleteScheduledAt: hardDeleteDate,
      legalBasis: 'user_request',
      complianceLaw: 'Israeli Privacy Protection Law 2025',
      retentionPeriodDays: 90,
    };

    const contentHash = computeHash(requestData);

    const [record] = await db
      .insert(accountDeletionRequests)
      .values({
        ...requestData,
        contentHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await appendAuditLog({
      requestId,
      userId,
      action: 'deletion_requested',
      details: {
        reason: data.reason,
        consentLanguage: data.language,
        consentTimestamp: consentTimestamp.toISOString(),
        userEmail: user.email,
        hardDeleteScheduledAt: hardDeleteDate.toISOString(),
      },
      dataCategory: 'account',
      performedBy: `user:${userId}`,
      ipAddress: requestData.ipAddress || undefined,
    });

    logger.info('[Account Deletion] Request created', {
      requestId,
      userId,
      email: user.email,
      hardDeleteScheduledAt: hardDeleteDate.toISOString(),
      contentHash: contentHash.substring(0, 16) + '...',
    });

    res.json({
      success: true,
      message: data.language === 'he'
        ? 'בקשת מחיקת החשבון התקבלה. החשבון שלך יושבת וימחק לאחר 90 יום.'
        : 'Account deletion request received. Your account will be deactivated and deleted after 90 days.',
      requestId,
      status: 'pending',
      hardDeleteScheduledAt: hardDeleteDate.toISOString(),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('[Account Deletion] Failed to create request', { error: error.message });
    res.status(500).json({ error: 'Failed to process deletion request' });
  }
});

router.get('/status', requireAuth, async (req: any, res) => {
  try {
    const userId: string = (req as any).userId || req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [request] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
      .orderBy(desc(accountDeletionRequests.createdAt))
      .limit(1);

    if (!request) {
      return res.json({ hasPendingRequest: false });
    }

    const auditLog = await db
      .select()
      .from(accountDeletionAuditLog)
      .where(eq(accountDeletionAuditLog.requestId, request.requestId))
      .orderBy(desc(accountDeletionAuditLog.createdAt));

    res.json({
      hasPendingRequest: ['pending', 'processing'].includes(request.status),
      request: {
        requestId: request.requestId,
        status: request.status,
        reason: request.reason,
        consentTimestamp: request.consentTimestamp,
        hardDeleteScheduledAt: request.hardDeleteScheduledAt,
        createdAt: request.createdAt,
      },
      auditLog: auditLog.map(log => ({
        action: log.action,
        dataCategory: log.dataCategory,
        recordsAffected: log.recordsAffected,
        createdAt: log.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error('[Account Deletion] Failed to check status', { error: error.message });
    res.status(500).json({ error: 'Failed to check deletion status' });
  }
});

router.post('/cancel', requireAuth, async (req: any, res) => {
  try {
    const userId: string = (req as any).userId || req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [request] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, userId))
      .orderBy(desc(accountDeletionRequests.createdAt))
      .limit(1);

    if (!request || !['pending', 'processing'].includes(request.status)) {
      return res.status(404).json({ error: 'No active deletion request found' });
    }

    await db
      .update(accountDeletionRequests)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(accountDeletionRequests.id, request.id));

    await appendAuditLog({
      requestId: request.requestId,
      userId,
      action: 'deletion_cancelled',
      details: { cancelledAt: new Date().toISOString() },
      dataCategory: 'account',
      performedBy: `user:${userId}`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || undefined,
    });

    logger.info('[Account Deletion] Request cancelled', { requestId: request.requestId, userId });

    res.json({
      success: true,
      message: 'Account deletion request has been cancelled.',
      requestId: request.requestId,
    });
  } catch (error: any) {
    logger.error('[Account Deletion] Failed to cancel request', { error: error.message });
    res.status(500).json({ error: 'Failed to cancel deletion request' });
  }
});

router.get('/consent-text', (req, res) => {
  const language = (req.query.language as string) || 'he';
  res.json({
    consentText: language === 'he' ? CONSENT_TEXT_HE : CONSENT_TEXT_EN,
    language,
    complianceLaw: 'Israeli Privacy Protection Law 2025',
    retentionPeriodDays: 90,
  });
});

export default router;
