import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Server, 
  TrendingUp,
  Zap,
  BarChart3,
  Users,
  Target
} from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface OpsDashboardProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function OpsDashboard({ language, onLanguageChange }: OpsDashboardProps) {
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const { data: metricsData, isLoading: metricsLoading } = useQuery<any>({
    queryKey: ['/health/metrics-summary'],
    refetchInterval: refreshInterval,
  });

  const { data: syntheticData, isLoading: syntheticLoading } = useQuery<any>({
    queryKey: ['/api/synthetic/auth-check'],
    refetchInterval: refreshInterval,
  });

  const { data: analyticsStatus } = useQuery<any>({
    queryKey: ['/api/analytics/status'],
  });

  const { data: funnelMetrics } = useQuery<any>({
    queryKey: ['/api/analytics/funnel'],
    refetchInterval: refreshInterval,
    enabled: analyticsStatus?.ga4?.configured && analyticsStatus?.bigquery?.configured,
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; icon: any }> = {
      pass: { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
      healthy: { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
      degraded: { variant: 'destructive', icon: <AlertTriangle className="w-3 h-3" /> },
      error: { variant: 'destructive', icon: <AlertTriangle className="w-3 h-3" /> },
      fail: { variant: 'destructive', icon: <AlertTriangle className="w-3 h-3" /> },
    };

    const config = statusMap[status?.toLowerCase()] || { variant: 'secondary', icon: <Activity className="w-3 h-3" /> };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const formatLatency = (ms: number) => {
    if (ms < 100) return <span className="text-green-500 font-semibold">{ms}ms</span>;
    if (ms < 300) return <span className="text-yellow-500 font-semibold">{ms}ms</span>;
    return <span className="text-red-500 font-semibold">{ms}ms</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950">
      <Header language={language} onLanguageChange={onLanguageChange || (() => {})} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Operations Dashboard</h1>
          <p className="text-zinc-400">Real-time monitoring and health checks for Pet Wash™</p>
          
          <div className="mt-4 flex gap-2 items-center">
            <label className="text-sm text-zinc-400">Refresh:</label>
            <select 
              value={refreshInterval} 
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-zinc-800 border-zinc-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="5000">5s</option>
              <option value="10000">10s</option>
              <option value="30000">30s</option>
              <option value="60000">1min</option>
            </select>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-zinc-800">
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-zinc-800">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Auth Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metricsData?.metrics?.auth ? 
                  `${((metricsData.metrics.auth.total_success / (metricsData.metrics.auth.total_success + metricsData.metrics.auth.total_errors || 1)) * 100).toFixed(1)}%` : 
                  '—'
                }
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {metricsData?.metrics?.auth?.total_success || 0} successful / {metricsData?.metrics?.auth?.total_errors || 0} errors
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Auth Latency (avg)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metricsData?.metrics?.auth?.avg_latency_ms ? 
                  formatLatency(Math.round(metricsData.metrics.auth.avg_latency_ms)) : 
                  '—'
                }
              </div>
              <p className="text-xs text-zinc-500 mt-1">Target: &lt;300ms</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Server className="w-4 h-4" />
                HTTP Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metricsData?.metrics?.http?.total_requests?.toLocaleString() || '—'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Avg: {metricsData?.metrics?.http?.avg_duration_ms ? `${Math.round(metricsData.metrics.http.avg_duration_ms)}ms` : '—'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Firestore Ops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metricsData?.metrics?.firestore?.total_operations?.toLocaleString() || '—'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Avg: {metricsData?.metrics?.firestore?.avg_latency_ms ? `${Math.round(metricsData.metrics.firestore.avg_latency_ms)}ms` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Synthetic Checks
              </CardTitle>
              <CardDescription>Automated health monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              {syntheticLoading ? (
                <div className="text-zinc-400">Loading...</div>
              ) : syntheticData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">Overall Status</span>
                    {getStatusBadge(syntheticData.status)}
                  </div>
                  
                  <div className="space-y-2">
                    {syntheticData.checks?.map((check: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-zinc-800 p-3 rounded">
                        <div>
                          <div className="text-white text-sm font-medium">{check.name}</div>
                          {check.error && (
                            <div className="text-red-400 text-xs mt-1">{check.error}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">{check.latency_ms}ms</span>
                          {getStatusBadge(check.status)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-500">
                    Total latency: {syntheticData.total_latency_ms}ms
                  </div>
                </div>
              ) : (
                <Alert className="bg-red-950/20 border-red-900">
                  <AlertDescription className="text-red-200">
                    Failed to load synthetic check data
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Station Status
              </CardTitle>
              <CardDescription>K9000 monitoring system</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsData?.metrics?.stations?.current_statuses ? (
                <div className="space-y-2">
                  {Object.entries(metricsData.metrics.stations.current_statuses).map(([stationId, info]: [string, any]) => (
                    <div key={stationId} className="flex items-center justify-between bg-zinc-800 p-3 rounded">
                      <div>
                        <div className="text-white text-sm font-medium">{stationId}</div>
                        <div className="text-zinc-400 text-xs">{info.location}</div>
                      </div>
                      {getStatusBadge(info.status)}
                    </div>
                  ))}
                  {Object.keys(metricsData.metrics.stations.current_statuses).length === 0 && (
                    <div className="text-zinc-400 text-sm">No stations configured</div>
                  )}
                </div>
              ) : (
                <div className="text-zinc-400 text-sm">No station data available</div>
              )}
            </CardContent>
          </Card>
        </div>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <a href="/metrics" target="_blank" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                    📊 Prometheus Metrics
                  </a>
                  <a href="/firebase-debug" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                    🔥 Firebase Diagnostics
                  </a>
                  <a href="/api/synthetic/e2e-login" target="_blank" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                    🧪 E2E Login Test
                  </a>
                  <a href="/healthz" target="_blank" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                    ❤️ Health Check
                  </a>
                  <a href="/readiness" target="_blank" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors">
                    ✅ Readiness Check
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            {!analyticsStatus?.ga4?.configured || !analyticsStatus?.bigquery?.configured ? (
              <Alert className="bg-yellow-900/20 border-yellow-500/50">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-200">
                  <strong>Analytics Not Configured</strong>
                  <p className="mt-2 text-sm">
                    To enable auth funnel analytics, please configure the following environment variables:
                  </p>
                  <ul className="mt-2 text-sm list-disc list-inside space-y-1">
                    {!analyticsStatus?.ga4?.configured && (
                      <>
                        <li>GA4_MEASUREMENT_ID</li>
                        <li>GA4_API_SECRET</li>
                      </>
                    )}
                    {!analyticsStatus?.bigquery?.configured && (
                      <>
                        <li>BIGQUERY_PROJECT_ID</li>
                        <li>BIGQUERY_DATASET_ID</li>
                      </>
                    )}
                  </ul>
                  <p className="mt-2 text-sm">
                    See <code className="bg-zinc-800 px-1 py-0.5 rounded">docs/SECRETS_PLACEHOLDERS.md</code> for setup instructions.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Login Started
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {funnelMetrics?.loginStarted?.toLocaleString() || '—'}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Total attempts</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Login Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {funnelMetrics?.loginCompleted?.toLocaleString() || '—'}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Successful logins</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Conversion Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {funnelMetrics?.conversionRate ? 
                          `${(funnelMetrics.conversionRate * 100).toFixed(1)}%` : 
                          '—'
                        }
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Started to completed</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Avg Latency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {funnelMetrics?.avgLatencyMs ? 
                          formatLatency(Math.round(funnelMetrics.avgLatencyMs)) : 
                          '—'
                        }
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Time to dashboard</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Auth Funnel Steps
                      </CardTitle>
                      <CardDescription>User journey breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">Login Started</span>
                          <span className="text-white font-semibold">
                            {funnelMetrics?.loginStarted?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">Method Selected</span>
                          <span className="text-white font-semibold">
                            {funnelMetrics?.methodSelected?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">Login Completed</span>
                          <span className="text-white font-semibold">
                            {funnelMetrics?.loginCompleted?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">Login Failed</span>
                          <span className="text-red-400 font-semibold">
                            {funnelMetrics?.loginFailed?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">Dashboard Loaded</span>
                          <span className="text-white font-semibold">
                            {funnelMetrics?.dashboardLoaded?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        GA4 Configuration
                      </CardTitle>
                      <CardDescription>Analytics integration status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-zinc-400 text-sm">Google Analytics 4</span>
                            {analyticsStatus?.ga4?.configured ? (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Not Configured</Badge>
                            )}
                          </div>
                          {analyticsStatus?.ga4?.measurementId && (
                            <code className="text-xs text-zinc-500 font-mono">
                              {analyticsStatus.ga4.measurementId}
                            </code>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-zinc-400 text-sm">BigQuery Export</span>
                            {analyticsStatus?.bigquery?.configured ? (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Not Configured</Badge>
                            )}
                          </div>
                          {analyticsStatus?.bigquery?.projectId && (
                            <div className="space-y-1">
                              <code className="text-xs text-zinc-500 font-mono block">
                                Project: {analyticsStatus.bigquery.projectId}
                              </code>
                              <code className="text-xs text-zinc-500 font-mono block">
                                Dataset: {analyticsStatus.bigquery.datasetId}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer language={language} />
    </div>
  );
}
