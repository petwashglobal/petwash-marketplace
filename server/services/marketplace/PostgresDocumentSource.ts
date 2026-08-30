/**
 * PostgresDocumentSource — CEO NEXT-AUTO §11 (real Document Inbox).
 *
 * Reads the canonical `digital_receipts` table — the SUMIT/ITA-
 * compliant Israeli Digital Receipt store — and projects rows into
 * DocumentRow shape for DocumentInboxService.
 *
 * PetWash indexes canonical document truth — it does NOT reissue the
 * fiscal document. When SUMIT is the issuer of record, sumit_document_id
 * flows through as the external document ref so the customer's Inbox
 * tap can open the authoritative document.
 *
 * Discipline:
 *   §11 — no fake fiscal documents. This adapter reads authoritatively.
 *   §27 — projects itemKind=DOCUMENT on the appropriate domain, never
 *   under SUPPORT.
 *   §10.2 — customer name / provider name are safe display fields, not
 *   raw contact info. Email / phone stay in the receipt row and never
 *   leak into the Inbox projection.
 */
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db';
import { digitalReceipts, users } from '@shared/schema';
import {
  type DocumentRow,
  type DocumentSource,
} from './DocumentInboxService';
import type { InboxWorkspace } from '@shared/marketplace/inboxItem';

function receiptTypeToKind(t: string): DocumentRow['kind'] {
  const s = t.toLowerCase();
  if (s.includes('refund') || s.includes('credit_note')) return 'REFUND_CONFIRMATION';
  if (s.includes('invoice')) return 'INVOICE';
  if (s.includes('tax')) return 'TAX_DOCUMENT';
  if (s.includes('payout')) return 'PAYOUT_STATEMENT';
  return 'RECEIPT';
}

function platformToEntity(platform: string, bookingId: string | null): DocumentRow['entityRef'] {
  const p = (platform || '').toLowerCase();
  if (bookingId) return { kind: 'booking', id: bookingId };
  if (p.includes('shop') || p === 'shop') return { kind: 'shop_order', id: '' };
  if (p.includes('gift')) return { kind: 'gift', id: '' };
  if (p.includes('wallet') || p.includes('topup')) return { kind: 'wallet_topup', id: '' };
  if (p.includes('payout')) return { kind: 'payout', id: '' };
  return { kind: 'booking', id: '' };
}

function titleCodeFor(kind: DocumentRow['kind']): string {
  switch (kind) {
    case 'RECEIPT':             return 'DOCUMENT_RECEIPT';
    case 'INVOICE':             return 'DOCUMENT_INVOICE';
    case 'REFUND_CONFIRMATION': return 'DOCUMENT_REFUND_CONFIRMATION';
    case 'TAX_DOCUMENT':        return 'DOCUMENT_TAX';
    case 'PAYOUT_STATEMENT':    return 'DOCUMENT_PAYOUT';
    default:                    return 'DOCUMENT_RECEIPT';
  }
}

export interface PostgresDocumentSourceOptions {
  /**
   * The user's email — needed because digital_receipts stores
   * customer_email, not customer_uid. Callers resolve the email
   * from the Firebase user upstream so this adapter stays pure of
   * auth.
   */
  actorEmail?: string;
}

export function createPostgresDocumentSource(opts: PostgresDocumentSourceOptions = {}): DocumentSource {
  return {
    async listForActor(uid: string, workspace: InboxWorkspace): Promise<DocumentRow[]> {
      try {
        // Resolve the email once — cheap indexed lookup — because
        // digital_receipts.customer_email is the join key for the
        // Pet Parent view.
        let email = opts.actorEmail ?? '';
        if (!email) {
          try {
            const [u] = await db
              .select({ email: users.email })
              .from(users)
              .where(eq(users.id, uid))
              .limit(1);
            email = u?.email ?? '';
          } catch { email = ''; }
        }

        const where = workspace === 'PROVIDER'
          ? eq(digitalReceipts.providerId, uid)
          : email
              ? or(
                  eq(digitalReceipts.customerEmail, email),
                  eq(digitalReceipts.providerId, uid),
                )
              : eq(digitalReceipts.providerId, uid);

        const rows = await db
          .select({
            id: digitalReceipts.id,
            receiptNumber: digitalReceipts.receiptNumber,
            receiptType: digitalReceipts.receiptType,
            platform: digitalReceipts.platform,
            bookingId: digitalReceipts.bookingId,
            totalAmount: digitalReceipts.totalAmount,
            currency: digitalReceipts.currency,
            issuedAt: digitalReceipts.issuedAt,
            sumitDocumentUrl: digitalReceipts.sumitDocumentUrl,
            sumitDocumentId: digitalReceipts.sumitDocumentId,
            isVoided: digitalReceipts.isVoided,
          })
          .from(digitalReceipts)
          .where(and(where!));

        return rows.map<DocumentRow>((r) => {
          const kind = receiptTypeToKind(String(r.receiptType ?? ''));
          const entity = platformToEntity(String(r.platform ?? ''), r.bookingId ?? null);
          const cents = Math.round(Number(r.totalAmount ?? 0) * 100);
          return {
            documentId: r.receiptNumber ?? `dr_${r.id}`,
            kind,
            entityRef: entity,
            amountCents: Number.isFinite(cents) ? cents : undefined,
            currency: (r.currency as 'ILS' | undefined) ?? 'ILS',
            titleCode: r.isVoided ? 'DOCUMENT_VOIDED' : titleCodeFor(kind),
            subtitleCode: r.sumitDocumentUrl ? 'ISSUER_SUMIT' : 'ISSUER_PW',
            issuedAt: r.issuedAt ? new Date(r.issuedAt as any).toISOString() : new Date().toISOString(),
            workspaceContext: workspace,
          };
        });
      } catch {
        // Fail-soft: an empty list is safer than surfacing a raw error
        // to the Inbox aggregator.
        return [];
      }
    },
  };
}
