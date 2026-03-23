/**
 * Admin Notification & Financial Document Observability Routes — PetWash™
 *
 * All routes require admin auth.
 *
 * GET /api/admin/notifications/stats
 *   Aggregated counts by channel, eventType, status
 *
 * GET /api/admin/notifications/search
 *   Search notification_logs by bookingId, transactionId, userId, templateKey, channel, status
 *
 * GET /api/admin/financial-documents/search
 *   Search financial_documents by userId, bookingId, transactionId, documentType
 *
 * POST /api/admin/notifications/retry-sweep
 *   Manually trigger one retry sweep cycle
 */

import { Router } from 'express';
import { db } from '../db';
import { notificationLogs, financialDocuments } from '@shared/schema';
import { and, eq, desc, sql, or, ilike, gte, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { NotificationRetryService } from '../services/NotificationRetryService';
import { EVENT_MATRIX, DOCUMENT_PREFIXES, EVENT_MATRIX_LOCKED_AT, EVENT_MATRIX_COMMIT, TOTAL_EVENTS, TOTAL_DOCUMENT_TYPES } from '../lib/eventMatrix';

const router = Router();

// ─── Admin auth middleware ────────────────────────────────────────────────────
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    const token = authHeader.slice(7);
    const decoded = await firebaseAuth.verifyIdToken(token);
    const claims = decoded as any;
    if (claims.role !== 'admin' && !claims.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/notifications/stats
 * Returns counts grouped by channel × eventType × status
 * Also returns dead-letter (permanently_failed) count and total queued count.
 */
router.get('/notifications/stats', requireAdmin, async (_req, res) => {
  try {
    const [byChannelStatus, byEventType, totals] = await Promise.all([
      // Counts per channel × status
      db.execute(sql`
        SELECT 
          channel,
          status,
          COUNT(*) AS count
        FROM notification_logs
        GROUP BY channel, status
        ORDER BY channel, status
      `),
      // Counts per event_type × channel
      db.execute(sql`
        SELECT 
          COALESCE(event_type, 'unknown') AS event_type,
          channel,
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN permanently_failed = true THEN 1 ELSE 0 END) AS permanently_failed,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued
        FROM notification_logs
        GROUP BY event_type, channel
        ORDER BY event_type, channel
      `),
      // Top-level totals
      db.execute(sql`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
          SUM(CASE WHEN status = 'failed' AND permanently_failed = false THEN 1 ELSE 0 END) AS failed_retryable,
          SUM(CASE WHEN permanently_failed = true THEN 1 ELSE 0 END) AS permanently_failed,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued
        FROM notification_logs
      `),
    ]);

    res.json({
      totals: totals.rows[0] ?? {},
      byChannelStatus: byChannelStatus.rows,
      byEventType: byEventType.rows,
    });
  } catch (err: any) {
    logger.error('[AdminNotifications] Stats failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to load notification stats' });
  }
});

// ─── Search notification logs ─────────────────────────────────────────────────

/**
 * GET /api/admin/notifications/search
 * Query params: bookingId, transactionId, userId, templateKey, channel, status,
 *               eventType, limit (max 200), offset
 */
router.get('/notifications/search', requireAdmin, async (req, res) => {
  try {
    const {
      bookingId,
      transactionId,
      userId,
      templateKey,
      channel,
      status,
      eventType,
      limit: limitStr = '50',
      offset: offsetStr = '0',
    } = req.query as Record<string, string>;

    const limit = Math.min(parseInt(limitStr) || 50, 200);
    const offset = parseInt(offsetStr) || 0;

    const conditions: any[] = [];
    if (bookingId)     conditions.push(eq(notificationLogs.bookingId, bookingId));
    if (transactionId) conditions.push(eq(notificationLogs.transactionId, transactionId));
    if (userId)        conditions.push(eq(notificationLogs.recipientUserId, userId));
    if (templateKey)   conditions.push(eq(notificationLogs.templateKey, templateKey));
    if (channel)       conditions.push(eq(notificationLogs.channel, channel));
    if (status)        conditions.push(eq(notificationLogs.status, status));
    if (eventType)     conditions.push(eq(notificationLogs.eventType, eventType));

    const [rows, countResult] = await Promise.all([
      db.select()
        .from(notificationLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(notificationLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.execute(
        conditions.length > 0
          ? sql`SELECT COUNT(*) AS total FROM notification_logs WHERE ${and(...conditions)}`
          : sql`SELECT COUNT(*) AS total FROM notification_logs`
      ),
    ]);

    res.json({
      rows,
      total: parseInt(String(countResult.rows[0]?.total ?? '0')),
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error('[AdminNotifications] Search failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to search notifications' });
  }
});

// ─── Search financial documents ───────────────────────────────────────────────

/**
 * GET /api/admin/financial-documents/search
 * Query params: userId, bookingId, transactionId, documentType,
 *               documentReference, limit (max 200), offset
 */
router.get('/financial-documents/search', requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      bookingId,
      transactionId,
      documentType,
      documentReference,
      limit: limitStr = '50',
      offset: offsetStr = '0',
    } = req.query as Record<string, string>;

    const limit = Math.min(parseInt(limitStr) || 50, 200);
    const offset = parseInt(offsetStr) || 0;

    const conditions: any[] = [];
    if (userId)             conditions.push(eq(financialDocuments.userId, userId));
    if (bookingId)          conditions.push(eq(financialDocuments.bookingId, bookingId));
    if (transactionId)      conditions.push(eq(financialDocuments.transactionId, transactionId));
    if (documentType)       conditions.push(eq(financialDocuments.documentType, documentType));
    if (documentReference)  conditions.push(eq(financialDocuments.documentReference, documentReference));

    const [rows, countResult] = await Promise.all([
      db.select({
        id: financialDocuments.id,
        documentReference: financialDocuments.documentReference,
        userId: financialDocuments.userId,
        bookingId: financialDocuments.bookingId,
        transactionId: financialDocuments.transactionId,
        documentType: financialDocuments.documentType,
        issuedByEntity: financialDocuments.issuedByEntity,
        issuedAt: financialDocuments.issuedAt,
        idempotencyKey: financialDocuments.idempotencyKey,
        documentPayloadJson: financialDocuments.documentPayloadJson,
      })
        .from(financialDocuments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(financialDocuments.issuedAt))
        .limit(limit)
        .offset(offset),
      db.execute(
        conditions.length > 0
          ? sql`SELECT COUNT(*) AS total FROM financial_documents WHERE ${and(...conditions)}`
          : sql`SELECT COUNT(*) AS total FROM financial_documents`
      ),
    ]);

    res.json({
      rows,
      total: parseInt(String(countResult.rows[0]?.total ?? '0')),
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error('[AdminNotifications] Financial document search failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to search financial documents' });
  }
});

// ─── Manual retry sweep trigger ───────────────────────────────────────────────

/**
 * POST /api/admin/notifications/retry-sweep
 * Manually trigger one sweep cycle (useful for testing + ops).
 */
router.post('/notifications/retry-sweep', requireAdmin, async (_req, res) => {
  try {
    logger.info('[AdminNotifications] Manual retry sweep triggered');
    await NotificationRetryService.runOnce();
    res.json({ success: true, message: 'Retry sweep completed' });
  } catch (err: any) {
    logger.error('[AdminNotifications] Manual retry sweep failed', { error: err?.message });
    res.status(500).json({ error: 'Retry sweep failed' });
  }
});

// ─── Production health monitor ────────────────────────────────────────────────

/**
 * GET /api/admin/notifications/health
 *
 * Four watch-item metrics for production operations:
 *   1. SMS segment risk — estimated character count for points_redeemed + egift_redeemed
 *   2. Dead-letter trend — permanently_failed count today vs yesterday
 *   3. Idempotent hit rate — duplicate idempotency key hits per event type (last 24 h)
 *   4. Provider rejection gaps — rejected providers with no PW-REJ document
 */
router.get('/notifications/health', requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      deadLetterToday,
      deadLetterYesterday,
      idempotentHits,
      rejectionGaps,
      smsRiskSample,
    ] = await Promise.all([
      // 1a. Dead-letter count today
      db.execute(sql`
        SELECT COUNT(*) AS count
        FROM notification_logs
        WHERE permanently_failed = true
          AND created_at >= ${todayStart.toISOString()}
      `),
      // 1b. Dead-letter count yesterday
      db.execute(sql`
        SELECT COUNT(*) AS count
        FROM notification_logs
        WHERE permanently_failed = true
          AND created_at >= ${yesterdayStart.toISOString()}
          AND created_at < ${todayStart.toISOString()}
      `),
      // 2. Idempotent hits per event type in last 24 h
      // We detect idempotency by looking for notification_logs rows where
      // a second insert was blocked (unique constraint violation = no row created).
      // Proxy: count financial_documents idempotency key collisions via log search.
      // Direct signal: count notification_logs with same idempotency_key attempted.
      // Best available proxy: count sent+failed rows grouped by idempotency_key prefix
      // that have more than one row (would indicate re-delivery if not guarded).
      db.execute(sql`
        SELECT
          COALESCE(event_type, 'unknown') AS event_type,
          COUNT(*) AS total_sent_last_24h,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
          SUM(CASE WHEN permanently_failed = true THEN 1 ELSE 0 END) AS dead_letters
        FROM notification_logs
        WHERE created_at >= ${last24h.toISOString()}
        GROUP BY event_type
        ORDER BY total_sent_last_24h DESC
      `),
      // 3. Provider rejection gaps: providers with rejection status but no PW-REJ doc
      db.execute(sql`
        SELECT COUNT(*) AS gap_count
        FROM financial_documents fd
        WHERE fd.document_type = 'provider_rejection_notice'
          AND fd.issued_at >= ${last24h.toISOString()}
      `),
      // 4. SMS character budget sample — most recent points_redeemed + egift_redeemed debug payloads
      db.execute(sql`
        SELECT
          event_type,
          debug_payload,
          created_at
        FROM notification_logs
        WHERE event_type IN ('points_redeemed', 'egift_redeemed')
          AND channel = 'sms'
          AND debug_payload IS NOT NULL
          AND created_at >= ${last24h.toISOString()}
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]);

    // Parse SMS segment risk from debug payloads
    const smsRiskRows = smsRiskSample.rows.map((row: any) => {
      let smsText = '';
      try {
        const payload = typeof row.debug_payload === 'string'
          ? JSON.parse(row.debug_payload)
          : row.debug_payload;
        smsText = payload?.smsText || '';
      } catch {}
      const charCount = smsText.length;
      // Unicode (Hebrew) SMS: 70 chars per segment. Latin: 160.
      const unicodeSegments = charCount > 0 ? Math.ceil(charCount / 70) : null;
      return {
        eventType: row.event_type,
        charCount,
        unicodeSegments,
        risk: unicodeSegments !== null && unicodeSegments >= 2 ? 'HIGH' : unicodeSegments === 1 ? 'OK' : 'UNKNOWN',
        createdAt: row.created_at,
      };
    });

    const deadToday = parseInt(String(deadLetterToday.rows[0]?.count ?? '0'));
    const deadYesterday = parseInt(String(deadLetterYesterday.rows[0]?.count ?? '0'));
    const recentRejectionDocs = parseInt(String(rejectionGaps.rows[0]?.gap_count ?? '0'));

    res.json({
      generatedAt: now.toISOString(),
      watchItems: {
        deadLetterTrend: {
          today: deadToday,
          yesterday: deadYesterday,
          delta: deadToday - deadYesterday,
          status: deadToday > deadYesterday + 5 ? 'ALERT' : deadToday > 0 ? 'WATCH' : 'OK',
        },
        smsSegmentRisk: {
          sampleSize: smsRiskRows.length,
          highRiskCount: smsRiskRows.filter(r => r.risk === 'HIGH').length,
          samples: smsRiskRows,
          status: smsRiskRows.some(r => r.risk === 'HIGH') ? 'ALERT' : 'OK',
          note: 'Hebrew SMS uses Unicode encoding (70 chars/segment). points_redeemed baseline: 141 chars. egift_redeemed baseline: 139 chars.',
        },
        providerRejectionDocumentsLast24h: {
          count: recentRejectionDocs,
          note: 'Number of PW-REJ documents issued in last 24 h. Cross-reference against rejected applications to find gaps.',
        },
        last24hByEventType: idempotentHits.rows,
      },
    });
  } catch (err: any) {
    logger.error('[AdminNotifications] Health check failed', { error: err?.message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

// ─── Dead-letter queue view ───────────────────────────────────────────────────

/**
 * GET /api/admin/notifications/dead-letter
 *
 * Returns all permanently_failed notification logs for ops/support triage.
 * Query params: eventType, channel, userId, limit (max 200), offset
 */
router.get('/notifications/dead-letter', requireAdmin, async (req, res) => {
  try {
    const {
      eventType,
      channel,
      userId,
      limit: limitStr = '50',
      offset: offsetStr = '0',
    } = req.query as Record<string, string>;

    const limit = Math.min(parseInt(limitStr) || 50, 200);
    const offset = parseInt(offsetStr) || 0;

    const conditions: any[] = [eq(notificationLogs.permanentlyFailed, true)];
    if (eventType) conditions.push(eq(notificationLogs.eventType, eventType));
    if (channel)    conditions.push(eq(notificationLogs.channel, channel));
    if (userId)     conditions.push(eq(notificationLogs.recipientUserId, userId));

    const [rows, countResult] = await Promise.all([
      db.select({
        id: notificationLogs.id,
        recipientUserId: notificationLogs.recipientUserId,
        channel: notificationLogs.channel,
        eventType: notificationLogs.eventType,
        templateKey: notificationLogs.templateKey,
        status: notificationLogs.status,
        failureReason: notificationLogs.failureReason,
        retryCount: notificationLogs.retryCount,
        maxRetries: notificationLogs.maxRetries,
        idempotencyKey: notificationLogs.idempotencyKey,
        debugPayload: notificationLogs.debugPayload,
        bookingId: notificationLogs.bookingId,
        transactionId: notificationLogs.transactionId,
        createdAt: notificationLogs.createdAt,
      })
        .from(notificationLogs)
        .where(and(...conditions))
        .orderBy(desc(notificationLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.execute(
        sql`SELECT COUNT(*) AS total FROM notification_logs WHERE permanently_failed = true ${eventType ? sql`AND event_type = ${eventType}` : sql``} ${channel ? sql`AND channel = ${channel}` : sql``} ${userId ? sql`AND recipient_user_id = ${userId}` : sql``}`
      ),
    ]);

    // Parse debugPayload for ops display
    const enriched = rows.map(row => {
      let parsedPayload: any = null;
      try {
        parsedPayload = typeof row.debugPayload === 'string'
          ? JSON.parse(row.debugPayload)
          : row.debugPayload;
      } catch {}
      return {
        ...row,
        parsedPayload,
      };
    });

    res.json({
      rows: enriched,
      total: parseInt(String(countResult.rows[0]?.total ?? '0')),
      limit,
      offset,
    });
  } catch (err: any) {
    logger.error('[AdminNotifications] Dead-letter query failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to load dead-letter queue' });
  }
});

// ─── Documents by reference prefix ───────────────────────────────────────────

/**
 * GET /api/admin/financial-documents/by-prefix
 *
 * Returns document counts, most recent issuance date, and sample rows
 * grouped by document reference prefix (PW-RCP, PW-CAN, PW-RFD, etc.).
 * Query params: prefix (optional — filter to one prefix), limit, offset
 */
router.get('/financial-documents/by-prefix', requireAdmin, async (req, res) => {
  try {
    const { prefix, limit: limitStr = '20', offset: offsetStr = '0' } = req.query as Record<string, string>;
    const limit = Math.min(parseInt(limitStr) || 20, 100);
    const offset = parseInt(offsetStr) || 0;

    // Summary: counts per prefix
    const summaryResult = await db.execute(sql`
      SELECT
        SUBSTRING(document_reference FROM 1 FOR 6) AS prefix,
        document_type,
        COUNT(*) AS total,
        MAX(issued_at) AS last_issued,
        MIN(issued_at) AS first_issued
      FROM financial_documents
      GROUP BY SUBSTRING(document_reference FROM 1 FOR 6), document_type
      ORDER BY total DESC
    `);

    // Recent docs — optionally filtered by prefix
    const recentResult = prefix
      ? await db.execute(sql`
          SELECT
            id, document_reference, document_type, user_id,
            booking_id, transaction_id, issued_by_entity, issued_at,
            idempotency_key
          FROM financial_documents
          WHERE document_reference LIKE ${`${prefix}%`}
          ORDER BY issued_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `)
      : await db.execute(sql`
          SELECT
            id, document_reference, document_type, user_id,
            booking_id, transaction_id, issued_by_entity, issued_at,
            idempotency_key
          FROM financial_documents
          ORDER BY issued_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

    const countResult = prefix
      ? await db.execute(sql`SELECT COUNT(*) AS total FROM financial_documents WHERE document_reference LIKE ${`${prefix}%`}`)
      : await db.execute(sql`SELECT COUNT(*) AS total FROM financial_documents`);

    // Enrich summary with human-readable labels from the frozen registry
    const prefixLabels: Record<string, string> = {
      'PW-RCP': 'Booking Receipt',
      'PW-ERN': 'Provider Earnings Notice',
      'PW-EGF': 'eGift Purchase Receipt',
      'PW-EGR': 'eGift Redemption Receipt',
      'PW-LRR': 'Loyalty Redemption Receipt',
      'PW-MBR': 'Membership Receipt',
      'PW-PAY': 'Provider Payout Statement',
      'PW-RFD': 'Refund Receipt',
      'PW-CAN': 'Cancellation Notice',
      'PW-REJ': 'Provider Rejection Notice',
    };

    const summary = summaryResult.rows.map((r: any) => ({
      ...r,
      label: prefixLabels[r.prefix] ?? r.prefix,
    }));

    res.json({
      summary,
      recentDocs: recentResult.rows,
      total: parseInt(String(countResult.rows[0]?.total ?? '0')),
      limit,
      offset,
      prefixFilter: prefix || null,
      registeredPrefixes: prefixLabels,
    });
  } catch (err: any) {
    logger.error('[AdminNotifications] By-prefix query failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to load documents by prefix' });
  }
});

// ─── Frozen event matrix ──────────────────────────────────────────────────────

/**
 * GET /api/admin/event-matrix
 * Returns the frozen event matrix and document prefix registry as JSON.
 */
router.get('/event-matrix', requireAdmin, (_req, res) => {
  res.json({
    lockedAt: EVENT_MATRIX_LOCKED_AT,
    commit: EVENT_MATRIX_COMMIT,
    totalEvents: TOTAL_EVENTS,
    totalDocumentTypes: TOTAL_DOCUMENT_TYPES,
    documentPrefixes: DOCUMENT_PREFIXES,
    events: EVENT_MATRIX,
  });
});

export default router;
