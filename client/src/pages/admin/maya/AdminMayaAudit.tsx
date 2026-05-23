/**
 * /admin/maya/audit — append-only audit log viewer.
 *
 * READ-ONLY. The underlying maya_audit_log table is append-only at the DB
 * level (trigger blocks UPDATE/DELETE). No edit affordances exist here.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { listAudit, isMayaDisabledError, mayaQK } from '@/lib/mayaApi';

const ENTITY_TYPES = [
  'all', 'conversation', 'message', 'lead',
  'provider_draft', 'booking_draft', 'task', 'escalation',
] as const;
type EntityFilter = (typeof ENTITY_TYPES)[number];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminMayaAudit() {
  const [entityType, setEntityType] = useState<EntityFilter>('all');

  const q = useQuery({
    queryKey: mayaQK.audit(entityType === 'all' ? {} : { entityType }),
    queryFn: () => listAudit({
      ...(entityType !== 'all' && { entityType }),
      limit: 200,
    }),
    retry: false,
  });

  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Audit log"
      subtitle="Append-only at the DB level. UPDATE and DELETE on this table are rejected by trigger."
      actions={
        <div className="flex flex-wrap gap-1 rounded-sm border border-neutral-200 p-0.5">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setEntityType(t)}
              className={[
                'rounded-sm px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
                entityType === t ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100',
              ].join(' ')}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      }
    >
      {disabled ? (
        <MayaDisabledState />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.entries.length ? (
        <MayaEmptyState message="No audit entries yet." />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">When</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Action</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {q.data.entries.map((e) => (
                <tr key={String(e.id)} className="border-b border-neutral-100 last:border-b-0">
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(e.occurredAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium uppercase tracking-wide text-xs text-neutral-900">{e.actorType}</div>
                    {e.actorId && <div className="text-xs text-neutral-500">{e.actorId}</div>}
                  </td>
                  <td className="px-4 py-3 uppercase tracking-wide text-xs text-neutral-700">{e.entityType.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-neutral-700">{e.action}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-neutral-500 md:table-cell">{e.entityId.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMayaLayout>
  );
}
