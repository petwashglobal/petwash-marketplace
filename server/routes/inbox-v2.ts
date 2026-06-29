/**
 * /api/inbox/v2 — smart inbox feed built on the chat_threads spine.
 *
 * Lists the authenticated user's threads (as customer, provider, or support owner)
 * and decorates each with the smart status badge + next action from
 * inboxSmartStatus. BOOKING rows get their live booking status best-effort so the
 * badge is real ("Provider accepted · Confirm & Pay"), never faked.
 *
 * Fail-safe: until migration 0084 (chat_threads) is applied the query throws and
 * we return an empty list — the endpoint never errors the app.
 */
import { Router } from 'express';
import { requireAuth } from '../customAuth';
import { db } from '../db';
import { or, eq, desc } from 'drizzle-orm';
import { chatThreads } from '@shared/schema-chat';
import { bookingRequests } from '@shared/schema';
import { computeInboxRowStatus, type InboxContext } from '../services/inboxSmartStatus';
import { logger } from '../lib/logger';

const router = Router();

router.get('/threads', requireAuth, async (req, res) => {
  const uid = req.user!.uid;
  try {
    const threads = await db
      .select()
      .from(chatThreads)
      .where(or(
        eq(chatThreads.customerUserId, uid),
        eq(chatThreads.providerUserId, uid),
        eq(chatThreads.supportOwnerId, uid),
      ))
      .orderBy(desc(chatThreads.lastMessageAt))
      .limit(200);

    const rows = await Promise.all(threads.map(async (t) => {
      const ctx: InboxContext = {
        threadType: t.threadType as any,
        threadStatus: t.status,
      };

      // Best-effort: enrich BOOKING rows with the real booking lifecycle so the
      // badge/action are truthful. Any failure leaves a safe default.
      if (t.threadType === 'BOOKING' && t.bookingId) {
        try {
          const [b] = await db
            .select({ status: bookingRequests.status })
            .from(bookingRequests)
            .where(eq(bookingRequests.requestId, t.bookingId))
            .limit(1);
          if (b) ctx.bookingStatus = b.status as string;
        } catch { /* leave defaults */ }
      }

      const smart = computeInboxRowStatus(ctx);
      const role = t.providerUserId === uid ? 'provider' : (t.supportOwnerId === uid ? 'support' : 'customer');
      const unread =
        role === 'provider' ? t.unreadProviderCount
        : role === 'support' ? t.unreadAdminCount
        : t.unreadCustomerCount;

      return {
        threadId: t.threadId,
        threadType: t.threadType,
        bookingId: t.bookingId,
        status: t.status,
        lastMessageAt: t.lastMessageAt,
        unread: unread ?? 0,
        role,
        ...smart,
      };
    }));

    res.json({ ok: true, threads: rows });
  } catch (e: any) {
    // chat_threads not live yet (migration 0084) → empty, never error the inbox.
    logger.warn('[InboxV2] threads query failed (returning empty)', { error: e?.message });
    res.json({ ok: true, threads: [], note: 'chat_threads not available yet' });
  }
});

/**
 * GET /api/inbox/v2/booking/:bookingId/status — smart status for ONE booking.
 * Reads the booking lifecycle directly (works today, no chat_threads dependency)
 * so the chat screen can show the same badge + next action as the inbox.
 */
router.get('/booking/:bookingId/status', requireAuth, async (req, res) => {
  const { bookingId } = req.params;
  try {
    let bookingStatus: string | null = null;
    try {
      const [b] = await db
        .select({ status: bookingRequests.status })
        .from(bookingRequests)
        .where(eq(bookingRequests.requestId, bookingId))
        .limit(1);
      bookingStatus = (b?.status as string) ?? null;
    } catch { /* leave null */ }

    const smart = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus });
    res.json({ ok: true, bookingId, bookingStatus, ...smart });
  } catch (e: any) {
    logger.warn('[InboxV2] booking status failed', { error: e?.message, bookingId });
    res.json({ ok: true, bookingId, badge: 'OPEN', action: 'OPEN_CHAT', badgeLabel: { en: 'Open', he: 'פתוח' }, actionLabel: { en: 'Open chat', he: 'פתחו צ׳אט' } });
  }
});

export default router;
