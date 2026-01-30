import { db as firestore } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { Timestamp } from 'firebase-admin/firestore';
export class NotificationConsentManager {
    DATA_RETENTION_DAYS = 2555;
    async recordNotificationConsent(consent) {
        try {
            const consentDoc = {
                userId: consent.userId,
                email: consent.email,
                provider: consent.provider,
                categories: consent.categories,
                deviceInfo: consent.deviceInfo || null,
                consent: {
                    granted: consent.consent.granted,
                    timestamp: Timestamp.fromDate(consent.consent.timestamp),
                    ipAddress: consent.consent.ipAddress,
                    userAgent: consent.consent.userAgent,
                },
                gdprCompliance: consent.gdprCompliance,
                auditLog: {
                    createdAt: Timestamp.now(),
                    action: consent.consent.granted ? 'granted' : 'revoked',
                },
            };
            await firestore
                .collection('notification_consents')
                .doc(`${consent.userId}_${consent.provider}`)
                .set(consentDoc, { merge: true });
            if (consent.deviceInfo?.fcmToken || consent.deviceInfo?.apnsToken) {
                await this.registerDeviceToken(consent);
            }
            logger.info('[NotificationConsent] Consent recorded', {
                userId: consent.userId,
                provider: consent.provider,
                granted: consent.consent.granted,
            });
        }
        catch (error) {
            logger.error('[NotificationConsent] Failed to record consent:', error);
            throw error;
        }
    }
    async registerDeviceToken(consent) {
        if (!consent.deviceInfo)
            return;
        try {
            const tokenDoc = {
                userId: consent.userId,
                deviceId: consent.deviceInfo.deviceId,
                deviceName: consent.deviceInfo.deviceName,
                platform: consent.deviceInfo.platform,
                fcmToken: consent.deviceInfo.fcmToken || null,
                apnsToken: consent.deviceInfo.apnsToken || null,
                provider: consent.provider,
                active: consent.consent.granted,
                categories: consent.categories,
                registeredAt: Timestamp.now(),
                lastUsed: Timestamp.now(),
            };
            await firestore
                .collection('notification_tokens')
                .doc(consent.deviceInfo.deviceId)
                .set(tokenDoc, { merge: true });
            logger.info('[NotificationConsent] Device token registered', {
                userId: consent.userId,
                deviceId: consent.deviceInfo.deviceId,
                provider: consent.provider,
            });
        }
        catch (error) {
            logger.error('[NotificationConsent] Failed to register device token:', error);
        }
    }
    async getUserPreferences(userId) {
        try {
            const prefDoc = await firestore
                .collection('notification_preferences')
                .doc(userId)
                .get();
            if (!prefDoc.exists) {
                const defaultPreferences = this.getDefaultPreferences(userId);
                await this.saveUserPreferences(defaultPreferences);
                return defaultPreferences;
            }
            const data = prefDoc.data();
            return {
                userId: data.userId,
                globalEnabled: data.globalEnabled,
                categories: data.categories,
                channels: data.channels,
                quietHours: data.quietHours || undefined,
                lastUpdated: data.lastUpdated.toDate(),
            };
        }
        catch (error) {
            logger.error('[NotificationConsent] Error getting user preferences:', error);
            return null;
        }
    }
    async saveUserPreferences(preferences) {
        try {
            await firestore
                .collection('notification_preferences')
                .doc(preferences.userId)
                .set({
                ...preferences,
                lastUpdated: Timestamp.fromDate(preferences.lastUpdated),
            });
            logger.info('[NotificationConsent] User preferences saved', {
                userId: preferences.userId,
            });
        }
        catch (error) {
            logger.error('[NotificationConsent] Error saving preferences:', error);
            throw error;
        }
    }
    getDefaultPreferences(userId) {
        return {
            userId,
            globalEnabled: false,
            categories: {
                promotions: false,
                updates: false,
                securityAlerts: true,
                loyaltyRewards: false,
                orderStatus: true,
                appointments: true,
            },
            channels: {
                push: false,
                email: true,
                sms: false,
            },
            lastUpdated: new Date(),
        };
    }
    async checkUserConsent(userId, provider, category) {
        try {
            const preferences = await this.getUserPreferences(userId);
            if (!preferences)
                return false;
            if (!preferences.globalEnabled)
                return false;
            const categoryEnabled = preferences.categories[category];
            if (!categoryEnabled)
                return false;
            const channelMapping = {
                fcm: 'push',
                apns: 'push',
                sms: 'sms',
                email: 'email',
            };
            const channel = channelMapping[provider];
            const channelEnabled = preferences.channels[channel];
            if (!channelEnabled)
                return false;
            if (preferences.quietHours?.enabled) {
                const isQuietHour = this.isInQuietHours(preferences.quietHours);
                if (isQuietHour && category !== 'securityAlerts') {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            logger.error('[NotificationConsent] Error checking user consent:', error);
            return false;
        }
    }
    isInQuietHours(quietHours) {
        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const [startHour, startMinute] = quietHours.startTime.split(':').map(Number);
            const [endHour, endMinute] = quietHours.endTime.split(':').map(Number);
            const currentMinutes = currentHour * 60 + currentMinute;
            const startMinutes = startHour * 60 + startMinute;
            const endMinutes = endHour * 60 + endMinute;
            if (startMinutes < endMinutes) {
                return currentMinutes >= startMinutes && currentMinutes < endMinutes;
            }
            else {
                return currentMinutes >= startMinutes || currentMinutes < endMinutes;
            }
        }
        catch (error) {
            logger.error('[NotificationConsent] Error checking quiet hours:', error);
            return false;
        }
    }
    async getActiveDeviceTokens(userId, provider) {
        try {
            let query = firestore
                .collection('notification_tokens')
                .where('userId', '==', userId)
                .where('active', '==', true);
            if (provider) {
                query = query.where('provider', '==', provider);
            }
            const tokensSnapshot = await query.get();
            return tokensSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    deviceId: data.deviceId,
                    token: data.fcmToken || data.apnsToken,
                    platform: data.platform,
                };
            }).filter((t) => t.token);
        }
        catch (error) {
            logger.error('[NotificationConsent] Error getting device tokens:', error);
            return [];
        }
    }
    async revokeAllConsents(userId) {
        try {
            const batch = firestore.batch();
            const consentsSnapshot = await firestore
                .collection('notification_consents')
                .where('userId', '==', userId)
                .get();
            consentsSnapshot.docs.forEach((doc) => {
                batch.update(doc.ref, {
                    'consent.granted': false,
                    'auditLog.revokedAt': Timestamp.now(),
                    'auditLog.action': 'revoked_all',
                });
            });
            const tokensSnapshot = await firestore
                .collection('notification_tokens')
                .where('userId', '==', userId)
                .get();
            tokensSnapshot.docs.forEach((doc) => {
                batch.update(doc.ref, {
                    active: false,
                    deactivatedAt: Timestamp.now(),
                });
            });
            await batch.commit();
            logger.info('[NotificationConsent] All consents revoked for user', { userId });
        }
        catch (error) {
            logger.error('[NotificationConsent] Error revoking consents:', error);
            throw error;
        }
    }
    async getConsentAuditLog(userId) {
        try {
            const consentsSnapshot = await firestore
                .collection('notification_consents')
                .where('userId', '==', userId)
                .get();
            return consentsSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    provider: data.provider,
                    granted: data.consent.granted,
                    timestamp: data.consent.timestamp.toDate(),
                    auditLog: data.auditLog,
                };
            });
        }
        catch (error) {
            logger.error('[NotificationConsent] Error getting audit log:', error);
            return [];
        }
    }
    async cleanupOldData() {
        try {
            const cutoffDate = Timestamp.fromDate(new Date(Date.now() - this.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000));
            const oldConsentsQuery = firestore
                .collection('notification_consents')
                .where('consent.timestamp', '<', cutoffDate);
            const oldConsentsSnapshot = await oldConsentsQuery.get();
            const batch = firestore.batch();
            oldConsentsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            if (oldConsentsSnapshot.size > 0) {
                await batch.commit();
            }
            const oldTokensQuery = firestore
                .collection('notification_tokens')
                .where('active', '==', false)
                .where('deactivatedAt', '<', cutoffDate);
            const oldTokensSnapshot = await oldTokensQuery.get();
            const tokensBatch = firestore.batch();
            oldTokensSnapshot.docs.forEach((doc) => {
                tokensBatch.delete(doc.ref);
            });
            if (oldTokensSnapshot.size > 0) {
                await tokensBatch.commit();
            }
            logger.info('[NotificationConsent] Old data cleanup complete', {
                consentsDeleted: oldConsentsSnapshot.size,
                tokensDeleted: oldTokensSnapshot.size,
                cutoffDate: cutoffDate.toDate().toISOString(),
                retentionDays: this.DATA_RETENTION_DAYS,
            });
        }
        catch (error) {
            logger.error('[NotificationConsent] Error during cleanup:', error);
        }
    }
}
export const notificationConsentManager = new NotificationConsentManager();
