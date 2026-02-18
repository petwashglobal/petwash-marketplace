import { Router } from 'express';
import { db } from '../db';
import {
  providerAvailability,
  bookings,
  bookingRequests,
  providers,
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { calendarIntegrationService } from '../services/CalendarIntegrationService';

const ISRAEL_TIMEZONE = 'Asia/Jerusalem';

const router = Router();

function toIsraelDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ISRAEL_TIMEZONE });
}

function todayIsrael(): string {
  return toIsraelDate(new Date());
}

function getIsraelOffset(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const utcHour = probe.getUTCHours();
  const israelHour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: ISRAEL_TIMEZONE }).format(probe),
    10
  );
  const diff = ((israelHour - utcHour) + 24) % 24;
  return diff === 3 ? '+03:00' : '+02:00';
}

function toIsraelDateTime(dateStr: string, time: string): Date {
  const offset = getIsraelOffset(dateStr);
  return new Date(`${dateStr}T${time}${offset}`);
}

router.get('/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { startDate, endDate, platform } = req.query;

    const start = (startDate as string) || todayIsrael();
    const end = (endDate as string) || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      return toIsraelDate(d);
    })();

    const conditions = [
      eq(providerAvailability.providerId, providerId),
      gte(providerAvailability.date, start),
      lte(providerAvailability.date, end),
    ];

    if (platform) {
      conditions.push(eq(providerAvailability.platform, platform as string));
    }

    const availability = await db.select()
      .from(providerAvailability)
      .where(and(...conditions))
      .orderBy(providerAvailability.date);

    const bookedDates = await getBookedDates(providerId, start, end);

    const calendar = availability.map(slot => ({
      id: slot.id,
      date: slot.date,
      timeSlot: slot.timeSlot || 'all_day',
      isAvailable: slot.isAvailable ?? true,
      maxBookings: slot.maxBookings || 1,
      currentBookings: slot.currentBookings || 0,
      hasConflict: bookedDates.has(slot.date),
      customRateCents: slot.customRateCents,
      notes: slot.notes,
    }));

    res.json({
      providerId,
      timezone: ISRAEL_TIMEZONE,
      startDate: start,
      endDate: end,
      calendar,
      bookedDates: Array.from(bookedDates),
    });
  } catch (error: any) {
    logger.error('[ProviderAvailability] Get availability error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

router.post('/set', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { platform, dates, isAvailable, timeSlot, maxBookings, customRateCents, notes } = req.body;

    if (!platform || !dates || !Array.isArray(dates)) {
      return res.status(400).json({ error: 'platform and dates[] are required' });
    }

    const [provider] = await db.select()
      .from(providers)
      .where(eq(providers.userId, userId));

    if (!provider) {
      return res.status(403).json({ error: 'Not a registered provider' });
    }

    const providerId = String(provider.id);

    const today = todayIsrael();
    const validDates = dates.filter((d: string) => d >= today);
    if (validDates.length === 0) {
      return res.status(400).json({ error: 'All dates are in the past' });
    }

    const results = [];
    for (const date of validDates) {
      const existing = await db.select()
        .from(providerAvailability)
        .where(and(
          eq(providerAvailability.providerId, providerId),
          eq(providerAvailability.platform, platform),
          eq(providerAvailability.date, date),
          eq(providerAvailability.timeSlot, timeSlot || 'all_day')
        ))
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db.update(providerAvailability)
          .set({
            isAvailable: isAvailable ?? true,
            maxBookings: maxBookings || 1,
            customRateCents: customRateCents || null,
            notes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(providerAvailability.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(providerAvailability)
          .values({
            providerId,
            platform,
            date,
            timeSlot: timeSlot || 'all_day',
            isAvailable: isAvailable ?? true,
            maxBookings: maxBookings || 1,
            currentBookings: 0,
            customRateCents: customRateCents || null,
            notes: notes || null,
          })
          .returning();
        results.push(created);
      }
    }

    if (isAvailable === false) {
      try {
        for (const date of validDates) {
          const startTime = toIsraelDateTime(date, '00:00:00');
          const endTime = toIsraelDateTime(date, '23:59:59');
          await calendarIntegrationService.createBookingEvent({
            platform,
            bookingId: `unavail-${providerId}-${date}`,
            title: `⁦Pet Wash™⁩ - Unavailable`,
            description: `Provider marked as unavailable for ${platform}`,
            startTime,
            endTime,
            providerName: providerId,
          });
        }
      } catch (calErr) {
        logger.warn('[ProviderAvailability] Calendar sync non-blocking error', { error: (calErr as Error).message });
      }
    }

    logger.info('[ProviderAvailability] Availability set', {
      providerId,
      platform,
      dates: validDates,
      isAvailable,
      timezone: ISRAEL_TIMEZONE,
    });

    res.json({
      success: true,
      updated: results.length,
      timezone: ISRAEL_TIMEZONE,
      results,
    });
  } catch (error: any) {
    logger.error('[ProviderAvailability] Set availability error', { error: error.message });
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

router.post('/toggle', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { platform, date } = req.body;

    if (!platform || !date) {
      return res.status(400).json({ error: 'platform and date are required' });
    }

    const [provider] = await db.select()
      .from(providers)
      .where(eq(providers.userId, userId));

    if (!provider) {
      return res.status(403).json({ error: 'Not a registered provider' });
    }

    const providerId = String(provider.id);

    const today = todayIsrael();
    if (date < today) {
      return res.status(400).json({ error: 'Cannot toggle availability for past dates' });
    }

    const existing = await db.select()
      .from(providerAvailability)
      .where(and(
        eq(providerAvailability.providerId, providerId),
        eq(providerAvailability.platform, platform),
        eq(providerAvailability.date, date)
      ))
      .limit(1);

    let result;
    let newStatus: boolean;

    if (existing.length > 0) {
      newStatus = !(existing[0].isAvailable ?? true);
      [result] = await db.update(providerAvailability)
        .set({ isAvailable: newStatus, updatedAt: new Date() })
        .where(eq(providerAvailability.id, existing[0].id))
        .returning();
    } else {
      newStatus = false;
      [result] = await db.insert(providerAvailability)
        .values({
          providerId,
          platform,
          date,
          timeSlot: 'all_day',
          isAvailable: false,
          maxBookings: 1,
          currentBookings: 0,
        })
        .returning();
    }

    logger.info('[ProviderAvailability] Toggled', {
      providerId, platform, date,
      isAvailable: newStatus,
      timezone: ISRAEL_TIMEZONE,
    });

    res.json({
      success: true,
      date,
      isAvailable: newStatus,
      timezone: ISRAEL_TIMEZONE,
      result,
    });
  } catch (error: any) {
    logger.error('[ProviderAvailability] Toggle error', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
});

router.post('/bulk-block', async (req, res) => {
  try {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { platform, startDate, endDate, reason } = req.body;

    if (!platform || !startDate || !endDate) {
      return res.status(400).json({ error: 'platform, startDate, endDate required' });
    }

    const [provider] = await db.select()
      .from(providers)
      .where(eq(providers.userId, userId));

    if (!provider) {
      return res.status(403).json({ error: 'Not a registered provider' });
    }

    const providerId = String(provider.id);

    const today = todayIsrael();
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (dateStr >= today) {
        dates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    if (dates.length === 0) {
      return res.status(400).json({ error: 'All dates are in the past' });
    }

    let blocked = 0;
    for (const date of dates) {
      const existing = await db.select()
        .from(providerAvailability)
        .where(and(
          eq(providerAvailability.providerId, providerId),
          eq(providerAvailability.platform, platform),
          eq(providerAvailability.date, date)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(providerAvailability)
          .set({ isAvailable: false, notes: reason || null, updatedAt: new Date() })
          .where(eq(providerAvailability.id, existing[0].id));
      } else {
        await db.insert(providerAvailability)
          .values({
            providerId,
            platform,
            date,
            timeSlot: 'all_day',
            isAvailable: false,
            maxBookings: 0,
            currentBookings: 0,
            notes: reason || null,
          });
      }
      blocked++;
    }

    try {
      const startTime = toIsraelDateTime(startDate, '00:00:00');
      const endTime = toIsraelDateTime(endDate, '23:59:59');
      await calendarIntegrationService.createBookingEvent({
        platform,
        bookingId: `block-${providerId}-${startDate}-${endDate}`,
        title: `⁦Pet Wash™⁩ - Blocked (${reason || 'Unavailable'})`,
        description: `Provider blocked ${dates.length} days: ${reason || 'No reason specified'}`,
        startTime,
        endTime,
        providerName: providerId,
      });
    } catch (calErr) {
      logger.warn('[ProviderAvailability] Calendar block sync non-blocking', { error: (calErr as Error).message });
    }

    logger.info('[ProviderAvailability] Bulk block', {
      providerId, platform, startDate, endDate,
      daysBlocked: blocked,
      reason,
      timezone: ISRAEL_TIMEZONE,
    });

    res.json({
      success: true,
      daysBlocked: blocked,
      dates,
      timezone: ISRAEL_TIMEZONE,
    });
  } catch (error: any) {
    logger.error('[ProviderAvailability] Bulk block error', { error: error.message });
    res.status(500).json({ error: 'Failed to block dates' });
  }
});

router.get('/:providerId/check', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { date, platform } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date query parameter is required' });
    }

    const dateStr = date as string;
    const platformStr = platform as string || '';

    const conditions = [
      eq(providerAvailability.providerId, providerId),
      eq(providerAvailability.date, dateStr),
    ];
    if (platformStr) {
      conditions.push(eq(providerAvailability.platform, platformStr));
    }

    const slots = await db.select()
      .from(providerAvailability)
      .where(and(...conditions));

    const markedUnavailable = slots.some(s => s.isAvailable === false);
    const atCapacity = slots.some(s => (s.currentBookings || 0) >= (s.maxBookings || 1));

    const bookedDates = await getBookedDates(providerId, dateStr, dateStr);
    const hasBooking = bookedDates.has(dateStr);

    const available = !markedUnavailable && !atCapacity;

    res.json({
      providerId,
      date: dateStr,
      timezone: ISRAEL_TIMEZONE,
      available,
      markedUnavailable,
      atCapacity,
      hasExistingBooking: hasBooking,
      slots: slots.map(s => ({
        timeSlot: s.timeSlot,
        isAvailable: s.isAvailable,
        maxBookings: s.maxBookings,
        currentBookings: s.currentBookings,
        customRateCents: s.customRateCents,
      })),
    });
  } catch (error: any) {
    logger.error('[ProviderAvailability] Check error', { error: error.message });
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

async function getBookedDates(providerId: string, startDate: string, endDate: string): Promise<Set<string>> {
  const bookedDates = new Set<string>();

  try {
    const confirmedBookings = await db.select({
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    })
    .from(bookings)
    .where(and(
      eq(bookings.providerId, providerId),
      sql`${bookings.status} IN ('confirmed', 'in_progress')`,
      sql`${bookings.startTime}::date <= ${endDate}::date`,
      sql`${bookings.endTime}::date >= ${startDate}::date`
    ));

    for (const b of confirmedBookings) {
      const current = new Date(b.startTime);
      const end = new Date(b.endTime);
      while (current <= end) {
        bookedDates.add(toIsraelDate(current));
        current.setDate(current.getDate() + 1);
      }
    }

    const activeRequests = await db.select({
      startDate: bookingRequests.startDate,
      endDate: bookingRequests.endDate,
    })
    .from(bookingRequests)
    .where(and(
      eq(bookingRequests.providerId, providerId),
      sql`${bookingRequests.status} IN ('pending', 'accepted', 'confirmed', 'in_progress')`,
      sql`${bookingRequests.startDate}::date <= ${endDate}::date`,
      sql`${bookingRequests.endDate}::date >= ${startDate}::date`
    ));

    for (const r of activeRequests) {
      const current = new Date(r.startDate);
      const end = new Date(r.endDate);
      while (current <= end) {
        bookedDates.add(toIsraelDate(current));
        current.setDate(current.getDate() + 1);
      }
    }
  } catch (error) {
    logger.warn('[ProviderAvailability] Error fetching booked dates', { error: (error as Error).message });
  }

  return bookedDates;
}

export default router;
