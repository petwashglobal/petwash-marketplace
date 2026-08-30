/**
 * DocumentInboxService — CEO NEXT-AUTO §11.
 *
 * Projection of customer-visible documents (receipts, invoices, tax
 * documents, refund confirmations) into an Inbox-consumable shape.
 * The doctrine §27 rule: documents are DOCUMENT itemKind, NOT
 * SUPPORT — a receipt lands in "Payments & Documents", not
 * "Support". This service is the read-model that produces that
 * projection.
 *
 * The service is pure — an injected source lists document rows; the
 * projection maps them to the doctrine's stable InboxItem shape.
 * Adapter implementations wire the source to the real DB.
 */
import type { InboxItem, InboxWorkspace } from '@shared/marketplace/inboxItem';

export type DocumentKind =
  | 'RECEIPT'
  | 'INVOICE'
  | 'REFUND_CONFIRMATION'
  | 'TAX_DOCUMENT'
  | 'PAYOUT_STATEMENT';

export interface DocumentRow {
  documentId: string;
  kind: DocumentKind;
  entityRef: { kind: 'booking' | 'shop_order' | 'gift' | 'wallet_topup' | 'payout'; id: string };
  amountCents?: number;
  currency?: 'ILS';
  titleCode: string;                    // stable slug the UI translates
  subtitleCode?: string;
  issuedAt: string;                     // ISO
  workspaceContext: InboxWorkspace;
}

export interface DocumentSource {
  listForActor(uid: string, workspace: InboxWorkspace): Promise<DocumentRow[]>;
}

export async function listDocumentInboxItems(
  uid: string,
  workspace: InboxWorkspace,
  source: DocumentSource,
): Promise<InboxItem[]> {
  const rows = await source.listForActor(uid, workspace);
  return rows.map<InboxItem>((r) => ({
    threadId: `doc:${r.documentId}`,
    threadType: 'SHOP_ORDER',            // legacy fallback for old callers
    entityId: r.entityRef.id,
    workspaceContext: workspace,
    // CEO §27 — documents are DOCUMENT itemKind in the appropriate
    // domain, never SUPPORT.
    itemKind: 'DOCUMENT',
    domain: domainForDocument(r),
    title: r.titleCode,
    subtitle: r.subtitleCode ?? '',
    lastMessage: r.subtitleCode ?? '',
    lastMessageAt: r.issuedAt,
    unreadCount: 0,
    secondaryActions: [],
  }));
}

function domainForDocument(r: DocumentRow) {
  switch (r.entityRef.kind) {
    case 'booking':     return 'BOOKING' as const;
    case 'shop_order':  return 'SHOP' as const;
    case 'gift':        return 'EGIFT' as const;
    case 'wallet_topup':return 'WALLET' as const;
    case 'payout':      return 'PAYOUT' as const;
    default:            return 'SUPPORT' as const;
  }
}

/**
 * Stub source — the tests use this. Real Postgres adapter follows
 * once the CEO-gated `customer_documents` table lands.
 */
export function createStubDocumentSource(rows: DocumentRow[]): DocumentSource {
  return {
    async listForActor(_uid, workspace) {
      return rows.filter((r) => r.workspaceContext === workspace);
    },
  };
}
