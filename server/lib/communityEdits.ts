/**
 * communityEdits — what a member may change after posting, and what that costs.
 *
 * Until 2026-09-17 nothing could be edited on either product: Adopt a Pet
 * allowed a status change, PawFinder only "resolved". A wrong street or a wrong
 * phone forced delete-and-repost, which threw away the notice's age, its matches
 * and every share it had collected.
 *
 * The rule, in one line: FREE TEXT AND PHOTOS GO BACK THROUGH REVIEW; structured
 * answers and contact details apply at once. Free text is what a scammer would
 * abuse, so a human sees it again before the public does. A phone correction on
 * a lost-dog notice must not wait for an approval queue.
 *
 * Pure module: no I/O, so the rules are testable on their own.
 */
import { z } from 'zod';

export type CommunitySurface = 'adoption' | 'paw_finder';

/** Applied immediately — structured, bounded, or contact-only. */
export const ADOPTION_INSTANT_FIELDS = [
  'contactPhone', 'listerType', 'sex', 'ageGroup', 'ageMonths', 'sizeCategory',
  'vaccinated', 'neutered', 'microchipped',
  'goodWithChildren', 'goodWithDogs', 'goodWithCats', 'apartmentFriendly', 'lowShedding',
] as const;

/** Back to the safety scan + support approval — anything the public reads or sees. */
export const ADOPTION_REVIEW_FIELDS = [
  'petName', 'breed', 'color', 'description', 'temperament', 'healthNotes', 'specialNeeds', 'city', 'area',
] as const;

export const PAW_FINDER_INSTANT_FIELDS = [
  'contactPhone', 'contactPreference', 'rewardAmount', 'sex', 'sizeCategory', 'eventDate', 'latitude', 'longitude',
] as const;

export const PAW_FINDER_REVIEW_FIELDS = [
  'petName', 'breed', 'colorPrimary', 'colorSecondary', 'description', 'city', 'area',
] as const;

export function fieldsFor(surface: CommunitySurface): { instant: readonly string[]; review: readonly string[] } {
  return surface === 'adoption'
    ? { instant: ADOPTION_INSTANT_FIELDS, review: ADOPTION_REVIEW_FIELDS }
    : { instant: PAW_FINDER_INSTANT_FIELDS, review: PAW_FINDER_REVIEW_FIELDS };
}

/**
 * Split a requested edit into what applies now and what needs a human.
 * A field nobody may edit (status, owner, post type) is reported as rejected —
 * never silently ignored.
 */
export function classifyEdit(surface: CommunitySurface, changed: Record<string, unknown>): {
  instant: string[];
  review: string[];
  rejected: string[];
  needsReview: boolean;
} {
  const { instant, review } = fieldsFor(surface);
  const i: string[] = [], r: string[] = [], x: string[] = [];
  for (const key of Object.keys(changed)) {
    if (instant.includes(key)) i.push(key);
    else if (review.includes(key)) r.push(key);
    else x.push(key);
  }
  return { instant: i, review: r, rejected: x, needsReview: r.length > 0 };
}

/** Only a live notice can be edited; a rejected or archived one cannot. */
export const EDITABLE_ADOPTION_STATUSES = ['pending_review', 'available', 'pending'] as const;
export const EDITABLE_PAW_FINDER_STATUSES = ['pending_review', 'published', 'matched'] as const;

export function canEdit(surface: CommunitySurface, status: string): boolean {
  return surface === 'adoption'
    ? (EDITABLE_ADOPTION_STATUSES as readonly string[]).includes(status)
    : (EDITABLE_PAW_FINDER_STATUSES as readonly string[]).includes(status);
}

/**
 * A published item whose public text changed goes back to pending_review; one
 * that was already waiting stays waiting. Nothing else moves.
 */
export function statusAfterEdit(surface: CommunitySurface, status: string, needsReview: boolean): string {
  if (!needsReview) return status;
  return 'pending_review';
}

const YES_NO = z.enum(['yes', 'no', 'unknown']);
const PHONE = z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,18}$/, 'invalid_phone');

export const adoptionEditSchema = z.object({
  petName: z.string().trim().min(1).max(100),
  breed: z.string().trim().max(100),
  color: z.string().trim().max(60),
  description: z.string().trim().min(20).max(2000),
  temperament: z.string().trim().max(1000),
  healthNotes: z.string().trim().max(1000),
  specialNeeds: z.string().trim().max(1000),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(100),
  contactPhone: PHONE,
  listerType: z.enum(['private', 'rescue', 'shelter']),
  sex: z.enum(['male', 'female', 'unknown']),
  ageGroup: z.enum(['baby', 'young', 'adult', 'senior', 'unknown']),
  ageMonths: z.number().int().min(0).max(360).nullable(),
  sizeCategory: z.enum(['tiny', 'small', 'medium', 'large', 'giant', 'unknown']),
  vaccinated: YES_NO, neutered: YES_NO, microchipped: YES_NO,
  goodWithChildren: YES_NO, goodWithDogs: YES_NO, goodWithCats: YES_NO,
  apartmentFriendly: YES_NO, lowShedding: YES_NO,
}).partial().strict();

export const pawFinderEditSchema = z.object({
  petName: z.string().trim().max(100),
  breed: z.string().trim().max(100),
  colorPrimary: z.string().trim().max(60),
  colorSecondary: z.string().trim().max(60),
  description: z.string().trim().min(10).max(2000),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(100),
  contactPhone: PHONE,
  contactPreference: z.enum(['inbox_first', 'reveal_phone_after_accept', 'public_phone']),
  rewardAmount: z.number().min(0).max(10000).nullable(),
  sex: z.enum(['male', 'female', 'unknown']),
  sizeCategory: z.enum(['tiny', 'small', 'medium', 'large', 'giant', 'unknown']),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
}).partial().strict();

/** A sighting: where and when someone saw the pet, plus what they saw. */
export const sightingSchema = z.object({
  seenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seenTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  note: z.string().trim().min(5).max(1000),
}).strict();

/** camelCase → the column it writes. Keeps the SQL honest and injection-free. */
export const EDIT_COLUMN: Record<string, string> = {
  petName: 'pet_name', breed: 'breed', color: 'color', colorPrimary: 'color_primary', colorSecondary: 'color_secondary',
  description: 'description', temperament: 'temperament', healthNotes: 'health_notes', specialNeeds: 'special_needs',
  city: 'city', area: 'area', contactPhone: 'contact_phone', contactPreference: 'contact_preference',
  listerType: 'lister_type', sex: 'sex', ageGroup: 'age_group', ageMonths: 'age_months', sizeCategory: 'size_category',
  vaccinated: 'vaccinated', neutered: 'neutered', microchipped: 'microchipped',
  goodWithChildren: 'good_with_children', goodWithDogs: 'good_with_dogs', goodWithCats: 'good_with_cats',
  apartmentFriendly: 'apartment_friendly', lowShedding: 'low_shedding',
  rewardAmount: 'reward_amount', eventDate: 'event_date', latitude: 'latitude', longitude: 'longitude',
};
