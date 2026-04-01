/**
 * Paw Finder Match Service
 * Haversine distance + attribute similarity scoring.
 * Threshold ≥ 45 → insert into paw_finder_matches.
 *
 * After inserting matches, BOTH sides of every match get their
 * matched_post_count and status updated — not just the triggering post.
 */

import { logger } from '../lib/logger';

export interface MatchResult {
  similarityScore: number;
  similarityReasons: string[];
  distanceKm: number | null;
  dateGapDays: number;
}

function toRad(v: number) { return (v * Math.PI) / 180; }

function haversineKm(
  lat1?: number | null, lon1?: number | null,
  lat2?: number | null, lon2?: number | null,
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function daysBetween(a: string, b: string) {
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000));
}

export function computeMatch(lostPost: any, foundPost: any): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  if (lostPost.city && lostPost.city === foundPost.city)                                        { score += 20; reasons.push('same_city'); }
  if (lostPost.pet_type === foundPost.pet_type)                                                  { score += 20; reasons.push('same_pet_type'); }
  if (lostPost.color_primary && lostPost.color_primary === foundPost.color_primary)             { score += 15; reasons.push('same_primary_color'); }
  if (lostPost.breed && foundPost.breed && lostPost.breed.toLowerCase() === foundPost.breed.toLowerCase()) { score += 20; reasons.push('same_breed'); }
  if (lostPost.size_category && lostPost.size_category === foundPost.size_category)             { score += 10; reasons.push('same_size'); }

  const gapDays = daysBetween(lostPost.event_date, foundPost.event_date);
  if (gapDays <= 1)       { score += 10; reasons.push('date_gap_1_day'); }
  else if (gapDays <= 3)  { score += 6;  reasons.push('date_gap_3_days'); }

  const distanceKm = haversineKm(
    Number(lostPost.latitude ?? null), Number(lostPost.longitude ?? null),
    Number(foundPost.latitude ?? null), Number(foundPost.longitude ?? null),
  );
  if (distanceKm != null) {
    if (distanceKm <= 1)        { score += 20; reasons.push('within_1km'); }
    else if (distanceKm <= 5)   { score += 12; reasons.push('within_5km'); }
    else if (distanceKm <= 15)  { score += 5;  reasons.push('within_15km'); }
  }

  return { similarityScore: Math.min(score, 100), similarityReasons: reasons, distanceKm, dateGapDays: gapDays };
}

/**
 * Recalculates all matches for `postId` and then updates matched_post_count
 * and status on BOTH sides of every affected match pair.
 *
 * Bug history: previous version only updated the triggering post — counterpart
 * posts kept stale matched_post_count = 0 and status = 'published'.
 */
export async function refreshMatchesForPost(pool: any, postId: number): Promise<void> {
  try {
    const postRes = await pool.query(`SELECT * FROM paw_finder_posts WHERE id = $1 LIMIT 1`, [postId]);
    const post = postRes.rows[0];
    if (!post) return;
    if (!['published', 'matched'].includes(post.status)) return;

    const targetType = post.post_type === 'lost' ? 'found' : 'lost';
    const others = await pool.query(
      `SELECT * FROM paw_finder_posts
       WHERE post_type = $1 AND status IN ('published','matched') AND city = $2 AND id <> $3`,
      [targetType, post.city, postId],
    );

    for (const other of others.rows) {
      const lostPost  = post.post_type === 'lost'  ? post  : other;
      const foundPost = post.post_type === 'found' ? post  : other;
      const match = computeMatch(lostPost, foundPost);

      if (match.similarityScore >= 45) {
        await pool.query(
          `INSERT INTO paw_finder_matches
           (lost_post_id, found_post_id, distance_km, date_gap_days, similarity_score, similarity_reasons, status, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'suggested',NOW())
           ON CONFLICT (lost_post_id, found_post_id) DO UPDATE SET
             distance_km       = EXCLUDED.distance_km,
             date_gap_days     = EXCLUDED.date_gap_days,
             similarity_score  = EXCLUDED.similarity_score,
             similarity_reasons= EXCLUDED.similarity_reasons,
             updated_at        = NOW()`,
          [lostPost.id, foundPost.id, match.distanceKm ?? null, match.dateGapDays ?? null,
           match.similarityScore, JSON.stringify(match.similarityReasons)],
        );
      }
    }

    // ── Update matched_post_count + status on ALL affected post IDs ──────────
    // Affected = the triggering post + every counterpart in the match table.
    const affectedIds: number[] = [postId];

    const counterparts = await pool.query(
      `SELECT lost_post_id AS pid FROM paw_finder_matches WHERE found_post_id = $1 AND status = 'suggested'
       UNION
       SELECT found_post_id AS pid FROM paw_finder_matches WHERE lost_post_id  = $1 AND status = 'suggested'`,
      [postId],
    );
    for (const r of counterparts.rows) affectedIds.push(Number(r.pid));

    // Deduplicate
    const uniqueIds = [...new Set(affectedIds)];

    // For each affected post, recount its live matches and update status
    for (const pid of uniqueIds) {
      await pool.query(
        `UPDATE paw_finder_posts p
         SET matched_post_count = COALESCE(sub.cnt, 0),
             status = CASE
               WHEN COALESCE(sub.cnt, 0) > 0 AND p.status = 'published' THEN 'matched'
               ELSE p.status
             END,
             updated_at = NOW()
         FROM (
           SELECT $1::int AS pid,
                  (SELECT COUNT(*)::int
                   FROM paw_finder_matches m
                   WHERE (m.lost_post_id = $1 OR m.found_post_id = $1)
                     AND m.status = 'suggested') AS cnt
         ) sub
         WHERE p.id = sub.pid`,
        [pid],
      );
    }

    logger.info('[PawFinderMatch] Matches refreshed', { postId, affectedPosts: uniqueIds });
  } catch (err: any) {
    logger.error('[PawFinderMatch] refreshMatchesForPost failed', { postId, error: err.message });
  }
}
