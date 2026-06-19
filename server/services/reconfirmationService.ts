/**
 * reconfirmationService.ts — 6-MONTH PROVIDER RECONFIRMATION engine (spec §17).
 *
 * Israeli marketplace duty: an approved provider must periodically RE-CONFIRM
 * their declarations/consent so a stale approval doesn't run forever. The
 * `reconfirmation_records` table (shared/schema-provider-services.ts) already
 * exists; before this file NOTHING populated it, no reminder was computed, no
 * status surfaced. This service fills that gap.
 *
 * SAFETY / SCOPE (deliberate):
 *  - DUE DATES are computed LAZILY from the EXISTING approval record
 *    (provider_applications.reviewedAt ?? createdAt) + 6 months. We do NOT edit
 *    the approval flow (provider-applications.ts) and we do NOT add columns.
 *  - The ONLY write is an ADDITIVE INSERT into reconfirmation_records when a
 *    provider actually re-confirms (recordReconfirmation). Everything else is a
 *    pure SELECT.
 *  - `isReconfirmationOverdue()` is an ADVISORY helper other systems MAY call.
 *    It is NOT hard-wired into the live payout/booking path here (another agent
 *    owns those gates) and it FAILS SAFE: a lookup error returns `false`
 *    (advisory only — it must never block money on its own infra hiccup).
 *
 * Provider identity here = Firebase UID (provider_applications.userId), which is
 * also the key the consent engine uses — so reconfirmation_records.providerId
 * holds the UID and a recorded consentRecordId lines up with the same subject.
 */
import { db } from '../db';
import { and, eq, desc } from 'drizzle-orm';
import { providerApplications, providers } from '@shared/schema';
import { reconfirmationRecords } from '@shared/schema-provider-services';
import { logger } from '../lib/logger';

/** How long an approval / reconfirmation stays valid before the next one is due. */
export const RECONFIRMATION_INTERVAL_MONTHS = 6;
export const RECONFIRMATION_TYPE = 'six_month';

/** Reminder bucket: how close the due date is (or that it has passed). */
export type ReminderBucket = 60 | 30 | 14 | 7 | 1 | 'overdue' | null;

export interface ReconfirmationDue {
  /** ISO timestamp the next reconfirmation is due. */
  dueAt: string;
  /** Whole days until due (negative once overdue). */
  daysUntil: number;
  /** True once the due date has passed. */
  overdue: boolean;
  /**
   * Which reminder window the provider is currently inside, or null if no
   * reminder is warranted yet (> 60 days out). 'overdue' once past due.
   */
  reminderBucket: ReminderBucket;
  /** The approval/last-reconfirmation anchor the due date was derived from. */
  anchorAt: string;
  /** Where the anchor came from — for honest UI ('approval' vs 'reconfirmation'). */
  anchorSource: 'approval' | 'reconfirmation';
}

/** Minimal shape we need to compute a due date — keeps this unit-testable. */
export interface ProviderLike {
  /** ISO approval timestamp (provider_applications.reviewedAt ?? createdAt). */
  approvedAt: string | Date | null | undefined;
  /** ISO of the latest completed reconfirmation, if any. */
  lastReconfirmedAt?: string | Date | null;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + months);
  return r;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function bucketFor(daysUntil: number): ReminderBucket {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 1) return 1;
  if (daysUntil <= 7) return 7;
  if (daysUntil <= 14) return 14;
  if (daysUntil <= 30) return 30;
  if (daysUntil <= 60) return 60;
  return null;
}

/**
 * PURE: compute when a provider's next reconfirmation is due.
 *   due = (lastReconfirmedAt ?? approvedAt) + 6 months
 * Returns null only if there is no anchor date at all (provider has neither an
 * approval timestamp nor a prior reconfirmation — nothing to base a clock on).
 */
export function computeReconfirmationDue(
  provider: ProviderLike,
  now: Date = new Date(),
): ReconfirmationDue | null {
  const last = toDate(provider.lastReconfirmedAt);
  const approved = toDate(provider.approvedAt);
  const anchor = last ?? approved;
  if (!anchor) return null;

  const dueAt = addMonths(anchor, RECONFIRMATION_INTERVAL_MONTHS);
  const daysUntil = Math.floor((dueAt.getTime() - now.getTime()) / MS_PER_DAY);
  const overdue = dueAt.getTime() <= now.getTime();

  return {
    dueAt: dueAt.toISOString(),
    daysUntil,
    overdue,
    reminderBucket: bucketFor(daysUntil),
    anchorAt: anchor.toISOString(),
    anchorSource: last ? 'reconfirmation' : 'approval',
  };
}

export interface ProviderReconfirmationStatus extends ReconfirmationDue {
  providerId: string;
  businessName: string | null;
  providerType: string | null;
  /** A coarse status label for the admin list / advisory consumers. */
  status: 'ok' | 'due_soon' | 'overdue';
}

/**
 * READ-ONLY: every APPROVED provider with their computed reconfirmation status.
 * Pure SELECT over provider_applications (approval anchor) + the latest completed
 * reconfirmation_records row per provider. No writes.
 */
export async function getProvidersNeedingReconfirmation(opts?: {
  /** When true (default), return everyone with a status; else only due/overdue. */
  includeOk?: boolean;
}): Promise<ProviderReconfirmationStatus[]> {
  const includeOk = opts?.includeOk ?? true;

  // Approved providers + their approval anchor. provider_applications.userId is
  // the canonical Firebase UID used everywhere else (consent engine, gates).
  const apps = await db
    .select({
      userId: providerApplications.userId,
      providerType: providerApplications.providerType,
      reviewedAt: providerApplications.reviewedAt,
      createdAt: providerApplications.createdAt,
    })
    .from(providerApplications)
    .where(eq(providerApplications.status, 'approved'));

  if (apps.length === 0) return [];

  // Optional display name per provider (best-effort join by userId).
  const provRows = await db
    .select({ userId: providers.userId, businessName: providers.businessName })
    .from(providers);
  const nameByUser = new Map<string, string | null>();
  for (const p of provRows) if (p.userId) nameByUser.set(p.userId, p.businessName ?? null);

  // Latest completed reconfirmation per provider.
  const recRows = await db
    .select({
      providerId: reconfirmationRecords.providerId,
      completedAt: reconfirmationRecords.completedAt,
    })
    .from(reconfirmationRecords)
    .where(eq(reconfirmationRecords.status, 'completed'))
    .orderBy(desc(reconfirmationRecords.completedAt));
  const lastReconfirmedByProvider = new Map<string, Date>();
  for (const r of recRows) {
    if (!r.providerId || !r.completedAt) continue;
    if (!lastReconfirmedByProvider.has(r.providerId)) {
      lastReconfirmedByProvider.set(r.providerId, r.completedAt as Date);
    }
  }

  // Dedupe by userId (a provider can have >1 application row across platforms);
  // keep the row with the EARLIER due date so the clock is conservative.
  const byProvider = new Map<string, ProviderReconfirmationStatus>();

  for (const a of apps) {
    if (!a.userId) continue;
    const due = computeReconfirmationDue({
      approvedAt: (a.reviewedAt ?? a.createdAt) as Date | null,
      lastReconfirmedAt: lastReconfirmedByProvider.get(a.userId) ?? null,
    });
    if (!due) continue;

    const status: ProviderReconfirmationStatus['status'] = due.overdue
      ? 'overdue'
      : due.reminderBucket !== null
        ? 'due_soon'
        : 'ok';

    const row: ProviderReconfirmationStatus = {
      ...due,
      providerId: a.userId,
      businessName: nameByUser.get(a.userId) ?? null,
      providerType: a.providerType ?? null,
      status,
    };

    const prev = byProvider.get(a.userId);
    if (!prev || new Date(row.dueAt).getTime() < new Date(prev.dueAt).getTime()) {
      byProvider.set(a.userId, row);
    }
  }

  const out: ProviderReconfirmationStatus[] = [];
  for (const row of byProvider.values()) {
    if (includeOk || row.status !== 'ok') out.push(row);
  }

  // Sort worst-first: overdue (most overdue first), then soonest due.
  out.sort((x, y) => x.daysUntil - y.daysUntil);
  return out;
}

/**
 * The ONLY write in this engine. ADDITIVE INSERT recording that a provider has
 * re-confirmed. The table's unique (providerId, type, dueAt) constraint means
 * re-submitting for the same due window is rejected at the DB layer; we surface
 * that as `alreadyRecorded` rather than throwing.
 */
export async function recordReconfirmation(
  providerId: string,
  consentRecordId?: string | null,
): Promise<{ ok: boolean; recordId?: number; dueAt?: string; alreadyRecorded?: boolean }> {
  // Re-derive the due window this confirmation satisfies so the row is anchored
  // to the same clock the admin list shows.
  const [app] = await db
    .select({
      reviewedAt: providerApplications.reviewedAt,
      createdAt: providerApplications.createdAt,
    })
    .from(providerApplications)
    .where(and(eq(providerApplications.userId, providerId), eq(providerApplications.status, 'approved')))
    .orderBy(desc(providerApplications.reviewedAt))
    .limit(1);

  // Find current latest reconfirmation to advance the clock.
  const [lastRec] = await db
    .select({ completedAt: reconfirmationRecords.completedAt })
    .from(reconfirmationRecords)
    .where(and(eq(reconfirmationRecords.providerId, providerId), eq(reconfirmationRecords.status, 'completed')))
    .orderBy(desc(reconfirmationRecords.completedAt))
    .limit(1);

  const due = computeReconfirmationDue({
    approvedAt: (app?.reviewedAt ?? app?.createdAt) as Date | null,
    lastReconfirmedAt: (lastRec?.completedAt as Date | null) ?? null,
  });
  // If we cannot anchor (no approval), still record against "now + interval" so
  // the act of confirming is captured rather than lost.
  const dueAt = due ? new Date(due.dueAt) : addMonths(new Date(), RECONFIRMATION_INTERVAL_MONTHS);

  try {
    const [record] = await db
      .insert(reconfirmationRecords)
      .values({
        providerId,
        reconfirmationType: RECONFIRMATION_TYPE,
        dueAt,
        completedAt: new Date(),
        status: 'completed',
        consentRecordId: consentRecordId ?? null,
      })
      .returning();

    logger.info('[Reconfirmation] recorded', { providerId, recordId: record.id, dueAt: dueAt.toISOString() });
    return { ok: true, recordId: record.id, dueAt: dueAt.toISOString() };
  } catch (err: any) {
    // 23505 = unique violation (already confirmed for this due window).
    if (err?.code === '23505') {
      logger.info('[Reconfirmation] already recorded for window', { providerId, dueAt: dueAt.toISOString() });
      return { ok: true, alreadyRecorded: true, dueAt: dueAt.toISOString() };
    }
    logger.error('[Reconfirmation] insert failed', { providerId, error: err?.message });
    throw err;
  }
}

/**
 * ADVISORY helper other systems MAY call. Returns true if the provider's 6-month
 * reconfirmation is past due. FAILS SAFE (returns false) on any lookup error —
 * it is advisory and must never block money on its own infra hiccup. It is NOT
 * wired into payout/booking here by design.
 */
export async function isReconfirmationOverdue(providerId: string): Promise<boolean> {
  try {
    const [app] = await db
      .select({ reviewedAt: providerApplications.reviewedAt, createdAt: providerApplications.createdAt })
      .from(providerApplications)
      .where(and(eq(providerApplications.userId, providerId), eq(providerApplications.status, 'approved')))
      .orderBy(desc(providerApplications.reviewedAt))
      .limit(1);
    if (!app) return false; // not an approved provider → nothing to enforce

    const [lastRec] = await db
      .select({ completedAt: reconfirmationRecords.completedAt })
      .from(reconfirmationRecords)
      .where(and(eq(reconfirmationRecords.providerId, providerId), eq(reconfirmationRecords.status, 'completed')))
      .orderBy(desc(reconfirmationRecords.completedAt))
      .limit(1);

    const due = computeReconfirmationDue({
      approvedAt: (app.reviewedAt ?? app.createdAt) as Date | null,
      lastReconfirmedAt: (lastRec?.completedAt as Date | null) ?? null,
    });
    return due?.overdue ?? false;
  } catch (err: any) {
    logger.warn('[Reconfirmation] isReconfirmationOverdue check failed — failing safe (false)', {
      providerId,
      error: err?.message,
    });
    return false;
  }
}
