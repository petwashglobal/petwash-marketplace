/**
 * CEO MASTER DIRECTIVE 2026-08-28 §36 §37 §65 — NextBestAction
 * composer.
 *
 * Structured code decides WHAT ACTION exists. Reads:
 *   * canonical attention feed (server-authoritative signals)
 *   * saved-search + favourite-provider stores (Phase 3)
 *   * (future) NextBestAction of its own for forward-looking picks
 *
 * Output is a strictly-typed NextBestAction[] so the client renders
 * without a second API call. The LLM never enters this path; the
 * concierge only converts the reasonCode into localised copy at
 * render time.
 */
import type {
  NextBestAction,
  NextBestActionActor,
  NextBestActionFeed,
  NextBestActionReasonCode,
  NextBestActionPriority,
} from '@shared/lib/nextBestAction';
import { composeAttentionFeed } from './attentionFeed';
import { logger } from '../lib/logger';

const PRIORITY_ORDER: Record<NextBestActionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Map an AttentionItem.priority × domain → NextBestAction.priority.
 * A refactor MUST keep this deterministic: NBA priority is not a
 * copy of Attention priority, it is a RANKING signal.
 */
function attentionPriorityToNba(
  attnPriority: 'urgent' | 'due_soon' | 'informational',
): NextBestActionPriority {
  switch (attnPriority) {
    case 'urgent':        return 'critical';
    case 'due_soon':      return 'high';
    case 'informational': return 'normal';
  }
}

/**
 * Derive the stable NextBestActionReasonCode from an AttentionItem
 * id. The composer emits ids like `booking:BR-…` / `egift:…` /
 * `wallet:…` / `refund:…` — the prefix identifies the reason.
 *
 * Returning null MEANS this attention item does NOT graduate to a
 * NextBestAction — the concierge feed is deliberately narrower than
 * the attention feed. Only the highest-value forward-looking or
 * unambiguous nudges should surface here.
 */
function attentionIdToReasonCode(
  id: string,
  actor: NextBestActionActor,
  attnPriority: 'urgent' | 'due_soon' | 'informational',
): NextBestActionReasonCode | null {
  const [prefix] = id.split(':', 1);
  switch (prefix) {
    case 'booking':
      // Same-item reason varies by attention priority: an urgent booking
      // is BOOKING_PAYMENT_DUE / BOOKING_REQUEST_WAITING; an
      // informational one is BOOKING_REVIEW_AVAILABLE / _STARTS_SOON.
      if (actor === 'provider' && attnPriority === 'urgent')  return 'PROVIDER_REQUEST_WAITING';
      if (actor === 'pet_parent' && attnPriority === 'urgent') return 'BOOKING_PAYMENT_DUE';
      if (attnPriority === 'due_soon')                        return 'BOOKING_STARTS_SOON';
      return 'BOOKING_REVIEW_AVAILABLE';
    case 'resume':          return 'JOURNEY_RESUME_SAVED';
    case 'saved-search':    return 'SAVED_SEARCH_CONTINUE';
    case 'refund':          return 'REFUND_IN_PROGRESS';
    case 'egift':           return attnPriority === 'due_soon' ? 'EGIFT_EXPIRING_SOON' : 'EGIFT_BALANCE_AVAILABLE';
    case 'wallet':          return actor === 'provider' ? 'PROVIDER_PAYOUT_AVAILABLE' : 'WALLET_BALANCE_AVAILABLE';
    case 'prestige':        return 'PRESTIGE_BENEFIT_AVAILABLE';
    case 'pet_passport':    return 'KYA_STALE_REVIEW';
    case 'payout':          return 'PROVIDER_PAYOUT_AVAILABLE';
    case 'kyc':             return 'PROVIDER_KYC_DOC_EXPIRING';
    default:                return null;
  }
}

/**
 * CEO §37 confirmation gate. L2 (business action) and L3 (money /
 * legal) require an explicit confirmation before the CTA fires. This
 * mapping is centralised so a refactor that adds a new reason gets
 * the safe default (requires confirmation) unless the code opts out.
 */
function requiresConfirmation(reason: NextBestActionReasonCode): boolean {
  switch (reason) {
    // L0 read-only
    case 'BOOKING_STARTS_SOON':
    case 'BOOKING_AWAITING_YOU':
    case 'REFUND_IN_PROGRESS':
    case 'JOURNEY_RESUME_SAVED':
    case 'SAVED_SEARCH_CONTINUE':
    case 'EGIFT_BALANCE_AVAILABLE':
    case 'EGIFT_EXPIRING_SOON':
    case 'WALLET_BALANCE_AVAILABLE':
    case 'WASH_PACKAGE_AVAILABLE':
    case 'PRESTIGE_BENEFIT_AVAILABLE':
    case 'KYA_STALE_REVIEW':
    case 'PROVIDER_INSURANCE_EXPIRING':
    case 'PROVIDER_KYC_DOC_EXPIRING':
    case 'PROVIDER_PAYOUT_AVAILABLE':
    case 'PROVIDER_AVAILABILITY_STALE':
    case 'BOOKING_REVIEW_AVAILABLE':
      return false;
    // L2 / L3 — every money / commit path
    case 'BOOKING_PAYMENT_DUE':
    case 'BOOKING_PROVIDER_ACCEPTED':
    case 'BOOKING_REQUEST_WAITING':
    case 'PROVIDER_REQUEST_WAITING':
    case 'FAVOURITE_REBOOK':
      return true;
  }
}

function actionTypeFor(reason: NextBestActionReasonCode): NextBestAction['actionType'] {
  switch (reason) {
    case 'BOOKING_PAYMENT_DUE':          return 'pay';
    case 'BOOKING_STARTS_SOON':          return 'track';
    case 'BOOKING_PROVIDER_ACCEPTED':    return 'confirm';
    case 'BOOKING_AWAITING_YOU':         return 'confirm';
    case 'BOOKING_REVIEW_AVAILABLE':     return 'review';
    case 'BOOKING_REQUEST_WAITING':      return 'view';
    case 'PROVIDER_REQUEST_WAITING':     return 'accept_or_decline';
    case 'JOURNEY_RESUME_SAVED':         return 'view';
    case 'SAVED_SEARCH_CONTINUE':        return 'view';
    case 'FAVOURITE_REBOOK':             return 'rebook';
    case 'REFUND_IN_PROGRESS':           return 'view';
    case 'EGIFT_BALANCE_AVAILABLE':      return 'use_benefit';
    case 'EGIFT_EXPIRING_SOON':          return 'use_benefit';
    case 'WALLET_BALANCE_AVAILABLE':     return 'view';
    case 'WASH_PACKAGE_AVAILABLE':       return 'view';
    case 'PRESTIGE_BENEFIT_AVAILABLE':   return 'use_benefit';
    case 'KYA_STALE_REVIEW':             return 'view';
    case 'PROVIDER_INSURANCE_EXPIRING':  return 'renew_document';
    case 'PROVIDER_KYC_DOC_EXPIRING':    return 'renew_document';
    case 'PROVIDER_PAYOUT_AVAILABLE':    return 'view';
    case 'PROVIDER_AVAILABILITY_STALE':  return 'update_availability';
  }
}

export async function composeNextBestActionFeed(
  actor: NextBestActionActor,
  userId: string,
  he: boolean,
): Promise<NextBestActionFeed> {
  const composedAt = new Date().toISOString();
  if (!userId) return { actor, actions: [], composedAt };

  const actions: NextBestAction[] = [];

  // Phase 4 slice #1: forward every actionable AttentionItem into a
  // NextBestAction whose reasonCode encodes the WHY.
  try {
    const feed = await composeAttentionFeed(actor === 'pet_parent' ? 'pet_parent' : 'provider', userId, he);
    for (const item of feed.items) {
      const reasonCode = attentionIdToReasonCode(item.id, actor, item.priority);
      if (!reasonCode) continue;
      actions.push({
        id: `nba:${item.id}`,
        actor,
        domain: item.domain as NextBestAction['domain'],
        entityRef: item.entityId,
        reasonCode,
        priority: attentionPriorityToNba(item.priority),
        actionType: actionTypeFor(reasonCode),
        destination: item.destination,
        expiresAt: item.dueAt,
        requiresConfirmation: requiresConfirmation(reasonCode),
        moneyHintCents: item.moneySummary?.amountCents,
      });
    }
  } catch (e: any) {
    logger.warn('[NextBestAction] attention passthrough failed', { userId, err: e?.message });
  }

  // Sort: critical → high → normal → low; within a bucket keep the
  // attention-feed order.
  actions.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
    if (a.expiresAt) return -1;
    if (b.expiresAt) return 1;
    return 0;
  });

  return { actor, actions, composedAt };
}
