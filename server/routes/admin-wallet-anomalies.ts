/**
 * AI-W1 — AI Wallet Anomaly Monitor
 *
 * Admin-only endpoint that scans recent wallet_ledger_entries activity,
 * aggregates per user (PII-stripped), asks Gemini to score 0..100 risk,
 * and returns flagged users for HUMAN admin review.
 *
 * What it does NOT do (per platform skill §3 — AI is advisory, never executive):
 *   - refund or credit any money
 *   - change account status (block / suspend / restrict)
 *   - notify customers
 *   - touch payment runtime (Tranzila, Nayax, K9000)
 *   - call any external API other than the existing Gemini wrapper
 *
 * Output is a list of flagged user IDs with severity + evidence + a
 * suggested admin action. Admin reads, clicks through to the user, and
 * decides themselves. Every consequential action is a human click.
 *
 * Cost: 1 Gemini call per scan run (~$0.0001 at 2026 Flash prices),
 * using the existing safeGenerate wrapper that handles quota + backoff.
 * Falls back to deterministic threshold scoring when Gemini is
 * unavailable — zero cost in fallback mode, scans still produce useful
 * output.
 *
 * Mounted at /api/admin/wallet/anomalies, inherits the full /api/admin/*
 * security stack (adminLimiter + requireRole + requireStaffApproved +
 * requireMfaEnrolled).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { and, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { walletLedgerEntries } from '@shared/schema';
import { logger } from '../lib/logger';
import { safeGenerate } from '../lib/gemini-client';
import { getFeatureFlag } from '../services/SystemConfig';

const router = Router();

// ── Tunables — exposed as constants so a future config endpoint can tweak ──
const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 30;
const MAX_USERS_TO_SCORE = 100; // bound the Gemini prompt size

// Deterministic anomaly thresholds — used as fallback AND as a backstop
// even when Gemini is on. A user that triggers EITHER the model or the
// thresholds shows up in the result set; the union is what admin reviews.
const THRESHOLD_LARGE_DEBIT_CENTS = 50_000;   // ₪500 single debit
const THRESHOLD_REFUND_COUNT_HIGH = 3;        // ≥3 refunds in window
const THRESHOLD_KIOSK_COUNT_HIGH  = 8;        // user touched ≥8 kiosks
const THRESHOLD_OFFHOURS_RATIO    = 0.6;      // ≥60% activity outside 7–23 IL

// ── Request validation ──────────────────────────────────────────────────────
const ScanBodySchema = z.object({
  lookbackDays: z.number().int().min(1).max(MAX_LOOKBACK_DAYS).optional().default(DEFAULT_LOOKBACK_DAYS),
  // Optional: scope the scan to a subset of userIds. If omitted, scans all
  // active users in the window.
  userIds: z.array(z.string().min(1).max(128)).max(500).optional(),
});

interface UserAggregate {
  userId: string;
  totalCredits: number;
  totalDebits: number;
  refundCount: number;
  largestSingleDebit: number;
  txnCount: number;
  uniqueKioskCount: number;
  uniqueIpCount: number;          // count only — raw IPs NEVER leave the server
  offhoursRatio: number;          // 0..1; fraction outside 07:00–23:00 IL
  divisionMix: Record<string, number>; // e.g. { station_k9000: 5, walkers: 2 }
}

interface AnomalyFlag {
  userId: string;
  severity: 'low' | 'medium' | 'high';
  reasons: string[];
  evidence: {
    largestSingleDebitIls?: number;
    refundCount?: number;
    uniqueKioskCount?: number;
    uniqueIpCount?: number;
    offhoursRatioPct?: number;
  };
  suggestedAction: string;
  source: 'deterministic' | 'ai' | 'both';
}

// ── Aggregator: builds the PII-stripped per-user summary ────────────────────
async function loadAggregates(lookbackDays: number, userIds?: string[]): Promise<UserAggregate[]> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Pull raw rows. For a 7-day window on a real PetWash this is bounded
  // — there's no risk of pulling millions of entries.
  let rowsQuery = db
    .select({
      userId: walletLedgerEntries.userId,
      direction: walletLedgerEntries.direction,
      eventType: walletLedgerEntries.eventType,
      amountCents: walletLedgerEntries.amountCents,
      kioskId: walletLedgerEntries.kioskId,
      ipAddress: walletLedgerEntries.ipAddress,
      divisionCode: walletLedgerEntries.divisionCode,
      createdAt: walletLedgerEntries.createdAt,
    })
    .from(walletLedgerEntries)
    .where(gte(walletLedgerEntries.createdAt, since));

  const rows = await rowsQuery;

  // Group by user. If userIds was provided, filter to that set.
  const wanted = userIds ? new Set(userIds) : null;
  const byUser = new Map<string, UserAggregate>();

  for (const r of rows) {
    if (wanted && !wanted.has(r.userId)) continue;
    let agg = byUser.get(r.userId);
    if (!agg) {
      agg = {
        userId: r.userId,
        totalCredits: 0,
        totalDebits: 0,
        refundCount: 0,
        largestSingleDebit: 0,
        txnCount: 0,
        uniqueKioskCount: 0,
        uniqueIpCount: 0,
        offhoursRatio: 0,
        divisionMix: {},
      };
      byUser.set(r.userId, agg);
    }
    agg.txnCount += 1;
    if (r.direction === 'credit') agg.totalCredits += r.amountCents;
    else if (r.direction === 'debit') {
      agg.totalDebits += r.amountCents;
      if (r.amountCents > agg.largestSingleDebit) agg.largestSingleDebit = r.amountCents;
    }
    if (r.eventType === 'refund' || r.eventType === 'reversal') agg.refundCount += 1;
    if (r.divisionCode) {
      agg.divisionMix[r.divisionCode] = (agg.divisionMix[r.divisionCode] ?? 0) + 1;
    }
  }

  // Second pass: distinct kiosks + IPs + off-hours ratio (per user).
  // We only computed counts above; do the distinct-tracking now with Sets
  // we keep local (and discard before exit — IPs never leave this scope).
  const kioskSets = new Map<string, Set<string>>();
  const ipSets = new Map<string, Set<string>>();
  const offhoursCount = new Map<string, number>();

  for (const r of rows) {
    if (wanted && !wanted.has(r.userId)) continue;
    if (r.kioskId) {
      if (!kioskSets.has(r.userId)) kioskSets.set(r.userId, new Set());
      kioskSets.get(r.userId)!.add(r.kioskId);
    }
    if (r.ipAddress) {
      if (!ipSets.has(r.userId)) ipSets.set(r.userId, new Set());
      ipSets.get(r.userId)!.add(r.ipAddress);
    }
    if (r.createdAt) {
      // Off-hours in IL ≈ outside 07:00–23:00 UTC+2/+3. We approximate
      // with UTC hour 5..21 (covers winter + DST without a tz dep).
      const h = r.createdAt.getUTCHours();
      const isOffhours = h < 5 || h >= 21;
      if (isOffhours) offhoursCount.set(r.userId, (offhoursCount.get(r.userId) ?? 0) + 1);
    }
  }

  for (const [uid, agg] of byUser) {
    agg.uniqueKioskCount = kioskSets.get(uid)?.size ?? 0;
    agg.uniqueIpCount = ipSets.get(uid)?.size ?? 0;
    agg.offhoursRatio = agg.txnCount > 0 ? (offhoursCount.get(uid) ?? 0) / agg.txnCount : 0;
  }

  // Order by riskiest deterministic candidates first so we feed Gemini
  // the most-interesting subset within the prompt size budget.
  const sorted = [...byUser.values()].sort(
    (a, b) =>
      b.largestSingleDebit - a.largestSingleDebit ||
      b.refundCount - a.refundCount ||
      b.uniqueKioskCount - a.uniqueKioskCount,
  );

  return sorted.slice(0, MAX_USERS_TO_SCORE);
}

// ── Deterministic scorer — fallback when Gemini unavailable, also a backstop ──
function deterministicFlag(agg: UserAggregate): AnomalyFlag | null {
  const reasons: string[] = [];
  const evidence: AnomalyFlag['evidence'] = {};
  let severity: AnomalyFlag['severity'] = 'low';

  if (agg.largestSingleDebit >= THRESHOLD_LARGE_DEBIT_CENTS) {
    reasons.push('large_single_debit');
    evidence.largestSingleDebitIls = Math.round(agg.largestSingleDebit / 100);
    severity = 'medium';
  }
  if (agg.refundCount >= THRESHOLD_REFUND_COUNT_HIGH) {
    reasons.push('repeated_refunds');
    evidence.refundCount = agg.refundCount;
    severity = 'high';
  }
  if (agg.uniqueKioskCount >= THRESHOLD_KIOSK_COUNT_HIGH) {
    reasons.push('many_kiosks');
    evidence.uniqueKioskCount = agg.uniqueKioskCount;
    if (severity === 'low') severity = 'medium';
  }
  if (agg.offhoursRatio >= THRESHOLD_OFFHOURS_RATIO && agg.txnCount >= 5) {
    reasons.push('mostly_offhours');
    evidence.offhoursRatioPct = Math.round(agg.offhoursRatio * 100);
    if (severity === 'low') severity = 'medium';
  }
  if (agg.uniqueIpCount >= 5 && agg.txnCount >= 5) {
    reasons.push('many_ips');
    evidence.uniqueIpCount = agg.uniqueIpCount;
    if (severity === 'low') severity = 'medium';
  }

  if (reasons.length === 0) return null;

  return {
    userId: agg.userId,
    severity,
    reasons,
    evidence,
    suggestedAction:
      severity === 'high'
        ? 'Open the user, review every refund manually, decide whether to suspend.'
        : 'Open the user, glance at last 7 days, decide whether to leave a note.',
    source: 'deterministic',
  };
}

// ── Gemini prompt — public-safe, PII-stripped ───────────────────────────────
function buildAnomalyPrompt(aggregates: UserAggregate[]): string {
  // Strip per-user inputs to the smallest safe shape before sending.
  // userId is an opaque Firebase UID — not PII on its own.
  const safe = aggregates.map((a) => ({
    userId: a.userId,
    totalCreditsIls: Math.round(a.totalCredits / 100),
    totalDebitsIls: Math.round(a.totalDebits / 100),
    refundCount: a.refundCount,
    largestSingleDebitIls: Math.round(a.largestSingleDebit / 100),
    txnCount: a.txnCount,
    uniqueKioskCount: a.uniqueKioskCount,
    uniqueIpCount: a.uniqueIpCount,
    offhoursRatioPct: Math.round(a.offhoursRatio * 100),
    divisionMix: a.divisionMix,
  }));

  return [
    'You are PetWash wallet-activity anomaly monitor for the admin review queue.',
    'Score each user 0..100 on suspiciousness given the activity summary. Flag the WORST users only.',
    '',
    'Return JSON only. No prose. No code fences. EXACTLY this shape:',
    '{ "flags": [',
    '  { "userId": "...", "score": 0..100,',
    '    "reasons": ["short_phrase", ...],     // max 3, lowercase snake_case',
    '    "suggestedAction": "..."              // max 120 chars',
    '  }, ...',
    '] }',
    '',
    'Only include users with score >= 60. Limit to top 20 by score.',
    '',
    'YOU MUST NOT:',
    '- recommend refunds / credits / account suspensions; those are admin decisions',
    '- output any personally identifying information (names, emails, phones)',
    '- claim to know who the user is — you only see opaque ids and counts',
    '- diagnose fraud — only flag patterns worth a human glance',
    '',
    'INPUT (last few days of PII-stripped wallet activity per user):',
    JSON.stringify(safe),
    '',
    'Return JSON only.',
  ].join('\n');
}

const AiFlagSchema = z.object({
  userId: z.string().min(1).max(128),
  score: z.number().int().min(0).max(100).catch(50),
  reasons: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).max(3).catch([]),
  suggestedAction: z.string().min(1).max(160).catch(''),
});
const AiAnomalyResponseSchema = z.object({
  flags: z.array(AiFlagSchema).max(50).catch([]),
});

function tryJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  try { return JSON.parse(trimmed); } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1) return null;
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { return null; }
  }
}

async function requireFlag(_req: Request, res: Response, next: NextFunction) {
  try {
    const enabled = await getFeatureFlag('ff.ai.wallet_anomaly_monitor.enabled');
    if (!enabled) return res.status(503).json({ ok: false, error: 'feature_disabled' });
    next();
  } catch (err) {
    logger.warn('[ai-wallet-anomaly] flag read failed; treating as disabled', { err });
    return res.status(503).json({ ok: false, error: 'feature_disabled' });
  }
}

// ── Scan endpoint ───────────────────────────────────────────────────────────
router.post('/scan', requireFlag, async (req: Request, res: Response) => {
  const body = ScanBodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({ ok: false, error: 'invalid_body', details: body.error.flatten() });
  }
  const { lookbackDays, userIds } = body.data;

  let aggregates: UserAggregate[];
  try {
    aggregates = await loadAggregates(lookbackDays, userIds);
  } catch (err) {
    logger.error('[ai-wallet-anomaly] aggregate load failed', { err });
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }

  if (aggregates.length === 0) {
    return res.json({ ok: true, flags: [], scannedUsers: 0, lookbackDays, fallback: false });
  }

  // 1. Always compute deterministic flags first — they're the floor.
  const detFlags = new Map<string, AnomalyFlag>();
  for (const agg of aggregates) {
    const f = deterministicFlag(agg);
    if (f) detFlags.set(agg.userId, f);
  }

  // 2. Ask Gemini to score on top. Graceful fallback if unavailable.
  const prompt = buildAnomalyPrompt(aggregates);
  const ai = await safeGenerate('gemini-1.5-flash', prompt, 'ai-wallet-anomaly');

  if (!ai.ok || !ai.text) {
    logger.info('[ai-wallet-anomaly] Gemini unavailable — returning deterministic flags only', {
      reason: ai.error ?? 'no_text',
      detCount: detFlags.size,
    });
    return res.json({
      ok: true,
      flags: Array.from(detFlags.values()),
      scannedUsers: aggregates.length,
      lookbackDays,
      fallback: true,
      reason: ai.error ?? 'no_text',
    });
  }

  const rawJson = tryJson(ai.text);
  const parsed = AiAnomalyResponseSchema.safeParse(rawJson);
  if (!parsed.success) {
    logger.warn('[ai-wallet-anomaly] AI response invalid — returning deterministic flags only');
    return res.json({
      ok: true,
      flags: Array.from(detFlags.values()),
      scannedUsers: aggregates.length,
      lookbackDays,
      fallback: true,
      reason: 'invalid_model_output',
    });
  }

  // 3. Merge AI flags with deterministic flags. Defense:
  //    - userId from model MUST match one we actually scored (no hallucination)
  //    - reasons + suggestedAction sanitised by Zod
  //    - severity derived from AI score band
  const validIds = new Set(aggregates.map((a) => a.userId));
  for (const f of parsed.data.flags) {
    if (!validIds.has(f.userId)) continue;
    const sev: AnomalyFlag['severity'] =
      f.score >= 85 ? 'high' : f.score >= 70 ? 'medium' : 'low';
    const existing = detFlags.get(f.userId);
    if (existing) {
      // Union: take the higher severity, merge reasons, prefer AI's suggested action.
      const ranks = { low: 0, medium: 1, high: 2 } as const;
      existing.severity = ranks[sev] > ranks[existing.severity] ? sev : existing.severity;
      existing.reasons = Array.from(new Set([...existing.reasons, ...f.reasons])).slice(0, 5);
      existing.suggestedAction = f.suggestedAction || existing.suggestedAction;
      existing.source = 'both';
    } else {
      detFlags.set(f.userId, {
        userId: f.userId,
        severity: sev,
        reasons: f.reasons,
        evidence: {},
        suggestedAction: f.suggestedAction || 'Open the user and review the last 7 days.',
        source: 'ai',
      });
    }
  }

  return res.json({
    ok: true,
    flags: Array.from(detFlags.values()),
    scannedUsers: aggregates.length,
    lookbackDays,
    fallback: false,
  });
});

export default router;
