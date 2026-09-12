/**
 * Resolve the name to greet a member by.
 *
 * WHY THIS EXISTS AS A PURE MODULE: the CEO's own phone showed
 *
 *     ערב טוב,
 *     User 👋
 *
 * The literal string 'User' had been STORED as his first name —
 * `customers.firstName` is NOT NULL, and signup satisfied that by inventing a
 * name whenever it collected none. The writers are fixed, but rows already
 * carry it and no code change reaches them, so the display must refuse
 * placeholders too.
 *
 * Pure and exported so the rule can be tested on its output rather than by
 * grepping a JSX file for the shape of an expression — a source-shaped pin here
 * passed while the guard was disconnected.
 */

/** Values that are stored in a name column but are not anyone's name. */
const PLACEHOLDERS = new Set([
  'user', 'users', 'member', 'customer', 'guest',
  'n/a', 'na', 'none', 'null', 'undefined', 'test', 'unknown',
]);

export function isPlaceholderName(name?: string | null): boolean {
  if (!name) return true;
  const t = name.trim();
  if (!t) return true;
  return PLACEHOLDERS.has(t.toLowerCase());
}

/**
 * The email local-part is deliberately NOT a candidate. "ערב טוב, support" is
 * an address with the @ cut off, not a name — and on this product the common
 * case is a role address, not a person's first name.
 */
export function resolveGreetingName(
  candidates: Array<string | null | undefined>,
  isHe: boolean,
): string {
  for (const c of candidates) {
    if (!isPlaceholderName(c)) return c!.trim();
  }
  return isHe ? 'חבר' : 'Member';
}
