/**
 * AdminStaffAcademy — Staff Performance (§16) + Staff Academy / Training (§17).
 *
 * Read-only. Surfaces two CEO "Business OS" modules:
 *   §16 Staff Performance  → GET /api/admin/staff-performance
 *   §17 Staff Academy      → GET /api/admin/academy
 *
 * Pure display. No mutations. White / black / gold brand. Bilingual via
 * useLanguage, RTL-aware. Honest: operational throughput from real tables;
 * metrics with no backing table render "—" + a note; the academy shows the
 * documented course catalog (training records not tracked yet) — never faked.
 */
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase, GraduationCap, ClipboardList, AlertTriangle, Clock, Wrench,
  ShieldAlert, Info, CheckCircle2, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = '#D4AF37';

// ── Types (mirror the read-only API payloads) ────────────────────────────────
interface StaffRow {
  employeeId: string;
  name: string;
  department: string;
  position: string;
  hasLinkedAccount: boolean;
  tasksClosed: number;
  tasksOpen: number;
  lateTasks: number;
  faultsClosed: number;
  hoursWorked: number;
  avgTaskResolutionHours: number | null;
  checklistCompletion: number | null;
  checklistNote: string;
  ticketsSolved: number | null;
  avgResponseTimeHours: number | null;
  ticketsNote: string;
}
interface StaffPerfResponse {
  generatedAt: string;
  lookbackDays: number;
  staffCount: number;
  rows: StaffRow[];
  note: string;
  degraded: boolean;
  errors: string[];
}
interface AcademyCourse {
  courseId: string;
  titleEn: string;
  titleHe: string;
  summaryEn: string;
  summaryHe: string;
  gatesPermissions: string[];
  required: boolean;
}
interface AcademyResponse {
  generatedAt: string;
  tracked: boolean;
  note: string;
  catalog: AcademyCourse[];
  records: unknown[];
  permissionRule: { enforced: boolean; description: string };
}

function num(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('he-IL', { maximumFractionDigits: 1 });
}

export default function AdminStaffAcademy() {
  const { language, dir } = useLanguage();
  const he = language === 'he';

  const perf = useQuery<StaffPerfResponse>({
    queryKey: ['/api/admin/staff-performance'],
    refetchInterval: 60000,
  });
  const academy = useQuery<AcademyResponse>({
    queryKey: ['/api/admin/academy'],
    refetchInterval: 300000,
  });

  const T = {
    title: he ? 'עובדים ואקדמיה' : 'Staff & Academy',
    subtitle: he
      ? 'ביצועי עובדים (§16) ואקדמיית הדרכה (§17) — לקריאה בלבד'
      : 'Staff Performance (§16) + Staff Academy (§17) — read-only',
    perfHeading: he ? 'ביצועי עובדים' : 'Staff Performance',
    perfNote: he
      ? 'נתוני תפעול לצורך נראות — לא ציון ולא כלי ענישה.'
      : 'Operational visibility — not a score, not a punitive tool.',
    academyHeading: he ? 'אקדמיית PetWash' : 'PetWash Academy',
    staff: he ? 'עובדים' : 'Staff',
    name: he ? 'שם' : 'Name',
    dept: he ? 'מחלקה' : 'Department',
    tasksClosed: he ? 'משימות שנסגרו' : 'Tasks closed',
    tasksOpen: he ? 'משימות פתוחות' : 'Tasks open',
    lateTasks: he ? 'משימות באיחור' : 'Late tasks',
    faultsClosed: he ? 'תקלות שנפתרו' : 'Faults closed',
    hours: he ? 'שעות עבודה' : 'Hours',
    avgResolution: he ? 'זמן טיפול ממוצע (שע׳)' : 'Avg resolution (hrs)',
    checklist: he ? 'השלמת צ׳קליסט' : 'Checklist',
    tickets: he ? 'פניות שנפתרו' : 'Tickets solved',
    response: he ? 'זמן תגובה' : 'Response time',
    notTracked: he ? 'לא נמדד' : 'Not tracked',
    noLink: he ? 'ללא חשבון מקושר' : 'No linked account',
    empty: he ? 'אין עובדים להצגה' : 'No staff to display yet',
    required: he ? 'חובה' : 'Required',
    optional: he ? 'רשות' : 'Optional',
    gates: he ? 'מגדיר הרשאות' : 'Gates permissions',
    notTrackedBanner: he ? 'רשומות הדרכה לא נמדדות עדיין' : 'Training records not tracked yet',
    ruleHeading: he ? 'כלל הרשאות' : 'Permission rule',
    notEnforced: he ? 'לא נאכף' : 'Not enforced',
    degraded: he ? 'חלק מהנתונים לא נטענו' : 'Some metrics failed to load',
  };

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl p-2.5" style={{ backgroundColor: `${GOLD}1A` }}>
          <Briefcase className="h-6 w-6" style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{T.title}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{T.subtitle}</p>
        </div>
      </div>

      {/* ── §16 STAFF PERFORMANCE ─────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-1.5">
          <ClipboardList className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.perfHeading}</h2>
        </div>
        <p className="text-[12px] text-neutral-500 mb-3 flex items-center gap-1">
          <Info className="h-3 w-3" /> {T.perfNote}
        </p>

        {perf.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : perf.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">
            {he ? 'טעינת ביצועי העובדים נכשלה' : 'Failed to load staff performance'}
          </CardContent></Card>
        ) : (perf.data?.rows.length ?? 0) === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-neutral-500">{T.empty}</CardContent></Card>
        ) : (
          <>
            {perf.data?.degraded && (
              <p className="text-[11px] text-amber-600 mb-2 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> {T.degraded}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {perf.data!.rows.map((s) => (
                <Card key={s.employeeId} className="border-neutral-200">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.name || s.employeeId}</div>
                        <div className="text-[12px] text-neutral-500 truncate">
                          {s.position} · {s.department}
                        </div>
                      </div>
                      {!s.hasLinkedAccount && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{T.noLink}</Badge>
                      )}
                    </div>

                    {/* Real metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Metric icon={CheckCircle2} label={T.tasksClosed} value={String(s.tasksClosed)} />
                      <Metric icon={ClipboardList} label={T.tasksOpen} value={String(s.tasksOpen)} />
                      <Metric icon={AlertTriangle} label={T.lateTasks} value={String(s.lateTasks)} warn={s.lateTasks > 0} />
                      <Metric icon={Wrench} label={T.faultsClosed} value={String(s.faultsClosed)} />
                      <Metric icon={Clock} label={T.hours} value={num(s.hoursWorked)} />
                      <Metric icon={Clock} label={T.avgResolution} value={num(s.avgTaskResolutionHours)} />
                    </div>

                    {/* Not-tracked metrics — honest "—" + note */}
                    <div className="mt-3 pt-3 border-t border-neutral-100 grid grid-cols-3 gap-2 text-center opacity-60">
                      <Metric icon={ClipboardList} label={T.checklist} value="—" muted />
                      <Metric icon={ClipboardList} label={T.tickets} value="—" muted />
                      <Metric icon={Clock} label={T.response} value="—" muted />
                    </div>
                    <p className="mt-1.5 text-[10px] text-neutral-400">{T.notTracked}: {he ? 'אין טבלה תומכת בסכימה' : 'no backing table in schema'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── §17 STAFF ACADEMY ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-semibold">{T.academyHeading}</h2>
        </div>

        {academy.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : academy.isError ? (
          <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">
            {he ? 'טעינת האקדמיה נכשלה' : 'Failed to load academy'}
          </CardContent></Card>
        ) : (
          <>
            {/* Honest "not tracked" banner */}
            {!academy.data?.tracked && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium">{T.notTrackedBanner}.</span>{' '}
                  {academy.data?.note}
                </span>
              </div>
            )}

            {/* Course catalog */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {academy.data?.catalog.map((c) => (
                <Card key={c.courseId} className="border-neutral-200">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-medium leading-snug">{he ? c.titleHe : c.titleEn}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] shrink-0',
                          c.required ? 'border-neutral-300 text-neutral-700' : 'border-neutral-200 text-neutral-400',
                        )}
                      >
                        {c.required ? T.required : T.optional}
                      </Badge>
                    </div>
                    <p className="text-[12px] text-neutral-500 leading-snug">{he ? c.summaryHe : c.summaryEn}</p>
                    {c.gatesPermissions.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        <Lock className="h-3 w-3 text-neutral-400" />
                        <span className="text-[10px] text-neutral-400">{T.gates}:</span>
                        {c.gatesPermissions.map((p) => (
                          <code key={p} className="text-[10px] rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{p}</code>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Permission-gating rule (documented, not enforced) */}
            {academy.data?.permissionRule && (
              <Card className="mt-5 border-neutral-200">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lock className="h-4 w-4" style={{ color: GOLD }} />
                    <h3 className="font-medium">{T.ruleHeading}</h3>
                    <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700">{T.notEnforced}</Badge>
                  </div>
                  <p className="text-[12px] text-neutral-500 leading-relaxed">
                    {academy.data.permissionRule.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── Small presentational helper ──────────────────────────────────────────────
function Metric({
  icon: Icon, label, value, warn, muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warn?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg bg-neutral-50 px-2 py-2">
      <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', muted ? 'text-neutral-300' : 'text-neutral-400')} />
      <div className={cn('text-base font-semibold leading-none', warn ? 'text-red-600' : muted ? 'text-neutral-400' : 'text-black')}>
        {value}
      </div>
      <div className="text-[10px] text-neutral-500 mt-1 leading-tight">{label}</div>
    </div>
  );
}
