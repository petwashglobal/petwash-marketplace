/**
 * /admin/maya/leads — list of captured leads.
 *
 * Read-only in Stage 2. Status changes ship in Stage 2b.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listLeads, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const STATUSES = ['all', 'new', 'contacted', 'qualified', 'closed'] as const;
type StatusFilter = (typeof STATUSES)[number];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminMayaLeads() {
  const [filter, setFilter] = useState<StatusFilter>('new');

  const q = useQuery({
    queryKey: mayaQK.leads(filter === 'all' ? {} : { status: filter }),
    queryFn: () => listLeads(filter === 'all' ? {} : { status: filter }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Leads"
      subtitle="Customer interest captured by Maya. Draft-only — no approvals here."
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
      ) : !q.data?.leads.length ? (
        <MayaEmptyState message={`No ${filter === 'all' ? '' : filter + ' '}leads.`} />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Name</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">Phone</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">City</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {q.data.leads.map((l) => (
                <tr key={l.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{l.name ?? '—'}</div>
                    {l.intent && <div className="mt-1 text-xs text-neutral-500">{l.intent}</div>}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">{l.phone ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-neutral-600 lg:table-cell">{l.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
                      {l.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMayaLayout>
  );
}
