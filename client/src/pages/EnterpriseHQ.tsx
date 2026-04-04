import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { type Language } from "@/lib/i18n";
import {
  Globe,
  Building2,
  MapPin,
  Activity,
  DollarSign,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Users,
  Search,
  Filter,
  Home,
  FileText,
  BarChart3,
  Shield,
  LogOut
} from "lucide-react";

interface EnterpriseHQProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function EnterpriseHQ({ language, onLanguageChange }: EnterpriseHQProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [location] = useLocation();
  const { user, signOut } = useFirebaseAuth();

  const navigation = [
    { name: "HQ Dashboard", href: "/enterprise/hq", icon: Home },
    { name: "Stations", href: "/enterprise/stations", icon: Building2 },
    { name: "Franchisees", href: "/enterprise/franchisees", icon: Users },
    { name: "Documents", href: "/enterprise/documents", icon: FileText },
    { name: "Work Orders", href: "/enterprise/work-orders", icon: Wrench },
    { name: "Analytics", href: "/enterprise/analytics", icon: BarChart3 },
    { name: "Security & Access", href: "/enterprise/rbac", icon: Shield },
  ];

  const { data: analytics, isLoading: analyticsLoading} = useQuery({
    queryKey: ["/api/enterprise/analytics/global"],
  });

  const { data: countries } = useQuery({
    queryKey: ["/api/enterprise/countries"],
  });

  const { data: stations } = useQuery({
    queryKey: ["/api/enterprise/stations/map"],
  });

  const { data: franchisees } = useQuery({
    queryKey: ["/api/enterprise/franchisees"],
  });

  if (analyticsLoading) {
    return (
      <Layout language={language} onLanguageChange={onLanguageChange}>
        <div className="luxury-bg-mesh min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="luxury-spinner mx-auto mb-4"></div>
            <p className="luxury-text-body">Loading enterprise dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const analyticsData = analytics as any;
  
  const stats = [
    {
      title: "Total Stations",
      value: analyticsData?.stations?.totalStations || 0,
      active: analyticsData?.stations?.activeStations || 0,
      icon: Building2,
      color: "text-blue-600",
    },
    {
      title: "Active Franchisees",
      value: analyticsData?.franchisees?.activeFranchisees || 0,
      total: analyticsData?.franchisees?.totalFranchisees || 0,
      icon: Users,
      color: "text-green-600",
    },
    {
      title: "Open Alerts",
      value: analyticsData?.alerts?.totalAlerts || 0,
      critical: analyticsData?.alerts?.criticalAlerts || 0,
      icon: AlertTriangle,
      color: "text-red-600",
    },
    {
      title: "Pending Work Orders",
      value: analyticsData?.workOrders?.totalPending || 0,
      inProgress: analyticsData?.workOrders?.totalInProgress || 0,
      icon: Wrench,
      color: "text-orange-600",
    },
  ];

  const healthStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "critical":
        return "bg-red-500";
      case "offline":
        return "bg-gray-500";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen luxury-bg-mesh">
        {/* Enterprise Admin Bar */}
        <div className="luxury-bg-primary text-white py-4 px-6 luxury-shadow-md">
          <div className="luxury-container flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="luxury-heading-sm text-white">⁦Pet Wash™⁩ Enterprise Control Panel</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm opacity-90">{user?.displayName || user?.email}</span>
              <Button
                onClick={() => signOut()}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all hover:scale-105"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex luxury-container">
          {/* Enterprise Sidebar Navigation with Luxury Styling */}
          <aside className="w-72 luxury-glass-panel luxury-shadow-lg min-h-[calc(100vh-200px)] m-6 mr-0">
            <nav className="p-6 space-y-2">
              {navigation.map((item, index) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all
                      luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}
                      ${isActive
                        ? "luxury-btn-secondary luxury-shadow-md"
                        : "luxury-btn-ghost"
                      }
                    `}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? 'luxury-bg-primary' : 'bg-white dark:bg-white'}`}>
                      <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <span className="font-semibold text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content Area with Luxury Styling */}
          <main className="flex-1 p-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 luxury-animate-fade-in">
          <div>
            <h1 className="luxury-heading-lg flex items-center gap-3">
              <div className="p-3 rounded-2xl luxury-bg-primary">
                <Globe className="h-8 w-8 text-white" />
              </div>
              Global HQ Dashboard
            </h1>
            <p className="luxury-text-body mt-2">
              ⁦Pet Wash™⁩ 2026 Enterprise Command Center
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search stations, franchisees, assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 luxury-glass-minimal border-0 focus:ring-2 focus:ring-purple-400"
                data-testid="input-search-global"
              />
            </div>
            <Button variant="outline" size="icon" className="luxury-glass-minimal border-0 hover:luxury-shadow-md" data-testid="button-filter">
              <Filter className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div 
                key={stat.title} 
                className={`luxury-glass-card luxury-shadow-md luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${index + 1}`}
                data-testid={`card-metric-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="luxury-heading-sm text-gray-700 dark:text-black">{stat.title}</h3>
                  <div className={`p-3 rounded-xl ${stat.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="luxury-heading-lg luxury-text-gradient mb-2">{stat.value}</div>
                {"active" in stat && (
                  <p className="luxury-text-small">
                    {stat.active} active
                  </p>
                )}
                {"critical" in stat && stat.critical > 0 && (
                  <div className="luxury-badge luxury-badge-gold mt-2 inline-flex">
                    <AlertTriangle className="h-3 w-3" />
                    {stat.critical} critical
                  </div>
                )}
                {"inProgress" in stat && (
                  <p className="luxury-text-small">
                    {stat.inProgress} in progress
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="map" className="space-y-6 luxury-animate-fade-in luxury-delay-3">
          <TabsList className="luxury-glass-panel p-2 grid w-full grid-cols-4">
            <TabsTrigger value="map" data-testid="tab-map" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
              <MapPin className="h-4 w-4 mr-2" />
              Global Map
            </TabsTrigger>
            <TabsTrigger value="stations" data-testid="tab-stations" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
              <Building2 className="h-4 w-4 mr-2" />
              Stations
            </TabsTrigger>
            <TabsTrigger value="franchisees" data-testid="tab-franchisees" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              Franchisees
            </TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
              <DollarSign className="h-4 w-4 mr-2" />
              Financials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4">
            <div className="luxury-glass-card luxury-shadow-md luxury-hover-lift p-8">
              <div className="mb-6">
                <h2 className="luxury-heading-md mb-2">Live Station Network</h2>
                <p className="luxury-text-body">
                  Real-time status of {(stations as any[])?.length || 0} stations worldwide
                </p>
              </div>
              <div className="luxury-glass-minimal rounded-2xl p-8 min-h-[500px] flex items-center justify-center">
                <div className="text-center space-y-6">
                  <div className="p-6 rounded-full luxury-bg-soft inline-flex">
                    <MapPin className="h-16 w-16 luxury-text-gradient" />
                  </div>
                  <div>
                    <p className="luxury-heading-md mb-2">Interactive Map Coming Soon</p>
                    <p className="luxury-text-body">
                      Integrated with Google Maps / Mapbox for real-time station visualization
                    </p>
                  </div>
                  
                  {/* Station List Preview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {(stations as any[])?.slice(0, 8).map((station: any, index) => (
                      <div
                        key={station.id}
                        className={`luxury-glass-card p-4 text-left luxury-animate-scale-in luxury-delay-${Math.min(index + 1, 5)}`}
                        data-testid={`station-${station.id}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`h-3 w-3 rounded-full ${healthStatusColor(
                              station.healthStatus
                            )}`}
                          />
                          <span className="text-xs font-semibold truncate">
                            {station.stationCode}
                          </span>
                        </div>
                        <p className="luxury-text-small truncate">
                          {station.city}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stations" className="space-y-4">
            <div className="luxury-glass-card luxury-shadow-md luxury-hover-lift p-8">
              <div className="mb-6">
                <h2 className="luxury-heading-md mb-2 luxury-text-gradient">Station Directory</h2>
                <p className="luxury-text-body">
                  Comprehensive list of all ⁦Pet Wash™⁩ stations
                </p>
              </div>
              <div className="space-y-3">
                {(stations as any[])?.slice(0, 10).map((station: any, index) => (
                  <div
                    key={station.id}
                    className={`flex items-center justify-between p-5 luxury-glass-minimal rounded-xl hover:luxury-shadow-md transition-all luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}
                    data-testid={`station-row-${station.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-12 w-12 rounded-xl ${healthStatusColor(
                          station.healthStatus
                        )} flex items-center justify-center luxury-shadow-sm`}
                      >
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-black">{station.stationName}</p>
                        <p className="luxury-text-small">
                          {station.stationCode} • {station.city}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`luxury-badge ${station.operationalStatus === 'active' ? 'luxury-badge-success' : ''}`}>
                        {station.operationalStatus}
                      </div>
                      <Button className="luxury-btn-secondary text-sm px-4 py-2" data-testid={`button-view-station-${station.id}`}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="franchisees" className="space-y-4">
            <div className="luxury-glass-card luxury-shadow-md luxury-hover-lift p-8">
              <div className="mb-6">
                <h2 className="luxury-heading-md mb-2 luxury-text-gradient">Franchise Partners</h2>
                <p className="luxury-text-body">
                  Manage {(franchisees as any[])?.length || 0} franchise relationships
                </p>
              </div>
              <div className="space-y-3">
                {(franchisees as any[])?.slice(0, 10).map((franchisee: any, index) => (
                  <div
                    key={franchisee.id}
                    className={`flex items-center justify-between p-5 luxury-glass-minimal rounded-xl hover:luxury-shadow-md transition-all luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}
                    data-testid={`franchisee-row-${franchisee.id}`}
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-black">{franchisee.companyName}</p>
                      <p className="luxury-text-small">
                        {franchisee.contactFirstName} {franchisee.contactLastName} • 
                        <span className="luxury-badge luxury-badge-gold ml-2 px-2 py-0.5 text-xs">
                          {franchisee.totalStations} stations
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`luxury-badge ${franchisee.status === 'active' ? 'luxury-badge-success' : ''}`}>
                        {franchisee.status}
                      </div>
                      <Button className="luxury-btn-secondary text-sm px-4 py-2" data-testid={`button-view-franchisee-${franchisee.id}`}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="luxury-glass-card luxury-shadow-md luxury-hover-lift p-8 luxury-animate-slide-up luxury-delay-1">
                <div className="mb-6">
                  <h2 className="luxury-heading-md mb-2 luxury-text-gradient">Unpaid Bills</h2>
                  <p className="luxury-text-body">Outstanding station expenses</p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="luxury-heading-lg luxury-text-gradient">
                      {analyticsData?.bills?.totalUnpaid || 0}
                    </span>
                    <div className="luxury-badge luxury-badge-gold">
                      <AlertTriangle className="h-3 w-3" />
                      {analyticsData?.bills?.totalOverdue || 0} overdue
                    </div>
                  </div>
                  <div className="luxury-divider"></div>
                  <p className="luxury-text-small">
                    Total Amount: <span className="font-semibold text-gray-900 dark:text-black">{analyticsData?.bills?.totalAmount || '0.00'} ILS</span>
                  </p>
                </div>
              </div>

              <div className="luxury-glass-card luxury-shadow-md luxury-hover-lift p-8 luxury-animate-slide-up luxury-delay-2">
                <div className="mb-6">
                  <h2 className="luxury-heading-md mb-2 luxury-text-gradient">Revenue Overview</h2>
                  <p className="luxury-text-body">Global network performance</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-green-100">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <span className="luxury-heading-lg luxury-text-gradient">Coming Soon</span>
                  </div>
                  <div className="luxury-divider"></div>
                  <p className="luxury-text-small">
                    Real-time revenue tracking and analytics
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
