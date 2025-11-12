import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Building2,
  Package,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Wrench
} from "lucide-react";

interface FranchiseeDashboardProps {
  franchiseeId: number;
}

export default function FranchiseeDashboard({ franchiseeId }: FranchiseeDashboardProps) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/enterprise/analytics/franchisee", franchiseeId],
  });

  const { data: stations } = useQuery({
    queryKey: ["/api/enterprise/stations", { franchiseeId }],
  });

  const healthStatusStyles = {
    healthy: 'bg-green-100',
    warning: 'bg-yellow-100',
    critical: 'bg-red-100',
    offline: 'bg-gray-100',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "My Stations",
      value: analytics?.stations?.length || 0,
      subtitle: "Active locations",
      icon: Building2,
      color: "text-blue-600",
    },
    {
      title: "Open Alerts",
      value: analytics?.openAlerts || 0,
      subtitle: `${analytics?.criticalAlerts || 0} critical`,
      icon: AlertCircle,
      color: "text-red-600",
    },
    {
      title: "Unpaid Bills",
      value: analytics?.unpaidBills || 0,
      subtitle: "Requires attention",
      icon: DollarSign,
      color: "text-orange-600",
    },
    {
      title: "Total Revenue",
      value: "Coming Soon",
      subtitle: "This month",
      icon: TrendingUp,
      color: "text-green-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold">Franchisee Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Pet Wash™ station network
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} data-testid={`card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="stations" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="stations" data-testid="tab-stations">
              <Building2 className="h-4 w-4 mr-2" />
              Stations
            </TabsTrigger>
            <TabsTrigger value="revenue" data-testid="tab-revenue">
              <DollarSign className="h-4 w-4 mr-2" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="maintenance" data-testid="tab-maintenance">
              <Wrench className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">
              <Package className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
          </TabsList>

          {/* Stations Tab */}
          <TabsContent value="stations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Stations</CardTitle>
                <CardDescription>
                  Overview of your {stations?.length || 0} Pet Wash™ locations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stations?.map((station: any) => (
                    <div
                      key={station.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`station-${station.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${healthStatusStyles[station.healthStatus as keyof typeof healthStatusStyles] || healthStatusStyles.offline}`}>
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold">{station.stationName}</p>
                          <p className="text-sm text-muted-foreground">
                            {station.address}, {station.city}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Code: {station.stationCode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge variant={station.operationalStatus === 'active' ? 'default' : 'secondary'}>
                            {station.operationalStatus}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {station.totalWashesCompleted || 0} total washes
                          </p>
                        </div>
                        <Button variant="outline" size="sm" data-testid={`button-view-station-${station.id}`}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!stations || stations.length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No stations found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue & Payments</CardTitle>
                <CardDescription>Financial performance overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Revenue Dashboard Coming Soon</p>
                  <p className="text-sm text-muted-foreground">
                    Track earnings, royalties, and payment history
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Station Maintenance</CardTitle>
                <CardDescription>Work orders and service requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="font-semibold">Pending</span>
                      </div>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold">In Progress</span>
                      </div>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">Completed</span>
                      </div>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory & Spare Parts</CardTitle>
                <CardDescription>Track supplies across your stations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Inventory System Coming Soon</p>
                  <p className="text-sm text-muted-foreground">
                    Monitor stock levels and order supplies
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Customers</CardTitle>
                <CardDescription>Recurring revenue members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-semibold">Customer Portal Coming Soon</p>
                  <p className="text-sm text-muted-foreground">
                    View subscriber analytics and retention metrics
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
