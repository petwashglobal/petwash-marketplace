/**
 * PetWash™ Analytics Events Schema 2025
 * 
 * Centralized event tracking for:
 * - Google Analytics 4
 * - BigQuery export
 * - Internal dashboards
 * - Cohort analysis
 * - LTV/CAC tracking
 * - Marketing attribution
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================
// 1. EVENT CATEGORIES
// ============================================

export type EventCategory =
  | "USER"
  | "BOOKING"
  | "PAYMENT"
  | "REFERRAL"
  | "LOYALTY"
  | "PROVIDER"
  | "IOT"
  | "MARKETING"
  | "SUPPORT"
  | "SECURITY";

// ============================================
// 2. EVENT DEFINITIONS
// ============================================

export const EVENT_SCHEMA = {
  // User Events
  USER_SIGNUP: {
    category: "USER" as EventCategory,
    description: "User created account",
    properties: {
      method: "string", // google, email, phone, apple
      referralCode: "string?",
      source: "string", // web, app, kiosk
      campaign: "string?",
    },
  },
  USER_LOGIN: {
    category: "USER" as EventCategory,
    description: "User logged in",
    properties: {
      method: "string",
      deviceType: "string",
      isNewDevice: "boolean",
    },
  },
  USER_PROFILE_COMPLETED: {
    category: "USER" as EventCategory,
    description: "User completed profile setup",
    properties: {
      completionPercentage: "number",
      fieldsCompleted: "string[]",
    },
  },
  USER_PET_ADDED: {
    category: "USER" as EventCategory,
    description: "User added a pet to profile",
    properties: {
      petId: "string",
      species: "string",
      breed: "string?",
    },
  },

  // Booking Events
  BOOKING_STARTED: {
    category: "BOOKING" as EventCategory,
    description: "User started booking flow",
    properties: {
      platformId: "string",
      mode: "string",
      source: "string",
    },
  },
  BOOKING_SLOT_SELECTED: {
    category: "BOOKING" as EventCategory,
    description: "User selected a time slot",
    properties: {
      platformId: "string",
      date: "string",
      time: "string",
      providerId: "string?",
    },
  },
  BOOKING_CREATED: {
    category: "BOOKING" as EventCategory,
    description: "Booking was created",
    properties: {
      bookingId: "string",
      platformId: "string",
      mode: "string",
      totalPriceILS: "number",
      petCount: "number",
      providerId: "string?",
      stationId: "string?",
    },
  },
  BOOKING_CONFIRMED: {
    category: "BOOKING" as EventCategory,
    description: "Booking was confirmed by provider/system",
    properties: {
      bookingId: "string",
      confirmationTimeMinutes: "number",
    },
  },
  BOOKING_IN_PROGRESS: {
    category: "BOOKING" as EventCategory,
    description: "Service has started",
    properties: {
      bookingId: "string",
      actualStartTime: "string",
    },
  },
  BOOKING_COMPLETED: {
    category: "BOOKING" as EventCategory,
    description: "Service completed successfully",
    properties: {
      bookingId: "string",
      durationMinutes: "number",
      rating: "number?",
    },
  },
  BOOKING_CANCELLED: {
    category: "BOOKING" as EventCategory,
    description: "Booking was cancelled",
    properties: {
      bookingId: "string",
      cancelledBy: "string", // customer, provider, system
      reason: "string?",
      minutesBeforeStart: "number",
    },
  },
  BOOKING_ABANDONED: {
    category: "BOOKING" as EventCategory,
    description: "User abandoned booking flow",
    properties: {
      platformId: "string",
      stepReached: "string",
      timeSpentSeconds: "number",
    },
  },

  // Payment Events
  PAYMENT_INITIATED: {
    category: "PAYMENT" as EventCategory,
    description: "Payment process started",
    properties: {
      bookingId: "string",
      amountILS: "number",
      paymentMethod: "string",
    },
  },
  PAYMENT_SUCCESS: {
    category: "PAYMENT" as EventCategory,
    description: "Payment completed successfully",
    properties: {
      bookingId: "string",
      transactionId: "string",
      amountILS: "number",
      paymentMethod: "string",
      source: "string", // NAYAX, APP, WEB
    },
  },
  PAYMENT_FAILED: {
    category: "PAYMENT" as EventCategory,
    description: "Payment failed",
    properties: {
      bookingId: "string",
      errorCode: "string",
      errorMessage: "string",
    },
  },
  REFUND_PROCESSED: {
    category: "PAYMENT" as EventCategory,
    description: "Refund was processed",
    properties: {
      bookingId: "string",
      amountILS: "number",
      reason: "string",
    },
  },
  CREDITS_APPLIED: {
    category: "PAYMENT" as EventCategory,
    description: "Credits were applied to payment",
    properties: {
      bookingId: "string",
      creditsUsedILS: "number",
      source: "string", // referral, loyalty, promo
    },
  },

  // Referral Events
  REFERRAL_LINK_VIEWED: {
    category: "REFERRAL" as EventCategory,
    description: "Referral link was clicked",
    properties: {
      referralCode: "string",
      source: "string", // whatsapp, sms, email, copy
    },
  },
  REFERRAL_SIGNUP: {
    category: "REFERRAL" as EventCategory,
    description: "New user signed up via referral",
    properties: {
      referralCode: "string",
      referrerId: "string",
      newUserId: "string",
    },
  },
  REFERRAL_COMPLETED: {
    category: "REFERRAL" as EventCategory,
    description: "Referral completed (first payment made)",
    properties: {
      referralId: "string",
      referrerId: "string",
      refereeId: "string",
      creditAmountILS: "number",
    },
  },
  REFERRAL_LEVEL_UP: {
    category: "REFERRAL" as EventCategory,
    description: "User reached new referral level",
    properties: {
      userId: "string",
      previousLevel: "string",
      newLevel: "string",
      totalReferrals: "number",
    },
  },

  // Loyalty Events
  LOYALTY_POINTS_EARNED: {
    category: "LOYALTY" as EventCategory,
    description: "User earned loyalty points",
    properties: {
      userId: "string",
      points: "number",
      source: "string", // booking, referral, bonus
      bookingId: "string?",
    },
  },
  LOYALTY_POINTS_REDEEMED: {
    category: "LOYALTY" as EventCategory,
    description: "User redeemed loyalty points",
    properties: {
      userId: "string",
      points: "number",
      rewardType: "string",
      bookingId: "string?",
    },
  },
  LOYALTY_TIER_CHANGED: {
    category: "LOYALTY" as EventCategory,
    description: "User tier changed",
    properties: {
      userId: "string",
      previousTier: "string",
      newTier: "string",
      direction: "string", // up, down
    },
  },

  // Provider Events
  PROVIDER_SIGNUP: {
    category: "PROVIDER" as EventCategory,
    description: "New provider signed up",
    properties: {
      providerId: "string",
      platformIds: "string[]",
      region: "string",
    },
  },
  PROVIDER_APPROVED: {
    category: "PROVIDER" as EventCategory,
    description: "Provider was approved",
    properties: {
      providerId: "string",
      approvalTimeHours: "number",
    },
  },
  PROVIDER_AVAILABILITY_UPDATED: {
    category: "PROVIDER" as EventCategory,
    description: "Provider updated availability",
    properties: {
      providerId: "string",
      slotsAdded: "number",
      slotsRemoved: "number",
    },
  },
  PROVIDER_PAYOUT_SENT: {
    category: "PROVIDER" as EventCategory,
    description: "Payout sent to provider",
    properties: {
      providerId: "string",
      amountILS: "number",
      bookingCount: "number",
    },
  },

  // IoT Events
  STATION_ACTIVATED: {
    category: "IOT" as EventCategory,
    description: "K9000 station was activated",
    properties: {
      stationId: "string",
      bookingId: "string",
      activationType: "string", // qr, nfc, app
    },
  },
  STATION_SESSION_COMPLETED: {
    category: "IOT" as EventCategory,
    description: "K9000 session completed",
    properties: {
      stationId: "string",
      bookingId: "string",
      durationMinutes: "number",
      packageType: "string",
    },
  },
  STATION_ERROR: {
    category: "IOT" as EventCategory,
    description: "K9000 station error",
    properties: {
      stationId: "string",
      errorCode: "string",
      errorMessage: "string",
      severity: "string",
    },
  },
  CONSUMABLE_LOW: {
    category: "IOT" as EventCategory,
    description: "Station consumable running low",
    properties: {
      stationId: "string",
      consumableType: "string", // shampoo, water, towels
      remainingPercent: "number",
    },
  },

  // Marketing Events
  CAMPAIGN_CLICK: {
    category: "MARKETING" as EventCategory,
    description: "Marketing campaign link clicked",
    properties: {
      campaignId: "string",
      source: "string",
      medium: "string",
      content: "string?",
    },
  },
  PROMO_CODE_APPLIED: {
    category: "MARKETING" as EventCategory,
    description: "Promo code was applied",
    properties: {
      code: "string",
      discountILS: "number",
      bookingId: "string",
    },
  },
  EMAIL_OPENED: {
    category: "MARKETING" as EventCategory,
    description: "Marketing email was opened",
    properties: {
      emailId: "string",
      campaignId: "string",
    },
  },
  EMAIL_CLICKED: {
    category: "MARKETING" as EventCategory,
    description: "Link in marketing email clicked",
    properties: {
      emailId: "string",
      campaignId: "string",
      linkId: "string",
    },
  },

  // Security Events
  SUSPICIOUS_ACTIVITY: {
    category: "SECURITY" as EventCategory,
    description: "Suspicious activity detected",
    properties: {
      userId: "string",
      activityType: "string",
      severity: "string",
      details: "object",
    },
  },
  FRAUD_DETECTED: {
    category: "SECURITY" as EventCategory,
    description: "Fraud was detected",
    properties: {
      userId: "string",
      fraudType: "string",
      actionTaken: "string",
    },
  },
} as const;

export type EventName = keyof typeof EVENT_SCHEMA;

// ============================================
// 3. EVENT TRACKING FUNCTIONS
// ============================================

export interface TrackEventOptions {
  eventName: EventName;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp?: Date;
}

export async function trackEvent(options: TrackEventOptions): Promise<string> {
  const schema = EVENT_SCHEMA[options.eventName];
  
  const eventDoc = db.collection("analyticsEvents").doc();
  
  const event = {
    id: eventDoc.id,
    name: options.eventName,
    category: schema.category,
    userId: options.userId || null,
    sessionId: options.sessionId || null,
    properties: options.properties,
    timestamp: options.timestamp 
      ? admin.firestore.Timestamp.fromDate(options.timestamp)
      : admin.firestore.Timestamp.now(),
    environment: process.env.NODE_ENV || "development",
    appVersion: process.env.APP_VERSION || "1.0.0",
  };
  
  await eventDoc.set(event);
  
  // Also push to real-time stream for dashboards
  await db.collection("analyticsStream").add({
    ...event,
    processedAt: admin.firestore.Timestamp.now(),
  });
  
  return eventDoc.id;
}

// ============================================
// 4. AGGREGATION QUERIES
// ============================================

export async function getDailyStats(date: string): Promise<{
  signups: number;
  bookings: number;
  revenue: number;
  activeUsers: number;
}> {
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);
  
  const [signupsSnap, bookingsSnap, paymentsSnap] = await Promise.all([
    db.collection("analyticsEvents")
      .where("name", "==", "USER_SIGNUP")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .get(),
    db.collection("analyticsEvents")
      .where("name", "==", "BOOKING_CREATED")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .get(),
    db.collection("analyticsEvents")
      .where("name", "==", "PAYMENT_SUCCESS")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
      .get(),
  ]);
  
  const revenue = paymentsSnap.docs.reduce(
    (sum, doc) => sum + (doc.data().properties?.amountILS || 0),
    0
  );
  
  const uniqueUsers = new Set([
    ...signupsSnap.docs.map(d => d.data().userId),
    ...bookingsSnap.docs.map(d => d.data().userId),
    ...paymentsSnap.docs.map(d => d.data().userId),
  ].filter(Boolean));
  
  return {
    signups: signupsSnap.size,
    bookings: bookingsSnap.size,
    revenue: Math.round(revenue),
    activeUsers: uniqueUsers.size,
  };
}

export async function getUserLTV(userId: string): Promise<{
  totalSpentILS: number;
  bookingCount: number;
  firstBookingDate: Date | null;
  lastBookingDate: Date | null;
  averageOrderValueILS: number;
}> {
  const paymentsSnap = await db.collection("analyticsEvents")
    .where("name", "==", "PAYMENT_SUCCESS")
    .where("userId", "==", userId)
    .orderBy("timestamp", "asc")
    .get();
  
  if (paymentsSnap.empty) {
    return {
      totalSpentILS: 0,
      bookingCount: 0,
      firstBookingDate: null,
      lastBookingDate: null,
      averageOrderValueILS: 0,
    };
  }
  
  const payments = paymentsSnap.docs.map(d => ({
    amount: d.data().properties?.amountILS || 0,
    date: d.data().timestamp?.toDate(),
  }));
  
  const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
  
  return {
    totalSpentILS: Math.round(totalSpent),
    bookingCount: payments.length,
    firstBookingDate: payments[0]?.date || null,
    lastBookingDate: payments[payments.length - 1]?.date || null,
    averageOrderValueILS: Math.round(totalSpent / payments.length),
  };
}

export async function getCohortRetention(
  cohortMonth: string // YYYY-MM
): Promise<Record<number, number>> {
  // Get users who signed up in the cohort month
  const startDate = new Date(`${cohortMonth}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  
  const signupsSnap = await db.collection("analyticsEvents")
    .where("name", "==", "USER_SIGNUP")
    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startDate))
    .where("timestamp", "<", admin.firestore.Timestamp.fromDate(endDate))
    .get();
  
  const cohortUsers = signupsSnap.docs.map(d => d.data().userId).filter(Boolean);
  
  if (cohortUsers.length === 0) return {};
  
  // Check activity in subsequent months
  const retention: Record<number, number> = { 0: 100 };
  
  for (let monthOffset = 1; monthOffset <= 12; monthOffset++) {
    const checkStart = new Date(startDate);
    checkStart.setMonth(checkStart.getMonth() + monthOffset);
    const checkEnd = new Date(checkStart);
    checkEnd.setMonth(checkEnd.getMonth() + 1);
    
    if (checkStart > new Date()) break;
    
    const activitySnap = await db.collection("analyticsEvents")
      .where("category", "==", "BOOKING")
      .where("userId", "in", cohortUsers.slice(0, 10)) // Firestore limit
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(checkStart))
      .where("timestamp", "<", admin.firestore.Timestamp.fromDate(checkEnd))
      .get();
    
    const activeUsers = new Set(activitySnap.docs.map(d => d.data().userId));
    retention[monthOffset] = Math.round((activeUsers.size / cohortUsers.length) * 100);
  }
  
  return retention;
}

// ============================================
// EXPORTS
// ============================================

export default {
  EVENT_SCHEMA,
  trackEvent,
  getDailyStats,
  getUserLTV,
  getCohortRetention,
};
