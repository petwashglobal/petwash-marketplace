/**
 * ManagementKycDashboard — read-only KYC funnel analytics for management tier.
 * Route: /admin/providers/analytics
 * Auth:  management role (fires against /api/provider-onboarding/mgmt/analytics)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuth } from 'firebase/auth';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kpi {
  pending_total: string;
  approved_this_week: string;
  rejected_this_week: string;
  awaiting_resubmission: string;
  high_fraud_flags: string;
  approval_rate_pct: string | null;
}

interface TrendPoint { day: string; approvals: number; rejections: number }
interface AgingBucket { bucket: string; count: string }
interface WorkloadRow {
  reviewer: string;
  total_reviewed: string;
  approved: string;
  rejected: string;
  avg_review_hours: string | null;
}

interface AnalyticsData {
  kpi: Kpi;
  trend: TrendPoint[];
  aging: AgingBucket[];
  workload: WorkloadRow[];
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGING_LABELS: Record<string, string> = {
  under_24h: '< 24 h',
  '24_72h': '24–72 h',
  '72h_7d': '3–7 days',
  over_7d: '> 7 days',
};

const AGING_COLORS: Record<string, string> = {
  under_24h: '#22c55e',
  '24_72h': '#facc15',
  '72h_7d': '#f97316',
  over_7d: '#ef4444',
};

async function fetchAnalytics(): Promise<AnalyticsData> {
  const auth = getAuth();
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const res = await apiRequest('GET', '/api/provider-onboarding/mgmt/analytics', undefined, {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="rounded-xl bg-muted p-3 shrink-0">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManagementKycDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error, isFetching } = useQuery<AnalyticsData>({
    queryKey: ['mgmt-kyc-analytics', refreshKey],
    queryFn: fetchAnalytics,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });

  const kpi = data?.kpi;

  const trendData = (data?.trend ?? []).map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Approved: Number(d.approvals),
    Rejected: Number(d.rejections),
  }));

  const agingData = (data?.aging ?? []).map((b) => ({
    name: AGING_LABELS[b.bucket] ?? b.bucket,
    value: Number(b.count),
    bucket: b.bucket,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KYC Funnel Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Management view — read only. Last updated:{' '}
            {data ? new Date(data.generatedAt).toLocaleTimeString('en-IL') : '—'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load analytics: {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 pb-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : kpi ? (
          <>
            <KpiCard
              icon={<Clock className="h-5 w-5 text-yellow-600" />}
              label="Pending review"
              value={Number(kpi.pending_total).toLocaleString()}
              color="text-yellow-700"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
              label="Approved (7 d)"
              value={Number(kpi.approved_this_week).toLocaleString()}
              color="text-green-700"
            />
            <KpiCard
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              label="Rejected (7 d)"
              value={Number(kpi.rejected_this_week).toLocaleString()}
              color="text-red-600"
            />
            <KpiCard
              icon={<RefreshCw className="h-5 w-5 text-blue-500" />}
              label="Awaiting resubmission"
              value={Number(kpi.awaiting_resubmission).toLocaleString()}
            />
            <KpiCard
              icon={<ShieldAlert className="h-5 w-5 text-orange-500" />}
              label="High fraud flags"
              value={Number(kpi.high_fraud_flags).toLocaleString()}
              color="text-orange-600"
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5 text-teal-600" />}
              label="Approval rate"
              value={kpi.approval_rate_pct != null ? `${kpi.approval_rate_pct}%` : '—'}
              sub="approved / (approved + rejected)"
            />
          </>
        ) : null}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily approvals vs rejections (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No decisions in last 30 days</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Approved" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Rejected" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Queue aging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open queue aging</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : agingData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Queue is empty</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agingData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {agingData.map((entry, i) => (
                      <Cell key={i} fill={AGING_COLORS[entry.bucket] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reviewer workload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" /> Reviewer workload (last 30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data?.workload?.length ? (
            <p className="text-sm text-muted-foreground">No review activity in last 30 days</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Reviewer</th>
                    <th className="text-right py-2 px-4 font-medium">Total</th>
                    <th className="text-right py-2 px-4 font-medium">Approved</th>
                    <th className="text-right py-2 px-4 font-medium">Rejected</th>
                    <th className="text-right py-2 pl-4 font-medium">Avg review (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workload.map((r) => (
                    <tr key={r.reviewer} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{r.reviewer}</td>
                      <td className="text-right py-2 px-4 font-semibold">{r.total_reviewed}</td>
                      <td className="text-right py-2 px-4">
                        <Badge className="bg-green-100 text-green-800 font-normal">{r.approved}</Badge>
                      </td>
                      <td className="text-right py-2 px-4">
                        <Badge className="bg-red-100 text-red-800 font-normal">{r.rejected}</Badge>
                      </td>
                      <td className="text-right py-2 pl-4 text-muted-foreground">
                        {r.avg_review_hours != null ? `${r.avg_review_hours} h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
