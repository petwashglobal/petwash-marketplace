import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertCircle, 
  FileText, 
  AlertTriangle, 
  Info, 
  Bug,
  Search,
  Download,
  RefreshCw,
  Clock,
  Filter,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const ADMIN_EMAIL = 'nirhadad1@gmail.com';

type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'debug';

interface ParsedLog {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
  stackTrace?: string;
  details?: any;
}

export default function AdminSystemLogs() {
  const { user: firebaseUser } = useFirebaseAuth();
  const [activeLevel, setActiveLevel] = useState<LogLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [isRealTime, setIsRealTime] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ParsedLog | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const getAuthHeaders = async () => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const token = await (firebaseUser as any).getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const isAdmin = firebaseUser?.email === ADMIN_EMAIL;

  const { data: workflowLogs, isLoading: workflowLoading, refetch: refetchWorkflow } = useQuery({
    queryKey: ['/api/admin/system-logs/workflow'],
    enabled: isAdmin && !!firebaseUser,
    refetchInterval: isRealTime ? 5000 : false,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/system-logs/workflow', { headers });
      if (!response.ok) throw new Error('Failed to fetch workflow logs');
      return response.json();
    }
  });

  const { data: activityLogs, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['/api/admin/system-logs/activity'],
    enabled: isAdmin && !!firebaseUser,
    refetchInterval: isRealTime ? 5000 : false,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/system-logs/activity', { headers });
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      return response.json();
    }
  });

  const parsedLogs = useMemo<ParsedLog[]>(() => {
    const logs: ParsedLog[] = [];
    
    if (activityLogs?.logs) {
      activityLogs.logs.forEach((log: any) => {
        logs.push({
          id: log.id,
          timestamp: new Date(log.timestamp),
          level: 'info',
          message: log.action,
          source: log.resource || 'admin',
          details: log.details
        });
      });
    }

    if (workflowLogs?.logs) {
      const lines = workflowLogs.logs.split('\n');
      lines.forEach((line: string, idx: number) => {
        if (line.trim()) {
          const level: LogLevel = 
            line.toLowerCase().includes('error') ? 'error' :
            line.toLowerCase().includes('warn') ? 'warn' :
            line.toLowerCase().includes('debug') ? 'debug' : 'info';
          
          logs.push({
            id: `workflow-${idx}`,
            timestamp: new Date(),
            level,
            message: line,
            source: 'workflow'
          });
        }
      });
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [workflowLogs, activityLogs]);

  const filteredLogs = useMemo(() => {
    let filtered = parsedLogs;

    if (activeLevel !== 'all') {
      filtered = filtered.filter(log => log.level === activeLevel);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query)
      );
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(log => log.source === sourceFilter);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      switch (dateRange) {
        case '1h':
          cutoff.setHours(now.getHours() - 1);
          break;
        case '24h':
          cutoff.setHours(now.getHours() - 24);
          break;
        case '7d':
          cutoff.setDate(now.getDate() - 7);
          break;
      }
      filtered = filtered.filter(log => log.timestamp >= cutoff);
    }

    return filtered;
  }, [parsedLogs, activeLevel, searchQuery, sourceFilter, dateRange]);

  const stats = useMemo(() => {
    const total = parsedLogs.length;
    const errors = parsedLogs.filter(l => l.level === 'error').length;
    const warnings = parsedLogs.filter(l => l.level === 'warn').length;
    const info = parsedLogs.filter(l => l.level === 'info').length;
    
    return { total, errors, warnings, info };
  }, [parsedLogs]);

  const sources = useMemo(() => {
    const sourceSet = new Set(parsedLogs.map(l => l.source).filter(Boolean));
    return Array.from(sourceSet);
  }, [parsedLogs]);

  const handleExport = () => {
    const data = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (autoScroll && isRealTime) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll, isRealTime]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
        <Card className="w-full max-w-md luxury-glass-card luxury-shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              Admin permissions required
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Title */}
        <div className="luxury-animate-fade-in">
          <h1 className="luxury-heading-lg luxury-text-gradient flex items-center gap-3 mb-2">
            <FileText className="h-10 w-10" />
            System Logs
          </h1>
          <p className="luxury-text-body">Monitor system activity and workflow logs in real-time</p>
        </div>

        {/* Stats Grid */}
        <div className="luxury-grid-4 luxury-animate-fade-in luxury-delay-1">
          <div className="luxury-glass-card luxury-hover-lift p-6" data-testid="stat-total-logs">
            <div className="flex items-center justify-between mb-2">
              <p className="luxury-text-small">Total Logs</p>
              <FileText className="h-5 w-5 text-purple-500" />
            </div>
            <p className="luxury-heading-lg luxury-text-gradient">{stats.total}</p>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift p-6" data-testid="stat-errors">
            <div className="flex items-center justify-between mb-2">
              <p className="luxury-text-small">Errors</p>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <p className="luxury-heading-lg text-red-600">{stats.errors}</p>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift p-6" data-testid="stat-warnings">
            <div className="flex items-center justify-between mb-2">
              <p className="luxury-text-small">Warnings</p>
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="luxury-heading-lg text-yellow-600">{stats.warnings}</p>
          </div>
          
          <div className="luxury-glass-card luxury-hover-lift p-6" data-testid="stat-info">
            <div className="flex items-center justify-between mb-2">
              <p className="luxury-text-small">Info</p>
              <Info className="h-5 w-5 text-blue-500" />
            </div>
            <p className="luxury-heading-lg text-blue-600">{stats.info}</p>
          </div>
        </div>

        {/* Search & Filters Panel */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-2">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs (supports regex)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 luxury-glass-minimal"
                  data-testid="input-search-logs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Date Range */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full lg:w-40 luxury-glass-minimal" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Source Filter */}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full lg:w-40 luxury-glass-minimal" data-testid="select-source">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(source => (
                  <SelectItem key={source} value={source!}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              className="luxury-btn-secondary"
              data-testid="button-export-logs"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Log Level Filter */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-3">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-purple-600" />
            <span className="luxury-heading-sm">Filter by Level</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveLevel('all')}
              className={`luxury-badge ${activeLevel === 'all' ? 'ring-2 ring-purple-500' : ''}`}
              data-testid="filter-all"
            >
              All Logs
            </button>
            <button
              onClick={() => setActiveLevel('error')}
              className={`luxury-badge ${activeLevel === 'error' ? 'ring-2 ring-red-500' : ''}`}
              style={{ 
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                color: '#dc2626',
                borderColor: 'rgba(239, 68, 68, 0.3)'
              }}
              data-testid="filter-error"
            >
              <AlertCircle className="h-4 w-4" />
              Errors ({stats.errors})
            </button>
            <button
              onClick={() => setActiveLevel('warn')}
              className={`luxury-badge ${activeLevel === 'warn' ? 'ring-2 ring-yellow-500' : ''}`}
              style={{ 
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
                color: '#d97706',
                borderColor: 'rgba(251, 191, 36, 0.3)'
              }}
              data-testid="filter-warn"
            >
              <AlertTriangle className="h-4 w-4" />
              Warnings ({stats.warnings})
            </button>
            <button
              onClick={() => setActiveLevel('info')}
              className={`luxury-badge ${activeLevel === 'info' ? 'ring-2 ring-blue-500' : ''}`}
              style={{ 
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                color: '#2563eb',
                borderColor: 'rgba(59, 130, 246, 0.3)'
              }}
              data-testid="filter-info"
            >
              <Info className="h-4 w-4" />
              Info ({stats.info})
            </button>
            <button
              onClick={() => setActiveLevel('debug')}
              className={`luxury-badge ${activeLevel === 'debug' ? 'ring-2 ring-green-500' : ''}`}
              style={{ 
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)',
                color: '#16a34a',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
              data-testid="filter-debug"
            >
              <Bug className="h-4 w-4" />
              Debug
            </button>
          </div>
        </div>

        {/* Real-Time Toggle */}
        <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isRealTime}
                  onCheckedChange={setIsRealTime}
                  data-testid="switch-realtime"
                />
                <span className="luxury-text-body font-medium">Real-Time Monitoring</span>
              </div>
              {isRealTime && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="luxury-text-small text-green-600">Live</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                  disabled={!isRealTime}
                  data-testid="switch-autoscroll"
                />
                <span className="luxury-text-small">Auto-scroll</span>
              </label>
              <Button
                onClick={() => {
                  refetchWorkflow();
                  refetchActivity();
                }}
                variant="outline"
                size="sm"
                disabled={workflowLoading || activityLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(workflowLoading || activityLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-5">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="luxury-heading-sm luxury-text-gradient">
              System Logs ({filteredLogs.length})
            </h2>
          </div>
          <div className="p-6">
            {workflowLoading || activityLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="luxury-spinner" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="luxury-text-body">No logs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log, idx) => {
                  const isExpanded = expandedLogs.has(log.id);
                  const hasDetails = log.details || log.stackTrace;
                  
                  return (
                    <div
                      key={log.id}
                      className={`luxury-glass-minimal luxury-hover-lift p-4 cursor-pointer transition-all ${
                        idx < 10 ? `luxury-animate-fade-in luxury-delay-${Math.min(idx + 1, 10)}` : ''
                      }`}
                      onClick={() => hasDetails && toggleLogExpansion(log.id)}
                      data-testid={`log-${log.id}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Level Badge */}
                        <div className="flex-shrink-0">
                          {log.level === 'error' && (
                            <span className="luxury-badge" style={{ 
                              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                              color: '#dc2626',
                              borderColor: 'rgba(239, 68, 68, 0.3)'
                            }}>
                              <AlertCircle className="h-4 w-4" />
                              Error
                            </span>
                          )}
                          {log.level === 'warn' && (
                            <span className="luxury-badge" style={{ 
                              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)',
                              color: '#d97706',
                              borderColor: 'rgba(251, 191, 36, 0.3)'
                            }}>
                              <AlertTriangle className="h-4 w-4" />
                              Warning
                            </span>
                          )}
                          {log.level === 'info' && (
                            <span className="luxury-badge" style={{ 
                              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                              color: '#2563eb',
                              borderColor: 'rgba(59, 130, 246, 0.3)'
                            }}>
                              <Info className="h-4 w-4" />
                              Info
                            </span>
                          )}
                          {log.level === 'debug' && (
                            <span className="luxury-badge" style={{ 
                              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.1) 100%)',
                              color: '#16a34a',
                              borderColor: 'rgba(34, 197, 94, 0.3)'
                            }}>
                              <Bug className="h-4 w-4" />
                              Debug
                            </span>
                          )}
                        </div>

                        {/* Log Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <p className="luxury-text-body font-medium truncate flex-1">
                              {log.message}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="luxury-text-small font-mono whitespace-nowrap">
                                {log.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          
                          {log.source && (
                            <p className="luxury-text-small">
                              Source: <span className="font-medium">{log.source}</span>
                            </p>
                          )}

                          {/* Expandable Details */}
                          {hasDetails && (
                            <div className="mt-2">
                              <button
                                className="flex items-center gap-1 luxury-text-small text-purple-600 hover:text-purple-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLogExpansion(log.id);
                                }}
                                data-testid={`button-expand-${log.id}`}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="h-4 w-4" />
                                    Show Details
                                  </>
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="mt-3 p-4 luxury-glass-minimal rounded-lg">
                                  {log.details && (
                                    <div className="mb-3">
                                      <p className="luxury-text-small font-semibold mb-2">Details:</p>
                                      <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded font-mono overflow-x-auto">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {log.stackTrace && (
                                    <div>
                                      <p className="luxury-text-small font-semibold mb-2">Stack Trace:</p>
                                      <pre className="text-xs bg-gray-900 text-red-400 p-3 rounded font-mono overflow-x-auto">
                                        {log.stackTrace}
                                      </pre>
                                    </div>
                                  )}
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLog(log);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    data-testid={`button-view-full-${log.id}`}
                                  >
                                    View Full Log
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="luxury-glass-card luxury-shadow-xl max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="luxury-heading-md luxury-text-gradient">
              Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Log Header */}
              <div className="luxury-glass-minimal p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {selectedLog.level === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    {selectedLog.level === 'warn' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {selectedLog.level === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                    {selectedLog.level === 'debug' && <Bug className="h-5 w-5 text-green-500" />}
                    <span className="luxury-heading-sm capitalize">{selectedLog.level}</span>
                  </div>
                  <span className="luxury-text-small font-mono">
                    {selectedLog.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="luxury-text-body font-medium">{selectedLog.message}</p>
                {selectedLog.source && (
                  <p className="luxury-text-small mt-2">
                    Source: <span className="font-medium">{selectedLog.source}</span>
                  </p>
                )}
              </div>

              {/* Full Log Data */}
              {selectedLog.details && (
                <div>
                  <h3 className="luxury-heading-sm mb-3">Full Log Data</h3>
                  <div className="luxury-glass-minimal p-4 rounded-lg">
                    <pre className="text-sm bg-gray-900 text-green-400 p-4 rounded font-mono overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {selectedLog.stackTrace && (
                <div>
                  <h3 className="luxury-heading-sm mb-3">Stack Trace</h3>
                  <div className="luxury-glass-minimal p-4 rounded-lg">
                    <pre className="text-sm bg-gray-900 text-red-400 p-4 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                      {selectedLog.stackTrace}
                    </pre>
                  </div>
                </div>
              )}

              {/* Related Logs */}
              <div>
                <h3 className="luxury-heading-sm mb-3">Related Logs</h3>
                <div className="space-y-2">
                  {parsedLogs
                    .filter(l => 
                      l.source === selectedLog.source && 
                      l.id !== selectedLog.id &&
                      Math.abs(l.timestamp.getTime() - selectedLog.timestamp.getTime()) < 60000
                    )
                    .slice(0, 5)
                    .map(relatedLog => (
                      <div
                        key={relatedLog.id}
                        className="luxury-glass-minimal p-3 rounded-lg cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/10"
                        onClick={() => setSelectedLog(relatedLog)}
                        data-testid={`related-log-${relatedLog.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="luxury-text-small font-medium truncate flex-1">
                            {relatedLog.message}
                          </p>
                          <span className="luxury-text-small font-mono ml-2">
                            {relatedLog.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  {parsedLogs.filter(l => 
                    l.source === selectedLog.source && 
                    l.id !== selectedLog.id &&
                    Math.abs(l.timestamp.getTime() - selectedLog.timestamp.getTime()) < 60000
                  ).length === 0 && (
                    <p className="luxury-text-small text-gray-500">No related logs found</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
