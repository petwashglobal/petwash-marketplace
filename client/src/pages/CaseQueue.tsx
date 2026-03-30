/**
 * CaseQueue — Phase 12.8
 * Route: /case-queue
 *
 * Exception management layer for:
 *   - Open / under-review disputes
 *   - Settlement reconciliation mismatches
 *   - Pending refund requests
 *
 * Each case carries: severity · aging · SLA clock · current owner · linked booking
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ShieldAlert, TriangleAlert, Clock, CheckCircle2,
  ArrowUpRight, Banknote, AlertCircle, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlaStatus = 'on_track' | 'at_risk' | 'breached';
type Severity  = 'critical' | 'high' | 'medium' | 'low';
type CaseOwner = 'platform' | 'franchise_owner' | 'system' | 'none';

interface BaseCase {
  caseType:     string;
  caseId:       string;
  bookingId:    string;
  bookingNumber: string;
  stationId:    number | null;
  stationName:  string;
  stationCode:  string;
  currency:     string;
  ageHours:     number;
  slaStatus:    SlaStatus;
  slaBudgetHours: number;
  severity:     Severity;
  currentOwner: CaseOwner;
  openedAt:     string | null;
}

interface DisputeCase extends BaseCase {
  caseType:   'dispute';
  reason:     string;
  description: string | null;
  status:     string;
  total:      number;
}

interface MismatchCase extends BaseCase {
  caseType:         'mismatch';
  settlementId:     number;
  settlementStatus: string;
  totalAmount:      number;
  mismatchILS:      number;
}

interface RefundCase extends BaseCase {
  caseType:    'refund';
  refundAmount: number;
  refundStatus: string;
  refundReason: string | null;
  total:        number;
}

interface QueueResponse<T extends BaseCase> { cases: T[]; total: number; }

interface Summary {
  disputes:    { total: number; breached: number; atRiskOrBreached: number };
  mismatches:  { total: number; breached: number; atRiskOrBreached: number };
  refunds:     { total: number; breached: number; atRiskOrBreached: number };
  totalActiveCases: number;
  totalBreached:    number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });
const fmt = (n: number) => ILS.format(n);
const dtShort = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function ageLabel(hours: number): string {
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  if (hours < 24)  return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`;
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ s }: { s: Severity }) {
  const styles = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    high:     'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    medium:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    low:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const icons = {
    critical: <ShieldAlert className="h-3 w-3 mr-1" />,
    high:     <TriangleAlert className="h-3 w-3 mr-1" />,
    medium:   <AlertCircle className="h-3 w-3 mr-1" />,
    low:      null,
  };
  return (
    <Badge className={cn('border-0 text-xs capitalize flex items-center', styles[s])}>
      {icons[s]}{s}
    </Badge>
  );
}

// ─── SLA cell ─────────────────────────────────────────────────────────────────

function SlaCell({ ageHours, slaBudgetHours, slaStatus }: { ageHours: number; slaBudgetHours: number; slaStatus: SlaStatus }) {
  const pct = Math.min(100, (ageHours / slaBudgetHours) * 100);
  const remaining = slaBudgetHours - ageHours;

  const barColor =
    slaStatus === 'breached'  ? 'bg-red-500' :
    slaStatus === 'at_risk'   ? 'bg-orange-400' :
                                'bg-emerald-400';
  const textColor =
    slaStatus === 'breached'  ? 'text-red-600 dark:text-red-400' :
    slaStatus === 'at_risk'   ? 'text-orange-600 dark:text-orange-400' :
                                'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="space-y-1 min-w-[80px]">
      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn('text-xs font-medium', textColor)}>
        {slaStatus === 'breached'
          ? `+${ageLabel(Math.abs(remaining))} over`
          : `${ageLabel(remaining)} left`}
      </p>
    </div>
  );
}

// ─── Owner badge ──────────────────────────────────────────────────────────────

function OwnerBadge({ owner }: { owner: CaseOwner }) {
  if (owner === 'platform') return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-0 text-xs">Platform</Badge>;
  if (owner === 'system')   return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border-0 text-xs">System</Badge>;
  if (owner === 'franchise_owner') return <Badge className="bg-indigo-100 text-indigo-800 border-0 text-xs">Owner</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">—</Badge>;
}

// ─── Row action link ──────────────────────────────────────────────────────────

function TraceLink({ bookingId }: { bookingId: string }) {
  return (
    <Link
      href={`/booking-trace/${bookingId}`}
      className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      View <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, total, breached, icon }: { label: string; total: number; breached: number; icon: React.ReactNode }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
          {breached > 0 && (
            <p className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />{breached} SLA breached
            </p>
          )}
        </div>
        <div className="text-gray-300 dark:text-gray-600 mt-0.5">{icon}</div>
      </CardContent>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No {label} cases</p>
      <p className="text-xs mt-1">Everything looks clean here.</p>
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <TableRow key={i}>
          {[1, 2, 3, 4, 5, 6, 7].map(j => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Sorting helper ───────────────────────────────────────────────────────────

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortCases<T extends BaseCase>(cases: T[]): T[] {
  return [...cases].sort((a, b) => {
    const sev = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (sev !== 0) return sev;
    return b.ageHours - a.ageHours;
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaseQueue() {
  const [activeTab, setActiveTab] = useState('disputes');

  const summaryQ  = useQuery<Summary>({
    queryKey: ['/api/case-queue/summary'],
  });
  const disputesQ = useQuery<QueueResponse<DisputeCase>>({
    queryKey: ['/api/case-queue/disputes'],
    enabled:  activeTab === 'disputes',
  });
  const mismatchQ = useQuery<QueueResponse<MismatchCase>>({
    queryKey: ['/api/case-queue/mismatches'],
    enabled:  activeTab === 'mismatches',
  });
  const refundsQ  = useQuery<QueueResponse<RefundCase>>({
    queryKey: ['/api/case-queue/refunds'],
    enabled:  activeTab === 'refunds',
  });

  const summary = summaryQ.data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              Exception Queue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Open disputes · settlement mismatches · pending refunds
            </p>
          </div>
          {summary && summary.totalBreached > 0 && (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-0 text-sm font-semibold px-3 py-1.5">
              <ShieldAlert className="h-4 w-4 mr-1.5" />
              {summary.totalBreached} SLA Breached
            </Badge>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryQ.isLoading ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)
          ) : summary ? (
            <>
              <SummaryCard
                label="Open Disputes"
                total={summary.disputes.total}
                breached={summary.disputes.breached}
                icon={<ShieldAlert className="h-7 w-7" />}
              />
              <SummaryCard
                label="Mismatches"
                total={summary.mismatches.total}
                breached={summary.mismatches.breached}
                icon={<TriangleAlert className="h-7 w-7" />}
              />
              <SummaryCard
                label="Pending Refunds"
                total={summary.refunds.total}
                breached={summary.refunds.breached}
                icon={<Banknote className="h-7 w-7" />}
              />
              <SummaryCard
                label="Total Active"
                total={summary.totalActiveCases}
                breached={summary.totalBreached}
                icon={<Clock className="h-7 w-7" />}
              />
            </>
          ) : null}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <TabsTrigger value="disputes" className="text-sm">
              Disputes
              {summary && summary.disputes.total > 0 && (
                <span className={cn(
                  'ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium',
                  summary.disputes.breached > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {summary.disputes.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mismatches" className="text-sm">
              Mismatches
              {summary && summary.mismatches.total > 0 && (
                <span className={cn(
                  'ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium',
                  summary.mismatches.breached > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {summary.mismatches.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="refunds" className="text-sm">
              Refunds
              {summary && summary.refunds.total > 0 && (
                <span className={cn(
                  'ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium',
                  summary.refunds.breached > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                )}>
                  {summary.refunds.total}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Disputes tab ─────────────────────────────────────────────── */}
          <TabsContent value="disputes" className="mt-3">
            <Card className="border-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                      <TableHead className="text-xs w-24">Severity</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Booking</TableHead>
                      <TableHead className="text-xs">Station</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                      <TableHead className="text-xs min-w-[100px]">SLA</TableHead>
                      <TableHead className="text-xs">Owner</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputesQ.isLoading ? <SkeletonRows /> :
                     !disputesQ.data?.cases.length ? (
                      <TableRow>
                        <TableCell colSpan={10}><EmptyQueue label="dispute" /></TableCell>
                      </TableRow>
                    ) : sortCases(disputesQ.data.cases).map(c => (
                      <TableRow
                        key={c.caseId}
                        className={cn(
                          'cursor-pointer transition-colors',
                          c.severity === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                          c.severity === 'high'     && 'bg-orange-50/40 dark:bg-orange-950/20',
                        )}
                      >
                        <TableCell className="py-3"><SeverityBadge s={c.severity} /></TableCell>
                        <TableCell className="py-3 text-sm font-medium capitalize max-w-[120px] truncate">{c.reason.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{c.bookingNumber}</TableCell>
                        <TableCell className="py-3 text-sm">{c.stationName || '—'}{c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums">{fmt(c.total)}</TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{ageLabel(c.ageHours)}</TableCell>
                        <TableCell className="py-3"><SlaCell ageHours={c.ageHours} slaBudgetHours={c.slaBudgetHours} slaStatus={c.slaStatus} /></TableCell>
                        <TableCell className="py-3"><OwnerBadge owner={c.currentOwner} /></TableCell>
                        <TableCell className="py-3">
                          <Badge className={cn(
                            'border-0 text-xs capitalize',
                            c.status === 'open'         ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            c.status === 'under_review' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {c.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3"><TraceLink bookingId={c.bookingId} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Mismatches tab ───────────────────────────────────────────── */}
          <TabsContent value="mismatches" className="mt-3">
            <Card className="border-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                      <TableHead className="text-xs w-24">Severity</TableHead>
                      <TableHead className="text-xs">Booking</TableHead>
                      <TableHead className="text-xs">Station</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Mismatch Δ</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                      <TableHead className="text-xs min-w-[100px]">SLA</TableHead>
                      <TableHead className="text-xs">Owner</TableHead>
                      <TableHead className="text-xs w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mismatchQ.isLoading ? <SkeletonRows /> :
                     !mismatchQ.data?.cases.length ? (
                      <TableRow>
                        <TableCell colSpan={9}><EmptyQueue label="mismatch" /></TableCell>
                      </TableRow>
                    ) : sortCases(mismatchQ.data.cases).map(c => (
                      <TableRow
                        key={c.caseId}
                        className={cn(
                          'cursor-pointer transition-colors',
                          c.severity === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                          c.severity === 'high'     && 'bg-orange-50/40 dark:bg-orange-950/20',
                        )}
                      >
                        <TableCell className="py-3"><SeverityBadge s={c.severity} /></TableCell>
                        <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{c.bookingNumber}</TableCell>
                        <TableCell className="py-3 text-sm">{c.stationName || '—'}{c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums">{fmt(c.totalAmount)}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums font-semibold text-orange-600 dark:text-orange-400">{fmt(c.mismatchILS)}</TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{ageLabel(c.ageHours)}</TableCell>
                        <TableCell className="py-3"><SlaCell ageHours={c.ageHours} slaBudgetHours={c.slaBudgetHours} slaStatus={c.slaStatus} /></TableCell>
                        <TableCell className="py-3"><OwnerBadge owner={c.currentOwner} /></TableCell>
                        <TableCell className="py-3"><TraceLink bookingId={c.bookingId} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ── Refunds tab ──────────────────────────────────────────────── */}
          <TabsContent value="refunds" className="mt-3">
            <Card className="border-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                      <TableHead className="text-xs w-24">Severity</TableHead>
                      <TableHead className="text-xs">Booking</TableHead>
                      <TableHead className="text-xs">Station</TableHead>
                      <TableHead className="text-xs text-right">Refund Amt</TableHead>
                      <TableHead className="text-xs text-right">Booking Total</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Age</TableHead>
                      <TableHead className="text-xs min-w-[100px]">SLA</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundsQ.isLoading ? <SkeletonRows /> :
                     !refundsQ.data?.cases.length ? (
                      <TableRow>
                        <TableCell colSpan={10}><EmptyQueue label="refund" /></TableCell>
                      </TableRow>
                    ) : sortCases(refundsQ.data.cases).map(c => (
                      <TableRow
                        key={c.caseId}
                        className={cn(
                          'cursor-pointer transition-colors',
                          c.severity === 'critical' && 'bg-red-50/40 dark:bg-red-950/20',
                          c.severity === 'high'     && 'bg-orange-50/40 dark:bg-orange-950/20',
                        )}
                      >
                        <TableCell className="py-3"><SeverityBadge s={c.severity} /></TableCell>
                        <TableCell className="py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{c.bookingNumber}</TableCell>
                        <TableCell className="py-3 text-sm">{c.stationName || '—'}{c.stationCode && <span className="text-xs text-gray-400 ml-1">({c.stationCode})</span>}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums font-semibold">{fmt(c.refundAmount)}</TableCell>
                        <TableCell className="py-3 text-sm text-right tabular-nums text-gray-500">{fmt(c.total)}</TableCell>
                        <TableCell className="py-3 text-xs text-gray-500 max-w-[120px] truncate">{c.refundReason ?? '—'}</TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{ageLabel(c.ageHours)}</TableCell>
                        <TableCell className="py-3"><SlaCell ageHours={c.ageHours} slaBudgetHours={c.slaBudgetHours} slaStatus={c.slaStatus} /></TableCell>
                        <TableCell className="py-3">
                          <Badge className={cn(
                            'border-0 text-xs capitalize',
                            c.refundStatus === 'pending'    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                            c.refundStatus === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {c.refundStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3"><TraceLink bookingId={c.bookingId} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* SLA legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
          <span>SLA budgets:</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Dispute (open) — 48h</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" />Dispute (review) — 72h</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />Mismatch — 24h</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" />Refund — 120h (5 days)</span>
        </div>

      </div>
    </div>
  );
}
