/**
 * PetWash™ Unified Notifications Hub 2025
 * 
 * Multi-channel notification system supporting:
 * - Push notifications (FCM)
 * - Email (SendGrid)
 * - SMS (Twilio)
 * - WhatsApp Business API
 * - In-app notifications
 * 
 * Features:
 * - Bilingual templates (Hebrew/English)
 * - User preference management
 * - Rate limiting
 * - Delivery tracking
 * - Triggered journeys
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================
// 1. NOTIFICATION TYPES
// ============================================

export type NotificationChannel = "PUSH" | "EMAIL" | "SMS" | "WHATSAPP" | "IN_APP";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type NotificationCategory =
  | "BOOKING"
  | "PAYMENT"
  | "REFERRAL"
  | "LOYALTY"
  | "MARKETING"
  | "SYSTEM"
  | "SECURITY"
  | "REMINDER";

export interface NotificationPayload {
  userId: string;
  templateId: string;
  variables: Record<string, string>;
  category: NotificationCategory;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  templateId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, any>;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  sentAt?: FirebaseFirestore.Timestamp;
  deliveredAt?: FirebaseFirestore.Timestamp;
  readAt?: FirebaseFirestore.Timestamp;
  failureReason?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

// ============================================
// 2. NOTIFICATION TEMPLATES
// ============================================

export const NOTIFICATION_TEMPLATES: Record<string, {
  titleHe: string;
  titleEn: string;
  bodyHe: string;
  bodyEn: string;
  channels: NotificationChannel[];
  category: NotificationCategory;
  priority: NotificationPriority;
}> = {
  // Booking Templates
  BOOKING_CONFIRMED: {
    titleHe: "ההזמנה אושרה! ✅",
    titleEn: "Booking Confirmed! ✅",
    bodyHe: "ההזמנה שלך ל-{{serviceName}} אושרה לתאריך {{date}} בשעה {{time}}.",
    bodyEn: "Your {{serviceName}} booking is confirmed for {{date}} at {{time}}.",
    channels: ["PUSH", "EMAIL", "WHATSAPP"],
    category: "BOOKING",
    priority: "HIGH",
  },
  BOOKING_REMINDER_24H: {
    titleHe: "תזכורת: מחר יש לך הזמנה 📅",
    titleEn: "Reminder: Booking Tomorrow 📅",
    bodyHe: "רק להזכיר - מחר {{date}} בשעה {{time}} יש לך {{serviceName}} עם {{providerName}}.",
    bodyEn: "Just a reminder - tomorrow {{date}} at {{time}} you have {{serviceName}} with {{providerName}}.",
    channels: ["PUSH", "SMS"],
    category: "REMINDER",
    priority: "NORMAL",
  },
  BOOKING_STARTED: {
    titleHe: "השירות התחיל! 🐾",
    titleEn: "Service Started! 🐾",
    bodyHe: "{{providerName}} התחיל/ה את השירות. תוכל/י לעקוב בזמן אמת באפליקציה.",
    bodyEn: "{{providerName}} has started the service. Track progress in the app.",
    channels: ["PUSH", "IN_APP"],
    category: "BOOKING",
    priority: "HIGH",
  },
  BOOKING_COMPLETED: {
    titleHe: "השירות הסתיים! ⭐",
    titleEn: "Service Completed! ⭐",
    bodyHe: "{{serviceName}} הסתיים בהצלחה! נשמח אם תדרג/י את {{providerName}}.",
    bodyEn: "{{serviceName}} completed successfully! Please rate {{providerName}}.",
    channels: ["PUSH", "EMAIL"],
    category: "BOOKING",
    priority: "NORMAL",
  },
  BOOKING_CANCELLED: {
    titleHe: "ההזמנה בוטלה",
    titleEn: "Booking Cancelled",
    bodyHe: "ההזמנה שלך ל-{{serviceName}} בתאריך {{date}} בוטלה. {{refundInfo}}",
    bodyEn: "Your {{serviceName}} booking on {{date}} was cancelled. {{refundInfo}}",
    channels: ["PUSH", "EMAIL", "SMS"],
    category: "BOOKING",
    priority: "HIGH",
  },

  // Payment Templates
  PAYMENT_SUCCESS: {
    titleHe: "התשלום התקבל! 💳",
    titleEn: "Payment Received! 💳",
    bodyHe: "קיבלנו את התשלום שלך בסך ₪{{amount}}. תודה!",
    bodyEn: "We received your payment of ₪{{amount}}. Thank you!",
    channels: ["PUSH", "EMAIL"],
    category: "PAYMENT",
    priority: "NORMAL",
  },
  PAYMENT_FAILED: {
    titleHe: "בעיה בתשלום ⚠️",
    titleEn: "Payment Issue ⚠️",
    bodyHe: "לא הצלחנו לחייב את כרטיס האשראי שלך. אנא עדכן/י את פרטי התשלום.",
    bodyEn: "We couldn't charge your card. Please update your payment details.",
    channels: ["PUSH", "EMAIL", "SMS"],
    category: "PAYMENT",
    priority: "URGENT",
  },
  REFUND_PROCESSED: {
    titleHe: "הזיכוי בוצע 💰",
    titleEn: "Refund Processed 💰",
    bodyHe: "הזיכוי בסך ₪{{amount}} בוצע בהצלחה. יגיע לחשבונך תוך 5-10 ימי עסקים.",
    bodyEn: "Your refund of ₪{{amount}} has been processed. It will arrive within 5-10 business days.",
    channels: ["EMAIL", "PUSH"],
    category: "PAYMENT",
    priority: "NORMAL",
  },

  // Referral Templates
  REFERRAL_SIGNUP: {
    titleHe: "חבר נרשם בזכותך! 🎉",
    titleEn: "Friend Signed Up! 🎉",
    bodyHe: "מישהו השתמש בקישור ההפניה שלך ונרשם! כשישלם בפעם הראשונה, שניכם תקבלו ₪25.",
    bodyEn: "Someone used your referral link and signed up! When they pay, you'll both get ₪25.",
    channels: ["PUSH", "IN_APP"],
    category: "REFERRAL",
    priority: "NORMAL",
  },
  REFERRAL_COMPLETED: {
    titleHe: "קיבלת ₪25 קרדיט! 🎁",
    titleEn: "You Got ₪25 Credit! 🎁",
    bodyHe: "החבר ששלחת שילם בפעם הראשונה! קיבלת ₪25 קרדיט לחשבונך.",
    bodyEn: "Your referred friend made their first payment! You got ₪25 credit.",
    channels: ["PUSH", "EMAIL", "WHATSAPP"],
    category: "REFERRAL",
    priority: "HIGH",
  },
  REFERRAL_LEVEL_UP: {
    titleHe: "עלית רמה! 🏆",
    titleEn: "Level Up! 🏆",
    bodyHe: "מזל טוב! עלית לרמת {{levelName}} בתוכנית ההפניות. המשך/י לשתף!",
    bodyEn: "Congrats! You reached {{levelName}} level in the referral program. Keep sharing!",
    channels: ["PUSH", "EMAIL"],
    category: "REFERRAL",
    priority: "NORMAL",
  },

  // Loyalty Templates
  LOYALTY_POINTS_EARNED: {
    titleHe: "צברת {{points}} נקודות! ⭐",
    titleEn: "You Earned {{points}} Points! ⭐",
    bodyHe: "נקודות הנאמנות שלך עודכנו. יתרה נוכחית: {{balance}} נקודות.",
    bodyEn: "Your loyalty points updated. Current balance: {{balance}} points.",
    channels: ["IN_APP"],
    category: "LOYALTY",
    priority: "LOW",
  },
  LOYALTY_TIER_UPGRADE: {
    titleHe: "עלית דרגה ל-{{tierName}}! 🌟",
    titleEn: "Upgraded to {{tierName}}! 🌟",
    bodyHe: "מזל טוב! עלית לדרגת {{tierName}} ונפתחו לך הטבות חדשות.",
    bodyEn: "Congrats! You've been upgraded to {{tierName}} with new benefits.",
    channels: ["PUSH", "EMAIL"],
    category: "LOYALTY",
    priority: "HIGH",
  },
  BIRTHDAY_REWARD: {
    titleHe: "יום הולדת שמח! 🎂🎁",
    titleEn: "Happy Birthday! 🎂🎁",
    bodyHe: "מזל טוב ליום ההולדת! קיבלת מאיתנו {{reward}} כמתנה.",
    bodyEn: "Happy Birthday! We got you {{reward}} as a gift.",
    channels: ["PUSH", "EMAIL", "WHATSAPP"],
    category: "LOYALTY",
    priority: "HIGH",
  },

  // Security Templates
  NEW_DEVICE_LOGIN: {
    titleHe: "התחברות ממכשיר חדש 🔐",
    titleEn: "New Device Login 🔐",
    bodyHe: "זוהתה התחברות לחשבונך ממכשיר חדש. אם לא את/ה - שנה סיסמה מיד.",
    bodyEn: "A new device logged into your account. If this wasn't you, change your password immediately.",
    channels: ["EMAIL", "SMS"],
    category: "SECURITY",
    priority: "URGENT",
  },
  PASSWORD_CHANGED: {
    titleHe: "הסיסמה שונתה בהצלחה 🔒",
    titleEn: "Password Changed Successfully 🔒",
    bodyHe: "הסיסמה שלך עודכנה בהצלחה. אם לא ביקשת זאת, פנה/י אלינו מיד.",
    bodyEn: "Your password was updated. If you didn't request this, contact us immediately.",
    channels: ["EMAIL", "PUSH"],
    category: "SECURITY",
    priority: "HIGH",
  },

  // Provider Templates
  NEW_BOOKING_REQUEST: {
    titleHe: "הזמנה חדשה! 📥",
    titleEn: "New Booking Request! 📥",
    bodyHe: "קיבלת בקשת הזמנה חדשה מ-{{customerName}} לתאריך {{date}}. אשר/י בהקדם!",
    bodyEn: "New booking request from {{customerName}} for {{date}}. Please confirm!",
    channels: ["PUSH", "SMS"],
    category: "BOOKING",
    priority: "URGENT",
  },
  PAYOUT_SENT: {
    titleHe: "העברת התשלום בדרך! 💸",
    titleEn: "Payout on the Way! 💸",
    bodyHe: "העברנו לחשבונך ₪{{amount}}. יגיע תוך 2-3 ימי עסקים.",
    bodyEn: "We sent ₪{{amount}} to your account. Arrives in 2-3 business days.",
    channels: ["EMAIL", "PUSH"],
    category: "PAYMENT",
    priority: "NORMAL",
  },
};

// ============================================
// 3. USER PREFERENCES
// ============================================

export interface UserNotificationPreferences {
  userId: string;
  channels: {
    PUSH: boolean;
    EMAIL: boolean;
    SMS: boolean;
    WHATSAPP: boolean;
    IN_APP: boolean;
  };
  categories: {
    BOOKING: boolean;
    PAYMENT: boolean;
    REFERRAL: boolean;
    LOYALTY: boolean;
    MARKETING: boolean;
    SYSTEM: boolean;
    SECURITY: boolean;
    REMINDER: boolean;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM
    endTime: string;
    timezone: string;
  };
  preferredLanguage: "he" | "en";
}

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const prefSnap = await db.collection("notificationPreferences").doc(userId).get();
  
  if (!prefSnap.exists) {
    // Return defaults
    return {
      userId,
      channels: { PUSH: true, EMAIL: true, SMS: true, WHATSAPP: true, IN_APP: true },
      categories: {
        BOOKING: true, PAYMENT: true, REFERRAL: true, LOYALTY: true,
        MARKETING: true, SYSTEM: true, SECURITY: true, REMINDER: true,
      },
      preferredLanguage: "he",
    };
  }
  
  return prefSnap.data() as UserNotificationPreferences;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<UserNotificationPreferences>
): Promise<void> {
  await db.collection("notificationPreferences").doc(userId).set(
    { userId, ...updates, updatedAt: admin.firestore.Timestamp.now() },
    { merge: true }
  );
}

// ============================================
// 4. SEND NOTIFICATION
// ============================================

export async function sendNotification(payload: NotificationPayload): Promise<string[]> {
  const template = NOTIFICATION_TEMPLATES[payload.templateId];
  if (!template) {
    throw new Error(`Template not found: ${payload.templateId}`);
  }
  
  // Get user preferences
  const prefs = await getUserNotificationPreferences(payload.userId);
  
  // Filter channels based on preferences
  const requestedChannels = payload.channels || template.channels;
  const allowedChannels = requestedChannels.filter(ch => 
    prefs.channels[ch] && prefs.categories[payload.category]
  );
  
  // Check quiet hours
  if (prefs.quietHours?.enabled) {
    const now = new Date();
    const currentTime = now.toLocaleTimeString("en-US", { 
      hour12: false, 
      hour: "2-digit", 
      minute: "2-digit",
      timeZone: prefs.quietHours.timezone 
    });
    
    if (currentTime >= prefs.quietHours.startTime && currentTime <= prefs.quietHours.endTime) {
      // During quiet hours - only allow URGENT priority
      if (payload.priority !== "URGENT") {
        // Schedule for after quiet hours
        // For now, skip non-urgent during quiet hours
        return [];
      }
    }
  }
  
  // Render templates
  const lang = prefs.preferredLanguage;
  const title = renderTemplate(lang === "he" ? template.titleHe : template.titleEn, payload.variables);
  const body = renderTemplate(lang === "he" ? template.bodyHe : template.bodyEn, payload.variables);
  
  const notificationIds: string[] = [];
  
  // Queue notifications for each channel
  for (const channel of allowedChannels) {
    const notifRef = db.collection("notifications").doc();
    const notification: NotificationRecord = {
      id: notifRef.id,
      userId: payload.userId,
      templateId: payload.templateId,
      channel,
      category: payload.category,
      priority: payload.priority || template.priority,
      title,
      body,
      data: payload.metadata,
      status: "PENDING",
      createdAt: admin.firestore.Timestamp.now(),
    };
    
    await notifRef.set(notification);
    notificationIds.push(notifRef.id);
    
    // Queue for actual sending
    await db.collection("notificationQueue").add({
      notificationId: notifRef.id,
      channel,
      userId: payload.userId,
      title,
      body,
      data: payload.metadata,
      scheduledAt: payload.scheduledAt 
        ? admin.firestore.Timestamp.fromDate(payload.scheduledAt)
        : admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
    });
  }
  
  return notificationIds;
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ============================================
// 5. NOTIFICATION WORKERS (to be called by Cloud Functions)
// ============================================

export async function processPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  // Get user's FCM tokens
  const tokensSnap = await db.collection("fcmTokens")
    .where("userId", "==", userId)
    .get();
  
  if (tokensSnap.empty) return false;
  
  const tokens = tokensSnap.docs.map(doc => doc.data().token);
  
  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data: data as Record<string, string>,
    android: {
      priority: "high",
      notification: { channelId: "petwash_main" },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  };
  
  const response = await admin.messaging().sendEachForMulticast(message);
  return response.successCount > 0;
}

export async function processEmailNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  // Get user email
  const userSnap = await db.collection("users").doc(userId).get();
  const user = userSnap.data();
  
  if (!user?.email) return false;
  
  // Queue for SendGrid (actual sending done by separate worker)
  await db.collection("emailQueue").add({
    to: user.email,
    subject: title,
    body,
    templateData: data,
    createdAt: admin.firestore.Timestamp.now(),
  });
  
  return true;
}

export async function processSMSNotification(
  userId: string,
  body: string
): Promise<boolean> {
  // Get user phone
  const userSnap = await db.collection("users").doc(userId).get();
  const user = userSnap.data();
  
  if (!user?.phone) return false;
  
  // Queue for Twilio
  await db.collection("smsQueue").add({
    to: user.phone,
    body,
    createdAt: admin.firestore.Timestamp.now(),
  });
  
  return true;
}

export async function processWhatsAppNotification(
  userId: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  // Get user phone
  const userSnap = await db.collection("users").doc(userId).get();
  const user = userSnap.data();
  
  if (!user?.phone) return false;
  
  // Queue for WhatsApp Business API
  await db.collection("whatsappQueue").add({
    to: user.phone,
    body,
    templateData: data,
    createdAt: admin.firestore.Timestamp.now(),
  });
  
  return true;
}

// ============================================
// 6. TRIGGERED JOURNEYS
// ============================================

export interface Journey {
  id: string;
  name: string;
  trigger: {
    event: string;
    conditions?: Record<string, any>;
  };
  steps: {
    delay: number; // minutes
    templateId: string;
    conditions?: Record<string, any>;
  }[];
  isActive: boolean;
}

export const PREDEFINED_JOURNEYS: Journey[] = [
  {
    id: "welcome_series",
    name: "Welcome Series",
    trigger: { event: "USER_SIGNUP" },
    steps: [
      { delay: 0, templateId: "WELCOME_EMAIL" },
      { delay: 60 * 24, templateId: "COMPLETE_PROFILE_REMINDER" }, // 24 hours
      { delay: 60 * 24 * 3, templateId: "FIRST_BOOKING_INCENTIVE" }, // 3 days
    ],
    isActive: true,
  },
  {
    id: "referral_milestones",
    name: "Referral Milestones",
    trigger: { event: "REFERRAL_COMPLETED" },
    steps: [
      { delay: 0, templateId: "REFERRAL_COMPLETED" },
      { delay: 60 * 24 * 7, templateId: "REFERRAL_KEEP_SHARING" }, // 7 days
    ],
    isActive: true,
  },
  {
    id: "post_booking",
    name: "Post Booking Flow",
    trigger: { event: "BOOKING_COMPLETED" },
    steps: [
      { delay: 30, templateId: "BOOKING_COMPLETED" }, // 30 min after
      { delay: 60 * 24, templateId: "REQUEST_REVIEW" }, // 24 hours
      { delay: 60 * 24 * 7, templateId: "REBOOK_REMINDER" }, // 7 days
    ],
    isActive: true,
  },
];

// ============================================
// EXPORTS
// ============================================

export default {
  NOTIFICATION_TEMPLATES,
  PREDEFINED_JOURNEYS,
  getUserNotificationPreferences,
  updateNotificationPreferences,
  sendNotification,
  processPushNotification,
  processEmailNotification,
  processSMSNotification,
  processWhatsAppNotification,
};
