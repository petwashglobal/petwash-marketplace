import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Database, Zap, Clock, AlertCircle, CheckCircle } from "lucide-react";

interface PerformanceMetrics {
  database: {
    activeConnections: number;
    maxConnections: number;
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
  api: {
    requestsPerSecond: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    activeRequests: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

export default function PerformanceMonitoring() {
  const { data: metrics, isLoading } = useQuery<{ metrics: PerformanceMetrics }>({
    queryKey: ["/api/monitoring/performance"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const { database, api, system } = metrics.metrics;
  const dbConnectionPercent = (database.activeConnections / database.maxConnections) * 100;
  const isHealthy = api.errorRate < 0.05 && database.avgQueryTime < 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Performance Monitoring
            </h1>
            <Badge variant={isHealthy ? "default" : "destructive"} className="text-sm">
              {isHealthy ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  System Healthy
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Performance Issues
                </>
              )}
            </Badge>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring of database, API, and system performance
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Database Performance */}
          <Card className="col-span-full lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Database Performance
                  </CardTitle>
                  <CardDescription>PostgreSQL (Neon Serverless)</CardDescription>
                </div>
                <Badge variant={database.avgQueryTime < 100 ? "default" : "destructive"}>
                  {database.avgQueryTime < 100 ? "Optimal" : "Slow"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Pool */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Connection Pool</span>
                  <span className="text-sm text-gray-600">
                    {database.activeConnections} / {database.maxConnections}
                  </span>
                </div>
                <Progress value={dbConnectionPercent} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">
                  {dbConnectionPercent.toFixed(1)}% utilized
                </p>
              </div>

              {/* Query Performance */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {database.avgQueryTime}ms
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Avg Query Time</div>
                  <div className="text-xs text-green-600 mt-1">
                    Target: &lt;100ms
                  </div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {database.slowQueries}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Slow Queries</div>
                  <div className="text-xs text-gray-500 mt-1">&gt;500ms</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {database.cacheHitRate}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Cache Hit Rate</div>
                  <div className="text-xs text-green-600 mt-1">Redis</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                System Resources
              </CardTitle>
              <CardDescription>Real-time metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">CPU Usage</span>
                  <span className="text-sm text-gray-600">{system.cpuUsage}%</span>
                </div>
                <Progress value={system.cpuUsage} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm text-gray-600">{system.memoryUsage}%</span>
                </div>
                <Progress value={system.memoryUsage} className="h-2" />
              </div>
              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="text-2xl font-bold">
                  {Math.floor(system.uptime / 3600)}h {Math.floor((system.uptime % 3600) / 60)}m
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Performance */}
          <Card className="col-span-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600" />
                    API Performance
                  </CardTitle>
                  <CardDescription>Express.js endpoints</CardDescription>
                </div>
                <Badge variant={api.errorRate < 0.05 ? "default" : "destructive"}>
                  {(api.errorRate * 100).toFixed(2)}% Error Rate
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {api.requestsPerSecond}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Requests/sec</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-500">Live</span>
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {api.avgResponseTime}ms
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Avg Response</div>
                  <div className="text-xs text-green-600 mt-1">Target: &lt;500ms</div>
                </div>
                <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">
                    {api.p95ResponseTime}ms
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">P95 Response</div>
                  <div className="text-xs text-gray-500 mt-1">95th percentile</div>
                </div>
                <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-600">
                    {api.p99ResponseTime}ms
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">P99 Response</div>
                  <div className="text-xs text-gray-500 mt-1">99th percentile</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active Requests</span>
                  <span className="text-lg font-bold text-purple-600">{api.activeRequests}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Targets */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Performance Targets (Load Testing Goals)</CardTitle>
            <CardDescription>Phase 1: 500 concurrent users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${api.avgResponseTime < 500 ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium">API &lt; 500ms</div>
                  <div className="text-xs text-gray-500">P95 response time</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${database.avgQueryTime < 100 ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium">DB &lt; 100ms</div>
                  <div className="text-xs text-gray-500">Avg query time</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${api.errorRate < 0.05 ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium">Errors &lt; 5%</div>
                  <div className="text-xs text-gray-500">Error rate</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${database.cacheHitRate > 80 ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium">Cache &gt; 80%</div>
                  <div className="text-xs text-gray-500">Hit rate</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
