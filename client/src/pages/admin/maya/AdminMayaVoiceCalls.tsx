/**
 * /admin/maya/voice/calls — list of phone-channel conversations.
 *
 * Read-only. Tap a row to view transcript + extracted drafts.
 * Stage 3D — pairs with backend GET /api/admin/maya/voice/calls (Stage 3A).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { apiRequest } from '@/lib/queryClient';
import { isMayaDisabledError } from '@/lib/mayaApi';

interface VoiceCall {
  id: string;
  channel: string;
  status: string;
  contactPhone: string | null;
  contactName: string | null;
  externalCallSid: string | null;
  voiceProvider: string | null;
  callStartedAt: string | null;
  callEndedAt: string | null;
  createdAt: string;
}

const STATUSES = ['all', 'open', 'closed'] as const;
type StatusFilter = (typeof STATUSES)[number];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

async function fetchVoiceCalls(status?: string): Promise<{ ok: true; calls: VoiceCall[] }> {
  const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiRequest(`/api/admin/maya/voice/calls${qs}`);
  return (await res.json()) as { ok: true; calls: VoiceCall[] };
}

export default function AdminMayaVoiceCalls() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const q = useQuery({
    queryKey: ['maya', 'voice', 'calls', filter],
    queryFn: () => fetchVoiceCalls(filter === 'all' ? undefined : filter),
    retry: false,
  });
  const disabled = q.isError && isMayaDisabledError(q.error);

  return (
    <AdminMayaLayout
      title="Voice calls"
      subtitle="Maya phone conversations. Read-only. Transcripts + extracted intake on each row."
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
        <MayaDisabledState feature="voice" />
      ) : q.isLoading ? (
        <MayaLoading />
      ) : !q.data?.calls.length ? (
        <MayaEmptyState message="No phone calls yet." />
      ) : (
        <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Caller</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 md:table-cell">Call SID</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Started</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500 lg:table-cell">Ended</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {q.data.calls.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-neutral-900">
                      <span aria-hidden="true">📞</span>
                      <span>{c.contactName ?? c.contactPhone ?? '—'}</span>
                    </div>
                    <div className="text-xs text-neutral-500">{c.voiceProvider ?? '—'}</div>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-neutral-500 md:table-cell">
                    {c.externalCallSid?.slice(0, 10) ?? '—'}…
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(c.callStartedAt)}</td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">{fmtDate(c.callEndedAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-neutral-200 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/maya/voice/calls/${c.id}`}
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
