/**
 * AdminFaultIntel — Fault & Maintenance Intel (read-only).
 *
 * Surfaces two CEO "Business OS" modules:
 *   §11 Fault Cost Tracking      → GET /api/admin/fault-cost
 *   §12 Predictive Maintenance   → GET /api/admin/predictive-maintenance
 *
 * Pure display. No mutations. White / black / gold brand. Bilingual via
 * useLanguage, RTL-aware. Honest: when the backend marks a cost/signal input
 * unavailable (null + note), this page shows that explicitly rather than
 * faking a number.
 */
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity, AlertTriangle, Banknote, Clock, Gauge, Repeat, Droplets,
  WifiOff, TrendingDown, ShieldAlert, Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = '#D4AF37';

// ── Types (mirror the read-only API payloads) ────────────────────────────────
interface FaultRow {
  faultId: string;
  stationId: string;
  stationName: string;
  stationNameHe: string | null;
  bayId: string;
  side: string;
  bayLabel: string | null;
  bayLabelHe: string | null;
  faultCode: string;
  severity: string;
  description: string | null;
  descriptionHe: string | null;
  status: string;
  stillOpen: boolean;
  reportedAt: string | null;
  resolvedAt: string | null;
  downtimeHours: number | null;
  avgWashesPerHour: number | null;
  avgRevenuePerWashIls: number | null;
  estLostWashes: number | null;
  estLostRevenueIls: number | null;
  estimateNote: string | null;
  repeatFaultCount: number;
}
interface StationTotal {
  stationId: string;
  stationName: string;
  stationNameHe: string | null;
  faults: number;
  downtimeHours: number;
  estLostWashes: number;
  estLostRevenueIls: number;
  hasUnknownEstimate: boolean;
}
interface FaultCostResponse {
  wired: boolean;
  generatedAt: string;
  lookbackDays: number;
  statusFilter: string;
  faultCount: number;
  faults: FaultRow[];
  stationTotals: StationTotal[];
  grandTotal: {
    faults: number;
    downtimeHours: number;
    estLostWashes: number | null;
    estLostRevenueIls: number | null;
    faultsWithUnknownEstimate?: number;
  };
  errors?: string[];
  note?: string;
}

interface Signal { signal: string; level: 'warning' | 'critical'; reason: string; reasonHe: string; }
interface BayRisk {
  bayId: string;
  stationId: string;
  stationName: string;
  stationNameHe: string | null;
  side: string;
  bayLabel: string | null;
  bayLabelHe: string | null;
  status: string;
  risk: 'low' | 'medium' | 'high';
  signalCount: number;
  signals: Signal[];
  metrics: {
    washes24h: number;
    failed24h: number;
    washes7d: number;
    dailyAvg7d: number;
    faults7d: number;
    shampooLevelPct: number | null;
    conditionerLevelPct: number | null;
    lastHeartbeat: string | null;
    nayaxLastAt: string | null;
  };
  unavailableSignals: string[];
}
interface PredictiveResponse {
  wired: boolean;
  generatedAt: string;
  bayCount: number;
  summary: { high: number; medium: number; low: number };
  bays: BayRisk[];
  errors?: string[];
  note?: string;
}

// ── Small helpers ─────────────────────────────────────────────────────────────
const SIGNAL_ICON: Record<string, typeof Activity> = {
  usage_drop: TrendingDown,
  failed_sessions: AlertTriangle,
  repeated_faults: Repeat,
  no_nayax_recently: WifiOff,
  low_consumables: Droplets,
  stale_heartbeat: Activity,
};

const ESTIMATE_NOTE_HE: Record<string, string> = {
  no_completed_wash_history: 'אין היסטוריית שטיפות שהושלמו לתא — אי אפשר לגזור עלות',
  insufficient_span_to_derive_rate: 'טווח נתונים לא מספיק לגזירת קצב',
  no_revenue_baseline_for_bay: 'אין בסיס הכנסה לתא — לא ניתן להעריך הכנסה אבודה',
  no_reported_at_timestamp: 'אין חותמת זמן לדיווח התקלה',
  no_usage_baseline: 'אין בסיס שימוש',
};
const ESTIMATE_NOTE_EN: Record<string, string> = {
  no_completed_wash_history: 'No completed-wash history for this bay — cost cannot be derived',
  insufficient_span_to_derive_rate: 'Not enough data span to derive a rate',
  no_revenue_baseline_for_bay: 'No revenue baseline for this bay — lost revenue not estimable',
  no_reported_at_timestamp: 'Fault has no reported-at timestamp',
  no_usage_baseline: 'No usage baseline',
};

function ils(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}
function num(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

export default function AdminFaultIntel() {
  const { language, dir } = useLanguage();
  const he = language === 'he';

  const cost = useQuery<FaultCostResponse>({
    queryKey: ['/api/admin/fault-cost'],
    refetchInterval: 60000,
  });
  const pred = useQuery<PredictiveResponse>({
    queryKey: ['/api/admin/predictive-maintenance'],
    refetchInterval: 60000,
  });

  const T = {
    title: he ? 'תקלות ותחזוקה חכמה' : 'Fault & Maintenance Intel',
    subtitle: he
      ? 'מעקב עלות תקלות (§11) ותחזוקה מנבאת (§12) — לקריאה בלבד'
      : 'Fault Cost Tracking (§11) + Predictive Maintenance (§12) — read-only',
    costHeading: he ? 'עלות תקלות' : 'Fault Cost Tracking',
    predHeading: he ? 'תחזוקה מנבאת' : 'Predictive Maintenance',
    grandTotal: he ? 'סה״כ' : 'Grand total',
    faults: he ? 'תקלות' : 'Faults',
    downtime: he ? 'שעות השבתה' : 'Downtime hrs',
    lostWashes: he ? 'שטיפות אבודות (הערכה)' : 'Lost washes (est.)',
    lostRevenue: he ? 'הכנסה אבודה (הערכה)' : 'Lost revenue (est.)',
    byStation: he ? 'לפי עמדה' : 'By station',
    perFault: he ? 'פירוט תקלות' : 'Per-fault detail',
    bay: he ? 'תא' : 'Bay',
    station: he ? 'עמדה' : 'Station',
    code: he ? 'קוד' : 'Code',
    repeat: he ? 'חזרות' : 'Repeats',
    open: he ? 'פתוחה' : 'Open',
    resolved: he ? 'נפתרה' : 'Resolved',
    estimateUnavailable: he ? 'הערכה לא זמינה' : 'Estimate unavailable',
    riskHigh: he ? 'סיכון גבוה' : 'High risk',
    riskMedium: he ? 'סיכון בינוני' : 'Medium risk',
    riskLow: he ? 'סיכון נמוך' : 'Low risk',
    noSignals: he ? 'אין אותות אזהרה' : 'No warning signals',
    signalsFire: he ? 'אותות שנדלקו' : 'Signals firing',
    unavailable: he ? 'אותות לא זמינים (אין נתון)' : 'Unavailable signals (no data)',
    empty: he ? 'אין נתונים להצגה' : 'Nothing to display yet',
    estimateLabel: he ? 'מספרי ההכנסה האבודה הם הערכה, לא רישום חשבונאי' : 'Lost-revenue figures are estimates, not ledger entries',
  };

  const riskLabel = (r: string) => (r === 'high' ? T.riskHigh : r === 'medium' ? T.riskMedium : T.riskLow);
  const riskStyle = (r: string) =>
    r === 'high'
      ? 'bg-red-50 text-red-700 border-red-200'
      : r === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const noteText = (key: string | null) =>
    !key ? '' : (he ? ESTIMATE_NOTE_HE[key] : ESTIMATE_NOTE_EN[key]) ?? key;

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: `${GOLD}1A` }}>
          <Wrench className="h-6 w-6" style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{T.title}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{T.subtitle}</p>
        </div>
      </div>

      {/* ── §11 FAULT COST ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.costHeading}</h2>
        </div>

        {cost.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : cost.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">
            {he ? 'טעינת עלות התקלות נכשלה' : 'Failed to load fault cost'}
          </CardContent></Card>
        ) : (
          <>
            {/* Grand-total cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <TotalCard icon={AlertTriangle} label={T.faults} value={String(cost.data?.grandTotal.faults ?? 0)} />
              <TotalCard icon={Clock} label={T.downtime} value={num(cost.data?.grandTotal.downtimeHours ?? 0)} />
              <TotalCard icon={Gauge} label={T.lostWashes} value={num(cost.data?.grandTotal.estLostWashes ?? null)} />
              <TotalCard icon={Banknote} label={T.lostRevenue} value={ils(cost.data?.grandTotal.estLostRevenueIls ?? null)} gold />
            </div>

            <p className="text-[11px] text-neutral-400 mt-2 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> {T.estimateLabel}
            </p>

            {(cost.data?.faultCount ?? 0) === 0 ? (
              <Card className="mt-4"><CardContent className="py-6 text-center text-sm text-neutral-500">
                {cost.data?.note ?? T.empty}
              </CardContent></Card>
            ) : (
              <>
                {/* Per-station totals */}
                {(cost.data?.stationTotals?.length ?? 0) > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-medium text-neutral-600 mb-2">{T.byStation}</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {cost.data!.stationTotals.map((s) => (
                        <Card key={s.stationId} className="border-neutral-200">
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{he ? (s.stationNameHe ?? s.stationName) : s.stationName}</span>
                              <Badge variant="outline" className="text-[10px]">{s.faults} {T.faults}</Badge>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-neutral-600">
                              <Metric label={T.downtime} value={num(s.downtimeHours)} />
                              <Metric label={T.lostWashes} value={num(s.estLostWashes)} />
                              <Metric label={T.lostRevenue} value={ils(s.estLostRevenueIls)} gold />
                            </div>
                            {s.hasUnknownEstimate && (
                              <p className="text-[10px] text-amber-600 mt-1.5">{T.estimateUnavailable}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-fault detail */}
                <div className="mt-5">
                  <h3 className="text-sm font-medium text-neutral-600 mb-2">{T.perFault}</h3>
                  <div className="space-y-2">
                    {cost.data!.faults.map((f) => (
                      <Card key={f.faultId} className="border-neutral-200">
                        <CardContent className="py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn('text-[10px] border',
                              f.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200'
                                : f.severity === 'error' ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200')}>
                              {f.severity}
                            </Badge>
                            <span className="font-mono text-xs text-neutral-700">{f.faultCode}</span>
                            <span className="text-xs text-neutral-500">
                              {he ? (f.stationNameHe ?? f.stationName) : f.stationName} · {he ? (f.bayLabelHe ?? f.bayLabel ?? f.side) : (f.bayLabel ?? f.side)}
                            </span>
                            <Badge variant="outline" className={cn('text-[10px]', f.stillOpen ? 'text-red-600' : 'text-emerald-600')}>
                              {f.stillOpen ? T.open : T.resolved}
                            </Badge>
                            {f.repeatFaultCount > 1 && (
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Repeat className="h-3 w-3" /> {f.repeatFaultCount}×
                              </Badge>
                            )}
                          </div>
                          {(he ? f.descriptionHe : f.description) && (
                            <p className="text-xs text-neutral-600 mt-1.5">{he ? f.descriptionHe : f.description}</p>
                          )}
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-600">
                            <Metric label={T.downtime} value={num(f.downtimeHours)} />
                            <Metric label={he ? 'שטיפות/שעה' : 'Washes/hr'} value={num(f.avgWashesPerHour)} />
                            <Metric label={T.lostWashes} value={num(f.estLostWashes)} />
                            <Metric label={T.lostRevenue} value={ils(f.estLostRevenueIls)} gold />
                          </div>
                          {f.estimateNote && (
                            <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3 shrink-0" /> {noteText(f.estimateNote)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ── §12 PREDICTIVE MAINTENANCE ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.predHeading}</h2>
        </div>

        {pred.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : pred.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">
            {he ? 'טעינת התחזוקה המנבאת נכשלה' : 'Failed to load predictive maintenance'}
          </CardContent></Card>
        ) : (
          <>
            {/* Risk summary */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <TotalCard icon={ShieldAlert} label={T.riskHigh} value={String(pred.data?.summary.high ?? 0)} tone="red" />
              <TotalCard icon={AlertTriangle} label={T.riskMedium} value={String(pred.data?.summary.medium ?? 0)} tone="amber" />
              <TotalCard icon={Gauge} label={T.riskLow} value={String(pred.data?.summary.low ?? 0)} tone="emerald" />
            </div>

            {(pred.data?.bayCount ?? 0) === 0 ? (
              <Card><CardContent className="py-6 text-center text-sm text-neutral-500">
                {pred.data?.note ?? T.empty}
              </CardContent></Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {pred.data!.bays.map((b) => (
                  <Card key={b.bayId} className={cn('border', riskStyle(b.risk))}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {he ? (b.stationNameHe ?? b.stationName) : b.stationName}
                          <span className="text-neutral-400 font-normal"> · {he ? (b.bayLabelHe ?? b.bayLabel ?? b.side) : (b.bayLabel ?? b.side)}</span>
                        </span>
                        <Badge className={cn('text-[10px] border', riskStyle(b.risk))}>{riskLabel(b.risk)}</Badge>
                      </div>

                      {/* Metrics row */}
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-neutral-600">
                        <Metric label={he ? 'שטיפות 24ש' : '24h washes'} value={String(b.metrics.washes24h)} />
                        <Metric label={he ? 'ממוצע יומי' : 'Daily avg'} value={num(b.metrics.dailyAvg7d)} />
                        <Metric label={he ? 'תקלות 7י' : 'Faults 7d'} value={String(b.metrics.faults7d)} />
                      </div>

                      {/* Signals */}
                      {b.signals.length === 0 ? (
                        <p className="text-[11px] text-emerald-600 mt-2">{T.noSignals}</p>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-neutral-400">{T.signalsFire}</p>
                          {b.signals.map((sig, idx) => {
                            const Icon = SIGNAL_ICON[sig.signal] ?? AlertTriangle;
                            return (
                              <div key={idx} className="flex items-start gap-1.5">
                                <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', sig.level === 'critical' ? 'text-red-500' : 'text-amber-500')} />
                                <span className="text-[11px] text-neutral-700">{he ? sig.reasonHe : sig.reason}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {b.unavailableSignals.length > 0 && (
                        <p className="text-[10px] text-neutral-400 mt-2">
                          {T.unavailable}: {b.unavailableSignals.join(', ')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── Presentational helpers ────────────────────────────────────────────────────
function TotalCard({
  icon: Icon, label, value, gold, tone,
}: {
  icon: typeof Activity; label: string; value: string; gold?: boolean;
  tone?: 'red' | 'amber' | 'emerald';
}) {
  const toneClass =
    tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-neutral-400';
  return (
    <Card className="border-neutral-200">
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <Icon className={cn('h-3.5 w-3.5', toneClass)} style={gold ? { color: GOLD } : undefined} />
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-1 text-lg font-semibold" style={gold ? { color: GOLD } : undefined}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-neutral-400">{label}</div>
      <div className="font-medium" style={gold ? { color: GOLD } : undefined}>{value}</div>
    </div>
  );
}
