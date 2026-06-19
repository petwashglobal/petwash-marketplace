/**
 * AdminSupportIncident — Support AI Script Builder (§15) + Incident Mode (§18).
 *
 * READ-ONLY / RECORD-ONLY. Pure display. No mutations, no money actions.
 *
 *   §15 Support Script Builder → GET /api/admin/support-scripts
 *        A deterministic decision-tree: pick an issue → see diagnostic steps +
 *        the recommended (advisory) action. Static structured content.
 *   §18 Incident Mode          → GET /api/admin/incidents
 *        Read-only incidents list (open/critical first) with timeline, RCA, and
 *        a READ-ONLY advisory hold flag. The advisory hold is a signal only — it
 *        is NOT wired into any payout/refund logic.
 *
 * White / black / gold brand. Bilingual via useLanguage, RTL-aware. Honest:
 * advisory-only signals are labelled as such, never presented as enforced.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck, Activity, AlertTriangle, MessageSquare, ChevronRight,
  Banknote, Clock, Link2, FileText, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = '#D4AF37';

// ── Types (mirror the read-only API payloads) ────────────────────────────────
interface BiText { en: string; he: string }
interface SupportScript {
  id: string;
  issue: BiText;
  diagnosticSteps: BiText[];
  recommendedAction: BiText;
  touchesMoney: boolean;
}
interface SupportScriptsResponse {
  wired: boolean;
  static: boolean;
  generatedAt: string;
  note?: string;
  scripts: SupportScript[];
}

interface AdvisoryHold {
  active: boolean;
  enforced: boolean;
  scope?: string;
  bookingId?: string | null;
  providerId?: string | null;
  reason?: string;
  note?: string;
}
interface TimelineEntry {
  id: number;
  eventType: string;
  content: string;
  actor: string;
  occurredAt: string | null;
}
interface IncidentRow {
  id: number;
  title: string;
  severity: string;
  status: string;
  isOpen: boolean;
  startedAt: string | null;
  resolvedAt: string | null;
  createdBy: string;
  summary: string | null;
  linked: { bookingId: string | null; faultId: string | null; providerId: string | null };
  advisoryHold: AdvisoryHold;
  timeline: TimelineEntry[];
  rca: {
    generatedAt: string | null;
    conclusion: string | null;
    recommendedAction: string | null;
    confidenceOverall: string | null;
    generatedBy: string | null;
  } | null;
}
interface IncidentsResponse {
  wired: boolean;
  generatedAt: string;
  incidentCount: number;
  openCount?: number;
  criticalCount?: number;
  advisoryHoldCount?: number;
  incidents: IncidentRow[];
  errors?: string[];
  advisoryHoldNote?: string;
  note?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string | null, he: boolean): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(he ? 'he-IL' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function severityStyle(sev: string): string {
  switch ((sev || '').toLowerCase()) {
    case 'critical': return 'bg-red-50 text-red-700 border-red-200';
    case 'high':     return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'medium':   return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:         return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  }
}

export default function AdminSupportIncident() {
  const { language, dir } = useLanguage();
  const he = language === 'he';
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);

  const scripts = useQuery<SupportScriptsResponse>({
    queryKey: ['/api/admin/support-scripts'],
  });
  const incidents = useQuery<IncidentsResponse>({
    queryKey: ['/api/admin/incidents'],
    refetchInterval: 60000,
  });

  const tr = (b: BiText) => (he ? b.he : b.en);

  const T = {
    title: he ? 'תמיכה ואירועים' : 'Support & Incidents',
    subtitle: he
      ? 'בונה תסריטי תמיכה (§15) ומצב אירוע (§18) — לקריאה בלבד'
      : 'Support Script Builder (§15) + Incident Mode (§18) — read-only',
    scriptsHeading: he ? 'בונה תסריטי תמיכה' : 'Support Script Builder',
    scriptsHint: he ? 'בחר סוג בעיה כדי לראות שלבי אבחון והמלצת פעולה' : 'Pick an issue type to see diagnostic steps + recommended action',
    pickIssue: he ? 'בחר בעיה' : 'Pick an issue',
    diagnostic: he ? 'שלבי אבחון' : 'Diagnostic steps',
    recommended: he ? 'פעולה מומלצת (ייעוץ)' : 'Recommended action (advisory)',
    touchesMoney: he ? 'נוגע בכסף — הסלם, אל תפעל לבד' : 'Touches money — escalate, don’t self-serve',
    incidentsHeading: he ? 'אירועים' : 'Incidents',
    incidentsHint: he ? 'פתוחים/קריטיים תחילה — לקריאה בלבד' : 'Open/critical first — read-only',
    open: he ? 'פתוח' : 'Open',
    critical: he ? 'קריטי' : 'Critical',
    advisoryHolds: he ? 'עיכובים מייעצים' : 'Advisory holds',
    timeline: he ? 'ציר זמן' : 'Timeline',
    rca: he ? 'ניתוח שורש' : 'Root-cause analysis',
    linkedBooking: he ? 'הזמנה מקושרת' : 'Linked booking',
    linkedFault: he ? 'תקלה מקושרת' : 'Linked fault',
    advisoryHold: he ? 'עיכוב מייעץ' : 'Advisory hold',
    advisoryHoldExplain: he
      ? 'אות מייעץ בלבד. אינו מעכב תשלום/החזר. אכיפה היא שלב עתידי שיאושר בנפרד.'
      : 'Advisory signal only. Does not hold any payout/refund. Enforcement is a future, separately-approved step.',
    noIncidents: he ? 'אין אירועים להצגה' : 'No incidents to display',
    started: he ? 'נפתח' : 'Started',
    resolved: he ? 'נפתר' : 'Resolved',
    loadFailScripts: he ? 'טעינת התסריטים נכשלה' : 'Failed to load scripts',
    loadFailIncidents: he ? 'טעינת האירועים נכשלה' : 'Failed to load incidents',
    confidence: he ? 'רמת ודאות' : 'Confidence',
  };

  const activeScript = scripts.data?.scripts.find((s) => s.id === activeScriptId) ?? null;

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: `${GOLD}1A` }}>
          <ShieldCheck className="h-6 w-6" style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{T.title}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{T.subtitle}</p>
        </div>
      </div>

      {/* ── §15 SUPPORT SCRIPT BUILDER ─────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.scriptsHeading}</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-3">{T.scriptsHint}</p>

        {scripts.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : scripts.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">{T.loadFailScripts}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Issue picker */}
            <div className="lg:col-span-5">
              <p className="text-xs font-medium text-neutral-500 mb-2">{T.pickIssue}</p>
              <div className="space-y-2">
                {scripts.data?.scripts.map((s) => {
                  const active = s.id === activeScriptId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveScriptId(s.id)}
                      className={cn(
                        'w-full text-start rounded-xl border px-4 py-3 transition flex items-center justify-between gap-2',
                        active ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400',
                      )}
                      style={active ? { boxShadow: `inset 3px 0 0 ${GOLD}` } : undefined}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{tr(s.issue)}</span>
                        {s.touchesMoney && (
                          <Banknote className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                        )}
                      </span>
                      <ChevronRight className={cn('h-4 w-4 text-neutral-400 shrink-0', dir === 'rtl' && 'rotate-180')} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected script detail */}
            <div className="lg:col-span-7">
              {!activeScript ? (
                <Card><CardContent className="py-10 text-center text-sm text-neutral-400">
                  {T.pickIssue}
                </CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="py-5 space-y-4">
                    <h3 className="text-base font-semibold">{tr(activeScript.issue)}</h3>

                    {activeScript.touchesMoney && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-800">{T.touchesMoney}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-neutral-500 mb-2">{T.diagnostic}</p>
                      <ol className="space-y-2">
                        {activeScript.diagnosticSteps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span
                              className="shrink-0 mt-0.5 h-5 w-5 rounded-full grid place-items-center text-[11px] font-semibold text-white"
                              style={{ backgroundColor: GOLD }}
                            >{i + 1}</span>
                            <span className="text-neutral-800">{tr(step)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
                      <p className="text-xs font-medium text-neutral-500 mb-1">{T.recommended}</p>
                      <p className="text-sm text-neutral-800">{tr(activeScript.recommendedAction)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── §18 INCIDENT MODE ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.incidentsHeading}</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-3">{T.incidentsHint}</p>

        {/* Advisory-hold disclaimer banner */}
        <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 mb-4">
          <Info className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
          <p className="text-xs text-neutral-600">{T.advisoryHoldExplain}</p>
        </div>

        {incidents.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : incidents.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">{T.loadFailIncidents}</CardContent></Card>
        ) : (incidents.data?.incidentCount ?? 0) === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-neutral-400">{T.noIncidents}</CardContent></Card>
        ) : (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="rounded-full border border-neutral-200 px-3 py-1">
                {T.open}: <b>{incidents.data?.openCount ?? 0}</b>
              </span>
              <span className="rounded-full border border-red-200 bg-red-50 text-red-700 px-3 py-1">
                {T.critical}: <b>{incidents.data?.criticalCount ?? 0}</b>
              </span>
              <span className="rounded-full border px-3 py-1" style={{ borderColor: `${GOLD}66`, color: GOLD }}>
                {T.advisoryHolds}: <b>{incidents.data?.advisoryHoldCount ?? 0}</b>
              </span>
            </div>

            <div className="space-y-3">
              {incidents.data?.incidents.map((inc) => (
                <Card key={inc.id} className={cn(inc.isOpen ? 'border-neutral-300' : 'border-neutral-200')}>
                  <CardContent className="py-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">{inc.title}</h3>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {T.started}: {fmtTime(inc.startedAt, he)}
                          {inc.resolvedAt ? ` · ${T.resolved}: ${fmtTime(inc.resolvedAt, he)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={cn('text-[11px]', severityStyle(inc.severity))}>
                          {inc.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">{inc.status}</Badge>
                      </div>
                    </div>

                    {inc.summary && <p className="text-sm text-neutral-700">{inc.summary}</p>}

                    {/* Linked + advisory hold chips */}
                    <div className="flex flex-wrap gap-2">
                      {inc.linked.bookingId && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700">
                          <Link2 className="h-3 w-3" /> {T.linkedBooking}: {inc.linked.bookingId}
                        </span>
                      )}
                      {inc.linked.faultId && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700">
                          <AlertTriangle className="h-3 w-3" /> {T.linkedFault}: {inc.linked.faultId}
                        </span>
                      )}
                      {inc.advisoryHold.active && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
                          style={{ borderColor: `${GOLD}66`, color: GOLD }}
                          title={inc.advisoryHold.note}
                        >
                          <ShieldCheck className="h-3 w-3" /> {T.advisoryHold}
                        </span>
                      )}
                    </div>

                    {/* RCA */}
                    {inc.rca && (inc.rca.conclusion || inc.rca.recommendedAction) && (
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <p className="text-[11px] font-medium text-neutral-500 mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {T.rca}
                          {inc.rca.confidenceOverall && (
                            <span className="text-neutral-400">· {T.confidence}: {inc.rca.confidenceOverall}</span>
                          )}
                        </p>
                        {inc.rca.conclusion && <p className="text-xs text-neutral-700">{inc.rca.conclusion}</p>}
                        {inc.rca.recommendedAction && (
                          <p className="text-xs text-neutral-600 mt-1">→ {inc.rca.recommendedAction}</p>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    {inc.timeline.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-neutral-500 mb-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {T.timeline}
                        </p>
                        <ul className="space-y-1.5">
                          {inc.timeline.map((t) => (
                            <li key={t.id} className="flex items-start gap-2 text-xs">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: GOLD }} />
                              <span className="text-neutral-700">
                                <span className="text-neutral-400">{fmtTime(t.occurredAt, he)} · {t.actor}</span>
                                {' — '}{t.content}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
