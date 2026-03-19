import { Router, Request, Response } from 'express';
import { db } from '../db';
import { providers, providerApplications, sitterReviews, sitterProfiles, walkerReviews, walkerProfiles } from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
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

// ── V1 READ ROUTES REMOVED (Phase 6, 2026-03-19) ───────────────────────────
// GET /stats       → removed; all callers migrated to /v2/stats
// GET /bookings    → removed; all callers migrated to /v2/bookings
// GET /earnings    → removed; all callers migrated to /v2/earnings
// V2 source: booking_requests table (canonical)

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

// ── V1 action routes REMOVED (Phase 6, 2026-03-19) ──────────────────────────
// confirm / start / complete / accept / decline / cancel / report
// All 7 were returning 410 with zero callers. Physically deleted.
// V2 replacement: POST /api/provider-dashboard/v2/bookings/:id/:action

// GET /upcoming    → removed; all callers migrated to /v2/upcoming

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

// GET /booking-counts → removed; all callers migrated to /v2/booking-counts

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