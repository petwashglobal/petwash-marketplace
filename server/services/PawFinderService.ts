/**
 * Paw Finder Service — orchestrates moderation, matching, events.
 * All DB writes happen inside a single PostgreSQL transaction.
 * Moderation runs BEFORE the transaction to avoid holding a connection open
 * during a multi-second Gemini call.
 */

import { nanoid } from 'nanoid';
import { pool } from '../db';
import { pawFinderModeration, type ModerationInput } from './PawFinderModerationService';
import { refreshMatchesForPost } from './PawFinderMatchService';
import { logger } from '../lib/logger';

export type PawFinderStatus =
  | 'draft' | 'pending_review' | 'published'
  | 'matched' | 'resolved' | 'rejected' | 'archived';

export interface CreatePostInput {
  postType: 'lost' | 'found';
  petType: 'dog' | 'cat' | 'bird' | 'other';
  petName?: string;
  breed?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  sizeCategory?: string;
  sex?: string;
  description: string;
  rewardAmount?: number;
  contactPreference?: string;
  contactPhone?: string;
  city: string;
  area?: string;
  addressText?: string;
  latitude?: number;
  longitude?: number;
  eventDate: string;
  mediaFiles: Array<{ filePath: string; mimeType?: string; mediaRole?: 'primary' | 'extra' }>;
}

/**
 * Creates and publishes a Paw Finder post.
 *
 * Flow:
 *   1. Validate inputs (synchronous — throws before acquiring DB connection)
 *   2. Run Gemini moderation OUTSIDE any transaction (can take 2-3 s)
 *   3. BEGIN transaction on a dedicated pool client
 *   4. INSERT post row with the final moderation status in one shot
 *      (never touches a "draft" state — eliminates orphan-draft risk)
 *   5. INSERT media rows
 *   6. INSERT moderation event
 *   7. INSERT event log
 *   8. COMMIT — all or nothing
 *   On any failure in steps 3-8 → ROLLBACK → zero rows written
 */
export async function createAndPublishPost(userId: string, input: CreatePostInput) {
  if (!input.description?.trim()) throw new Error('DESCRIPTION_REQUIRED');
  if (!input.city?.trim())        throw new Error('CITY_REQUIRED');
  if (!input.eventDate)           throw new Error('EVENT_DATE_REQUIRED');
  if (!input.mediaFiles?.length)  throw new Error('PRIMARY_MEDIA_REQUIRED');

  const postKey = `PF-${Date.now()}-${nanoid(8).toUpperCase()}`;

  // ── STEP 1: Moderation (outside transaction) ──────────────────────────────
  const modInput: ModerationInput = {
    title: input.petName ?? null,
    description: input.description,
    rewardAmount: input.rewardAmount ?? null,
    city: input.city,
    area: input.area ?? null,
    postType: input.postType,
    petType: input.petType,
    mediaPaths: input.mediaFiles.map(m => m.filePath),
  };

  const modResult = await pawFinderModeration.moderateFinal(modInput);

  const finalStatus: PawFinderStatus =
    modResult.verdict === 'approved' ? 'published' :
    modResult.verdict === 'flagged'  ? 'pending_review' : 'rejected';

  // ── STEP 2: Atomic DB writes ──────────────────────────────────────────────
  const client = await pool.connect();
  let postId: number;

  try {
    await client.query('BEGIN');

    // INSERT post with final status — no intermediate draft row
    const { rows } = await client.query(
      `INSERT INTO paw_finder_posts
       (post_key, user_id, post_type, pet_type, pet_name, breed,
        color_primary, color_secondary, size_category, sex,
        description, reward_amount, contact_preference, contact_phone,
        city, area, address_text, latitude, longitude, event_date,
        status, moderation_status, moderation_reason, moderation_confidence,
        final_publish_checked_at,
        published_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
               $21,$22,$23,$24,
               NOW(),
               CASE WHEN $25::text = 'published' THEN NOW() ELSE NULL END,
               NOW(), NOW())
       RETURNING id`,
      [
        postKey, userId, input.postType, input.petType,         // $1-$4
        input.petName ?? null, input.breed ?? null,             // $5-$6
        input.colorPrimary ?? null, input.colorSecondary ?? null, // $7-$8
        input.sizeCategory ?? 'unknown', input.sex ?? 'unknown', // $9-$10
        input.description, input.rewardAmount ?? null,          // $11-$12
        input.contactPreference ?? 'inbox_first', input.contactPhone ?? null, // $13-$14
        input.city, input.area ?? null, input.addressText ?? null, // $15-$17
        input.latitude ?? null, input.longitude ?? null, input.eventDate, // $18-$20
        finalStatus, modResult.verdict, modResult.moderationReason, modResult.confidence, // $21-$24
        finalStatus,                                            // $25 — same as $21 for CASE WHEN
      ],
    );

    postId = Number(rows[0].id);

    // INSERT media rows
    for (const media of input.mediaFiles) {
      await client.query(
        `INSERT INTO paw_finder_media (post_id, media_role, file_path, mime_type)
         VALUES ($1,$2,$3,$4)`,
        [postId, media.mediaRole ?? 'primary', media.filePath, media.mimeType ?? null],
      );
    }

    // INSERT moderation event (client duck-types as pool — same .query() interface)
    await pawFinderModeration.logModerationEvent(client, postId, 'auto_publish', modResult, userId);

    // INSERT event log
    await client.query(
      `INSERT INTO paw_finder_events (post_id, event_name, severity, actor_user_id, payload)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        postId,
        `paw_finder_post_${finalStatus}`,
        finalStatus === 'rejected' ? 'warning' : 'info',
        userId,
        JSON.stringify({ verdict: modResult.verdict, flags: modResult.flags }),
      ],
    );

    await client.query('COMMIT');
    logger.info('[PawFinder] Post created atomically', { postId, postKey, finalStatus });
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('[PawFinder] createAndPublishPost transaction rolled back', { error: err.message });
    throw err;
  } finally {
    client.release();
  }

  // Trigger match refresh asynchronously — outside the now-closed transaction
  if (finalStatus === 'published') {
    setImmediate(() => refreshMatchesForPost(pool, postId));
  }

  return { postId, postKey, status: finalStatus, moderation: modResult };
}

export async function resolvePost(userId: string, postId: number) {
  const { rows } = await pool.query(
    `SELECT user_id, status FROM paw_finder_posts WHERE id = $1 LIMIT 1`,
    [postId],
  );
  const post = rows[0];
  if (!post) throw new Error('POST_NOT_FOUND');
  if (post.user_id !== userId) throw new Error('NOT_POST_OWNER');
  if (post.status === 'resolved') throw new Error('ALREADY_RESOLVED');
  if (!['published', 'matched', 'pending_review'].includes(post.status)) throw new Error('POST_NOT_RESOLVABLE');

  await pool.query(
    `UPDATE paw_finder_posts SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [postId],
  );
  await pool.query(
    `UPDATE paw_finder_matches SET status = 'resolved', updated_at = NOW()
     WHERE lost_post_id = $1 OR found_post_id = $1`,
    [postId],
  );
  await pool.query(
    `INSERT INTO paw_finder_events (post_id, event_name, severity, actor_user_id, payload)
     VALUES ($1, 'paw_finder_post_resolved', 'info', $2, '{}')`,
    [postId, userId],
  );
  return { ok: true };
}

export async function createContactRequest(
  postId: number,
  requesterUserId: string,
  messageText: string,
) {
  if (!messageText?.trim()) throw new Error('MESSAGE_REQUIRED');

  const { rows } = await pool.query(
    `SELECT user_id, status FROM paw_finder_posts WHERE id = $1 LIMIT 1`,
    [postId],
  );
  const post = rows[0];
  if (!post) throw new Error('POST_NOT_FOUND');
  if (!['published', 'matched'].includes(post.status)) throw new Error('POST_NOT_CONTACTABLE');
  if (post.user_id === requesterUserId) throw new Error('CANNOT_CONTACT_OWN_POST');

  const res = await pool.query(
    `INSERT INTO paw_finder_contact_requests
     (post_id, requester_user_id, owner_user_id, message_text, status, reveal_phone, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'pending',FALSE,NOW(),NOW())
     RETURNING id`,
    [postId, requesterUserId, post.user_id, messageText.trim()],
  );

  await pool.query(
    `INSERT INTO paw_finder_events (post_id, event_name, severity, actor_user_id, payload)
     VALUES ($1, 'paw_finder_contact_request_created', 'info', $2, $3)`,
    [postId, requesterUserId, JSON.stringify({ contactRequestId: res.rows[0].id })],
  );

  return { contactRequestId: Number(res.rows[0].id), status: 'pending' };
}
