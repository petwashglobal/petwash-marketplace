/**
 * adoptionRules — the Adopt a Pet domain, without I/O.
 *
 * Adopt a Pet is its own PetWash™‎ service: "this pet needs a new permanent
 * family". It is NOT PawFinder™‎ ("where is my pet? / I found someone's pet").
 * Until 2026-09-13 adoption listings were paw_finder_posts rows with
 * post_type='adoption' (PR #920), so they appeared on the lost & found board
 * and went through lost & found logic. The two now share only plumbing —
 * login, photo storage, the content-safety scan, push delivery.
 *
 * Everything that decides behaviour lives here so it can be tested without a
 * database: listing statuses, who may move a listing where, input schemas, and
 * the owner/applicant message copy.
 */
import { z } from 'zod';

/** A listing's life: reviewed → available → (meeting) pending → adopted. */
export const ADOPTION_STATUSES = ['pending_review', 'available', 'pending', 'adopted', 'rejected', 'archived'] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

/** Visible to the public board and the listing page. */
export const PUBLIC_ADOPTION_STATUSES: readonly AdoptionStatus[] = ['available', 'pending', 'adopted'];

/** Enquiries are accepted only while the pet can still be adopted. */
export const ENQUIRABLE_ADOPTION_STATUSES: readonly AdoptionStatus[] = ['available', 'pending'];

/**
 * The moves a lister may make on their own listing. Review outcomes
 * (pending_review → available / rejected) belong to support only.
 */
const OWNER_TRANSITIONS: Record<AdoptionStatus, readonly AdoptionStatus[]> = {
  pending_review: ['archived'],
  available: ['pending', 'adopted', 'archived'],
  pending: ['available', 'adopted', 'archived'],
  adopted: ['archived'],
  rejected: ['archived'],
  archived: [],
};

export function canOwnerMoveListing(from: string, to: string): boolean {
  const allowed = OWNER_TRANSITIONS[from as AdoptionStatus];
  return !!allowed && allowed.includes(to as AdoptionStatus);
}

export const ADOPTION_PET_TYPES = ['dog', 'cat', 'rabbit', 'bird', 'other'] as const;
export const ADOPTION_AGE_GROUPS = ['baby', 'young', 'adult', 'senior', 'unknown'] as const;
export const ADOPTION_LISTER_TYPES = ['private', 'rescue', 'shelter'] as const;
const YES_NO = z.enum(['yes', 'no', 'unknown']).default('unknown');

/** A photo address the adoption upload returns — nothing else. */
export const ADOPTION_MEDIA_PATH_RE =
  /^\/api\/adoption\/photo\/ad-\d{10,16}-[a-f0-9]{12}\.(?:jpg|jpeg|png|webp|heic)$/;

const PHONE = z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,18}$/, 'invalid_phone');

export const createAdoptionListingSchema = z.object({
  listerType: z.enum(ADOPTION_LISTER_TYPES).default('private'),
  petType: z.enum(ADOPTION_PET_TYPES),
  petName: z.string().trim().min(1).max(100),
  breed: z.string().trim().max(100).optional(),
  sex: z.enum(['male', 'female', 'unknown']).default('unknown'),
  ageGroup: z.enum(ADOPTION_AGE_GROUPS).default('unknown'),
  sizeCategory: z.enum(['tiny', 'small', 'medium', 'large', 'giant', 'unknown']).default('unknown'),
  color: z.string().trim().max(60).optional(),
  description: z.string().trim().min(20).max(2000),
  temperament: z.string().trim().max(1000).optional(),
  healthNotes: z.string().trim().max(1000).optional(),
  specialNeeds: z.string().trim().max(1000).optional(),
  vaccinated: YES_NO,
  neutered: YES_NO,
  microchipped: YES_NO,
  goodWithChildren: YES_NO,
  goodWithDogs: YES_NO,
  goodWithCats: YES_NO,
  apartmentFriendly: YES_NO,
  lowShedding: YES_NO,
  /** Approximate age in months (0–360); optional — ageGroup is the fallback. */
  ageMonths: z.number().int().min(0).max(360).optional(),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(100).optional(),
  // Needed to arrange a meeting. Never public — shown only to an applicant the
  // lister accepts.
  contactPhone: PHONE,
  mediaFiles: z.array(z.object({
    filePath: z.string().regex(ADOPTION_MEDIA_PATH_RE, { message: 'filePath must be an adoption upload path' }),
    mimeType: z.string().max(64).optional(),
    mediaRole: z.enum(['primary', 'extra']).default('primary'),
    hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  })).min(1).max(6),
}).strict();

export type CreateAdoptionListingInput = z.infer<typeof createAdoptionListingSchema>;

export const adoptionEnquirySchema = z.object({
  messageText: z.string().trim().min(20).max(1500),
  applicantPhone: PHONE.optional(),
  homeType: z.enum(['apartment', 'house', 'house_with_yard', 'other', 'unspecified']).default('unspecified'),
  hasChildren: YES_NO,
  hasOtherPets: YES_NO,
}).strict();

export const ownerStatusSchema = z.object({
  status: z.enum(['available', 'pending', 'adopted', 'archived']),
}).strict();

export function adoptionListingLink(listingId: number): string {
  return `/adoption/${listingId}`;
}

export const ADOPTION_DASHBOARD_LINK = '/adoption/my';

export type AdoptionEvent =
  | 'listing_approved'
  | 'listing_rejected'
  | 'enquiry_received'
  | 'enquiry_accepted'
  | 'enquiry_declined';

/** Hebrew-first copy for the lister and the applicant. Pure — tested. */
export function adoptionMessage(
  event: AdoptionEvent,
  listing: { pet_name?: string | null },
  extra: { ownerPhone?: string | null } = {},
): { title: string; body: string } {
  const name = listing.pet_name || 'החיה';
  switch (event) {
    case 'listing_approved':
      return { title: '✅ המודעה שלך באוויר', body: `${name} מופיע/ה עכשיו בעמוד האימוץ` };
    case 'listing_rejected':
      return { title: 'המודעה לא אושרה', body: `מודעת האימוץ של ${name} לא פורסמה. אפשר לפנות לתמיכה לפרטים` };
    case 'enquiry_received':
      return { title: '🏡 פנייה חדשה לאימוץ', body: `מישהו מעוניין לאמץ את ${name}. פתחו כדי לקרוא` };
    case 'enquiry_accepted':
      return {
        title: '✅ הפנייה שלך התקבלה',
        body: extra.ownerPhone
          ? `אפשר לתאם היכרות עם ${name}: ${extra.ownerPhone}`
          : `אפשר לתאם היכרות עם ${name}. הפרטים באזור האישי`,
      };
    case 'enquiry_declined':
      return { title: 'עדכון על הפנייה שלך', body: `הפנייה לאימוץ ${name} לא התקדמה הפעם` };
  }
}

/* ── Adopter profile + matching ───────────────────────────────────────────── */

export const adopterProfileSchema = z.object({
  homeType: z.enum(['apartment', 'house', 'house_with_yard', 'other', 'unspecified']).default('unspecified'),
  hasChildren: YES_NO,
  hasDogs: YES_NO,
  hasCats: YES_NO,
  wantsLowShedding: YES_NO,
  preferredSpecies: z.enum(['any', ...ADOPTION_PET_TYPES]).default('any'),
  city: z.string().trim().max(100).optional(),
  about: z.string().trim().max(1000).optional(),
}).strict();

export type AdopterProfile = z.infer<typeof adopterProfileSchema>;

export interface FitListing {
  pet_type: string;
  good_with_children?: string | null;
  good_with_dogs?: string | null;
  good_with_cats?: string | null;
  apartment_friendly?: string | null;
  low_shedding?: string | null;
}

export type FitReason = 'species' | 'children' | 'dogs' | 'cats' | 'apartment' | 'low_shedding';

/**
 * Honest compatibility — no invented percentage. A pet is a "great fit" only
 * when nothing the lister said conflicts with the adopter's home AND at least
 * one of the adopter's needs is positively confirmed. Unknown never counts as
 * a match, and never as a conflict.
 */
export function adoptionFit(listing: FitListing, profile: Partial<AdopterProfile> | null | undefined): {
  greatFit: boolean;
  conflicts: FitReason[];
  confirmed: FitReason[];
} {
  const conflicts: FitReason[] = [];
  const confirmed: FitReason[] = [];
  if (!profile) return { greatFit: false, conflicts, confirmed };

  const check = (need: boolean, answer: string | null | undefined, reason: FitReason) => {
    if (!need) return;
    if (answer === 'no') conflicts.push(reason);
    else if (answer === 'yes') confirmed.push(reason);
  };

  if (profile.preferredSpecies && profile.preferredSpecies !== 'any') {
    if (listing.pet_type === profile.preferredSpecies) confirmed.push('species');
    else conflicts.push('species');
  }
  check(profile.hasChildren === 'yes', listing.good_with_children, 'children');
  check(profile.hasDogs === 'yes', listing.good_with_dogs, 'dogs');
  check(profile.hasCats === 'yes', listing.good_with_cats, 'cats');
  check(profile.homeType === 'apartment', listing.apartment_friendly, 'apartment');
  check(profile.wantsLowShedding === 'yes', listing.low_shedding, 'low_shedding');

  return { greatFit: conflicts.length === 0 && confirmed.length > 0, conflicts, confirmed };
}
