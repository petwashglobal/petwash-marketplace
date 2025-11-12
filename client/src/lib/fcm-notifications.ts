import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { app } from './firebase';
import { logger } from './logger';
import { db as firestore } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

let messagingInstance: Messaging | null = null;

// Generate unique device ID for this browser/device
function getDeviceId(): string {
  let deviceId = localStorage.getItem('fcm_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('fcm_device_id', deviceId);
  }
  return deviceId;
}

// Get user-friendly device name
function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browserName = 'Unknown Browser';
  let osName = 'Unknown OS';
  
  // Detect browser
  if (ua.includes('Chrome')) browserName = 'Chrome';
  else if (ua.includes('Firefox')) browserName = 'Firefox';
  else if (ua.includes('Safari')) browserName = 'Safari';
  else if (ua.includes('Edge')) browserName = 'Edge';
  
  // Detect OS
  if (ua.includes('Windows')) osName = 'Windows';
  else if (ua.includes('Mac')) osName = 'macOS';
  else if (ua.includes('Linux')) osName = 'Linux';
  else if (ua.includes('Android')) osName = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS';
  
  return `${browserName} on ${osName}`;
}

// VAPID key for Firebase Cloud Messaging (Web Push)
// This will be set from environment variable
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Initialize Firebase Cloud Messaging
 * Only works in browsers that support Service Workers and Notifications API
 */
export async function initializeFCM(): Promise<Messaging | null> {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      logger.info('[FCM] Notifications not supported in this browser');
      return null;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      logger.info('[FCM] Service Workers not supported');
      return null;
    }

    // Check if VAPID key is configured
    if (!VAPID_KEY) {
      logger.warn('[FCM] VAPID key not configured - push notifications disabled');
      logger.info('[FCM] Set VITE_FIREBASE_VAPID_KEY in Replit Secrets to enable push notifications');
      return null;
    }

    // Initialize Firebase Messaging
    messagingInstance = getMessaging(app);
    logger.info('[FCM] Firebase Cloud Messaging initialized successfully');
    
    // Set up foreground message handler
    setupForegroundMessageHandler(messagingInstance);
    
    return messagingInstance;
  } catch (error) {
    logger.error('[FCM] Failed to initialize Firebase Cloud Messaging:', error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 * Saves token to Firestore for the user
 */
export async function requestNotificationPermission(userId: string): Promise<string | null> {
  try {
    // Request permission from user
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      logger.info('[FCM] Notification permission denied by user');
      return null;
    }

    logger.info('[FCM] Notification permission granted');

    // Initialize messaging if not already done
    if (!messagingInstance) {
      messagingInstance = await initializeFCM();
      if (!messagingInstance) {
        return null;
      }
    }

    // Get FCM token
    const token = await getToken(messagingInstance, { 
      vapidKey: VAPID_KEY 
    });

    if (!token) {
      logger.warn('[FCM] No registration token available');
      return null;
    }

    logger.info('[FCM] FCM Token obtained successfully');

    // Save token to Firestore
    await saveFCMToken(userId, token);

    return token;
  } catch (error) {
    logger.error('[FCM] Error requesting notification permission:', error);
    return null;
  }
}

/**
 * Save FCM token to Firestore (multi-device support)
 */
async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();
    
    const deviceTokenRef = doc(firestore, 'fcmTokens', userId, 'devices', deviceId);
    await setDoc(deviceTokenRef, {
      token,
      userId,
      deviceId,
      deviceName,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: new Date(),
      browser: navigator.userAgent,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    }, { merge: true });
    
    logger.info(`[FCM] Token saved for device ${deviceId} (${deviceName})`);
  } catch (error) {
    logger.error('[FCM] Failed to save token to Firestore:', error);
    throw error;
  }
}

/**
 * Delete FCM token for current device (on logout)
 */
export async function deleteFCMToken(userId: string): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const deviceTokenRef = doc(firestore, 'fcmTokens', userId, 'devices', deviceId);
    await deleteDoc(deviceTokenRef);
    logger.info(`[FCM] Token deleted for device ${deviceId}`);
  } catch (error) {
    logger.error('[FCM] Failed to delete token from Firestore:', error);
  }
}

/**
 * Delete all FCM tokens for a user (all devices)
 */
export async function deleteAllFCMTokens(userId: string): Promise<void> {
  try {
    const devicesRef = collection(firestore, 'fcmTokens', userId, 'devices');
    const snapshot = await getDocs(devicesRef);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    logger.info(`[FCM] Deleted ${snapshot.size} device tokens for user ${userId}`);
  } catch (error) {
    logger.error('[FCM] Failed to delete all tokens:', error);
  }
}

/**
 * Handle foreground messages (when app is open)
 */
function setupForegroundMessageHandler(messaging: Messaging): void {
  onMessage(messaging, (payload) => {
    logger.info('[FCM] Foreground message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Pet Wash™';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/brand/petwash-logo-official.png',
      badge: '/brand/petwash-logo-official.png',
      tag: payload.data?.tag || 'default',
      data: payload.data,
      requireInteraction: false,
    };

    // Show browser notification
    if (Notification.permission === 'granted') {
      new Notification(notificationTitle, notificationOptions);
    }

    // Optionally trigger a custom event for UI updates
    const event = new CustomEvent('fcm-message', { detail: payload });
    window.dispatchEvent(event);
  });
}

/**
 * Check if notifications are supported and enabled
 */
export function areNotificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Check if VAPID key is configured
 */
export function isVAPIDKeyConfigured(): boolean {
  return !!VAPID_KEY;
}
