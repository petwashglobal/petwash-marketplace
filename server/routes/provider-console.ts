import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  providerOperationalSettings,
  providerBlockedList,
  bookingActionsLog,
  providerSafetyNotes,
  providerRateCards,
  walkBookings,
  sitterBookings,
  bookingConversations,
  bookingMessages,
} from '../../shared/schema';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { GoogleGenAI } from '@google/genai';

const router = Router();
router.use(validateFirebaseToken);

const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY! });

// ─── SETTINGS ────────────────────────────────────────────────
/**
 * GET /api/provider-console/settings
 * Returns provider's operational settings, creating defaults on first call.
 */
router.get('/settings', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    let [settings] = await db
      .select()
      .from(providerOperationalSettings)
      .where(eq(providerOperationalSettings.providerUid, uid))
      .limit(1);

    if (!settings) {
      [settings] = await db
        .insert(providerOperationalSettings)
        .values({ providerUid: uid })
        .returning();
    }
    res.json(settings);
  } catch (err) {
    logger.error('GET /provider-console/settings', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/**
 * PUT /api/provider-console/settings
 * Partial update of operational settings.
 */
router.put('/settings', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const allowed = [
      'autoAccept','instantBooking','requireApproval','sameDayBookings',
      'weekendJobs','nightJobs','nightStartHour','nightEndHour',
      'repeatCustomersOnly','newCustomerRequests','notifInApp','notifPush',
      'notifEmail','notifSmsEmergency','aiSuggestions','maxSimultaneous',
      'maxJobsPerDay','bufferMinutes','travelRadiusKm','homeVisitsOnly',
      'holidayMode','holidayStart','holidayEnd','emergencyUnavailable',
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    patch.updatedAt = new Date();

    const [updated] = await db
      .insert(providerOperationalSettings)
      .values({ providerUid: uid, ...patch })
      .onConflictDoUpdate({
        target: providerOperationalSettings.providerUid,
        set: patch,
      })
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error('PUT /provider-console/settings', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── BLOCKED LIST ────────────────────────────────────────────
router.get('/blocked-list', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const entries = await db
      .select()
      .from(providerBlockedList)
      .where(eq(providerBlockedList.providerUid, uid))
      .orderBy(desc(providerBlockedList.createdAt));
    res.json(entries);
  } catch (err) {
    logger.error('GET /provider-console/blocked-list', err);
    res.status(500).json({ error: 'Failed to load blocked list' });
  }
});

router.post('/blocked-list', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { blockedType, blockedRef, blockedName, reason, notes } = req.body;
    if (!blockedType || !blockedRef) {
      return res.status(400).json({ error: 'blockedType and blockedRef are required' });
    }
    const [entry] = await db
      .insert(providerBlockedList)
      .values({ providerUid: uid, blockedType, blockedRef, blockedName, reason, notes })
      .returning();
    res.status(201).json(entry);
  } catch (err) {
    logger.error('POST /provider-console/blocked-list', err);
    res.status(500).json({ error: 'Failed to add to blocked list' });
  }
});

router.delete('/blocked-list/:id', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const id = parseInt(req.params.id, 10);
    await db
      .delete(providerBlockedList)
      .where(and(eq(providerBlockedList.id, id), eq(providerBlockedList.providerUid, uid)));
    res.json({ success: true });
  } catch (err) {
    logger.error('DELETE /provider-console/blocked-list/:id', err);
    res.status(500).json({ error: 'Failed to remove entry' });
  }
});

// ─── SAFETY NOTES ────────────────────────────────────────────
router.get('/safety-notes', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const notes = await db
      .select()
      .from(providerSafetyNotes)
      .where(eq(providerSafetyNotes.providerUid, uid))
      .orderBy(desc(providerSafetyNotes.updatedAt));
    res.json(notes);
  } catch (err) {
    logger.error('GET /provider-console/safety-notes', err);
    res.status(500).json({ error: 'Failed to load safety notes' });
  }
});

router.post('/safety-notes', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { subjectType, subjectId, subjectName, notes, riskLevel } = req.body;
    if (!subjectType || !subjectId || !notes) {
      return res.status(400).json({ error: 'subjectType, subjectId, and notes are required' });
    }
    const [note] = await db
      .insert(providerSafetyNotes)
      .values({ providerUid: uid, subjectType, subjectId, subjectName, notes, riskLevel: riskLevel || 'low' })
      .onConflictDoUpdate({
        target: [providerSafetyNotes.providerUid, providerSafetyNotes.subjectType, providerSafetyNotes.subjectId],
        set: { notes, riskLevel: riskLevel || 'low', subjectName, updatedAt: new Date() },
      })
      .returning();
    res.json(note);
  } catch (err) {
    logger.error('POST /provider-console/safety-notes', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// ─── BOOKING ACTIONS LOG ─────────────────────────────────────
router.get('/booking-actions/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const entries = await db
      .select()
      .from(bookingActionsLog)
      .where(eq(bookingActionsLog.bookingId, bookingId))
      .orderBy(desc(bookingActionsLog.createdAt));
    res.json(entries);
  } catch (err) {
    logger.error('GET /provider-console/booking-actions', err);
    res.status(500).json({ error: 'Failed to load action log' });
  }
});

router.post('/booking-actions/:bookingId', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { bookingId } = req.params;
    const { action, platform, actorRole, reasonCode, notes, metadata } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });

    // Persist action log entry
    const [entry] = await db
      .insert(bookingActionsLog)
      .values({
        bookingId,
        platform: platform || 'walk_my_pet',
        actorUid: uid,
        actorRole: actorRole || 'provider',
        action,
        reasonCode,
        notes,
        metadata,
      })
      .returning();

    // Cascade status update to the actual booking table
    const statusMap: Record<string, string> = {
      accepted: 'confirmed',
      arrived: 'in_progress',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
      no_show: 'no_show',
      disputed: 'disputed',
    };
    const newStatus = statusMap[action];
    if (newStatus && platform === 'walk_my_pet') {
      await db.update(walkBookings)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(walkBookings.bookingId, bookingId));
    } else if (newStatus && platform === 'sitter_suite') {
      await db.update(sitterBookings)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(sitterBookings.bookingId, bookingId));
    }

    res.status(201).json(entry);
  } catch (err) {
    logger.error('POST /provider-console/booking-actions', err);
    res.status(500).json({ error: 'Failed to log action' });
  }
});

// ─── PRICING ─────────────────────────────────────────────────
router.get('/pricing/:platform', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { platform } = req.params;
    const [card] = await db
      .select()
      .from(providerRateCards)
      .where(and(eq(providerRateCards.providerId, uid), eq(providerRateCards.platform, platform)))
      .limit(1);
    res.json(card || null);
  } catch (err) {
    logger.error('GET /provider-console/pricing', err);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

router.put('/pricing/:platform', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { platform } = req.params;
    const {
      serviceType, baseRatePerHourCents, baseRatePerVisitCents, baseRatePerNightCents,
      additionalPetSurchargeCents, weekendSurchargePercent, holidaySurchargePercent,
      nightSurchargePct, urgentSurchargePct, urgentHoursThreshold,
      travelSurchargePerKm, repeatDiscountPct, cancelPolicy24hPct,
      cancelPolicy48hPct, cancelPolicy72hPct, promoParticipation,
      sizeSmallAdjustment, sizeLargeAdjustment, sizeXlargeAdjustment,
      minBookingAmountCents,
    } = req.body;

    const patch = {
      providerId: uid,
      platform,
      serviceType: serviceType || 'general',
      rateCardId: `RATE-${uid}-${platform}`,
      baseRatePerHourCents, baseRatePerVisitCents, baseRatePerNightCents,
      additionalPetSurchargeCents, weekendSurchargePercent, holidaySurchargePercent,
      nightSurchargePct, urgentSurchargePct, urgentHoursThreshold,
      travelSurchargePerKm, repeatDiscountPct, cancelPolicy24hPct,
      cancelPolicy48hPct, cancelPolicy72hPct, promoParticipation,
      sizeSmallAdjustment, sizeLargeAdjustment, sizeXlargeAdjustment,
      minBookingAmountCents,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .insert(providerRateCards)
      .values(patch as any)
      .onConflictDoUpdate({
        target: providerRateCards.rateCardId,
        set: patch as any,
      })
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error('PUT /provider-console/pricing', err);
    res.status(500).json({ error: 'Failed to save pricing' });
  }
});

// ─── PERFORMANCE ─────────────────────────────────────────────
router.get('/performance', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;

    // Walk bookings stats
    const walkStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
        COUNT(*) FILTER (WHERE status = 'confirmed' OR status = 'in_progress') AS active,
        COUNT(*) FILTER (WHERE status = 'no_show')    AS no_show,
        COUNT(*)                                       AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS last_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')   AS today
      FROM walk_bookings WHERE walker_id = ${uid}
    `);

    // Action log stats — acceptance rate
    const actionStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE action = 'accepted')  AS accepted,
        COUNT(*) FILTER (WHERE action = 'rejected')  AS rejected,
        COUNT(*) FILTER (WHERE action = 'cancelled') AS cancelled_actions
      FROM booking_actions_log WHERE actor_uid = ${uid}
    `);

    // Flagged messages in provider's conversations
    const flagStats = await db.execute(sql`
      SELECT COUNT(*) AS flagged_count
      FROM booking_messages bm
      JOIN booking_conversations bc ON bm.conversation_id = bc.conversation_id
      WHERE bc.provider_id = ${uid} AND bm.is_flagged = true
    `);

    const ws = (walkStats.rows?.[0] || {}) as any;
    const as = (actionStats.rows?.[0] || {}) as any;
    const fs = (flagStats.rows?.[0] || {}) as any;

    const total = parseInt(ws.total) || 0;
    const completed = parseInt(ws.completed) || 0;
    const cancelled = parseInt(ws.cancelled) || 0;
    const accepted = parseInt(as.accepted) || 0;
    const rejected = parseInt(as.rejected) || 0;
    const decisionTotal = accepted + rejected;

    res.json({
      bookings: {
        today: parseInt(ws.today) || 0,
        last7d: parseInt(ws.last_7d) || 0,
        last30d: parseInt(ws.last_30d) || 0,
        total,
        completed,
        cancelled,
        active: parseInt(ws.active) || 0,
        noShow: parseInt(ws.no_show) || 0,
      },
      rates: {
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
        acceptanceRate: decisionTotal > 0 ? Math.round((accepted / decisionTotal) * 100) : 0,
      },
      flaggedMessages: parseInt(fs.flagged_count) || 0,
    });
  } catch (err) {
    logger.error('GET /provider-console/performance', err);
    res.status(500).json({ error: 'Failed to load performance data' });
  }
});

// ─── GEMINI AI ASSISTANT ─────────────────────────────────────
router.post('/ai/query', async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    // Gather live provider context to inject
    const [settings] = await db.select().from(providerOperationalSettings)
      .where(eq(providerOperationalSettings.providerUid, uid)).limit(1);

    const upcomingWalkBookings = await db.select({
      bookingId: walkBookings.bookingId,
      status: walkBookings.status,
      scheduledDate: walkBookings.scheduledDate,
      ownerId: walkBookings.ownerId,
    }).from(walkBookings)
      .where(and(eq(walkBookings.walkerId, uid), sql`scheduled_date >= NOW()`))
      .orderBy(walkBookings.scheduledDate)
      .limit(10);

    const context = `
You are Kenzo, the PetWash™ provider business assistant.
Provider UID: ${uid}
Current settings: ${JSON.stringify(settings || {})}
Upcoming bookings (next 10): ${JSON.stringify(upcomingWalkBookings)}
Today: ${new Date().toISOString()}

Answer the provider's question concisely and helpfully. Focus on actionable advice.
If suggesting pricing, reference their current rate card context.
If discussing bookings, reference the actual booking data above.
Provider's question: ${query}
    `.trim();

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: context,
    });

    const text = result.text ?? 'Unable to generate response.';
    res.json({ response: text });
  } catch (err) {
    logger.error('POST /provider-console/ai/query', err);
    res.status(500).json({ error: 'AI query failed' });
  }
});

export default router;
