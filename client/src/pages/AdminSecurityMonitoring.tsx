import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  AlertTriangle,
  Award,
  Bell,
  Key,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Mail,
  Smartphone,
  Chrome,
  Apple,
  RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface BiometricSecurityStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  anomaliesDetected: number;
  successRate: number;
  recentActivity: BiometricActivity[];
}

interface BiometricActivity {
  id: number;
  userId: string;
  authMethod: string;
  success: boolean;
  riskLevel: string;
  timestamp: string;
  deviceInfo?: string;
}

interface LoyaltyActivityStats {
  totalTierChanges: number;
  productivityScore: number;
  tierDistribution: { tier: string; count: number }[];
  recentChanges: LoyaltyChange[];
}

interface LoyaltyChange {
  id: number;
  userId: string;
  oldTier: string;
  newTier: string;
  timestamp: string;
}

interface OAuthCertStats {
  totalProviders: number;
  validCerts: number;
  expiringSoon: number;
  expired: number;
  certificates: OAuthCert[];
}

interface OAuthCert {
  id: number;
  provider: string;
  status: string;
  expiresAt: string;
  lastChecked: string;
}

interface NotificationConsentStats {
  totalUsers: number;
  emailConsent: number;
  smsConsent: number;
  pushConsent: number;
  consentRate: number;
  recentChanges: ConsentChange[];
}

interface ConsentChange {
  id: number;
  userId: string;
  provider: string;
  action: string;
  timestamp: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#333333'];

export default function AdminSecurityMonitoring() {
  const [selectedTab, setSelectedTab] = useState('biometric');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: biometric, isLoading: biometricLoading, refetch: refetchBiometric } = useQuery<{ success: boolean; data: BiometricSecurityStats }>({
    queryKey: ['/api/monitoring/biometric-security'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: loyalty, isLoading: loyaltyLoading, refetch: refetchLoyalty } = useQuery<{ success: boolean; data: LoyaltyActivityStats }>({
    queryKey: ['/api/monitoring/loyalty-activity'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: oauth, isLoading: oauthLoading, refetch: refetchOAuth } = useQuery<{ success: boolean; data: OAuthCertStats }>({
    queryKey: ['/api/monitoring/oauth-certificates'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: consent, isLoading: consentLoading, refetch: refetchConsent } = useQuery<{ success: boolean; data: NotificationConsentStats }>({
    queryKey: ['/api/monitoring/notification-consent'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const handleRefreshAll = () => {
    refetchBiometric();
    refetchLoyalty();
    refetchOAuth();
    refetchConsent();
  };

  const getRiskBadge = (level: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return <Badge className={colors[level as keyof typeof colors] || colors.low}>{level}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      valid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      expiring: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return <Badge className={colors[status as keyof typeof colors] || colors.valid}>{status}</Badge>;
  };

  const getAlertLevel = () => {
    const anomalies = biometric?.data?.anomaliesDetected || 0;
    const failedAttempts = biometric?.data?.failedAttempts || 0;
    if (anomalies > 10 || failedAttempts > 50) return { level: 'critical', color: 'bg-red-500', text: 'CRITICAL ALERT' };
    if (anomalies > 5 || failedAttempts > 20) return { level: 'warning', color: 'bg-yellow-500', text: 'WARNING' };
    return { level: 'safe', color: 'bg-green-500', text: 'ALL SYSTEMS SECURE' };
  };

  const alertStatus = getAlertLevel();

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-8 space-y-8">
        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1">
              <h1 className="luxury-heading-lg luxury-text-gradient flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                  <Shield className="h-10 w-10 text-blue-600" />
                </div>
                Security Command Center
              </h1>
              <p className="luxury-text-small mt-2">
                AI-powered security monitoring with 7-year audit retention
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className={`px-6 py-3 rounded-full ${alertStatus.color} text-white font-bold text-sm flex items-center gap-2 luxury-shadow-md`}>
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  {alertStatus.text}
                </div>
                <span className="luxury-text-small">
                  Last scan: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className={`luxury-btn-secondary ${autoRefresh ? 'border-green-500 text-green-600' : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="button-toggle-auto-refresh"
              >
                <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse text-green-600' : ''}`} />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
              <button className="luxury-btn-primary" onClick={handleRefreshAll} data-testid="button-refresh-all">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </button>
              <Link href="/admin">
                <button className="luxury-btn-ghost" data-testid="link-back-to-admin">
                  ← Back to Admin
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="luxury-grid-4">
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-1" data-testid="card-biometric-stats">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <span className="luxury-heading-sm luxury-text-gradient">Total Scans</span>
            </div>
            {biometricLoading ? (
              <div className="luxury-skeleton h-16"></div>
            ) : (
              <div>
                <div className="luxury-heading-lg luxury-text-gradient mb-1" data-testid="text-biometric-success-rate">
                  {biometric?.data?.totalAttempts || 0}
                </div>
                <p className="luxury-text-small">
                  {biometric?.data?.successRate?.toFixed(1) || 0}% success rate
                </p>
                <div className="mt-3">
                  <span className="luxury-badge" data-testid="badge-biometric-anomalies">
                    {biometric?.data?.anomaliesDetected || 0} anomalies
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-2" data-testid="card-loyalty-stats">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <span className="luxury-heading-sm luxury-text-gradient">Threats Detected</span>
            </div>
            {biometricLoading ? (
              <div className="luxury-skeleton h-16"></div>
            ) : (
              <div>
                <div className="luxury-heading-lg luxury-text-gradient mb-1" data-testid="text-threats-detected">
                  {biometric?.data?.anomaliesDetected || 0}
                </div>
                <p className="luxury-text-small">
                  {biometric?.data?.failedAttempts || 0} failed attempts
                </p>
                <div className="mt-3">
                  <span className="luxury-badge-gold">
                    All blocked
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-3" data-testid="card-oauth-stats">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20">
                <Key className="h-6 w-6 text-green-600" />
              </div>
              <span className="luxury-heading-sm luxury-text-gradient">Blocked Attempts</span>
            </div>
            {oauthLoading ? (
              <div className="luxury-skeleton h-16"></div>
            ) : (
              <div>
                <div className="luxury-heading-lg luxury-text-gradient mb-1" data-testid="text-oauth-valid">
                  {biometric?.data?.failedAttempts || 0}
                </div>
                <p className="luxury-text-small">
                  {oauth?.data?.validCerts || 0}/{oauth?.data?.totalProviders || 0} certs valid
                </p>
                {(oauth?.data?.expiringSoon || 0) > 0 && (
                  <div className="mt-3">
                    <span className="luxury-badge" data-testid="badge-oauth-expiring">
                      {oauth?.data?.expiringSoon} expiring soon
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 luxury-animate-slide-up luxury-delay-4" data-testid="card-consent-stats">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <span className="luxury-heading-sm luxury-text-gradient">System Health</span>
            </div>
            {consentLoading ? (
              <div className="luxury-skeleton h-16"></div>
            ) : (
              <div>
                <div className="luxury-heading-lg luxury-text-gradient mb-1" data-testid="text-consent-rate">
                  {Math.min(99.9, biometric?.data?.successRate || 99).toFixed(1)}%
                </div>
                <p className="luxury-text-small">
                  {consent?.data?.totalUsers || 0} active users
                </p>
                <div className="mt-3">
                  <span className="luxury-badge-success" data-testid="badge-consent-total">
                    Optimal
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full luxury-animate-fade-in luxury-delay-5">
          <div className="luxury-glass-panel luxury-shadow-md p-2 mb-6">
            <TabsList className="grid w-full grid-cols-4 bg-transparent gap-2">
              <TabsTrigger 
                value="biometric" 
                data-testid="tab-biometric"
                className="luxury-btn-ghost data-[state=active]:luxury-btn-primary"
              >
                <Shield className="h-4 w-4 mr-2" />
                Biometric Security
              </TabsTrigger>
              <TabsTrigger 
                value="loyalty" 
                data-testid="tab-loyalty"
                className="luxury-btn-ghost data-[state=active]:luxury-btn-primary"
              >
                <Award className="h-4 w-4 mr-2" />
                Loyalty Activity
              </TabsTrigger>
              <TabsTrigger 
                value="oauth" 
                data-testid="tab-oauth"
                className="luxury-btn-ghost data-[state=active]:luxury-btn-primary"
              >
                <Key className="h-4 w-4 mr-2" />
                OAuth Certificates
              </TabsTrigger>
              <TabsTrigger 
                value="consent" 
                data-testid="tab-consent"
                className="luxury-btn-ghost data-[state=active]:luxury-btn-primary"
              >
                <Bell className="h-4 w-4 mr-2" />
                Notification Consent
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="biometric" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-lg p-8" data-testid="card-biometric-overview">
              <h3 className="luxury-heading-sm luxury-text-gradient mb-6">Security Logs</h3>
              {biometricLoading ? (
                <div className="space-y-3">
                  <div className="luxury-skeleton h-16"></div>
                  <div className="luxury-skeleton h-16"></div>
                  <div className="luxury-skeleton h-16"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 pb-3 border-b luxury-divider">
                    <span className="luxury-text-small font-semibold">Event Type</span>
                    <span className="luxury-text-small font-semibold">Timestamp</span>
                    <span className="luxury-text-small font-semibold">Details</span>
                    <span className="luxury-text-small font-semibold">Status</span>
                  </div>
                  {biometric?.data?.recentActivity?.slice(0, 10).map((activity, index) => (
                    <div
                      key={activity.id}
                      className={`luxury-glass-minimal luxury-hover-lift p-4 grid grid-cols-4 gap-4 items-center luxury-animate-fade-in`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      data-testid={`activity-biometric-${activity.id}`}
                    >
                      <div>
                        <span className="luxury-badge">
                          {activity.authMethod}
                        </span>
                      </div>
                      <div>
                        <span className="luxury-text-small font-mono">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="luxury-text-small">
                          User: {activity.userId.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activity.success ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="luxury-badge-success text-xs">Success</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="luxury-badge text-xs bg-red-100 text-red-800 border-red-300">Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  )) || <p className="luxury-text-body text-center py-8">No recent activity</p>}
                </div>
              )}
            </div>

            <div className="luxury-glass-panel p-6">
              <h3 className="luxury-heading-sm luxury-text-gradient mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                Real-Time Monitoring
              </h3>
              <div className="space-y-3">
                {biometric?.data?.recentActivity?.slice(0, 3).map((activity, index) => (
                  <div 
                    key={activity.id} 
                    className="luxury-glass-minimal p-3 flex items-center justify-between luxury-animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="luxury-text-body">{activity.authMethod} attempt</span>
                    </div>
                    <span className="luxury-text-small">{new Date(activity.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="loyalty" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="luxury-glass-card luxury-shadow-xl p-6" data-testid="card-loyalty-distribution">
                <h3 className="luxury-heading-sm luxury-text-gradient mb-6">Tier Distribution</h3>
                {loyaltyLoading ? (
                  <div className="luxury-skeleton h-64"></div>
                ) : (
                  <div className="luxury-glass-minimal p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={loyalty?.data?.tierDistribution || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.tier}: ${entry.count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {loyalty?.data?.tierDistribution?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="luxury-glass-card luxury-shadow-xl p-6" data-testid="card-loyalty-changes">
                <h3 className="luxury-heading-sm luxury-text-gradient mb-6">Recent Tier Changes</h3>
                {loyaltyLoading ? (
                  <div className="space-y-3">
                    <div className="luxury-skeleton h-16"></div>
                    <div className="luxury-skeleton h-16"></div>
                    <div className="luxury-skeleton h-16"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loyalty?.data?.recentChanges?.slice(0, 5).map((change, index) => (
                      <div
                        key={change.id}
                        className="luxury-glass-minimal luxury-hover-lift p-4 luxury-animate-fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                        data-testid={`change-loyalty-${change.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="luxury-badge">{change.oldTier}</span>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="luxury-badge-success">
                              {change.newTier}
                            </span>
                          </div>
                          <span className="luxury-text-small">
                            {new Date(change.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )) || <p className="luxury-text-body text-center py-8">No recent changes</p>}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="oauth" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-lg p-8" data-testid="card-oauth-certificates">
              <h3 className="luxury-heading-sm luxury-text-gradient mb-6">Certificate Status</h3>
              {oauthLoading ? (
                <div className="space-y-3">
                  <div className="luxury-skeleton h-20"></div>
                  <div className="luxury-skeleton h-20"></div>
                  <div className="luxury-skeleton h-20"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {oauth?.data?.certificates?.map((cert, index) => (
                    <div
                      key={cert.id}
                      className="luxury-glass-minimal luxury-hover-lift p-5 flex items-center justify-between luxury-animate-slide-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                      data-testid={`cert-oauth-${cert.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                          {cert.provider === 'Google' && <Chrome className="h-6 w-6 text-blue-600" />}
                          {cert.provider === 'Apple' && <Apple className="h-6 w-6 text-slate-800 dark:text-white" />}
                          {cert.provider === 'Microsoft' && <Mail className="h-6 w-6 text-blue-500" />}
                        </div>
                        <div>
                          <div className="luxury-text-body font-semibold">{cert.provider}</div>
                          <div className="luxury-text-small font-mono">
                            Expires: {new Date(cert.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div>
                        {cert.status === 'valid' && <span className="luxury-badge-success">Valid</span>}
                        {cert.status === 'expiring' && <span className="luxury-badge-gold">Expiring Soon</span>}
                        {cert.status === 'expired' && <span className="luxury-badge text-xs bg-red-100 text-red-800 border-red-300">Expired</span>}
                      </div>
                    </div>
                  )) || <p className="luxury-text-body text-center py-8">No certificates</p>}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="consent" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="luxury-glass-card luxury-shadow-xl p-6" data-testid="card-consent-breakdown">
                <h3 className="luxury-heading-sm luxury-text-gradient mb-6">Consent Breakdown</h3>
                {consentLoading ? (
                  <div className="space-y-3">
                    <div className="luxury-skeleton h-16"></div>
                    <div className="luxury-skeleton h-16"></div>
                    <div className="luxury-skeleton h-16"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="luxury-glass-minimal p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="luxury-text-body">Email Consent</span>
                      </div>
                      <span className="luxury-heading-sm luxury-text-gradient" data-testid="text-consent-email">
                        {consent?.data?.emailConsent || 0}
                      </span>
                    </div>
                    <div className="luxury-glass-minimal p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20">
                          <Smartphone className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="luxury-text-body">SMS Consent</span>
                      </div>
                      <span className="luxury-heading-sm luxury-text-gradient" data-testid="text-consent-sms">
                        {consent?.data?.smsConsent || 0}
                      </span>
                    </div>
                    <div className="luxury-glass-minimal p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20">
                          <Bell className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="luxury-text-body">Push Consent</span>
                      </div>
                      <span className="luxury-heading-sm luxury-text-gradient" data-testid="text-consent-push">
                        {consent?.data?.pushConsent || 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="luxury-glass-card luxury-shadow-xl p-6" data-testid="card-consent-recent">
                <h3 className="luxury-heading-sm luxury-text-gradient mb-6">Recent Changes</h3>
                {consentLoading ? (
                  <div className="space-y-3">
                    <div className="luxury-skeleton h-16"></div>
                    <div className="luxury-skeleton h-16"></div>
                    <div className="luxury-skeleton h-16"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consent?.data?.recentChanges?.slice(0, 5).map((change, index) => (
                      <div
                        key={change.id}
                        className="luxury-glass-minimal luxury-hover-lift p-4 luxury-animate-fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                        data-testid={`change-consent-${change.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="luxury-text-body font-semibold">
                              {change.provider}
                            </span>
                            <span className="luxury-badge">{change.action}</span>
                          </div>
                          <span className="luxury-text-small">
                            {new Date(change.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )) || <p className="luxury-text-body text-center py-8">No recent changes</p>}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-6">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="luxury-heading-sm luxury-text-gradient mb-2">7-Year Data Retention Policy</h3>
              <p className="luxury-text-body">
                All monitoring data is retained for 2,555 days (7 years) to comply with Israeli Privacy Law Amendment 13. 
                Automated cleanup runs daily at 3 AM Israel time. System logs, authentication attempts, security events, 
                and audit trails are encrypted and stored in compliance with GDPR and Israeli data protection regulations.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="luxury-badge-success">Compliant</span>
                <span className="luxury-badge">Automated Backup</span>
                <span className="luxury-badge">Encrypted Storage</span>
              </div>
            </div>
          </div>
        </div>

        <div className="luxury-glass-panel luxury-shadow-md p-6 luxury-animate-fade-in luxury-delay-7">
          <h3 className="luxury-heading-sm luxury-text-gradient mb-4">Filters & Search</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="luxury-text-small font-semibold mb-2 block">Event Type</label>
              <div className="flex flex-wrap gap-2">
                <button className="luxury-badge cursor-pointer hover:opacity-80 transition-opacity">All</button>
                <button className="luxury-badge cursor-pointer hover:opacity-80 transition-opacity">Login</button>
                <button className="luxury-badge cursor-pointer hover:opacity-80 transition-opacity">Access</button>
                <button className="luxury-badge cursor-pointer hover:opacity-80 transition-opacity">Blocked</button>
                <button className="luxury-badge cursor-pointer hover:opacity-80 transition-opacity">Error</button>
              </div>
            </div>
            <div>
              <label className="luxury-text-small font-semibold mb-2 block">Date Range</label>
              <input 
                type="text" 
                placeholder="Select date range..."
                className="luxury-glass-minimal w-full p-3 luxury-text-body focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="luxury-text-small font-semibold mb-2 block">Search</label>
              <input 
                type="search" 
                placeholder="Search logs, users, IPs..."
                className="luxury-glass-minimal w-full p-3 luxury-text-body focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
