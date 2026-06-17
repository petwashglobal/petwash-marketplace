import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { getApiUrl } from "@/lib/apiConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Brain,
  Crown,
  Gem,
  Medal
} from "lucide-react";
import { Link, useLocation } from "wouter";
import NayaxMonitoring from "@/components/admin/NayaxMonitoring";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
          <div className="w-16 h-16 border-4 border-[#12936A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#111111] text-lg font-medium">Loading Premium Analytics...</p>
          <p className="text-gray-500 text-sm mt-2">Preparing your luxury dashboard</p>
        </div>
      </div>
    );
  }

  const overview = analytics?.data;

  return (
    <div className="min-h-screen bg-white relative overflow-hidden luxury-animate-fade-in">
      {/* Subtle emerald accent wash */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#36C98F] rounded-full mix-blend-multiply filter blur-3xl opacity-[0.06] animate-pulse" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-[#12936A] rounded-full mix-blend-multiply filter blur-3xl opacity-[0.06] animate-pulse delay-700" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-[#36C98F] rounded-full mix-blend-multiply filter blur-3xl opacity-[0.06] animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm relative z-10">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <img 
                src="/brand/petwash-logo-official.png" 
                alt="Pet Wash" 
                className="h-12 w-auto object-contain"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#0C5B3F]">
                    Pet Wash Admin Platform
                  </h1>
                  <span className="px-2 py-0.5 text-[8px] tracking-[0.12em] uppercase font-semibold bg-[#12936A]/10 text-[#0C5B3F] border border-[#12936A]/30 rounded-sm">
                    Admin
                  </span>
                </div>
                <p className="text-sm text-gray-500 font-medium">Business Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Live Clock */}
              <div className="hidden md:flex flex-col items-end">
                <div className="text-[#111111] font-mono text-lg font-bold">
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-gray-500 text-xs">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>

              <Link href="/admin/brain">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#0C5B3F] hover:text-[#12936A] hover:bg-[#12936A]/10 border border-[#12936A]/30"
                  title="Operations Brain — live stations, revenue, alerts, approvals"
                  data-testid="button-header-brain"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">Brain</span>
                </Button>
              </Link>
              <Link href="/admin/stations">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-[#12936A] hover:bg-[#12936A]/10"
                  title="Manage Stations"
                  data-testid="button-header-stations"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="hidden lg:inline">Stations</span>
                </Button>
              </Link>
              <Link href="/admin/help">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-[#12936A] hover:bg-[#12936A]/10"
                  title="View Admin Documentation"
                  data-testid="button-admin-help"
                >
                  <Info className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Help</span>
                </Button>
              </Link>
              <Link href="/admin/financial-monitor">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-[#12936A] hover:bg-[#12936A]/10" data-testid="button-financial-monitor">
                  <Brain className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Financial AI</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-[#12936A] hover:bg-[#12936A]/10" data-testid="button-settings">
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-600 hover:text-red-600 hover:bg-red-50" data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 relative z-10">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'payments', label: 'Payments', icon: CreditCard },
              { id: 'loyalty', label: 'Loyalty', icon: Award },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'hr', label: 'HR Docs', icon: FileText },
            ].map((section) => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id as any)}
                  className={`flex items-center space-x-2 py-4 px-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap bg-transparent hover:bg-transparent rounded-none ${
                    selectedSection === section.id
                      ? 'border-[#12936A] text-[#0C5B3F]'
                      : 'border-transparent text-gray-500 hover:text-[#12936A] hover:border-[#36C98F]/50'
                  }`}
                  data-testid={`nav-${section.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                  {selectedSection === section.id && <Sparkles className="w-3 h-3 text-[#12936A]" />}
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {selectedSection === 'overview' && (
          <div className="space-y-8">
            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Revenue Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all luxury-animate-scale-in luxury-delay-1" data-testid="card-revenue">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#12936A] rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  {overview?.revenue.growthRate !== undefined && (
                    <div className={`flex items-center space-x-1 ${overview.revenue.growthRate >= 0 ? 'text-[#12936A]' : 'text-red-600'}`}>
                      {overview.revenue.growthRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-bold">{Math.abs(overview.revenue.growthRate).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-3xl font-bold text-[#111111] mb-2" data-testid="text-monthly-revenue">
                  ₪{overview?.revenue.thisMonth.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">Monthly Revenue</div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Today: ₪{overview?.revenue.today.toLocaleString() || 0}</span>
                    <span className="text-gray-600">Week: ₪{overview?.revenue.thisWeek.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Customers Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all luxury-animate-scale-in luxury-delay-2" data-testid="card-customers">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#0C5B3F] rounded-xl">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  {overview?.customers.growthRate !== undefined && (
                    <div className={`flex items-center space-x-1 ${overview.customers.growthRate >= 0 ? 'text-[#12936A]' : 'text-red-600'}`}>
                      {overview.customers.growthRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-bold">{Math.abs(overview.customers.growthRate).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-3xl font-bold text-[#111111] mb-2" data-testid="text-total-customers">
                  {overview?.customers.total.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">Total Customers</div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Active: {overview?.customers.active.toLocaleString() || 0}</span>
                    <span className="text-gray-600">New: {overview?.customers.new.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Stations Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all luxury-animate-scale-in luxury-delay-3" data-testid="card-stations">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#36C98F] rounded-xl">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-[#12936A]">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-bold">{overview?.stations.utilizationRate.toFixed(0) || 0}%</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-[#111111] mb-2" data-testid="text-total-stations">
                  {overview?.stations.total || 0}
                </div>
                <div className="text-sm text-gray-500">Total Stations</div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-gray-600">Online: {overview?.stations.active || 0}</span>
                    <span className="text-gray-600">Offline: {overview?.stations.offline || 0}</span>
                  </div>
                  <Link href="/admin/stations">
                    <Button
                      className="w-full text-sm bg-[#12936A] hover:bg-[#0C5B3F] text-white"
                      data-testid="button-manage-stations"
                    >
                      <Settings className="w-4 h-4 mr-2 inline" />
                      Manage Stations
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Transactions Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all luxury-animate-scale-in luxury-delay-4" data-testid="card-transactions">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#12936A] rounded-xl">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-[#12936A]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-bold">{overview?.transactions.successRate.toFixed(1) || 0}%</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-[#111111] mb-2" data-testid="text-total-transactions">
                  {overview?.transactions.total.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-500">Total Transactions</div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Success: {overview?.transactions.completed || 0}</span>
                    <span className="text-gray-600">Failed: {overview?.transactions.failed || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 luxury-animate-slide-up luxury-delay-2">
              {/* Revenue Trend Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm" data-testid="chart-revenue-trend">
                <h3 className="text-lg font-semibold text-[#111111] mb-6 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-[#12936A]" />
                  <span>Revenue Trend (30 Days)</span>
                </h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-400">Loading chart...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData?.data || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#12936A" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#12936A" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <YAxis stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        labelStyle={{ color: '#111111' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#12936A" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Loyalty Distribution */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm" data-testid="chart-loyalty">
                <h3 className="text-lg font-semibold text-[#111111] mb-6 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-[#12936A]" />
                  <span>Loyalty Tier Distribution</span>
                </h3>
                <div className="space-y-4">
                  {[
                    { tier: 'Royal', count: overview?.loyalty.royal || 0, Icon: Crown, iconColor: 'text-[#0C5B3F]', barColor: 'bg-[#0C5B3F]' },
                    { tier: 'Emerald', count: overview?.loyalty.emerald || 0, Icon: Gem, iconColor: 'text-[#12936A]', barColor: 'bg-[#12936A]' },
                    { tier: 'Diamond', count: overview?.loyalty.diamond || 0, Icon: Gem, iconColor: 'text-[#36C98F]', barColor: 'bg-[#36C98F]' },
                    { tier: 'Platinum', count: overview?.loyalty.platinum || 0, Icon: Award, iconColor: 'text-gray-500', barColor: 'bg-gray-400' },
                    { tier: 'Gold', count: overview?.loyalty.gold || 0, Icon: Medal, iconColor: 'text-[#12936A]', barColor: 'bg-[#12936A]' },
                    { tier: 'Silver', count: overview?.loyalty.silver || 0, Icon: Medal, iconColor: 'text-gray-400', barColor: 'bg-gray-300' },
                    { tier: 'Bronze', count: overview?.loyalty.bronze || 0, Icon: Medal, iconColor: 'text-gray-500', barColor: 'bg-gray-400' },
                  ].map((item) => {
                    const total = overview?.loyalty.totalMembers || 1;
                    const percentage = (item.count / total) * 100;
                    const TierIcon = item.Icon;
                    return (
                      <div key={item.tier} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#111111] font-medium flex items-center gap-2">
                            <TierIcon className={`w-4 h-4 ${item.iconColor}`} />
                            {item.tier}
                          </span>
                          <span className="text-gray-500">{item.count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.barColor} transition-all duration-1000`}
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
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm luxury-animate-fade-in luxury-delay-3" data-testid="section-recent-activity">
              <h3 className="text-lg font-semibold text-[#111111] mb-6 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-[#12936A]" />
                <span>Recent Activity</span>
              </h3>
              <div className="space-y-3">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#12936A]/30 transition-all" data-testid={`activity-${activity.id}`}>
                      <div>
                        <p className="text-sm font-medium text-[#111111]">{activity.action}</p>
                        <p className="text-sm text-gray-500">{activity.resource}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="text-xs bg-[#12936A]/10 text-[#0C5B3F] border-[#12936A]/20">
                          {activity.adminName}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
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
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm luxury-animate-fade-in">
              <h2 className="text-2xl font-bold text-[#111111] mb-6 flex items-center space-x-3">
                <div className="p-2 bg-[#12936A] rounded-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <span>Advanced Business Intelligence</span>
                <Badge className="bg-[#12936A]/10 text-[#0C5B3F] border-[#12936A]/20">PREMIUM</Badge>
              </h2>

              {/* Station Performance */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-[#111111] mb-4">Top Performing Stations</h3>
                {stationLoading ? (
                  <div className="text-gray-500 text-center py-8">Loading station data...</div>
                ) : (
                  <div className="space-y-3">
                    {stationData?.data?.slice(0, 5).map((station, index) => (
                      <div key={station.stationId} className="bg-gray-50 border border-gray-100 hover:border-[#12936A]/30 transition-all rounded-xl p-4" data-testid={`station-${station.stationId}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                              index === 0 ? 'bg-[#0C5B3F]' :
                              index === 1 ? 'bg-[#12936A]' :
                              index === 2 ? 'bg-[#36C98F]' :
                              'bg-gray-400'
                            }`}>
                              #{index + 1}
                            </div>
                            <div>
                              <div className="text-[#111111] font-medium">{station.stationName}</div>
                              <div className="text-sm text-gray-500">{station.totalTransactions} transactions</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#0C5B3F]">₪{station.totalRevenue.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">Avg: ₪{station.averageTransaction.toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction Volume Chart */}
              <div>
                <h3 className="text-lg font-semibold text-[#111111] mb-4">Transaction Volume (30 Days)</h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-400">Loading chart...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <YAxis stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        labelStyle={{ color: '#111111' }}
                      />
                      <Bar dataKey="transactions" fill="#12936A" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedSection === 'loyalty' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm luxury-animate-fade-in">
            <h2 className="text-2xl font-bold text-[#111111] mb-4">Loyalty Program Dashboard</h2>
            <p className="text-gray-600 mb-8">Manage customer loyalty, tiers, and rewards</p>
            <div className="text-center py-12 text-gray-400">
              <Award className="w-16 h-16 mx-auto mb-4 opacity-30 text-[#12936A]" />
              <p className="text-lg font-semibold text-[#111111]">Loyalty Management</p>
              <p className="text-sm text-gray-500">Advanced loyalty features coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'inventory' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm luxury-animate-fade-in">
            <h2 className="text-2xl font-bold text-[#111111] mb-4">Inventory Management</h2>
            <p className="text-gray-600 mb-8">Track stock levels, supplies, and equipment</p>
            <div className="text-center py-12 text-gray-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30 text-[#12936A]" />
              <p className="text-lg font-semibold text-[#111111]">Inventory Tracker</p>
              <p className="text-sm text-gray-500">Real-time inventory monitoring coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'hr' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm luxury-animate-fade-in">
            <h2 className="text-2xl font-bold text-[#111111] mb-4">HR Document Management</h2>
            <p className="text-gray-600 mb-8">Manage employee documents, contracts, and records</p>
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30 text-[#12936A]" />
              <p className="text-lg font-semibold text-[#111111]">HR Documents</p>
              <p className="text-sm text-gray-500">Document management system coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'payments' && (
          <div className="space-y-6 luxury-animate-fade-in">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <NayaxMonitoring />
            </div>
          </div>
        )}
      </main>

      {/* Footer Badge */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white border border-[#12936A]/20 rounded-full px-4 py-2 shadow-md">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#12936A] animate-pulse" />
            <span className="text-[#111111] text-sm font-medium">Premium 2025-2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
