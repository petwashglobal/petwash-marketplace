/**
 * addressMatch — link-two-users fraud signal (CEO 2026-07-03; guardrails 2026-07-03).
 *
 * When the BOOKER and the PROVIDER on a booking are DIFFERENT accounts but share
 * the SAME saved home address, that's a self-dealing / duplicate-account signal
 * (gaming referrals/reviews, or arranging to cut PetWash out). Pure read-only
 * comparison of the structured address fields — no Maps API, no cost.
 *
 * GUARDRAILS (item F): this must NEVER auto-terminate and must minimise false
 * accusations of legitimate cases (same family/household, same building, an old
 * saved address, spelling differences). So it returns a CONFIDENCE level + an
 * evidence bundle; the caller opens a *review-required* case only for
 * medium/high confidence and logs (no case) for low. Advisory only — it never
 * blocks a booking or bans anyone; a human decides.
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

type AddrParts = {
  address?: string | null; street?: string | null; streetNumber?: string | null;
  city?: string | null; postalCode?: string | null;
};

/** Canonicalise an address for comparison: lowercase, collapse whitespace,
 *  strip punctuation. Uses the structured parts when present, else the free
 *  `address` text. Returns '' when there isn't enough to compare. */
export function normalizeAddress(u: AddrParts): string {
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

/** The original (pre-normalisation) address string the human should see — keeps
 *  spelling/formatting so a reviewer can judge a near-miss. */
function rawAddress(u: AddrParts): string {
  const structured = [u.streetNumber, u.street, u.city, u.postalCode]
    .filter((p) => p && String(p).trim()).join(', ');
  return (structured || u.address || '').trim();
}

/** Which structured fields are present AND equal between the two users. */
function matchedStructuredFields(a: AddrParts, b: AddrParts): string[] {
  const eqField = (x?: string | null, y?: string | null) =>
    !!x && !!y && String(x).trim().toLowerCase() === String(y).trim().toLowerCase();
  const fields: string[] = [];
  if (eqField(a.streetNumber, b.streetNumber)) fields.push('streetNumber');
  if (eqField(a.street, b.street)) fields.push('street');
  if (eqField(a.city, b.city)) fields.push('city');
  if (eqField(a.postalCode, b.postalCode)) fields.push('postalCode');
  return fields;
}

export type AddressMatchConfidence = 'low' | 'medium' | 'high';

export interface AddressMatchEvidence {
  reasonCode: 'ADDR_EXACT_STRUCTURED_POSTAL' | 'ADDR_EXACT_STRUCTURED' | 'ADDR_EXACT_FREETEXT';
  confidence: AddressMatchConfidence;
  normalized: string;
  ownerRaw: string;
  providerRaw: string;
  matchedFields: string[];
  ownerAccountUpdatedAt: string | null;
  providerAccountUpdatedAt: string | null;
  checkedAt: string;
}

export interface AddressMatchResult {
  match: boolean;
  reason: 'same_address' | 'insufficient_data' | 'different' | 'same_user';
  confidence?: AddressMatchConfidence;
  evidence?: AddressMatchEvidence;
}

/** Compare the two users' saved addresses. Best-effort; never throws. */
export async function checkBookingAddressMatch(ownerId: string, providerId: string): Promise<AddressMatchResult> {
  try {
    if (!ownerId || !providerId) return { match: false, reason: 'insufficient_data' };
    if (ownerId === providerId) return { match: false, reason: 'same_user' };

    const cols = {
      id: users.id, address: users.address, street: users.street,
      streetNumber: users.streetNumber, city: users.city, postalCode: users.postalCode,
      updatedAt: users.updatedAt,
    };
    const rows = await db.select(cols).from(users).where(eq(users.id, ownerId));
    const provRows = await db.select(cols).from(users).where(eq(users.id, providerId));

    const owner = rows[0];
    const provider = provRows[0];
    if (!owner || !provider) return { match: false, reason: 'insufficient_data' };

    const a = normalizeAddress(owner);
    const b = normalizeAddress(provider);
    if (!a || !b) return { match: false, reason: 'insufficient_data' };
    if (a !== b) return { match: false, reason: 'different' };

    // Matched. Grade confidence so the caller can suppress likely false
    // positives. Structured + matching postal code is the strongest signal; a
    // match backed only by free-text is the weakest (and most likely a
    // coincidental/legitimate overlap).
    const fields = matchedStructuredFields(owner, provider);
    const hasPostal = fields.includes('postalCode') && fields.includes('streetNumber');
    const strongStructured = fields.includes('streetNumber') && fields.includes('street') && fields.includes('city');

    let confidence: AddressMatchConfidence;
    let reasonCode: AddressMatchEvidence['reasonCode'];
    if (hasPostal) { confidence = 'high'; reasonCode = 'ADDR_EXACT_STRUCTURED_POSTAL'; }
    else if (strongStructured) { confidence = 'medium'; reasonCode = 'ADDR_EXACT_STRUCTURED'; }
    else { confidence = 'low'; reasonCode = 'ADDR_EXACT_FREETEXT'; }

    const evidence: AddressMatchEvidence = {
      reasonCode,
      confidence,
      normalized: a,
      ownerRaw: rawAddress(owner),
      providerRaw: rawAddress(provider),
      matchedFields: fields,
      ownerAccountUpdatedAt: owner.updatedAt ? new Date(owner.updatedAt).toISOString() : null,
      providerAccountUpdatedAt: provider.updatedAt ? new Date(provider.updatedAt).toISOString() : null,
      checkedAt: new Date().toISOString(),
    };
    return { match: true, reason: 'same_address', confidence, evidence };
  } catch {
    return { match: false, reason: 'insufficient_data' };
  }
}
