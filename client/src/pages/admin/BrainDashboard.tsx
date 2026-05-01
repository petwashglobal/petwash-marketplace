/**
 * /admin/brain — CEO Operations Brain (read-only, PR-1).
 *
 * RULES (from CEO directive):
 *   - Read-only. No mutations on this page.
 *   - No fake data. If a panel returns { wired: false }, show "Not wired yet".
 *   - Existing data only. No new schema, no new aggregation endpoints.
 *
 * Single fetch:
 *   GET /api/admin/brain/summary
 *
 * Six panels: stations · revenue · approvals · alerts · activity · agreements
 *
 * Auth gate is server-side (requireBrainAccess). The page itself is wrapped
 * in <AdminRouteGuard> in App.tsx — that's the client-side Firebase auth
 * gate. Together: only authenticated super-admins (or future ceo/cfo/ops_lead
 * roles) reach the data.
 */
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import {
  Activity, AlertTriangle, Banknote, FileSignature, MapPin,
  Server, ShieldCheck, Users, Loader2, RefreshCw,
} from 'lucide-react';

// ─── Types (mirror server/routes/admin-brain.ts response) ─────────────────────
type Wired<T> = ({ wired: true } & T) | { wired: false; reason: string };

interface StationsPanel {
  total: number;
  online: number;
  offline: number;
  stations: Array<{
    id: number;
    stationCode: string;
    stationName: string;
    serialNumber: string;
    address: string;
    city: string;
    operationalStatus: string;
    healthStatus: string | null;
    lastHeartbeat: string | null;
    minutesSinceHeartbeat: number | null;
    heartbeatStale: boolean;
    totalWashes: number | null;
    nayaxTerminalId: string | null;
  }>;
}

interface RevenuePanel {
  totals: {
    grossCents24h: string | number | null;
    netCents24h: string | number | null;
    grossCents7d: string | number | null;
    netCents7d: string | number | null;
    grossCents30d: string | number | null;
    netCents30d: string | number | null;
    txCount24h: string | number | null;
    txCount7d: string | number | null;
  };
  byVertical: Array<{
    vertical: string;
    grossCents: string | number | null;
    netCents: string | number | null;
    txCount: string | number | null;
  }>;
}

interface ApprovalsPanel {
  total: number;
  applications: Array<{
    applicationId: string;
    firstName: string;
    lastName: string;
    email: string;
    providerType: string;
    city: string;
    biometricStatus: string | null;
    backgroundCheckStatus: string | null;
    criminalCheckStatus: string | null;
    selfDeclarationAt: string | null;
    requiresEnhancedVerification: boolean;
    createdAt: string;
  }>;
}

interface AlertsPanel {
  total: number;
  alerts: Array<{
    id: number;
    stationId: number;
    alertType: string;
    severity: 'info' | 'warning' | 'critical';
    status: string;
    title: string;
    message: string;
    triggeredAt: string;
  }>;
}

interface ActivityPanel {
  sources: { payments: number; applications: number };
  events: Array<{
    kind: 'payment' | 'application';
    id: string;
    label: string;
    amountCents: number | null;
    at: string;
  }>;
}

interface AgreementsPanel {
  documents: Array<{
    id: number;
    documentType: string;
    documentTitle: string;
    signedBy: string;
    signedAt: string;
    documentHash: string;
    previousDocumentHash: string | null;
    status: string;
  }>;
  providerDeclarations: Array<{
    applicationId: string;
    userId: string;
    signedAt: string;
    ip: string | null;
  }>;
  notes: string[];
}

interface BrainSummary {
  generatedAt: string;
  gaps: string[];
  stations: Wired<StationsPanel>;
  revenue: Wired<RevenuePanel>;
  approvals: Wired<ApprovalsPanel>;
  alerts: Wired<AlertsPanel>;
  activity: Wired<ActivityPanel>;
  agreements: Wired<AgreementsPanel>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ils = (cents: string | number | null | undefined): string => {
  if (cents === null || cents === undefined) return '—';
  const n = typeof cents === 'string' ? parseInt(cents, 10) : cents;
  if (!Number.isFinite(n)) return '—';
  return `₪${(n / 100).toLocaleString('en-IL', { maximumFractionDigits: 0 })}`;
};

const ago = (iso: string | null): string => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

const sev = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'warning':  return 'bg-amber-100 text-amber-700 border-amber-200';
    default:         return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// ─── Reusable shells ──────────────────────────────────────────────────────────
function PanelShell({
  title, icon: Icon, children, right,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function NotWiredYet({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-6 text-center">
      <p className="text-sm font-semibold text-amber-700">Not wired yet</p>
      <p className="text-xs text-amber-600 mt-1 break-words">{reason}</p>
      <p className="text-[10px] text-gray-500 mt-3 uppercase tracking-wider">
        will be addressed in PR-2
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BrainDashboard() {
  const { user } = useFirebaseAuth();

  const { data, isLoading, error, refetch, isFetching } = useQuery<BrainSummary>({
    queryKey: ['/api/admin/brain/summary'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/admin/brain/summary'), {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body.slice(0, 200)}`);
      }
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500 text-sm">Sign in required.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-red-500 mb-3" />
            <p className="text-sm font-semibold text-gray-900">
              Unable to load Operations Brain
            </p>
            <p className="text-xs text-gray-500 mt-1 break-words">
              {(error as Error).message}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!data) return null;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                Operations Brain
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Read-only · last refreshed {ago(data.generatedAt)}
                {data.gaps.length > 0 && (
                  <span className="ml-2 text-amber-600">
                    · {data.gaps.length} panel{data.gaps.length === 1 ? '' : 's'} not wired
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border border-gray-200 hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Top strip — Revenue */}
          <PanelShell title="Revenue" icon={Banknote}>
            {data.revenue.wired ? (
              <RevenueGrid panel={data.revenue} />
            ) : (
              <NotWiredYet reason={data.revenue.reason} />
            )}
          </PanelShell>

          {/* Stations */}
          <PanelShell
            title="Stations (K9000)"
            icon={Server}
            right={
              data.stations.wired ? (
                <span className="text-xs text-gray-500">
                  <span className="text-emerald-600 font-semibold">{data.stations.online}</span> online ·{' '}
                  <span className="text-red-600 font-semibold">{data.stations.offline}</span> offline ·{' '}
                  total {data.stations.total}
                </span>
              ) : null
            }
          >
            {data.stations.wired ? (
              <StationsGrid panel={data.stations} />
            ) : (
              <NotWiredYet reason={data.stations.reason} />
            )}
          </PanelShell>

          {/* Two-column row: Alerts + Approvals */}
          <div className="grid lg:grid-cols-2 gap-6">
            <PanelShell title="Open Alerts" icon={AlertTriangle}>
              {data.alerts.wired ? (
                <AlertsList panel={data.alerts} />
              ) : (
                <NotWiredYet reason={data.alerts.reason} />
              )}
            </PanelShell>

            <PanelShell title="Provider Approvals Queue" icon={Users}>
              {data.approvals.wired ? (
                <ApprovalsList panel={data.approvals} />
              ) : (
                <NotWiredYet reason={data.approvals.reason} />
              )}
            </PanelShell>
          </div>

          {/* Activity feed */}
          <PanelShell title="Live Activity (last 24h)" icon={Activity}>
            {data.activity.wired ? (
              <ActivityList panel={data.activity} />
            ) : (
              <NotWiredYet reason={data.activity.reason} />
            )}
          </PanelShell>

          {/* Agreements */}
          <PanelShell title="Signed Agreements" icon={FileSignature}>
            {data.agreements.wired ? (
              <AgreementsList panel={data.agreements} />
            ) : (
              <NotWiredYet reason={data.agreements.reason} />
            )}
          </PanelShell>

          <p className="text-[10px] text-gray-400 text-center pt-4">
            Generated {data.generatedAt}. PR-1: read-only wire-up. PR-2: gap fixes (revenue-by-station, agreements audit, alerts feed, hash-chain verification).
          </p>
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────
function RevenueGrid({ panel }: { panel: RevenuePanel }) {
  const cells = [
    { label: 'Today', gross: panel.totals.grossCents24h, net: panel.totals.netCents24h, count: panel.totals.txCount24h },
    { label: 'Last 7 days', gross: panel.totals.grossCents7d, net: panel.totals.netCents7d, count: panel.totals.txCount7d },
    { label: 'Last 30 days', gross: panel.totals.grossCents30d, net: panel.totals.netCents30d, count: null },
  ];
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cells.map(c => (
          <div key={c.label} className="rounded-xl border border-gray-100 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{c.label}</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{ils(c.gross)}</div>
            <div className="text-xs text-gray-500 mt-1">
              net {ils(c.net)}
              {c.count != null && ` · ${c.count} transactions`}
            </div>
          </div>
        ))}
      </div>
      {panel.byVertical.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">By vertical (30d)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {panel.byVertical.map(v => (
              <div key={v.vertical} className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="text-xs font-medium text-gray-700">{v.vertical}</div>
                <div className="text-sm font-semibold text-gray-900">{ils(v.grossCents)}</div>
                <div className="text-[10px] text-gray-400">{v.txCount ?? '—'} tx</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function StationsGrid({ panel }: { panel: StationsPanel }) {
  if (panel.stations.length === 0) {
    return <p className="text-sm text-gray-500 italic">No stations registered yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
          <tr>
            <th className="text-start py-2 font-medium">Station</th>
            <th className="text-start py-2 font-medium">Serial</th>
            <th className="text-start py-2 font-medium">Location</th>
            <th className="text-start py-2 font-medium">Status</th>
            <th className="text-end py-2 font-medium">Last Heartbeat</th>
            <th className="text-end py-2 font-medium">Total Washes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {panel.stations.map(s => (
            <tr key={s.id}>
              <td className="py-2">
                <div className="font-medium text-gray-900">{s.stationName}</div>
                <div className="text-[10px] text-gray-400">{s.stationCode}</div>
              </td>
              <td className="py-2 font-mono text-xs text-gray-600">{s.serialNumber || '—'}</td>
              <td className="py-2 text-xs text-gray-600">
                <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{s.city || '—'}</div>
                <div className="text-[10px] text-gray-400">{s.address || ''}</div>
              </td>
              <td className="py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    s.heartbeatStale
                      ? 'bg-red-100 text-red-700 border-red-200'
                      : s.operationalStatus === 'active'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {s.heartbeatStale ? 'stale heartbeat' : s.operationalStatus}
                </span>
              </td>
              <td className="py-2 text-end text-xs text-gray-500">
                {s.lastHeartbeat ? ago(s.lastHeartbeat) : '—'}
              </td>
              <td className="py-2 text-end text-xs font-semibold text-gray-900">
                {s.totalWashes?.toLocaleString() ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertsList({ panel }: { panel: AlertsPanel }) {
  if (panel.alerts.length === 0) {
    return <p className="text-sm text-gray-500 italic">No open alerts.</p>;
  }
  return (
    <ul className="space-y-2">
      {panel.alerts.map(a => (
        <li key={a.id} className={`rounded-lg border px-3 py-2 ${sev(a.severity)}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-xs">{a.title}</div>
            <span className="text-[10px] uppercase tracking-wider opacity-70">{a.alertType}</span>
          </div>
          <div className="text-xs mt-1 opacity-80">{a.message}</div>
          <div className="text-[10px] mt-1 opacity-60">station #{a.stationId} · {ago(a.triggeredAt)}</div>
        </li>
      ))}
    </ul>
  );
}

function ApprovalsList({ panel }: { panel: ApprovalsPanel }) {
  if (panel.applications.length === 0) {
    return <p className="text-sm text-gray-500 italic">Queue empty — nothing waiting.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {panel.applications.map(app => (
        <li key={app.applicationId} className="py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {app.firstName} {app.lastName}
              </div>
              <div className="text-[10px] text-gray-500">
                {app.providerType} · {app.city} · applied {ago(app.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {app.requiresEnhancedVerification && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-200">
                  ENHANCED
                </span>
              )}
              {app.selfDeclarationAt && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] border border-emerald-100">
                  declared
                </span>
              )}
              {app.biometricStatus === 'verified' && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] border border-blue-100">
                  biometric
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ panel }: { panel: ActivityPanel }) {
  if (panel.events.length === 0) {
    return <p className="text-sm text-gray-500 italic">No activity in the last 24h.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
      {panel.events.map(e => (
        <li key={`${e.kind}-${e.id}`} className="py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
              e.kind === 'payment'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-blue-50 text-blue-700 border border-blue-100'
            }`}>
              {e.kind}
            </span>
            <div className="text-xs text-gray-700 truncate">{e.label}</div>
          </div>
          <div className="text-[10px] text-gray-400 shrink-0">
            {e.amountCents != null && <span className="text-gray-700 font-semibold mr-2">{ils(e.amountCents)}</span>}
            {ago(e.at)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgreementsList({ panel }: { panel: AgreementsPanel }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Signed documents</div>
        {panel.documents.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No signed documents yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {panel.documents.slice(0, 10).map(d => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{d.documentTitle}</div>
                  <div className="text-[10px] text-gray-500">
                    {d.documentType} · signed by {d.signedBy} · {ago(d.signedAt)}
                  </div>
                </div>
                <div className="text-[9px] font-mono text-gray-400 shrink-0" title={d.documentHash}>
                  {d.documentHash?.slice(0, 8) ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">
          Provider self-declarations <span className="text-gray-300">(IP captured)</span>
        </div>
        {panel.providerDeclarations.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No declarations yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {panel.providerDeclarations.slice(0, 10).map(d => (
              <li key={d.applicationId} className="py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-700 font-mono">{d.applicationId}</span>
                <span className="text-gray-500">{d.ip ?? 'no ip recorded'} · {ago(d.signedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {panel.notes.length > 0 && (
        <ul className="text-[10px] text-gray-500 list-disc ps-4 space-y-0.5">
          {panel.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
