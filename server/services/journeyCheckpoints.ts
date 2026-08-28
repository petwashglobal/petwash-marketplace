/**
 * CEO MASTER DIRECTIVE 2026-08-28 §11 §12 §13 §28 §34 §70 —
 * Journey Brain Phase 2 checkpoint store.
 *
 * The wizard writes a checkpoint at each SAFE step. On resume, the
 * client fetches the newest non-expired checkpoint per (userUid,
 * domain) and re-hydrates state. The AI concierge reads these to
 * render "still looking at Maya?" copy — it never writes them.
 *
 * CRITICAL RULES:
 *   * userUid is the OWNER — Firebase UID, never trusted from the
 *     body. The caller of save() / getActive() MUST have verified
 *     the caller before invoking.
 *   * NEVER write a checkpoint when the state carries an external
 *     side effect that might have completed (payment started, etc.).
 *     The `lastSafeStep` is the resume-safe stage; the `state` may
 *     be the exploratory stage the wizard is currently on.
 *   * `expiresAt` is enforced by the reader. Default TTL is 72
 *     hours — the customer has a long weekend to come back, then
 *     the wizard treats the flow as forgotten.
 */
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { journeyCheckpoints, type InsertJourneyCheckpoint, type JourneyCheckpoint } from '@shared/schema';
import { randomUUID } from 'crypto';

export const DEFAULT_CHECKPOINT_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Domain names the flow. Keep as a wide union so a new wizard can
 * add a new domain without touching this file — but at least one
 * literal so misuse types instead of stringly.
 */
export type JourneyDomain =
  | 'walk_booking'
  | 'sitter_booking'
  | 'academy_booking'
  | 'marketplace_booking'
  | 'shop_checkout'
  | 'egift_purchase'
  | 'provider_apply'
  | string;

export interface SaveCheckpointInput {
  userUid: string;
  domain: JourneyDomain;
  entityRef?: string | null;
  state: string;
  lastSafeStep: string;
  /** Wizard-owned payload. Free-form JSON that the resume path re-hydrates. */
  snapshot?: Record<string, unknown>;
  ttlMs?: number;
}

/**
 * UPSERT the (userUid, domain) checkpoint. The UNIQUE index on
 * (user_uid, domain) means a fresh flow supersedes the older one —
 * there is only ever ONE active checkpoint per user per domain.
 * Returns the resulting row so the caller can hand journeyId back
 * to the client as a resume token.
 */
export async function saveCheckpoint(input: SaveCheckpointInput): Promise<JourneyCheckpoint> {
  if (!input.userUid) throw new Error('journeyCheckpoints: userUid required');
  if (!input.domain)  throw new Error('journeyCheckpoints: domain required');
  const now = new Date();
  const ttl = Number.isFinite(input.ttlMs) && (input.ttlMs as number) > 0
    ? (input.ttlMs as number)
    : DEFAULT_CHECKPOINT_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  const values: InsertJourneyCheckpoint = {
    journeyId: randomUUID(),
    userUid: input.userUid,
    domain: String(input.domain),
    entityRef: input.entityRef ?? null,
    state: input.state,
    lastSafeStep: input.lastSafeStep,
    snapshot: (input.snapshot ?? {}) as any,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
  // UPSERT on (user_uid, domain) — see UNIQUE INDEX in
  // migrations/0134_journey_checkpoints_2026_08_28.sql. The journeyId
  // stays stable across updates by re-reading the existing row's id
  // through onConflictDoUpdate — but drizzle-pg doesn't return the
  // previously-assigned journeyId that way, so we return whatever
  // Postgres kept after conflict (the older journeyId is preserved on
  // ON CONFLICT DO UPDATE).
  const [row] = await db
    .insert(journeyCheckpoints)
    .values(values)
    .onConflictDoUpdate({
      target: [journeyCheckpoints.userUid, journeyCheckpoints.domain],
      set: {
        entityRef: values.entityRef ?? null,
        state: values.state,
        lastSafeStep: values.lastSafeStep,
        snapshot: values.snapshot as any,
        updatedAt: now,
        expiresAt,
      },
    })
    .returning();
  return row;
}

/**
 * Fetch the active (unexpired) checkpoint for (userUid, domain).
 * Returns null if there is no non-expired row — the resume path
 * treats null as "no journey saved; start fresh".
 */
export async function getActiveCheckpoint(
  userUid: string,
  domain: JourneyDomain,
): Promise<JourneyCheckpoint | null> {
  if (!userUid || !domain) return null;
  const rows = await db
    .select()
    .from(journeyCheckpoints)
    .where(and(
      eq(journeyCheckpoints.userUid, userUid),
      eq(journeyCheckpoints.domain, String(domain)),
      gt(journeyCheckpoints.expiresAt, new Date()),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * List every unexpired checkpoint for a user across all domains. The
 * attention-feed abandoned-flow probe uses this to render "we saved
 * your booking with Maya" cards.
 */
export async function listActiveCheckpoints(userUid: string): Promise<JourneyCheckpoint[]> {
  if (!userUid) return [];
  return db
    .select()
    .from(journeyCheckpoints)
    .where(and(
      eq(journeyCheckpoints.userUid, userUid),
      gt(journeyCheckpoints.expiresAt, new Date()),
    ))
    .orderBy(desc(journeyCheckpoints.updatedAt))
    .limit(20);
}

/**
 * Explicit dismissal — the customer finished the flow or chose to
 * forget it. Wizard routes should call this on final commit so the
 * resume prompt disappears cleanly.
 */
export async function clearCheckpoint(userUid: string, domain: JourneyDomain): Promise<void> {
  if (!userUid || !domain) return;
  await db
    .delete(journeyCheckpoints)
    .where(and(
      eq(journeyCheckpoints.userUid, userUid),
      eq(journeyCheckpoints.domain, String(domain)),
    ));
}
