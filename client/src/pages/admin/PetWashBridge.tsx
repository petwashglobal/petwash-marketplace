/**
 * PetWash Bridge — read-only admin/operator cockpit (MVP).
 *
 * The internal control panel over the PetWash operating system for Nir and
 * (later) the office manager. READ-ONLY: it surfaces queues and feeds, links
 * out to the underlying records, and performs no mutations.
 *
 * Mobile-first (iPhone Safari): single-column, 100dvh, safe-area aware.
 * Route is gated by VITE_BRIDGE_MVP_ENABLED and wrapped in AdminRouteGuard
 * (see App.tsx). Data comes from GET /api/admin/bridge/summary.
 */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import {
  ClipboardList, CalendarClock, Users, ListTodo, Bell, ScrollText,
  Loader2, RefreshCw, ChevronRight, PlugZap, Search,
} from 'lucide-react';

type Wired<T> = ({ wired: true } & T) | { wired: false; reason: string };

interface ProviderApplicationsPanel {
  stats: { total: number; pending: number; underReview: number; approved: number; rejected: number; onHold: number };
  recent: Array<{
    id: number;
    providerId: string;
    platform: string;
    status: string;
    priority: string;
    createdAt: string | null;
  }>;
  reviewPath: string;
}

interface BookingIntakePanel {
  recent: Array<{
    id: string;
    bookingNumber: string;
    userId: string;
    providerId: string | null;
    status: string;
    paymentStatus: string | null;
    total: string;
    currency: string | null;
    startTime: string | null;
    createdAt: string | null;
  }>;
  tracePathPrefix: string;
}

interface BridgeSummary {
  generatedAt: string;
  readOnly: boolean;
  providerApplications: Wired<ProviderApplicationsPanel>;
  bookingIntake: Wired<BookingIntakePanel>;
  hubspotTasks: Wired<never>;
  alerts: Wired<never>;
  auditEvents: Wired<never>;
}

interface LookupResult {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  loyaltyTier: string | null;
  createdAt: string | null;
}

interface LookupResponse {
  query: string;
  count: number;
  results: LookupResult[];
}

function PanelShell({
  icon, title, subtitle, children,
}: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 text-gray-900">{icon}</span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function NotConnected({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
      <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div>
        <p className="text-sm font-medium text-gray-700">Not connected yet</p>
        <p className="mt-0.5 text-sm text-gray-500">{reason}</p>
      </div>
    </div>
  );
}

interface SignupActivityEvent {
  id: number;
  actionType: string;
  createdAt: string | null;
  actorUserId: string | null;
  ip: string | null;
  severity: string | null;
  metadata: Record<string, any> | null;
}

interface SignupActivityResponse {
  since: string;
  hours: number;
  count: number;
  summary: { otpSent: number; verified: number; sessionsCreated: number; failed: number; newSignups: number };
  events: SignupActivityEvent[];
}

const SIGNUP_ACTION_LABEL: Record<string, string> = {
  SIGNUP_OTP_SENT: 'OTP sent',
  SIGNUP_AUTH_VERIFIED: 'Verified',
  SIGNUP_SESSION_CREATED: 'Session created',
  SIGNUP_FAILED: 'Failed',
};
const SIGNUP_ACTION_TONE: Record<string, string> = {
  SIGNUP_OTP_SENT: 'bg-sky-100 text-sky-700',
  SIGNUP_AUTH_VERIFIED: 'bg-emerald-100 text-emerald-700',
  SIGNUP_SESSION_CREATED: 'bg-violet-100 text-violet-700',
  SIGNUP_FAILED: 'bg-rose-100 text-rose-700',
};

// Signup/login funnel from audit_events (read-only). Loads independently of the
// summary query so a summary failure doesn't hide it.
function SignupActivityPanel({ enabled }: { enabled: boolean }) {
  const { data, isLoading, error } = useQuery<SignupActivityResponse>({
    queryKey: ['/api/admin/bridge/signup-activity'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/admin/bridge/signup-activity?hours=24'), { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res.json();
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <PanelShell icon={<ScrollText className="h-5 w-5" />} title="Signup activity" subtitle="Last 24h · sign-in / sign-up funnel">
      {isLoading && (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      )}
      {error && !isLoading && <p className="text-sm text-rose-600">{(error as Error).message}</p>}
      {data && !isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {([
              ['New signups', data.summary.newSignups],
              ['Verified', data.summary.verified],
              ['OTP sent', data.summary.otpSent],
              ['Failed', data.summary.failed],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          {data.events.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {data.events.slice(0, 25).map((ev) => {
                const m = ev.metadata || {};
                return (
                  <li key={ev.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {[m.method, m.flow].filter(Boolean).join(' · ') || '—'}
                        {m.phone ? ` · ${m.phone}` : ''}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                        {m.reason ? ` · ${m.reason}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${SIGNUP_ACTION_TONE[ev.actionType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {SIGNUP_ACTION_LABEL[ev.actionType] ?? ev.actionType}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No signup activity in the last 24 hours.</p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

const PLACEHOLDER_PANELS: Array<{ key: keyof BridgeSummary; icon: ReactNode; title: string; subtitle: string }> = [
  { key: 'hubspotTasks', icon: <ListTodo className="h-5 w-5" />, title: 'HubSpot tasks', subtitle: 'Tasks created by signup / booking / provider flows' },
  { key: 'alerts', icon: <Bell className="h-5 w-5" />, title: 'Alerts', subtitle: 'Operational alerts feed' },
  { key: 'auditEvents', icon: <ScrollText className="h-5 w-5" />, title: 'Audit events', subtitle: 'Recent system audit trail' },
];

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  under_review: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  on_hold: 'bg-gray-100 text-gray-600',
};

function CustomerLookupPanel() {
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LookupResponse | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (q.length < 2) { setError('Enter at least 2 characters.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/admin/bridge/lookup?q=${encodeURIComponent(q)}`), { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          inputMode="search"
          placeholder="Email, phone, or name"
          className="min-h-11 flex-1 rounded-xl border border-gray-200 px-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {data && (
        data.results.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {data.results.map((u) => (
              <li key={u.id} className="py-2.5">
                <p className="text-sm font-medium text-gray-900">
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || '(no name)'}
                  {u.loyaltyTier && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{u.loyaltyTier}</span>}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {[u.email, u.phone, u.city].filter(Boolean).join(' · ') || u.id}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No matches for “{data.query}”.</p>
        )
      )}
    </div>
  );
}

export default function PetWashBridge() {
  const { user } = useFirebaseAuth();

  const { data, isLoading, error, refetch, isFetching } = useQuery<BridgeSummary>({
    queryKey: ['/api/admin/bridge/summary'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/admin/bridge/summary'), { credentials: 'include' });
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
        <div className="flex min-h-[60dvh] items-center justify-center">
          <p className="text-sm text-gray-500">Sign in required.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="mx-auto w-full max-w-3xl px-4 py-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">PetWash Bridge</h1>
            <p className="text-sm text-gray-500">Read-only operator cockpit</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {isLoading && (
          <div className="flex min-h-[40dvh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <p className="text-sm font-medium text-rose-700">Could not load the cockpit.</p>
            <p className="mt-1 text-sm text-rose-600">{(error as Error).message}</p>
          </div>
        )}

        {/* Signup activity — own query; visible even if the summary fails. */}
        <div className="mb-4">
          <SignupActivityPanel enabled={!!user} />
        </div>

        {data && !isLoading && (
          <div className="space-y-4">
            {/* Panel 1 — Provider applications (wired) */}
            <PanelShell
              icon={<ClipboardList className="h-5 w-5" />}
              title="Provider applications"
              subtitle="Approval queue"
            >
              {data.providerApplications.wired ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['Pending', data.providerApplications.stats.pending],
                      ['In review', data.providerApplications.stats.underReview],
                      ['On hold', data.providerApplications.stats.onHold],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-gray-50 p-3 text-center">
                        <div className="text-2xl font-semibold text-gray-900">{value}</div>
                        <div className="text-xs text-gray-500">{label}</div>
                      </div>
                    ))}
                  </div>

                  {data.providerApplications.recent.length > 0 ? (
                    <ul className="divide-y divide-gray-100">
                      {data.providerApplications.recent.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {row.platform} · #{row.id}
                            </p>
                            <p className="truncate text-xs text-gray-500">{row.providerId}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[row.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {row.status.replace(/_/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No applications in the queue.</p>
                  )}

                  <Link
                    href={data.providerApplications.reviewPath}
                    className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:underline"
                  >
                    Open review queue <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <NotConnected reason={data.providerApplications.reason} />
              )}
            </PanelShell>

            {/* Panel 2 — Booking intake (wired) */}
            <PanelShell
              icon={<CalendarClock className="h-5 w-5" />}
              title="Booking intake"
              subtitle="Most recent bookings"
            >
              {data.bookingIntake.wired ? (
                data.bookingIntake.recent.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {data.bookingIntake.recent.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link
                            href={`${data.bookingIntake.wired ? data.bookingIntake.tracePathPrefix : '/booking-trace/'}${b.id}`}
                            className="truncate text-sm font-medium text-gray-900 hover:underline"
                          >
                            {b.bookingNumber}
                          </Link>
                          <p className="truncate text-xs text-gray-500">
                            {b.currency} {b.total}
                            {b.startTime && ` · ${new Date(b.startTime).toLocaleDateString()}`}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {b.status.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No bookings yet.</p>
                )
              ) : (
                <NotConnected reason={data.bookingIntake.reason} />
              )}
            </PanelShell>

            {/* Panel 4 — Customer lookup (search-driven) */}
            <PanelShell
              icon={<Users className="h-5 w-5" />}
              title="Customer lookup"
              subtitle="Find a customer or contact"
            >
              <CustomerLookupPanel />
            </PanelShell>

            {/* Remaining panels — placeholders */}
            {PLACEHOLDER_PANELS.map(({ key, icon, title, subtitle }) => {
              const panel = data[key] as Wired<never>;
              return (
                <PanelShell key={key} icon={icon} title={title} subtitle={subtitle}>
                  <NotConnected reason={panel.wired ? '' : panel.reason} />
                </PanelShell>
              );
            })}

            <p className="pt-2 text-center text-xs text-gray-400">
              Read-only · generated {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
