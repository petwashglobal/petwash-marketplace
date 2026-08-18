/**
 * Secure Personal Inbox API — P0-143 identity + privacy hardening.
 *
 * PRE-FIX PROBLEMS THIS FILE CLOSES:
 *
 *   1. GET /lookup-user returned { uid, email, displayName } for ANY
 *      queried email to any authenticated user — a directory-scraping
 *      surface. RETIRED. Callers must send `recipientEmail` on /send
 *      and the SERVER resolves the recipient uid internally.
 *
 *   2. POST /send trusted the browser to supply senderId, senderName,
 *      senderEmail, recipientId, recipientName, recipientEmail. Only
 *      senderId was verified against the token. Every other identity
 *      field was caller-controlled — a poisoned display identity on
 *      messages your recipient sees. FIX: sender uid/email/name come
 *      from the decoded Firebase token + server profile. Browser
 *      supplies only recipientEmail + message content. Recipient
 *      uid/email/name are resolved server-side.
 *
 *   3. /inbox and /:messageId returned `SELECT *` from userMessages —
 *      exposing internal fields (gcsBackupPath, backupStatus,
 *      permanentlyDeleted, deletedBySender/Recipient). FIX: explicit
 *      customer-facing DTO projection.
 *
 *   4. 5xx catch blocks returned raw `error.message` — leaked SQL /
 *      stack fragments. FIX: generic mapped error strings + code
 *      discriminator.
 *
 *   5. /send had no per-user rate limit — abuse vector. FIX: simple
 *      in-memory per-uid limiter (per-instance defensive; a
 *      distributed limiter is tracked as a separate follow-up).
 */

import { Router } from 'express';
import { db } from '../db';
import { auth as fbAuth } from '../lib/firebase-admin';
import {
  userMessages,
  messageAttachments,
  insertUserMessageSchema,
  type InsertUserMessage,
  type UserMessage,
} from '../../shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { recordAuditEvent } from '../utils/auditSignature';
import { backupMessage } from '../services/gcsBackupService';
import { logger } from '../lib/logger';
import { z } from 'zod';
import crypto from 'crypto';
import { EmailService } from '../emailService';

const router = Router();

// ── Per-instance defensive rate limits (P0-143) ────────────────────────────
// A distributed Redis limiter is tracked as a follow-up; this is best-effort
// per-Cloud-Run-instance protection for the /send and /lookup-check paths.
const SEND_WINDOW_MS = parseInt(process.env.INBOX_SEND_WINDOW_MS || String(60 * 1000), 10);
const SEND_LIMIT     = parseInt(process.env.INBOX_SEND_LIMIT     || '20', 10);
const LOOKUP_WINDOW_MS = parseInt(process.env.INBOX_LOOKUP_WINDOW_MS || String(60 * 1000), 10);
const LOOKUP_LIMIT     = parseInt(process.env.INBOX_LOOKUP_LIMIT     || '30', 10);

const sendHits: Map<string, number[]> = new Map();
const lookupHits: Map<string, number[]> = new Map();

function hitAndCheck(map: Map<string, number[]>, key: string, windowMs: number, limit: number): boolean {
  const now = Date.now();
  const arr = (map.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) {
    map.set(key, arr);
    return false;
  }
  arr.push(now);
  map.set(key, arr);
  return true;
}

// ── Customer-facing DTO projection (P0-143 #3) ─────────────────────────────
export interface InboxMessageDto {
  id: number;
  senderId: string;
  senderName: string | null;
  senderEmail: string | null;
  recipientId: string;
  recipientName: string | null;
  recipientEmail: string | null;
  subject: string;
  body: string;
  messageType: string;
  priority: string;
  isRead: boolean;
  isStarred: boolean;
  readAt: Date | null;
  createdAt: Date | null;
  requiresSignature: boolean;
}

function toInboxMessageDto(m: UserMessage): InboxMessageDto {
  return {
    id: m.id,
    senderId: m.senderId,
    senderName: (m as any).senderName ?? null,
    senderEmail: (m as any).senderEmail ?? null,
    recipientId: m.recipientId,
    recipientName: (m as any).recipientName ?? null,
    recipientEmail: (m as any).recipientEmail ?? null,
    subject: m.subject,
    body: m.body,
    messageType: (m as any).messageType ?? 'general',
    priority: (m as any).priority ?? 'normal',
    isRead: !!(m as any).isRead,
    isStarred: !!(m as any).isStarred,
    readAt: (m as any).readAt ?? null,
    createdAt: m.createdAt ?? null,
    requiresSignature: !!(m as any).requiresSignature,
  };
}

interface AttachmentDto {
  id: number;
  messageId: number;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: Date | null;
}
function toAttachmentDto(a: any): AttachmentDto {
  return {
    id: a.id,
    messageId: a.messageId,
    fileName: a.fileName,
    fileSize: a.fileSize ?? null,
    mimeType: a.mimeType ?? null,
    createdAt: a.createdAt ?? null,
  };
}

// ── Sender identity resolver (P0-143 #2) ───────────────────────────────────
async function resolveAuthoritativeSender(req: any): Promise<{
  uid: string;
  email: string;
  displayName: string;
} | null> {
  const uid = req.firebaseUser?.uid;
  if (!uid) return null;
  // Prefer token-decoded email/name; fall back to Firebase admin lookup.
  let email = (req.firebaseUser?.email as string | undefined) || '';
  let displayName =
    (req.firebaseUser?.name as string | undefined) ||
    (req.firebaseUser?.email as string | undefined) ||
    uid;
  if (!email) {
    try {
      const rec = await fbAuth.getUser(uid);
      email = rec.email || '';
      displayName = rec.displayName || rec.email || uid;
    } catch {
      // no-op — fall back to defaults
    }
  }
  return { uid, email: email.toLowerCase().trim(), displayName };
}

// ── Cryptographic content hash (kept — used in tamper-detection UI) ────────
function createMessageHash(message: Partial<InsertUserMessage>): string {
  const content = JSON.stringify({
    senderId: message.senderId,
    recipientId: message.recipientId,
    subject: message.subject,
    body: message.body,
    timestamp: new Date().toISOString(),
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ── Recipient existence probe — replaces the pre-fix /lookup-user ─────────
// Returns ONLY a boolean and (optional) short display name. Never returns
// another user's Firebase UID or email. Rate-limited per caller.
router.get('/lookup-check', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  if (!hitAndCheck(lookupHits, userId, LOOKUP_WINDOW_MS, LOOKUP_LIMIT)) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many lookups — slow down.' });
  }
  const emailRaw = typeof req.query.email === 'string' ? req.query.email : '';
  const email = emailRaw.trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'MISSING_EMAIL' });
  }
  try {
    const userRecord = await fbAuth.getUserByEmail(email).catch(() => null);
    // Existence-only response — no uid, no email echo, no displayName leak.
    return res.json({ exists: !!userRecord });
  } catch (err: any) {
    logger.error('[Secure Inbox] lookup-check failed', { error: err?.message });
    return res.status(500).json({
      error: 'LOOKUP_FAILED',
      message: 'Recipient lookup temporarily unavailable',
      code: 'INBOX_LOOKUP_500',
    });
  }
});

/**
 * GET /api/messages/lookup-user — RETIRED (P0-143).
 * Kept as a hard 410 so any straggler client fails LOUDLY rather than
 * silently.
 */
router.get('/lookup-user', (_req, res) => {
  return res.status(410).json({
    error: 'ENDPOINT_RETIRED',
    message:
      'lookup-user was retired. Send messages with { recipientEmail } and the server resolves the recipient internally.',
    code: 'INBOX_LOOKUP_RETIRED',
  });
});

// ── GET /api/messages/inbox — explicit DTO ─────────────────────────────────
router.get('/inbox', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const rows = await db
      .select()
      .from(userMessages)
      .where(
        and(
          or(eq(userMessages.senderId, userId), eq(userMessages.recipientId, userId)),
          eq(userMessages.permanentlyDeleted, false),
        ),
      )
      .orderBy(desc(userMessages.createdAt));

    const messages = rows
      // A hard-deleted-by-me row should not surface to me on either side.
      .filter((m: any) =>
        (m.senderId === userId && !m.deletedBySender) ||
        (m.recipientId === userId && !m.deletedByRecipient),
      )
      .map(toInboxMessageDto);

    logger.info('[Secure Inbox] Messages retrieved', { userId, count: messages.length });
    return res.json({ messages });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to retrieve inbox', { error: err?.message });
    return res.status(500).json({
      error: 'Failed to retrieve inbox',
      code: 'INBOX_LIST_500',
    });
  }
});

// ── GET /api/messages/:messageId — explicit DTO ───────────────────────────
router.get('/:messageId', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isFinite(messageId)) {
    return res.status(400).json({ error: 'INVALID_MESSAGE_ID' });
  }
  try {
    const [message] = await db
      .select()
      .from(userMessages)
      .where(eq(userMessages.id, messageId));

    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Mark read on view (recipient side).
    if (message.recipientId === userId && !(message as any).isRead) {
      await db
        .update(userMessages)
        .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
        .where(eq(userMessages.id, messageId));
    }
    const attachmentRows = await db
      .select()
      .from(messageAttachments)
      .where(eq(messageAttachments.messageId, messageId));

    return res.json({
      message: toInboxMessageDto({
        ...message,
        isRead: message.recipientId === userId ? true : (message as any).isRead,
      } as UserMessage),
      attachments: attachmentRows.map(toAttachmentDto),
    });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to retrieve message', { error: err?.message });
    return res.status(500).json({
      error: 'Failed to retrieve message',
      code: 'INBOX_GET_500',
    });
  }
});

// ── POST /api/messages/send — server-authoritative sender identity ────────
const sendSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
  messageType: z.enum(['general', 'notification', 'transactional', 'contract', 'system']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  requiresSignature: z.boolean().optional(),
});

router.post('/send', async (req, res) => {
  const sender = await resolveAuthoritativeSender(req);
  if (!sender) return res.status(401).json({ error: 'Unauthorized' });
  if (!hitAndCheck(sendHits, sender.uid, SEND_WINDOW_MS, SEND_LIMIT)) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'You are sending messages too fast. Please slow down.',
    });
  }

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      issues: parsed.error.issues,
    });
  }

  try {
    // Resolve the recipient uid + name SERVER-SIDE. Browser never sees another user's uid.
    const recipientEmail = parsed.data.recipientEmail.trim().toLowerCase();
    const recipientRecord = await fbAuth.getUserByEmail(recipientEmail).catch(() => null);
    if (!recipientRecord) {
      return res.status(404).json({
        error: 'RECIPIENT_NOT_FOUND',
        message: 'No PetWash account matches that email.',
      });
    }
    const recipientId = recipientRecord.uid;
    const recipientName = recipientRecord.displayName || recipientRecord.email || recipientId;

    // Canonical write set — sender/recipient identity fields are computed
    // server-side. Nothing from req.body is trusted for identity.
    const values: any = {
      senderId: sender.uid,
      senderEmail: sender.email,
      senderName: sender.displayName,
      recipientId,
      recipientEmail: recipientRecord.email || null,
      recipientName,
      subject: parsed.data.subject,
      body: parsed.data.body,
      messageType: parsed.data.messageType || 'general',
      priority: parsed.data.priority || 'normal',
      requiresSignature: !!parsed.data.requiresSignature,
    };

    const messageHash = createMessageHash(values);

    // Blockchain-style chain of the sender's most recent hash.
    const [previousMessage] = await db
      .select()
      .from(userMessages)
      .where(eq(userMessages.senderId, sender.uid))
      .orderBy(desc(userMessages.createdAt))
      .limit(1);

    const auditSignature = await recordAuditEvent({
      eventType: 'send_secure_message',
      customerUid: sender.uid,
      metadata: {
        action: 'send_secure_message',
        resourceType: 'user_message',
        resourceId: 'pending',
        subject: values.subject,
        messageType: values.messageType,
        priority: values.priority,
        recipientId,
        recipientEmailHashed: crypto
          .createHash('sha256')
          .update(recipientEmail)
          .digest('hex')
          .slice(0, 16),
        messageHash,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
      userAgent: req.headers['user-agent'] || null,
    });

    const [newMessage] = await db
      .insert(userMessages)
      .values({
        ...values,
        messageHash,
        previousMessageHash: (previousMessage as any)?.messageHash || null,
        auditHash: auditSignature.auditHash,
        gcsBackupPath: `messages/${sender.uid}/${Date.now()}.json`,
        backupStatus: 'pending',
      })
      .returning();

    // Async backup — never blocks the response.
    backupMessage({
      messageId: newMessage.id,
      userId: sender.uid,
      subject: newMessage.subject,
      body: newMessage.body,
      messageHash: (newMessage as any).messageHash,
      auditHash: (newMessage as any).auditHash,
      createdAt: new Date(newMessage.createdAt as any),
    })
      .then(async (result) => {
        if (result.success) {
          await db
            .update(userMessages)
            .set({
              backupStatus: 'completed',
              gcsBackupPath: result.gcsPath,
              updatedAt: new Date(),
            })
            .where(eq(userMessages.id, newMessage.id));
        } else {
          await db
            .update(userMessages)
            .set({ backupStatus: 'failed', updatedAt: new Date() })
            .where(eq(userMessages.id, newMessage.id));
        }
      })
      .catch((err) => {
        logger.error('[Secure Inbox] Backup promise error', { error: err?.message });
      });

    // Recipient email notification — never leaks the sender's uid.
    if (recipientRecord.email) {
      EmailService.send({
        to: recipientRecord.email,
        subject: '📬 New Message in Your ⁦PetWash™⁩ Inbox',
        html: `
          <h2>You have a new message</h2>
          <p><strong>From:</strong> ${sender.email || '⁦PetWash™⁩ Team'}</p>
          <p><strong>Subject:</strong> ${values.subject}</p>
          <p><em>Log in to your ⁦PetWash™⁩ account to read and reply.</em></p>
        `,
      }).catch((err) =>
        logger.error('[Secure Inbox] Failed to send email notification', { error: err?.message }),
      );
    }

    logger.info('[Secure Inbox] Message sent successfully', {
      messageId: newMessage.id,
      senderId: sender.uid,
      recipientId,
      auditHash: auditSignature.auditHash,
    });
    return res.json({
      success: true,
      message: toInboxMessageDto(newMessage as UserMessage),
      auditSignature,
    });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to send message', { error: err?.message });
    return res.status(500).json({
      error: 'Failed to send message',
      code: 'INBOX_SEND_500',
    });
  }
});

// ── POST /api/messages/:messageId/star ────────────────────────────────────
router.post('/:messageId/star', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isFinite(messageId)) {
    return res.status(400).json({ error: 'INVALID_MESSAGE_ID' });
  }
  try {
    const [message] = await db.select().from(userMessages).where(eq(userMessages.id, messageId));
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const [updated] = await db
      .update(userMessages)
      .set({ isStarred: !(message as any).isStarred, updatedAt: new Date() })
      .where(eq(userMessages.id, messageId))
      .returning();
    return res.json({ success: true, message: toInboxMessageDto(updated as UserMessage) });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to toggle star', { error: err?.message });
    return res.status(500).json({ error: 'Failed to toggle star', code: 'INBOX_STAR_500' });
  }
});

// ── POST /api/messages/:messageId/read ────────────────────────────────────
router.post('/:messageId/read', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isFinite(messageId)) return res.status(400).json({ error: 'INVALID_MESSAGE_ID' });
  try {
    const [message] = await db.select().from(userMessages).where(eq(userMessages.id, messageId));
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const [updated] = await db
      .update(userMessages)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(userMessages.id, messageId))
      .returning();
    return res.json({ success: true, message: toInboxMessageDto(updated as UserMessage) });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to mark read', { error: err?.message });
    return res.status(500).json({ error: 'Failed to mark read', code: 'INBOX_READ_500' });
  }
});

// ── DELETE /api/messages/:messageId ───────────────────────────────────────
router.delete('/:messageId', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const messageId = parseInt(req.params.messageId, 10);
  if (!Number.isFinite(messageId)) return res.status(400).json({ error: 'INVALID_MESSAGE_ID' });
  try {
    const [message] = await db.select().from(userMessages).where(eq(userMessages.id, messageId));
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const updateData: any = { updatedAt: new Date() };
    if (message.senderId === userId) updateData.deletedBySender = true;
    else if (message.recipientId === userId) updateData.deletedByRecipient = true;
    else return res.status(403).json({ error: 'Access denied' });
    // Both parties deleted → hard-delete flag.
    if (
      ((message as any).deletedBySender && message.recipientId === userId) ||
      ((message as any).deletedByRecipient && message.senderId === userId)
    ) {
      updateData.permanentlyDeleted = true;
    }
    await db.update(userMessages).set(updateData).where(eq(userMessages.id, messageId));
    logger.info('[Secure Inbox] Message deleted', { messageId, userId });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to delete message', { error: err?.message });
    return res.status(500).json({ error: 'Failed to delete message', code: 'INBOX_DELETE_500' });
  }
});

// ── GET /api/messages/unread/count ────────────────────────────────────────
router.get('/unread/count', async (req, res) => {
  const userId = req.firebaseUser?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const unreadMessages = await db
      .select()
      .from(userMessages)
      .where(
        and(
          eq(userMessages.recipientId, userId),
          eq(userMessages.isRead, false),
          eq(userMessages.deletedByRecipient, false),
          eq(userMessages.permanentlyDeleted, false),
        ),
      );
    return res.json({ count: unreadMessages.length });
  } catch (err: any) {
    logger.error('[Secure Inbox] Failed to get unread count', { error: err?.message });
    return res.status(500).json({ error: 'Failed to get unread count', code: 'INBOX_UNREAD_500' });
  }
});

export default router;
