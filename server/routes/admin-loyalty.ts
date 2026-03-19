/**
 * Admin Loyalty Routes — Phase 6.7
 * Mounted at /api/admin/loyalty (under the /api/admin/ middleware stack in routes.ts)
 *
 * GET    /rules                — list all loyalty_rules
 * PATCH  /rules/:ruleKey       — toggle enabled / edit reward / expiry / description
 * GET    /stats                — conversion funnel by event_type + experiment_variant
 * GET    /winback              — winback queue summary + recent entries
 * POST   /adjust               — manual credit grant / deduct with audit trail
 * GET    /ledger               — recent system-wide ledger (last 200 rows)
 */

import { Router } from 'express';
import { db } from '../db';
import {
  loyaltyRules,
  loyaltyLedger,
  winbackQueue,
  users,
  rewardClaims,
  experimentEvents,
  experimentDecisions,
} from '../../shared/schema';
import { eq, desc, sql, and, gte, count, inArray } from 'drizzle-orm';
import { runExperimentDecisionJob } from '../jobs/experiment-decision';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { adjustLoyaltyBalance } from '../utils/loyaltyLedger';

const router = Router();

// ── Email-based admin guard (mirrors admin.ts pattern) ────────────────────────
const FULL_ADMIN_EMAILS = [
  'nirhadad1@gmail.com',
  'nir.h@petwash.co.il',
  'admin@petwash.co.il',
  'Support@PetWash.co.il',
];

function requireAdmin(req: any, res: any, next: any) {
  const email = req.firebaseUser?.email;
  if (!FULL_ADMIN_EMAILS.includes(email || '')) {
    return res.status(403).json({ error: 'Full admin access required' });
  }
  next();
}

// ── GET /rules ────────────────────────────────────────────────────────────────
router.get('/rules', requireAdmin, async (_req, res) => {
  try {
    const rules = await db
      .select()
      .from(loyaltyRules)
      .orderBy(loyaltyRules.ruleKey);
    res.json({ rules });
  } catch (err: any) {
    logger.error('admin-loyalty GET /rules', err);
    res.status(500).json({ error: 'Failed to fetch loyalty rules' });
  }
});

// ── PATCH /rules/:ruleKey ──────────────────────────────────────────────────────
const patchRuleSchema = z.object({
  enabled:        z.boolean().optional(),
  rewardIlsCents: z.number().int().min(0).optional(),
  expiryDays:     z.number().int().min(1).nullable().optional(),
  minBookingIls:  z.number().int().min(0).nullable().optional(),
  maxUsesPerUser: z.number().int().min(1).nullable().optional(),
  description:    z.string().max(500).optional(),
});

router.patch('/rules/:ruleKey', requireAdmin, async (req, res) => {
  try {
    const { ruleKey } = req.params;
    const body = patchRuleSchema.parse(req.body);

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.enabled        !== undefined) updates.enabled        = body.enabled;
    if (body.rewardIlsCents !== undefined) updates.rewardIlsCents = body.rewardIlsCents;
    if (body.expiryDays     !== undefined) updates.expiryDays     = body.expiryDays;
    if (body.minBookingIls  !== undefined) updates.minBookingIls  = body.minBookingIls;
    if (body.maxUsesPerUser !== undefined) updates.maxUsesPerUser = body.maxUsesPerUser;
    if (body.description    !== undefined) updates.description    = body.description;

    const rows = await db
      .update(loyaltyRules)
      .set(updates)
      .where(eq(loyaltyRules.ruleKey, ruleKey))
      .returning();

    if (!rows.length) return res.status(404).json({ error: 'Rule not found' });

    logger.info(`admin-loyalty: PATCH rule ${ruleKey}`, { updates });
    res.json({ rule: rows[0] });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty PATCH /rules/:ruleKey', err);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// ── GET /stats ─────────────────────────────────────────────────────────────────
// Conversion funnel: event counts + redemption totals + experiment variant breakdown
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    // Event-type totals (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const eventTotals = await db
      .select({
        eventType:   loyaltyLedger.eventType,
        txCount:     count(),
        totalCents:  sql<number>`COALESCE(SUM(ABS(${loyaltyLedger.amountIlsCents})), 0)`.mapWith(Number),
        userCount:   sql<number>`COUNT(DISTINCT ${loyaltyLedger.userId})`.mapWith(Number),
      })
      .from(loyaltyLedger)
      .where(gte(loyaltyLedger.createdAt, cutoff))
      .groupBy(loyaltyLedger.eventType)
      .orderBy(desc(count()));

    // Redemption totals (absolute cents redeemed vs. earned)
    const redemptionRow = await db
      .select({
        totalEarnedCents:   sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyLedger.amountIlsCents} > 0 THEN ${loyaltyLedger.amountIlsCents} ELSE 0 END), 0)`.mapWith(Number),
        totalRedeemedCents: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyLedger.eventType} = 'redeem' THEN ABS(${loyaltyLedger.amountIlsCents}) ELSE 0 END), 0)`.mapWith(Number),
        activeUsers:        sql<number>`COUNT(DISTINCT ${loyaltyLedger.userId})`.mapWith(Number),
      })
      .from(loyaltyLedger)
      .where(gte(loyaltyLedger.createdAt, cutoff));

    // Experiment variant conversion breakdown (experimentEvents)
    const variantFunnel = await db
      .select({
        experimentKey: experimentEvents.experimentKey,
        variant:       experimentEvents.variant,
        event:         experimentEvents.event,
        cnt:           count(),
      })
      .from(experimentEvents)
      .where(gte(experimentEvents.createdAt, cutoff))
      .groupBy(
        experimentEvents.experimentKey,
        experimentEvents.variant,
        experimentEvents.event,
      )
      .orderBy(
        experimentEvents.experimentKey,
        experimentEvents.variant,
        desc(count()),
      );

    // Rule claim counts
    const ruleClaims = await db
      .select({
        ruleKey: rewardClaims.ruleKey,
        claims:  count(),
      })
      .from(rewardClaims)
      .groupBy(rewardClaims.ruleKey)
      .orderBy(desc(count()));

    res.json({
      period: '90d',
      eventTotals,
      summary: redemptionRow[0] ?? { totalEarnedCents: 0, totalRedeemedCents: 0, activeUsers: 0 },
      variantFunnel,
      ruleClaims,
    });
  } catch (err: any) {
    logger.error('admin-loyalty GET /stats', err);
    res.status(500).json({ error: 'Failed to fetch loyalty stats' });
  }
});

// ── GET /winback ───────────────────────────────────────────────────────────────
router.get('/winback', requireAdmin, async (_req, res) => {
  try {
    // Status breakdown
    const statusBreakdown = await db
      .select({
        trigger: winbackQueue.trigger,
        status:  winbackQueue.status,
        cnt:     count(),
      })
      .from(winbackQueue)
      .groupBy(winbackQueue.trigger, winbackQueue.status)
      .orderBy(winbackQueue.trigger, winbackQueue.status);

    // Recent 50 entries
    const recent = await db
      .select({
        id:          winbackQueue.id,
        userId:      winbackQueue.userId,
        trigger:     winbackQueue.trigger,
        status:      winbackQueue.status,
        scheduledAt: winbackQueue.scheduledAt,
        sentAt:      winbackQueue.sentAt,
        convertedAt: winbackQueue.convertedAt,
        variant:     winbackQueue.experimentVariant,
      })
      .from(winbackQueue)
      .orderBy(desc(winbackQueue.scheduledAt))
      .limit(50);

    // Conversion rate
    const conversionRow = await db
      .select({
        sent:      sql<number>`COUNT(*) FILTER (WHERE ${winbackQueue.status} = 'sent')`.mapWith(Number),
        converted: sql<number>`COUNT(*) FILTER (WHERE ${winbackQueue.status} = 'converted')`.mapWith(Number),
        suppressed: sql<number>`COUNT(*) FILTER (WHERE ${winbackQueue.status} = 'suppressed')`.mapWith(Number),
      })
      .from(winbackQueue);

    // Experiment variant funnel for winback experiments
    const variantFunnel = await db
      .select({
        experimentKey: experimentEvents.experimentKey,
        variant:       experimentEvents.variant,
        event:         experimentEvents.event,
        cnt:           count(),
      })
      .from(experimentEvents)
      .where(sql`${experimentEvents.experimentKey} LIKE 'winback_%'`)
      .groupBy(
        experimentEvents.experimentKey,
        experimentEvents.variant,
        experimentEvents.event,
      )
      .orderBy(experimentEvents.experimentKey, experimentEvents.variant);

    res.json({
      statusBreakdown,
      recent,
      conversion:    conversionRow[0] ?? { sent: 0, converted: 0, suppressed: 0 },
      variantFunnel,
    });
  } catch (err: any) {
    logger.error('admin-loyalty GET /winback', err);
    res.status(500).json({ error: 'Failed to fetch winback queue' });
  }
});

// ── POST /adjust ───────────────────────────────────────────────────────────────
// Manual credit grant (positive) or deduct (negative) with full audit trail
const adjustSchema = z.object({
  userId:      z.string().min(1),
  amountCents: z.number().int().refine(n => n !== 0, { message: 'Amount cannot be zero' }),
  reason:      z.string().min(3).max(300),
});

router.post('/adjust', requireAdmin, async (req: any, res) => {
  try {
    const { userId, amountCents, reason } = adjustSchema.parse(req.body);

    // Verify user exists
    const [targetUser] = await db
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const adminEmail = req.firebaseUser?.email ?? 'admin';
    const note = `[admin_adjust] ${reason} — by ${adminEmail}`;

    const newBalance = await adjustLoyaltyBalance({
      userId,
      amountCents,
      eventType:  'admin_adjust',
      note,
    });

    logger.info('admin-loyalty: manual adjust', { userId, amountCents, adminEmail, reason });
    res.json({
      success:          true,
      targetUser,
      amountCents,
      newBalanceCents:  newBalance,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty POST /adjust', err);
    res.status(500).json({ error: err.message || 'Failed to adjust credits' });
  }
});

// ── GET /ledger ────────────────────────────────────────────────────────────────
// Recent system-wide ledger — last 200 rows with user email/name joined
router.get('/ledger', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 200);

    const rows = await db
      .select({
        id:              loyaltyLedger.id,
        userId:          loyaltyLedger.userId,
        eventType:       loyaltyLedger.eventType,
        amountIlsCents:  loyaltyLedger.amountIlsCents,
        balanceAfterCents: loyaltyLedger.balanceAfterCents,
        bookingId:       loyaltyLedger.bookingId,
        note:            loyaltyLedger.note,
        createdAt:       loyaltyLedger.createdAt,
        userName:        users.displayName,
        userEmail:       users.email,
      })
      .from(loyaltyLedger)
      .leftJoin(users, eq(loyaltyLedger.userId, users.id))
      .orderBy(desc(loyaltyLedger.createdAt))
      .limit(limit);

    res.json({ entries: rows });
  } catch (err: any) {
    logger.error('admin-loyalty GET /ledger', err);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

// ── GET /experiment-decisions ────────────────────────────────────────────────
// Returns all rows from experiment_decisions joined with per-variant funnel counts.
router.get('/experiment-decisions', requireAdmin, async (_req, res) => {
  try {
    const decisions = await db
      .select()
      .from(experimentDecisions)
      .orderBy(desc(experimentDecisions.updatedAt));

    // Also pull per-variant funnel for the same experiment keys
    const expKeys = decisions.map(d => d.experimentKey);
    const funnel = expKeys.length > 0
      ? await db
          .select({
            experimentKey: experimentEvents.experimentKey,
            variant:       experimentEvents.variant,
            event:         experimentEvents.event,
            cnt:           count(),
          })
          .from(experimentEvents)
          .where(inArray(experimentEvents.experimentKey, expKeys))
          .groupBy(experimentEvents.experimentKey, experimentEvents.variant, experimentEvents.event)
      : [];

    res.json({ decisions, funnel });
  } catch (err: any) {
    logger.error('admin-loyalty GET /experiment-decisions', err);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// ── POST /experiment-decisions/evaluate ─────────────────────────────────────
// Manually trigger the decision job (for admin testing / forcing a re-evaluation).
router.post('/experiment-decisions/evaluate', requireAdmin, async (_req, res) => {
  try {
    await runExperimentDecisionJob();
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('admin-loyalty POST /experiment-decisions/evaluate', err);
    res.status(500).json({ error: err.message || 'Evaluation failed' });
  }
});

// ── POST /experiment-decisions/promote ──────────────────────────────────────
// Promote the winner: sets promoted_at on the decision row.
// After this, the winback processor will only assign the winner variant.
const promoteSchema = z.object({
  experimentKey: z.string().min(1),
  notes:         z.string().max(500).optional(),
});

router.post('/experiment-decisions/promote', requireAdmin, async (req: any, res) => {
  try {
    const { experimentKey, notes } = promoteSchema.parse(req.body);
    const adminEmail = req.firebaseUser?.email ?? 'admin';

    const [decision] = await db
      .select()
      .from(experimentDecisions)
      .where(eq(experimentDecisions.experimentKey, experimentKey))
      .limit(1);

    if (!decision) return res.status(404).json({ error: 'No decision record for this experiment' });
    if (!decision.winnerVariant) return res.status(400).json({ error: 'No winner determined yet — run evaluation first' });
    if (decision.promotedAt) return res.status(409).json({ error: 'Already promoted' });

    await db
      .update(experimentDecisions)
      .set({
        promotedAt: new Date(),
        decidedBy:  adminEmail,
        notes:      notes ?? decision.notes,
        updatedAt:  new Date(),
      })
      .where(eq(experimentDecisions.experimentKey, experimentKey));

    logger.info('admin-loyalty: winner promoted', { experimentKey, winner: decision.winnerVariant, adminEmail });
    res.json({ ok: true, winnerVariant: decision.winnerVariant });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty POST /experiment-decisions/promote', err);
    res.status(500).json({ error: err.message || 'Promote failed' });
  }
});

// ── POST /experiment-decisions/pause-variant ─────────────────────────────────
// Admin override: add or remove a variant from the paused_variants list.
const pauseVariantSchema = z.object({
  experimentKey: z.string().min(1),
  variant:       z.enum(['ctrl', 'v1', 'v2']),
  paused:        z.boolean(),
  notes:         z.string().max(500).optional(),
});

router.post('/experiment-decisions/pause-variant', requireAdmin, async (req: any, res) => {
  try {
    const { experimentKey, variant, paused, notes } = pauseVariantSchema.parse(req.body);
    const adminEmail = req.firebaseUser?.email ?? 'admin';

    // Upsert the decision row
    const [existing] = await db
      .select({ pausedVariants: experimentDecisions.pausedVariants })
      .from(experimentDecisions)
      .where(eq(experimentDecisions.experimentKey, experimentKey))
      .limit(1);

    const currentPaused: string[] = existing?.pausedVariants ?? [];
    const nextPaused = paused
      ? Array.from(new Set([...currentPaused, variant]))
      : currentPaused.filter(v => v !== variant);

    await db
      .insert(experimentDecisions)
      .values({
        experimentKey,
        pausedVariants: nextPaused,
        decidedBy:      adminEmail,
        notes:          notes ?? null,
        updatedAt:      new Date(),
      })
      .onConflictDoUpdate({
        target: experimentDecisions.experimentKey,
        set: {
          pausedVariants: nextPaused,
          decidedBy:      adminEmail,
          notes:          notes ?? sql`experiment_decisions.notes`,
          updatedAt:      new Date(),
        },
      });

    // Stamp / clear paused_at on the winback_queue rows accordingly
    if (paused) {
      await db
        .update(winbackQueue)
        .set({ pausedAt: new Date(), pauseReason: 'admin' })
        .where(and(
          eq(winbackQueue.experimentVariant, variant),
          sql`${winbackQueue.status} IN ('pending','sent')`,
          sql`${winbackQueue.pausedAt} IS NULL`,
        ));
    } else {
      await db
        .update(winbackQueue)
        .set({ pausedAt: null, pauseReason: null })
        .where(and(
          eq(winbackQueue.experimentVariant, variant),
          eq(winbackQueue.pauseReason, 'admin'),
          sql`${winbackQueue.status} IN ('pending','sent')`,
        ));
    }

    logger.info('admin-loyalty: variant pause toggled', { experimentKey, variant, paused, adminEmail });
    res.json({ ok: true, pausedVariants: nextPaused });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty POST /experiment-decisions/pause-variant', err);
    res.status(500).json({ error: err.message || 'Pause-variant failed' });
  }
});

export default router;
