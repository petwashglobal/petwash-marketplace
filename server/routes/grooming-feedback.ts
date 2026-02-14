import { Router, Request, Response } from 'express';
import { db } from '../db';
import { groomingFeedback, stations, insertGroomingFeedbackSchema } from '@shared/schema';
import { eq, and, desc, sql, avg, count } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const router = Router();

async function optionalAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(token);
      (req as any).userId = decodedToken.uid;
      (req as any).userEmail = decodedToken.email;
      (req as any).userName = decodedToken.name || decodedToken.email || 'Anonymous';
    }
    next();
  } catch (error) {
    next();
  }
}

async function requireAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    (req as any).userId = decodedToken.uid;
    (req as any).userEmail = decodedToken.email;
    (req as any).userName = decodedToken.name || decodedToken.email || 'Anonymous';
    next();
  } catch (error) {
    logger.error('[GroomingFeedback] Auth error', error);
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

const FLAGGED_WORDS = ['scam', 'fraud', 'dangerous', 'injury', 'hurt', 'lawsuit', 'sue', 'stolen'];

router.post('/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const userName = (req as any).userName;

    const submitSchema = insertGroomingFeedbackSchema.extend({
      stationId: z.coerce.number().int().positive(),
      overallRating: z.coerce.number().int().min(1).max(5),
      cleanlinessRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
      equipmentRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
      valueRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
      easeOfUseRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
      comment: z.string().max(1000).optional().nullable(),
      petName: z.string().max(50).optional().nullable(),
      petType: z.string().optional().nullable(),
      serviceType: z.string().optional().nullable(),
      wouldRecommend: z.boolean().optional().nullable(),
    }).omit({ feedbackId: true, customerId: true, customerName: true, isFlagged: true, flaggedReason: true, isVisible: true, isPublic: true, adminResponse: true, adminRespondedAt: true, adminRespondedBy: true, photos: true });

    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { stationId, overallRating, cleanlinessRating, equipmentRating, valueRating, easeOfUseRating, comment, petName, petType, serviceType, wouldRecommend } = parsed.data;

    const [station] = await db.select().from(stations).where(eq(stations.id, stationId)).limit(1);
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    let isFlagged = false;
    let flaggedReason: string | null = null;
    if (comment) {
      const commentLower = comment.toLowerCase();
      for (const word of FLAGGED_WORDS) {
        if (commentLower.includes(word)) {
          isFlagged = true;
          flaggedReason = `Contains flagged keyword: ${word}`;
          break;
        }
      }
    }

    const feedbackId = `GF-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

    const [newFeedback] = await db.insert(groomingFeedback).values({
      feedbackId,
      stationId,
      customerId: userId,
      customerName: userName,
      petName: petName || null,
      petType: petType || null,
      serviceType: serviceType || 'self_service_wash',
      overallRating,
      cleanlinessRating: cleanlinessRating || null,
      equipmentRating: equipmentRating || null,
      valueRating: valueRating || null,
      easeOfUseRating: easeOfUseRating || null,
      comment: comment || null,
      wouldRecommend: wouldRecommend ?? null,
      isFlagged,
      flaggedReason,
    }).returning();

    logger.info('[GroomingFeedback] New feedback submitted', {
      feedbackId,
      stationId,
      overallRating,
      customerId: userId,
      isFlagged,
    });

    return res.status(201).json({
      success: true,
      feedbackId: newFeedback.feedbackId,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    logger.error('[GroomingFeedback] Submit error', error);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

router.get('/station/:stationId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { stationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    const [station] = await db.select().from(stations).where(eq(stations.id, parseInt(stationId))).limit(1);
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const [stats] = await db
      .select({
        totalReviews: count(),
        avgOverall: avg(groomingFeedback.overallRating),
        avgCleanliness: avg(groomingFeedback.cleanlinessRating),
        avgEquipment: avg(groomingFeedback.equipmentRating),
        avgValue: avg(groomingFeedback.valueRating),
        avgEaseOfUse: avg(groomingFeedback.easeOfUseRating),
        recommendCount: sql<number>`COUNT(CASE WHEN ${groomingFeedback.wouldRecommend} = true THEN 1 END)`,
      })
      .from(groomingFeedback)
      .where(and(
        eq(groomingFeedback.stationId, parseInt(stationId)),
        eq(groomingFeedback.isVisible, true)
      ));

    const ratingDistribution = await db
      .select({
        rating: groomingFeedback.overallRating,
        count: count(),
      })
      .from(groomingFeedback)
      .where(and(
        eq(groomingFeedback.stationId, parseInt(stationId)),
        eq(groomingFeedback.isVisible, true)
      ))
      .groupBy(groomingFeedback.overallRating)
      .orderBy(desc(groomingFeedback.overallRating));

    const reviews = await db
      .select({
        id: groomingFeedback.id,
        feedbackId: groomingFeedback.feedbackId,
        customerName: groomingFeedback.customerName,
        petName: groomingFeedback.petName,
        petType: groomingFeedback.petType,
        serviceType: groomingFeedback.serviceType,
        overallRating: groomingFeedback.overallRating,
        cleanlinessRating: groomingFeedback.cleanlinessRating,
        equipmentRating: groomingFeedback.equipmentRating,
        valueRating: groomingFeedback.valueRating,
        easeOfUseRating: groomingFeedback.easeOfUseRating,
        comment: groomingFeedback.comment,
        wouldRecommend: groomingFeedback.wouldRecommend,
        adminResponse: groomingFeedback.adminResponse,
        createdAt: groomingFeedback.createdAt,
      })
      .from(groomingFeedback)
      .where(and(
        eq(groomingFeedback.stationId, parseInt(stationId)),
        eq(groomingFeedback.isVisible, true),
        eq(groomingFeedback.isPublic, true)
      ))
      .orderBy(desc(groomingFeedback.createdAt))
      .limit(limit)
      .offset(offset);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach(r => {
      distribution[r.rating] = Number(r.count);
    });

    return res.json({
      station: {
        id: station.id,
        name: station.name,
        nameHe: station.nameHe,
        stationCode: station.stationCode,
      },
      stats: {
        totalReviews: Number(stats.totalReviews),
        averageRating: stats.avgOverall ? parseFloat(Number(stats.avgOverall).toFixed(1)) : 0,
        averageCleanliness: stats.avgCleanliness ? parseFloat(Number(stats.avgCleanliness).toFixed(1)) : 0,
        averageEquipment: stats.avgEquipment ? parseFloat(Number(stats.avgEquipment).toFixed(1)) : 0,
        averageValue: stats.avgValue ? parseFloat(Number(stats.avgValue).toFixed(1)) : 0,
        averageEaseOfUse: stats.avgEaseOfUse ? parseFloat(Number(stats.avgEaseOfUse).toFixed(1)) : 0,
        recommendPercentage: stats.totalReviews > 0
          ? Math.round((Number(stats.recommendCount) / Number(stats.totalReviews)) * 100)
          : 0,
        distribution,
      },
      reviews,
      pagination: {
        page,
        limit,
        total: Number(stats.totalReviews),
        totalPages: Math.ceil(Number(stats.totalReviews) / limit),
      },
    });
  } catch (error) {
    logger.error('[GroomingFeedback] Station reviews error', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/my-reviews', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const reviews = await db
      .select()
      .from(groomingFeedback)
      .where(eq(groomingFeedback.customerId, userId))
      .orderBy(desc(groomingFeedback.createdAt))
      .limit(50);

    return res.json({ reviews });
  } catch (error) {
    logger.error('[GroomingFeedback] My reviews error', error);
    return res.status(500).json({ error: 'Failed to fetch your reviews' });
  }
});

router.get('/stations/top-rated', async (_req: Request, res: Response) => {
  try {
    const topStations = await db
      .select({
        stationId: groomingFeedback.stationId,
        stationName: stations.name,
        stationNameHe: stations.nameHe,
        stationCode: stations.stationCode,
        avgRating: avg(groomingFeedback.overallRating),
        totalReviews: count(),
      })
      .from(groomingFeedback)
      .innerJoin(stations, eq(groomingFeedback.stationId, stations.id))
      .where(eq(groomingFeedback.isVisible, true))
      .groupBy(groomingFeedback.stationId, stations.name, stations.nameHe, stations.stationCode)
      .orderBy(desc(avg(groomingFeedback.overallRating)))
      .limit(10);

    return res.json({
      stations: topStations.map(s => ({
        ...s,
        avgRating: s.avgRating ? parseFloat(Number(s.avgRating).toFixed(1)) : 0,
        totalReviews: Number(s.totalReviews),
      })),
    });
  } catch (error) {
    logger.error('[GroomingFeedback] Top rated error', error);
    return res.status(500).json({ error: 'Failed to fetch top rated stations' });
  }
});

router.get('/all-stations', async (_req: Request, res: Response) => {
  try {
    const allStations = await db
      .select({
        id: stations.id,
        name: stations.name,
        nameHe: stations.nameHe,
        stationCode: stations.stationCode,
        status: stations.status,
      })
      .from(stations)
      .where(eq(stations.isActive, true))
      .orderBy(stations.name);

    return res.json({ stations: allStations });
  } catch (error) {
    logger.error('[GroomingFeedback] All stations error', error);
    return res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

export default router;
