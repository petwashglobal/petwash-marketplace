/**
 * pawFinderNotify — tell the person who posted what happened to their post.
 *
 * WHY (audit 2026-09-13): support approving or rejecting a post, and the matcher
 * pairing a found dog with a lost one, all happened silently. The only alerts
 * were rows in paw_finder_notifications, visible only inside the PawFinder page.
 * An owner searching for a lost pet had to keep reopening the page to learn
 * that their post went live, or that someone found their dog.
 *
 * Now every such event writes the in-app row AND sends a push to the owner's
 * registered devices, deep-linked to the post. Both are fail-soft: a failed
 * alert never fails the admin action or the match refresh.
 */
import { logger } from './logger';

export type PawFinderOwnerEvent = 'post_approved' | 'post_rejected' | 'match_found';

export interface PawFinderOwnerMessage {
  title: string;
  body: string;
}

/** The link a push opens: the post's own page. */
export function pawFinderPostLink(postId: number): string {
  return `/paw-finder/${postId}`;
}

/** Hebrew-first copy (same voice as the existing contact alerts). Pure — tested. */
export function pawFinderOwnerMessage(
  event: PawFinderOwnerEvent,
  post: { post_type?: string | null; pet_name?: string | null },
): PawFinderOwnerMessage {
  const name = post.pet_name || 'החיה';
  switch (event) {
    case 'post_approved':
      return {
        title: '✅ הפוסט שלך פורסם',
        body: post.post_type === 'adoption'
          ? `${name} מופיע/ה עכשיו בעמוד האימוץ`
          : `הפוסט על ${name} גלוי עכשיו לכל הקהילה`,
      };
    case 'post_rejected':
      return {
        title: 'הפוסט שלך לא אושר',
        body: `הפוסט על ${name} לא פורסם. אפשר לפנות לתמיכה לפרטים`,
      };
    case 'match_found':
      return {
        title: post.post_type === 'lost' ? '🐾 ייתכן שמצאנו את החיה שלך!' : '🐾 נמצאה התאמה לפוסט שלך',
        body: `יש פוסט שדומה ל-${name}. פתחו כדי לבדוק`,
      };
  }
}

/**
 * Write the in-app notification and push it to the owner's devices.
 * Never throws.
 */
export async function notifyPawFinderOwner(
  pool: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  args: {
    userId: string | null | undefined;
    postId: number;
    event: PawFinderOwnerEvent;
    post: { post_type?: string | null; pet_name?: string | null };
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  if (!args.userId) return;
  const msg = pawFinderOwnerMessage(args.event, args.post);
  const link = pawFinderPostLink(args.postId);

  try {
    await pool.query(
      `INSERT INTO paw_finder_notifications (user_id, post_id, event_type, title, body, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [args.userId, args.postId, args.event, msg.title, msg.body, JSON.stringify({ ...(args.payload ?? {}), link })],
    );
  } catch (err: any) {
    logger.warn('[PawFinder] in-app notification failed', { postId: args.postId, event: args.event, error: err?.message });
  }

  try {
    const { sendPushToUser } = await import('./fcm-push');
    await sendPushToUser(args.userId, {
      title: msg.title,
      body: msg.body,
      data: { deepLink: link, type: `paw_finder_${args.event}`, postId: String(args.postId) },
    });
  } catch (err: any) {
    logger.warn('[PawFinder] push failed', { postId: args.postId, event: args.event, error: err?.message });
  }
}
