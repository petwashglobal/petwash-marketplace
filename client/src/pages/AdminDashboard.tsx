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
          <p className="text-black text-lg font-medium">Loading analytics…</p>
          <p className="text-black/45 text-sm mt-2">Preparing your dashboard</p>
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
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'payments', label: 'Payments', icon: CreditCard },
            { id: 'loyalty', label: 'Loyalty', icon: Award },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'hr', label: 'HR Docs', icon: FileText },
          ].map((section) => {
            const Icon = section.icon;
            const active = selectedSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'border-emerald-700 text-black' : 'border-transparent text-black/50 hover:text-black'
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
          <div className="space-y-8">
            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Revenue Card */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-hover-lift luxury-shadow-md luxury-animate-scale-in luxury-delay-1" data-testid="card-revenue">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  {overview?.revenue.growthRate !== undefined && (
                    <div className={`flex items-center space-x-1 ${overview.revenue.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {overview.revenue.growthRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-bold">{Math.abs(overview.revenue.growthRate).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-2xl font-semibold text-black text-emerald-700 mb-2" data-testid="text-monthly-revenue">
                  ₪{overview?.revenue.thisMonth.toLocaleString() || 0}
                </div>
                <div className="text-xs text-black/50 text-gray-600">Monthly Revenue</div>
                <div className="mt-4 pt-4 border-t border-black/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Today: ₪{overview?.revenue.today.toLocaleString() || 0}</span>
                    <span className="text-gray-600">Week: ₪{overview?.revenue.thisWeek.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Customers Card */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-hover-lift luxury-shadow-md luxury-animate-scale-in luxury-delay-2" data-testid="card-customers">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  {overview?.customers.growthRate !== undefined && (
                    <div className={`flex items-center space-x-1 ${overview.customers.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {overview.customers.growthRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-bold">{Math.abs(overview.customers.growthRate).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-2xl font-semibold text-black text-emerald-700 mb-2" data-testid="text-total-customers">
                  {overview?.customers.total.toLocaleString() || 0}
                </div>
                <div className="text-xs text-black/50 text-gray-600">Total Customers</div>
                <div className="mt-4 pt-4 border-t border-black/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Active: {overview?.customers.active.toLocaleString() || 0}</span>
                    <span className="text-gray-600">New: {overview?.customers.new.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Stations Card */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-hover-lift luxury-shadow-md luxury-animate-scale-in luxury-delay-3" data-testid="card-stations">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-emerald-700">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-bold">{overview?.stations.utilizationRate.toFixed(0) || 0}%</span>
                  </div>
                </div>
                <div className="text-2xl font-semibold text-black text-emerald-700 mb-2" data-testid="text-total-stations">
                  {overview?.stations.total || 0}
                </div>
                <div className="text-xs text-black/50 text-gray-600">Total Stations</div>
                <div className="mt-4 pt-4 border-t border-black/10">
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-gray-600">Online: {overview?.stations.active || 0}</span>
                    <span className="text-gray-600">Offline: {overview?.stations.offline || 0}</span>
                  </div>
                  <Link href="/admin/stations">
                    <Button 
                      className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg w-full text-sm"
                      data-testid="button-manage-stations"
                    >
                      <Settings className="w-4 h-4 mr-2 inline" />
                      Manage Stations
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Transactions Card */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-hover-lift luxury-shadow-md luxury-animate-scale-in luxury-delay-4" data-testid="card-transactions">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-orange-600">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-bold">{overview?.transactions.successRate.toFixed(1) || 0}%</span>
                  </div>
                </div>
                <div className="text-2xl font-semibold text-black text-emerald-700 mb-2" data-testid="text-total-transactions">
                  {overview?.transactions.total.toLocaleString() || 0}
                </div>
                <div className="text-xs text-black/50 text-gray-600">Total Transactions</div>
                <div className="mt-4 pt-4 border-t border-black/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Success: {overview?.transactions.completed || 0}</span>
                    <span className="text-gray-600">Failed: {overview?.transactions.failed || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Control Tower — today's live business snapshot.
                Read-only aggregation of existing DB data (/api/admin/control-tower). */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-lg font-semibold text-black flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-700" />
                  <span>Control Tower — Today</span>
                </h3>
                {controlTower?.generatedAt && (
                  <span className="text-xs text-black/40">
                    Updated {new Date(controlTower.generatedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Sales today */}
                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="ct-sales">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-5 w-5 text-emerald-700" />
                    <span className="text-xs font-medium text-black/50">Sales Today</span>
                  </div>
                  <div className="text-2xl font-semibold text-black">
                    {controlTower?.salesToday
                      ? `₪${controlTower.salesToday.totalIls.toLocaleString()}`
                      : '—'}
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    {controlTower?.salesToday
                      ? `${controlTower.salesToday.count} payment${controlTower.salesToday.count === 1 ? '' : 's'}`
                      : 'unavailable'}
                  </div>
                </div>

                {/* Stations */}
                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="ct-stations">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-5 w-5 text-emerald-700" />
                    <span className="text-xs font-medium text-black/50">Stations</span>
                  </div>
                  <div className="text-2xl font-semibold text-black">
                    {controlTower?.stations
                      ? `${controlTower.stations.active}/${controlTower.stations.total}`
                      : '—'}
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    {controlTower?.stations
                      ? `${controlTower.stations.offline} offline`
                      : 'unavailable'}
                  </div>
                </div>

                {/* Open faults */}
                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="ct-faults">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className={`h-5 w-5 ${controlTower?.faults && controlTower.faults.critical > 0 ? 'text-red-600' : 'text-emerald-700'}`} />
                    <span className="text-xs font-medium text-black/50">Open Faults</span>
                  </div>
                  <div className={`text-2xl font-semibold ${controlTower?.faults && controlTower.faults.open > 0 ? 'text-red-600' : 'text-black'}`}>
                    {controlTower?.faults ? controlTower.faults.open : '—'}
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    {controlTower?.faults
                      ? `${controlTower.faults.critical} critical`
                      : 'unavailable'}
                  </div>
                </div>

                {/* Low stock */}
                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="ct-stock">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className={`h-5 w-5 ${controlTower?.stock && controlTower.stock.lowCount > 0 ? 'text-amber-600' : 'text-emerald-700'}`} />
                    <span className="text-xs font-medium text-black/50">Low Stock</span>
                  </div>
                  <div className={`text-2xl font-semibold ${controlTower?.stock && controlTower.stock.lowCount > 0 ? 'text-amber-600' : 'text-black'}`}>
                    {controlTower?.stock ? controlTower.stock.lowCount : '—'}
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    {controlTower?.stock ? 'items at/below min' : 'unavailable'}
                  </div>
                </div>

                {/* eGift */}
                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="ct-egift">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-emerald-700" />
                    <span className="text-xs font-medium text-black/50">eGift</span>
                  </div>
                  <div className="text-2xl font-semibold text-black">
                    {controlTower?.egift ? controlTower.egift.soldToday : '—'}
                  </div>
                  <div className="mt-1 text-xs text-black/50">
                    {controlTower?.egift
                      ? `sold today · ${controlTower.egift.unredeemed} unredeemed`
                      : 'unavailable'}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 luxury-animate-slide-up luxury-delay-2">
              {/* Revenue Trend Chart */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg" data-testid="chart-revenue-trend">
                <h3 className="text-lg font-semibold text-black mb-6 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-emerald-700" />
                  <span>Revenue Trend (30 Days)</span>
                </h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-black/40">Loading chart...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData?.data || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#047857" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#047857" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                      <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#6b7280' }} />
                      <YAxis stroke="#9ca3af" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #00000020', borderRadius: '8px' }}
                        labelStyle={{ color: '#111' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#047857" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Loyalty Distribution */}
              <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg" data-testid="chart-loyalty">
                <h3 className="text-lg font-semibold text-black mb-6 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-emerald-700" />
                  <span>Loyalty Tier Distribution</span>
                </h3>
                <div className="space-y-4">
                  {[
                    { tier: 'Royal 👑', count: overview?.loyalty.royal || 0, color: 'from-purple-500 to-violet-600', bgColor: 'bg-purple-500/20' },
                    { tier: 'Emerald 💚', count: overview?.loyalty.emerald || 0, color: 'from-emerald-400 to-green-500', bgColor: 'bg-emerald-500/20' },
                    { tier: 'Diamond 💎', count: overview?.loyalty.diamond || 0, color: 'from-blue-400 to-cyan-500', bgColor: 'bg-blue-500/20' },
                    { tier: 'Platinum 💠', count: overview?.loyalty.platinum || 0, color: 'from-slate-200 to-slate-300', bgColor: 'bg-slate-500/20' },
                    { tier: 'Gold 🥇', count: overview?.loyalty.gold || 0, color: 'from-yellow-400 to-amber-500', bgColor: 'bg-yellow-500/20' },
                    { tier: 'Silver 🥈', count: overview?.loyalty.silver || 0, color: 'from-gray-300 to-gray-400', bgColor: 'bg-gray-500/20' },
                    { tier: 'Bronze 🥉', count: overview?.loyalty.bronze || 0, color: 'from-amber-600 to-orange-700', bgColor: 'bg-amber-500/20' },
                  ].map((item) => {
                    const total = overview?.loyalty.totalMembers || 1;
                    const percentage = (item.count / total) * 100;
                    return (
                      <div key={item.tier} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-black font-medium">{item.tier}</span>
                          <span className="text-black/50">{item.count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-3 bg-black/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${item.color} transition-all duration-1000`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-animate-fade-in luxury-delay-3" data-testid="section-recent-activity">
              <h3 className="text-lg font-semibold text-black mb-6 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-emerald-700" />
                <span>Recent Activity</span>
              </h3>
              <div className="space-y-3">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 rounded-xl bg-black/[0.02] border border-black/10 luxury-hover-lift transition-all" data-testid={`activity-${activity.id}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                        <p className="text-xs text-black/50">{activity.resource}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs">
                          {activity.adminName}
                        </Badge>
                        <p className="text-xs text-black/50 mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedSection === 'analytics' && (
          <div className="space-y-8">
            {/* Advanced Analytics Section */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
              <h2 className="text-2xl font-semibold text-black mb-6 flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <span>Advanced Business Intelligence</span>
                <Badge className="bg-[#D4AF37] text-black">PREMIUM</Badge>
              </h2>

              {/* Station Performance */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-black mb-4">Top Performing Stations</h3>
                {stationLoading ? (
                  <div className="text-gray-500 text-center py-8">Loading station data...</div>
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
                              <div className="text-gray-800 font-medium">{station.stationName}</div>
                              <div className="text-xs text-black/50">{station.totalTransactions} transactions</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-semibold text-black text-emerald-700">₪{station.totalRevenue.toLocaleString()}</div>
                            <div className="text-xs text-black/50">Avg: ₪{station.averageTransaction.toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction Volume Chart */}
              <div>
                <h3 className="text-lg font-semibold text-black mb-4">Transaction Volume (30 Days)</h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-black/40">Loading chart...</div>
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
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
            <h2 className="text-2xl font-semibold text-black mb-4">Loyalty Program Dashboard</h2>
            <p className="text-sm text-black/60 mb-8">Manage customer loyalty, tiers, and rewards</p>
            <div className="text-center py-12 text-gray-500">
              <Award className="w-16 h-16 mx-auto mb-4 opacity-30 text-emerald-600" />
              <p className="text-base font-semibold text-black">Loyalty Management</p>
              <p className="text-xs text-black/50">Advanced loyalty features coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'inventory' && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
            <h2 className="text-2xl font-semibold text-black mb-4">Inventory Management</h2>
            <p className="text-sm text-black/60 mb-8">Track stock levels, supplies, and equipment</p>
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-emerald-600" />
              <p className="text-base font-semibold text-black">Inventory Tracker</p>
              <p className="text-xs text-black/50">Real-time inventory monitoring coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'hr' && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm luxury-shadow-lg luxury-animate-fade-in">
            <h2 className="text-2xl font-semibold text-black mb-4">HR Document Management</h2>
            <p className="text-sm text-black/60 mb-8">Manage employee documents, contracts, and records</p>
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30 text-emerald-600" />
              <p className="text-base font-semibold text-black">HR Documents</p>
              <p className="text-xs text-black/50">Document management system coming soon</p>
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
