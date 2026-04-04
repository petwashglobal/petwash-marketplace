import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, RefreshCw, MessageSquare, FileText, Inbox, Activity, Shield } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

// ─── Auth header helper ───────────────────────────────────────────────────────
function useAdminHeaders() {
  const { user } = useFirebaseAuth();
  const [token, setToken] = useState<string | null>(null);
  if (user && !token) {
    user.getIdToken().then(setToken);
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithAuth(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'OK') return <Badge className="bg-green-100 text-green-800 border-green-200">OK</Badge>;
  if (status === 'WATCH') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">WATCH</Badge>;
  if (status === 'ALERT') return <Badge className="bg-red-100 text-red-800 border-red-200">ALERT</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ─── Section: Health Dashboard ────────────────────────────────────────────────
function HealthSection({ headers }: { headers: Record<string, string> }) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/admin/notifications/health'],
    queryFn: () => fetchWithAuth('/api/admin/notifications/health', headers),
    refetchInterval: 60_000,
    enabled: Object.keys(headers).length > 0,
  });

  const dl = data?.watchItems?.deadLetterTrend;
  const sms = data?.watchItems?.smsSegmentRisk;
  const rej = data?.watchItems?.providerRejectionDocumentsLast24h;
  const byEvent = data?.watchItems?.last24hByEventType ?? [];

  return (
    <Card className="border border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Production Health — 4 Watch Items
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="text-slate-400 text-sm text-center py-4">Loading health metrics…</div>
        ) : (
          <>
            {/* Dead-letter trend */}
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dead-Letter Trend</span>
                {dl && <StatusBadge status={dl.status} />}
              </div>
              {dl && (
                <div className="flex gap-6 text-sm">
                  <div><span className="text-slate-500">Today</span> <span className="font-bold text-slate-900">{dl.today}</span></div>
                  <div><span className="text-slate-500">Yesterday</span> <span className="font-bold text-slate-900">{dl.yesterday}</span></div>
                  <div><span className="text-slate-500">Delta</span> <span className={`font-bold ${dl.delta > 0 ? 'text-red-600' : 'text-green-600'}`}>{dl.delta > 0 ? `+${dl.delta}` : dl.delta}</span></div>
                </div>
              )}
            </div>

            {/* SMS segment risk */}
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">SMS Segment Risk</span>
                {sms && <StatusBadge status={sms.status} />}
              </div>
              {sms && (
                <>
                  <p className="text-xs text-slate-500 mb-3">{sms.note}</p>
                  {sms.sampleSize === 0 ? (
                    <p className="text-xs text-slate-400">No SMS events in the last 24 h.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {sms.samples.map((s: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{s.eventType}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-800">{s.charCount} chars</span>
                            <span className="text-slate-400">→</span>
                            <span className={`font-semibold ${s.risk === 'HIGH' ? 'text-red-600' : 'text-green-600'}`}>
                              {s.unicodeSegments !== null ? `${s.unicodeSegments} seg` : '?'}
                            </span>
                            {s.risk === 'HIGH' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Provider rejection docs */}
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">PW-REJ Documents (24 h)</span>
                {rej && <span className="text-sm font-bold text-slate-900">{rej.count}</span>}
              </div>
              <p className="text-xs text-slate-500">{rej?.note}</p>
            </div>

            {/* Last 24h by event type */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Last 24 h by Event Type</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="pb-1.5 font-medium text-slate-500">Event</th>
                      <th className="pb-1.5 font-medium text-slate-500 text-right">Total</th>
                      <th className="pb-1.5 font-medium text-slate-500 text-right">Sent</th>
                      <th className="pb-1.5 font-medium text-slate-500 text-right">Dead-letters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byEvent.length === 0 && (
                      <tr><td colSpan={4} className="text-slate-400 py-3 text-center">No events in last 24 h</td></tr>
                    )}
                    {byEvent.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-white">
                        <td className="py-1.5 font-mono">{row.event_type}</td>
                        <td className="py-1.5 text-right">{row.total_sent_last_24h}</td>
                        <td className="py-1.5 text-right text-green-700">{row.sent}</td>
                        <td className="py-1.5 text-right text-red-600">{row.dead_letters}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Dead-Letter Queue ───────────────────────────────────────────────
function DeadLetterSection({ headers }: { headers: Record<string, string> }) {
  const [eventType, setEventType] = useState('');
  const [channel, setChannel] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/notifications/dead-letter', eventType, channel],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (eventType) params.set('eventType', eventType);
      if (channel) params.set('channel', channel);
      return fetchWithAuth(`/api/admin/notifications/dead-letter?${params}`, headers);
    },
    enabled: Object.keys(headers).length > 0,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="border border-red-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-red-500" />
          Dead-Letter Queue
          {total > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 ml-1">{total} total</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Select onValueChange={v => setEventType(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="All event types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {['booking_cancelled','refund_issued','egift_redeemed','points_redeemed',
                'provider_rejected','membership_renewed','membership_cancelled',
                'booking_confirmed','egift_purchased','prestige_joined','payout_issued'].map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={v => setChannel(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-slate-400 text-sm text-center py-6">Loading dead-letter queue…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <p className="text-sm">Dead-letter queue is empty</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {rows.map((row: any) => (
              <div key={row.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs border-slate-300">{row.channel}</Badge>
                    <Badge className="text-xs bg-red-100 text-red-700 border-red-200">{row.eventType ?? 'unknown'}</Badge>
                    {row.retryCount != null && (
                      <Badge variant="outline" className="text-xs">{row.retryCount}/{row.maxRetries} retries</Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '—'}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-500">User ID:</span> <span className="font-mono text-slate-800">{row.recipientUserId ?? '—'}</span></div>
                  {row.bookingId && <div><span className="text-slate-500">Booking:</span> <span className="font-mono">{row.bookingId}</span></div>}
                  {row.failureReason && (
                    <div className="mt-1 text-red-700 bg-red-100 rounded px-2 py-1 font-mono">
                      {row.failureReason}
                    </div>
                  )}
                  {row.parsedPayload?.smsText && (
                    <div className="mt-1">
                      <span className="text-slate-500">SMS text ({row.parsedPayload.smsText.length} chars):</span>
                      <div className="font-mono text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 mt-0.5 text-right" dir="rtl">
                        {row.parsedPayload.smsText}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Documents by Prefix ────────────────────────────────────────────
const PREFIXES = ['PW-RCP','PW-ERN','PW-EGF','PW-EGR','PW-LRR','PW-MBR','PW-PAY','PW-RFD','PW-CAN','PW-REJ'] as const;
const PREFIX_LABELS: Record<string, string> = {
  'PW-RCP': 'Booking Receipt',
  'PW-ERN': 'Provider Earnings',
  'PW-EGF': 'eGift Purchase',
  'PW-EGR': 'eGift Redemption',
  'PW-LRR': 'Loyalty Redemption',
  'PW-MBR': 'Membership',
  'PW-PAY': 'Provider Payout',
  'PW-RFD': 'Refund',
  'PW-CAN': 'Cancellation',
  'PW-REJ': 'Provider Rejection',
};

function DocumentsByPrefixSection({ headers }: { headers: Record<string, string> }) {
  const [selectedPrefix, setSelectedPrefix] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/financial-documents/by-prefix', selectedPrefix],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '30' });
      if (selectedPrefix) params.set('prefix', selectedPrefix);
      return fetchWithAuth(`/api/admin/financial-documents/by-prefix?${params}`, headers);
    },
    enabled: Object.keys(headers).length > 0,
  });

  const summary: any[] = data?.summary ?? [];
  const recentDocs: any[] = data?.recentDocs ?? [];

  // Build a map of prefix → count from summary
  const prefixCounts: Record<string, number> = {};
  for (const row of summary) {
    const key = (row.prefix || '').trim().toUpperCase();
    prefixCounts[key] = (prefixCounts[key] || 0) + parseInt(String(row.total || 0));
  }

  return (
    <Card className="border border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          Financial Documents by Prefix
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prefix grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PREFIXES.map(pfx => {
            const count = prefixCounts[pfx] ?? 0;
            const isSelected = selectedPrefix === pfx;
            return (
              <button
                key={pfx}
                onClick={() => setSelectedPrefix(isSelected ? '' : pfx)}
                className={`rounded-lg border p-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-white'
                }`}
              >
                <div className="font-mono text-xs font-bold text-slate-800">{pfx}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-tight">{PREFIX_LABELS[pfx]}</div>
                <div className={`text-sm font-bold mt-1.5 ${count > 0 ? 'text-indigo-700' : 'text-slate-300'}`}>
                  {isLoading ? '…' : count.toLocaleString()}
                </div>
              </button>
            );
          })}
        </div>

        {/* Recent documents table */}
        {selectedPrefix && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-600">Recent {selectedPrefix} documents</span>
              <Badge variant="outline" className="text-xs">{data?.total ?? 0} total</Badge>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 text-left bg-white sticky top-0">
                    <th className="pb-2 pr-3 font-medium text-slate-500">Reference</th>
                    <th className="pb-2 pr-3 font-medium text-slate-500">User</th>
                    <th className="pb-2 pr-3 font-medium text-slate-500">Booking</th>
                    <th className="pb-2 font-medium text-slate-500">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.length === 0 && (
                    <tr><td colSpan={4} className="text-slate-400 py-4 text-center">No documents found</td></tr>
                  )}
                  {recentDocs.map((doc: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-white">
                      <td className="py-1.5 pr-3 font-mono font-semibold text-indigo-700">{doc.document_reference}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-600 max-w-[120px] truncate">{doc.user_id ?? '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-600">{doc.booking_id ?? '—'}</td>
                      <td className="py-1.5 text-slate-500 whitespace-nowrap">
                        {doc.issued_at ? new Date(doc.issued_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!selectedPrefix && !isLoading && summary.length > 0 && (
          <p className="text-xs text-slate-400 text-center pt-1">Click a prefix above to see recent documents</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Frozen Event Matrix ─────────────────────────────────────────────
function EventMatrixSection({ headers }: { headers: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/event-matrix'],
    queryFn: () => fetchWithAuth('/api/admin/event-matrix', headers),
    staleTime: Infinity,
    enabled: Object.keys(headers).length > 0,
  });

  return (
    <Card className="border border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500" />
          Frozen Event Matrix
          {data && (
            <Badge variant="outline" className="text-xs ml-1">
              {data.totalEvents} events · {data.totalDocumentTypes} doc types · locked {new Date(data.lockedAt).toLocaleDateString('he-IL')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-slate-400 text-sm text-center py-4">Loading event matrix…</div>
        ) : !data ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-700 min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 pr-3 font-medium text-slate-500">Event</th>
                  <th className="pb-2 pr-3 font-medium text-slate-500">Document</th>
                  <th className="pb-2 pr-3 font-medium text-slate-500">Prefix</th>
                  <th className="pb-2 pr-3 font-medium text-slate-500">Channels</th>
                  <th className="pb-2 font-medium text-slate-500">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-white">
                    <td className="py-1.5 pr-3 font-mono font-semibold text-slate-800">{e.event}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{e.documentType}</td>
                    <td className="py-1.5 pr-3 font-mono font-bold text-indigo-700">{e.documentPrefix}</td>
                    <td className="py-1.5 pr-3">
                      <div className="flex gap-1">
                        {e.channels.map((ch: string) => (
                          <Badge key={ch} variant="outline" className="text-xs py-0">{ch}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 text-slate-400 italic">{e.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminOpsMonitor() {
  const headers = useAdminHeaders();

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Ops Monitor</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Production observability — transactional comms baseline
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>PetWash™ Operations</span>
          </div>
        </div>

        {/* 1. Health watch items */}
        <HealthSection headers={headers} />

        {/* 2. Dead-letter queue */}
        <DeadLetterSection headers={headers} />

        {/* 3. Documents by prefix */}
        <DocumentsByPrefixSection headers={headers} />

        {/* 4. Frozen event matrix */}
        <EventMatrixSection headers={headers} />
      </div>
    </div>
  );
}
