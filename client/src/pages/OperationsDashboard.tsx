import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Hebrew labels for DB codes (stored values stay English).
const PRIORITY_HE: Record<string, string> = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחוף" };
const TASK_STATUS_HE: Record<string, string> = { pending: "ממתין", in_progress: "בביצוע", completed: "הושלם", cancelled: "בוטל" };
const TASK_CAT_HE: Record<string, string> = { maintenance: "תחזוקה", customer_support: "שירות לקוחות", logistics: "לוגיסטיקה", admin: "אדמין" };
const SEVERITY_HE: Record<string, string> = { low: "נמוכה", medium: "בינונית", high: "גבוהה", critical: "קריטית" };
const INC_STATUS_HE: Record<string, string> = { open: "פתוחה", investigating: "בבדיקה", resolved: "טופלה", closed: "סגורה" };
const INC_CAT_HE: Record<string, string> = { equipment_failure: "תקלת ציוד", customer_complaint: "תלונת לקוח", safety: "בטיחות", security: "אבטחה" };
const he = (map: Record<string, string>, k: string) => map[k] ?? k;

export default function OperationsDashboard() {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskStatus, setTaskStatus] = useState("pending");
  const [taskCategory, setTaskCategory] = useState("maintenance");
  const [incidentSeverity, setIncidentSeverity] = useState("medium");
  const [incidentCategory, setIncidentCategory] = useState("equipment_failure");
  const { toast } = useToast();

  const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useQuery({
    queryKey: ["/api/enterprise/operations/tasks"],
  });

  const { data: overdueTasks } = useQuery({
    queryKey: ["/api/enterprise/operations/tasks/overdue"],
  });

  const { data: incidents, isLoading: incidentsLoading, isError: incidentsError } = useQuery({
    queryKey: ["/api/enterprise/operations/incidents"],
  });

  const { data: slaMetrics, isError: slaError } = useQuery({
    queryKey: ["/api/enterprise/operations/sla/metrics"],
  });

  const { data: slaBreaches } = useQuery({
    queryKey: ["/api/enterprise/operations/sla/breaches"],
  });

  const hasDataError = tasksError || incidentsError || slaError;

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/operations/tasks`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks/overdue"] });
      setShowTaskDialog(false);
      toast({ title: "בוצע", description: "המשימה נפתחה" });
    },
    onError: () => {
      toast({ title: "אופס", description: "לא הצלחנו לפתוח את המשימה", variant: "destructive" });
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/operations/incidents`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/sla/metrics"] });
      setShowIncidentDialog(false);
      toast({ title: "נשלח", description: "התקלה דווחה" });
    },
    onError: () => {
      toast({ title: "אופס", description: "לא הצלחנו לשלוח את הדיווח", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, completedBy, notes }: { id: number; completedBy: number; notes?: string }) =>
      apiRequest(`/api/enterprise/operations/tasks/${id}/complete`, { method: "POST", body: { completedBy, notes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks/overdue"] });
      toast({ title: "בוצע", description: "המשימה סומנה כהושלמה" });
    },
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: async ({ id, resolvedBy, resolution }: { id: number; resolvedBy: number; resolution: string }) =>
      apiRequest(`/api/enterprise/operations/incidents/${id}/resolve`, { method: "POST", body: { resolvedBy, resolution } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/sla/metrics"] });
      toast({ title: "בוצע", description: "התקלה נסגרה" });
    },
  });

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      taskId: formData.get("taskId"),
      title: formData.get("title"),
      description: formData.get("description"),
      priority: taskPriority,
      category: taskCategory,
      status: taskStatus,
      assignedTo: formData.get("assignedTo") ? parseInt(formData.get("assignedTo") as string) : undefined,
      stationId: formData.get("stationId") || undefined,
      dueDate: formData.get("dueDate") || undefined,
    };
    createTaskMutation.mutate(data);
  };

  const handleCreateIncident = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      incidentId: formData.get("incidentId"),
      title: formData.get("title"),
      description: formData.get("description"),
      severity: incidentSeverity,
      category: incidentCategory,
      stationId: formData.get("stationId") || undefined,
      reportedBy: formData.get("reportedBy") ? parseInt(formData.get("reportedBy") as string) : undefined,
      assignedTo: formData.get("assignedTo") ? parseInt(formData.get("assignedTo") as string) : undefined,
    };
    createIncidentMutation.mutate(data);
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-[#D4AF37]",
      medium: "bg-yellow-500",
      high: "bg-[#D4AF37]",
      urgent: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: "bg-[#D4AF37]",
      medium: "bg-yellow-500",
      high: "bg-[#D4AF37]",
      critical: "bg-red-600",
    };
    return colors[severity] || "bg-gray-500";
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="מרכז התפעול"
      subtitle="משימות, תקלות ועמידה ביעדי שירות — הכול במקום אחד"
    >
      <div className="p-6 space-y-6" dir="rtl">
      {hasDataError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          חלק מהנתונים לא נטענו — ייתכן שהמספרים חלקיים. כדאי לרענן.
        </div>
      )}
      <div className="flex justify-end items-center">
        <div className="flex gap-2">
          <Button className="luxury-btn-primary" onClick={() => setShowTaskDialog(true)} data-testid="button-create-task">
            <Plus className="w-4 h-4 ml-2" />
            משימה חדשה
          </Button>
          <Button onClick={() => setShowIncidentDialog(true)} variant="destructive" data-testid="button-create-incident">
            <AlertTriangle className="w-4 h-4 ml-2" />
            דיווח על תקלה
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="luxury-grid-4">
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משימות פעילות</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-active-tasks">
              {tasks?.filter((t: any) => t.status !== "completed" && t.status !== "cancelled").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משימות באיחור</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-overdue-tasks">{overdueTasks?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">תקלות פתוחות</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-open-incidents">
              {incidents?.filter((i: any) => i.status === "open" || i.status === "investigating").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="luxury-glass-card luxury-shadow-lg luxury-delay-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">חריגה מיעדי שירות</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="luxury-heading-lg luxury-text-gradient" data-testid="metric-sla-breach-rate">
              {slaMetrics?.breachRate?.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckCircle2 className="w-4 h-4 ml-2" />
            משימות ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-incidents">
            <AlertTriangle className="w-4 h-4 ml-2" />
            תקלות ({incidents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="sla" data-testid="tab-sla">
            <Activity className="w-4 h-4 ml-2" />
            יעדי שירות ({slaBreaches?.length || 0} חריגות)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {tasksLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : tasks?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין עדיין משימות</h3>
                  <p className="text-muted-foreground mb-4">פותחים משימה ומתחילים לנהל את התפעול</p>
                  <Button onClick={() => setShowTaskDialog(true)}>
                    <Plus className="w-4 h-4 ml-2" />
                    פתיחת משימה
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks?.map((task: any, idx: number) => (
                <Card key={task.id} className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)}`} data-testid={`task-card-${task.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{task.title}</h4>
                          <Badge className={getPriorityColor(task.priority)}>{he(PRIORITY_HE, task.priority)}</Badge>
                          <Badge variant="outline">{he(TASK_STATUS_HE, task.status)}</Badge>
                        </div>
                        {task.description && <p className="text-sm text-muted-foreground mb-3">{task.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>קטגוריה: {he(TASK_CAT_HE, task.category)}</span>
                          {task.taskId && <span>מזהה: {task.taskId}</span>}
                          {task.stationId && <span>עמדה: {task.stationId}</span>}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              יעד: {new Date(task.dueDate).toLocaleDateString("he-IL")}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.status !== "completed" && task.status !== "cancelled" && (
                        <Button
                          size="sm"
                          onClick={() => completeTaskMutation.mutate({ id: task.id, completedBy: 1, notes: "הושלם דרך הדשבורד" })}
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 ml-1" />
                          סיום
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {incidentsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : incidents?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">אין תקלות פתוחות</h3>
                  <p className="text-muted-foreground mb-4">מדווחים על תקלה כדי לעקוב ולטפל בה עד הסוף</p>
                  <Button onClick={() => setShowIncidentDialog(true)} variant="destructive">
                    <AlertTriangle className="w-4 h-4 ml-2" />
                    דיווח על תקלה
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {incidents?.map((incident: any, idx: number) => (
                <Card key={incident.id} className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(idx + 1, 6)}`} data-testid={`incident-card-${incident.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{incident.title}</h4>
                          <Badge className={getSeverityColor(incident.severity)}>{he(SEVERITY_HE, incident.severity)}</Badge>
                          <Badge variant="outline">{he(INC_STATUS_HE, incident.status)}</Badge>
                          {incident.slaBreach && <Badge variant="destructive">חריגת SLA</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{incident.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>קטגוריה: {he(INC_CAT_HE, incident.category)}</span>
                          {incident.incidentId && <span>מזהה: {incident.incidentId}</span>}
                          {incident.stationId && <span>עמדה: {incident.stationId}</span>}
                          <span>דווח: {new Date(incident.reportedAt).toLocaleDateString("he-IL")}</span>
                        </div>
                      </div>
                      {(incident.status === "open" || incident.status === "investigating") && (
                        <Button
                          size="sm"
                          onClick={() => resolveIncidentMutation.mutate({ id: incident.id, resolvedBy: 1, resolution: "נסגר דרך הדשבורד" })}
                          data-testid={`button-resolve-incident-${incident.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 ml-1" />
                          סגירה
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>סה״כ יעדים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="sla-total">{slaMetrics?.totalSlas || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>חריגות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600" data-testid="sla-breaches">{slaMetrics?.breachCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>זמן תגובה ממוצע</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="sla-avg-response">{slaMetrics?.avgResponseTime || 0} דק׳</div>
              </CardContent>
            </Card>
          </div>
          {slaBreaches && slaBreaches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">חריגות מיעד</h3>
              {slaBreaches.map((breach: any) => (
                <Card key={breach.id} data-testid={`sla-breach-card-${breach.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {breach.entityType} #{breach.entityId} · {breach.slaType}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          חריגה: {breach.breachMinutes} דק׳ מעבר ליעד
                        </p>
                      </div>
                      <Badge variant="destructive">חריגה</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>פתיחת משימת תפעול</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="taskId">מזהה משימה *</Label>
                <Input id="taskId" name="taskId" required placeholder="OPS-2025-0001" data-testid="input-task-id" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="title">כותרת *</Label>
                <Input id="title" name="title" required data-testid="input-task-title" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">תיאור</Label>
                <Textarea id="description" name="description" rows={3} data-testid="textarea-task-description" />
              </div>
              <div>
                <Label>עדיפות</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">נמוכה</SelectItem>
                    <SelectItem value="medium">בינונית</SelectItem>
                    <SelectItem value="high">גבוהה</SelectItem>
                    <SelectItem value="urgent">דחוף</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>קטגוריה</Label>
                <Select value={taskCategory} onValueChange={setTaskCategory}>
                  <SelectTrigger data-testid="select-task-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">תחזוקה</SelectItem>
                    <SelectItem value="customer_support">שירות לקוחות</SelectItem>
                    <SelectItem value="logistics">לוגיסטיקה</SelectItem>
                    <SelectItem value="admin">אדמין</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stationId">מזהה עמדה</Label>
                <Input id="stationId" name="stationId" data-testid="input-station-id" />
              </div>
              <div>
                <Label htmlFor="dueDate">תאריך יעד</Label>
                <Input id="dueDate" name="dueDate" type="datetime-local" data-testid="input-due-date" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTaskDialog(false)}
                data-testid="button-cancel-task"
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                {createTaskMutation.isPending ? "פותח..." : "פתיחת משימה"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Incident Dialog */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-w-2xl" dir="rtl" data-testid="dialog-create-incident">
          <DialogHeader>
            <DialogTitle>דיווח על תקלה</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateIncident} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="incidentId">מזהה תקלה *</Label>
                <Input id="incidentId" name="incidentId" required placeholder="INC-2025-0001" data-testid="input-incident-id" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="title">כותרת *</Label>
                <Input id="title" name="title" required data-testid="input-incident-title" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">תיאור *</Label>
                <Textarea id="description" name="description" rows={3} required data-testid="textarea-incident-description" />
              </div>
              <div>
                <Label>חומרה</Label>
                <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                  <SelectTrigger data-testid="select-incident-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">נמוכה</SelectItem>
                    <SelectItem value="medium">בינונית</SelectItem>
                    <SelectItem value="high">גבוהה</SelectItem>
                    <SelectItem value="critical">קריטית</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>קטגוריה</Label>
                <Select value={incidentCategory} onValueChange={setIncidentCategory}>
                  <SelectTrigger data-testid="select-incident-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment_failure">תקלת ציוד</SelectItem>
                    <SelectItem value="customer_complaint">תלונת לקוח</SelectItem>
                    <SelectItem value="safety">בטיחות</SelectItem>
                    <SelectItem value="security">אבטחה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stationId">מזהה עמדה</Label>
                <Input id="stationId" name="stationId" data-testid="input-incident-station-id" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIncidentDialog(false)}
                data-testid="button-cancel-incident"
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createIncidentMutation.isPending} data-testid="button-submit-incident">
                {createIncidentMutation.isPending ? "שולח..." : "שליחת דיווח"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LuxuryPageWrapper>
  );
}
