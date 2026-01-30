/**
 * USER REGISTRATION TRACKING SERVICE
 *
 * Tracks all user registrations with comprehensive stamping:
 * - IP address, location, timezone
 * - Device information
 * - Marketing attribution
 * - Consent tracking
 * - Blockchain-style audit hash chain
 */
import { db } from '../db';
import { userRegistrations } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import * as crypto from 'crypto';
export class UserRegistrationService {
    /**
     * Record a new user registration with full tracking
     */
    static async recordRegistration(data, location, device) {
        try {
            const previousHash = await this.getLastRegistrationHash();
            const registrationData = {
                userId: data.userId,
                email: data.email,
                phone: data.phone,
                firstName: data.firstName,
                lastName: data.lastName,
                registrationType: data.registrationType,
                registrationMethod: data.registrationMethod,
                platformSource: data.platformSource,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                referralCode: data.referralCode,
                referredBy: data.referredBy,
                utmSource: data.utmSource,
                utmMedium: data.utmMedium,
                utmCampaign: data.utmCampaign,
                utmContent: data.utmContent,
                utmTerm: data.utmTerm,
                landingPage: data.landingPage,
                privacyConsentAt: data.privacyConsent ? new Date() : undefined,
                marketingConsentAt: data.marketingConsent ? new Date() : undefined,
                termsAcceptedAt: data.termsAccepted ? new Date() : undefined,
                ageVerifiedAt: data.ageVerified ? new Date() : undefined,
                previousHash,
                ...location,
                ...device,
            };
            const registrationHash = this.computeRegistrationHash(registrationData, previousHash);
            registrationData.registrationHash = registrationHash;
            const [result] = await db.insert(userRegistrations)
                .values(registrationData)
                .returning({ id: userRegistrations.id });
            logger.info('[UserRegistration] Recorded new registration', {
                userId: data.userId,
                email: data.email,
                type: data.registrationType,
                method: data.registrationMethod,
                registrationId: result.id,
            });
            return result.id;
        }
        catch (error) {
            logger.error('[UserRegistration] Failed to record registration', { error, userId: data.userId });
            throw error;
        }
    }
    /**
     * Update registration with email verification
     */
    static async markEmailVerified(userId) {
        await db.update(userRegistrations)
            .set({ emailVerified: true, updatedAt: new Date() })
            .where(eq(userRegistrations.userId, userId));
        logger.info('[UserRegistration] Email verified', { userId });
    }
    /**
     * Update registration with phone verification
     */
    static async markPhoneVerified(userId) {
        await db.update(userRegistrations)
            .set({ phoneVerified: true, updatedAt: new Date() })
            .where(eq(userRegistrations.userId, userId));
        logger.info('[UserRegistration] Phone verified', { userId });
    }
    /**
     * Update last login timestamp
     */
    static async updateLastLogin(userId) {
        await db.update(userRegistrations)
            .set({ lastLoginAt: new Date(), updatedAt: new Date() })
            .where(eq(userRegistrations.userId, userId));
    }
    /**
     * Get registration by user ID
     */
    static async getByUserId(userId) {
        const [registration] = await db.select()
            .from(userRegistrations)
            .where(eq(userRegistrations.userId, userId))
            .limit(1);
        return registration;
    }
    /**
     * Get registration statistics
     */
    static async getStats(days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const registrations = await db.select()
            .from(userRegistrations)
            .orderBy(desc(userRegistrations.registeredAt));
        const recentRegistrations = registrations.filter(r => r.registeredAt && new Date(r.registeredAt) >= since);
        const stats = {
            total: registrations.length,
            last30Days: recentRegistrations.length,
            byType: {},
            byMethod: {},
            byCountry: {},
            byPlatform: {},
        };
        for (const reg of registrations) {
            const type = reg.registrationType || 'unknown';
            const method = reg.registrationMethod || 'unknown';
            const country = reg.country || 'unknown';
            const platform = reg.platformSource || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
            stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
            stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
        }
        return stats;
    }
    /**
     * Parse user agent string for device info
     */
    static parseUserAgent(userAgent) {
        const device = {};
        if (userAgent.includes('iPhone')) {
            device.deviceType = 'mobile';
            device.deviceModel = 'iPhone';
            device.osName = 'iOS';
        }
        else if (userAgent.includes('iPad')) {
            device.deviceType = 'tablet';
            device.deviceModel = 'iPad';
            device.osName = 'iOS';
        }
        else if (userAgent.includes('Android')) {
            device.deviceType = userAgent.includes('Mobile') ? 'mobile' : 'tablet';
            device.osName = 'Android';
        }
        else if (userAgent.includes('Windows')) {
            device.deviceType = 'desktop';
            device.osName = 'Windows';
        }
        else if (userAgent.includes('Macintosh')) {
            device.deviceType = 'desktop';
            device.osName = 'macOS';
        }
        else if (userAgent.includes('Linux')) {
            device.deviceType = 'desktop';
            device.osName = 'Linux';
        }
        if (userAgent.includes('Chrome')) {
            device.browserName = 'Chrome';
            const match = userAgent.match(/Chrome\/(\d+)/);
            if (match)
                device.browserVersion = match[1];
        }
        else if (userAgent.includes('Safari')) {
            device.browserName = 'Safari';
            const match = userAgent.match(/Version\/(\d+)/);
            if (match)
                device.browserVersion = match[1];
        }
        else if (userAgent.includes('Firefox')) {
            device.browserName = 'Firefox';
            const match = userAgent.match(/Firefox\/(\d+)/);
            if (match)
                device.browserVersion = match[1];
        }
        return device;
    }
    /**
     * Get the last registration hash for chain integrity
     */
    static async getLastRegistrationHash() {
        const [last] = await db.select({ hash: userRegistrations.registrationHash })
            .from(userRegistrations)
            .orderBy(desc(userRegistrations.id))
            .limit(1);
        return last?.hash || undefined;
    }
    /**
     * Compute SHA-256 hash for registration record
     */
    static computeRegistrationHash(data, previousHash) {
        const hashData = {
            userId: data.userId,
            email: data.email,
            registrationType: data.registrationType,
            registrationMethod: data.registrationMethod,
            ipAddress: data.ipAddress,
            timestamp: new Date().toISOString(),
            previousHash: previousHash || 'GENESIS',
        };
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(hashData))
            .digest('hex');
    }
}
export default UserRegistrationService;
