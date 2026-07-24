/**
 * מגדל הבקרה של PetWash (Octopus Control Tower) — the admin home.
 *
 * CEO 2026-07-24 ("logged in to backend, it's shocking — ugly old, text mixed,
 * looks demo fake"): this replaces the sprawling old dashboard as the admin
 * front door. ONE premium Hebrew screen, canon white/black/gold, every number
 * live from GET /api/admin/octopus/overview (real SQL, fail-soft). No fake
 * zeros: a block with no data yet says so in words, never a demo number.
 */
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Droplets, Store, Users, Radio, Bell, Wallet, Ticket, CreditCard,
  Landmark, RefreshCw, ChevronLeft, TrendingUp, ShoppingBag, UserCheck,
  Activity, ClipboardList,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const GOLD = '#D4AF37';
const INK = '#0a0a0a';

interface PerPeriod { sumitCents: number; kioskCents: number; kioskCount: number; shopCents: number; bookingCents: number }
interface Overview {
  ok: boolean;
  generatedAt: string;
  sales: { today: PerPeriod; week: PerPeriod; month: PerPeriod } | null;
  stations: Array<{ machineId: string; lastEventAt: string; washesToday: number; ilsToday: number }> | null;
  shop: { activeProducts: number; realItems: number; orders: number; openOrders: number } | null;
  providers: { pending: number; approved: number; total: number } | null;
  members: { total: number; today: number; week: number } | null;
  alerts: { open: number; urgent: number } | null;
}

const nis = (cents: number) => `₪${Math.round((cents ?? 0) / 100).toLocaleString('he-IL')}`;
const totalOf = (p?: PerPeriod | null) =>
  p ? p.sumitCents + p.kioskCents + p.shopCents + p.bookingCents : 0;

const MACHINE_NAMES: Record<string, string> = {
  '182443': 'פארק ולד — תא ימין',
  '182462': 'פארק ולד — תא שמאל',
};

const timeHe = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminOctopus() {
  const [, go] = useLocation();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['octopus-overview'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/octopus/overview');
      if (!res.ok) throw new Error('overview_failed');
      return res.json() as Promise<Overview>;
    },
    refetchInterval: 60_000,
  });

  const s = data?.sales;
  const st = data?.stations;

  const actions = [
    { label: 'ניהול מוצרי חנות', to: '/admin/shop-products', icon: ShoppingBag },
    { label: 'אישור ספקים', to: '/admin/applications', icon: UserCheck },
    { label: 'אירועי Nayax', to: '/admin/nayax-events', icon: Radio },
    { label: 'תשלומים SUMIT', to: '/admin/sumit-control', icon: CreditCard },
    { label: 'קופונים', to: '/admin/coupons', icon: Ticket },
    { label: 'התראות', to: '/admin/alerts', icon: Bell },
    { label: 'כספים', to: '/admin/finance', icon: Landmark },
    { label: 'ארנקים', to: '/admin/wallet-dashboard', icon: Wallet },
    { label: 'עמדות — בריאות', to: '/admin/stations', icon: Activity },
    { label: 'לוח קלאסי', to: '/admin/dashboard', icon: ClipboardList },
  ];

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-[#FAFAF7]" data-testid="admin-octopus">
      {/* Header band */}
      <div className="border-b bg-white" style={{ borderColor: '#EDE6D2' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: INK }}>
              <Droplets className="h-6 w-6" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: INK }}>מגדל הבקרה</h1>
              <p className="text-xs text-neutral-500">
                נתונים חיים · עודכן {data ? new Date(data.generatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            data-testid="octopus-refresh"
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: '#E4DCC4', color: INK }}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} style={{ color: GOLD }} /> רענון
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {isError && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            לא ניתן לטעון את הנתונים כרגע. נסו רענון או בדקו את חיבור השרת.
          </div>
        )}

        {/* Hero: total sales today */}
        <div className="mb-5 overflow-hidden rounded-3xl" style={{ background: INK }}>
          <div className="flex flex-wrap items-end justify-between gap-4 p-6">
            <div>
              <p className="text-xs font-semibold tracking-wide text-white/50">סך מכירות היום · כל המקורות</p>
              <p className="mt-1 text-4xl font-extrabold text-white">
                {isLoading ? '…' : s ? nis(totalOf(s.today)) : '—'}
              </p>
              {s && (
                <p className="mt-1 text-xs text-white/50">
                  השבוע {nis(totalOf(s.week))} · החודש {nis(totalOf(s.month))}
                </p>
              )}
            </div>
            {s && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-white/70">
                <span>עמדות (Nayax)</span><span className="text-left font-semibold text-white">{nis(s.today.kioskCents)}</span>
                <span>אונליין (SUMIT)</span><span className="text-left font-semibold text-white">{nis(s.today.sumitCents)}</span>
                <span>חנות</span><span className="text-left font-semibold text-white">{nis(s.today.shopCents)}</span>
                <span>שירותים</span><span className="text-left font-semibold text-white">{nis(s.today.bookingCents)}</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi icon={Users} label="חברים" value={data?.members ? data.members.total.toLocaleString('he-IL') : '—'}
            sub={data?.members ? `+${data.members.today} היום` : ''} onClick={() => go('/admin/customers')} />
          <Kpi icon={UserCheck} label="ספקים ממתינים" value={data?.providers ? String(data.providers.pending) : '—'}
            sub={data?.providers ? `${data.providers.approved} מאושרים` : ''} accent={!!data?.providers?.pending}
            onClick={() => go('/admin/applications')} />
          <Kpi icon={Store} label="מוצרי חנות" value={data?.shop ? String(data.shop.realItems) : '—'}
            sub={data?.shop ? `${data.shop.openOrders} הזמנות פתוחות` : ''} onClick={() => go('/admin/shop-products')} />
          <Kpi icon={Bell} label="התראות פתוחות" value={data?.alerts ? String(data.alerts.open) : '—'}
            sub={data?.alerts?.urgent ? `${data.alerts.urgent} דחופות` : ''} accent={!!data?.alerts?.urgent}
            onClick={() => go('/admin/alerts')} />
        </div>

        {/* Stations live */}
        <section className="mb-5 rounded-3xl border bg-white p-5" style={{ borderColor: '#EDE6D2' }} data-testid="octopus-stations">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="h-4 w-4" style={{ color: GOLD }} />
            <h2 className="text-sm font-bold" style={{ color: INK }}>עמדות שטיפה — פעילות חיה</h2>
          </div>
          {st === null && <p className="text-sm text-neutral-400">אין נתוני עמדות זמינים כרגע.</p>}
          {st && st.length === 0 && (
            <p className="text-sm text-neutral-500">
              עדיין לא נקלטו אירועי עמדה. הזרם נפתח עם חיבור ה־webhook של Nayax או ייבוא דוח ידני
              במסך «אירועי Nayax».
            </p>
          )}
          {st && st.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {st.map((m) => (
                <div key={m.machineId} className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: '#F0EAD8', background: '#FFFDF6' }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: INK }}>{MACHINE_NAMES[m.machineId] || `מכונה ${m.machineId}`}</p>
                    <p className="text-[11px] text-neutral-500">אירוע אחרון: {timeHe(m.lastEventAt)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-base font-extrabold" style={{ color: INK }}>{nis(m.ilsToday * 100)}</p>
                    <p className="text-[11px] text-neutral-500">{m.washesToday} שטיפות היום</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sales by period — mini table */}
        <section className="mb-5 rounded-3xl border bg-white p-5" style={{ borderColor: '#EDE6D2' }}>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: GOLD }} />
            <h2 className="text-sm font-bold" style={{ color: INK }}>מכירות לפי תקופה ומקור</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="text-xs text-neutral-400">
                  <th className="pb-2 font-medium">תקופה</th>
                  <th className="pb-2 font-medium">עמדות</th>
                  <th className="pb-2 font-medium">אונליין</th>
                  <th className="pb-2 font-medium">חנות</th>
                  <th className="pb-2 font-medium">שירותים</th>
                  <th className="pb-2 font-semibold" style={{ color: INK }}>סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {([['היום', s?.today], ['7 ימים', s?.week], ['30 יום', s?.month]] as const).map(([label, p]) => (
                  <tr key={label} className="border-t" style={{ borderColor: '#F3EEDF' }}>
                    <td className="py-2 font-semibold" style={{ color: INK }}>{label}</td>
                    <td className="py-2 text-neutral-600">{p ? nis(p.kioskCents) : '—'}</td>
                    <td className="py-2 text-neutral-600">{p ? nis(p.sumitCents) : '—'}</td>
                    <td className="py-2 text-neutral-600">{p ? nis(p.shopCents) : '—'}</td>
                    <td className="py-2 text-neutral-600">{p ? nis(p.bookingCents) : '—'}</td>
                    <td className="py-2 font-extrabold" style={{ color: INK }}>{p ? nis(totalOf(p)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Actions grid */}
        <section className="rounded-3xl border bg-white p-5" style={{ borderColor: '#EDE6D2' }}>
          <h2 className="mb-3 text-sm font-bold" style={{ color: INK }}>פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {actions.map((a) => (
              <button
                key={a.to}
                type="button"
                onClick={() => go(a.to)}
                className="group flex items-center gap-2 rounded-2xl border px-3 py-3 text-right transition hover:shadow-md"
                style={{ borderColor: '#EFE8D6' }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: '#FBF6E6' }}>
                  <a.icon className="h-4 w-4" style={{ color: GOLD }} />
                </span>
                <span className="text-xs font-semibold" style={{ color: INK }}>{a.label}</span>
                <ChevronLeft className="mr-auto h-4 w-4 text-neutral-300 group-hover:text-neutral-500" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, accent, onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string; sub?: string; accent?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border bg-white p-4 text-right transition hover:shadow-md"
      style={{ borderColor: accent ? '#D4AF37' : '#EDE6D2', background: accent ? '#FFFDF5' : '#fff' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <Icon className="h-4 w-4" style={{ color: '#D4AF37' }} />
      </div>
      <p className="text-2xl font-extrabold" style={{ color: '#0a0a0a', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p className="text-[11px] font-semibold text-neutral-500">{label}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p> : null}
    </button>
  );
}
