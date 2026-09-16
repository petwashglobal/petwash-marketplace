/**
 * CommunityEditService — applying a member's edit to their own listing or notice.
 *
 * One shared engine for both products because the *mechanics* are identical
 * (own the item → allowed field → write → log → maybe back to review); the field
 * lists and the safety rules live in server/lib/communityEdits.ts and stay
 * per-product. Adoption and PawFinder remain two products.
 *
 * Every accepted change writes a community_edit_events row (before → after).
 */
import { logger } from '../lib/logger';
import {
  canEdit, classifyEdit, statusAfterEdit, EDIT_COLUMN, type CommunitySurface,
} from '../lib/communityEdits';

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<any> };

export class CommunityEditError extends Error {
  constructor(public code: string, public httpStatus: number) {
    super(code);
  }
}

const TABLE: Record<CommunitySurface, string> = { adoption: 'adoption_listings', paw_finder: 'paw_finder_posts' };

/**
 * Apply an edit. Returns which fields changed, and whether the item went back
 * to review. A field the member is not allowed to touch is refused, loudly.
 */
export async function applyCommunityEdit(
  pool: Queryable,
  args: { surface: CommunitySurface; itemId: number; userId: string; changes: Record<string, unknown> },
): Promise<{ applied: string[]; needsReview: boolean; status: string }> {
  const { surface, itemId, userId, changes } = args;
  const table = TABLE[surface];

  const { instant, review, rejected } = classifyEdit(surface, changes);
  if (rejected.length) throw new CommunityEditError(`FIELD_NOT_EDITABLE:${rejected.join(',')}`, 400);
  const fields = [...instant, ...review];
  if (!fields.length) throw new CommunityEditError('NOTHING_TO_CHANGE', 400);

  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [itemId]);
  const item = rows[0];
  if (!item) throw new CommunityEditError('NOT_FOUND', 404);
  if (item.user_id !== userId) throw new CommunityEditError('NOT_OWNER', 403);
  if (!canEdit(surface, item.status)) throw new CommunityEditError(`NOT_EDITABLE_IN_STATUS:${item.status}`, 409);

  // Only the fields whose value actually differs — an edit that changes nothing
  // must not push a published notice back into the approval queue.
  const norm = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  const changedFields = fields.filter((f) => norm(item[EDIT_COLUMN[f]]) !== norm(changes[f]));
  if (!changedFields.length) return { applied: [], needsReview: false, status: item.status };

  const reallyNeedsReview = changedFields.some((f) => review.includes(f));
  const nextStatus = statusAfterEdit(surface, item.status, reallyNeedsReview);

  const sets = changedFields.map((f, i) => `${EDIT_COLUMN[f]} = $${i + 1}`);
  const params: unknown[] = changedFields.map((f) => changes[f] ?? null);
  params.push(nextStatus, itemId, userId);
  const statusIdx = params.length - 2, idIdx = params.length - 1, userIdx = params.length;

  const { rows: updated } = await pool.query(
    `UPDATE ${table}
        SET ${sets.join(', ')},
            status = $${statusIdx},
            last_edited_at = NOW(),
            edit_count = COALESCE(edit_count, 0) + 1,
            ${reallyNeedsReview ? `moderation_status = 'pending', ` : ''}
            updated_at = NOW()
      WHERE id = $${idIdx} AND user_id = $${userIdx}
      RETURNING status`,
    params,
  );
  if (!updated.length) throw new CommunityEditError('NOT_OWNER', 403);

  for (const f of changedFields) {
    await pool.query(
      `INSERT INTO community_edit_events (surface, item_id, actor_user_id, field, old_value, new_value, re_review)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [surface, itemId, userId, f,
        item[EDIT_COLUMN[f]] === null || item[EDIT_COLUMN[f]] === undefined ? null : String(item[EDIT_COLUMN[f]]),
        changes[f] === null || changes[f] === undefined ? null : String(changes[f]),
        reallyNeedsReview && review.includes(f)],
    ).catch((err: any) => logger.warn('[CommunityEdit] trail write failed', { surface, itemId, field: f, error: err?.message }));
  }

  return { applied: changedFields, needsReview: reallyNeedsReview, status: updated[0].status };
}

/** The edit history a member (or support) can read back. */
export async function readEditTrail(pool: Queryable, surface: CommunitySurface, itemId: number) {
  const { rows } = await pool.query(
    `SELECT field, old_value, new_value, re_review, created_at
       FROM community_edit_events WHERE surface = $1 AND item_id = $2
      ORDER BY created_at DESC LIMIT 100`,
    [surface, itemId],
  );
  return rows;
}
