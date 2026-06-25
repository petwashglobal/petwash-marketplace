import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { getApiUrl } from "@/lib/apiConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { 
  Users, 
  Package, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  Activity,
  LogOut,
  Settings,
  Shield,
  CreditCard,
  Info,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  PieChart,
  Zap,
  Target,
  Award,
  MapPin,
  Brain
} from "lucide-react";
import { Link, useLocation } from "wouter";
import NayaxMonitoring from "@/components/admin/NayaxMonitoring";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from "@/lib/languageStore";

// PetWash brand accent — metallic gold is the ONLY accent on the luxury
// Overview. #D4AF37 for marks/strokes, #B8860B for darker gold text.
const GOLD = '#D4AF37';
const GOLD_DARK = '#B8860B';

// Control Tower — read-only "today" snapshot from /api/admin/control-tower.
// Each sub-object may be null if its source query failed server-side.
interface ControlTower {
  generatedAt: string;
  salesToday: { count: number; totalIls: number } | null;
  stations: { active: number; offline: number; total: number } | null;
  faults: { open: number; critical: number } | null;
  stock: { lowCount: number } | null;
  egift: { soldToday: number; unredeemed: number } | null;
}

interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  lowStockItems: number;
  pendingDocuments: number;
  monthlyRevenue: number;
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  timestamp: string;
  adminName: string;
}

interface AnalyticsOverview {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    growthRate: number;
  };
  customers: {
    total: number;
    active: number;
    new: number;
    growthRate: number;
  };
  stations: {
    total: number;
    active: number;
    offline: number;
    utilizationRate: number;
  };
  transactions: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    successRate: number;
  };
  loyalty: {
    totalMembers: number;
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
    emerald: number;
    royal: number;
  };
}

interface RevenueDataPoint {
  date: string;
  revenue: number;
  transactions: number;
}

interface StationPerformance {
  stationId: string;
  stationName: string;
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  utilizationRate: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const [selectedSection, setSelectedSection] = useState<'overview' | 'analytics' | 'loyalty' | 'inventory' | 'hr' | 'payments'>('overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch analytics overview
  const { data: analytics, isLoading: analyticsLoading } = useQuery<{ success: boolean; data: AnalyticsOverview; timestamp: string }>({
    queryKey: ['/api/admin/analytics/overview'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch revenue time series
  const { data: revenueData, isLoading: revenueLoading } = useQuery<{ success: boolean; data: RevenueDataPoint[]; days: number }>({
    queryKey: ['/api/admin/analytics/revenue'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch station performance
  const { data: stationData, isLoading: stationLoading } = useQuery<{ success: boolean; data: StationPerformance[]; count: number }>({
    queryKey: ['/api/admin/analytics/stations'],
    refetchInterval: 60000,
  });

  // Legacy stats for backwards compatibility
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/admin/dashboard/stats'],
    refetchInterval: 30000,
  });

  // Control Tower — read-only "today" business snapshot (sales, stations,
  // faults, low stock, eGift). Aggregates data that already exists in the DB.
  const { data: controlTower } = useQuery<ControlTower>({
    queryKey: ['/api/admin/control-tower'],
    refetchInterval: 30000,
  });

  // Real 7-day revenue series for the luxury Overview trend chart. Reuses the
  // existing /api/admin/analytics/revenue endpoint with ?days=7 — true per-day
  // totals (no fabricated data). Empty array renders an honest empty state.
  const { data: revenue7Data, isLoading: revenue7Loading } = useQuery<{ success: boolean; data: RevenueDataPoint[]; days: number }>({
    queryKey: ['/api/admin/analytics/revenue?days=7'],
    refetchInterval: 60000,
  });
  const revenue7 = revenue7Data?.data ?? [];
  const revenue7HasData = revenue7.some((d) => (d.revenue ?? 0) > 0);

  const handleLogout = async () => {
    try {
      await fetch(getApiUrl('/api/admin/logout'), { method: 'POST' });
      setLocation('/admin/login');
    } catch (error) {
      logger.error('Logout error', error);
    }
  };

  const isLoading = analyticsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-black text-lg font-medium">{he ? 'טוען נתונים…' : 'Loading analytics…'}</p>
          <p className="text-black/70 text-sm mt-2">{he ? 'מכינים את לוח הבקרה' : 'Preparing your dashboard'}</p>
        </div>
      </div>
    );
  }

  const overview = analytics?.data;

  return (
    <DashboardShell role="admin" title="Admin" subtitle="Business management">
      {/* Section tabs */}
      <div className="mb-8 -mt-2 border-b border-black/10">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: he ? 'סקירה' : 'Overview', icon: Activity },
            { id: 'analytics', label: he ? 'אנליטיקה' : 'Analytics', icon: BarChart3 },
            { id: 'payments', label: he ? 'תשלומים' : 'Payments', icon: CreditCard },
            { id: 'loyalty', label: he ? 'מועדון לקוחות' : 'Loyalty', icon: Award },
            { id: 'inventory', label: he ? 'מלאי' : 'Inventory', icon: Package },
            { id: 'hr', label: he ? 'מסמכי כוח אדם' : 'HR Docs', icon: FileText },
          ].map((section) => {
            const Icon = section.icon;
            const active = selectedSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'border-emerald-700 text-black' : 'border-transparent text-black/65 hover:text-black'
                }`}
                data-testid={`nav-${section.id}`}
              >
                <Icon className="w-4 h-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main>
        {selectedSection === 'overview' && (
          <section dir={he ? 'rtl' : 'ltr'} className="space-y-12" data-testid="overview-control-tower">
            {/* ── Section header + gold hairline rule ─────────────────────── */}
            <header>
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-light tracking-tight text-black">
                    {he ? 'מגדל הבקרה' : 'Control Tower'}
                  </h2>
                  <p className="mt-1 text-sm font-light text-black/70">
                    {he ? 'תמונת מצב חיה — היום' : 'Live snapshot — today'}
                  </p>
                </div>
                {controlTower?.generatedAt && (
                  <span className="text-xs font-light text-black/60 whitespace-nowrap" dir="ltr">
                    {he ? 'עודכן ' : 'Updated '}
                    {new Date(controlTower.generatedAt).toLocaleTimeString(he ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {/* single thin gold hairline — the only divider on this surface */}
              <div className="mt-5 h-px w-full" style={{ backgroundColor: GOLD, opacity: 0.55 }} />
            </header>

            {/* ── KPI row: big thin figures, muted labels ─────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-black/[0.06]">
              {/* Sales today (₪) */}
              <div className="bg-white px-6 py-8" data-testid="kpi-sales">
                <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                  {he ? 'מכירות היום' : 'Sales today'}
                </div>
                <div className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold leading-none text-black truncate" dir="ltr">
                  {controlTower?.salesToday
                    ? `₪${controlTower.salesToday.totalIls.toLocaleString()}`
                    : <span className="text-black/55">₪0</span>}
                </div>
                <div className="mt-3 text-xs font-light text-black/65">
                  {controlTower?.salesToday
                    ? (he
                        ? `${controlTower.salesToday.count} עסקאות`
                        : `${controlTower.salesToday.count} payment${controlTower.salesToday.count === 1 ? '' : 's'}`)
                    : (he ? 'אין נתון' : 'unavailable')}
                </div>
              </div>

              {/* Bays / Stations active */}
              <div className="bg-white px-6 py-8" data-testid="kpi-bays">
                <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                  {he ? 'עמדות פעילות' : 'Bays active'}
                </div>
                <div className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold leading-none text-black truncate" dir="ltr">
                  {controlTower?.stations
                    ? <>{controlTower.stations.active}<span className="text-2xl text-black/55">/{controlTower.stations.total}</span></>
                    : <span className="text-black/55">—</span>}
                </div>
                <div className="mt-3 text-xs font-light text-black/65">
                  {controlTower?.stations
                    ? (he
                        ? `${controlTower.stations.offline} לא מקוונות`
                        : `${controlTower.stations.offline} offline`)
                    : (he ? 'אין נתון' : 'unavailable')}
                </div>
              </div>

              {/* Open faults */}
              <div className="bg-white px-6 py-8" data-testid="kpi-faults">
                <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                  {he ? 'תקלות פתוחות' : 'Open faults'}
                </div>
                <div
                  className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold leading-none truncate"
                  dir="ltr"
                  style={{ color: controlTower?.faults && controlTower.faults.critical > 0 ? GOLD_DARK : '#000' }}
                >
                  {controlTower?.faults
                    ? controlTower.faults.open
                    : <span className="text-black/55">—</span>}
                </div>
                <div className="mt-3 text-xs font-light text-black/65">
                  {controlTower?.faults
                    ? (he
                        ? `${controlTower.faults.critical} קריטיות`
                        : `${controlTower.faults.critical} critical`)
                    : (he ? 'אין נתון' : 'unavailable')}
                </div>
              </div>

              {/* eGifts */}
              <div className="bg-white px-6 py-8" data-testid="kpi-egift">
                <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                  {he ? 'מתנות' : 'eGifts'}
                </div>
                <div className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold leading-none text-black truncate" dir="ltr">
                  {controlTower?.egift
                    ? controlTower.egift.soldToday
                    : <span className="text-black/55">0</span>}
                </div>
                <div className="mt-3 text-xs font-light text-black/65">
                  {controlTower?.egift
                    ? (he
                        ? `נמכרו היום · ${controlTower.egift.unredeemed} לא מומשו`
                        : `sold today · ${controlTower.egift.unredeemed} unredeemed`)
                    : (he ? 'אין נתון' : 'unavailable')}
                </div>
              </div>
            </div>

            {/* ── 7-day revenue trend (real data) ─────────────────────────── */}
            <div data-testid="overview-revenue-chart">
              <div className="flex items-baseline justify-between gap-4 mb-6">
                <h3 className="text-lg font-light tracking-tight text-black">
                  {he ? 'מגמת הכנסות — 7 ימים' : 'Revenue — last 7 days'}
                </h3>
                <span className="text-xs font-light text-black/60">
                  {he ? 'כולל מע״מ · ₪' : 'incl. VAT · ₪'}
                </span>
              </div>

              {revenue7Loading ? (
                <div className="h-72 flex items-center justify-center text-sm font-light text-black/55">
                  {he ? 'טוען…' : 'Loading…'}
                </div>
              ) : revenue7HasData ? (
                <ResponsiveContainer width="100%" height={288}>
                  <AreaChart data={revenue7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ctGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="#00000010" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => {
                        try { return new Date(d).toLocaleDateString(he ? 'he-IL' : 'en-GB', { day: '2-digit', month: '2-digit' }); }
                        catch { return d; }
                      }}
                      stroke="#00000020"
                      tick={{ fill: '#00000066', fontSize: 11, fontWeight: 300 }}
                      tickLine={false}
                      axisLine={false}
                      reversed={he}
                    />
                    <YAxis
                      stroke="#00000020"
                      tick={{ fill: '#00000066', fontSize: 11, fontWeight: 300 }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      orientation={he ? 'right' : 'left'}
                      tickFormatter={(v: number) => `₪${Number(v).toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, fontWeight: 300, fontSize: 12 }}
                      labelStyle={{ color: '#000' }}
                      formatter={(value: any) => [`₪${Number(value).toLocaleString()}`, he ? 'הכנסה' : 'Revenue']}
                      labelFormatter={(d: any) => {
                        try { return new Date(d).toLocaleDateString(he ? 'he-IL' : 'en-GB', { day: '2-digit', month: 'short' }); }
                        catch { return String(d); }
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={GOLD_DARK}
                      strokeWidth={1.5}
                      fill="url(#ctGold)"
                      dot={false}
                      activeDot={{ r: 4, fill: GOLD_DARK, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                /* Honest empty state — no revenue yet today/this week. */
                <div className="h-72 flex flex-col items-center justify-center gap-3 border border-black/[0.06]">
                  <div className="text-4xl font-bold text-black" dir="ltr">
                    {controlTower?.salesToday ? `₪${controlTower.salesToday.totalIls.toLocaleString()}` : '₪0'}
                  </div>
                  <p className="text-xs font-light text-black/65">
                    {he ? 'אין הכנסות ב-7 הימים האחרונים עדיין' : 'No revenue in the last 7 days yet'}
                  </p>
                </div>
              )}
            </div>

            {/* ── Stations & operations (aggregate) ───────────────────────── */}
            {/* TODO(control-tower): /api/admin/control-tower returns aggregate
                station/fault counts only. To render per-station cards with each
                left/right bay (עמדה שמאל / עמדה ימין) status + ₪ + wash count +
                fault flag, extend the endpoint with a per-bay rows array
                (e.g. stationsDetail: [{ stationId, name, bays: [{ side, status,
                salesIls, washCount, hasFault }] }]). Until then we show the
                honest aggregate below — we do NOT invent per-bay numbers. */}
            <div data-testid="overview-stations-aggregate">
              <h3 className="text-lg font-light tracking-tight text-black mb-6">
                {he ? 'תפעול ומלאי' : 'Operations & stock'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-black/[0.06]">
                {/* Stations online/offline */}
                <div className="bg-white px-6 py-7" data-testid="ops-stations">
                  <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                    {he ? 'עמדות' : 'Stations'}
                  </div>
                  <div className="mt-3 text-3xl font-bold text-black" dir="ltr">
                    {controlTower?.stations
                      ? <>{controlTower.stations.active}<span className="text-lg text-black/55">/{controlTower.stations.total}</span></>
                      : <span className="text-black/55">—</span>}
                  </div>
                  <div className="mt-2 text-xs font-light text-black/65">
                    {controlTower?.stations
                      ? (he ? `${controlTower.stations.offline} לא מקוונות` : `${controlTower.stations.offline} offline`)
                      : (he ? 'אין נתון' : 'unavailable')}
                  </div>
                </div>

                {/* Open faults */}
                <div className="bg-white px-6 py-7" data-testid="ops-faults">
                  <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                    {he ? 'תקלות פתוחות' : 'Open faults'}
                  </div>
                  <div
                    className="mt-3 text-3xl font-bold"
                    dir="ltr"
                    style={{ color: controlTower?.faults && controlTower.faults.critical > 0 ? GOLD_DARK : '#000' }}
                  >
                    {controlTower?.faults ? controlTower.faults.open : <span className="text-black/55">—</span>}
                  </div>
                  <div className="mt-2 text-xs font-light text-black/65">
                    {controlTower?.faults
                      ? (he ? `${controlTower.faults.critical} קריטיות` : `${controlTower.faults.critical} critical`)
                      : (he ? 'אין נתון' : 'unavailable')}
                  </div>
                </div>

                {/* Low stock */}
                <div className="bg-white px-6 py-7" data-testid="ops-stock">
                  <div className="text-xs font-medium uppercase tracking-wider text-black/70">
                    {he ? 'מלאי נמוך' : 'Low stock'}
                  </div>
                  <div
                    className="mt-3 text-3xl font-bold"
                    dir="ltr"
                    style={{ color: controlTower?.stock && controlTower.stock.lowCount > 0 ? GOLD_DARK : '#000' }}
                  >
                    {controlTower?.stock ? controlTower.stock.lowCount : <span className="text-black/55">—</span>}
                  </div>
                  <div className="mt-2 text-xs font-light text-black/65">
                    {controlTower?.stock
                      ? (he ? 'פריטים בסף המינימום' : 'items at/below min')
                      : (he ? 'אין נתון' : 'unavailable')}
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <Link href="/admin/stations">
                  <button
                    className="text-sm font-light text-black border-b transition-opacity hover:opacity-60"
                    style={{ borderColor: GOLD }}
                    data-testid="button-manage-stations"
                  >
                    {he ? 'ניהול עמדות ←' : 'Manage stations →'}
                  </button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {selectedSection === 'analytics' && (
          <div className="space-y-8" dir={he ? 'rtl' : 'ltr'}>
            {/* Advanced Analytics Section */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
              <h2 className="text-2xl font-semibold text-black mb-6 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <span>{he ? 'בינה עסקית מתקדמת' : 'Advanced Business Intelligence'}</span>
                <Badge className="bg-[#D4AF37] text-black">{he ? 'פרימיום' : 'PREMIUM'}</Badge>
              </h2>

              {/* Station Performance */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-black mb-4">{he ? 'העמדות המובילות' : 'Top Performing Stations'}</h3>
                {stationLoading ? (
                  <div className="text-black/70 text-center py-8">{he ? 'טוען נתוני עמדות…' : 'Loading station data...'}</div>
                ) : (
                  <div className="space-y-3">
                    {stationData?.data?.slice(0, 5).map((station, index) => (
                      <div key={station.stationId} className="rounded-xl border border-black/10 bg-white luxury-hover-lift p-4" data-testid={`station-${station.stationId}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                              index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                              index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                              'bg-gradient-to-br from-purple-500 to-blue-600'
                            }`}>
                              #{index + 1}
                            </div>
                            <div>
                              <div className="text-black font-medium">{station.stationName}</div>
                              <div className="text-xs text-black/65">{he ? `${station.totalTransactions} עסקאות` : `${station.totalTransactions} transactions`}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-semibold text-black text-emerald-700">₪{station.totalRevenue.toLocaleString()}</div>
                            <div className="text-xs text-black/65">{he ? 'ממוצע' : 'Avg'}: ₪{station.averageTransaction.toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction Volume Chart */}
              <div>
                <h3 className="text-lg font-semibold text-black mb-4">{he ? 'נפח עסקאות (30 ימים)' : 'Transaction Volume (30 Days)'}</h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-black/65">{he ? 'טוען גרף…' : 'Loading chart...'}</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                      <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#6b7280' }} />
                      <YAxis stroke="#9ca3af" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #00000020', borderRadius: '8px' }}
                        labelStyle={{ color: '#111' }}
                      />
                      <Bar dataKey="transactions" fill="#047857" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedSection === 'loyalty' && (
          <div dir={he ? 'rtl' : 'ltr'} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
            <h2 className="text-2xl font-semibold text-black mb-4">{he ? 'לוח מועדון לקוחות' : 'Loyalty Program Dashboard'}</h2>
            <p className="text-sm text-black/60 mb-8">{he ? 'ניהול נאמנות לקוחות, דרגות ותגמולים' : 'Manage customer loyalty, tiers, and rewards'}</p>
            <div className="text-center py-12 text-black/70">
              <Award className="w-16 h-16 mx-auto mb-4 opacity-60 text-emerald-600" />
              <p className="text-base font-semibold text-black">{he ? 'ניהול מועדון לקוחות' : 'Loyalty Management'}</p>
              <p className="text-xs text-black/65">{he ? 'תכונות נאמנות מתקדמות יגיעו בקרוב' : 'Advanced loyalty features coming soon'}</p>
            </div>
          </div>
        )}

        {selectedSection === 'inventory' && (
          <div dir={he ? 'rtl' : 'ltr'} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
            <h2 className="text-2xl font-semibold text-black mb-4">{he ? 'ניהול מלאי' : 'Inventory Management'}</h2>
            <p className="text-sm text-black/60 mb-8">{he ? 'מעקב אחר רמות מלאי, אספקה וציוד' : 'Track stock levels, supplies, and equipment'}</p>
            <div className="text-center py-12 text-black/70">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-60 text-emerald-600" />
              <p className="text-base font-semibold text-black">{he ? 'מעקב מלאי' : 'Inventory Tracker'}</p>
              <p className="text-xs text-black/65">{he ? 'ניטור מלאי בזמן אמת יגיע בקרוב' : 'Real-time inventory monitoring coming soon'}</p>
            </div>
          </div>
        )}

        {selectedSection === 'hr' && (
          <div dir={he ? 'rtl' : 'ltr'} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
            <h2 className="text-2xl font-semibold text-black mb-4">{he ? 'ניהול מסמכי כוח אדם' : 'HR Document Management'}</h2>
            <p className="text-sm text-black/60 mb-8">{he ? 'ניהול מסמכי עובדים, חוזים ורשומות' : 'Manage employee documents, contracts, and records'}</p>
            <div className="text-center py-12 text-black/70">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-60 text-emerald-600" />
              <p className="text-base font-semibold text-black">{he ? 'מסמכי כוח אדם' : 'HR Documents'}</p>
              <p className="text-xs text-black/65">{he ? 'מערכת ניהול מסמכים תגיע בקרוב' : 'Document management system coming soon'}</p>
            </div>
          </div>
        )}

        {selectedSection === 'payments' && (
          <div className="space-y-6 luxury-animate-fade-in">
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg">
              <NayaxMonitoring />
            </div>
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
