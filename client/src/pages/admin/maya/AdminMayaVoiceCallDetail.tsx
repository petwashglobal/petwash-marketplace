/**
 * /admin/maya/voice/calls/:id — phone call detail with transcript and
 * extracted intake side-by-side.
 *
 * Read-only. Stage 3D pairs with Stage 3A's GET /api/admin/maya/voice/calls/:id
 * and Stage 1b's existing endpoints (messages, leads, drafts).
 */
import { useQuery } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import { apiRequest } from '@/lib/queryClient';
import { isMayaDisabledError, listMessages } from '@/lib/mayaApi';

interface PhoneCall {
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

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'maya' | 'admin' | 'system';
  content: string;
  locale: 'he' | 'en';
  createdAt: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

async function fetchCall(id: string): Promise<{ ok: true; call: PhoneCall }> {
  const res = await apiRequest(`/api/admin/maya/voice/calls/${id}`);
  return (await res.json()) as { ok: true; call: PhoneCall };
}

function TranscriptTurn({ m }: { m: Message }) {
  const isMaya = m.role === 'maya';
  const dir = m.locale === 'he' ? 'rtl' : 'ltr';
  return (
    <div className={`flex flex-col ${isMaya ? 'items-start' : 'items-end'}`}>
      <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
        <span className="font-medium uppercase tracking-wide">{m.role}</span>
        <span>·</span>
        <time>{fmt(m.createdAt)}</time>
      </div>
      <div
        dir={dir}
        className={[
          'max-w-[80%] whitespace-pre-wrap rounded-sm border px-4 py-3 text-sm',
          isMaya
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-900',
        ].join(' ')}
      >
        {m.content}
      </div>
    </div>
  );
}

export default function AdminMayaVoiceCallDetail() {
  const [, params] = useRoute<{ id: string }>('/admin/maya/voice/calls/:id');
  const id = params?.id ?? '';

  const callQ = useQuery({
    queryKey: ['maya', 'voice', 'call', id],
    queryFn: () => fetchCall(id),
    enabled: !!id,
    retry: false,
  });

  const msgQ = useQuery({
    queryKey: ['maya', 'messages', id],
    queryFn: () => listMessages(id),
    enabled: !!id,
    retry: false,
  });

  const disabled =
    (callQ.isError && isMayaDisabledError(callQ.error)) ||
    (msgQ.isError && isMayaDisabledError(msgQ.error));

  if (disabled) {
    return (
      <AdminMayaLayout title="Call">
        <MayaDisabledState feature="voice" />
      </AdminMayaLayout>
    );
  }
  if (callQ.isLoading || msgQ.isLoading) {
    return (
      <AdminMayaLayout title="Call">
        <MayaLoading />
      </AdminMayaLayout>
    );
  }
  if (!callQ.data) {
    return (
      <AdminMayaLayout title="Call">
        <MayaEmptyState message="Call not found." />
        <div className="mt-4">
          <Link href="/admin/maya/voice/calls" className="text-sm underline-offset-2 hover:underline">
            ← Back to voice calls
          </Link>
        </div>
      </AdminMayaLayout>
    );
  }

  const c = callQ.data.call;
  const messages = msgQ.data?.messages ?? [];
  const duration =
    c.callStartedAt && c.callEndedAt
      ? Math.max(0, Math.floor((new Date(c.callEndedAt).getTime() - new Date(c.callStartedAt).getTime()) / 1000))
      : null;

  return (
    <AdminMayaLayout
      title={c.contactName ?? c.contactPhone ?? 'Phone call'}
      subtitle={`${c.voiceProvider ?? 'unknown provider'} · ${c.status} · started ${fmt(c.callStartedAt)}`}
      actions={
        <Link
          href="/admin/maya/voice/calls"
          className="rounded-sm border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          ← Voice calls
        </Link>
      }
    >
      {/* Call meta */}
      <dl className="mb-8 grid grid-cols-2 gap-4 rounded-sm border border-neutral-200 bg-white p-6 md:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">From</dt>
          <dd className="mt-1 text-sm text-neutral-900">{c.contactPhone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Call SID</dt>
          <dd className="mt-1 font-mono text-xs text-neutral-500">{c.externalCallSid ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ended</dt>
          <dd className="mt-1 text-sm text-neutral-900">{fmt(c.callEndedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Duration</dt>
          <dd className="mt-1 text-sm text-neutral-900">
            {duration !== null ? `${Math.floor(duration / 60)}m ${duration % 60}s` : '—'}
          </dd>
        </div>
      </dl>

      {/* Transcript */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
        Transcript
      </h2>
      {messages.length === 0 ? (
        <MayaEmptyState message="No transcript turns captured." />
      ) : (
        <div className="space-y-6">
          {messages.map((m) => <TranscriptTurn key={m.id} m={m} />)}
        </div>
      )}

      {/* Note about extracted drafts — Stage 3D ships the read; Stage 3C creates them. */}
      <div className="mt-10 rounded-sm border border-neutral-200 bg-neutral-50 px-6 py-4 text-xs text-neutral-500">
        Extracted leads / drafts / tasks / escalations created from this call
        appear in their respective sections under /admin/maya. Filter by
        <code className="mx-1 rounded bg-white px-1 py-0.5 font-mono">conversation_id={c.id.slice(0, 8)}…</code>
        to see them.
      </div>
    </AdminMayaLayout>
  );
}
