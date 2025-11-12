import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Package, Calendar, MapPin, Sparkles, Play, Pause, X, Truck, Star, Gift } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface Subscription {
  subscription: {
    id: number;
    userId: string;
    boxTypeId: number;
    status: string;
    frequency: string;
    startDate: string;
    nextShipmentDate: string | null;
    lastShipmentDate: string | null;
    cancelledAt: string | null;
    pausedAt: string | null;
    pauseReason: string | null;
    cancelReason: string | null;
    petProfile: any;
    deliveryAddress: any;
    totalShipments: number;
    createdAt: string;
    updatedAt: string;
  };
  boxType: {
    id: number;
    name: string;
    nameHe: string;
    description: string;
    monthlyPrice: string;
    itemCount: number;
    estimatedValue: string;
    features: string[];
  };
}

interface Shipment {
  id: number;
  subscriptionId: number;
  boxTypeId: number;
  status: string;
  shipmentDate: string | null;
  deliveryDate: string | null;
  trackingNumber: string | null;
  products: any[];
  totalValue: string;
  aiGenerated: boolean;
  customerRating: number | null;
  customerFeedback: string | null;
  createdAt: string;
}

export default function MySubscriptions() {
  const [, navigate] = useLocation();
  const [selectedSubscription, setSelectedSubscription] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const { toast } = useToast();

  const { data: subscriptionsData, isLoading } = useQuery<{ success: boolean; subscriptions: Subscription[] }>({
    queryKey: ["/api/subscriptions/my"],
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, action, reason }: { subscriptionId: number; action: string; reason?: string }) => {
      const response = await apiRequest("PUT", `/api/subscriptions/${subscriptionId}`, { action, reason });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/my"] });
      const actionMessages = {
        pause: "Subscription paused successfully",
        cancel: "Subscription cancelled successfully",
        resume: "Subscription resumed successfully",
      };
      toast({
        title: "Success!",
        description: actionMessages[variables.action as keyof typeof actionMessages] || "Subscription updated",
      });
      setShowCancelDialog(false);
      setShowPauseDialog(false);
      setCancelReason("");
      setPauseReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    },
  });

  const handlePause = (subscriptionId: number) => {
    updateSubscriptionMutation.mutate({ subscriptionId, action: "pause", reason: pauseReason });
  };

  const handleCancel = (subscriptionId: number) => {
    updateSubscriptionMutation.mutate({ subscriptionId, action: "cancel", reason: cancelReason });
  };

  const handleResume = (subscriptionId: number) => {
    updateSubscriptionMutation.mutate({ subscriptionId, action: "resume" });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: "bg-green-500", text: "Active" },
      paused: { color: "bg-yellow-500", text: "Paused" },
      cancelled: { color: "bg-red-500", text: "Cancelled" },
      expired: { color: "bg-gray-500", text: "Expired" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return <Badge className={`${config.color} text-white`}>{config.text}</Badge>;
  };

  const getFrequencyText = (frequency: string) => {
    const frequencyMap = {
      monthly: "Monthly",
      bimonthly: "Every 2 Months",
      quarterly: "Quarterly",
    };
    return frequencyMap[frequency as keyof typeof frequencyMap] || frequency;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-purple-500 animate-pulse mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading your subscriptions...</p>
        </div>
      </div>
    );
  }

  const subscriptions = subscriptionsData?.subscriptions || [];

  if (subscriptions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Package className="w-24 h-24 text-gray-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">No Subscriptions Yet</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Start receiving curated monthly boxes for your furry friend!
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/subscriptions")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-browse-subscriptions"
          >
            <Gift className="w-5 h-5 mr-2" />
            Browse Subscription Boxes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            My Subscriptions
          </h1>
          <Button
            onClick={() => navigate("/subscriptions")}
            variant="outline"
            data-testid="button-add-subscription"
          >
            <Package className="w-4 h-4 mr-2" />
            Add Another
          </Button>
        </div>

        <div className="space-y-6">
          {subscriptions.map(({ subscription, boxType }) => (
            <Card key={subscription.id} className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 shadow-xl" data-testid={`card-subscription-${subscription.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      {boxType.name} Box
                      {getStatusBadge(subscription.status)}
                    </CardTitle>
                    <CardDescription className="text-lg mt-2">{boxType.description}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">₪{boxType.monthlyPrice}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{getFrequencyText(subscription.frequency)}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pet Profile */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Pet Profile
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                      <p className="font-medium">{subscription.petProfile?.petName || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <p className="font-medium capitalize">{subscription.petProfile?.petType || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Age:</span>
                      <p className="font-medium capitalize">{subscription.petProfile?.age || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Size:</span>
                      <p className="font-medium capitalize">{subscription.petProfile?.size || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Info */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Delivery Address
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {subscription.deliveryAddress?.address}, {subscription.deliveryAddress?.city} {subscription.deliveryAddress?.postalCode}
                  </p>
                </div>

                {/* Shipment Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Started</p>
                      <p className="font-medium">{format(new Date(subscription.startDate), "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                  {subscription.nextShipmentDate && subscription.status === "active" && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Next Shipment</p>
                        <p className="font-medium">{format(new Date(subscription.nextShipmentDate), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Shipments</p>
                      <p className="font-medium">{subscription.totalShipments}</p>
                    </div>
                  </div>
                </div>

                {subscription.status === "paused" && subscription.pauseReason && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Paused:</strong> {subscription.pauseReason}
                    </p>
                  </div>
                )}

                {subscription.status === "cancelled" && subscription.cancelReason && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      <strong>Cancelled:</strong> {subscription.cancelReason}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-wrap gap-3">
                {subscription.status === "active" && (
                  <>
                    <Dialog open={showPauseDialog && selectedSubscription === subscription.id} onOpenChange={(open) => {
                      setShowPauseDialog(open);
                      if (open) setSelectedSubscription(subscription.id);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid={`button-pause-${subscription.id}`}>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause Subscription
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Pause Subscription</DialogTitle>
                          <DialogDescription>
                            Let us know why you're pausing. You can resume anytime.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Reason for pausing (optional)"
                          value={pauseReason}
                          onChange={(e) => setPauseReason(e.target.value)}
                          data-testid="textarea-pause-reason"
                        />
                        <Button
                          onClick={() => handlePause(subscription.id)}
                          disabled={updateSubscriptionMutation.isPending}
                          data-testid="button-confirm-pause"
                        >
                          Confirm Pause
                        </Button>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={showCancelDialog && selectedSubscription === subscription.id} onOpenChange={(open) => {
                      setShowCancelDialog(open);
                      if (open) setSelectedSubscription(subscription.id);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" data-testid={`button-cancel-${subscription.id}`}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel Subscription
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Cancel Subscription</DialogTitle>
                          <DialogDescription>
                            We're sad to see you go! Help us improve by sharing why you're cancelling.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Reason for cancellation (optional)"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          data-testid="textarea-cancel-reason"
                        />
                        <Button
                          onClick={() => handleCancel(subscription.id)}
                          variant="destructive"
                          disabled={updateSubscriptionMutation.isPending}
                          data-testid="button-confirm-cancel"
                        >
                          Confirm Cancellation
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </>
                )}

                {subscription.status === "paused" && (
                  <Button
                    onClick={() => handleResume(subscription.id)}
                    disabled={updateSubscriptionMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-green-700"
                    data-testid={`button-resume-${subscription.id}`}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Resume Subscription
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => navigate(`/subscriptions/${subscription.id}/ai-recommendations`)}
                  className="border-purple-500 text-purple-700 hover:bg-purple-50"
                  data-testid={`button-ai-recommendations-${subscription.id}`}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  View AI Recommendations
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
