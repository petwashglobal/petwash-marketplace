/**
 * Loyalty Credits API — Step 6 retention ledger endpoints.
 * Separate from the existing /api/loyalty (points/badges) system.
 *
 * GET  /api/loyalty-credits/balance   — balance, upcoming expiry
 * GET  /api/loyalty-credits/history   — paginated ledger
 * GET  /api/loyalty-credits/streaks   — streak counts per category + same-provider
 */

import { Router } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import {
  getLoyaltyBalance,
  getLoyaltyHistory,
  getStreakCounts,
} from '../utils/loyaltyLedger';
import { db } from '../db';
import { loyaltyLedger, users, winbackQueue } from '../../shared/schema';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/loyalty-credits/balance
router.get('/balance', validateFirebaseToken, async (req: any, res) => {
  try {
    const userId = req.firebaseUser?.uid || req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const balance = await getLoyaltyBalance(userId);
    const now = new Date();

    // Find next expiring credit amount (within 30 days)
    const upcoming = await db
      .select({
        amount:    sql<number>`sum(amount_ils_cents)::int`,
        expiresAt: loyaltyLedger.expiresAt,
      })
      .from(loyaltyLedger)
      .where(and(
        eq(loyaltyLedger.userId, userId),
        gt(loyaltyLedger.amountIlsCents, 0),
        gt(loyaltyLedger.expiresAt as any, now),
        lte(loyaltyLedger.expiresAt as any, new Date(now.getTime() + 30 * 86_400_000)),
      ))
      .groupBy(loyaltyLedger.expiresAt)
      .orderBy(loyaltyLedger.expiresAt)
      .limit(1);

    res.json({
      balanceCents:       balance,
      balanceIls:         (balance / 100).toFixed(2),
      pendingExpiryCents: upcoming[0]?.amount ?? 0,
      pendingExpiryAt:    upcoming[0]?.expiresAt ?? null,
    });
  } catch (err: any) {
    logger.error('[LoyaltyCredits] Balance error', { error: err.message });
    res.status(500).json({ error: 'Failed to load balance' });
  }
});

// GET /api/loyalty-credits/history?limit=20
router.get('/history', validateFirebaseToken, async (req: any, res) => {
  try {
    const userId = req.firebaseUser?.uid || req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const entries = await getLoyaltyHistory(userId, limit);
    res.json({ entries });
  } catch (err: any) {
    logger.error('[LoyaltyCredits] History error', { error: err.message });
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// GET /api/loyalty-credits/streaks
router.get('/streaks', validateFirebaseToken, async (req: any, res) => {
  try {
    const userId = req.firebaseUser?.uid || req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const streaks = await getStreakCounts(userId);
    res.json(streaks);
  } catch (err: any) {
    logger.error('[LoyaltyCredits] Streaks error', { error: err.message });
    res.status(500).json({ error: 'Failed to load streaks' });
  }
});

// GET /api/loyalty-credits/summary
// One-stop endpoint: balance + streaks + referral code + winback eligibility.
// Used by Dashboard, LoyaltyRefer, and the winback card to avoid 4 round-trips.
router.get('/summary', validateFirebaseToken, async (req: any, res) => {
  try {
    const userId = req.firebaseUser?.uid || req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();

    // Parallel: balance, expiry, streaks, user referral code, winback status
    const [balanceCents, upcomingExpiry, streaks, userRow, winbackRow] = await Promise.all([
      getLoyaltyBalance(userId),
      db
        .select({
          amount:    sql<number>`sum(amount_ils_cents)::int`,
          expiresAt: loyaltyLedger.expiresAt,
        })
        .from(loyaltyLedger)
        .where(and(
          eq(loyaltyLedger.userId, userId),
          gt(loyaltyLedger.amountIlsCents, 0),
          gt(loyaltyLedger.expiresAt as any, now),
          lte(loyaltyLedger.expiresAt as any, new Date(now.getTime() + 30 * 86_400_000)),
        ))
        .groupBy(loyaltyLedger.expiresAt)
        .orderBy(loyaltyLedger.expiresAt)
        .limit(1),
      getStreakCounts(userId),
      db
        .select({ referralCode: users.referralCode, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db
        .select({ id: winbackQueue.id, trigger: winbackQueue.trigger, scheduledAt: winbackQueue.scheduledAt })
        .from(winbackQueue)
        .where(and(eq(winbackQueue.userId, userId), eq(winbackQueue.status, 'pending')))
        .orderBy(winbackQueue.scheduledAt)
        .limit(1),
    ]);

    res.json({
      balance: {
        cents:              balanceCents,
        ils:                (balanceCents / 100).toFixed(2),
        pendingExpiryCents: upcomingExpiry[0]?.amount ?? 0,
        pendingExpiryAt:    upcomingExpiry[0]?.expiresAt ?? null,
      },
      streaks: {
        walkBookings:            streaks.walkBookings,
        sitBookings:             streaks.sitBookings,
        consecutiveSameProvider: streaks.consecutiveSameProvider,
      },
      referralCode: userRow[0]?.referralCode ?? null,
      winback: winbackRow.length > 0
        ? { eligible: true, trigger: winbackRow[0].trigger, scheduledAt: winbackRow[0].scheduledAt }
        : { eligible: false },
    });
  } catch (err: any) {
    logger.error('[LoyaltyCredits] Summary error', { error: err.message });
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

export default router;
