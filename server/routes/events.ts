import express, { Router } from 'express';
import { requireAdmin } from '../adminAuth';
import { db } from '../db';
import { domainEvents } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { eventPublisher } from '../services/EventPublisher';
import { z } from 'zod';

const router = Router();

const paginationSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const validation = paginationSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        details: validation.error.errors,
      });
    }

    const { limit, offset } = validation.data;

    logger.info('[Events API] Fetching recent events', { limit, offset });

    const events = await db
      .select()
      .from(domainEvents)
      .orderBy(desc(domainEvents.occurredAt))
      .limit(Math.min(limit, 100))
      .offset(offset);

    const total = await db
      .select({ count: sql`count(*)` })
      .from(domainEvents);

    res.json({
      events,
      pagination: {
        limit,
        offset,
        total: parseInt(total[0].count as string, 10),
      },
    });
  } catch (error: any) {
    logger.error('[Events API] Failed to fetch events', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch events',
      message: error.message,
    });
  }
});

router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[Events API] Fetching event by ID', { eventId: id });

    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventId, id))
      .limit(1);

    if (events.length === 0) {
      return res.status(404).json({
        error: 'Event not found',
        eventId: id,
      });
    }

    res.json(events[0]);
  } catch (error: any) {
    logger.error('[Events API] Failed to fetch event', {
      eventId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch event',
      message: error.message,
    });
  }
});

router.get('/type/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const validation = paginationSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        details: validation.error.errors,
      });
    }

    const { limit, offset } = validation.data;

    logger.info('[Events API] Fetching events by type', { type, limit, offset });

    const events = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.eventType, type))
      .orderBy(desc(domainEvents.occurredAt))
      .limit(Math.min(limit, 100))
      .offset(offset);

    const total = await db
      .select({ count: sql`count(*)` })
      .from(domainEvents)
      .where(eq(domainEvents.eventType, type));

    res.json({
      events,
      eventType: type,
      pagination: {
        limit,
        offset,
        total: parseInt(total[0].count as string, 10),
      },
    });
  } catch (error: any) {
    logger.error('[Events API] Failed to fetch events by type', {
      type: req.params.type,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch events by type',
      message: error.message,
    });
  }
});

router.post('/replay/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[Events API] Replaying event', { eventId: id });

    await eventPublisher.replayEvent(id);

    res.json({
      success: true,
      message: 'Event replayed successfully',
      eventId: id,
    });
  } catch (error: any) {
    logger.error('[Events API] Failed to replay event', {
      eventId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to replay event',
      message: error.message,
    });
  }
});

router.get('/aggregate/:aggregateType/:aggregateId', requireAdmin, async (req, res) => {
  try {
    const { aggregateType, aggregateId } = req.params;
    const validation = paginationSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        details: validation.error.errors,
      });
    }

    const { limit, offset } = validation.data;

    logger.info('[Events API] Fetching events by aggregate', {
      aggregateType,
      aggregateId,
      limit,
      offset,
    });

    const events = await db
      .select()
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.aggregateType, aggregateType),
          eq(domainEvents.aggregateId, aggregateId)
        )
      )
      .orderBy(desc(domainEvents.occurredAt))
      .limit(Math.min(limit, 100))
      .offset(offset);

    res.json({
      events,
      aggregate: {
        type: aggregateType,
        id: aggregateId,
      },
      pagination: {
        limit,
        offset,
        total: events.length,
      },
    });
  } catch (error: any) {
    logger.error('[Events API] Failed to fetch events by aggregate', {
      aggregateType: req.params.aggregateType,
      aggregateId: req.params.aggregateId,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch events by aggregate',
      message: error.message,
    });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    logger.info('[Events API] Fetching event statistics');

    const stats = await db
      .select({
        eventType: domainEvents.eventType,
        count: sql`count(*)`,
      })
      .from(domainEvents)
      .groupBy(domainEvents.eventType);

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await db
      .select({ count: sql`count(*)` })
      .from(domainEvents)
      .where(gte(domainEvents.occurredAt, last24Hours));

    const unpublished = await db
      .select({ count: sql`count(*)` })
      .from(domainEvents)
      .where(eq(domainEvents.isPublished, false));

    res.json({
      byType: stats.map(s => ({
        eventType: s.eventType,
        count: parseInt(s.count as string, 10),
      })),
      last24Hours: parseInt(recentCount[0].count as string, 10),
      unpublished: parseInt(unpublished[0].count as string, 10),
    });
  } catch (error: any) {
    logger.error('[Events API] Failed to fetch event statistics', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch event statistics',
      message: error.message,
    });
  }
});

export default router;
