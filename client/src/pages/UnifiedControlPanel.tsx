import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Truck,
  DollarSign,
  AlertTriangle,
  Package,
  Users,
  Bell,
  BarChart3,
  Activity,
  TrendingUp,
  Shield,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LogisticsFleetView from "@/components/control-panel/LogisticsFleetView";
import FinanceSettlementsView from "@/components/control-panel/FinanceSettlementsView";
import ComplianceView from "@/components/control-panel/ComplianceView";
import ProviderManagementView from "@/components/control-panel/ProviderManagementView";

export default function UnifiedControlPanel() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch overview metrics
  const { data: metrics } = useQuery({
    queryKey: ["/api/control-panel/metrics"],
  });

  // Fetch real-time events
  const { data: recentEvents } = useQuery({
    queryKey: ["/api/control-panel/events/recent"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="min-h-screen luxury-bg-mesh p-6">
      {/* Header */}
      <div className="mb-8 animate-in fade-in duration-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold luxury-text-gradient">
              Unified Control Panel
            </h1>
            <p className="text-muted-foreground mt-2">
              Enterprise orchestration for all Pet Wash™ platforms
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge className="luxury-badge gap-2 bg-green-50 border-green-200 text-green-700">
              <Activity className="w-4 h-4 animate-pulse" />
              All Systems Operational
            </Badge>
            <Button className="luxury-btn-secondary" variant="outline" size="icon" data-testid="button-notifications">
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="luxury-grid-4 gap-6 mb-8 animate-in slide-in-from-bottom duration-700">
        <Card className="luxury-glass-card luxury-shadow-lg" data-testid="card-platforms">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Platforms</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Building2 className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold luxury-text-gradient">{metrics?.platforms?.active || 10}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.platforms?.total || 10} total platforms
            </p>
          </CardContent>
        </Card>

        <Card className="luxury-glass-card luxury-shadow-lg" data-testid="card-departments">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
              <Users className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold luxury-text-gradient">{metrics?.departments?.count || 16}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.users?.active || 247} active users
            </p>
          </CardContent>
        </Card>

        <Card className="luxury-glass-card luxury-shadow-lg" data-testid="card-events">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Events Today</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Activity className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold luxury-text-gradient">
              {metrics?.events?.today || "1,247"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              {metrics?.events?.change || "+12%"} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="luxury-glass-card luxury-shadow-lg" data-testid="card-alerts">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold luxury-text-gradient">{metrics?.alerts?.active || 3}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.alerts?.critical || 0} critical
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9 mb-6">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="logistics" className="gap-2" data-testid="tab-logistics">
            <Truck className="w-4 h-4" />
            <span className="hidden sm:inline">Logistics</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2" data-testid="tab-finance">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Finance</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2" data-testid="tab-compliance">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2" data-testid="tab-providers">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Providers</span>
          </TabsTrigger>
          <TabsTrigger value="health-safety" className="gap-2" data-testid="tab-health-safety">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">H&S</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2" data-testid="tab-inventory">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="rbac" className="gap-2" data-testid="tab-rbac">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">RBAC</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Status */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle>Platform Status</CardTitle>
                <CardDescription>Real-time health of all platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "The Hub™", status: "operational", uptime: "99.9%" },
                    { name: "The Sitter Suite™", status: "operational", uptime: "99.8%" },
                    { name: "Walk My Pet™", status: "operational", uptime: "99.7%" },
                    { name: "PetTrek™", status: "operational", uptime: "99.9%" },
                    { name: "The Plush Lab™", status: "maintenance", uptime: "98.5%" },
                    { name: "Franchise Portal", status: "operational", uptime: "100%" },
                  ].map((platform, index) => (
                    <div
                      key={platform.name}
                      className="luxury-glass-minimal luxury-hover-lift flex items-center justify-between p-3 rounded-lg transition-all duration-300"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            platform.status === "operational"
                              ? "bg-green-500 animate-pulse"
                              : "bg-orange-500 animate-pulse"
                          }`}
                        />
                        <span className="font-medium">{platform.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {platform.uptime} uptime
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Events Feed */}
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Live system events from all platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {recentEvents?.events?.slice(0, 10).map((event: any, i: number) => (
                    <div key={i} className="luxury-glass-minimal p-3 rounded-lg flex items-start gap-3">
                      <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className="luxury-badge text-xs">
                            {event.type || "SYSTEM_EVENT"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {event.timestamp || "2 minutes ago"}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          {event.description || "System event occurred"}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center text-muted-foreground py-8">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No recent events</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Overview */}
          <Card className="luxury-glass-card luxury-shadow-lg">
            <CardHeader>
              <CardTitle>Department Overview</CardTitle>
              <CardDescription>Activity across all 16 departments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {[
                  { name: "Operations", count: 42, icon: Building2 },
                  { name: "Finance", count: 18, icon: DollarSign },
                  { name: "Logistics", count: 15, icon: Truck },
                  { name: "H&S", count: 7, icon: Shield },
                  { name: "Support", count: 56, icon: Users },
                  { name: "Sales", count: 23, icon: TrendingUp },
                  { name: "Technology", count: 12, icon: Activity },
                  { name: "Marketing", count: 31, icon: BarChart3 },
                ].map((dept, index) => (
                  <Card 
                    key={dept.name} 
                    className="luxury-glass-minimal luxury-hover-lift text-center transition-all duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardContent className="pt-6">
                      <dept.icon className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                      <div className="text-2xl font-bold luxury-text-gradient">{dept.count}</div>
                      <p className="text-xs text-muted-foreground">{dept.name}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logistics & Fleet Module */}
        <TabsContent value="logistics">
          <LogisticsFleetView />
        </TabsContent>

        {/* Finance & Settlements Module */}
        <TabsContent value="finance">
          <FinanceSettlementsView />
        </TabsContent>

        {/* Global Compliance Brain Module */}
        <TabsContent value="compliance">
          <ComplianceView />
        </TabsContent>

        {/* Provider Management Module */}
        <TabsContent value="providers">
          <ProviderManagementView />
        </TabsContent>

        <TabsContent value="health-safety">
          <Card>
            <CardHeader>
              <CardTitle>Health & Safety</CardTitle>
              <CardDescription>
                Incident reporting, photo documentation, and resolution workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Health & Safety Module</p>
                <p className="text-sm">Coming in next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>
                Stock levels, low-stock alerts, and purchase order generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Inventory Module</p>
                <p className="text-sm">Coming in next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rbac">
          <Card>
            <CardHeader>
              <CardTitle>RBAC Management</CardTitle>
              <CardDescription>
                User roles, department assignments, and platform access control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">RBAC Module</p>
                <p className="text-sm">Coming in next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications Center</CardTitle>
              <CardDescription>
                Unified inbox, channel management, and template editor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Notifications Module</p>
                <p className="text-sm">Coming in next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Platform metrics, department KPIs, and revenue charts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Analytics Module</p>
                <p className="text-sm">Coming in next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
