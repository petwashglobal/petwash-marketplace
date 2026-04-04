import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Clock, TrendingUp,
  TrendingDown, Info, ArrowRight, Lightbulb, BarChart2, Activity,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirror server/lib/learning-policy.ts)
// ---------------------------------------------------------------------------

type ConfidenceLevel = 'confident' | 'directional' | 'insufficient_data';
type PolicyAction = 'tighten' | 'relax' | 'retire' | 'retain' | 'review' | 'monitor' | 'escalate';

interface SignalCalibration {
  flagType: string;
  label: string;
  totalFired: number;
  resolvedWithBaseline: number;
  successRate: number | null;
  avgResolutionDays: number | null;
  currentlyActive: boolean;
  confidence: ConfidenceLevel;
  recommendation: string;
  suggestedAction: PolicyAction;
}

interface DecisionEffectiveness {
  decision: string;
  label: string;
  rank: number;
  totalCases: number;
  successRate: number | null;
  avgResolutionDays: number | null;
  avgMarginImprovement: number | null;
  confidence: ConfidenceLevel;
  assessment: string;
}

interface ChronicEntity {
  entityType: string;
  entityId: string;
  entityName: string;
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  lastCaseDate: string;
  riskLevel: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface PolicyRecommendation {
  id: string;
  area: 'signal_threshold' | 'decision_playbook' | 'capital_rules' | 'entity_escalation' | 'approval_friction' | 'data_quality';
  priority: 'critical' | 'high' | 'medium' | 'low';
  finding: string;
  recommendation: string;
  rationale: string;
  confidence: ConfidenceLevel;
  evidenceCount: number;
}

interface FrictionFeedback {
  totalFrictionIls: number;
  approvalDelayIls: number;
  reserveAgedIls: number;
  failedPayoutIls: number;
  openCasesLinkedToFriction: number;
  resolvedCasesLinkedToFriction: number;
  frictionResolutionRate: number | null;
  thresholdAssessment: string;
}

interface DataMaturity {
  totalCases: number;
  casesWithBaseline: number;
  resolvedCases: number;
  resolvedWithBaseline: number;
  baselineCoverageRate: number;
  measurementReadiness: 'accumulating' | 'directional' | 'sufficient';
  estimatedCasesUntilConfident: number | null;
  maturityNote: string;
}

interface PolicyFeedbackReport {
  generatedAt: string;
  dataMaturity: DataMaturity;
  signalCalibration: SignalCalibration[];
  decisionEffectiveness: DecisionEffectiveness[];
  chronicEntities: ChronicEntity[];
  policyRecommendations: PolicyRecommendation[];
  frictionFeedback: FrictionFeedback;
}

// ---------------------------------------------------------------------------
// Display constants
// ---------------------------------------------------------------------------

const CONFIDENCE_CFG: Record<ConfidenceLevel, { label: string; color: string; icon: React.ReactNode }> = {
  confident:        { label: 'Confident',    color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  directional:      { label: 'Directional',  color: 'text-amber-700 bg-amber-50 border-amber-200',       icon: <Activity className="w-3 h-3" /> },
  insufficient_data:{ label: 'Accumulating', color: 'text-gray-600 bg-white border-gray-200',          icon: <RefreshCw className="w-3 h-3" /> },
};

const PRIORITY_CFG: Record<string, { color: string; icon: React.ReactNode }> = {
  critical: { color: 'text-red-700 bg-red-50 border-red-200',       icon: <AlertCircle className="w-3.5 h-3.5" /> },
  high:     { color: 'text-orange-700 bg-orange-50 border-orange-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  medium:   { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Info className="w-3.5 h-3.5" /> },
  low:      { color: 'text-blue-700 bg-blue-50 border-blue-200',    icon: <Info className="w-3.5 h-3.5" /> },
};

const AREA_LABELS: Record<string, string> = {
  signal_threshold: 'Signal threshold',
  decision_playbook:'Decision playbook',
  capital_rules:    'Capital rules',
  entity_escalation:'Entity escalation',
  approval_friction:'Approval friction',
  data_quality:     'Data quality',
};

const ACTION_CFG: Record<PolicyAction, { label: string; color: string }> = {
  tighten:  { label: 'Tighten',  color: 'text-red-700 bg-red-50 border-red-200' },
  relax:    { label: 'Relax',    color: 'text-blue-700 bg-blue-50 border-blue-200' },
  retire:   { label: 'Retire',   color: 'text-gray-700 bg-white border-gray-300' },
  retain:   { label: 'Retain',   color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  review:   { label: 'Review',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
  monitor:  { label: 'Monitor',  color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  escalate: { label: 'Escalate', color: 'text-red-800 bg-red-100 border-red-300' },
};

const READINESS_CFG: Record<DataMaturity['measurementReadiness'], { label: string; color: string; bar: string }> = {
  accumulating: { label: 'Accumulating data',      color: 'border-gray-300 bg-white',    bar: 'bg-gray-400' },
  directional:  { label: 'Directional analysis',   color: 'border-amber-300 bg-amber-50',  bar: 'bg-amber-500' },
  sufficient:   { label: 'Sufficient for analysis', color: 'border-emerald-300 bg-emerald-50', bar: 'bg-emerald-500' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 0 });

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const cfg = CONFIDENCE_CFG[level];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority] ?? PRIORITY_CFG.low;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

function ActionBadge({ action }: { action: PolicyAction }) {
  const cfg = ACTION_CFG[action] ?? ACTION_CFG.monitor;
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function RateBar({ value, max = 100, color = 'bg-blue-500', label }: { value: number | null; max?: number; color?: string; label?: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground">Insufficient data</span>;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden min-w-[50px]">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-10">{label ?? `${Math.round(value)}%`}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Data maturity banner
// ---------------------------------------------------------------------------

function DataMaturityBanner({ maturity }: { maturity: DataMaturity }) {
  const cfg = READINESS_CFG[maturity.measurementReadiness];
  const pct = Math.min(100, (maturity.resolvedWithBaseline / 10) * 100);

  return (
    <Card className={`border ${cfg.color}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 shrink-0" />
              <span className="font-semibold text-sm">Measurement Readiness: {cfg.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{maturity.maturityNote}</p>
          </div>
          <div className="sm:w-56 shrink-0">
            <div className="text-xs text-muted-foreground mb-1">Progress to confident analysis (10 resolved+baseline)</div>
            <div className="h-2 bg-white rounded-full overflow-hidden">
              <div className={`h-full ${cfg.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
              <span>{maturity.resolvedWithBaseline} resolved</span>
              <span>target: 10</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t">
          {[
            ['Total cases', maturity.totalCases],
            ['With baseline', maturity.casesWithBaseline],
            ['Resolved', maturity.resolvedCases],
            ['Resolved + baseline', maturity.resolvedWithBaseline],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-bold">{val}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: Policy recommendations
// ---------------------------------------------------------------------------

function PolicyRecommendations({ recommendations }: { recommendations: PolicyRecommendation[] }) {
  if (!recommendations.length) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No policy recommendations generated yet. Accumulate resolved cases with baselines.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map(r => {
        const pCfg = PRIORITY_CFG[r.priority] ?? PRIORITY_CFG.low;
        return (
          <div key={r.id} className={`rounded-lg border p-4 ${r.priority === 'critical' ? 'border-red-200 bg-red-50' : r.priority === 'high' ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <PriorityBadge priority={r.priority} />
                <span className="text-xs text-muted-foreground font-medium bg-white border border-gray-200 px-2 py-0.5 rounded">{AREA_LABELS[r.area] ?? r.area}</span>
                <ConfidenceBadge level={r.confidence} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0 font-mono">{r.id}</span>
            </div>
            <div className="text-sm font-semibold mb-1">{r.finding}</div>
            <div className="text-sm text-foreground mb-1.5 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
              {r.recommendation}
            </div>
            <div className="text-xs text-muted-foreground italic">{r.rationale} ({r.evidenceCount} case(s))</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Signal calibration table
// ---------------------------------------------------------------------------

function SignalCalibrationTable({ rows }: { rows: SignalCalibration[] }) {
  if (!rows.length) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No flag-triggered cases yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Signal</TableHead>
            <TableHead className="text-right">Times fired</TableHead>
            <TableHead>Success rate</TableHead>
            <TableHead className="text-right">Avg resolution</TableHead>
            <TableHead>Currently active</TableHead>
            <TableHead>Suggested action</TableHead>
            <TableHead>Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.flagType}>
              <TableCell>
                <div className="font-medium text-sm">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.recommendation}</div>
              </TableCell>
              <TableCell className="text-right font-mono">{row.totalFired}</TableCell>
              <TableCell>
                <RateBar
                  value={row.successRate}
                  color={row.successRate !== null && row.successRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}
                />
              </TableCell>
              <TableCell className="text-right text-sm">
                {row.avgResolutionDays !== null ? `${row.avgResolutionDays}d` : '—'}
              </TableCell>
              <TableCell>
                {row.currentlyActive
                  ? <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium"><AlertCircle className="w-3 h-3" /> Active</span>
                  : <span className="text-xs text-muted-foreground">Inactive</span>}
              </TableCell>
              <TableCell><ActionBadge action={row.suggestedAction} /></TableCell>
              <TableCell><ConfidenceBadge level={row.confidence} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Decision effectiveness ranking
// ---------------------------------------------------------------------------

function DecisionRanking({ rows }: { rows: DecisionEffectiveness[] }) {
  if (!rows.length) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No decision data yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Rank</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead>Success rate</TableHead>
            <TableHead className="text-right">Avg resolution</TableHead>
            <TableHead>Avg margin Δ</TableHead>
            <TableHead>Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.decision}>
              <TableCell className="font-bold text-center text-sm">{row.rank}</TableCell>
              <TableCell>
                <div className="font-medium text-sm">{row.label}</div>
                <div className="text-xs text-muted-foreground max-w-xs">{row.assessment}</div>
              </TableCell>
              <TableCell className="text-right font-mono">{row.totalCases}</TableCell>
              <TableCell>
                <RateBar
                  value={row.successRate}
                  color={row.successRate !== null && row.successRate >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}
                />
              </TableCell>
              <TableCell className="text-right text-sm">
                {row.avgResolutionDays !== null ? `${row.avgResolutionDays}d` : '—'}
              </TableCell>
              <TableCell>
                {row.avgMarginImprovement !== null
                  ? <span className={`text-sm font-mono ${row.avgMarginImprovement > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {row.avgMarginImprovement > 0 ? '+' : ''}{row.avgMarginImprovement.toFixed(1)}%
                    </span>
                  : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell><ConfidenceBadge level={row.confidence} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Chronic entities
// ---------------------------------------------------------------------------

function ChronicEntities({ entities }: { entities: ChronicEntity[] }) {
  if (!entities.length) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No entities with repeated intervention cases detected.
      </div>
    );
  }

  const RISK_CFG = {
    high:   { color: 'border-red-200 bg-red-50',    badge: 'text-red-700 bg-red-100 border-red-200', icon: <AlertCircle className="w-4 h-4 text-red-600" /> },
    medium: { color: 'border-amber-200 bg-amber-50', badge: 'text-amber-700 bg-amber-100 border-amber-200', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
    low:    { color: 'border-gray-200 bg-white',     badge: 'text-gray-700 bg-white border-gray-200', icon: <Info className="w-4 h-4 text-gray-500" /> },
  };

  return (
    <div className="space-y-3">
      {entities.map(entity => {
        const cfg = RISK_CFG[entity.riskLevel];
        return (
          <div key={`${entity.entityType}:${entity.entityId}`} className={`rounded-lg border p-4 ${cfg.color}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {cfg.icon}
                <div>
                  <span className="font-semibold text-sm">{entity.entityName}</span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">{entity.entityType}</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${cfg.badge}`}>
                {entity.riskLevel.charAt(0).toUpperCase() + entity.riskLevel.slice(1)} risk
              </span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground mb-2">
              <span><b className="text-foreground">{entity.totalCases}</b> total cases</span>
              <span><b className="text-foreground">{entity.openCases}</b> open</span>
              <span><b className="text-foreground">{entity.resolvedCases}</b> resolved</span>
            </div>
            <p className="text-sm">{entity.recommendation}</p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Friction feedback
// ---------------------------------------------------------------------------

function FrictionFeedbackCard({ data }: { data: FrictionFeedback }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total friction', value: `₪${fmt(data.totalFrictionIls)}`, color: 'border-red-200 bg-red-50' },
          { label: 'Approval delay', value: `₪${fmt(data.approvalDelayIls)}`, color: 'border-orange-200 bg-orange-50' },
          { label: 'Reserve aged', value: `₪${fmt(data.reserveAgedIls)}`, color: 'border-amber-200 bg-amber-50' },
          { label: 'Failed payouts', value: `₪${fmt(data.failedPayoutIls)}`, color: 'border-red-200 bg-red-50' },
        ].map(item => (
          <Card key={item.label} className={`border ${item.color}`}>
            <CardContent className="pt-3 pb-2 px-3">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-lg font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Open cases linked to friction signals</div>
          <div className="text-xl font-bold">{data.openCasesLinkedToFriction}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Resolved cases linked to friction signals</div>
          <div className="text-xl font-bold">{data.resolvedCasesLinkedToFriction}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Friction case resolution rate</div>
          {data.frictionResolutionRate !== null
            ? <RateBar value={data.frictionResolutionRate} color="bg-blue-500" />
            : <span className="text-sm text-muted-foreground">No friction-linked cases</span>}
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
        <span className="font-semibold">Threshold assessment: </span>
        {data.thresholdAssessment}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PolicyFeedback() {
  const { data, isLoading } = useQuery<PolicyFeedbackReport>({
    queryKey: ['/api/expansion/policy/summary'],
    refetchInterval: 120000,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Lightbulb className="w-7 h-7 text-amber-500" />
              <h1 className="text-2xl font-bold text-gray-900">Policy Refinement & Capital Feedback</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Learning from measured intervention outcomes. What should change in signals, decision playbooks, capital rules, and operating policies.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
            <Link href="/finance/outcomes">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Outcome measurement
              </span>
            </Link>
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
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : data ? (
          <>
            {/* Data maturity */}
            <DataMaturityBanner maturity={data.dataMaturity} />

            {/* Policy recommendations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Policy Recommendations
                </CardTitle>
                <CardDescription>
                  Deterministic recommendations based on measured outcomes, signal performance, and structural patterns.
                  Confidence level indicates data quality behind each recommendation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PolicyRecommendations recommendations={data.policyRecommendations} />
              </CardContent>
            </Card>

            {/* Signal calibration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Signal Calibration
                </CardTitle>
                <CardDescription>
                  Which board signals fire effectively. Success rate measures resolved cases where economic baseline improved.
                  "Currently active" means the signal is firing in the live board pack right now.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <SignalCalibrationTable rows={data.signalCalibration} />
              </CardContent>
            </Card>

            {/* Decision effectiveness */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  Decision Effectiveness Ranking
                </CardTitle>
                <CardDescription>
                  Which decision types produce the best outcomes. Ranked by resolved cases with baseline — not total volume.
                  Use this to refine playbooks for each decision type.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <DecisionRanking rows={data.decisionEffectiveness} />
              </CardContent>
            </Card>

            {/* Chronic entities */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  Chronic Entities
                </CardTitle>
                <CardDescription>
                  Stations, networks, or franchises with 2 or more intervention cases.
                  Recurring cases on the same entity indicate systemic issues not addressed by individual decisions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChronicEntities entities={data.chronicEntities} />
              </CardContent>
            </Card>

            {/* Friction feedback */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  Approval Threshold & Friction Feedback
                </CardTitle>
                <CardDescription>
                  Live friction cost from the 12.19 economics engine, correlated with open and resolved intervention cases.
                  Informs whether approval thresholds are causing unnecessary friction relative to value protected.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FrictionFeedbackCard data={data.frictionFeedback} />
              </CardContent>
            </Card>

            {/* Footer note */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-amber-700 space-y-1">
                  <div className="font-semibold mb-1">Governing rules for this analysis</div>
                  <div>All inputs come exclusively from Phase 12.22 measured outcomes and the live 12.19 economics engine.</div>
                  <div>No retrospective numbers are invented. Cases without baselines remain <b>no_baseline</b> permanently.</div>
                  <div>Success rates are only computed when resolved cases have economic baselines.</div>
                  <div>Policy recommendations are deterministic rules, not statistical models — confidence degrades gracefully as sample size decreases.</div>
                </div>
              </CardContent>
            </Card>

            {/* Drilldown footer */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
              <span className="font-medium">Chain source:</span>
              {[
                ['/finance/outcomes', 'Outcome measurement (12.22)'],
                ['/finance/interventions', 'Intervention cases (12.21)'],
                ['/finance/board-pack', 'Board pack (12.20)'],
                ['/finance/profitability', 'Unit economics (12.19)'],
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
          <div className="py-12 text-center text-sm text-muted-foreground">No data available</div>
        )}

      </div>
    </div>
  );
}
