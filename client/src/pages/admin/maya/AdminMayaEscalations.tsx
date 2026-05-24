/**
 * /admin/maya/escalations — escalations list.
 *
 * Read-only in Stage 2. Stage 2b adds acknowledge/resolve actions.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listEscalations, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const SEVERITIES = ['all', 'low', 'medium', 'high', 'critical'] as const;
type SeverityFilter = (typeof SEVERITIES)[number];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function SeverityChip({ s }: { s: string }) {
  const style =
    s === 'critical' ? 'border-neutral-900 bg-neutral-900 text-white'
    : s === 'high'   ? 'border-neutral-900 text-neutral-900'
    : 'border-neutral-200 text-neutral-600';
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs uppercase tracking-wide ${style}`}>
      {s}
    </span>
  );
}

export default function AdminMayaEscalations() {
  const [severity, setSeverity] = useState<SeverityFilter>('all');

  const q = useQuery({
    queryKey: mayaQK.escalations(severity === 'all' ? { status: 'open' } : { status: 'open', severity }),
    queryFn: () => listEscalations(severity === 'all' ? { status: 'open' } : { status: 'open', severity }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Escalations"
      subtitle="Issues Maya has routed to a human. Acknowledgement and resolution ship in Stage 2b."
      actions={
        <div className="flex gap-1 rounded-sm border border-neutral-200 p-0.5">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={[
                'rounded-sm px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
                severity === s ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      }
    >
      {disabled ? (
        <MayaDisabledState feature="escalations" />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.escalations.length ? (
        <MayaEmptyState message="No open escalations." />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Severity</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">Assignee</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {q.data.escalations.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-900">{e.reason}</td>
                  <td className="px-4 py-3"><SeverityChip s={e.severity} /></td>
                  <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">{e.assignee ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMayaLayout>
  );
}
