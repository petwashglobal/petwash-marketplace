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

export default function OperationsDashboard() {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskStatus, setTaskStatus] = useState("pending");
  const [taskCategory, setTaskCategory] = useState("maintenance");
  const [incidentSeverity, setIncidentSeverity] = useState("medium");
  const [incidentCategory, setIncidentCategory] = useState("equipment_failure");
  const { toast } = useToast();

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/enterprise/operations/tasks"],
  });

  const { data: overdueTasks } = useQuery({
    queryKey: ["/api/enterprise/operations/tasks/overdue"],
  });

  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ["/api/enterprise/operations/incidents"],
  });

  const { data: slaMetrics } = useQuery({
    queryKey: ["/api/enterprise/operations/sla/metrics"],
  });

  const { data: slaBreaches } = useQuery({
    queryKey: ["/api/enterprise/operations/sla/breaches"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/operations/tasks`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks/overdue"] });
      setShowTaskDialog(false);
      toast({ title: "Success", description: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    },
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/operations/incidents`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/sla/metrics"] });
      setShowIncidentDialog(false);
      toast({ title: "Success", description: "Incident created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create incident", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, completedBy, notes }: { id: number; completedBy: number; notes?: string }) =>
      apiRequest(`/api/enterprise/operations/tasks/${id}/complete`, { method: "POST", body: { completedBy, notes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/tasks/overdue"] });
      toast({ title: "Success", description: "Task completed" });
    },
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: async ({ id, resolvedBy, resolution }: { id: number; resolvedBy: number; resolution: string }) =>
      apiRequest(`/api/enterprise/operations/incidents/${id}/resolve`, { method: "POST", body: { resolvedBy, resolution } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/operations/sla/metrics"] });
      toast({ title: "Success", description: "Incident resolved" });
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
      low: "bg-blue-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      urgent: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      critical: "bg-red-600",
    };
    return colors[severity] || "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Operations Management</h1>
          <p className="text-muted-foreground">Manage tasks, incidents, and SLA compliance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowTaskDialog(true)} data-testid="button-create-task">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
          <Button onClick={() => setShowIncidentDialog(true)} variant="destructive" data-testid="button-create-incident">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Incident
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-active-tasks">
              {tasks?.filter((t: any) => t.status !== "completed" && t.status !== "cancelled").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="metric-overdue-tasks">{overdueTasks?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-open-incidents">
              {incidents?.filter((i: any) => i.status === "open" || i.status === "investigating").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Breach Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-sla-breach-rate">
              {slaMetrics?.breachRate?.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Tasks ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-incidents">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Incidents ({incidents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="sla" data-testid="tab-sla">
            <Activity className="w-4 h-4 mr-2" />
            SLA Tracking ({slaBreaches?.length || 0} breaches)
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
                  <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
                  <p className="text-muted-foreground mb-4">Create tasks to manage operations</p>
                  <Button onClick={() => setShowTaskDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks?.map((task: any) => (
                <Card key={task.id} data-testid={`task-card-${task.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{task.title}</h4>
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          <Badge variant="outline">{task.status}</Badge>
                        </div>
                        {task.description && <p className="text-sm text-muted-foreground mb-3">{task.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Category: {task.category}</span>
                          {task.taskId && <span>ID: {task.taskId}</span>}
                          {task.stationId && <span>Station: {task.stationId}</span>}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.status !== "completed" && task.status !== "cancelled" && (
                        <Button
                          size="sm"
                          onClick={() => completeTaskMutation.mutate({ id: task.id, completedBy: 1, notes: "Completed via dashboard" })}
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Complete
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
                  <h3 className="text-lg font-semibold mb-2">No incidents reported</h3>
                  <p className="text-muted-foreground mb-4">Report incidents to track and resolve issues</p>
                  <Button onClick={() => setShowIncidentDialog(true)} variant="destructive">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report Incident
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {incidents?.map((incident: any) => (
                <Card key={incident.id} data-testid={`incident-card-${incident.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{incident.title}</h4>
                          <Badge className={getSeverityColor(incident.severity)}>{incident.severity}</Badge>
                          <Badge variant="outline">{incident.status}</Badge>
                          {incident.slaBreach && <Badge variant="destructive">SLA Breach</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{incident.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Category: {incident.category}</span>
                          {incident.incidentId && <span>ID: {incident.incidentId}</span>}
                          {incident.stationId && <span>Station: {incident.stationId}</span>}
                          <span>Reported: {new Date(incident.reportedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {(incident.status === "open" || incident.status === "investigating") && (
                        <Button
                          size="sm"
                          onClick={() => resolveIncidentMutation.mutate({ id: incident.id, resolvedBy: 1, resolution: "Resolved via dashboard" })}
                          data-testid={`button-resolve-incident-${incident.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Resolve
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
                <CardTitle>Total SLAs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="sla-total">{slaMetrics?.totalSlas || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>SLA Breaches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600" data-testid="sla-breaches">{slaMetrics?.breachCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="sla-avg-response">{slaMetrics?.avgResponseTime || 0}m</div>
              </CardContent>
            </Card>
          </div>
          {slaBreaches && slaBreaches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">SLA Breaches</h3>
              {slaBreaches.map((breach: any) => (
                <Card key={breach.id} data-testid={`sla-breach-card-${breach.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {breach.entityType} #{breach.entityId} - {breach.slaType}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Breach: {breach.breachMinutes}m over target
                        </p>
                      </div>
                      <Badge variant="destructive">Breached</Badge>
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
        <DialogContent className="max-w-2xl" data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Create Operations Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="taskId">Task ID *</Label>
                <Input id="taskId" name="taskId" required placeholder="OPS-2025-0001" data-testid="input-task-id" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required data-testid="input-task-title" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} data-testid="textarea-task-description" />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={taskCategory} onValueChange={setTaskCategory}>
                  <SelectTrigger data-testid="select-task-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="customer_support">Customer Support</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stationId">Station ID</Label>
                <Input id="stationId" name="stationId" data-testid="input-station-id" />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Incident Dialog */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-incident">
          <DialogHeader>
            <DialogTitle>Report Incident</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateIncident} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="incidentId">Incident ID *</Label>
                <Input id="incidentId" name="incidentId" required placeholder="INC-2025-0001" data-testid="input-incident-id" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required data-testid="input-incident-title" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" name="description" rows={3} required data-testid="textarea-incident-description" />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                  <SelectTrigger data-testid="select-incident-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={incidentCategory} onValueChange={setIncidentCategory}>
                  <SelectTrigger data-testid="select-incident-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment_failure">Equipment Failure</SelectItem>
                    <SelectItem value="customer_complaint">Customer Complaint</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stationId">Station ID</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createIncidentMutation.isPending} data-testid="button-submit-incident">
                {createIncidentMutation.isPending ? "Reporting..." : "Report Incident"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
