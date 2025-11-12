import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench,
  Camera,
  QrCode,
  CheckCircle,
  Clock,
  AlertCircle,
  Upload,
  ChevronRight
} from "lucide-react";

interface TechnicianViewProps {
  technicianId: string;
}

export default function TechnicianView({ technicianId }: TechnicianViewProps) {
  const { toast } = useToast();
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ["/api/enterprise/work-orders", { technicianId }],
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: async (data: { id: number; status: string; notes?: string }) => {
      return await apiRequest(`/api/enterprise/work-orders/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: data.status,
          technicianNotes: data.notes,
          completedDate: data.status === 'completed' ? new Date().toISOString() : undefined
        }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/work-orders"] });
      toast({
        title: "Work order updated",
        description: "Status updated successfully"
      });
      setSelectedWorkOrder(null);
      setNotes("");
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update work order",
        variant: "destructive"
      });
    }
  });

  const pendingOrders = workOrders?.filter((wo: any) => wo.status === 'pending' || wo.status === 'scheduled');
  const inProgressOrders = workOrders?.filter((wo: any) => wo.status === 'in_progress');
  const completedToday = workOrders?.filter((wo: any) => {
    if (wo.status !== 'completed') return false;
    const today = new Date().setHours(0, 0, 0, 0);
    const completedDate = new Date(wo.completedDate).setHours(0, 0, 0, 0);
    return completedDate === today;
  });

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'scheduled':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Wrench className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading work orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Mobile-Optimized Header */}
        <div className="bg-primary text-primary-foreground rounded-lg p-4">
          <h1 className="text-2xl font-bold">Technician Dashboard</h1>
          <p className="text-sm opacity-90">Field Service Portal</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
              <p className="text-2xl font-bold text-yellow-900">{pendingOrders?.length || 0}</p>
              <p className="text-xs text-yellow-700">Pending</p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center">
              <Wrench className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-900">{inProgressOrders?.length || 0}</p>
              <p className="text-xs text-blue-700">Active</p>
            </CardContent>
          </Card>
          
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-900">{completedToday?.length || 0}</p>
              <p className="text-xs text-green-700">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-20 flex-col gap-2" variant="outline" data-testid="button-scan-qr">
            <QrCode className="h-6 w-6" />
            <span className="text-sm">Scan QR</span>
          </Button>
          <Button className="h-20 flex-col gap-2" variant="outline" data-testid="button-upload-photo">
            <Camera className="h-6 w-6" />
            <span className="text-sm">Photo</span>
          </Button>
        </div>

        {/* Active Work Orders */}
        {inProgressOrders && inProgressOrders.length > 0 && (
          <Card className="border-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Active Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inProgressOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="p-3 border rounded-lg bg-blue-50 border-blue-200"
                  data-testid={`work-order-active-${order.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{order.title}</p>
                      <p className="text-xs text-muted-foreground">
                        WO-{order.workOrderNumber}
                      </p>
                    </div>
                    <Badge variant={priorityColor(order.priority)}>
                      {order.priority}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setSelectedWorkOrder(order.id)}
                      data-testid={`button-update-${order.id}`}
                    >
                      Update
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => updateWorkOrderMutation.mutate({ 
                        id: order.id, 
                        status: 'completed',
                        notes 
                      })}
                      data-testid={`button-complete-${order.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pending Work Orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled Jobs ({pendingOrders?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingOrders?.map((order: any) => (
              <div
                key={order.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedWorkOrder(order.id)}
                data-testid={`work-order-pending-${order.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {statusIcon(order.status)}
                      <p className="font-semibold text-sm">{order.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {order.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      WO-{order.workOrderNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={priorityColor(order.priority)}>
                      {order.priority}
                    </Badge>
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateWorkOrderMutation.mutate({ 
                          id: order.id, 
                          status: 'in_progress' 
                        });
                      }}
                      data-testid={`button-start-${order.id}`}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {(!pendingOrders || pendingOrders.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending work orders</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Today */}
        {completedToday && completedToday.length > 0 && (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Completed Today ({completedToday.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {completedToday.map((order: any) => (
                <div
                  key={order.id}
                  className="p-3 border rounded-lg bg-green-50 border-green-200"
                  data-testid={`work-order-completed-${order.id}`}
                >
                  <p className="font-semibold text-sm text-green-900">{order.title}</p>
                  <p className="text-xs text-green-700">
                    WO-{order.workOrderNumber}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
