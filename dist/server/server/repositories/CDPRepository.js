import { db } from '../db';
import { user360Profiles, userActivity, aiSegments } from '../../shared/schema-unified-platform';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
export class CDPRepository {
    async getProfile(userId) {
        const result = await db.select().from(user360Profiles).where(eq(user360Profiles.userId, userId)).limit(1);
        return result[0] || null;
    }
    async createProfile(userId) {
        const result = await db.insert(user360Profiles).values({
            userId,
            totalSpending: '0.00',
            totalTransactions: 0,
            platformsUsed: [],
            loyaltyTier: 'bronze',
            lifecycleStage: 'new',
            segments: [],
            preferredLanguage: 'he',
        }).returning();
        return result[0];
    }
    async updateProfile(userId, updates) {
        const result = await db.update(user360Profiles)
            .set({ ...updates, lastUpdated: new Date() })
            .where(eq(user360Profiles.userId, userId))
            .returning();
        return result[0];
    }
    async trackActivity(activity) {
        const result = await db.insert(userActivity).values({
            userId: activity.userId,
            platform: activity.platform,
            action: activity.action,
            resource: activity.resource || null,
            resourceId: activity.resourceId || null,
            metadata: activity.metadata || null,
            sessionId: activity.sessionId || null,
            ipAddress: activity.ipAddress || null,
            userAgent: activity.userAgent || null,
        }).returning();
        return result[0];
    }
    async getActivityHistory(userId, options = {}) {
        const { limit = 100, offset = 0, platform, startDate, endDate } = options;
        const conditions = [eq(userActivity.userId, userId)];
        if (platform)
            conditions.push(eq(userActivity.platform, platform));
        if (startDate)
            conditions.push(gte(userActivity.timestamp, startDate));
        if (endDate)
            conditions.push(lte(userActivity.timestamp, endDate));
        return await db.select()
            .from(userActivity)
            .where(and(...conditions))
            .orderBy(desc(userActivity.timestamp))
            .limit(limit)
            .offset(offset);
    }
    async getPlatformUsage(userId) {
        const result = await db.select({
            platform: userActivity.platform,
            actionCount: sql `COUNT(*)::int`,
            lastActivity: sql `MAX(${userActivity.timestamp})`,
        }).from(userActivity)
            .where(eq(userActivity.userId, userId))
            .groupBy(userActivity.platform);
        return result;
    }
    async calculateLoyaltyTier(totalSpending) {
        if (totalSpending >= 10000)
            return 'platinum';
        if (totalSpending >= 5000)
            return 'gold';
        if (totalSpending >= 1000)
            return 'silver';
        return 'bronze';
    }
    async calculateLifecycleStage(profile) {
        const daysSinceLastActivity = profile.lastActivityDate
            ? Math.floor((Date.now() - profile.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
            : 999;
        if (!profile.firstPurchaseDate)
            return 'new';
        if (daysSinceLastActivity > 90)
            return 'churned';
        if (daysSinceLastActivity > 30)
            return 'at_risk';
        if (profile.totalTransactions > 10)
            return 'loyal';
        if (profile.totalTransactions > 0)
            return 'active';
        return 'engaged';
    }
    async createSegment(segment) {
        const result = await db.insert(aiSegments).values({
            name: segment.name,
            description: segment.description || null,
            criteria: segment.criteria,
            userCount: 0,
            aiGenerated: segment.aiGenerated || false,
        }).returning();
        return result[0];
    }
    async getSegments() {
        return await db.select().from(aiSegments).orderBy(desc(aiSegments.createdAt));
    }
    async updateSegmentUserCount(segmentId, count) {
        await db.update(aiSegments)
            .set({ userCount: count, lastRefreshed: new Date() })
            .where(eq(aiSegments.id, segmentId));
    }
    async getUsersBySegment(segmentId) {
        const segment = await db.select().from(aiSegments).where(eq(aiSegments.id, segmentId)).limit(1);
        if (!segment[0])
            return [];
        // For now, return users matching the segment criteria (simplified)
        return await db.select().from(user360Profiles).limit(100);
    }
    async addUserToSegment(userId, segmentName) {
        const profile = await this.getProfile(userId);
        if (!profile)
            return;
        const segments = Array.isArray(profile.segments) ? profile.segments : [];
        if (!segments.includes(segmentName)) {
            segments.push(segmentName);
            await this.updateProfile(userId, { segments });
        }
    }
}
export const cdpRepository = new CDPRepository();
