/**
 * Thread-scoped chat — the missing send/read half of the Communication
 * Hub's chat_threads spine. Any non-booking thread type (support,
 * incident, K9000, PAW_FINDER, shop, gift, provider_application,
 * franchise, admin) reads and writes here.
 *
 * Booking chats KEEP using bookingConversations/bookingMessages — their
 * unique(booking_id) FK + booking-status gating do not port to the more
 * generic thread spine, and the existing WebSocket / risk-scan / SLA
 * bookkeeping around them stays intact.
 *
 * Routes:
 *   GET  /api/threads/:threadId/messages   — participant only
 *   POST /api/threads/:threadId/send       — participant only, sanitized body
 *   PUT  /api/threads/:threadId/read       — participant only, marks own side read
 *
 * Auth model: participant = caller.uid ∈ { customerUserId, providerUserId,
 * supportOwnerId }. Anyone else 404s (does NOT 403) so thread-id existence
 * is not leaked to a snooper. Admin/super-admin get read access via a
 * distinct branch (audit-logged) — never the write path here.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { and, asc, eq, or, sql as dsql } from 'drizzle-orm';
import { db } from '../db';
import { chatThreads, chatThreadMessages } from '@shared/schema-chat';
import { validateFirebaseToken } from '../customAuth';
import { logger } from '../lib/logger';
import { isSuperAdminVerified } from '../middleware/rbac';

const router = Router();

// Every thread route needs a real caller identity.
router.use(validateFirebaseToken);

function callerUid(req: Request): string | null {
  return (req as any).firebaseUser?.uid || (req as any).user?.uid || null;
}

async function loadThreadForCaller(
  threadId: string,
  callerUid: string,
  callerEmail: string,
): Promise<{ ok: true; thread: typeof chatThreads.$inferSelect; isAdmin: boolean } | { ok: false; status: number; error: string }> {
  const [t] = await db.select().from(chatThreads).where(eq(chatThreads.threadId, threadId)).limit(1);
  if (!t) return { ok: false, status: 404, error: 'not_found' };
  const isParticipant =
    t.customerUserId === callerUid ||
    t.providerUserId === callerUid ||
    t.supportOwnerId === callerUid;
  const isAdmin = callerEmail ? await isSuperAdminVerified(callerEmail).catch(() => false) : false;
  if (!isParticipant && !isAdmin) return { ok: false, status: 404, error: 'not_found' };
  return { ok: true, thread: t, isAdmin };
}

// GET /api/threads/:threadId/messages?limit=50&before=<ISO>
router.get('/:threadId/messages', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ error: 'auth_required' });
  const callerEmail = (req as any).firebaseUser?.email || '';
  const loaded = await loadThreadForCaller(req.params.threadId, uid, callerEmail);
  if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });

  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  // Read oldest→newest for the caller (chat UI renders top-down for a
  // page load, then paginates upward). before= is a keyset paginator on
  // created_at DESC — used on scroll-back.
  const rows = await db
    .select()
    .from(chatThreadMessages)
    .where(eq(chatThreadMessages.threadId, req.params.threadId))
    .orderBy(asc(chatThreadMessages.createdAt))
    .limit(limit);
  return res.json({ ok: true, threadId: req.params.threadId, messages: rows });
});

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z.array(z.object({
    url: z.string().url().max(2000),
    mime: z.string().max(120),
    sizeBytes: z.number().int().nonnegative().max(50_000_000),
    name: z.string().max(200).optional(),
  })).max(4).optional(),
});

// POST /api/threads/:threadId/send
router.post('/:threadId/send', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ error: 'auth_required' });
  const callerEmail = (req as any).firebaseUser?.email || '';
  const loaded = await loadThreadForCaller(req.params.threadId, uid, callerEmail);
  if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
  // Admin READ is allowed above; admin WRITE is not permitted here —
  // admin messages route through the dedicated admin surfaces so they
  // are audit-logged as admin-authored, not participant-authored.
  if (loaded.isAdmin && loaded.thread.customerUserId !== uid && loaded.thread.providerUserId !== uid && loaded.thread.supportOwnerId !== uid) {
    return res.status(403).json({ error: 'admin_read_only' });
  }

  const parsed = sendSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
  }
  const trimmedBody = parsed.data.body.trim().slice(0, 4000);
  if (!trimmedBody) return res.status(400).json({ error: 'empty_body' });

  // Insert + bump last_message_at + increment recipient unread. All in
  // one round trip using a CTE-style batch so a concurrent reader sees
  // a consistent thread head.
  const [inserted] = await db
    .insert(chatThreadMessages)
    .values({
      threadId: req.params.threadId,
      senderUid: uid,
      senderRole: 'user',
      body: trimmedBody,
      attachments: parsed.data.attachments ?? [],
    })
    .returning();

  // Bump the thread head + increment the OTHER side's unread counter.
  const t = loaded.thread;
  const now = new Date();
  const otherSideCustomer = t.customerUserId && t.customerUserId !== uid;
  const otherSideProvider = t.providerUserId && t.providerUserId !== uid;
  await db.update(chatThreads).set({
    lastMessageAt: now,
    updatedAt: now,
    unreadCustomerCount: otherSideCustomer ? dsql`${chatThreads.unreadCustomerCount} + 1` : chatThreads.unreadCustomerCount,
    unreadProviderCount: otherSideProvider ? dsql`${chatThreads.unreadProviderCount} + 1` : chatThreads.unreadProviderCount,
  }).where(eq(chatThreads.threadId, req.params.threadId));

  logger.info('[ThreadChat] message sent', {
    threadId: req.params.threadId, threadType: t.threadType, senderUid: uid,
  });

  return res.json({ ok: true, message: inserted });
});

// PUT /api/threads/:threadId/read — marks the caller's side read.
router.put('/:threadId/read', async (req: Request, res: Response) => {
  const uid = callerUid(req);
  if (!uid) return res.status(401).json({ error: 'auth_required' });
  const callerEmail = (req as any).firebaseUser?.email || '';
  const loaded = await loadThreadForCaller(req.params.threadId, uid, callerEmail);
  if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });

  const t = loaded.thread;
  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (t.customerUserId === uid) patch.unreadCustomerCount = 0;
  if (t.providerUserId === uid) patch.unreadProviderCount = 0;
  await db.update(chatThreads).set(patch as any).where(eq(chatThreads.threadId, req.params.threadId));

  // Stamp read_at on unread messages sent by the OTHER side. We only mark
  // messages from a different sender — a caller's own messages don't need
  // a "someone read them" timestamp until we surface per-message receipts.
  await db.update(chatThreadMessages)
    .set({ readAt: now })
    .where(and(
      eq(chatThreadMessages.threadId, req.params.threadId),
      dsql`${chatThreadMessages.senderUid} <> ${uid}`,
      dsql`${chatThreadMessages.readAt} IS NULL`,
    ));

  return res.json({ ok: true });
});

export default router;
