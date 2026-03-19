import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookings, providers, providerApplications, sitterReviews, sitterProfiles, walkerReviews, walkerProfiles } from '@shared/schema';
import { eq, and, desc, sql, count, inArray } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

async function getAuthenticatedUser(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    return await auth.verifyIdToken(token, true);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.json({
        success: true,
        stats: {
          totalBookings: 0,
          completedBookings: 0,
          activeBookings: 0,
          cancelledBookings: 0,
          totalEarnings: 0,
          pendingPayouts: 0,
          averageRating: 0,
          totalReviews: 0,
          completionRate: 0,
          platforms: [],
          isActive: false,
        },
      });
    }

    const allBookings = await db
      .select()
      .from(bookings)
      .where(
        sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`
      );

    const totalBookings = allBookings.length;
    const completedBookings = allBookings.filter(b => b.status === 'completed').length;
    const activeBookings = allBookings.filter(b => ['confirmed', 'provider_confirmed', 'in_progress', 'started'].includes(b.status)).length;
    const cancelledBookings = allBookings.filter(b => b.status === 'cancelled').length;

    const totalEarnings = allBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + parseFloat(b.providerPayout || '0'), 0);

    const pendingPayouts = allBookings
      .filter(b => b.status === 'completed' && b.payoutStatus === 'pending')
      .reduce((sum, b) => sum + parseFloat(b.providerPayout || '0'), 0);

    const avgRating = providerRecords.reduce((sum, p) => sum + parseFloat(p.averageRating || '0'), 0) / providerRecords.length;
    const totalReviews = providerRecords.reduce((sum, p) => sum + (p.totalReviews || 0), 0);
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    const platformList = providerRecords.map(p => ({
      id: p.id,
      platformId: p.platformId,
      businessName: p.businessName,
      isAvailable: p.isAvailable,
      isActive: p.isActive,
      verificationStatus: p.verificationStatus,
    }));

    res.json({
      success: true,
      stats: {
        totalBookings,
        completedBookings,
        activeBookings,
        cancelledBookings,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingPayouts: Math.round(pendingPayouts * 100) / 100,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews,
        completionRate: Math.round(completionRate),
        platforms: platformList,
        isActive: providerRecords.some(p => p.isActive),
      },
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Stats error', error);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    const offset = (pageNum - 1) * limitNum;

    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.json({ success: true, bookings: [], total: 0, page: pageNum, totalPages: 0 });
    }

    const conditions = [
      sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`,
    ];

    if (status && status !== 'all') {
      const statusList = (status as string).split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length === 1) {
        conditions.push(sql`${bookings.status} = ${statusList[0]}`);
      } else if (statusList.length > 1) {
        conditions.push(inArray(bookings.status, statusList));
      }
    }

    const whereClause = sql`${sql.join(conditions, sql` AND `)}`;

    const [countResult] = await db.select({ total: count() }).from(bookings).where(whereClause);
    const total = countResult?.total || 0;

    const results = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        platformId: bookings.platformId,
        userId: bookings.userId,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        duration: bookings.duration,
        status: bookings.status,
        serviceType: bookings.serviceType,
        serviceDescription: bookings.serviceDescription,
        specialRequests: bookings.specialRequests,
        subtotal: bookings.subtotal,
        platformFee: bookings.platformFee,
        providerPayout: bookings.providerPayout,
        total: bookings.total,
        currency: bookings.currency,
        paymentStatus: bookings.paymentStatus,
        payoutStatus: bookings.payoutStatus,
        payoutDate: bookings.payoutDate,
        confirmedAt: bookings.confirmedAt,
        startedAt: bookings.startedAt,
        completedAt: bookings.completedAt,
        cancelledAt: bookings.cancelledAt,
        cancellationReason: bookings.cancellationReason,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .where(whereClause)
      .orderBy(desc(bookings.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      success: true,
      bookings: results,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Bookings error', error);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

router.get('/earnings', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.json({
        success: true,
        earnings: {
          totalEarnings: 0,
          pendingPayouts: 0,
          paidPayouts: 0,
          thisMonthEarnings: 0,
          lastMonthEarnings: 0,
          recentPayouts: [],
        },
      });
    }

    const allCompletedBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`,
          eq(bookings.status, 'completed')
        )
      )
      .orderBy(desc(bookings.completedAt));

    const now = new Date();
    const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay()); thisWeekStart.setHours(0,0,0,0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const r = (n: number) => Math.round(n * 100) / 100;

    const totalEarnings = allCompletedBookings.reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    const pendingPayouts = allCompletedBookings.filter(b => b.payoutStatus === 'pending').reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    const paidPayouts = allCompletedBookings.filter(b => b.payoutStatus === 'paid').reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const thisWeekEarnings = allCompletedBookings
      .filter(b => b.completedAt && new Date(b.completedAt) >= thisWeekStart)
      .reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const thisMonthEarnings = allCompletedBookings
      .filter(b => b.completedAt && new Date(b.completedAt) >= thisMonthStart)
      .reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const lastMonthEarnings = allCompletedBookings
      .filter(b => b.completedAt && new Date(b.completedAt) >= lastMonthStart && new Date(b.completedAt) < thisMonthStart)
      .reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const recentPayouts = allCompletedBookings.slice(0, 20).map(b => ({
      bookingNumber: b.bookingNumber,
      amount: r(parseFloat(b.providerPayout || '0')),
      gross: r(parseFloat(b.subtotal || '0')),
      platformFee: r(parseFloat(b.platformFee || '0')),
      date: b.completedAt || b.createdAt,
      payoutStatus: b.payoutStatus || 'pending',
      serviceType: b.serviceType,
      platformId: b.platformId,
    }));

    res.json({
      success: true,
      earnings: {
        totalEarnings: r(totalEarnings),
        pendingPayouts: r(pendingPayouts),
        paidPayouts: r(paidPayouts),
        thisWeekEarnings: r(thisWeekEarnings),
        thisMonthEarnings: r(thisMonthEarnings),
        lastMonthEarnings: r(lastMonthEarnings),
        recentPayouts,
        totalJobs: allCompletedBookings.length,
      },
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Earnings error', error);
    res.status(500).json({ error: 'Failed to load earnings' });
  }
});

router.get('/application-status', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const applications = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.userId, user.uid))
      .orderBy(desc(providerApplications.createdAt));

    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));

    res.json({
      success: true,
      applications: applications.map(a => ({
        applicationId: a.applicationId,
        providerType: a.providerType,
        status: a.status,
        firstName: a.firstName,
        lastName: a.lastName,
        city: a.city,
        createdAt: a.createdAt,
        reviewedAt: a.reviewedAt,
        reviewedBy: a.reviewedBy,
        approvedAsProviderId: a.approvedAsProviderId,
      })),
      isProvider: providerRecords.length > 0,
      providerProfiles: providerRecords.map(p => ({
        id: p.id,
        platformId: p.platformId,
        businessName: p.businessName,
        isActive: p.isActive,
        isAvailable: p.isAvailable,
        verificationStatus: p.verificationStatus,
        averageRating: parseFloat(p.averageRating || '0'),
        totalReviews: p.totalReviews || 0,
        totalBookings: p.totalBookings || 0,
      })),
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Application status error', error);
    res.status(500).json({ error: 'Failed to load application status' });
  }
});

function providerOwnsBooking(providerIds: number[], bookingProviderId: string | number | null | undefined): boolean {
  if (!bookingProviderId) return false;
  const bookingPid = typeof bookingProviderId === 'string' ? parseInt(bookingProviderId, 10) : bookingProviderId;
  return providerIds.includes(bookingPid);
}

router.post('/bookings/:bookingId/confirm', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { bookingId } = req.params;
    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.status(403).json({ error: 'Not a provider' });
    }

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!providerOwnsBooking(providerIds, booking.providerId)) {
      return res.status(403).json({ error: 'Not your booking' });
    }

    if (!['pending', 'confirmed', 'owner_confirmed'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot confirm booking with status: ${booking.status}` });
    }

    const now = new Date();
    await db.update(bookings).set({
      status: 'provider_confirmed',
      confirmedAt: now,
    }).where(eq(bookings.id, bookingId));

    logger.info('[ProviderDashboard] Booking confirmed', {
      bookingId,
      bookingNumber: booking.bookingNumber,
      providerId: booking.providerId,
      confirmedAt: now.toISOString(),
      confirmedByUid: user.uid,
    });

    res.json({
      success: true,
      action: 'confirmed',
      bookingId,
      confirmedAt: now.toISOString(),
      stamp: `PROVIDER_CONFIRMED::${user.uid}::${now.toISOString()}`,
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Confirm booking error', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

router.post('/bookings/:bookingId/start', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { bookingId } = req.params;
    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.status(403).json({ error: 'Not a provider' });
    }

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));

    if (!booking || !providerOwnsBooking(providerIds, booking.providerId)) {
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    if (booking.status !== 'provider_confirmed') {
      return res.status(400).json({ error: `Cannot start booking with status: ${booking.status}. Must be provider_confirmed first.` });
    }

    const now = new Date();
    await db.update(bookings).set({
      status: 'in_progress',
      startedAt: now,
    }).where(eq(bookings.id, bookingId));

    logger.info('[ProviderDashboard] Booking started', {
      bookingId,
      bookingNumber: booking.bookingNumber,
      startedAt: now.toISOString(),
      startedByUid: user.uid,
    });

    res.json({
      success: true,
      action: 'started',
      bookingId,
      startedAt: now.toISOString(),
      stamp: `SERVICE_STARTED::${user.uid}::${now.toISOString()}`,
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Start booking error', error);
    res.status(500).json({ error: 'Failed to start booking' });
  }
});

router.post('/bookings/:bookingId/complete', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { bookingId } = req.params;
    const providerRecords = await db.select().from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.status(403).json({ error: 'Not a provider' });
    }

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));

    if (!booking || !providerOwnsBooking(providerIds, booking.providerId)) {
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    if (!['in_progress', 'started'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot complete booking with status: ${booking.status}` });
    }

    const now = new Date();
    await db.update(bookings).set({
      status: 'completed',
      completedAt: now,
      payoutStatus: 'pending',
    }).where(eq(bookings.id, bookingId));

    logger.info('[ProviderDashboard] Booking completed', {
      bookingId,
      bookingNumber: booking.bookingNumber,
      completedAt: now.toISOString(),
      completedByUid: user.uid,
      providerPayout: booking.providerPayout,
    });

    res.json({
      success: true,
      action: 'completed',
      bookingId,
      completedAt: now.toISOString(),
      payoutStatus: 'pending',
      stamp: `SERVICE_COMPLETED::${user.uid}::${now.toISOString()}`,
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Complete booking error', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// ── Unified action handler for accept / decline / cancel / report ──────────
async function bookingActionHandler(req: Request, res: Response, action: string) {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { bookingId } = req.params;
    const providerRecords = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);
    if (providerIds.length === 0) return res.status(403).json({ error: 'Not a provider' });

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking || !providerOwnsBooking(providerIds, booking.providerId)) {
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    const now = new Date();
    let update: Record<string, any> = {};
    let newStatus = '';

    if (action === 'accept') {
      if (!['new_request', 'pending', 'confirmed', 'owner_confirmed'].includes(booking.status)) {
        return res.status(400).json({ error: `Cannot accept booking with status: ${booking.status}` });
      }
      newStatus = 'provider_confirmed';
      update = { status: 'provider_confirmed', confirmedAt: now };
    } else if (action === 'decline') {
      if (!['new_request', 'pending', 'confirmed', 'owner_confirmed'].includes(booking.status)) {
        return res.status(400).json({ error: `Cannot decline booking with status: ${booking.status}` });
      }
      const { reason } = req.body;
      newStatus = 'cancelled';
      update = { status: 'cancelled', cancelledAt: now, cancellationReason: reason || 'Provider declined' };
    } else if (action === 'cancel') {
      if (['completed', 'cancelled'].includes(booking.status)) {
        return res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
      }
      const { reason } = req.body;
      newStatus = 'cancelled';
      update = { status: 'cancelled', cancelledAt: now, cancellationReason: reason || 'Provider cancelled' };
    } else if (action === 'report') {
      const { reason } = req.body;
      newStatus = 'dispute';
      update = { status: 'dispute', cancellationReason: reason || 'Issue reported by provider' };
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    await db.update(bookings).set(update).where(eq(bookings.id, bookingId));

    logger.info(`[ProviderDashboard] Booking ${action}`, {
      bookingId,
      bookingNumber: booking.bookingNumber,
      newStatus,
      uid: user.uid,
      ts: now.toISOString(),
    });

    res.json({ success: true, action, bookingId, newStatus, stamp: `BOOKING_${action.toUpperCase()}::${user.uid}::${now.toISOString()}` });
  } catch (error) {
    logger.error(`[ProviderDashboard] Action ${action} error`, error);
    res.status(500).json({ error: `Failed to ${action} booking` });
  }
}

router.post('/bookings/:bookingId/accept',  (req, res) => bookingActionHandler(req, res, 'accept'));
router.post('/bookings/:bookingId/decline', (req, res) => bookingActionHandler(req, res, 'decline'));
router.post('/bookings/:bookingId/cancel',  (req, res) => bookingActionHandler(req, res, 'cancel'));
router.post('/bookings/:bookingId/report',  (req, res) => bookingActionHandler(req, res, 'report'));

// ── Upcoming confirmed jobs (next 7 days) ───────────────────────────────────
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const providerRecords = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) return res.json({ success: true, upcoming: [] });

    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const providerFilter = sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`;

    const rows = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        serviceType: bookings.serviceType,
        status: bookings.status,
        startTime: bookings.startTime,
        providerPayout: bookings.providerPayout,
        userId: bookings.userId,
        platformId: bookings.platformId,
        specialRequests: bookings.specialRequests,
      })
      .from(bookings)
      .where(
        sql`${providerFilter}
          AND ${bookings.status} IN ('confirmed','provider_confirmed')
          AND ${bookings.startTime} IS NOT NULL
          AND ${bookings.startTime} >= ${now}
          AND ${bookings.startTime} <= ${sevenDaysOut}`
      )
      .orderBy(bookings.startTime)
      .limit(20);

    res.json({ success: true, upcoming: rows });
  } catch (error) {
    logger.error('[ProviderDashboard] Upcoming error', error);
    res.status(500).json({ error: 'Failed to load upcoming jobs' });
  }
});

router.post('/availability', async (req: Request, res: Response) => {
  return availabilityHandler(req, res);
});
router.patch('/availability', async (req: Request, res: Response) => {
  return availabilityHandler(req, res);
});
async function availabilityHandler(req: Request, res: Response) {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { providerId, isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable is required' });
    }

    const [provider] = await db
      .select()
      .from(providers)
      .where(and(eq(providers.id, providerId), eq(providers.userId, user.uid)));

    if (!provider) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    await db.update(providers).set({ isAvailable }).where(eq(providers.id, providerId));

    res.json({ success: true, isAvailable });
  } catch (error) {
    logger.error('[ProviderDashboard] Availability update error', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
}

// ── Booking counts per status (for tab badges) ─────────────────────────────
router.get('/booking-counts', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const providerRecords = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, user.uid));
    const providerIds = providerRecords.map(p => p.id);

    if (providerIds.length === 0) {
      return res.json({ success: true, counts: { all: 0 } });
    }

    const providerFilter = sql`${bookings.providerId} = ANY(${sql`ARRAY[${sql.join(providerIds.map(id => sql`${id}`), sql`, `)}]`})`;

    const rows = await db
      .select({ status: bookings.status, total: count() })
      .from(bookings)
      .where(providerFilter)
      .groupBy(bookings.status);

    const counts: Record<string, number> = {};
    let allTotal = 0;
    for (const row of rows) {
      if (row.status) {
        counts[row.status] = Number(row.total);
        allTotal += Number(row.total);
      }
    }
    counts['all'] = allTotal;

    res.json({ success: true, counts });
  } catch (error) {
    logger.error('[ProviderDashboard] Booking counts error', error);
    res.status(500).json({ error: 'Failed to load booking counts' });
  }
});

// ── Reviews endpoint ───────────────────────────────────────────────────────
router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const limit = Math.min(50, parseInt((req.query.limit as string) || '20') || 20);

    // Sitter reviews
    const sitterProfileRows = await db.select({ id: sitterProfiles.id }).from(sitterProfiles).where(eq(sitterProfiles.userId, user.uid));
    const sitterProfileIds = sitterProfileRows.map(p => p.id);

    let sitterReviewRows: any[] = [];
    if (sitterProfileIds.length > 0) {
      sitterReviewRows = await db
        .select({ id: sitterReviews.id, rating: sitterReviews.rating, comment: sitterReviews.comment, createdAt: sitterReviews.createdAt })
        .from(sitterReviews)
        .where(inArray(sitterReviews.sitterId, sitterProfileIds))
        .orderBy(desc(sitterReviews.createdAt))
        .limit(limit);
    }

    // Walker reviews
    const walkerProfileRows = await db.select({ walkerId: walkerProfiles.walkerId }).from(walkerProfiles).where(eq(walkerProfiles.userId, user.uid));
    const walkerIds = walkerProfileRows.map(p => p.walkerId);

    let walkerReviewRows: any[] = [];
    if (walkerIds.length > 0) {
      walkerReviewRows = await db
        .select({ id: walkerReviews.id, rating: walkerReviews.overallRating, comment: walkerReviews.reviewText, createdAt: walkerReviews.createdAt })
        .from(walkerReviews)
        .where(inArray(walkerReviews.walkerId, walkerIds))
        .orderBy(desc(walkerReviews.createdAt))
        .limit(limit);
    }

    const allReviews = [...sitterReviewRows, ...walkerReviewRows]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);

    const totalCount = allReviews.length;
    const avgRating = totalCount > 0
      ? Math.round((allReviews.reduce((s, r) => s + (r.rating || 0), 0) / totalCount) * 10) / 10
      : null;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allReviews) if (r.rating >= 1 && r.rating <= 5) distribution[r.rating]++;

    res.json({
      success: true,
      reviews: {
        avgRating,
        totalCount,
        distribution,
        recent: allReviews.slice(0, 10).map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || null,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('[ProviderDashboard] Reviews error', error);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

export default router;