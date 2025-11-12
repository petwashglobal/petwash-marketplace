import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle, Activity, Database, Clock, MapPin } from 'lucide-react';

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
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" /> Warning</Badge>;
      case 'critical':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Critical</Badge>;
      case 'offline':
        return <Badge className="bg-gray-500"><XCircle className="w-3 h-3 mr-1" /> Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (uptimeLoading || stationsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            PetWash™ System Status
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time platform health and station monitoring
          </p>
          {uptimeData && (
            <p className="text-sm text-gray-500">
              Last updated: {new Date(uptimeData.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Overall Status Card */}
        {uptimeData && (
          <Card className="border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {uptimeData.ok ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
                {uptimeData.service}
              </CardTitle>
              <CardDescription>
                Environment: {uptimeData.environment} • Uptime: {uptimeData.uptime.formatted}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Database Health */}
                <div className="p-4 bg-blue-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold">Database</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {uptimeData.health.database}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Latency: {uptimeData.health.dbLatencyMs}ms
                  </p>
                </div>

                {/* Station Health */}
                <div className="p-4 bg-green-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold">Station Health</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {uptimeData.stations.healthPercentage}%
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {uptimeData.stations.health.healthy}/{uptimeData.stations.total} healthy
                  </p>
                </div>

                {/* Critical Alerts */}
                <div className="p-4 bg-orange-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold">Critical Alerts</h3>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">
                    {uptimeData.alerts.criticalUnacknowledged}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Unacknowledged (24h)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Station Status Breakdown */}
        {stationsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Stations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stationsData.summary.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Online</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stationsData.summary.online}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Offline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {stationsData.summary.offline}
                </div>
              </CardContent>
            </Card>

            <Card>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Station Details
              </CardTitle>
              <CardDescription>
                Real-time status of all Pet Wash stations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stationsData.stations.map((station) => (
                  <div
                    key={station.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{station.stationName}</h4>
                        {getHealthBadge(station.healthStatus)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {station.stationCode} • {station.city}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {station.isOnline ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last heartbeat: {station.minutesSinceHeartbeat}m ago
                          </span>
                        ) : (
                          <span className="text-red-600 font-semibold">OFFLINE</span>
                        )}
                        <span>{station.totalWashesCompleted} total washes</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={station.isOnline ? "default" : "destructive"}>
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
          <p>PetWash™ Enterprise Platform • Powered by Replit</p>
          <p className="mt-1">
            Monitoring infrastructure for petwash.co.il (Israel) and future petwash.app (Global)
          </p>
        </div>
      </div>
    </div>
  );
}
