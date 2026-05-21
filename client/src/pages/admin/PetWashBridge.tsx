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
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Layout } from '@/components/Layout';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import {
  ClipboardList, CalendarClock, Users, ListTodo, Bell, ScrollText,
  Loader2, RefreshCw, ChevronRight, PlugZap,
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

interface BridgeSummary {
  generatedAt: string;
  readOnly: boolean;
  providerApplications: Wired<ProviderApplicationsPanel>;
  bookingIntake: Wired<never>;
  customerLookup: Wired<never>;
  hubspotTasks: Wired<never>;
  alerts: Wired<never>;
  auditEvents: Wired<never>;
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

const PLACEHOLDER_PANELS: Array<{ key: keyof BridgeSummary; icon: ReactNode; title: string; subtitle: string }> = [
  { key: 'bookingIntake', icon: <CalendarClock className="h-5 w-5" />, title: 'Booking intake queue', subtitle: 'Recent bookings awaiting action' },
  { key: 'hubspotTasks', icon: <ListTodo className="h-5 w-5" />, title: 'HubSpot tasks', subtitle: 'Tasks created by signup / booking / provider flows' },
  { key: 'customerLookup', icon: <Users className="h-5 w-5" />, title: 'Customer lookup', subtitle: 'Find a customer or contact' },
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

            {/* Panels 2–6 — placeholders */}
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
