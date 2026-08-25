/**
 * AdminLiveOps — "review everything" screen for the CEO / support@petwash.
 *
 * One place to see ALL live bookings across every platform (unified washes,
 * pet-sitting, dog-walking, marketplace requests) + today's KPIs + open alerts
 * + jump-links to money and health. READ-ONLY. Data: GET /api/admin/live-ops.
 *
 * NOT feature-flagged — reachable at /admin/live-ops by any admin role
 * (super_admin, admin, ops, finance, ceo, or read-only viewer such as support@).
 * Mobile-first (iPhone Safari), brand: white / black / gold (#D4AF37).
 */
import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { getApiUrl } from '@/lib/apiConfig';
import {
  Loader2, RefreshCw, Activity, CalendarDays, Wallet, AlertTriangle,
  HeartPulse, ChevronLeft, CircleDot,
} from 'lucide-react';

const GOLD = '#D4AF37';

interface PlatformTile {
  key: string;
  label: string;
  available: boolean;
  total: number;
  active: number;
  today: number;
  revenueTodayIls: number;
  reason?: string;
}
interface RecentRow {
  platform: string;
  platformKey: string;
  refId: string;
  status: string;
  paymentStatus: string | null;
  amountIls: number;
  customerId: string | null;
  providerId: string | null;
  createdAt: string | null;
  traceUrl: string | null;
}
interface LiveOps {
  ok: boolean;
  generatedAt: string;
  kpis: {
    bookingsToday: number;
    revenueTodayIls: number;
    activeNow: number;
    openAlerts: number;
    criticalAlerts: number;
    alertsAvailable: boolean;
  };
  platforms: PlatformTile[];
  recent: RecentRow[];
  links: { money: string; alerts: string; health: string };
}

const ils = (n: number) =>
  '₪' + (n ?? 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function statusColor(s: string): string {
  const v = (s || '').toLowerCase();
  if (['completed', 'confirmed', 'accepted', 'started', 'in_progress'].includes(v)) return '#1a7f37';
  if (['pending', 'pending_provider', 'draft'].includes(v)) return '#9a6700';
  if (['cancelled', 'failed', 'refunded', 'payment_failed', 'disputed'].includes(v)) return '#cf222e';
  return '#57606a';
}

function whenLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
  return d.toLocaleDateString('he-IL');
}

export default function AdminLiveOps() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<LiveOps>({
    queryKey: ['/api/admin/live-ops'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/api/admin/live-ops'), { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000, // live-ish: refresh every minute
  });

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: '#fff', color: '#111' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 64px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Link href="/admin">
            <a style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#57606a', fontSize: 14, textDecoration: 'none' }}>
              <ChevronLeft size={16} /> ניהול
            </a>
          </Link>
          <button
            onClick={() => refetch()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${GOLD}`, background: '#fff', color: '#111', borderRadius: 8, padding: '6px 12px', fontSize: 14, cursor: 'pointer' }}
          >
            {isFetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} רענן
          </button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 2px' }}>
          מרכז בקרה — הזמנות חיות
        </h1>
        <p style={{ color: '#57606a', fontSize: 14, margin: '0 0 18px' }}>
          Live operations — all platforms · bookings · money · health
          {data?.generatedAt && (
            <span style={{ marginInlineStart: 8, fontSize: 12 }}>· {whenLabel(data.generatedAt)}</span>
          )}
        </p>

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#57606a', padding: 40 }}>
            <Loader2 size={18} className="animate-spin" /> טוען נתונים חיים…
          </div>
        )}
        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffc9c9', color: '#cf222e', borderRadius: 10, padding: 16 }}>
            לא ניתן לטעון את הנתונים. נסה לרענן. ({String((error as Error).message)})
          </div>
        )}

        {data && (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
              <Kpi icon={<CalendarDays size={18} />} label="הזמנות היום" value={String(data.kpis.bookingsToday)} />
              <Kpi icon={<Wallet size={18} />} label="הכנסה היום" value={ils(data.kpis.revenueTodayIls)} accent />
              <Kpi icon={<Activity size={18} />} label="פעילות עכשיו" value={String(data.kpis.activeNow)} />
              <Kpi
                icon={<AlertTriangle size={18} />}
                label="התראות פתוחות"
                value={data.kpis.alertsAvailable ? String(data.kpis.openAlerts) : '—'}
                danger={data.kpis.criticalAlerts > 0}
              />
            </div>

            {/* Quick links */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
              <QuickLink href={data.links.money} icon={<Wallet size={15} />} label="כסף ותשלומים" />
              <QuickLink href={data.links.alerts} icon={<AlertTriangle size={15} />} label="מרכז התראות" />
              <QuickLink href={data.links.health} icon={<HeartPulse size={15} />} label="בריאות המערכת" />
            </div>

            {/* Platform tiles */}
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>פלטפורמות</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 26 }}>
              {data.platforms.map((p) => (
                <div key={p.key} style={{ border: '1px solid #eaecef', borderRadius: 12, padding: 14, background: p.available ? '#fff' : '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</span>
                    <CircleDot size={14} color={p.available ? '#1a7f37' : '#cf222e'} />
                  </div>
                  {p.available ? (
                    <div style={{ display: 'flex', gap: 14 }}>
                      <Stat label="פעיל" value={p.active} strong />
                      <Stat label="היום" value={p.today} />
                      <Stat label="₪ היום" value={ils(p.revenueTodayIls)} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#cf222e' }}>לא זמין · {p.reason}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Recent activity */}
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px' }}>פעילות אחרונה</h2>
            <div style={{ border: '1px solid #eaecef', borderRadius: 12, overflow: 'hidden' }}>
              {data.recent.length === 0 && (
                <div style={{ padding: 20, color: '#57606a', fontSize: 14 }}>אין הזמנות אחרונות.</div>
              )}
              {data.recent.map((r, i) => {
                const row = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid #f1f3f5' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: statusColor(r.status), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.platform}
                      </div>
                      <div style={{ fontSize: 11, color: '#57606a' }}>
                        {r.refId} · {r.status}{r.paymentStatus ? ` · ${r.paymentStatus}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{ils(r.amountIls)}</div>
                      <div style={{ fontSize: 11, color: '#57606a' }}>{whenLabel(r.createdAt)}</div>
                    </div>
                  </div>
                );
                return r.traceUrl ? (
                  <Link key={r.refId + i} href={r.traceUrl}><a style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{row}</a></Link>
                ) : (
                  <div key={r.refId + i}>{row}</div>
                );
              })}
            </div>

            <p style={{ fontSize: 11, color: '#8a8f98', marginTop: 14 }}>
              KPI (היום/פעילים) — סופרת את מלוא הטבלה. פיד "אחרונות" — 200 השורות האחרונות לכל פלטפורמה. קריאה בלבד · מתעדכן כל דקה.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent, danger }: { icon: ReactNode; label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div style={{ border: `1px solid ${danger ? '#ffc9c9' : '#eaecef'}`, borderRadius: 12, padding: 14, background: danger ? '#fff5f5' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: danger ? '#cf222e' : '#57606a', fontSize: 12, marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: danger ? '#cf222e' : accent ? GOLD : '#111' }}>{value}</div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#57606a' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: strong ? 800 : 600 }}>{value}</div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href}>
      <a style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #eaecef', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#111', textDecoration: 'none', background: '#fff' }}>
        {icon} {label}
      </a>
    </Link>
  );
}
