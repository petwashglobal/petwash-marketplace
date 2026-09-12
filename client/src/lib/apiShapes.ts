/**
 * apiShapes — ONE place that knows what a shared API response looks like.
 *
 * WHY (2026-09-12): eleven pages share the react-query key '/api/pets', and
 * they cached three different shapes — the raw `{ pets: [...] }` object, a
 * bare array, or `{ pets }` typed as an array. Whichever page fetched first
 * decided what the next page found in the cache; /pets and /pet-care-planner
 * crashed with "pets.map is not a function", the marketplace booking flow and
 * the groomer booking silently showed no pets. The class, not the instance:
 * a shared key with no single owner of its shape.
 *
 * Use these as react-query `select:` (they normalise whatever is in the cache)
 * or at the point of use. Never assume the cached shape.
 */

/** `/api/pets` → always an array of pets. */
export function petsList<T = any>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  const pets = (d as any)?.pets;
  return Array.isArray(pets) ? (pets as T[]) : [];
}

/** `/api/social/feed` → `{ posts, page, hasMore }` on the server; always an array of posts. */
export function feedPosts<T = any>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  const posts = (d as any)?.posts ?? (d as any)?.data;
  return Array.isArray(posts) ? (posts as T[]) : [];
}
