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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="h-8 w-8 text-blue-600" />
              Security Monitoring Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              AI-powered security monitoring with 7-year audit retention
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              data-testid="button-toggle-auto-refresh"
            >
              <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse text-green-600' : ''}`} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button onClick={handleRefreshAll} size="sm" data-testid="button-refresh-all">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh All
            </Button>
            <Link href="/admin">
              <Button variant="outline" size="sm" data-testid="link-back-to-admin">
                ← Back to Admin
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-biometric-stats">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Biometric Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              {biometricLoading ? (
                <div className="animate-pulse h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-biometric-success-rate">
                    {biometric?.data?.successRate?.toFixed(1) || 0}%
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Success Rate</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs" data-testid="badge-biometric-anomalies">
                      {biometric?.data?.anomaliesDetected || 0} anomalies
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-loyalty-stats">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-600" />
                Loyalty Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loyaltyLoading ? (
                <div className="animate-pulse h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-loyalty-productivity">
                    {loyalty?.data?.productivityScore?.toFixed(1) || 0}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Productivity Score</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs" data-testid="badge-loyalty-changes">
                      {loyalty?.data?.totalTierChanges || 0} tier changes
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-oauth-stats">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-green-600" />
                OAuth Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oauthLoading ? (
                <div className="animate-pulse h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-oauth-valid">
                    {oauth?.data?.validCerts || 0}/{oauth?.data?.totalProviders || 0}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Valid Certificates</p>
                  <div className="mt-2 flex items-center gap-2">
                    {(oauth?.data?.expiringSoon || 0) > 0 && (
                      <Badge variant="destructive" className="text-xs" data-testid="badge-oauth-expiring">
                        {oauth?.data?.expiringSoon} expiring soon
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-consent-stats">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-orange-600" />
                Notification Consent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consentLoading ? (
                <div className="animate-pulse h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-consent-rate">
                    {consent?.data?.consentRate?.toFixed(1) || 0}%
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Consent Rate</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs" data-testid="badge-consent-total">
                      {consent?.data?.totalUsers || 0} users
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="biometric" data-testid="tab-biometric">
              <Shield className="h-4 w-4 mr-2" />
              Biometric Security
            </TabsTrigger>
            <TabsTrigger value="loyalty" data-testid="tab-loyalty">
              <Award className="h-4 w-4 mr-2" />
              Loyalty Activity
            </TabsTrigger>
            <TabsTrigger value="oauth" data-testid="tab-oauth">
              <Key className="h-4 w-4 mr-2" />
              OAuth Certificates
            </TabsTrigger>
            <TabsTrigger value="consent" data-testid="tab-consent">
              <Bell className="h-4 w-4 mr-2" />
              Notification Consent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="biometric" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-biometric-overview">
                <CardHeader>
                  <CardTitle>Authentication Overview</CardTitle>
                  <CardDescription>Real-time authentication monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  {biometricLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Total Attempts</span>
                        <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-biometric-total">
                          {biometric?.data?.totalAttempts || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Successful
                        </span>
                        <span className="font-semibold text-green-600" data-testid="text-biometric-successful">
                          {biometric?.data?.successfulAttempts || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Failed
                        </span>
                        <span className="font-semibold text-red-600" data-testid="text-biometric-failed">
                          {biometric?.data?.failedAttempts || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          Anomalies Detected
                        </span>
                        <span className="font-semibold text-orange-600" data-testid="text-biometric-anomalies-detail">
                          {biometric?.data?.anomaliesDetected || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-biometric-recent">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest authentication attempts</CardDescription>
                </CardHeader>
                <CardContent>
                  {biometricLoading ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {biometric?.data?.recentActivity?.slice(0, 5).map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          data-testid={`activity-biometric-${activity.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-slate-900 dark:text-white">
                                {activity.authMethod}
                              </span>
                              {activity.success ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {new Date(activity.timestamp).toLocaleString()}
                            </div>
                          </div>
                          {getRiskBadge(activity.riskLevel)}
                        </div>
                      )) || <p className="text-sm text-slate-500">No recent activity</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="loyalty" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-loyalty-distribution">
                <CardHeader>
                  <CardTitle>Tier Distribution</CardTitle>
                  <CardDescription>User distribution across loyalty tiers</CardDescription>
                </CardHeader>
                <CardContent>
                  {loyaltyLoading ? (
                    <div className="animate-pulse h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  ) : (
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
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-loyalty-changes">
                <CardHeader>
                  <CardTitle>Recent Tier Changes</CardTitle>
                  <CardDescription>Latest loyalty tier transitions</CardDescription>
                </CardHeader>
                <CardContent>
                  {loyaltyLoading ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {loyalty?.data?.recentChanges?.slice(0, 5).map((change) => (
                        <div
                          key={change.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          data-testid={`change-loyalty-${change.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{change.oldTier}</Badge>
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                {change.newTier}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {new Date(change.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )) || <p className="text-sm text-slate-500">No recent changes</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="oauth" className="space-y-4">
            <Card data-testid="card-oauth-certificates">
              <CardHeader>
                <CardTitle>Certificate Status</CardTitle>
                <CardDescription>OAuth provider certificate monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                {oauthLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {oauth?.data?.certificates?.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        data-testid={`cert-oauth-${cert.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {cert.provider === 'Google' && <Chrome className="h-5 w-5 text-blue-600" />}
                          {cert.provider === 'Apple' && <Apple className="h-5 w-5 text-slate-800 dark:text-white" />}
                          {cert.provider === 'Microsoft' && <Mail className="h-5 w-5 text-blue-500" />}
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">{cert.provider}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Expires: {new Date(cert.expiresAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(cert.status)}
                      </div>
                    )) || <p className="text-sm text-slate-500">No certificates</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consent" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-consent-breakdown">
                <CardHeader>
                  <CardTitle>Consent Breakdown</CardTitle>
                  <CardDescription>Notification preferences by channel</CardDescription>
                </CardHeader>
                <CardContent>
                  {consentLoading ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Consent
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-consent-email">
                          {consent?.data?.emailConsent || 0} users
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          SMS Consent
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-consent-sms">
                          {consent?.data?.smsConsent || 0} users
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Push Consent
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-consent-push">
                          {consent?.data?.pushConsent || 0} users
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-consent-recent">
                <CardHeader>
                  <CardTitle>Recent Changes</CardTitle>
                  <CardDescription>Latest consent modifications</CardDescription>
                </CardHeader>
                <CardContent>
                  {consentLoading ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {consent?.data?.recentChanges?.slice(0, 5).map((change) => (
                        <div
                          key={change.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          data-testid={`change-consent-${change.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-slate-900 dark:text-white">
                                {change.provider}
                              </span>
                              <Badge variant="outline">{change.action}</Badge>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {new Date(change.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )) || <p className="text-sm text-slate-500">No recent changes</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Alert data-testid="alert-retention-notice">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            <strong>7-Year Data Retention:</strong> All monitoring data is retained for 2,555 days (7 years) to comply
            with Israeli Privacy Law Amendment 13. Automated cleanup runs daily at 3 AM Israel time.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
