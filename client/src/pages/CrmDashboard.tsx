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
  MessageSquare,
  CheckSquare,
  Activity,
  Settings,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CrmDashboard() {
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showDealStageDialog, setShowDealStageDialog] = useState(false);
  const [communicationType, setCommunicationType] = useState("email");
  const [communicationDirection, setCommunicationDirection] = useState("outbound");
  const [taskStatus, setTaskStatus] = useState("pending");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [activityType, setActivityType] = useState("call");
  const { toast } = useToast();

  const { data: communications, isLoading: communicationsLoading } = useQuery({
    queryKey: ["/api/enterprise/sales/crm/communications"],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/enterprise/sales/crm/tasks"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/enterprise/sales/crm/activities"],
  });

  const { data: dealStages, isLoading: dealStagesLoading } = useQuery({
    queryKey: ["/api/enterprise/sales/crm/deal-stages"],
  });

  const { data: overdueTasks } = useQuery({
    queryKey: ["/api/enterprise/sales/crm/tasks/overdue"],
  });

  const { data: upcomingTasks } = useQuery({
    queryKey: ["/api/enterprise/sales/crm/tasks/upcoming"],
  });

  const createCommunicationMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/sales/crm/communications`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/communications"] });
      setShowCommunicationDialog(false);
      toast({ title: "Success", description: "Communication logged successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log communication", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/enterprise/sales/crm/tasks`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/tasks/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/tasks/upcoming"] });
      setShowTaskDialog(false);
      toast({ title: "Success", description: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/sales/crm/activities`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/activities"] });
      setShowActivityDialog(false);
      toast({ title: "Success", description: "Activity logged successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log activity", variant: "destructive" });
    },
  });

  const createDealStageMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/enterprise/sales/crm/deal-stages`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/deal-stages"] });
      setShowDealStageDialog(false);
      toast({ title: "Success", description: "Deal stage created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create deal stage", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, completedBy }: { id: number; completedBy: string }) =>
      apiRequest(`/api/enterprise/sales/crm/tasks/${id}/complete`, { method: "POST", body: { completedBy } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/sales/crm/tasks/overdue"] });
      toast({ title: "Success", description: "Task completed" });
    },
  });

  const handleCreateCommunication = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      communicationType,
      direction: communicationDirection,
      subject: formData.get("subject"),
      content: formData.get("content"),
      leadId: formData.get("leadId") ? parseInt(formData.get("leadId") as string) : undefined,
      customerId: formData.get("customerId") ? parseInt(formData.get("customerId") as string) : undefined,
      opportunityId: formData.get("opportunityId") ? parseInt(formData.get("opportunityId") as string) : undefined,
      userId: formData.get("userId"),
      duration: formData.get("duration") ? parseInt(formData.get("duration") as string) : undefined,
      outcome: formData.get("outcome"),
      followUpRequired: formData.get("followUpRequired") === "true",
    };
    createCommunicationMutation.mutate(data);
  };

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      taskType: formData.get("taskType"),
      status: taskStatus,
      priority: taskPriority,
      dueDate: formData.get("dueDate"),
      assignedTo: formData.get("assignedTo"),
      leadId: formData.get("leadId") ? parseInt(formData.get("leadId") as string) : undefined,
      opportunityId: formData.get("opportunityId") ? parseInt(formData.get("opportunityId") as string) : undefined,
      customerId: formData.get("customerId") ? parseInt(formData.get("customerId") as string) : undefined,
    };
    createTaskMutation.mutate(data);
  };

  const handleCreateActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      activityType,
      title: formData.get("title"),
      description: formData.get("description"),
      leadId: formData.get("leadId") ? parseInt(formData.get("leadId") as string) : undefined,
      customerId: formData.get("customerId") ? parseInt(formData.get("customerId") as string) : undefined,
      opportunityId: formData.get("opportunityId") ? parseInt(formData.get("opportunityId") as string) : undefined,
      userId: formData.get("userId"),
      duration: formData.get("duration") ? parseInt(formData.get("duration") as string) : undefined,
      outcome: formData.get("outcome"),
      revenue: formData.get("revenue") ? parseFloat(formData.get("revenue") as string) : undefined,
    };
    createActivityMutation.mutate(data);
  };

  const handleCreateDealStage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      displayOrder: formData.get("displayOrder") ? parseInt(formData.get("displayOrder") as string) : undefined,
      winProbability: formData.get("winProbability") ? parseInt(formData.get("winProbability") as string) : undefined,
    };
    createDealStageMutation.mutate(data);
  };

  const getCommunicationTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="w-4 h-4" />;
      case "phone":
        return <Phone className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTaskPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      urgent: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getTaskStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      in_progress: "bg-blue-500",
      completed: "bg-green-500",
      cancelled: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">CRM Management</h1>
          <p className="text-muted-foreground">Manage customer relationships, communications, tasks, and activities</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCommunicationDialog(true)} data-testid="button-create-communication">
            <MessageSquare className="w-4 h-4 mr-2" />
            Log Communication
          </Button>
          <Button onClick={() => setShowTaskDialog(true)} variant="outline" data-testid="button-create-task">
            <CheckSquare className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Communications</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-total-communications">{communications?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
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
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="metric-overdue-tasks">{overdueTasks?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-recent-activities">{activities?.slice(0, 10).length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="communications" className="w-full">
        <TabsList>
          <TabsTrigger value="communications" data-testid="tab-communications">
            <MessageSquare className="w-4 h-4 mr-2" />
            Communications ({communications?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="w-4 h-4 mr-2" />
            Tasks ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="activities" data-testid="tab-activities">
            <Activity className="w-4 h-4 mr-2" />
            Activities ({activities?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="deal-stages" data-testid="tab-deal-stages">
            <Settings className="w-4 h-4 mr-2" />
            Deal Stages ({dealStages?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="communications" className="space-y-4">
          {communicationsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : communications?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No communications yet</h3>
                  <p className="text-muted-foreground mb-4">Start logging customer interactions</p>
                  <Button onClick={() => setShowCommunicationDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Communication
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {communications?.map((comm: any) => (
                <Card key={comm.id} data-testid={`communication-card-${comm.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getCommunicationTypeIcon(comm.communicationType)}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{comm.subject || "No subject"}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{comm.content}</p>
                          </div>
                          <Badge variant="outline">{comm.direction}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Type: {comm.communicationType}</span>
                          {comm.duration && <span>Duration: {comm.duration}m</span>}
                          {comm.outcome && <span>Outcome: {comm.outcome}</span>}
                          <span>{new Date(comm.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

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
                  <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
                  <p className="text-muted-foreground mb-4">Create follow-up tasks for leads and opportunities</p>
                  <Button onClick={() => setShowTaskDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Task
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
                          <Badge className={getTaskPriorityColor(task.priority)}>{task.priority}</Badge>
                          <Badge className={getTaskStatusColor(task.status)} variant="outline">
                            {task.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {task.assignedTo && <span>Assigned to: {task.assignedTo}</span>}
                          {task.taskType && <span>Type: {task.taskType}</span>}
                        </div>
                      </div>
                      {task.status !== "completed" && task.status !== "cancelled" && (
                        <Button
                          size="sm"
                          onClick={() => completeTaskMutation.mutate({ id: task.id, completedBy: "admin" })}
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

        <TabsContent value="activities" className="space-y-4">
          {activitiesLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-24 bg-muted" />
              ))}
            </div>
          ) : activities?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No activities yet</h3>
                  <p className="text-muted-foreground mb-4">Activity history will appear here</p>
                  <Button onClick={() => setShowActivityDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Activity
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activities?.map((activity: any) => (
                <Card key={activity.id} data-testid={`activity-card-${activity.id}`}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{activity.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Type: {activity.activityType}</span>
                          {activity.duration && <span>Duration: {activity.duration}m</span>}
                          {activity.outcome && <span>Outcome: {activity.outcome}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="deal-stages" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowDealStageDialog(true)} data-testid="button-create-deal-stage">
              <Plus className="w-4 h-4 mr-2" />
              New Deal Stage
            </Button>
          </div>
          {dealStagesLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-32 bg-muted" />
              ))}
            </div>
          ) : dealStages?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No deal stages configured</h3>
                  <p className="text-muted-foreground mb-4">Create deal stages to track sales pipeline</p>
                  <Button onClick={() => setShowDealStageDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Deal Stage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {dealStages?.map((stage: any) => (
                <Card key={stage.id} data-testid={`deal-stage-card-${stage.id}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{stage.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{stage.description || "No description"}</p>
                    <div className="space-y-2 text-sm">
                      {stage.displayOrder && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Order:</span>
                          <span className="font-medium">{stage.displayOrder}</span>
                        </div>
                      )}
                      {stage.winProbability !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Win Probability:</span>
                          <span className="font-medium">{stage.winProbability}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Communication Dialog */}
      <Dialog open={showCommunicationDialog} onOpenChange={setShowCommunicationDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-communication">
          <DialogHeader>
            <DialogTitle>Log Communication</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCommunication} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Communication Type</Label>
                <Select value={communicationType} onValueChange={setCommunicationType}>
                  <SelectTrigger data-testid="select-communication-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={communicationDirection} onValueChange={setCommunicationDirection}>
                  <SelectTrigger data-testid="select-communication-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" data-testid="input-subject" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea id="content" name="content" rows={3} required data-testid="textarea-content" />
              </div>
              <div>
                <Label htmlFor="leadId">Lead ID</Label>
                <Input id="leadId" name="leadId" type="number" data-testid="input-lead-id" />
              </div>
              <div>
                <Label htmlFor="customerId">Customer ID</Label>
                <Input id="customerId" name="customerId" type="number" data-testid="input-customer-id" />
              </div>
              <div>
                <Label htmlFor="opportunityId">Opportunity ID</Label>
                <Input id="opportunityId" name="opportunityId" type="number" data-testid="input-opportunity-id" />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input id="duration" name="duration" type="number" data-testid="input-duration" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Input id="outcome" name="outcome" data-testid="input-outcome" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCommunicationDialog(false)}
                data-testid="button-cancel-communication"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createCommunicationMutation.isPending} data-testid="button-submit-communication">
                {createCommunicationMutation.isPending ? "Logging..." : "Log Communication"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required data-testid="input-task-title" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} data-testid="textarea-task-description" />
              </div>
              <div>
                <Label htmlFor="taskType">Task Type</Label>
                <Input id="taskType" name="taskType" placeholder="e.g., follow_up, demo" data-testid="input-task-type" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={taskStatus} onValueChange={setTaskStatus}>
                  <SelectTrigger data-testid="select-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" name="dueDate" type="date" data-testid="input-due-date" />
              </div>
              <div>
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input id="assignedTo" name="assignedTo" placeholder="User ID" data-testid="input-assigned-to" />
              </div>
              <div>
                <Label htmlFor="leadId">Lead ID</Label>
                <Input id="leadId" name="leadId" type="number" data-testid="input-task-lead-id" />
              </div>
              <div>
                <Label htmlFor="opportunityId">Opportunity ID</Label>
                <Input id="opportunityId" name="opportunityId" type="number" data-testid="input-task-opportunity-id" />
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

      {/* Create Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-activity">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateActivity} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Activity Type</Label>
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                    <SelectItem value="contract_signed">Contract Signed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required data-testid="input-activity-title" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} data-testid="textarea-activity-description" />
              </div>
              <div>
                <Label htmlFor="leadId">Lead ID</Label>
                <Input id="leadId" name="leadId" type="number" data-testid="input-activity-lead-id" />
              </div>
              <div>
                <Label htmlFor="opportunityId">Opportunity ID</Label>
                <Input id="opportunityId" name="opportunityId" type="number" data-testid="input-activity-opportunity-id" />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input id="duration" name="duration" type="number" data-testid="input-activity-duration" />
              </div>
              <div>
                <Label htmlFor="outcome">Outcome</Label>
                <Input id="outcome" name="outcome" data-testid="input-activity-outcome" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowActivityDialog(false)}
                data-testid="button-cancel-activity"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createActivityMutation.isPending} data-testid="button-submit-activity">
                {createActivityMutation.isPending ? "Logging..." : "Log Activity"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Deal Stage Dialog */}
      <Dialog open={showDealStageDialog} onOpenChange={setShowDealStageDialog}>
        <DialogContent data-testid="dialog-create-deal-stage">
          <DialogHeader>
            <DialogTitle>Create Deal Stage</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDealStage} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required data-testid="input-deal-stage-name" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} data-testid="textarea-deal-stage-description" />
              </div>
              <div>
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input id="displayOrder" name="displayOrder" type="number" data-testid="input-display-order" />
              </div>
              <div>
                <Label htmlFor="winProbability">Win Probability (%)</Label>
                <Input
                  id="winProbability"
                  name="winProbability"
                  type="number"
                  min="0"
                  max="100"
                  data-testid="input-win-probability"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDealStageDialog(false)}
                data-testid="button-cancel-deal-stage"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createDealStageMutation.isPending} data-testid="button-submit-deal-stage">
                {createDealStageMutation.isPending ? "Creating..." : "Create Deal Stage"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
