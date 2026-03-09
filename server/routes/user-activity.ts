/**
 * User Activity API
 * Aggregates data for the user dashboard: pets, upcoming bookings, recent transactions,
 * and their legal stamp count.
 *
 * Endpoints:
 *   GET /api/user/activity/summary  — dashboard summary (pets, next booking, wallet, stamps)
 *   GET /api/user/activity/bookings — all bookings across platforms for this user
 *   GET /api/user/activity/pets     — this user's pets
 */

import { Router } from 'express';
import { db } from '../db';
import {
  customerPets,
  sitterBookings,
  walkBookings,
  creditTransactions,
} from '@shared/schema';
import { legalStamps } from '@shared/schema-finance';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import admin from '../lib/firebase-admin';

const router = Router();

async function getUid(req: any): Promise<string | null> {
  if (req.firebaseUser?.uid) return req.firebaseUser.uid;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const decoded = await admin.auth().verifyIdToken(auth.split('Bearer ')[1], true);
      return decoded.uid;
    } catch {
      return null;
    }
  }
  return null;
}

// ── GET /api/user/activity/summary ──────────────────────────────────────────
router.get('/summary', async (req: any, res) => {
  try {
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const now = new Date();

    // Pets
    let pets: any[] = [];
    try {
      pets = await db
        .select({
          id: customerPets.id,
          name: customerPets.name,
          species: customerPets.species,
          breed: customerPets.breed,
          photoUrl: customerPets.profileImageUrl,
        })
        .from(customerPets)
        .where(eq(customerPets.ownerUid, uid))
        .limit(5);
    } catch { pets = []; }

    // Upcoming sitter bookings
    let sitterUpcoming: any[] = [];
    try {
      sitterUpcoming = await db
        .select({
          id: sitterBookings.id,
          bookingId: sitterBookings.bookingId,
          platform: sql<string>`'Sitter Suite'`,
          status: sitterBookings.status,
          startDate: sitterBookings.startDate,
          endDate: sitterBookings.endDate,
          amountCents: sitterBookings.totalChargeCents,
        })
        .from(sitterBookings)
        .where(and(eq(sitterBookings.ownerId, uid), gte(sitterBookings.startDate, now)))
        .orderBy(sitterBookings.startDate)
        .limit(3);
    } catch { sitterUpcoming = []; }

    // Upcoming walk bookings
    let walkUpcoming: any[] = [];
    try {
      walkUpcoming = await db
        .select({
          id: walkBookings.id,
          bookingId: walkBookings.bookingId,
          platform: sql<string>`'Walk My Pet'`,
          status: walkBookings.status,
          startDate: walkBookings.scheduledDate,
          endDate: walkBookings.scheduledDate,
          amountCents: sql<number>`(${walkBookings.totalCost} * 100)::int`,
        })
        .from(walkBookings)
        .where(and(eq(walkBookings.ownerId, uid), gte(walkBookings.scheduledDate, now.toISOString().split('T')[0])))
        .orderBy(walkBookings.scheduledDate)
        .limit(3);
    } catch { walkUpcoming = []; }

    // Recent wallet transactions
    let recentTransactions: any[] = [];
    try {
      recentTransactions = await db
        .select({
          id: creditTransactions.id,
          type: creditTransactions.transactionType,
          creditType: creditTransactions.creditType,
          amountCents: creditTransactions.amountCents,
          description: creditTransactions.description,
          createdAt: creditTransactions.createdAt,
        })
        .from(creditTransactions)
        .where(eq(creditTransactions.walletId, uid))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(5);
    } catch { recentTransactions = []; }

    // Legal stamp count
    let stampCount = 0;
    try {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(legalStamps)
        .where(eq(legalStamps.actorUid, uid));
      stampCount = row?.count ?? 0;
    } catch { stampCount = 0; }

    const upcomingBookings = [...sitterUpcoming, ...walkUpcoming].sort((a: any, b: any) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );

    res.json({
      success: true,
      pets,
      petsCount: pets.length,
      upcomingBookings,
      recentTransactions,
      stampCount,
    });
  } catch (err) {
    logger.error('[UserActivity] GET /summary error', err);
    res.status(500).json({ error: 'Failed to fetch activity summary' });
  }
});

// ── GET /api/user/activity/bookings ──────────────────────────────────────────
router.get('/bookings', async (req: any, res) => {
  try {
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    let sitter: any[] = [];
    let walk: any[] = [];

    try {
      sitter = await db
        .select({
          id: sitterBookings.id,
          bookingId: sitterBookings.bookingId,
          platform: sql<string>`'Sitter Suite'`,
          status: sitterBookings.status,
          startDate: sitterBookings.startDate,
          endDate: sitterBookings.endDate,
          amountCents: sitterBookings.totalChargeCents,
          currency: sql<string>`'ILS'`,
        })
        .from(sitterBookings)
        .where(eq(sitterBookings.ownerId, uid))
        .orderBy(desc(sitterBookings.startDate))
        .limit(20);
    } catch { sitter = []; }

    try {
      walk = await db
        .select({
          id: walkBookings.id,
          bookingId: walkBookings.bookingId,
          platform: sql<string>`'Walk My Pet'`,
          status: walkBookings.status,
          startDate: walkBookings.scheduledDate,
          endDate: walkBookings.scheduledDate,
          amountCents: sql<number>`(${walkBookings.totalCost} * 100)::int`,
          currency: sql<string>`'ILS'`,
        })
        .from(walkBookings)
        .where(eq(walkBookings.ownerId, uid))
        .orderBy(desc(walkBookings.scheduledDate))
        .limit(20);
    } catch { walk = []; }

    const all = [...sitter, ...walk].sort((a: any, b: any) =>
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );

    res.json({ success: true, bookings: all, total: all.length });
  } catch (err) {
    logger.error('[UserActivity] GET /bookings error', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ── GET /api/user/activity/pets ──────────────────────────────────────────────
router.get('/pets', async (req: any, res) => {
  try {
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const pets = await db
      .select()
      .from(customerPets)
      .where(eq(customerPets.ownerUid, uid))
      .orderBy(customerPets.name);

    res.json({ success: true, pets, count: pets.length });
  } catch (err) {
    logger.error('[UserActivity] GET /pets error', err);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

export default router;
