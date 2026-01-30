import { db } from '../db';
import { notificationPreferences, notificationHistory } from '../../shared/schema-unified-platform';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
export class NotificationRepository {
    async getPreferences(userId) {
        const result = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
        return result[0] || null;
    }
    async createPreferences(userId) {
        const result = await db.insert(notificationPreferences).values({
            userId,
            whatsapp: true,
            email: true,
            sms: true,
            push: true,
            inApp: true,
            platformPreferences: {
                'walk-my-pet': true,
                'sitter-suite': true,
                'pettrek': true,
                'academy': true,
                'wash-hub': true,
                'plush-lab': true,
            },
            marketing: true,
            transactional: true,
            alerts: true,
        }).returning();
        return result[0];
    }
    async updatePreferences(userId, updates) {
        const result = await db.update(notificationPreferences)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(notificationPreferences.userId, userId))
            .returning();
        return result[0];
    }
    async recordNotification(notification) {
        const result = await db.insert(notificationHistory).values({
            userId: notification.userId,
            channel: notification.channel,
            template: notification.template,
            platform: notification.platform || null,
            subject: notification.subject || null,
            content: notification.content,
            metadata: notification.metadata || null,
            status: notification.status || 'sent',
        }).returning();
        return result[0];
    }
    async markDelivered(notificationId) {
        await db.update(notificationHistory)
            .set({ status: 'delivered', deliveredAt: new Date() })
            .where(eq(notificationHistory.id, notificationId));
    }
    async markRead(notificationId) {
        await db.update(notificationHistory)
            .set({ readAt: new Date() })
            .where(eq(notificationHistory.id, notificationId));
    }
    async getHistory(userId, limit = 50, offset = 0) {
        return await db.select()
            .from(notificationHistory)
            .where(eq(notificationHistory.userId, userId))
            .orderBy(desc(notificationHistory.sentAt))
            .limit(limit)
            .offset(offset);
    }
    async getUnreadCount(userId) {
        const result = await db.select({
            count: sql `COUNT(*)::int`
        }).from(notificationHistory)
            .where(and(eq(notificationHistory.userId, userId), eq(notificationHistory.channel, 'in_app'), sql `${notificationHistory.readAt} IS NULL`));
        return result[0]?.count || 0;
    }
    async getChannelStats(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await db.select({
            channel: notificationHistory.channel,
            sent: sql `COUNT(*)::int`,
            delivered: sql `COUNT(*) FILTER (WHERE ${notificationHistory.deliveredAt} IS NOT NULL)::int`,
            read: sql `COUNT(*) FILTER (WHERE ${notificationHistory.readAt} IS NOT NULL)::int`,
        }).from(notificationHistory)
            .where(and(eq(notificationHistory.userId, userId), gte(notificationHistory.sentAt, startDate)))
            .groupBy(notificationHistory.channel);
        return result;
    }
}
export const notificationRepository = new NotificationRepository();
