import { db } from '../db';
import { domainEvents } from '@shared/schema';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { EventBus } from './EventBus';
import { eq } from 'drizzle-orm';
export class EventPublisher {
    static instance;
    eventBus;
    constructor() {
        this.eventBus = new EventBus();
    }
    static getInstance() {
        if (!EventPublisher.instance) {
            EventPublisher.instance = new EventPublisher();
        }
        return EventPublisher.instance;
    }
    async publishEvent(eventType, payload, metadata) {
        const eventId = `evt_${nanoid(24)}`;
        const occurredAt = new Date().toISOString();
        try {
            const event = {
                id: eventId,
                type: eventType,
                occurredAt,
                aggregateType: metadata?.aggregateType,
                aggregateId: metadata?.aggregateId,
                payload,
                metadata: metadata || {},
            };
            logger.info('[EventPublisher] Publishing domain event', {
                eventId,
                eventType,
                aggregateType: metadata?.aggregateType,
                aggregateId: metadata?.aggregateId,
            });
            await db.insert(domainEvents).values({
                eventId,
                eventType,
                aggregateType: metadata?.aggregateType || null,
                aggregateId: metadata?.aggregateId || null,
                payload: payload,
                metadata: metadata || null,
                version: 1,
                occurredAt: new Date(),
                isPublished: false,
            });
            await this.eventBus.publish({
                eventType,
                timestamp: occurredAt,
                platform: 'petwash',
                userId: metadata?.userId,
                data: {
                    eventId,
                    ...payload,
                },
            });
            await db
                .update(domainEvents)
                .set({
                isPublished: true,
                publishedAt: new Date(),
            })
                .where(eq(domainEvents.eventId, eventId));
            logger.info('[EventPublisher] Event published successfully', { eventId, eventType });
            return eventId;
        }
        catch (error) {
            logger.error('[EventPublisher] Failed to publish event', {
                eventId,
                eventType,
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    async replayEvent(eventId) {
        try {
            const events = await db
                .select()
                .from(domainEvents)
                .where(eq(domainEvents.eventId, eventId))
                .limit(1);
            if (events.length === 0) {
                throw new Error(`Event not found: ${eventId}`);
            }
            const storedEvent = events[0];
            await this.eventBus.publish({
                eventType: storedEvent.eventType,
                timestamp: storedEvent.occurredAt.toISOString(),
                platform: 'petwash',
                userId: storedEvent.metadata?.userId,
                data: {
                    eventId: storedEvent.eventId,
                    isReplay: true,
                    ...storedEvent.payload,
                },
            });
            logger.info('[EventPublisher] Event replayed successfully', { eventId });
        }
        catch (error) {
            logger.error('[EventPublisher] Failed to replay event', {
                eventId,
                error: error.message,
            });
            throw error;
        }
    }
}
export const eventPublisher = EventPublisher.getInstance();
