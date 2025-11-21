import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import {
  Bot,
  AlertTriangle,
  CheckCircle,
  Zap,
  Users,
  ShoppingCart,
  UserPlus,
  TrendingUp,
  ArrowLeft,
  Activity,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';

interface WatchdogStatus {
  isRunning: boolean;
  uptime: number;
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  autoFixesApplied: number;
  userStruggles: number;
  checkoutIssues: number;
  registrationIssues: number;
}

interface Issue {
  id: number;
  severity: string;
  category: string;
  affectedService: string;
  description: string;
  suggestedFix: string | null;
  detectedAt: string;
  status: string;
  autoFixAttempted: boolean;
}

interface UserStruggle {
  id: number;
  userId: string;
  action: string;
  failureCount: number;
  likelyCause: string | null;
  suggestedGuidance: string | null;
  urgency: string;
  detectedAt: string;
  resolved: boolean;
}

interface AutoFix {
  id: number;
  issueId: number;
  fixDescription: string;
  success: boolean;
  errorMessage: string | null;
  appliedAt: string;
}

export default function GeminiWatchdogDashboard() {
  const { language } = useLanguage();
  const isHebrew = language === "he";

  // Fetch watchdog status with real-time updates (every 5 seconds)
  const { data: statusData, isLoading } = useQuery<{ status: WatchdogStatus }>({
    queryKey: ["/api/gemini-watchdog/status"],
    refetchInterval: 5000, // Real-time: refresh every 5 seconds
  });

  // Fetch open issues with real-time updates (every 10 seconds)
  const { data: issuesData, isFetching: issuesFetching } = useQuery<{ issues: Issue[] }>({
    queryKey: ["/api/gemini-watchdog/issues", { status: "open", limit: 20 }],
    refetchInterval: 10000, // Real-time: refresh every 10 seconds
  });

  // Fetch user struggles with real-time updates (every 15 seconds)
  const { data: strugglesData, isFetching: strugglesFetching } = useQuery<{ struggles: UserStruggle[] }>({
    queryKey: ["/api/gemini-watchdog/struggles", { resolved: "false", limit: 20 }],
    refetchInterval: 15000, // Real-time: refresh every 15 seconds
  });

  // Fetch auto-fixes with real-time updates (every 10 seconds)
  const { data: autoFixesData, isFetching: autoFixesFetching } = useQuery<{ autoFixes: AutoFix[] }>({
    queryKey: ["/api/gemini-watchdog/auto-fixes", { limit: 20 }],
    refetchInterval: 10000, // Real-time: refresh every 10 seconds
  });

  const status = statusData?.status;
  const issues = issuesData?.issues || [];
  const struggles = strugglesData?.struggles || [];
  const autoFixes = autoFixesData?.autoFixes || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "text-blue-600 dark:text-blue-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "critical":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getSeverityBadgeVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case "low":
        return "default";
      case "medium":
        return "secondary";
      case "high":
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getUrgencyBadgeVariant = (urgency: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (urgency) {
      case "low":
        return "default";
      case "medium":
        return "secondary";
      case "high":
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? "rtl" : "ltr"}`}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {isHebrew ? "טוען..." : "Loading..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title={isHebrew ? "🤖 פיקוח Gemini AI" : "🤖 Gemini AI Watchdog"}
      subtitle={isHebrew ? "ניטור אוטונומי 24/7 ותיקון עצמי" : "24/7 Autonomous monitoring and self-healing"}
      icon={<Bot className="w-8 h-8 text-purple-600" />}
    >
      <div className={`min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? "rtl" : "ltr"}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin">
            <button className="mb-4 flex items-center gap-2 text-purple-600 hover:text-purple-700 dark:text-purple-400" data-testid="button-back-admin">
              <ArrowLeft className="h-4 w-4" />
              {isHebrew ? "חזרה לניהול" : "Back to Admin"}
            </button>
          </Link>

          <div className="flex items-center gap-4 mb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {isHebrew ? "Gemini AI Watchdog" : "Gemini AI Watchdog"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {isHebrew
                  ? "ניטור חכם בזמן אמת ותיקון אוטומטי של בעיות"
                  : "Real-time intelligent monitoring and auto-fix engine"}
              </p>
            </div>
          </div>
        </div>

        {/* Overall Status Cards */}
        <div className="luxury-grid-4 mb-8">
          <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "סטטוס מערכת" : "System Status"}
              </CardTitle>
              <Activity className={`h-4 w-4 ${status?.isRunning ? "text-green-600" : "text-red-600"}`} />
            </CardHeader>
            <CardContent>
              <div className={`luxury-heading-lg luxury-text-gradient`}>
                {status?.isRunning ? (isHebrew ? "פעיל" : "ACTIVE") : (isHebrew ? "לא פעיל" : "OFFLINE")}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew ? "זמן פעולה: " : "Uptime: "}
                {formatUptime(status?.uptime || 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "בעיות פתוחות" : "Open Issues"}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">
                {status?.openIssues || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew
                  ? `סה"כ ${status?.totalIssues || 0} בעיות`
                  : `${status?.totalIssues || 0} total issues`}
              </p>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "תיקונים אוטומטיים" : "Auto-Fixes"}
              </CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">
                {status?.autoFixesApplied || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew ? "תיקונים שבוצעו" : "Fixes applied"}
              </p>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "משתמשים במצוקה" : "User Struggles"}
              </CardTitle>
              <Users className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="luxury-heading-lg luxury-text-gradient">
                {status?.userStruggles || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew ? "זוהו היום" : "Detected today"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="issues" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="issues" data-testid="tab-issues">
              {isHebrew ? "בעיות" : "Issues"} ({issues.length})
            </TabsTrigger>
            <TabsTrigger value="struggles" data-testid="tab-struggles">
              {isHebrew ? "מצוקות משתמשים" : "User Struggles"} ({struggles.length})
            </TabsTrigger>
            <TabsTrigger value="autofixes" data-testid="tab-autofixes">
              {isHebrew ? "תיקונים אוטומטיים" : "Auto-Fixes"} ({autoFixes.length})
            </TabsTrigger>
          </TabsList>

          {/* Issues Tab */}
          <TabsContent value="issues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? "בעיות פתוחות" : "Open Issues"}</CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "בעיות שזוהו על ידי Gemini AI הדורשות תשומת לב"
                    : "Issues detected by Gemini AI requiring attention"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!issuesData && issuesFetching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">
                      {isHebrew ? "טוען..." : "Loading..."}
                    </span>
                  </div>
                ) : issues.length === 0 ? (
                  <div className="text-center py-12">
                    {issuesFetching && (
                      <div className="flex items-center justify-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-4">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span>{isHebrew ? "מרענן..." : "Refreshing..."}</span>
                      </div>
                    )}
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? "אין בעיות פתוחות! 🎉" : "No open issues! 🎉"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {issuesFetching && (
                      <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span>{isHebrew ? "מרענן..." : "Refreshing..."}</span>
                      </div>
                    )}
                    {issues.map((issue, idx) => (
                      <div
                        key={issue.id}
                        className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)} p-4`}
                        data-testid={`issue-${issue.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityBadgeVariant(issue.severity)}>
                              {issue.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{issue.category}</Badge>
                            {issue.autoFixAttempted && (
                              <Badge variant="secondary">
                                {isHebrew ? "נוסה תיקון" : "Auto-fix attempted"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(issue.detectedAt).toLocaleString(isHebrew ? "he-IL" : "en-US")}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {issue.affectedService}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {issue.description}
                        </p>
                        {issue.suggestedFix && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 mt-2">
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">
                              {isHebrew ? "תיקון מוצע:" : "Suggested Fix:"}
                            </p>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              {issue.suggestedFix}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Struggles Tab */}
          <TabsContent value="struggles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? "מצוקות משתמשים" : "User Struggles"}</CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "משתמשים שנתקלו בקשיים והם זקוקים לעזרה"
                    : "Users experiencing difficulties who need assistance"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!strugglesData && strugglesFetching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">
                      {isHebrew ? "טוען..." : "Loading..."}
                    </span>
                  </div>
                ) : struggles.length === 0 ? (
                  <div className="text-center py-12">
                    {strugglesFetching && (
                      <div className="flex items-center justify-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-4">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span>{isHebrew ? "מרענן..." : "Refreshing..."}</span>
                      </div>
                    )}
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? "אין משתמשים במצוקה! 👏" : "No users struggling! 👏"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {strugglesFetching && (
                      <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span>{isHebrew ? "מרענן..." : "Refreshing..."}</span>
                      </div>
                    )}
                    {struggles.map((struggle, idx) => (
                      <div
                        key={struggle.id}
                        className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)} p-4`}
                        data-testid={`struggle-${struggle.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getUrgencyBadgeVariant(struggle.urgency)}>
                              {struggle.urgency.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {isHebrew ? "כשלונות: " : "Failures: "}
                              {struggle.failureCount}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(struggle.detectedAt).toLocaleString(isHebrew ? "he-IL" : "en-US")}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {isHebrew ? "פעולה: " : "Action: "}
                          {struggle.action}
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">
                          {isHebrew ? "משתמש: " : "User: "}
                          {struggle.userId}
                        </p>
                        {struggle.likelyCause && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mt-2">
                            <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                              {isHebrew ? "סיבה אפשרית:" : "Likely Cause:"}
                            </p>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              {struggle.likelyCause}
                            </p>
                          </div>
                        )}
                        {struggle.suggestedGuidance && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 mt-2">
                            <p className="text-xs font-semibold text-green-900 dark:text-green-300 mb-1">
                              {isHebrew ? "הנחיה מוצעת:" : "Suggested Guidance:"}
                            </p>
                            <p className="text-sm text-green-800 dark:text-green-200">
                              {struggle.suggestedGuidance}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Fixes Tab */}
          <TabsContent value="autofixes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? "תיקונים אוטומטיים" : "Auto-Fixes"}</CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "תיקונים שבוצעו אוטומטית על ידי Gemini AI"
                    : "Automatic fixes applied by Gemini AI"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!autoFixesData && autoFixesFetching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">
                      {isHebrew ? "טוען..." : "Loading..."}
                    </span>
                  </div>
                ) : autoFixes.length === 0 ? (
                  <div className="text-center py-12">
                    {autoFixesFetching && (
                      <div className="flex items-center justify-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-4">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span>{isHebrew ? "מרענן..." : "Refreshing..."}</span>
                      </div>
                    )}
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? "עדיין לא בוצעו תיקונים אוטומטיים" : "No auto-fixes applied yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {autoFixesFetching && (
                      <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                        <span>{isHebrew ? "מרענן..." : "Refreshing..."}</span>
                      </div>
                    )}
                    {autoFixes.map((fix, idx) => (
                      <div
                        key={fix.id}
                        className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)} p-4`}
                        data-testid={`autofix-${fix.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {fix.success ? (
                              <Badge variant="default" className="bg-green-600">
                                {isHebrew ? "הצליח" : "SUCCESS"}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                {isHebrew ? "נכשל" : "FAILED"}
                              </Badge>
                            )}
                            <Badge variant="outline">
                              {isHebrew ? "בעיה #" : "Issue #"}
                              {fix.issueId}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(fix.appliedAt).toLocaleString(isHebrew ? "he-IL" : "en-US")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {fix.fixDescription}
                        </p>
                        {!fix.success && fix.errorMessage && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mt-2">
                            <p className="text-xs font-semibold text-red-900 dark:text-red-300 mb-1">
                              {isHebrew ? "שגיאה:" : "Error:"}
                            </p>
                            <p className="text-sm text-red-800 dark:text-red-200">
                              {fix.errorMessage}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </LuxuryPageWrapper>
  );
}
