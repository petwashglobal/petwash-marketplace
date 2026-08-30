/**
 * DocumentDetailService — CEO NEXT-AUTO §11 (Document Center detail).
 *
 * The single Document detail endpoint's back end. Given a document id
 * + the calling actor, resolves the canonical `digital_receipts` row,
 * validates the actor is either the customer (email match through
 * users) or the provider on the receipt, and returns a projection
 * safe for the client.
 *
 * §11 discipline: PetWash INDEXES canonical document truth — it does
 * NOT reissue it. When SUMIT is the issuer of record, the returned
 * projection carries the SUMIT documentUrl / documentId as the
 * external reference; the client opens the authoritative document
 * there.
 *
 * Fail-CLOSED discipline: any unrecognised outcome returns NOT_FOUND
 * rather than leaking backing state. The endpoint mapper turns each
 * outcome into a stable HTTP code.
 */
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db';
import { digitalReceipts, users } from '@shared/schema';

export type DocumentDetailOutcome =
  | { code: 'OK'; document: DocumentDetail }
  | { code: 'NOT_FOUND' }
  | { code: 'NOT_A_PARTY' };

export interface DocumentDetail {
  documentId: string;
  receiptNumber: string | null;
  kind: 'RECEIPT' | 'INVOICE' | 'REFUND_CONFIRMATION' | 'TAX_DOCUMENT' | 'PAYOUT_STATEMENT';
  entityRef: { kind: 'booking' | 'shop_order' | 'gift' | 'wallet_topup' | 'payout'; id: string };
  amountCents: number;
  currency: string;
  issuedAt: string;
  isVoided: boolean;
  issuer: {
    /** ISSUER_SUMIT when SUMIT authoritative; ISSUER_PW when PetWash self-issued. */
    code: 'ISSUER_SUMIT' | 'ISSUER_PW';
    externalDocumentUrl?: string;
    externalDocumentId?: string;
  };
  titleCode: string;                    // stable slug
  subtitleCode: string;                 // stable slug
}

function kindFromReceiptType(t: string): DocumentDetail['kind'] {
  const s = t.toLowerCase();
  if (s.includes('refund') || s.includes('credit_note')) return 'REFUND_CONFIRMATION';
  if (s.includes('invoice')) return 'INVOICE';
  if (s.includes('tax')) return 'TAX_DOCUMENT';
  if (s.includes('payout')) return 'PAYOUT_STATEMENT';
  return 'RECEIPT';
}

function entityFromPlatform(platform: string, bookingId: string | null): DocumentDetail['entityRef'] {
  const p = (platform || '').toLowerCase();
  if (bookingId) return { kind: 'booking', id: bookingId };
  if (p.includes('shop') || p === 'shop') return { kind: 'shop_order', id: '' };
  if (p.includes('gift')) return { kind: 'gift', id: '' };
  if (p.includes('wallet') || p.includes('topup')) return { kind: 'wallet_topup', id: '' };
  if (p.includes('payout')) return { kind: 'payout', id: '' };
  return { kind: 'booking', id: '' };
}

function titleCodeFor(kind: DocumentDetail['kind'], isVoided: boolean): string {
  if (isVoided) return 'DOCUMENT_VOIDED';
  switch (kind) {
    case 'RECEIPT':             return 'DOCUMENT_RECEIPT';
    case 'INVOICE':             return 'DOCUMENT_INVOICE';
    case 'REFUND_CONFIRMATION': return 'DOCUMENT_REFUND_CONFIRMATION';
    case 'TAX_DOCUMENT':        return 'DOCUMENT_TAX';
    case 'PAYOUT_STATEMENT':    return 'DOCUMENT_PAYOUT';
    default:                    return 'DOCUMENT_RECEIPT';
  }
}

export async function loadDocumentDetail(input: {
  documentId: string;
  actorUid: string;
  actorEmail?: string;
}): Promise<DocumentDetailOutcome> {
  try {
    const documentIdNum = Number.parseInt(input.documentId, 10);
    if (!Number.isFinite(documentIdNum) || documentIdNum <= 0) return { code: 'NOT_FOUND' };

    // Resolve the actor's email if not provided — needed for the
    // customer-side authorization check (digital_receipts stores
    // customer_email, not the Firebase uid).
    let actorEmail = input.actorEmail ?? '';
    if (!actorEmail) {
      try {
        const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.actorUid)).limit(1);
        actorEmail = u?.email ?? '';
      } catch { actorEmail = ''; }
    }

    const [row] = await db
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
        customerEmail: digitalReceipts.customerEmail,
        providerId: digitalReceipts.providerId,
      })
      .from(digitalReceipts)
      .where(and(eq(digitalReceipts.id, documentIdNum)))
      .limit(1);

    if (!row) return { code: 'NOT_FOUND' };

    const isCustomer = !!actorEmail && row.customerEmail === actorEmail;
    const isProvider = row.providerId === input.actorUid;
    if (!isCustomer && !isProvider) return { code: 'NOT_A_PARTY' };

    const kind = kindFromReceiptType(String(row.receiptType ?? ''));
    const entityRef = entityFromPlatform(String(row.platform ?? ''), row.bookingId ?? null);
    const amountCents = Math.round(Number(row.totalAmount ?? 0) * 100);
    const currency = String(row.currency ?? 'ILS');
    const issuedAt = row.issuedAt ? new Date(row.issuedAt).toISOString() : new Date().toISOString();
    const isVoided = Boolean(row.isVoided);
    const issuer: DocumentDetail['issuer'] = row.sumitDocumentUrl
      ? {
          code: 'ISSUER_SUMIT',
          externalDocumentUrl: row.sumitDocumentUrl ?? undefined,
          externalDocumentId: row.sumitDocumentId ?? undefined,
        }
      : { code: 'ISSUER_PW' };

    return {
      code: 'OK',
      document: {
        documentId: String(row.id),
        receiptNumber: row.receiptNumber ?? null,
        kind,
        entityRef,
        amountCents,
        currency,
        issuedAt,
        isVoided,
        issuer,
        titleCode: titleCodeFor(kind, isVoided),
        subtitleCode: issuer.code === 'ISSUER_SUMIT' ? 'ISSUER_SUMIT' : 'ISSUER_PW',
      },
    };
  } catch {
    // Never leak backing state — the router surfaces a stable 500.
    return { code: 'NOT_FOUND' };
  }
}

// Silence unused-import warning without changing behaviour: `or` is
// kept for future callers doing multi-column authorization.
void or;
