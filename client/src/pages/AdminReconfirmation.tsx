/**
 * AdminReconfirmation — Provider 6-Month Reconfirmation (spec §17, read-only).
 *
 * Surfaces GET /api/admin/reconfirmation: every approved provider with their
 * computed reconfirmation due date, days-until, reminder bucket (60/30/14/7/1/
 * overdue) and a coarse status (ok / due soon / overdue). Pure display — this
 * page never writes; the provider re-confirms via POST /api/provider/reconfirm
 * from their own app.
 *
 * White / black / gold brand. Bilingual via useLanguage, RTL-aware. Honest:
 * dates derive lazily from the approval record, shown as such.
 */
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, ClipboardList, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = '#D4AF37';

type ReminderBucket = 60 | 30 | 14 | 7 | 1 | 'overdue' | null;

interface ProviderRow {
  providerId: string;
  businessName: string | null;
  providerType: string | null;
  dueAt: string;
  daysUntil: number;
  overdue: boolean;
  reminderBucket: ReminderBucket;
  anchorAt: string;
  anchorSource: 'approval' | 'reconfirmation';
  status: 'ok' | 'due_soon' | 'overdue';
}
interface Response {
  generatedAt: string;
  intervalMonths: number;
  count: number;
  summary: { ok: number; due_soon: number; overdue: number };
  providers: ProviderRow[];
}

function fmtDate(iso: string, he: boolean): string {
  try {
    return new Date(iso).toLocaleDateString(he ? 'he-IL' : 'en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function AdminReconfirmation() {
  const { language, dir } = useLanguage();
  const he = language === 'he';

  const q = useQuery<Response>({
    queryKey: ['/api/admin/reconfirmation'],
    refetchInterval: 120000,
  });

  const T = {
    title: he ? 'אישור מחדש לנותני שירות' : 'Provider Reconfirmation',
    subtitle: he
      ? 'מחזור אישור מחדש של 6 חודשים (§17) — לקריאה בלבד'
      : 'Six-month reconfirmation cycle (§17) — read-only',
    ok: he ? 'תקין' : 'OK',
    dueSoon: he ? 'מתקרב' : 'Due soon',
    overdue: he ? 'באיחור' : 'Overdue',
    provider: he ? 'נותן שירות' : 'Provider',
    type: he ? 'סוג' : 'Type',
    due: he ? 'תאריך יעד' : 'Due',
    daysLeft: he ? 'ימים שנותרו' : 'Days left',
    daysOverdue: he ? 'ימים באיחור' : 'Days overdue',
    anchor: he ? 'מבוסס על' : 'Based on',
    fromApproval: he ? 'אישור ראשוני' : 'Initial approval',
    fromReconf: he ? 'אישור מחדש קודם' : 'Prior reconfirmation',
    empty: he ? 'אין נותני שירות מאושרים להצגה' : 'No approved providers to display yet',
    failed: he ? 'טעינת הסטטוס נכשלה' : 'Failed to load status',
    note: he
      ? 'תאריכי היעד מחושבים מתאריך האישור — אינם נכתבים מראש. נותן השירות מאשר מחדש מהאפליקציה שלו.'
      : 'Due dates are computed from the approval date — not pre-written. Providers re-confirm from their own app.',
    unnamed: he ? 'ללא שם עסק' : 'Unnamed business',
  };

  const statusLabel = (s: ProviderRow['status']) =>
    s === 'overdue' ? T.overdue : s === 'due_soon' ? T.dueSoon : T.ok;
  const statusStyle = (s: ProviderRow['status']) =>
    s === 'overdue'
      ? 'bg-red-50 text-red-700 border-red-200'
      : s === 'due_soon'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const bucketLabel = (b: ReminderBucket) => {
    if (b === null) return null;
    if (b === 'overdue') return T.overdue;
    return he ? `תזכורת ${b} ימים` : `${b}-day reminder`;
  };

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
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

      {q.isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : q.isError ? (
        <Card className="border-red-200"><CardContent className="py-4 text-sm text-red-700">{T.failed}</CardContent></Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard icon={AlertTriangle} label={T.overdue} value={q.data?.summary.overdue ?? 0} tone="red" />
            <SummaryCard icon={Clock} label={T.dueSoon} value={q.data?.summary.due_soon ?? 0} tone="amber" />
            <SummaryCard icon={CheckCircle2} label={T.ok} value={q.data?.summary.ok ?? 0} tone="emerald" />
          </div>

          <p className="text-[11px] text-neutral-400 mb-4 flex items-center gap-1">
            <ClipboardList className="h-3 w-3 shrink-0" /> {T.note}
          </p>

          {(q.data?.count ?? 0) === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-neutral-500">{T.empty}</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {q.data!.providers.map((p) => (
                <Card key={p.providerId} className={cn('border', statusStyle(p.status))}>
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{p.businessName ?? T.unnamed}</span>
                      {p.providerType && (
                        <Badge variant="outline" className="text-[10px]">{p.providerType}</Badge>
                      )}
                      <Badge className={cn('text-[10px] border', statusStyle(p.status))}>{statusLabel(p.status)}</Badge>
                      {bucketLabel(p.reminderBucket) && p.status !== 'overdue' && (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200">
                          {bucketLabel(p.reminderBucket)}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-neutral-600">
                      <Metric label={T.due} value={fmtDate(p.dueAt, he)} gold={p.overdue} />
                      <Metric
                        label={p.overdue ? T.daysOverdue : T.daysLeft}
                        value={String(Math.abs(p.daysUntil))}
                        gold={p.overdue}
                      />
                      <Metric
                        label={T.anchor}
                        value={p.anchorSource === 'reconfirmation' ? T.fromReconf : T.fromApproval}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, tone,
}: {
  icon: typeof ShieldCheck; label: string; value: number; tone: 'red' | 'amber' | 'emerald';
}) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-emerald-600';
  return (
    <Card className="border-neutral-200">
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <Icon className={cn('h-3.5 w-3.5', toneClass)} />
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
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
