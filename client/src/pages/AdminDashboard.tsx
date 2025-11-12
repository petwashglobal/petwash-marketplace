import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
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
  MapPin
} from "lucide-react";
import { Link } from "wouter";
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
    new: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
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
      await fetch('/api/admin/logout', { method: 'POST' });
      window.location.href = '/admin/login';
    } catch (error) {
      logger.error('Logout error', error);
    }
  };

  const isLoading = analyticsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Loading Premium Analytics...</p>
          <p className="text-purple-300 text-sm mt-2">Preparing your luxury dashboard</p>
        </div>
      </div>
    );
  }

  const overview = analytics?.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-rose-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-700" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
      </div>

      {/* Glassmorphism Header */}
      <header className="backdrop-blur-xl bg-white/10 border-b border-white/20 shadow-2xl relative z-10">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-400 via-purple-400 to-blue-400 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50 animate-pulse">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-300 via-purple-300 to-blue-300 bg-clip-text text-transparent">
                  Pet Wash™ Premium
                </h1>
                <p className="text-sm text-purple-200 font-medium">Enterprise Analytics Portal</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Live Clock */}
              <div className="hidden md:flex flex-col items-end">
                <div className="text-white font-mono text-lg font-bold">
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-purple-300 text-xs">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>

              <Link href="/admin/stations">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-purple-300 hover:text-purple-200 hover:bg-white/10 backdrop-blur-sm"
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
                  className="text-emerald-300 hover:text-emerald-200 hover:bg-white/10 backdrop-blur-sm"
                  title="View Admin Documentation"
                  data-testid="button-admin-help"
                >
                  <Info className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Help</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 backdrop-blur-sm" data-testid="button-settings">
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-300 hover:text-rose-200 hover:bg-white/10 backdrop-blur-sm" data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Glassmorphism Navigation */}
      <nav className="backdrop-blur-xl bg-white/5 border-b border-white/10 relative z-10">
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
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id as any)}
                  className={`flex items-center space-x-2 py-4 px-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap ${
                    selectedSection === section.id
                      ? 'border-rose-400 text-white bg-white/5'
                      : 'border-transparent text-purple-200 hover:text-white hover:border-purple-300/50'
                  }`}
                  data-testid={`nav-${section.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                  {selectedSection === section.id && <Sparkles className="w-3 h-3 text-rose-400" />}
                </button>
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
              <div className="group backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-400/30 rounded-2xl p-6 shadow-2xl hover:shadow-green-500/50 transition-all duration-300 hover:scale-105" data-testid="card-revenue">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <DollarSign className="h-6 w-6 text-green-300" />
                  </div>
                  {overview?.revenue.growthRate !== undefined && (
                    <div className={`flex items-center space-x-1 ${overview.revenue.growthRate >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {overview.revenue.growthRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-bold">{Math.abs(overview.revenue.growthRate).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-3xl font-bold text-white mb-2" data-testid="text-monthly-revenue">
                  ₪{overview?.revenue.thisMonth.toLocaleString() || 0}
                </div>
                <div className="text-green-200 text-sm font-medium">Monthly Revenue</div>
                <div className="mt-4 pt-4 border-t border-green-400/20">
                  <div className="flex justify-between text-xs">
                    <span className="text-green-300">Today: ₪{overview?.revenue.today.toLocaleString() || 0}</span>
                    <span className="text-green-300">Week: ₪{overview?.revenue.thisWeek.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Customers Card */}
              <div className="group backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-400/30 rounded-2xl p-6 shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105" data-testid="card-customers">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Users className="h-6 w-6 text-blue-300" />
                  </div>
                  {overview?.customers.growthRate !== undefined && (
                    <div className={`flex items-center space-x-1 ${overview.customers.growthRate >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {overview.customers.growthRate >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="text-sm font-bold">{Math.abs(overview.customers.growthRate).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-3xl font-bold text-white mb-2" data-testid="text-total-customers">
                  {overview?.customers.total.toLocaleString() || 0}
                </div>
                <div className="text-blue-200 text-sm font-medium">Total Customers</div>
                <div className="mt-4 pt-4 border-t border-blue-400/20">
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-300">Active: {overview?.customers.active.toLocaleString() || 0}</span>
                    <span className="text-blue-300">New: {overview?.customers.new.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Stations Card */}
              <div className="group backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-400/30 rounded-2xl p-6 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105" data-testid="card-stations">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <MapPin className="h-6 w-6 text-purple-300" />
                  </div>
                  <div className="flex items-center space-x-1 text-purple-300">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-bold">{overview?.stations.utilizationRate.toFixed(0) || 0}%</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2" data-testid="text-total-stations">
                  {overview?.stations.total || 0}
                </div>
                <div className="text-purple-200 text-sm font-medium">Total Stations</div>
                <div className="mt-4 pt-4 border-t border-purple-400/20">
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-purple-300">Online: {overview?.stations.active || 0}</span>
                    <span className="text-purple-300">Offline: {overview?.stations.offline || 0}</span>
                  </div>
                  <Link href="/admin/stations">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-purple-500/20 border-purple-400/50 text-purple-100 hover:bg-purple-500/30 hover:text-white transition-all"
                      data-testid="button-manage-stations"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Stations
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Transactions Card */}
              <div className="group backdrop-blur-xl bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-400/30 rounded-2xl p-6 shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105" data-testid="card-transactions">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-500/20 rounded-xl">
                    <Zap className="h-6 w-6 text-orange-300" />
                  </div>
                  <div className="flex items-center space-x-1 text-orange-300">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-bold">{overview?.transactions.successRate.toFixed(1) || 0}%</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-2" data-testid="text-total-transactions">
                  {overview?.transactions.total.toLocaleString() || 0}
                </div>
                <div className="text-orange-200 text-sm font-medium">Total Transactions</div>
                <div className="mt-4 pt-4 border-t border-orange-400/20">
                  <div className="flex justify-between text-xs">
                    <span className="text-orange-300">Success: {overview?.transactions.completed || 0}</span>
                    <span className="text-orange-300">Failed: {overview?.transactions.failed || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Chart */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl" data-testid="chart-revenue-trend">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-rose-400" />
                  <span>Revenue Trend (30 Days)</span>
                </h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-purple-300">Loading chart...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData?.data || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f472b6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f472b6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis dataKey="date" stroke="#fff" tick={{ fill: '#fff' }} />
                      <YAxis stroke="#fff" tick={{ fill: '#fff' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #ffffff30', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#f472b6" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Loyalty Distribution */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl" data-testid="chart-loyalty">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  <span>Loyalty Tier Distribution</span>
                </h3>
                <div className="space-y-4">
                  {[
                    { tier: 'Diamond', count: overview?.loyalty.diamond || 0, color: 'from-blue-400 to-blue-600', bgColor: 'bg-blue-500/20' },
                    { tier: 'Platinum', count: overview?.loyalty.platinum || 0, color: 'from-purple-400 to-purple-600', bgColor: 'bg-purple-500/20' },
                    { tier: 'Gold', count: overview?.loyalty.gold || 0, color: 'from-yellow-400 to-yellow-600', bgColor: 'bg-yellow-500/20' },
                    { tier: 'Silver', count: overview?.loyalty.silver || 0, color: 'from-gray-400 to-gray-600', bgColor: 'bg-gray-500/20' },
                    { tier: 'New', count: overview?.loyalty.new || 0, color: 'from-slate-400 to-slate-600', bgColor: 'bg-slate-500/20' },
                  ].map((item) => {
                    const total = overview?.loyalty.totalMembers || 1;
                    const percentage = (item.count / total) * 100;
                    return (
                      <div key={item.tier} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium">{item.tier}</span>
                          <span className="text-purple-200">{item.count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
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
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl" data-testid="section-recent-activity">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span>Recent Activity</span>
              </h3>
              <div className="space-y-3">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all" data-testid={`activity-${activity.id}`}>
                      <div>
                        <p className="text-sm font-medium text-white">{activity.action}</p>
                        <p className="text-xs text-purple-300">{activity.resource}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="text-xs bg-purple-500/30 text-purple-200 border-purple-400/30">
                          {activity.adminName}
                        </Badge>
                        <p className="text-xs text-purple-400 mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-purple-300">
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
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-rose-400" />
                <span>Advanced Business Intelligence</span>
                <Badge className="bg-gradient-to-r from-rose-500 to-purple-500 text-white border-0">PREMIUM</Badge>
              </h2>

              {/* Station Performance */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-4">Top Performing Stations</h3>
                {stationLoading ? (
                  <div className="text-purple-300 text-center py-8">Loading station data...</div>
                ) : (
                  <div className="space-y-3">
                    {stationData?.data?.slice(0, 5).map((station, index) => (
                      <div key={station.stationId} className="flex items-center justify-between p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10" data-testid={`station-${station.stationId}`}>
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                            'bg-white/10'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <div className="text-white font-medium">{station.stationName}</div>
                            <div className="text-purple-300 text-sm">{station.totalTransactions} transactions</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold text-lg">₪{station.totalRevenue.toLocaleString()}</div>
                          <div className="text-purple-300 text-sm">Avg: ₪{station.averageTransaction.toFixed(0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction Volume Chart */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4">Transaction Volume (30 Days)</h3>
                {revenueLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-purple-300">Loading chart...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis dataKey="date" stroke="#fff" tick={{ fill: '#fff' }} />
                      <YAxis stroke="#fff" tick={{ fill: '#fff' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #ffffff30', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="transactions" fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedSection === 'loyalty' && (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Loyalty Program Dashboard</h2>
            <p className="text-purple-200 mb-8">Manage customer loyalty, tiers, and rewards</p>
            <div className="text-center py-12 text-purple-300">
              <Award className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-white">Loyalty Management</p>
              <p className="text-sm">Advanced loyalty features coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'inventory' && (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Inventory Management</h2>
            <p className="text-purple-200 mb-8">Track stock levels, supplies, and equipment</p>
            <div className="text-center py-12 text-purple-300">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-white">Inventory Tracker</p>
              <p className="text-sm">Real-time inventory monitoring coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'hr' && (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">HR Document Management</h2>
            <p className="text-purple-200 mb-8">Manage employee documents, contracts, and records</p>
            <div className="text-center py-12 text-purple-300">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-white">HR Documents</p>
              <p className="text-sm">Document management system coming soon</p>
            </div>
          </div>
        )}

        {selectedSection === 'payments' && (
          <div className="space-y-6">
            <NayaxMonitoring />
          </div>
        )}
      </main>

      {/* Footer Badge */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="backdrop-blur-xl bg-gradient-to-r from-purple-500/30 to-rose-500/30 border border-white/20 rounded-full px-4 py-2 shadow-2xl">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-rose-300 animate-pulse" />
            <span className="text-white text-sm font-medium">Premium 2025-2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
