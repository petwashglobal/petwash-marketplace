import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Clock, ArrowRight, BarChart2, Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutcomeVerdict = 'improved' | 'no_change' | 'deteriorated' | 'pending' | 'no_baseline';

interface MetricDelta {
  before: number | null;
  after: number | null;
  delta: number | null;
  improved: boolean | null;
}

interface CaseOutcome {
  caseId: number;
  entityName: string;
  entityType: string;
  triggerFlag: string | null;
  triggerSignal: string | null;
  decision: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionDays: number | null;
  hasBaseline: boolean;
  marginDelta: MetricDelta;
  frictionDelta: MetricDelta;
  reserveRiskDelta: { before: string | null; after: string | null; improved: boolean | null };
  failureRateDelta: MetricDelta;
  verdict: OutcomeVerdict;
  improvedMetrics: number;
  totalMetrics: number;
}

interface EffectivenessByDecision {
  decision: string;
  totalCases: number;
  resolvedWithBaseline: number;
  successRate: number | null;
  avgResolutionDays: number | null;
  avgMarginImprovement: number | null;
  avgFrictionReduction: number | null;
}

interface OutcomeSummary {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  escalatedCases: number;
  resolvedCases: number;
  casesWithBaseline: number;
  resolvedWithBaseline: number;
  overallSuccessRate: number | null;
  avgResolutionDays: number | null;
  byDecision: EffectivenessByDecision[];
  caseOutcomes: CaseOutcome[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERDICT_CFG: Record<OutcomeVerdict, { label: string; color: string; icon: React.ReactNode }> = {
  improved:     { label: 'Improved',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <TrendingUp className="w-3 h-3" /> },
  no_change:    { label: 'No change',    color: 'text-amber-700 bg-amber-50 border-amber-200',       icon: <Minus className="w-3 h-3" /> },
  deteriorated: { label: 'Deteriorated', color: 'text-red-700 bg-red-50 border-red-200',             icon: <TrendingDown className="w-3 h-3" /> },
  pending:      { label: 'Pending',      color: 'text-blue-700 bg-blue-50 border-blue-200',          icon: <Clock className="w-3 h-3" /> },
  no_baseline:  { label: 'No baseline',  color: 'text-gray-600 bg-white border-gray-200',          icon: <Info className="w-3 h-3" /> },
};

const DECISION_LABELS: Record<string, string> = {
  approve_expansion: 'Approve expansion',
  freeze_capex:      'Freeze capex',
  restructure:       'Restructure',
  review_franchise:  'Review franchise',
  monitor:           'Monitor',
  no_action:         'No action',
  no_decision:       'No decision yet',
};

const FLAG_LABELS: Record<string, string> = {
  treasury_critical:   'Treasury critical',
  margin_collapse:     'Margin collapse',
  cash_blocked:        'Cash blocked',
  reserve_aged_31plus: 'Reserve aged 31+d',
  approval_backlog:    'Approval backlog',
  payout_failure:      'Payout failure',
  network_health_low:  'Network health low',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function VerdictBadge({ verdict }: { verdict: OutcomeVerdict }) {
  const cfg = VERDICT_CFG[verdict] ?? VERDICT_CFG.no_baseline;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function DeltaCell({ delta, improved, unit = '%', lowerIsBetter = false }: {
  delta: number | null; improved: boolean | null; unit?: string; lowerIsBetter?: boolean;
}) {
  if (delta === null) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = lowerIsBetter ? delta < 0 : delta > 0;
  const color = improved === true ? 'text-emerald-700' : improved === false ? 'text-red-700' : 'text-muted-foreground';
  const icon = improved === true ? <TrendingUp className="w-3 h-3 inline" /> : improved === false ? <TrendingDown className="w-3 h-3 inline" /> : null;
  return (
    <span className={`text-sm font-mono ${color} flex items-center gap-1`}>
      {icon}
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}
    </span>
  );
}

function MetricBar({ value, max = 100, color = 'bg-blue-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden min-w-[40px]">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8">{Math.round(value)}%</span>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{msg}</div>;
}

// ---------------------------------------------------------------------------
// Section 1: Summary strip
// ---------------------------------------------------------------------------

function SummaryStrip({ data }: { data: OutcomeSummary }) {
  const cards = [
    { label: 'Total cases', value: data.totalCases, color: 'border-gray-200' },
    { label: 'Open', value: data.openCases, color: 'border-amber-200 bg-amber-50' },
    { label: 'In progress', value: data.inProgressCases, color: 'border-blue-200 bg-blue-50' },
    { label: 'Resolved', value: data.resolvedCases, color: 'border-emerald-200 bg-emerald-50' },
    {
      label: 'Success rate',
      value: data.overallSuccessRate !== null ? `${data.overallSuccessRate}%` : 'N/A',
      color: (data.overallSuccessRate ?? 0) >= 60 ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200',
      sub: data.resolvedWithBaseline > 0 ? `${data.resolvedWithBaseline} with baseline` : 'No resolved + baseline',
    },
    {
      label: 'Avg resolution',
      value: data.avgResolutionDays !== null ? `${data.avgResolutionDays}d` : 'N/A',
      color: 'border-gray-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(k => (
        <Card key={k.label} className={`border ${k.color}`}>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="text-xs text-muted-foreground mb-1">{k.label}</div>
            <div className="text-xl font-bold">{k.value}</div>
            {(k as any).sub && <div className="text-xs text-muted-foreground mt-0.5">{(k as any).sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Baseline coverage notice
// ---------------------------------------------------------------------------

function BaselineCoverage({ data }: { data: OutcomeSummary }) {
  const noBaseline = data.totalCases - data.casesWithBaseline;
  if (noBaseline === 0) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
      <Info className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">{noBaseline} case(s) have no economic baseline</span> — these were created before outcome measurement was enabled, or are network/franchise entities without direct settlement mapping.
        Before-vs-after comparison is only available for cases created from this point forward.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Effectiveness by decision type
// ---------------------------------------------------------------------------

function ByDecisionTable({ rows }: { rows: EffectivenessByDecision[] }) {
  if (!rows.length) return <EmptyState msg="No decision data yet" />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Decision type</TableHead>
            <TableHead className="text-right">Total cases</TableHead>
            <TableHead className="text-right">Resolved w/ baseline</TableHead>
            <TableHead>Success rate</TableHead>
            <TableHead className="text-right">Avg resolution</TableHead>
            <TableHead>Avg margin improvement</TableHead>
            <TableHead>Avg friction reduction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.decision}>
              <TableCell className="font-medium text-sm">{DECISION_LABELS[row.decision] ?? row.decision}</TableCell>
              <TableCell className="text-right">{row.totalCases}</TableCell>
              <TableCell className="text-right">{row.resolvedWithBaseline}</TableCell>
              <TableCell>
                {row.successRate !== null
                  ? <MetricBar value={row.successRate} color={row.successRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500'} />
                  : <span className="text-xs text-muted-foreground">N/A</span>}
              </TableCell>
              <TableCell className="text-right text-sm">
                {row.avgResolutionDays !== null ? `${row.avgResolutionDays}d` : '—'}
              </TableCell>
              <TableCell>
                <DeltaCell delta={row.avgMarginImprovement} improved={row.avgMarginImprovement !== null ? row.avgMarginImprovement > 0 : null} />
              </TableCell>
              <TableCell>
                <DeltaCell delta={row.avgFrictionReduction} improved={row.avgFrictionReduction !== null ? row.avgFrictionReduction > 0 : null} lowerIsBetter />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Case-level before vs after
// ---------------------------------------------------------------------------

function CaseOutcomesTable({ outcomes }: { outcomes: CaseOutcome[] }) {
  if (!outcomes.length) return <EmptyState msg="No cases" />;

  const sorted = [...outcomes].sort((a, b) => {
    const order: Record<OutcomeVerdict, number> = { improved: 0, deteriorated: 1, pending: 2, no_change: 3, no_baseline: 4 };
    return (order[a.verdict] ?? 5) - (order[b.verdict] ?? 5);
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Margin Δ</TableHead>
            <TableHead>Friction Δ</TableHead>
            <TableHead>Reserve risk</TableHead>
            <TableHead>Failure rate Δ</TableHead>
            <TableHead>Resolution</TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(o => (
            <TableRow key={o.caseId} className={
              o.verdict === 'improved' ? 'bg-emerald-50' :
              o.verdict === 'deteriorated' ? 'bg-red-50' : ''
            }>
              <TableCell className="text-xs text-muted-foreground">{o.caseId}</TableCell>
              <TableCell>
                <div className="font-medium text-sm">{o.entityName}</div>
                <span className="text-xs text-muted-foreground capitalize">{o.entityType}</span>
              </TableCell>
              <TableCell>
                {o.triggerFlag
                  ? <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">{FLAG_LABELS[o.triggerFlag] ?? o.triggerFlag}</span>
                  : <span className="text-xs text-muted-foreground">Manual</span>}
              </TableCell>
              <TableCell className="text-xs">{o.decision ? (DECISION_LABELS[o.decision] ?? o.decision) : <span className="text-muted-foreground italic">Pending</span>}</TableCell>
              <TableCell>
                {o.hasBaseline
                  ? <DeltaCell delta={o.marginDelta.delta} improved={o.marginDelta.improved} />
                  : <span className="text-xs text-muted-foreground">No baseline</span>}
              </TableCell>
              <TableCell>
                {o.hasBaseline
                  ? <DeltaCell delta={o.frictionDelta.delta} improved={o.frictionDelta.improved} lowerIsBetter />
                  : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                {o.reserveRiskDelta.before !== null ? (
                  <div className="text-xs">
                    <span className="text-muted-foreground">{o.reserveRiskDelta.before}</span>
                    {' → '}
                    <span className={o.reserveRiskDelta.improved === true ? 'text-emerald-700 font-medium' : o.reserveRiskDelta.improved === false ? 'text-red-700' : ''}>
                      {o.reserveRiskDelta.after ?? '—'}
                    </span>
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                {o.hasBaseline
                  ? <DeltaCell delta={o.failureRateDelta.delta} improved={o.failureRateDelta.improved} lowerIsBetter />
                  : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-xs">
                {o.resolutionDays !== null ? `${o.resolutionDays}d` : '—'}
              </TableCell>
              <TableCell><VerdictBadge verdict={o.verdict} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Outcomes() {
  const { data, isLoading } = useQuery<OutcomeSummary>({
    queryKey: ['/api/expansion/interventions/outcomes/summary'],
    refetchInterval: 60000,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BarChart2 className="w-7 h-7 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Intervention Outcomes</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Did the intervention actually improve the business? Before vs after on margin, friction, reserve pressure, and payout failures.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
            <Link href="/finance/interventions">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Intervention cases
              </span>
            </Link>
            <Link href="/finance/board-pack">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Board pack
              </span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : data ? (
          <>
            {/* Summary strip */}
            <SummaryStrip data={data} />

            {/* Baseline coverage notice */}
            <BaselineCoverage data={data} />

            {/* Effectiveness by decision */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Effectiveness by Decision Type</CardTitle>
                <CardDescription>
                  Which decisions work — success rate, average time to resolution, and economic delta per decision type.
                  Only resolved cases with economic baselines are counted toward success rate.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <ByDecisionTable rows={data.byDecision} />
              </CardContent>
            </Card>

            {/* Case-level before vs after */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Case-Level Before vs After</CardTitle>
                <CardDescription>
                  Per-case measurement across 4 metrics: margin, friction, reserve risk, payout failure rate.
                  Cases without baselines are listed but cannot be measured.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <CaseOutcomesTable outcomes={data.caseOutcomes} />
              </CardContent>
            </Card>

            {/* Measurement methodology note */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-blue-700 space-y-1">
                  <div className="font-semibold mb-2">Measurement methodology</div>
                  <div><strong>Before</strong> = economic snapshot captured when the case was created (margin %, friction %, reserve risk, payout failure rate)</div>
                  <div><strong>After</strong> = current live economics from settlement and treasury state</div>
                  <div><strong>Success</strong> = resolved case where 2 or more metrics improved vs baseline</div>
                  <div><strong>No baseline</strong> = case created before outcome measurement was enabled, or entity has no direct settlement mapping</div>
                </div>
              </CardContent>
            </Card>

            {/* Drilldown footer */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
              <span className="font-medium">Economics sourced from:</span>
              {[
                ['/treasury', 'Settlements & payouts'],
                ['/finance/profitability', 'Unit economics'],
                ['/finance/board-pack', 'Board pack signals'],
                ['/finance/policy', 'Policy refinement'],
              ].map(([href, lbl]) => (
                <Link key={href} href={href}>
                  <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                    {lbl} <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <EmptyState msg="No outcome data available" />
        )}

      </div>
    </div>
  );
}
