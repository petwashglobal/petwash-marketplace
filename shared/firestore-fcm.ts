import { z } from 'zod';

/**
 * Firestore Schema for FCM (Firebase Cloud Messaging) Tokens
 * 
 * MULTI-DEVICE SUPPORT:
 * Collection: fcmTokens/{userId}/devices/{deviceId}
 * 
 * This allows each user to have multiple FCM tokens for different devices
 * (desktop, mobile, tablet, etc.)
 */

export const fcmDeviceTokenSchema = z.object({
  token: z.string().min(1, { message: "FCM token is required" }),
  userId: z.string().min(1, { message: "User ID is required" }),
  deviceId: z.string().min(1, { message: "Device ID is required" }), // Unique device identifier
  deviceName: z.string().optional(), // User-friendly name (e.g., "Chrome on MacBook")
  createdAt: z.date(),
  updatedAt: z.date(),
  lastUsed: z.date().optional(),
  browser: z.string().optional(),
  platform: z.string().optional(),
  userAgent: z.string().optional(),
});

export type FCMDeviceToken = z.infer<typeof fcmDeviceTokenSchema>;

/**
 * Firestore paths for FCM tokens (multi-device support)
 */
export const FCM_TOKENS_PATH = 'fcmTokens';
export const getFCMDevicesPath = (userId: string) => `fcmTokens/${userId}/devices`;
export const getFCMDeviceTokenPath = (userId: string, deviceId: string) => `fcmTokens/${userId}/devices/${deviceId}`;

/**
 * Notification payload schema for sending push notifications
 */
export const pushNotificationSchema = z.object({
  userId: z.string().optional(), // If specified, send to specific user (all devices)
  userIds: z.array(z.string()).optional(), // If specified, send to multiple users (all their devices)
  deviceId: z.string().optional(), // If specified with userId, send to specific device only
  title: z.string().min(1, { message: "Notification title is required" }),
  body: z.string().min(1, { message: "Notification message is required" }),
  icon: z.string().optional(),
  badge: z.string().optional(),
  tag: z.string().optional(),
  url: z.string().optional(), // URL to open when notification is clicked
  data: z.record(z.string()).optional(), // Custom data
  requireInteraction: z.boolean().optional(),
});

export type PushNotification = z.infer<typeof pushNotificationSchema>;
