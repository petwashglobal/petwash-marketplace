/**
 * AdminBayControl — K9000 BAY CONTROL admin panel
 * Route: /admin/bays
 *
 * Lets an admin operate K9000 bays (left/right):
 *   - disable/enable a bay  (maintenance / offline / ready)  — OPERATIONAL FLAG
 *   - open a fault & clear a fault
 *   - link a Nayax terminal / QR reader ID
 *
 * NOTE: this changes ADMIN DB STATE only (station_bays row). It does NOT send
 * a physical machine command — the backend is decoupled from the K9000/Nayax
 * hardware controller. Setting a status here marks intended availability, it
 * does not power-cycle or drain the machine.
 *
 * Hebrew-first, RTL. Brand: pure white / black / metallic gold (#D4AF37).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Power, PlayCircle, AlertTriangle, CheckCircle2, Link2,
  Loader2, RefreshCw, X, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const GOLD = "#D4AF37";

// ── Types ──────────────────────────────────────────────────────────────────
interface Bay {
  id: string;
  stationId: string;
  stationCode: string | null;
  side: string;
  bayLabel: string | null;
  bayLabelHe: string | null;
  status: string;
  nayaxTerminalId: string | null;
  nayaxQrReaderId: string | null;
  lastFaultCode: string | null;
  lastFaultAt: string | null;
  lastHeartbeat: string | null;
  currentSessionId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDatetime(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("he-IL"); } catch { return iso; }
}

const SIDE_HE: Record<string, string> = { left: "שמאל", right: "ימין" };

const STATUS_HE: Record<string, string> = {
  ready: "פנוי",
  busy: "בשימוש",
  cleanup: "ניקוי",
  fault: "תקלה",
  maintenance: "תחזוקה",
  offline: "מנותק",
};

function statusBadge(status: string) {
  // ready=green, maintenance/offline=grey, fault=red, busy=amber, cleanup=amber
  const map: Record<string, string> = {
    ready: "bg-green-100 text-green-700 border-green-200",
    busy: "bg-amber-100 text-amber-700 border-amber-200",
    cleanup: "bg-amber-100 text-amber-700 border-amber-200",
    fault: "bg-red-100 text-red-700 border-red-200",
    maintenance: "bg-gray-100 text-gray-600 border-gray-200",
    offline: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return map[status] || "bg-gray-100 text-gray-600 border-gray-200";
}

// ── Reason / confirm modal ─────────────────────────────────────────────────
type ModalKind =
  | { kind: "status"; bay: Bay; status: "maintenance" | "offline" | "ready" }
  | { kind: "fault"; bay: Bay }
  | { kind: "clear-fault"; bay: Bay }
  | { kind: "nayax"; bay: Bay }
  | null;

export default function AdminBayControl() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<ModalKind>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ ok: boolean; bays: Bay[] }>({
    queryKey: ["/api/admin/bay-control"],
    queryFn: () => apiRequest("GET", "/api/admin/bay-control").then((r) => r.json()),
  });

  const bays = data?.bays ?? [];

  // Group bays by station.
  const grouped = useMemo(() => {
    const m = new Map<string, { code: string; bays: Bay[] }>();
    for (const b of bays) {
      const key = b.stationCode || b.stationId;
      if (!m.has(key)) m.set(key, { code: b.stationCode || b.stationId, bays: [] });
      m.get(key)!.bays.push(b);
    }
    return Array.from(m.values());
  }, [bays]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/bay-control"] });

  // ── Mutations ────────────────────────────────────────────────────────────
  const statusMut = useMutation({
    mutationFn: (p: { bayId: string; status: string; reason: string }) =>
      apiRequest("PATCH", `/api/admin/bay-control/${p.bayId}/status`, { status: p.status, reason: p.reason }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "סטטוס עודכן" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const faultMut = useMutation({
    mutationFn: (p: { bayId: string; faultCode: string; note?: string }) =>
      apiRequest("POST", `/api/admin/bay-control/${p.bayId}/fault`, { faultCode: p.faultCode, note: p.note }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "תקלה נפתחה" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const clearFaultMut = useMutation({
    mutationFn: (p: { bayId: string; reason: string }) =>
      apiRequest("POST", `/api/admin/bay-control/${p.bayId}/clear-fault`, { reason: p.reason }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "תקלה נסגרה — התא בתחזוקה" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const nayaxMut = useMutation({
    mutationFn: (p: { bayId: string; nayaxTerminalId: string; nayaxQrReaderId: string }) =>
      apiRequest("PATCH", `/api/admin/bay-control/${p.bayId}/nayax`, {
        nayaxTerminalId: p.nayaxTerminalId,
        nayaxQrReaderId: p.nayaxQrReaderId,
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "שגיאה");
        return r.json();
      }),
    onSuccess: () => { toast({ title: "מסוף Nayax עודכן" }); setModal(null); invalidate(); },
    onError: (e: any) => toast({ title: "פעולה נכשלה", description: String(e?.message || e), variant: "destructive" }),
  });

  const anyPending = statusMut.isPending || faultMut.isPending || clearFaultMut.isPending || nayaxMut.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="min-h-screen bg-white text-black px-4 py-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6" style={{ color: GOLD }} />
              בקרת תאים (שמאל/ימין)
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              דגל תפעולי בלבד — לא פקודת חומרה למכונה.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            רענן
          </Button>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin ml-2" /> טוען תאים…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-600">
            <ShieldAlert className="w-8 h-8 mb-2" />
            שגיאה בטעינת התאים.
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>נסה שוב</Button>
          </div>
        ) : bays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Wrench className="w-8 h-8 mb-2" />
            אין תאים רשומים.
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((station) => (
              <div key={station.code} className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold flex items-center gap-2">
                  <span style={{ color: GOLD }}>●</span> תחנה: {station.code}
                </div>

                {/* Desktop table / mobile cards */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm hidden md:table">
                    <thead>
                      <tr className="text-right text-gray-500 border-b border-gray-100">
                        <th className="px-3 py-2 font-medium">צד</th>
                        <th className="px-3 py-2 font-medium">סטטוס</th>
                        <th className="px-3 py-2 font-medium">מסוף Nayax</th>
                        <th className="px-3 py-2 font-medium">קורא QR</th>
                        <th className="px-3 py-2 font-medium">תקלה אחרונה</th>
                        <th className="px-3 py-2 font-medium">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {station.bays.map((b) => (
                        <tr key={b.id} className="border-b border-gray-50 align-top">
                          <td className="px-3 py-3 font-medium">
                            {SIDE_HE[b.side] || b.side}
                            <div className="text-xs text-gray-400">{b.bayLabelHe || b.bayLabel}</div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-block text-xs px-2 py-1 rounded-full border ${statusBadge(b.status)}`}>
                              {STATUS_HE[b.status] || b.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs">{b.nayaxTerminalId || "—"}</td>
                          <td className="px-3 py-3 font-mono text-xs">{b.nayaxQrReaderId || "—"}</td>
                          <td className="px-3 py-3 text-xs">
                            {b.lastFaultCode ? (
                              <span className="text-red-600">
                                {b.lastFaultCode}
                                <div className="text-gray-400">{fmtDatetime(b.lastFaultAt)}</div>
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <BayActions bay={b} onAction={setModal} disabled={anyPending} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {station.bays.map((b) => (
                      <div key={b.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{SIDE_HE[b.side] || b.side}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(b.status)}`}>
                            {STATUS_HE[b.status] || b.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">מסוף Nayax: <span className="font-mono">{b.nayaxTerminalId || "—"}</span></div>
                        <div className="text-xs text-gray-500">קורא QR: <span className="font-mono">{b.nayaxQrReaderId || "—"}</span></div>
                        {b.lastFaultCode && (
                          <div className="text-xs text-red-600">תקלה: {b.lastFaultCode} ({fmtDatetime(b.lastFaultAt)})</div>
                        )}
                        <BayActions bay={b} onAction={setModal} disabled={anyPending} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <ActionModal
          modal={modal}
          onClose={() => setModal(null)}
          pending={anyPending}
          onSubmitStatus={(reason) => modal.kind === "status" && statusMut.mutate({ bayId: modal.bay.id, status: modal.status, reason })}
          onSubmitFault={(faultCode, note) => modal.kind === "fault" && faultMut.mutate({ bayId: modal.bay.id, faultCode, note })}
          onSubmitClearFault={(reason) => modal.kind === "clear-fault" && clearFaultMut.mutate({ bayId: modal.bay.id, reason })}
          onSubmitNayax={(terminal, qr) => modal.kind === "nayax" && nayaxMut.mutate({ bayId: modal.bay.id, nayaxTerminalId: terminal, nayaxQrReaderId: qr })}
        />
      )}
    </div>
  );
}

// ── Per-bay action buttons ──────────────────────────────────────────────────
function BayActions({ bay, onAction, disabled }: { bay: Bay; onAction: (m: ModalKind) => void; disabled: boolean }) {
  const busy = bay.status === "busy" || bay.status === "cleanup";
  const isFault = bay.status === "fault";
  return (
    <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || busy || bay.status === "maintenance"}
        onClick={() => onAction({ kind: "status", bay, status: "maintenance" })}>
        <Wrench className="w-3.5 h-3.5" /> השבת
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || busy || bay.status === "offline"}
        onClick={() => onAction({ kind: "status", bay, status: "offline" })}>
        <Power className="w-3.5 h-3.5" /> נתק
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || busy || isFault || bay.status === "ready"}
        onClick={() => onAction({ kind: "status", bay, status: "ready" })}>
        <PlayCircle className="w-3.5 h-3.5" /> הפעל
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs text-red-600 border-red-200"
        disabled={disabled || busy || isFault}
        onClick={() => onAction({ kind: "fault", bay })}>
        <AlertTriangle className="w-3.5 h-3.5" /> פתח תקלה
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled || !isFault}
        onClick={() => onAction({ kind: "clear-fault", bay })}>
        <CheckCircle2 className="w-3.5 h-3.5" /> סגור תקלה
      </Button>
      <Button size="sm" variant="outline" className="gap-1 text-xs"
        disabled={disabled}
        onClick={() => onAction({ kind: "nayax", bay })}>
        <Link2 className="w-3.5 h-3.5" /> קישור מסוף
      </Button>
    </div>
  );
}

// ── Action modal ────────────────────────────────────────────────────────────
function ActionModal({
  modal, onClose, pending,
  onSubmitStatus, onSubmitFault, onSubmitClearFault, onSubmitNayax,
}: {
  modal: NonNullable<ModalKind>;
  onClose: () => void;
  pending: boolean;
  onSubmitStatus: (reason: string) => void;
  onSubmitFault: (faultCode: string, note?: string) => void;
  onSubmitClearFault: (reason: string) => void;
  onSubmitNayax: (terminal: string, qr: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [note, setNote] = useState("");
  const [terminal, setTerminal] = useState(modal.bay.nayaxTerminalId ?? "");
  const [qr, setQr] = useState(modal.bay.nayaxQrReaderId ?? "");

  const sideLabel = `${SIDE_HE[modal.bay.side] || modal.bay.side} · ${modal.bay.stationCode || modal.bay.stationId}`;

  const titles: Record<string, string> = {
    status: "שינוי סטטוס תא",
    fault: "פתיחת תקלה",
    "clear-fault": "סגירת תקלה",
    nayax: "קישור מסוף Nayax",
  };

  const statusVerb: Record<string, string> = {
    maintenance: "השבתה (תחזוקה)",
    offline: "ניתוק (מנותק)",
    ready: "הפעלה (פנוי)",
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">{titles[modal.kind]}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">תא: {sideLabel}</p>

        {modal.kind === "status" && (
          <>
            <p className="text-sm mb-3">
              פעולה: <b>{statusVerb[modal.status]}</b>
              <span className="block text-xs text-gray-400 mt-1">דגל תפעולי — אינו פקודת חומרה למכונה.</span>
            </p>
            <label className="text-xs font-medium">סיבה (חובה)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="לדוגמה: תחזוקה מתוכננת" className="mt-1 mb-4" />
            <ModalButtons pending={pending} disabled={!reason.trim()} onClose={onClose} onConfirm={() => onSubmitStatus(reason.trim())} />
          </>
        )}

        {modal.kind === "fault" && (
          <>
            <label className="text-xs font-medium">קוד תקלה (חובה)</label>
            <Input value={faultCode} onChange={(e) => setFaultCode(e.target.value)} placeholder="לדוגמה: E12" className="mt-1 mb-3" />
            <label className="text-xs font-medium">הערה</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="תיאור קצר" className="mt-1 mb-4" />
            <ModalButtons pending={pending} disabled={!faultCode.trim()} destructive onClose={onClose}
              onConfirm={() => onSubmitFault(faultCode.trim(), note.trim() || undefined)} />
          </>
        )}

        {modal.kind === "clear-fault" && (
          <>
            <p className="text-sm mb-3">
              סגירת התקלה תעביר את התא ל<b>תחזוקה</b>. לאחר מכן יש להפעיל ידנית.
            </p>
            <label className="text-xs font-medium">סיבה (חובה)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="לדוגמה: טופל ע״י טכנאי" className="mt-1 mb-4" />
            <ModalButtons pending={pending} disabled={!reason.trim()} onClose={onClose} onConfirm={() => onSubmitClearFault(reason.trim())} />
          </>
        )}

        {modal.kind === "nayax" && (
          <>
            <label className="text-xs font-medium">מזהה מסוף Nayax</label>
            <Input value={terminal} onChange={(e) => setTerminal(e.target.value)} placeholder="ריק = ניתוק" className="mt-1 mb-3 font-mono" />
            <label className="text-xs font-medium">מזהה קורא QR</label>
            <Input value={qr} onChange={(e) => setQr(e.target.value)} placeholder="ריק = ניתוק" className="mt-1 mb-4 font-mono" />
            <ModalButtons pending={pending} disabled={false} onClose={onClose} onConfirm={() => onSubmitNayax(terminal.trim(), qr.trim())} />
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
