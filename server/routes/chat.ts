import express from "express";
import ChatService from "../services/ChatService";
import { requireAuth } from "../customAuth";

const router = express.Router();

router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const { user2Id, bookingId, bookingType } = req.body;
    const user1Id = req.user!.uid;
    
    const conversation = await ChatService.createConversation(user1Id, user2Id, bookingId, bookingType);
    res.json({ conversation });
  } catch (error: any) {
    console.error("[Chat] Error creating conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const conversations = await ChatService.getUserConversations(userId);
    res.json({ conversations });
  } catch (error: any) {
    console.error("[Chat] Error fetching conversations:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const messages = await ChatService.getConversationMessages(conversationId, limit);
    res.json({ messages });
  } catch (error: any) {
    console.error("[Chat] Error fetching messages:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { receiverId, message, type, metadata } = req.body;
    const senderId = req.user!.uid;
    
    const chatMessage = await ChatService.sendMessage(
      conversationId,
      senderId,
      receiverId,
      message,
      type,
      metadata
    );
    
    res.json({ message: chatMessage });
  } catch (error: any) {
    console.error("[Chat] Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/conversations/:conversationId/read", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.uid;
    
    await ChatService.markConversationAsRead(conversationId, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Chat] Error marking as read:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
