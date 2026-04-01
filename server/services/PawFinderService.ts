/**
 * Paw Finder Service — orchestrates moderation, matching, events.
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

async function logEvent(
  postId: number | null,
  eventName: string,
  actorUserId: string | null,
  payload: Record<string, any> = {},
  severity: 'info' | 'warning' | 'critical' = 'info',
) {
  try {
    await pool.query(
      `INSERT INTO paw_finder_events (post_id, event_name, severity, actor_user_id, payload)
       VALUES ($1,$2,$3,$4,$5)`,
      [postId, eventName, severity, actorUserId, JSON.stringify(payload)],
    );
  } catch (err: any) {
    logger.warn('[PawFinder] Event log failed', { error: err.message });
  }
}

export async function createAndPublishPost(userId: string, input: CreatePostInput) {
  if (!input.description?.trim()) throw new Error('DESCRIPTION_REQUIRED');
  if (!input.city?.trim())        throw new Error('CITY_REQUIRED');
  if (!input.eventDate)           throw new Error('EVENT_DATE_REQUIRED');
  if (!input.mediaFiles?.length)  throw new Error('PRIMARY_MEDIA_REQUIRED');

  const postKey = `PF-${Date.now()}-${nanoid(8).toUpperCase()}`;

  const { rows } = await pool.query(
    `INSERT INTO paw_finder_posts
     (post_key, user_id, post_type, pet_type, pet_name, breed, color_primary, color_secondary,
      size_category, sex, description, reward_amount, contact_preference, contact_phone,
      city, area, address_text, latitude, longitude, event_date,
      status, moderation_status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
             'draft','pending',NOW(),NOW())
     RETURNING id`,
    [
      postKey, userId, input.postType, input.petType,
      input.petName ?? null, input.breed ?? null,
      input.colorPrimary ?? null, input.colorSecondary ?? null,
      input.sizeCategory ?? 'unknown', input.sex ?? 'unknown',
      input.description, input.rewardAmount ?? null,
      input.contactPreference ?? 'inbox_first', input.contactPhone ?? null,
      input.city, input.area ?? null, input.addressText ?? null,
      input.latitude ?? null, input.longitude ?? null, input.eventDate,
    ],
  );

  const postId = Number(rows[0].id);

  for (const media of input.mediaFiles) {
    await pool.query(
      `INSERT INTO paw_finder_media (post_id, media_role, file_path, mime_type)
       VALUES ($1,$2,$3,$4)`,
      [postId, media.mediaRole ?? 'primary', media.filePath, media.mimeType ?? null],
    );
  }

  await logEvent(postId, 'paw_finder_draft_created', userId, { postType: input.postType, city: input.city });

  const modInput: ModerationInput = {
    title: input.petName ?? null,
    description: input.description,
    rewardAmount: input.rewardAmount ?? null,
    city: input.city, area: input.area ?? null,
    postType: input.postType, petType: input.petType,
    mediaPaths: input.mediaFiles.map(m => m.filePath),
  };

  const modResult = await pawFinderModeration.moderateFinal(modInput);
  await pawFinderModeration.logModerationEvent(pool, postId, 'auto_publish', modResult, userId);

  const finalStatus: PawFinderStatus =
    modResult.verdict === 'approved' ? 'published' :
    modResult.verdict === 'flagged'  ? 'pending_review' : 'rejected';

  await pool.query(
    `UPDATE paw_finder_posts
     SET moderation_status = $2, moderation_reason = $3, moderation_confidence = $4,
         status = $5, final_publish_checked_at = NOW(),
         published_at = CASE WHEN $5 = 'published' THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1`,
    [postId, modResult.verdict, modResult.moderationReason, modResult.confidence, finalStatus],
  );

  await logEvent(postId, `paw_finder_post_${finalStatus}`, userId,
    { verdict: modResult.verdict, flags: modResult.flags },
    finalStatus === 'rejected' ? 'warning' : 'info',
  );

  if (finalStatus === 'published') {
    setImmediate(() => refreshMatchesForPost(pool, postId));
  }

  return { postId, postKey, status: finalStatus, moderation: modResult };
}

export async function resolvePost(userId: string, postId: number) {
  const { rows } = await pool.query(`SELECT user_id, status FROM paw_finder_posts WHERE id = $1 LIMIT 1`, [postId]);
  const post = rows[0];
  if (!post) throw new Error('POST_NOT_FOUND');
  if (post.user_id !== userId) throw new Error('NOT_POST_OWNER');
  if (post.status === 'resolved') throw new Error('ALREADY_RESOLVED');

  await pool.query(
    `UPDATE paw_finder_posts SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [postId],
  );
  await pool.query(
    `UPDATE paw_finder_matches SET status = 'resolved', updated_at = NOW() WHERE lost_post_id = $1 OR found_post_id = $1`,
    [postId],
  );
  await logEvent(postId, 'paw_finder_post_resolved', userId);
  return { ok: true };
}

export async function createContactRequest(
  postId: number,
  requesterUserId: string,
  messageText: string,
) {
  if (!messageText?.trim()) throw new Error('MESSAGE_REQUIRED');

  const { rows } = await pool.query(`SELECT user_id, status FROM paw_finder_posts WHERE id = $1 LIMIT 1`, [postId]);
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

  await logEvent(postId, 'paw_finder_contact_request_created', requesterUserId, { contactRequestId: res.rows[0].id });
  return { contactRequestId: Number(res.rows[0].id), status: 'pending' };
}
