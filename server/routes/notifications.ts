/**
 * Notification API Routes
 * Multi-channel notification management and template CRUD
 */

import express from "express";
import NotificationService from "../services/NotificationService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";
import { insertNotificationTemplateSchema } from "@shared/schema";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = express.Router();

// ==================== NOTIFICATION SENDING ====================

/**
 * POST /api/notifications/send
 * Send notification using template
 */
router.post("/send", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      templateKey: z.string(),
      userId: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      channelsOverride: z.array(z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app'])).optional(),
      variables: z.record(z.any()).optional(),
    });
    
    const data = schema.parse(req.body);
    
    const result = await NotificationService.sendNotification(data);
    
    res.json({
      success: result.success,
      logIds: result.logIds,
      errors: result.errors,
    });
  } catch (error: any) {
    logger.error("[Notifications] Error sending notification:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== TEMPLATE MANAGEMENT ====================

/**
 * GET /api/notifications/templates
 * List all templates
 */
router.get("/templates", requireAdmin, async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    
    const templates = await NotificationService.listTemplates(activeOnly);
    
    res.json({ templates });
  } catch (error: any) {
    logger.error("[Notifications] Error fetching templates:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/templates/:key
 * Get template by key
 */
router.get("/templates/:key", requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    const template = await NotificationService.getTemplateByKey(key);
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    res.json({ template });
  } catch (error: any) {
    logger.error("[Notifications] Error fetching template:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/templates
 * Create new template
 */
router.post("/templates", requireAdmin, async (req, res) => {
  try {
    const data = insertNotificationTemplateSchema.parse(req.body);
    
    const template = await NotificationService.createTemplate(data);
    
    res.status(201).json({ template });
  } catch (error: any) {
    logger.error("[Notifications] Error creating template:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/notifications/templates/:key
 * Update template
 */
router.patch("/templates/:key", requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const updates = insertNotificationTemplateSchema.partial().parse(req.body);
    
    const template = await NotificationService.updateTemplate(key, updates);
    
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    res.json({ template });
  } catch (error: any) {
    logger.error("[Notifications] Error updating template:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/notifications/templates/:key
 * Delete template
 */
router.delete("/templates/:key", requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    const success = await NotificationService.deleteTemplate(key);
    
    if (!success) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Notifications] Error deleting template:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== NOTIFICATION LOGS ====================

/**
 * GET /api/notifications/logs
 * Get notification logs with filters
 */
router.get("/logs", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string().optional(),
      channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']).optional(),
      status: z.string().optional(),
      templateKey: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.string().optional(),
    });
    
    const filters = schema.parse(req.query);
    
    const logs = await NotificationService.getNotificationLogs({
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      limit: filters.limit ? parseInt(filters.limit) : undefined,
    });
    
    res.json({ logs });
  } catch (error: any) {
    logger.error("[Notifications] Error fetching logs:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /api/notifications/stats
 * Get delivery statistics
 */
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    });
    
    const filters = schema.parse(req.query);
    
    const stats = await NotificationService.getDeliveryStats({
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });
    
    res.json({ stats });
  } catch (error: any) {
    logger.error("[Notifications] Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== WEBHOOK CALLBACKS ====================

/**
 * POST /api/notifications/webhook/delivered
 * Mark notification as delivered (for webhook callbacks)
 */
router.post("/webhook/delivered", async (req, res) => {
  try {
    const schema = z.object({
      logId: z.number(),
    });
    
    const data = schema.parse(req.body);
    
    await NotificationService.markAsDelivered(data.logId);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Notifications] Error marking as delivered:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/webhook/failed
 * Mark notification as failed (for webhook callbacks)
 */
router.post("/webhook/failed", async (req, res) => {
  try {
    const schema = z.object({
      logId: z.number(),
      reason: z.string(),
    });
    
    const data = schema.parse(req.body);
    
    await NotificationService.markAsFailed(data.logId, data.reason);
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Notifications] Error marking as failed:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== USER-FACING ENDPOINTS ====================

/**
 * GET /api/notifications
 * Get user's in-app notifications
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const logs = await NotificationService.getNotificationLogs({
      userId,
      channel: 'in_app',
      limit,
    });
    
    res.json({ notifications: logs });
  } catch (error: any) {
    logger.error("[Notifications] Error fetching user notifications:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/:logId/read
 * Mark a notification log as read
 */
router.post("/:logId/read", requireAuth, async (req, res) => {
  try {
    const { logId } = req.params;
    const id = parseInt(logId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid logId' });

    const { db } = await import('../db');
    const { notificationLogs } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(notificationLogs)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notificationLogs.id, id));

    logger.info("[Notifications] Marked as read", { logId: id });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Notifications] Error marking as read:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all of the current user's notifications as read
 */
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.uid;
    const { db } = await import('../db');
    const { notificationLogs } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    await db.update(notificationLogs)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notificationLogs.recipientUserId, uid), eq(notificationLogs.isRead, false)));

    res.json({ success: true });
  } catch (error: any) {
    logger.error("[Notifications] Error marking all as read:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
