/**
 * /admin/maya — overview page.
 *
 * Read-only summary of Maya's current state. Counts come from the list
 * endpoints (no separate /stats endpoint needed). All cards link to the
 * relevant section page.
 *
 * No actions on this page — by design. The overview is for orientation only.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaLoading,
} from './AdminMayaLayout';
import {
  listConversations,
  listLeads,
  listProviderDrafts,
  listBookingDrafts,
  listTasks,
  listEscalations,
  isMayaDisabledError,
  mayaQK,
} from '@/lib/mayaApi';

interface OverviewCard {
  label: string;
  path: string;
  count: number | null;
}

function Card({ card }: { card: OverviewCard }) {
  return (
    <Link
      href={card.path}
      className="group block rounded-sm border border-neutral-200 bg-white px-6 py-6 transition-colors hover:border-neutral-900"
    >
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
        {card.label}
      </div>
      <div className="mt-4 text-3xl font-medium tabular-nums text-neutral-900">
        {card.count === null ? '—' : card.count}
      </div>
      <div className="mt-3 text-xs text-neutral-400 group-hover:text-neutral-900">View →</div>
    </Link>
  );
}

export default function AdminMaya() {
  const conversationsQ = useQuery({
    queryKey: mayaQK.conversations({ status: 'open' }),
    queryFn: () => listConversations({ status: 'open', limit: 200 }),
    retry: false,
  });
  const leadsQ = useQuery({
    queryKey: mayaQK.leads({ status: 'new' }),
    queryFn: () => listLeads({ status: 'new', limit: 200 }),
    retry: false,
  });
  const providerDraftsQ = useQuery({
    queryKey: mayaQK.providerDrafts({ status: 'draft' }),
    queryFn: () => listProviderDrafts({ status: 'draft', limit: 200 }),
    retry: false,
  });
  const bookingDraftsQ = useQuery({
    queryKey: mayaQK.bookingDrafts({ status: 'draft' }),
    queryFn: () => listBookingDrafts({ status: 'draft', limit: 200 }),
    retry: false,
  });
  const tasksQ = useQuery({
    queryKey: mayaQK.tasks({ status: 'open' }),
    queryFn: () => listTasks({ status: 'open', limit: 200 }),
    retry: false,
  });
  const escalationsQ = useQuery({
    queryKey: mayaQK.escalations({ status: 'open' }),
    queryFn: () => listEscalations({ status: 'open', limit: 200 }),
    retry: false,
  });

  // Master-disabled detection: if every query failed with 503 maya_disabled,
  // show the disabled state instead of error spam.
  const queries = [conversationsQ, leadsQ, providerDraftsQ, bookingDraftsQ, tasksQ, escalationsQ];
  const allDisabled = queries.every((q) => q.isError && isMayaDisabledError(q.error));

  if (allDisabled) {
    return (
      <AdminMayaLayout
        title="Maya"
        subtitle="Reception, intake, and office assistant."
      >
        <MayaDisabledState />
      </AdminMayaLayout>
    );
  }

  const cards: OverviewCard[] = [
    { label: 'Open conversations', path: '/admin/maya/inbox', count: conversationsQ.data?.conversations.length ?? null },
    { label: 'New leads', path: '/admin/maya/leads', count: leadsQ.data?.leads.length ?? null },
    { label: 'Provider drafts', path: '/admin/maya/provider-drafts', count: providerDraftsQ.data?.drafts.length ?? null },
    { label: 'Booking drafts', path: '/admin/maya/booking-drafts', count: bookingDraftsQ.data?.drafts.length ?? null },
    { label: 'Open tasks', path: '/admin/maya/tasks', count: tasksQ.data?.tasks.length ?? null },
    { label: 'Open escalations', path: '/admin/maya/escalations', count: escalationsQ.data?.escalations.length ?? null },
  ];

  const anyLoading = queries.some((q) => q.isLoading);

  return (
    <AdminMayaLayout
      title="Maya"
      subtitle="Reception, intake, and office assistant. All actions are draft-only — no wallet, K9000, payments, or final booking confirmation from this surface."
    >
      {anyLoading && (
        <div className="mb-6">
          <MayaLoading />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} card={c} />
        ))}
      </div>
    </AdminMayaLayout>
  );
}
