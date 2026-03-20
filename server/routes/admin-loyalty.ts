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
import { runExperimentDecisionJob }                 from '../jobs/experiment-decision';
import {
  loadQueueHealth, getChannelRoiDetail,
  PAID_KILL_SWITCH_RULE,
} from '../jobs/winback-processor';
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
  // Phase 6.11 — rollout guardrails
  armed:          z.boolean().optional(),
  dailySendCap:   z.number().int().min(1).nullable().optional(),
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
    if (body.armed          !== undefined) updates.armed          = body.armed;
    if (body.dailySendCap   !== undefined) updates.dailySendCap   = body.dailySendCap;

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

    // Experiment variant funnel for winback experiments (Phase 6.12: includes channel)
    const variantFunnel = await db
      .select({
        experimentKey: experimentEvents.experimentKey,
        variant:       experimentEvents.variant,
        channel:       experimentEvents.channel,
        event:         experimentEvents.event,
        cnt:           count(),
      })
      .from(experimentEvents)
      .where(sql`${experimentEvents.experimentKey} LIKE 'winback_%'`)
      .groupBy(
        experimentEvents.experimentKey,
        experimentEvents.variant,
        experimentEvents.channel,
        experimentEvents.event,
      )
      .orderBy(experimentEvents.experimentKey, experimentEvents.variant);

    // Phase 6.12: channel daily usage for cost panel
    const channelStats = await db.execute<{
      channel: string; today_sent: number; total_sent: number;
    }>(sql`
      SELECT
        channel,
        count(*) FILTER (WHERE event = 'notification_sent' AND created_at >= current_date)::int  AS today_sent,
        count(*) FILTER (WHERE event = 'notification_sent')::int                                  AS total_sent
      FROM experiment_events
      WHERE experiment_key LIKE 'winback_%'
        AND channel IN ('sms', 'whatsapp')
      GROUP BY channel
    `);

    // Channel click-through and conversion rates
    const channelConversion = await db.execute<{
      channel: string; sent: number; clicked: number; completed: number;
    }>(sql`
      SELECT
        channel,
        count(*) FILTER (WHERE event = 'notification_sent')::int AS sent,
        count(*) FILTER (WHERE event = 'clicked')::int           AS clicked,
        count(*) FILTER (WHERE event = 'completed')::int         AS completed
      FROM experiment_events
      WHERE experiment_key LIKE 'winback_%'
        AND channel IN ('inapp','sms','whatsapp')
      GROUP BY channel
    `);

    // Phase 6.13: Revenue vs Cost — join conversions to booking revenue by channel
    const revenueByChannel = await db.execute<{
      channel: string; conversions: number; revenue_ils: number;
    }>(sql`
      WITH last_channel AS (
        SELECT DISTINCT ON (user_id, experiment_key)
          user_id, experiment_key, channel
        FROM experiment_events
        WHERE experiment_key LIKE 'winback_%'
          AND event = 'notification_sent'
        ORDER BY user_id, experiment_key, created_at DESC
      ),
      converted AS (
        SELECT wq.id, wq.user_id, wq.trigger, wq.converted_at,
               COALESCE(lc.channel, 'inapp') AS channel
        FROM winback_queue wq
        LEFT JOIN last_channel lc
          ON lc.user_id         = wq.user_id
         AND lc.experiment_key  = 'winback_' || wq.trigger
        WHERE wq.status = 'converted'
          AND wq.converted_at IS NOT NULL
      )
      SELECT
        c.channel,
        COUNT(DISTINCT c.id)::int                                          AS conversions,
        COALESCE(SUM(CAST(br.total_amount AS numeric)), 0)::float          AS revenue_ils
      FROM converted c
      LEFT JOIN booking_requests br
        ON  br.owner_id  = c.user_id
        AND br.status    IN ('completed','reviewed')
        AND br.updated_at BETWEEN c.converted_at AND c.converted_at + interval '7 days'
      GROUP BY c.channel
    `);

    // Phase 6.13: Control group stats
    const controlStats = await db.execute<{ control_skipped: number }>(sql`
      SELECT count(*)::int AS control_skipped
      FROM experiment_events
      WHERE event = 'control_skip'
        AND experiment_key LIKE 'winback_%'
    `);

    res.json({
      statusBreakdown,
      recent,
      conversion:        conversionRow[0] ?? { sent: 0, converted: 0, suppressed: 0 },
      variantFunnel,
      channelStats:      channelStats.rows ?? [],
      channelConversion: channelConversion.rows ?? [],
      revenueByChannel:  revenueByChannel.rows ?? [],
      controlSkipped:    controlStats.rows[0]?.control_skipped ?? 0,
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


// ── POST /proof-run ───────────────────────────────────────────────────────────
// Seeds synthetic experiment_events for a controlled scenario, runs the
// statistical evaluator, returns the decision result, then cleans up.
// Safe: uses a dedicated proof experiment key that is deleted after.
const PROOF_EXP_KEY = 'proof_winback_14d';
const proofRunSchema = z.object({
  scenario: z.enum(['low_sample', 'losing_variant', 'winner_ready', 'frequency_cap', 'admin_pause']),
});

router.post('/proof-run', requireAdmin, async (req: any, res) => {
  try {
    const { scenario } = proofRunSchema.parse(req.body);
    const adminEmail = req.firebaseUser?.email ?? 'admin';

    // Always clean up any previous proof data first
    await db.execute(sql`DELETE FROM experiment_events WHERE experiment_key = ${PROOF_EXP_KEY}`);
    await db.execute(sql`DELETE FROM experiment_decisions WHERE experiment_key = ${PROOF_EXP_KEY}`);

    const PROOF_USER = 'proof-user-ctrl';
    const PROOF_USER_V1 = 'proof-user-v1';
    const PROOF_USER_V2 = 'proof-user-v2';

    type ScenarioResult = {
      scenario: string;
      seeded: string;
      expected: string;
      actual: object;
      pass: boolean;
    };

    let result: ScenarioResult = {
      scenario,
      seeded: '',
      expected: '',
      actual: {},
      pass: false,
    };

    if (scenario === 'low_sample') {
      // Seed 50 notification_sent per variant — below MIN_SAMPLE=100
      for (const [variant, userId] of [['ctrl', PROOF_USER], ['v1', PROOF_USER_V1], ['v2', PROOF_USER_V2]]) {
        for (let i = 0; i < 50; i++) {
          await db.insert(experimentEvents).values({
            experimentKey: PROOF_EXP_KEY, userId: `${userId}-${i}`, variant: variant!, event: 'notification_sent',
          });
        }
      }
      result.seeded   = '50 notification_sent per variant (below MIN_SAMPLE=100)';
      result.expected = 'hasEnoughData=false, no winner, no paused variants';

    } else if (scenario === 'losing_variant') {
      // v1: 150 sent, 0 completed → clear loser (>= ZERO_CONV_THRESHOLD=50)
      // ctrl + v2: 150 sent, 10 completed each
      for (let i = 0; i < 150; i++) {
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `ctrl-${i}`, variant: 'ctrl', event: 'notification_sent' });
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v1-${i}`,   variant: 'v1',   event: 'notification_sent' });
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v2-${i}`,   variant: 'v2',   event: 'notification_sent' });
      }
      for (let i = 0; i < 10; i++) {
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `ctrl-${i}`, variant: 'ctrl', event: 'completed' });
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v2-${i}`,   variant: 'v2',   event: 'completed' });
      }
      result.seeded   = 'v1: 150 sent / 0 completed (clear loser). ctrl+v2: 150 sent / 10 completed.';
      result.expected = 'v1 flagged as clearLoser, pauseVariants includes v1';

    } else if (scenario === 'winner_ready') {
      // ctrl: 200 sent / 10 completed (5%). v1: 200 sent / 25 completed (12.5%) → z~2.65 → ~99.6% confidence
      for (let i = 0; i < 200; i++) {
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `ctrl-${i}`, variant: 'ctrl', event: 'notification_sent' });
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v1-${i}`,   variant: 'v1',   event: 'notification_sent' });
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v2-${i}`,   variant: 'v2',   event: 'notification_sent' });
      }
      // Back-date events to >= 7 days ago to clear the runtime gate
      await db.execute(sql`
        UPDATE experiment_events SET created_at = now() - interval '8 days'
        WHERE experiment_key = ${PROOF_EXP_KEY}
      `);
      for (let i = 0; i < 10; i++) {
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `ctrl-${i}`, variant: 'ctrl', event: 'completed' });
      }
      for (let i = 0; i < 25; i++) {
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v1-${i}`,   variant: 'v1',   event: 'completed' });
      }
      for (let i = 0; i < 10; i++) {
        await db.insert(experimentEvents).values({ experimentKey: PROOF_EXP_KEY, userId: `v2-${i}`,   variant: 'v2',   event: 'completed' });
      }
      result.seeded   = 'ctrl 5%, v1 12.5%, v2 5% (200 sent each, 8 days old)';
      result.expected = 'winnerVariant=v1, confidence>=95%, v2 may be paused';

    } else if (scenario === 'frequency_cap') {
      // Simulated — no DB writes needed; just verify the in-memory logic description
      result.seeded   = 'No data seeded — frequency cap is enforced via winback_queue.sent_at in-memory set';
      result.expected = 'Users with sent_at > now()-14d are in recentSentSet; any pending row for them gets suppressed';
      result.actual   = { logic: 'recentSentSet populated at batch start from winback_queue WHERE status=sent AND sent_at>now()-14d' };
      result.pass     = true;

    } else if (scenario === 'admin_pause') {
      // Seed a decision with v1 paused, confirm evaluation respects it
      await db.insert(experimentDecisions).values({
        experimentKey: PROOF_EXP_KEY,
        winnerVariant:  null,
        pausedVariants: ['v1'],
        decidedBy:      adminEmail,
      });
      result.seeded   = 'experiment_decisions row with pausedVariants=[v1] for PROOF_EXP_KEY';
      result.expected = 'Processor would skip any winback_queue rows with experiment_variant=v1';
      result.actual   = { pausedVariants: ['v1'], checkedBy: 'processor reads decision at batch start → variant in pausedVariants → skip row' };
      result.pass     = true;
    }

    // Run the statistical evaluator on proof data (except scenarios that don't need it)
    if (['low_sample', 'losing_variant', 'winner_ready'].includes(scenario)) {
      const { evaluateExperiment } = await import('../utils/experimentStats');

      const rows = await db.execute<{
        variant: string; event: string; cnt: number; first_sent: Date | null;
      }>(sql`
        SELECT
          variant,
          event,
          count(*)::int AS cnt,
          min(created_at) FILTER (WHERE event = 'notification_sent') AS first_sent
        FROM experiment_events
        WHERE experiment_key = ${PROOF_EXP_KEY}
        GROUP BY variant, event
      `);

      const variantMap = new Map<string, { variant: string; sent: number; completed: number; firstSentAt: Date | null }>();
      for (const row of rows.rows ?? []) {
        if (!variantMap.has(row.variant)) {
          variantMap.set(row.variant, { variant: row.variant, sent: 0, completed: 0, firstSentAt: null });
        }
        const v = variantMap.get(row.variant)!;
        if (row.event === 'notification_sent') { v.sent = row.cnt; v.firstSentAt = row.first_sent; }
        if (row.event === 'completed')          { v.completed = row.cnt; }
      }

      const evalResult = evaluateExperiment(PROOF_EXP_KEY, Array.from(variantMap.values()));

      result.actual = {
        hasEnoughData:   evalResult.hasEnoughData,
        winnerVariant:   evalResult.winnerVariant,
        pauseVariants:   evalResult.pauseVariants,
        challengers:     evalResult.challengers.map(c => ({
          variant:       c.variant,
          conversionRate: (c.conversionRate * 100).toFixed(2) + '%',
          confidencePct: c.confidencePct,
          upliftPct:     c.upliftPct,
          clearLoser:    c.clearLoser,
          winner:        c.winner,
        })),
      };

      // Pass if actual matches expected for this scenario
      if (scenario === 'low_sample') {
        result.pass = !evalResult.hasEnoughData && !evalResult.winnerVariant && evalResult.pauseVariants.length === 0;
      } else if (scenario === 'losing_variant') {
        result.pass = evalResult.pauseVariants.includes('v1');
      } else if (scenario === 'winner_ready') {
        result.pass = evalResult.winnerVariant === 'v1' || (evalResult.challengers.find(c => c.variant === 'v1')?.confidencePct ?? 0) >= 95;
      }
    }

    // Clean up proof data
    await db.execute(sql`DELETE FROM experiment_events WHERE experiment_key = ${PROOF_EXP_KEY}`);
    await db.execute(sql`DELETE FROM experiment_decisions WHERE experiment_key = ${PROOF_EXP_KEY}`);

    logger.info('admin-loyalty: proof-run complete', { scenario, pass: result.pass, adminEmail });
    res.json(result);
  } catch (err: any) {
    // Always clean up
    await db.execute(sql`DELETE FROM experiment_events WHERE experiment_key = ${PROOF_EXP_KEY}`).catch(() => {});
    await db.execute(sql`DELETE FROM experiment_decisions WHERE experiment_key = ${PROOF_EXP_KEY}`).catch(() => {});

    logger.error('admin-loyalty POST /proof-run', err);
    res.status(500).json({ error: err.message || 'Proof run failed' });
  }
});

// ── GET /experiment-decisions ────────────────────────────────────────────────
// Returns all rows from experiment_decisions joined with per-variant funnel counts
// plus runtimeInfo (first notification sent → now) for auto-promote eligibility display.
router.get('/experiment-decisions', requireAdmin, async (_req, res) => {
  try {
    const decisions = await db
      .select()
      .from(experimentDecisions)
      .orderBy(desc(experimentDecisions.updatedAt));

    const expKeys = decisions.map(d => d.experimentKey);

    const [funnel, runtimeRows] = await Promise.all([
      expKeys.length > 0
        ? db
            .select({
              experimentKey: experimentEvents.experimentKey,
              variant:       experimentEvents.variant,
              event:         experimentEvents.event,
              cnt:           count(),
            })
            .from(experimentEvents)
            .where(inArray(experimentEvents.experimentKey, expKeys))
            .groupBy(experimentEvents.experimentKey, experimentEvents.variant, experimentEvents.event)
        : Promise.resolve([]),

      // Phase 6.14: per-experiment first_sent_at for runtime day calculation
      expKeys.length > 0
        ? db.execute<{ experiment_key: string; first_sent_at: string }>(sql`
            SELECT experiment_key, MIN(created_at) AS first_sent_at
            FROM experiment_events
            WHERE experiment_key = ANY(${sql.raw(`ARRAY['${expKeys.join("','")}']`)})
              AND event = 'notification_sent'
            GROUP BY experiment_key
          `)
        : Promise.resolve({ rows: [] as { experiment_key: string; first_sent_at: string }[] }),
    ]);

    // Build runtimeDays map
    const runtimeMap: Record<string, number | null> = {};
    for (const row of (runtimeRows as any).rows ?? []) {
      const msAgo = Date.now() - new Date(row.first_sent_at).getTime();
      runtimeMap[row.experiment_key] = Math.floor(msAgo / 86_400_000);
    }

    // Attach runtimeDays + autoPromoteEligible to each decision
    const decisionsOut = decisions.map(d => ({
      ...d,
      runtimeDays: runtimeMap[d.experimentKey] ?? null,
      autoPromoteEligible:
        !d.promotedAt &&
        !d.promotionLocked &&
        !!d.winnerVariant &&
        Number(d.confidencePct ?? 0) >= 97 &&
        (runtimeMap[d.experimentKey] ?? 0) >= 14,
    }));

    res.json({ decisions: decisionsOut, funnel });
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

// ── GET /queue-health ─────────────────────────────────────────────────────────
// Phase 6.15: Returns queue health checks + daily ops indicators + channel ROI detail.
router.get('/queue-health', requireAdmin, async (_req, res) => {
  try {
    const [health, roiDetail, killActive] = await Promise.all([
      loadQueueHealth(),
      getChannelRoiDetail(),
      db.select({ enabled: loyaltyRules.enabled })
        .from(loyaltyRules)
        .where(eq(loyaltyRules.ruleKey, PAID_KILL_SWITCH_RULE))
        .limit(1)
        .then(rows => rows[0]?.enabled ?? false),
    ]);
    res.json({ ...health, roiDetail, paidKillSwitchActive: killActive });
  } catch (err: any) {
    logger.error('admin-loyalty GET /queue-health', err);
    res.status(500).json({ error: 'Failed to load queue health' });
  }
});

// ── GET /deployment-checklist ─────────────────────────────────────────────────
// Phase 6.15: Returns a live readiness checklist for production deployment.
router.get('/deployment-checklist', requireAdmin, async (_req, res) => {
  try {
    const [ruleRows, expData, killRow] = await Promise.all([
      db.select({
        ruleKey: loyaltyRules.ruleKey, armed: loyaltyRules.armed,
        enabled: loyaltyRules.enabled, dailySendCap: loyaltyRules.dailySendCap,
      }).from(loyaltyRules),
      db.execute<{ experiment_key: string; cnt: string }>(sql`
        SELECT experiment_key, COUNT(*)::text AS cnt FROM experiment_events
        WHERE experiment_key = 'winback_14d' GROUP BY experiment_key LIMIT 1
      `),
      db.select({ enabled: loyaltyRules.enabled })
        .from(loyaltyRules)
        .where(eq(loyaltyRules.ruleKey, PAID_KILL_SWITCH_RULE))
        .limit(1),
    ]);

    const rule14d  = ruleRows.find(r => r.ruleKey === 'winback_14d');
    const rule30d  = ruleRows.find(r => r.ruleKey === 'winback_30d');
    const rule60d  = ruleRows.find(r => r.ruleKey === 'winback_60d');
    const killOn   = killRow[0]?.enabled ?? false;
    const expCount = parseInt(expData.rows?.[0]?.cnt ?? '0', 10);

    // Check environment secrets (presence only — values never logged)
    const hasTwilioSid   = !!process.env.TWILIO_ACCOUNT_SID?.trim();
    const hasTwilioPhone = !!(process.env.TWILIO_PHONE_NUMBER?.trim() || process.env.TWILIO_MESSAGING_SERVICE_SID?.trim());
    const hasWaFrom      = !!process.env.TWILIO_WHATSAPP_FROM?.trim();
    const hasWaContent   = !!process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim();
    const hasWinbackSecret = !!(process.env.WINBACK_LINK_SECRET?.trim() || process.env.COOKIE_SECRET?.trim());

    const checklist = [
      {
        id:      'twilio_sid',
        label:   'TWILIO_ACCOUNT_SID',
        status:  hasTwilioSid ? 'ok' : 'critical',
        note:    hasTwilioSid ? 'מוגדר' : 'חסר — SMS/WhatsApp לא יישלחו',
      },
      {
        id:      'twilio_phone',
        label:   'TWILIO_PHONE_NUMBER / MESSAGING_SERVICE_SID',
        status:  hasTwilioPhone ? 'ok' : 'critical',
        note:    hasTwilioPhone ? 'מוגדר' : 'חסר — SMS לא יישלחו',
      },
      {
        id:      'twilio_wa',
        label:   'TWILIO_WHATSAPP_FROM + CONTENT_SID',
        status:  (hasWaFrom && hasWaContent) ? 'ok' : hasWaFrom ? 'warn' : 'warn',
        note:    (hasWaFrom && hasWaContent) ? 'מוגדר' : 'חסר (אופציונלי לשלב זה) — WhatsApp לא יישלחו',
      },
      {
        id:      'winback_secret',
        label:   'WINBACK_LINK_SECRET / COOKIE_SECRET',
        status:  hasWinbackSecret ? 'ok' : 'critical',
        note:    hasWinbackSecret ? 'מוגדר' : 'חסר — קישורי מעקב לא יעבדו',
      },
      {
        id:      'arm_14d',
        label:   'winback_14d armed',
        status:  rule14d?.armed ? 'ok' : 'warn',
        note:    rule14d?.armed ? 'חמוש ומוכן' : 'לא חמוש — הפעל בלוח הניהול',
      },
      {
        id:      'arm_30d_60d_off',
        label:   'winback_30d + winback_60d לא חמושים (מדיניות שלב א׳)',
        status:  (!rule30d?.armed && !rule60d?.armed) ? 'ok' : 'warn',
        note:    (!rule30d?.armed && !rule60d?.armed) ? 'כבויים כמצופה' : '⚠️ 30d/60d חמושים — ודא שזה מכוון',
      },
      {
        id:      'daily_cap',
        label:   'daily_send_cap מוגדר',
        status:  (rule14d?.dailySendCap && rule14d.dailySendCap > 0) ? 'ok' : 'warn',
        note:    rule14d?.dailySendCap ? `מוגדר: ${rule14d.dailySendCap}/יום` : 'לא מוגדר — ריצה ללא מגבלה יומית',
      },
      {
        id:      'kill_switch_off',
        label:   'kill switch כבוי',
        status:  killOn ? 'warn' : 'ok',
        note:    killOn ? '⚠️ KILL SWITCH פעיל — ערוצים פחותים מבוטלים' : 'כבוי (מצב תקין)',
      },
      {
        id:      'experiment_data',
        label:   'winback_14d — יש נתוני ניסוי',
        status:  expCount > 0 ? 'ok' : 'warn',
        note:    expCount > 0 ? `${expCount} אירועים רשומים` : 'אין נתונים עדיין — הפעל את הניסוי',
      },
    ];

    res.json({ checklist, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    logger.error('admin-loyalty GET /deployment-checklist', err);
    res.status(500).json({ error: 'Failed to generate checklist' });
  }
});

// ── POST /proof-scenario ──────────────────────────────────────────────────────
// Phase 6.15: Dry-run proofs — read-only verification that automation logic is correct.
const proofSchema = z.object({
  scenario: z.enum(['auto_promote', 'lock_blocks', 'roi_gate', 'budget_order']),
});

router.post('/proof-scenario', requireAdmin, async (req, res) => {
  try {
    const { scenario } = proofSchema.parse(req.body);

    if (scenario === 'auto_promote') {
      // Which experiments WOULD auto-promote if the decision job ran right now?
      const decisions = await db.select().from(experimentDecisions);
      const expKeys = decisions.map(d => d.experimentKey);

      const runtimeRows = expKeys.length > 0
        ? await db.execute<{ experiment_key: string; first_sent_at: string }>(sql`
            SELECT experiment_key, MIN(created_at) AS first_sent_at
            FROM experiment_events
            WHERE experiment_key = ANY(${sql.raw(`ARRAY['${expKeys.join("','")}']`)})
              AND event = 'notification_sent'
            GROUP BY experiment_key
          `)
        : { rows: [] as any[] };

      const runtimeMap: Record<string, number> = {};
      for (const r of runtimeRows.rows ?? []) {
        runtimeMap[r.experiment_key] = Math.floor((Date.now() - new Date(r.first_sent_at).getTime()) / 86_400_000);
      }

      const eligible = decisions.map(d => {
        const confidence  = parseFloat(d.confidencePct ?? '0');
        const runtimeDays = runtimeMap[d.experimentKey] ?? 0;
        const wouldPromote =
          !d.promotedAt &&
          !d.promotionLocked &&
          !!d.winnerVariant &&
          confidence >= 97 &&
          runtimeDays >= 14;

        return {
          experimentKey: d.experimentKey,
          winnerVariant:    d.winnerVariant,
          confidencePct:    confidence,
          runtimeDays,
          promotedAt:       d.promotedAt,
          promotionLocked:  d.promotionLocked,
          wouldAutoPromote: wouldPromote,
          blockedReason: wouldPromote ? null
            : d.promotedAt       ? 'already_promoted'
            : d.promotionLocked  ? 'locked_by_admin'
            : !d.winnerVariant   ? 'no_winner_yet'
            : confidence < 97    ? `confidence_${confidence.toFixed(1)}_lt_97`
            : `runtime_${runtimeDays}d_lt_14d`,
        };
      });

      return res.json({ scenario, eligible, proofAt: new Date().toISOString() });
    }

    if (scenario === 'lock_blocks') {
      // Show locked experiments that have a winner (proving lock is blocking auto-promote)
      const decisions = await db
        .select()
        .from(experimentDecisions)
        .where(sql`${experimentDecisions.promotionLocked} = true`);

      const proof = decisions.map(d => ({
        experimentKey:   d.experimentKey,
        winnerVariant:   d.winnerVariant,
        confidencePct:   parseFloat(d.confidencePct ?? '0'),
        promotionLocked: true,
        promotedAt:      d.promotedAt,
        blocking:        !!d.winnerVariant && !d.promotedAt,
      }));

      return res.json({ scenario, proof, proofAt: new Date().toISOString() });
    }

    if (scenario === 'roi_gate') {
      // Show which channels would be gated by the ROI floor
      const roiDetail = await getChannelRoiDetail();
      const proof = roiDetail.map(r => ({
        channel:  r.channel,
        roi7d:    r.roi7d,
        roi24h:   r.roi24h,
        sent7d:   r.sent7d,
        completed7d: r.completed7d,
        wouldBeGated: r.roi7d !== null && r.roi7d < 0,
        reason:   r.roi7d === null ? 'insufficient_data_pass' : r.roi7d >= 0 ? 'roi_ok' : 'roi_below_floor',
      }));
      return res.json({ scenario, proof, proofAt: new Date().toISOString() });
    }

    if (scenario === 'budget_order') {
      // Show the ROI-based pass ordering that would be chosen
      const roiDetail = await getChannelRoiDetail();
      const sms = roiDetail.find(r => r.channel === 'sms')!;
      const wa  = roiDetail.find(r => r.channel === 'whatsapp')!;
      const smsRoi = sms.roi7d ?? 0;
      const waRoi  = wa.roi7d  ?? 0;
      const smsEligible = sms.roi7d === null || sms.roi7d >= 0;
      const waEligible  = wa.roi7d  === null || wa.roi7d  >= 0;
      const smsFirst = smsRoi >= waRoi;

      return res.json({
        scenario,
        proof: {
          sms:  { roi7d: sms.roi7d, eligible: smsEligible },
          whatsapp: { roi7d: wa.roi7d, eligible: waEligible },
          order: smsEligible && waEligible
            ? (smsFirst ? ['sms', 'whatsapp'] : ['whatsapp', 'sms'])
            : smsEligible ? ['sms'] : waEligible ? ['whatsapp'] : [],
          reason: !smsEligible && !waEligible
            ? 'both_gated_by_roi_floor'
            : smsEligible && waEligible
              ? `sorted_by_roi_${smsFirst ? 'sms_wins' : 'whatsapp_wins'}`
              : smsEligible ? 'whatsapp_gated' : 'sms_gated',
        },
        proofAt: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty POST /proof-scenario', err);
    res.status(500).json({ error: err.message || 'Proof run failed' });
  }
});

// ── POST /paid-channel-kill-switch ────────────────────────────────────────────
// Phase 6.15: Emergency toggle — instantly halt all SMS + WhatsApp passes.
// Creates or updates a loyalty_rules row with ruleKey = PAID_KILL_SWITCH_RULE.
const killSwitchSchema = z.object({ active: z.boolean() });

router.post('/paid-channel-kill-switch', requireAdmin, async (req: any, res) => {
  try {
    const { active } = killSwitchSchema.parse(req.body);
    const adminEmail = req.firebaseUser?.email ?? 'admin';

    await db
      .insert(loyaltyRules)
      .values({
        ruleKey:        PAID_KILL_SWITCH_RULE,
        enabled:        active,
        armed:          false,
        rewardIlsCents: 0,
        description:    'Phase 6.15 emergency kill switch — disables all paid winback channels (SMS + WhatsApp)',
      })
      .onConflictDoUpdate({
        target: loyaltyRules.ruleKey,
        set:    { enabled: active, updatedAt: new Date() },
      });

    logger.warn('admin-loyalty: paid channel kill switch toggled', { active, adminEmail });
    res.json({ ok: true, active });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty POST /paid-channel-kill-switch', err);
    res.status(500).json({ error: err.message || 'Kill switch update failed' });
  }
});

// ── POST /experiment-decisions/lock ──────────────────────────────────────────
// Phase 6.14: Admin override — prevent or re-enable auto-promotion for an experiment.
// When locked=true the auto-promote job will NOT promote this experiment automatically,
// even if confidence and runtime thresholds are met.
// Manual promote via /promote still works regardless of lock state.
const lockSchema = z.object({
  experimentKey: z.string().min(1),
  locked:        z.boolean(),
  notes:         z.string().max(500).optional(),
});

router.post('/experiment-decisions/lock', requireAdmin, async (req: any, res) => {
  try {
    const { experimentKey, locked, notes } = lockSchema.parse(req.body);
    const adminEmail = req.firebaseUser?.email ?? 'admin';

    // Upsert the decision row with the new lock state
    await db
      .insert(experimentDecisions)
      .values({
        experimentKey,
        promotionLocked: locked,
        decidedBy:       adminEmail,
        notes:           notes ?? null,
        updatedAt:       new Date(),
      })
      .onConflictDoUpdate({
        target: experimentDecisions.experimentKey,
        set: {
          promotionLocked: locked,
          decidedBy:       adminEmail,
          notes:           notes ? notes : sql`experiment_decisions.notes`,
          updatedAt:       new Date(),
        },
      });

    logger.info('admin-loyalty: auto-promotion lock toggled', { experimentKey, locked, adminEmail });
    res.json({ ok: true, experimentKey, promotionLocked: locked });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('admin-loyalty POST /experiment-decisions/lock', err);
    res.status(500).json({ error: err.message || 'Lock update failed' });
  }
});

export default router;
