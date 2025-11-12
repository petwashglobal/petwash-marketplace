import admin from "firebase-admin";
import NotificationService from "./NotificationService";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: "text" | "image" | "location";
  metadata?: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: { [userId: string]: string };
  participantPhotos: { [userId: string]: string };
  lastMessage: string;
  lastMessageTimestamp: Date;
  unreadCount: { [userId: string]: number };
  bookingId?: string;
  bookingType?: "sitter" | "walk" | "transport";
  createdAt: Date;
}

class ChatService {
  private db = admin.firestore();

  async createConversation(
    user1Id: string,
    user2Id: string,
    bookingId?: string,
    bookingType?: "sitter" | "walk" | "transport"
  ): Promise<Conversation> {
    const existingConv = await this.findConversation(user1Id, user2Id);
    if (existingConv) {
      return existingConv;
    }

    const [user1, user2] = await Promise.all([
      this.db.collection("users").doc(user1Id).get(),
      this.db.collection("users").doc(user2Id).get(),
    ]);

    const user1Data = user1.data();
    const user2Data = user2.data();

    const conversationRef = this.db.collection("conversations").doc();
    const conversation: Conversation = {
      id: conversationRef.id,
      participants: [user1Id, user2Id],
      participantNames: {
        [user1Id]: user1Data?.name || "User",
        [user2Id]: user2Data?.name || "User",
      },
      participantPhotos: {
        [user1Id]: user1Data?.photoURL || "",
        [user2Id]: user2Data?.photoURL || "",
      },
      lastMessage: "",
      lastMessageTimestamp: new Date(),
      unreadCount: { [user1Id]: 0, [user2Id]: 0 },
      bookingId,
      bookingType,
      createdAt: new Date(),
    };

    await conversationRef.set(conversation);
    return conversation;
  }

  async findConversation(user1Id: string, user2Id: string): Promise<Conversation | null> {
    const snapshot = await this.db
      .collection("conversations")
      .where("participants", "array-contains", user1Id)
      .get();

    const conversation = snapshot.docs
      .map((doc) => doc.data() as Conversation)
      .find((conv) => conv.participants.includes(user2Id));

    return conversation || null;
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    receiverId: string,
    message: string,
    type: "text" | "image" | "location" = "text",
    metadata?: any
  ): Promise<ChatMessage> {
    const senderDoc = await this.db.collection("users").doc(senderId).get();
    const senderData = senderDoc.data();

    const messageRef = this.db.collection("conversations").doc(conversationId).collection("messages").doc();
    
    const chatMessage: ChatMessage = {
      id: messageRef.id,
      conversationId,
      senderId,
      senderName: senderData?.name || "User",
      senderPhoto: senderData?.photoURL,
      receiverId,
      message,
      timestamp: new Date(),
      read: false,
      type,
      metadata,
    };

    await messageRef.set(chatMessage);

    await this.db.collection("conversations").doc(conversationId).update({
      lastMessage: message,
      lastMessageTimestamp: new Date(),
      [`unreadCount.${receiverId}`]: admin.firestore.FieldValue.increment(1),
    });

    await NotificationService.sendNotification({
      userId: receiverId,
      type: "system",
      title: `New message from ${senderData?.name || "User"}`,
      message,
      priority: "normal",
      channel: "push",
      data: { conversationId, senderId },
    });

    return chatMessage;
  }

  async getConversationMessages(conversationId: string, limit: number = 100): Promise<ChatMessage[]> {
    const snapshot = await this.db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as ChatMessage);
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    const snapshot = await this.db
      .collection("conversations")
      .where("participants", "array-contains", userId)
      .orderBy("lastMessageTimestamp", "desc")
      .get();

    return snapshot.docs.map((doc) => doc.data() as Conversation);
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    await this.db.collection("conversations").doc(conversationId).update({
      [`unreadCount.${userId}`]: 0,
    });

    const messagesSnapshot = await this.db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .where("receiverId", "==", userId)
      .where("read", "==", false)
      .get();

    const batch = this.db.batch();
    messagesSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  }
}

export default new ChatService();
