import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EnterpriseLayout } from "@/components/EnterpriseLayout";
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
  Filter
} from "lucide-react";

export default function EnterpriseHQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

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
      <EnterpriseLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading enterprise dashboard...</p>
          </div>
        </div>
      </EnterpriseLayout>
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
    <EnterpriseLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-2 text-gray-900">
              <Globe className="h-8 w-8 text-blue-600" />
              Global HQ Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Pet Wash™ 2026 Enterprise Command Center
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search stations, franchisees, assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-300"
                data-testid="input-search-global"
              />
            </div>
            <Button variant="outline" size="icon" className="border-gray-300 hover:bg-gray-50" data-testid="button-filter">
              <Filter className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} data-testid={`card-metric-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  {"active" in stat && (
                    <p className="text-xs text-muted-foreground">
                      {stat.active} active
                    </p>
                  )}
                  {"critical" in stat && stat.critical > 0 && (
                    <p className="text-xs text-red-600 font-medium">
                      {stat.critical} critical
                    </p>
                  )}
                  {"inProgress" in stat && (
                    <p className="text-xs text-muted-foreground">
                      {stat.inProgress} in progress
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="map" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="map" data-testid="tab-map">
              <MapPin className="h-4 w-4 mr-2" />
              Global Map
            </TabsTrigger>
            <TabsTrigger value="stations" data-testid="tab-stations">
              <Building2 className="h-4 w-4 mr-2" />
              Stations
            </TabsTrigger>
            <TabsTrigger value="franchisees" data-testid="tab-franchisees">
              <Users className="h-4 w-4 mr-2" />
              Franchisees
            </TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials">
              <DollarSign className="h-4 w-4 mr-2" />
              Financials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Station Network</CardTitle>
                <CardDescription>
                  Real-time status of {(stations as any[])?.length || 0} stations worldwide
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4 min-h-[500px] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <MapPin className="h-16 w-16 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-lg font-semibold">Interactive Map Coming Soon</p>
                      <p className="text-sm text-muted-foreground">
                        Integrated with Google Maps / Mapbox for real-time station visualization
                      </p>
                    </div>
                    
                    {/* Station List Preview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      {(stations as any[])?.slice(0, 8).map((station: any) => (
                        <div
                          key={station.id}
                          className="bg-background p-3 rounded-lg border text-left"
                          data-testid={`station-${station.id}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={`h-3 w-3 rounded-full ${healthStatusColor(
                                station.healthStatus
                              )}`}
                            />
                            <span className="text-xs font-medium truncate">
                              {station.stationCode}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {station.city}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Station Directory</CardTitle>
                <CardDescription>
                  Comprehensive list of all Pet Wash™ stations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(stations as any[])?.slice(0, 10).map((station: any) => (
                    <div
                      key={station.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`station-row-${station.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-10 w-10 rounded-full ${healthStatusColor(
                            station.healthStatus
                          )} flex items-center justify-center`}
                        >
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">{station.stationName}</p>
                          <p className="text-sm text-muted-foreground">
                            {station.stationCode} • {station.city}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={station.operationalStatus === 'active' ? 'default' : 'secondary'}>
                          {station.operationalStatus}
                        </Badge>
                        <Button variant="outline" size="sm" data-testid={`button-view-station-${station.id}`}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="franchisees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Franchise Partners</CardTitle>
                <CardDescription>
                  Manage {(franchisees as any[])?.length || 0} franchise relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(franchisees as any[])?.slice(0, 10).map((franchisee: any) => (
                    <div
                      key={franchisee.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`franchisee-row-${franchisee.id}`}
                    >
                      <div>
                        <p className="font-semibold">{franchisee.companyName}</p>
                        <p className="text-sm text-muted-foreground">
                          {franchisee.contactFirstName} {franchisee.contactLastName} • {franchisee.totalStations} stations
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={franchisee.status === 'active' ? 'default' : 'secondary'}>
                          {franchisee.status}
                        </Badge>
                        <Button variant="outline" size="sm" data-testid={`button-view-franchisee-${franchisee.id}`}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Unpaid Bills</CardTitle>
                  <CardDescription>Outstanding station expenses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold">
                        {analyticsData?.bills?.totalUnpaid || 0}
                      </span>
                      <Badge variant="destructive">
                        {analyticsData?.bills?.totalOverdue || 0} overdue
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total Amount: {analyticsData?.bills?.totalAmount || '0.00'} ILS
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                  <CardDescription>Global network performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold">Coming Soon</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Real-time revenue tracking and analytics
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EnterpriseLayout>
  );
}
