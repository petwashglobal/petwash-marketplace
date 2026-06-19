/**
 * AdminBuildingsPartners — Building / Resident Program (§8) +
 * Partner Report Automation (§28). READ-ONLY.
 *
 * Surfaces two CEO "Business OS" modules:
 *   §28 Partner Report  → GET /api/admin/partner-report
 *   §8  Buildings       → GET /api/admin/buildings
 *
 * Pure display. No mutations. White / black / gold brand. Bilingual via
 * useLanguage, RTL-aware. Honest: when the backend marks a metric unavailable
 * (null + note — e.g. bay-level faults are not partner-attributable, no
 * building-type column, resident-code is a placeholder), this page shows that
 * explicitly rather than faking a number.
 */
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, Handshake, Banknote, Activity, Users, AlertTriangle,
  ShieldAlert, MapPin, TrendingUp, TrendingDown, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = '#D4AF37';

// ── Types (mirror the read-only API payloads) ────────────────────────────────
interface StationLite {
  id: number;
  stationCode: string;
  name: string;
  nameHe: string | null;
  status: string | null;
  ownershipType: string | null;
  totalWashes: number;
  totalRevenueIls: number;
  lastHeartbeat: string | null;
  isLive: boolean;
}
interface PartnerCard {
  partnerId: number;
  name: string;
  type: string;
  contactEmail: string | null;
  contactPhone: string | null;
  revenueSharePercent: number | null;
  isActive: boolean | null;
  contractStart: string | null;
  contractEnd: string | null;
  stationCount: number;
  stations: StationLite[];
  metrics: {
    washes: number;
    lifetimeRevenueIls: number;
    latestSettlement: {
      periodStart: string | null;
      periodEnd: string | null;
      grossRevenueIls: number;
      partnerShareIls: number;
      petwashShareIls: number;
      status: string | null;
    } | null;
    settlementNote: string | null;
    uptime: { stations: number; operational: number; liveHeartbeat: number; operationalPct: number | null; note: string };
    faults: number | null;
    faultsNote: string;
    faultsNoteHe: string;
    customerGrowth: { feedbackLast30: number; feedbackPrev30: number; growthPct: number | null; note: string };
    supportIssues: { flaggedFeedback: number; note: string };
  };
}
interface FranchiseCard {
  franchiseOwnerId: number;
  businessName: string;
  status: string | null;
  stationCount: number;
  stations: StationLite[];
  metrics: { washes: number; lifetimeRevenueIls: number; operational: number; operationalPct: number | null; faults: number | null; faultsNote: string };
}
interface PartnerReportResponse {
  wired: boolean;
  generatedAt: string;
  partnerCount: number;
  partners: PartnerCard[];
  franchiseOwnerCount: number;
  franchiseOwners: FranchiseCard[];
  dataModelNote: string;
}
interface BuildingCard {
  partnerId: number;
  name: string;
  type: string;
  isActive: boolean | null;
  billingAddress: string | null;
  residentCode: string;
  residentCodeIsPlaceholder: boolean;
  stationCount: number;
  stations: StationLite[];
  performance: { washes: number; lifetimeRevenueIls: number; operational: number; operationalPct: number | null; liveHeartbeat: number };
}
interface BuildingsResponse {
  wired: boolean;
  generatedAt: string;
  hasBuildingType: boolean;
  buildingTypeNote: string;
  residentCodeNote: string;
  buildingCount: number;
  buildings: BuildingCard[];
}

// ── helpers ───────────────────────────────────────────────────────────────────
function ils(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}
function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('he-IL', { maximumFractionDigits: 1 });
}
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n}%`;
}

export default function AdminBuildingsPartners() {
  const { language, dir } = useLanguage();
  const he = language === 'he';

  const report = useQuery<PartnerReportResponse>({
    queryKey: ['/api/admin/partner-report'],
    refetchInterval: 60000,
  });
  const buildings = useQuery<BuildingsResponse>({
    queryKey: ['/api/admin/buildings'],
    refetchInterval: 60000,
  });

  const T = {
    title: he ? 'בניינים ודוחות שותפים' : 'Buildings & Partner Reports',
    subtitle: he
      ? 'תוכנית בניינים/דיירים (§8) ואוטומציית דוחות שותפים (§28) — לקריאה בלבד'
      : 'Building/Resident program (§8) + Partner Report Automation (§28) — read-only',
    partnersHeading: he ? 'דוחות שותפים' : 'Partner Reports',
    franchiseHeading: he ? 'בעלי זכיינות' : 'Franchise Owners',
    buildingsHeading: he ? 'בניינים / דיירים' : 'Buildings / Residents',
    stations: he ? 'עמדות' : 'Stations',
    washes: he ? 'שטיפות' : 'Washes',
    revenue: he ? 'הכנסה (מצטבר)' : 'Revenue (lifetime)',
    revShare: he ? 'אחוז שותף' : 'Rev share',
    settlement: he ? 'התחשבנות אחרונה' : 'Latest settlement',
    gross: he ? 'ברוטו' : 'Gross',
    partnerShare: he ? 'חלק השותף' : 'Partner share',
    uptime: he ? 'זמינות' : 'Uptime',
    operational: he ? 'פעילות' : 'Operational',
    live: he ? 'חי' : 'Live',
    faults: he ? 'תקלות' : 'Faults',
    growth: he ? 'צמיחת לקוחות' : 'Customer growth',
    support: he ? 'פניות שירות' : 'Support issues',
    feedback30: he ? 'משוב 30י' : 'Feedback 30d',
    flagged: he ? 'מסומנים' : 'Flagged',
    active: he ? 'פעיל' : 'Active',
    inactive: he ? 'לא פעיל' : 'Inactive',
    notAvailable: he ? 'לא זמין' : 'Not available',
    empty: he ? 'אין נתונים להצגה' : 'Nothing to display yet',
    residentCode: he ? 'קוד דייר' : 'Resident code',
    placeholder: he ? 'ממלא מקום' : 'placeholder',
  };

  const statusBadge = (active: boolean | null) => (
    <Badge variant="outline" className={cn('text-[10px]', active === false ? 'text-neutral-500' : 'text-emerald-600')}>
      {active === false ? T.inactive : T.active}
    </Badge>
  );

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: `${GOLD}1A` }}>
          <Building2 className="h-6 w-6" style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{T.title}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{T.subtitle}</p>
        </div>
      </div>

      {/* ── §28 PARTNER REPORTS ──────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Handshake className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.partnersHeading}</h2>
        </div>

        {report.isLoading ? (
          <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
        ) : report.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">
            {he ? 'טעינת דוחות השותפים נכשלה' : 'Failed to load partner reports'}
          </CardContent></Card>
        ) : (report.data?.partnerCount ?? 0) === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-neutral-500">{T.empty}</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {report.data!.partners.map((p) => {
              const g = p.metrics.customerGrowth;
              return (
                <Card key={p.partnerId} className="border-neutral-200">
                  <CardContent className="py-4">
                    {/* Title row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] text-neutral-500">{p.type}</Badge>
                      {statusBadge(p.isActive)}
                      {p.revenueSharePercent != null && (
                        <Badge variant="outline" className="text-[10px]">{T.revShare} {pct(p.revenueSharePercent)}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="h-3 w-3" />{p.stationCount} {T.stations}</Badge>
                    </div>

                    {/* Metric grid */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <Metric icon={Activity} label={T.washes} value={num(p.metrics.washes)} />
                      <Metric icon={Banknote} label={T.revenue} value={ils(p.metrics.lifetimeRevenueIls)} gold />
                      <Metric icon={Activity} label={T.uptime}
                        value={`${pct(p.metrics.uptime.operationalPct)}`}
                        sub={`${p.metrics.uptime.liveHeartbeat} ${T.live}`} />
                      <Metric icon={Users} label={T.growth}
                        value={`${num(g.feedbackLast30)}`}
                        sub={g.growthPct != null ? `${g.growthPct >= 0 ? '+' : ''}${g.growthPct}%` : '—'}
                        trend={g.growthPct} />
                    </div>

                    {/* Settlement (authoritative revenue share) */}
                    {p.metrics.latestSettlement ? (
                      <div className="mt-3 rounded-lg border border-neutral-200 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">{T.settlement}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-neutral-700">
                          <Metric label={T.gross} value={ils(p.metrics.latestSettlement.grossRevenueIls)} />
                          <Metric label={T.partnerShare} value={ils(p.metrics.latestSettlement.partnerShareIls)} gold />
                          <Metric label="PetWash" value={ils(p.metrics.latestSettlement.petwashShareIls)} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-400 mt-2 flex items-center gap-1">
                        <Info className="h-3 w-3" /> {he ? 'טרם נוצרה התחשבנות לשותף זה' : (p.metrics.settlementNote ?? '')}
                      </p>
                    )}

                    {/* Faults — explicitly unavailable + note */}
                    <p className="text-[10px] text-amber-600 mt-2 flex items-start gap-1">
                      <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{T.faults}: {T.notAvailable} — {he ? p.metrics.faultsNoteHe : p.metrics.faultsNote}</span>
                    </p>

                    {/* Support proxy */}
                    {p.metrics.supportIssues.flaggedFeedback > 0 && (
                      <p className="text-[11px] text-neutral-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {T.support}: {p.metrics.supportIssues.flaggedFeedback} {T.flagged}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Data-model honesty footer */}
            {report.data?.dataModelNote && (
              <p className="text-[10px] text-neutral-400 flex items-start gap-1 px-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" /> {report.data.dataModelNote}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Franchise owners ──────────────────────────────────────────────── */}
      {(report.data?.franchiseOwnerCount ?? 0) > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Handshake className="h-5 w-5" style={{ color: GOLD }} />
            <h2 className="text-lg font-semibold">{T.franchiseHeading}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {report.data!.franchiseOwners.map((o) => (
              <Card key={o.franchiseOwnerId} className="border-neutral-200">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{o.businessName}</span>
                    <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="h-3 w-3" />{o.stationCount}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-neutral-600">
                    <Metric label={T.washes} value={num(o.metrics.washes)} />
                    <Metric label={T.revenue} value={ils(o.metrics.lifetimeRevenueIls)} gold />
                    <Metric label={T.operational} value={pct(o.metrics.operationalPct)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── §8 BUILDINGS / RESIDENTS ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.buildingsHeading}</h2>
        </div>

        {buildings.isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        ) : buildings.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">
            {he ? 'טעינת הבניינים נכשלה' : 'Failed to load buildings'}
          </CardContent></Card>
        ) : (
          <>
            {/* Honest banner about missing building-type column */}
            {buildings.data && !buildings.data.hasBuildingType && (
              <p className="text-[11px] text-neutral-500 mb-3 flex items-start gap-1.5 rounded-lg bg-neutral-50 px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: GOLD }} />
                {he
                  ? 'אין סוג שותף "בניין/מגדל/מגורים" בסכימה — מוצגים כל השותפים המארחים עמדות. קוד הדייר הוא ממלא מקום.'
                  : buildings.data.buildingTypeNote}
              </p>
            )}

            {(buildings.data?.buildingCount ?? 0) === 0 ? (
              <Card><CardContent className="py-6 text-center text-sm text-neutral-500">{T.empty}</CardContent></Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {buildings.data!.buildings.map((b) => (
                  <Card key={b.partnerId} className="border-neutral-200">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{b.name}</span>
                        {statusBadge(b.isActive)}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                        <span>{T.residentCode}:</span>
                        <span className="font-mono">{b.residentCode}</span>
                        {b.residentCodeIsPlaceholder && (
                          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">{T.placeholder}</Badge>
                        )}
                      </div>
                      {b.billingAddress && (
                        <p className="text-[11px] text-neutral-500 mt-1 truncate">{b.billingAddress}</p>
                      )}
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-neutral-600">
                        <Metric label={T.stations} value={String(b.stationCount)} />
                        <Metric label={T.washes} value={num(b.performance.washes)} />
                        <Metric label={T.revenue} value={ils(b.performance.lifetimeRevenueIls)} gold />
                      </div>
                      {/* Per-station rows */}
                      {b.stations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {b.stations.map((s) => (
                            <div key={s.id} className="flex items-center justify-between text-[11px] text-neutral-600">
                              <span className="truncate flex items-center gap-1">
                                <span className={cn('h-1.5 w-1.5 rounded-full', s.isLive ? 'bg-emerald-500' : 'bg-neutral-300')} />
                                {he ? (s.nameHe ?? s.name) : s.name}
                              </span>
                              <span className="font-mono text-neutral-400">{num(s.totalWashes)} · {ils(s.totalRevenueIls)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {buildings.data?.residentCodeNote && (
              <p className="text-[10px] text-neutral-400 mt-3 flex items-start gap-1 px-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {he ? 'קוד הדייר הוא ממלא מקום דטרמיניסטי; אין עמודת קוד-דייר בסכימה כרגע.' : buildings.data.residentCodeNote}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── Presentational helper ──────────────────────────────────────────────────────
function Metric({
  icon: Icon, label, value, sub, gold, trend,
}: {
  icon?: typeof Activity; label: string; value: string; sub?: string; gold?: boolean; trend?: number | null;
}) {
  const TrendIcon = trend == null ? null : trend >= 0 ? TrendingUp : TrendingDown;
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-neutral-400">
        {Icon && <Icon className="h-3 w-3" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="font-medium mt-0.5" style={gold ? { color: GOLD } : undefined}>{value}</div>
      {sub && (
        <div className={cn('text-[10px] flex items-center gap-0.5',
          trend == null ? 'text-neutral-400' : trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
          {TrendIcon && <TrendIcon className="h-2.5 w-2.5" />}{sub}
        </div>
      )}
    </div>
  );
}
