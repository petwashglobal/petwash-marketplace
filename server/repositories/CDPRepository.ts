import { db } from '../db';
import { user360Profiles, userActivity, aiSegments } from '../../shared/schema-unified-platform';
import { eq, desc, and, gte, lte, sql, inArray } from 'drizzle-orm';

export interface User360Profile {
  id: string;
  userId: string;
  totalSpending: string;
  totalTransactions: number;
  platformsUsed: any;
  favoriteService: string | null;
  loyaltyTier: string;
  lifecycleStage: string;
  firstPurchaseDate: Date | null;
  lastActivityDate: Date | null;
  segments: any;
  predictedChurnProbability: string | null;
  predictedLifetimeValue: string | null;
  location: string | null;
  preferredLanguage: string;
  lastUpdated: Date;
}

export interface UserActivityRecord {
  id: string;
  userId: string;
  platform: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: any;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}

export interface AISegment {
  id: string;
  name: string;
  description: string | null;
  criteria: any;
  userCount: number;
  aiGenerated: boolean;
  lastRefreshed: Date | null;
  createdAt: Date;
}

export class CDPRepository {
  async getProfile(userId: string): Promise<User360Profile | null> {
    const result = await db.select().from(user360Profiles).where(eq(user360Profiles.userId, userId)).limit(1);
    return result[0] || null;
  }

  async createProfile(userId: string): Promise<User360Profile> {
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

  async updateProfile(userId: string, updates: Partial<User360Profile>): Promise<User360Profile> {
    const result = await db.update(user360Profiles)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(user360Profiles.userId, userId))
      .returning();
    return result[0];
  }

  async trackActivity(activity: {
    userId: string;
    platform: string;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: any;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserActivityRecord> {
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

  async getActivityHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      platform?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<UserActivityRecord[]> {
    const { limit = 100, offset = 0, platform, startDate, endDate } = options;
    
    const conditions: any[] = [eq(userActivity.userId, userId)];
    if (platform) conditions.push(eq(userActivity.platform, platform));
    if (startDate) conditions.push(gte(userActivity.timestamp, startDate));
    if (endDate) conditions.push(lte(userActivity.timestamp, endDate));
    
    return await db.select()
      .from(userActivity)
      .where(and(...conditions))
      .orderBy(desc(userActivity.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getPlatformUsage(userId: string): Promise<any[]> {
    const result = await db.select({
      platform: userActivity.platform,
      actionCount: sql<number>`COUNT(*)::int`,
      lastActivity: sql<Date>`MAX(${userActivity.timestamp})`,
    }).from(userActivity)
      .where(eq(userActivity.userId, userId))
      .groupBy(userActivity.platform);
    
    return result;
  }

  async calculateLoyaltyTier(totalSpending: number): Promise<string> {
    if (totalSpending >= 10000) return 'platinum';
    if (totalSpending >= 5000) return 'gold';
    if (totalSpending >= 1000) return 'silver';
    return 'bronze';
  }

  async calculateLifecycleStage(profile: User360Profile): Promise<string> {
    const daysSinceLastActivity = profile.lastActivityDate 
      ? Math.floor((Date.now() - profile.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    if (!profile.firstPurchaseDate) return 'new';
    if (daysSinceLastActivity > 90) return 'churned';
    if (daysSinceLastActivity > 30) return 'at_risk';
    if (profile.totalTransactions > 10) return 'loyal';
    if (profile.totalTransactions > 0) return 'active';
    return 'engaged';
  }

  async createSegment(segment: {
    name: string;
    description?: string;
    criteria: any;
    aiGenerated?: boolean;
  }): Promise<AISegment> {
    const result = await db.insert(aiSegments).values({
      name: segment.name,
      description: segment.description || null,
      criteria: segment.criteria,
      userCount: 0,
      aiGenerated: segment.aiGenerated || false,
    }).returning();
    return result[0];
  }

  async getSegments(): Promise<AISegment[]> {
    return await db.select().from(aiSegments).orderBy(desc(aiSegments.createdAt));
  }

  async updateSegmentUserCount(segmentId: string, count: number): Promise<void> {
    await db.update(aiSegments)
      .set({ userCount: count, lastRefreshed: new Date() })
      .where(eq(aiSegments.id, segmentId));
  }

  async getUsersBySegment(segmentId: string): Promise<User360Profile[]> {
    const segment = await db.select().from(aiSegments).where(eq(aiSegments.id, segmentId)).limit(1);
    if (!segment[0]) return [];
    
    // For now, return users matching the segment criteria (simplified)
    return await db.select().from(user360Profiles).limit(100);
  }

  async addUserToSegment(userId: string, segmentName: string): Promise<void> {
    const profile = await this.getProfile(userId);
    if (!profile) return;
    
    const segments = Array.isArray(profile.segments) ? profile.segments : [];
    if (!segments.includes(segmentName)) {
      segments.push(segmentName);
      await this.updateProfile(userId, { segments });
    }
  }
}

export const cdpRepository = new CDPRepository();
