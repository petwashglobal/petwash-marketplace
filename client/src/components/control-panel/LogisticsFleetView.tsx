import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Truck,
  MapPin,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Plus,
  Filter,
  Navigation,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

type TaskStatus = "planned" | "assigned" | "in_progress" | "completed" | "blocked";
type TaskType = "install" | "service" | "repair" | "inspection" | "relocation";

interface LogisticsTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  stationId: string | null;
  stationName?: string;
  assignedTechnicianId: string | null;
  technicianName?: string;
  dueDate: string | null;
  description: string;
  notes?: string;
  createdAt: string;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  capacity: string | null;
  defaultDriverId: string | null;
  driverName?: string;
}

export default function LogisticsFleetView() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ label: "", type: "van", plateNumber: "", capacityKg: "" });
  const { toast } = useToast();

  // Fetch logistics tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/logistics/tasks", statusFilter, typeFilter],
  });

  // Fetch vehicles
  const { data: vehiclesData } = useQuery({
    queryKey: ["/api/logistics/vehicles"],
  });

  const tasks = (tasksData?.tasks || []) as LogisticsTask[];
  const vehicles = (vehiclesData?.vehicles || []) as Vehicle[];

  // Task stats
  const stats = {
    planned: tasks.filter((t) => t.status === "planned").length,
    assigned: tasks.filter((t) => t.status === "assigned").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-600 animate-pulse" />;
      case "assigned":
        return <User className="w-4 h-4 text-purple-600" />;
      case "blocked":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    const variants: Record<TaskStatus, "default" | "secondary" | "destructive" | "outline"> = {
      planned: "outline",
      assigned: "secondary",
      in_progress: "default",
      completed: "default",
      blocked: "destructive",
    };
    return <Badge variant={variants[status]}>{status.replace("_", " ")}</Badge>;
  };

  const getTypeBadge = (type: TaskType) => {
    const colors: Record<TaskType, string> = {
      install: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      service: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      repair: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      inspection: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      relocation: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    };
    return (
      <Badge className={colors[type]} variant="outline">
        {type}
      </Badge>
    );
  };

  const addVehicleMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logistics/vehicles", {
      label: vehicleForm.label,
      type: vehicleForm.type,
      plateNumber: vehicleForm.plateNumber,
      ...(vehicleForm.capacityKg ? { capacityKg: parseInt(vehicleForm.capacityKg) } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/vehicles"] });
      setAddVehicleOpen(false);
      setVehicleForm({ label: "", type: "van", plateNumber: "", capacityKg: "" });
      toast({ title: "Vehicle added", description: `${vehicleForm.plateNumber} registered successfully` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add vehicle", description: err.message || "Unknown error", variant: "destructive" });
    },
  });

  const openInWaze = (stationId: string) => {
    const task = tasks.find(t => t.stationId === stationId);
    const query = encodeURIComponent(task?.stationName || `PetWash Station ${stationId}`);
    const wazeUrl = `https://waze.com/ul?q=${query}&navigate=yes`;
    window.open(wazeUrl, "_blank");
    toast({
      title: "Opening Waze",
      description: `Navigating to ${task?.stationName || `Station ${stationId}`}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card data-testid="card-tasks-planned">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <div className="text-2xl font-bold">{stats.planned}</div>
              <p className="text-xs text-muted-foreground">Planned</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tasks-assigned">
          <CardContent className="pt-6">
            <div className="text-center">
              <User className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold">{stats.assigned}</div>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tasks-inprogress">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600 animate-pulse" />
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tasks-completed">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tasks-blocked">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold">{stats.blocked}</div>
              <p className="text-xs text-muted-foreground">Blocked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logistics Tasks</CardTitle>
              <CardDescription>Manage installation, service, and maintenance tasks</CardDescription>
            </div>
            <Button data-testid="button-create-task">
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label>Type Filter</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="install">Installation</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="relocation">Relocation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tasks List */}
          {tasksLoading ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No logistics tasks found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new task to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(task.status)}
                          {getTypeBadge(task.type)}
                          {getStatusBadge(task.status)}
                        </div>
                        <h4 className="font-medium mb-1">{task.description}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {task.stationName && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {task.stationName}
                            </div>
                          )}
                          {task.technicianName && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {task.technicianName}
                            </div>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {task.stationId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInWaze(task.stationId!)}
                          data-testid={`button-navigate-${task.id}`}
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          Navigate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fleet Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fleet Management</CardTitle>
              <CardDescription>Manage vehicles and drivers</CardDescription>
            </div>
            <Button variant="outline" data-testid="button-add-vehicle" onClick={() => setAddVehicleOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
            <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Vehicle</DialogTitle>
                  <DialogDescription>Register a new vehicle in the fleet</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <Label>Label / Name</Label>
                    <Input
                      placeholder="e.g. Van 01"
                      value={vehicleForm.label}
                      onChange={e => setVehicleForm(f => ({ ...f, label: e.target.value }))}
                      data-testid="input-vehicle-label"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Plate Number</Label>
                    <Input
                      placeholder="e.g. 123-45-678"
                      value={vehicleForm.plateNumber}
                      onChange={e => setVehicleForm(f => ({ ...f, plateNumber: e.target.value }))}
                      data-testid="input-vehicle-plate"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={vehicleForm.type} onValueChange={v => setVehicleForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger data-testid="select-vehicle-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="small_truck">Small Truck</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="bike">Bike</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Capacity (kg, optional)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={vehicleForm.capacityKg}
                      onChange={e => setVehicleForm(f => ({ ...f, capacityKg: e.target.value }))}
                      data-testid="input-vehicle-capacity"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => addVehicleMutation.mutate()}
                    disabled={!vehicleForm.label || !vehicleForm.plateNumber || addVehicleMutation.isPending}
                    data-testid="button-submit-add-vehicle"
                  >
                    {addVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No vehicles registered</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((vehicle) => (
                <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Truck className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{vehicle.plateNumber}</h4>
                        {vehicle.driverName && (
                          <p className="text-sm text-muted-foreground">{vehicle.driverName}</p>
                        )}
                        {vehicle.capacity && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Capacity: {vehicle.capacity}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
