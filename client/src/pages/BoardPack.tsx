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
  XCircle, ArrowRight, LayoutDashboard, Shield, Building2,
  ChevronUp, ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExpansionSignal =
  | 'expand_now' | 'expand_carefully' | 'fix_operations_first'
  | 'freeze_capex' | 'review_franchise' | 'restructure' | 'maintain';

type NetworkGrade = 'A' | 'B' | 'C' | 'D' | 'E';
type OwnershipWinner = 'company' | 'franchise' | 'tie';
type BoardFlagSeverity = 'critical' | 'warning' | 'info';

interface StationScores {
  profitabilityScore: number;
  frictionScore: number;
  liquidityCleanlinessScore: number;
  expansionReadinessScore: number;
}

interface StationEconomicsSnapshot {
  grossRevenueILS: number;
  netReleasableContributionILS: number;
  contributionMarginPct: number;
  frictionCostILS: number;
  heldAmountILS: number;
  blockedAmountILS: number;
  failedPayoutILS: number;
  delayedApprovalILS: number;
}

interface ExpansionStationScore {
  stationId: number;
  stationName: string;
  ownershipType: string;
  franchiseOwnerId: number | null;
  economics: StationEconomicsSnapshot;
  scores: StationScores;
  recommendation: ExpansionSignal;
  confidence: number;
  reasons: string[];
}

interface NetworkHealthGrade {
  ownerKey: string;
  ownerName: string;
  ownershipType: string;
  grade: NetworkGrade;
  score: number;
  reasons: string[];
}

interface OwnershipComparisonDecision {
  winner: OwnershipWinner;
  deltaMarginPct: number;
  deltaHeldILS: number;
  deltaBlockedILS: number;
  explanation: string[];
}

interface BoardFlag {
  entityType: 'station' | 'network' | 'system';
  entityId: number | string;
  entityName: string;
  flagType: string;
  severity: BoardFlagSeverity;
  explanation: string;
}

interface BoardPackSummary {
  executiveKpis: {
    networkGrossRevenueILS: number;
    networkNetContributionILS: number;
    networkMarginPct: number;
    heldCapitalILS: number;
    blockedCapitalILS: number;
    totalFrictionILS: number;
  };
  stations: ExpansionStationScore[];
  networks: NetworkHealthGrade[];
  ownershipDecision: OwnershipComparisonDecision;
  boardFlags: BoardFlag[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ils(v: number | null | undefined) {
  return `₪${(v ?? 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const SIGNAL_CFG: Record<ExpansionSignal, { label: string; color: string; icon: React.ReactNode }> = {
  expand_now:            { label: 'Expand now',           color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: <TrendingUp className="w-3 h-3" /> },
  expand_carefully:      { label: 'Expand carefully',     color: 'bg-blue-100 text-blue-800 border-blue-300',         icon: <TrendingUp className="w-3 h-3" /> },
  fix_operations_first:  { label: 'Fix ops first',        color: 'bg-amber-100 text-amber-800 border-amber-300',      icon: <AlertTriangle className="w-3 h-3" /> },
  freeze_capex:          { label: 'Freeze capex',         color: 'bg-orange-100 text-orange-800 border-orange-300',   icon: <Minus className="w-3 h-3" /> },
  review_franchise:      { label: 'Review franchise',     color: 'bg-purple-100 text-purple-800 border-purple-300',   icon: <AlertTriangle className="w-3 h-3" /> },
  restructure:           { label: 'Restructure',          color: 'bg-red-100 text-red-800 border-red-300',            icon: <TrendingDown className="w-3 h-3" /> },
  maintain:              { label: 'Maintain',             color: 'bg-white text-gray-700 border-gray-300',         icon: <Minus className="w-3 h-3" /> },
};

const GRADE_CFG: Record<NetworkGrade, { color: string; label: string }> = {
  A: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Excellent' },
  B: { color: 'text-blue-700 bg-blue-50 border-blue-200',         label: 'Good' },
  C: { color: 'text-amber-700 bg-amber-50 border-amber-200',      label: 'Acceptable' },
  D: { color: 'text-orange-700 bg-orange-50 border-orange-200',   label: 'Weak' },
  E: { color: 'text-red-700 bg-red-50 border-red-200',            label: 'Critical' },
};

const REASON_LABELS: Record<string, string> = {
  clean_high_margin: 'Clean margin',
  healthy_but_not_perfect: 'Healthy',
  low_margin: 'Low margin',
  treasury_risk: 'Treasury risk',
  capital_restricted: 'Capital restricted',
  stable: 'Stable',
  missing_data: 'Insufficient data',
  margins_comparable: 'Margins comparable',
  company_sites_outperform_margin: 'Company outperforms',
  franchise_sites_outperform_margin: 'Franchise outperforms',
  company_has_more_payout_failures: 'Company: more failures',
  franchise_has_more_payout_failures: 'Franchise: more failures',
  company_holds_less_capital: 'Company holds less',
  franchise_holds_less_capital: 'Franchise holds less',
  meets_threshold: 'Meets threshold',
  low_friction: 'Low friction',
  friction_heavy: 'Friction heavy',
};

function label(code: string) { return REASON_LABELS[code] ?? code; }

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-6 text-right">{Math.round(value)}</span>
    </div>
  );
}

function SignalBadge({ signal }: { signal: ExpansionSignal }) {
  const cfg = SIGNAL_CFG[signal] ?? SIGNAL_CFG.maintain;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function GradeBadge({ grade }: { grade: NetworkGrade }) {
  const cfg = GRADE_CFG[grade];
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 font-black text-base ${cfg.color}`}>
      {grade}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{msg}</div>;
}

// ---------------------------------------------------------------------------
// Section 1: Executive KPI strip
// ---------------------------------------------------------------------------

function KPIStrip({ kpis }: { kpis: BoardPackSummary['executiveKpis'] }) {
  const cards = [
    { label: 'Network Gross Revenue', value: ils(kpis.networkGrossRevenueILS), sub: 'All settlements', hi: false },
    { label: 'Net Releasable Contribution', value: ils(kpis.networkNetContributionILS), sub: 'After friction', hi: true },
    { label: 'Contribution Margin', value: `${kpis.networkMarginPct.toFixed(1)}%`, sub: 'Net / gross', hi: kpis.networkMarginPct >= 15 },
    { label: 'Held Capital', value: ils(kpis.heldCapitalILS), sub: 'Reserve / hold', hi: false, warn: kpis.heldCapitalILS > 0 },
    { label: 'Blocked Capital', value: ils(kpis.blockedCapitalILS), sub: 'Disputes', hi: false, warn: kpis.blockedCapitalILS > 0 },
    { label: 'Total Friction Cost', value: ils(kpis.totalFrictionILS), sub: 'Disputes + reserve + failures', hi: false, warn: kpis.totalFrictionILS > 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(k => (
        <Card key={k.label} className={`border ${k.warn ? 'border-amber-200 bg-amber-50' : k.hi ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="text-xs text-muted-foreground mb-1">{k.label}</div>
            <div className="text-lg font-bold leading-tight">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Board flags (critical items first)
// ---------------------------------------------------------------------------

function BoardFlags({ flags }: { flags: BoardFlag[] }) {
  if (!flags.length) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4" />
        No red-flag conditions detected. All entities within normal thresholds.
      </div>
    );
  }

  const critical = flags.filter(f => f.severity === 'critical');
  const warnings = flags.filter(f => f.severity === 'warning');

  return (
    <div className="space-y-2">
      {critical.map((f, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Critical</span>
              <span className="text-xs text-muted-foreground">{f.entityName}</span>
              <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">{f.flagType}</span>
            </div>
            <div className="text-sm text-red-800">{f.explanation}</div>
          </div>
          <Link href={`/treasury`}>
            <ArrowRight className="w-3.5 h-3.5 text-red-400 hover:text-red-700 cursor-pointer mt-0.5" />
          </Link>
        </div>
      ))}
      {warnings.map((f, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Warning</span>
              <span className="text-xs text-muted-foreground">{f.entityName}</span>
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{f.flagType}</span>
            </div>
            <div className="text-sm text-amber-800">{f.explanation}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Station investment ranking
// ---------------------------------------------------------------------------

function StationRanking({ stations }: { stations: ExpansionStationScore[] }) {
  const ranked = [...stations].sort((a, b) => b.scores.expansionReadinessScore - a.scores.expansionReadinessScore);

  if (!ranked.length) return <EmptyState msg="No station data" />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6">#</TableHead>
            <TableHead>Station</TableHead>
            <TableHead>Ownership</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Net contribution</TableHead>
            <TableHead>Margin</TableHead>
            <TableHead>Profitability</TableHead>
            <TableHead>Friction</TableHead>
            <TableHead>Liquidity</TableHead>
            <TableHead className="font-bold">Readiness</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((s, idx) => (
            <TableRow key={s.stationId} className={s.recommendation === 'expand_now' ? 'bg-emerald-50' : s.recommendation === 'restructure' || s.recommendation === 'freeze_capex' ? 'bg-red-50' : ''}>
              <TableCell className="text-xs text-muted-foreground font-bold">{idx + 1}</TableCell>
              <TableCell>
                <div className="font-medium text-sm">{s.stationName}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-1 mt-0.5">
                  {s.reasons.map(rc => (
                    <span key={rc} className="bg-white text-gray-600 px-1 rounded">{label(rc)}</span>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${s.ownershipType === 'company' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                  {s.ownershipType === 'company' ? 'Company' : 'Franchise'}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{ils(s.economics.grossRevenueILS)}</TableCell>
              <TableCell className="text-right font-bold">{ils(s.economics.netReleasableContributionILS)}</TableCell>
              <TableCell className="text-sm">{s.economics.contributionMarginPct.toFixed(1)}%</TableCell>
              <TableCell><ScoreBar value={s.scores.profitabilityScore} /></TableCell>
              <TableCell><ScoreBar value={s.scores.frictionScore} /></TableCell>
              <TableCell><ScoreBar value={s.scores.liquidityCleanlinessScore} /></TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <ScoreBar value={s.scores.expansionReadinessScore} />
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <SignalBadge signal={s.recommendation} />
                  <div className="text-xs text-muted-foreground">conf. {s.confidence}%</div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Network health grades
// ---------------------------------------------------------------------------

function NetworkGrades({ networks }: { networks: NetworkHealthGrade[] }) {
  if (!networks.length) return <EmptyState msg="No network data" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {networks.map(n => {
        const cfg = GRADE_CFG[n.grade];
        return (
          <div key={n.ownerKey} className={`border rounded-lg p-4 ${cfg.color}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{n.ownerName}</div>
                <div className="text-xs capitalize mt-0.5">{n.ownershipType}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {n.reasons.map(rc => (
                    <span key={rc} className="text-xs bg-white bg-opacity-60 border rounded px-1.5 py-0.5">
                      {label(rc)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <GradeBadge grade={n.grade} />
                <div className="text-xs mt-1 font-mono">{n.score}/100</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Ownership model decision
// ---------------------------------------------------------------------------

function OwnershipDecision({ decision }: { decision: OwnershipComparisonDecision }) {
  const { winner, deltaMarginPct, deltaHeldILS, deltaBlockedILS, explanation } = decision;

  const winnerLabel = winner === 'company' ? 'Company-owned outperforms' : winner === 'franchise' ? 'Franchise-owned outperforms' : 'Performance is comparable';
  const winnerColor = winner === 'tie'
    ? 'bg-white border-gray-200 text-gray-700'
    : 'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <div className="space-y-3">
      <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${winnerColor}`}>
        {winner === 'tie' ? <Minus className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        <span className="font-semibold text-sm">{winnerLabel}</span>
        {winner !== 'tie' && (
          <span className="text-sm">{Math.abs(deltaMarginPct).toFixed(1)}pp margin advantage</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-muted-foreground mb-1">Margin delta</div>
          <div className={`flex items-center gap-1 font-bold text-lg ${deltaMarginPct > 0 ? 'text-blue-700' : deltaMarginPct < 0 ? 'text-purple-700' : 'text-gray-600'}`}>
            {deltaMarginPct > 0 ? <ChevronUp className="w-4 h-4" /> : deltaMarginPct < 0 ? <ChevronDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            {Math.abs(deltaMarginPct).toFixed(1)}pp
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Company − Franchise</div>
        </div>
        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-muted-foreground mb-1">Held capital delta</div>
          <div className="font-bold text-lg">{ils(Math.abs(deltaHeldILS))}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{deltaHeldILS < 0 ? 'Franchise holds more' : deltaHeldILS > 0 ? 'Company holds more' : 'Equal'}</div>
        </div>
        <div className="border rounded-lg p-3 bg-white">
          <div className="text-xs text-muted-foreground mb-1">Blocked capital delta</div>
          <div className="font-bold text-lg">{ils(Math.abs(deltaBlockedILS))}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{deltaBlockedILS < 0 ? 'Franchise blocks more' : deltaBlockedILS > 0 ? 'Company blocks more' : 'Equal'}</div>
        </div>
      </div>

      {explanation.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {explanation.map(e => (
            <span key={e} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
              {label(e)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BoardPack() {
  const { data, isLoading } = useQuery<BoardPackSummary>({
    queryKey: ['/api/expansion/board-pack'],
    refetchInterval: 180000,
  });

  const criticalFlags = data?.boardFlags.filter(f => f.severity === 'critical') ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <LayoutDashboard className="w-7 h-7 text-slate-700" />
              <h1 className="text-2xl font-bold text-gray-900">Board Pack</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Expansion decisions built from settlement truth — all scores are deterministic, all recommendations are explainable
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground">
            <Link href="/finance/profitability">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Profitability
              </span>
            </Link>
            <Link href="/treasury/forecast">
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer hover:underline underline-offset-2">
                <ArrowRight className="w-3 h-3" /> Treasury forecast
              </span>
            </Link>
          </div>
        </div>

        {/* Critical flags banner */}
        {!isLoading && criticalFlags.length > 0 && (
          <div className="bg-red-600 text-white rounded-lg px-4 py-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">
              {criticalFlags.length} critical condition(s) require board or treasury intervention
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : data ? (
          <>
            {/* 1. KPI strip */}
            <KPIStrip kpis={data.executiveKpis} />

            {/* 2. Board flags */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-500" /> Red-Flag Conditions
                </CardTitle>
                <CardDescription>
                  Deterministic flags from treasury state — critical items require immediate action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BoardFlags flags={data.boardFlags} />
              </CardContent>
            </Card>

            {/* 3. Investment priority ranking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Investment Priority Ranking</CardTitle>
                <CardDescription>
                  Stations ranked by expansion readiness (profitability × 45% + friction-cleanliness × 35% + liquidity × 20%).
                  Every score traces to settlement economics.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <StationRanking stations={data.stations} />
              </CardContent>
            </Card>

            {/* 4. Network health grades */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" /> Franchise & Network Health Grades
                </CardTitle>
                <CardDescription>
                  A = excellent (score ≥85) · B = good · C = acceptable · D = weak · E = critical intervention required
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NetworkGrades networks={data.networks} />
              </CardContent>
            </Card>

            {/* 5. Ownership model decision */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ownership Model Decision</CardTitle>
                <CardDescription>
                  Which model is performing better on a margin, held capital, and friction basis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OwnershipDecision decision={data.ownershipDecision} />
              </CardContent>
            </Card>

            {/* Drilldown footer */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center border-t pt-4">
              <span className="font-medium">All scores computed from:</span>
              {[
                ['/treasury', 'Settlements & payouts'],
                ['/treasury/forecast', 'Reserve & liquidity'],
                ['/finance/profitability', 'Unit economics'],
                ['/financial-approvals', 'Approval queue'],
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
          <EmptyState msg="No board pack data available" />
        )}

      </div>
    </div>
  );
}
