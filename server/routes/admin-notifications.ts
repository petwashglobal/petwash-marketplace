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
import { and, eq, desc, sql, or, ilike } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';
import { NotificationRetryService } from '../services/NotificationRetryService';

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

export default router;
