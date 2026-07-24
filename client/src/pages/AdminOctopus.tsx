/**
 * Octopus Control Panel — the ONE admin overview (CEO 2026-07-23).
 *
 * Real numbers only, from GET /api/admin/octopus/overview (live SQL per block;
 * a failed block renders "—", never a fake number). Curated links go ONLY to
 * panels verified to work — this page is the antidote to the 107-route sprawl.
 */
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Activity, ShoppingBag, Users, CreditCard, Droplets, RefreshCw,
  ArrowUpRight, Radio, Ticket, Wallet, AlertTriangle, Landmark,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const GOLD = '#D4AF37';
const DEEP = '#063B22';

interface PerPeriod { sumitCents: number; kioskCents: number; kioskCount: number; shopCents: number; bookingCents: number }
interface Overview {
  ok: boolean;
  generatedAt: string;
  sales: { today: PerPeriod; week: PerPeriod; month: PerPeriod } | null;
  stations: Array<{ machineId: string; lastEventAt: string; washesToday: number; ilsToday: number }> | null;
  shop: { activeProducts: number; realItems: number; orders: number; openOrders: number } | null;
  providers: { pending: number; approved: number; total: number } | null;
}

function ils(cents: number): string {
  return `₪${(cents / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}
function totalOf(p?: PerPeriod | null): number {
  if (!p) return 0;
  return p.sumitCents + p.kioskCents + p.shopCents + p.bookingCents;
}

const MACHINE_NAMES: Record<string, string> = {
  '182443': 'ולד כפר סבא — ימין',
  '182462': 'ולד כפר סבא — שמאל',
};

export default function AdminOctopus() {
  const [, nav] = useLocation();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['octopus-overview'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/octopus/overview');
      if (!res.ok) throw new Error('overview_failed');
      return res.json() as Promise<Overview>;
    },
    refetchInterval: 60_000,
  });

  const links = [
    { label: 'Nayax אירועים + ייבוא', to: '/admin/nayax-events', icon: Radio },
    { label: 'ניהול מוצרי חנות', to: '/admin/shop-products', icon: ShoppingBag },
    { label: 'Live Ops — אישורים', to: '/admin/live-ops', icon: Activity },
    { label: 'SUMIT בקרת תשלומים', to: '/admin/sumit-control', icon: CreditCard },
    { label: 'קופונים וקמפיינים', to: '/admin/coupons', icon: Ticket },
    { label: 'התראות מערכת', to: '/admin/alerts', icon: AlertTriangle },
    { label: 'כספים', to: '/admin/finance', icon: Landmark },
    { label: 'ארנקים', to: '/admin/wallet-dashboard', icon: Wallet },
    { label: 'לוח אנליטיקה קלאסי', to: '/admin/dashboard', icon: Activity },
    { label: 'עמדות — בריאות', to: '/admin/stations', icon: Radio },
  ];

  const s = data?.sales;

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-[#D4AF37]/10 text-black" data-testid="admin-octopus">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">🐙 Octopus Control <span style={{ color: GOLD }}>·</span></h1>
            <p className="text-sm text-gray-500">
              כל המספרים חיים מה־DB · עודכן {data ? new Date(data.generatedAt).toLocaleTimeString('he-IL') : '…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
            data-testid="octopus-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> רענון
          </button>
        </div>

        {/* ── Sales ── */}
        <section className="mb-6 rounded-2xl border border-[#D4AF37]/40 bg-white p-5 luxury-shadow-lg" data-testid="octopus-sales">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Droplets className="h-4 w-4" style={{ color: GOLD }} /> מכירות — כל המקורות
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([['היום', s?.today], ['7 ימים', s?.week], ['30 יום', s?.month]] as const).map(([label, p]) => (
              <div key={label} className="rounded-xl bg-slate-50 border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-black">
                  {isLoading ? '…' : s ? ils(totalOf(p)) : '—'}
                </p>
                {p && (
                  <div className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                    <p>עמדות (Nayax): {ils(p.kioskCents)} · {p.kioskCount} שטיפות</p>
                    <p>אונליין (SUMIT): {ils(p.sumitCents)}</p>
                    <p>חנות: {ils(p.shopCents)} · הזמנות שירות: {ils(p.bookingCents)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ── Live stations ── */}
          <section className="rounded-2xl border border-[#D4AF37]/40 bg-white p-5 luxury-shadow-lg lg:col-span-2" data-testid="octopus-stations">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500">
              <Radio className="h-4 w-4" style={{ color: GOLD }} /> עמדות — פעילות חיה
            </h2>
            {data?.stations === null && (
              <p className="text-sm text-gray-400">אין נתוני עמדות זמינים</p>
            )}
            {data?.stations && data.stations.length === 0 && (
              <p className="text-sm text-gray-400">
                עדיין לא נקלטו אירועי עמדה — הזרם נפתח עם ה־webhook של Nayax או ייבוא CSV ידני
              </p>
            )}
            <div className="space-y-2">
              {(data?.stations ?? []).map((m) => (
                <div key={m.machineId} className="flex items-center justify-between rounded-xl bg-slate-50 border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-black">{MACHINE_NAMES[m.machineId] || `מכונה ${m.machineId}`}</p>
                    <p className="text-[11px] text-gray-500">
                      אירוע אחרון: {m.lastEventAt ? new Date(m.lastEventAt).toLocaleString('he-IL') : '—'}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-black">₪{m.ilsToday.toLocaleString('he-IL')}</p>
                    <p className="text-[11px] text-gray-500">{m.washesToday} שטיפות היום</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Shop + Providers ── */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-[#D4AF37]/40 bg-white p-5 luxury-shadow-lg" data-testid="octopus-shop">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-500">
                <ShoppingBag className="h-4 w-4" style={{ color: GOLD }} /> חנות
              </h2>
              {data?.shop ? (
                <div className="text-sm text-gray-800">
                  <p>{data.shop.realItems} מוצרים אמיתיים · {data.shop.activeProducts} פעילים סה״כ</p>
                  <p>{data.shop.openOrders} הזמנות פתוחות מתוך {data.shop.orders}</p>
                </div>
              ) : <p className="text-sm text-gray-400">—</p>}
              <button
                type="button"
                onClick={() => nav('/admin/shop-products')}
                className="mt-3 flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold"
                style={{ background: GOLD, color: DEEP }}
                data-testid="octopus-goto-shop-products"
              >
                ניהול מוצרים <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </section>

            <section className="rounded-2xl border border-[#D4AF37]/40 bg-white p-5 luxury-shadow-lg" data-testid="octopus-providers">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-500">
                <Users className="h-4 w-4" style={{ color: GOLD }} /> ספקים
              </h2>
              {data?.providers ? (
                <div className="text-sm text-gray-800">
                  <p><span className="font-bold" style={{ color: GOLD }}>{data.providers.pending}</span> ממתינים לאישור</p>
                  <p>{data.providers.approved} מאושרים · {data.providers.total} סה״כ</p>
                </div>
              ) : <p className="text-sm text-gray-400">—</p>}
              <button
                type="button"
                onClick={() => nav('/admin/live-ops')}
                className="mt-3 flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-black"
              >
                לאישורים <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </section>
          </div>
        </div>

        {/* ── Curated links (working panels only) ── */}
        <section className="rounded-2xl border border-[#D4AF37]/40 bg-white p-5 luxury-shadow-lg">
          <h2 className="mb-3 text-sm font-semibold text-gray-500">פאנלים פעילים</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {links.map((l) => (
              <button
                key={l.to}
                type="button"
                onClick={() => nav(l.to)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-right text-xs font-semibold text-gray-800 hover:border-[#D4AF37]/60"
              >
                <l.icon className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
                {l.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
