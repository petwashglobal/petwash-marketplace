import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookings, providers, providerApplications } from '@shared/schema';
import { eq, and, desc, sql, count } from 'drizzle-orm';
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
    return await auth.verifyIdToken(token);
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
      conditions.push(sql`${bookings.status} = ${status}`);
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
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const totalEarnings = allCompletedBookings.reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    const pendingPayouts = allCompletedBookings.filter(b => b.payoutStatus === 'pending').reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);
    const paidPayouts = allCompletedBookings.filter(b => b.payoutStatus === 'paid').reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const thisMonthEarnings = allCompletedBookings
      .filter(b => b.completedAt && new Date(b.completedAt) >= thisMonthStart)
      .reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const lastMonthEarnings = allCompletedBookings
      .filter(b => b.completedAt && new Date(b.completedAt) >= lastMonthStart && new Date(b.completedAt) < thisMonthStart)
      .reduce((s, b) => s + parseFloat(b.providerPayout || '0'), 0);

    const recentPayouts = allCompletedBookings.slice(0, 10).map(b => ({
      bookingNumber: b.bookingNumber,
      amount: parseFloat(b.providerPayout || '0'),
      date: b.completedAt || b.createdAt,
      payoutStatus: b.payoutStatus,
      serviceType: b.serviceType,
      platformId: b.platformId,
    }));

    res.json({
      success: true,
      earnings: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingPayouts: Math.round(pendingPayouts * 100) / 100,
        paidPayouts: Math.round(paidPayouts * 100) / 100,
        thisMonthEarnings: Math.round(thisMonthEarnings * 100) / 100,
        lastMonthEarnings: Math.round(lastMonthEarnings * 100) / 100,
        recentPayouts,
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

router.patch('/availability', async (req: Request, res: Response) => {
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
});

export default router;