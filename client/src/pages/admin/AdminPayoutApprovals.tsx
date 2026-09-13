/**
 * AdminPayoutApprovals — תשלומים לספקים ממתינים לאישור
 * Route: /admin/payout-approvals
 *
 * CEO rule (2026-09-13): provider money is released ONLY when a Pet Wash admin
 * presses Yes, after cross-examining the job. Each card shows the held amount,
 * the evidence verdict and every finding. Approving needs a written reason; a
 * BLOCKED job additionally needs an explicit override and 20+ characters.
 *
 * Hebrew-first, RTL. Brand: white / black / gold #D4AF37.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, AlertOctagon, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FINDING_HE, VERDICT_HE } from "./payoutApprovalCopy";

const GOLD = "#D4AF37";

type Verdict = "clear" | "review" | "blocked";
interface Finding { code: string; severity: "block" | "warn"; detail: string }
interface Evidence {
  verdict: Verdict;
  kind: "walk" | "booking_request";
  findings: Finding[];
  measured: { gpsPoints: number; gpsDistanceMeters: number | null; gpsSpanMinutes: number | null; checkInDistanceMeters: number | null; maxSpeedKmh: number | null };
}
interface Item {
  escrowId: string;
  bookingId: string | null;
  providerId: string | null;
  amountIls: number;
  providerPayoutIls: number | null;
  holdUntil: string | null;
  holdEnded: boolean;
  evidence: Evidence | null;
}

const VERDICT_UI: Record<Verdict | "none", { he: string; color: string; Icon: typeof CheckCircle2 }> = {
  clear: { he: VERDICT_HE.clear, color: "#15803d", Icon: CheckCircle2 },
  review: { he: VERDICT_HE.review, color: "#b45309", Icon: AlertTriangle },
  blocked: { he: VERDICT_HE.blocked, color: "#b91c1c", Icon: AlertOctagon },
  none: { he: VERDICT_HE.none, color: "#6b7280", Icon: AlertTriangle },
};

function ApproveBox({ item, onDone }: { item: Item; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const blocked = item.evidence?.verdict === "blocked";
  const canSubmit = reason.trim().length > 0 && (!blocked || (override && reason.trim().length >= 20));

  const approve = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/escrow/admin/${encodeURIComponent(item.escrowId)}/approve-release`, {
        reason: reason.trim(),
        ...(blocked ? { overrideBlocked: override } : {}),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "התשלום אושר", description: `₪${item.amountIls.toFixed(2)} שוחרר לאחר בדיקתך.` });
      onDone();
    },
    onError: (err: any) => {
      const code = err?.body?.error;
      const description = code === "PAYOUT_HELD_GATE"
        ? `שער התשלום עצר את השחרור (${err?.body?.reason ?? "gate"}).`
        : code === "EVIDENCE_BLOCKED"
          ? "הראיות חוסמות. סמנו עקיפה וכתבו נימוק של 20 תווים לפחות."
          : "האישור נכשל.";
      toast({ variant: "destructive", title: "לא אושר", description });
    },
  });

  return (
    <div className="mt-4 rounded-xl border border-gray-200 p-3" data-testid={`approve-box-${item.escrowId}`}>
      <label className="block text-sm text-gray-700">
        מה בדקת לפני האישור?
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={2}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          data-testid={`approve-reason-${item.escrowId}`}
        />
      </label>
      {blocked && (
        <label className="mt-2 flex items-start gap-2 text-sm text-red-700">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-1 h-5 w-5" data-testid={`approve-override-${item.escrowId}`} />
          <span>אני מאשר/ת לעקוף את החסימה על אחריותי (נדרש נימוק של 20 תווים לפחות).</span>
        </label>
      )}
      <Button
        onClick={() => approve.mutate()}
        disabled={!canSubmit || approve.isPending}
        className="mt-3 w-full rounded-full bg-black py-5 text-base text-white"
        data-testid={`approve-submit-${item.escrowId}`}
      >
        {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `אישור תשלום ₪${item.amountIls.toFixed(2)}`}
      </Button>
    </div>
  );
}

export default function AdminPayoutApprovals() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ ok: boolean; total: number; items: Item[] }>({
    queryKey: ["/api/escrow/admin/awaiting-approval"],
    queryFn: async () => (await apiRequest("GET", "/api/escrow/admin/awaiting-approval")).json(),
  });
  const done = () => { setOpen(null); qc.invalidateQueries({ queryKey: ["/api/escrow/admin/awaiting-approval"] }); };

  return (
    <div className="mx-auto max-w-3xl p-4" dir="rtl" data-testid="admin-payout-approvals">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" style={{ color: GOLD }} /> תשלומים לספקים — ממתינים לאישור
          </h1>
          <p className="mt-1 text-sm text-gray-500" style={{ textAlign: "right" }}>
            כסף לספק משתחרר רק באישור מנהל Pet Wash, אחרי בדיקת הראיות של העבודה.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="rounded-full" data-testid="payout-approvals-refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading && <div className="mt-8 text-gray-500">טוען…</div>}
      {isError && <div className="mt-8 text-red-700">לא ניתן לטעון את הרשימה.</div>}
      {data && data.items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-gray-100 p-6 text-center text-gray-600" data-testid="payout-approvals-empty">
          אין תשלומים שממתינים לאישור.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {data?.items.map((item) => {
          const v = VERDICT_UI[item.evidence?.verdict ?? "none"];
          const expanded = open === item.escrowId;
          return (
            <section key={item.escrowId} className="rounded-2xl border border-gray-100 p-4 shadow-sm" data-testid={`payout-card-${item.escrowId}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-gray-900" dir="ltr" style={{ textAlign: "right" }}>₪{item.amountIls.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 break-all" dir="ltr" style={{ textAlign: "right" }}>
                    {item.bookingId ?? "—"} · {item.holdEnded ? "תקופת ההחזקה הסתיימה" : "עדיין בתקופת החזקה"}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium" style={{ color: v.color, border: `1px solid ${v.color}` }} data-testid={`payout-verdict-${item.escrowId}`}>
                  <v.Icon className="h-4 w-4" /> {v.he}
                </span>
              </div>

              {item.evidence && item.evidence.findings.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {item.evidence.findings.map((f) => (
                    <li key={f.code} className="text-sm" style={{ color: f.severity === "block" ? "#b91c1c" : "#92400e", textAlign: "right" }}>
                      {f.severity === "block" ? "⛔" : "⚠️"} {FINDING_HE[f.code] ?? f.code}
                      <div className="text-xs text-gray-500" dir="ltr" style={{ textAlign: "right" }}>{f.detail}</div>
                    </li>
                  ))}
                </ul>
              )}
              {item.evidence?.kind === "walk" && (
                <div className="mt-2 text-xs text-gray-500" style={{ textAlign: "right" }}>
                  GPS: {item.evidence.measured.gpsPoints} נקודות · {item.evidence.measured.gpsDistanceMeters ?? "—"} מ׳ · {item.evidence.measured.gpsSpanMinutes ?? "—"} דק׳
                </div>
              )}

              <Button variant="outline" onClick={() => setOpen(expanded ? null : item.escrowId)} className="mt-3 rounded-full" data-testid={`payout-open-${item.escrowId}`}>
                {expanded ? "סגירה" : "לאישור התשלום"}
              </Button>
              {expanded && <ApproveBox item={item} onDone={done} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}
