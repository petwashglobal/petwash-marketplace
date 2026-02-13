import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle, Activity, Database, Clock, MapPin } from 'lucide-react';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';

interface UptimeStatus {
  ok: boolean;
  service: string;
  environment: string;
  timestamp: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  health: {
    database: string;
    dbLatencyMs: number;
    responseTimeMs: number;
  };
  stations: {
    total: number;
    operational: number;
    health: {
      healthy: number;
      warning: number;
      critical: number;
      offline: number;
    };
    healthPercentage: number;
  };
  alerts: {
    criticalUnacknowledged: number;
  };
}

interface StationStatus {
  ok: boolean;
  timestamp: string;
  summary: {
    total: number;
    online: number;
    offline: number;
    healthBreakdown: {
      healthy: number;
      warning: number;
      critical: number;
      offline: number;
    };
    maintenanceDue: number;
  };
  stations: Array<{
    id: number;
    stationCode: string;
    stationName: string;
    city: string;
    healthStatus: string;
    operationalStatus: string;
    isOnline: boolean;
    minutesSinceHeartbeat: number | null;
    totalWashesCompleted: number;
  }>;
}

export default function StatusDashboard() {
  const { data: uptimeData, isLoading: uptimeLoading } = useQuery<UptimeStatus>({
    queryKey: ['/status/uptime'],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: stationsData, isLoading: stationsLoading } = useQuery<StationStatus>({
    queryKey: ['/status/stations'],
    refetchInterval: 60000, // Refresh every minute
  });

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="luxury-badge bg-green-500 animate-pulse"><CheckCircle2 className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case 'warning':
        return <Badge className="luxury-badge bg-yellow-500 animate-pulse"><AlertCircle className="w-3 h-3 mr-1" /> Warning</Badge>;
      case 'critical':
        return <Badge className="luxury-badge bg-red-500 animate-pulse"><XCircle className="w-3 h-3 mr-1" /> Critical</Badge>;
      case 'offline':
        return <Badge className="luxury-badge bg-gray-500"><XCircle className="w-3 h-3 mr-1" /> Offline</Badge>;
      default:
        return <Badge className="luxury-badge" variant="outline">{status}</Badge>;
    }
  };

  if (uptimeLoading || stationsLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="⁦Pet Wash™⁩ System Status"
      subtitle="Real-time platform health monitoring"
      icon={<Activity className="w-8 h-8 text-purple-600" />}
    >
      <div className="min-h-screen luxury-bg-mesh p-6">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
        {/* Header */}
        <div className="text-center space-y-2">
          {uptimeData && (
            <p className="text-sm text-gray-500">
              Last updated: {new Date(uptimeData.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Overall Status Card */}
        {uptimeData && (
          <Card className="luxury-glass-card luxury-shadow-lg animate-in slide-in-from-top duration-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {uptimeData.ok ? (
                  <div className="p-2 rounded-full bg-green-100">
                    <CheckCircle2 className="w-6 h-6 text-green-600 animate-pulse" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-red-100">
                    <XCircle className="w-6 h-6 text-red-600 animate-pulse" />
                  </div>
                )}
                {uptimeData.service}
              </CardTitle>
              <CardDescription>
                Environment: {uptimeData.environment} • Uptime: {uptimeData.uptime.formatted}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="luxury-grid-3 gap-4">
                {/* Database Health */}
                <div className="luxury-glass-minimal p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold">Database</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {uptimeData.health.database}
                  </p>
                  <p className="text-sm text-gray-600">
                    Latency: {uptimeData.health.dbLatencyMs}ms
                  </p>
                </div>

                {/* Station Health */}
                <div className="luxury-glass-minimal p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold">Station Health</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {uptimeData.stations.healthPercentage}%
                  </p>
                  <p className="text-sm text-gray-600">
                    {uptimeData.stations.health.healthy}/{uptimeData.stations.total} healthy
                  </p>
                </div>

                {/* Critical Alerts */}
                <div className="luxury-glass-minimal p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold">Critical Alerts</h3>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">
                    {uptimeData.alerts.criticalUnacknowledged}
                  </p>
                  <p className="text-sm text-gray-600">
                    Unacknowledged (24h)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Station Status Breakdown */}
        {stationsData && (
          <div className="luxury-grid-4 gap-4 animate-in slide-in-from-bottom duration-700 delay-100">
            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Stations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold luxury-text-gradient">{stationsData.summary.total}</div>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Online</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stationsData.summary.online}
                </div>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Offline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {stationsData.summary.offline}
                </div>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card luxury-shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Maintenance Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {stationsData.summary.maintenanceDue}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Individual Station Status */}
        {stationsData && (
          <Card className="luxury-glass-card luxury-shadow-lg animate-in slide-in-from-bottom duration-700 delay-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                Station Details
              </CardTitle>
              <CardDescription>
                Real-time status of all Pet Wash stations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stationsData.stations.map((station, index) => (
                  <div
                    key={station.id}
                    className="luxury-glass-minimal luxury-hover-lift p-4 rounded-lg transition-all duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{station.stationName}</h4>
                        {getHealthBadge(station.healthStatus)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {station.stationCode} • {station.city}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {station.isOnline ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last heartbeat: {station.minutesSinceHeartbeat}m ago
                          </span>
                        ) : (
                          <Badge className="luxury-badge bg-red-500 animate-pulse">OFFLINE</Badge>
                        )}
                        <span>{station.totalWashesCompleted} total washes</span>
                      </div>
                    </div>
                    <div className="text-right mt-2">
                      <Badge className="luxury-badge" variant={station.isOnline ? "default" : "destructive"}>
                        {station.operationalStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pb-6">
          <p>⁦PetWash™⁩ Enterprise Platform • Powered by Replit</p>
          <p className="mt-1">
            Monitoring infrastructure for petwash.co.il (Israel) and future petwash.app (Global)
          </p>
        </div>
      </div>
    </div>
    </LuxuryPageWrapper>
  );
}
