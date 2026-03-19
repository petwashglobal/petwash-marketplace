/**
 * experiment-decision.ts
 *
 * Runs after each winback processor batch (and can be triggered manually via admin API).
 * For each active winback experiment key:
 *
 *   1. Aggregates notification_sent + completed counts per variant from experiment_events.
 *   2. Calls evaluateExperiment() to determine statistical winner and variants to pause.
 *   3. Upserts the result into experiment_decisions (authoritative source).
 *   4. Stamps pending/sent winback_queue rows whose assigned variant is paused
 *      with paused_at + pause_reason (row-level suppression for processor).
 *
 * This job is deliberately idempotent — running it twice produces the same result.
 */

import { db }                  from '../db';
import { experimentEvents, experimentDecisions, winbackQueue } from '@shared/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { logger }              from '../lib/logger';
import { evaluateExperiment, VariantCounts } from '../utils/experimentStats';

const WINBACK_EXPERIMENT_KEYS = ['winback_14d', 'winback_30d', 'winback_60d'] as const;

export async function runExperimentDecisionJob(): Promise<void> {
  logger.info('[ExperimentDecision] Starting evaluation run');

  for (const expKey of WINBACK_EXPERIMENT_KEYS) {
    try {
      await evaluateWinbackExperiment(expKey);
    } catch (err: any) {
      logger.error('[ExperimentDecision] Error evaluating experiment', { expKey, error: err.message });
    }
  }

  logger.info('[ExperimentDecision] Evaluation run complete');
}

async function evaluateWinbackExperiment(experimentKey: string): Promise<void> {
  // ── 1. Aggregate sent + completed per variant ──────────────────────────────
  const rows = await db
    .select({
      variant:   experimentEvents.variant,
      event:     experimentEvents.event,
      cnt:       sql<number>`count(*)::int`,
      firstSent: sql<Date | null>`min(${experimentEvents.createdAt}) filter (where ${experimentEvents.event} = 'notification_sent')`,
    })
    .from(experimentEvents)
    .where(eq(experimentEvents.experimentKey, experimentKey))
    .groupBy(experimentEvents.variant, experimentEvents.event);

  if (rows.length === 0) {
    logger.info('[ExperimentDecision] No data for experiment', { experimentKey });
    return;
  }

  // Build VariantCounts map
  const variantMap = new Map<string, VariantCounts>();
  for (const row of rows) {
    if (!variantMap.has(row.variant)) {
      variantMap.set(row.variant, {
        variant: row.variant,
        sent: 0,
        completed: 0,
        firstSentAt: null,
      });
    }
    const v = variantMap.get(row.variant)!;
    if (row.event === 'notification_sent') {
      v.sent       = row.cnt;
      v.firstSentAt = row.firstSent;
    }
    if (row.event === 'completed') {
      v.completed  = row.cnt;
    }
  }
  const variants = Array.from(variantMap.values());

  // ── 2. Run statistical evaluation ─────────────────────────────────────────
  const result = evaluateExperiment(experimentKey, variants);

  logger.info('[ExperimentDecision] Evaluation result', {
    experimentKey,
    winnerVariant: result.winnerVariant,
    pauseVariants: result.pauseVariants,
    hasEnoughData: result.hasEnoughData,
  });

  if (!result.winnerVariant && result.pauseVariants.length === 0) {
    // Nothing to decide yet — but still persist the current confidence state
    // so the admin UI can show progress bars even before thresholds are hit.
    const bestChallenger = result.challengers.reduce(
      (best, c) => c.confidencePct > (best?.confidencePct ?? -Infinity) ? c : best,
      null as (typeof result.challengers)[0] | null,
    );

    await db
      .insert(experimentDecisions)
      .values({
        experimentKey,
        winnerVariant:  null,
        pausedVariants: [],
        decidedBy:      'auto',
        confidencePct:  bestChallenger?.confidencePct?.toString() ?? null,
        upliftPct:      bestChallenger?.upliftPct?.toString() ?? null,
        updatedAt:      new Date(),
      })
      .onConflictDoUpdate({
        target: experimentDecisions.experimentKey,
        set: {
          confidencePct: bestChallenger?.confidencePct?.toString() ?? null,
          upliftPct:     bestChallenger?.upliftPct?.toString() ?? null,
          updatedAt:     new Date(),
        },
      });
    return;
  }

  // ── 3. Upsert into experiment_decisions ───────────────────────────────────
  // Only set winnerVariant if not already promoted (don't overwrite a manual decision)
  const [existing] = await db
    .select({ winnerVariant: experimentDecisions.winnerVariant, promotedAt: experimentDecisions.promotedAt })
    .from(experimentDecisions)
    .where(eq(experimentDecisions.experimentKey, experimentKey))
    .limit(1);

  const isAlreadyPromoted = !!existing?.promotedAt;

  const bestChallenger = result.challengers.find(c => c.variant === result.winnerVariant);

  await db
    .insert(experimentDecisions)
    .values({
      experimentKey,
      winnerVariant:  isAlreadyPromoted ? existing!.winnerVariant : result.winnerVariant,
      pausedVariants: result.pauseVariants,
      decidedBy:      'auto',
      confidencePct:  bestChallenger?.confidencePct?.toString() ?? null,
      upliftPct:      bestChallenger?.upliftPct?.toString() ?? null,
      updatedAt:      new Date(),
    })
    .onConflictDoUpdate({
      target: experimentDecisions.experimentKey,
      set: {
        winnerVariant:  isAlreadyPromoted
          ? existing!.winnerVariant
          : sql`EXCLUDED.winner_variant`,
        pausedVariants: sql`EXCLUDED.paused_variants`,
        confidencePct:  sql`EXCLUDED.confidence_pct`,
        upliftPct:      sql`EXCLUDED.uplift_pct`,
        updatedAt:      new Date(),
      },
    });

  // ── 4. Stamp paused winback_queue rows ───────────────────────────────────
  if (result.pauseVariants.length > 0) {
    const updated = await db
      .update(winbackQueue)
      .set({
        pausedAt:    new Date(),
        pauseReason: 'losing',
      })
      .where(and(
        sql`${winbackQueue.trigger} = ${experimentKey.replace('winback_', '')}`,
        sql`${winbackQueue.status} IN ('pending', 'sent')`,
        sql`${winbackQueue.pausedAt} IS NULL`,
        inArray(winbackQueue.experimentVariant, result.pauseVariants),
      ))
      .returning({ id: winbackQueue.id });

    logger.info('[ExperimentDecision] Stamped paused queue rows', {
      experimentKey,
      pausedVariants: result.pauseVariants,
      rowsStamped: updated.length,
    });
  }
}
