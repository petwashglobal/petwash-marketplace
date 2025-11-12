import { SmsService } from "../smsService";
import { EmailService } from "../emailService";
import admin from "firebase-admin";

export interface Notification {
  id: string;
  userId: string;
  type: "booking" | "payment" | "ride_update" | "walk_update" | "system";
  title: string;
  message: string;
  data?: any;
  priority: "high" | "normal" | "low";
  channel: "push" | "sms" | "email" | "all";
  read: boolean;
  createdAt: Date;
}

class NotificationService {
  private db = admin.firestore();

  async sendNotification(notification: Omit<Notification, "id" | "read" | "createdAt">): Promise<void> {
    try {
      const notificationRef = this.db.collection("notifications").doc();
      const fullNotification: Notification = {
        ...notification,
        id: notificationRef.id,
        read: false,
        createdAt: new Date(),
      };

      await notificationRef.set(fullNotification);

      switch (notification.channel) {
        case "push":
          await this.sendPushNotification(notification);
          break;
        case "sms":
          await this.sendSMSNotification(notification);
          break;
        case "email":
          await this.sendEmailNotification(notification);
          break;
        case "all":
          await Promise.all([
            this.sendPushNotification(notification),
            this.sendSMSNotification(notification),
            this.sendEmailNotification(notification),
          ]);
          break;
      }
    } catch (error) {
      console.error("[NotificationService] Error sending notification:", error);
      throw error;
    }
  }

  private async sendPushNotification(notification: Omit<Notification, "id" | "read" | "createdAt">): Promise<void> {
    try {
      const userDoc = await this.db.collection("users").doc(notification.userId).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log("[NotificationService] No FCM token for user:", notification.userId);
        return;
      }

      const message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: notification.data || {},
        android: {
          priority: notification.priority === "high" ? "high" as const : "normal" as const,
        },
        apns: {
          headers: {
            "apns-priority": notification.priority === "high" ? "10" : "5",
          },
        },
      };

      await admin.messaging().send(message);
      console.log("[NotificationService] Push notification sent to:", notification.userId);
    } catch (error) {
      console.error("[NotificationService] Error sending push:", error);
    }
  }

  private async sendSMSNotification(notification: Omit<Notification, "id" | "read" | "createdAt">): Promise<void> {
    try {
      const userDoc = await this.db.collection("users").doc(notification.userId).get();
      const phoneNumber = userDoc.data()?.phone;

      if (!phoneNumber) {
        console.log("[NotificationService] No phone number for user:", notification.userId);
        return;
      }

      await SmsService.sendSMS(phoneNumber, `${notification.title}\n${notification.message}`);
      console.log("[NotificationService] SMS sent to:", phoneNumber);
    } catch (error) {
      console.error("[NotificationService] Error sending SMS:", error);
    }
  }

  private async sendEmailNotification(notification: Omit<Notification, "id" | "read" | "createdAt">): Promise<void> {
    try {
      const userDoc = await this.db.collection("users").doc(notification.userId).get();
      const email = userDoc.data()?.email;

      if (!email) {
        console.log("[NotificationService] No email for user:", notification.userId);
        return;
      }

      await EmailService.sendCustomEmail(email, notification.title, `<p>${notification.message}</p>`);
      console.log("[NotificationService] Email sent to:", email);
    } catch (error) {
      console.error("[NotificationService] Error sending email:", error);
    }
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.db.collection("notifications").doc(notificationId).update({
      read: true,
      readAt: new Date(),
    });
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const snapshot = await this.db
      .collection("notifications")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Notification);
  }

  async sendBookingConfirmation(userId: string, bookingDetails: any): Promise<void> {
    await this.sendNotification({
      userId,
      type: "booking",
      title: "Booking Confirmed! 🎉",
      message: `Your booking for ${bookingDetails.date} has been confirmed.`,
      data: bookingDetails,
      priority: "high",
      channel: "all",
    });
  }

  async sendPaymentNotification(userId: string, amount: number, status: "success" | "failed"): Promise<void> {
    await this.sendNotification({
      userId,
      type: "payment",
      title: status === "success" ? "Payment Successful ✅" : "Payment Failed ❌",
      message: status === "success" 
        ? `Payment of ₪${amount.toFixed(2)} processed successfully.`
        : `Payment of ₪${amount.toFixed(2)} failed. Please update your payment method.`,
      priority: "high",
      channel: "all",
    });
  }

  async sendRideUpdate(userId: string, status: string, eta?: number): Promise<void> {
    await this.sendNotification({
      userId,
      type: "ride_update",
      title: "Ride Update 🚗",
      message: eta ? `Your driver is ${eta} minutes away.` : `Ride status: ${status}`,
      priority: "high",
      channel: "push",
    });
  }
}

export default new NotificationService();
