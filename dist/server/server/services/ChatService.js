import admin from "firebase-admin";
import NotificationService from "./NotificationService";
class ChatService {
    db = admin.firestore();
    async createConversation(user1Id, user2Id, bookingId, bookingType) {
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
        const conversation = {
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
    async findConversation(user1Id, user2Id) {
        const snapshot = await this.db
            .collection("conversations")
            .where("participants", "array-contains", user1Id)
            .get();
        const conversation = snapshot.docs
            .map((doc) => doc.data())
            .find((conv) => conv.participants.includes(user2Id));
        return conversation || null;
    }
    async sendMessage(conversationId, senderId, receiverId, message, type = "text", metadata) {
        const senderDoc = await this.db.collection("users").doc(senderId).get();
        const senderData = senderDoc.data();
        const messageRef = this.db.collection("conversations").doc(conversationId).collection("messages").doc();
        const chatMessage = {
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
    async getConversationMessages(conversationId, limit = 100) {
        const snapshot = await this.db
            .collection("conversations")
            .doc(conversationId)
            .collection("messages")
            .orderBy("timestamp", "desc")
            .limit(limit)
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    async getUserConversations(userId) {
        const snapshot = await this.db
            .collection("conversations")
            .where("participants", "array-contains", userId)
            .orderBy("lastMessageTimestamp", "desc")
            .get();
        return snapshot.docs.map((doc) => doc.data());
    }
    async markConversationAsRead(conversationId, userId) {
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
