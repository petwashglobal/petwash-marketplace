/**
 * /admin/maya/inbox — list of Maya conversations.
 *
 * Read-only. Tap a row to view the conversation thread. No bulk actions,
 * no destructive controls.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listConversations, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const STATUSES = ['all', 'open', 'closed', 'archived'] as const;
type StatusFilter = (typeof STATUSES)[number];

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-sm border border-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
      {status}
    </span>
  );
}

export default function AdminMayaInbox() {
  const [filter, setFilter] = useState<StatusFilter>('open');

  const q = useQuery({
    queryKey: mayaQK.conversations(filter === 'all' ? {} : { status: filter }),
    queryFn: () => listConversations(filter === 'all' ? {} : { status: filter }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Inbox"
      subtitle="Conversations Maya has had with web visitors and admin staff."
      actions={
        <div className="flex gap-1 rounded-sm border border-neutral-200 p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={[
                'rounded-sm px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
                filter === s ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100',
              ].join(' ')}
              data-testid={`filter-${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      }
    >
      {disabled ? (
        <MayaDisabledState />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.conversations.length ? (
        <MayaEmptyState message={`No ${filter === 'all' ? '' : filter + ' '}conversations.`} />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-xs text-neutral-500">
                  Contact
                </th>
                <th className="hidden px-4 py-3 text-left font-medium uppercase tracking-wide text-xs text-neutral-500 md:table-cell">
                  Channel
                </th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-xs text-neutral-500">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left font-medium uppercase tracking-wide text-xs text-neutral-500 lg:table-cell">
                  Created
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.conversations.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{c.contactName ?? '—'}</div>
                    <div className="text-xs text-neutral-500">
                      {c.contactPhone ?? c.contactEmail ?? c.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">{c.channel}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/maya/conversations/${c.id}`}
                      className="text-sm text-neutral-900 underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMayaLayout>
  );
}
