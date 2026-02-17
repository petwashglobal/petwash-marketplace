import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users,
  GraduationCap,
  Shield,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Eye,
  UserCheck,
  UserX,
  Pause,
  Award,
  Building2,
  Dog,
  MapPin,
  Car,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProviderStats {
  totalProviders: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  onHold: number;
  expiringPoliceChecks: number;
  pendingPoliceChecks: number;
  trainingCompletions: number;
  byPlatform: {
    sitter_suite: number;
    walk_my_pet: number;
    pettrek: number;
    k9000: number;
  };
}

interface QueueItem {
  id: number;
  providerId: string;
  platform: string;
  status: string;
  priority: string;
  createdAt: string;
  providerName?: string;
  checklistProgress?: number;
}

interface PoliceCheck {
  id: number;
  providerId: string;
  status: string;
  documentIssuedAt: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
}

const platformIcons: Record<string, any> = {
  sitter_suite: Dog,
  walk_my_pet: MapPin,
  pettrek: Car,
  k9000: Building2,
};

const platformLabels: Record<string, { he: string; en: string }> = {
  sitter_suite: { he: "מלון חיות", en: "⁦Sitter Suite™⁩" },
  walk_my_pet: { he: "טיולי כלבים", en: "⁦Walk My Pet™⁩" },
  pettrek: { he: "הסעות", en: "⁦PetTrek™⁩" },
  k9000: { he: "עמדות שטיפה", en: "⁦K9000™⁩" },
};

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  on_hold: "bg-orange-100 text-orange-800 border-orange-200",
  under_review: "bg-blue-100 text-blue-800 border-blue-200",
  expired: "bg-gray-100 text-gray-800 border-gray-200",
};

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700 animate-pulse",
};

export default function ProviderManagementView() {
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [selectedApplication, setSelectedApplication] = useState<QueueItem | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<ProviderStats>({
    queryKey: ["/api/control-panel/providers/stats"],
  });

  const { data: queue, isLoading: queueLoading } = useQuery<{ queue: QueueItem[] }>({
    queryKey: ["/api/control-panel/providers/queue"],
  });

  const { data: policeChecks, isLoading: policeLoading } = useQuery<{ checks: PoliceCheck[] }>({
    queryKey: ["/api/control-panel/providers/police-checks"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      return apiRequest("POST", `/api/provider-review/admin/approve/${id}`, { reviewNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/providers/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/providers/queue"] });
      toast({
        title: "בקשה אושרה",
        description: "הספק אושר לעבודה בפלטפורמה",
      });
      setSelectedApplication(null);
      setActionNotes("");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest("POST", `/api/provider-review/admin/reject/${id}`, { rejectionReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/providers/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/providers/queue"] });
      toast({
        title: "בקשה נדחתה",
        description: "הספק קיבל הודעה על הדחייה",
      });
      setSelectedApplication(null);
      setActionNotes("");
    },
  });

  const holdMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest("POST", `/api/provider-review/admin/hold/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/providers/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-panel/providers/queue"] });
      toast({
        title: "בקשה הוקפאה",
        description: "הבקשה הועברה להמתנה",
      });
      setSelectedApplication(null);
      setActionNotes("");
    },
  });

  const pendingQueue = queue?.queue?.filter(q => q.status === "pending") || [];
  const expiringChecks = policeChecks?.checks?.filter(c => c.daysUntilExpiry && c.daysUntilExpiry <= 30) || [];

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview" className="gap-2" data-testid="provider-tab-overview">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">סקירה כללית</span>
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2" data-testid="provider-tab-queue">
            <ClipboardCheck className="w-4 h-4" />
            <span className="hidden sm:inline">תור אישורים</span>
          </TabsTrigger>
          <TabsTrigger value="police" className="gap-2" data-testid="provider-tab-police">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">תעודות יושר</span>
          </TabsTrigger>
          <TabsTrigger value="training" className="gap-2" data-testid="provider-tab-training">
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">הכשרה</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="luxury-glass-card" data-testid="card-pending-review">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">ממתינים לבדיקה</CardTitle>
                <Clock className="w-4 h-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold luxury-text-gradient">
                  {stats?.pendingReview || 0}
                </div>
                <p className="text-xs text-muted-foreground">בקשות חדשות</p>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card" data-testid="card-approved">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">מאושרים</CardTitle>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold luxury-text-gradient">
                  {stats?.approved || 0}
                </div>
                <p className="text-xs text-muted-foreground">ספקים פעילים</p>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card" data-testid="card-expiring-police">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">תעודות יושר</CardTitle>
                <AlertTriangle className="w-4 h-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold luxury-text-gradient">
                  {stats?.expiringPoliceChecks || 0}
                </div>
                <p className="text-xs text-muted-foreground">פגות ב-30 יום</p>
              </CardContent>
            </Card>

            <Card className="luxury-glass-card" data-testid="card-training">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">הכשרות</CardTitle>
                <Award className="w-4 h-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold luxury-text-gradient">
                  {stats?.trainingCompletions || 0}
                </div>
                <p className="text-xs text-muted-foreground">תעודות הוצאו</p>
              </CardContent>
            </Card>
          </div>

          <Card className="luxury-glass-card">
            <CardHeader>
              <CardTitle>ספקים לפי פלטפורמה</CardTitle>
              <CardDescription>התפלגות ספקים מאושרים</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(platformLabels).map(([key, labels]) => {
                  const Icon = platformIcons[key] || Users;
                  const count = stats?.byPlatform?.[key as keyof typeof stats.byPlatform] || 0;
                  return (
                    <div
                      key={key}
                      className="luxury-glass-minimal p-4 rounded-lg text-center"
                      data-testid={`platform-stat-${key}`}
                    >
                      <Icon className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                      <div className="text-2xl font-bold luxury-text-gradient">{count}</div>
                      <p className="text-sm text-muted-foreground">{labels.he}</p>
                      <p className="text-xs text-muted-foreground">{labels.en}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {pendingQueue.length > 0 && (
            <Card className="luxury-glass-card border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  בקשות דחופות לטיפול
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingQueue.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 luxury-glass-minimal rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={priorityStyles[item.priority] || priorityStyles.normal}>
                          {item.priority === "urgent" ? "דחוף" : item.priority}
                        </Badge>
                        <span className="font-medium">{item.providerName || item.providerId}</span>
                        <Badge variant="outline">
                          {platformLabels[item.platform]?.he || item.platform}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveSubTab("queue")}
                        data-testid={`view-application-${item.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        צפייה
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card className="luxury-glass-card">
            <CardHeader>
              <CardTitle>תור אישורים - ⁦Pet Wash™⁩</CardTitle>
              <CardDescription>
                7-פריטים לבדיקה לכל ספק: תמונה, תעודות, זהות, כתובת, תעודת יושר, ביטוח, תמחור
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">ספק</TableHead>
                    <TableHead className="text-right">פלטפורמה</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">עדיפות</TableHead>
                    <TableHead className="text-right">התקדמות</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Clock className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">טוען...</p>
                      </TableCell>
                    </TableRow>
                  ) : queue?.queue?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-muted-foreground">אין בקשות ממתינות 🎉</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    queue?.queue?.map((item) => (
                      <TableRow key={item.id} data-testid={`queue-row-${item.id}`}>
                        <TableCell className="font-medium">
                          {item.providerName || item.providerId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {platformLabels[item.platform]?.he || item.platform}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusStyles[item.status] || statusStyles.pending}>
                            {item.status === "pending" && "ממתין"}
                            {item.status === "approved" && "מאושר"}
                            {item.status === "rejected" && "נדחה"}
                            {item.status === "on_hold" && "מוקפא"}
                            {item.status === "under_review" && "בבדיקה"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityStyles[item.priority] || priorityStyles.normal}>
                            {item.priority === "urgent" && "דחוף"}
                            {item.priority === "high" && "גבוה"}
                            {item.priority === "normal" && "רגיל"}
                            {item.priority === "low" && "נמוך"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={item.checklistProgress || 0} className="w-20" />
                            <span className="text-sm text-muted-foreground">
                              {item.checklistProgress || 0}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedApplication(item)}
                                data-testid={`action-btn-${item.id}`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md" dir="rtl">
                              <DialogHeader>
                                <DialogTitle>פעולות על בקשה #{item.id}</DialogTitle>
                                <DialogDescription>
                                  {item.providerName || item.providerId} - {platformLabels[item.platform]?.he}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <Textarea
                                  placeholder="הערות (אופציונלי)"
                                  value={actionNotes}
                                  onChange={(e) => setActionNotes(e.target.value)}
                                  data-testid="action-notes"
                                />
                              </div>
                              <DialogFooter className="flex gap-2 sm:justify-start">
                                <Button
                                  onClick={() => approveMutation.mutate({ id: item.id, notes: actionNotes })}
                                  disabled={approveMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                  data-testid="btn-approve"
                                >
                                  <UserCheck className="w-4 h-4 mr-1" />
                                  אישור
                                </Button>
                                <Button
                                  onClick={() => holdMutation.mutate({ id: item.id, reason: actionNotes || "ממתין למסמכים נוספים" })}
                                  disabled={holdMutation.isPending}
                                  variant="outline"
                                  className="border-orange-500 text-orange-600"
                                  data-testid="btn-hold"
                                >
                                  <Pause className="w-4 h-4 mr-1" />
                                  הקפאה
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (!actionNotes) {
                                      toast({
                                        title: "חסרה סיבה",
                                        description: "יש לציין סיבת דחייה",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    rejectMutation.mutate({ id: item.id, reason: actionNotes });
                                  }}
                                  disabled={rejectMutation.isPending}
                                  variant="destructive"
                                  data-testid="btn-reject"
                                >
                                  <UserX className="w-4 h-4 mr-1" />
                                  דחייה
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="police" className="space-y-4">
          <Card className="luxury-glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                תעודות יושר - Israeli תעודת יושר
              </CardTitle>
              <CardDescription>
                ניהול תעודות יושר עם מעקב תפוגה בזמן אמת
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="luxury-glass-minimal">
                  <CardContent className="pt-4 text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                    <div className="text-xl font-bold">{stats?.pendingPoliceChecks || 0}</div>
                    <p className="text-sm text-muted-foreground">ממתינות לאישור</p>
                  </CardContent>
                </Card>
                <Card className="luxury-glass-minimal">
                  <CardContent className="pt-4 text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                    <div className="text-xl font-bold">{stats?.expiringPoliceChecks || 0}</div>
                    <p className="text-sm text-muted-foreground">פגות ב-30 יום</p>
                  </CardContent>
                </Card>
                <Card className="luxury-glass-minimal">
                  <CardContent className="pt-4 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <div className="text-xl font-bold">{stats?.approved || 0}</div>
                    <p className="text-sm text-muted-foreground">תקינות</p>
                  </CardContent>
                </Card>
              </div>

              {expiringChecks.length > 0 && (
                <div className="border border-orange-200 rounded-lg p-4 bg-white">
                  <h4 className="font-medium text-orange-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    תעודות שעומדות לפוג ({expiringChecks.length})
                  </h4>
                  <div className="space-y-2">
                    {expiringChecks.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center justify-between p-2 bg-white rounded border"
                        data-testid={`expiring-check-${check.id}`}
                      >
                        <span className="font-medium">{check.providerId}</span>
                        <Badge className="bg-orange-100 text-orange-800">
                          {check.daysUntilExpiry} ימים נותרו
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card className="luxury-glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                מערכת הכשרה - ⁦Pet Wash™⁩
              </CardTitle>
              <CardDescription>
                מודולים, מבחנים, ותעודות לכל פלטפורמה
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(platformLabels).map(([key, labels]) => {
                  const Icon = platformIcons[key] || GraduationCap;
                  return (
                    <Card key={key} className="luxury-glass-minimal">
                      <CardContent className="pt-6 text-center">
                        <Icon className="w-10 h-10 mx-auto mb-3 text-purple-500" />
                        <h4 className="font-medium mb-1">{labels.he}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{labels.en}</p>
                        <div className="flex justify-center gap-2">
                          <Badge variant="outline">4 מודולים</Badge>
                          <Badge variant="outline">100% ציון עובר</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 p-4 luxury-glass-minimal rounded-lg">
                <h4 className="font-medium mb-3">תעודות שהופקו</h4>
                <div className="flex items-center gap-4">
                  <Award className="w-12 h-12 text-yellow-500" />
                  <div>
                    <div className="text-3xl font-bold luxury-text-gradient">
                      {stats?.trainingCompletions || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      תעודות ⁦Pet Wash™⁩ Certified שהופקו
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
