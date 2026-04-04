/**
 * Shared finance components — Phase 12, Step 1
 *
 * Five stateless, purely presentational components used by both:
 *   FranchiseOwnerDashboard  (/franchise/:franchiseId/dashboard)
 *   CompanyHQDashboard       (/company/dashboard)
 *
 * Rules:
 *   - No business logic inside components
 *   - No API calls — all data passed via props
 *   - No fake aggregates — what the API sends is what renders
 *   - Both franchise and company views share the same components;
 *     ownerType prop controls label/visibility differences only
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Building2,
  Factory,
  Wrench,
  ReceiptText,
  XCircle,
  CalendarCheck,
  TriangleAlert,
} from 'lucide-react';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type Period    = 'today' | 'mtd' | 'last30';
export type OwnerType = 'franchise' | 'company';
export type Severity  = 'high' | 'medium' | 'low';
export type CycleStatus = 'pending' | 'in_progress' | 'completed' | 'internal';

export interface FinancialWindow {
  grossRevenue:   number;
  platformFees:   number;
  franchiseShare: number;
  stationPayouts: number;
  bookingCount:   number;
  settledCount:   number;
  pendingCount:   number;
  disputedCount:  number;
  disputedAmount: number;
}

export interface StationFinancial {
  stationId:      number;
  stationName:    string;
  stationCode:    string;
  ownershipType:  string;
  grossRevenue:   number;
  platformFees:   number;
  franchiseShare: number;
  stationPayouts: number;
  bookingCount:   number;
  settledCount:   number;
  pendingCount:   number;
  avgOrderValue:  number;
  disputedCount:  number;
  disputedAmount: number;
}

export interface PayoutCycle {
  cycleId:                  string;
  weekStart:                string;
  weekEnd:                  string;
  expectedPayoutDate:       string | null;
  status:                   CycleStatus;
  grossRevenue:             number;
  platformFees:             number;
  franchiseShare:           number;
  stationPayouts:           number;
  settlementCount:          number;
  settledCount:             number;
  pendingCount:             number;
  disputedCount:            number;
  disputedAmount:           number;
  hasReconciliationMismatch: boolean;
}

export interface AuditEvent {
  eventType:    string;
  severity:     Severity;
  occurredAt:   string;
  stationId:    number;
  stationName:  string;
  stationCode:  string;
  ownershipType?: string;
  refId:        string;
  amountILS:    number;
  detailStatus:  string | null;
  detailContext: string | null;
  detailReason:  string | null;
}

export interface SettlementRow {
  id:                      number;
  bookingId:               string;
  status:                  string;
  settledAt:               string | null;
  createdAt:               string;
  totalAmount:             number;
  platformFeePct:          number;
  platformAmount:          number;
  stationRevenuePct:       number;
  stationAmount:           number;
  franchiseOverridePct:    number | null;
  franchiseShare:          number;
  hasReconciliationMismatch: boolean;
}

export interface SettlementLedgerSummary {
  total:         number;
  settled:       number;
  pending:       number;
  disputed:      number;
  mismatchCount: number;
}

// ─── Currency helper ──────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat('he-IL', {
  style:    'currency',
  currency: 'ILS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmt(n: number): string {
  return ILS.format(n);
}

// ─── 1. PeriodSelector ────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  value:    Period;
  onChange: (p: Period) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const options: { key: Period; label: string }[] = [
    { key: 'today',  label: 'Today'   },
    { key: 'mtd',    label: 'MTD'     },
    { key: 'last30', label: 'Last 30' },
  ];

  return (
    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-4 py-1.5 font-medium transition-colors',
            value === key
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'bg-white text-gray-600 hover:bg-white dark:bg-white dark:text-gray-400 dark:hover:bg-white'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── 2. FinanceSummaryPanel ───────────────────────────────────────────────────

interface FinanceSummaryPanelProps {
  data:       FinancialWindow;
  ownerType:  OwnerType;
  isLoading?: boolean;
}

interface MetricTile {
  label:       string;
  value:       string;
  sub?:        string;
  subClass?:   string;
  icon:        React.ReactNode;
  highlight?:  boolean;  // gold accent on gross revenue
  dimmed?:     boolean;  // gray for N/A (company franchise share)
}

export function FinanceSummaryPanel({ data, ownerType, isLoading }: FinanceSummaryPanelProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isCompany = ownerType === 'company';

  const tiles: MetricTile[] = [
    {
      label:     'Gross Revenue',
      value:     fmt(data.grossRevenue),
      sub:       `${data.bookingCount} settlements`,
      subClass:  'text-gray-500',
      icon:      <TrendingUp className="h-4 w-4" />,
      highlight: true,
    },
    {
      label:    'Platform Fees',
      value:    fmt(data.platformFees),
      icon:     <ReceiptText className="h-4 w-4" />,
    },
    {
      label:   isCompany ? 'Franchise Share — N/A' : 'Franchise Share',
      value:   isCompany ? '—' : fmt(data.franchiseShare),
      sub:     isCompany ? 'Company-owned: no external cut' : undefined,
      subClass: 'text-gray-400 text-xs',
      icon:    <Building2 className="h-4 w-4" />,
      dimmed:  isCompany,
    },
    {
      label:    'Station Payouts',
      value:    fmt(data.stationPayouts),
      sub:      `${data.settledCount} settled · ${data.pendingCount} pending`,
      subClass: 'text-gray-500',
      icon:     <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card
            key={t.label}
            className={cn(
              'border-0 shadow-sm transition-all',
              t.highlight && 'ring-1 ring-[#D4AF37] ring-offset-1',
              t.dimmed && 'opacity-60'
            )}
          >
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t.icon}
                <span className="truncate">{t.label}</span>
              </div>
              <p className={cn(
                'text-xl font-semibold tracking-tight',
                t.dimmed ? 'text-gray-400' : 'text-gray-900 dark:text-black'
              )}>
                {t.value}
              </p>
              {t.sub && (
                <p className={cn('text-xs mt-0.5', t.subClass ?? 'text-gray-500')}>
                  {t.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dispute warning stripe — always visible, always obvious */}
      {data.disputedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{data.disputedCount} disputed settlement{data.disputedCount > 1 ? 's' : ''}</strong>
            {' '}totalling{' '}
            <strong>{fmt(data.disputedAmount)}</strong>
            {' '}— excluded from totals above
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 3. StationFinancialsTable ────────────────────────────────────────────────

type SortKey = keyof Pick<StationFinancial,
  'grossRevenue' | 'platformFees' | 'franchiseShare' | 'stationPayouts' |
  'bookingCount' | 'avgOrderValue' | 'disputedCount'
>;

interface StationFinancialsTableProps {
  stations:           StationFinancial[];
  ownerType:          OwnerType;
  isLoading?:         boolean;
  buildDrilldownUrl?: (stationId: number) => string;
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-gray-400 ml-1 inline" />;
  return dir === 'desc'
    ? <ChevronDown className="h-3 w-3 ml-1 inline text-gray-900 dark:text-black" />
    : <ChevronUp   className="h-3 w-3 ml-1 inline text-gray-900 dark:text-black" />;
}

export function StationFinancialsTable({ stations, ownerType, isLoading, buildDrilldownUrl }: StationFinancialsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('grossRevenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sorted = [...stations].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const isCompany = ownerType === 'company';

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (stations.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center text-sm text-gray-500">
          No station data for this period
        </CardContent>
      </Card>
    );
  }

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap text-xs"
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col} active={sortKey === col} dir={sortDir} />
    </TableHead>
  );

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-black">
          Station Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-white dark:bg-white">
                <TableHead className="text-xs">Station</TableHead>
                <Th col="grossRevenue"   label="Gross Revenue" />
                <Th col="platformFees"   label="Platform" />
                {!isCompany && <Th col="franchiseShare" label="Franchise" />}
                <Th col="stationPayouts" label="Station Payout" />
                <Th col="bookingCount"   label="Settlements" />
                <Th col="avgOrderValue"  label="AOV" />
                <Th col="disputedCount"  label="Disputes" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((st) => {
                const hasDispute = st.disputedCount > 0;
                return (
                  <TableRow
                    key={st.stationId}
                    className={cn(
                      'text-sm',
                      hasDispute && 'bg-amber-50/40 dark:bg-amber-950/20'
                    )}
                  >
                    <TableCell className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        {st.ownershipType === 'company'
                          ? <Factory className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          : <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        }
                        <div>
                          {buildDrilldownUrl ? (
                            <Link
                              href={buildDrilldownUrl(st.stationId)}
                              className="font-medium leading-tight text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {st.stationName}
                            </Link>
                          ) : (
                            <p className="font-medium leading-tight">{st.stationName}</p>
                          )}
                          <p className="text-xs text-gray-400">{st.stationCode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 font-medium">{fmt(st.grossRevenue)}</TableCell>
                    <TableCell className="py-2.5 text-gray-600 dark:text-gray-400">{fmt(st.platformFees)}</TableCell>
                    {!isCompany && (
                      <TableCell className="py-2.5 text-gray-600 dark:text-gray-400">{fmt(st.franchiseShare)}</TableCell>
                    )}
                    <TableCell className="py-2.5">{fmt(st.stationPayouts)}</TableCell>
                    <TableCell className="py-2.5 text-center">
                      <span className="text-gray-700 dark:text-black">{st.bookingCount}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-gray-600 dark:text-gray-400">{fmt(st.avgOrderValue)}</TableCell>
                    <TableCell className="py-2.5">
                      {hasDispute ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {st.disputedCount}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 4. PayoutCycleList ───────────────────────────────────────────────────────

interface PayoutCycleListProps {
  cycles:     PayoutCycle[];
  ownerType:  OwnerType;
  isLoading?: boolean;
}

const CYCLE_STATUS_CONFIG: Record<CycleStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',            className: 'border-yellow-400 text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300',  icon: <Clock className="h-3 w-3 mr-1" /> },
  in_progress: { label: 'In Progress',        className: 'border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',             icon: <Wrench className="h-3 w-3 mr-1" /> },
  completed:   { label: 'Completed',          className: 'border-green-400 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300',         icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
  internal:    { label: 'Internal Settlement', className: 'border-gray-300 text-gray-600 bg-white dark:bg-white dark:text-gray-400',             icon: <CalendarCheck className="h-3 w-3 mr-1" /> },
};

export function PayoutCycleList({ cycles, ownerType, isLoading }: PayoutCycleListProps) {
  const isCompany = ownerType === 'company';

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-10">
        No settlement cycles found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cycles.map((cycle) => {
        const cfg = CYCLE_STATUS_CONFIG[cycle.status];
        return (
          <Card
            key={cycle.cycleId}
            className={cn(
              'border shadow-sm',
              cycle.hasReconciliationMismatch && 'border-red-500 dark:border-red-600'
            )}
          >
            <CardContent className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Week range */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {cycle.weekStart} → {cycle.weekEnd}
                    <span className="ml-2 text-gray-400">{cycle.cycleId}</span>
                  </p>

                  {/* Status badge */}
                  <Badge variant="outline" className={cn('text-xs mb-2', cfg.className)}>
                    {cfg.icon}{cfg.label}
                  </Badge>

                  {/* Key amounts */}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                    <span>
                      <span className="text-gray-500 text-xs">Gross </span>
                      <span className="font-semibold">{fmt(cycle.grossRevenue)}</span>
                    </span>
                    {!isCompany && (
                      <span>
                        <span className="text-gray-500 text-xs">Franchise </span>
                        <span>{fmt(cycle.franchiseShare)}</span>
                      </span>
                    )}
                    <span>
                      <span className="text-gray-500 text-xs">Station </span>
                      <span>{fmt(cycle.stationPayouts)}</span>
                    </span>
                  </div>

                  {/* Settlement counts */}
                  <p className="text-xs text-gray-400 mt-1">
                    {cycle.settlementCount} settlements ·{' '}
                    {cycle.settledCount} settled ·{' '}
                    {cycle.pendingCount} pending
                    {cycle.disputedCount > 0 && (
                      <span className="text-amber-600 ml-1">
                        · {cycle.disputedCount} disputed ({fmt(cycle.disputedAmount)})
                      </span>
                    )}
                  </p>
                </div>

                {/* Right column: payout date + mismatch flag */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {/* Reconciliation mismatch — prominent, not subtle */}
                  {cycle.hasReconciliationMismatch && (
                    <div className="flex items-center gap-1 rounded border border-red-500 bg-red-50 dark:bg-red-950 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                      <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      Split mismatch — review required
                    </div>
                  )}

                  {/* Expected payout date — hidden for internal cycles */}
                  {!isCompany && cycle.expectedPayoutDate && (
                    <p className="text-xs text-gray-500 text-right">
                      {cycle.status === 'completed' ? 'Settled' : 'Expected'}
                      <br />
                      <span className="font-medium text-gray-700 dark:text-black">
                        {cycle.expectedPayoutDate}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── 5. AuditEventFeed ───────────────────────────────────────────────────────

interface AuditEventFeedProps {
  events:     AuditEvent[];
  isLoading?: boolean;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  dispute_opened:     { label: 'Dispute opened',      icon: <ShieldAlert  className="h-3.5 w-3.5" /> },
  refund_approved:    { label: 'Refund approved',     icon: <ReceiptText  className="h-3.5 w-3.5" /> },
  downtime_started:   { label: 'Station offline',     icon: <Wrench       className="h-3.5 w-3.5" /> },
  booking_cancelled:  { label: 'Booking cancelled',   icon: <XCircle      className="h-3.5 w-3.5" /> },
  settlement_disputed:{ label: 'Settlement disputed', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const SEVERITY_STRIP: Record<Severity, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-gray-300 dark:bg-gray-600',
};

const SEVERITY_TEXT: Record<Severity, string> = {
  high:   'text-red-700 dark:text-red-300',
  medium: 'text-amber-700 dark:text-amber-300',
  low:    'text-gray-500',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('he-IL');
}

export function AuditEventFeed({ events, isLoading }: AuditEventFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-10">
        No recent events
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {events.map((ev, idx) => {
        const cfg = EVENT_TYPE_CONFIG[ev.eventType] ?? { label: ev.eventType, icon: <AlertTriangle className="h-3.5 w-3.5" /> };
        return (
          <div
            key={`${ev.refId}-${idx}`}
            className="flex items-stretch gap-0 rounded-md border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-white"
          >
            {/* Severity colour strip — left edge */}
            <div className={cn('w-1 flex-shrink-0', SEVERITY_STRIP[ev.severity])} />

            <div className="flex items-start gap-3 px-3 py-2.5 flex-1 min-w-0">
              {/* Event type icon */}
              <span className={cn('mt-0.5 flex-shrink-0', SEVERITY_TEXT[ev.severity])}>
                {cfg.icon}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs font-semibold', SEVERITY_TEXT[ev.severity])}>
                    {cfg.label}
                  </span>
                  <Badge variant="outline" className="text-xs py-0 px-1.5 h-4 border-gray-300 text-gray-500">
                    {ev.stationCode}
                  </Badge>
                  {ev.amountILS > 0 && (
                    <span className="text-xs text-gray-500">{fmt(ev.amountILS)}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {ev.stationName}
                  {ev.detailStatus && <span className="ml-1 text-gray-400">· {ev.detailStatus}</span>}
                  {ev.detailReason && <span className="ml-1 text-gray-400">· {ev.detailReason}</span>}
                </p>
              </div>

              {/* Timestamp */}
              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                {relativeTime(ev.occurredAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 6. SettlementLedger ──────────────────────────────────────────────────────

interface SettlementLedgerProps {
  rows:      SettlementRow[];
  summary:   SettlementLedgerSummary;
  ownerType: OwnerType;
  isLoading?: boolean;
}

function statusBadge(status: string) {
  if (status === 'settled') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0 text-xs font-normal">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Settled
      </Badge>
    );
  }
  if (status === 'disputed') {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0 text-xs font-normal">
        <XCircle className="h-3 w-3 mr-1" />
        Disputed
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0 text-xs font-normal">
      <Clock className="h-3 w-3 mr-1" />
      Pending
    </Badge>
  );
}

export function SettlementLedger({ rows, summary, ownerType, isLoading }: SettlementLedgerProps) {
  const isCompany = ownerType === 'company';

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: summary.total,    color: 'text-gray-700 dark:text-black' },
          { label: 'Settled',  value: summary.settled,  color: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Pending',  value: summary.pending,  color: 'text-yellow-700 dark:text-yellow-400' },
          { label: 'Disputed', value: summary.disputed, color: 'text-red-700 dark:text-red-400' },
          { label: 'Mismatches', value: summary.mismatchCount, color: 'text-orange-700 dark:text-orange-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className={cn('text-xl font-bold', color)}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ledger table */}
      {rows.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-sm text-gray-500">
            No settlements in this period
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white dark:bg-white">
                    <TableHead className="text-xs">Booking</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Platform</TableHead>
                    {!isCompany && <TableHead className="text-xs text-right">Franchise</TableHead>}
                    <TableHead className="text-xs text-right">Station</TableHead>
                    <TableHead className="text-xs text-center">Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isDisputed  = row.status === 'disputed';
                    const hasMismatch = row.hasReconciliationMismatch;
                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          'text-sm',
                          isDisputed  && 'bg-red-50/60 dark:bg-red-950/30',
                          hasMismatch && !isDisputed && 'bg-orange-50/60 dark:bg-orange-950/30',
                        )}
                      >
                        <TableCell className="py-2.5 font-mono text-xs">
                          <Link
                            href={`/booking-trace/${row.bookingId}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {row.bookingId}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                          {new Date(row.createdAt).toLocaleDateString('he-IL')}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {statusBadge(row.status)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-medium">
                          {fmt(row.totalAmount)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                          <span>{fmt(row.platformAmount)}</span>
                          <span className="text-xs text-gray-400 ml-1">({row.platformFeePct}%)</span>
                        </TableCell>
                        {!isCompany && (
                          <TableCell className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                            <span>{fmt(row.franchiseShare)}</span>
                            {row.franchiseOverridePct != null && (
                              <span className="text-xs text-gray-400 ml-1">({row.franchiseOverridePct}%)</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="py-2.5 text-right">
                          {fmt(row.stationAmount)}
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          {hasMismatch ? (
                            <span title="Split totals do not add up to gross — reconciliation required">
                              <TriangleAlert className="h-4 w-4 text-orange-500 mx-auto" />
                            </span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
