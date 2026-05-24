/**
 * /admin/maya/conversations/:id — single conversation with message thread.
 *
 * Read-only in Stage 2. Future stages will add: append admin reply, close,
 * archive, create lead from this thread.
 *
 * RTL-aware: messages in Hebrew render with dir="rtl"; English with dir="ltr".
 */
import { useQuery } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import AdminMayaLayout, {
  MayaDisabledState,
  MayaEmptyState,
  MayaLoading,
} from './AdminMayaLayout';
import {
  getConversation,
  listMessages,
  isMayaDisabledError,
  mayaQK,
  type MayaMessage,
} from '@/lib/mayaApi';

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function MessageRow({ msg }: { msg: MayaMessage }) {
  const isMaya = msg.role === 'maya';
  const isAdmin = msg.role === 'admin';
  const align = isMaya ? 'items-start' : 'items-end';
  const dir = msg.locale === 'he' ? 'rtl' : 'ltr';

  return (
    <div className={`flex flex-col ${align}`}>
      <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
        <span className="font-medium uppercase tracking-wide">{msg.role}</span>
        <span>·</span>
        <time>{fmtDate(msg.createdAt)}</time>
      </div>
      <div
        dir={dir}
        className={[
          'max-w-[80%] whitespace-pre-wrap rounded-sm border px-4 py-3 text-sm',
          isMaya || isAdmin
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-200 bg-white text-neutral-900',
        ].join(' ')}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function AdminMayaConversationDetail() {
  const [, params] = useRoute<{ id: string }>('/admin/maya/conversations/:id');
  const id = params?.id ?? '';

  const convQ = useQuery({
    queryKey: mayaQK.conversation(id),
    queryFn: () => getConversation(id),
    enabled: !!id,
    retry: false,
  });
  const msgQ = useQuery({
    queryKey: mayaQK.messages(id),
    queryFn: () => listMessages(id),
    enabled: !!id,
    retry: false,
  });

  const disabled =
    (convQ.isError && isMayaDisabledError(convQ.error)) ||
    (msgQ.isError && isMayaDisabledError(msgQ.error));

  if (disabled) {
    return (
      <AdminMayaLayout title="Conversation">
        <MayaDisabledState />
      </AdminMayaLayout>
    );
  }

  if (convQ.isLoading || msgQ.isLoading) {
    return (
      <AdminMayaLayout title="Conversation">
        <MayaLoading />
      </AdminMayaLayout>
    );
  }

  if (!convQ.data) {
    return (
      <AdminMayaLayout title="Conversation">
        <MayaEmptyState message="Conversation not found." />
        <div className="mt-4">
          <Link href="/admin/maya/inbox" className="text-sm underline-offset-2 hover:underline">
            ← Back to inbox
          </Link>
        </div>
      </AdminMayaLayout>
    );
  }

  const c = convQ.data.conversation;
  const messages = msgQ.data?.messages ?? [];

  return (
    <AdminMayaLayout
      title={c.contactName ?? 'Conversation'}
      subtitle={`${c.channel} · ${c.locale.toUpperCase()} · created ${fmtDate(c.createdAt)}`}
      actions={
        <Link
          href="/admin/maya/inbox"
          className="rounded-sm border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          ← Inbox
        </Link>
      }
    >
      {/* Contact strip */}
      <dl className="mb-8 grid grid-cols-2 gap-4 rounded-sm border border-neutral-200 bg-white p-6 md:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Phone</dt>
          <dd className="mt-1 text-sm text-neutral-900">{c.contactPhone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Email</dt>
          <dd className="mt-1 text-sm text-neutral-900">{c.contactEmail ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Status</dt>
          <dd className="mt-1 text-sm uppercase tracking-wide text-neutral-900">{c.status}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">ID</dt>
          <dd className="mt-1 font-mono text-xs text-neutral-500">{c.id.slice(0, 8)}…</dd>
        </div>
      </dl>

      {/* Message thread */}
      {messages.length === 0 ? (
        <MayaEmptyState message="No messages in this conversation." />
      ) : (
        <div className="space-y-6">
          {messages.map((m) => (
            <MessageRow key={m.id} msg={m} />
          ))}
        </div>
      )}
    </AdminMayaLayout>
  );
}
