/**
 * Provider Task Inbox — /provider/tasks
 * Phase 6: one operational screen for daily provider execution
 * "Needs Your Decision" + "Today & Tomorrow" sections
 * One-click accept/decline — no modals required
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Check,
  X,
  MessageSquare,
  Calendar,
  Clock,
  Package,
  Inbox,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

interface TaskBooking {
  id: string;
  bookingNumber: string;
  userId: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  serviceType: string | null;
  subtotal: string | null;
  platformFee: string | null;
  providerPayout: string | null;
  total: string | null;
  currency: string;
  payoutStatus: string | null;
  petCount: number | null;
  ownerMessage: string | null;
  createdAt: string;
}

interface MarketplaceBooking {
  id: string;
  bookingNumber: string;
  serviceType: string | null;
  startTime: string | null;
  endTime: string | null;
  subtotal: string | null;
  platformFee: string | null;
  providerPayout: string | null;
  total: string | null;
  currency: string;
  status: string;
  payoutStatus: string;
  createdAt: string;
  addons: { code: string; labelEn: string; labelHe: string; unitPrice: string }[];
}

const PAYOUT_BADGE: Record<string, { label: string; className: string }> = {
  pending:           { label: "Payout Pending",    className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  pending_transfer:  { label: "Transfer Pending",  className: "bg-blue-100 text-blue-800 border-blue-200" },
  released:          { label: "Payout Released",   className: "bg-blue-100 text-blue-800 border-blue-200" },
  paid_out:          { label: "Paid Out",           className: "bg-green-100 text-green-800 border-green-200" },
  failed:            { label: "Payout Failed",      className: "bg-red-100 text-red-800 border-red-200" },
};

const STATUS_LABEL: Record<string, string> = {
  pending: "New Request",
  accepted: "Awaiting Payment",
  meet_greet_scheduled: "Meet & Greet Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

function formatDate(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (isToday) return `Today ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
  if (isTomorrow) return `Tomorrow ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatILS(amount: string | null) {
  if (!amount) return "—";
  return `₪${parseFloat(amount).toFixed(2)}`;
}

function PayoutBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = PAYOUT_BADGE[status];
  if (!cfg) return null;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function ProviderTaskInbox() {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  // Pending (needs decision)
  const { data: pendingData, isLoading: pendingLoading } = useQuery<{
    bookings: TaskBooking[];
  }>({
    queryKey: ["/api/provider-dashboard/v2/bookings", "new_request"],
    enabled: !!user,
    queryFn: () =>
      fetchWithAuth("/api/provider-dashboard/v2/bookings?status=new_request&limit=20"),
  });

  // Upcoming (today + tomorrow)
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery<{
    upcoming: TaskBooking[];
  }>({
    queryKey: ["/api/provider-dashboard/v2/upcoming"],
    enabled: !!user,
    queryFn: () => fetchWithAuth("/api/provider-dashboard/v2/upcoming"),
  });

  // Marketplace bookings (bookings table — includes addon items)
  const { data: mktData, isLoading: mktLoading } = useQuery<{
    bookings: MarketplaceBooking[];
  }>({
    queryKey: ["/api/provider-dashboard/v2/marketplace-bookings"],
    enabled: !!user,
    queryFn: () => fetchWithAuth("/api/provider-dashboard/v2/marketplace-bookings?limit=10"),
  });

  const bookingActionMutation = useMutation({
    mutationFn: async ({ bookingId, action }: { bookingId: string; action: string }) => {
      return fetchWithAuth(`/api/provider-dashboard/v2/bookings/${bookingId}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/v2/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/v2/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/v2/booking-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      setProcessingId(null);
      toast({
        title: action === "accept" ? "Booking accepted" : "Booking declined",
        description:
          action === "accept"
            ? "The customer will be notified."
            : "The booking has been declined.",
        variant: action === "accept" ? "default" : "destructive",
      });
    },
    onError: (err: any, { action }) => {
      setProcessingId(null);
      toast({
        title: `Failed to ${action} booking`,
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function handleAction(bookingId: string, action: "accept" | "decline") {
    setProcessingId(bookingId + action);
    bookingActionMutation.mutate({ bookingId, action });
  }

  const pending = pendingData?.bookings ?? [];
  const upcoming = upcomingData?.upcoming ?? [];
  const mktBookings = mktData?.bookings ?? [];
  const totalPending = pending.length;

  const isLoading = pendingLoading || upcomingLoading;

  return (
    <div className="min-h-screen bg-white dark:bg-white">
      {/* Header */}
      <div className="bg-white dark:bg-white border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/provider/dashboard")}
              className="p-2 rounded-full hover:bg-white dark:hover:bg-white transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-black" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-black flex items-center gap-2">
                <Inbox className="w-5 h-5" />
                Task Inbox
              </h1>
              {totalPending > 0 && (
                <p className="text-xs text-orange-600 font-medium">
                  {totalPending} decision{totalPending !== 1 ? "s" : ""} needed
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/provider/earnings")}
            className="gap-1 text-xs"
          >
            <TrendingUp className="w-3 h-3" />
            Earnings
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* SECTION 1: Needs Your Decision */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Needs Your Decision
            </h2>
            {totalPending > 0 && (
              <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {totalPending}
              </span>
            )}
          </div>

          {pendingLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          )}

          {!pendingLoading && pending.length === 0 && (
            <div className="bg-white dark:bg-white rounded-xl p-6 text-center border border-gray-100 dark:border-gray-700">
              <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No pending decisions — you're all caught up</p>
            </div>
          )}

          <div className="space-y-3">
            {pending.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-black text-sm">
                      {b.serviceType || "Service Request"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">#{b.bookingNumber}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 dark:text-black">
                      {formatILS(b.providerPayout)}
                    </p>
                    <p className="text-xs text-gray-400">you receive</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(b.startTime)}
                  </span>
                  {b.petCount && (
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {b.petCount} pet{b.petCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {b.ownerMessage && (
                  <p className="text-xs text-gray-500 italic mb-3 bg-white dark:bg-white rounded-lg px-3 py-2">
                    "{b.ownerMessage}"
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={processingId === b.id + "accept"}
                    onClick={() => handleAction(b.id, "accept")}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1 border-red-200 text-red-600 hover:bg-red-50"
                    disabled={processingId === b.id + "decline"}
                    onClick={() => handleAction(b.id, "decline")}
                  >
                    <X className="w-3.5 h-3.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    onClick={() => navigate(`/booking-chat/${b.id}`)}
                    aria-label="Message customer"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: Today & Tomorrow */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Today &amp; Tomorrow
            </h2>
          </div>

          {upcomingLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}

          {!upcomingLoading && upcoming.length === 0 && (
            <div className="bg-white dark:bg-white rounded-xl p-6 text-center border border-gray-100 dark:border-gray-700">
              <Calendar className="w-8 h-8 text-blue-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No upcoming jobs in the next 24 hours</p>
            </div>
          )}

          <div className="space-y-3">
            {upcoming.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-black text-sm">
                      {b.serviceType || "Booking"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">#{b.bookingNumber}</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      {formatDate(b.startTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-black">
                      {formatILS(b.providerPayout)}
                    </p>
                    <PayoutBadge status={b.payoutStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: Marketplace Bookings with Add-ons */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Marketplace Bookings
            </h2>
            {mktBookings.length > 0 && (
              <span className="ml-auto bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {mktBookings.length}
              </span>
            )}
          </div>

          {mktLoading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}

          {!mktLoading && mktBookings.length === 0 && (
            <div className="bg-white dark:bg-white rounded-xl p-5 text-center border border-gray-100 dark:border-gray-700">
              <Package className="w-8 h-8 text-purple-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No marketplace bookings yet</p>
            </div>
          )}

          <div className="space-y-3">
            {mktBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-400"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-black text-sm">
                      {b.serviceType || "Marketplace Service"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">#{b.bookingNumber}</p>
                    <p className="text-xs text-purple-600 mt-1 font-medium">
                      {formatDate(b.startTime)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 dark:text-black">
                      {formatILS(b.providerPayout)}
                    </p>
                    <PayoutBadge status={b.payoutStatus} />
                  </div>
                </div>

                {b.addons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.addons.map((addon) => (
                      <span
                        key={addon.code}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-white dark:text-purple-300 dark:border-purple-700"
                      >
                        {addon.labelEn}
                        <span className="text-purple-400">
                          +₪{parseFloat(addon.unitPrice).toFixed(0)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <div className="text-center pb-4 space-y-2">
          <button
            type="button"
            className="text-sm text-blue-500 hover:underline block w-full"
            onClick={() => navigate("/provider/dashboard")}
          >
            View all bookings in full dashboard →
          </button>
          <button
            type="button"
            className="text-sm text-purple-500 hover:underline block w-full"
            onClick={() => navigate("/provider/feedback")}
          >
            ⭐ Customer Feedback & Ratings →
          </button>
        </div>
      </div>
    </div>
  );
}
