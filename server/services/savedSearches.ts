/**
 * CEO MASTER DIRECTIVE 2026-08-28 §7 (Journey Brain Phase 3) —
 * saved-search service.
 *
 * "Still looking for a walk for Bruno on Tuesday?" Reads back the
 * customer's most recent search per (userUid, domain) so the wizard
 * can offer [Continue search] instead of forcing them to rebuild
 * seven filters.
 *
 * OWNER-scoped by Firebase UID. Filters are a free-form JSONB payload
 * the wizard owns end-to-end; the service does not interpret them.
 *
 * NOT a source of truth for pricing / eligibility — the marketplace
 * tables retain that authority (CEO §22 recommendation-safety).
 */
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import { savedSearches, type InsertSavedSearch, type SavedSearch } from '@shared/schema';
import { randomUUID } from 'crypto';

export interface SaveSearchInput {
  userUid: string;
  domain: string;
  filters: Record<string, unknown>;
  label?: string;
  ttlMs?: number;
}

export const DEFAULT_SAVED_SEARCH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function saveSearch(input: SaveSearchInput): Promise<SavedSearch> {
  if (!input.userUid) throw new Error('savedSearches: userUid required');
  if (!input.domain)  throw new Error('savedSearches: domain required');
  const now = new Date();
  const ttl = Number.isFinite(input.ttlMs) && (input.ttlMs as number) > 0
    ? (input.ttlMs as number)
    : DEFAULT_SAVED_SEARCH_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  const values: InsertSavedSearch = {
    searchId: randomUUID(),
    userUid: input.userUid,
    domain: input.domain,
    filters: (input.filters ?? {}) as any,
    label: input.label ?? null,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
  // See migration 0135 UNIQUE (user_uid, domain).
  const [row] = await db
    .insert(savedSearches)
    .values(values)
    .onConflictDoUpdate({
      target: [savedSearches.userUid, savedSearches.domain],
      set: {
        filters: values.filters as any,
        label: values.label ?? null,
        lastUsedAt: now,
        updatedAt: now,
        expiresAt,
      },
    })
    .returning();
  return row;
}

/** The wizard reads this on a fresh session to offer "continue search". */
export async function getActiveSavedSearch(userUid: string, domain: string): Promise<SavedSearch | null> {
  if (!userUid || !domain) return null;
  const now = new Date();
  const rows = await db
    .select()
    .from(savedSearches)
    .where(and(
      eq(savedSearches.userUid, userUid),
      eq(savedSearches.domain, domain),
      // A row without expires_at counts as unexpired (long-lived
      // preferences); one with expires_at must be in the future.
      or(
        isNull(savedSearches.expiresAt),
        gt(savedSearches.expiresAt, now),
      ),
    ))
    .limit(1);
  return rows[0] ?? null;
}

/** Attention-feed probe uses this to enumerate all live saved searches for the user. */
export async function listActiveSavedSearches(userUid: string): Promise<SavedSearch[]> {
  if (!userUid) return [];
  const now = new Date();
  return db
    .select()
    .from(savedSearches)
    .where(and(
      eq(savedSearches.userUid, userUid),
      or(
        isNull(savedSearches.expiresAt),
        gt(savedSearches.expiresAt, now),
      ),
    ))
    .orderBy(desc(savedSearches.lastUsedAt))
    .limit(10);
}

export async function clearSavedSearch(userUid: string, domain: string): Promise<void> {
  if (!userUid || !domain) return;
  await db
    .delete(savedSearches)
    .where(and(
      eq(savedSearches.userUid, userUid),
      eq(savedSearches.domain, domain),
    ));
}
