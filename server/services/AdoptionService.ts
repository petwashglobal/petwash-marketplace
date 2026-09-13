/**
 * AdoptionService — Adopt a Pet listings, enquiries and alerts.
 *
 * Its own tables (adoption_*), its own statuses, its own contact flow. Shared
 * with PawFinder only as plumbing: the content-safety scan and push delivery.
 * No lost/found matching ever runs on an adoption listing.
 *
 * Every function takes the pool so the rules can be exercised without a DB.
 */
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import {
  adoptionListingLink,
  adoptionMessage,
  canOwnerMoveListing,
  ENQUIRABLE_ADOPTION_STATUSES,
  ADOPTION_DASHBOARD_LINK,
  type AdoptionEvent,
  type CreateAdoptionListingInput,
} from '../lib/adoptionRules';

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<any> };
type PoolLike = Queryable & { connect?: () => Promise<Queryable & { release: () => void }> };

export class AdoptionError extends Error {
  constructor(public code: string, public httpStatus: number) {
    super(code);
  }
}

/** In-app row + push to the person's devices. Never throws. */
export async function notifyAdoption(
  pool: Queryable,
  args: {
    userId: string | null | undefined;
    listingId: number;
    event: AdoptionEvent;
    listing: { pet_name?: string | null };
    link?: string;
    extra?: { ownerPhone?: string | null };
  },
): Promise<void> {
  if (!args.userId) return;
  const msg = adoptionMessage(args.event, args.listing, args.extra);
  const link = args.link ?? adoptionListingLink(args.listingId);
  try {
    await pool.query(
      `INSERT INTO adoption_notifications (user_id, listing_id, event_type, title, body, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [args.userId, args.listingId, args.event, msg.title, msg.body, JSON.stringify({ link })],
    );
  } catch (err: any) {
    logger.warn('[Adoption] in-app notification failed', { listingId: args.listingId, event: args.event, error: err?.message });
  }
  try {
    const { sendPushToUser } = await import('../lib/fcm-push');
    await sendPushToUser(args.userId, {
      title: msg.title,
      body: msg.body,
      data: { deepLink: link, type: `adoption_${args.event}`, listingId: String(args.listingId) },
    });
  } catch (err: any) {
    logger.warn('[Adoption] push failed', { listingId: args.listingId, event: args.event, error: err?.message });
  }
}

async function logEvent(pool: Queryable, listingId: number, eventName: string, actorUserId: string | null, payload: Record<string, unknown> = {}) {
  try {
    await pool.query(
      `INSERT INTO adoption_events (listing_id, event_name, actor_user_id, payload) VALUES ($1,$2,$3,$4)`,
      [listingId, eventName, actorUserId, JSON.stringify(payload)],
    );
  } catch (err: any) {
    logger.warn('[Adoption] event log failed', { listingId, eventName, error: err?.message });
  }
}

/**
 * Create a listing. Every listing waits for a human (same rule as PawFinder,
 * CEO 2026-06-26); the safety scan only decides review vs. refused.
 */
export async function createAdoptionListing(
  pool: PoolLike,
  userId: string,
  input: CreateAdoptionListingInput,
  deps: {
    moderate: (input: {
      title: string; description: string; city: string; area: string | null;
      postType: 'adoption'; petType: 'dog' | 'cat' | 'bird' | 'other'; mediaPaths: string[];
    }) => Promise<{ verdict: string; moderationReason: string; confidence: number; flags: string[] }>;
  },
) {
  const { rows: today } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM adoption_listings
      WHERE user_id = $1
        AND (created_at AT TIME ZONE 'Asia/Jerusalem')::date = (NOW() AT TIME ZONE 'Asia/Jerusalem')::date`,
    [userId],
  );
  if ((today[0]?.cnt ?? 0) >= 3) throw new AdoptionError('DAILY_LIMIT_REACHED', 429);

  const primary = input.mediaFiles.find((m) => m.mediaRole === 'primary') ?? input.mediaFiles[0];
  const imageHash = primary?.hash ?? null;
  if (imageHash) {
    const { rows: dup } = await pool.query(
      `SELECT id FROM adoption_listings WHERE image_hash = $1 AND user_id = $2 AND status <> 'archived' LIMIT 1`,
      [imageHash, userId],
    );
    if (dup.length) throw new AdoptionError('DUPLICATE_IMAGE', 409);
  }

  const mod = await deps.moderate({
    title: input.petName,
    description: [input.description, input.temperament, input.healthNotes, input.specialNeeds].filter(Boolean).join('\n'),
    city: input.city,
    area: input.area ?? null,
    postType: 'adoption',
    petType: input.petType === 'rabbit' ? 'other' : input.petType,
    mediaPaths: input.mediaFiles.map((m) => m.filePath),
  });
  const status = mod.verdict === 'blocked' ? 'rejected' : 'pending_review';
  const listingKey = `AD-${Date.now()}-${nanoid(8).toUpperCase()}`;

  const client = pool.connect ? await pool.connect() : null;
  const q: Queryable = client ?? pool;
  let listingId: number;
  try {
    await q.query('BEGIN');
    const { rows } = await q.query(
      `INSERT INTO adoption_listings
        (listing_key, user_id, lister_type, pet_type, pet_name, breed, sex, age_group, size_category, color,
         description, temperament, health_notes, special_needs,
         vaccinated, neutered, microchipped, good_with_children, good_with_dogs, good_with_cats,
         city, area, contact_phone, status, moderation_status, moderation_reason, moderation_confidence, image_hash,
         apartment_friendly, low_shedding, age_months)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       RETURNING id`,
      [
        listingKey, userId, input.listerType, input.petType, input.petName, input.breed ?? null,
        input.sex, input.ageGroup, input.sizeCategory, input.color ?? null,
        input.description, input.temperament ?? null, input.healthNotes ?? null, input.specialNeeds ?? null,
        input.vaccinated, input.neutered, input.microchipped,
        input.goodWithChildren, input.goodWithDogs, input.goodWithCats,
        input.city, input.area ?? null, input.contactPhone,
        status, mod.verdict, mod.moderationReason, mod.confidence, imageHash,
        input.apartmentFriendly, input.lowShedding, input.ageMonths ?? null,
      ],
    );
    listingId = Number(rows[0].id);
    for (const m of input.mediaFiles) {
      await q.query(
        `INSERT INTO adoption_listing_media (listing_id, media_role, file_path, mime_type) VALUES ($1,$2,$3,$4)`,
        [listingId, m.mediaRole, m.filePath, m.mimeType ?? null],
      );
    }
    await q.query(
      `INSERT INTO adoption_events (listing_id, event_name, actor_user_id, payload) VALUES ($1,$2,$3,$4)`,
      [listingId, `adoption_listing_${status}`, userId, JSON.stringify({ verdict: mod.verdict, flags: mod.flags })],
    );
    await q.query('COMMIT');
  } catch (err) {
    await q.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client?.release();
  }

  return { listingId, listingKey, status };
}

/** The lister moves their own listing (available ↔ pending → adopted, or archive). */
export async function setOwnListingStatus(pool: Queryable, userId: string, listingId: number, to: string) {
  const { rows } = await pool.query(`SELECT id, user_id, status FROM adoption_listings WHERE id = $1 LIMIT 1`, [listingId]);
  const listing = rows[0];
  if (!listing) throw new AdoptionError('LISTING_NOT_FOUND', 404);
  if (listing.user_id !== userId) throw new AdoptionError('NOT_LISTING_OWNER', 403);
  if (!canOwnerMoveListing(listing.status, to)) throw new AdoptionError('STATUS_CHANGE_NOT_ALLOWED', 409);

  // Guard on the status we read so two taps cannot race past the rules.
  const { rows: updated } = await pool.query(
    `UPDATE adoption_listings
        SET status = $1,
            adopted_at  = CASE WHEN $1 = 'adopted'  THEN NOW() ELSE adopted_at END,
            archived_at = CASE WHEN $1 = 'archived' THEN NOW() ELSE archived_at END,
            updated_at = NOW()
      WHERE id = $2 AND status = $3
      RETURNING id`,
    [to, listingId, listing.status],
  );
  if (!updated.length) throw new AdoptionError('STATUS_CHANGE_NOT_ALLOWED', 409);

  if (to === 'adopted' || to === 'archived') {
    await pool.query(
      `UPDATE adoption_enquiries SET status = 'declined', updated_at = NOW() WHERE listing_id = $1 AND status = 'pending'`,
      [listingId],
    );
  }
  await logEvent(pool, listingId, `adoption_listing_${to}`, userId, { from: listing.status });
  return { ok: true, status: to };
}

export async function createAdoptionEnquiry(
  pool: Queryable,
  applicantUserId: string,
  listingId: number,
  input: { messageText: string; applicantPhone?: string; homeType: string; hasChildren: string; hasOtherPets: string },
) {
  const { rows } = await pool.query(
    `SELECT id, user_id, status, pet_name FROM adoption_listings WHERE id = $1 LIMIT 1`,
    [listingId],
  );
  const listing = rows[0];
  if (!listing) throw new AdoptionError('LISTING_NOT_FOUND', 404);
  if (!ENQUIRABLE_ADOPTION_STATUSES.includes(listing.status)) throw new AdoptionError('LISTING_NOT_OPEN', 409);
  if (listing.user_id === applicantUserId) throw new AdoptionError('CANNOT_ENQUIRE_OWN_LISTING', 400);

  const { rows: pending } = await pool.query(
    `SELECT id FROM adoption_enquiries WHERE listing_id = $1 AND applicant_user_id = $2 AND status = 'pending' LIMIT 1`,
    [listingId, applicantUserId],
  );
  if (pending.length) throw new AdoptionError('DUPLICATE_ENQUIRY', 409);

  const { rows: daily } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM adoption_enquiries WHERE applicant_user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [applicantUserId],
  );
  if ((daily[0]?.cnt ?? 0) >= 10) throw new AdoptionError('ENQUIRY_RATE_LIMIT', 429);

  const { rows: created } = await pool.query(
    `INSERT INTO adoption_enquiries
       (listing_id, applicant_user_id, owner_user_id, message_text, applicant_phone, home_type, has_children, has_other_pets)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [listingId, applicantUserId, listing.user_id, input.messageText, input.applicantPhone ?? null,
      input.homeType, input.hasChildren, input.hasOtherPets],
  );
  const enquiryId = Number(created[0].id);
  await logEvent(pool, listingId, 'adoption_enquiry_created', applicantUserId, { enquiryId });
  await notifyAdoption(pool, {
    userId: listing.user_id, listingId, event: 'enquiry_received', listing, link: ADOPTION_DASHBOARD_LINK,
  });
  return { enquiryId, status: 'pending' as const };
}

/**
 * The lister answers an enquiry. Accepting shares the lister's phone with that
 * applicant only; the phone is never on the public listing.
 */
export async function respondToAdoptionEnquiry(
  pool: Queryable,
  ownerUserId: string,
  enquiryId: number,
  decision: 'accepted' | 'declined',
) {
  const { rows } = await pool.query(
    `UPDATE adoption_enquiries
        SET status = $1, updated_at = NOW()
      WHERE id = $2 AND owner_user_id = $3 AND status = 'pending'
      RETURNING id, listing_id, applicant_user_id`,
    [decision, enquiryId, ownerUserId],
  );
  const enquiry = rows[0];
  if (!enquiry) throw new AdoptionError('ENQUIRY_NOT_FOUND_OR_HANDLED', 404);

  const { rows: listingRows } = await pool.query(
    `SELECT id, pet_name, contact_phone FROM adoption_listings WHERE id = $1`,
    [enquiry.listing_id],
  );
  const listing = listingRows[0] ?? { pet_name: null, contact_phone: null };
  await logEvent(pool, Number(enquiry.listing_id), `adoption_enquiry_${decision}`, ownerUserId, { enquiryId });
  await notifyAdoption(pool, {
    userId: enquiry.applicant_user_id,
    listingId: Number(enquiry.listing_id),
    event: decision === 'accepted' ? 'enquiry_accepted' : 'enquiry_declined',
    listing,
    link: ADOPTION_DASHBOARD_LINK,
    extra: decision === 'accepted' ? { ownerPhone: listing.contact_phone } : {},
  });
  return { ok: true, status: decision };
}
