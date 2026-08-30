/**
 * useDocumentDetail — client hook for the Document Center detail
 * endpoint (CEO NEXT-AUTO §11).
 *
 * Fetches GET /api/marketplace/documents/:id and maps the outcome
 * onto a client-side union — ok / not_found / not_a_party / error.
 * §72 discipline: the hook never fabricates a document projection
 * for a missing / unauthorized row.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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
    code: 'ISSUER_SUMIT' | 'ISSUER_PW';
    externalDocumentUrl?: string;
    externalDocumentId?: string;
  };
  titleCode: string;
  subtitleCode: string;
}

export type DocumentDetailOutcome =
  | { status: 'ok'; document: DocumentDetail }
  | { status: 'not_found' }
  | { status: 'not_a_party' }
  | { status: 'error' };

interface Options {
  enabled?: boolean;
  staleTimeMs?: number;
}

export function useDocumentDetail(id: string | null | undefined, opts: Options = {}) {
  const enabled = Boolean(opts.enabled ?? true) && !!id;
  const q = useQuery<DocumentDetailOutcome>({
    queryKey: ['/api/marketplace/documents', id],
    enabled,
    retry: false,
    staleTime: opts.staleTimeMs ?? 60_000,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/marketplace/documents/${encodeURIComponent(id!)}`);
        const body: unknown = await (res as Response).json();
        if (body && typeof body === 'object' && 'document' in body) {
          return { status: 'ok', document: (body as { document: DocumentDetail }).document };
        }
        return { status: 'error' };
      } catch (err: any) {
        const code = err?.status ?? err?.response?.status;
        if (code === 404) return { status: 'not_found' };
        if (code === 403) return { status: 'not_a_party' };
        return { status: 'error' };
      }
    },
  });

  return {
    outcome: q.data,
    document: q.data?.status === 'ok' ? q.data.document : undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}
