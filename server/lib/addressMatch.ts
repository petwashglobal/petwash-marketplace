/**
 * addressMatch — link-two-users fraud signal (CEO 2026-07-03).
 *
 * When the BOOKER and the PROVIDER on a booking are DIFFERENT accounts but share
 * the SAME saved home address, that's a self-dealing / duplicate-account signal
 * (gaming referrals/reviews, or arranging to cut PetWash out). Pure read-only
 * comparison of the structured address fields — no Maps API, no cost. Advisory:
 * it raises a flag for a human; it never blocks a booking or bans anyone.
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/** Canonicalise an address for comparison: lowercase, collapse whitespace,
 *  strip punctuation. Uses the structured parts when present, else the free
 *  `address` text. Returns '' when there isn't enough to compare. */
export function normalizeAddress(u: {
  address?: string | null; street?: string | null; streetNumber?: string | null;
  city?: string | null; postalCode?: string | null;
}): string {
  const structured = [u.streetNumber, u.street, u.city, u.postalCode]
    .filter((p) => p && String(p).trim()).join(' ');
  const raw = structured || u.address || '';
  const norm = String(raw)
    .toLowerCase()
    .replace(/[.,#\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Require a house-number digit + at least a couple of words, else it's too
  // thin to call a match (avoids "tel aviv" == "tel aviv" false positives).
  const hasNumber = /\d/.test(norm);
  const wordCount = norm.split(' ').filter(Boolean).length;
  return hasNumber && wordCount >= 2 ? norm : '';
}

export interface AddressMatchResult {
  match: boolean;
  reason: 'same_address' | 'insufficient_data' | 'different' | 'same_user';
  normalized?: string;
}

/** Compare the two users' saved addresses. Best-effort; never throws. */
export async function checkBookingAddressMatch(ownerId: string, providerId: string): Promise<AddressMatchResult> {
  try {
    if (!ownerId || !providerId) return { match: false, reason: 'insufficient_data' };
    if (ownerId === providerId) return { match: false, reason: 'same_user' };

    const rows = await db.select({
      id: users.id, address: users.address, street: users.street,
      streetNumber: users.streetNumber, city: users.city, postalCode: users.postalCode,
    }).from(users).where(eq(users.id, ownerId));
    const provRows = await db.select({
      id: users.id, address: users.address, street: users.street,
      streetNumber: users.streetNumber, city: users.city, postalCode: users.postalCode,
    }).from(users).where(eq(users.id, providerId));

    const owner = rows[0];
    const provider = provRows[0];
    if (!owner || !provider) return { match: false, reason: 'insufficient_data' };

    const a = normalizeAddress(owner);
    const b = normalizeAddress(provider);
    if (!a || !b) return { match: false, reason: 'insufficient_data' };

    return a === b
      ? { match: true, reason: 'same_address', normalized: a }
      : { match: false, reason: 'different' };
  } catch {
    return { match: false, reason: 'insufficient_data' };
  }
}
