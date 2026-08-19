import { useQuery } from '@tanstack/react-query';
// Firebase-audit 2026-08-19 SEV-2 #4: prefer shared `auth` (see
// client/src/lib/firebase.ts:143 initializeAuth). Raw getAuth() risks a
// second Auth instance without persistence/resolver on lazy-loaded pages.
import { auth } from '@/lib/firebase';
import { getApiUrl } from '@/lib/apiConfig';
import { ShieldAlert, RefreshCw, Loader2, Inbox } from 'lucide-react';

/** One flagged chat message from GET /api/admin/chat-risk/flagged. */
interface FlaggedMessage {
  messageId: string;
  conversationId: string;
  senderRole: string;
  senderUid: string;
  flaggedReason: string | null;
  content: string;
  createdAt: string | null;
  bookingId: string | null;
  platform: string | null;
}

// Higher-severity reasons render red; the rest gold.
const RED_REASONS = new Set([
  'OFF_PLATFORM_PAYMENT', 'PET_DANGER', 'MEDICAL_URGENT', 'LOST_PET', 'ABUSE_THREAT',
]);

async function bearer(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  return u.getIdToken();
}

export default function AdminChatRisk() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{ ok: boolean; count: number; flagged: FlaggedMessage[] }>({
    queryKey: ['/api/admin/chat-risk/flagged'],
    queryFn: async () => {
      const token = await bearer();
      const res = await fetch(getApiUrl('/api/admin/chat-risk/flagged'), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: 60000,
  });

  const rows = data?.flagged ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-[#D4AF37]" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Flagged chat messages</h1>
              <p className="text-sm text-muted-foreground">Advisory risk flags — review and decide. Nothing is auto-actioned.</p>
            </div>
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {(error as any)?.message || 'Failed to load flagged messages.'}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-slate-700">No flagged messages</p>
            <p className="text-sm">Risky chats (off-platform payment, urgent safety, etc.) will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{data?.count} flagged · newest first</p>
            {rows.map((m) => {
              const reasons = (m.flaggedReason || '').split(',').map((r) => r.trim()).filter(Boolean);
              return (
                <div key={m.messageId} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {reasons.length ? reasons.map((r) => (
                        <span key={r} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={RED_REASONS.has(r)
                            ? { background: '#FBEAEA', color: '#b42318' }
                            : { background: '#FBF3DC', color: '#8a6a12' }}>
                          {r.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EEF1F4', color: '#475569' }}>flagged</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString('he-IL') : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 break-words">{m.content}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="capitalize">from: {m.senderRole}</span>
                    {m.platform && <span>· {m.platform.replace(/_/g, ' ')}</span>}
                    {m.bookingId && (
                      <a href={`/admin/booking-chat/${m.bookingId}`} className="underline hover:text-slate-800">
                        open chat · #{m.bookingId.slice(-6)}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
