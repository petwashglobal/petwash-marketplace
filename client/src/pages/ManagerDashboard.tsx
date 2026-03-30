/**
 * ManagerDashboard.tsx
 * Phase 12.12 — Manager Control & Operational Reporting
 *
 * Route: /manager
 * Auth: franchise_owner / admin / team_manager
 *
 * Tabs:
 *   1. Approvals       — pending closure approvals queue (T121)
 *   2. SLA Breaches    — breach view by user/team/station (T122)
 *   3. Workload        — per-user and per-team heatmap (T123)
 *   4. Resolution      — code analytics by team/station/franchise (T124)
 *   5. Reopen Stats    — reopen rate per handler + per reopen_code (T125)
 *   6. Performance     — comparison by station/franchise/team (T126)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2, XCircle, ClipboardList, ShieldAlert, Users, BarChart3,
  RotateCcw, TrendingUp, Loader2, RefreshCw, Building2, User,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Approval {
  disputeId:          string;
  bookingId:          string;
  bookingNumber:      string;
  stationName:        string;
  handlerUid:         string | null;
  teamId:             number | null;
  teamName:           string | null;
  closureReasonCode:  string;
  closureReasonLabel: string;
  requestedAt:        string | null;
  ageHours:           number;
}

interface SlaGroup {
  uid?:          string;
  teamId?:       number;
  teamName?:     string;
  stationId?:    string;
  stationName?:  string;
  totalCases:    number;
  breachedCases: number;
  breachRate:    number;
  avgAgeHours:   number;
}

interface WorkloadRow {
  uid?:          string;
  teamId?:       number;
  teamName?:     string;
  activeCases:   number;
  avgAgeHours:   number;
  breachedCount: number;
}

interface ResolutionCode {
  code:       string;
  label:      string;
  totalCount?: number;
  percentage?: number;
  count?:      number;
  teamName?:   string;
  stationName?: string;
  franchiseName?: string;
}

interface ReopenUser {
  handlerUid:    string;
  closedCount:   number;
  reopenCount:   number;
  reopenRatePct: number;
}

interface ReopenCode {
  reopenCode: string;
  count:      number;
}

interface PerfRow {
  stationId?:          string;
  stationName?:        string;
  franchiseId?:        string;
  franchiseName?:      string;
  teamId?:             number;
  teamName?:           string;
  totalCases:          number;
  closedCases:         number;
  avgResolutionHours:  number | null;
  breachRate:          number;
  reopenRate:          number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function BreachBadge({ rate }: { rate: number }) {
  const c = rate >= 50 ? 'bg-red-100 text-red-700' : rate >= 20 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';
  return <Badge className={cn('border-0 text-xs', c)}>{rate.toFixed(1)}%</Badge>;
}

function WorkloadColor({ n }: { n: number }) {
  const c = n >= 10 ? 'text-red-600 font-bold' : n >= 5 ? 'text-amber-600 font-semibold' : 'text-green-700';
  return <span className={c}>{n}</span>;
}

function HidUid({ uid }: { uid: string }) {
  return <span className="font-mono text-xs text-gray-500">{uid.slice(0, 8)}…</span>;
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-gray-400 text-sm">
      No {label} data yet — this view updates as cases are handled.
    </div>
  );
}

// ─── Approval Actions ─────────────────────────────────────────────────────────

function ApprovalActions({ disputeId, bookingId, onDone }: {
  disputeId: string; bookingId: string; onDone: () => void;
}) {
  const qc = useQueryClient();

  const approveMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/closure-approve', { bookingId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/manager/approvals'] }); onDone(); },
  });
  const rejectMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/case-actions/closure-reject', { bookingId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/manager/approvals'] }); onDone(); },
  });

  const busy = approveMut.isPending || rejectMut.isPending;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm" variant="ghost"
        className="h-7 text-xs gap-1 px-2 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
        disabled={busy}
        onClick={() => approveMut.mutate()}
      >
        {approveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Approve
      </Button>
      <Button
        size="sm" variant="ghost"
        className="h-7 text-xs gap-1 px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        disabled={busy}
        onClick={() => rejectMut.mutate()}
      >
        {rejectMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
        Reject
      </Button>
    </div>
  );
}

// ─── Tab: Approvals ───────────────────────────────────────────────────────────

function ApprovalsTab() {
  const q = useQuery<{ approvals: Approval[]; total: number }>({
    queryKey: ['/api/manager/approvals'],
    refetchInterval: 60_000,
  });
  const qc = useQueryClient();

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const items = q.data?.approvals ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Pending Closure Approvals
            {items.length > 0 && (
              <Badge className="ml-2 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs">
                {items.length}
              </Badge>
            )}
          </h3>
          <p className="text-xs text-gray-500">Cases where an agent has requested closure — requiring manager decision.</p>
        </div>
        <Button
          size="sm" variant="ghost"
          className="h-7 gap-1.5 text-xs text-gray-500"
          onClick={() => qc.invalidateQueries({ queryKey: ['/api/manager/approvals'] })}
        >
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No pending approvals — queue is clear.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                <TableHead className="text-xs">Booking</TableHead>
                <TableHead className="text-xs">Station</TableHead>
                <TableHead className="text-xs">Handler</TableHead>
                <TableHead className="text-xs">Team</TableHead>
                <TableHead className="text-xs">Resolution Code</TableHead>
                <TableHead className="text-xs">Pending</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.disputeId}
                  className={item.ageHours >= 24 ? 'bg-red-50/40 dark:bg-red-950/10' : ''}
                >
                  <TableCell className="font-mono text-xs py-3">{item.bookingNumber || item.bookingId.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm py-3">{item.stationName || '—'}</TableCell>
                  <TableCell className="py-3">
                    {item.handlerUid ? <HidUid uid={item.handlerUid} /> : <span className="text-gray-400 text-xs">unassigned</span>}
                  </TableCell>
                  <TableCell className="py-3">
                    {item.teamName
                      ? <Badge className="border-0 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs">{item.teamName}</Badge>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge className="border-0 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs">
                      {item.closureReasonLabel || item.closureReasonCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap">
                    <span className={item.ageHours >= 24 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {ageLabel(item.ageHours)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <ApprovalActions
                      disputeId={item.disputeId}
                      bookingId={item.bookingId}
                      onDone={() => {}}
                    />
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

// ─── Tab: SLA Breaches ────────────────────────────────────────────────────────

function SlaBreachesTab() {
  const q = useQuery<{ byUser: SlaGroup[]; byTeam: SlaGroup[]; byStation: SlaGroup[] }>({
    queryKey: ['/api/manager/sla-breaches'],
    staleTime: 120_000,
  });
  const [view, setView] = useState<'user' | 'team' | 'station'>('user');

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const cols = {
    user:    { label: 'Handler', rows: q.data?.byUser ?? [], key: (r: SlaGroup) => r.uid! },
    team:    { label: 'Team',    rows: q.data?.byTeam ?? [], key: (r: SlaGroup) => String(r.teamId!) },
    station: { label: 'Station', rows: q.data?.byStation ?? [], key: (r: SlaGroup) => r.stationId! },
  }[view];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">SLA Breach Control View</h3>
          <p className="text-xs text-gray-500">Where SLA is breaking — grouped by handler, team, or station.</p>
        </div>
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs">
          {(['user', 'team', 'station'] as const).map(v => (
            <button key={v}
              className={cn('px-3 py-1.5 capitalize transition-colors',
                view === v ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
              onClick={() => setView(v)}
            >
              {v === 'user' ? 'By Handler' : v === 'team' ? 'By Team' : 'By Station'}
            </button>
          ))}
        </div>
      </div>

      {cols.rows.length === 0 ? <EmptyState label="SLA breach" /> : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                <TableHead className="text-xs">{cols.label}</TableHead>
                <TableHead className="text-xs text-right">Total Cases</TableHead>
                <TableHead className="text-xs text-right">Breached</TableHead>
                <TableHead className="text-xs text-right">Breach Rate</TableHead>
                <TableHead className="text-xs text-right">Avg Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cols.rows.map(r => (
                <TableRow key={cols.key(r)}>
                  <TableCell className="py-3 text-sm">
                    {view === 'user'
                      ? <HidUid uid={r.uid!} />
                      : view === 'team'
                        ? <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-purple-500" />{r.teamName}</span>
                        : r.stationName}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm tabular-nums">{r.totalCases}</TableCell>
                  <TableCell className="py-3 text-right">
                    <span className={r.breachedCases > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>{r.breachedCases}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right"><BreachBadge rate={r.breachRate} /></TableCell>
                  <TableCell className="py-3 text-right text-sm text-gray-600">{ageLabel(r.avgAgeHours)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Workload Heatmap ────────────────────────────────────────────────────

function WorkloadTab() {
  const q = useQuery<{ byUser: WorkloadRow[]; byTeam: WorkloadRow[] }>({
    queryKey: ['/api/manager/workload'],
    staleTime: 120_000,
  });
  const [view, setView] = useState<'user' | 'team'>('user');

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const rows = view === 'user' ? (q.data?.byUser ?? []) : (q.data?.byTeam ?? []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Workload Heatmap</h3>
          <p className="text-xs text-gray-500">
            Active case distribution — <span className="text-green-600 font-medium">green ≤4</span>,{' '}
            <span className="text-amber-600 font-medium">yellow 5–9</span>,{' '}
            <span className="text-red-600 font-medium">red ≥10</span>. Use this for reassignment decisions.
          </p>
        </div>
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs">
          {(['user', 'team'] as const).map(v => (
            <button key={v}
              className={cn('px-3 py-1.5 transition-colors',
                view === v ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
              onClick={() => setView(v)}
            >
              {v === 'user' ? <><User className="inline h-3 w-3 mr-1" />Handlers</> : <><Building2 className="inline h-3 w-3 mr-1" />Teams</>}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <EmptyState label="workload" /> : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                <TableHead className="text-xs">{view === 'user' ? 'Handler' : 'Team'}</TableHead>
                <TableHead className="text-xs text-right">Active Cases</TableHead>
                <TableHead className="text-xs text-right">Avg Age</TableHead>
                <TableHead className="text-xs text-right">SLA Breached</TableHead>
                <TableHead className="text-xs">Load</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.uid ?? r.teamId ?? i}>
                  <TableCell className="py-3 text-sm">
                    {view === 'user'
                      ? <HidUid uid={r.uid!} />
                      : <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-purple-500" />{r.teamName}</span>}
                  </TableCell>
                  <TableCell className="py-3 text-right"><WorkloadColor n={r.activeCases} /></TableCell>
                  <TableCell className="py-3 text-right text-sm text-gray-600">{ageLabel(r.avgAgeHours)}</TableCell>
                  <TableCell className="py-3 text-right">
                    <span className={r.breachedCount > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{r.breachedCount}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(r.activeCases, 15) }).map((_, i) => (
                        <div
                          key={i}
                          className={cn('h-3 w-2 rounded-sm',
                            r.activeCases >= 10 ? 'bg-red-400' : r.activeCases >= 5 ? 'bg-amber-400' : 'bg-green-400'
                          )}
                        />
                      ))}
                      {r.activeCases > 15 && <span className="text-xs text-gray-400 ml-1">+{r.activeCases - 15}</span>}
                    </div>
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

// ─── Tab: Resolution Analytics ────────────────────────────────────────────────

function ResolutionTab() {
  const q = useQuery<{
    overall: ResolutionCode[];
    byTeam:  ResolutionCode[];
    byStation: ResolutionCode[];
    byFranchise: ResolutionCode[];
  }>({
    queryKey: ['/api/manager/resolution-analytics'],
    staleTime: 300_000,
  });
  const [groupBy, setGroupBy] = useState<'overall' | 'team' | 'station' | 'franchise'>('overall');

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const rows = {
    overall:   q.data?.overall ?? [],
    team:      q.data?.byTeam ?? [],
    station:   q.data?.byStation ?? [],
    franchise: q.data?.byFranchise ?? [],
  }[groupBy];

  const ALERT_CODES = new Set(['goodwill_refund', 'operator_error']);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resolution Code Analytics</h3>
          <p className="text-xs text-gray-500">
            Reveals root causes.{' '}
            <span className="text-amber-600 font-medium">goodwill_refund</span> = service issue.{' '}
            <span className="text-red-600 font-medium">operator_error</span> = training issue.
          </p>
        </div>
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs">
          {(['overall', 'team', 'station', 'franchise'] as const).map(v => (
            <button key={v}
              className={cn('px-3 py-1.5 capitalize transition-colors',
                groupBy === v ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
              onClick={() => setGroupBy(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <EmptyState label="resolution code" /> : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                {groupBy !== 'overall' && <TableHead className="text-xs capitalize">{groupBy}</TableHead>}
                <TableHead className="text-xs">Resolution Code</TableHead>
                <TableHead className="text-xs text-right">Count</TableHead>
                {groupBy === 'overall' && <TableHead className="text-xs text-right">Share</TableHead>}
                <TableHead className="text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className={ALERT_CODES.has(r.code) ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}>
                  {groupBy !== 'overall' && (
                    <TableCell className="text-sm py-3 text-gray-700">
                      {r.teamName ?? r.stationName ?? r.franchiseName ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <Badge className={cn('border-0 text-xs',
                      r.code === 'operator_error'  ? 'bg-red-100 text-red-700'    :
                      r.code === 'goodwill_refund' ? 'bg-amber-100 text-amber-700':
                      'bg-gray-100 text-gray-600'
                    )}>
                      {r.label || r.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm tabular-nums font-medium">
                    {r.totalCount ?? r.count}
                  </TableCell>
                  {groupBy === 'overall' && (
                    <TableCell className="py-3 text-right text-sm text-gray-500">
                      {r.percentage?.toFixed(1)}%
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    {ALERT_CODES.has(r.code) && (
                      <span className="text-xs text-amber-600">⚠ Review needed</span>
                    )}
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

// ─── Tab: Reopen Stats ────────────────────────────────────────────────────────

function ReopenTab() {
  const q = useQuery<{ byUser: ReopenUser[]; byCode: ReopenCode[] }>({
    queryKey: ['/api/manager/reopen-stats'],
    staleTime: 300_000,
  });

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const byUser = q.data?.byUser ?? [];
  const byCode = q.data?.byCode ?? [];

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Reopen Rate by Handler"
          sub="High reopen rate signals incomplete or incorrect resolution. Investigate handlers above 20%."
        />
        {byUser.length === 0 ? <EmptyState label="reopen" /> : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-900">
                  <TableHead className="text-xs">Handler</TableHead>
                  <TableHead className="text-xs text-right">Cases Closed</TableHead>
                  <TableHead className="text-xs text-right">Reopened</TableHead>
                  <TableHead className="text-xs text-right">Reopen Rate</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUser.map(r => (
                  <TableRow key={r.handlerUid}
                    className={r.reopenRatePct >= 30 ? 'bg-red-50/40 dark:bg-red-950/10' : ''}
                  >
                    <TableCell className="py-3"><HidUid uid={r.handlerUid} /></TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">{r.closedCount}</TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums">
                      <span className={r.reopenCount > 0 ? 'text-red-600 font-medium' : ''}>{r.reopenCount}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right"><BreachBadge rate={r.reopenRatePct} /></TableCell>
                    <TableCell className="py-3 text-xs text-gray-400">
                      {r.reopenRatePct >= 30 ? '🚨 High — review closures' : r.reopenRatePct >= 10 ? '⚠ Elevated' : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <SectionHeader
          title="Reopen Reason Codes"
          sub="Which reasons are driving reopens. High 'incomplete_resolution' = systemic quality issue."
        />
        {byCode.length === 0 ? <EmptyState label="reopen code" /> : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-900">
                  <TableHead className="text-xs">Reopen Code</TableHead>
                  <TableHead className="text-xs text-right">Times Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCode.map(r => (
                  <TableRow key={r.reopenCode}>
                    <TableCell className="py-3">
                      <Badge className="border-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs">
                        {r.reopenCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-semibold tabular-nums">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Performance Comparison ─────────────────────────────────────────────

function PerformanceTab() {
  const q = useQuery<{ byStation: PerfRow[]; byFranchise: PerfRow[]; byTeam: PerfRow[] }>({
    queryKey: ['/api/manager/performance-comparison'],
    staleTime: 300_000,
  });
  const [view, setView] = useState<'station' | 'franchise' | 'team'>('station');

  if (q.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const rows = {
    station:   q.data?.byStation ?? [],
    franchise: q.data?.byFranchise ?? [],
    team:      q.data?.byTeam ?? [],
  }[view];

  const getName = (r: PerfRow) =>
    r.stationName ?? r.franchiseName ?? r.teamName ?? '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Performance Comparison</h3>
          <p className="text-xs text-gray-500">
            Side-by-side: avg resolution time, breach rate, and reopen rate. Sorted by breach rate.
          </p>
        </div>
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-xs">
          {(['station', 'franchise', 'team'] as const).map(v => (
            <button key={v}
              className={cn('px-3 py-1.5 capitalize transition-colors',
                view === v ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <EmptyState label="performance" /> : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                <TableHead className="text-xs capitalize">{view}</TableHead>
                <TableHead className="text-xs text-right">Total Cases</TableHead>
                <TableHead className="text-xs text-right">Closed</TableHead>
                <TableHead className="text-xs text-right">Avg Resolution</TableHead>
                <TableHead className="text-xs text-right">Breach Rate</TableHead>
                <TableHead className="text-xs text-right">Reopen Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}
                  className={r.breachRate >= 50 ? 'bg-red-50/40 dark:bg-red-950/10' : r.breachRate >= 20 ? 'bg-orange-50/30 dark:bg-orange-950/10' : ''}
                >
                  <TableCell className="py-3 text-sm font-medium">
                    {view === 'team'
                      ? <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-purple-500" />{getName(r)}</span>
                      : getName(r)}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm tabular-nums">{r.totalCases}</TableCell>
                  <TableCell className="py-3 text-right text-sm tabular-nums">{r.closedCases}</TableCell>
                  <TableCell className="py-3 text-right text-sm text-gray-600">
                    {r.avgResolutionHours != null ? ageLabel(r.avgResolutionHours) : '—'}
                  </TableCell>
                  <TableCell className="py-3 text-right"><BreachBadge rate={r.breachRate} /></TableCell>
                  <TableCell className="py-3 text-right">
                    {r.reopenRate != null
                      ? <BreachBadge rate={r.reopenRate} />
                      : <span className="text-xs text-gray-400">—</span>}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const approvalsQ = useQuery<{ total: number }>({
    queryKey: ['/api/manager/approvals'],
    staleTime: 60_000,
  });
  const pendingCount = approvalsQ.data?.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Manager Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Team control · SLA visibility · Resolution discipline
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="approvals">
          <TabsList className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 h-auto p-1 flex-wrap gap-1">
            <TabsTrigger value="approvals" className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approvals
              {pendingCount > 0 && (
                <Badge className="ml-1 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs px-1.5 py-0">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sla" className="flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />SLA Breaches
            </TabsTrigger>
            <TabsTrigger value="workload" className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />Workload
            </TabsTrigger>
            <TabsTrigger value="resolution" className="flex items-center gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />Resolution Codes
            </TabsTrigger>
            <TabsTrigger value="reopen" className="flex items-center gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />Reopen Stats
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="h-3.5 w-3.5" />Performance
            </TabsTrigger>
          </TabsList>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <TabsContent value="approvals"  className="mt-0"><ApprovalsTab /></TabsContent>
            <TabsContent value="sla"        className="mt-0"><SlaBreachesTab /></TabsContent>
            <TabsContent value="workload"   className="mt-0"><WorkloadTab /></TabsContent>
            <TabsContent value="resolution" className="mt-0"><ResolutionTab /></TabsContent>
            <TabsContent value="reopen"     className="mt-0"><ReopenTab /></TabsContent>
            <TabsContent value="performance" className="mt-0"><PerformanceTab /></TabsContent>
          </div>
        </Tabs>

      </div>
    </div>
  );
}
