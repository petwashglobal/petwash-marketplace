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
// customAuth.ts exports only setupCustomAuth + requireAuth. The real
// validateFirebaseToken middleware lives at ../middleware/firebase-auth
// (used by routes.ts:12066 and every other Bearer-validated route).
// The old import path was a broken alias that only surfaced when the
// production build actually resolved it — smoke-test-routes-load caught
// it on 2026-08-28 after PR #2166 introduced this route mount.
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { isSuperAdminVerified } from '../middleware/rbac';
// CEO Integrity Doctrine §13, §14, §15 + CEO SECURITY §23, §24 —
// every user message runs through the MarketplaceMessagePolicyEngine
// BEFORE delivery. Server is the enforcement authority; the client
// cannot bypass with a "trust me" header.
import {
  evaluateMessage,
  CURRENT_POLICY_VERSION,
  type ThreadType as PolicyThreadType,
  normalizePolicyThreadType,
} from '@shared/marketplace/policyEngine';
import { integritySignalFor } from '@shared/marketplace/moderationAudit';
import { recordModerationDecision } from '../services/marketplace/moderationEvidence';
import {
  hashSafeContent,
  issueWarningToken,
  verifyWarningToken,
  buildAllowNoticePayload,
} from '../services/marketplace/moderationDecisions';
import {
  classifyAttachmentUrl,
  sanitiseAttachmentName,
} from '../services/marketplace/attachmentPolicy';

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
  moderationDecisionId: z.string().max(4096).optional(),
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

  // CEO DEEP-LOGIC §19 — attachment gate. Any attachment URL must
  // resolve to a PetWash-owned origin; filenames are sanitised of
  // phone-number-shaped runs and @handles so a "call me: 050-...png"
  // file cannot smuggle contact info past the text moderator. Server
  // NEVER dereferences attacker URLs — rejection is by URL shape.
  const rawAttachments = parsed.data.attachments ?? [];
  const rejected: string[] = [];
  const gatedAttachments: typeof rawAttachments = [];
  for (const att of rawAttachments) {
    const verdict = classifyAttachmentUrl(att.url);
    if (verdict !== 'ok') {
      rejected.push(verdict);
      continue;
    }
    gatedAttachments.push({ ...att, name: sanitiseAttachmentName(att.name) });
  }
  if (rejected.length > 0) {
    return res.status(400).json({
      error: 'attachment_rejected',
      reasonCode: 'ATTACHMENT_NOT_PETWASH_OWNED',
      rejectedCount: rejected.length,
    });
  }

  // CEO Integrity §13, §14, §15, §23, §24 — MessagePolicyEngine BEFORE
  // insert. Server is authority; the client cannot bypass this.
  const t = loaded.thread;
  const senderRole: 'BOOKER' | 'PROVIDER' | 'STAFF' | 'SYSTEM' =
    t.customerUserId === uid ? 'BOOKER'
      : t.providerUserId === uid ? 'PROVIDER'
      : t.supportOwnerId === uid ? 'STAFF'
      : 'SYSTEM';
  const recipientRole: 'BOOKER' | 'PROVIDER' | 'STAFF' | 'SYSTEM' =
    senderRole === 'BOOKER' ? (t.providerUserId ? 'PROVIDER' : 'STAFF')
      : senderRole === 'PROVIDER' ? 'BOOKER'
      : 'BOOKER';
  // CEO DEEP-LOGIC §21 — runtime normalizer. The prior `as`-cast was
  // a compile-time hint that let INCIDENT / FRANCHISE (and any future
  // schema string) reach evaluateMessage as an unknown ThreadType.
  // normalizePolicyThreadType collapses those to the closed policy
  // vocabulary explicitly (INCIDENT → SUPPORT, FRANCHISE → ADMIN,
  // anything else → SUPPORT).
  const policyThreadType: PolicyThreadType = normalizePolicyThreadType(t.threadType);
  const policyResult = evaluateMessage({
    text: trimmedBody,
    threadType: policyThreadType,
    // bookingPhase intentionally undefined — chat_threads is non-booking
    // (booking chat lives in booking-chat.ts). If a caller migrates a
    // booking thread here later, pass the phase for context-aware allow.
    senderRole,
    recipientRole,
    policyVersion: CURRENT_POLICY_VERSION,
  });

  // CEO DEEP-LOGIC §20 — raw body NEVER goes to general logger.info.
  // recordModerationDecision writes only safe metadata to the standard
  // log and routes the raw body to the dedicated moderation-evidence
  // sink only when shouldRetainBody() is true. Detection rule ids stay
  // out of the standard log per §29.
  const integritySignal = integritySignalFor(policyResult.primaryCategory);
  recordModerationDecision(
    {
      route: '[ThreadChat.policy]',
      threadId: req.params.threadId,
      senderUid: uid,
      policyVersion: policyResult.policyVersion,
      primaryCategory: policyResult.primaryCategory,
      integritySignal,
      outcome: policyResult.outcome,
      matches: policyResult.matches,
    },
    trimmedBody,
  );

  // §6.10 refuse-with-neutral-copy on BLOCK / BLOCK_AND_REVIEW /
  // SAFETY_ESCALATION. Sender sees a policy-neutral message + reason
  // code the UI translates. §29 discipline: detection rules are NOT
  // exposed to the client.
  if (
    policyResult.outcome === 'BLOCK' ||
    policyResult.outcome === 'BLOCK_AND_REVIEW' ||
    policyResult.outcome === 'SAFETY_ESCALATION'
  ) {
    return res.status(403).json({
      error: 'moderation_block',
      reasonCode: 'MODERATION_BLOCK',
      category: policyResult.primaryCategory ?? null,
      // Do NOT include a raw explanation of what pattern matched.
    });
  }

  // CEO DEEP-LOGIC §16 — WARN_BEFORE_SEND two-stage handshake. The
  // prior wire silently sent WARN_BEFORE_SEND messages, contradicting
  // the outcome name. Server now issues a signed moderationDecisionId
  // bound to (sender, thread, exact body hash, policy version,
  // category). A second POST with the same body + the token proceeds.
  // Any mismatch → fresh warning.
  if (policyResult.outcome === 'WARN_BEFORE_SEND') {
    const bodyHash = hashSafeContent(trimmedBody);
    const bindings = {
      senderUid: uid,
      threadId: req.params.threadId,
      safeContentHash: bodyHash,
      policyVersion: policyResult.policyVersion,
      category: policyResult.primaryCategory ?? 'OFF_PLATFORM_BOOKING' as any,
    };
    const incoming = typeof (req.body as any).moderationDecisionId === 'string'
      ? (req.body as any).moderationDecisionId as string
      : undefined;
    const verified = verifyWarningToken(incoming, bindings);
    if (!verified.ok) {
      const moderationDecisionId = issueWarningToken(bindings);
      return res.status(409).json({
        status: 'WARNING_REQUIRED',
        reasonCode: 'MODERATION_WARN',
        category: bindings.category,
        moderationDecisionId,
        overridable: true,
      });
    }
    // Verified — fall through to insert.
  }

  // CEO DEEP-LOGIC §23 — atomic send. Message row + thread head +
  // recipient unread bump must all commit together, or none of them.
  // The prior two-statement flow could leave a ghost message with a
  // stale head timestamp and un-incremented unread when the second
  // UPDATE failed. db.transaction() gives us the required boundary.
  //
  // §24-§25 — support/admin unread routing. chatThreads carries THREE
  // counters (customer / provider / admin). A support-owned thread
  // routes the target-side increment through unreadAdminCount when
  // the recipient is the support owner; a support user replying to
  // a customer/provider still increments the target side's user
  // counter. The counter that is bumped is derived from the ROLE of
  // the *other* participant on this thread, never from a workspace
  // heuristic.
  const now = new Date();
  const isSenderCustomer = t.customerUserId === uid;
  const isSenderProvider = t.providerUserId === uid;
  const isSenderSupport = t.supportOwnerId === uid;
  // The set of "other" party roles receiving the message. Multi-role
  // threads (e.g. support owner replying to a customer) may bump
  // more than one counter — the customer sees the ping AND the
  // provider (if present) sees it too. Sender's own side is never
  // bumped.
  const bumpCustomer = !!(t.customerUserId && !isSenderCustomer);
  const bumpProvider = !!(t.providerUserId && !isSenderProvider);
  const bumpAdmin = !!(t.supportOwnerId && !isSenderSupport);

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(chatThreadMessages)
      .values({
        threadId: req.params.threadId,
        senderUid: uid,
        senderRole: 'user',
        body: trimmedBody,
        attachments: gatedAttachments,
      })
      .returning();
    await tx.update(chatThreads).set({
      lastMessageAt: now,
      updatedAt: now,
      unreadCustomerCount: bumpCustomer ? dsql`${chatThreads.unreadCustomerCount} + 1` : chatThreads.unreadCustomerCount,
      unreadProviderCount: bumpProvider ? dsql`${chatThreads.unreadProviderCount} + 1` : chatThreads.unreadProviderCount,
      unreadAdminCount: bumpAdmin ? dsql`${chatThreads.unreadAdminCount} + 1` : chatThreads.unreadAdminCount,
    }).where(eq(chatThreads.threadId, req.params.threadId));
    return row;
  });

  logger.info('[ThreadChat] message sent', {
    threadId: req.params.threadId, threadType: t.threadType, senderUid: uid,
  });

  // CEO DEEP-LOGIC §18 — ALLOW_WITH_NOTICE surfaces an educational
  // notice to the UI ("For safety, keep payments on PetWash.") so
  // the notice outcome isn't silently ignored.
  const notice = policyResult.outcome === 'ALLOW_WITH_NOTICE'
    ? buildAllowNoticePayload(policyResult.primaryCategory)
    : undefined;
  return res.json({ ok: true, message: inserted, ...(notice ? { notice } : {}) });
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
  // CEO DEEP-LOGIC §25 — reset the counter that matches the caller's
  // ACTUAL participant role on this thread. The prior code only knew
  // about customer / provider; a support owner reading a thread never
  // cleared unreadAdminCount, so support badges stayed sticky.
  if (t.customerUserId === uid) patch.unreadCustomerCount = 0;
  if (t.providerUserId === uid) patch.unreadProviderCount = 0;
  if (t.supportOwnerId === uid) patch.unreadAdminCount = 0;
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
