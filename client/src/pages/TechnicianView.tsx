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
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center luxury-animate-scale-in">
          <div className="luxury-spinner"></div>
          <p className="luxury-text-small mt-4">Loading work orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Mobile-Optimized Header */}
        <div className="luxury-glass-card luxury-shadow-lg p-6 rounded-2xl luxury-animate-fade-in">
          <h1 className="luxury-heading-lg">🔧 Technician Dashboard</h1>
          <p className="luxury-text-small mt-1">Field Service Portal</p>
        </div>

        {/* Quick Stats */}
        <div className="luxury-grid-3 gap-3 luxury-animate-fade-in luxury-delay-1">
          <div className="luxury-glass-card luxury-shadow-lg p-4 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold text-yellow-600">{pendingOrders?.length || 0}</p>
            <p className="luxury-text-small">Pending</p>
          </div>
          
          <div className="luxury-glass-card luxury-shadow-lg p-4 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-3">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold luxury-text-gradient">{inProgressOrders?.length || 0}</p>
            <p className="luxury-text-small">Active</p>
          </div>
          
          <div className="luxury-glass-card luxury-shadow-lg p-4 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <p className="text-3xl font-bold text-green-600">{completedToday?.length || 0}</p>
            <p className="luxury-text-small">Today</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 luxury-animate-fade-in luxury-delay-2">
          <button className="luxury-glass-card luxury-shadow-lg luxury-hover-lift h-20 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300" data-testid="button-scan-qr">
            <QrCode className="h-6 w-6 text-purple-600" />
            <span className="text-sm font-semibold luxury-text-gradient">Scan QR</span>
          </button>
          <button className="luxury-glass-card luxury-shadow-lg luxury-hover-lift h-20 flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-300" data-testid="button-upload-photo">
            <Camera className="h-6 w-6 text-purple-600" />
            <span className="text-sm font-semibold luxury-text-gradient">Photo</span>
          </button>
        </div>

        {/* Active Work Orders */}
        {inProgressOrders && inProgressOrders.length > 0 && (
          <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden border-2 border-blue-200 luxury-animate-slide-up luxury-delay-3">
            <div className="luxury-glass-panel px-6 py-4">
              <h2 className="font-bold flex items-center gap-2 luxury-text-gradient">
                <Wrench className="h-5 w-5" />
                Active Jobs
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              {inProgressOrders.map((order: any, index: number) => (
                <div
                  key={order.id}
                  className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl border-2 border-blue-200 transition-all duration-300"
                  data-testid={`work-order-active-${order.id}`}
                  style={{ animationDelay: `${(index + 4) * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold">{order.title}</p>
                      <p className="luxury-text-small">
                        WO-{order.workOrderNumber}
                      </p>
                    </div>
                    <span className={`luxury-badge ${
                      order.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      order.priority === 'high' ? 'luxury-badge-gold' :
                      'luxury-badge'
                    }`}>
                      {order.priority}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="luxury-btn-secondary flex-1 text-sm"
                      onClick={() => setSelectedWorkOrder(order.id)}
                      data-testid={`button-update-${order.id}`}
                    >
                      Update
                    </button>
                    <button 
                      className="luxury-btn-primary flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-sm"
                      onClick={() => updateWorkOrderMutation.mutate({ 
                        id: order.id, 
                        status: 'completed',
                        notes 
                      })}
                      data-testid={`button-complete-${order.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Work Orders */}
        <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden luxury-animate-slide-up luxury-delay-4">
          <div className="luxury-glass-panel px-6 py-4">
            <h2 className="font-bold flex items-center gap-2 luxury-text-gradient">
              <Clock className="h-5 w-5" />
              Scheduled Jobs ({pendingOrders?.length || 0})
            </h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {pendingOrders?.map((order: any, index: number) => (
              <div
                key={order.id}
                className="luxury-glass-minimal luxury-hover-lift p-4 rounded-xl cursor-pointer transition-all duration-300"
                onClick={() => setSelectedWorkOrder(order.id)}
                data-testid={`work-order-pending-${order.id}`}
                style={{ animationDelay: `${(index + 5) * 0.05}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {statusIcon(order.status)}
                      <p className="font-semibold">{order.title}</p>
                    </div>
                    <p className="luxury-text-small mb-1">
                      {order.description}
                    </p>
                    <p className="luxury-text-small">
                      WO-{order.workOrderNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`luxury-badge ${
                      order.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      order.priority === 'high' ? 'luxury-badge-gold' :
                      'luxury-badge'
                    }`}>
                      {order.priority}
                    </span>
                    <button 
                      className="luxury-btn-primary text-sm px-4"
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
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(!pendingOrders || pendingOrders.length === 0) && (
              <div className="text-center py-12">
                <Wrench className="h-16 w-16 mx-auto mb-4 text-purple-200" />
                <p className="luxury-text-small">No pending work orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Completed Today */}
        {completedToday && completedToday.length > 0 && (
          <div className="luxury-glass-card luxury-shadow-lg rounded-2xl overflow-hidden border-2 border-green-200 luxury-animate-slide-up luxury-delay-5">
            <div className="luxury-glass-panel px-6 py-4">
              <h2 className="font-bold flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Completed Today ({completedToday.length})
              </h2>
            </div>
            <div className="px-6 py-4 space-y-2">
              {completedToday.map((order: any) => (
                <div
                  key={order.id}
                  className="luxury-glass-minimal p-4 rounded-xl bg-green-50 border border-green-200"
                  data-testid={`work-order-completed-${order.id}`}
                >
                  <p className="font-semibold text-green-900">{order.title}</p>
                  <p className="text-xs text-green-700">
                    WO-{order.workOrderNumber}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
