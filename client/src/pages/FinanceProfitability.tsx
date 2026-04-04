import { useState } from 'react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Building2,
  ArrowRight, BarChart3, Shield, CheckCircle2, XCircle, Info,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (match unit-economics.ts output exactly)
// ---------------------------------------------------------------------------

interface StationEconomics {
  stationId: number;
  stationName: string;
  ownershipType: string;
  franchiseOwnerId: number | null;
  franchiseOwnerName: string | null;
  grossRevenueCents: number;
  platformFeeCents: number;
  stationPayoutCents: number;
  franchiseShareCents: number;
  heldAmountCents: number;
  blockedAmountCents: number;
  failedPayoutCents: number;
  delayedApprovalCents: number;
  frictionCostCents: number;
  netReleasableContributionCents: number;
  contributionMarginPct: number;
  disputeRate: number;
  payoutFailureRate: number;
  reserveAgeRisk: 'none' | 'low' | 'medium' | 'high';
  capitalPriority: 'invest' | 'maintain' | 'watch' | 'restrict';
  capitalSignal: { signal: string; confidence: number; reasonCodes: string[]; explanation: string };
  settlementCount: number;
}

interface NetworkEconomics {
  ownerId: string;
  ownerName: string;
  ownershipType: string;
  stationCount: number;
  grossRevenueCents: number;
  netReleasableContributionCents: number;
  contributionMarginPct: number;
  heldAmountCents: number;
  reserve31PlusCents: number;
  failedPayoutCents: number;
  blockedAmountCents: number;
  frictionCostCents: number;
  riskAdjustedScore: number;
}

interface OwnershipBlock {
  ownershipType: string;
  stationCount: number;
  grossRevenueCents: number;
  netContributionCents: number;
  marginPct: number;
  heldAmountCents: number;
  blockedAmountCents: number;
  reserve31PlusCents: number;
  payoutFailureRate: number;
  approvalDelayRate: number;
  avgSettlementCycleDays: number | null;
}

interface CapitalSignal {
  entityType: string;
  entityId: number;
  entityName: string;
  ownershipType: string;
  signal: string;
  confidence: number;
  reasonCodes: string[];
  explanation: string;
  grossRevenueCents: number;
  contributionMarginPct: number;
  frictionCostCents: number;
  capitalPriority: string;
}

interface FrictionStation {
  stationId: number;
  stationName: string;
  ownershipType: string;
  disputeBlockedCents: number;
  reserveHeldCents: number;
  approvalPendingCents: number;
  payoutFailureCents: number;
  mismatchAffectedCents: number;
  frictionTotalCents: number;
  frictionPctOfGross: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ils(cents: number | null | undefined) {
  const n = cents ?? 0;
  return `₪${(n / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PRIORITY_CONFIG = {
  invest:    { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <TrendingUp className="w-3 h-3" /> },
  maintain:  { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Minus className="w-3 h-3" /> },
  watch:     { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: <AlertTriangle className="w-3 h-3" /> },
  restrict:  { bg: 'bg-red-100 text-red-800 border-red-200', icon: <TrendingDown className="w-3 h-3" /> },
};

const SIGNAL_CONFIG: Record<string, { color: string; label: string }> = {
  invest_more:               { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Invest more' },
  maintain:                  { color: 'text-blue-700 bg-blue-50 border-blue-200', label: 'Maintain' },
  operational_fix_first:     { color: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Fix operations first' },
  freeze_expansion:          { color: 'text-orange-700 bg-orange-50 border-orange-200', label: 'Freeze expansion' },
  review_franchise:          { color: 'text-purple-700 bg-purple-50 border-purple-200', label: 'Review franchise' },
  treasury_attention_required: { color: 'text-red-700 bg-red-50 border-red-200', label: 'Treasury attention' },
};

const REASON_LABELS: Record<string, string> = {
  strong_margin_low_friction: 'Clean margin',
  high_reserve_age: 'Aged reserve',
  repeated_failed_payouts: 'Repeated failures',
  low_margin_high_dispute: 'Dispute drag',
  approval_backlog: 'Approval backlog',
  blocked_cash_pressure: 'Cash blocked',
};

function PriorityBadge({ p }: { p: StationEconomics['capitalPriority'] }) {
  const cfg = PRIORITY_CONFIG[p] ?? PRIORITY_CONFIG.maintain;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
      {cfg.icon} {p}
    </span>
  );
}

function MarginBar({ pct, max = 50 }: { pct: number; max?: number }) {
  const clamped = Math.max(0, Math.min(pct, max));
  const w = Math.round((clamped / max) * 100);
  const color = pct >= 20 ? 'bg-emerald-500' : pct >= 10 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function RiskScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[70px]">
      <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right">{score}</span>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{msg}</div>;
}

// ---------------------------------------------------------------------------
// Section 1: KPI strip
// ---------------------------------------------------------------------------

function KPIStrip({ kpis }: { kpis: any }) {
  const cards = [
    { label: 'Gross Network Revenue', value: ils(kpis.grossNetworkRevenueCents), note: 'All settlements', color: 'border-gray-200' },
    { label: 'Net Releasable Contribution', value: ils(kpis.netReleasableContributionCents), note: 'After friction', color: 'border-emerald-200 bg-emerald-50' },
    { label: 'Contribution Margin', value: `${kpis.contributionMarginPct?.toFixed(1)}%`, note: 'Net / gross', color: kpis.contributionMarginPct >= 15 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50' },
    { label: 'Held Capital', value: ils(kpis.heldCapitalCents), note: 'Reserve / hold', color: kpis.heldCapitalCents > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200' },
    { label: 'Blocked Capital', value: ils(kpis.blockedCapitalCents), note: 'Disputes', color: kpis.blockedCapitalCents > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200' },
    { label: 'Friction Cost', value: ils(kpis.frictionCostCents), note: 'Disputes + reserve + failed + delayed', color: kpis.frictionCostCents > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(k => (
        <Card key={k.label} className={`border ${k.color}`}>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="text-xs text-muted-foreground mb-1">{k.label}</div>
            <div className="text-lg font-bold leading-tight">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.note}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Station profitability table
// ---------------------------------------------------------------------------

function StationTable({ stations }: { stations: StationEconomics[] }) {
  const [sort, setSort] = useState('contribution');

  const sorted = [...stations].sort((a, b) => {
    if (sort === 'margin') return b.contributionMarginPct - a.contributionMarginPct;
    if (sort === 'friction') return b.frictionCostCents - a.frictionCostCents;
    if (sort === 'reserve') return b.heldAmountCents - a.heldAmountCents;
    return b.netReleasableContributionCents - a.netReleasableContributionCents;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{stations.length} station(s)</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contribution">Net contribution</SelectItem>
              <SelectItem value="margin">Margin %</SelectItem>
              <SelectItem value="friction">Highest friction</SelectItem>
              <SelectItem value="reserve">Reserve pressure</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {stations.length === 0
        ? <EmptyState msg="No settlement data for stations" />
        : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net contribution</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead className="text-right text-red-600">Friction</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(s => (
                  <TableRow key={s.stationId}>
                    <TableCell>
                      <div className="font-medium text-sm">{s.stationName}</div>
                      <div className="text-xs text-muted-foreground">#{s.stationId} · {s.settlementCount} settlements</div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.ownershipType === 'company' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                        {s.ownershipType === 'company' ? 'Company' : 'Franchise'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{ils(s.grossRevenueCents)}</TableCell>
                    <TableCell className="text-right font-bold">{ils(s.netReleasableContributionCents)}</TableCell>
                    <TableCell><MarginBar pct={s.contributionMarginPct} /></TableCell>
                    <TableCell className={`text-right text-sm ${s.frictionCostCents > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {s.frictionCostCents > 0 ? ils(s.frictionCostCents) : '—'}
                    </TableCell>
                    <TableCell><PriorityBadge p={s.capitalPriority} /></TableCell>
                    <TableCell>
                      <Link href={`/treasury`}>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Franchise / company network comparison
// ---------------------------------------------------------------------------

function NetworkTable({ network }: { network: NetworkEconomics[] }) {
  if (!network?.length) return <EmptyState msg="No network data" />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Owner / Network</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Net contribution</TableHead>
            <TableHead>Margin</TableHead>
            <TableHead className="text-right text-amber-600">Held</TableHead>
            <TableHead className="text-right text-red-600">Failed</TableHead>
            <TableHead>Risk score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {network.map(n => (
            <TableRow key={n.ownerId} className={n.riskAdjustedScore < 30 ? 'bg-red-50' : ''}>
              <TableCell>
                <div className="font-medium text-sm">{n.ownerName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${n.ownershipType === 'company' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                    {n.ownershipType === 'company' ? 'Company' : 'Franchise'}
                  </span>
                  <span className="text-xs text-muted-foreground">{n.stationCount} station(s)</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{ils(n.grossRevenueCents)}</TableCell>
              <TableCell className="text-right font-bold">{ils(n.netReleasableContributionCents)}</TableCell>
              <TableCell><MarginBar pct={n.contributionMarginPct} /></TableCell>
              <TableCell className={`text-right text-sm ${n.heldAmountCents > 0 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                {n.heldAmountCents > 0 ? ils(n.heldAmountCents) : '—'}
              </TableCell>
              <TableCell className={`text-right text-sm ${n.failedPayoutCents > 0 ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
                {n.failedPayoutCents > 0 ? ils(n.failedPayoutCents) : '—'}
              </TableCell>
              <TableCell><RiskScoreBar score={n.riskAdjustedScore} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Ownership model comparison (side-by-side)
// ---------------------------------------------------------------------------

function OwnershipPanel({ data }: { data: { company_owned: OwnershipBlock; franchise_owned: OwnershipBlock } }) {
  const { company_owned: co, franchise_owned: fr } = data;
  const rows = [
    { label: 'Stations', co: co.stationCount, fr: fr.stationCount, fmt: (v: any) => v },
    { label: 'Gross revenue', co: co.grossRevenueCents, fr: fr.grossRevenueCents, fmt: ils },
    { label: 'Net contribution', co: co.netContributionCents, fr: fr.netContributionCents, fmt: ils },
    { label: 'Margin %', co: co.marginPct, fr: fr.marginPct, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: 'Held capital', co: co.heldAmountCents, fr: fr.heldAmountCents, fmt: ils },
    { label: 'Blocked capital', co: co.blockedAmountCents, fr: fr.blockedAmountCents, fmt: ils },
    { label: '31+ reserve', co: co.reserve31PlusCents, fr: fr.reserve31PlusCents, fmt: ils },
    { label: 'Payout failure rate', co: co.payoutFailureRate, fr: fr.payoutFailureRate, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: 'Approval delay rate', co: co.approvalDelayRate, fr: fr.approvalDelayRate, fmt: (v: number) => `${v.toFixed(1)}%` },
  ];

  function betterFor(row: { co: any; fr: any; label: string }): 'co' | 'fr' | 'equal' {
    const reverseMetrics = ['Held capital', 'Blocked capital', '31+ reserve', 'Payout failure rate', 'Approval delay rate'];
    if (typeof row.co !== 'number' || typeof row.fr !== 'number' || row.co === row.fr) return 'equal';
    if (reverseMetrics.includes(row.label)) return row.co < row.fr ? 'co' : 'fr';
    return row.co > row.fr ? 'co' : 'fr';
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Metric</TableHead>
            <TableHead className="text-center bg-blue-50">Company-owned</TableHead>
            <TableHead className="text-center bg-purple-50">Franchise-owned</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const winner = betterFor(row);
            return (
              <TableRow key={row.label}>
                <TableCell className="text-xs font-medium text-muted-foreground">{row.label}</TableCell>
                <TableCell className={`text-center font-semibold text-sm ${winner === 'co' ? 'text-emerald-700' : ''}`}>
                  {row.fmt(row.co)}
                  {winner === 'co' && <CheckCircle2 className="w-3 h-3 text-emerald-500 inline ml-1" />}
                </TableCell>
                <TableCell className={`text-center font-semibold text-sm ${winner === 'fr' ? 'text-emerald-700' : ''}`}>
                  {row.fmt(row.fr)}
                  {winner === 'fr' && <CheckCircle2 className="w-3 h-3 text-emerald-500 inline ml-1" />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Capital signals queue
// ---------------------------------------------------------------------------

function SignalsQueue({ signals }: { signals: CapitalSignal[] }) {
  if (!signals?.length) return <EmptyState msg="No signals generated" />;
  return (
    <div className="space-y-2">
      {signals.map((sig, i) => {
        const cfg = SIGNAL_CONFIG[sig.signal] ?? SIGNAL_CONFIG.maintain;
        return (
          <div key={i} className={`border rounded-lg px-4 py-3 ${cfg.color}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{sig.entityName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-muted-foreground">Confidence: {sig.confidence}%</span>
                </div>
                <div className="text-xs italic mb-1">{sig.explanation}</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sig.reasonCodes.map(code => (
                    <span key={code} className="text-xs bg-white bg-opacity-60 border rounded px-1.5 py-0.5">
                      {REASON_LABELS[code] ?? code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">Gross</div>
                <div className="font-mono text-sm font-bold">{ils(sig.grossRevenueCents)}</div>
                <div className="text-xs mt-1">Margin: {sig.contributionMarginPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 6: Friction analytics
// ---------------------------------------------------------------------------

function FrictionTable({ stations, totals }: { stations: FrictionStation[]; totals: any }) {
  if (!stations?.length) return <EmptyState msg="No friction data" />;
  return (
    <div className="space-y-3">
      {/* Network totals row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
        {[
          ['Dispute blocked', totals.disputeBlockedCents, 'text-orange-700'],
          ['Reserve held', totals.reserveHeldCents, 'text-amber-700'],
          ['Approval pending', totals.approvalPendingCents, 'text-blue-700'],
          ['Payout failures', totals.payoutFailureCents, 'text-red-700'],
          ['Mismatch affected', totals.mismatchAffectedCents, 'text-purple-700'],
          ['Total friction', totals.frictionTotalCents, 'text-red-800 font-bold'],
        ].map(([label, val, color]) => (
          <div key={label as string} className="bg-white rounded-lg p-2 border text-center">
            <div className="text-muted-foreground mb-0.5">{label}</div>
            <div className={`font-semibold ${color}`}>{ils(val as number)}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Station</TableHead>
              <TableHead className="text-right text-orange-600">Disputes</TableHead>
              <TableHead className="text-right text-amber-600">Reserve</TableHead>
              <TableHead className="text-right text-blue-600">Approval</TableHead>
              <TableHead className="text-right text-red-600">Failed payout</TableHead>
              <TableHead className="text-right text-purple-600">Mismatch</TableHead>
              <TableHead className="text-right font-bold">Total friction</TableHead>
              <TableHead>% of gross</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.map(s => (
              <TableRow key={s.stationId} className={s.frictionPctOfGross > 20 ? 'bg-red-50' : ''}>
                <TableCell>
                  <div className="text-sm font-medium">{s.stationName}</div>
                  <div className="text-xs text-muted-foreground capitalize">{s.ownershipType}</div>
                </TableCell>
                <TableCell className={`text-right text-sm ${s.disputeBlockedCents > 0 ? 'text-orange-700 font-medium' : 'text-muted-foreground'}`}>
                  {s.disputeBlockedCents > 0 ? ils(s.disputeBlockedCents) : '—'}
                </TableCell>
                <TableCell className={`text-right text-sm ${s.reserveHeldCents > 0 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                  {s.reserveHeldCents > 0 ? ils(s.reserveHeldCents) : '—'}
                </TableCell>
                <TableCell className={`text-right text-sm ${s.approvalPendingCents > 0 ? 'text-blue-700 font-medium' : 'text-muted-foreground'}`}>
                  {s.approvalPendingCents > 0 ? ils(s.approvalPendingCents) : '—'}
                </TableCell>
                <TableCell className={`text-right text-sm ${s.payoutFailureCents > 0 ? 'text-red-700 font-bold' : 'text-muted-foreground'}`}>
                  {s.payoutFailureCents > 0 ? ils(s.payoutFailureCents) : '—'}
                </TableCell>
                <TableCell className={`text-right text-sm ${s.mismatchAffectedCents > 0 ? 'text-purple-700 font-medium' : 'text-muted-foreground'}`}>
                  {s.mismatchAffectedCents > 0 ? ils(s.mismatchAffectedCents) : '—'}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {s.frictionTotalCents > 0 ? ils(s.frictionTotalCents) : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden min-w-[40px]">
                      <div
                        className={`h-full rounded-full ${s.frictionPctOfGross > 20 ? 'bg-red-500' : s.frictionPctOfGross > 10 ? 'bg-amber-500' : 'bg-blue-400'}`}
                        style={{ width: `${Math.min(s.frictionPctOfGross * 2, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs w-10">{s.frictionPctOfGross.toFixed(1)}%</span>
                  </div>
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
// Main page
// ---------------------------------------------------------------------------

export default function FinanceProfitability() {
  const { data: stationData, isLoading: stationLoading } = useQuery<{ stations: StationEconomics[]; count: number }>({
    queryKey: ['/api/finance/profitability/stations'],
    refetchInterval: 120000,
  });

  const { data: networkData, isLoading: networkLoading } = useQuery<{ network: NetworkEconomics[]; count: number }>({
    queryKey: ['/api/finance/profitability/network'],
  });

  const { data: signalData, isLoading: signalLoading } = useQuery<{ signals: CapitalSignal[] }>({
    queryKey: ['/api/finance/capital-signals'],
  });

  const { data: ownershipData, isLoading: ownershipLoading } = useQuery<{ company_owned: OwnershipBlock; franchise_owned: OwnershipBlock }>({
    queryKey: ['/api/finance/ownership-comparison'],
  });

  const { data: frictionData, isLoading: frictionLoading } = useQuery<{ stations: FrictionStation[]; totals: any }>({
    queryKey: ['/api/finance/friction-analytics'],
  });

  const { data: summaryData } = useQuery<{ kpis: any; stationCount: number }>({
    queryKey: ['/api/finance/summary'],
    refetchInterval: 120000,
  });

  const stations = stationData?.stations ?? [];
  const criticalSignals = signalData?.signals?.filter(s =>
    s.signal === 'treasury_attention_required' || s.signal === 'freeze_expansion'
  ) ?? [];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BarChart3 className="w-7 h-7 text-violet-600" />
              <h1 className="text-2xl font-bold text-gray-900">Profitability & Capital Allocation</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Operational contribution after payment friction — not accounting profit
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/treasury/forecast">
              <span className="text-xs text-muted-foreground underline-offset-2 hover:underline cursor-pointer flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> Treasury forecast
              </span>
            </Link>
          </div>
        </div>

        {/* Critical signals banner */}
        {criticalSignals.length > 0 && (
          <div className="bg-red-600 text-white rounded-lg px-4 py-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">
              {criticalSignals.length} station(s) require immediate treasury or operational attention
            </span>
          </div>
        )}

        {/* 1. KPI strip */}
        {summaryData?.kpis
          ? <KPIStrip kpis={summaryData.kpis} />
          : <div className="grid grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-white rounded-lg animate-pulse" />)}</div>}

        {/* 2. Station profitability */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Station Profitability</CardTitle>
            <CardDescription>
              Net releasable contribution = platform fee + franchise share − failed payouts − friction. Each station sorted by real economic value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stationLoading
              ? <div className="h-32 bg-white rounded animate-pulse" />
              : <StationTable stations={stations} />}
          </CardContent>
        </Card>

        {/* 3. Network comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Franchise / Company Network Comparison</CardTitle>
            <CardDescription>Aggregated by owner — ranked by risk-adjusted score (higher is healthier)</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {networkLoading
              ? <div className="h-24 bg-white mx-4 rounded animate-pulse" />
              : <NetworkTable network={networkData?.network ?? []} />}
          </CardContent>
        </Card>

        {/* 4. Ownership model comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ownership Model Comparison</CardTitle>
            <CardDescription>Company-owned vs franchise-owned — honest side-by-side on the same metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {ownershipLoading
              ? <div className="h-32 bg-white rounded animate-pulse" />
              : ownershipData
                ? <OwnershipPanel data={ownershipData} />
                : <EmptyState msg="No ownership data" />}
          </CardContent>
        </Card>

        {/* 5. Capital signals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-500" /> Capital Allocation Signals
            </CardTitle>
            <CardDescription>
              Deterministic — signals are computed from real settlement state, not guessed. Every signal is explainable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signalLoading
              ? <div className="h-24 bg-white rounded animate-pulse" />
              : <SignalsQueue signals={signalData?.signals ?? []} />}
          </CardContent>
        </Card>

        {/* 6. Friction analytics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Economic Friction Analytics</CardTitle>
            <CardDescription>
              Where value is leaking operationally — disputes, reserves, approvals, failed payouts, mismatches
            </CardDescription>
          </CardHeader>
          <CardContent>
            {frictionLoading
              ? <div className="h-32 bg-white rounded animate-pulse" />
              : <FrictionTable stations={frictionData?.stations ?? []} totals={frictionData?.totals ?? {}} />}
          </CardContent>
        </Card>

        {/* Drilldown note (T198) */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
          <span className="font-medium">Every number traces to:</span>
          {[
            ['/treasury', 'Payout batches & reconciliation'],
            ['/treasury/forecast', 'Forecast & reserve ageing'],
            ['/financial-approvals', 'Approval queue'],
          ].map(([href, label]) => (
            <Link key={href} href={href}>
              <span className="flex items-center gap-1 hover:text-foreground cursor-pointer underline-offset-2 hover:underline">
                {label} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
