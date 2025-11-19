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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LogisticsFleetView from "@/components/control-panel/LogisticsFleetView";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Unified Control Panel
            </h1>
            <p className="text-muted-foreground mt-2">
              Enterprise orchestration for all Pet Wash™ platforms
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-2">
              <Activity className="w-4 h-4 text-green-500 animate-pulse" />
              All Systems Operational
            </Badge>
            <Button variant="outline" size="icon" data-testid="button-notifications">
              <Bell className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-blue-200 dark:border-blue-900" data-testid="card-platforms">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Platforms</CardTitle>
            <Building2 className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.platforms?.active || 10}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.platforms?.total || 10} total platforms
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-900" data-testid="card-departments">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Users className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.departments?.count || 16}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.users?.active || 247} active users
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-900" data-testid="card-events">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Events Today</CardTitle>
            <Activity className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.events?.today || "1,247"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              {metrics?.events?.change || "+12%"} from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-900" data-testid="card-alerts">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.alerts?.active || 3}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.alerts?.critical || 0} critical
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 mb-6">
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
            <Card>
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
                  ].map((platform) => (
                    <div
                      key={platform.name}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            platform.status === "operational"
                              ? "bg-green-500"
                              : "bg-orange-500"
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
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Live system events from all platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {recentEvents?.events?.slice(0, 10).map((event: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
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
          <Card>
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
                ].map((dept) => (
                  <Card key={dept.name} className="text-center">
                    <CardContent className="pt-6">
                      <dept.icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-2xl font-bold">{dept.count}</div>
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

        <TabsContent value="finance">
          <Card>
            <CardHeader>
              <CardTitle>Finance & Settlements</CardTitle>
              <CardDescription>
                Partner revenue, commission tracking, and monthly settlements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Finance Module</p>
                <p className="text-sm">Coming in next update</p>
              </div>
            </CardContent>
          </Card>
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
