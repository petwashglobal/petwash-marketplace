/**
 * AdminAlertsCenter — מרכז התראות (Alerts Center)
 * Route: /admin/alerts
 *
 * A triage queue of operational alerts ("what needs attention"): payment failures,
 * station/bay faults, tax-doc gaps, eGift/coupon abuse, low stock, expiries,
 * provider/support issues, and system signals. Each alert can be acknowledged,
 * assigned, snoozed, resolved, or dismissed.
 *
 * Hebrew-first, RTL. Brand: pure white / black / metallic gold (#D4AF37).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, AlertTriangle, AlertOctagon, Info, CheckCircle2, UserPlus,
  Clock, XCircle, Loader2, RefreshCw, X, ShieldAlert, Search, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const GOLD = "#D4AF37";

// ── Types ──────────────────────────────────────────────────────────────────
type Severity = "info" | "warning" | "critical";
type Status = "open" | "acknowledged" | "snoozed" | "resolved" | "dismissed";

interface Alert {
  id: number;
  dedupeKey: string;
  category: string;
  severity: Severity;
  status: Status;
  title: string;
  message: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  assignedTo?: string;
  dueAt?: string;
  snoozedUntil?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: any;
}

interface AlertsResponse {
  rows: Alert[];
  total: number;
  page: number;
  pageSize: number;
  counts: { open: number; critical: number; warning: number; snoozed: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDatetime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("he-IL"); } catch { return iso; }
}

function relativeTime(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "כעת";
  if (min < 60) return `לפני ${min} דק׳`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `לפני ${hr} שע׳`;
  const days = Math.round(hr / 24);
  return `לפני ${days} ימ׳`;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "open", label: "פתוחות" },
  { value: "acknowledged", label: "אושרו" },
  { value: "snoozed", label: "נדחו זמנית" },
  { value: "resolved", label: "נפתרו" },
  { value: "dismissed", label: "בוטלו" },
];

const SEVERITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "כל החומרות" },
  { value: "critical", label: "קריטי" },
  { value: "warning", label: "אזהרה" },
  { value: "info", label: "מידע" },
];

// category keys → Hebrew labels
const CATEGORY_HE: Record<string, string> = {
  payment: "תשלום",
  station: "תחנה",
  bay: "תא",
  finance_doc: "מסמך מס",
  egift: "eGift",
  coupon_abuse: "קופון",
  stock: "מלאי",
  expiry: "תפוגה",
  provider: "ספק",
  support: "תמיכה",
  system: "מערכת",
};

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "כל הקטגוריות" },
  ...Object.entries(CATEGORY_HE).map(([value, label]) => ({ value, label })),
];

const SEVERITY_HE: Record<Severity, string> = {
  critical: "קריטי",
  warning: "אזהרה",
  info: "מידע",
};

function severityBadge(sev: Severity) {
  const map: Record<Severity, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    info: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return map[sev] || "bg-gray-100 text-gray-600 border-gray-200";
}

function SeverityIcon({ sev }: { sev: Severity }) {
  if (sev === "critical") return <AlertOctagon className="w-3.5 h-3.5" />;
  if (sev === "warning") return <AlertTriangle className="w-3.5 h-3.5" />;
  return <Info className="w-3.5 h-3.5" />;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

const SNOOZE_PRESETS: Array<{ label: string; ms: number }> = [
  { label: "שעה", ms: 60 * 60 * 1000 },
  { label: "4 שעות", ms: 4 * 60 * 60 * 1000 },
  { label: "יום", ms: 24 * 60 * 60 * 1000 },
  { label: "3 ימים", ms: 3 * 24 * 60 * 60 * 1000 },
];

// ── Action modal kinds ──────────────────────────────────────────────────────
type ModalKind =
  | { kind: "acknowledge"; alert: Alert }
  | { kind: "assign"; alert: Alert }
  | { kind: "snooze"; alert: Alert }
  | { kind: "resolve"; alert: Alert }
  | { kind: "dismiss"; alert: Alert }
  | null;

export default function AdminAlertsCenter() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<ModalKind>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [assignedTo, setAssignedTo] = useState("");
  const [q, setQ] = useState("");

  const queryKey = useMemo(
    () => ["/api/admin/alerts", { status, severity, category, assignedTo, q }] as const,
    [status, severity, category, assignedTo, q],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AlertsResponse>({
    queryKey,
    queryFn: () => {
      const p = new URLSearchParams();
      if (status && status !== "all") p.set("status", status);
      if (severity && severity !== "all") p.set("severity", severity);
      if (category && category !== "all") p.set("category", category);
      if (assignedTo.trim()) p.set("assignedTo", assignedTo.trim());
      if (q.trim()) p.set("q", q.trim());
      const qs = p.toString();
      return apiRequest("GET", `/api/admin/alerts${qs ? `?${qs}` : ""}`).then((r) => r.json());
    },
  });

  const counts = data?.counts ?? { open: 0, critical: 0, warning: 0, snoozed: 0 };

  // Default sort: severity then createdAt (newest first).
  const rows = useMemo(() => {
    const list = data?.rows ?? [];
    return [...list].sort((a, b) => {
      const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (r !== 0) return r;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data?.rows]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/alerts"] });

  // ── Mutations ────────────────────────────────────────────────────────────
  const ackMut = useMutation({
    mutationFn: (p: { id: number; note?: string }) =>
      apiRequest("POST", `/api/admin/alerts/${p.id}/acknowledge`, { note: p.note }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "ההתראה אושרה" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const assignMut = useMutation({
    mutationFn: (p: { id: number; assigneeUid: string }) =>
      apiRequest("POST", `/api/admin/alerts/${p.id}/assign`, { assigneeUid: p.assigneeUid }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "ההתראה שויכה" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const snoozeMut = useMutation({
    mutationFn: (p: { id: number; until: string }) =>
      apiRequest("POST", `/api/admin/alerts/${p.id}/snooze`, { until: p.until }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "ההתראה נדחתה זמנית" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const resolveMut = useMutation({
    mutationFn: (p: { id: number; note: string }) =>
      apiRequest("POST", `/api/admin/alerts/${p.id}/resolve`, { note: p.note }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "ההתראה נפתרה" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const dismissMut = useMutation({
    mutationFn: (p: { id: number; reason: string }) =>
      apiRequest("POST", `/api/admin/alerts/${p.id}/dismiss`, { reason: p.reason }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "ההתראה בוטלה" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const sweepMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/alerts/sweep").then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "הסריקה הושלמה" }); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const anyPending =
    ackMut.isPending || assignMut.isPending || snoozeMut.isPending ||
    resolveMut.isPending || dismissMut.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-white text-black px-4 py-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6" style={{ color: GOLD }} />
              מרכז התראות
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              תור טיפול — מה דורש תשומת לב עכשיו.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => sweepMut.mutate()}
              disabled={sweepMut.isPending}
              className="gap-2 text-black"
              style={{ backgroundColor: GOLD }}
            >
              {sweepMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              רענון עכשיו
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              רענן
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="סה״כ פתוחות" value={counts.open} icon={<Bell className="w-4 h-4" />} tone="gold" />
          <SummaryCard label="קריטיות" value={counts.critical} icon={<AlertOctagon className="w-4 h-4" />} tone="red" />
          <SummaryCard label="אזהרות" value={counts.warning} icon={<AlertTriangle className="w-4 h-4" />} tone="amber" />
          <SummaryCard label="נדחו זמנית" value={counts.snoozed} icon={<Clock className="w-4 h-4" />} tone="grey" />
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div>
            <label className="text-xs font-medium text-gray-500">סטטוס</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">חומרה</label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">קטגוריה</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">משויך ל־ (UID)</label>
            <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="UID" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">חיפוש</label>
            <div className="relative mt-1">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="כותרת / הודעה" className="pr-8" />
            </div>
          </div>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin ml-2" /> טוען התראות…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-600">
            <ShieldAlert className="w-8 h-8 mb-2" />
            שגיאה בטעינת ההתראות.
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>נסה שוב</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Bell className="w-8 h-8 mb-2" />
            אין התראות פתוחות 🎉
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {/* Desktop table */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="text-right text-gray-500 border-b border-gray-100">
                    <th className="px-3 py-2 font-medium">חומרה</th>
                    <th className="px-3 py-2 font-medium">קטגוריה</th>
                    <th className="px-3 py-2 font-medium">כותרת</th>
                    <th className="px-3 py-2 font-medium">ישות מקושרת</th>
                    <th className="px-3 py-2 font-medium">משויך</th>
                    <th className="px-3 py-2 font-medium">גיל</th>
                    <th className="px-3 py-2 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 align-top">
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${severityBadge(a.severity)}`}>
                          <SeverityIcon sev={a.severity} />
                          {SEVERITY_HE[a.severity]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                          {CATEGORY_HE[a.category] || a.category}
                        </span>
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-gray-500 truncate">{a.message}</div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {a.linkedEntityType ? (
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <Link2 className="w-3 h-3" />
                            {a.linkedEntityType}
                            {a.linkedEntityId ? <span className="font-mono">#{a.linkedEntityId}</span> : null}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{a.assignedTo || "—"}</td>
                      <td className="px-3 py-3 text-xs text-gray-500" title={fmtDatetime(a.createdAt)}>
                        {relativeTime(a.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <AlertActions alert={a} onAction={setModal} disabled={anyPending} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {rows.map((a) => (
                  <div key={a.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${severityBadge(a.severity)}`}>
                        <SeverityIcon sev={a.severity} />
                        {SEVERITY_HE[a.severity]}
                      </span>
                      <span className="inline-block text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                        {CATEGORY_HE[a.category] || a.category}
                      </span>
                    </div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{a.message}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {a.linkedEntityType && (
                        <span className="inline-flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          {a.linkedEntityType}{a.linkedEntityId ? ` #${a.linkedEntityId}` : ""}
                        </span>
                      )}
                      <span>משויך: <span className="font-mono">{a.assignedTo || "—"}</span></span>
                      <span title={fmtDatetime(a.createdAt)}>{relativeTime(a.createdAt)}</span>
                    </div>
                    <AlertActions alert={a} onAction={setModal} disabled={anyPending} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ActionModal
          modal={modal}
          onClose={() => setModal(null)}
          pending={anyPending}
          onAcknowledge={(note) => modal.kind === "acknowledge" && ackMut.mutate({ id: modal.alert.id, note: note || undefined })}
          onAssign={(uid) => modal.kind === "assign" && assignMut.mutate({ id: modal.alert.id, assigneeUid: uid })}
          onSnooze={(until) => modal.kind === "snooze" && snoozeMut.mutate({ id: modal.alert.id, until })}
          onResolve={(note) => modal.kind === "resolve" && resolveMut.mutate({ id: modal.alert.id, note })}
          onDismiss={(reason) => modal.kind === "dismiss" && dismissMut.mutate({ id: modal.alert.id, reason })}
        />
      )}
    </div>
  );
}

// ── Summary card ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, tone }: {
  label: string; value: number; icon: React.ReactNode; tone: "gold" | "red" | "amber" | "grey";
}) {
  const toneCls: Record<string, string> = {
    gold: "text-black",
    red: "text-red-600",
    amber: "text-amber-600",
    grey: "text-gray-600",
  };
  return (
    <div className="border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-2xl font-bold ${toneCls[tone]}`}>{value}</div>
      </div>
      <div className={toneCls[tone]} style={tone === "gold" ? { color: GOLD } : undefined}>{icon}</div>
    </div>
  );
}

// ── Per-row action buttons ──────────────────────────────────────────────────
function AlertActions({ alert, onAction, disabled }: {
  alert: Alert; onAction: (m: ModalKind) => void; disabled: boolean;
}) {
  const isClosed = alert.status === "resolved" || alert.status === "dismissed";
  return (
    <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || isClosed || alert.status === "acknowledged"}
        onClick={() => onAction({ kind: "acknowledge", alert })}>
        <CheckCircle2 className="w-3.5 h-3.5" /> אישור
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || isClosed}
        onClick={() => onAction({ kind: "assign", alert })}>
        <UserPlus className="w-3.5 h-3.5" /> שיוך
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || isClosed}
        onClick={() => onAction({ kind: "snooze", alert })}>
        <Clock className="w-3.5 h-3.5" /> נדחה
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || isClosed}
        onClick={() => onAction({ kind: "resolve", alert })}>
        <CheckCircle2 className="w-3.5 h-3.5" /> נפתר
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs text-red-600 border-red-200"
        disabled={disabled || isClosed}
        onClick={() => onAction({ kind: "dismiss", alert })}>
        <XCircle className="w-3.5 h-3.5" /> ביטול
      </Button>
    </div>
  );
}

// ── Action modal ────────────────────────────────────────────────────────────
function ActionModal({
  modal, onClose, pending,
  onAcknowledge, onAssign, onSnooze, onResolve, onDismiss,
}: {
  modal: NonNullable<ModalKind>;
  onClose: () => void;
  pending: boolean;
  onAcknowledge: (note: string) => void;
  onAssign: (uid: string) => void;
  onSnooze: (until: string) => void;
  onResolve: (note: string) => void;
  onDismiss: (reason: string) => void;
}) {
  const [note, setNote] = useState("");
  const [uid, setUid] = useState(modal.alert.assignedTo ?? "");
  const [reason, setReason] = useState("");
  const [snoozeMs, setSnoozeMs] = useState<number | null>(null);

  const titles: Record<string, string> = {
    acknowledge: "אישור התראה",
    assign: "שיוך התראה",
    snooze: "דחייה זמנית",
    resolve: "סימון כנפתר",
    dismiss: "ביטול התראה",
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">{titles[modal.kind]}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{modal.alert.title}</p>

        {modal.kind === "acknowledge" && (
          <>
            <label className="text-xs font-medium">הערה (רשות)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה קצרה" className="mt-1 mb-4" />
            <ModalButtons pending={pending} disabled={false} onClose={onClose} onConfirm={() => onAcknowledge(note.trim())} />
          </>
        )}

        {modal.kind === "assign" && (
          <>
            <label className="text-xs font-medium">UID של אחראי (חובה)</label>
            <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="UID" className="mt-1 mb-4 font-mono" />
            <ModalButtons pending={pending} disabled={!uid.trim()} onClose={onClose} onConfirm={() => onAssign(uid.trim())} />
          </>
        )}

        {modal.kind === "snooze" && (
          <>
            <label className="text-xs font-medium mb-2 block">דחה למשך</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {SNOOZE_PRESETS.map((p) => (
                <Button key={p.label} size="sm" variant={snoozeMs === p.ms ? "default" : "outline"}
                  className={snoozeMs === p.ms ? "text-black" : ""}
                  style={snoozeMs === p.ms ? { backgroundColor: GOLD } : undefined}
                  onClick={() => setSnoozeMs(p.ms)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <ModalButtons pending={pending} disabled={snoozeMs === null} onClose={onClose}
              onConfirm={() => snoozeMs !== null && onSnooze(new Date(Date.now() + snoozeMs).toISOString())} />
          </>
        )}

        {modal.kind === "resolve" && (
          <>
            <label className="text-xs font-medium">הערת פתרון (חובה)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="כיצד טופל" className="mt-1 mb-4" />
            <ModalButtons pending={pending} disabled={!note.trim()} onClose={onClose} onConfirm={() => onResolve(note.trim())} />
          </>
        )}

        {modal.kind === "dismiss" && (
          <>
            <label className="text-xs font-medium">סיבת ביטול (חובה)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="מדוע אין צורך בטיפול" className="mt-1 mb-4" />
            <ModalButtons pending={pending} disabled={!reason.trim()} destructive onClose={onClose} onConfirm={() => onDismiss(reason.trim())} />
          </>
        )}
      </div>
    </div>
  );
}

function ModalButtons({ pending, disabled, destructive, onClose, onConfirm }: {
  pending: boolean; disabled: boolean; destructive?: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="flex gap-2 justify-start">
      <Button onClick={onConfirm} disabled={pending || disabled}
        className={destructive ? "bg-red-600 hover:bg-red-700 text-white" : "text-black"}
        style={destructive ? undefined : { backgroundColor: GOLD }}>
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "אישור"}
      </Button>
      <Button variant="outline" onClick={onClose} disabled={pending}>ביטול</Button>
    </div>
  );
}
