/**
 * NetworkOversight.tsx
 * Phase 12.15 — Executive Oversight & Network Health
 *
 * Route: /pet-wash-ltd/executive/oversight
 * Auth: franchise_owner / admin
 *
 * Sections:
 *   1. Network Risk   — dispute counts, SLA states, escalations, L2 pending
 *   2. Automation     — auto-resolution rate, trigger breakdown, top policies
 *   3. Breach Trends  — SLA breach timeline chart (last 30 days)
 *   4. Policy Impact  — before/after comparison for a chosen policy
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label }  from '@/components/ui/label';
import {
  AlertTriangle, CheckCircle2, ShieldCheck, TrendingDown, TrendingUp, Minus,
  Zap, RefreshCw, Network, BarChart2, GitBranch, Activity, Loader2,
  ArrowRight, Clock, ArrowDown, ArrowUp,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface NetworkRisk {
  disputes: { total: number; open: number; inReview: number; resolved: number; other: number };
  sla: { total: number; withinSla: number; atRisk: number; breached: number; breachRate: number };
  escalations7d:     number;
  pendingL2Approval: number;
  policyFires24h:    number;
  generatedAt:       string;
}

interface AutomationData {
  periodDays:          number;
  totalExecutions:     number;
  uniqueCasesHandled:  number;
  autoApproved:        number;
  flaggedForReview:    number;
  autoResolutionRate:  number;
  flaggedRate:         number;
  byTrigger:   Array<{ triggerEvent: string; fires: number }>;
  topPolicies: Array<{ policyId: number; policyName: string; policyType: string; fires: number; autoApproved: number }>;
}

interface BreachTrends {
  periodDays:     number;
  currentPeriod:  number;
  priorPeriod:    number;
  trendPct:       number | null;
  trendDirection: string;
  byDay:      Array<Record<string, any>>;
  byCaseType: Array<{ caseType: string; totalBreaches: number; avgAgeHours: number }>;
}

interface PolicyImpact {
  policy: { id: number; name: string; policyType: string; isActive: boolean };
  pivotDate: string;
  versions: Array<{ versionNumber: number; changeType: string; changedAt: string; changedBy: string }>;
  policyExecutions: {
    before: { totalFires: number; autoApproved: number; flagged: number };
    after:  { totalFires: number; autoApproved: number; flagged: number };
  };
  disputes: {
    before: { total: number; resolved: number; neededL2: number; resolutionRate: number | null };
    after:  { total: number; resolved: number; neededL2: number; resolutionRate: number | null };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CASE_TYPE_COLORS: Record<string, string> = {
  dispute:  '#3b82f6',
  mismatch: '#f59e0b',
  refund:   '#8b5cf6',
};

const POLICY_TYPE_COLORS: Record<string, string> = {
  approval_threshold: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  auto_routing:       'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  escalation_rule:    'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  playbook:           'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

function KpiCard({
  icon, label, value, sub, color, alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 flex flex-col gap-1.5',
      alert
        ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
        : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-white'
    )}>
      <div className={cn('flex items-center gap-2 text-xs font-medium', color ?? 'text-gray-500')}>
        {icon}{label}
      </div>
      <div className={cn('text-3xl font-bold tracking-tight', alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-black')}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-black">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white dark:bg-white overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-black">{title}</h2>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section: Network Risk ────────────────────────────────────────────────────

function NetworkRiskSection() {
  const q = useQuery<NetworkRisk>({
    queryKey: ['/api/executive/network-risk'],
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (q.isLoading) return (
    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  );

  const d = q.data!;

  return (
    <div>
      <SectionHeader icon={<Network className="h-4 w-4" />} title="Network Risk" sub={`Snapshot at ${new Date(d.generatedAt).toLocaleTimeString()}`} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Open Disputes"
          value={d.disputes.open} sub={`${d.disputes.inReview} in review`}
          color={d.disputes.open > 20 ? 'text-red-600' : 'text-orange-600'}
          alert={d.disputes.open > 20} />

        <KpiCard icon={<Activity className="h-3.5 w-3.5" />} label="SLA At-Risk"
          value={d.sla.atRisk} sub={`of ${d.sla.total} tracked`}
          color={d.sla.atRisk > 5 ? 'text-orange-600' : 'text-gray-500'}
          alert={d.sla.atRisk > 5} />

        <KpiCard icon={<TrendingDown className="h-3.5 w-3.5" />} label="SLA Breached"
          value={d.sla.breached} sub={`${d.sla.breachRate}% breach rate`}
          color={d.sla.breached > 0 ? 'text-red-600' : 'text-green-600'}
          alert={d.sla.breached > 0} />

        <KpiCard icon={<ArrowUp className="h-3.5 w-3.5" />} label="Escalations (7d)"
          value={d.escalations7d} sub="last 7 days"
          color={d.escalations7d > 10 ? 'text-orange-600' : 'text-gray-500'} />

        <KpiCard icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Pending L2"
          value={d.pendingL2Approval} sub="needs franchise owner"
          color={d.pendingL2Approval > 0 ? 'text-red-600' : 'text-green-600'}
          alert={d.pendingL2Approval > 0} />
      </div>

      {/* Dispute breakdown */}
      <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-4">
        <div className="text-xs font-medium text-gray-500 mb-3">Dispute status breakdown</div>
        <div className="flex items-center gap-4 flex-wrap">
          {[
            { label: 'Open',      value: d.disputes.open,     color: 'bg-red-500' },
            { label: 'In Review', value: d.disputes.inReview,  color: 'bg-orange-400' },
            { label: 'Resolved',  value: d.disputes.resolved,  color: 'bg-green-500' },
            { label: 'Other',     value: d.disputes.other,     color: 'bg-gray-300' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs">
              <div className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
              <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              <span className="font-semibold text-gray-900 dark:text-black">{item.value}</span>
            </div>
          ))}
          <div className="ml-auto text-xs text-gray-400">Policy fires (24h): <span className="font-semibold text-gray-700 dark:text-black">{d.policyFires24h}</span></div>
        </div>
        {/* Bar */}
        {d.disputes.total > 0 && (
          <div className="mt-2 h-2 rounded-full overflow-hidden flex">
            <div className="bg-red-500 h-full" style={{ width: `${(d.disputes.open / d.disputes.total) * 100}%` }} />
            <div className="bg-orange-400 h-full" style={{ width: `${(d.disputes.inReview / d.disputes.total) * 100}%` }} />
            <div className="bg-green-500 h-full" style={{ width: `${(d.disputes.resolved / d.disputes.total) * 100}%` }} />
            <div className="bg-white dark:bg-white h-full flex-1" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Automation Effectiveness ────────────────────────────────────────

function AutomationSection() {
  const [days, setDays] = useState('30');
  const q = useQuery<AutomationData>({
    queryKey: [`/api/executive/automation?days=${days}`],
    staleTime: 60_000,
  });

  if (q.isLoading) return (
    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  );

  const d = q.data!;

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <SectionHeader icon={<Zap className="h-4 w-4" />} title="Automation Effectiveness"
          sub={`Last ${d.periodDays} days · ${d.totalExecutions} policy executions`} />
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7d</SelectItem>
            <SelectItem value="30">Last 30d</SelectItem>
            <SelectItem value="90">Last 90d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rate bars */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-5 space-y-4">
          <div className="text-xs font-medium text-gray-500">Resolution Breakdown</div>
          <RateBar label="Auto-approved" value={d.autoResolutionRate} color="bg-green-500" />
          <RateBar label="Flagged for review" value={d.flaggedRate} color="bg-orange-400" />
          <RateBar label="Other / escalated" value={Math.max(0, 100 - d.autoResolutionRate - d.flaggedRate)} color="bg-gray-300 dark:bg-gray-600" />
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xl font-bold text-green-600">{d.autoApproved}</div>
              <div className="text-xs text-gray-500">auto-approved</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-700 dark:text-black">{d.uniqueCasesHandled}</div>
              <div className="text-xs text-gray-500">unique cases</div>
            </div>
          </div>
        </div>

        {/* Trigger breakdown */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-5">
          <div className="text-xs font-medium text-gray-500 mb-3">Fires by trigger</div>
          <div className="space-y-2">
            {d.byTrigger.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No executions in period</div>
            ) : d.byTrigger.map(t => (
              <div key={t.triggerEvent} className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[60%]">{t.triggerEvent}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-white dark:bg-white overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min((t.fires / (d.byTrigger[0]?.fires || 1)) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-black w-6 text-right">{t.fires}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top policies */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-5">
          <div className="text-xs font-medium text-gray-500 mb-3">Top policies by execution</div>
          <div className="space-y-2.5">
            {d.topPolicies.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No executions in period</div>
            ) : d.topPolicies.slice(0, 6).map((p, i) => (
              <div key={p.policyId} className="flex items-start gap-2">
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-black truncate">{p.policyName}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={cn('border-0 text-xs h-4 px-1', POLICY_TYPE_COLORS[p.policyType] ?? 'bg-white text-gray-600')}>
                      {p.policyType.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-gray-400">{p.fires} fires</span>
                    {p.autoApproved > 0 && <span className="text-xs text-green-600">· {p.autoApproved} auto</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Breach Trends ────────────────────────────────────────────────────

function BreachTrendsSection() {
  const [days, setDays] = useState('30');
  const q = useQuery<BreachTrends>({
    queryKey: [`/api/executive/breach-trends?days=${days}`],
    staleTime: 60_000,
  });

  if (q.isLoading) return (
    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  );

  const d = q.data!;

  const TrendIcon = d.trendDirection === 'worsening' ? TrendingUp : d.trendDirection === 'improving' ? TrendingDown : Minus;
  const trendColor = d.trendDirection === 'worsening' ? 'text-red-600' : d.trendDirection === 'improving' ? 'text-green-600' : 'text-gray-500';

  // Derive unique case types from data
  const caseTypes = Array.from(new Set(d.byCaseType.map(r => r.caseType)));

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <SectionHeader icon={<TrendingDown className="h-4 w-4" />} title="SLA Breach Trends"
          sub="Number of cases that first hit 'breached' status per day" />
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7d</SelectItem>
            <SelectItem value="30">Last 30d</SelectItem>
            <SelectItem value="90">Last 90d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trend summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">This period</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-black">{d.currentPeriod}</div>
          <div className="text-xs text-gray-400">breaches</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Prior period</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-black">{d.priorPeriod}</div>
          <div className="text-xs text-gray-400">breaches</div>
        </div>
        <div className={cn('rounded-xl border p-4',
          d.trendDirection === 'worsening'  ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' :
          d.trendDirection === 'improving'  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20' :
          'border-gray-200 bg-white dark:border-gray-800 dark:bg-white')}>
          <div className="text-xs text-gray-500 mb-1">Trend</div>
          <div className={cn('text-2xl font-bold flex items-center gap-1', trendColor)}>
            <TrendIcon className="h-5 w-5" />
            {d.trendPct !== null ? `${Math.abs(d.trendPct)}%` : '—'}
          </div>
          <div className="text-xs text-gray-400">{d.trendDirection}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Most affected</div>
          <div className="text-xl font-bold text-gray-900 dark:text-black capitalize">
            {d.byCaseType[0]?.caseType ?? '—'}
          </div>
          <div className="text-xs text-gray-400">{d.byCaseType[0]?.totalBreaches ?? 0} total breaches</div>
        </div>
      </div>

      {/* Chart */}
      {d.byDay.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-10 text-center text-sm text-gray-400">
          No breach data in the selected period. That's a good sign.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-5">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={d.byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={l => `Date: ${l}`}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {caseTypes.map(ct => (
                <Area key={ct} type="monotone" dataKey={ct}
                  stroke={CASE_TYPE_COLORS[ct] ?? '#94a3b8'}
                  fill={`${CASE_TYPE_COLORS[ct] ?? '#94a3b8'}30`}
                  strokeWidth={2}
                />
              ))}
              {caseTypes.length === 0 && (
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
              )}
            </AreaChart>
          </ResponsiveContainer>

          {/* By case type breakdown */}
          <div className="mt-4 flex flex-wrap gap-4">
            {d.byCaseType.map(ct => (
              <div key={ct.caseType} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: CASE_TYPE_COLORS[ct.caseType] ?? '#94a3b8' }} />
                <span className="text-gray-600 dark:text-gray-400 capitalize">{ct.caseType}</span>
                <span className="font-semibold text-gray-900 dark:text-black">{ct.totalBreaches}</span>
                <span className="text-gray-400">· avg {ct.avgAgeHours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Policy Impact ────────────────────────────────────────────────────

function PolicyImpactSection() {
  const [selectedId, setSelectedId] = useState<string>('');

  const policiesQ = useQuery<{ policies: Array<{ id: number; name: string; policyType: string; isActive: boolean }> }>({
    queryKey: ['/api/governance/policies?active=false'],
    staleTime: 120_000,
  });

  const impactQ = useQuery<PolicyImpact>({
    queryKey: [`/api/executive/policy-impact/${selectedId}`],
    enabled:  Boolean(selectedId),
    staleTime: 120_000,
  });

  const allPolicies = policiesQ.data?.policies ?? [];
  const d           = impactQ.data;

  const ImpactCompareCard = ({
    label, before, after,
  }: {
    label: string;
    before: { value: number; sub?: string };
    after:  { value: number; sub?: string };
  }) => {
    const delta = after.value - before.value;
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/50 p-4">
        <div className="text-xs font-medium text-gray-500 mb-3">{label}</div>
        <div className="grid grid-cols-3 gap-3 items-center">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Before</div>
            <div className="text-xl font-bold text-gray-700 dark:text-black">{before.value}</div>
            {before.sub && <div className="text-xs text-gray-400">{before.sub}</div>}
          </div>
          <div className="flex items-center justify-center">
            <div className={cn('flex items-center gap-1 text-sm font-semibold',
              delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-400')}>
              {delta > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : delta < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              {delta !== 0 ? Math.abs(delta) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">After</div>
            <div className="text-xl font-bold text-gray-900 dark:text-black">{after.value}</div>
            {after.sub && <div className="text-xs text-gray-400">{after.sub}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <SectionHeader icon={<GitBranch className="h-4 w-4" />} title="Policy Impact"
        sub="Before vs after a policy went live — dispute outcomes and automation changes" />

      <div className="mb-5 max-w-sm">
        <Label className="text-xs font-medium">Select policy to analyse</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue placeholder="Choose a policy..." /></SelectTrigger>
          <SelectContent>
            {allPolicies.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="flex items-center gap-2">
                  <span className={cn('text-xs px-1.5 rounded', !p.isActive ? 'bg-white text-gray-500' : 'bg-green-100 text-green-700')}>
                    {p.isActive ? 'active' : 'inactive'}
                  </span>
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {impactQ.isLoading && (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      )}

      {d && (
        <div className="space-y-5">
          {/* Policy info + pivot */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 flex flex-wrap gap-4 items-center">
            <div>
              <div className="text-xs text-blue-600 font-medium">Policy went live</div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-200 mt-0.5">
                {new Date(d.pivotDate).toLocaleDateString('en-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-xs text-blue-600 font-medium">Comparison window</div>
              <div className="text-sm text-blue-800 dark:text-blue-300">30 days before · 30 days after</div>
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {d.versions.map(v => (
                <div key={v.versionNumber} className="text-xs bg-white dark:bg-white border border-blue-200 dark:border-blue-800 rounded px-2 py-1">
                  <span className="font-mono">v{v.versionNumber}</span>
                  <span className="ml-1 text-gray-500">{v.changeType}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Policy execution comparison */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Policy Executions</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ImpactCompareCard label="Total Fires"
                before={{ value: d.policyExecutions.before.totalFires }}
                after={{  value: d.policyExecutions.after.totalFires }} />
              <ImpactCompareCard label="Auto-Approved"
                before={{ value: d.policyExecutions.before.autoApproved }}
                after={{  value: d.policyExecutions.after.autoApproved }} />
              <ImpactCompareCard label="Flagged for Review"
                before={{ value: d.policyExecutions.before.flagged }}
                after={{  value: d.policyExecutions.after.flagged }} />
            </div>
          </div>

          {/* Dispute outcome comparison */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dispute Outcomes (30d window)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ImpactCompareCard label="Total Disputes"
                before={{ value: d.disputes.before.total }}
                after={{  value: d.disputes.after.total }} />
              <ImpactCompareCard label="Resolved"
                before={{ value: d.disputes.before.resolved, sub: d.disputes.before.resolutionRate != null ? `${d.disputes.before.resolutionRate}% rate` : undefined }}
                after={{  value: d.disputes.after.resolved, sub: d.disputes.after.resolutionRate != null ? `${d.disputes.after.resolutionRate}% rate` : undefined }} />
              <ImpactCompareCard label="Needed L2 Approval"
                before={{ value: d.disputes.before.neededL2 }}
                after={{  value: d.disputes.after.neededL2 }} />
            </div>
          </div>

          {d.policyExecutions.before.totalFires === 0 && d.policyExecutions.after.totalFires === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              This policy has no recorded executions yet — impact data will appear once it fires on real cases.
            </div>
          )}
        </div>
      )}

      {!d && selectedId && !impactQ.isLoading && (
        <div className="text-center py-10 text-sm text-gray-400">No impact data found for this policy.</div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NetworkOversight() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-black flex items-center gap-3">
              <BarChart2 className="h-6 w-6 text-blue-600" />
              Executive Oversight
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Network health · Automation effectiveness · Breach trends · Policy impact
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
        </div>

        {/* Sections */}
        <section key={`risk-${refreshKey}`} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-6 shadow-sm">
          <NetworkRiskSection />
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-6 shadow-sm">
          <AutomationSection />
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-6 shadow-sm">
          <BreachTrendsSection />
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white p-6 shadow-sm">
          <PolicyImpactSection />
        </section>

      </div>
    </div>
  );
}
