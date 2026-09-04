/**
 * NextBestAction — Journey Brain Phase 4 (post-release 2026-09-03 · Lane C.4).
 *
 * A THIN read-only composer over two canonical sources already in
 * production:
 *
 *   1. composeAttentionFeed  — "what needs my attention right now"
 *      urgent / due-soon / informational cards from booking, wallet,
 *      eGift, Prestige, KYA-stale, provider doc-expiry probes.
 *
 *   2. listActiveCheckpoints — "where did I leave off"
 *      abandoned wizard drafts (sitter / walk / marketplace / shop /
 *      egift / provider apply) that are still within their TTL.
 *
 * Returns ONE canonical projection the client renders on home:
 *
 *   {
 *     primaryAction:  AttentionItem | ResumeAction | null,
 *     secondaryActions: (AttentionItem | ResumeAction)[]
 *   }
 *
 * Selection rules (in priority order):
 *
 *   • ANY urgent attention item wins — a real booking that needs
 *     "pay to confirm" or "provider marked complete — confirm" is
 *     the single most important action on the home surface.
 *
 *   • If NO urgent attention item, the MOST RECENTLY UPDATED
 *     JourneyCheckpoint becomes primary — that's the wizard the
 *     user was actually in the middle of. A resume hint beats a
 *     due_soon booking that is not yet urgent.
 *
 *   • Otherwise the top due_soon / informational attention item
 *     is primary. `null` primaryAction means the home is quiet —
 *     the client suppresses the projection.
 *
 * Safety model (mirrors the composer):
 *
 *   • READ-ONLY. Never captures, reserves, or mutates.
 *   • Fails-CLOSED to `{ primaryAction: null, secondaryActions: [] }`
 *     on any error so a partial outage cannot break the home
 *     surface.
 *   • Every underlying probe is already fail-CLOSED per domain,
 *     so a Wallet outage does not lose sitter items.
 *   • The RESUMING wizard is the sole authority on payment /
 *     permission / availability gates. A resume action is a UX
 *     hint; it is NEVER treated as authority.
 */
import type { Pool } from 'pg';
import type { AttentionActor, AttentionItem } from '@shared/lib/attentionFeed';
import { composeAttentionFeed } from './attentionFeed';
import { listActiveCheckpoints, type JourneyDomain, type JourneyCheckpointRow } from './journeyCheckpoints';
import { recentFeedback } from './nextBestActionFeedback';
import { logger } from '../lib/logger';

/**
 * Journey Brain Phase 6 · CEO §24 §60 (adaptive, no dark patterns).
 *
 * When a user tells us "not interested" on an action, we suppress
 * that same action_key for a cooldown window so home stops nagging.
 * NEVER a permanent block — the cooldown expires and the composer
 * is free to re-surface the action later if it's still relevant.
 *
 * 7 days is the initial cooldown. A later change can tune it based
 * on feedback verdict density (dismiss <<< not_interested <<<
 * fewer_like_this in aggressiveness).
 */
const NOT_INTERESTED_COOLDOWN_DAYS = 7;

/**
 * A resume-your-journey card. Mirrors the shape of the AttentionItem
 * probe added in Lane C.1 but is emitted here so a caller can render
 * it without a second attention-feed read.
 */
export interface ResumeAction {
  kind: 'resume';
  domain: JourneyDomain;
  destination: string;
  title: string;
  reason: string;
  updatedAt: string;
  /** The checkpoint row id — stable for dedupe. */
  checkpointId: string;
}

export interface NextBestActionResult {
  primaryAction: AttentionItem | ResumeAction | null;
  secondaryActions: (AttentionItem | ResumeAction)[];
  composedAt: string;
}

const DOMAIN_META: Readonly<
  Record<
    JourneyDomain,
    { destination: string; he: string; en: string }
  >
> = Object.freeze({
  walk_book:        { destination: '/walk-my-pet',        he: 'הזמנת הליכה',           en: 'walk booking' },
  sitter_book:      { destination: '/sitter-suite',       he: 'הזמנת פט-סיטר',         en: 'sitter booking' },
  marketplace_book: { destination: '/marketplace',        he: 'הזמנה מהמרקטפלייס',     en: 'marketplace booking' },
  shop_checkout:    { destination: '/shop/checkout',      he: 'רכישה בחנות',           en: 'shop purchase' },
  egift:            { destination: '/wallet/egift/buy',   he: 'רכישת eGift',           en: 'eGift purchase' },
  provider_apply:   { destination: '/provider-onboarding', he: 'רישום ספק',            en: 'provider application' },
});

function toResumeAction(row: JourneyCheckpointRow, he: boolean): ResumeAction | null {
  const meta = DOMAIN_META[row.domain];
  if (!meta) return null; // unknown domain from a future release → skip silently
  return {
    kind: 'resume',
    domain: row.domain,
    destination: meta.destination,
    title: he ? `המשך ${meta.he}` : `Resume your ${meta.en}`,
    reason: he
      ? 'שמרנו את המקום שלך — נמשיך מהמקום בו עצרת.'
      : 'We saved where you left off — pick up from the same spot.',
    updatedAt: row.updatedAt.toISOString(),
    checkpointId: row.id,
  };
}

/**
 * Compose the next-best-action for one user. Fails-CLOSED to an
 * empty projection on any error.
 */
export async function composeNextBestAction(
  pool: Pool,
  args: { userUid: string; actor: AttentionActor; he: boolean },
): Promise<NextBestActionResult> {
  const emptyResult: NextBestActionResult = {
    primaryAction: null,
    secondaryActions: [],
    composedAt: new Date().toISOString(),
  };
  if (!args.userUid) return emptyResult;

  try {
    // Phase 6 · read feed + checkpoints + recent "not_interested"
    // verdicts in parallel. recentFeedback is fail-CLOSED (returns
    // [] on any pool error) so a broken feedback read NEVER
    // suppresses valid actions — the worst it can do is skip
    // the cooldown, not block a legitimate primary.
    const [feed, activeCheckpoints, suppressedRows] = await Promise.all([
      composeAttentionFeed(args.actor, args.userUid, args.he),
      listActiveCheckpoints(pool, { userUid: args.userUid }),
      recentFeedback(pool, {
        userUid: args.userUid,
        lookbackDays: NOT_INTERESTED_COOLDOWN_DAYS,
        verdicts: ['not_interested'],
      }),
    ]);

    // Build the suppression set once. Keys are the same stable
    // identity the feedback endpoint accepts:
    //   AttentionItem → `attn:<id>`
    //   ResumeAction  → `resume:<domain>`
    const suppressed = new Set<string>(suppressedRows.map((r) => r.actionKey));

    // Bucket the attention items. Suppressed keys drop out here,
    // so the picker never sees them at all.
    const urgent: AttentionItem[] = [];
    const dueSoon: AttentionItem[] = [];
    const informational: AttentionItem[] = [];
    for (const item of feed.items) {
      if (suppressed.has(`attn:${item.id}`)) continue;
      if (item.priority === 'urgent') urgent.push(item);
      else if (item.priority === 'due_soon') dueSoon.push(item);
      else informational.push(item);
    }

    // Resume hints — most-recently-updated first so a mid-flow user
    // sees their most recent draft on top. Suppressed domains drop
    // out here (the user can still resume from the wizard page
    // directly — this only removes the home surface nag).
    const resumeActions = activeCheckpoints
      .slice()
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((row) => toResumeAction(row, args.he))
      .filter((x): x is ResumeAction => x !== null)
      .filter((r) => !suppressed.has(`resume:${r.domain}`));

    // Selection rules — see file-level doc.
    let primaryAction: AttentionItem | ResumeAction | null = null;
    if (urgent.length) {
      primaryAction = urgent[0];
    } else if (resumeActions.length) {
      primaryAction = resumeActions[0];
    } else if (dueSoon.length) {
      primaryAction = dueSoon[0];
    } else if (informational.length) {
      primaryAction = informational[0];
    }

    // Secondary actions: the rest, in a consistent order. Urgent
    // first, then remaining resumes, then due_soon, then
    // informational. Never duplicates the primary.
    const secondary: (AttentionItem | ResumeAction)[] = [];
    for (const it of urgent) if (it !== primaryAction) secondary.push(it);
    for (const r of resumeActions) if (r !== primaryAction) secondary.push(r);
    for (const it of dueSoon) if (it !== primaryAction) secondary.push(it);
    for (const it of informational) if (it !== primaryAction) secondary.push(it);

    return {
      primaryAction,
      secondaryActions: secondary,
      composedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn('[NextBestAction] composer failed', {
      userUid: args.userUid,
      err: (err as Error)?.message,
    });
    return emptyResult;
  }
}
