import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { StationSheet } from "@/components/StationSheet";
import {
  MapPin,
  Package,
  AlertTriangle,
  Activity,
  LogOut,
  Settings,
  Shield,
  Search,
  Plus,
  Eye,
  Calendar,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Droplet,
  Zap,
  FileText,
} from "lucide-react";

interface Station {
  id: string;
  serialNumber: string;
  name: string;
  brand: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  status: "planned" | "installing" | "active" | "paused" | "decommissioned";
  openedAt?: Date;
  utilities?: {
    insurance?: any;
    electricity?: any;
    water?: any;
  };
  thresholds?: {
    minStock: {
      shampoo: number;
      conditioner: number;
      disinfectant: number;
      fragrance: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

interface Alert {
  stationId: string;
  serialNumber: string;
  city: string;
  severity: "critical" | "high" | "medium";
}

interface LowStockAlert extends Alert {
  item: string;
  onHand: number;
  threshold: number;
}

interface RenewalAlert extends Alert {
  utilityType: string;
  provider: string;
  renewalDate: string;
  daysUntilRenewal: number;
}

type TabType = "list" | "alerts" | "health";

export default function AdminStations() {
  const [selectedTab, setSelectedTab] = useState<TabType>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toast } = useToast();

  // Fetch stations list
  const { data: stationsData, isLoading: stationsLoading } = useQuery<{ stations: Station[] }>({
    queryKey: ['/api/admin/stations', { search: searchQuery, status: statusFilter !== "all" ? statusFilter : undefined, city: cityFilter !== "all" ? cityFilter : undefined }],
    enabled: selectedTab === "list",
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery<{
    lowStockAlerts: LowStockAlert[];
    renewalAlerts: RenewalAlert[];
    summary: { totalAlerts: number; critical: number };
  }>({
    queryKey: ['/api/admin/alerts/pending'],
    enabled: selectedTab === "alerts",
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch health stats
  const { data: healthData, isLoading: healthLoading } = useQuery<{
    totalStations: number;
    byStatus: Record<string, number>;
    lowStockCount: number;
    healthy: number;
  }>({
    queryKey: ['/api/admin/health/stations'],
    enabled: selectedTab === "health",
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", color: string }> = {
      active: { variant: "default", color: "bg-green-500" },
      installing: { variant: "secondary", color: "bg-blue-500" },
      planned: { variant: "outline", color: "bg-gray-500" },
      paused: { variant: "secondary", color: "bg-yellow-500" },
      decommissioned: { variant: "destructive", color: "bg-red-500" },
    };

    const config = variants[status] || variants.planned;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive", icon: any }> = {
      critical: { variant: "destructive", icon: XCircle },
      high: { variant: "secondary", icon: AlertTriangle },
      medium: { variant: "outline" as any, icon: AlertCircle },
    };

    const config = variants[severity] || variants.medium;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Badge>
    );
  };

  const uniqueCities = Array.from(new Set((stationsData?.stations || []).map(s => s.address.city))).sort();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Stations Management</h1>
                <p className="text-sm text-slate-600">Registry, Inventory & Alerts</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => window.location.href = '/admin/dashboard'}>
                <Shield className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'list', label: 'Stations List', icon: MapPin },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: alertsData?.summary.totalAlerts },
              { id: 'health', label: 'Health Overview', icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as TabType)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 text-sm font-medium transition-colors relative ${
                    selectedTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {tab.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stations List Tab */}
        {selectedTab === "list" && (
          <div className="space-y-6">
            {/* Filters and Search */}
            <Card>
              <CardHeader>
                <CardTitle>Stations Registry</CardTitle>
                <CardDescription>Search and filter all Pet Wash™ stations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[250px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search by serial number or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-stations"
                      />
                    </div>
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="installing">Installing</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="decommissioned">Decommissioned</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-city-filter">
                      <SelectValue placeholder="Filter by city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {uniqueCities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button className="ml-auto" data-testid="button-add-station">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Station
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stations Table */}
            {stationsLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading stations...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-slate-50 to-blue-50 border-b-2 border-blue-200">
                        <tr>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Station ID</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Serial #</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Name & Brand</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Location</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Contact Info</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Stock Levels</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Status</th>
                          <th className="text-left py-4 px-4 font-bold text-sm text-slate-800">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {stationsData?.stations.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-500">
                              <MapPin className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                              <p className="text-lg font-medium">No stations found</p>
                              <p className="text-sm">Try adjusting your filters or add a new station</p>
                            </td>
                          </tr>
                        ) : (
                          stationsData?.stations.map((station) => (
                            <tr key={station.id} className="hover:bg-blue-50/50 transition-all border-b border-slate-100">
                              {/* Station ID */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                                    <MapPin className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                    {station.id.substring(0, 8)}...
                                  </span>
                                </div>
                              </td>
                              
                              {/* Serial Number */}
                              <td className="py-4 px-4">
                                <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                  {station.serialNumber}
                                </span>
                              </td>
                              
                              {/* Name & Brand */}
                              <td className="py-4 px-4">
                                <div>
                                  <div className="font-bold text-slate-900">{station.name}</div>
                                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    {station.brand || 'K9000'}
                                  </div>
                                </div>
                              </td>
                              
                              {/* Location */}
                              <td className="py-4 px-4">
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-800 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-blue-500" />
                                    {station.address.city}
                                  </div>
                                  <div className="text-xs text-slate-600 truncate max-w-[180px]">
                                    {station.address.line1}
                                  </div>
                                  {station.address.postcode && (
                                    <div className="text-xs text-slate-500 font-mono">
                                      {station.address.postcode}
                                    </div>
                                  )}
                                </div>
                              </td>
                              
                              {/* Contact Info */}
                              <td className="py-4 px-4">
                                <div className="space-y-1 text-xs">
                                  {station.utilities?.council?.contactPhone ? (
                                    <div className="flex items-center gap-1 text-slate-700">
                                      <Phone className="w-3 h-3 text-green-500" />
                                      <span className="font-medium">{station.utilities.council.contactPhone}</span>
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 italic">No phone</div>
                                  )}
                                  {station.utilities?.council?.contactEmail ? (
                                    <div className="flex items-center gap-1 text-slate-600 truncate max-w-[150px]">
                                      <Mail className="w-3 h-3 text-blue-500" />
                                      <span>{station.utilities.council.contactEmail}</span>
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 italic">No email</div>
                                  )}
                                </div>
                              </td>
                              
                              {/* Stock Levels */}
                              <td className="py-4 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Droplet className="w-3 h-3 text-blue-500" />
                                    <span className="text-xs font-semibold text-slate-700">Stock Ready</span>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Click to view levels
                                  </div>
                                </div>
                              </td>
                              
                              {/* Status */}
                              <td className="py-4 px-4">
                                {getStatusBadge(station.status)}
                              </td>
                              
                              {/* Actions */}
                              <td className="py-4 px-4">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStationId(station.id);
                                    setSheetOpen(true);
                                  }}
                                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md"
                                  data-testid={`button-view-station-${station.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View Full
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {selectedTab === "alerts" && (
          <div className="space-y-6">
            {alertsLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading alerts...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Total Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-slate-900">
                        {alertsData?.summary.totalAlerts || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Critical Alerts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">
                        {alertsData?.summary.critical || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Low Stock Stations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600">
                        {alertsData?.lowStockAlerts.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Low Stock Alerts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                      Low Stock Alerts
                    </CardTitle>
                    <CardDescription>Stations with inventory below minimum thresholds</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {alertsData?.lowStockAlerts.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <p className="font-medium">All stations have adequate inventory</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {alertsData?.lowStockAlerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg"
                            data-testid={`alert-low-stock-${idx}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <Droplet className="w-5 h-5 text-orange-600" />
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {alert.serialNumber} - {alert.city}
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    {alert.item.charAt(0).toUpperCase() + alert.item.slice(1)}: {alert.onHand}L (min: {alert.threshold}L)
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getSeverityBadge(alert.severity)}
                              <Button variant="outline" size="sm">
                                Resolve
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Renewal Alerts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      Utility Renewal Alerts
                    </CardTitle>
                    <CardDescription>Insurance, electricity, and water renewals due within 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {alertsData?.renewalAlerts.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <p className="font-medium">No upcoming renewals</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {alertsData?.renewalAlerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg"
                            data-testid={`alert-renewal-${idx}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                {alert.utilityType === 'insurance' && <Shield className="w-5 h-5 text-blue-600" />}
                                {alert.utilityType === 'electricity' && <Zap className="w-5 h-5 text-yellow-600" />}
                                {alert.utilityType === 'water' && <Droplet className="w-5 h-5 text-blue-600" />}
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {alert.serialNumber} - {alert.city}
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    {alert.utilityType.charAt(0).toUpperCase() + alert.utilityType.slice(1)} renewal in {alert.daysUntilRenewal} days ({alert.provider})
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getSeverityBadge(alert.severity)}
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Health Overview Tab */}
        {selectedTab === "health" && (
          <div className="space-y-6">
            {healthLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading health data...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Total Stations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-slate-900">
                        {healthData?.totalStations || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Active Stations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">
                        {healthData?.byStatus.active || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Low Stock Stations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600">
                        {healthData?.lowStockCount || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-slate-600">Health Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600">
                        {healthData?.totalStations
                          ? Math.round((healthData.healthy / healthData.totalStations) * 100)
                          : 0}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Status Breakdown</CardTitle>
                    <CardDescription>Distribution of stations by operational status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(healthData?.byStatus || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusBadge(status)}
                            <span className="text-sm text-slate-600">
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-64 bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${((count as number) / (healthData?.totalStations || 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="font-semibold text-slate-900 w-12 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </main>

      {/* Station Detail Sheet */}
      <StationSheet
        stationId={selectedStationId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
