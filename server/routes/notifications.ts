import express from "express";
import NotificationService from "../services/NotificationService";
import { requireAuth } from "../customAuth";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const notifications = await NotificationService.getUserNotifications(userId, limit);
    res.json({ notifications });
  } catch (error: any) {
    console.error("[Notifications] Error fetching:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:notificationId/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { notificationId } = req.params;
    
    await NotificationService.markAsRead(userId, notificationId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Error marking as read:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/send", requireAuth, async (req, res) => {
  try {
    await NotificationService.sendNotification(req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Error sending:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
