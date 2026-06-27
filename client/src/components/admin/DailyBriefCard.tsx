/**
 * DailyBriefCard — the admin "morning brain" tile (CEO Trend Bible §20).
 * Renders GET /api/admin/daily-brief: what's stuck / valuable / recoverable today.
 * Read-only; brand white/black/gold + emerald. Degrades to an honest empty state
 * before the Deal Gate / Rescue migrations are applied.
 */
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { Sparkles, ListChecks } from 'lucide-react';

const GOLD = '#D4AF37';

interface Brief {
  generatedAt: string;
  conversion: { activeLeads: number; recoverableCents: number };
  bookings: { acceptedUnpaid: number; paymentPending: number; cancelled24h: number };
  pawFinder: { activeLostPosts: number; pendingReview: number };
  suggestedActions: string[];
  summary: string;
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-4 py-3 min-w-[120px]">
      <div className="text-2xl font-bold" style={{ color: accent || '#000' }}>{value}</div>
      <div className="text-xs text-black/55 mt-0.5">{label}</div>
    </div>
  );
}

export function DailyBriefCard() {
  const { language } = useLanguage();
  const he = language === 'he';
  const { data, isLoading } = useQuery<Brief>({
    queryKey: ['/api/admin/daily-brief'],
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6">
        <div className="h-5 w-40 bg-black/5 rounded animate-pulse" />
      </div>
    );
  }

  const recoverable = `₪${(data.conversion.recoverableCents / 100).toLocaleString('en-IL')}`;

  return (
    <div className="rounded-2xl border bg-white p-5 mb-6" style={{ borderColor: `${GOLD}55` }} dir={he ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5" style={{ color: GOLD }} />
        <h2 className="text-lg font-bold text-black">{he ? 'תקציר יומי' : 'Daily Brief'}</h2>
        <span className="text-xs text-black/40 ms-auto">
          {he ? 'מתעדכן אוטומטית' : 'auto-updates'}
        </span>
      </div>

      <p className="text-sm text-black/70 mb-4">{data.summary}</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <Stat label={he ? 'לידים פעילים' : 'Active leads'} value={data.conversion.activeLeads} />
        <Stat label={he ? 'התקבל ולא שולם' : 'Accepted · unpaid'} value={data.bookings.acceptedUnpaid} accent="#b45309" />
        <Stat label={he ? 'ממתין לתשלום' : 'Awaiting payment'} value={data.bookings.paymentPending} accent="#b45309" />
        <Stat label={he ? 'בוטלו (24ש)' : 'Cancelled 24h'} value={data.bookings.cancelled24h} />
        <Stat label={he ? 'ניתן לשחזור' : 'Recoverable'} value={recoverable} accent="#047857" />
        <Stat label={he ? 'התראות אבודים' : 'Lost-pet alerts'} value={data.pawFinder.activeLostPosts} />
      </div>

      {data.suggestedActions?.length > 0 && (
        <div className="rounded-xl bg-black/[0.03] p-4">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-black/60 uppercase tracking-wide">
            <ListChecks className="w-3.5 h-3.5" /> {he ? 'פעולות מומלצות' : 'Suggested actions'}
          </div>
          <ul className="space-y-1.5">
            {data.suggestedActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-black/80">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
