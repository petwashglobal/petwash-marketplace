/**
 * CEO MASTER DIRECTIVE 2026-08-28 §9 §10 (Journey Brain Phase 3) —
 * favourite-providers service.
 *
 * "Book Maya again." Reads the customer's starred providers so the
 * recommender can rank them above random providers when they're
 * available for the requested slot (never in place of eligibility —
 * marketplace ranking retains authority).
 *
 * OWNER-scoped by Firebase UID. Domain names the service (walk /
 * sitter / academy) so a single provider offering multiple services
 * shows up in the correct slot only.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { favouriteProviders, type InsertFavouriteProvider, type FavouriteProvider } from '@shared/schema';

export async function addFavouriteProvider(input: {
  userUid: string;
  providerId: string;
  domain: string;
}): Promise<FavouriteProvider> {
  if (!input.userUid)   throw new Error('favouriteProviders: userUid required');
  if (!input.providerId) throw new Error('favouriteProviders: providerId required');
  if (!input.domain)    throw new Error('favouriteProviders: domain required');
  const values: InsertFavouriteProvider = {
    userUid: input.userUid,
    providerId: input.providerId,
    domain: input.domain,
    addedAt: new Date(),
  };
  // Migration 0135 UNIQUE (user_uid, provider_id, domain) — starring
  // twice is a no-op, not a stack of rows. onConflictDoNothing keeps
  // the original addedAt so we can measure loyalty by first-star date.
  const [row] = await db
    .insert(favouriteProviders)
    .values(values)
    .onConflictDoNothing({
      target: [
        favouriteProviders.userUid,
        favouriteProviders.providerId,
        favouriteProviders.domain,
      ],
    })
    .returning();
  if (row) return row;
  // Conflict path — return the existing row so callers can echo it back.
  const [existing] = await db
    .select()
    .from(favouriteProviders)
    .where(and(
      eq(favouriteProviders.userUid, input.userUid),
      eq(favouriteProviders.providerId, input.providerId),
      eq(favouriteProviders.domain, input.domain),
    ))
    .limit(1);
  if (!existing) throw new Error('favouriteProviders: insert-conflict but row not found');
  return existing;
}

export async function removeFavouriteProvider(input: {
  userUid: string;
  providerId: string;
  domain: string;
}): Promise<void> {
  if (!input.userUid || !input.providerId || !input.domain) return;
  await db
    .delete(favouriteProviders)
    .where(and(
      eq(favouriteProviders.userUid, input.userUid),
      eq(favouriteProviders.providerId, input.providerId),
      eq(favouriteProviders.domain, input.domain),
    ));
}

export async function listFavouriteProviders(userUid: string, domain?: string): Promise<FavouriteProvider[]> {
  if (!userUid) return [];
  const where = domain
    ? and(eq(favouriteProviders.userUid, userUid), eq(favouriteProviders.domain, domain))
    : eq(favouriteProviders.userUid, userUid);
  return db
    .select()
    .from(favouriteProviders)
    .where(where)
    .orderBy(desc(favouriteProviders.addedAt))
    .limit(100);
}

/** Convenience predicate for the recommender. */
export async function isFavouriteProvider(userUid: string, providerId: string, domain: string): Promise<boolean> {
  if (!userUid || !providerId || !domain) return false;
  const rows = await db
    .select({ id: favouriteProviders.id })
    .from(favouriteProviders)
    .where(and(
      eq(favouriteProviders.userUid, userUid),
      eq(favouriteProviders.providerId, providerId),
      eq(favouriteProviders.domain, domain),
    ))
    .limit(1);
  return rows.length > 0;
}
