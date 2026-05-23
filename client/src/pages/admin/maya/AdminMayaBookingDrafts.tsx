/**
 * /admin/maya/booking-drafts — booking intake drafts list.
 *
 * READ-ONLY in Stage 2. 'confirmed' is NOT a valid status here — final
 * booking confirmation happens in the existing booking system. Price is
 * NOT stored on these rows (resolved from source-of-truth pricing).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listBookingDrafts, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const STATUSES = ['all', 'draft', 'submitted-for-review'] as const;
type StatusFilter = (typeof STATUSES)[number];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminMayaBookingDrafts() {
  const [filter, setFilter] = useState<StatusFilter>('draft');

  const q = useQuery({
    queryKey: mayaQK.bookingDrafts(filter === 'all' ? {} : { status: filter }),
    queryFn: () => listBookingDrafts(filter === 'all' ? {} : { status: filter }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Booking drafts"
      subtitle="Intake drafts only. Final booking confirmation happens in the booking system. Price is resolved at confirm time — never stored here."
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
        <MayaDisabledState feature="booking intake" />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.drafts.length ? (
        <MayaEmptyState message={`No ${filter === 'all' ? '' : filter + ' '}booking drafts.`} />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Service / Pet</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">Size</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {q.data.drafts.map((d) => (
                <tr key={d.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{d.serviceCode ?? '—'}</div>
                    {(d.petName || d.petBreed) && (
                      <div className="mt-1 text-xs text-neutral-500">
                        {[d.petName, d.petBreed].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">{d.petSize ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-neutral-600 lg:table-cell">{d.preferredLocation ?? '—'}</td>
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
