/**
 * /admin/maya/provider-drafts — provider intake drafts list.
 *
 * READ-ONLY in Stage 2. 'approved' is NOT a valid status here — provider
 * approval lives outside Maya in the provider-admin system.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listProviderDrafts, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const STATUSES = ['all', 'draft', 'submitted-for-review'] as const;
type StatusFilter = (typeof STATUSES)[number];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminMayaProviderDrafts() {
  const [filter, setFilter] = useState<StatusFilter>('draft');

  const q = useQuery({
    queryKey: mayaQK.providerDrafts(filter === 'all' ? {} : { status: filter }),
    queryFn: () => listProviderDrafts(filter === 'all' ? {} : { status: filter }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Provider drafts"
      subtitle="Intake drafts only. Approval is handled outside Maya."
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
        <MayaDisabledState feature="provider intake" />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.drafts.length ? (
        <MayaEmptyState message={`No ${filter === 'all' ? '' : filter + ' '}provider drafts.`} />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Business</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">City / Region</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {q.data.drafts.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{d.businessName ?? '—'}</div>
                    {d.contactName && <div className="mt-1 text-xs text-neutral-500">{d.contactName}</div>}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">
                    {[d.city, d.region].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
                      {d.intakeStatus}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMayaLayout>
  );
}
