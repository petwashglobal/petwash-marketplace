import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Loader2,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  BarChart3,
  BookOpen,
  ChevronRight,
  Download,
  History,
  SlidersHorizontal,
  FileDown,
  Unlock,
  RotateCcw,
  Plus,
  Minus,
  TrendingUp,
  Clock,
  XCircle,
  LifeBuoy,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";

const GOLD = "#C5A55A";

function centsToILS(cents: number): string {
  return (cents / 100).toLocaleString("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 2 });
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "PASS") return <Badge className="bg-green-600 text-white text-sm px-3 py-1">PASS</Badge>;
  if (verdict === "WARN") return <Badge className="bg-yellow-500 text-white text-sm px-3 py-1">WARN</Badge>;
  return <Badge className="bg-red-600 text-white text-sm px-3 py-1">FAIL</Badge>;
}

function FinanceStateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    none: "bg-gray-100 text-gray-600",
    hold_active: "bg-yellow-100 text-yellow-800",
    debited: "bg-blue-100 text-blue-800",
    released: "bg-green-100 text-green-800",
    refunded: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[state] ?? "bg-gray-100 text-gray-600"}`}>
      {state}
    </span>
  );
}

const DIVISION_LABELS: Record<string, string> = {
  station_k9000: "K9000",
  petsitter: "Sitter Suite",
  walkers: "Walk My Pet",
  academy: "Academy",
  pettrek: "PetTrek",
  general: "General",
};

// ── Support Action Zod schemas ────────────────────────────────────────────────
const releaseHoldSchema = z.object({
  bookingId:   z.string().min(1, "Booking ID required"),
  bookingType: z.enum(["marketplace", "academy"], { required_error: "Select booking type" }),
  reason:      z.string().min(5, "Reason must be at least 5 characters"),
});
const issueRefundSchema = z.object({
  bookingId:   z.string().min(1, "Booking ID required"),
  bookingType: z.enum(["marketplace", "academy"], { required_error: "Select booking type" }),
  amountIls:   z.coerce.number().min(0, "Amount must be ≥ 0"),
  reason:      z.string().min(5, "Reason must be at least 5 characters"),
});
const supportCreditSchema = z.object({
  userId:    z.string().min(1, "User ID required"),
  amountIls: z.coerce.number().positive("Amount must be > 0").max(500, "Max ₪500 per credit"),
  reason:    z.string().min(5, "Reason must be at least 5 characters"),
});
type ReleaseHoldVars  = z.infer<typeof releaseHoldSchema>;
type IssueRefundVars  = z.infer<typeof issueRefundSchema>;
type SupportCreditVars = z.infer<typeof supportCreditSchema>;

export default function AdminWalletDashboard() {
  const { toast } = useToast();
  const [auditId, setAuditId] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditUserId, setAuditUserId] = useState("");
  const [auditUserSearch, setAuditUserSearch] = useState("");

  // ── Action modals ────────────────────────────────────────────────────────────
  const [releaseModal, setReleaseModal]     = useState<{ bookingId: string; holdCents: number } | null>(null);
  const [refundModal, setRefundModal]       = useState<{ bookingId: string; debitedCents: number; refundedCents: number } | null>(null);
  const [adjustModal, setAdjustModal]       = useState<{ userId: string; type: "credit" | "debit" } | null>(null);
  const [forceConfirmModal, setForceConfirmModal] = useState<{ bookingId: string; holdCents: number } | null>(null);
  const [forceCancelModal, setForceCancelModal]   = useState<{ bookingId: string; financeState: string; amount: number } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  // ── Adjustments filters ──────────────────────────────────────────────────────
  const [adjFrom, setAdjFrom]           = useState("");
  const [adjTo, setAdjTo]               = useState("");
  const [adjUserId, setAdjUserId]       = useState("");
  const [adjDivision, setAdjDivision]   = useState("");
  const [adjApplied, setAdjApplied]     = useState(false);

  // ── Ledger export filters ────────────────────────────────────────────────────
  const [expFrom, setExpFrom]           = useState("");
  const [expTo, setExpTo]               = useState("");
  const [expDivision, setExpDivision]   = useState("");
  const [expEventType, setExpEventType] = useState("");
  const [expUserId, setExpUserId]       = useState("");

  // ── Booking finance export filters ──────────────────────────────────────────
  const [bkFrom, setBkFrom]               = useState("");
  const [bkTo, setBkTo]                   = useState("");
  const [bkFinanceState, setBkFinanceState] = useState("");
  const [bkSource, setBkSource]           = useState("");
  const [bkUserId, setBkUserId]           = useState("");

  // ── Action History filters ───────────────────────────────────────────────────
  const [ahFrom, setAhFrom]           = useState("");
  const [ahTo, setAhTo]               = useState("");
  const [ahDivision, setAhDivision]   = useState("");
  const [ahAdminUid, setAhAdminUid]   = useState("");
  const [ahBookingId, setAhBookingId] = useState("");
  const [ahApplied, setAhApplied]     = useState(false);

  // ── Division Report ─────────────────────────────────────────────────────────
  const { data: divisionReport, isLoading: divLoading } = useQuery<any[]>({
    queryKey: ["/api/prestige-pass/admin/wallet/division-report"],
  });

  // ── Booking Audit ───────────────────────────────────────────────────────────
  const {
    data: auditData,
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/booking-audit", auditSearch],
    enabled: !!auditSearch,
  });

  // ── User Wallet Audit ────────────────────────────────────────────────────────
  const {
    data: userAuditData,
    isLoading: userAuditLoading,
  } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/user-audit", auditUserSearch],
    queryFn: () =>
      fetch(`/api/prestige-pass/admin/wallet/user-audit?userId=${encodeURIComponent(auditUserSearch)}`, {
        credentials: "include",
      }).then(r => r.json()),
    enabled: !!auditUserSearch,
  });

  // ── Proof Pass ──────────────────────────────────────────────────────────────
  const {
    data: proofPass,
    isPending: proofPending,
    mutate: runProofPass,
  } = useMutation<any>({
    mutationFn: () =>
      apiRequest("POST", "/api/prestige-pass/admin/wallet/proof-pass", {}),
    onError: () => toast({ title: "Proof pass failed", variant: "destructive" }),
  });

  // ── Reconciliation History ───────────────────────────────────────────────────
  const { data: reconHistory, isLoading: reconHistLoading } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/reconciliation-history"],
  });

  // ── Action History ────────────────────────────────────────────────────────────
  const ahParams = new URLSearchParams();
  if (ahApplied) {
    if (ahFrom)      ahParams.set("from",         ahFrom);
    if (ahTo)        ahParams.set("to",           ahTo);
    if (ahDivision)  ahParams.set("divisionCode", ahDivision);
    if (ahAdminUid)  ahParams.set("adminUid",     ahAdminUid);
    if (ahBookingId) ahParams.set("bookingId",    ahBookingId);
  }
  const { data: actionHistory, isLoading: ahLoading, refetch: refetchAH } = useQuery<any>({
    queryKey: ["wallet-action-history", { from: ahFrom, to: ahTo, division: ahDivision, adminUid: ahAdminUid, bookingId: ahBookingId, applied: ahApplied }],
    queryFn:  () => fetch(`/api/prestige-pass/admin/wallet/action-history?${ahParams.toString()}`)
                      .then(r => r.json()),
    enabled:  ahApplied,
  });

  // ── Finance Today ─────────────────────────────────────────────────────────────
  const { data: financeToday, isLoading: financeTodayLoading, refetch: refetchFinanceToday } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/finance-today"],
  });

  // ── Exception Summary ────────────────────────────────────────────────────────
  const { data: exceptionSummary, isLoading: exceptionLoading, refetch: refetchException } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/exception-summary"],
    refetchInterval: 120_000,
  });
  const [exceptionExpanded, setExceptionExpanded] = useState(false);

  // ── Anomaly banners ───────────────────────────────────────────────────────────
  const { data: anomalyData } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/anomalies"],
    refetchInterval: 60_000,
  });
  const anomalies: any[] = anomalyData?.anomalies ?? [];
  const hasCritical = anomalies.some((a) => a.severity === "critical");
  const [anomalyExpanded, setAnomalyExpanded] = useState<boolean | null>(null);
  // null = auto: expand if critical, collapse if only warnings
  const isExpanded = anomalyExpanded !== null ? anomalyExpanded : hasCritical;
  const [dismissedCodes, setDismissedCodes] = useState<Set<string>>(new Set());
  const visibleAnomalies = anomalies.filter(
    (a) => !dismissedCodes.has(`${a.code}:${a.userId ?? ""}:${a.bookingId ?? ""}`)
  );

  // ── Release hold mutation ─────────────────────────────────────────────────────
  const { mutate: releaseHold, isPending: releasePending } = useMutation<any, any, { bookingId: string; reason: string }>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/release", vars),
    onSuccess: (data) => {
      toast({ title: `Hold released — txn ${data.txnId}`, variant: "default" });
      setReleaseModal(null);
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Release failed", variant: "destructive" }),
  });

  // ── Refund mutation ───────────────────────────────────────────────────────────
  const { mutate: refundBooking, isPending: refundPending } = useMutation<any, any, { bookingId: string; reason: string; amountCents?: number }>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/refund", vars),
    onSuccess: (data) => {
      toast({ title: `Refund issued — txn ${data.txnId}`, variant: "default" });
      setRefundModal(null);
      setActionReason("");
      setRefundAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Refund failed", variant: "destructive" }),
  });

  // ── Adjust wallet mutation ────────────────────────────────────────────────────
  const [adjustAmountIls, setAdjustAmountIls] = useState("");
  const { mutate: adjustWallet, isPending: adjustPending } = useMutation<any, any, { userId: string; amountCents: number; reason: string; type: "credit" | "debit" }>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/adjust", vars),
    onSuccess: (data) => {
      toast({ title: `Wallet ${data.type}ed — txn ${data.txnId}`, variant: "default" });
      setAdjustModal(null);
      setActionReason("");
      setAdjustAmountIls("");
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/user-audit"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Adjustment failed", variant: "destructive" }),
  });

  // ── Academy force-confirm mutation ───────────────────────────────────────────
  const { mutate: forceConfirm, isPending: forceConfirmPending } = useMutation<any, any, { bookingId: string; reason: string }>({
    mutationFn: (vars) =>
      apiRequest("POST", `/api/prestige-pass/admin/wallet/academy/${vars.bookingId}/force-confirm`, { reason: vars.reason }),
    onSuccess: (data) => {
      toast({ title: `Force confirmed — txn ${data.txnId ?? "n/a"}`, variant: "default" });
      setForceConfirmModal(null);
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Force confirm failed", variant: "destructive" }),
  });

  // ── Academy force-cancel mutation ────────────────────────────────────────────
  const { mutate: forceCancel, isPending: forceCancelPending } = useMutation<any, any, { bookingId: string; reason: string }>({
    mutationFn: (vars) =>
      apiRequest("POST", `/api/prestige-pass/admin/wallet/academy/${vars.bookingId}/force-cancel`, { reason: vars.reason }),
    onSuccess: (data) => {
      toast({ title: `Force cancelled — ${data.action}`, variant: "default" });
      setForceCancelModal(null);
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
    },
    onError: (err) => toast({ title: err?.message ?? "Force cancel failed", variant: "destructive" }),
  });

  // ── Support Actions (2.8C) ───────────────────────────────────────────────────
  const releaseHoldForm = useForm<ReleaseHoldVars>({
    resolver: zodResolver(releaseHoldSchema),
    defaultValues: { bookingId: "", bookingType: "marketplace", reason: "" },
  });
  const issueRefundForm = useForm<IssueRefundVars>({
    resolver: zodResolver(issueRefundSchema),
    defaultValues: { bookingId: "", bookingType: "marketplace", amountIls: 0, reason: "" },
  });
  const supportCreditForm = useForm<SupportCreditVars>({
    resolver: zodResolver(supportCreditSchema),
    defaultValues: { userId: "", amountIls: 0, reason: "" },
  });

  const [releaseHoldConfirm, setReleaseHoldConfirm] = useState<ReleaseHoldVars | null>(null);
  const [issueRefundConfirm, setIssueRefundConfirm] = useState<IssueRefundVars | null>(null);
  const [supportCreditConfirm, setSupportCreditConfirm] = useState<SupportCreditVars | null>(null);

  const [releaseHoldResult, setReleaseHoldResult] = useState<any>(null);
  const [issueRefundResult, setIssueRefundResult] = useState<any>(null);
  const [supportCreditResult, setSupportCreditResult] = useState<any>(null);

  const { mutate: supportRelease, isPending: supportReleasePending } = useMutation<any, any, ReleaseHoldVars>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/support/release-hold", {
      bookingId: vars.bookingId, bookingType: vars.bookingType, reason: vars.reason,
    }),
    onSuccess: (data) => {
      setReleaseHoldResult(data);
      setReleaseHoldConfirm(null);
      releaseHoldForm.reset();
      toast({ title: `Hold released — ₪${((data.releasedCents ?? 0) / 100).toFixed(2)} returned to wallet` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-action-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/anomalies"] });
    },
    onError: (err) => {
      setReleaseHoldConfirm(null);
      toast({ title: err?.detail ?? err?.error ?? "Release failed", variant: "destructive" });
    },
  });

  const { mutate: supportRefund, isPending: supportRefundPending } = useMutation<any, any, IssueRefundVars>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/support/issue-refund", {
      bookingId: vars.bookingId, bookingType: vars.bookingType,
      amountCents: vars.amountIls > 0 ? Math.round(vars.amountIls * 100) : 0,
      reason: vars.reason,
    }),
    onSuccess: (data) => {
      setIssueRefundResult(data);
      setIssueRefundConfirm(null);
      issueRefundForm.reset();
      const label = data.actionTaken === "release" ? "Hold released (degraded)" : "Refund issued";
      toast({ title: `${label} — ₪${((data.amountCents ?? 0) / 100).toFixed(2)}` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-action-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/anomalies"] });
    },
    onError: (err) => {
      setIssueRefundConfirm(null);
      toast({ title: err?.detail ?? err?.error ?? "Refund failed", variant: "destructive" });
    },
  });

  const { mutate: supportCredit, isPending: supportCreditPending } = useMutation<any, any, SupportCreditVars>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/support/credit", {
      userId: vars.userId, amountCents: Math.round(vars.amountIls * 100), reason: vars.reason,
    }),
    onSuccess: (data) => {
      setSupportCreditResult(data);
      setSupportCreditConfirm(null);
      supportCreditForm.reset();
      toast({ title: `₪${((data.creditedCents ?? 0) / 100).toFixed(2)} credited to wallet` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/user-audit"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-action-history"] });
    },
    onError: (err) => {
      setSupportCreditConfirm(null);
      toast({ title: err?.detail ?? err?.error ?? "Credit failed", variant: "destructive" });
    },
  });

  // ── Admin Adjustments ────────────────────────────────────────────────────────
  const adjParams = new URLSearchParams();
  if (adjApplied) {
    if (adjFrom)     adjParams.set("from",         adjFrom);
    if (adjTo)       adjParams.set("to",           adjTo);
    if (adjUserId)   adjParams.set("userId",       adjUserId);
    if (adjDivision) adjParams.set("divisionCode", adjDivision);
  }
  const adjUrl = `/api/prestige-pass/admin/wallet/adjustments?${adjParams.toString()}`;
  const { data: adjData, isLoading: adjLoading, refetch: refetchAdj } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/adjustments", adjApplied, adjFrom, adjTo, adjUserId, adjDivision],
    queryFn: () => fetch(adjUrl, { credentials: "include" }).then(r => r.json()),
    enabled: adjApplied,
  });

  function handleAuditSearch() {
    if (!auditId.trim()) return;
    setAuditSearch(auditId.trim());
  }

  function handleUserAuditSearch() {
    if (!auditUserId.trim()) return;
    setAuditUserSearch(auditUserId.trim());
  }

  function buildExportUrl() {
    const p = new URLSearchParams();
    if (expFrom)      p.set("from",         expFrom);
    if (expTo)        p.set("to",           expTo);
    if (expDivision)  p.set("divisionCode", expDivision);
    if (expEventType) p.set("eventType",    expEventType);
    if (expUserId)    p.set("userId",       expUserId);
    return `/api/prestige-pass/admin/wallet/export.csv?${p.toString()}`;
  }

  function buildBookingsExportUrl() {
    const p = new URLSearchParams();
    if (bkFrom)                                   p.set("from",         bkFrom);
    if (bkTo)                                     p.set("to",           bkTo);
    if (bkFinanceState && bkFinanceState !== "__all__") p.set("financeState", bkFinanceState);
    if (bkSource       && bkSource       !== "__all__") p.set("source",       bkSource);
    if (bkUserId)                                 p.set("userId",       bkUserId);
    return `/api/prestige-pass/admin/wallet/bookings-export.csv?${p.toString()}`;
  }

  // Group division report by division_code
  const divisionGroups: Record<string, any[]> = {};
  if (divisionReport) {
    for (const row of divisionReport) {
      const key = row.division_code ?? row.divisionCode ?? "general";
      if (!divisionGroups[key]) divisionGroups[key] = [];
      divisionGroups[key].push(row);
    }
  }

  return (
    <div className="min-h-screen bg-white" dir="ltr">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <Link href="/admin/finance">
          <span className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <ChevronRight className="w-4 h-4 rotate-180 inline" />
          </span>
        </Link>
        <Wallet className="w-5 h-5" style={{ color: GOLD }} />
        <h1 className="text-xl font-semibold text-gray-900">Wallet Finance Dashboard</h1>
      </div>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* ── Anomaly Banner Zone ───────────────────────────────────────────── */}
        {visibleAnomalies.length > 0 && (
          <div className={`rounded-lg border px-4 py-3 ${hasCritical ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {hasCritical
                  ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                <span className={`text-sm font-semibold ${hasCritical ? "text-red-700" : "text-amber-700"}`}>
                  {visibleAnomalies.filter(a => a.severity === "critical").length > 0
                    ? `${visibleAnomalies.filter(a => a.severity === "critical").length} Critical`
                    : ""}{" "}
                  {visibleAnomalies.filter(a => a.severity === "warning").length > 0
                    ? `${visibleAnomalies.filter(a => a.severity === "warning").length} Warning`
                    : ""}{" "}
                  {visibleAnomalies.length === 1 ? "Anomaly" : "Anomalies"} Detected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAnomalyExpanded(v => v === null ? !hasCritical : !v)}
                  className={`text-xs underline ${hasCritical ? "text-red-600" : "text-amber-600"}`}
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
                <button
                  onClick={() => {
                    const newSet = new Set(dismissedCodes);
                    visibleAnomalies.forEach(a =>
                      newSet.add(`${a.code}:${a.userId ?? ""}:${a.bookingId ?? ""}`)
                    );
                    setDismissedCodes(newSet);
                  }}
                  className={`text-xs underline ${hasCritical ? "text-red-500" : "text-amber-500"}`}
                >
                  Dismiss all
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-3 space-y-2">
                {visibleAnomalies.map((a, idx) => {
                  const key = `${a.code}:${a.userId ?? ""}:${a.bookingId ?? ""}`;
                  const isCrit = a.severity === "critical";
                  return (
                    <div key={idx} className={`flex items-start gap-3 p-2 rounded border text-xs ${isCrit ? "border-red-200 bg-white" : "border-amber-200 bg-white"}`}>
                      {isCrit
                        ? <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                        : <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${isCrit ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {a.code}
                          </span>
                          {a.userId && (
                            <button
                              onClick={() => navigator.clipboard.writeText(a.userId)}
                              title="Copy userId"
                              className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono hover:bg-gray-200 truncate max-w-[140px]"
                            >
                              uid:{a.userId.slice(0, 12)}…
                            </button>
                          )}
                          {a.bookingId && (
                            <button
                              onClick={() => navigator.clipboard.writeText(a.bookingId)}
                              title="Copy bookingId"
                              className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono hover:bg-gray-200 truncate max-w-[140px]"
                            >
                              bk:{a.bookingId.slice(0, 10)}…
                            </button>
                          )}
                        </div>
                        <p className="text-gray-600 mt-0.5 truncate">{a.detail}</p>
                      </div>
                      <button
                        onClick={() => setDismissedCodes(s => new Set([...s, key]))}
                        className="text-gray-400 hover:text-gray-600 shrink-0 ml-1"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="proof">
          <TabsList className="bg-gray-100 flex-wrap h-auto">
            <TabsTrigger value="proof">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Proof Pass
            </TabsTrigger>
            <TabsTrigger value="divisions">
              <BarChart3 className="w-4 h-4 mr-2" />
              Division Report
            </TabsTrigger>
            <TabsTrigger value="audit">
              <BookOpen className="w-4 h-4 mr-2" />
              Booking Audit
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Reconciliation History
            </TabsTrigger>
            <TabsTrigger value="action-history">
              <Clock className="w-4 h-4 mr-2" />
              Action History
            </TabsTrigger>
            <TabsTrigger value="finance">
              <TrendingUp className="w-4 h-4 mr-2" />
              Finance Today
            </TabsTrigger>
            <TabsTrigger value="adjustments">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Adjustments
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </TabsTrigger>
            <TabsTrigger value="support">
              <LifeBuoy className="w-4 h-4 mr-2" />
              Support Actions
            </TabsTrigger>
          </TabsList>

          {/* ── PROOF PASS ── */}
          <TabsContent value="proof" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Wallet Integrity Proof Pass</CardTitle>
                  {proofPass && <VerdictBadge verdict={proofPass.verdict} />}
                </div>
                <p className="text-sm text-gray-500">
                  Runs 6 audit steps: reconciliation, finance-state distribution, negative balance,
                  pending drift, idempotency coverage, and final verdict.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => runProofPass()}
                  disabled={proofPending}
                  style={{ backgroundColor: GOLD, color: "#fff" }}
                  className="hover:opacity-90"
                >
                  {proofPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Run Proof Pass</>
                  )}
                </Button>

                {proofPass && (
                  <div className="space-y-2 mt-2">
                    {proofPass.steps?.map((step: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                      >
                        {step.status === "PASS" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        ) : step.status === "WARN" ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{step.name}</span>
                            <Badge
                              className={
                                step.status === "PASS"
                                  ? "bg-green-100 text-green-700 text-xs"
                                  : step.status === "WARN"
                                  ? "bg-yellow-100 text-yellow-700 text-xs"
                                  : "bg-red-100 text-red-700 text-xs"
                              }
                            >
                              {step.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
                        </div>
                      </div>
                    ))}

                    <div className="mt-3 p-3 rounded-lg border border-gray-200 text-sm text-gray-600">
                      <span className="font-medium">Run at:</span>{" "}
                      {new Date(proofPass.runAt).toLocaleString("he-IL")}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DIVISION REPORT ── */}
          <TabsContent value="divisions" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Wallet Volume by Division</CardTitle>
                <p className="text-sm text-gray-500">
                  Aggregated hold / debit / release / refund totals per division from the wallet ledger.
                </p>
              </CardHeader>
              <CardContent>
                {divLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : !divisionReport || divisionReport.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No data yet.</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(divisionGroups).map(([divCode, rows]) => (
                      <div key={divCode}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                          {DIVISION_LABELS[divCode] ?? divCode}
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Event Type</TableHead>
                              <TableHead className="text-xs text-right">Count</TableHead>
                              <TableHead className="text-xs text-right">Total (ILS)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-sm capitalize">
                                  {(row.event_type ?? row.eventType ?? "—").replace(/_/g, " ")}
                                </TableCell>
                                <TableCell className="text-sm text-right">
                                  {Number(row.count ?? row.txnCount ?? 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-sm text-right font-mono">
                                  {centsToILS(Number(row.total_cents ?? row.totalCents ?? 0))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BOOKING AUDIT + USER WALLET AUDIT ── */}
          <TabsContent value="audit" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Booking Wallet Audit</CardTitle>
                <p className="text-sm text-gray-500">
                  Enter a booking ID (e.g. REQ-2024-XXXX or TRN-2024-XXXX) to view the full
                  wallet ledger timeline for that booking.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Booking ID…"
                    value={auditId}
                    onChange={(e) => setAuditId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuditSearch()}
                    className="max-w-xs"
                  />
                  <Button
                    onClick={handleAuditSearch}
                    style={{ backgroundColor: GOLD, color: "#fff" }}
                    className="hover:opacity-90"
                  >
                    {auditLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {auditSearch && !auditLoading && !auditData && (
                  <p className="text-sm text-gray-500">No ledger entries found for <strong>{auditSearch}</strong>.</p>
                )}

                {auditData && (
                  <div className="space-y-4">
                    {/* Booking summary */}
                    <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Booking ID</p>
                        <p className="text-sm font-mono font-medium">{auditData.booking?.bookingId ?? auditSearch}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Finance State</p>
                        <FinanceStateBadge state={auditData.booking?.financeState ?? "—"} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Hold</p>
                        <p className="text-sm font-mono">{centsToILS(Number(auditData.booking?.walletHoldCents ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Debited</p>
                        <p className="text-sm font-mono">{centsToILS(Number(auditData.booking?.walletDebitedCents ?? 0))}</p>
                      </div>
                    </div>

                    {/* Admin actions */}
                    <div className="flex flex-wrap gap-2">
                      {auditData.booking?.financeState === "hold_active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                          onClick={() => setReleaseModal({
                            bookingId: auditData.booking.bookingId,
                            holdCents: Number(auditData.booking.walletHoldCents ?? 0),
                          })}
                        >
                          <Unlock className="w-3 h-3" /> Release Hold
                        </Button>
                      )}
                      {(auditData.booking?.financeState === "debited" || auditData.booking?.financeState === "hold_active") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs border-blue-400 text-blue-700 hover:bg-blue-50"
                          onClick={() => setRefundModal({
                            bookingId: auditData.booking.bookingId,
                            debitedCents: Number(auditData.booking.walletDebitedCents ?? 0),
                            refundedCents: Number(auditData.booking.walletRefundedCents ?? 0),
                          })}
                        >
                          <RotateCcw className="w-3 h-3" /> Issue Refund
                        </Button>
                      )}

                      {/* Academy-only admin overrides */}
                      {auditData.booking?.divisionCode === "academy" && (
                        <>
                          {(auditData.booking?.financeState === "hold_active" ||
                            auditData.booking?.financeState === "none") &&
                            auditData.booking?.bookingStatus !== "confirmed" &&
                            auditData.booking?.bookingStatus !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs border-green-500 text-green-700 hover:bg-green-50"
                              onClick={() => setForceConfirmModal({
                                bookingId: auditData.booking.bookingId,
                                holdCents: Number(auditData.booking.walletHoldCents ?? 0),
                              })}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Force Confirm
                            </Button>
                          )}
                          {auditData.booking?.bookingStatus !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs border-red-400 text-red-700 hover:bg-red-50"
                              onClick={() => setForceCancelModal({
                                bookingId: auditData.booking.bookingId,
                                financeState: auditData.booking.financeState,
                                amount: Number(
                                  auditData.booking.financeState === "debited"
                                    ? auditData.booking.walletDebitedCents
                                    : auditData.booking.walletHoldCents ?? 0
                                ),
                              })}
                            >
                              <XCircle className="w-3 h-3" /> Force Cancel
                            </Button>
                          )}
                          <span className="self-center text-xs text-gray-400 italic">Admin override</span>
                        </>
                      )}

                      {/* Download signed bundle */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs border-gray-400 text-gray-700 hover:bg-gray-50 ml-auto"
                        onClick={() => window.open(
                          `/api/prestige-pass/admin/wallet/audit-bundle/booking/${encodeURIComponent(auditData.booking?.bookingId ?? auditSearch)}`,
                          '_blank'
                        )}
                      >
                        <FileDown className="w-3 h-3" /> Download Bundle
                      </Button>
                    </div>

                    {/* Ledger entries */}
                    {auditData.entries && auditData.entries.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="text-xs">Time</TableHead>
                            <TableHead className="text-xs">Event</TableHead>
                            <TableHead className="text-xs">Bucket</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Idempotent Key</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditData.entries.map((e: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(e.createdAt ?? e.created_at).toLocaleString("he-IL")}
                              </TableCell>
                              <TableCell className="text-xs capitalize">
                                {(e.eventType ?? e.event_type ?? "—").replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-xs">
                                {e.bucketType ?? e.bucket_type ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {centsToILS(Number(e.amountCents ?? e.amount_cents ?? 0))}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-400 max-w-[180px] truncate">
                                {e.idempotencyKey ?? e.idempotency_key ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── User Wallet Audit ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4" style={{ color: GOLD }} />
                  User Wallet Audit
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Enter a user ID to view their full wallet balance breakdown, booking finance
                  summary, and ledger history (latest 200 entries).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="User ID (Firebase UID)…"
                    value={auditUserId}
                    onChange={(e) => setAuditUserId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUserAuditSearch()}
                    className="max-w-xs"
                  />
                  <Button
                    onClick={handleUserAuditSearch}
                    style={{ backgroundColor: GOLD, color: "#fff" }}
                    className="hover:opacity-90"
                  >
                    {userAuditLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {auditUserSearch && !userAuditLoading && (!userAuditData || userAuditData?.error) && (
                  <p className="text-sm text-gray-500">
                    {userAuditData?.error ?? `No wallet found for user ${auditUserSearch}.`}
                  </p>
                )}

                {userAuditData?.wallet && (
                  <div className="space-y-4">
                    {/* Admin action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs border-green-400 text-green-700 hover:bg-green-50"
                        onClick={() => { setAdjustModal({ userId: auditUserSearch, type: "credit" }); setActionReason(""); setAdjustAmountIls(""); }}
                      >
                        <Plus className="w-3 h-3" /> Credit Wallet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs border-red-400 text-red-700 hover:bg-red-50"
                        onClick={() => { setAdjustModal({ userId: auditUserSearch, type: "debit" }); setActionReason(""); setAdjustAmountIls(""); }}
                      >
                        <Minus className="w-3 h-3" /> Debit Wallet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs border-gray-400 text-gray-700 hover:bg-gray-50 ml-auto"
                        onClick={() => window.open(
                          `/api/prestige-pass/admin/wallet/audit-bundle/user/${encodeURIComponent(auditUserSearch)}`,
                          '_blank'
                        )}
                      >
                        <FileDown className="w-3 h-3" /> Download User Bundle
                      </Button>
                    </div>

                    {/* Balance breakdown */}
                    <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Balance Breakdown</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: "Cash", value: userAuditData.wallet.cashCents },
                          { label: "E-Gift", value: userAuditData.wallet.egiftCents },
                          { label: "Promo", value: userAuditData.wallet.promoCents },
                          { label: "Referral", value: userAuditData.wallet.referralCents },
                          { label: "Pending (held)", value: userAuditData.wallet.pendingCents },
                          { label: "Lifetime Earned", value: userAuditData.wallet.lifetimeEarnedCents },
                          { label: "Lifetime Redeemed", value: userAuditData.wallet.lifetimeRedeemedCents },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-sm font-mono font-medium">{centsToILS(Number(value ?? 0))}</p>
                          </div>
                        ))}
                        <div>
                          <p className="text-xs text-gray-500">Tier</p>
                          <p className="text-sm font-medium capitalize">{userAuditData.wallet.loyaltyTier ?? "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Booking finance summary */}
                    {userAuditData.bookingSummary?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">Booking Finance Summary</p>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Finance State</TableHead>
                              <TableHead className="text-xs text-right">Count</TableHead>
                              <TableHead className="text-xs text-right">Hold</TableHead>
                              <TableHead className="text-xs text-right">Debited</TableHead>
                              <TableHead className="text-xs text-right">Refunded</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userAuditData.bookingSummary.map((row: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs">
                                  <FinanceStateBadge state={row.financeState ?? "—"} />
                                </TableCell>
                                <TableCell className="text-xs text-right">{row.count}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{centsToILS(Number(row.totalHold ?? 0))}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{centsToILS(Number(row.totalDebited ?? 0))}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{centsToILS(Number(row.totalRefunded ?? 0))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Ledger entries */}
                    {userAuditData.ledger?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Ledger Entries (latest {userAuditData.ledger.length})
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Time</TableHead>
                              <TableHead className="text-xs">Event</TableHead>
                              <TableHead className="text-xs">Dir</TableHead>
                              <TableHead className="text-xs">Bucket</TableHead>
                              <TableHead className="text-xs text-right">Amount</TableHead>
                              <TableHead className="text-xs">Division</TableHead>
                              <TableHead className="text-xs">Booking</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userAuditData.ledger.map((e: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                                  {new Date(e.createdAt).toLocaleString("he-IL")}
                                </TableCell>
                                <TableCell className="text-xs capitalize">
                                  {(e.eventType ?? "—").replace(/_/g, " ")}
                                </TableCell>
                                <TableCell className={`text-xs font-medium ${e.direction === "credit" ? "text-green-700" : "text-red-600"}`}>
                                  {e.direction === "credit" ? "↑" : "↓"}
                                </TableCell>
                                <TableCell className="text-xs">{e.bucket ?? "—"}</TableCell>
                                <TableCell className="text-xs text-right font-mono">
                                  {centsToILS(Number(e.amountCents ?? 0))}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {DIVISION_LABELS[e.divisionCode] ?? e.divisionCode ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-gray-400 max-w-[140px] truncate">
                                  {e.bookingId ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RECONCILIATION HISTORY ── */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" style={{ color: GOLD }} />
                  Reconciliation &amp; Proof Pass Run History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reconHistLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : !reconHistory?.runs?.length ? (
                  <p className="text-sm text-gray-500 py-4">No runs recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">Time</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Verdict</TableHead>
                        <TableHead className="text-xs text-right">Duration</TableHead>
                        <TableHead className="text-xs text-right">Drifted</TableHead>
                        <TableHead className="text-xs text-right">Healed</TableHead>
                        <TableHead className="text-xs text-right">Failed</TableHead>
                        <TableHead className="text-xs">Triggered By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconHistory.runs.map((r: any) => (
                        <TableRow key={r.runId}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(r.startedAt ?? r.createdAt).toLocaleString("he-IL")}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {(r.runType ?? "—").replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-xs capitalize">{r.status ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.verdict ? <VerdictBadge verdict={r.verdict} /> : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {r.durationMs != null ? `${r.durationMs} ms` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right">{r.drifted ?? 0}</TableCell>
                          <TableCell className="text-xs text-right text-green-700 font-medium">{r.healed ?? 0}</TableCell>
                          <TableCell className="text-xs text-right text-red-600">{r.failedCount ?? 0}</TableCell>
                          <TableCell className="text-xs font-mono text-gray-500 max-w-[140px] truncate">
                            {r.triggeredBy ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {reconHistory?.total != null && (
                  <p className="text-xs text-gray-400 mt-2">
                    Showing {reconHistory.runs?.length ?? 0} of {reconHistory.total} runs.
                  </p>
                )}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-xs"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = "/api/prestige-pass/admin/wallet/reconciliation-history/export.csv";
                      a.download = `petwash-reconciliation-history-${new Date().toISOString().slice(0,10)}.csv`;
                      a.click();
                    }}
                  >
                    <Download className="w-3 h-3" /> Download History CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ACTION HISTORY ── */}
          <TabsContent value="action-history" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: GOLD }} />
                    Admin Wallet Action History
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      disabled={!ahApplied || ahLoading || !actionHistory?.rows?.length}
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (ahFrom)      params.set("from",         ahFrom);
                        if (ahTo)        params.set("to",           ahTo);
                        if (ahDivision)  params.set("divisionCode", ahDivision);
                        if (ahAdminUid)  params.set("adminUid",     ahAdminUid);
                        if (ahBookingId) params.set("bookingId",    ahBookingId);
                        const a = document.createElement("a");
                        a.href = `/api/prestige-pass/admin/wallet/action-history/export?${params.toString()}`;
                        a.click();
                      }}
                    >
                      <FileDown className="w-3 h-3" /> Export Audit CSV
                    </Button>
                    <span className="text-[10px] text-gray-400 text-right leading-none">
                      Exports current filters · limit 5,000 rows
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter row */}
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">From</label>
                    <Input type="date" className="text-xs h-8 w-36" value={ahFrom} onChange={e => setAhFrom(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">To</label>
                    <Input type="date" className="text-xs h-8 w-36" value={ahTo} onChange={e => setAhTo(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Division</label>
                    <Select value={ahDivision} onValueChange={setAhDivision}>
                      <SelectTrigger className="text-xs h-8 w-36">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="walkers">Walkers</SelectItem>
                        <SelectItem value="petsitter">Sitter Suite</SelectItem>
                        <SelectItem value="academy">Academy</SelectItem>
                        <SelectItem value="station_k9000">K9000</SelectItem>
                        <SelectItem value="pettrek">PetTrek</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Admin UID</label>
                    <Input className="text-xs h-8 w-44" placeholder="firebase uid…" value={ahAdminUid} onChange={e => setAhAdminUid(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Booking ID</label>
                    <Input className="text-xs h-8 w-44" placeholder="BR- or TB-…" value={ahBookingId} onChange={e => setAhBookingId(e.target.value)} />
                  </div>
                  <Button size="sm" className="h-8 text-xs" onClick={() => { setAhApplied(true); refetchAH(); }}>
                    Search
                  </Button>
                  {ahApplied && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-500"
                      onClick={() => { setAhFrom(""); setAhTo(""); setAhDivision(""); setAhAdminUid(""); setAhBookingId(""); setAhApplied(false); }}>
                      Clear
                    </Button>
                  )}
                </div>

                {/* B6 — Filter echo strip (shown once search applied) */}
                {ahApplied && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded px-3 py-2">
                    <span><span className="font-medium text-gray-700">Range:</span> {ahFrom || "—"} → {ahTo || "—"}</span>
                    <span><span className="font-medium text-gray-700">Division:</span> {ahDivision || "all"}</span>
                    <span><span className="font-medium text-gray-700">Admin:</span> {ahAdminUid || "all"}</span>
                    <span><span className="font-medium text-gray-700">Booking:</span> {ahBookingId || "all"}</span>
                    {actionHistory?.total != null && (
                      <span className="ml-auto font-medium text-gray-600">
                        Rows shown: {actionHistory.total}
                      </span>
                    )}
                  </div>
                )}

                {/* Results */}
                {!ahApplied ? (
                  <p className="text-sm text-gray-400 py-6 text-center">
                    Enter filters above and click Search to load admin wallet actions.
                  </p>
                ) : ahLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : !actionHistory?.rows?.length ? (
                  <p className="text-sm text-gray-500 py-6 text-center">
                    No admin wallet actions found for this range.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Admin</TableHead>
                          <TableHead className="text-xs">User</TableHead>
                          <TableHead className="text-xs">Booking</TableHead>
                          <TableHead className="text-xs">Division</TableHead>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Reason</TableHead>
                          <TableHead className="text-xs"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(actionHistory.rows as any[]).map((row: any, i: number) => {
                          const amountILS = (row.amountCents / 100).toFixed(2);
                          const isDebit   = row.source === 'admin_debit';

                          // B7 — Human-readable action label (raw source kept in CSV)
                          const sourceLabel: Record<string, string> = {
                            admin_credit:   "Manual Credit",
                            admin_debit:    "Manual Debit",
                            admin_override: "Admin Override",
                            admin_release:  "Hold Release",
                            admin_refund:   "Refund",
                            admin_adjust:   "Adjustment",
                          };
                          const actionColor: Record<string, string> = {
                            admin_credit:   "bg-green-100 text-green-800",
                            admin_debit:    "bg-red-100 text-red-800",
                            admin_override: "bg-amber-100 text-amber-800",
                            admin_release:  "bg-blue-100 text-blue-800",
                            admin_refund:   "bg-indigo-100 text-indigo-800",
                            admin_adjust:   "bg-gray-100 text-gray-800",
                          };
                          const chipClass = actionColor[row.source] ?? "bg-gray-100 text-gray-700";
                          const chipLabel = sourceLabel[row.source]  ?? row.source;

                          const divisionChip: Record<string, string> = {
                            walkers:       "bg-green-50 text-green-700",
                            petsitter:     "bg-blue-50 text-blue-700",
                            academy:       "bg-purple-50 text-purple-700",
                            station_k9000: "bg-amber-50 text-amber-700",
                          };
                          const divChip = divisionChip[row.divisionCode] ?? "bg-gray-50 text-gray-600";
                          return (
                            <TableRow key={`${row.txnId}-${i}`}>
                              <TableCell className="text-xs font-mono whitespace-nowrap">
                                {new Date(row.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-500 max-w-[120px] truncate" title={row.adminUid ?? ""}>
                                {row.adminUid ? row.adminUid.slice(0, 12) + "…" : "—"}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-500 max-w-[120px] truncate" title={row.userId}>
                                {row.userId.slice(0, 12) + "…"}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {row.bookingId ? (
                                  <span className="text-blue-700 cursor-pointer hover:underline" onClick={() => { setAuditId(row.bookingId); setAuditSearch(row.bookingId); }}>
                                    {row.bookingId.slice(0, 12)}…
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {row.divisionCode ? (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${divChip}`}>{row.divisionCode}</span>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${chipClass}`} title={row.source}>
                                  {chipLabel}
                                </span>
                              </TableCell>
                              <TableCell className={`text-xs font-mono text-right font-semibold ${isDebit ? "text-red-600" : "text-green-700"}`}>
                                {isDebit ? "-" : "+"}₪{amountILS}
                              </TableCell>
                              <TableCell className="text-xs max-w-[200px]">
                                <span className="truncate block" title={row.reason ?? ""}>
                                  {row.reason ?? "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                {row.bookingId && (
                                  <button
                                    className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap hover:bg-gray-50"
                                    onClick={() => window.open(
                                      `/api/prestige-pass/admin/wallet/audit-bundle/booking/${encodeURIComponent(row.bookingId)}`,
                                      '_blank'
                                    )}
                                    title="Download signed audit bundle for this booking"
                                  >
                                    <FileDown className="w-3 h-3" /> Bundle
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-gray-400 mt-2 text-right">
                      {actionHistory.total} result{actionHistory.total !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FINANCE TODAY ── */}
          <TabsContent value="finance" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" style={{ color: GOLD }} />
                    Finance Today
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => refetchFinanceToday()} className="text-xs gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </Button>
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Real-time snapshot of today's wallet activity (00:00 IL → now).
                </p>
              </CardHeader>
              <CardContent>
                {financeTodayLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : !financeToday ? (
                  <p className="text-sm text-gray-500 py-4">No data available.</p>
                ) : (
                  <div className="space-y-6">
                    {/* KPI cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Revenue (Debited)", value: financeToday.totalDebitedCents, color: "text-green-700" },
                        { label: "Holds Placed", value: financeToday.totalHoldCents, color: "text-amber-700" },
                        { label: "Released", value: financeToday.totalReleasedCents, color: "text-blue-700" },
                        { label: "Refunded", value: financeToday.totalRefundedCents, color: "text-red-600" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                          <p className="text-xs text-gray-500 mb-1">{label}</p>
                          <p className={`text-xl font-bold font-mono ${color}`}>{centsToILS(Number(value ?? 0))}</p>
                        </div>
                      ))}
                    </div>

                    {/* Override + Refund KPI cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Admin Overrides Today */}
                      <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
                        <p className="text-xs font-semibold text-orange-700 mb-0.5">Admin Overrides Today</p>
                        <p className="text-xs text-orange-400 mb-3">credits, debits, releases, refunds</p>
                        <p className="text-3xl font-bold text-orange-700 tabular-nums">
                          {financeToday.overridesToday?.count ?? 0}
                        </p>
                        <p className="text-sm font-mono text-orange-600 mt-1">
                          {centsToILS(Number(financeToday.overridesToday?.totalCents ?? 0))}
                        </p>
                      </div>

                      {/* Refunds Today */}
                      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                        <p className="text-xs font-semibold text-blue-700 mb-0.5">Refunds Today</p>
                        <p className="text-xs text-blue-400 mb-3">all booking divisions</p>
                        <p className="text-3xl font-bold text-blue-700 tabular-nums">
                          {financeToday.refundsToday?.count ?? 0}
                        </p>
                        <p className="text-sm font-mono text-blue-600 mt-1">
                          {centsToILS(Number(financeToday.refundsToday?.totalCents ?? 0))}
                        </p>
                      </div>
                    </div>

                    {/* Booking counts */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "New Holds", count: financeToday.holdsCount },
                        { label: "Completed (Debited)", count: financeToday.debitedCount },
                        { label: "Released", count: financeToday.releasedCount },
                        { label: "Refunds", count: financeToday.refundsCount },
                      ].map(({ label, count }) => (
                        <div key={label} className="p-3 rounded-lg border border-gray-100 bg-white">
                          <p className="text-xs text-gray-500 mb-1">{label}</p>
                          <p className="text-2xl font-bold">{count ?? 0}</p>
                        </div>
                      ))}
                    </div>

                    {/* Per-division breakdown */}
                    {financeToday.byDivision?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">By Division</p>
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Division</TableHead>
                              <TableHead className="text-xs text-right">Holds</TableHead>
                              <TableHead className="text-xs text-right">Debited</TableHead>
                              <TableHead className="text-xs text-right">Released</TableHead>
                              <TableHead className="text-xs text-right">Refunded</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {financeToday.byDivision.map((row: any) => (
                              <TableRow key={row.divisionCode}>
                                <TableCell className="text-xs font-medium">
                                  {DIVISION_LABELS[row.divisionCode] ?? row.divisionCode}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono text-amber-700">
                                  {centsToILS(Number(row.holdCents ?? 0))}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono text-green-700">
                                  {centsToILS(Number(row.debitedCents ?? 0))}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono text-blue-700">
                                  {centsToILS(Number(row.releasedCents ?? 0))}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono text-red-600">
                                  {centsToILS(Number(row.refundedCents ?? 0))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* ── Exception Summary ─────────────────────────────── */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        onClick={() => {
                          setExceptionExpanded((v) => !v);
                          if (!exceptionExpanded) refetchException();
                        }}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Exception Summary
                          {exceptionSummary && (
                            (() => {
                              const totalIssues =
                                (exceptionSummary.staleHoldsOver72h?.count ?? 0) +
                                (exceptionSummary.refundExceedsHold?.count ?? 0) +
                                (exceptionSummary.negativeBalances?.count ?? 0) +
                                (exceptionSummary.unresolvedAnomalies?.count ?? 0);
                              return totalIssues > 0 ? (
                                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                  {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                  Clean
                                </span>
                              );
                            })()
                          )}
                        </span>
                        {exceptionExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </button>

                      {exceptionExpanded && (
                        <div className="p-4 space-y-4">
                          {exceptionLoading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Loading exception data…
                            </div>
                          ) : !exceptionSummary ? (
                            <p className="text-sm text-gray-400">No data.</p>
                          ) : (
                            <>
                              {/* 4 metric cards */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                  {
                                    label: "Stale Holds > 72h",
                                    count: exceptionSummary.staleHoldsOver72h?.count ?? 0,
                                    sub: centsToILS(exceptionSummary.staleHoldsOver72h?.totalCents ?? 0),
                                    color: (exceptionSummary.staleHoldsOver72h?.count ?? 0) > 0 ? "border-amber-300 bg-amber-50" : "border-gray-100 bg-white",
                                    textColor: (exceptionSummary.staleHoldsOver72h?.count ?? 0) > 0 ? "text-amber-700" : "text-gray-400",
                                  },
                                  {
                                    label: "Refund > Hold",
                                    count: exceptionSummary.refundExceedsHold?.count ?? 0,
                                    sub: centsToILS(exceptionSummary.refundExceedsHold?.totalCents ?? 0),
                                    color: (exceptionSummary.refundExceedsHold?.count ?? 0) > 0 ? "border-red-300 bg-red-50" : "border-gray-100 bg-white",
                                    textColor: (exceptionSummary.refundExceedsHold?.count ?? 0) > 0 ? "text-red-700" : "text-gray-400",
                                  },
                                  {
                                    label: "Negative Balances",
                                    count: exceptionSummary.negativeBalances?.count ?? 0,
                                    sub: null,
                                    color: (exceptionSummary.negativeBalances?.count ?? 0) > 0 ? "border-red-400 bg-red-100" : "border-gray-100 bg-white",
                                    textColor: (exceptionSummary.negativeBalances?.count ?? 0) > 0 ? "text-red-800 font-bold" : "text-gray-400",
                                  },
                                  {
                                    label: "Unresolved Anomalies",
                                    count: exceptionSummary.unresolvedAnomalies?.count ?? 0,
                                    sub: null,
                                    color: (exceptionSummary.unresolvedAnomalies?.count ?? 0) > 0 ? "border-orange-300 bg-orange-50" : "border-gray-100 bg-white",
                                    textColor: (exceptionSummary.unresolvedAnomalies?.count ?? 0) > 0 ? "text-orange-700" : "text-gray-400",
                                  },
                                ].map(({ label, count, sub, color, textColor }) => (
                                  <div key={label} className={`p-3 rounded-lg border ${color}`}>
                                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                                    <p className={`text-2xl font-bold tabular-nums ${textColor}`}>{count}</p>
                                    {sub !== null && (
                                      <p className={`text-xs font-mono mt-0.5 ${textColor}`}>{sub}</p>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Top Offenders */}
                              {exceptionSummary.topOffenders?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" /> Top Offenders
                                  </p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-gray-50">
                                        <TableHead className="text-xs">User ID</TableHead>
                                        <TableHead className="text-xs text-right">Issues</TableHead>
                                        <TableHead className="text-xs">Description</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {exceptionSummary.topOffenders.map((row: any, idx: number) => (
                                        <TableRow key={row.userId ?? idx}>
                                          <TableCell className="text-xs font-mono max-w-[150px] truncate">{row.userId ?? "—"}</TableCell>
                                          <TableCell className="text-xs text-right font-bold text-red-700">{row.issueCount}</TableCell>
                                          <TableCell className="text-xs text-gray-600">{row.description}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}

                              {exceptionSummary.asOf && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Exception snapshot as of {new Date(exceptionSummary.asOf).toLocaleString("he-IL")}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {financeToday.asOf && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Snapshot as of {new Date(financeToday.asOf).toLocaleString("he-IL")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ADMIN ADJUSTMENTS ── */}
          <TabsContent value="adjustments" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" style={{ color: GOLD }} />
                  Admin / Reversal Ledger Adjustments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From</label>
                    <Input type="date" value={adjFrom} onChange={e => setAdjFrom(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To</label>
                    <Input type="date" value={adjTo} onChange={e => setAdjTo(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">User ID</label>
                    <Input placeholder="uid…" value={adjUserId} onChange={e => setAdjUserId(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Division</label>
                    <Input placeholder="e.g. academy" value={adjDivision} onChange={e => setAdjDivision(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="text-white"
                  style={{ background: GOLD }}
                  onClick={() => setAdjApplied(true)}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search Adjustments
                </Button>

                {adjLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                )}

                {adjApplied && !adjLoading && !adjData?.entries?.length && (
                  <p className="text-sm text-gray-500">No adjustment entries found.</p>
                )}

                {adjData?.entries?.length > 0 && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">Event</TableHead>
                          <TableHead className="text-xs">Division</TableHead>
                          <TableHead className="text-xs">Bucket</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">User ID</TableHead>
                          <TableHead className="text-xs">Created By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adjData.entries.map((e: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(e.createdAt).toLocaleString("he-IL")}
                            </TableCell>
                            <TableCell className="text-xs capitalize">
                              {(e.eventType ?? "—").replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-xs">
                              {DIVISION_LABELS[e.divisionCode] ?? e.divisionCode ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs">{e.bucket ?? "—"}</TableCell>
                            <TableCell className={`text-xs text-right font-mono font-medium ${e.direction === "credit" ? "text-green-700" : "text-red-600"}`}>
                              {e.direction === "credit" ? "+" : "−"}{centsToILS(Number(e.amountCents ?? 0))}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-gray-500 max-w-[120px] truncate">{e.userId ?? "—"}</TableCell>
                            <TableCell className="text-xs font-mono text-gray-500 max-w-[120px] truncate">{e.createdBy ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-gray-400">
                      Showing {adjData.entries.length} of {adjData.total} entries.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EXPORT CSV ── */}
          <TabsContent value="export" className="mt-4 space-y-4">

            {/* ── Section A: Wallet Ledger CSV ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4" style={{ color: GOLD }} />
                  Wallet Ledger CSV
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Raw ledger entries from <code className="text-xs bg-gray-100 px-1 rounded">wallet_ledger_entries</code>.
                  Up to 50,000 rows. All filters optional.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From Date</label>
                    <Input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To Date</label>
                    <Input type="date" value={expTo} onChange={e => setExpTo(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Division Code</label>
                    <Input placeholder="e.g. academy" value={expDivision} onChange={e => setExpDivision(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Event Type</label>
                    <Input placeholder="e.g. hold" value={expEventType} onChange={e => setExpEventType(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">User ID</label>
                    <Input placeholder="uid…" value={expUserId} onChange={e => setExpUserId(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="text-white gap-2"
                  style={{ background: GOLD }}
                  onClick={() => {
                    const url = buildExportUrl();
                    const a = document.createElement("a");
                    a.href = url;
                    const from = expFrom || "all";
                    const to   = expTo   || new Date().toISOString().slice(0, 10);
                    a.download = `petwash-wallet-ledger-${from}_to_${to}.csv`;
                    a.click();
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download Ledger CSV
                </Button>
                <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Columns:</p>
                  <p className="text-xs text-gray-500 font-mono leading-relaxed">
                    created_at · user_id · wallet_id · division_code · source_type · event_type ·
                    direction · amount_cents · currency · bucket · idempotency_key · booking_id · created_by · metadata_json
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Section B: Booking Finance CSV ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileDown className="w-4 h-4" style={{ color: GOLD }} />
                  Booking Finance CSV
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Booking-level wallet lifecycle state. Covers walkers, sitters, and academy in one
                  export. Includes <code className="text-xs bg-gray-100 px-1 rounded">finance_state</code>,
                  hold / debit / refund amounts, and idempotency keys — ready for reconciliation.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From Date</label>
                    <Input type="date" value={bkFrom} onChange={e => setBkFrom(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To Date</label>
                    <Input type="date" value={bkTo} onChange={e => setBkTo(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Finance State</label>
                    <Select value={bkFinanceState || "__all__"} onValueChange={v => setBkFinanceState(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="All states" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All states</SelectItem>
                        <SelectItem value="none">none</SelectItem>
                        <SelectItem value="hold_active">hold_active</SelectItem>
                        <SelectItem value="debited">debited</SelectItem>
                        <SelectItem value="released">released</SelectItem>
                        <SelectItem value="refunded">refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Source</label>
                    <Select value={bkSource || "__all__"} onValueChange={v => setBkSource(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="All sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All sources</SelectItem>
                        <SelectItem value="booking">booking (walkers + sitters)</SelectItem>
                        <SelectItem value="academy">academy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">User ID</label>
                    <Input placeholder="uid…" value={bkUserId} onChange={e => setBkUserId(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="text-white gap-2"
                  style={{ background: GOLD }}
                  onClick={() => {
                    const url = buildBookingsExportUrl();
                    const a = document.createElement("a");
                    a.href = url;
                    const from = bkFrom || "all";
                    const to   = bkTo   || new Date().toISOString().slice(0, 10);
                    const state = bkFinanceState && bkFinanceState !== "__all__" ? `-${bkFinanceState}` : "";
                    a.download = `petwash-booking-finance${state}-${from}_to_${to}.csv`;
                    a.click();
                  }}
                >
                  <FileDown className="w-4 h-4" />
                  Download Booking Finance CSV
                </Button>
                <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Columns:</p>
                  <p className="text-xs text-gray-500 font-mono leading-relaxed">
                    booking_id · source_type · division_code · customer_id · provider_id · status ·
                    finance_state · wallet_hold_cents · wallet_debited_cents · wallet_refunded_cents ·
                    wallet_hold_key · wallet_debit_key · wallet_release_key · wallet_refund_key ·
                    total_cents · currency · created_at
                  </p>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* ── SUPPORT ACTIONS ── */}
          <TabsContent value="support" className="mt-4 space-y-4">

            {/* Card 1 — Force Release Hold */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-amber-600" /> Force Release Hold
                </CardTitle>
                <p className="text-sm text-gray-500">Release a stuck hold on a booking and return funds to the customer.</p>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={releaseHoldForm.handleSubmit((vals) => setReleaseHoldConfirm(vals))}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Booking ID</label>
                      <Input
                        placeholder="REQ-… or TRN-…"
                        {...releaseHoldForm.register("bookingId")}
                        className={releaseHoldForm.formState.errors.bookingId ? "border-red-400" : ""}
                      />
                      {releaseHoldForm.formState.errors.bookingId && (
                        <p className="text-xs text-red-500 mt-0.5">{releaseHoldForm.formState.errors.bookingId.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Booking Type</label>
                      <Controller
                        control={releaseHoldForm.control}
                        name="bookingType"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className={releaseHoldForm.formState.errors.bookingType ? "border-red-400" : ""}>
                              <SelectValue placeholder="Select type…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="marketplace">Marketplace</SelectItem>
                              <SelectItem value="academy">Academy</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Reason (required, min 5 chars)</label>
                    <Textarea
                      placeholder="e.g. Provider no-show confirmed by ops team…"
                      {...releaseHoldForm.register("reason")}
                      className={`text-sm ${releaseHoldForm.formState.errors.reason ? "border-red-400" : ""}`}
                      rows={2}
                    />
                    {releaseHoldForm.formState.errors.reason && (
                      <p className="text-xs text-red-500 mt-0.5">{releaseHoldForm.formState.errors.reason.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={supportReleasePending}
                  >
                    {supportReleasePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                    Release Hold
                  </Button>
                </form>
                {releaseHoldResult && (
                  <div className="mt-3 p-3 rounded-lg border border-green-200 bg-green-50 text-sm space-y-1">
                    <p className="font-medium text-green-800 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Hold Released</p>
                    <p className="text-xs text-green-700">Released: <strong>{centsToILS(releaseHoldResult.releasedCents ?? 0)}</strong></p>
                    <p className="text-xs font-mono text-green-600">TxnID: {releaseHoldResult.txnId}</p>
                    {releaseHoldResult.idempotent && <p className="text-xs text-amber-600">⚠ Idempotent — already released</p>}
                    {releaseHoldResult.walletSnapshot && (
                      <p className="text-xs text-green-700">New cash balance: <strong>{centsToILS(releaseHoldResult.walletSnapshot.cashCents)}</strong></p>
                    )}
                    <button className="text-xs underline text-green-600" onClick={() => setReleaseHoldResult(null)}>Clear</button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 2 — Issue Refund */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-600" /> Issue Refund
                </CardTitle>
                <p className="text-sm text-gray-500">Refund a debited booking. If the booking is still on hold, the system will automatically degrade to a release.</p>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={issueRefundForm.handleSubmit((vals) => setIssueRefundConfirm(vals))}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Booking ID</label>
                      <Input
                        placeholder="REQ-… or TRN-…"
                        {...issueRefundForm.register("bookingId")}
                        className={issueRefundForm.formState.errors.bookingId ? "border-red-400" : ""}
                      />
                      {issueRefundForm.formState.errors.bookingId && (
                        <p className="text-xs text-red-500 mt-0.5">{issueRefundForm.formState.errors.bookingId.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Booking Type</label>
                      <Controller
                        control={issueRefundForm.control}
                        name="bookingType"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className={issueRefundForm.formState.errors.bookingType ? "border-red-400" : ""}>
                              <SelectValue placeholder="Select type…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="marketplace">Marketplace</SelectItem>
                              <SelectItem value="academy">Academy</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Amount (₪) — <span className="font-normal text-gray-500">leave 0 for full refundable amount</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0 = full amount"
                      {...issueRefundForm.register("amountIls")}
                      className={`max-w-xs ${issueRefundForm.formState.errors.amountIls ? "border-red-400" : ""}`}
                    />
                    {issueRefundForm.formState.errors.amountIls && (
                      <p className="text-xs text-red-500 mt-0.5">{issueRefundForm.formState.errors.amountIls.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Reason (required, min 5 chars)</label>
                    <Textarea
                      placeholder="e.g. Customer disputes charge, service not delivered…"
                      {...issueRefundForm.register("reason")}
                      className={`text-sm ${issueRefundForm.formState.errors.reason ? "border-red-400" : ""}`}
                      rows={2}
                    />
                    {issueRefundForm.formState.errors.reason && (
                      <p className="text-xs text-red-500 mt-0.5">{issueRefundForm.formState.errors.reason.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={supportRefundPending}
                  >
                    {supportRefundPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Issue Refund
                  </Button>
                </form>
                {issueRefundResult && (
                  <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm space-y-1">
                    <p className="font-medium text-blue-800 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {issueRefundResult.actionTaken === "release" ? "Degraded to Release" : "Refund Issued"}
                    </p>
                    {issueRefundResult.actionTaken === "release" && (
                      <p className="text-xs text-amber-700 font-medium">ℹ Booking was hold_active — release performed instead of refund</p>
                    )}
                    <p className="text-xs text-blue-700">Amount: <strong>{centsToILS(issueRefundResult.amountCents ?? 0)}</strong></p>
                    <p className="text-xs font-mono text-blue-600">TxnID: {issueRefundResult.txnId}</p>
                    {issueRefundResult.walletSnapshot && (
                      <p className="text-xs text-blue-700">New cash balance: <strong>{centsToILS(issueRefundResult.walletSnapshot.cashCents)}</strong></p>
                    )}
                    <button className="text-xs underline text-blue-600" onClick={() => setIssueRefundResult(null)}>Clear</button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 3 — Manual Credit */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" /> Manual Credit
                </CardTitle>
                <p className="text-sm text-gray-500">Grant a one-off cash wallet credit directly to a user. Max ₪500 per action.</p>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={supportCreditForm.handleSubmit((vals) => setSupportCreditConfirm(vals))}
                >
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">User ID (Firebase UID)</label>
                    <Input
                      placeholder="Firebase UID…"
                      {...supportCreditForm.register("userId")}
                      className={supportCreditForm.formState.errors.userId ? "border-red-400" : ""}
                    />
                    {supportCreditForm.formState.errors.userId && (
                      <p className="text-xs text-red-500 mt-0.5">{supportCreditForm.formState.errors.userId.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Amount (₪) — max ₪500</label>
                    <Input
                      type="number"
                      min="0.01"
                      max="500"
                      step="0.01"
                      placeholder="e.g. 50"
                      {...supportCreditForm.register("amountIls")}
                      className={`max-w-xs ${supportCreditForm.formState.errors.amountIls ? "border-red-400" : ""}`}
                    />
                    {supportCreditForm.formState.errors.amountIls && (
                      <p className="text-xs text-red-500 mt-0.5">{supportCreditForm.formState.errors.amountIls.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Reason (required, min 5 chars)</label>
                    <Textarea
                      placeholder="e.g. Goodwill gesture for app error on 2026-03-20…"
                      {...supportCreditForm.register("reason")}
                      className={`text-sm ${supportCreditForm.formState.errors.reason ? "border-red-400" : ""}`}
                      rows={2}
                    />
                    {supportCreditForm.formState.errors.reason && (
                      <p className="text-xs text-red-500 mt-0.5">{supportCreditForm.formState.errors.reason.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={supportCreditPending}
                  >
                    {supportCreditPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Credit Wallet
                  </Button>
                </form>
                {supportCreditResult && (
                  <div className="mt-3 p-3 rounded-lg border border-green-200 bg-green-50 text-sm space-y-1">
                    <p className="font-medium text-green-800 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Credit Applied</p>
                    <p className="text-xs text-green-700">Credited: <strong>{centsToILS(supportCreditResult.creditedCents ?? 0)}</strong></p>
                    <p className="text-xs font-mono text-green-600">TxnID: {supportCreditResult.txnId}</p>
                    {supportCreditResult.walletSnapshot && (
                      <p className="text-xs text-green-700">New cash balance: <strong>{centsToILS(supportCreditResult.walletSnapshot.cashCents)}</strong></p>
                    )}
                    <button className="text-xs underline text-green-600" onClick={() => setSupportCreditResult(null)}>Clear</button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ── Support: Release Hold Confirm ──────────────────────────────────────── */}
      <Dialog open={!!releaseHoldConfirm} onOpenChange={(open) => !open && setReleaseHoldConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-amber-600" /> Confirm Release Hold
            </DialogTitle>
          </DialogHeader>
          {releaseHoldConfirm && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Release the hold on booking <code className="font-mono text-xs">{releaseHoldConfirm.bookingId}</code> ({releaseHoldConfirm.bookingType}).
                Funds will be returned to the customer's available balance.
              </div>
              <p className="text-xs text-gray-600"><span className="font-medium">Reason:</span> {releaseHoldConfirm.reason}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReleaseHoldConfirm(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={supportReleasePending}
              onClick={() => releaseHoldConfirm && supportRelease(releaseHoldConfirm)}
            >
              {supportReleasePending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Support: Issue Refund Confirm ──────────────────────────────────────── */}
      <Dialog open={!!issueRefundConfirm} onOpenChange={(open) => !open && setIssueRefundConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600" /> Confirm Issue Refund
            </DialogTitle>
          </DialogHeader>
          {issueRefundConfirm && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                Issue refund for booking <code className="font-mono text-xs">{issueRefundConfirm.bookingId}</code> ({issueRefundConfirm.bookingType}).
                {issueRefundConfirm.amountIls > 0
                  ? <> Amount: <strong>₪{issueRefundConfirm.amountIls.toFixed(2)}</strong>.</>
                  : <> Full refundable amount will be returned.</>
                }
                {" "}If booking is still hold_active, the system will perform a release instead.
              </div>
              <p className="text-xs text-gray-600"><span className="font-medium">Reason:</span> {issueRefundConfirm.reason}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIssueRefundConfirm(null)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={supportRefundPending}
              onClick={() => issueRefundConfirm && supportRefund(issueRefundConfirm)}
            >
              {supportRefundPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Support: Manual Credit Confirm ────────────────────────────────────── */}
      <Dialog open={!!supportCreditConfirm} onOpenChange={(open) => !open && setSupportCreditConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-600" /> Confirm Manual Credit
            </DialogTitle>
          </DialogHeader>
          {supportCreditConfirm && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                Credit <strong>₪{supportCreditConfirm.amountIls.toFixed(2)}</strong> to user{" "}
                <code className="font-mono text-xs">{supportCreditConfirm.userId}</code>.
                This will appear in the ledger and action history immediately.
              </div>
              <p className="text-xs text-gray-600"><span className="font-medium">Reason:</span> {supportCreditConfirm.reason}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSupportCreditConfirm(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={supportCreditPending}
              onClick={() => supportCreditConfirm && supportCredit(supportCreditConfirm)}
            >
              {supportCreditPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Release Hold Modal ─────────────────────────────────────────────────── */}
      <Dialog open={!!releaseModal} onOpenChange={(open) => !open && setReleaseModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-amber-600" /> Release Hold
            </DialogTitle>
          </DialogHeader>
          {releaseModal && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Release hold of <strong>{centsToILS(releaseModal.holdCents)}</strong> on booking{" "}
                <code className="text-xs font-mono">{releaseModal.bookingId}</code>. Funds will be
                returned to the customer's available balance.
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Reason (required)</label>
                <Textarea
                  placeholder="e.g. Provider no-show, manual cancellation by ops…"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseModal(null)}>Cancel</Button>
            <Button
              className="text-white"
              style={{ background: "#B45309" }}
              disabled={!actionReason.trim() || releasePending}
              onClick={() => releaseModal && releaseHold({ bookingId: releaseModal.bookingId, reason: actionReason.trim() })}
            >
              {releasePending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
              Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Refund Modal ───────────────────────────────────────────────────────── */}
      <Dialog open={!!refundModal} onOpenChange={(open) => !open && setRefundModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600" /> Issue Refund
            </DialogTitle>
          </DialogHeader>
          {refundModal && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                Booking <code className="text-xs font-mono">{refundModal.bookingId}</code><br />
                Debited: <strong>{centsToILS(refundModal.debitedCents)}</strong> —
                Already refunded: <strong>{centsToILS(refundModal.refundedCents)}</strong>.<br />
                Leave amount blank for full refund.
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Partial refund amount (ILS) — leave empty for full</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 25.00"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Reason (required)</label>
                <Textarea
                  placeholder="e.g. Service not delivered, customer complaint resolved…"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundModal(null)}>Cancel</Button>
            <Button
              className="text-white"
              style={{ background: "#1D4ED8" }}
              disabled={!actionReason.trim() || refundPending}
              onClick={() => {
                if (!refundModal) return;
                const amountCents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined;
                refundBooking({ bookingId: refundModal.bookingId, reason: actionReason.trim(), amountCents });
              }}
            >
              {refundPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Confirm Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Force Confirm Modal (Academy admin override) ───────────────────────── */}
      <Dialog open={!!forceConfirmModal} onOpenChange={(open) => !open && setForceConfirmModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Force Confirm — Admin Override
            </DialogTitle>
          </DialogHeader>
          {forceConfirmModal && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                <p>Force-confirming booking <code className="text-xs font-mono">{forceConfirmModal.bookingId}</code>.</p>
                {forceConfirmModal.holdCents > 0 && (
                  <p className="mt-1">
                    Will debit <strong>{centsToILS(forceConfirmModal.holdCents)}</strong> from the customer's wallet hold.
                  </p>
                )}
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-green-700">
                  Source: admin_override — this action is fully audited.
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Reason (required)</label>
                <Textarea
                  placeholder="e.g. Trainer unreachable, ops manual confirmation…"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceConfirmModal(null)}>Cancel</Button>
            <Button
              className="text-white bg-green-700 hover:bg-green-800"
              disabled={!actionReason.trim() || forceConfirmPending}
              onClick={() => forceConfirmModal && forceConfirm({ bookingId: forceConfirmModal.bookingId, reason: actionReason.trim() })}
            >
              {forceConfirmPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Force Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Force Cancel Modal (Academy admin override) ────────────────────────── */}
      <Dialog open={!!forceCancelModal} onOpenChange={(open) => !open && setForceCancelModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" /> Force Cancel — Admin Override
            </DialogTitle>
          </DialogHeader>
          {forceCancelModal && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                <p>Force-cancelling booking <code className="text-xs font-mono">{forceCancelModal.bookingId}</code>.</p>
                {forceCancelModal.financeState === "hold_active" && forceCancelModal.amount > 0 && (
                  <p className="mt-1">Will <strong>release the hold</strong> of <strong>{centsToILS(forceCancelModal.amount)}</strong> back to the customer's wallet.</p>
                )}
                {forceCancelModal.financeState === "debited" && forceCancelModal.amount > 0 && (
                  <p className="mt-1">Will <strong>refund</strong> <strong>{centsToILS(forceCancelModal.amount)}</strong> back to the customer's wallet.</p>
                )}
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                  Source: admin_override — this action is fully audited.
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Reason (required)</label>
                <Textarea
                  placeholder="e.g. Trainer no-show, booking error, customer escalation resolved…"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceCancelModal(null)}>Keep Booking</Button>
            <Button
              className="text-white bg-red-600 hover:bg-red-700"
              disabled={!actionReason.trim() || forceCancelPending}
              onClick={() => forceCancelModal && forceCancel({ bookingId: forceCancelModal.bookingId, reason: actionReason.trim() })}
            >
              {forceCancelPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Force Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adjust Wallet Modal ────────────────────────────────────────────────── */}
      <Dialog open={!!adjustModal} onOpenChange={(open) => !open && setAdjustModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustModal?.type === "credit"
                ? <Plus className="w-4 h-4 text-green-600" />
                : <Minus className="w-4 h-4 text-red-600" />}
              {adjustModal?.type === "credit" ? "Credit Wallet" : "Debit Wallet"}
            </DialogTitle>
          </DialogHeader>
          {adjustModal && (
            <div className="space-y-4 py-2">
              <div className={`p-3 rounded-lg border text-sm ${adjustModal.type === "credit" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                Manual {adjustModal.type} on wallet of user{" "}
                <code className="text-xs font-mono">{adjustModal.userId}</code>. This creates a full
                ledger audit entry. Cash wallet bucket only.
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Amount (ILS)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 50.00"
                  value={adjustAmountIls}
                  onChange={(e) => setAdjustAmountIls(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Reason (required)</label>
                <Textarea
                  placeholder="e.g. Compensation for service issue, admin correction…"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal(null)}>Cancel</Button>
            <Button
              className="text-white"
              style={{ background: adjustModal?.type === "credit" ? "#15803D" : "#DC2626" }}
              disabled={!actionReason.trim() || !adjustAmountIls || adjustPending}
              onClick={() => {
                if (!adjustModal || !adjustAmountIls) return;
                const amountCents = Math.round(parseFloat(adjustAmountIls) * 100);
                adjustWallet({ userId: adjustModal.userId, amountCents, reason: actionReason.trim(), type: adjustModal.type });
              }}
            >
              {adjustPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : adjustModal?.type === "credit" ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
              Confirm {adjustModal?.type === "credit" ? "Credit" : "Debit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
