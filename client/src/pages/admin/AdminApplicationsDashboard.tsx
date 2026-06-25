/**
 * Smart Admin Panel — unified Applications Dashboard (spec §1, §24).
 *
 * One screen aggregating BOTH provider onboarding and senior/disability discount
 * applications into summary cards + a single risk-scored, priority-sorted review
 * queue. Read-only triage view; the per-application approve/reject actions live
 * in the existing Provider Control + Member-Discount admin panels (linked here).
 *
 * Data: GET /api/admin/applications/dashboard (risk engine scored, no ID numbers).
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { RefreshCw, AlertTriangle, ShieldAlert, Clock, Users, Copy } from 'lucide-react';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Flag { code: string; severity: string; message: string }
interface QueueItem {
  appKind: 'provider' | 'discount';
  id: number;
  applicationId: string | null;
  userId: string;
  name: string;
  type: string;
  status: string;
  riskScore: RiskLevel;
  flags: Flag[];
  submittedAt: string | null;
  daysPending: number;
}
interface DashboardResponse {
  ok: boolean;
  cards: Record<string, number>;
  queue: QueueItem[];
  generatedAt: string;
}

const RISK_STYLE: Record<RiskLevel, { bg: string; color: string; label: string }> = {
  critical: { bg: '#fee2e2', color: '#991b1b', label: 'Critical' },
  high: { bg: '#fef3c7', color: '#b45309', label: 'High' },
  medium: { bg: '#e0f2fe', color: '#075985', label: 'Medium' },
  low: { bg: '#f3f4f6', color: '#374151', label: 'Low' },
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', pending_review: 'Pending review',
  under_review: 'Under review', needs_more_info: 'Needs more info',
};

const CARD_DEFS: { key: string; label: string; Icon: any; tone: string }[] = [
  { key: 'pendingApplications', label: 'Pending', Icon: Clock, tone: '#111827' },
  { key: 'providerPending', label: 'Provider', Icon: Users, tone: '#075985' },
  { key: 'discountPending', label: 'Discount', Icon: Users, tone: '#075985' },
  { key: 'critical', label: 'Critical', Icon: ShieldAlert, tone: '#991b1b' },
  { key: 'highRisk', label: 'High risk', Icon: AlertTriangle, tone: '#b45309' },
  { key: 'overdue', label: 'Overdue', Icon: Clock, tone: '#b45309' },
  { key: 'needsMoreInfo', label: 'Needs info', Icon: AlertTriangle, tone: '#b45309' },
  { key: 'duplicateContact', label: 'Dup. contact', Icon: Copy, tone: '#991b1b' },
];

export default function AdminApplicationsDashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DashboardResponse>({
    queryKey: ['/api/admin/applications/dashboard'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/applications/dashboard');
      return res.json();
    },
  });

  const cards = data?.cards ?? {};
  const queue = data?.queue ?? [];

  return (
    <div className="min-h-screen bg-white p-5 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500">Provider onboarding + senior/disability discount — risk-scored queue.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-gray-300"
          data-testid="refresh-applications"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-7">
        {CARD_DEFS.map(({ key, label, Icon, tone }) => (
          <div key={key} className="rounded-xl border border-gray-200 p-3 text-center">
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: tone }} />
            <p className="text-xl font-bold" style={{ color: tone }}>{isLoading ? '—' : (cards[key] ?? 0)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
          Could not load applications. <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {/* Priority queue */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
          Review queue · highest risk / longest waiting first
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No pending applications 🎉</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {queue.map((q) => {
              const rs = RISK_STYLE[q.riskScore];
              // Provider rows deep-link to the Provider Control panel. Discount
              // review has API (#1054) but no dedicated page yet → informational.
              const target = q.appKind === 'provider' ? '/admin/providers' : null;
              return (
                <button
                  key={`${q.appKind}-${q.id}`}
                  onClick={() => target && setLocation(target)}
                  disabled={!target}
                  data-testid={`app-row-${q.appKind}-${q.id}`}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${target ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                    style={{ background: rs.bg, color: rs.color }}
                  >
                    {rs.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{q.name}</p>
                      <span className="text-[11px] text-gray-400">{q.applicationId || `#${q.id}`}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {q.type} · {STATUS_LABEL[q.status] || q.status}
                      {q.daysPending > 0 ? ` · ${q.daysPending}d pending` : ''}
                    </p>
                    {q.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {q.flags.map((f) => (
                          <span
                            key={f.code}
                            title={f.message}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: RISK_STYLE[(f.severity as RiskLevel)] ? RISK_STYLE[f.severity as RiskLevel].bg : '#f3f4f6', color: RISK_STYLE[(f.severity as RiskLevel)] ? RISK_STYLE[f.severity as RiskLevel].color : '#374151' }}
                          >
                            {f.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-4">
        Advisory risk scoring — every approval is still a manual admin action (audited). IDs/passports are never shown here.
        {data?.generatedAt ? ` · Updated ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}
      </p>
    </div>
  );
}
