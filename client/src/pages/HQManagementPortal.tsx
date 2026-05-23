import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Star,
  DollarSign,
  Cpu,
  Shield,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Building2,
  FileText,
  Award,
  Zap,
  Package,
  CreditCard,
  ArrowUpRight,
  Bell,
  Search,
  Menu,
  X,
  RefreshCw,
  MapPin,
  Briefcase,
  HeartHandshake,
  ShieldCheck,
  Eye,
  Target,
  BookOpen,
  PieChart,
} from "lucide-react";

interface AdminMetrics {
  totalUsers?: number;
  activeProviders?: number;
  pendingApplications?: number;
  totalRevenue?: number;
  activeBookings?: number;
  stationUptime?: number;
  pendingKYC?: number;
  openTickets?: number;
  walletLiability?: number;
  fraudAlerts?: number;
}

const MODULES = [
  { id: "overview", label: "Overview", labelHe: "סקירה כללית", icon: LayoutDashboard, color: "text-slate-700" },
  { id: "providers", label: "Providers", labelHe: "ספקים", icon: UserCheck, color: "text-blue-600" },
  { id: "members", label: "Members & Rewards", labelHe: "חברים ופרסים", icon: Star, color: "text-amber-500" },
  { id: "hr", label: "HR & Team", labelHe: "משאבי אנוש", icon: Briefcase, color: "text-purple-600" },
  { id: "finance", label: "Finance", labelHe: "כספים", icon: DollarSign, color: "text-emerald-600" },
  { id: "stations", label: "K9000 Stations", labelHe: "תחנות K9000", icon: Cpu, color: "text-cyan-600" },
  { id: "kyc", label: "KYC & Compliance", labelHe: "זיהוי ועמידה", icon: ShieldCheck, color: "text-orange-600" },
  { id: "security", label: "Security", labelHe: "אבטחה", icon: Shield, color: "text-red-600" },
  { id: "communications", label: "Communications", labelHe: "תקשורת", icon: MessageSquare, color: "text-indigo-600" },
  { id: "bookings", label: "Bookings", labelHe: "הזמנות", icon: BookOpen, color: "text-teal-600" },
];

const MODULE_LINKS: Record<string, { label: string; href: string; icon: typeof Eye }[]> = {
  overview: [
    { label: "Analytics Dashboard", href: "/admin/dashboard", icon: BarChart3 },
    { label: "System Logs", href: "/admin/system-logs", icon: FileText },
    { label: "Performance Monitor", href: "/admin/performance-monitoring", icon: Activity },
  ],
  providers: [
    { label: "Provider Applications", href: "/admin/backend", icon: UserCheck },
    { label: "Provider Review", href: "/admin/provider-review", icon: Eye },
    { label: "Staff Applications", href: "/admin/staff-onboarding", icon: Briefcase },
  ],
  members: [
    { label: "Members & Loyalty", href: "/admin/backend", icon: Star },
    { label: "Vouchers & Gifts", href: "/admin/vouchers", icon: Package },
  ],
  hr: [
    { label: "HR Dashboard", href: "/admin/hr", icon: Users },
    { label: "Team Management", href: "/admin/users", icon: Users },
    { label: "Team Invitations", href: "/admin/team-invitations", icon: HeartHandshake },
  ],
  finance: [
    { label: "Financial Reports", href: "/admin/financial", icon: DollarSign },
    { label: "Vouchers & Credits", href: "/admin/vouchers", icon: CreditCard },
    { label: "Suppliers", href: "/admin/suppliers", icon: Building2 },
    { label: "SUMIT Control", href: "/admin/sumit", icon: ShieldCheck },
  ],
  stations: [
    { label: "Station Control", href: "/admin/stations", icon: Cpu },
    { label: "Status Monitor", href: "/admin/status-monitor", icon: Activity },
  ],
  kyc: [
    { label: "KYC Verification", href: "/admin/kyc", icon: ShieldCheck },
    { label: "Compliance Control Tower", href: "/pet-wash-ltd/executive/compliance", icon: Globe },
  ],
  security: [
    { label: "Security Monitoring", href: "/admin/security-monitoring", icon: Shield },
    { label: "Fraud Dashboard", href: "/admin/fraud-dashboard", icon: AlertTriangle },
  ],
  communications: [
    { label: "Admin Inbox", href: "/admin/inbox", icon: MessageSquare },
    { label: "Google Forms", href: "/admin/google-forms", icon: FileText },
  ],
  bookings: [
    { label: "Jobs & Dispatch", href: "/admin/jobs", icon: Briefcase },
    { label: "Bookings Overview", href: "/admin/dashboard", icon: BookOpen },
  ],
};

function KpiCard({ label, value, sub, trend, icon: Icon, color, urgent }: {
  label: string; value: string | number; sub?: string; trend?: number; icon: typeof Activity; color: string; urgent?: boolean;
}) {
  return (
    <Card className={`border ${urgent ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"} shadow-sm`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${urgent ? "text-red-700" : "text-slate-900"}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${urgent ? "bg-red-100" : "bg-white"}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-3">
            {trend >= 0
              ? <TrendingUp className="w-3 h-3 text-emerald-500" />
              : <TrendingDown className="w-3 h-3 text-red-500" />}
            <span className={`text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {Math.abs(trend)}% this month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModulePanel({ moduleId, links }: { moduleId: string; links: typeof MODULE_LINKS[string] }) {
  const mod = MODULES.find(m => m.id === moduleId);
  if (!mod) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
          <mod.icon className={`w-5 h-5 ${mod.color}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{mod.label}</h2>
          <p className="text-sm text-slate-500">{mod.labelHe}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map(link => (
          <Link key={link.href} href={link.href}>
            <Card className="border border-slate-200 bg-white hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                    <link.icon className={`w-4 h-4 ${mod.color}`} />
                  </div>
                  <span className="font-medium text-slate-800 group-hover:text-slate-900">{link.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border border-dashed border-slate-300 bg-white">
        <CardContent className="p-5 text-center">
          <p className="text-sm text-slate-500">Full {mod.label} management coming in HQ v2.0</p>
          <p className="text-xs text-slate-400 mt-1">Providers Management, analytics, bulk actions</p>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewModule({ metrics }: { metrics?: AdminMetrics }) {
  const kpis = [
    { label: "Total Users", value: metrics?.totalUsers?.toLocaleString() ?? "—", sub: "Registered members", trend: 12, icon: Users, color: "text-blue-600" },
    { label: "Active Providers", value: metrics?.activeProviders?.toLocaleString() ?? "—", sub: "Sitters, walkers, drivers", trend: 8, icon: UserCheck, color: "text-purple-600" },
    { label: "Active Bookings", value: metrics?.activeBookings?.toLocaleString() ?? "—", sub: "Live service sessions", trend: 5, icon: Activity, color: "text-teal-600" },
    { label: "Pending KYC", value: metrics?.pendingKYC?.toLocaleString() ?? "0", sub: "Awaiting verification", urgent: (metrics?.pendingKYC ?? 0) > 5, icon: ShieldCheck, color: "text-orange-600" },
    { label: "Pending Applications", value: metrics?.pendingApplications?.toLocaleString() ?? "0", sub: "Provider & staff signups", urgent: (metrics?.pendingApplications ?? 0) > 10, icon: Clock, color: "text-amber-600" },
    { label: "Station Uptime", value: metrics?.stationUptime ? `${metrics.stationUptime}%` : "—", sub: "K9000 network health", trend: 0.5, icon: Cpu, color: "text-cyan-600" },
    { label: "Wallet Liability", value: metrics?.walletLiability ? `₪${(metrics.walletLiability / 100).toLocaleString()}` : "—", sub: "Outstanding credits", icon: CreditCard, color: "text-emerald-600" },
    { label: "Fraud Alerts", value: metrics?.fraudAlerts?.toLocaleString() ?? "0", sub: "Requires review", urgent: (metrics?.fraudAlerts ?? 0) > 0, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Platform Overview</h2>
        <p className="text-sm text-slate-500">Real-time management intelligence for PetWash™ Israel operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} {...kpi} value={kpi.value} trend={kpi.trend} />
        ))}
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-4">Quick Access — All Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {MODULES.filter(m => m.id !== "overview").map(mod => (
            <Card
              key={mod.id}
              className="border border-slate-200 bg-white hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => window.location.hash = mod.id}
            >
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mx-auto mb-2">
                  <mod.icon className={`w-5 h-5 ${mod.color}`} />
                </div>
                <p className="text-xs font-medium text-slate-700">{mod.label}</p>
                <p className="text-xs text-slate-400">{mod.labelHe}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Revenue Trend (ILS)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-center justify-center bg-white rounded-lg border border-dashed border-slate-200">
              <Link href="/admin/dashboard">
                <Button variant="outline" size="sm" className="text-xs">
                  <BarChart3 className="w-3 h-3 mr-2" />
                  Open Full Analytics
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(metrics?.pendingApplications ?? 0) > 0 && (
              <Link href="/admin/backend">
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
                  <span className="text-xs font-medium text-amber-800">Provider Applications</span>
                  <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-800">{metrics!.pendingApplications}</Badge>
                </div>
              </Link>
            )}
            {(metrics?.pendingKYC ?? 0) > 0 && (
              <Link href="/admin/kyc">
                <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors">
                  <span className="text-xs font-medium text-orange-800">KYC Reviews</span>
                  <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-800">{metrics!.pendingKYC}</Badge>
                </div>
              </Link>
            )}
            {(metrics?.fraudAlerts ?? 0) > 0 && (
              <Link href="/admin/fraud-dashboard">
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
                  <span className="text-xs font-medium text-red-800">Fraud Alerts</span>
                  <Badge variant="outline" className="text-xs bg-red-100 border-red-300 text-red-800">{metrics!.fraudAlerts}</Badge>
                </div>
              </Link>
            )}
            {(metrics?.pendingApplications ?? 0) === 0 && (metrics?.pendingKYC ?? 0) === 0 && (metrics?.fraudAlerts ?? 0) === 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-800">All clear — no actions needed</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function HQManagementPortal() {
  const [activeModule, setActiveModule] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: metricsData, isLoading: metricsLoading, refetch } = useQuery<{ success: boolean; stats: AdminMetrics }>({
    queryKey: ["/api/admin/analytics/overview"],
    refetchInterval: 60000,
  });

  const metrics = metricsData?.stats;

  const handleLogout = () => navigate("/");

  const currentModule = MODULES.find(m => m.id === activeModule) || MODULES[0];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-16"} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">PW</span>
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-bold text-slate-900">PetWash™ HQ</p>
              <p className="text-xs text-slate-400">Management Portal</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {MODULES.map(mod => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                activeModule === mod.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              <mod.icon className={`w-4 h-4 flex-shrink-0 ${activeModule === mod.id ? "text-white" : mod.color}`} />
              {sidebarOpen && <span className="font-medium truncate">{mod.label}</span>}
            </button>
          ))}
        </nav>

        {/* User footer */}
        {sidebarOpen && (
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-700">
                  {user?.displayName?.[0] || user?.email?.[0] || "A"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.displayName || "Admin"}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email || ""}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Exit HQ
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-slate-700 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-800">{currentModule.label}</span>
              <ChevronRight className="w-4 h-4" />
              <span>{currentModule.labelHe}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${metricsLoading ? "animate-spin" : ""}`} />
            </button>
            <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
              Live
            </Badge>
            <Link href="/admin/inbox">
              <button className="relative text-slate-400 hover:text-slate-700 transition-colors">
                <Bell className="w-5 h-5" />
                {(metrics?.openTickets ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {metrics!.openTickets! > 9 ? "9+" : metrics!.openTickets}
                  </span>
                )}
              </button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <Link href="/admin/system-logs">
              <Button variant="ghost" size="sm" className="text-xs text-slate-500">
                <Settings className="w-3 h-3 mr-1" />
                System
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeModule === "overview" && <OverviewModule metrics={metrics} />}
          {activeModule !== "overview" && (
            <ModulePanel
              moduleId={activeModule}
              links={MODULE_LINKS[activeModule] || []}
            />
          )}
        </main>

        {/* Footer */}
        <div className="border-t border-slate-100 px-8 py-3 bg-white">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>PetWash™ HQ Management Portal v2.0 — Israel Operations</span>
            <div className="flex items-center gap-4">
              <span>Neon PostgreSQL</span>
              <span>•</span>
              <span>Firebase Auth</span>
              <span>•</span>
              <span>Nayax Israel</span>
              <span>•</span>
              <Link href="/admin/dashboard">
                <span className="hover:text-slate-700 cursor-pointer">Full Analytics →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
