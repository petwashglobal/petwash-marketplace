/**
 * MyInvoicesLink — "My Invoices / החשבוניות שלי" surface.
 *
 * SUMIT full-service adoption, Phase 2 (CEO 2026-08-16). SUMIT owns all
 * Israeli invoices legally. Every PetWash member has a SUMIT customer-portal
 * (`CustomerHistoryURL`) that lists their invoices/receipts/subscriptions in
 * one authoritative place. This component surfaces that link inside the
 * PetWash account area.
 *
 * SECURITY:
 * - The portal URL is fetched from GET /api/me/invoices/portal-url which
 *   RESOLVES the authenticated uid server-side. The browser never supplies
 *   a uid. User A cannot obtain User B's link.
 * - When the SUMIT customer has not been synced yet (e.g. flag off, or
 *   backfill has not run), the endpoint returns { available: false } and
 *   the component silently renders nothing — this is not an error state.
 * - Link opens SUMIT in a new tab with rel="noopener noreferrer".
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ExternalLink } from 'lucide-react';

type PortalResponse =
  | { available: true; url: string }
  | { available: false; reason?: string };

interface Props {
  language?: 'he' | 'en';
}

export default function MyInvoicesLink({ language = 'he' }: Props) {
  const { data, isLoading } = useQuery<PortalResponse>({
    queryKey: ['/api/me/invoices/portal-url'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/me/invoices/portal-url');
      if (!res.ok) return { available: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return null;
  if (!data || !data.available) return null;

  const he = language === 'he';
  const label = he ? 'החשבוניות שלי' : 'My Invoices';
  const sub = he
    ? 'צפו בכל החשבוניות והקבלות שלכם בפורטל SUMIT'
    : 'View all your invoices and receipts in the SUMIT portal';

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="link-my-invoices-sumit"
      className="flex items-center justify-between gap-3 rounded-md border border-[#e5e7eb] bg-white px-4 py-3 hover:bg-[#f9fafb] transition"
      dir={he ? 'rtl' : 'ltr'}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#1a1a1a]">{label}</div>
        <div className="text-xs text-[#666] font-light mt-0.5">{sub}</div>
      </div>
      <ExternalLink className="w-4 h-4 text-[#666] flex-shrink-0" aria-hidden="true" />
    </a>
  );
}
