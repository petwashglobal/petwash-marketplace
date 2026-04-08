/**
 * Provider Earnings Page — /provider/earnings
 * Phase 6: standalone, clear earnings breakdown
 * Gross / platform fee / net per booking
 * Filter: All / Pending / Paid
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react";

interface RecentPayout {
  bookingNumber: string;
  amount: number;
  gross: number;
  platformFee: number;
  date: string | null;
  payoutStatus: string | null;
  serviceType: string | null;
  platformId: string;
}

interface EarningsSummary {
  totalEarnings: number;
  paidPayouts: number;
  pendingPayouts: number;
  thisWeekEarnings: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  completedCount: number;
  totalJobs: number;
  recentPayouts: RecentPayout[];
}

const PAYOUT_CONFIG: Record<
  string,
  { label: string; icon: any; bg: string; text: string; border: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  pending_transfer: {
    label: "Transfer Pending",
    icon: TrendingUp,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  paid_out: {
    label: "Paid Out",
    icon: CheckCircle2,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
};

function formatILS(amount: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PayoutStatusPill({ status }: { status: string | null }) {
  const cfg = PAYOUT_CONFIG[status ?? "pending"] ?? PAYOUT_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

type FilterTab = "all" | "pending" | "pending_transfer" | "paid_out" | "failed";

export default function ProviderEarningsPage() {
  const { user } = useFirebaseAuth();
  const [, navigate] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const fetchWithAuth = async (url: string) => {
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  };

  const { data, isLoading } = useQuery<{ success: boolean; earnings: EarningsSummary }>({
    queryKey: ["/api/provider-dashboard/v2/earnings"],
    enabled: !!user,
    queryFn: () => fetchWithAuth("/api/provider-dashboard/v2/earnings"),
  });

  const earnings = data?.earnings;

  const filteredPayouts = (earnings?.recentPayouts ?? []).filter((p) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "pending") return (p.payoutStatus ?? "pending") === "pending";
    if (activeFilter === "pending_transfer") return p.payoutStatus === "pending_transfer";
    if (activeFilter === "paid_out") return p.payoutStatus === "paid_out";
    if (activeFilter === "failed") return p.payoutStatus === "failed";
    return true;
  });

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "pending_transfer", label: "Transfer Pending" },
    { id: "paid_out", label: "Paid Out" },
    { id: "failed", label: "Failed" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-white">
      {/* Header */}
      <div className="bg-white dark:bg-white border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/provider/dashboard")}
            className="p-2 rounded-full hover:bg-white dark:hover:bg-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-black" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-black flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              My Earnings
            </h1>
            <p className="text-xs text-gray-500">Gross, platform fee, and what you receive</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : earnings ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white col-span-2">
              <p className="text-xs font-medium opacity-80">Total Earned (all time)</p>
              <p className="text-3xl font-bold mt-1">{formatILS(earnings.totalEarnings)}</p>
              <p className="text-xs opacity-70 mt-1">{earnings.completedCount} completed bookings</p>
            </div>
            <div className="bg-white dark:bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500">This Month</p>
              <p className="text-xl font-bold text-gray-900 dark:text-black mt-1">
                {formatILS(earnings.thisMonthEarnings)}
              </p>
              {earnings.lastMonthEarnings > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  vs {formatILS(earnings.lastMonthEarnings)} last month
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500">Pending Payout</p>
              <p className="text-xl font-bold text-yellow-600 mt-1">
                {formatILS(earnings.pendingPayouts)}
              </p>
              {earnings.paidPayouts > 0 && (
                <p className="text-xs text-green-600 mt-0.5">{formatILS(earnings.paidPayouts)} paid out</p>
              )}
            </div>
          </div>
        ) : null}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-white text-gray-600 dark:text-black border border-gray-200 dark:border-gray-700 hover:bg-white"
              }`}
              onClick={() => setActiveFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Per-Booking Rows */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : filteredPayouts.length === 0 ? (
          <div className="bg-white dark:bg-white rounded-xl p-10 text-center">
            <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No bookings in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayouts.map((p, idx) => (
              <div
                key={`${p.bookingNumber}-${idx}`}
                className="bg-white dark:bg-white rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-black text-sm">
                      {p.serviceType || "Booking"}
                    </p>
                    <p className="text-xs text-gray-400">#{p.bookingNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 text-base">{formatILS(p.amount)}</p>
                    <p className="text-xs text-gray-400">you receive</p>
                  </div>
                </div>

                {/* Fee breakdown */}
                <div className="bg-white dark:bg-white rounded-lg px-3 py-2 text-xs space-y-1 mb-3">
                  <div className="flex justify-between text-gray-600 dark:text-black">
                    <span>Gross (customer paid)</span>
                    <span className="font-medium">{formatILS(p.gross)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Platform fee</span>
                    <span>− {formatILS(p.platformFee)}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-1 flex justify-between font-semibold text-gray-900 dark:text-black">
                    <span>You receive</span>
                    <span className="text-emerald-600">{formatILS(p.amount)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(p.date)}
                  </span>
                  <PayoutStatusPill status={p.payoutStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
