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
  Settings,
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
  Lock,
  CalendarDays,
  DollarSign,
  Package,
  Activity,
  FileText,
  Filter,
  CalendarClock,
  GitMerge,
  LayoutDashboard,
  Archive,
  RefreshCcw,
  PlayCircle,
  Eye,
  ShieldAlert,
  Bell,
  Send,
  FileSignature,
  FolderSearch,
  GitCompare,
  Scale,
  FlaskConical,
  Building2,
  Layers,
  CheckCircle,
  Bot,
  ListChecks,
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
  bookingId:            z.string().min(1, "Booking ID required"),
  bookingType:          z.enum(["marketplace", "academy"], { required_error: "Select booking type" }),
  amountIls:            z.coerce.number().min(0, "Amount must be ≥ 0"),
  reason:               z.string().min(5, "Reason must be at least 5 characters"),
  linkedDisputeCaseRef: z.string().optional(),
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

  // ── Reversal modal ───────────────────────────────────────────────────────────
  const [reverseModal, setReverseModal] = useState<{
    txnId: string; source: string; amountCents: number; userId: string;
  } | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseResult, setReverseResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Disputes tab (2.9C) ──────────────────────────────────────────────────────
  const [dispStatus,   setDispStatus]   = useState("");
  const [dispDivision, setDispDivision] = useState("");
  const [dispAssigned, setDispAssigned] = useState("");
  const [dispBooking,  setDispBooking]  = useState("");
  const [dispApplied,  setDispApplied]  = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [drawerNote,   setDrawerNote]   = useState("");
  const [resolveMode,  setResolveMode]  = useState(false);
  const [resolveType,  setResolveType]  = useState<string>("no_action");
  const [resolveCents, setResolveCents] = useState("");
  const [resolveNote,  setResolveNote]  = useState("");
  const [openForm,     setOpenForm]     = useState(false);
  // 3.0C Apply Resolution state
  const [applyResMode,    setApplyResMode]    = useState(false);
  const [applyResAction,  setApplyResAction]  = useState<"refund"|"clawback"|"none">("none");
  const [applyResBatchId, setApplyResBatchId] = useState("");
  const [applyResRefundAmt,     setApplyResRefundAmt]     = useState("");
  const [applyResRefundBooking, setApplyResRefundBooking] = useState("");
  const [applyResRefundNote,    setApplyResRefundNote]    = useState("");
  const [applyResClawbackAmt,   setApplyResClawbackAmt]   = useState("");
  const [applyResClawbackUid,   setApplyResClawbackUid]   = useState("");
  const [applyResClawbackDiv,   setApplyResClawbackDiv]   = useState("");
  const [applyResClawbackNote,  setApplyResClawbackNote]  = useState("");
  const [applyResResult,        setApplyResResult]        = useState<any>(null);
  const [newComplainantUid,  setNewComplainantUid]  = useState("");
  const [newComplainantType, setNewComplainantType] = useState<"customer"|"provider">("customer");
  const [newBookingId,       setNewBookingId]       = useState("");
  const [newDivision,        setNewDivision]        = useState("");
  const [newAmount,          setNewAmount]          = useState("");
  const [newOpeningNote,     setNewOpeningNote]     = useState("");
  const [assignUid,          setAssignUid]          = useState("");

  const dispParams = new URLSearchParams();
  if (dispApplied) {
    if (dispStatus)   dispParams.set("status",           dispStatus);
    if (dispDivision) dispParams.set("divisionCode",     dispDivision);
    if (dispAssigned) dispParams.set("assignedAdminUid", dispAssigned);
    if (dispBooking)  dispParams.set("bookingId",        dispBooking);
  }

  const { data: dispData, isLoading: dispLoading, refetch: refetchDisp } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/disputes", dispApplied, dispStatus, dispDivision, dispAssigned, dispBooking],
    queryFn:  () => fetch(`/api/prestige-pass/admin/wallet/disputes?${dispParams.toString()}`, { credentials: "include" }).then(r => r.json()),
    enabled:  dispApplied,
  });

  const { mutate: openDispute, isPending: openDispPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest("POST", "/api/prestige-pass/admin/wallet/disputes", body),
    onSuccess: (data) => {
      toast({ title: `Dispute ${data.dispute?.case_ref} opened` });
      setOpenForm(false); setNewComplainantUid(""); setNewBookingId(""); setNewDivision(""); setNewAmount(""); setNewOpeningNote("");
      setDispApplied(true);
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/disputes"] });
    },
    onError: (err) => toast({ title: err?.error ?? "Open dispute failed", variant: "destructive" }),
  });

  const { mutate: patchDispute, isPending: patchPending } = useMutation<any, any, { caseRef: string; body: any }>({
    mutationFn: ({ caseRef, body }) => apiRequest("PATCH", `/api/prestige-pass/admin/wallet/disputes/${caseRef}`, body),
    onSuccess: (data) => {
      setSelectedDispute(data.dispute);
      setDrawerNote(""); setAssignUid("");
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/disputes"] });
    },
    onError: (err) => toast({ title: err?.error ?? "Update failed", variant: "destructive" }),
  });

  const { mutate: resolveDispute, isPending: resolvePending } = useMutation<any, any, { caseRef: string; body: any }>({
    mutationFn: ({ caseRef, body }) => apiRequest("POST", `/api/prestige-pass/admin/wallet/disputes/${caseRef}/resolve`, body),
    onSuccess: (data) => {
      setSelectedDispute(data.dispute);
      setResolveMode(false); setResolveNote(""); setResolveCents("");
      toast({ title: `Dispute resolved: ${data.dispute?.resolution_type}` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/disputes"] });
    },
    onError: (err) => toast({ title: err?.error ?? "Resolve failed", variant: "destructive" }),
  });

  // 3.0C — Apply Resolution mutation
  const { mutate: applyResolution, isPending: applyResPending } = useMutation<any, any, { caseRef: string; body: any }>({
    mutationFn: ({ caseRef, body }) => apiRequest("POST", `/api/prestige-pass/admin/wallet/disputes/${caseRef}/apply-resolution`, body),
    onSuccess: (data) => {
      setApplyResResult(data);
      setApplyResMode(false);
      toast({ title: `Resolution applied: ${data.action}${data.refundRequestId ? ` — refund ${data.refundRequestId}` : ''}${data.clawbackId ? ` — clawback ${data.clawbackId}` : ''}` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/disputes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/payout-ledger"] });
    },
    onError: (err: any) => toast({ title: err?.error ?? "Apply resolution failed", variant: "destructive" }),
  });

  // ── Settlement tab (2.9B) ─────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [settlFrom,    setSettlFrom]    = useState(firstOfMonth);
  const [settlTo,      setSettlTo]      = useState(today);
  const [settlDiv,     setSettlDiv]     = useState("");
  const [settlApplied, setSettlApplied] = useState(false);

  const settlParams = new URLSearchParams();
  if (settlApplied) {
    if (settlFrom) settlParams.set("from",         settlFrom);
    if (settlTo)   settlParams.set("to",           settlTo);
    if (settlDiv)  settlParams.set("divisionCode", settlDiv);
  }
  const { data: settlData, isLoading: settlLoading, refetch: refetchSettl } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/settlement-summary", settlApplied, settlFrom, settlTo, settlDiv],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/settlement-summary?${settlParams.toString()}`, { credentials: "include" }).then(r => r.json()),
    enabled: settlApplied,
  });

  // ── Admin Payouts tab (2.9A) ──────────────────────────────────────────────────
  const [payFilterUserId, setPayFilterUserId]     = useState("");
  const [payFilterDivision, setPayFilterDivision] = useState("");
  const [payFilterStatus, setPayFilterStatus]     = useState("");
  const [payFilterBatch, setPayFilterBatch]       = useState("");
  const [payApplied, setPayApplied]               = useState(false);
  const [paySelected, setPaySelected]             = useState<number[]>([]);
  const [markPaidNote, setMarkPaidNote]           = useState("");
  const [markPaidResult, setMarkPaidResult]       = useState<any>(null);

  const payParams = new URLSearchParams();
  if (payApplied) {
    if (payFilterUserId)   payParams.set("userId",       payFilterUserId);
    if (payFilterDivision) payParams.set("divisionCode", payFilterDivision);
    if (payFilterStatus)   payParams.set("status",       payFilterStatus);
    if (payFilterBatch)    payParams.set("batchId",      payFilterBatch);
  }
  const { data: payLedgerData, isLoading: payLoading, refetch: refetchPay } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/payout-ledger", payApplied, payFilterUserId, payFilterDivision, payFilterStatus, payFilterBatch],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/payout-ledger?${payParams.toString()}`, { credentials: "include" }).then(r => r.json()),
  });

  const { mutate: markPaid, isPending: markPaidPending } = useMutation<any, any, { entryIds: number[]; note: string }>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/payout-entries/mark-paid", vars),
    onSuccess: (data) => {
      setMarkPaidResult(data);
      setPaySelected([]);
      setMarkPaidNote("");
      toast({ title: `Batch ${data.batchId} — ${data.updatedIds.length} entries marked paid` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/payout-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/payout-batches"] });
    },
    onError: (err) => {
      toast({ title: err?.error ?? "Mark-paid failed", variant: "destructive" });
    },
  });

  // ── Payout Batches (3.0A) ─────────────────────────────────────────────────────
  const [batchCreateIds, setBatchCreateIds] = useState("");
  const [batchCreateNotes, setBatchCreateNotes] = useState("");
  const [batchCreateResult, setBatchCreateResult] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedFormat,  setSelectedFormat]  = useState<string>("csv");

  const { data: batchListData, isLoading: batchListLoading, refetch: refetchBatchList } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/payout-batches"],
    queryFn: () => fetch("/api/prestige-pass/admin/wallet/payout-batches", { credentials: "include" }).then(r => r.json()),
  });

  const { data: batchDetailData, isLoading: batchDetailLoading } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/payout-batches", selectedBatchId],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/payout-batches/${selectedBatchId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedBatchId,
  });

  const { mutate: createBatch, isPending: createBatchPending } = useMutation<any, any, { entryIds: number[]; notes: string }>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/payout-batches/create", vars),
    onSuccess: (data) => {
      setBatchCreateResult(data);
      setBatchCreateIds("");
      setBatchCreateNotes("");
      if (data.idempotent) {
        toast({ title: `Already batched — returning existing batch ${data.batchId}` });
      } else {
        toast({ title: `Batch created: ${data.batchId} — ${data.updatedIds?.length ?? 0} entries` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/payout-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/payout-ledger"] });
    },
    onError: (err: any) => toast({ title: err?.error ?? "Batch create failed", variant: "destructive" }),
  });

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

  // ── Finance Close (2.9E) ──────────────────────────────────────────────────────
  const [closeDate, setCloseDate] = useState(today);
  const [closeNotes, setCloseNotes] = useState("");

  const { data: closeData, isLoading: closeLoading, refetch: refetchClose } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/finance-close", closeDate],
    queryFn:  () => fetch(`/api/prestige-pass/admin/wallet/finance-close/${closeDate}`, { credentials: "include" }).then(r => r.json()),
  });
  const closeRecord   = closeData?.record;
  const closeChecklist: Record<string, { ok: boolean; count: number }> = closeData?.checklist ?? {};
  const allClear      = Object.values(closeChecklist).every((c) => c.ok);

  const { data: closeHistory, refetch: refetchCloseHistory } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/finance-close/history"],
    queryFn:  () => fetch("/api/prestige-pass/admin/wallet/finance-close/history", { credentials: "include" }).then(r => r.json()),
  });

  const { mutate: executeClose, isPending: closePending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", `/api/prestige-pass/admin/wallet/finance-close/${closeDate}/close`, { notes: closeNotes }),
    onSuccess: (data) => {
      if (data.ok) {
        toast({ title: data.idempotent ? "Already closed — returning existing record" : `Day ${closeDate} closed successfully` });
        queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/finance-close", closeDate] });
        queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/finance-close/history"] });
      }
    },
    onError: (err: any) => {
      if (err?.blocked) {
        toast({ title: `Close blocked: ${Object.keys(err.blocked).join(", ")}`, variant: "destructive" });
      } else {
        toast({ title: err?.error ?? "Finance close failed", variant: "destructive" });
      }
    },
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
    defaultValues: { bookingId: "", bookingType: "marketplace", amountIls: 0, reason: "", linkedDisputeCaseRef: "" },
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

  // ── 2.9D: Pending approvals query (polls every 20s to keep badge fresh) ──────
  const { data: pendingApprovalsData, refetch: refetchPendingApprovals } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/refund-requests/pending"],
    queryFn:  () => fetch("/api/prestige-pass/admin/wallet/refund-requests/pending", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 20000,
  });
  const pendingCount = pendingApprovalsData?.count ?? 0;

  const { mutate: approveRefund, isPending: approvePending } = useMutation<any, any, string>({
    mutationFn: (approvalId) => apiRequest("POST", `/api/prestige-pass/admin/wallet/refund-requests/${approvalId}/approve`, {}),
    onSuccess: (data) => {
      toast({ title: `Refund approved — ${data.refund?.actionTaken ?? ""} ₪${((data.refund?.amountCents ?? 0) / 100).toFixed(2)}` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/refund-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-action-history"] });
    },
    onError: (err: any) => toast({ title: err?.error ?? "Approve failed", variant: "destructive" }),
  });

  const { mutate: rejectRefund, isPending: rejectPending } = useMutation<any, any, string>({
    mutationFn: (approvalId) => apiRequest("POST", `/api/prestige-pass/admin/wallet/refund-requests/${approvalId}/reject`, {}),
    onSuccess: () => {
      toast({ title: "Refund request rejected — wallet untouched" });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/refund-requests/pending"] });
    },
    onError: (err: any) => toast({ title: err?.error ?? "Reject failed", variant: "destructive" }),
  });

  // 2.9D: Route support refund through approval threshold endpoint
  const { mutate: supportRefund, isPending: supportRefundPending } = useMutation<any, any, IssueRefundVars>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/refund-requests", {
      bookingId:            vars.bookingId,
      bookingType:          vars.bookingType,
      amountCents:          vars.amountIls > 0 ? Math.round(vars.amountIls * 100) : 0,
      reason:               vars.reason,
      linkedDisputeCaseRef: vars.linkedDisputeCaseRef || undefined,
    }),
    onSuccess: (data) => {
      setIssueRefundResult(data);
      setIssueRefundConfirm(null);
      issueRefundForm.reset();
      if (data.autoApproved) {
        const label = data.refund?.actionTaken === "release" ? "Hold released (degraded)" : "Refund auto-approved";
        toast({ title: `✓ ${label} — ₪${((data.refund?.amountCents ?? 0) / 100).toFixed(2)}` });
      } else {
        toast({ title: `⏳ Refund pending second approval — ID: ${data.approvalId}` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/booking-audit"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-action-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/refund-requests/pending"] });
    },
    onError: (err) => {
      setIssueRefundConfirm(null);
      toast({ title: err?.detail ?? err?.error ?? "Refund request failed", variant: "destructive" });
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

  // ── Reversal mutation ────────────────────────────────────────────────────────
  const { mutate: reverseAction, isPending: reversePending } = useMutation<any, any, { txnId: string; reason: string }>({
    mutationFn: (vars) => apiRequest("POST", "/api/prestige-pass/admin/wallet/reverse-action", vars),
    onSuccess: (data) => {
      const amt = ((data.amountCents ?? 0) / 100).toFixed(2);
      setReverseResult({ ok: true, msg: `הפעולה בוטלה — ₪${amt} הוחזרו (${data.reversalTxnId})` });
      setReverseReason("");
      queryClient.invalidateQueries({ queryKey: ["wallet-action-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/user-audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/finance-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/anomalies"] });
      toast({ title: `ביטול הצליח — ₪${amt}` });
    },
    onError: (err) => {
      const msg = err?.error ?? err?.detail ?? "Reversal failed";
      setReverseResult({ ok: false, msg });
      toast({ title: msg, variant: "destructive" });
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

  // ── Phase 3.0G: Finance Roles ──────────────────────────────────────────────
  const [roleAssignUid, setRoleAssignUid] = useState("");
  const [roleAssignVal, setRoleAssignVal] = useState<"read"|"write"|"admin">("write");
  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/finance-roles"],
    queryFn:  () => fetch("/api/prestige-pass/admin/wallet/finance-roles", { credentials: "include" }).then(r => r.json()),
  });
  const { data: roleAuditData, isLoading: roleAuditLoading, refetch: refetchRoleAudit } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/finance-roles/audit"],
    queryFn:  () => fetch("/api/prestige-pass/admin/wallet/finance-roles/audit", { credentials: "include" }).then(r => r.json()),
  });

  // ── Phase 3.1D: Finance Activity Timeline ─────────────────────────────
  const [finActorFilter,  setFinActorFilter]  = useState("");
  const [finActionFilter, setFinActionFilter] = useState("");
  const [finEntityFilter, setFinEntityFilter] = useState("");
  const [finFromFilter,   setFinFromFilter]   = useState("");
  const [finToFilter,     setFinToFilter]     = useState("");
  const [finPage,         setFinPage]         = useState(1);
  const [finFiltersApplied, setFinFiltersApplied] = useState<Record<string,string>>({});
  const { data: finActivityData, isLoading: finActivityLoading, refetch: refetchFinActivity } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/finance-audit", finFiltersApplied, finPage],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(finPage) });
      if (finFiltersApplied.actor)      p.set("actor",      finFiltersApplied.actor);
      if (finFiltersApplied.action)     p.set("action",     finFiltersApplied.action);
      if (finFiltersApplied.entityType) p.set("entityType", finFiltersApplied.entityType);
      if (finFiltersApplied.from)       p.set("from",       finFiltersApplied.from);
      if (finFiltersApplied.to)         p.set("to",         finFiltersApplied.to);
      return fetch(`/api/prestige-pass/admin/wallet/finance-audit?${p}`, { credentials: "include" }).then(r => r.json());
    },
  });
  // ── 3.1F: Dispute SLA Report ─────────────────────────────────────────────
  const [slaFrom, setSlaFrom] = useState('');
  const [slaTo, setSlaTo]     = useState('');
  const { data: slaReportData, isLoading: slaLoading, refetch: refetchSla } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/dispute-sla-report", slaFrom, slaTo],
    queryFn: () => {
      const p = new URLSearchParams();
      if (slaFrom) p.set("from", slaFrom);
      if (slaTo)   p.set("to",   slaTo);
      return fetch(`/api/prestige-pass/admin/wallet/dispute-sla-report?${p}`, { credentials: "include" }).then(r => r.json());
    },
  });

  // ── 3.1E: Monthly Variance Analysis ──────────────────────────────────────
  const [varianceMonth, setVarianceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const { data: varianceData, isLoading: varianceLoading } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/variance-analysis", varianceMonth],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/variance-analysis?month=${varianceMonth}`, { credentials: "include" }).then(r => r.json()),
  });

  // ── 3.1B: Clawback Summary (admin) ───────────────────────────────────────
  const { data: clawbackSummaryData, isLoading: clawbackSummaryLoading } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/clawback-summary"],
    queryFn: () => fetch("/api/prestige-pass/admin/wallet/clawback-summary", { credentials: "include" }).then(r => r.json()),
  });

  // ── 3.1C: Remittance Log + Mutation ──────────────────────────────────────
  const { data: remittanceLogData, isLoading: remittanceLogLoading, refetch: refetchRemLog } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/payout-batches", selectedBatchId, "remittance-log"],
    enabled: !!selectedBatchId,
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/payout-batches/${selectedBatchId}/remittance-log`, { credentials: "include" }).then(r => r.json()),
  });
  const { mutate: sendRemittances, isPending: sendRemittancesPending } = useMutation<any, any, string>({
    mutationFn: (batchId) => apiRequest("POST", `/api/prestige-pass/admin/wallet/payout-batches/${batchId}/send-remittances`, {}),
    onSuccess: (data) => {
      toast({ title: `Remittances sent — ${data.sent} sent, ${data.failed} failed, ${data.skipped} skipped` });
      refetchRemLog();
    },
    onError: (e) => toast({ title: "Failed to send remittances", description: e.message, variant: "destructive" }),
  });

  // ── 3.2B: Remittance Resend / Retry-Failed ─────────────────────────────
  const { mutate: resendRemittance, isPending: resendPending } = useMutation<any, any, string>({
    mutationFn: (providerUid) => apiRequest("POST",
      `/api/prestige-pass/admin/wallet/payout-batches/${selectedBatchId}/resend-remittance/${providerUid}`, {}),
    onSuccess: (data) => {
      toast({ title: data.ok ? `Resent to ${data.to}` : `Resend failed — ${data.error}`, variant: data.ok ? "default" : "destructive" });
      refetchRemLog();
    },
    onError: (e) => toast({ title: "Resend error", description: e.message, variant: "destructive" }),
  });
  const { mutate: retryFailed, isPending: retryFailedPending } = useMutation<any, any, string>({
    mutationFn: (batchId) => apiRequest("POST",
      `/api/prestige-pass/admin/wallet/payout-batches/${batchId}/retry-failed`, {}),
    onSuccess: (data) => {
      toast({ title: `Retry complete — ${data.sent} sent, ${data.failed} still failed` });
      refetchRemLog();
    },
    onError: (e) => toast({ title: "Retry-failed error", description: e.message, variant: "destructive" }),
  });

  // ── 3.2A: Bank Reconciliation ──────────────────────────────────────────
  const [reconFile, setReconFile] = useState<File | null>(null);
  const [reconUploading, setReconUploading] = useState(false);
  const { data: reconData, isLoading: reconLoading, refetch: refetchRecon } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/payout-batches", selectedBatchId, "reconciliation"],
    enabled: !!selectedBatchId,
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/payout-batches/${selectedBatchId}/reconciliation`, { credentials: "include" }).then(r => r.json()),
  });
  async function uploadReconFile() {
    if (!reconFile || !selectedBatchId) return;
    setReconUploading(true);
    try {
      const form = new FormData();
      form.append("file", reconFile);
      const res = await fetch(`/api/prestige-pass/admin/wallet/payout-batches/${selectedBatchId}/reconcile`, {
        method: "POST", body: form, credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast({ title: `Reconciled — ${data.matched} matched, ${data.unmatched} unmatched, ${data.amountMismatch} amount mismatch` });
      setReconFile(null);
      refetchRecon();
    } catch (e: any) {
      toast({ title: "Reconciliation upload failed", description: e.message, variant: "destructive" });
    } finally {
      setReconUploading(false);
    }
  }

  // ── 3.2C: Dispute Escalation ───────────────────────────────────────────
  const { mutate: escalateDispute, isPending: escalatePending } = useMutation<any, any, { caseRef: string; note?: string }>({
    mutationFn: ({ caseRef, note }) => apiRequest("POST", `/api/prestige-pass/admin/wallet/disputes/${caseRef}/escalate`, { note }),
    onSuccess: (data) => {
      toast({ title: `Case ${data.caseRef} escalated` });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/disputes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/alerts"] });
    },
    onError: (e) => toast({ title: "Escalation failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.2D: Finance Alerts ───────────────────────────────────────────────
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/alerts"],
    queryFn: () => fetch("/api/prestige-pass/admin/wallet/alerts", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });
  const { mutate: acknowledgeAlert, isPending: ackPending } = useMutation<any, any, number>({
    mutationFn: (alertId) => apiRequest("POST", `/api/prestige-pass/admin/wallet/alerts/${alertId}/acknowledge`, {}),
    onSuccess: () => refetchAlerts(),
    onError: (e) => toast({ title: "Ack failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: acknowledgeAll, isPending: ackAllPending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", "/api/prestige-pass/admin/wallet/alerts/acknowledge-all", {}),
    onSuccess: () => { toast({ title: "All alerts acknowledged" }); refetchAlerts(); },
    onError: (e) => toast({ title: "Ack-all failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.2E: Monthly Sign-off ──────────────────────────────────────────────
  const { data: signoffData, isLoading: signoffLoading, refetch: refetchSignoff } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/monthly-signoff", varianceMonth],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/monthly-signoff?month=${varianceMonth}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!varianceMonth,
  });
  const [signoffNote, setSignoffNote] = useState("");
  const [escalationNote, setEscalationNote] = useState("");
  const { mutate: signoffMonth, isPending: signoffPending } = useMutation<any, any, { month: string; notes?: string }>({
    mutationFn: ({ month, notes }) => apiRequest("POST", "/api/prestige-pass/admin/wallet/monthly-signoff", { month, notes }),
    onSuccess: (data) => {
      toast({ title: `Month ${data.month} signed off — this is irreversible` });
      setSignoffNote("");
      refetchSignoff();
      queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/alerts"] });
    },
    onError: (e) => toast({ title: "Sign-off failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.2F: Variance Commentary ──────────────────────────────────────────
  const { data: commentaryData, isLoading: commentaryLoading, refetch: refetchCommentary } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/variance-commentary", varianceMonth],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/variance-commentary?month=${varianceMonth}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!varianceMonth,
  });
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const { mutate: saveComment, isPending: saveCommentPending } = useMutation<any, any, { month: string; metric: string; comment: string }>({
    mutationFn: ({ month, metric, comment }) => apiRequest("POST", "/api/prestige-pass/admin/wallet/variance-commentary", { month, metric, comment }),
    onSuccess: (_data, vars) => {
      toast({ title: `Commentary saved for ${vars.metric}` });
      refetchCommentary();
      setCommentDraft(d => { const n = { ...d }; delete n[vars.metric]; return n; });
    },
    onError: (e) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.3A: Reconciliation Exceptions ───────────────────────────────────────
  const [reconExFilter, setReconExFilter] = useState<{ status: string; batchId: string; providerUid: string }>({ status: "", batchId: "", providerUid: "" });
  const [reconExFiltersApplied, setReconExFiltersApplied] = useState<any>({});
  const [selectedReconEx, setSelectedReconEx] = useState<any>(null);
  const [reconExNote, setReconExNote] = useState("");
  const [reconMatchEntryId, setReconMatchEntryId] = useState("");
  const [reconMatchReason, setReconMatchReason] = useState("");
  const { data: reconExData, isLoading: reconExLoading, refetch: refetchReconEx } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/reconciliation-exceptions", reconExFiltersApplied],
    queryFn: () => {
      const p = new URLSearchParams();
      if (reconExFiltersApplied.status) p.set("status", reconExFiltersApplied.status);
      if (reconExFiltersApplied.batchId) p.set("batchId", reconExFiltersApplied.batchId);
      if (reconExFiltersApplied.providerUid) p.set("providerUid", reconExFiltersApplied.providerUid);
      return fetch(`/api/prestige-pass/admin/wallet/reconciliation-exceptions?${p}`, { credentials: "include" }).then(r => r.json());
    },
  });
  const { mutate: patchReconEx, isPending: patchReconExPending } = useMutation<any, any, { id: number; action: string; note?: string; assignedAdminUid?: string }>({
    mutationFn: ({ id, ...body }) => apiRequest("PATCH", `/api/prestige-pass/admin/wallet/reconciliation-exceptions/${id}`, body),
    onSuccess: () => { toast({ title: "Exception updated" }); refetchReconEx(); setSelectedReconEx(null); },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: manualMatchReconEx, isPending: matchReconExPending } = useMutation<any, any, { id: number; payoutEntryId: number; reason: string }>({
    mutationFn: ({ id, ...body }) => apiRequest("POST", `/api/prestige-pass/admin/wallet/reconciliation-exceptions/${id}/match`, body),
    onSuccess: () => { toast({ title: "Manually matched — entry settled" }); refetchReconEx(); setSelectedReconEx(null); setReconMatchEntryId(""); setReconMatchReason(""); },
    onError: (e) => toast({ title: "Match failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.3B: Alert Delivery Log & Escalation ─────────────────────────────────
  const [alertDeliveryDrawer, setAlertDeliveryDrawer] = useState(false);
  const { data: deliveryLogData, isLoading: deliveryLogLoading, refetch: refetchDeliveryLog } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/alerts/delivery-log"],
    queryFn: () => fetch("/api/prestige-pass/admin/wallet/alerts/delivery-log", { credentials: "include" }).then(r => r.json()),
    enabled: alertDeliveryDrawer,
  });
  const { data: digestPreviewData, refetch: refetchDigestPreview } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/alerts/digest-preview"],
    queryFn: () => fetch("/api/prestige-pass/admin/wallet/alerts/digest-preview", { credentials: "include" }).then(r => r.json()),
    enabled: false,
  });
  const { mutate: escalateAlertNow, isPending: escalateAlertPending } = useMutation<any, any, number>({
    mutationFn: (alertId) => apiRequest("POST", `/api/prestige-pass/admin/wallet/alerts/${alertId}/escalate-now`, {}),
    onSuccess: (d) => { toast({ title: `Alert escalated to level ${d.escalationLevel}` }); refetchAlerts(); },
    onError: (e) => toast({ title: "Escalation failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.3E: Board Pack ───────────────────────────────────────────────────────
  const [boardMonth, setBoardMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [boardMonthApplied, setBoardMonthApplied] = useState<string>(new Date().toISOString().slice(0, 7));
  const { data: boardPackData, isLoading: boardPackLoading, refetch: refetchBoardPack } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/board-pack", boardMonthApplied],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/board-pack?month=${boardMonthApplied}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!boardMonthApplied,
  });

  // ── 3.3F: Integrity Jobs ───────────────────────────────────────────────────
  const { data: integrityHistoryData, isLoading: integrityHistoryLoading, refetch: refetchIntegrityHistory } = useQuery<any>({
    queryKey: ["/api/prestige-pass/admin/wallet/integrity/history"],
    queryFn: () => fetch("/api/prestige-pass/admin/wallet/integrity/history", { credentials: "include" }).then(r => r.json()),
  });
  const { mutate: runIntegrityJobs, isPending: runIntegrityPending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", "/api/prestige-pass/admin/wallet/integrity/run", {}),
    onSuccess: () => { toast({ title: "Integrity check complete" }); refetchIntegrityHistory(); queryClient.invalidateQueries({ queryKey: ["/api/prestige-pass/admin/wallet/alerts"] }); },
    onError: (e) => toast({ title: "Integrity check failed", description: e.message, variant: "destructive" }),
  });

  const { mutate: upsertRole, isPending: upsertRolePending } = useMutation<any, any, { uid: string; role: string }>({
    mutationFn: ({ uid, role }) => apiRequest("POST", `/api/prestige-pass/admin/wallet/finance-roles/${uid}`, { role }),
    onSuccess: () => { toast({ title: "Finance role assigned" }); setRoleAssignUid(""); refetchRoles(); },
    onError: (e) => toast({ title: "Failed to assign role", description: e.message, variant: "destructive" }),
  });
  const { mutate: deleteRole, isPending: deleteRolePending } = useMutation<any, any, string>({
    mutationFn: (uid) => apiRequest("DELETE", `/api/prestige-pass/admin/wallet/finance-roles/${uid}`, {}),
    onSuccess: () => { toast({ title: "Finance role removed" }); refetchRoles(); },
    onError: (e) => toast({ title: "Failed to remove role", description: e.message, variant: "destructive" }),
  });

  // ── 3.4A: Cash Forecast ──────────────────────────────────────────────────────
  const [forecastHorizon, setForecastHorizon] = useState<number>(14);
  const [forecastHorizonApplied, setForecastHorizonApplied] = useState<number>(14);
  const { data: forecastData, isLoading: forecastLoading, refetch: refetchForecast } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/cash-forecast', forecastHorizonApplied],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/cash-forecast?horizon=${forecastHorizonApplied}`, { credentials: 'include' }).then(r => r.json()),
  });

  // ── 3.4B: Payout Schedules ───────────────────────────────────────────────────
  const { data: schedulesData, isLoading: schedulesLoading, refetch: refetchSchedules } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/payout-schedules'] });
  const { data: scheduleRunsData, isLoading: scheduleRunsLoading, refetch: refetchScheduleRuns } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/payout-schedules/runs'] });
  const [newSchedule, setNewSchedule] = useState({ cadence: 'weekly', divisionCode: '', dayOfWeek: '', dayOfMonth: '', minBatchNetCents: '', notes: '' });
  const { mutate: createSchedule, isPending: createSchedulePending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest("POST", "/api/prestige-pass/admin/wallet/payout-schedules", body),
    onSuccess: () => { toast({ title: "Schedule created" }); refetchSchedules(); setNewSchedule({ cadence: 'weekly', divisionCode: '', dayOfWeek: '', dayOfMonth: '', minBatchNetCents: '', notes: '' }); },
    onError: (e) => toast({ title: "Failed to create schedule", description: e.message, variant: "destructive" }),
  });
  const { mutate: toggleSchedule } = useMutation<any, any, { id: number; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => apiRequest("PATCH", `/api/prestige-pass/admin/wallet/payout-schedules/${id}`, { enabled }),
    onSuccess: () => { toast({ title: "Schedule updated" }); refetchSchedules(); },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: runScheduleNow, isPending: runScheduleNowPending } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest("POST", `/api/prestige-pass/admin/wallet/payout-schedules/${id}/run-now`, {}),
    onSuccess: (d) => { toast({ title: d.result === 'created' ? `Batch created: ${d.batchId}` : `Skipped: ${d.reason}` }); refetchSchedules(); refetchScheduleRuns(); },
    onError: (e) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.4C: Dispute Routing ────────────────────────────────────────────────────
  const { data: routingRulesData, isLoading: routingRulesLoading, refetch: refetchRoutingRules } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/dispute-routing-rules'] });
  const [newRule, setNewRule] = useState({ divisionCode: '', minAmountCents: '', maxAmountCents: '', assignToUid: '', queueName: '', priority: '100' });
  const { mutate: createRoutingRule, isPending: createRulePending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest("POST", "/api/prestige-pass/admin/wallet/dispute-routing-rules", body),
    onSuccess: () => { toast({ title: "Routing rule created" }); refetchRoutingRules(); setNewRule({ divisionCode: '', minAmountCents: '', maxAmountCents: '', assignToUid: '', queueName: '', priority: '100' }); },
    onError: (e) => toast({ title: "Failed to create rule", description: e.message, variant: "destructive" }),
  });
  const { mutate: toggleRule } = useMutation<any, any, { id: number; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => apiRequest("PATCH", `/api/prestige-pass/admin/wallet/dispute-routing-rules/${id}`, { enabled }),
    onSuccess: () => { toast({ title: "Rule updated" }); refetchRoutingRules(); },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const [routeDisputeRef, setRouteDisputeRef] = useState("");
  const { mutate: routeDispute, isPending: routeDisputePending } = useMutation<any, any, string>({
    mutationFn: (caseRef) => apiRequest("POST", `/api/prestige-pass/admin/wallet/disputes/${caseRef}/route`, {}),
    onSuccess: (d) => toast({ title: `Routed to ${d.routedQueue || d.routedToUid}`, description: d.routingReason }),
    onError: (e) => toast({ title: "Routing failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.4D: Control Center ─────────────────────────────────────────────────────
  const { data: controlCenterData, isLoading: controlCenterLoading, refetch: refetchControlCenter } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/control-center'],
    refetchInterval: 60_000,
  });

  // ── 3.4E: Executive KPIs ─────────────────────────────────────────────────────
  const [execPeriod, setExecPeriod] = useState<'daily'|'weekly'|'monthly'>('monthly');
  const { data: execKpiData, isLoading: execKpiLoading, refetch: refetchExecKpi } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/executive-kpis', execPeriod],
    queryFn: () => fetch(`/api/prestige-pass/admin/wallet/executive-kpis?period=${execPeriod}`, { credentials: 'include' }).then(r => r.json()),
  });

  // ── 3.4F: Archive Policies ───────────────────────────────────────────────────
  const { data: archivePoliciesData, isLoading: archivePoliciesLoading, refetch: refetchArchivePolicies } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/archive-policies'] });
  const { data: archiveRunsData, isLoading: archiveRunsLoading, refetch: refetchArchiveRuns } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/archive-runs'] });
  const { mutate: dryRunArchive, isPending: dryRunArchivePending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", "/api/prestige-pass/admin/wallet/archive-runs/dry-run", {}),
    onSuccess: () => { toast({ title: "Dry-run complete" }); refetchArchiveRuns(); },
    onError: (e) => toast({ title: "Dry-run failed", description: e.message, variant: "destructive" }),
  });

  // ── 3.4G: Recovery & Replay ──────────────────────────────────────────────────
  const REPLAY_TYPES = ['rebuild_payout_batch_totals','rebuild_remittance_status','rebuild_close_snapshots','recheck_reconciliation_links'];
  const [selectedReplayType, setSelectedReplayType] = useState<string>(REPLAY_TYPES[0]);
  const [expandedReplayRun, setExpandedReplayRun] = useState<number|null>(null);
  const { data: replayRunsData, isLoading: replayRunsLoading, refetch: refetchReplayRuns } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/replay-runs'] });
  const { mutate: startDryRun, isPending: dryRunPending } = useMutation<any, any, string>({
    mutationFn: (replayType) => apiRequest("POST", "/api/prestige-pass/admin/wallet/replay/dry-run", { replayType }),
    onSuccess: (d) => { toast({ title: `Dry-run started: ${d.replayType}`, description: `Run ID: ${d.runId}` }); setTimeout(() => refetchReplayRuns(), 3000); },
    onError: (e) => toast({ title: "Dry-run failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: executeReplay, isPending: executeReplayPending } = useMutation<any, any, string>({
    mutationFn: (replayType) => apiRequest("POST", "/api/prestige-pass/admin/wallet/replay/execute", { replayType }),
    onSuccess: (d) => { toast({ title: `Replay executing: ${d.replayType}`, description: `Run ID: ${d.runId}` }); setTimeout(() => refetchReplayRuns(), 3000); },
    onError: (e) => toast({ title: "Execute failed", description: e.message, variant: "destructive" }),
  });

  // ─── PHASE 3.5A: Forecast Accuracy ──────────────────────────────────────────
  const [accuracyHorizon, setAccuracyHorizon] = useState<number|null>(null);
  const { data: accuracyData, isLoading: accuracyLoading, refetch: refetchAccuracy } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/cash-forecast/accuracy'],
    enabled: false,
  });
  const { mutate: scoreAccuracy, isPending: scorePending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", "/api/prestige-pass/admin/wallet/cash-forecast/accuracy/score", {}),
    onSuccess: (d) => { toast({ title: "Accuracy scored", description: `${d.scored} row(s) scored` }); refetchAccuracy(); },
    onError: (e) => toast({ title: "Score failed", description: e.message, variant: "destructive" }),
  });

  // ─── PHASE 3.5B: Payout Release Approvals ───────────────────────────────────
  const [releaseReason, setReleaseReason] = useState<Record<string, string>>({});
  const [showReleaseConfirm, setShowReleaseConfirm] = useState<string|null>(null);
  const { data: pendingReleasesData, isLoading: pendingReleasesLoading, refetch: refetchPendingReleases } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/payout-release-approvals/pending'],
  });
  const { mutate: requestRelease, isPending: requestReleasePending } = useMutation<any, any, { batchId: string; reason: string }>({
    mutationFn: ({ batchId, reason }) => apiRequest("POST", `/api/prestige-pass/admin/wallet/payout-batches/${batchId}/release-request`, { reason }),
    onSuccess: (d) => { toast({ title: d.autoApproved ? "Auto-approved & released" : "Release request submitted", description: d.autoApproved ? `₪${(d.amountCents/100).toFixed(0)} — below threshold` : "Awaiting second approver" }); setShowReleaseConfirm(null); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/payout-release-approvals/pending'] }); },
    onError: (e) => toast({ title: "Request failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: approveRelease, isPending: approveReleasePending } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest("POST", `/api/prestige-pass/admin/wallet/payout-release-approvals/${id}/approve`, {}),
    onSuccess: () => { toast({ title: "Release approved" }); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/payout-release-approvals/pending'] }); },
    onError: (e) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: rejectRelease, isPending: rejectReleasePending } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest("POST", `/api/prestige-pass/admin/wallet/payout-release-approvals/${id}/reject`, {}),
    onSuccess: () => { toast({ title: "Release rejected" }); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/payout-release-approvals/pending'] }); },
    onError: (e) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  // ─── PHASE 3.5C: Routing Simulation ─────────────────────────────────────────
  const [simInput, setSimInput] = useState({ divisionCode: '', amountCents: '', complainantType: 'customer' });
  const [simResult, setSimResult] = useState<any>(null);
  const [simPending, setSimPending] = useState(false);
  const { data: testCasesData } = useQuery<any>({ queryKey: ['/api/prestige-pass/admin/wallet/dispute-routing-rules/test-cases'] });
  const runSimulation = async () => {
    setSimPending(true); setSimResult(null);
    try {
      const r = await apiRequest("POST", "/api/prestige-pass/admin/wallet/dispute-routing-rules/simulate", {
        divisionCode: simInput.divisionCode || undefined,
        amountCents: simInput.amountCents ? Math.round(parseFloat(simInput.amountCents)*100) : 0,
        complainantType: simInput.complainantType,
      });
      setSimResult(r);
    } catch (e: any) { toast({ title: "Simulation failed", description: e.message, variant: "destructive" }); }
    finally { setSimPending(false); }
  };

  // ─── PHASE 3.5D: Control-Center Subscriptions ───────────────────────────────
  const SIGNAL_LABELS: Record<string, string> = {
    cash_pressure: 'Cash Pressure', critical_alerts: 'Critical Alerts',
    stale_recon_exceptions: 'Stale Recon Exceptions', pending_payout_approvals: 'Pending Payout Approvals', close_blocked: 'Close Blocked',
  };
  const [newSub, setNewSub] = useState({ signalCode: 'cash_pressure', deliveryChannel: 'email' });
  const { data: controlSubsData, isLoading: controlSubsLoading, refetch: refetchControlSubs } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/control-subscriptions'],
  });
  const { mutate: createSub, isPending: createSubPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest("POST", "/api/prestige-pass/admin/wallet/control-subscriptions", body),
    onSuccess: () => { toast({ title: "Subscription created" }); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/control-subscriptions'] }); },
    onError: (e) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: toggleSub } = useMutation<any, any, { id: number; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => apiRequest("PATCH", `/api/prestige-pass/admin/wallet/control-subscriptions/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/control-subscriptions'] }),
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  // ─── PHASE 3.5E: Executive Weekly Digest ────────────────────────────────────
  const { data: execDigestPreview, isLoading: execDigestPreviewLoading, refetch: refetchExecDigestPreview } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/executive-digest/preview'],
    enabled: false,
  });
  const { data: execDigestLog, isLoading: execDigestLogLoading, refetch: refetchExecDigestLog } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/executive-digest/log'],
  });
  const { mutate: sendExecDigest, isPending: sendDigestPending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", "/api/prestige-pass/admin/wallet/executive-digest/send", {}),
    onSuccess: (d) => { toast({ title: "Digest sent", description: `Period: ${d.fromDate}` }); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/executive-digest/log'] }); },
    onError: (e) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  // ─── PHASE 3.5F: Archive Execution ──────────────────────────────────────────
  const [showArchiveExecuteConfirm, setShowArchiveExecuteConfirm] = useState(false);
  const { data: archiveArtifactsData, isLoading: archiveArtifactsLoading, refetch: refetchArchiveArtifacts } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/archive/artifacts'],
  });
  const { mutate: executeArchive, isPending: executeArchivePending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest("POST", "/api/prestige-pass/admin/wallet/archive/execute", {}),
    onSuccess: (d) => { toast({ title: "Archive executed", description: `${d.totalMoved} rows across ${d.artifacts.length} policies` }); setShowArchiveExecuteConfirm(false); refetchArchiveArtifacts(); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/archive-runs'] }); },
    onError: (e) => toast({ title: "Execute failed", description: e.message, variant: "destructive" }),
  });

  // ─── PHASE 3.5G: Replay Approvals & Signed Reports ──────────────────────────
  const [replayReason, setReplayReason] = useState('');
  const [viewingReportRunId, setViewingReportRunId] = useState<number|null>(null);
  const { data: pendingReplayApprovalsData, isLoading: pendingReplayApprovalsLoading, refetch: refetchPendingReplayApprovals } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/replay/approvals/pending'],
  });
  const { mutate: requestReplayExecute, isPending: requestReplayPending } = useMutation<any, any, { replayType: string; reason: string }>({
    mutationFn: (body) => apiRequest("POST", "/api/prestige-pass/admin/wallet/replay/request-execute", body),
    onSuccess: (d) => { toast({ title: "Execute request submitted", description: `Approval ID: ${d.approval?.id}` }); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/replay/approvals/pending'] }); },
    onError: (e) => toast({ title: "Request failed", description: e.message, variant: "destructive" }),
  });
  const { mutate: approveReplayExec, isPending: approveReplayPending } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest("POST", `/api/prestige-pass/admin/wallet/replay/approvals/${id}/approve`, {}),
    onSuccess: (d) => { toast({ title: "Replay approved & executing", description: `Run: ${d.executeRunId}, sig: ${d.signature?.slice(0,8)}…` }); queryClient.invalidateQueries({ queryKey: ['/api/prestige-pass/admin/wallet/replay/approvals/pending'] }); refetchReplayRuns(); },
    onError: (e) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });
  const { data: replayReportData, isLoading: replayReportLoading, refetch: refetchReplayReport } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/replay/reports', viewingReportRunId],
    enabled: !!viewingReportRunId,
  });

  // ── Phase 3.6A: Forecast Model Weights ────────────────────────────────────
  const [weightHorizon, setWeightHorizon] = useState<number>(7);
  const [editingWeight, setEditingWeight] = useState<{ id: number; value: string } | null>(null);
  const [newWeight, setNewWeight] = useState({ horizonDays: 7, factorName: 'payouts', weight: '1.0' });
  const { data: forecastWeights, isLoading: forecastWeightsLoading, refetch: refetchForecastWeights } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/cash-forecast/weights', weightHorizon],
  });
  const { data: recomputeResult, isLoading: recomputeLoading, refetch: refetchRecompute } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/cash-forecast/recompute', weightHorizon],
    enabled: false,
  });
  const { mutate: createForecastWeight, isPending: createWeightPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/cash-forecast/weights', body),
    onSuccess: () => { toast({ title: 'Weight added' }); refetchForecastWeights(); setNewWeight({ horizonDays: 7, factorName: 'payouts', weight: '1.0' }); },
  });
  const { mutate: patchForecastWeight, isPending: patchWeightPending } = useMutation<any, any, { id: number; body: any }>({
    mutationFn: ({ id, body }) => apiRequest('PATCH', `/api/prestige-pass/admin/wallet/cash-forecast/weights/${id}`, body),
    onSuccess: () => { toast({ title: 'Weight updated' }); refetchForecastWeights(); setEditingWeight(null); },
  });

  // ── Phase 3.6B: Payout Release Policies ───────────────────────────────────
  const [showNewPolicyForm, setShowNewPolicyForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ minAmountCents: '', maxAmountCents: '', divisionCode: '', requiresSecondApproval: true, allowedAutoRelease: false, notes: '' });
  const [evaluatingBatchId, setEvaluatingBatchId] = useState<string>('');
  const { data: releasePolicies, isLoading: releasePoliciesLoading, refetch: refetchReleasePolicies } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/payout-release-policies'],
  });
  const { data: policyEvalResult, isLoading: policyEvalLoading, refetch: refetchPolicyEval } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/payout-batches', evaluatingBatchId, 'evaluate-release-policy'],
    enabled: false,
  });
  const { mutate: createReleasePolicy, isPending: createPolicyPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/payout-release-policies', body),
    onSuccess: () => { toast({ title: 'Policy created' }); refetchReleasePolicies(); setShowNewPolicyForm(false); },
  });
  const { mutate: patchReleasePolicy, isPending: patchPolicyPending } = useMutation<any, any, { id: number; body: any }>({
    mutationFn: ({ id, body }) => apiRequest('PATCH', `/api/prestige-pass/admin/wallet/payout-release-policies/${id}`, body),
    onSuccess: () => { toast({ title: 'Policy updated' }); refetchReleasePolicies(); },
  });
  const { mutate: evaluateReleasePolicy, isPending: evaluatePolicyPending } = useMutation<any, any, string>({
    mutationFn: (batchId) => apiRequest('POST', `/api/prestige-pass/admin/wallet/payout-batches/${batchId}/evaluate-release-policy`, {}),
    onSuccess: (d) => { toast({ title: 'Policy evaluated', description: d.reasoning }); queryClient.setQueryData(['/api/prestige-pass/admin/wallet/payout-batches', evaluatingBatchId, 'evaluate-release-policy'], d); },
  });

  // ── Phase 3.6C: Digest Preferences ────────────────────────────────────────
  const [showNewPrefForm, setShowNewPrefForm] = useState(false);
  const [newPref, setNewPref] = useState({ userUid: '', digestType: 'weekly', minSeverity: 'warning', includeControlCenter: true, includeExecutiveSummary: false });
  const { data: digestPrefs, isLoading: digestPrefsLoading, refetch: refetchDigestPrefs } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/digest-preferences'],
  });
  const { mutate: createDigestPref, isPending: createPrefPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/digest-preferences', body),
    onSuccess: () => { toast({ title: 'Preference saved' }); refetchDigestPrefs(); setShowNewPrefForm(false); },
  });
  const { mutate: patchDigestPref, isPending: patchPrefPending } = useMutation<any, any, { id: number; body: any }>({
    mutationFn: ({ id, body }) => apiRequest('PATCH', `/api/prestige-pass/admin/wallet/digest-preferences/${id}`, body),
    onSuccess: () => { toast({ title: 'Preference updated' }); refetchDigestPrefs(); },
  });

  // ── Phase 3.6D: Archive Retrievals ────────────────────────────────────────
  const [retrievalReason, setRetrievalReason] = useState('');
  const [retrievalArtifactId, setRetrievalArtifactId] = useState<string>('');
  const [markReadyId, setMarkReadyId] = useState<string>('');
  const [markReadyRef, setMarkReadyRef] = useState('');
  const { data: archiveRetrievals, isLoading: archiveRetrievalsLoading, refetch: refetchArchiveRetrievals } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/archive/retrievals'],
  });
  const { mutate: requestRetrieval, isPending: requestRetrievalPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/archive/retrieve', body),
    onSuccess: (d) => { toast({ title: 'Retrieval requested', description: `ID: ${d.retrieval?.id}` }); refetchArchiveRetrievals(); setRetrievalReason(''); setRetrievalArtifactId(''); },
  });
  const { mutate: markRetrievalReady, isPending: markReadyPending } = useMutation<any, any, { id: number; retrievalRef: string }>({
    mutationFn: ({ id, retrievalRef }) => apiRequest('POST', `/api/prestige-pass/admin/wallet/archive/retrievals/${id}/mark-ready`, { retrievalRef }),
    onSuccess: () => { toast({ title: 'Retrieval marked ready' }); refetchArchiveRetrievals(); setMarkReadyId(''); setMarkReadyRef(''); },
  });

  // ── Phase 3.6E: Replay Diff ────────────────────────────────────────────────
  const [diffRunId, setDiffRunId] = useState<string>('');
  const [diffEntityFilter, setDiffEntityFilter] = useState('');
  const { data: replayDiffData, isLoading: replayDiffLoading, refetch: refetchReplayDiff } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/replay/diff', diffRunId],
    enabled: !!diffRunId,
  });

  // ── Phase 3.6F: Finance Policy Engine ─────────────────────────────────────
  const [editingPolicyKey, setEditingPolicyKey] = useState<string | null>(null);
  const [policyEditValue, setPolicyEditValue] = useState('');
  const [showNewFinancePolicyForm, setShowNewFinancePolicyForm] = useState(false);
  const [newFinancePolicy, setNewFinancePolicy] = useState({ policyKey: '', policyScope: 'global', divisionCode: '', valueJson: '{}' });
  const { data: financePolicies, isLoading: financePoliciesLoading, refetch: refetchFinancePolicies } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/policies'],
  });
  const { mutate: upsertFinancePolicy, isPending: upsertPolicyPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/policies', body),
    onSuccess: () => { toast({ title: 'Policy saved' }); refetchFinancePolicies(); setShowNewFinancePolicyForm(false); setEditingPolicyKey(null); },
  });
  const { mutate: patchFinancePolicy, isPending: patchFinancePolicyPending } = useMutation<any, any, { policyKey: string; body: any }>({
    mutationFn: ({ policyKey, body }) => apiRequest('PATCH', `/api/prestige-pass/admin/wallet/policies/${policyKey}`, body),
    onSuccess: () => { toast({ title: 'Policy updated' }); refetchFinancePolicies(); setEditingPolicyKey(null); },
  });

  // ── Phase 3.6G: Period Close Packs ────────────────────────────────────────
  const [packType, setPackType] = useState<'quarter' | 'year'>('quarter');
  const [packPeriod, setPackPeriod] = useState('2026-Q1');
  const { data: periodPackData, isLoading: periodPackLoading, refetch: refetchPeriodPack } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/period-pack', packType, packPeriod],
    enabled: false,
  });

  // ── Phase 3.7A: Policy Simulation ─────────────────────────────────────────
  const [simPolicyKey, setSimPolicyKey] = useState('refund_auto_approve_limit');
  const [simProposedValue, setSimProposedValue] = useState('');
  const [simDivision, setSimDivision] = useState('');
  const [simResult, setSimResult] = useState<any>(null);
  const { data: simHistory, isLoading: simHistoryLoading, refetch: refetchSimHistory } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/policy-simulation/history'],
  });
  const { mutate: runSimulation, isPending: runSimulationPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/policy-simulation/run', body),
    onSuccess: (d) => { setSimResult(d); toast({ title: 'Simulation complete', description: d.outcomeSummary }); refetchSimHistory(); },
  });

  // ── Phase 3.7B: Approval Chains ────────────────────────────────────────────
  const { data: approvalChains, isLoading: approvalChainsLoading, refetch: refetchApprovalChains } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/approval-chains'],
  });
  const { data: approvalRequestsData, isLoading: approvalRequestsLoading, refetch: refetchApprovalRequests } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/approval-requests'],
  });
  const [showNewChainForm, setShowNewChainForm] = useState(false);
  const [newChain, setNewChain] = useState({ chainName: '', triggerType: 'payout', minAmountCents: '', maxAmountCents: '', escalationHours: '48', notes: '' });
  const [expandedChainId, setExpandedChainId] = useState<number | null>(null);
  const [newStep, setNewStep] = useState({ chainId: 0, stepOrder: '1', requiredRole: 'finance_manager', timeoutHours: '24', escalateToRole: '' });
  const { mutate: createApprovalChain, isPending: createChainPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/approval-chains', body),
    onSuccess: () => { toast({ title: 'Chain created' }); refetchApprovalChains(); setShowNewChainForm(false); setNewChain({ chainName: '', triggerType: 'payout', minAmountCents: '', maxAmountCents: '', escalationHours: '48', notes: '' }); },
  });
  const { mutate: patchApprovalChain, isPending: patchChainPending } = useMutation<any, any, { id: number; body: any }>({
    mutationFn: ({ id, body }) => apiRequest('PATCH', `/api/prestige-pass/admin/wallet/approval-chains/${id}`, body),
    onSuccess: () => { toast({ title: 'Chain updated' }); refetchApprovalChains(); },
  });
  const { mutate: addChainStep, isPending: addStepPending } = useMutation<any, any, any>({
    mutationFn: ({ chainId, body }) => apiRequest('POST', `/api/prestige-pass/admin/wallet/approval-chains/${chainId}/steps`, body),
    onSuccess: () => { toast({ title: 'Step added' }); refetchApprovalChains(); setNewStep({ chainId: 0, stepOrder: '1', requiredRole: 'finance_manager', timeoutHours: '24', escalateToRole: '' }); },
  });
  const { mutate: deleteChainStep } = useMutation<any, any, number>({
    mutationFn: (stepId) => apiRequest('DELETE', `/api/prestige-pass/admin/wallet/approval-chain-steps/${stepId}`),
    onSuccess: () => { toast({ title: 'Step removed' }); refetchApprovalChains(); },
  });
  const { mutate: actOnApproval, isPending: actOnApprovalPending } = useMutation<any, any, { id: number; action: string; comment?: string }>({
    mutationFn: ({ id, action, comment }) => apiRequest('POST', `/api/prestige-pass/admin/wallet/approval-requests/${id}/act`, { action, comment }),
    onSuccess: (d) => { toast({ title: `Approval ${d.newStatus}` }); refetchApprovalRequests(); },
  });

  // ── Phase 3.7C: Forecast Scenarios ─────────────────────────────────────────
  const { data: forecastScenariosData, isLoading: forecastScenariosLoading, refetch: refetchForecastScenarios } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/forecast-scenarios'],
  });
  const [showNewScenarioForm, setShowNewScenarioForm] = useState(false);
  const [newScenario, setNewScenario] = useState({ scenarioName: '', description: '', revenueAdjustmentPct: '0', bookingVolumeAdjustmentPct: '0', baseHorizonDays: '30' });
  const [scenarioRunResult, setScenarioRunResult] = useState<any>(null);
  const { mutate: createScenario, isPending: createScenarioPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/forecast-scenarios', body),
    onSuccess: () => { toast({ title: 'Scenario created' }); refetchForecastScenarios(); setShowNewScenarioForm(false); },
  });
  const { mutate: runScenario, isPending: runScenarioPending } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest('POST', `/api/prestige-pass/admin/wallet/forecast-scenarios/${id}/run`, {}),
    onSuccess: (d) => { setScenarioRunResult(d.result); toast({ title: 'Scenario run complete' }); refetchForecastScenarios(); },
  });
  const { mutate: patchScenario, isPending: patchScenarioPending } = useMutation<any, any, { id: number; body: any }>({
    mutationFn: ({ id, body }) => apiRequest('PATCH', `/api/prestige-pass/admin/wallet/forecast-scenarios/${id}`, body),
    onSuccess: () => { toast({ title: 'Scenario updated' }); refetchForecastScenarios(); },
  });

  // ── Phase 3.7D: Exception Suggestions ──────────────────────────────────────
  const { data: exceptionSuggestionsData, isLoading: exceptionSuggestionsLoading, refetch: refetchExceptionSuggestions } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/exception-suggestions'],
  });
  const { mutate: generateSuggestions, isPending: generateSuggestionsPending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest('POST', '/api/prestige-pass/admin/wallet/exception-suggestions/generate', {}),
    onSuccess: (d) => { toast({ title: 'Suggestions generated', description: `${d.generated} new items` }); refetchExceptionSuggestions(); },
  });
  const { mutate: applySuggestion, isPending: applySuggestionPending } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest('POST', `/api/prestige-pass/admin/wallet/exception-suggestions/${id}/apply`, {}),
    onSuccess: () => { toast({ title: 'Suggestion applied' }); refetchExceptionSuggestions(); },
  });
  const { mutate: dismissSuggestion } = useMutation<any, any, number>({
    mutationFn: (id) => apiRequest('POST', `/api/prestige-pass/admin/wallet/exception-suggestions/${id}/dismiss`, {}),
    onSuccess: () => { toast({ title: 'Dismissed' }); refetchExceptionSuggestions(); },
  });

  // ── Phase 3.7E: Governance Report ──────────────────────────────────────────
  const { data: governanceReport, isLoading: governanceReportLoading, refetch: refetchGovernanceReport } = useQuery<any>({
    queryKey: ['/api/prestige-pass/admin/wallet/governance-report'],
  });

  // ── Phase 3.7F: Finance Assistant ──────────────────────────────────────────
  const [assistantContext, setAssistantContext] = useState('');
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantResult, setAssistantResult] = useState<any>(null);
  const { mutate: askAssistant, isPending: askAssistantPending } = useMutation<any, any, { context: string; question: string }>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/finance-assistant', body),
    onSuccess: (d) => { setAssistantResult(d); },
  });

  // ── Phase 3.6 UI aliases & supplemental state ──────────────────────────────
  // 3.6A — weight form state for the UI card
  const [weightForm, setWeightForm] = useState({ signalKey: '', divisionCode: '', weight: '' });
  const { mutate: upsertForecastWeight, isPending: upsertWeightPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/cash-forecast/weights', body),
    onSuccess: () => { toast({ title: 'Weight saved' }); refetchForecastWeights(); setWeightForm({ signalKey: '', divisionCode: '', weight: '' }); },
  });
  const { mutate: recomputeForecast, isPending: recomputeForecastPending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest('POST', '/api/prestige-pass/admin/wallet/cash-forecast/recompute', { horizonDays: 30 }),
    onSuccess: (d) => { toast({ title: 'Forecast recomputed', description: `Horizon: ${d.horizonDays}d` }); },
  });
  // 3.6C — single upsert helper that always POSTs (backend handles UPSERT)
  const { mutate: upsertDigestPref } = useMutation<any, any, { key: string; value: any }>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/digest-preferences', body),
    onSuccess: () => { toast({ title: 'Preference updated' }); refetchDigestPrefs(); },
  });
  // 3.6D — retrieval form & aliases matching UI expectations
  const [retrievalForm, setRetrievalForm] = useState({ entityType: '', entityId: '', reason: '', dateRange: '' });
  const retrievals = archiveRetrievals;
  const retrievalsLoading = archiveRetrievalsLoading;
  const { mutate: createRetrieval, isPending: createRetrievalPending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/archive/retrieve', body),
    onSuccess: (d) => { toast({ title: 'Retrieval requested', description: `ID: ${d.retrieval?.id}` }); refetchArchiveRetrievals(); setRetrievalForm({ entityType: '', entityId: '', reason: '', dateRange: '' }); },
  });
  const markRetrievalReadyPending = markReadyPending;
  // 3.6E — diff viewer state (two run IDs comparison)
  const [diffRunA, setDiffRunA] = useState('');
  const [diffRunB, setDiffRunB] = useState('');
  const [replayDiff, setReplayDiff] = useState<any>(null);
  const { mutate: computeReplayDiff, isPending: computeDiffPending } = useMutation<any, any, { runAId: number; runBId: number }>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/replay/diff', body),
    onSuccess: (d) => { setReplayDiff(d); toast({ title: 'Diff computed', description: `${d.divergenceCount ?? 0} divergence(s)` }); },
  });
  // 3.6F — policy engine aliases
  const policyRules = financePolicies;
  const policyRulesLoading = financePoliciesLoading;
  const [newRuleForm, setNewRuleForm] = useState({ policyKey: '', value: '', divisionCode: '', description: '' });
  const { mutate: upsertPolicyRule, isPending: upsertPolicyRulePending } = useMutation<any, any, any>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/policies', body),
    onSuccess: () => { toast({ title: 'Policy rule saved' }); refetchFinancePolicies(); setNewRuleForm({ policyKey: '', value: '', divisionCode: '', description: '' }); },
  });
  // 3.6G — period close pack aliases
  const periodPacks = periodPackData;
  const periodPacksLoading = periodPackLoading;
  const [closePeriodType, setClosePeriodType] = useState<'quarter' | 'year'>('quarter');
  const [closePeriodValue, setClosePeriodValue] = useState('');
  const { mutate: generatePeriodPack, isPending: generatePeriodPackPending } = useMutation<any, any, { type: string; period: string }>({
    mutationFn: (body) => apiRequest('POST', '/api/prestige-pass/admin/wallet/period-pack/generate', body),
    onSuccess: (d) => { toast({ title: 'Period pack generated', description: `${d.pack?.period} — ${d.pack?.recordCount} records` }); refetchPeriodPack(); },
  });
  const { mutate: exportPeriodPack, isPending: exportPeriodPackPending } = useMutation<any, any, void>({
    mutationFn: () => apiRequest('GET', '/api/prestige-pass/admin/wallet/period-pack/export'),
    onSuccess: (d) => { toast({ title: 'Export ready', description: d.filename ?? 'period-pack.json' }); },
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
            <TabsTrigger value="approvals" className="relative">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Approvals
              {pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-rose-600 text-white rounded-full">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="support">
              <LifeBuoy className="w-4 h-4 mr-2" />
              Support Actions
            </TabsTrigger>
            <TabsTrigger value="payouts">
              <DollarSign className="w-4 h-4 mr-2" />
              Payouts
            </TabsTrigger>
            <TabsTrigger value="batches">
              <Package className="w-4 h-4 mr-2" />
              Payout Batches
            </TabsTrigger>
            <TabsTrigger value="disputes">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Disputes
            </TabsTrigger>
            <TabsTrigger value="settlement">
              <BarChart3 className="w-4 h-4 mr-2" />
              Settlement
            </TabsTrigger>
            <TabsTrigger value="roles">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Finance Roles
            </TabsTrigger>
            <TabsTrigger value="fin-activity">
              <Activity className="w-4 h-4 mr-2" />
              Finance Activity
            </TabsTrigger>
            <TabsTrigger value="recon-exceptions">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Recon Exceptions
            </TabsTrigger>
            <TabsTrigger value="board-pack">
              <TrendingUp className="w-4 h-4 mr-2" />
              Board Pack
            </TabsTrigger>
            <TabsTrigger value="integrity">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Integrity
            </TabsTrigger>
            <TabsTrigger value="forecast">
              <TrendingUp className="w-4 h-4 mr-2" />
              Forecast
            </TabsTrigger>
            <TabsTrigger value="schedules">
              <CalendarClock className="w-4 h-4 mr-2" />
              Schedules
            </TabsTrigger>
            <TabsTrigger value="routing">
              <GitMerge className="w-4 h-4 mr-2" />
              Routing
            </TabsTrigger>
            <TabsTrigger value="control-center">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Control Center
            </TabsTrigger>
            <TabsTrigger value="executive">
              <BarChart3 className="w-4 h-4 mr-2" />
              Executive
            </TabsTrigger>
            <TabsTrigger value="archive">
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </TabsTrigger>
            <TabsTrigger value="recovery">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Recovery
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Settings className="w-4 h-4 mr-2" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="simulation">
              <FlaskConical className="w-4 h-4 mr-2" />
              Simulation
            </TabsTrigger>
            <TabsTrigger value="governance">
              <Building2 className="w-4 h-4 mr-2" />
              Governance
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
                                <div className="flex items-center gap-1.5 flex-wrap">
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
                                  {row.reversed ? (
                                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium" title={row.reversedByTxnId ?? ""}>בוטל</span>
                                  ) : (() => {
                                    const isReversible = (row.source === 'admin_credit' || row.source === 'admin_debit') && !!row.adminUid;
                                    const ageMs = Date.now() - new Date(row.createdAt).getTime();
                                    const withinWindow = ageMs <= 24 * 60 * 60 * 1000;
                                    if (!isReversible || !withinWindow) return null;
                                    return (
                                      <button
                                        className="text-xs text-rose-600 hover:text-rose-800 border border-rose-300 rounded px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap hover:bg-rose-50"
                                        onClick={() => { setReverseModal({ txnId: row.txnId, source: row.source, amountCents: row.amountCents, userId: row.userId }); setReverseReason(""); setReverseResult(null); }}
                                        title="Reverse this admin action (within 24h)"
                                      >
                                        ↩ בטל
                                      </button>
                                    );
                                  })()}
                                </div>
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

          {/* ── APPROVALS (2.9D) ── */}
          <TabsContent value="approvals" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    Refund Approval Queue
                    {pendingCount > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-full">
                        {pendingCount} pending
                      </span>
                    )}
                  </CardTitle>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchPendingApprovals()}>
                    Refresh
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  Refunds above the auto-approve threshold (₪{((Number(process.env.REFUND_AUTO_APPROVE_LIMIT_CENTS ?? 50)) / 100).toFixed(0) ?? "50"} default ₪50) require a second admin approver.
                  The approver cannot be the original requester.
                </p>
              </CardHeader>
              <CardContent>
                {/* Info bar */}
                <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-500">
                  <div className="px-2 py-1 bg-blue-50 border border-blue-100 rounded">
                    <span className="font-semibold text-blue-800">Auto-approve threshold:</span> ₪50.00 (env: REFUND_AUTO_APPROVE_LIMIT_CENTS)
                  </div>
                  <div className="px-2 py-1 bg-amber-50 border border-amber-100 rounded">
                    <span className="font-semibold text-amber-700">Self-approve:</span> Blocked at server level
                  </div>
                  <div className="px-2 py-1 bg-rose-50 border border-rose-100 rounded">
                    <span className="font-semibold text-rose-700">Reject:</span> Zero wallet mutations
                  </div>
                </div>

                {!pendingApprovalsData ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : pendingCount === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm text-gray-400 font-medium">No pending refund approvals</p>
                    <p className="text-xs text-gray-400 mt-1">All requests are either auto-approved or already reviewed.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(pendingApprovalsData.pending as any[]).map((row: any) => (
                      <div key={row.refund_request_id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs font-mono font-bold text-amber-800">{row.refund_request_id}</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              Requested by <span className="font-mono">{row.requested_by_uid?.slice(0, 12)}…</span>
                              {" · "}{new Date(row.created_at).toLocaleString("he-IL")}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded uppercase">
                            pending
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Amount</p>
                            <p className="text-sm font-bold text-gray-900">₪{(row.amount_cents / 100).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Booking</p>
                            <p className="text-xs font-mono text-gray-700 truncate" title={row.booking_id}>{row.booking_id ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Type</p>
                            <p className="text-xs text-gray-700">{row.booking_type ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase">Dispute Ref</p>
                            <p className="text-xs font-mono text-gray-700">{row.linked_dispute_case_ref ?? "—"}</p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <p className="text-[10px] text-gray-400 uppercase mb-0.5">Reason</p>
                          <p className="text-xs text-gray-700 bg-white border border-amber-100 rounded px-2 py-1.5">{row.reason}</p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
                            disabled={approvePending || rejectPending}
                            onClick={() => approveRefund(row.refund_request_id)}
                          >
                            {approvePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Approve &amp; Execute Refund
                          </button>
                          <button
                            className="px-3 py-2 text-xs font-semibold border border-rose-300 text-rose-700 rounded hover:bg-rose-50 disabled:opacity-50 flex items-center justify-center gap-1"
                            disabled={approvePending || rejectPending}
                            onClick={() => rejectRefund(row.refund_request_id)}
                          >
                            {rejectPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Linked Dispute Ref <span className="font-normal text-gray-400">(optional — DSP-…)</span>
                    </label>
                    <Input
                      placeholder="DSP-…"
                      {...issueRefundForm.register("linkedDisputeCaseRef")}
                      className="max-w-xs text-sm font-mono"
                    />
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
                  <div className={`mt-3 p-3 rounded-lg text-sm space-y-1 ${
                    issueRefundResult.autoApproved
                      ? "border border-emerald-200 bg-emerald-50"
                      : "border border-amber-200 bg-amber-50"
                  }`}>
                    {issueRefundResult.autoApproved ? (
                      <>
                        <p className="font-medium text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {issueRefundResult.refund?.actionTaken === "release" ? "Degraded to Hold Release" : "Refund Auto-Approved & Executed"}
                        </p>
                        <p className="text-xs text-emerald-700">Amount: <strong>{centsToILS(issueRefundResult.refund?.amountCents ?? 0)}</strong></p>
                        <p className="text-xs font-mono text-emerald-600">TxnID: {issueRefundResult.refund?.txnId}</p>
                        <p className="text-xs text-emerald-600">Approval ID: <span className="font-mono">{issueRefundResult.approvalId}</span></p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Refund Pending Second Approval
                        </p>
                        <p className="text-xs text-amber-700">{issueRefundResult.message}</p>
                        <p className="text-xs text-amber-700">Amount: <strong>{centsToILS(issueRefundResult.amountCents ?? (issueRefundResult.limitCents ?? 0))}</strong></p>
                        <p className="text-xs font-mono text-amber-800">Approval ID: {issueRefundResult.approvalId}</p>
                        <p className="text-xs text-amber-600">→ Go to the <strong>Approvals</strong> tab to approve or reject this request.</p>
                      </>
                    )}
                    <button className="text-xs underline text-gray-500 mt-1 block" onClick={() => setIssueRefundResult(null)}>Clear</button>
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

          {/* ── PAYOUTS (2.9A) ── */}
          <TabsContent value="payouts" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Provider Payout Ledger
                  </CardTitle>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => refetchPay()}
                  >Refresh</button>
                </div>
                <p className="text-sm text-gray-500">
                  net = gross − floor(gross × commission_bps / 10000). No wallet mutations.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Provider UID</label>
                    <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Firebase UID…"
                      value={payFilterUserId} onChange={e => setPayFilterUserId(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Division</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm"
                      value={payFilterDivision} onChange={e => setPayFilterDivision(e.target.value)}>
                      <option value="">All</option>
                      <option value="walkers">Walkers</option>
                      <option value="petsitter">Sitter Suite</option>
                      <option value="academy">Academy</option>
                      <option value="station_k9000">K9000</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm"
                      value={payFilterStatus} onChange={e => setPayFilterStatus(e.target.value)}>
                      <option value="">All</option>
                      <option value="earned">earned</option>
                      <option value="held">held</option>
                      <option value="paid">paid</option>
                      <option value="clawed_back">clawed_back</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Batch ID</label>
                    <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="batch_…"
                      value={payFilterBatch} onChange={e => setPayFilterBatch(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800"
                    onClick={() => { setPayApplied(true); setMarkPaidResult(null); setPaySelected([]); }}
                  >Apply Filters</button>
                  <button
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                    onClick={() => { setPayFilterUserId(""); setPayFilterDivision(""); setPayFilterStatus(""); setPayFilterBatch(""); setPayApplied(false); setPaySelected([]); setMarkPaidResult(null); }}
                  >Clear</button>
                </div>

                {/* Totals summary */}
                {payLedgerData?.totals && (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: "Entries",     val: payLedgerData.totals.count,           isMoney: false },
                      { label: "Gross",       val: payLedgerData.totals.grossCents,       isMoney: true  },
                      { label: "Net",         val: payLedgerData.totals.netCents,         isMoney: true  },
                      { label: "Earned",      val: payLedgerData.totals.earnedCents,      isMoney: true, highlight: "amber" },
                      { label: "Held",        val: payLedgerData.totals.heldCents,        isMoney: true, highlight: "blue"  },
                      { label: "Paid",        val: payLedgerData.totals.paidCents,        isMoney: true, highlight: "green" },
                    ].map(({ label, val, isMoney, highlight }) => (
                      <div key={label} className={`border rounded p-2 text-center ${highlight === 'amber' ? 'bg-amber-50 border-amber-200' : highlight === 'blue' ? 'bg-blue-50 border-blue-200' : highlight === 'green' ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50'}`}>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {isMoney ? `₪${((val as number) / 100).toFixed(2)}` : val}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mark-paid result banner */}
                {markPaidResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded px-4 py-2.5 text-sm flex items-center justify-between">
                    <span className="text-emerald-800">
                      Batch <code className="font-mono text-xs">{markPaidResult.batchId}</code> — {markPaidResult.updatedIds.length} paid,{" "}
                      {markPaidResult.skippedIds.length} skipped · Net ₪{((markPaidResult.batchTotals?.netCents ?? 0) / 100).toFixed(2)}
                    </span>
                    <button className="text-emerald-600 hover:text-emerald-800 text-xs" onClick={() => setMarkPaidResult(null)}>✕</button>
                  </div>
                )}

                {/* Bulk actions bar (shows when rows selected) */}
                {paySelected.length > 0 && (
                  <div className="bg-gray-900 text-white rounded px-4 py-2.5 flex items-center justify-between gap-4">
                    <span className="text-sm">{paySelected.length} entries selected</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="border border-gray-600 bg-gray-800 text-white rounded px-2 py-1 text-xs w-52"
                        placeholder="Optional note for batch…"
                        value={markPaidNote}
                        onChange={e => setMarkPaidNote(e.target.value)}
                      />
                      <button
                        className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded disabled:opacity-50"
                        disabled={markPaidPending}
                        onClick={() => markPaid({ entryIds: paySelected, note: markPaidNote })}
                      >
                        {markPaidPending ? "Processing…" : "Mark Paid"}
                      </button>
                      <button
                        className="text-xs text-gray-400 hover:text-white"
                        onClick={() => setPaySelected([])}
                      >Clear</button>
                    </div>
                  </div>
                )}

                {/* Table */}
                {payLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : !payLedgerData?.entries?.length ? (
                  <div className="border rounded p-10 text-center text-gray-400 text-sm">
                    {payApplied ? "No entries match these filters." : "Apply filters to load payout entries."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">
                            <input type="checkbox"
                              checked={paySelected.length === payLedgerData.entries.length && payLedgerData.entries.length > 0}
                              onChange={e => setPaySelected(e.target.checked ? payLedgerData.entries.map((r: any) => r.id) : [])}
                            />
                          </TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Provider</TableHead>
                          <TableHead className="text-xs">Division</TableHead>
                          <TableHead className="text-xs">Booking</TableHead>
                          <TableHead className="text-xs text-right">Gross</TableHead>
                          <TableHead className="text-xs text-right">Commission</TableHead>
                          <TableHead className="text-xs text-right">Net</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Batch</TableHead>
                          <TableHead className="text-xs">Paid At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(payLedgerData.entries as any[]).map((entry: any) => {
                          const commissionCents = entry.grossCents - entry.netCents;
                          const statusChip: Record<string, string> = {
                            earned:      "bg-amber-100 text-amber-800",
                            held:        "bg-blue-100 text-blue-800",
                            paid:        "bg-emerald-100 text-emerald-800",
                            clawed_back: "bg-red-100 text-red-700",
                          };
                          const isSelected = paySelected.includes(entry.id);
                          const isPayable  = entry.status === 'earned' || entry.status === 'held';
                          return (
                            <TableRow key={entry.id} className={isSelected ? "bg-blue-50" : undefined}>
                              <TableCell>
                                {isPayable && (
                                  <input type="checkbox" checked={isSelected}
                                    onChange={e => setPaySelected(prev => e.target.checked ? [...prev, entry.id] : prev.filter(x => x !== entry.id))}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-mono whitespace-nowrap">
                                {new Date(entry.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-500 max-w-[100px] truncate" title={entry.providerUid}>
                                {entry.providerUid.slice(0, 10)}…
                              </TableCell>
                              <TableCell className="text-xs">{entry.divisionCode}</TableCell>
                              <TableCell className="text-xs font-mono text-gray-400 max-w-[80px] truncate" title={entry.bookingId ?? ""}>
                                {entry.bookingId ? `${entry.bookingId.slice(0, 8)}…` : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">₪{(entry.grossCents / 100).toFixed(2)}</TableCell>
                              <TableCell className="text-xs text-right font-mono text-gray-500">
                                ₪{(commissionCents / 100).toFixed(2)}
                                <span className="text-gray-400 ml-1">({(entry.commissionRateBps / 100).toFixed(0)}%)</span>
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono font-semibold text-emerald-700">
                                ₪{(entry.netCents / 100).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusChip[entry.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {entry.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-400 max-w-[90px] truncate" title={entry.payoutBatchId ?? ""}>
                                {entry.payoutBatchId ? entry.payoutBatchId.slice(0, 12) + "…" : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                                {entry.paidAt ? new Date(entry.paidAt).toLocaleDateString("he-IL") : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-gray-400 mt-2 text-right">
                      {payLedgerData.totals?.count} result{payLedgerData.totals?.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── DAILY FINANCE CLOSE (2.9E) ────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-700" />
                    Daily Close
                    {closeRecord?.status === "closed" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full uppercase">Locked</span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={closeDate}
                      max={today}
                      onChange={(e) => { setCloseDate(e.target.value); }}
                      className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700"
                    />
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchClose()}>Refresh</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {closeLoading ? (
                  <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : (
                  <>
                    {/* ── Checklist ── */}
                    <div className="mb-4 space-y-2">
                      {([
                        ["noOpenAnomalies",          "No open anomalies"],
                        ["noStaleHolds",             "No stale holds (>72h)"],
                        ["noPendingDisputes",        "No pending disputes"],
                        ["noPendingRefundApprovals", "No pending refund approvals"],
                      ] as [string, string][]).map(([key, label]) => {
                        const item = closeChecklist[key];
                        return (
                          <div key={key} className={`flex items-center justify-between px-3 py-2 rounded border ${item?.ok ? "border-emerald-100 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                            <div className="flex items-center gap-2 text-sm">
                              {item?.ok
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                              <span className={item?.ok ? "text-emerald-800" : "text-amber-800"}>{label}</span>
                            </div>
                            {!item?.ok && (
                              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{item?.count} blocking</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Closed state ── */}
                    {closeRecord?.status === "closed" ? (
                      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-emerald-700" />
                          <p className="text-sm font-semibold text-emerald-800">Day Closed & Locked</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400 uppercase text-[10px]">Closed By</p>
                            <p className="font-mono text-emerald-700">{closeRecord.closedByUid ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase text-[10px]">Closed At</p>
                            <p className="text-emerald-700">{closeRecord.closedAt ? new Date(closeRecord.closedAt).toLocaleString("he-IL") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase text-[10px]">VAT Liability</p>
                            <p className="font-bold text-emerald-700">{centsToILS(closeRecord.vatLiabilityCents ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase text-[10px]">Exceptions</p>
                            <p className={`font-bold ${closeRecord.exceptionCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>{closeRecord.exceptionCount}</p>
                          </div>
                        </div>
                        {closeRecord.notes && (
                          <div>
                            <p className="text-gray-400 uppercase text-[10px] mb-1">Notes</p>
                            <p className="text-xs text-emerald-700 bg-white border border-emerald-100 rounded px-2 py-1.5">{closeRecord.notes}</p>
                          </div>
                        )}
                        {/* ── 3.0E Export Bundle ── */}
                        <div className="flex justify-end">
                          <button
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-emerald-300 bg-white text-emerald-700 rounded hover:bg-emerald-50 font-medium"
                            onClick={async () => {
                              try {
                                const res = await fetch(
                                  `/api/prestige-pass/admin/wallet/finance-close/${closeRecord.closeDate ?? closeDate}/export`,
                                  { credentials: "include" }
                                );
                                if (!res.ok) throw new Error(await res.text());
                                const blob = await res.blob();
                                const url  = URL.createObjectURL(blob);
                                const a    = document.createElement("a");
                                a.href     = url;
                                a.download = `petwash-finance-${closeRecord.closeDate ?? closeDate}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (e: any) {
                                toast({ title: "Export failed", description: e.message, variant: "destructive" });
                              }
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Audit Pack
                          </button>
                        </div>

                        {/* Division snapshot chips */}
                        {closeRecord.divisionSnapshots && (
                          <div>
                            <p className="text-gray-400 uppercase text-[10px] mb-2">Division Snapshots</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(closeRecord.divisionSnapshots as Record<string, any>).map(([div, snap]: [string, any]) => (
                                <div key={div} className="px-2 py-1 bg-white border border-emerald-100 rounded text-[10px]">
                                  <span className="font-semibold text-emerald-800 capitalize">{div.replace("_", " ")}</span>
                                  <span className="text-gray-500"> · </span>
                                  <span className="text-emerald-700">{centsToILS(snap.collectedCents)}</span>
                                  <span className="text-gray-400"> collected</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── Open state ── */
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optional)</label>
                          <textarea
                            rows={2}
                            value={closeNotes}
                            onChange={(e) => setCloseNotes(e.target.value)}
                            placeholder="EOD note for the record…"
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none"
                          />
                        </div>
                        <button
                          disabled={!allClear || closePending}
                          onClick={() => executeClose()}
                          className={`w-full py-2 px-4 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                            allClear
                              ? "bg-blue-700 text-white hover:bg-blue-800"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {closePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                          {allClear ? `Close ${closeDate}` : "Checklist must be clear to close"}
                        </button>
                        {!allClear && (
                          <p className="text-xs text-amber-700 text-center">
                            {Object.entries(closeChecklist).filter(([, v]) => !v.ok).length} item(s) blocking close.
                            Clear them in the Anomalies, Disputes, or Approvals tabs first.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── CLOSE HISTORY (2.9E) ──────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-gray-600" />
                    Close History
                    <span className="text-xs font-normal text-gray-400">(last 30 days)</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* ── 3.0F Month-end Pack ── */}
                    <input
                      type="month"
                      defaultValue={today.slice(0, 7)}
                      id="month-pack-input"
                      className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700"
                    />
                    <button
                      className="text-xs flex items-center gap-1 px-2 py-1 border border-violet-300 text-violet-700 rounded hover:bg-violet-50"
                      onClick={async () => {
                        const monthInput = (document.getElementById("month-pack-input") as HTMLInputElement);
                        const month = monthInput?.value;
                        if (!month) return;
                        try {
                          const res = await fetch(
                            `/api/prestige-pass/admin/wallet/finance-close/month-export?month=${month}`,
                            { credentials: "include" }
                          );
                          if (!res.ok) throw new Error(await res.text());
                          const blob = await res.blob();
                          const url  = URL.createObjectURL(blob);
                          const a    = document.createElement("a");
                          a.href     = url;
                          a.download = `petwash-finance-month-${month}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (e: any) {
                          toast({ title: "Month-end export failed", description: e.message, variant: "destructive" });
                        }
                      }}
                    >
                      <Download className="w-3 h-3" />
                      Month-end Pack
                    </button>
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchCloseHistory()}>Refresh</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!closeHistory?.records || closeHistory.records.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <CalendarDays className="w-7 h-7 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm text-gray-400">No close records yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Date</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Status</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Closed By</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Closed At</th>
                          <th className="text-right py-2 pr-3 text-gray-400 font-medium">VAT</th>
                          <th className="text-right py-2 text-gray-400 font-medium">Exceptions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(closeHistory.records as any[]).map((r: any) => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-3 font-mono text-gray-700">{String(r.closeDate).slice(0, 10)}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                r.status === "closed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}>{r.status}</span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-500">{r.closedByUid ? r.closedByUid.slice(0, 12) + "…" : "—"}</td>
                            <td className="py-2 pr-3 text-gray-500">{r.closedAt ? new Date(r.closedAt).toLocaleString("he-IL") : "—"}</td>
                            <td className="py-2 pr-3 text-right text-gray-700">{centsToILS(r.vatLiabilityCents ?? 0)}</td>
                            <td className={`py-2 text-right font-medium ${r.exceptionCount > 0 ? "text-amber-600" : "text-gray-400"}`}>{r.exceptionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PAYOUT BATCHES (3.0A) ── */}
          <TabsContent value="batches" className="mt-4 space-y-4">
            {/* Totals cards */}
            {batchListData?.batches && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Batches", value: batchListData.batches.length },
                  { label: "Total Providers", value: batchListData.batches.reduce((s: number, b: any) => s + (b.totalProviders ?? 0), 0) },
                  { label: "Total Net (ILS)", value: `₪${(batchListData.batches.reduce((s: number, b: any) => s + (b.totalNetCents ?? 0), 0) / 100).toLocaleString("he-IL", { minimumFractionDigits: 2 })}` },
                  { label: "Total Entries", value: batchListData.batches.reduce((s: number, b: any) => s + (b.entryCount ?? 0), 0) },
                ].map(c => (
                  <Card key={c.label} className="p-4">
                    <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                    <div className="text-xl font-bold">{c.value}</div>
                  </Card>
                ))}
              </div>
            )}

            {/* Create batch panel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" /> Create Payout Batch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Entry IDs (comma-separated)</label>
                  <input
                    className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                    placeholder="1,2,3,4"
                    value={batchCreateIds}
                    onChange={e => setBatchCreateIds(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">IDs must be in earned or held status. Already-paid entries are detected and handled for idempotency.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
                  <input
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="Weekly payout — week 12"
                    value={batchCreateNotes}
                    onChange={e => setBatchCreateNotes(e.target.value)}
                  />
                </div>
                <button
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                  disabled={createBatchPending || !batchCreateIds.trim()}
                  onClick={() => {
                    const ids = batchCreateIds.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                    if (ids.length === 0) return;
                    createBatch({ entryIds: ids, notes: batchCreateNotes });
                  }}
                >
                  {createBatchPending ? "Creating…" : "Create Batch"}
                </button>

                {batchCreateResult && (
                  <div className={`rounded border p-3 text-sm space-y-1 ${batchCreateResult.idempotent ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                    <div className="font-semibold">{batchCreateResult.idempotent ? "Existing batch returned (idempotent)" : "Batch created"}</div>
                    <div>Batch ID: <span className="font-mono">{batchCreateResult.batchId}</span></div>
                    <div>Entries marked paid: {batchCreateResult.updatedIds?.length ?? 0}</div>
                    <div>Entries already paid (skipped): {batchCreateResult.skippedIds?.length ?? 0}</div>
                    {batchCreateResult.batch && (
                      <div>Net total: ₪{((batchCreateResult.batch.total_net_cents ?? batchCreateResult.batch.totalNetCents ?? 0) / 100).toFixed(2)}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Batch list */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">All Batches</CardTitle>
                  <button className="text-xs text-gray-500 hover:text-gray-800 border rounded px-2 py-1" onClick={() => refetchBatchList()}>Refresh</button>
                </div>
              </CardHeader>
              <CardContent>
                {batchListLoading ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Loading batches…</div>
                ) : !batchListData?.batches?.length ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No batches yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500">
                          <th className="py-2 pr-4">Batch ID</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Providers</th>
                          <th className="py-2 pr-4">Entries</th>
                          <th className="py-2 pr-4">Net (ILS)</th>
                          <th className="py-2 pr-4">Created</th>
                          <th className="py-2 pr-4">Notes</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchListData.batches.map((b: any) => (
                          <tr key={b.batchId} className={`border-b hover:bg-gray-50 cursor-pointer ${selectedBatchId === b.batchId ? "bg-blue-50" : ""}`}>
                            <td className="py-2 pr-4 font-mono text-xs" onClick={() => setSelectedBatchId(selectedBatchId === b.batchId ? null : b.batchId)}>
                              {b.batchId}
                            </td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.status === "completed" ? "bg-emerald-100 text-emerald-700" : b.status === "exported" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2 pr-4">{b.totalProviders}</td>
                            <td className="py-2 pr-4">{b.entryCount}</td>
                            <td className="py-2 pr-4 font-mono">₪{(b.totalNetCents / 100).toFixed(2)}</td>
                            <td className="py-2 pr-4 text-xs text-gray-500">{b.createdAt ? new Date(b.createdAt).toLocaleString("he-IL") : "—"}</td>
                            <td className="py-2 pr-4 text-xs text-gray-500 max-w-[140px] truncate">{b.notes || "—"}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  onClick={() => setSelectedBatchId(selectedBatchId === b.batchId ? null : b.batchId)}
                                >
                                  <ChevronRight className="w-3 h-3" />
                                  Detail
                                </button>
                                <a
                                  href={`/api/prestige-pass/admin/wallet/payout-batches/${b.batchId}/export`}
                                  className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  CSV
                                </a>
                                {!['exported','completed'].includes(b.status) && (
                                  <button
                                    className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                                    onClick={() => setShowReleaseConfirm(showReleaseConfirm === b.batchId ? null : b.batchId)}
                                  >
                                    ↑ Release
                                  </button>
                                )}
                                {showReleaseConfirm === b.batchId && (
                                  <div className="absolute z-10 mt-8 right-0 bg-white border rounded-lg shadow-lg p-3 w-64 text-xs space-y-2">
                                    <div className="font-semibold text-gray-700">Request Release — ₪{(b.totalNetCents/100).toFixed(0)}</div>
                                    <input placeholder="Reason (optional)" value={releaseReason[b.batchId] ?? ''}
                                      onChange={e => setReleaseReason(r => ({...r, [b.batchId]: e.target.value}))}
                                      className="border rounded px-2 py-1 w-full"/>
                                    <div className="flex gap-2">
                                      <button disabled={requestReleasePending}
                                        onClick={() => requestRelease({ batchId: b.batchId, reason: releaseReason[b.batchId] ?? '' })}
                                        className="flex-1 px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-40">
                                        {requestReleasePending ? '…' : 'Confirm'}
                                      </button>
                                      <button onClick={() => setShowReleaseConfirm(null)} className="flex-1 px-2 py-1 border rounded hover:bg-gray-100">Cancel</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.5B: Pending Release Approvals */}
            {(pendingReleasesData?.approvals?.length > 0 || pendingReleasesLoading) && (
              <Card className="border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" /> Payout Release Approvals
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">{pendingReleasesData?.total ?? 0} pending</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingReleasesLoading ? (
                    <div className="h-16 bg-gray-100 animate-pulse rounded"/>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-amber-50">
                        <tr className="text-gray-500">
                          <th className="text-left p-2">Batch</th><th className="text-right p-2">Amount</th>
                          <th className="text-left p-2">Requested By</th><th className="text-left p-2">Reason</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead><tbody>
                        {pendingReleasesData.approvals.map((a: any) => (
                          <tr key={a.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-700">{a.batchId}</td>
                            <td className="p-2 text-right font-bold text-amber-700">₪{(a.amountCents/100).toLocaleString('he-IL',{minimumFractionDigits:0})}</td>
                            <td className="p-2 font-mono text-gray-500 truncate max-w-24">{a.requestedByUid}</td>
                            <td className="p-2 text-gray-500 truncate max-w-32">{a.reason || '—'}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-1.5">
                                <button disabled={approveReleasePending} onClick={() => approveRelease(a.id)}
                                  className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-40">Approve</button>
                                <button disabled={rejectReleasePending} onClick={() => rejectRelease(a.id)}
                                  className="px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-40">Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Batch detail panel */}
            {selectedBatchId && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Batch detail — <span className="font-mono">{selectedBatchId}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <select
                        className="text-xs border rounded px-2 py-1.5 bg-white"
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        title="Export format"
                      >
                        <option value="csv">CSV (Standard)</option>
                        <option value="tranzilla">Tranzilla</option>
                        <option value="hapoalim">Bank Hapoalim</option>
                        <option value="mizrahi">Bank Mizrahi</option>
                        <option value="iban_csv">IBAN / SEPA</option>
                        <option value="quickbooks_iif">QuickBooks IIF</option>
                      </select>
                      <a
                        href={`/api/prestige-pass/admin/wallet/payout-batches/${selectedBatchId}/export?format=${selectedFormat}`}
                        className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Export for Bank
                      </a>
                      <button
                        disabled={sendRemittancesPending}
                        onClick={() => sendRemittances(selectedBatchId)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
                      >
                        {sendRemittancesPending ? "Sending…" : "✉ Send Remittances"}
                      </button>
                      <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setSelectedBatchId(null)}>✕ Close</button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {batchDetailLoading ? (
                    <div className="text-center py-6 text-gray-400 text-sm">Loading…</div>
                  ) : batchDetailData?.error ? (
                    <div className="text-red-500 text-sm">{batchDetailData.error}</div>
                  ) : (
                    <div className="space-y-4">
                      {/* Header totals */}
                      {batchDetailData?.totals && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: "Entries", value: batchDetailData.totals.entryCount },
                            { label: "Providers", value: batchDetailData.totals.providerCount },
                            { label: "Gross (ILS)", value: `₪${(batchDetailData.totals.grossCents / 100).toFixed(2)}` },
                            { label: "Net (ILS)", value: `₪${(batchDetailData.totals.netCents / 100).toFixed(2)}` },
                          ].map(c => (
                            <div key={c.label} className="bg-gray-50 rounded p-3">
                              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                              <div className="font-bold">{c.value}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* By-provider breakdown */}
                      {batchDetailData?.byProvider?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-2">By Provider</div>
                          <div className="space-y-2">
                            {batchDetailData.byProvider.map((prov: any) => (
                              <div key={prov.providerUid} className="border rounded p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-mono text-xs text-gray-700">{prov.providerUid}</span>
                                  <span className="text-xs font-medium">
                                    Gross: ₪{(prov.grossCents / 100).toFixed(2)} · Net: ₪{(prov.netCents / 100).toFixed(2)}
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-gray-400 border-b">
                                        <th className="pb-1 pr-3">ID</th>
                                        <th className="pb-1 pr-3">Division</th>
                                        <th className="pb-1 pr-3">Booking</th>
                                        <th className="pb-1 pr-3">Gross</th>
                                        <th className="pb-1 pr-3">Commission</th>
                                        <th className="pb-1">Net</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {prov.entries.map((e: any) => (
                                        <tr key={e.id} className="border-b last:border-0">
                                          <td className="py-1 pr-3 font-mono">{e.id}</td>
                                          <td className="py-1 pr-3">{e.divisionCode}</td>
                                          <td className="py-1 pr-3 font-mono">{e.bookingId ?? "—"}</td>
                                          <td className="py-1 pr-3">₪{(e.grossCents / 100).toFixed(2)}</td>
                                          <td className="py-1 pr-3">₪{((e.grossCents - e.netCents) / 100).toFixed(2)}</td>
                                          <td className="py-1">₪{(e.netCents / 100).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 3.1C + 3.2B: Remittance Delivery Log with Retry Controls ── */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Remittance Delivery Log</span>
                      <div className="flex items-center gap-2">
                        {remittanceLogData?.summary && (
                          <span className="text-xs text-gray-400">
                            {remittanceLogData.summary.sent} sent · {remittanceLogData.summary.failed} failed · {remittanceLogData.summary.pending} pending
                          </span>
                        )}
                        {remittanceLogData?.summary?.failed > 0 && (
                          <button
                            disabled={retryFailedPending}
                            onClick={() => retryFailed(selectedBatchId!)}
                            className="text-xs px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                          >
                            {retryFailedPending ? "Retrying…" : `↺ Retry All Failed (${remittanceLogData.summary.failed})`}
                          </button>
                        )}
                      </div>
                    </div>
                    {remittanceLogLoading ? (
                      <div className="text-xs text-gray-400 py-2">Loading…</div>
                    ) : !remittanceLogData?.entries?.length ? (
                      <div className="text-xs text-gray-400 py-2">No remittances sent for this batch yet. Click "✉ Send Remittances" above.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 border-b">
                            <th className="pb-1 pr-3">Provider UID</th>
                            <th className="pb-1 pr-3">Status</th>
                            <th className="pb-1 pr-3">Sent At</th>
                            <th className="pb-1 pr-3">Retries</th>
                            <th className="pb-1 pr-3">Error</th>
                            <th className="pb-1">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {remittanceLogData.entries.map((e: any) => (
                            <tr key={e.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-3 font-mono text-gray-700">{e.providerUid}</td>
                              <td className="py-1.5 pr-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  e.status === 'sent'    ? 'bg-green-100 text-green-700' :
                                  e.status === 'failed'  ? 'bg-red-100 text-red-700' :
                                                           'bg-yellow-100 text-yellow-700'
                                }`}>{e.status}</span>
                              </td>
                              <td className="py-1.5 pr-3 text-gray-500">{e.sentAt ? new Date(e.sentAt).toLocaleString() : '—'}</td>
                              <td className="py-1.5 pr-3 text-gray-400">{e.retryCount ?? 0}</td>
                              <td className="py-1.5 pr-3 text-red-500 truncate max-w-[160px]">{e.errorDetail ?? '—'}</td>
                              <td className="py-1.5">
                                {e.status !== 'sent' && (
                                  <button
                                    disabled={resendPending}
                                    onClick={() => resendRemittance(e.providerUid)}
                                    className="text-[10px] px-2 py-0.5 border border-blue-300 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-40"
                                  >
                                    Retry
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* ── 3.2A: Bank Reconciliation Upload ── */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Reconciliation</span>
                      {reconData?.summary && (
                        <span className="text-xs text-gray-400">
                          {reconData.summary.settled}/{reconData.summary.total} entries settled · ₪{((reconData.summary.settledNetCents ?? 0) / 100).toFixed(2)} confirmed
                        </span>
                      )}
                    </div>

                    {/* Settlement progress bar */}
                    {reconData?.summary?.total > 0 && (
                      <div className="mb-3">
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.round((reconData.summary.settled / reconData.summary.total) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span>{reconData.summary.settled} settled</span>
                          <span>{reconData.summary.unsettled} pending</span>
                        </div>
                      </div>
                    )}

                    {/* Upload zone */}
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="text-xs text-gray-500 mb-2">
                        Upload bank payment CSV — columns: <span className="font-mono">provider_uid</span> (required), <span className="font-mono">bank_ref</span>, <span className="font-mono">amount_ils</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={e => setReconFile(e.target.files?.[0] ?? null)}
                          className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
                        />
                        <button
                          disabled={!reconFile || reconUploading}
                          onClick={uploadReconFile}
                          className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-40 shrink-0"
                        >
                          {reconUploading ? "Uploading…" : "Upload & Match"}
                        </button>
                      </div>
                    </div>

                    {/* Upload history */}
                    {reconLoading ? (
                      <div className="text-xs text-gray-400 mt-2">Loading…</div>
                    ) : reconData?.uploads?.length > 0 ? (
                      <div className="mt-3">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Upload History</div>
                        {reconData.uploads.map((u: any) => (
                          <div key={u.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-xs">
                            <span className="font-mono text-gray-600">{u.fileName}</span>
                            <span className="text-gray-400">{u.matchedCount} matched · {u.unmatchedCount} unmatched</span>
                            <span className="text-gray-400">{new Date(u.createdAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Per-provider settlement table */}
                    {reconData?.providers?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Provider Settlement Status</div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-400 border-b">
                              <th className="pb-1 pr-3">Provider UID</th>
                              <th className="pb-1 pr-3">Net (₪)</th>
                              <th className="pb-1 pr-3">Bank Ref</th>
                              <th className="pb-1">Settled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reconData.providers.map((p: any) => (
                              <tr key={p.providerUid} className="border-b last:border-0">
                                <td className="py-1.5 pr-3 font-mono text-gray-700">{p.providerUid}</td>
                                <td className="py-1.5 pr-3">₪{(p.netCents / 100).toFixed(2)}</td>
                                <td className="py-1.5 pr-3 font-mono text-gray-400">{p.bankRef ?? '—'}</td>
                                <td className="py-1.5">
                                  {p.settled ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Settled</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">Pending</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 3.1B: Clawback Summary ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-red-500">⊖</span> Clawback Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clawbackSummaryLoading ? (
                  <div className="text-xs text-gray-400 py-3">Loading…</div>
                ) : !clawbackSummaryData?.total ? (
                  <div className="text-xs text-gray-400 py-3">No clawbacks recorded.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Total Clawbacks</span>
                        <p className="font-bold">{clawbackSummaryData.total}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Total Amount</span>
                        <p className="font-bold text-red-600">₪{((clawbackSummaryData.totalClawbackCents ?? 0) / 100).toFixed(2)}</p>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">By Provider</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 border-b">
                            <th className="pb-1 pr-3">Provider UID</th>
                            <th className="pb-1 pr-3">Count</th>
                            <th className="pb-1">Total Clawback</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(clawbackSummaryData.byProvider ?? []).map((p: any) => (
                            <tr key={p.providerUid} className="border-b last:border-0">
                              <td className="py-1.5 pr-3 font-mono text-gray-700">{p.providerUid}</td>
                              <td className="py-1.5 pr-3">{p.count}</td>
                              <td className="py-1.5 font-semibold text-red-600">₪{(p.totalClawbackCents / 100).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.6B: Payout Release Policies */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Release Policies (Phase 3.6)
                  </CardTitle>
                  <button onClick={() => setShowNewPolicyForm(!showNewPolicyForm)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3"/> New Policy
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                  Division-specific policies override the global PAYOUT_AUTO_RELEASE_LIMIT_CENTS. Unmatched batches fall back to the env var. Requesters cannot self-approve.
                </div>
                {showNewPolicyForm && (
                  <div className="border rounded-lg p-3 bg-gray-50 space-y-2 text-xs">
                    <div className="font-semibold text-gray-700">New Release Policy</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-gray-500 mb-0.5 block">Min (₪)</label>
                        <input type="number" placeholder="0" value={newPolicy.minAmountCents} onChange={e=>setNewPolicy(p=>({...p, minAmountCents: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                      <div><label className="text-gray-500 mb-0.5 block">Max (₪, blank=∞)</label>
                        <input type="number" placeholder="∞" value={newPolicy.maxAmountCents} onChange={e=>setNewPolicy(p=>({...p, maxAmountCents: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                      <div><label className="text-gray-500 mb-0.5 block">Division Code</label>
                        <input placeholder="(global)" value={newPolicy.divisionCode} onChange={e=>setNewPolicy(p=>({...p, divisionCode: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={newPolicy.requiresSecondApproval} onChange={e=>setNewPolicy(p=>({...p, requiresSecondApproval: e.target.checked}))}/> Requires 2nd approval</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={newPolicy.allowedAutoRelease} onChange={e=>setNewPolicy(p=>({...p, allowedAutoRelease: e.target.checked}))}/> Allow auto-release</label>
                      </div>
                    </div>
                    <input placeholder="Notes" value={newPolicy.notes} onChange={e=>setNewPolicy(p=>({...p, notes: e.target.value}))} className="border rounded px-2 py-1 w-full"/>
                    <div className="flex gap-2">
                      <button disabled={createPolicyPending} onClick={() => createReleasePolicy({ ...newPolicy, minAmountCents: parseInt(newPolicy.minAmountCents||'0',10)*100, maxAmountCents: newPolicy.maxAmountCents ? parseInt(newPolicy.maxAmountCents,10)*100 : null })}
                        className="px-3 py-1.5 bg-blue-700 text-white rounded text-xs hover:bg-blue-800 disabled:opacity-40">
                        {createPolicyPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Create Policy'}
                      </button>
                      <button onClick={() => setShowNewPolicyForm(false)} className="px-3 py-1.5 border rounded text-xs">Cancel</button>
                    </div>
                  </div>
                )}
                {releasePoliciesLoading ? <div className="h-16 bg-gray-100 animate-pulse rounded"/> :
                  !releasePolicies?.policies?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No release policies — all batches use the global env var fallback</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Division</th><th className="text-left p-2">Range (₪)</th><th className="text-left p-2">Auto-Release</th><th className="text-left p-2">2nd Approval</th><th className="text-left p-2">Status</th></tr>
                      </thead><tbody>
                        {releasePolicies.policies.map((p: any) => (
                          <tr key={p.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 text-gray-700">{p.divisionCode || <span className="text-gray-400 italic">global</span>}</td>
                            <td className="p-2 font-mono text-gray-600">₪{(p.minAmountCents/100).toFixed(0)}–{p.maxAmountCents ? '₪'+(p.maxAmountCents/100).toFixed(0) : '∞'}</td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${p.allowedAutoRelease ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.allowedAutoRelease ? 'Yes' : 'No'}</span></td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${p.requiresSecondApproval ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{p.requiresSecondApproval ? 'Required' : 'Optional'}</span></td>
                            <td className="p-2">
                              <button onClick={() => patchReleasePolicy({ id: p.id, body: { enabled: !p.enabled } })}
                                className={`px-1.5 py-0.5 rounded text-xs ${p.enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {p.enabled ? 'Active' : 'Off'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )
                }
                {/* Evaluate batch */}
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Evaluate Batch Against Policy</div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Batch ID" value={evaluatingBatchId} onChange={e=>setEvaluatingBatchId(e.target.value)} className="border rounded px-2 py-1 text-xs w-28"/>
                    <button disabled={evaluatePolicyPending || !evaluatingBatchId} onClick={() => evaluateReleasePolicy(evaluatingBatchId)}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">
                      {evaluatePolicyPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Evaluate'}
                    </button>
                  </div>
                  {policyEvalResult?.ok && (
                    <div className="mt-2 border rounded-lg p-3 bg-blue-50 border-blue-200 text-xs space-y-1.5">
                      <div className="font-semibold text-blue-800">Evaluation result for Batch #{policyEvalResult.batchId}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="font-bold text-blue-800">{policyEvalResult.autoReleaseAllowed ? '✓ Yes' : '✗ No'}</div><div className="text-gray-500 mt-0.5">Auto-Release</div></div>
                        <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="font-bold text-blue-800">{policyEvalResult.secondApprovalRequired ? '✓ Yes' : '✗ No'}</div><div className="text-gray-500 mt-0.5">2nd Approval</div></div>
                        <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="font-bold text-blue-800">#{policyEvalResult.matchedPolicy?.id ?? 'env'}</div><div className="text-gray-500 mt-0.5">Matched Policy</div></div>
                      </div>
                      <div className="text-gray-600 italic">{policyEvalResult.reasoning}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DISPUTES (2.9C) ── */}
          <TabsContent value="disputes" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Dispute Cases
                  </CardTitle>
                  <div className="flex gap-2">
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchDisp()}>Refresh</button>
                    <button
                      className="text-xs px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700"
                      onClick={() => setOpenForm(true)}
                    >+ Open Dispute</button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">2.9C1 — case management only; no wallet changes on resolve.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ── Filters ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm"
                      value={dispStatus} onChange={e => setDispStatus(e.target.value)}>
                      <option value="">All</option>
                      <option value="open">open</option>
                      <option value="investigating">investigating</option>
                      <option value="escalated">escalated</option>
                      <option value="resolved">resolved</option>
                      <option value="dismissed">dismissed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Division</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm"
                      value={dispDivision} onChange={e => setDispDivision(e.target.value)}>
                      <option value="">All</option>
                      <option value="walkers">Walkers</option>
                      <option value="petsitter">Sitter Suite</option>
                      <option value="academy">Academy</option>
                      <option value="station_k9000">K9000</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Booking ID</label>
                    <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="BK-…"
                      value={dispBooking} onChange={e => setDispBooking(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Assigned Admin</label>
                    <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="UID…"
                      value={dispAssigned} onChange={e => setDispAssigned(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800"
                    onClick={() => setDispApplied(true)}
                  >Apply Filters</button>
                  <button
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                    onClick={() => { setDispStatus(""); setDispDivision(""); setDispBooking(""); setDispAssigned(""); setDispApplied(false); }}
                  >Clear</button>
                  <button
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={() => setDispApplied(true)}
                  >Show All</button>
                </div>

                {/* ── Open-Dispute Form ── */}
                {openForm && (
                  <div className="border border-rose-200 bg-rose-50 rounded p-4 space-y-3">
                    <p className="text-sm font-semibold text-rose-800">Open New Dispute Case</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Complainant UID *</label>
                        <input className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          value={newComplainantUid} onChange={e => setNewComplainantUid(e.target.value)} placeholder="Firebase UID" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Complainant Type</label>
                        <select className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          value={newComplainantType} onChange={e => setNewComplainantType(e.target.value as any)}>
                          <option value="customer">Customer</option>
                          <option value="provider">Provider</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Booking ID</label>
                        <input className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          value={newBookingId} onChange={e => setNewBookingId(e.target.value)} placeholder="Optional" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Division</label>
                        <select className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          value={newDivision} onChange={e => setNewDivision(e.target.value)}>
                          <option value="">— pick —</option>
                          <option value="walkers">Walkers</option>
                          <option value="petsitter">Sitter Suite</option>
                          <option value="academy">Academy</option>
                          <option value="station_k9000">K9000</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Amount Disputed (₪)</label>
                        <input type="number" min="0" step="0.01" className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Opening Note *</label>
                      <textarea className="w-full border rounded px-2 py-1.5 text-sm bg-white h-16 resize-none"
                        value={newOpeningNote} onChange={e => setNewOpeningNote(e.target.value)}
                        placeholder="Describe the dispute..." />
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 text-sm bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50"
                        disabled={openDispPending || !newComplainantUid.trim() || !newOpeningNote.trim()}
                        onClick={() => openDispute({
                          complainantUid:      newComplainantUid.trim(),
                          complainantType:     newComplainantType,
                          bookingId:           newBookingId.trim() || undefined,
                          divisionCode:        newDivision || undefined,
                          amountDisputedCents: newAmount ? Math.round(parseFloat(newAmount) * 100) : 0,
                          openingNote:         newOpeningNote.trim(),
                        })}
                      >
                        {openDispPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Open Case"}
                      </button>
                      <button className="px-3 py-1.5 text-sm border rounded hover:bg-white"
                        onClick={() => setOpenForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* ── Dispute List ── */}
                {!dispApplied ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center">
                    <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-400">Apply filters or click Show All to load disputes</p>
                  </div>
                ) : dispLoading ? (
                  <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : !dispData?.disputes?.length ? (
                  <div className="border rounded p-10 text-center text-sm text-gray-400">No disputes match these filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <p className="text-xs text-gray-400 mb-2">{dispData.total} case{dispData.total !== 1 ? "s" : ""} found</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Case Ref</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Division</TableHead>
                          <TableHead className="text-xs">Booking</TableHead>
                          <TableHead className="text-xs">Complainant</TableHead>
                          <TableHead className="text-xs text-right">Disputed</TableHead>
                          <TableHead className="text-xs">Opened</TableHead>
                          <TableHead className="text-xs">Assigned</TableHead>
                          <TableHead className="text-xs"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dispData.disputes as any[]).map((d: any) => {
                          const statusColor: Record<string,string> = {
                            open:          "bg-red-100    text-red-800",
                            investigating: "bg-amber-100  text-amber-800",
                            escalated:     "bg-purple-100 text-purple-800",
                            resolved:      "bg-emerald-100 text-emerald-800",
                            dismissed:     "bg-gray-100   text-gray-600",
                          };
                          return (
                            <TableRow key={d.case_ref} className="cursor-pointer hover:bg-blue-50/40"
                              onClick={() => { setSelectedDispute(d); setResolveMode(false); setDrawerNote(""); }}>
                              <TableCell className="text-xs font-mono font-semibold text-rose-700">{d.case_ref}</TableCell>
                              <TableCell>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {d.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">{d.division_code ?? "—"}</TableCell>
                              <TableCell className="text-xs font-mono text-gray-500 max-w-[80px] truncate" title={d.booking_id ?? ""}>
                                {d.booking_id ? d.booking_id.slice(0,10)+"…" : "—"}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-gray-500 max-w-[80px] truncate" title={d.complainant_uid}>
                                {d.complainant_uid.slice(0,10)}…<span className="text-gray-400 ml-1">({d.complainant_type})</span>
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                ₪{(d.amount_disputed_cents / 100).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                                {new Date(d.opened_at).toLocaleDateString("he-IL")}
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 font-mono max-w-[70px] truncate" title={d.assigned_admin_uid ?? ""}>
                                {d.assigned_admin_uid ? d.assigned_admin_uid.slice(0,8)+"…" : "—"}
                              </TableCell>
                              <TableCell>
                                <button className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                                  onClick={(e) => { e.stopPropagation(); setSelectedDispute(d); setResolveMode(false); setDrawerNote(""); }}>
                                  View →
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Detail Drawer (slide-over panel) ── */}
            {selectedDispute && (
              <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl border-l border-gray-200 flex flex-col"
                style={{ top: '60px' }}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Dispute Case</p>
                    <h3 className="text-base font-mono font-bold text-rose-700">{selectedDispute.case_ref}</h3>
                  </div>
                  <button className="text-gray-400 hover:text-gray-700 text-xl font-bold"
                    onClick={() => { setSelectedDispute(null); setResolveMode(false); }}>✕</button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* Case meta */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {[
                      { label: "Status",      val: selectedDispute.status },
                      { label: "Division",    val: selectedDispute.division_code ?? "—" },
                      { label: "Type",        val: selectedDispute.complainant_type },
                      { label: "Disputed",    val: `₪${(selectedDispute.amount_disputed_cents / 100).toFixed(2)}` },
                      { label: "Booking",     val: selectedDispute.booking_id ?? "—" },
                      { label: "Opened",      val: new Date(selectedDispute.opened_at).toLocaleString("he-IL") },
                      { label: "Resolved",    val: selectedDispute.resolved_at ? new Date(selectedDispute.resolved_at).toLocaleString("he-IL") : "—" },
                      { label: "Resolution",  val: selectedDispute.resolution_type ?? "—" },
                      { label: "Res. Amount", val: selectedDispute.resolution_cents != null ? `₪${(selectedDispute.resolution_cents / 100).toFixed(2)}` : "—" },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-medium text-gray-800 truncate">{String(val)}</p>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Complainant UID</p>
                      <p className="text-xs font-mono text-gray-600">{selectedDispute.complainant_uid}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Assigned Admin</p>
                      <p className="text-xs font-mono text-gray-600">{selectedDispute.assigned_admin_uid ?? "—"}</p>
                    </div>
                  </div>

                  {/* Assign section */}
                  {selectedDispute.status !== "resolved" && selectedDispute.status !== "dismissed" && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-800">Assign Admin</p>
                      <div className="flex gap-2">
                        <input className="flex-1 border rounded px-2 py-1.5 text-xs bg-white"
                          placeholder="Admin UID…"
                          value={assignUid} onChange={e => setAssignUid(e.target.value)} />
                        <button
                          className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          disabled={patchPending || !assignUid.trim()}
                          onClick={() => patchDispute({ caseRef: selectedDispute.case_ref, body: { assignedAdminUid: assignUid.trim() } })}
                        >Assign</button>
                      </div>
                    </div>
                  )}

                  {/* Status change */}
                  {selectedDispute.status !== "resolved" && selectedDispute.status !== "dismissed" && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800">Update Status</p>
                      <div className="flex gap-2">
                        <select className="flex-1 border rounded px-2 py-1.5 text-xs bg-white"
                          defaultValue={selectedDispute.status}>
                          <option value="open">open</option>
                          <option value="investigating">investigating</option>
                          <option value="escalated">escalated</option>
                        </select>
                        <button
                          className="px-2 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                          disabled={patchPending}
                          onClick={(e) => {
                            const sel = (e.currentTarget.previousSibling as HTMLSelectElement)?.value;
                            if (sel) patchDispute({ caseRef: selectedDispute.case_ref, body: { status: sel as any } });
                          }}
                        >Update</button>
                      </div>
                    </div>
                  )}

                  {/* Notes timeline */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Timeline</p>
                    <div className="space-y-2">
                      {(Array.isArray(selectedDispute.notes) ? selectedDispute.notes : []).map((n: any, i: number) => (
                        <div key={i} className={`text-xs rounded px-3 py-2 border ${n.text?.startsWith('[RESOLVE:') ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-gray-700">{n.authorName ?? n.authorUid?.slice(0,10)}</span>
                            <span className="text-gray-400">{new Date(n.createdAt).toLocaleString("he-IL")}</span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{n.text}</p>
                        </div>
                      ))}
                      {!(Array.isArray(selectedDispute.notes) ? selectedDispute.notes : []).length && (
                        <p className="text-xs text-gray-400 italic">No notes yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Add note */}
                  {selectedDispute.status !== "resolved" && selectedDispute.status !== "dismissed" && !resolveMode && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Add Note</p>
                      <textarea className="w-full border rounded px-2 py-1.5 text-xs h-16 resize-none"
                        placeholder="Note text…"
                        value={drawerNote} onChange={e => setDrawerNote(e.target.value)} />
                      <button
                        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                        disabled={patchPending || !drawerNote.trim()}
                        onClick={() => patchDispute({ caseRef: selectedDispute.case_ref, body: { note: drawerNote.trim() } })}
                      >
                        {patchPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Note"}
                      </button>
                    </div>
                  )}

                  {/* ── 3.2C: Escalate panel ── */}
                  {selectedDispute.status !== "escalated" && selectedDispute.status !== "resolved" && selectedDispute.status !== "dismissed" && (
                    <div className="border border-purple-200 rounded p-3 bg-purple-50 space-y-2">
                      <p className="text-xs font-semibold text-purple-800">⬆ Escalate Case</p>
                      <input
                        className="w-full border rounded px-2 py-1.5 text-xs"
                        placeholder="Escalation reason (optional)"
                        value={escalationNote}
                        onChange={e => setEscalationNote(e.target.value)}
                      />
                      <button
                        className="text-xs px-3 py-1.5 bg-purple-700 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                        disabled={escalatePending}
                        onClick={() => escalateDispute({ caseRef: selectedDispute.case_ref, note: escalationNote || undefined })}
                      >
                        {escalatePending ? "Escalating…" : "Escalate to Senior Finance"}
                      </button>
                    </div>
                  )}
                  {selectedDispute.escalated_at && (
                    <div className="border border-purple-200 bg-purple-50 rounded px-3 py-2 text-xs text-purple-700">
                      <span className="font-semibold">Escalated</span> by {selectedDispute.escalated_by} at {new Date(selectedDispute.escalated_at).toLocaleString()}
                      {selectedDispute.escalation_note && <span> — {selectedDispute.escalation_note}</span>}
                    </div>
                  )}

                  {/* Resolve panel */}
                  {selectedDispute.status !== "resolved" && selectedDispute.status !== "dismissed" && (
                    <div className={`border rounded p-3 space-y-2 ${resolveMode ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                      {!resolveMode ? (
                        <button className="text-xs text-emerald-700 font-semibold hover:underline"
                          onClick={() => setResolveMode(true)}>
                          ✓ Resolve / Dismiss this case →
                        </button>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-emerald-800">Resolve Case</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-500 block mb-1">Resolution Type</label>
                              <select className="w-full border rounded px-2 py-1.5 text-xs bg-white"
                                value={resolveType} onChange={e => setResolveType(e.target.value)}>
                                <option value="no_action">no_action</option>
                                <option value="full_refund">full_refund</option>
                                <option value="partial_refund">partial_refund</option>
                                <option value="goodwill_credit">goodwill_credit</option>
                                <option value="dismissed">dismissed</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-500 block mb-1">Resolution Amount (₪)</label>
                              <input type="number" min="0" step="0.01" className="w-full border rounded px-2 py-1.5 text-xs bg-white"
                                value={resolveCents} onChange={e => setResolveCents(e.target.value)} placeholder="0.00" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">Resolution Note *</label>
                            <textarea className="w-full border rounded px-2 py-1.5 text-xs h-12 resize-none bg-white"
                              value={resolveNote} onChange={e => setResolveNote(e.target.value)}
                              placeholder="Reason for this resolution…" />
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                              disabled={resolvePending || !resolveNote.trim()}
                              onClick={() => resolveDispute({
                                caseRef: selectedDispute.case_ref,
                                body: {
                                  resolutionType:  resolveType,
                                  resolutionCents: resolveCents ? Math.round(parseFloat(resolveCents) * 100) : 0,
                                  note:            resolveNote.trim(),
                                  finalStatus:     resolveType === "dismissed" ? "dismissed" : "resolved",
                                },
                              })}
                            >
                              {resolvePending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Resolution"}
                            </button>
                            <button className="px-2 py-1.5 text-xs border rounded hover:bg-white"
                              onClick={() => setResolveMode(false)}>Cancel</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── 3.0C Apply Resolution ── */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">Apply Financial Resolution</span>
                      {!applyResMode && !applyResResult && (
                        <button
                          className="text-xs px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-700"
                          onClick={() => { setApplyResMode(true); setApplyResResult(null); }}
                        >Apply Resolution</button>
                      )}
                    </div>

                    {applyResResult && (
                      <div className="rounded border p-3 text-xs space-y-1 bg-emerald-50 border-emerald-200 mb-2">
                        <div className="font-semibold text-emerald-700">Resolution applied: {applyResResult.action}</div>
                        {applyResResult.refundRequestId && <div>Refund request: <span className="font-mono">{applyResResult.refundRequestId}</span> — {applyResResult.refundStatus}</div>}
                        {applyResResult.clawbackId && <div>Clawback ID: <span className="font-mono">{applyResResult.clawbackId}</span> — ₪{(Math.abs(applyResResult.clawbackCents ?? 0) / 100).toFixed(2)}</div>}
                      </div>
                    )}

                    {applyResMode && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Action</label>
                          <select className="w-full border rounded px-2 py-1.5 text-sm"
                            value={applyResAction} onChange={e => setApplyResAction(e.target.value as any)}>
                            <option value="none">None — record decision only</option>
                            <option value="refund">Refund — issue refund to customer</option>
                            <option value="clawback">Clawback — reduce provider payout</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Linked Batch ID (optional)</label>
                          <input className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                            placeholder="batch_…" value={applyResBatchId} onChange={e => setApplyResBatchId(e.target.value)} />
                        </div>
                        {applyResAction === "refund" && (
                          <div className="space-y-2 bg-amber-50 rounded p-3 border border-amber-200">
                            <div className="text-xs font-semibold text-amber-700">Refund Details</div>
                            <input className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="Booking ID" value={applyResRefundBooking} onChange={e => setApplyResRefundBooking(e.target.value)} />
                            <input className="w-full border rounded px-2 py-1.5 text-sm" type="number" step="0.01"
                              placeholder="Amount (ILS)" value={applyResRefundAmt} onChange={e => setApplyResRefundAmt(e.target.value)} />
                            <input className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="Note" value={applyResRefundNote} onChange={e => setApplyResRefundNote(e.target.value)} />
                          </div>
                        )}
                        {applyResAction === "clawback" && (
                          <div className="space-y-2 bg-rose-50 rounded p-3 border border-rose-200">
                            <div className="text-xs font-semibold text-rose-700">Clawback Details</div>
                            <input className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                              placeholder="Provider UID" value={applyResClawbackUid} onChange={e => setApplyResClawbackUid(e.target.value)} />
                            <input className="w-full border rounded px-2 py-1.5 text-sm" type="number" step="0.01"
                              placeholder="Amount (ILS)" value={applyResClawbackAmt} onChange={e => setApplyResClawbackAmt(e.target.value)} />
                            <input className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="Division code" value={applyResClawbackDiv} onChange={e => setApplyResClawbackDiv(e.target.value)} />
                            <input className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="Note" value={applyResClawbackNote} onChange={e => setApplyResClawbackNote(e.target.value)} />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                            disabled={applyResPending}
                            onClick={() => {
                              if (!selectedDispute) return;
                              applyResolution({
                                caseRef: selectedDispute.case_ref,
                                body: {
                                  action: applyResAction,
                                  linkedPayoutBatchId: applyResBatchId || undefined,
                                  ...(applyResAction === "refund" ? {
                                    refundAmountCents:  Math.round(parseFloat(applyResRefundAmt || "0") * 100),
                                    refundBookingId:    applyResRefundBooking || undefined,
                                    refundNote:         applyResRefundNote || undefined,
                                  } : {}),
                                  ...(applyResAction === "clawback" ? {
                                    clawbackCents:      Math.round(parseFloat(applyResClawbackAmt || "0") * 100),
                                    clawbackProviderUid:applyResClawbackUid || undefined,
                                    clawbackDivision:   applyResClawbackDiv || undefined,
                                    clawbackNote:       applyResClawbackNote || undefined,
                                  } : {}),
                                },
                              });
                            }}
                          >
                            {applyResPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                          </button>
                          <button className="px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
                            onClick={() => setApplyResMode(false)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Backdrop for drawer */}
            {selectedDispute && (
              <div className="fixed inset-0 z-40 bg-black/20"
                onClick={() => { setSelectedDispute(null); setResolveMode(false); setApplyResMode(false); setApplyResResult(null); }} />
            )}

            {/* ── 3.1F: SLA Report ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-amber-500">⏱</span> Dispute SLA Compliance Report
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <input type="date" className="text-xs border rounded px-2 py-1" value={slaFrom} onChange={e => setSlaFrom(e.target.value)} placeholder="From" />
                    <input type="date" className="text-xs border rounded px-2 py-1" value={slaTo} onChange={e => setSlaTo(e.target.value)} placeholder="To" />
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchSla()}>Run</button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">SLA: ≥₪500 disputes = 24h · Standard = 72h</p>
              </CardHeader>
              <CardContent>
                {slaLoading ? (
                  <div className="text-xs text-gray-400 py-3">Loading…</div>
                ) : !slaReportData?.ok ? (
                  <div className="text-xs text-gray-400 py-3">No data</div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Total",        value: slaReportData.total,            color: "text-gray-700" },
                        { label: "Met",           value: slaReportData.met,              color: "text-green-600" },
                        { label: "Breached",      value: slaReportData.breached,         color: "text-red-600" },
                        { label: "Compliance",    value: `${slaReportData.compliancePct}%`, color: slaReportData.compliancePct >= 90 ? "text-green-600" : slaReportData.compliancePct >= 70 ? "text-amber-600" : "text-red-600" },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-50 rounded p-3">
                          <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                          <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Compliance progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>SLA Compliance</span>
                        <span>Avg resolution: {slaReportData.avgDurationHours}h</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${slaReportData.compliancePct >= 90 ? 'bg-green-500' : slaReportData.compliancePct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${slaReportData.compliancePct}%` }}
                        />
                      </div>
                    </div>
                    {/* Case table */}
                    {slaReportData.cases?.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-400 border-b">
                              <th className="pb-1 pr-3">Case</th>
                              <th className="pb-1 pr-3">Division</th>
                              <th className="pb-1 pr-3">Amount</th>
                              <th className="pb-1 pr-3">Status</th>
                              <th className="pb-1 pr-3">Duration</th>
                              <th className="pb-1 pr-3">SLA</th>
                              <th className="pb-1">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slaReportData.cases.slice(0, 20).map((c: any) => (
                              <tr key={c.caseRef} className="border-b last:border-0">
                                <td className="py-1.5 pr-3 font-mono">{c.caseRef}</td>
                                <td className="py-1.5 pr-3">{c.divisionCode}</td>
                                <td className="py-1.5 pr-3">₪{(c.amountDisputedCents / 100).toFixed(0)}{c.isHighValue && <span className="ml-1 text-amber-500 text-[10px]">HIGH</span>}</td>
                                <td className="py-1.5 pr-3">{c.status}</td>
                                <td className="py-1.5 pr-3">{c.durationHours}h</td>
                                <td className="py-1.5 pr-3 text-gray-400">{c.slaHours}h</td>
                                <td className="py-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${c.slaMet ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {c.slaMet ? 'Met' : 'Breached'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {slaReportData.total > 20 && <p className="text-xs text-gray-400 mt-1">Showing 20 of {slaReportData.total} cases</p>}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SETTLEMENT (2.9B) ── */}
          <TabsContent value="settlement" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Settlement Summary
                  </CardTitle>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => refetchSettl()}
                    >Refresh</button>
                    {settlData?.summary && (
                      <a
                        href={`/api/prestige-pass/admin/wallet/settlement-summary/export?${settlParams.toString()}`}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Export CSV
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Read-only. collected − providerPayable − VAT(18%) = platform margin.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">From</label>
                    <input type="date" className="w-full border rounded px-2 py-1.5 text-sm"
                      value={settlFrom} onChange={e => setSettlFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">To</label>
                    <input type="date" className="w-full border rounded px-2 py-1.5 text-sm"
                      value={settlTo} onChange={e => setSettlTo(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Division</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm"
                      value={settlDiv} onChange={e => setSettlDiv(e.target.value)}>
                      <option value="">All Divisions</option>
                      <option value="walkers">Walkers</option>
                      <option value="petsitter">Sitter Suite</option>
                      <option value="academy">Academy</option>
                      <option value="station_k9000">K9000</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 w-full"
                      onClick={() => setSettlApplied(true)}
                    >Run Report</button>
                  </div>
                </div>
                {/* Quick presets */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Today',     from: today,         to: today },
                    { label: 'This Month',from: firstOfMonth,  to: today },
                    { label: 'Last 7d',   from: (() => { const d = new Date(); d.setDate(d.getDate()-6); return d.toISOString().slice(0,10); })(), to: today },
                    { label: 'Last 30d',  from: (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10); })(), to: today },
                    { label: 'All Time',  from: '',            to: '' },
                  ].map(({ label, from, to }) => (
                    <button key={label}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                      onClick={() => { setSettlFrom(from); setSettlTo(to); setSettlApplied(true); }}
                    >{label}</button>
                  ))}
                </div>

                {!settlApplied ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-400">Select a period and click <strong>Run Report</strong></p>
                  </div>
                ) : settlLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded" />)}
                  </div>
                ) : settlData?.error ? (
                  <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">{settlData.error}</div>
                ) : settlData?.summary ? (
                  <>
                    {/* 6 KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        {
                          label: 'Collected',
                          value: settlData.summary.collected,
                          sub: 'gross revenue from services',
                          color: 'indigo',
                          icon: <TrendingUp className="w-4 h-4" />,
                        },
                        {
                          label: 'Pending Holds',
                          value: settlData.summary.pendingHolds,
                          sub: 'active holds not yet captured',
                          color: 'blue',
                          icon: <Clock className="w-4 h-4" />,
                        },
                        {
                          label: 'Provider Payable',
                          value: settlData.summary.providerPayable,
                          sub: 'earned + held payout entries',
                          color: 'amber',
                          icon: <DollarSign className="w-4 h-4" />,
                        },
                        {
                          label: 'VAT Liability',
                          value: settlData.summary.vatLiability,
                          sub: 'collected × 18%',
                          color: 'rose',
                          icon: <AlertTriangle className="w-4 h-4" />,
                        },
                        {
                          label: 'Platform Margin',
                          value: settlData.summary.margin,
                          sub: `collected − payable − VAT`,
                          color: settlData.summary.margin >= 0 ? 'emerald' : 'red',
                          icon: <CheckCircle2 className="w-4 h-4" />,
                        },
                        {
                          label: 'Margin %',
                          value: null,
                          pct: settlData.summary.marginPct,
                          sub: 'of collected revenue',
                          color: settlData.summary.marginPct >= 0 ? 'emerald' : 'red',
                          icon: <BarChart3 className="w-4 h-4" />,
                        },
                      ].map(({ label, value, pct, sub, color, icon }) => {
                        const palette: Record<string, string> = {
                          indigo:  'bg-indigo-50  border-indigo-200  text-indigo-700',
                          blue:    'bg-blue-50    border-blue-200    text-blue-700',
                          amber:   'bg-amber-50   border-amber-200   text-amber-700',
                          rose:    'bg-rose-50    border-rose-200    text-rose-700',
                          emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                          red:     'bg-red-50     border-red-200     text-red-700',
                        };
                        return (
                          <div key={label} className={`border rounded p-4 ${palette[color] ?? 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-1 opacity-70">{icon}<span className="text-xs font-medium uppercase tracking-wide">{label}</span></div>
                            <p className="text-xl font-bold font-mono">
                              {pct !== undefined
                                ? `${pct.toFixed(2)}%`
                                : `₪${((value as number) / 100).toFixed(2)}`}
                            </p>
                            <p className="text-xs opacity-60 mt-0.5">{sub}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Period info */}
                    <div className="text-xs text-gray-400 flex gap-4">
                      <span>Period: <strong>{settlData.period.from ?? 'all'}</strong> → <strong>{settlData.period.to ?? 'all'}</strong></span>
                      {settlData.period.divisionCode && <span>Division: <strong>{settlData.period.divisionCode}</strong></span>}
                    </div>

                    {/* By-division table */}
                    {settlData.byDivision?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Collected vs Payable by Division</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Division</TableHead>
                                <TableHead className="text-xs text-right">Collected</TableHead>
                                <TableHead className="text-xs text-right">Provider Payable</TableHead>
                                <TableHead className="text-xs text-right">VAT (18%)</TableHead>
                                <TableHead className="text-xs text-right">Margin</TableHead>
                                <TableHead className="text-xs text-right">Margin %</TableHead>
                                <TableHead className="text-xs">Bar</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(settlData.byDivision as any[]).map((row: any) => {
                                const totalCollected = settlData.summary.collected;
                                const barPct = totalCollected > 0 ? Math.round((row.collected / totalCollected) * 100) : 0;
                                const marginNeg = row.margin < 0;
                                return (
                                  <TableRow key={row.divisionCode}>
                                    <TableCell className="text-xs font-medium">{row.divisionCode}</TableCell>
                                    <TableCell className="text-xs text-right font-mono">₪{(row.collected / 100).toFixed(2)}</TableCell>
                                    <TableCell className="text-xs text-right font-mono text-amber-700">₪{(row.providerPayable / 100).toFixed(2)}</TableCell>
                                    <TableCell className="text-xs text-right font-mono text-rose-600">₪{(row.vatLiability / 100).toFixed(2)}</TableCell>
                                    <TableCell className={`text-xs text-right font-mono font-semibold ${marginNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                                      ₪{(row.margin / 100).toFixed(2)}
                                    </TableCell>
                                    <TableCell className={`text-xs text-right ${marginNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                                      {row.marginPct.toFixed(1)}%
                                    </TableCell>
                                    <TableCell className="text-xs min-w-[80px]">
                                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-400 rounded-full"
                                          style={{ width: `${barPct}%` }}
                                        />
                                      </div>
                                      <span className="text-gray-400 text-[10px]">{barPct}%</span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {/* Totals footer */}
                              <TableRow className="bg-gray-50 font-semibold border-t-2">
                                <TableCell className="text-xs">TOTAL</TableCell>
                                <TableCell className="text-xs text-right font-mono">₪{(settlData.summary.collected / 100).toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-right font-mono text-amber-700">₪{(settlData.summary.providerPayable / 100).toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-right font-mono text-rose-600">₪{(settlData.summary.vatLiability / 100).toFixed(2)}</TableCell>
                                <TableCell className={`text-xs text-right font-mono ${settlData.summary.margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  ₪{(settlData.summary.margin / 100).toFixed(2)}
                                </TableCell>
                                <TableCell className={`text-xs text-right ${settlData.summary.margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                  {settlData.summary.marginPct.toFixed(1)}%
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Math identity check */}
                    <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3 text-xs font-mono text-gray-500 space-y-0.5">
                      <p className="font-semibold text-gray-700 text-[11px] mb-1">Identity Check</p>
                      <p>collected({(settlData.summary.collected/100).toFixed(2)}) − payable({(settlData.summary.providerPayable/100).toFixed(2)}) − vat({(settlData.summary.vatLiability/100).toFixed(2)}) = <span className={settlData.summary.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}>{(settlData.summary.margin/100).toFixed(2)}</span></p>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FINANCE ROLES (3.0G) ──────────────────────────────────────── */}
          <TabsContent value="roles" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet-600" />
                    Finance Roles
                  </CardTitle>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchRoles()}>Refresh</button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Role hierarchy info */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { role: "read",  color: "bg-blue-50 border-blue-200 text-blue-700",   desc: "View all finance data (reports, exports)" },
                    { role: "write", color: "bg-amber-50 border-amber-200 text-amber-700", desc: "Create payout batches, apply dispute resolution" },
                    { role: "admin", color: "bg-violet-50 border-violet-200 text-violet-700", desc: "All write + close the finance day" },
                  ].map(({ role, color, desc }) => (
                    <div key={role} className={`rounded border p-3 ${color}`}>
                      <div className="font-bold uppercase text-[11px] mb-1">{role}</div>
                      <div className="text-[10px] opacity-80">{desc}</div>
                    </div>
                  ))}
                </div>

                {/* Assign / Update Role */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="text-xs font-semibold text-gray-700">Assign or Update Role</div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono"
                      placeholder="User UID (Firebase)"
                      value={roleAssignUid}
                      onChange={(e) => setRoleAssignUid(e.target.value)}
                    />
                    <select
                      className="border rounded px-2 py-1.5 text-sm"
                      value={roleAssignVal}
                      onChange={(e) => setRoleAssignVal(e.target.value as any)}
                    >
                      <option value="read">read</option>
                      <option value="write">write</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      disabled={!roleAssignUid.trim() || upsertRolePending}
                      className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                      onClick={() => upsertRole({ uid: roleAssignUid.trim(), role: roleAssignVal })}
                    >
                      {upsertRolePending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign"}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">Admins with no explicit role default to finance_admin (bootstrapping). Assigning a role overrides the default.</p>
                </div>

                {/* Role List */}
                {rolesLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : rolesData?.roles?.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <ShieldCheck className="w-7 h-7 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm text-gray-400">No explicit roles assigned — all admins default to finance_admin</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">User UID</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Role</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Granted By</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Since</th>
                          <th className="text-right py-2 text-gray-400 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rolesData?.roles ?? []).map((r: any) => (
                          <tr key={r.userUid} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-3 font-mono text-gray-700">{r.userUid}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                r.role === "admin"  ? "bg-violet-100 text-violet-700" :
                                r.role === "write"  ? "bg-amber-100 text-amber-700" :
                                                      "bg-blue-100 text-blue-700"
                              }`}>{r.role}</span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-400">{r.grantedBy ? r.grantedBy.slice(0, 12) + "…" : "—"}</td>
                            <td className="py-2 pr-3 text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                            <td className="py-2 text-right">
                              <button
                                disabled={deleteRolePending}
                                className="text-rose-600 hover:underline text-[10px]"
                                onClick={() => deleteRole(r.userUid)}
                              >Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Role Audit Log (3.1G) ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Role Change Audit Log
                  </CardTitle>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchRoleAudit()}>Refresh</button>
                </div>
              </CardHeader>
              <CardContent>
                {roleAuditLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-7 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : (roleAuditData?.events ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No role changes recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Grantor</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Target</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Action</th>
                          <th className="text-left py-2 pr-3 text-gray-400 font-medium">Old → New</th>
                          <th className="text-left py-2 text-gray-400 font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(roleAuditData?.events ?? []).map((e: any) => (
                          <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-3 font-mono text-gray-500">{e.grantorUid ? e.grantorUid.slice(0, 12) + "…" : "—"}</td>
                            <td className="py-2 pr-3 font-mono text-gray-700">{e.targetUid ? e.targetUid.slice(0, 16) + "…" : "—"}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                e.action === "grant"  ? "bg-green-100 text-green-700"  :
                                e.action === "revoke" ? "bg-red-100 text-red-700"     :
                                                        "bg-amber-100 text-amber-700"
                              }`}>{e.action}</span>
                            </td>
                            <td className="py-2 pr-3 text-gray-500">
                              {e.oldRole
                                ? <><span className="line-through text-gray-300">{e.oldRole}</span> → {e.newRole ?? "—"}</>
                                : e.newRole ?? "—"}
                            </td>
                            <td className="py-2 text-gray-400">{e.createdAt ? new Date(e.createdAt).toLocaleString("he-IL") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Finance Activity Timeline (3.1D) ────────────────────── */}
          <TabsContent value="fin-activity" className="mt-4 space-y-4">

            {/* ── 3.1E: Monthly Variance Analysis ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-violet-500">📊</span> Monthly Variance Analysis
                  </CardTitle>
                  <input
                    type="month"
                    className="text-xs border rounded px-2 py-1"
                    value={varianceMonth}
                    onChange={e => setVarianceMonth(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {varianceLoading ? (
                  <div className="text-xs text-gray-400 py-3">Loading…</div>
                ) : !varianceData?.ok ? (
                  <div className="text-xs text-gray-400 py-3">No data for this period.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2 text-xs text-gray-400 mb-1">
                      <span>Comparing <strong className="text-gray-700">{varianceData.currentMonth}</strong> vs <strong className="text-gray-700">{varianceData.previousMonth}</strong></span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(varianceData.metrics ?? {}).map(([key, m]: [string, any]) => {
                        const labels: Record<string, string> = {
                          grossPayoutCents:     'Gross Payout (₪)',
                          netPayoutCents:       'Net Payout (₪)',
                          commissionCents:      'Commission (₪)',
                          entryCount:           'Payout Entries',
                          providerCount:        'Providers Paid',
                          disputeCount:         'Disputes Opened',
                          resolvedDisputeCount: 'Disputes Resolved',
                          disputedCents:        'Total Disputed (₪)',
                        };
                        const isMoney = key.endsWith('Cents');
                        const fmt = (v: number) => isMoney ? `₪${(v / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(v);
                        const pct = m.changePct;
                        const isPositive = key === 'disputeCount' || key === 'disputedCents' ? pct <= 0 : pct >= 0;
                        return (
                          <div key={key} className="bg-gray-50 rounded p-3 flex items-center justify-between">
                            <div>
                              <div className="text-xs text-gray-500 mb-0.5">{labels[key] ?? key}</div>
                              <div className="text-sm font-bold">{fmt(m.current)}</div>
                              <div className="text-[10px] text-gray-400">prev: {fmt(m.previous)}</div>
                            </div>
                            <div className={`text-sm font-semibold px-2 py-1 rounded ${pct === 0 ? 'text-gray-400' : isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                              {pct > 0 ? '+' : ''}{pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── 3.2F: Variance Commentary ── */}
                    <div className="border-t pt-3 mt-1">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Close-to-Close Commentary</div>
                      {commentaryLoading ? (
                        <div className="text-xs text-gray-400">Loading…</div>
                      ) : (
                        <div className="space-y-2">
                          {Object.keys(varianceData?.metrics ?? {}).map((key: string) => {
                            const labels: Record<string, string> = {
                              grossPayoutCents: 'Gross Payout', netPayoutCents: 'Net Payout', commissionCents: 'Commission',
                              entryCount: 'Entries', providerCount: 'Providers', disputeCount: 'Disputes Opened',
                              resolvedDisputeCount: 'Disputes Resolved', disputedCents: 'Total Disputed',
                            };
                            const saved = (commentaryData?.comments ?? []).find((c: any) => c.metric === key);
                            const draft = commentDraft[key] ?? saved?.comment ?? "";
                            const isDirty = commentDraft[key] !== undefined && commentDraft[key] !== (saved?.comment ?? "");
                            return (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-[10px] text-gray-400 w-28 shrink-0 pt-1.5">{labels[key] ?? key}</span>
                                <input
                                  className="flex-1 border rounded px-2 py-1 text-xs"
                                  placeholder="Add commentary…"
                                  value={draft}
                                  onChange={e => setCommentDraft(d => ({ ...d, [key]: e.target.value }))}
                                />
                                {isDirty && (
                                  <button
                                    disabled={saveCommentPending}
                                    onClick={() => saveComment({ month: varianceMonth, metric: key, comment: draft })}
                                    className="text-[10px] px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-500 shrink-0 disabled:opacity-40"
                                  >Save</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── 3.2E: Monthly Sign-off ── */}
                    <div className="border-t pt-3 mt-1">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Sign-off</div>
                      {signoffLoading ? (
                        <div className="text-xs text-gray-400">Loading…</div>
                      ) : signoffData?.signedOff ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-xs text-emerald-700">
                            <span>✓</span>
                            <span><strong>{varianceMonth}</strong> signed off by <strong>{signoffData.signOff.signedOffBy}</strong> on {new Date(signoffData.signOff.signedOffAt).toLocaleString()}</span>
                            {signoffData.signOff.notes && <span className="text-emerald-500">— {signoffData.signOff.notes}</span>}
                          </div>
                          <a
                            href={`/api/prestige-pass/admin/wallet/monthly-signoff/${varianceMonth}/export`}
                            download={`signoff-pack-${varianceMonth}.json`}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-700 text-white rounded hover:bg-emerald-600"
                          >
                            ⬇ Download Sign-off Pack
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 border rounded px-2 py-1.5 text-xs"
                            placeholder="Sign-off notes (optional)"
                            value={signoffNote}
                            onChange={e => setSignoffNote(e.target.value)}
                          />
                          <button
                            disabled={signoffPending}
                            onClick={() => {
                              if (!confirm(`Sign off ${varianceMonth}? This is irreversible.`)) return;
                              signoffMonth({ month: varianceMonth, notes: signoffNote || undefined });
                            }}
                            className="text-xs px-3 py-1.5 bg-emerald-700 text-white rounded hover:bg-emerald-600 disabled:opacity-50 shrink-0"
                          >
                            {signoffPending ? "Signing…" : `✓ Sign off ${varianceMonth}`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3.2D: Finance Alerts ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-amber-500">🔔</span> Finance Alerts
                    {(alertsData?.unacknowledged?.critical ?? 0) > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                        {alertsData.unacknowledged.critical}
                      </span>
                    )}
                    {(alertsData?.unacknowledged?.warning ?? 0) > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-white">
                        {alertsData.unacknowledged.warning}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setAlertDeliveryDrawer(true); refetchDeliveryLog(); }}
                      className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                    >📬 Delivery Log</button>
                    <button
                      onClick={async () => { await refetchDigestPreview(); toast({ title: "Digest preview loaded — check Delivery Log" }); }}
                      className="text-xs px-2 py-1 border border-blue-300 rounded hover:bg-blue-50 text-blue-600"
                    >Preview Digest</button>
                    {(alertsData?.unacknowledged?.total ?? 0) > 0 && (
                      <button
                        disabled={ackAllPending}
                        onClick={() => acknowledgeAll()}
                        className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 disabled:opacity-40"
                      >
                        {ackAllPending ? "…" : "Acknowledge All"}
                      </button>
                    )}
                    <button onClick={() => refetchAlerts()} className="text-xs text-blue-600 hover:underline">Refresh</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="text-xs text-gray-400 py-3">Loading…</div>
                ) : !alertsData?.alerts?.length ? (
                  <div className="text-xs text-gray-400 py-3">No unacknowledged alerts.</div>
                ) : (
                  <div className="space-y-2">
                    {alertsData.alerts.map((a: any) => (
                      <div key={a.id} className={`flex items-start justify-between gap-3 rounded p-3 border text-xs ${
                        a.severity === 'critical' ? 'bg-red-50 border-red-200' :
                        a.severity === 'warning'  ? 'bg-amber-50 border-amber-200' :
                                                    'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              a.severity === 'critical' ? 'bg-red-500 text-white' :
                              a.severity === 'warning'  ? 'bg-amber-400 text-white' :
                                                          'bg-gray-400 text-white'
                            }`}>{a.severity.toUpperCase()}</span>
                            {(a.escalation_level > 0) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white">
                                ESC L{a.escalation_level}
                              </span>
                            )}
                            <span className="font-mono text-gray-600">{a.alert_type ?? a.alertType}</span>
                            {a.entity_id && <span className="text-gray-400">({a.entity_type}: {a.entity_id})</span>}
                          </div>
                          <div className="text-gray-500 truncate">{JSON.stringify(a.detail).slice(0, 120)}</div>
                          <div className="text-gray-400 mt-0.5">{new Date(a.created_at ?? a.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {a.severity === 'critical' && !a.acknowledged_at && (
                            <button
                              disabled={escalateAlertPending}
                              onClick={() => escalateAlertNow(a.id)}
                              className="text-[10px] px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40"
                            >↑ Escalate</button>
                          )}
                          <button
                            disabled={ackPending}
                            onClick={() => acknowledgeAlert(a.id)}
                            className="text-[10px] px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
                          >Ack</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Finance Activity Timeline
                  </CardTitle>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => refetchFinActivity()}>Refresh</button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter bar */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 mb-1">
                    <Filter className="w-3 h-3" /> Filters
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Actor UID"
                      value={finActorFilter}  onChange={e => setFinActorFilter(e.target.value)} />
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Action (e.g. payout_batch_create)"
                      value={finActionFilter} onChange={e => setFinActionFilter(e.target.value)} />
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Entity type (e.g. payout_batch)"
                      value={finEntityFilter} onChange={e => setFinEntityFilter(e.target.value)} />
                    <input type="date" className="border rounded px-2 py-1 text-xs" placeholder="From"
                      value={finFromFilter}   onChange={e => setFinFromFilter(e.target.value)} />
                    <input type="date" className="border rounded px-2 py-1 text-xs" placeholder="To"
                      value={finToFilter}     onChange={e => setFinToFilter(e.target.value)} />
                    <div className="flex gap-2">
                      <button
                        className="flex-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        onClick={() => { setFinFiltersApplied({ actor: finActorFilter, action: finActionFilter, entityType: finEntityFilter, from: finFromFilter, to: finToFilter }); setFinPage(1); }}
                      >Apply</button>
                      <button
                        className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-100"
                        onClick={() => { setFinActorFilter(""); setFinActionFilter(""); setFinEntityFilter(""); setFinFromFilter(""); setFinToFilter(""); setFinFiltersApplied({}); setFinPage(1); }}
                      >Clear</button>
                    </div>
                  </div>
                </div>

                {/* Event list */}
                {finActivityLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : (finActivityData?.events ?? []).length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm text-gray-400">No finance activity recorded yet.</p>
                    <p className="text-xs text-gray-300 mt-1">Events appear here when payout batches are created, dispute resolutions applied, or finance days are closed.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(finActivityData?.events ?? []).map((e: any) => (
                      <div key={e.id} className="border rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
                                e.action?.includes('close')   ? "bg-violet-100 text-violet-700" :
                                e.action?.includes('create')  ? "bg-green-100 text-green-700"   :
                                e.action?.includes('refund')  ? "bg-blue-100 text-blue-700"     :
                                e.action?.includes('clawback')? "bg-orange-100 text-orange-700" :
                                                                 "bg-gray-100 text-gray-600"
                              }`}>{e.action}</span>
                              <span className="text-xs text-gray-400 font-mono">{e.entityType}</span>
                              <span className="text-xs font-mono text-gray-600 truncate">{e.entityId}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">Actor: <span className="font-mono">{e.actorUid || "—"}</span></div>
                          </div>
                          <div className="text-[10px] text-gray-400 whitespace-nowrap">
                            {e.createdAt ? new Date(e.createdAt).toLocaleString("he-IL") : "—"}
                          </div>
                        </div>
                        {e.after && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-blue-600 cursor-pointer hover:underline">Details</summary>
                            <pre className="mt-1 text-[9px] bg-gray-50 rounded p-2 overflow-x-auto text-gray-600">{JSON.stringify(e.after, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    ))}

                    {/* Pagination */}
                    {(finActivityData?.pages ?? 1) > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-gray-400">Page {finActivityData.page} of {finActivityData.pages} ({finActivityData.total} total)</span>
                        <div className="flex gap-2">
                          <button disabled={finPage <= 1} className="text-xs px-2 py-1 border rounded disabled:opacity-40" onClick={() => setFinPage(p => Math.max(1, p - 1))}>← Prev</button>
                          <button disabled={finPage >= finActivityData.pages} className="text-xs px-2 py-1 border rounded disabled:opacity-40" onClick={() => setFinPage(p => p + 1)}>Next →</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 3.3A: Recon Exceptions Tab ──────────────────────────────────── */}
          <TabsContent value="recon-exceptions" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-orange-500">⚠️</span> Reconciliation Exceptions
                    {(reconExData?.summary?.open ?? 0) > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">{reconExData.summary.open} open</span>
                    )}
                  </CardTitle>
                  <button onClick={() => refetchReconEx()} className="text-xs text-blue-600 hover:underline">Refresh</button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Filter bar */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <select className="border rounded px-2 py-1 text-xs" value={reconExFilter.status}
                      onChange={e => setReconExFilter(f => ({ ...f, status: e.target.value }))}>
                      <option value="">All statuses</option>
                      <option value="open">Open</option>
                      <option value="matched_manually">Matched manually</option>
                      <option value="ignored">Ignored</option>
                      <option value="escalated">Escalated</option>
                    </select>
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Batch ID" value={reconExFilter.batchId}
                      onChange={e => setReconExFilter(f => ({ ...f, batchId: e.target.value }))} />
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Provider UID" value={reconExFilter.providerUid}
                      onChange={e => setReconExFilter(f => ({ ...f, providerUid: e.target.value }))} />
                    <div className="flex gap-1">
                      <button className="flex-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                        onClick={() => setReconExFiltersApplied({ ...reconExFilter })}>Apply</button>
                      <button className="flex-1 px-2 py-1 text-xs border rounded"
                        onClick={() => { setReconExFilter({ status: "", batchId: "", providerUid: "" }); setReconExFiltersApplied({}); }}>Clear</button>
                    </div>
                  </div>
                </div>
                {/* Summary chips */}
                {reconExData?.summary && (
                  <div className="flex gap-2 flex-wrap text-xs">
                    {[['open','orange'],['matched_manually','green'],['ignored','gray'],['escalated','red']].map(([s,c]) => (
                      <span key={s} className={`px-2 py-0.5 rounded-full border font-medium bg-${c}-50 border-${c}-200 text-${c}-700`}>
                        {reconExData.summary[s]} {s.replace('_',' ')}
                      </span>
                    ))}
                  </div>
                )}
                {/* Table */}
                {reconExLoading ? (
                  <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : !(reconExData?.exceptions?.length) ? (
                  <div className="text-center py-10 text-sm text-gray-400 border-2 border-dashed rounded-lg">No reconciliation exceptions.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                          <th className="px-3 py-2 text-left">ID</th>
                          <th className="px-3 py-2 text-left">Batch</th>
                          <th className="px-3 py-2 text-left">Provider</th>
                          <th className="px-3 py-2 text-left">Reason</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Created</th>
                          <th className="px-3 py-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconExData.exceptions.map((ex: any) => (
                          <tr key={ex.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedReconEx(ex); setReconExNote(ex.resolution_note ?? ""); }}>
                            <td className="px-3 py-2 font-mono">{ex.id}</td>
                            <td className="px-3 py-2 font-mono text-blue-700">{ex.batch_id}</td>
                            <td className="px-3 py-2">{ex.provider_uid ?? <span className="text-gray-400 italic">unknown</span>}</td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">{ex.detected_reason}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                ex.status === 'open' ? 'bg-orange-100 text-orange-700' :
                                ex.status === 'matched_manually' ? 'bg-green-100 text-green-700' :
                                ex.status === 'ignored' ? 'bg-gray-100 text-gray-500' :
                                'bg-red-100 text-red-700'
                              }`}>{ex.status}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">{new Date(ex.created_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              {ex.status === 'open' && (
                                <div className="flex gap-1">
                                  <button className="px-1.5 py-0.5 text-[10px] border rounded hover:bg-gray-50"
                                    onClick={e => { e.stopPropagation(); patchReconEx({ id: ex.id, action: 'ignore', note: 'Ignored by admin' }); }}>
                                    Ignore
                                  </button>
                                  <button className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100"
                                    onClick={e => { e.stopPropagation(); patchReconEx({ id: ex.id, action: 'escalate' }); }}>
                                    Escalate
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Exception Detail Drawer */}
            {selectedReconEx && (
              <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedReconEx(null)}>
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Exception #{selectedReconEx.id}</h3>
                    <button className="text-gray-400 hover:text-gray-700 text-lg" onClick={() => setSelectedReconEx(null)}>✕</button>
                  </div>
                  <div className="p-4 space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="font-medium text-gray-500">Batch:</span> <span className="font-mono">{selectedReconEx.batch_id}</span></div>
                      <div><span className="font-medium text-gray-500">Provider:</span> {selectedReconEx.provider_uid ?? "—"}</div>
                      <div><span className="font-medium text-gray-500">Reason:</span> <span className="text-orange-700">{selectedReconEx.detected_reason}</span></div>
                      <div><span className="font-medium text-gray-500">Status:</span> {selectedReconEx.status}</div>
                      <div><span className="font-medium text-gray-500">Upload ID:</span> {selectedReconEx.upload_id}</div>
                      {selectedReconEx.resolved_at && <div><span className="font-medium text-gray-500">Resolved:</span> {new Date(selectedReconEx.resolved_at).toLocaleDateString()}</div>}
                    </div>
                    {/* Raw bank row */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-1">Raw Bank Row</div>
                      <pre className="bg-gray-50 border rounded p-2 text-[10px] overflow-x-auto">{JSON.stringify(selectedReconEx.raw_row, null, 2)}</pre>
                    </div>
                    {/* Note */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 mb-1">Resolution Note</div>
                      <textarea className="w-full border rounded px-2 py-1 text-xs" rows={3} value={reconExNote}
                        onChange={e => setReconExNote(e.target.value)} placeholder="Add resolution note…" />
                      <button className="mt-1 text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        onClick={() => patchReconEx({ id: selectedReconEx.id, action: 'note', note: reconExNote })}>
                        Save Note
                      </button>
                    </div>
                    {/* Manual match */}
                    {selectedReconEx.status === 'open' && (
                      <div className="border-t pt-3">
                        <div className="text-xs font-semibold text-gray-500 mb-2">Manual Match to Payout Entry</div>
                        <div className="flex gap-2 mb-2">
                          <input className="flex-1 border rounded px-2 py-1 text-xs" placeholder="Payout Entry ID"
                            value={reconMatchEntryId} onChange={e => setReconMatchEntryId(e.target.value)} />
                        </div>
                        <input className="w-full border rounded px-2 py-1 text-xs mb-2" placeholder="Reason for match"
                          value={reconMatchReason} onChange={e => setReconMatchReason(e.target.value)} />
                        <button
                          disabled={matchReconExPending || !reconMatchEntryId || !reconMatchReason}
                          className="w-full text-xs px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                          onClick={() => manualMatchReconEx({ id: selectedReconEx.id, payoutEntryId: parseInt(reconMatchEntryId), reason: reconMatchReason })}>
                          {matchReconExPending ? "Matching…" : "✓ Confirm Manual Match"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── 3.3E: Board Pack Tab ─────────────────────────────────────────── */}
          <TabsContent value="board-pack" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-violet-500">📋</span> Monthly Board Pack
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <input type="month" className="border rounded px-2 py-1 text-xs" value={boardMonth}
                      onChange={e => setBoardMonth(e.target.value)} />
                    <button className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      onClick={() => setBoardMonthApplied(boardMonth)}>Load</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {boardPackLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : !boardPackData?.ok ? (
                  <div className="text-sm text-gray-400 py-6 text-center">Select a month and click Load.</div>
                ) : (
                  <>
                    {/* Summary tiles */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Gross Payout", value: `₪${((boardPackData.financials?.grossCents ?? 0)/100).toLocaleString('he-IL',{minimumFractionDigits:2})}` },
                        { label: "Net Payout", value: `₪${((boardPackData.financials?.netCents ?? 0)/100).toLocaleString('he-IL',{minimumFractionDigits:2})}` },
                        { label: "Commission", value: `₪${((boardPackData.financials?.commissionCents ?? 0)/100).toLocaleString('he-IL',{minimumFractionDigits:2})}` },
                        { label: "Est. VAT (18%)", value: `₪${((boardPackData.financials?.vatCents ?? 0)/100).toLocaleString('he-IL',{minimumFractionDigits:2})}` },
                        { label: "Net Margin", value: `${boardPackData.financials?.netMarginPct ?? 0}%` },
                        { label: "Providers", value: boardPackData.providerCount ?? 0 },
                        { label: "Dispute SLA", value: `${boardPackData.disputes?.slaCompliancePct ?? 0}%` },
                        { label: "Open Exceptions", value: (boardPackData.reconExceptions?.find((r: any) => r.status === 'open')?.count ?? 0) },
                      ].map(({ label, value }) => (
                        <div key={label} className="border rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-gray-800">{value}</div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Variance vs prior */}
                    {boardPackData.varianceVsPrior?.grossChangePct !== null && (
                      <div className="text-xs text-gray-600">
                        vs {boardPackData.varianceVsPrior?.priorMonth}:&nbsp;
                        <span className={boardPackData.varianceVsPrior.grossChangePct >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {boardPackData.varianceVsPrior.grossChangePct >= 0 ? '+' : ''}{boardPackData.varianceVsPrior.grossChangePct}% gross payout
                        </span>
                      </div>
                    )}
                    {/* Risks */}
                    {boardPackData.risks?.length > 0 && (
                      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <div className="text-xs font-semibold text-red-700 mb-1.5">⚠ Key Risks</div>
                        <ul className="text-xs text-red-800 space-y-1">
                          {boardPackData.risks.map((r: string, i: number) => <li key={i}>• {r}</li>)}
                        </ul>
                      </div>
                    )}
                    {/* Commentary rollup */}
                    {boardPackData.commentary?.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-2">Variance Commentary</div>
                        <div className="space-y-1.5">
                          {boardPackData.commentary.map((c: any) => (
                            <div key={c.metric} className="border rounded p-2 bg-gray-50 text-xs">
                              <span className="font-medium text-gray-700">{c.metric}:</span> {c.comment}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Sign-off state */}
                    <div className="text-xs flex items-center gap-2">
                      <span className="font-medium text-gray-600">Sign-off:</span>
                      {boardPackData.signOff ? (
                        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">✓ Signed by {boardPackData.signOff.signedOffBy} on {new Date(boardPackData.signOff.signedOffAt).toLocaleDateString()}</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Not signed off</span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 3.3F: Integrity Tab ───────────────────────────────────────────── */}
          <TabsContent value="integrity" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-emerald-500">🛡</span> Cross-Check Integrity Jobs
                  </CardTitle>
                  <button
                    disabled={runIntegrityPending}
                    onClick={() => runIntegrityJobs()}
                    className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {runIntegrityPending ? "Running…" : "▶ Run All Checks Now"}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {integrityHistoryLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
                ) : !(integrityHistoryData?.history?.length) ? (
                  <div className="text-sm text-gray-400 py-10 text-center border-2 border-dashed rounded-lg">
                    No integrity checks run yet. Click "Run All Checks Now" to start.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {integrityHistoryData.history.map((run: any) => (
                      <div key={run.id} className={`border rounded-lg p-3 flex items-start justify-between gap-3 ${
                        run.status === 'passed' ? 'bg-green-50 border-green-200' :
                        run.status === 'failed' ? 'bg-red-50 border-red-200' :
                        run.status === 'error'  ? 'bg-amber-50 border-amber-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              run.status === 'passed' ? 'bg-green-600 text-white' :
                              run.status === 'failed' ? 'bg-red-600 text-white' :
                              'bg-amber-500 text-white'
                            }`}>{run.status.toUpperCase()}</span>
                            <span className="text-xs font-semibold text-gray-700">{run.job_name.replace(/_/g,' ')}</span>
                          </div>
                          <div className="text-[11px] text-gray-600">{run.summary?.summary ?? "—"}</div>
                          {run.findings_count > 0 && (
                            <div className="text-[11px] text-red-700 font-medium mt-0.5">{run.findings_count} finding(s) — check Finance Alerts</div>
                          )}
                        </div>
                        <div className="text-right text-[10px] text-gray-400">
                          <div>{run.started_at ? new Date(run.started_at).toLocaleDateString() : "—"}</div>
                          <div>{run.started_at ? new Date(run.started_at).toLocaleTimeString() : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-3">
                  <button onClick={() => refetchIntegrityHistory()} className="text-xs text-blue-600 hover:underline">Refresh history</button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4A — CASH FORECAST                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="forecast" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" /> Cash Forecast
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Horizon:</span>
                    {([7,14,30] as number[]).map(h => (
                      <button key={h} onClick={() => setForecastHorizon(h)}
                        className={`text-xs px-2.5 py-1 rounded border ${forecastHorizon === h ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}>{h}d</button>
                    ))}
                    <button onClick={() => { setForecastHorizonApplied(forecastHorizon); refetchForecast(); }}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Load</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {forecastLoading ? (
                  <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-14 bg-gray-100 animate-pulse rounded"/>)}</div>
                ) : !forecastData?.ok ? (
                  <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">Select a horizon and click Load</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'Expected Payouts', cents: forecastData.totals.expectedPayoutsCents, color: 'text-orange-600' },
                        { label: 'Expected Refunds', cents: forecastData.totals.expectedRefundsCents, color: 'text-red-600' },
                        { label: 'Expected VAT',     cents: forecastData.totals.expectedVatCents,     color: 'text-purple-600' },
                        { label: 'Net Cash Need',    cents: forecastData.totals.expectedNetCashNeedCents, color: 'text-blue-700 font-bold' },
                      ].map(t => (
                        <div key={t.label} className="border rounded-lg p-3 text-center">
                          <div className={`text-lg font-bold ${t.color}`}>₪{(t.cents/100).toLocaleString('he-IL',{minimumFractionDigits:2})}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/>Day-by-Day Breakdown ({forecastData.horizonDays}d)</div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50"><tr className="text-gray-500">
                          <th className="text-left p-2">Date</th>
                          <th className="text-right p-2">Payouts</th>
                          <th className="text-right p-2">Refunds</th>
                          <th className="text-right p-2">VAT</th>
                          <th className="text-right p-2 font-bold">Net Need</th>
                        </tr></thead>
                        <tbody>
                          {forecastData.byDay?.map((d: any) => (
                            <tr key={d.date} className="border-t hover:bg-gray-50">
                              <td className="p-2 font-mono">{d.date}</td>
                              <td className="p-2 text-right text-orange-700">₪{(d.payoutsCents/100).toFixed(0)}</td>
                              <td className="p-2 text-right text-red-700">₪{(d.refundsCents/100).toFixed(0)}</td>
                              <td className="p-2 text-right text-purple-700">₪{(d.vatCents/100).toFixed(0)}</td>
                              <td className="p-2 text-right font-bold text-blue-700">₪{(d.netCashNeedCents/100).toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {forecastData.assumptions?.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 space-y-0.5">
                        <div className="font-semibold mb-1">Forecast assumptions:</div>
                        {forecastData.assumptions.map((a: string, i: number) => <div key={i}>• {a}</div>)}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          {/* 3.5A: Forecast Accuracy */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" /> Forecast Accuracy
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={() => refetchAccuracy()} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">Load Accuracy</button>
                    <button disabled={scorePending} onClick={() => scoreAccuracy()} className="text-xs px-3 py-1 border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50 disabled:opacity-40">
                      {scorePending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Score Now'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {accuracyLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-12 bg-gray-100 animate-pulse rounded"/>)}</div>
                ) : !accuracyData?.ok ? (
                  <div className="text-sm text-gray-400 py-6 text-center border-2 border-dashed rounded-lg">Click "Load Accuracy" to view forecast vs actuals</div>
                ) : !accuracyData.summary ? (
                  <div className="text-sm text-gray-400 py-6 text-center border-2 border-dashed rounded-lg">No accuracy rows yet — forecasts will be scored automatically after daily close</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'MAE (Mean Abs Error)', value: `₪${(accuracyData.summary.mae/100).toFixed(0)}`, color: 'text-blue-700' },
                        { label: 'MAPE (%)', value: `${accuracyData.summary.mape}%`, color: parseFloat(accuracyData.summary.mape) < 10 ? 'text-green-700' : 'text-red-700' },
                        { label: 'Accuracy Grade', value: accuracyData.summary.grade, color: accuracyData.summary.grade === 'A' ? 'text-green-700' : accuracyData.summary.grade === 'B' ? 'text-blue-700' : accuracyData.summary.grade === 'C' ? 'text-amber-700' : 'text-red-700' },
                        { label: 'Rows Scored', value: accuracyData.summary.rowCount, color: 'text-gray-700' },
                      ].map(t => (
                        <div key={t.label} className="border rounded-lg p-3 text-center">
                          <div className={`text-xl font-bold ${t.color}`}>{t.value}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                        </div>
                      ))}
                    </div>
                    {accuracyData.summary.biggestMiss && (
                      <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        ⚠ Biggest miss: <strong>{accuracyData.summary.biggestMiss.targetDate}</strong> — error {accuracyData.summary.biggestMiss.pctError.toFixed(1)}%
                      </div>
                    )}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500">
                          <th className="text-left p-2">Date</th><th className="text-left p-2">Horizon</th>
                          <th className="text-right p-2">Forecast Net</th><th className="text-right p-2">Actual Net</th>
                          <th className="text-right p-2">Abs Error</th><th className="text-right p-2">Error %</th>
                        </tr>
                      </thead><tbody>
                        {accuracyData.rows?.slice(0,30).map((r: any) => (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono">{r.targetDate}</td>
                            <td className="p-2 text-gray-500">{r.horizonDays}d</td>
                            <td className="p-2 text-right text-blue-700">₪{(r.forecastNetCashNeedCents/100).toFixed(0)}</td>
                            <td className="p-2 text-right text-gray-700">₪{(r.actualNetCashNeedCents/100).toFixed(0)}</td>
                            <td className="p-2 text-right text-amber-700">₪{(r.absErrorCents/100).toFixed(0)}</td>
                            <td className={`p-2 text-right font-medium ${r.pctError < 10 ? 'text-green-700' : r.pctError < 20 ? 'text-amber-700' : 'text-red-700'}`}>{r.pctError.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 3.6A: Forecast Model Weights */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-violet-600" /> Forecast Model Weights (Phase 3.6)
                  </CardTitle>
                  <button onClick={() => recomputeForecast()} disabled={recomputeForecastPending}
                    className="text-xs px-3 py-1 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 flex items-center gap-1">
                    {recomputeForecastPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Recompute
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded p-2">
                  Weights adjust how much each historical signal contributes to the 30-day revenue forecast. All active weights are normalised to sum to 1 before computation. Changes take effect on the next scheduled recompute.
                </div>
                {forecastWeightsLoading ? <div className="h-16 bg-gray-100 animate-pulse rounded"/> :
                  !forecastWeights?.weights?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No forecast weight overrides — using system defaults</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Signal</th><th className="text-left p-2">Division</th><th className="text-right p-2">Weight</th><th className="text-left p-2">Last Updated</th></tr>
                      </thead><tbody>
                        {forecastWeights.weights.map((w: any) => (
                          <tr key={w.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-700">{w.signalKey}</td>
                            <td className="p-2 text-gray-600">{w.divisionCode || <span className="text-gray-400 italic">all</span>}</td>
                            <td className="p-2 text-right font-semibold">{w.weight.toFixed(4)}</td>
                            <td className="p-2 text-gray-400">{new Date(w.updatedAt).toLocaleDateString('he-IL')}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )
                }
                {/* Update weight form */}
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Update Signal Weight</div>
                  <div className="flex flex-wrap gap-2">
                    <input placeholder="signalKey (e.g. bookings_7d)" value={weightForm.signalKey} onChange={e=>setWeightForm(f=>({...f, signalKey: e.target.value}))} className="border rounded px-2 py-1 text-xs flex-1 min-w-32"/>
                    <input placeholder="divisionCode (blank=all)" value={weightForm.divisionCode} onChange={e=>setWeightForm(f=>({...f, divisionCode: e.target.value}))} className="border rounded px-2 py-1 text-xs w-36"/>
                    <input type="number" step="0.01" placeholder="weight" value={weightForm.weight} onChange={e=>setWeightForm(f=>({...f, weight: e.target.value}))} className="border rounded px-2 py-1 text-xs w-24"/>
                    <button disabled={upsertWeightPending || !weightForm.signalKey || !weightForm.weight} onClick={() => upsertForecastWeight({ signalKey: weightForm.signalKey, divisionCode: weightForm.divisionCode||null, weight: parseFloat(weightForm.weight) })}
                      className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40">
                      {upsertWeightPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Save'}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4B — PAYOUT SCHEDULES                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="schedules" className="mt-4 space-y-4">
            {/* Create new schedule */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-violet-600" /> Payout Schedules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* New schedule form */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="text-xs font-semibold text-gray-600">Create New Schedule</div>
                  <div className="flex flex-wrap gap-2">
                    <select value={newSchedule.cadence} onChange={e => setNewSchedule(s=>({...s, cadence: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 bg-white">
                      {['daily','weekly','fortnightly','monthly'].map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <input placeholder="Division (optional)" value={newSchedule.divisionCode}
                      onChange={e=>setNewSchedule(s=>({...s, divisionCode: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-36"/>
                    {['weekly','fortnightly'].includes(newSchedule.cadence) && (
                      <input type="number" min={0} max={6} placeholder="Day of week (0=Sun)" value={newSchedule.dayOfWeek}
                        onChange={e=>setNewSchedule(s=>({...s, dayOfWeek: e.target.value}))}
                        className="text-xs border rounded px-2 py-1.5 w-36"/>
                    )}
                    {newSchedule.cadence === 'monthly' && (
                      <input type="number" min={1} max={28} placeholder="Day of month" value={newSchedule.dayOfMonth}
                        onChange={e=>setNewSchedule(s=>({...s, dayOfMonth: e.target.value}))}
                        className="text-xs border rounded px-2 py-1.5 w-32"/>
                    )}
                    <input type="number" placeholder="Min net (ILS)" value={newSchedule.minBatchNetCents}
                      onChange={e=>setNewSchedule(s=>({...s, minBatchNetCents: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-32"/>
                    <input placeholder="Notes" value={newSchedule.notes}
                      onChange={e=>setNewSchedule(s=>({...s, notes: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 flex-1 min-w-0"/>
                    <button disabled={createSchedulePending} onClick={() => createSchedule({
                      cadence: newSchedule.cadence,
                      divisionCode: newSchedule.divisionCode || undefined,
                      dayOfWeek: newSchedule.dayOfWeek ? parseInt(newSchedule.dayOfWeek) : undefined,
                      dayOfMonth: newSchedule.dayOfMonth ? parseInt(newSchedule.dayOfMonth) : undefined,
                      minBatchNetCents: newSchedule.minBatchNetCents ? Math.round(parseFloat(newSchedule.minBatchNetCents)*100) : 0,
                      notes: newSchedule.notes,
                    })} className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40">
                      {createSchedulePending ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Create'}
                    </button>
                  </div>
                </div>

                {/* Schedules list */}
                {schedulesLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-12 bg-gray-100 animate-pulse rounded"/>)}</div>
                ) : !schedulesData?.schedules?.length ? (
                  <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">No schedules configured yet</div>
                ) : (
                  <div className="space-y-2">
                    {schedulesData.schedules.map((s: any) => (
                      <div key={s.id} className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${s.enabled ? 'bg-white' : 'bg-gray-50 opacity-70'}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.enabled ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-500'}`}>{s.cadence}</span>
                            {s.divisionCode && <span className="text-xs text-gray-500 font-mono">{s.divisionCode}</span>}
                            {s.minBatchNetCents > 0 && <span className="text-xs text-gray-400">min ₪{(s.minBatchNetCents/100).toFixed(0)}</span>}
                            <span className="text-xs text-gray-400">{s.runCount} runs</span>
                            {s.lastRunAt && <span className="text-xs text-gray-400">last: {new Date(s.lastRunAt).toLocaleDateString('he-IL')}</span>}
                          </div>
                          {s.notes && <div className="text-xs text-gray-500 mt-0.5 truncate">{s.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => runScheduleNow(s.id)} disabled={runScheduleNowPending}
                            className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40">
                            ▶ Run Now
                          </button>
                          <button onClick={() => toggleSchedule({ id: s.id, enabled: !s.enabled })}
                            className={`text-xs px-2.5 py-1 rounded border ${s.enabled ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                            {s.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent runs */}
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <History className="w-3 h-3"/> Recent Runs
                    <button onClick={() => refetchScheduleRuns()} className="ml-2 text-blue-600 hover:underline font-normal">Refresh</button>
                  </div>
                  {scheduleRunsLoading ? (
                    <div className="h-20 bg-gray-100 animate-pulse rounded"/>
                  ) : !scheduleRunsData?.runs?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No runs yet</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Schedule</th><th className="text-left p-2">Ran</th><th className="text-left p-2">Result</th><th className="text-left p-2">Batch</th></tr>
                      </thead><tbody>
                        {scheduleRunsData.runs.slice(0,20).map((r: any) => (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 text-gray-600">#{r.scheduleId} {r.cadence && <span className="text-gray-400">({r.cadence})</span>}</td>
                            <td className="p-2 text-gray-500">{new Date(r.ranAt).toLocaleString('he-IL')}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.result === 'created' ? 'bg-green-100 text-green-700' : r.result === 'skipped' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>{r.result}</span>
                            </td>
                            <td className="p-2 font-mono text-gray-500">{r.batchId ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4C — DISPUTE SLA AUTO-ROUTING                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="routing" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-teal-600" /> Dispute Auto-Routing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Manual route-now */}
                <div className="border rounded-lg p-3 bg-teal-50 border-teal-200">
                  <div className="text-xs font-semibold text-teal-700 mb-2">Route Dispute by Case Ref</div>
                  <div className="flex gap-2">
                    <input placeholder="Case ref e.g. DISP-001" value={routeDisputeRef}
                      onChange={e=>setRouteDisputeRef(e.target.value)}
                      className="text-xs border rounded px-2 py-1.5 flex-1"/>
                    <button disabled={routeDisputePending || !routeDisputeRef.trim()}
                      onClick={() => { routeDispute(routeDisputeRef.trim()); setRouteDisputeRef(''); }}
                      className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-40">
                      {routeDisputePending ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Auto-Route'}
                    </button>
                  </div>
                </div>

                {/* Create rule */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="text-xs font-semibold text-gray-600">Add Routing Rule</div>
                  <div className="flex flex-wrap gap-2">
                    <input placeholder="Division (optional)" value={newRule.divisionCode}
                      onChange={e=>setNewRule(r=>({...r, divisionCode: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-32"/>
                    <input type="number" placeholder="Min amount (₪)" value={newRule.minAmountCents}
                      onChange={e=>setNewRule(r=>({...r, minAmountCents: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-28"/>
                    <input type="number" placeholder="Max amount (₪)" value={newRule.maxAmountCents}
                      onChange={e=>setNewRule(r=>({...r, maxAmountCents: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-28"/>
                    <input placeholder="Queue name" value={newRule.queueName}
                      onChange={e=>setNewRule(r=>({...r, queueName: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-32"/>
                    <input placeholder="Assign to UID" value={newRule.assignToUid}
                      onChange={e=>setNewRule(r=>({...r, assignToUid: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-36"/>
                    <input type="number" placeholder="Priority" value={newRule.priority}
                      onChange={e=>setNewRule(r=>({...r, priority: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-20"/>
                    <button disabled={createRulePending} onClick={() => createRoutingRule({
                      divisionCode: newRule.divisionCode || undefined,
                      minAmountCents: newRule.minAmountCents ? Math.round(parseFloat(newRule.minAmountCents)*100) : 0,
                      maxAmountCents: newRule.maxAmountCents ? Math.round(parseFloat(newRule.maxAmountCents)*100) : undefined,
                      queueName: newRule.queueName || undefined,
                      assignToUid: newRule.assignToUid || undefined,
                      priority: parseInt(newRule.priority),
                    })} className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-40">
                      {createRulePending ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Add Rule'}
                    </button>
                  </div>
                </div>

                {/* Rules table */}
                {/* 3.5C: Simulation Card */}
                <div className="border rounded-lg p-3 bg-indigo-50 border-indigo-200 space-y-3">
                  <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5"/> Simulate Routing — test rules without affecting live disputes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input placeholder="Division (optional)" value={simInput.divisionCode}
                      onChange={e=>setSimInput(s=>({...s, divisionCode: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-32"/>
                    <input type="number" placeholder="Amount (₪)" value={simInput.amountCents}
                      onChange={e=>setSimInput(s=>({...s, amountCents: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 w-28"/>
                    <select value={simInput.complainantType} onChange={e=>setSimInput(s=>({...s, complainantType: e.target.value}))}
                      className="text-xs border rounded px-2 py-1.5 bg-white">
                      <option value="customer">Customer</option>
                      <option value="provider">Provider</option>
                    </select>
                    {testCasesData?.testCases?.map((tc: any) => (
                      <button key={tc.label} onClick={() => setSimInput({ divisionCode: tc.divisionCode ?? '', amountCents: String(tc.amountCents/100), complainantType: tc.complainantType })}
                        className="text-xs px-2 py-1 border border-indigo-300 rounded text-indigo-700 hover:bg-indigo-100">{tc.label}</button>
                    ))}
                    <button disabled={simPending} onClick={runSimulation}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1">
                      {simPending ? <Loader2 className="w-3 h-3 animate-spin"/> : '▶ Simulate'}
                    </button>
                  </div>
                  {simResult && (
                    <div className={`border rounded p-2.5 text-xs ${simResult.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      {simResult.matched ? (
                        <>
                          <div className="font-semibold text-green-700 mb-1">✓ Match found — Rule #{simResult.matchedRule.id} (Priority {simResult.matchedRule.priority})</div>
                          <div className="text-gray-700 space-y-0.5">
                            <div>Queue: <span className="font-mono text-teal-700">{simResult.routedQueue ?? '—'}</span></div>
                            <div>Assign to: <span className="font-mono text-gray-500">{simResult.routedToUid ?? 'Any'}</span></div>
                            <div>Reason: {simResult.routingReason}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-red-700 mb-1">✗ No match — {simResult.message}</div>
                          {simResult.eliminationLog?.length > 0 && (
                            <div className="space-y-0.5 text-gray-600">
                              {simResult.eliminationLog.map((e: any, i: number) => <div key={i}>Rule #{e.ruleId}: {e.reason}</div>)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {routingRulesLoading ? (
                  <div className="h-24 bg-gray-100 animate-pulse rounded"/>
                ) : !routingRulesData?.rules?.length ? (
                  <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">No routing rules yet. Add rules above to enable auto-routing.</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs"><thead className="bg-gray-50">
                      <tr className="text-gray-500">
                        <th className="text-left p-2">P</th><th className="text-left p-2">Division</th>
                        <th className="text-left p-2">Amount Range</th><th className="text-left p-2">Queue</th>
                        <th className="text-left p-2">Assign To</th><th className="text-left p-2">Status</th>
                      </tr>
                    </thead><tbody>
                      {routingRulesData.rules.map((r: any) => (
                        <tr key={r.id} className={`border-t ${r.enabled ? 'hover:bg-gray-50' : 'opacity-50 bg-gray-50'}`}>
                          <td className="p-2 font-bold text-teal-600">{r.priority}</td>
                          <td className="p-2 font-mono text-gray-600">{r.divisionCode ?? 'All'}</td>
                          <td className="p-2">
                            {r.minAmountCents > 0 && `≥₪${(r.minAmountCents/100).toFixed(0)}`}
                            {r.maxAmountCents && ` — ≤₪${(r.maxAmountCents/100).toFixed(0)}`}
                            {!r.minAmountCents && !r.maxAmountCents && 'Any'}
                          </td>
                          <td className="p-2 text-teal-700 font-medium">{r.queueName ?? '—'}</td>
                          <td className="p-2 font-mono text-gray-500 truncate max-w-24">{r.assignToUid ?? '—'}</td>
                          <td className="p-2">
                            <button onClick={() => toggleRule({ id: r.id, enabled: !r.enabled })}
                              className={`text-xs px-1.5 py-0.5 rounded ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {r.enabled ? 'Active' : 'Off'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.6C: Finance Digest Preferences */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-orange-600" /> Finance Alert Preferences (Phase 3.6)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {digestPrefsLoading ? <div className="h-16 bg-gray-100 animate-pulse rounded"/> : (
                  <div className="space-y-3 text-xs">
                    <div className="text-gray-500">Customize which events trigger finance digest emails and at what threshold.</div>
                    {[
                      { key: 'digest_daily_enabled', label: 'Daily digest email', type: 'boolean' },
                      { key: 'digest_weekly_enabled', label: 'Weekly executive digest', type: 'boolean' },
                      { key: 'alert_anomaly_threshold_pct', label: 'Anomaly alert threshold (%)', type: 'number' },
                      { key: 'alert_forecast_deviation_pct', label: 'Forecast deviation alert (%)', type: 'number' },
                      { key: 'alert_payout_above_cents', label: 'Payout alert above (₪)', type: 'cents' },
                    ].map(pref => (
                      <div key={pref.key} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                        <span className="text-gray-700">{pref.label}</span>
                        {pref.type === 'boolean' ? (
                          <button onClick={() => upsertDigestPref({ key: pref.key, value: !(digestPrefs?.prefs?.[pref.key]) })}
                            className={`px-2 py-0.5 rounded text-xs ${digestPrefs?.prefs?.[pref.key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {digestPrefs?.prefs?.[pref.key] ? 'On' : 'Off'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-mono">{pref.type === 'cents' ? `₪${((digestPrefs?.prefs?.[pref.key] ?? 0)/100).toFixed(0)}` : `${digestPrefs?.prefs?.[pref.key] ?? '—'}${pref.type==='number'?'%':''}`}</span>
                            <button onClick={() => { const v = prompt(pref.label, String(digestPrefs?.prefs?.[pref.key] ?? '')); if(v!==null) upsertDigestPref({ key: pref.key, value: pref.type==='cents' ? parseFloat(v)*100 : parseFloat(v) }); }}
                              className="text-xs px-1.5 py-0.5 border rounded hover:bg-gray-50">Edit</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4D — CONTROL CENTER                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="control-center" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Finance Control Center
                  </CardTitle>
                  <button onClick={() => refetchControlCenter()}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <RefreshCcw className="w-3 h-3"/> Refresh
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {controlCenterLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[...Array(6)].map((_,i)=><div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg"/>)}
                  </div>
                ) : !controlCenterData?.ok ? (
                  <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">Failed to load control center</div>
                ) : (
                  <>
                    <div className="text-xs text-gray-400 mb-3">Updated: {new Date(controlCenterData.generatedAt).toLocaleString('he-IL')}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(controlCenterData.widgets).map(([key, w]: [string, any]) => {
                        const statusColor = w.status === 'critical' ? 'border-red-300 bg-red-50' : w.status === 'warning' ? 'border-amber-300 bg-amber-50' : w.status === 'closed' ? 'border-green-300 bg-green-50' : 'border-green-200 bg-green-50';
                        const textColor = w.status === 'critical' ? 'text-red-700' : w.status === 'warning' ? 'text-amber-700' : 'text-green-700';
                        return (
                          <div key={key} className={`border-2 rounded-lg p-4 text-center cursor-pointer hover:shadow-sm transition-shadow ${statusColor}`}>
                            <div className={`text-2xl font-bold ${textColor}`}>
                              {w.valueCents !== undefined ? `₪${(w.valueCents/100).toLocaleString('he-IL',{minimumFractionDigits:0,maximumFractionDigits:0})}` :
                               w.count      !== undefined ? w.count :
                               w.status === 'closed' ? '✓' : '–'}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">{w.label}</div>
                            {w.closedAt && <div className="text-xs text-gray-400 mt-0.5">{new Date(w.closedAt).toLocaleTimeString('he-IL')}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          {/* 3.5D: Control-Center Subscriptions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" /> Alert Subscriptions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-gray-500">Subscribe to receive push notifications when control-center signals cross critical thresholds.</div>
                <div className="flex flex-wrap gap-2">
                  <select value={newSub.signalCode} onChange={e=>setNewSub(s=>({...s, signalCode: e.target.value}))}
                    className="text-xs border rounded px-2 py-1.5 bg-white">
                    {Object.entries(SIGNAL_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={newSub.deliveryChannel} onChange={e=>setNewSub(s=>({...s, deliveryChannel: e.target.value}))}
                    className="text-xs border rounded px-2 py-1.5 bg-white">
                    <option value="email">Email</option>
                    <option value="in_app">In-App</option>
                  </select>
                  <button disabled={createSubPending} onClick={() => createSub(newSub)}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40">
                    {createSubPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Subscribe'}
                  </button>
                </div>
                {controlSubsLoading ? (
                  <div className="h-16 bg-gray-100 animate-pulse rounded"/>
                ) : !controlSubsData?.subscriptions?.length ? (
                  <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No subscriptions yet</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs"><thead className="bg-gray-50">
                      <tr className="text-gray-500">
                        <th className="text-left p-2">Signal</th><th className="text-left p-2">Channel</th><th className="text-left p-2">Status</th>
                      </tr>
                    </thead><tbody>
                      {controlSubsData.subscriptions.map((s: any) => (
                        <tr key={s.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 text-gray-700">{SIGNAL_LABELS[s.signalCode] ?? s.signalCode}</td>
                          <td className="p-2 text-gray-500 capitalize">{s.deliveryChannel}</td>
                          <td className="p-2">
                            <button onClick={() => toggleSub({ id: s.id, enabled: !s.enabled })}
                              className={`text-xs px-1.5 py-0.5 rounded ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {s.enabled ? 'Active' : 'Off'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.7D — EXCEPTION SUGGESTION ENGINE */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-amber-600" /> Exception Suggestion Engine
                  </CardTitle>
                  <button
                    onClick={() => generateSuggestions()}
                    disabled={generateSuggestionsPending}
                    className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-40 flex items-center gap-1">
                    {generateSuggestionsPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    Scan &amp; Generate Suggestions
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {exceptionSuggestionsLoading ? (
                  <div className="h-20 bg-gray-100 animate-pulse rounded" />
                ) : !exceptionSuggestionsData?.suggestions?.length ? (
                  <div className="text-xs text-gray-400 text-center py-6 border border-dashed rounded">
                    No open exception suggestions. Click "Scan &amp; Generate" to detect issues.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {exceptionSuggestionsData.suggestions.map((s: any) => (
                      <div key={s.id} className="border rounded-lg p-3 text-xs flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 rounded font-medium ${
                              s.exception_type === 'negative_balance' ? 'bg-red-100 text-red-700' :
                              s.exception_type === 'overdue_dispute' ? 'bg-orange-100 text-orange-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>{s.exception_type?.replace(/_/g, ' ')}</span>
                            <span className="text-gray-400">{s.entity_type} #{s.entity_id}</span>
                            <span className="ml-auto text-gray-400">Confidence: {s.confidence_score}%</span>
                          </div>
                          <div className="text-gray-700 font-medium">{s.suggested_action}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => applySuggestion(s.id)} disabled={applySuggestionPending}
                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Apply
                          </button>
                          <button onClick={() => dismissSuggestion(s.id)}
                            className="px-2 py-1 border border-gray-200 text-gray-600 rounded hover:bg-gray-50 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4E — EXECUTIVE KPI SNAPSHOTS                                */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="executive" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" /> Executive KPI Snapshot
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {(['daily','weekly','monthly'] as const).map(p => (
                      <button key={p} onClick={() => { setExecPeriod(p); }}
                        className={`text-xs px-2.5 py-1 rounded border capitalize ${execPeriod === p ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 hover:border-emerald-400'}`}>{p}</button>
                    ))}
                    <button onClick={() => refetchExecKpi()} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">Load</button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {execKpiLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-14 bg-gray-100 animate-pulse rounded"/>)}</div>
                ) : !execKpiData?.ok ? (
                  <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">Select period and click Load</div>
                ) : (() => {
                  const k = execKpiData.kpi;
                  return (
                    <>
                      <div className="text-xs text-gray-400 mb-3">Period: {k.period} from {k.fromDate}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {[
                          { label: 'Gross Collected', value: `₪${(k.grossCents/100).toLocaleString('he-IL',{minimumFractionDigits:0})}`, color: 'text-blue-700' },
                          { label: 'Net Margin',       value: `${k.marginPct}%`,     color: parseFloat(k.marginPct) > 15 ? 'text-green-700' : 'text-amber-700' },
                          { label: 'VAT Liability',    value: `₪${(k.vatCents/100).toLocaleString('he-IL',{minimumFractionDigits:0})}`, color: 'text-purple-700' },
                          { label: 'Payouts',          value: `₪${(k.payoutsCents/100).toLocaleString('he-IL',{minimumFractionDigits:0})}`, color: 'text-orange-700' },
                          { label: 'Refund Rate',      value: `${k.refundRatePct}%`, color: parseFloat(k.refundRatePct) > 5 ? 'text-red-700' : 'text-green-700' },
                          { label: 'Dispute SLA Breach', value: `${k.disputeBreachRatePct}%`, color: k.disputeBreachRatePct > 10 ? 'text-red-700' : 'text-green-700' },
                          { label: 'Recon Exceptions', value: k.reconExceptionsOpen, color: k.reconExceptionsOpen > 0 ? 'text-amber-700' : 'text-green-700' },
                          { label: 'Sign-off Status',  value: k.signoffStatus, color: k.signoffStatus.startsWith('Signed') ? 'text-green-700' : 'text-amber-700' },
                        ].map(t => (
                          <div key={t.label} className="border rounded-lg p-3 text-center">
                            <div className={`text-base font-bold ${t.color}`}>{t.value}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                          </div>
                        ))}
                      </div>
                      {k.topRisks?.length > 0 && (
                        <div className="border border-red-200 bg-red-50 rounded-lg p-3 mb-3">
                          <div className="text-xs font-semibold text-red-700 mb-1.5">⚠ Key Risks</div>
                          {k.topRisks.map((risk: string, i: number) => (
                            <div key={i} className="text-xs text-red-700">• {risk}</div>
                          ))}
                        </div>
                      )}
                      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-xs text-emerald-700">
                        💡 {k.topImprovement}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* 3.5E: Executive Weekly Digest */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-600" /> Weekly Digest
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={() => refetchExecDigestPreview()} className="text-xs px-3 py-1 border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">
                      Preview This Week
                    </button>
                    <button disabled={sendDigestPending} onClick={() => sendExecDigest()}
                      className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1">
                      {sendDigestPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>} Send Now
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {execDigestPreviewLoading ? (
                  <div className="h-20 bg-gray-100 animate-pulse rounded"/>
                ) : execDigestPreview?.ok && (
                  <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200 text-xs space-y-1.5">
                    <div className="font-semibold text-emerald-700">{execDigestPreview.periodLabel}</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: 'Gross', value: `₪${(execDigestPreview.summary.grossCents/100).toLocaleString('he-IL',{minimumFractionDigits:0})}` },
                        { label: 'Net', value: `₪${(execDigestPreview.summary.netCents/100).toLocaleString('he-IL',{minimumFractionDigits:0})}` },
                        { label: 'Refund Rate', value: `${execDigestPreview.summary.refundRatePct}%` },
                        { label: 'Close Days', value: execDigestPreview.summary.closeDays },
                      ].map(t=>(
                        <div key={t.label} className="bg-white border border-emerald-100 rounded p-2 text-center">
                          <div className="font-bold text-emerald-800">{t.value}</div>
                          <div className="text-gray-500 mt-0.5">{t.label}</div>
                        </div>
                      ))}
                    </div>
                    {execDigestPreview.summary.topRisks?.length > 0 && (
                      <div className="border border-red-200 bg-red-50 rounded p-2 text-red-700">
                        {execDigestPreview.summary.topRisks.map((r: string, i: number) => <div key={i}>⚠ {r}</div>)}
                      </div>
                    )}
                  </div>
                )}
                {/* Delivery log */}
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <History className="w-3 h-3"/> Delivery Log
                    <button onClick={() => refetchExecDigestLog()} className="ml-2 text-blue-600 hover:underline font-normal">Refresh</button>
                  </div>
                  {execDigestLogLoading ? (
                    <div className="h-16 bg-gray-100 animate-pulse rounded"/>
                  ) : !execDigestLog?.entries?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No digests sent yet</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Week</th><th className="text-left p-2">Sent To</th><th className="text-left p-2">Status</th><th className="text-left p-2">Sent At</th></tr>
                      </thead><tbody>
                        {execDigestLog.entries.slice(0,10).map((e: any) => (
                          <tr key={e.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-700">{e.periodStart} → {e.periodEnd}</td>
                            <td className="p-2 text-gray-500 truncate max-w-32">{e.sentTo || '—'}</td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${e.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{e.status}</span></td>
                            <td className="p-2 text-gray-500">{new Date(e.sentAt).toLocaleString('he-IL')}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3.6G: Period Close Packs */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Archive className="w-4 h-4 text-slate-600" /> Period Close Packs (Phase 3.6)
                  </CardTitle>
                  <button onClick={() => exportPeriodPack()} disabled={exportPeriodPackPending}
                    className="text-xs px-3 py-1 border border-slate-400 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                    {exportPeriodPackPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>} Export Latest
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2">
                  Generate signed quarter/year-end close packages that bundle all finance close records into a tamper-evident SHA-256-signed artifact. Required for audit submission.
                </div>
                {/* Generate form */}
                <div className="flex flex-wrap gap-2">
                  <select value={closePeriodType} onChange={e=>setClosePeriodType(e.target.value as any)}
                    className="border rounded px-2 py-1 text-xs">
                    <option value="quarter">Quarter</option>
                    <option value="year">Year</option>
                  </select>
                  <input placeholder={closePeriodType==='quarter' ? '2026-Q1' : '2026'} value={closePeriodValue} onChange={e=>setClosePeriodValue(e.target.value)} className="border rounded px-2 py-1 text-xs w-28"/>
                  <button disabled={generatePeriodPackPending || !closePeriodValue} onClick={() => generatePeriodPack({ type: closePeriodType, period: closePeriodValue })}
                    className="text-xs px-3 py-1.5 bg-slate-700 text-white rounded hover:bg-slate-800 disabled:opacity-40">
                    {generatePeriodPackPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Generate Pack'}
                  </button>
                </div>
                {periodPacksLoading ? <div className="h-20 bg-gray-100 animate-pulse rounded"/> :
                  !periodPacks?.packs?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No close packs generated yet</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Period</th><th className="text-left p-2">Type</th><th className="text-left p-2">Records</th><th className="text-left p-2">Signature</th><th className="text-left p-2">Generated</th></tr>
                      </thead><tbody>
                        {periodPacks.packs.map((pk: any) => (
                          <tr key={pk.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-700">{pk.period}</td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${pk.packType === 'year' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{pk.packType}</span></td>
                            <td className="p-2 text-gray-600">{pk.recordCount}</td>
                            <td className="p-2 font-mono text-gray-400 text-[10px]">{pk.signatureHash?.slice(0,16)}…</td>
                            <td className="p-2 text-gray-400">{new Date(pk.generatedAt).toLocaleString('he-IL')}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4F — ARCHIVE POLICIES                                       */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="archive" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Archive className="w-4 h-4 text-slate-600" /> Retention & Archive Policies
                  </CardTitle>
                  <button disabled={dryRunArchivePending} onClick={() => dryRunArchive()}
                    className="text-xs px-3 py-1.5 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1">
                    {dryRunArchivePending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Eye className="w-3 h-3"/>} Dry-Run All
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠ Archive Phase 3.4 is simulation-only. No records are deleted. All runs are recorded for audit. Phase 3.5 adds controlled execution — protected entities (signed closes, audit logs, sign-offs) are always skipped.
                </div>

                {/* 3.5F: Execute Archive */}
                <div className="border rounded-lg p-3 bg-slate-50 border-slate-200 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5"/> Execute Archive — Phase 3.5</span>
                    <button onClick={() => setShowArchiveExecuteConfirm(!showArchiveExecuteConfirm)}
                      className="text-xs px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-800">
                      Execute Archive
                    </button>
                  </div>
                  {showArchiveExecuteConfirm && (
                    <div className="border border-red-200 bg-red-50 rounded p-3 text-xs space-y-2">
                      <div className="font-semibold text-red-700">⚠ Confirm Archive Execution</div>
                      <div className="text-red-600">This will process all enabled archive policies. Protected entities (finance_audit_log, monthly_signoffs, finance_close_records, refund_approvals) will be skipped. Artifact records will be written. This action is audit-logged.</div>
                      <div className="flex gap-2">
                        <button disabled={executeArchivePending} onClick={() => executeArchive()}
                          className="px-3 py-1.5 bg-red-700 text-white rounded text-xs hover:bg-red-800 disabled:opacity-40 flex items-center gap-1">
                          {executeArchivePending ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Confirm Execute'}
                        </button>
                        <button onClick={() => setShowArchiveExecuteConfirm(false)} className="px-3 py-1.5 border rounded text-xs hover:bg-gray-100">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Archive Artifacts */}
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3"/> Archive Artifacts
                    <button onClick={() => refetchArchiveArtifacts()} className="ml-2 text-blue-600 hover:underline font-normal">Refresh</button>
                  </div>
                  {archiveArtifactsLoading ? (
                    <div className="h-16 bg-gray-100 animate-pulse rounded"/>
                  ) : !archiveArtifactsData?.artifacts?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No archive artifacts yet — run Execute Archive to produce artifact records</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500">
                          <th className="text-left p-2">Entity</th><th className="text-left p-2">Storage Ref</th>
                          <th className="text-right p-2">Count</th><th className="text-left p-2">Created</th>
                        </tr>
                      </thead><tbody>
                        {archiveArtifactsData.artifacts.slice(0,20).map((a: any) => (
                          <tr key={a.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-700">{a.entityType}</td>
                            <td className="p-2 text-gray-500 truncate max-w-48 font-mono text-xs">{a.storageRef}</td>
                            <td className="p-2 text-right text-slate-700 font-medium">{a.archivedCount}</td>
                            <td className="p-2 text-gray-500">{new Date(a.createdAt).toLocaleString('he-IL')}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </div>

                {/* Policies */}
                {archivePoliciesLoading ? (
                  <div className="h-24 bg-gray-100 animate-pulse rounded"/>
                ) : !archivePoliciesData?.policies?.length ? (
                  <div className="text-sm text-gray-400 py-6 text-center border-2 border-dashed rounded-lg">No policies configured</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs"><thead className="bg-gray-50">
                      <tr className="text-gray-500">
                        <th className="text-left p-2">Entity Type</th>
                        <th className="text-right p-2">Archive After</th>
                        <th className="text-right p-2">Retain For</th>
                        <th className="text-left p-2">Notes</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead><tbody>
                      {archivePoliciesData.policies.map((p: any) => (
                        <tr key={p.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-mono text-gray-700">{p.entityType}</td>
                          <td className="p-2 text-right text-amber-700">{p.archiveAfterDays}d</td>
                          <td className="p-2 text-right text-slate-700">{p.retentionDays}d</td>
                          <td className="p-2 text-gray-500 max-w-48 truncate">{p.notes}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {p.enabled ? 'Active' : 'Off'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                )}

                {/* Archive runs */}
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <History className="w-3 h-3"/> Recent Archive Runs
                    <button onClick={() => refetchArchiveRuns()} className="ml-2 text-blue-600 hover:underline font-normal">Refresh</button>
                  </div>
                  {archiveRunsLoading ? (
                    <div className="h-20 bg-gray-100 animate-pulse rounded"/>
                  ) : !archiveRunsData?.runs?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No archive runs yet</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Entity</th><th className="text-left p-2">Ran</th><th className="text-left p-2">Status</th><th className="text-right p-2">Eligible</th></tr>
                      </thead><tbody>
                        {archiveRunsData.runs.slice(0,20).map((r: any) => (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-600">{r.entityType}</td>
                            <td className="p-2 text-gray-500">{new Date(r.ranAt).toLocaleString('he-IL')}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === 'dry_run' ? 'bg-blue-100 text-blue-700' : r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                            </td>
                            <td className="p-2 text-right text-gray-500">{r.movedCount}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3.6D: Archive Retrieval Requests */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderSearch className="w-4 h-4 text-teal-600" /> Archive Retrievals (Phase 3.6)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2">
                  Request a full data retrieval from the archive for audit, dispute investigation, or compliance. Retrievals are processed asynchronously and marked ready when complete.
                </div>
                {/* New retrieval */}
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2 text-xs">
                  <div className="font-semibold text-gray-700">New Retrieval Request</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-gray-500 mb-0.5 block">Entity Type</label>
                      <input placeholder="e.g. booking, payout, refund" value={retrievalForm.entityType} onChange={e=>setRetrievalForm(f=>({...f, entityType: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                    <div><label className="text-gray-500 mb-0.5 block">Entity ID</label>
                      <input placeholder="ID or range" value={retrievalForm.entityId} onChange={e=>setRetrievalForm(f=>({...f, entityId: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                    <div><label className="text-gray-500 mb-0.5 block">Reason</label>
                      <input placeholder="audit / dispute / compliance" value={retrievalForm.reason} onChange={e=>setRetrievalForm(f=>({...f, reason: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                    <div><label className="text-gray-500 mb-0.5 block">Date Range</label>
                      <input placeholder="2026-01-01 → 2026-03-31" value={retrievalForm.dateRange} onChange={e=>setRetrievalForm(f=>({...f, dateRange: e.target.value}))} className="border rounded px-2 py-1 w-full"/></div>
                  </div>
                  <button disabled={createRetrievalPending || !retrievalForm.entityType} onClick={() => createRetrieval(retrievalForm)}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 disabled:opacity-40">
                    {createRetrievalPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Request Retrieval'}
                  </button>
                </div>
                {retrievalsLoading ? <div className="h-16 bg-gray-100 animate-pulse rounded"/> :
                  !retrievals?.retrievals?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No archive retrievals requested yet</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Entity</th><th className="text-left p-2">Reason</th><th className="text-left p-2">Status</th><th className="text-left p-2">Requested</th><th className="text-left p-2">Actions</th></tr>
                      </thead><tbody>
                        {retrievals.retrievals.map((r: any) => (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="p-2"><span className="font-mono text-gray-700">{r.entityType}</span><span className="text-gray-400"> #{r.entityId}</span></td>
                            <td className="p-2 text-gray-600">{r.reason}</td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${r.status==='ready' ? 'bg-green-100 text-green-700' : r.status==='processing' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                            <td className="p-2 text-gray-400">{new Date(r.requestedAt).toLocaleDateString('he-IL')}</td>
                            <td className="p-2">
                              {r.status !== 'ready' && (
                                <button onClick={() => markRetrievalReady({ id: r.id, retrievalRef: '' })} disabled={markRetrievalReadyPending}
                                  className="text-xs px-1.5 py-0.5 border border-teal-300 text-teal-700 rounded hover:bg-teal-50">Mark Ready</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.4G — RECOVERY & REPLAY                                      */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="recovery" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4 text-rose-600" /> Disaster Recovery & Replay
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  ⚠ Replay Execute requires <strong>finance_admin</strong> role and only modifies derived state — never immutable financial facts. Always dry-run first.
                </div>

                {/* Replay type selector */}
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Select Replay Type</div>
                  <div className="space-y-1.5">
                    {REPLAY_TYPES.map(rt => (
                      <label key={rt} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="replayType" value={rt}
                          checked={selectedReplayType === rt}
                          onChange={() => setSelectedReplayType(rt)}
                          className="w-3 h-3"/>
                        <span className="text-xs font-mono text-gray-700">{rt}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button disabled={dryRunPending} onClick={() => startDryRun(selectedReplayType)}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
                      {dryRunPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Eye className="w-3 h-3"/>} Dry-Run
                    </button>
                    <button disabled={executeReplayPending} onClick={() => executeReplay(selectedReplayType)}
                      className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1">
                      {executeReplayPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <PlayCircle className="w-3 h-3"/>} Execute (Direct)
                    </button>
                    <button onClick={() => refetchReplayRuns()} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-100 flex items-center gap-1">
                      <RefreshCcw className="w-3 h-3"/> Refresh
                    </button>
                  </div>

                  {/* 3.5G: Request Execute via Approval */}
                  <div className="mt-3 border-t pt-3 space-y-2">
                    <div className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5"/> Request Execute via Approval (Phase 3.5)
                    </div>
                    <div className="text-xs text-gray-500">Requires a completed dry-run. A second finance_admin must approve before execution.</div>
                    <div className="flex gap-2">
                      <input placeholder="Reason for execution" value={replayReason}
                        onChange={e=>setReplayReason(e.target.value)}
                        className="text-xs border rounded px-2 py-1.5 flex-1"/>
                      <button disabled={requestReplayPending} onClick={() => requestReplayExecute({ replayType: selectedReplayType, reason: replayReason })}
                        className="text-xs px-3 py-1.5 bg-rose-700 text-white rounded hover:bg-rose-800 disabled:opacity-40 flex items-center gap-1">
                        {requestReplayPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <FileSignature className="w-3 h-3"/>} Request
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replay runs history */}
                {replayRunsLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-16 bg-gray-100 animate-pulse rounded"/>)}</div>
                ) : !replayRunsData?.runs?.length ? (
                  <div className="text-sm text-gray-400 py-8 text-center border-2 border-dashed rounded-lg">
                    No replay runs yet. Select a type and click Dry-Run to start.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {replayRunsData.runs.map((r: any) => (
                      <div key={r.id} className={`border rounded-lg overflow-hidden ${r.status === 'completed' ? 'border-green-200' : r.status === 'failed' ? 'border-red-200' : 'border-blue-200'}`}>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedReplayRun(expandedReplayRun === r.id ? null : r.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.dryRun ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                              {r.dryRun ? 'DRY-RUN' : 'EXECUTE'}
                            </span>
                            <span className="text-xs font-mono text-gray-700">{r.replayType}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{new Date(r.startedAt).toLocaleString('he-IL')}</span>
                            {r.appliedCount > 0 && <span className="text-rose-700 font-semibold">{r.appliedCount} applied</span>}
                            <ChevronDown className={`w-3 h-3 transition-transform ${expandedReplayRun === r.id ? 'rotate-180' : ''}`}/>
                          </div>
                        </div>
                        {expandedReplayRun === r.id && r.findingsJson?.findings && (
                          <div className="border-t bg-gray-50 p-3">
                            <div className="text-xs font-semibold text-gray-600 mb-1.5">Findings ({r.findingsJson.findings.length})</div>
                            {r.findingsJson.findings.length === 0 ? (
                              <div className="text-xs text-green-700">✓ No issues found</div>
                            ) : (
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {r.findingsJson.findings.map((f: any, i: number) => (
                                  <div key={i} className="text-xs bg-white border rounded p-2 font-mono text-gray-700">
                                    {JSON.stringify(f)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.5G: Pending Replay Approvals */}
            {(pendingReplayApprovalsData?.approvals?.length > 0 || pendingReplayApprovalsLoading) && (
              <Card className="border-rose-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600" /> Pending Replay Approvals
                      <span className="ml-1 px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-bold">{pendingReplayApprovalsData?.total ?? 0}</span>
                    </CardTitle>
                    <button onClick={() => refetchPendingReplayApprovals()} className="text-xs text-blue-600 hover:underline">Refresh</button>
                  </div>
                </CardHeader>
                <CardContent>
                  {pendingReplayApprovalsLoading ? (
                    <div className="h-16 bg-gray-100 animate-pulse rounded"/>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-rose-50">
                        <tr className="text-gray-500">
                          <th className="text-left p-2">Replay Type</th><th className="text-left p-2">Requested By</th>
                          <th className="text-left p-2">Reason</th><th className="text-left p-2">Requested</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead><tbody>
                        {pendingReplayApprovalsData.approvals.map((a: any) => (
                          <tr key={a.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-rose-700 text-xs">{a.replayType}</td>
                            <td className="p-2 font-mono text-gray-500 truncate max-w-24">{a.requestedByUid}</td>
                            <td className="p-2 text-gray-500 truncate max-w-32">{a.reason || '—'}</td>
                            <td className="p-2 text-gray-400">{new Date(a.createdAt).toLocaleString('he-IL')}</td>
                            <td className="p-2">
                              <button disabled={approveReplayPending} onClick={() => approveReplayExec(a.id)}
                                className="px-2 py-0.5 bg-rose-700 text-white rounded text-xs hover:bg-rose-800 disabled:opacity-40">
                                {approveReplayPending ? '…' : 'Approve & Execute'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 3.5G: Signed Report Viewer */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-gray-600" /> Signed Run Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <input type="number" placeholder="Run ID"
                    value={viewingReportRunId ?? ''}
                    onChange={e => setViewingReportRunId(e.target.value ? parseInt(e.target.value) : null)}
                    className="text-xs border rounded px-2 py-1.5 w-28"/>
                  <button onClick={() => refetchReplayReport()} disabled={!viewingReportRunId || replayReportLoading}
                    className="text-xs px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-40">
                    {replayReportLoading ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Load Report'}
                  </button>
                </div>
                {replayReportData?.ok && replayReportData.report && (
                  <div className="border rounded-lg p-3 bg-gray-50 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Run #{replayReportData.report.replayRunId}</span>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">Signed</span>
                    </div>
                    <div className="font-mono text-gray-500 break-all">SHA-256: {replayReportData.report.signature}</div>
                    <div className="text-gray-500">Generated: {new Date(replayReportData.report.createdAt).toLocaleString('he-IL')}</div>
                    <div className="border rounded bg-white p-2 font-mono text-xs max-h-40 overflow-y-auto text-gray-700">
                      {JSON.stringify(replayReportData.report.reportJson, null, 2)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.6E: Replay Diff Viewer */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-rose-600" /> Replay Diff Viewer (Phase 3.6)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  Compare two replay runs to identify divergent computation paths, changed amounts, or missing records. Useful for validating close-record idempotency.
                </div>
                <div className="flex flex-wrap gap-2">
                  <input type="number" placeholder="Run A ID" value={diffRunA} onChange={e=>setDiffRunA(e.target.value)} className="border rounded px-2 py-1 text-xs w-28"/>
                  <input type="number" placeholder="Run B ID" value={diffRunB} onChange={e=>setDiffRunB(e.target.value)} className="border rounded px-2 py-1 text-xs w-28"/>
                  <button disabled={computeDiffPending || !diffRunA || !diffRunB} onClick={() => computeReplayDiff({ runAId: parseInt(diffRunA, 10), runBId: parseInt(diffRunB, 10) })}
                    className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-40">
                    {computeDiffPending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Compare Runs'}
                  </button>
                </div>
                {replayDiff?.ok && (
                  <div className="border rounded-lg p-3 bg-rose-50 border-rose-200 text-xs space-y-2">
                    <div className="flex items-center gap-3 font-semibold text-rose-800">
                      <span>Run #{replayDiff.runA} vs Run #{replayDiff.runB}</span>
                      <span className={`px-1.5 py-0.5 rounded ${replayDiff.divergenceCount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {replayDiff.divergenceCount} divergence{replayDiff.divergenceCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {replayDiff.diffs?.length > 0 && (
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-xs"><thead className="bg-gray-50">
                          <tr className="text-gray-500"><th className="text-left p-2">Record</th><th className="text-left p-2">Field</th><th className="text-right p-2">Run A</th><th className="text-right p-2">Run B</th></tr>
                        </thead><tbody>
                          {replayDiff.diffs.map((d: any, i: number) => (
                            <tr key={i} className="border-t hover:bg-rose-50">
                              <td className="p-2 font-mono text-gray-700">{d.recordKey}</td>
                              <td className="p-2 text-gray-600">{d.field}</td>
                              <td className="p-2 text-right font-mono text-red-600">{d.valueA ?? '—'}</td>
                              <td className="p-2 text-right font-mono text-green-700">{d.valueB ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody></table>
                      </div>
                    )}
                    {replayDiff.divergenceCount === 0 && (
                      <div className="text-center text-green-700 py-2">Runs are identical — no divergence detected</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.6F — POLICY ENGINE                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="policies" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-600" /> Finance Policy Engine
                  </CardTitle>
                  <div className="text-xs text-gray-500">5 default policies seeded — override values to adjust system behaviour without code changes</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded p-2 space-y-0.5">
                  <div className="font-semibold">System Policy Keys</div>
                  <div>• <code>refund_auto_approve_limit</code> — max refund auto-approved (₪ cents)</div>
                  <div>• <code>payout_auto_release_limit</code> — max payout auto-released (₪ cents)</div>
                  <div>• <code>dispute_sla_hours</code> — SLA window for dispute resolution</div>
                  <div>• <code>forecast_default_horizon</code> — forecast horizon in days</div>
                  <div>• <code>archive_protected_entities</code> — comma-separated entity types immune to archival</div>
                </div>
                {policyRulesLoading ? <div className="h-20 bg-gray-100 animate-pulse rounded"/> :
                  !policyRules?.rules?.length ? (
                    <div className="text-xs text-gray-400 text-center py-4 border border-dashed rounded">No policy rules found</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs"><thead className="bg-gray-50">
                        <tr className="text-gray-500"><th className="text-left p-2">Policy Key</th><th className="text-left p-2">Value</th><th className="text-left p-2">Division</th><th className="text-left p-2">Active</th><th className="text-left p-2">Actions</th></tr>
                      </thead><tbody>
                        {policyRules.rules.map((rule: any) => (
                          <tr key={rule.id} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-700">{rule.policyKey}</td>
                            <td className="p-2 font-mono text-indigo-700">{rule.value}</td>
                            <td className="p-2 text-gray-500">{rule.divisionCode || <span className="italic text-gray-400">global</span>}</td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{rule.isActive ? 'Active' : 'Off'}</span></td>
                            <td className="p-2">
                              <button onClick={() => { const v = prompt(`New value for ${rule.policyKey}:`, rule.value); if(v!==null) upsertPolicyRule({ policyKey: rule.policyKey, value: v, divisionCode: rule.divisionCode || null, description: rule.description }) }}
                                className="text-xs px-1.5 py-0.5 border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50 mr-1">Edit</button>
                              <button onClick={() => upsertPolicyRule({ policyKey: rule.policyKey, value: rule.value, divisionCode: rule.divisionCode || null, description: rule.description, isActive: !rule.isActive })}
                                className={`text-xs px-1.5 py-0.5 border rounded hover:bg-gray-50 ${rule.isActive ? 'border-red-200 text-red-600' : 'border-green-200 text-green-700'}`}>
                                {rule.isActive ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )
                }
                {/* Add new rule */}
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Add / Override Policy Rule</div>
                  <div className="flex flex-wrap gap-2">
                    <input placeholder="policy_key" value={newRuleForm.policyKey} onChange={e=>setNewRuleForm(f=>({...f, policyKey: e.target.value}))} className="border rounded px-2 py-1 text-xs flex-1 min-w-32"/>
                    <input placeholder="value" value={newRuleForm.value} onChange={e=>setNewRuleForm(f=>({...f, value: e.target.value}))} className="border rounded px-2 py-1 text-xs w-28"/>
                    <input placeholder="divisionCode (blank=global)" value={newRuleForm.divisionCode} onChange={e=>setNewRuleForm(f=>({...f, divisionCode: e.target.value}))} className="border rounded px-2 py-1 text-xs w-36"/>
                    <input placeholder="description" value={newRuleForm.description} onChange={e=>setNewRuleForm(f=>({...f, description: e.target.value}))} className="border rounded px-2 py-1 text-xs flex-1 min-w-32"/>
                    <button disabled={upsertPolicyRulePending || !newRuleForm.policyKey || !newRuleForm.value} onClick={() => upsertPolicyRule({ policyKey: newRuleForm.policyKey, value: newRuleForm.value, divisionCode: newRuleForm.divisionCode||null, description: newRuleForm.description })}
                      className="text-xs px-3 py-1.5 bg-indigo-700 text-white rounded hover:bg-indigo-800 disabled:opacity-40">
                      {upsertPolicyRulePending ? <Loader2 className="w-3 h-3 animate-spin inline"/> : 'Save Rule'}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3.7B — APPROVAL CHAIN DESIGNER */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-600" /> Approval Chain Designer
                  </CardTitle>
                  <button onClick={() => setShowNewChainForm(f => !f)}
                    className="text-xs px-3 py-1.5 bg-violet-700 text-white rounded hover:bg-violet-800 flex items-center gap-1">
                    {showNewChainForm ? <XCircle className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showNewChainForm ? 'Cancel' : 'New Chain'}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showNewChainForm && (
                  <div className="border border-violet-200 rounded-lg p-3 bg-violet-50 space-y-2">
                    <div className="text-xs font-semibold text-violet-800 mb-1">New Approval Chain</div>
                    <div className="flex flex-wrap gap-2">
                      <input placeholder="Chain name" value={newChain.chainName} onChange={e => setNewChain(f => ({ ...f, chainName: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs flex-1 min-w-36" />
                      <select value={newChain.triggerType} onChange={e => setNewChain(f => ({ ...f, triggerType: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-36">
                        <option value="payout">Payout</option>
                        <option value="refund">Refund</option>
                        <option value="dispute">Dispute</option>
                        <option value="policy_change">Policy Change</option>
                        <option value="period_close">Period Close</option>
                      </select>
                      <input placeholder="Min ₪ (cents)" type="number" value={newChain.minAmountCents} onChange={e => setNewChain(f => ({ ...f, minAmountCents: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-28" />
                      <input placeholder="Max ₪ (cents, blank=∞)" type="number" value={newChain.maxAmountCents} onChange={e => setNewChain(f => ({ ...f, maxAmountCents: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-36" />
                      <input placeholder="Escalation hours" type="number" value={newChain.escalationHours} onChange={e => setNewChain(f => ({ ...f, escalationHours: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-32" />
                      <input placeholder="Notes" value={newChain.notes} onChange={e => setNewChain(f => ({ ...f, notes: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs flex-1 min-w-36" />
                    </div>
                    <button disabled={createChainPending || !newChain.chainName}
                      onClick={() => createApprovalChain({ ...newChain, minAmountCents: parseInt(newChain.minAmountCents || '0', 10), maxAmountCents: newChain.maxAmountCents ? parseInt(newChain.maxAmountCents, 10) : null, escalationHours: parseInt(newChain.escalationHours || '48', 10) })}
                      className="text-xs px-3 py-1.5 bg-violet-700 text-white rounded hover:bg-violet-800 disabled:opacity-40 flex items-center gap-1">
                      {createChainPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Create Chain
                    </button>
                  </div>
                )}
                {approvalChainsLoading ? <div className="h-20 bg-gray-100 animate-pulse rounded" /> :
                  !approvalChains?.chains?.length ? (
                    <div className="text-xs text-gray-400 text-center py-6 border border-dashed rounded">No approval chains configured</div>
                  ) : (
                    <div className="space-y-3">
                      {approvalChains.chains.map((chain: any) => (
                        <div key={chain.id} className="border rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer" onClick={() => setExpandedChainId(expandedChainId === chain.id ? null : chain.id)}>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-800">{chain.chain_name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{chain.trigger_type}</span>
                              <span className="text-gray-500">₪{(chain.min_amount_cents/100).toFixed(0)}–{chain.max_amount_cents ? '₪'+(chain.max_amount_cents/100).toFixed(0) : '∞'}</span>
                              <span className={`px-1.5 py-0.5 rounded ${chain.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{chain.is_active ? 'Active' : 'Off'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={e => { e.stopPropagation(); patchApprovalChain({ id: chain.id, body: { isActive: !chain.is_active } }); }}
                                className={`text-xs px-2 py-0.5 rounded border ${chain.is_active ? 'border-red-200 text-red-600' : 'border-green-200 text-green-700'}`}>
                                {chain.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedChainId === chain.id ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                          {expandedChainId === chain.id && (
                            <div className="p-3 space-y-3 border-t">
                              <div className="text-xs font-semibold text-gray-600">Steps ({chain.steps?.length ?? 0})</div>
                              {chain.steps?.length ? (
                                <div className="space-y-1">
                                  {chain.steps.map((step: any) => (
                                    <div key={step.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 bg-white">
                                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-mono text-xs">{step.step_order}</span>
                                      <span className="font-medium text-gray-700">{step.required_role}</span>
                                      <span className="text-gray-400">timeout {step.timeout_hours}h</span>
                                      {step.escalate_to_role && <span className="text-gray-400">→ {step.escalate_to_role}</span>}
                                      <span className={`ml-auto px-1 py-0.5 rounded ${step.is_required ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{step.is_required ? 'required' : 'optional'}</span>
                                      <button onClick={() => deleteChainStep(step.id)} className="text-red-400 hover:text-red-600"><XCircle className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ))}
                                </div>
                              ) : <div className="text-xs text-gray-400">No steps yet</div>}
                              {/* Add step form */}
                              <div className="border-t pt-2">
                                <div className="text-xs font-semibold text-gray-600 mb-1">Add Step</div>
                                <div className="flex flex-wrap gap-2">
                                  <input type="number" placeholder="Order" value={newStep.chainId === chain.id ? newStep.stepOrder : '1'} onChange={e => setNewStep(f => ({ ...f, chainId: chain.id, stepOrder: e.target.value }))}
                                    className="border rounded px-2 py-1 text-xs w-16" />
                                  <select value={newStep.chainId === chain.id ? newStep.requiredRole : 'finance_manager'}
                                    onChange={e => setNewStep(f => ({ ...f, chainId: chain.id, requiredRole: e.target.value }))}
                                    className="border rounded px-2 py-1 text-xs">
                                    <option value="finance_manager">Finance Manager</option>
                                    <option value="cfo">CFO</option>
                                    <option value="director">Director</option>
                                    <option value="board">Board</option>
                                    <option value="legal">Legal</option>
                                  </select>
                                  <input type="number" placeholder="Timeout hrs" value={newStep.chainId === chain.id ? newStep.timeoutHours : '24'}
                                    onChange={e => setNewStep(f => ({ ...f, chainId: chain.id, timeoutHours: e.target.value }))}
                                    className="border rounded px-2 py-1 text-xs w-24" />
                                  <button disabled={addStepPending} onClick={() => addChainStep({ chainId: chain.id, body: { stepOrder: parseInt(newStep.stepOrder, 10), requiredRole: newStep.requiredRole, timeoutHours: parseInt(newStep.timeoutHours, 10) } })}
                                    className="text-xs px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40">
                                    {addStepPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Step'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }

                {/* Pending approval requests */}
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    Pending Approval Requests
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">{approvalRequestsData?.requests?.filter((r: any) => r.status === 'pending')?.length ?? 0}</span>
                  </div>
                  {approvalRequestsLoading ? <div className="h-16 bg-gray-100 animate-pulse rounded" /> :
                    !approvalRequestsData?.requests?.filter((r: any) => r.status === 'pending')?.length ? (
                      <div className="text-xs text-gray-400 text-center py-3 border border-dashed rounded">No pending requests</div>
                    ) : (
                      <div className="space-y-2">
                        {approvalRequestsData.requests.filter((r: any) => r.status === 'pending').map((r: any) => (
                          <div key={r.id} className="border rounded-lg p-3 text-xs flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-gray-800">{r.entity_type} #{r.entity_id}</div>
                              <div className="text-gray-500">{r.chain_name ?? 'No chain'} — Step {r.current_step_order}</div>
                              {r.amount_cents && <div className="text-gray-600 font-mono">₪{(r.amount_cents/100).toFixed(2)}</div>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => actOnApproval({ id: r.id, action: 'approve' })} disabled={actOnApprovalPending}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Approve
                              </button>
                              <button onClick={() => actOnApproval({ id: r.id, action: 'reject' })} disabled={actOnApprovalPending}
                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Reject
                              </button>
                              <button onClick={() => actOnApproval({ id: r.id, action: 'escalate' })} disabled={actOnApprovalPending}
                                className="px-2 py-1 border border-orange-300 text-orange-700 rounded hover:bg-orange-50 disabled:opacity-40">
                                Escalate
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.7A+3.7C — SIMULATION TAB                                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="simulation" className="mt-4 space-y-4">
            {/* 3.7A — Policy Simulator */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-600" /> Policy Impact Simulator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2">
                  Simulate the financial impact of changing a policy rule before applying it. Results are saved to history and never modify live rules.
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={simPolicyKey} onChange={e => setSimPolicyKey(e.target.value)}
                    className="border rounded px-2 py-1 text-xs flex-1 min-w-48">
                    <option value="refund_auto_approve_limit">refund_auto_approve_limit</option>
                    <option value="payout_auto_release_limit">payout_auto_release_limit</option>
                    <option value="dispute_sla_hours">dispute_sla_hours</option>
                    <option value="forecast_default_horizon">forecast_default_horizon</option>
                  </select>
                  <input placeholder="Proposed value (cents / hours)" value={simProposedValue} onChange={e => setSimProposedValue(e.target.value)}
                    className="border rounded px-2 py-1 text-xs w-48" />
                  <input placeholder="Division (blank=global)" value={simDivision} onChange={e => setSimDivision(e.target.value)}
                    className="border rounded px-2 py-1 text-xs w-40" />
                  <button disabled={runSimulationPending || !simProposedValue}
                    onClick={() => runSimulation({ policyKey: simPolicyKey, proposedValue: simProposedValue, divisionCode: simDivision || undefined })}
                    className="text-xs px-3 py-1.5 bg-teal-700 text-white rounded hover:bg-teal-800 disabled:opacity-40 flex items-center gap-1">
                    {runSimulationPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />} Run Simulation
                  </button>
                </div>
                {simResult && (
                  <div className="border border-teal-200 rounded-lg p-3 bg-teal-50 text-xs space-y-2">
                    <div className="font-semibold text-teal-800">Simulation Result</div>
                    <div className="text-gray-700">{simResult.outcomeSummary}</div>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <div className="flex flex-col"><span className="text-gray-500">Current</span><span className="font-mono text-gray-800">{simResult.originalValue ?? 'unset'}</span></div>
                      <div className="flex flex-col"><span className="text-gray-500">Proposed</span><span className="font-mono text-teal-700">{simResult.proposedValue}</span></div>
                      <div className="flex flex-col"><span className="text-gray-500">Affected entities</span><span className="font-mono text-orange-700">{simResult.affectedEntities}</span></div>
                      <div className="flex flex-col"><span className="text-gray-500">Risk score</span><span className={`font-mono font-semibold ${simResult.riskScore > 60 ? 'text-red-600' : simResult.riskScore > 30 ? 'text-orange-500' : 'text-green-600'}`}>{simResult.riskScore}/100</span></div>
                      {simResult.wouldSaveCents > 0 && <div className="flex flex-col"><span className="text-gray-500">Value impacted</span><span className="font-mono text-blue-700">₪{(simResult.wouldSaveCents/100).toFixed(2)}</span></div>}
                    </div>
                  </div>
                )}
                {/* Simulation history */}
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Recent Simulations</div>
                  {simHistoryLoading ? <div className="h-16 bg-gray-100 animate-pulse rounded" /> :
                    !simHistory?.simulations?.length ? (
                      <div className="text-xs text-gray-400 text-center py-3 border border-dashed rounded">No past simulations</div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-xs"><thead className="bg-gray-50">
                          <tr className="text-gray-500"><th className="text-left p-2">Policy Key</th><th className="text-left p-2">From → To</th><th className="text-left p-2">Risk</th><th className="text-left p-2">Affected</th><th className="text-left p-2">Date</th></tr>
                        </thead><tbody>
                          {simHistory.simulations.slice(0, 10).map((s: any) => (
                            <tr key={s.id} className="border-t hover:bg-gray-50">
                              <td className="p-2 font-mono text-gray-700">{s.policy_key}</td>
                              <td className="p-2 text-gray-500">{s.original_value ?? '—'} → <span className="text-teal-700">{s.proposed_value}</span></td>
                              <td className="p-2"><span className={`font-mono ${s.risk_score > 60 ? 'text-red-600' : s.risk_score > 30 ? 'text-orange-500' : 'text-green-600'}`}>{s.risk_score}</span></td>
                              <td className="p-2 font-mono">{s.affected_entities}</td>
                              <td className="p-2 text-gray-400">{new Date(s.created_at).toLocaleDateString('he-IL')}</td>
                            </tr>
                          ))}
                        </tbody></table>
                      </div>
                    )
                  }
                </div>
              </CardContent>
            </Card>

            {/* 3.7C — Forecast Scenarios */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" /> Forecast Scenario Planner
                  </CardTitle>
                  <button onClick={() => setShowNewScenarioForm(f => !f)}
                    className="text-xs px-3 py-1.5 bg-blue-700 text-white rounded hover:bg-blue-800 flex items-center gap-1">
                    {showNewScenarioForm ? <XCircle className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {showNewScenarioForm ? 'Cancel' : 'New Scenario'}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showNewScenarioForm && (
                  <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                    <div className="text-xs font-semibold text-blue-800">New Forecast Scenario</div>
                    <div className="flex flex-wrap gap-2">
                      <input placeholder="Scenario name" value={newScenario.scenarioName} onChange={e => setNewScenario(f => ({ ...f, scenarioName: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs flex-1 min-w-36" />
                      <input placeholder="Description" value={newScenario.description} onChange={e => setNewScenario(f => ({ ...f, description: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs flex-1 min-w-48" />
                      <input type="number" placeholder="Horizon days" value={newScenario.baseHorizonDays} onChange={e => setNewScenario(f => ({ ...f, baseHorizonDays: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-28" />
                      <input type="number" placeholder="Revenue adj %" value={newScenario.revenueAdjustmentPct} onChange={e => setNewScenario(f => ({ ...f, revenueAdjustmentPct: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-32" />
                      <input type="number" placeholder="Booking vol adj %" value={newScenario.bookingVolumeAdjustmentPct} onChange={e => setNewScenario(f => ({ ...f, bookingVolumeAdjustmentPct: e.target.value }))}
                        className="border rounded px-2 py-1 text-xs w-32" />
                    </div>
                    <button disabled={createScenarioPending || !newScenario.scenarioName}
                      onClick={() => createScenario({ ...newScenario, baseHorizonDays: parseInt(newScenario.baseHorizonDays, 10), revenueAdjustmentPct: parseFloat(newScenario.revenueAdjustmentPct), bookingVolumeAdjustmentPct: parseFloat(newScenario.bookingVolumeAdjustmentPct) })}
                      className="text-xs px-3 py-1.5 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-40 flex items-center gap-1">
                      {createScenarioPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Create Scenario
                    </button>
                  </div>
                )}
                {forecastScenariosLoading ? <div className="h-20 bg-gray-100 animate-pulse rounded" /> :
                  !forecastScenariosData?.scenarios?.length ? (
                    <div className="text-xs text-gray-400 text-center py-6 border border-dashed rounded">No forecast scenarios yet</div>
                  ) : (
                    <div className="space-y-2">
                      {forecastScenariosData.scenarios.map((sc: any) => (
                        <div key={sc.id} className="border rounded-lg p-3 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-gray-800">{sc.scenario_name}</div>
                              {sc.description && <div className="text-gray-500 mt-0.5">{sc.description}</div>}
                              <div className="flex flex-wrap gap-3 mt-1.5 text-gray-600">
                                <span>Horizon: <span className="font-mono">{sc.base_horizon_days}d</span></span>
                                <span>Revenue adj: <span className={`font-mono ${parseFloat(sc.revenue_adjustment_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{parseFloat(sc.revenue_adjustment_pct) >= 0 ? '+' : ''}{parseFloat(sc.revenue_adjustment_pct).toFixed(1)}%</span></span>
                                <span>Bookings adj: <span className={`font-mono ${parseFloat(sc.booking_volume_adjustment_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{parseFloat(sc.booking_volume_adjustment_pct) >= 0 ? '+' : ''}{parseFloat(sc.booking_volume_adjustment_pct).toFixed(1)}%</span></span>
                              </div>
                              {sc.last_run_at && sc.last_run_result && (
                                <div className="mt-2 border border-blue-100 bg-blue-50 rounded p-2 space-y-0.5">
                                  <div className="text-blue-700 font-medium">Last run: {new Date(sc.last_run_at).toLocaleString('he-IL')}</div>
                                  <div>Base revenue: <span className="font-mono">₪{((sc.last_run_result?.baseRevenueCents ?? 0)/100).toFixed(2)}</span></div>
                                  <div>Projected: <span className="font-mono text-blue-700">₪{((sc.last_run_result?.projectedRevenueCents ?? 0)/100).toFixed(2)}</span></div>
                                  <div>Delta: <span className={`font-mono font-semibold ${(sc.last_run_result?.deltaRevenueCents ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{(sc.last_run_result?.deltaRevenueCents ?? 0) >= 0 ? '+' : ''}₪{((sc.last_run_result?.deltaRevenueCents ?? 0)/100).toFixed(2)}</span></div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button onClick={() => runScenario(sc.id)} disabled={runScenarioPending}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
                                {runScenarioPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />} Run
                              </button>
                              <button onClick={() => patchScenario({ id: sc.id, body: { isActive: !sc.is_active } })} disabled={patchScenarioPending}
                                className={`text-xs px-2 py-1 border rounded ${sc.is_active ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'}`}>
                                {sc.is_active ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* 3.7E+3.7F — GOVERNANCE TAB                                    */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="governance" className="mt-4 space-y-4">
            {/* 3.7E — Governance Report */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-700" /> Board-Level Governance Report
                  </CardTitle>
                  <button onClick={() => refetchGovernanceReport()}
                    className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center gap-1">
                    <RefreshCcw className="w-3 h-3" /> Refresh
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {governanceReportLoading ? (
                  <div className="h-32 bg-gray-100 animate-pulse rounded" />
                ) : !governanceReport ? (
                  <div className="text-xs text-gray-400 text-center py-6 border border-dashed rounded">Report unavailable</div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs text-gray-400">Generated: {new Date(governanceReport.generatedAt).toLocaleString('he-IL')}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Wallets', value: governanceReport.wallets?.total, color: 'blue' },
                        { label: 'Available (₪)', value: ((governanceReport.wallets?.totalAvailableCents ?? 0)/100).toFixed(2), color: 'green' },
                        { label: 'Pending (₪)', value: ((governanceReport.wallets?.totalPendingCents ?? 0)/100).toFixed(2), color: 'orange' },
                        { label: 'Disputes Open', value: governanceReport.disputes?.open, color: 'red' },
                        { label: 'Disputes Resolved', value: governanceReport.disputes?.resolved, color: 'green' },
                        { label: 'Refunds Completed', value: governanceReport.refunds?.completed, color: 'teal' },
                        { label: 'Refund Value (₪)', value: ((governanceReport.refunds?.totalValueCents ?? 0)/100).toFixed(2), color: 'teal' },
                        { label: 'Payout Batches Paid', value: governanceReport.payouts?.paidBatches, color: 'violet' },
                        { label: 'Payout Value (₪)', value: ((governanceReport.payouts?.totalValueCents ?? 0)/100).toFixed(2), color: 'violet' },
                        { label: 'Pending Approvals', value: governanceReport.approvals?.pending, color: 'orange' },
                        { label: 'Close Records', value: governanceReport.closeRecords?.total, color: 'gray' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className={`border rounded-lg p-3 bg-${color}-50 border-${color}-100`}>
                          <div className="text-xs text-gray-500">{label}</div>
                          <div className={`text-lg font-bold font-mono text-${color}-700`}>{value ?? 0}</div>
                        </div>
                      ))}
                    </div>
                    {governanceReport.openExceptions?.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Open Exceptions by Type</div>
                        <div className="flex flex-wrap gap-2">
                          {governanceReport.openExceptions.map((e: any) => (
                            <span key={e.type} className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-medium">
                              {e.type.replace(/_/g, ' ')}: {e.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {governanceReport.recentSimulations?.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Recent Policy Simulations</div>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs"><thead className="bg-gray-50">
                            <tr className="text-gray-500"><th className="text-left p-2">Policy</th><th className="text-left p-2">Risk</th><th className="text-left p-2">Summary</th></tr>
                          </thead><tbody>
                            {governanceReport.recentSimulations.map((s: any, i: number) => (
                              <tr key={i} className="border-t hover:bg-gray-50">
                                <td className="p-2 font-mono text-gray-700 whitespace-nowrap">{s.policy_key}</td>
                                <td className="p-2"><span className={`font-mono ${s.risk_score > 60 ? 'text-red-600' : s.risk_score > 30 ? 'text-orange-500' : 'text-green-600'}`}>{s.risk_score}/100</span></td>
                                <td className="p-2 text-gray-600 truncate max-w-xs">{s.outcome_summary}</td>
                              </tr>
                            ))}
                          </tbody></table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3.7F — Finance Assistant */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" /> Finance Decision Assistant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded p-2">
                  Ask the assistant for contextual action guidance. It scans the live system state and surfaces prioritised recommendations.
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={assistantContext} onChange={e => setAssistantContext(e.target.value)}
                    className="border rounded px-2 py-1 text-xs w-40">
                    <option value="">No context</option>
                    <option value="forecast">Forecasting</option>
                    <option value="period-close">Period Close</option>
                    <option value="policy">Policy Change</option>
                    <option value="disputes">Dispute Review</option>
                  </select>
                  <input placeholder="Optional question..." value={assistantQuestion} onChange={e => setAssistantQuestion(e.target.value)}
                    className="border rounded px-2 py-1 text-xs flex-1 min-w-48" />
                  <button disabled={askAssistantPending} onClick={() => askAssistant({ context: assistantContext, question: assistantQuestion })}
                    className="text-xs px-3 py-1.5 bg-indigo-700 text-white rounded hover:bg-indigo-800 disabled:opacity-40 flex items-center gap-1">
                    {askAssistantPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Ask Assistant
                  </button>
                </div>
                {assistantResult && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-600">Recommendations ({assistantResult.suggestions?.length ?? 0})</div>
                    {assistantResult.suggestions?.map((s: any, i: number) => (
                      <div key={i} className={`border-l-4 rounded-r-lg p-3 text-xs ${
                        s.priority === 'high' ? 'border-red-400 bg-red-50' :
                        s.priority === 'medium' ? 'border-orange-400 bg-orange-50' : 'border-blue-300 bg-blue-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded font-medium text-xs ${
                            s.priority === 'high' ? 'bg-red-100 text-red-700' :
                            s.priority === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>{s.priority.toUpperCase()}</span>
                          <span className="font-semibold text-gray-800">{s.action}</span>
                        </div>
                        <div className="text-gray-600">{s.reason}</div>
                        {s.link && <a href={s.link} className="text-indigo-600 hover:underline mt-1 block">Go to {s.link}</a>}
                      </div>
                    ))}
                    <div className="text-xs text-gray-400 text-right">Generated: {new Date(assistantResult.generatedAt).toLocaleString('he-IL')}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ── 3.3B: Alert Delivery Log Drawer ──────────────────────────────────── */}
      {alertDeliveryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setAlertDeliveryDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">📬 Alert Delivery Log</h3>
              <button className="text-gray-400 hover:text-gray-700 text-lg" onClick={() => setAlertDeliveryDrawer(false)}>✕</button>
            </div>
            <div className="p-4 flex-1">
              {/* Digest preview */}
              {digestPreviewData?.ok && (
                <div className="mb-4 border rounded-lg p-3 bg-blue-50 border-blue-200">
                  <div className="text-xs font-semibold text-blue-700 mb-1.5">Digest Preview — {digestPreviewData.period}</div>
                  <div className="text-xs text-blue-600 mb-2">{digestPreviewData.total} unacknowledged alert(s)</div>
                  <div className="space-y-1">
                    {digestPreviewData.groups?.map((g: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span><span className={`font-bold ${g.severity === 'critical' ? 'text-red-600' : g.severity === 'warning' ? 'text-amber-600' : 'text-gray-600'}`}>{g.severity.toUpperCase()}</span> / {g.alert_type}</span>
                        <span className="font-mono">{g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Delivery log table */}
              {deliveryLogLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded" />)}</div>
              ) : !(deliveryLogData?.deliveries?.length) ? (
                <div className="text-xs text-gray-400 text-center py-8 border-2 border-dashed rounded-lg">No delivery records yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                        <th className="px-2 py-2 text-left">Alert ID</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Severity</th>
                        <th className="px-2 py-2 text-left">Delivery</th>
                        <th className="px-2 py-2 text-left">Status</th>
                        <th className="px-2 py-2 text-left">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryLogData.deliveries.map((d: any) => (
                        <tr key={d.id} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-1.5 font-mono">{d.alert_id ?? "—"}</td>
                          <td className="px-2 py-1.5">{d.alert_type ?? "—"}</td>
                          <td className="px-2 py-1.5">
                            {d.severity && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${d.severity === 'critical' ? 'bg-red-100 text-red-700' : d.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                {d.severity.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${d.delivery_type === 'escalation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {d.delivery_type}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${d.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-gray-500">{d.sent_at ? new Date(d.sent_at).toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* ── Reverse Admin Action Modal ──────────────────────────────────────────── */}
      <Dialog open={!!reverseModal} onOpenChange={(open) => { if (!open) { setReverseModal(null); setReverseResult(null); setReverseReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              ↩ ביטול פעולת אדמין
            </DialogTitle>
          </DialogHeader>
          {reverseModal && (
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded p-3 text-sm space-y-1">
                <p><span className="font-medium">עסקה:</span> <code className="text-xs font-mono">{reverseModal.txnId}</code></p>
                <p><span className="font-medium">סוג:</span> {reverseModal.source === 'admin_credit' ? 'זיכוי ידני' : 'חיוב ידני'}</p>
                <p><span className="font-medium">סכום:</span> ₪{(reverseModal.amountCents / 100).toFixed(2)}</p>
                <p><span className="font-medium">משתמש:</span> <code className="text-xs font-mono">{reverseModal.userId.slice(0, 20)}…</code></p>
                <p className="text-rose-700 font-medium mt-2">
                  ביטול יוצר פעולה הפוכה בארנק. לא ניתן לבטל פעמיים.
                </p>
              </div>
              {reverseResult && (
                <div className={`text-sm px-3 py-2 rounded border ${reverseResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {reverseResult.msg}
                </div>
              )}
              {!reverseResult?.ok && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">סיבה לביטול <span className="text-red-500">*</span></label>
                    <textarea
                      className="w-full border rounded p-2 text-sm resize-none"
                      rows={2}
                      placeholder="הסבר מדוע הפעולה מבוטלת..."
                      value={reverseReason}
                      onChange={(e) => setReverseReason(e.target.value)}
                      disabled={reversePending}
                    />
                    {reverseReason.trim().length > 0 && reverseReason.trim().length < 5 && (
                      <p className="text-xs text-red-500">הסיבה חייבת להכיל לפחות 5 תווים</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                      onClick={() => { setReverseModal(null); setReverseReason(""); setReverseResult(null); }}
                      disabled={reversePending}
                    >
                      ביטול
                    </button>
                    <button
                      className="px-4 py-2 text-sm bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50"
                      disabled={reversePending || reverseReason.trim().length < 5}
                      onClick={() => reverseAction({ txnId: reverseModal.txnId, reason: reverseReason.trim() })}
                    >
                      {reversePending ? "מבצע ביטול…" : "אשר ביטול"}
                    </button>
                  </div>
                </>
              )}
              {reverseResult?.ok && (
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                    onClick={() => { setReverseModal(null); setReverseResult(null); setReverseReason(""); }}
                  >
                    סגור
                  </button>
                </div>
              )}
            </div>
          )}
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
