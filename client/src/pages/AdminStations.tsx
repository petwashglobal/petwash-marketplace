import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { getApiUrl } from '@/lib/apiConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { StationSheet } from "@/components/StationSheet";
import { useLanguage } from "@/lib/languageStore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
  Phone,
  Mail,
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

type TabType = "list" | "alerts" | "health" | "score";

// ── Station Health Score (§2) + Bay Intelligence (§3) ───────────────────────
interface BayIntel {
  bayId: string;
  side: string;
  label: string | null;
  labelHe: string | null;
  status: string;
  downtime: boolean;
  washes: number;
  attempts: number;
  failedSessions: number;
  revenueIls: number;
  nayaxPayments: number;
  qrRedemptions: number;
  openFaults: number;
  openFaultsBySeverity: { critical: number; error: number; warning: number };
  shampooLevelPct: number | null;
  conditionerLevelPct: number | null;
  lastWashAt: string | null;
  lastFaultAt: string | null;
  lastHeartbeat: string | null;
}
interface StationHealth {
  stationId: string;
  stationCode: string | null;
  name: string;
  nameHe: string | null;
  stationStatus: string | null;
  score: number;
  band: "excellent" | "healthy" | "attention" | "critical";
  bayCount: number;
  factors: {
    revenueTodayIls: number;
    washesToday: number;
    openFaults: number;
    lastMaintenanceDate: string | null;
    daysSinceMaintenance: number | null;
    [k: string]: any;
  };
  usedFactors: string[];
  unavailableFactors: string[];
  bays: BayIntel[];
}
interface StationHealthResponse {
  wired: boolean;
  generatedAt: string;
  stationCount: number;
  unavailableFactors: string[];
  factorErrors: string[];
  bands?: Record<string, string>;
  stations: StationHealth[];
  note?: string;
}

export default function AdminStations() {
  const { language, dir } = useLanguage();
  const isHe = language === "he";
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState<TabType>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toast } = useToast();

  const { data: rawStationsData, isLoading: stationsLoading } = useQuery<{ stations: Station[] }>({
    queryKey: ['/api/admin/stations'],
    enabled: selectedTab === "list",
  });

  const stationsData = rawStationsData ? {
    stations: (rawStationsData.stations || []).filter((s: Station) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name?.toLowerCase().includes(q) && !s.serialNumber?.toLowerCase().includes(q) && !s.address?.line1?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (cityFilter !== "all" && s.address?.city !== cityFilter) return false;
      return true;
    })
  } : undefined;

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

  // Station Health Score (§2) + Bay Intelligence (§3) — read-only.
  const { data: scoreData, isLoading: scoreLoading } = useQuery<StationHealthResponse>({
    queryKey: ['/api/admin/station-health'],
    enabled: selectedTab === "score",
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    try {
      await fetch(getApiUrl('/api/admin/logout'), { method: 'POST' });
      setLocation('/admin/login');
    } catch (error) {
      logger.error('Logout error', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const luxuryClass: Record<string, string> = {
      active: "luxury-badge-success",
      installing: "luxury-badge",
      planned: "luxury-badge",
      paused: "luxury-badge-gold",
      decommissioned: "luxury-badge bg-red-50 text-red-600 border-red-200",
    };

    const dotColor: Record<string, string> = {
      active: "bg-green-500",
      installing: "bg-blue-500",
      planned: "bg-gray-500",
      paused: "bg-yellow-500",
      decommissioned: "bg-red-500",
    };

    return (
      <span className={`${luxuryClass[status] || luxuryClass.planned} flex items-center gap-1`}>
        <div className={`w-2 h-2 rounded-full ${dotColor[status] || dotColor.planned}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const luxuryClass: Record<string, string> = {
      critical: "luxury-badge bg-red-50 text-red-600 border-red-200",
      high: "luxury-badge-gold",
      medium: "luxury-badge",
    };

    const icons: Record<string, any> = {
      critical: XCircle,
      high: AlertTriangle,
      medium: AlertCircle,
    };

    const Icon = icons[severity] || icons.medium;

    return (
      <span className={`${luxuryClass[severity] || luxuryClass.medium} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  const uniqueCities = Array.from(new Set((rawStationsData?.stations || []).map(s => s.address.city))).sort();

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Header */}
      <header className="luxury-glass-panel luxury-shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 luxury-animate-fade-in">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="luxury-heading-lg luxury-text-gradient">Stations Management</h1>
                <p className="luxury-text-small">Registry, Inventory & Alerts</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button className="luxury-btn-ghost" onClick={() => setLocation('/admin/dashboard')}>
                <Shield className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button className="luxury-btn-ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="luxury-glass-panel border-0 luxury-shadow-sm luxury-animate-fade-in luxury-delay-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'list', label: isHe ? 'רשימת תחנות' : 'Stations List', icon: MapPin },
              { id: 'alerts', label: isHe ? 'התראות' : 'Alerts', icon: AlertTriangle, badge: alertsData?.summary.totalAlerts },
              { id: 'health', label: isHe ? 'סקירת בריאות' : 'Health Overview', icon: Activity },
              { id: 'score', label: isHe ? 'ציון בריאות ועמדות' : 'Health Score & Bays', icon: Zap },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as TabType)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-semibold transition-all relative ${
                    selectedTab === tab.id
                      ? 'border-purple-600 luxury-text-gradient'
                      : 'border-transparent text-slate-500 hover:text-purple-600 hover:border-purple-300'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="luxury-badge bg-red-50 text-red-600 border-red-200 ml-2 px-2 py-0.5 text-xs">
                      {tab.badge}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="luxury-container py-8">
        {/* Stations List Tab */}
        {selectedTab === "list" && (
          <div className="space-y-6">
            {/* Filters and Search */}
            <div className="luxury-glass-panel luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
              <div className="mb-6">
                <h2 className="luxury-heading-sm luxury-text-gradient">Stations Registry</h2>
                <p className="luxury-text-small mt-1">Search and filter all ⁦Pet Wash™⁩ stations</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      placeholder="Search by serial number or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="luxury-glass-minimal w-full pl-10 pr-4 py-3 outline-none focus:border-purple-300 transition-all"
                      data-testid="input-search-stations"
                    />
                  </div>
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={`w-[180px] ${statusFilter === 'all' ? 'luxury-glass-minimal' : 'luxury-btn-secondary'}`} data-testid="select-status-filter">
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
                  <SelectTrigger className={`w-[180px] ${cityFilter === 'all' ? 'luxury-glass-minimal' : 'luxury-btn-secondary'}`} data-testid="select-city-filter">
                    <SelectValue placeholder="Filter by city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {uniqueCities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  className="luxury-btn-primary ml-auto"
                  data-testid="button-add-station"
                  onClick={() => setLocation('/admin/station-registry')}
                >
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Add Station
                </Button>
              </div>
            </div>

            {/* Stations Grid */}
            {stationsLoading ? (
              <div className="luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-fade-in luxury-delay-3">
                <div className="luxury-spinner mx-auto mb-4" />
                <p className="luxury-text-body">Loading stations...</p>
              </div>
            ) : stationsData?.stations.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-fade-in luxury-delay-3">
                <MapPin className="w-16 h-16 mx-auto mb-4 text-purple-300" />
                <p className="luxury-heading-sm mb-2">No stations found</p>
                <p className="luxury-text-small">Try adjusting your filters or add a new station</p>
              </div>
            ) : (
              <div className="luxury-grid-3">
                {stationsData?.stations.map((station, index) => (
                  <div
                    key={station.id}
                    className={`luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-${Math.min(index % 6 + 3, 5)}`}
                    data-testid={`card-station-${station.id}`}
                  >
                    {/* Station Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="luxury-heading-sm mb-1">{station.name}</h3>
                          <span className="luxury-badge inline-flex">
                            <Package className="w-3 h-3 mr-1" />
                            {station.brand || 'K9000'}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(station.status)}
                    </div>

                    <div className="luxury-divider my-4" />

                    {/* Station Details */}
                    <div className="space-y-3 mb-4">
                      {/* Serial Number */}
                      <div>
                        <div className="luxury-text-small text-gray-500 mb-1">Serial Number</div>
                        <div className="font-mono font-bold luxury-text-gradient">
                          {station.serialNumber}
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <div className="luxury-text-small text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Location
                        </div>
                        <div className="luxury-text-small font-semibold">{station.address.city}</div>
                        <div className="luxury-text-small text-gray-600">{station.address.line1}</div>
                        {station.address.postcode && (
                          <div className="luxury-text-small text-gray-500 font-mono">
                            {station.address.postcode}
                          </div>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div>
                        <div className="luxury-text-small text-gray-500 mb-1">Contact</div>
                        {station.utilities?.council?.contactPhone ? (
                          <div className="flex items-center gap-2 luxury-text-small mb-1">
                            <Phone className="w-3 h-3 text-green-500" />
                            <span className="font-medium">{station.utilities.council.contactPhone}</span>
                          </div>
                        ) : (
                          <div className="luxury-text-small text-gray-400 italic">No phone</div>
                        )}
                        {station.utilities?.council?.contactEmail ? (
                          <div className="flex items-center gap-2 luxury-text-small truncate">
                            <Mail className="w-3 h-3 text-blue-500" />
                            <span className="truncate">{station.utilities.council.contactEmail}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Stock Status */}
                      <div>
                        <div className="luxury-text-small text-gray-500 mb-1 flex items-center gap-1">
                          <Droplet className="w-3 h-3" />
                          Inventory
                        </div>
                        <div className="luxury-text-small font-semibold text-green-600">
                          Stock Ready
                        </div>
                      </div>
                    </div>

                    <div className="luxury-divider my-4" />

                    {/* Actions */}
                    <Button
                      onClick={() => {
                        setSelectedStationId(station.id);
                        setSheetOpen(true);
                      }}
                      className="luxury-btn-primary w-full"
                      data-testid={`button-view-station-${station.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2 inline" />
                      View Full Details
                    </Button>
                    <Link href={`/admin/stations/${station.id}/timeline`}>
                      <Button variant="outline" className="w-full mt-2" size="sm">
                        <Calendar className="w-4 h-4 mr-2 inline" />
                        Station Timeline
                      </Button>
                    </Link>
                    <Link href={`/admin/stations/${station.id}/bays`}>
                      <Button variant="outline" className="w-full mt-1" size="sm">
                        <Activity className="w-4 h-4 mr-2 inline" />
                        מפת עמדות חיה
                      </Button>
                    </Link>
                    <Link href={`/admin/stations/${station.id}/commands`}>
                      <Button variant="outline" className="w-full mt-1" size="sm">
                        <Zap className="w-4 h-4 mr-2 inline" />
                        יומן פקודות
                      </Button>
                    </Link>
                  </div>
                ))
                }
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {selectedTab === "alerts" && (
          <div className="space-y-6">
            {alertsLoading ? (
              <div className="luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-fade-in">
                <div className="luxury-spinner mx-auto mb-4" />
                <p className="luxury-text-body">Loading alerts...</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="luxury-grid-3">
                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Total Alerts</div>
                    <div className="luxury-heading-lg luxury-text-gradient">
                      {alertsData?.summary.totalAlerts || 0}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mb-4">
                      <XCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Critical Alerts</div>
                    <div className="text-3xl font-bold text-red-600">
                      {alertsData?.summary.critical || 0}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center mb-4">
                      <Droplet className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Low Stock Stations</div>
                    <div className="text-3xl font-bold text-orange-600">
                      {alertsData?.lowStockAlerts.length || 0}
                    </div>
                  </div>
                </div>

                {/* Low Stock Alerts */}
                <div className="luxury-glass-panel luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="luxury-heading-sm">Low Stock Alerts</h2>
                      <p className="luxury-text-small">Stations with inventory below minimum thresholds</p>
                    </div>
                  </div>
                  {alertsData?.lowStockAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                      <p className="luxury-text-body font-semibold">All stations have adequate inventory</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alertsData?.lowStockAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="luxury-glass-minimal p-4 border-l-4 border-orange-400"
                          data-testid={`alert-low-stock-${idx}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <Droplet className="w-5 h-5 text-orange-600" />
                                <div>
                                  <div className="luxury-text-body font-semibold">
                                    {alert.serialNumber} - {alert.city}
                                  </div>
                                  <div className="luxury-text-small">
                                    {alert.item.charAt(0).toUpperCase() + alert.item.slice(1)}: {alert.onHand}L (min: {alert.threshold}L)
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getSeverityBadge(alert.severity)}
                              <Button className="luxury-btn-secondary">
                                Resolve
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Renewal Alerts */}
                <div className="luxury-glass-panel luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="luxury-heading-sm">Utility Renewal Alerts</h2>
                      <p className="luxury-text-small">Insurance, electricity, and water renewals due within 30 days</p>
                    </div>
                  </div>
                  {alertsData?.renewalAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                      <p className="luxury-text-body font-semibold">No upcoming renewals</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alertsData?.renewalAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="luxury-glass-minimal p-4 border-l-4 border-blue-400"
                          data-testid={`alert-renewal-${idx}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                {alert.utilityType === 'insurance' && <Shield className="w-5 h-5 text-blue-600" />}
                                {alert.utilityType === 'electricity' && <Zap className="w-5 h-5 text-yellow-600" />}
                                {alert.utilityType === 'water' && <Droplet className="w-5 h-5 text-blue-600" />}
                                <div>
                                  <div className="luxury-text-body font-semibold">
                                    {alert.serialNumber} - {alert.city}
                                  </div>
                                  <div className="luxury-text-small">
                                    {alert.utilityType.charAt(0).toUpperCase() + alert.utilityType.slice(1)} renewal in {alert.daysUntilRenewal} days ({alert.provider})
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getSeverityBadge(alert.severity)}
                              <Button className="luxury-btn-secondary">
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Health Overview Tab */}
        {selectedTab === "health" && (
          <div className="space-y-6">
            {healthLoading ? (
              <div className="luxury-glass-card luxury-shadow-lg p-12 text-center luxury-animate-fade-in">
                <div className="luxury-spinner mx-auto mb-4" />
                <p className="luxury-text-body">Loading health data...</p>
              </div>
            ) : (
              <>
                {/* Summary Metrics */}
                <div className="luxury-grid-4">
                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Total Stations</div>
                    <div className="luxury-heading-lg luxury-text-gradient">
                      {healthData?.totalStations || 0}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Active Stations</div>
                    <div className="text-3xl font-bold text-green-600">
                      {healthData?.byStatus.active || 0}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center mb-4">
                      <Droplet className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Low Stock Stations</div>
                    <div className="text-3xl font-bold text-orange-600">
                      {healthData?.lowStockCount || 0}
                    </div>
                  </div>

                  <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div className="luxury-text-small text-gray-600 mb-2">Health Score</div>
                    <div className="text-3xl font-bold text-blue-600">
                      {healthData?.totalStations
                        ? Math.round((healthData.healthy / healthData.totalStations) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="luxury-glass-panel luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-5">
                  <div className="mb-6">
                    <h2 className="luxury-heading-sm luxury-text-gradient mb-2">Status Breakdown</h2>
                    <p className="luxury-text-small">Distribution of stations by operational status</p>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(healthData?.byStatus || {}).map(([status, count]) => (
                      <div key={status} className="luxury-glass-minimal p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {getStatusBadge(status)}
                            <span className="luxury-text-small font-semibold">
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </div>
                          <span className="luxury-text-body font-bold luxury-text-gradient">{count}</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${((count as number) / (healthData?.totalStations || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Health Score & Bay Intelligence Tab (§2 + §3) */}
        {selectedTab === "score" && (
          <div className="space-y-6" dir={dir}>
            <div className="luxury-glass-panel luxury-shadow-lg p-6 luxury-animate-fade-in">
              <h2 className="luxury-heading-sm" style={{ color: "#000" }}>
                {isHe ? "ציון בריאות תחנה ומודיעין עמדות" : "Station Health Score & Bay Intelligence"}
              </h2>
              <p className="luxury-text-small mt-1">
                {isHe
                  ? "ציון 0–100 מחושב רק מנתונים אמיתיים. גורמים ללא טבלה מסומנים כ\"לא זמין\" ואינם משפיעים על הציון."
                  : "0–100 score computed only from real data. Factors with no backing table are marked unavailable and never move the score."}
              </p>
              {/* Band legend */}
              <div className="flex flex-wrap gap-3 mt-4">
                {([
                  ["excellent", "90–100", "#1a7f37"],
                  ["healthy", "70–89", "#B8860B"],
                  ["attention", "50–69", "#D4AF37"],
                  ["critical", "0–49", "#b42318"],
                ] as [string, string, string][]).map(([key, rng, col]) => (
                  <span key={key} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#000" }}>
                    <span className="w-3 h-3 rounded-full" style={{ background: col }} />
                    {(isHe
                      ? { excellent: "מצוין", healthy: "תקין", attention: "דורש תשומת לב", critical: "קריטי" }
                      : { excellent: "Excellent", healthy: "Healthy", attention: "Attention", critical: "Critical" })[key]}{" "}
                    <span className="text-gray-400">{rng}</span>
                  </span>
                ))}
              </div>
            </div>

            {scoreLoading ? (
              <div className="luxury-glass-card luxury-shadow-lg p-12 text-center">
                <div className="luxury-spinner mx-auto mb-4" />
                <p className="luxury-text-body">{isHe ? "טוען ציוני בריאות..." : "Loading health scores..."}</p>
              </div>
            ) : !scoreData || scoreData.stations.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg p-12 text-center">
                <Zap className="w-16 h-16 mx-auto mb-4" style={{ color: "#D4AF37" }} />
                <p className="luxury-heading-sm mb-2" style={{ color: "#000" }}>
                  {isHe ? "אין נתוני עמדות עדיין" : "No bay data yet"}
                </p>
                <p className="luxury-text-small">
                  {scoreData?.note ||
                    (isHe
                      ? "הציון מחושב מטבלאות העמדות. עד שיירשמו עמדות אין מה לדרג."
                      : "Health is computed from the bay tables. Until bays are registered there is nothing to score.")}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {scoreData.unavailableFactors.length > 0 && (
                  <p className="luxury-text-small" style={{ color: "#6b7280" }}>
                    {isHe ? "גורמים שאינם זמינים (לא מומצאים): " : "Unavailable factors (not faked): "}
                    {scoreData.unavailableFactors.join(", ")}
                  </p>
                )}
                {scoreData.stations.map((st) => {
                  const bandColor = { excellent: "#1a7f37", healthy: "#B8860B", attention: "#D4AF37", critical: "#b42318" }[st.band];
                  const chartData = st.bays.map((b) => ({
                    name: (isHe ? { left: "שמאל", right: "ימין" } : { left: "Left", right: "Right" })[b.side] || b.side,
                    [isHe ? "שטיפות" : "Washes"]: b.washes,
                    [isHe ? "QR" : "QR"]: b.qrRedemptions,
                    [isHe ? "Nayax" : "Nayax"]: b.nayaxPayments,
                    [isHe ? "נכשלו" : "Failed"]: b.failedSessions,
                  }));
                  return (
                    <div
                      key={st.stationId}
                      className="luxury-glass-card luxury-shadow-lg p-6"
                      style={{ background: "#fff", borderTop: `3px solid ${bandColor}` }}
                      data-testid={`station-score-${st.stationId}`}
                    >
                      {/* Score header */}
                      <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
                        <div>
                          <h3 className="luxury-heading-sm" style={{ color: "#000" }}>
                            {isHe && st.nameHe ? st.nameHe : st.name}
                          </h3>
                          <p className="luxury-text-small">{st.stationCode || st.stationId}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-4xl font-bold" style={{ color: bandColor }}>{st.score}</div>
                            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: bandColor }}>
                              {(isHe
                                ? { excellent: "מצוין", healthy: "תקין", attention: "דורש תשומת לב", critical: "קריטי" }
                                : { excellent: "Excellent", healthy: "Healthy", attention: "Attention", critical: "Critical" })[st.band]}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* KPI strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {[
                          { lbl: isHe ? "הכנסה היום (₪)" : "Revenue today (₪)", val: st.factors.revenueTodayIls?.toFixed(2) ?? "0.00" },
                          { lbl: isHe ? "שטיפות היום" : "Washes today", val: st.factors.washesToday ?? 0 },
                          { lbl: isHe ? "תקלות פתוחות" : "Open faults", val: st.factors.openFaults ?? 0 },
                          { lbl: isHe ? "ימים מאז תחזוקה" : "Days since maint.", val: st.factors.daysSinceMaintenance ?? (isHe ? "לא ידוע" : "N/A") },
                        ].map((k, i) => (
                          <div key={i} className="rounded-lg p-3" style={{ background: "#faf7ef", border: "1px solid #efe6cf" }}>
                            <div className="text-xs" style={{ color: "#6b7280" }}>{k.lbl}</div>
                            <div className="text-lg font-bold" style={{ color: "#000" }}>{k.val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Left vs Right bay comparison chart */}
                      <h4 className="text-sm font-semibold mb-2" style={{ color: "#000" }}>
                        {isHe ? "השוואת עמדות: שמאל מול ימין (24 שעות)" : "Bay comparison: Left vs Right (last 24h)"}
                      </h4>
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer>
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fill: "#000", fontSize: 12 }} />
                            <YAxis tick={{ fill: "#000", fontSize: 12 }} allowDecimals={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey={isHe ? "שטיפות" : "Washes"} fill="#D4AF37" radius={[3, 3, 0, 0]} />
                            <Bar dataKey={isHe ? "QR" : "QR"} fill="#000000" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Nayax" fill="#8a6d1f" radius={[3, 3, 0, 0]} />
                            <Bar dataKey={isHe ? "נכשלו" : "Failed"} fill="#b42318" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Per-bay detail rows */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        {st.bays.map((b) => {
                          const sideLbl = (isHe ? { left: "עמדה שמאל", right: "עמדה ימין" } : { left: "Left bay", right: "Right bay" })[b.side] || b.side;
                          return (
                            <div key={b.bayId} className="rounded-lg p-4" style={{ background: "#fff", border: "1px solid #eee" }} data-testid={`bay-${b.bayId}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold" style={{ color: "#000" }}>{sideLbl}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: b.downtime ? "#fee" : "#eefbf0", color: b.downtime ? "#b42318" : "#1a7f37" }}>
                                  {b.downtime ? (isHe ? "מושבת" : "Downtime") : (isHe ? b.status : b.status)}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: "#374151" }}>
                                <span>{isHe ? "שטיפות" : "Washes"}: <b>{b.washes}</b></span>
                                <span>{isHe ? "הכנסה ₪" : "Revenue ₪"}: <b>{b.revenueIls.toFixed(2)}</b></span>
                                <span>Nayax: <b>{b.nayaxPayments}</b></span>
                                <span>QR: <b>{b.qrRedemptions}</b></span>
                                <span>{isHe ? "נכשלו" : "Failed"}: <b>{b.failedSessions}</b></span>
                                <span>{isHe ? "תקלות" : "Faults"}: <b>{b.openFaults}</b></span>
                                <span>{isHe ? "שטיפה אחרונה" : "Last wash"}: <b>{b.lastWashAt ? new Date(b.lastWashAt).toLocaleDateString() : "—"}</b></span>
                                <span>{isHe ? "תקלה אחרונה" : "Last fault"}: <b>{b.lastFaultAt ? new Date(b.lastFaultAt).toLocaleDateString() : "—"}</b></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Transparency: which factors fed the score */}
                      <p className="text-xs mt-4" style={{ color: "#9ca3af" }}>
                        {isHe ? "גורמים בשימוש: " : "Factors used: "}{st.usedFactors.join(", ") || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
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
