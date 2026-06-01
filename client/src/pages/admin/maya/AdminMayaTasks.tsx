/**
 * /admin/maya/tasks — task/callback list.
 *
 * Read-only in Stage 2. Stage 2b adds task creation + mark-done.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listTasks, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const STATUSES = ['all', 'open', 'in-progress', 'done', 'cancelled'] as const;
type StatusFilter = (typeof STATUSES)[number];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminMayaTasks() {
  const [filter, setFilter] = useState<StatusFilter>('open');

  const q = useQuery({
    queryKey: mayaQK.tasks(filter === 'all' ? {} : { status: filter }),
    queryFn: () => listTasks(filter === 'all' ? {} : { status: filter }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Tasks"
      subtitle="Callback and follow-up tasks captured by Maya."
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
        <MayaDisabledState feature="tasks" />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.tasks.length ? (
        <MayaEmptyState message={`No ${filter === 'all' ? '' : filter + ' '}tasks.`} />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Title</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Due</th>
              </tr>
            </thead>
            <tbody>
              {q.data.tasks.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{t.title}</div>
                    {t.description && <div className="mt-1 text-xs text-neutral-500">{t.description}</div>}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">{t.assignee ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
                      {t.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(t.dueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMayaLayout>
  );
}
