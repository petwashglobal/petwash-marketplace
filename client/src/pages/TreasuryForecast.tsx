import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, ShieldAlert,
  XCircle, Info, ArrowRight, CalendarDays, BarChart3, Building2,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ForecastWindow {
  label: '7d' | '14d' | '30d';
  expected_gross_outflow_cents: number;
  expected_releasable_outflow_cents: number;
  expected_held_outflow_cents: number;
  expected_risky_outflow_cents: number;
  expected_failed_retry_outflow_cents: number;
}

interface ReserveAgeing {
  total_held: number;
  total_held_cents: number;
  data_quality_issues: number;
  buckets: Array<{ bucket: string; reserve_count: number; reserve_amount_cents: number; avg_age_days: number; oldest_reserve_days: number }>;
  by_owner: Array<{ owner_type: string; owner_id: string | null; amount_cents: number; count: number }>;
}

interface LiquidityPressure {
  next_7_days_expected_outflow: number;
  next_14_days_expected_outflow: number;
  total_open_outflow: number;
  total_held_amount: number;
  releasable_amount: number;
  failed_batches_waiting_retry: number;
  failed_retry_cents: number;
  unresolved_approval_amount: number;
  unresolved_approval_count: number;
  unresolved_dispute_count: number;
  pressure_level: 'low' | 'medium' | 'high' | 'critical';
  pressure_reason: string;
}

interface CalendarCycle {
  cycle_start: string;
  cycle_end: string;
  projected_gross_cents: number;
  projected_releasable_cents: number;
  projected_held_cents: number;
  projected_risky_cents: number;
  projected_failed_retry_cents: number;
  dominant_blocker: string;
}

interface RiskEntity {
  owner_type: string;
  owner_id: string;
  expected_outflow_30d_cents: number;
  held_amount_cents: number;
  reserve_age_31_plus_cents: number;
  failed_payout_count: number;
  dispute_blocked_cents: number;
  approval_pending_cents: number;
  risk_score: number;
}

interface TreasuryWarning {
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  title: string;
  description: string;
  entity_scope: string;
  entity_id: string | null;
  amount_cents: number;
  age_days: number | null;
  action_hint: string;
}

interface ForecastVsActualCycle {
  batch_id: string;
  paid_at: string | null;
  forecasted_releasable_cents: number;
  actual_paid_cents: number;
  variance_cents: number;
  variance_pct: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ils(cents: number | null | undefined) {
  const n = cents ?? 0;
  return `₪${(n / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

const BLOCKER_LABELS: Record<string, string> = {
  disputes: 'Disputes',
  mismatches: 'Reserve holds',
  pending_approvals: 'Pending approvals',
  failed_transfers: 'Failed transfers',
  no_blocker: '—',
};

const PRESSURE_CONFIG = {
  low: { color: 'bg-emerald-100 border-emerald-300 text-emerald-800', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, label: 'LOW' },
  medium: { color: 'bg-amber-100 border-amber-300 text-amber-800', icon: <Clock className="w-5 h-5 text-amber-600" />, label: 'MEDIUM' },
  high: { color: 'bg-orange-100 border-orange-300 text-orange-800', icon: <AlertTriangle className="w-5 h-5 text-orange-600" />, label: 'HIGH' },
  critical: { color: 'bg-red-100 border-red-300 text-red-800', icon: <XCircle className="w-5 h-5 text-red-600" />, label: 'CRITICAL' },
};

const SEVERITY_CONFIG = {
  info: { color: 'border-blue-200 bg-blue-50', icon: <Info className="w-4 h-4 text-blue-500 shrink-0" /> },
  warning: { color: 'border-amber-200 bg-amber-50', icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> },
  high: { color: 'border-orange-200 bg-orange-50', icon: <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0" /> },
  critical: { color: 'border-red-200 bg-red-50', icon: <XCircle className="w-4 h-4 text-red-600 shrink-0" /> },
};

function RiskBar({ score }: { score: number }) {
  const color = score <= 20 ? 'bg-emerald-500' : score <= 50 ? 'bg-amber-500' : score <= 75 ? 'bg-orange-500' : 'bg-red-600';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold w-7 text-right">{score}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>
  );
}

// ---------------------------------------------------------------------------
// Section: Forecast snapshot cards
// ---------------------------------------------------------------------------

function ForecastCards({ windows }: { windows: ForecastWindow[] }) {
  if (!windows?.length) return <EmptyState message="No settlement data for forecast" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {windows.map(w => {
        const gross = w.expected_gross_outflow_cents;
        return (
          <Card key={w.label} className="border">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-base font-bold">{w.label === '7d' ? 'Next 7 days' : w.label === '14d' ? 'Next 14 days' : 'Next 30 days'}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="text-2xl font-bold">{ils(gross)}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1">
                <div className="text-emerald-700 font-medium">Releasable</div>
                <div className="text-right font-mono">{ils(w.expected_releasable_outflow_cents)} <span className="text-muted-foreground">({pct(w.expected_releasable_outflow_cents, gross)})</span></div>
                <div className="text-amber-700 font-medium">Held</div>
                <div className="text-right font-mono">{ils(w.expected_held_outflow_cents)} <span className="text-muted-foreground">({pct(w.expected_held_outflow_cents, gross)})</span></div>
                <div className="text-orange-700 font-medium">Risky</div>
                <div className="text-right font-mono">{ils(w.expected_risky_outflow_cents)} <span className="text-muted-foreground">({pct(w.expected_risky_outflow_cents, gross)})</span></div>
                <div className="text-red-700 font-medium">Failed retry</div>
                <div className="text-right font-mono">{ils(w.expected_failed_retry_outflow_cents)} <span className="text-muted-foreground">({pct(w.expected_failed_retry_outflow_cents, gross)})</span></div>
              </div>
              {/* Mini stacked bar */}
              <div className="flex h-2 rounded-full overflow-hidden mt-2 gap-px">
                {w.expected_releasable_outflow_cents > 0 && <div className="bg-emerald-500" style={{ width: pct(w.expected_releasable_outflow_cents, gross) }} title="Releasable" />}
                {w.expected_held_outflow_cents > 0 && <div className="bg-amber-400" style={{ width: pct(w.expected_held_outflow_cents, gross) }} title="Held" />}
                {w.expected_risky_outflow_cents > 0 && <div className="bg-orange-400" style={{ width: pct(w.expected_risky_outflow_cents, gross) }} title="Risky" />}
                {w.expected_failed_retry_outflow_cents > 0 && <div className="bg-red-500" style={{ width: pct(w.expected_failed_retry_outflow_cents, gross) }} title="Failed" />}
                {gross === 0 && <div className="bg-gray-200 flex-1" />}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Liquidity pressure gauge
// ---------------------------------------------------------------------------

function LiquidityGauge({ data }: { data: LiquidityPressure }) {
  const cfg = PRESSURE_CONFIG[data.pressure_level];
  return (
    <Card className={`border-2 ${cfg.color}`}>
      <CardContent className="py-5 px-5">
        <div className="flex items-start gap-4">
          <div className="text-4xl font-black tracking-tight flex items-center gap-3">
            {cfg.icon}
            <span>{cfg.label}</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium mb-2 italic">"{data.pressure_reason}"</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div>
                <div className="text-xs text-muted-foreground">7d expected</div>
                <div className="font-bold text-sm">{ils(data.next_7_days_expected_outflow)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">14d expected</div>
                <div className="font-bold text-sm">{ils(data.next_14_days_expected_outflow)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total held</div>
                <div className={`font-bold text-sm ${data.total_held_amount > 0 ? 'text-amber-700' : ''}`}>{ils(data.total_held_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Approval backlog</div>
                <div className={`font-bold text-sm ${data.unresolved_approval_count > 0 ? 'text-orange-700' : ''}`}>
                  {data.unresolved_approval_count} items ({ils(data.unresolved_approval_amount)})
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Failed batches</div>
                <div className={`font-bold text-sm ${data.failed_batches_waiting_retry > 0 ? 'text-red-700' : ''}`}>
                  {data.failed_batches_waiting_retry} ({ils(data.failed_retry_cents)})
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Open disputes</div>
                <div className={`font-bold text-sm ${data.unresolved_dispute_count > 0 ? 'text-orange-700' : ''}`}>{data.unresolved_dispute_count}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Releasable now</div>
                <div className="font-bold text-sm text-emerald-700">{ils(data.releasable_amount)}</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: Payout calendar forecast
// ---------------------------------------------------------------------------

function CalendarForecast({ cycles }: { cycles: CalendarCycle[] }) {
  if (!cycles?.length) return <EmptyState message="No upcoming cycle projections" />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cycle</TableHead>
            <TableHead className="text-right">Projected Gross</TableHead>
            <TableHead className="text-right text-emerald-700">Releasable</TableHead>
            <TableHead className="text-right text-amber-700">Held</TableHead>
            <TableHead className="text-right text-orange-700">Risky</TableHead>
            <TableHead className="text-right text-red-700">Failed</TableHead>
            <TableHead>Dominant Blocker</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cycles.map((c, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-mono">
                {c.cycle_start} → {c.cycle_end}
              </TableCell>
              <TableCell className="text-right font-bold">{ils(c.projected_gross_cents)}</TableCell>
              <TableCell className="text-right text-emerald-700">{ils(c.projected_releasable_cents)}</TableCell>
              <TableCell className="text-right text-amber-700">{ils(c.projected_held_cents)}</TableCell>
              <TableCell className="text-right text-orange-700">{ils(c.projected_risky_cents)}</TableCell>
              <TableCell className="text-right text-red-700">{ils(c.projected_failed_retry_cents)}</TableCell>
              <TableCell>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.dominant_blocker === 'no_blocker' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                  {BLOCKER_LABELS[c.dominant_blocker] ?? c.dominant_blocker}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Reserve ageing
// ---------------------------------------------------------------------------

function ReserveAgeingTable({ data }: { data: ReserveAgeing }) {
  const maxAmt = Math.max(...(data.buckets?.map(b => b.reserve_amount_cents) ?? [1]), 1);
  return (
    <div className="space-y-4">
      {data.data_quality_issues > 0 && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2 text-amber-800">
          ⚠ {data.data_quality_issues} held settlement(s) missing explicit hold reason — treasury data quality issue
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Age bucket</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Amount held</TableHead>
              <TableHead>Avg age</TableHead>
              <TableHead>Oldest</TableHead>
              <TableHead className="w-32">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.buckets?.map(b => (
              <TableRow key={b.bucket} className={b.bucket === '31+d' && b.reserve_count > 0 ? 'bg-red-50' : ''}>
                <TableCell className="font-medium">{b.bucket}</TableCell>
                <TableCell className="text-right">{b.reserve_count}</TableCell>
                <TableCell className="text-right font-bold">{ils(b.reserve_amount_cents)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{b.avg_age_days}d</TableCell>
                <TableCell className={`text-sm font-medium ${b.oldest_reserve_days > 30 ? 'text-red-700' : b.oldest_reserve_days > 14 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {b.oldest_reserve_days}d
                </TableCell>
                <TableCell>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full ${b.bucket === '31+d' ? 'bg-red-500' : b.bucket === '15-30d' ? 'bg-orange-400' : b.bucket === '8-14d' ? 'bg-amber-400' : 'bg-blue-400'}`}
                      style={{ width: `${Math.round((b.reserve_amount_cents / maxAmt) * 100)}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.total_held > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          Total: {data.total_held} held settlements / {ils(data.total_held_cents)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Risk comparison
// ---------------------------------------------------------------------------

function RiskTable({ entities }: { entities: RiskEntity[] }) {
  if (!entities?.length) return <EmptyState message="No entity data" />;
  const sorted = [...entities].sort((a, b) => b.risk_score - a.risk_score);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead className="text-right">30d outflow</TableHead>
            <TableHead className="text-right">Held</TableHead>
            <TableHead className="text-right">31+ reserve</TableHead>
            <TableHead className="text-center">Failed</TableHead>
            <TableHead className="text-right">Disputed</TableHead>
            <TableHead className="text-right">Pending approval</TableHead>
            <TableHead>Risk score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((e, i) => (
            <TableRow key={i} className={e.risk_score >= 75 ? 'bg-red-50' : e.risk_score >= 50 ? 'bg-orange-50' : ''}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-xs font-semibold capitalize">{e.owner_type}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate max-w-[80px]">{e.owner_id}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-bold">{ils(e.expected_outflow_30d_cents)}</TableCell>
              <TableCell className={`text-right ${e.held_amount_cents > 0 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>{ils(e.held_amount_cents)}</TableCell>
              <TableCell className={`text-right ${e.reserve_age_31_plus_cents > 0 ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>{ils(e.reserve_age_31_plus_cents)}</TableCell>
              <TableCell className={`text-center ${e.failed_payout_count > 0 ? 'text-red-700 font-bold' : 'text-muted-foreground'}`}>{e.failed_payout_count}</TableCell>
              <TableCell className={`text-right ${e.dispute_blocked_cents > 0 ? 'text-orange-700 font-medium' : 'text-muted-foreground'}`}>{ils(e.dispute_blocked_cents)}</TableCell>
              <TableCell className={`text-right ${e.approval_pending_cents > 0 ? 'text-orange-700 font-medium' : 'text-muted-foreground'}`}>{ils(e.approval_pending_cents)}</TableCell>
              <TableCell><RiskBar score={e.risk_score} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Warnings
// ---------------------------------------------------------------------------

function WarningsList({ warnings }: { warnings: TreasuryWarning[] }) {
  if (!warnings?.length) {
    return (
      <div className="flex items-center gap-2 py-4 text-emerald-700 text-sm">
        <CheckCircle2 className="w-4 h-4" /> No active warnings — treasury is clean
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const cfg = SEVERITY_CONFIG[w.severity];
        return (
          <div key={i} className={`border rounded-lg px-4 py-3 flex items-start gap-3 ${cfg.color}`}>
            {cfg.icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{w.title}</span>
                {w.amount_cents > 0 && <span className="text-xs font-bold font-mono">{ils(w.amount_cents)}</span>}
              </div>
              <div className="text-xs mt-0.5">{w.description}</div>
              <div className="text-xs text-muted-foreground mt-1 italic">Action: {w.action_hint}</div>
            </div>
            {w.entity_id && (
              <Link href={w.entity_scope === 'batch' ? '/treasury' : `/treasury`}>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground shrink-0 mt-0.5 cursor-pointer" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Forecast vs Actual
// ---------------------------------------------------------------------------

function ForecastVsActual({ data }: { data: { cycles: ForecastVsActualCycle[]; summary: any } }) {
  if (!data?.cycles?.length) return <EmptyState message="No completed payout cycles yet" />;
  const { summary } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-muted-foreground">Total forecasted</div>
          <div className="font-bold">{ils(summary.total_forecasted_cents)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-muted-foreground">Total actual paid</div>
          <div className="font-bold">{ils(summary.total_actual_cents)}</div>
        </div>
        <div className={`rounded-lg p-3 border ${Math.abs(summary.total_variance_cents) > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="text-xs text-muted-foreground">Variance</div>
          <div className={`font-bold ${summary.total_variance_cents !== 0 ? 'text-red-700' : 'text-emerald-700'}`}>{ils(summary.total_variance_cents)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="text-xs text-muted-foreground">Avg abs variance</div>
          <div className={`font-bold ${summary.avg_abs_variance_pct > 10 ? 'text-red-700' : summary.avg_abs_variance_pct > 5 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {summary.avg_abs_variance_pct}%
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Forecasted</TableHead>
              <TableHead className="text-right">Actual paid</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Variance %</TableHead>
              <TableHead>Paid at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.cycles.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{c.batch_id}</TableCell>
                <TableCell className="text-right">{ils(c.forecasted_releasable_cents)}</TableCell>
                <TableCell className="text-right">{ils(c.actual_paid_cents)}</TableCell>
                <TableCell className={`text-right font-medium ${c.variance_cents !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {c.variance_cents !== 0 ? ils(c.variance_cents) : '✓ exact'}
                </TableCell>
                <TableCell className={`text-right text-xs ${Math.abs(c.variance_pct) > 10 ? 'text-red-700 font-bold' : 'text-muted-foreground'}`}>
                  {c.variance_pct !== 0 ? `${c.variance_pct}%` : '0%'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.paid_at ? new Date(c.paid_at).toLocaleDateString('he-IL') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drilldown links footer (T189)
// ---------------------------------------------------------------------------

function DrilldownLinks() {
  const links = [
    { href: '/treasury', label: 'Payout Batches & Reconciliation', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { href: '/financial-approvals', label: 'Approval Queue', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span className="font-medium">Drilldown:</span>
      {links.map(l => (
        <Link key={l.href} href={l.href}>
          <span className="flex items-center gap-1 hover:text-foreground cursor-pointer underline-offset-2 hover:underline">
            {l.icon} {l.label} <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TreasuryForecast() {
  const { data: forecastData, isLoading: forecastLoading } = useQuery<{ windows: ForecastWindow[] }>({
    queryKey: ['/api/treasury/forecast-snapshot'],
    refetchInterval: 60000,
  });

  const { data: pressureData, isLoading: pressureLoading } = useQuery<LiquidityPressure>({
    queryKey: ['/api/treasury/liquidity-pressure'],
    refetchInterval: 60000,
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery<{ cycles: CalendarCycle[] }>({
    queryKey: ['/api/treasury/payout-calendar-forecast'],
  });

  const { data: ageingData, isLoading: ageingLoading } = useQuery<ReserveAgeing>({
    queryKey: ['/api/treasury/reserve-ageing'],
  });

  const { data: riskData, isLoading: riskLoading } = useQuery<{ entities: RiskEntity[] }>({
    queryKey: ['/api/treasury/risk-comparison'],
  });

  const { data: warningsData, isLoading: warningsLoading } = useQuery<{ warnings: TreasuryWarning[] }>({
    queryKey: ['/api/treasury/warnings'],
    refetchInterval: 120000,
  });

  const { data: fvaData, isLoading: fvaLoading } = useQuery<{ cycles: ForecastVsActualCycle[]; summary: any }>({
    queryKey: ['/api/treasury/forecast-vs-actual'],
  });

  const warningCount = warningsData?.warnings?.length ?? 0;
  const criticalCount = warningsData?.warnings?.filter(w => w.severity === 'critical').length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-7 h-7 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Treasury Forecast</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Forward-looking cash control — expected outflows, reserve pressure, and liquidity warnings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/treasury">
              <span className="text-xs text-muted-foreground underline-offset-2 hover:underline cursor-pointer flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> Treasury (reconciliation)
              </span>
            </Link>
          </div>
        </div>

        {/* Critical warnings banner */}
        {criticalCount > 0 && (
          <div className="bg-red-600 text-white rounded-lg px-4 py-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">
              {criticalCount} critical treasury warning{criticalCount > 1 ? 's' : ''} — immediate action required
            </span>
          </div>
        )}

        {/* 1. Forecast Snapshot */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Forecast Snapshot</h2>
          </div>
          {forecastLoading
            ? <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            : <ForecastCards windows={forecastData?.windows ?? []} />}
        </div>

        {/* 2. Liquidity Pressure */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Liquidity Pressure</h2>
          </div>
          {pressureLoading
            ? <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            : pressureData
              ? <LiquidityGauge data={pressureData} />
              : <EmptyState message="Could not load pressure data" />}
        </div>

        {/* 3. Payout Calendar Forecast */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payout Calendar Forecast</CardTitle>
            <CardDescription>Forward-looking 4-week projection by settlement state</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {calendarLoading
              ? <div className="h-24 bg-gray-100 mx-4 rounded animate-pulse" />
              : <CalendarForecast cycles={calendarData?.cycles ?? []} />}
          </CardContent>
        </Card>

        {/* 4. Reserve Ageing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reserve Ageing</CardTitle>
            <CardDescription>Money held in reserve by age bucket — 31+ is structural risk</CardDescription>
          </CardHeader>
          <CardContent>
            {ageingLoading
              ? <div className="h-24 bg-gray-100 rounded animate-pulse" />
              : ageingData
                ? <ReserveAgeingTable data={ageingData} />
                : <EmptyState message="No reserve ageing data" />}
          </CardContent>
        </Card>

        {/* 5. Risk Comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Franchise / Network Risk Comparison</CardTitle>
            <CardDescription>Ranked by risk score — score 0 = healthy, 100 = critical</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {riskLoading
              ? <div className="h-24 bg-gray-100 mx-4 rounded animate-pulse" />
              : <RiskTable entities={riskData?.entities ?? []} />}
          </CardContent>
        </Card>

        {/* 6. Warnings */}
        <Card className={criticalCount > 0 ? 'border-red-300' : warningCount > 0 ? 'border-amber-300' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                Treasury Warnings
              </CardTitle>
              {warningCount > 0 && (
                <Badge variant="destructive" className="text-xs">{warningCount} active</Badge>
              )}
            </div>
            <CardDescription>Explicit, actionable — no silent buildup</CardDescription>
          </CardHeader>
          <CardContent>
            {warningsLoading
              ? <div className="h-16 bg-gray-100 rounded animate-pulse" />
              : <WarningsList warnings={warningsData?.warnings ?? []} />}
          </CardContent>
        </Card>

        {/* 7. Forecast vs Actual */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Forecast vs Actual</CardTitle>
            <CardDescription>Discipline check — are forecasted amounts matching real payments?</CardDescription>
          </CardHeader>
          <CardContent>
            {fvaLoading
              ? <div className="h-24 bg-gray-100 rounded animate-pulse" />
              : fvaData
                ? <ForecastVsActual data={fvaData} />
                : <EmptyState message="No completed cycles yet" />}
          </CardContent>
        </Card>

        {/* Drilldown footer */}
        <DrilldownLinks />
      </div>
    </div>
  );
}
