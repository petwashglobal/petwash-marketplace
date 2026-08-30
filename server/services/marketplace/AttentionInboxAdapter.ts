/**
 * AttentionInboxAdapter — CEO NEXT-AUTO §16 + Doctrine §22, §23, §85, §92.
 *
 * Third and final HubSource adapter (§14 booking-conversation + §15
 * chat_threads already landed). Projects the Attention feed — the
 * "things that need your attention" strip — into the shared InboxItem
 * shape so the unified Inbox screen carries nudges alongside real
 * conversations.
 *
 * Composition — not a new engine (§92):
 *   • Reuses composeAttentionFeed() from server/services/attentionFeed.ts.
 *   • Workspace maps directly to the Attention actor: PET_PARENT →
 *     'pet_parent'; PROVIDER → 'provider'. A multi-role UID gets two
 *     DISTINCT feeds (§37) — never merged.
 *
 * Contact discipline (§10.2):
 *   • Attention items do not have a "counterparty" — they are
 *     PetWash-generated nudges. otherParticipant stays unset; there is
 *     nothing to mask, and no user-row lookup happens here.
 *
 * The composer returns AttentionItem from shared/lib/attentionFeed.ts
 * (NOT AttentionFeedItem from shared/marketplace/attentionFeed.ts — the
 * server side of Attention was authored first). This adapter maps
 * AttentionItem.domain → InboxItem.threadType via a closed switch so no
 * unknown string can reach the UI.
 */
import { composeAttentionFeed } from '../attentionFeed';
import type {
  InboxItem,
  InboxWorkspace,
} from '@shared/marketplace/inboxItem';
import type { ThreadType } from '@shared/marketplace/policyEngine';
import type {
  AttentionDomain,
  AttentionItem,
  AttentionPriority,
} from '@shared/lib/attentionFeed';

// Map an AttentionDomain to the inbox ThreadType so the "Bookings",
// "Orders", "Compliance", etc. tabs pick the item up correctly.
// Anything unknown falls back to SUPPORT — never raw DB text.
function threadTypeForDomain(d: AttentionDomain): ThreadType {
  switch (d) {
    case 'booking':
    case 'walk':
    case 'sitting':
    case 'academy':
      return 'BOOKING';
    case 'shop':
      return 'SHOP_ORDER';
    case 'egift':
      return 'GIFT';
    case 'paw_finder':
      return 'PAW_FINDER';
    case 'kyc':
      return 'PROVIDER_APPLICATION';
    case 'wallet':
    case 'prestige':
    case 'pet_passport':
    case 'profile':
      return 'SUPPORT';
    default:
      return 'SUPPORT';
  }
}

function badgeForPriority(p: AttentionPriority): string | undefined {
  if (p === 'urgent') return 'URGENT';
  if (p === 'due_soon') return 'DUE_SOON';
  return undefined;
}

export async function listAttentionInboxItems(
  uid: string,
  workspace: InboxWorkspace,
  locale: 'he' | 'en' = 'he',
): Promise<InboxItem[]> {
  const actor = workspace === 'PET_PARENT' ? 'pet_parent' : 'provider';
  // CEO DEEP-LOGIC §7 — composeAttentionFeed already server-renders
  // title/subtitle strings; we forward the caller's locale so the
  // Inbox does not silently return English. The doctrine's next step
  // (§9) is to move InboxItem to `messageKey` + `messageParams` so the
  // client owns translation for system-generated items; that requires
  // a shared InboxItem shape change and is tracked as a follow-up.
  const feed = await composeAttentionFeed(actor, uid, /* he */ locale === 'he');
  if (feed.items.length === 0) return [];

  return feed.items.map<InboxItem>((it: AttentionItem) => ({
    threadId: `attention:${it.id}`,
    threadType: threadTypeForDomain(it.domain),
    entityId: it.entityId,
    workspaceContext: workspace,
    title: it.title,
    subtitle: it.reason,
    lastMessage: it.reason,
    lastMessageAt: it.dueAt ?? feed.composedAt,
    unreadCount: 0,
    statusBadge: badgeForPriority(it.priority),
    secondaryActions: [],
  }));
}
