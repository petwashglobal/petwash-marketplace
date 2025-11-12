import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Users,
  Scale,
  Award,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ComplianceControlTower() {
  const { language } = useLanguage();
  const isHebrew = language === "he";

  // Fetch compliance status
  const { data: complianceStatus, isLoading } = useQuery({
    queryKey: ["/api/compliance/status"],
  });

  // Fetch authority documents
  const { data: authorityDocs } = useQuery({
    queryKey: ["/api/compliance/authority-documents"],
  });

  // Fetch compliance tasks
  const { data: complianceTasks } = useQuery({
    queryKey: ["/api/compliance/tasks", { status: "pending" }],
  });

  // Fetch corporate seals
  const { data: corporateSeals } = useQuery({
    queryKey: ["/api/compliance/corporate-seals", { isActive: "true" }],
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "text-green-600 dark:text-green-400";
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

  const getRiskBadgeVariant = (risk: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (risk) {
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

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? "rtl" : "ltr"}`}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? "rtl" : "ltr"}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin">
            <button className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400" data-testid="button-back-admin">
              <ArrowLeft className="h-4 w-4" />
              {isHebrew ? "חזרה לניהול" : "Back to Admin"}
            </button>
          </Link>

          <div className="flex items-center gap-4 mb-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {isHebrew ? "מגדל בקרת ציות" : "Compliance Control Tower"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {isHebrew
                  ? "מערכת ניטור ואכיפה מונעת AI לציות משפטי"
                  : "AI-driven legal compliance monitoring and enforcement"}
              </p>
            </div>
          </div>
        </div>

        {/* Overall Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "רמת סיכון כוללת" : "Overall Risk"}
              </CardTitle>
              <Shield className={`h-4 w-4 ${getRiskColor(complianceStatus?.overallRisk || "low")}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getRiskColor(complianceStatus?.overallRisk || "low")}`}>
                {complianceStatus?.overallRisk?.toUpperCase() || "LOW"}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew
                  ? `נבדק לאחרונה: ${new Date().toLocaleDateString("he-IL")}`
                  : `Last checked: ${new Date().toLocaleDateString("en-US")}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "מסמכים פגי תוקף" : "Expired Documents"}
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {complianceStatus?.expiredDocuments || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew ? "נדרש טיפול מיידי" : "Requires immediate action"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "משימות ציות" : "Compliance Tasks"}
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {complianceStatus?.pendingTasks || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="text-red-600 font-semibold">
                  {complianceStatus?.criticalTasks || 0}
                </span>{" "}
                {isHebrew ? "קריטיות" : "critical"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isHebrew ? "ספקים מושעים" : "Suspended Providers"}
              </CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {complianceStatus?.suspendedProviders || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {isHebrew ? "עקב רישיונות פגי תוקף" : "Due to expired licenses"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">
              {isHebrew ? "סקירה" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">
              {isHebrew ? "מסמכים" : "Documents"}
            </TabsTrigger>
            <TabsTrigger value="licenses" data-testid="tab-licenses">
              {isHebrew ? "רישיונות" : "Licenses"}
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              {isHebrew ? "משימות" : "Tasks"}
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              {isHebrew ? "ממשל תאגידי" : "Governance"}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  {isHebrew ? "בעיות קריטיות" : "Critical Issues"}
                </CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "בעיות ציות הדורשות טיפול מיידי"
                    : "Compliance issues requiring immediate attention"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {complianceStatus?.issues && complianceStatus.issues.length > 0 ? (
                  <div className="space-y-4">
                    {complianceStatus.issues.slice(0, 10).map((issue: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getRiskBadgeVariant(issue.severity)}>
                                {issue.severity}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {issue.type.replace(/_/g, " ")}
                              </span>
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {isHebrew ? issue.titleHe : issue.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {isHebrew ? issue.descriptionHe : issue.description}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              {isHebrew ? "פעולה נדרשת: " : "Action required: "}
                              {issue.actionRequired}
                            </p>
                          </div>
                          {issue.dueDate && (
                            <div className="text-right text-sm">
                              <div className="text-gray-500 dark:text-gray-400">
                                {isHebrew ? "תאריך יעד" : "Due"}
                              </div>
                              <div className="font-semibold">
                                {new Date(issue.dueDate).toLocaleDateString(isHebrew ? "he-IL" : "en-US")}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {isHebrew ? "אין בעיות קריטיות" : "No Critical Issues"}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew
                        ? "כל מערכות הציות פועלות כראוי"
                        : "All compliance systems are operating properly"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authority Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {isHebrew ? "מסמכי רשות ואישורים" : "Authority Documents & Approvals"}
                </CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "אישורי משרדים, רישיונות עירוניים, תעודות ביטוח"
                    : "Ministry approvals, municipal permits, insurance certificates"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {authorityDocs && authorityDocs.length > 0 ? (
                  <div className="space-y-4">
                    {authorityDocs.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={doc.status === "active" ? "default" : "destructive"}
                              >
                                {doc.status}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {doc.documentType.replace(/_/g, " ")}
                              </span>
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {isHebrew ? doc.titleHe : doc.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {isHebrew ? doc.authorityNameHe : doc.authorityName}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>
                                {isHebrew ? "מספר: " : "No: "}
                                {doc.documentNumber}
                              </span>
                              {doc.expiryDate && (
                                <span>
                                  {isHebrew ? "פג תוקף: " : "Expires: "}
                                  {new Date(doc.expiryDate).toLocaleDateString(
                                    isHebrew ? "he-IL" : "en-US"
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {doc.displayBadge && (
                            <Award className="h-8 w-8 text-green-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? "אין מסמכי רשות" : "No authority documents"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Provider Licenses Tab */}
          <TabsContent value="licenses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isHebrew ? "רישיונות ספקים" : "Provider Licenses"}
                </CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "רישיונות מקצועיים של מטפלים, מטיילים, נהגים ומפעילי תחנות"
                    : "Professional licenses for sitters, walkers, drivers, and station operators"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400">
                  {isHebrew
                    ? "ממשק ניהול רישיונות ספקים יבוא כאן"
                    : "Provider license management interface coming soon"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {isHebrew ? "משימות ציות" : "Compliance Tasks"}
                </CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "משימות אוטומטיות מונעות AI לטיפול בבעיות ציות"
                    : "AI-driven automated tasks for compliance issue resolution"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {complianceTasks && complianceTasks.length > 0 ? (
                  <div className="space-y-4">
                    {complianceTasks.slice(0, 10).map((task: any) => (
                      <div
                        key={task.id}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getRiskBadgeVariant(task.priority)}>
                                {task.priority}
                              </Badge>
                              {task.aiGenerated && (
                                <Badge variant="secondary">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  AI
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {isHebrew ? task.titleHe : task.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {isHebrew ? task.descriptionHe : task.description}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-gray-500 dark:text-gray-400">
                              {isHebrew ? "תאריך יעד" : "Due"}
                            </div>
                            <div className="font-semibold">
                              {new Date(task.dueDate).toLocaleDateString(isHebrew ? "he-IL" : "en-US")}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? "אין משימות ציות ממתינות" : "No pending compliance tasks"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Corporate Governance Tab */}
          <TabsContent value="governance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  {isHebrew ? "ממשל תאגידי וחותמות אמון" : "Corporate Governance & Trust Seals"}
                </CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "החלטות דירקטוריון, חותמות אימות ותגי אמון"
                    : "Board resolutions, verification seals, and trust badges"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {corporateSeals && corporateSeals.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {corporateSeals.map((seal: any) => (
                      <div
                        key={seal.id}
                        className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-center hover:border-blue-500 dark:hover:border-blue-400 transition"
                      >
                        <div className="flex justify-center mb-4">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: seal.badgeColor + "20" }}
                          >
                            <Award
                              className="h-8 w-8"
                              style={{ color: seal.badgeColor }}
                            />
                          </div>
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                          {isHebrew ? seal.titleHe : seal.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isHebrew ? seal.descriptionHe : seal.description}
                        </p>
                        {seal.isVerified && (
                          <div className="mt-4">
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {isHebrew ? "מאומת" : "Verified"}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? "אין חותמות תאגידיות" : "No corporate seals"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
