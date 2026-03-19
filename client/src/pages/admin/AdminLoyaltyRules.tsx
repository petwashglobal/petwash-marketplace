/**
 * AdminLoyaltyRules — Phase 6.7 Admin Panel
 * Route: /admin/loyalty
 *
 * Tabs:
 *  1. Rules        — view + toggle + inline-edit all loyalty_rules rows
 *  2. Reporting    — conversion funnel, event-type totals, experiment variants
 *  3. Adjustments  — manual grant / deduct for any user with audit note
 *  4. Win-back     — queue summary + recent entries
 *  5. Ledger       — system-wide recent ledger (read-only)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2, BarChart2, Coins, RefreshCw, ClipboardList,
  ToggleLeft, ToggleRight, Loader2, AlertTriangle, ChevronRight, Check,
  TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyRule {
  ruleKey:        string;
  enabled:        boolean;
  rewardIlsCents: number;
  expiryDays:     number | null;
  minBookingIls:  number | null;
  maxUsesPerUser: number | null;
  description:    string | null;
  updatedAt:      string;
}

interface StatsData {
  period: string;
  summary: { totalEarnedCents: number; totalRedeemedCents: number; activeUsers: number };
  eventTotals: { eventType: string; txCount: number; totalCents: number; userCount: number }[];
  ruleClaims:  { ruleKey: string; claims: number }[];
  variantFunnel: { experimentKey: string; variant: string; event: string; cnt: number }[];
}

interface WinbackData {
  statusBreakdown: { trigger: string; status: string; cnt: number }[];
  recent: { id: number; userId: string; trigger: string; status: string;
            scheduledAt: string; sentAt: string | null; convertedAt: string | null; variant: string | null }[];
  conversion: { sent: number; converted: number; suppressed: number };
  variantFunnel: { experimentKey: string; variant: string; event: string; cnt: number }[];
}

interface LedgerEntry {
  id: number;
  userId: string;
  eventType: string;
  amountIlsCents: number;
  balanceAfterCents: number;
  bookingId: number | null;
  note: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ils(cents: number) { return `₪${(Math.abs(cents) / 100).toFixed(2)}`; }
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return iso; }
}
function fmtDatetime(iso: string) {
  try { return new Date(iso).toLocaleString("he-IL"); }
  catch { return iso; }
}
function pct(num: number, den: number) {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  sent:       "bg-blue-100 text-blue-700",
  converted:  "bg-emerald-100 text-emerald-700",
  suppressed: "bg-gray-100 text-gray-500",
};

// ── Tab navigation ───────────────────────────────────────────────────────────

type Tab = "rules" | "reporting" | "adjustments" | "winback" | "ledger";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "rules",       label: "כללים",    icon: Settings2    },
  { id: "reporting",   label: "דיווח",    icon: BarChart2    },
  { id: "adjustments", label: "התאמות",   icon: Coins        },
  { id: "winback",     label: "Win-back", icon: RefreshCw    },
  { id: "ledger",      label: "יומן",     icon: ClipboardList },
];

// ── Rules Tab ─────────────────────────────────────────────────────────────────

function RulesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<LoyaltyRule>>({});

  const { data, isLoading, isError } = useQuery<{ rules: LoyaltyRule[] }>({
    queryKey: ["/api/admin/loyalty/rules"],
    staleTime: 30_000,
  });

  const patchMut = useMutation({
    mutationFn: ({ ruleKey, updates }: { ruleKey: string; updates: Partial<LoyaltyRule> }) =>
      apiRequest("PATCH", `/api/admin/loyalty/rules/${ruleKey}`, updates).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/loyalty/rules"] });
      setEditingKey(null);
      toast({ title: "כלל עודכן בהצלחה" });
    },
    onError: () => toast({ title: "שגיאה בעדכון הכלל", variant: "destructive" }),
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorMsg />;

  const startEdit = (r: LoyaltyRule) => {
    setEditingKey(r.ruleKey);
    setEditValues({
      rewardIlsCents: r.rewardIlsCents,
      expiryDays:     r.expiryDays ?? undefined,
      minBookingIls:  r.minBookingIls ?? undefined,
      maxUsesPerUser: r.maxUsesPerUser ?? undefined,
      description:    r.description ?? "",
    });
  };

  const saveEdit = (ruleKey: string) => {
    const updates: Partial<LoyaltyRule> = { ...editValues };
    patchMut.mutate({ ruleKey, updates });
  };

  return (
    <div className="space-y-3 p-4">
      {data.rules.map((rule) => {
        const isEditing = editingKey === rule.ruleKey;
        return (
          <div key={rule.ruleKey} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => patchMut.mutate({ ruleKey: rule.ruleKey, updates: { enabled: !rule.enabled } })}
                className="text-gray-400 hover:text-[#C5A55A] transition-colors"
                title={rule.enabled ? "Disable rule" : "Enable rule"}
              >
                {rule.enabled
                  ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                  : <ToggleLeft className="w-7 h-7 text-gray-300" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">{rule.ruleKey}</span>
                  <Badge className={`text-[10px] px-2 py-0.5 ${rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {rule.enabled ? "פעיל" : "כבוי"}
                  </Badge>
                  <Badge className="text-[10px] px-2 py-0.5 bg-[#C5A55A]/10 text-[#7A5C1E]">
                    {ils(rule.rewardIlsCents)}
                  </Badge>
                </div>
                {rule.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.description}</p>
                )}
              </div>
              <button
                onClick={() => isEditing ? setEditingKey(null) : startEdit(rule)}
                className="text-xs text-[#C5A55A] font-semibold hover:underline"
              >
                {isEditing ? "ביטול" : "עריכה"}
              </button>
            </div>

            {/* Quick stats row */}
            {!isEditing && (
              <div className="px-4 pb-3 flex gap-4 text-[11px] text-gray-400">
                {rule.expiryDays     && <span>תוקף: {rule.expiryDays} ימים</span>}
                {rule.minBookingIls  && <span>מינימום: ₪{rule.minBookingIls}</span>}
                {rule.maxUsesPerUser && <span>מקסימום שימושים: {rule.maxUsesPerUser}</span>}
                <span className="mr-auto">עודכן: {fmtDate(rule.updatedAt)}</span>
              </div>
            )}

            {/* Inline edit form */}
            {isEditing && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">פרס (אגורות)</label>
                  <Input
                    type="number" min={0}
                    value={editValues.rewardIlsCents ?? ""}
                    onChange={e => setEditValues(v => ({ ...v, rewardIlsCents: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">תוקף (ימים)</label>
                  <Input
                    type="number" min={1} placeholder="ללא הגבלה"
                    value={editValues.expiryDays ?? ""}
                    onChange={e => setEditValues(v => ({ ...v, expiryDays: e.target.value ? parseInt(e.target.value) : null }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">הזמנה מינ' (₪)</label>
                  <Input
                    type="number" min={0} placeholder="ללא"
                    value={editValues.minBookingIls ?? ""}
                    onChange={e => setEditValues(v => ({ ...v, minBookingIls: e.target.value ? parseInt(e.target.value) : null }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">מקס' שימושים</label>
                  <Input
                    type="number" min={1} placeholder="ללא הגבלה"
                    value={editValues.maxUsesPerUser ?? ""}
                    onChange={e => setEditValues(v => ({ ...v, maxUsesPerUser: e.target.value ? parseInt(e.target.value) : null }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-gray-400 mb-1 block">תיאור</label>
                  <Input
                    value={editValues.description ?? ""}
                    onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    className="bg-[#C5A55A] hover:bg-[#8B6914] text-white"
                    onClick={() => saveEdit(rule.ruleKey)}
                    disabled={patchMut.isPending}
                  >
                    {patchMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    <span className="mr-1">שמור</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Reporting Tab ─────────────────────────────────────────────────────────────

function ReportingTab() {
  const { data, isLoading, isError } = useQuery<StatsData>({
    queryKey: ["/api/admin/loyalty/stats"],
    staleTime: 60_000,
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorMsg />;

  const { summary, eventTotals, ruleClaims, variantFunnel } = data;
  const redemptionRate = summary.totalEarnedCents
    ? (summary.totalRedeemedCents / summary.totalEarnedCents * 100).toFixed(1)
    : "0";

  // Group variant funnel by experimentKey
  const experiments = Array.from(new Set(variantFunnel.map(v => v.experimentKey)));

  return (
    <div className="p-4 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          label="נצבר (90י׳)" value={ils(summary.totalEarnedCents)} />
        <KpiCard icon={<TrendingDown className="w-4 h-4 text-[#C5A55A]" />}
          label="מומש (90י׳)" value={ils(summary.totalRedeemedCents)} />
        <KpiCard icon={<Users className="w-4 h-4 text-blue-500" />}
          label="משתמשים פעילים" value={String(summary.activeUsers)} />
        <KpiCard icon={<ArrowUpRight className="w-4 h-4 text-purple-500" />}
          label="אחוז מימוש" value={`${redemptionRate}%`} />
      </div>

      {/* Event type table */}
      <SectionCard title="פעילות לפי סוג אירוע">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-50">
              <th className="text-right py-2 font-semibold">סוג</th>
              <th className="text-center py-2 font-semibold">עסקאות</th>
              <th className="text-center py-2 font-semibold">משתמשים</th>
              <th className="text-left py-2 font-semibold">סכום</th>
            </tr>
          </thead>
          <tbody>
            {eventTotals.map(e => (
              <tr key={e.eventType} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-700 font-medium">{e.eventType}</td>
                <td className="py-2 text-center text-gray-500">{e.txCount}</td>
                <td className="py-2 text-center text-gray-500">{e.userCount}</td>
                <td className="py-2 text-left text-gray-700">{ils(e.totalCents)}</td>
              </tr>
            ))}
            {eventTotals.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-gray-300">אין נתונים</td></tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      {/* Rule claim counts */}
      {ruleClaims.length > 0 && (
        <SectionCard title="תביעות לפי כלל">
          <div className="space-y-2">
            {ruleClaims.map(r => (
              <div key={r.ruleKey} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1">{r.ruleKey}</span>
                <span className="text-xs font-bold text-[#C5A55A]">{r.claims}</span>
                <div className="h-1.5 rounded-full bg-[#C5A55A]/20 w-20 overflow-hidden">
                  <div
                    className="h-full bg-[#C5A55A] rounded-full"
                    style={{ width: `${Math.min(100, (r.claims / (ruleClaims[0]?.claims || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Experiment variant funnel */}
      {experiments.length > 0 && (
        <SectionCard title="ניסויים A/B — משפך המרה">
          {experiments.map(expKey => {
            const rows = variantFunnel.filter(v => v.experimentKey === expKey);
            const variants = Array.from(new Set(rows.map(v => v.variant)));
            const events   = Array.from(new Set(rows.map(v => v.event)));
            return (
              <div key={expKey} className="mb-4 last:mb-0">
                <p className="text-xs font-bold text-gray-700 mb-2">{expKey}</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-50">
                      <th className="text-right py-1 font-semibold">וריאנט</th>
                      {events.map(ev => <th key={ev} className="text-center py-1 font-semibold">{ev}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map(variant => (
                      <tr key={variant} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-600">{variant}</td>
                        {events.map(ev => {
                          const cell = rows.find(r => r.variant === variant && r.event === ev);
                          return <td key={ev} className="py-1.5 text-center text-gray-700">{cell?.cnt ?? "—"}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </SectionCard>
      )}
    </div>
  );
}

// ── Adjustments Tab ───────────────────────────────────────────────────────────

function AdjustmentsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userId, setUserId]         = useState("");
  const [amount, setAmount]         = useState<number>(0);
  const [reason, setReason]         = useState("");
  const [direction, setDirection]   = useState<"grant" | "deduct">("grant");
  const [lastResult, setLastResult] = useState<any>(null);

  const adjustMut = useMutation({
    mutationFn: (payload: { userId: string; amountCents: number; reason: string }) =>
      apiRequest("POST", "/api/admin/loyalty/adjust", payload).then(r => r.json()),
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ["/api/admin/loyalty/ledger"] });
      toast({ title: "קרדיט עודכן בהצלחה" });
      setUserId(""); setAmount(0); setReason("");
    },
    onError: (err: any) =>
      toast({ title: err?.message || "שגיאה בהתאמת קרדיט", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!userId.trim() || !amount || !reason.trim()) {
      toast({ title: "יש למלא את כל השדות", variant: "destructive" });
      return;
    }
    const amountCents = Math.round(amount * 100) * (direction === "deduct" ? -1 : 1);
    adjustMut.mutate({ userId: userId.trim(), amountCents, reason: reason.trim() });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
        <p className="text-sm font-bold text-gray-800">התאמת קרדיטים ידנית</p>
        <p className="text-xs text-gray-400">
          מוסיף שורה ב-loyalty_ledger ומעדכן את היתרה הנוכחית. הפעולה נרשמת עם שם המנהל.
        </p>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Firebase User ID</label>
          <Input
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="e.g. vdiboz7IrUQEm2RbdO7VZLkBu552"
            className="font-mono text-xs h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">כיוון</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 h-9">
              {(["grant", "deduct"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 text-xs font-semibold transition-all ${
                    direction === d
                      ? d === "grant" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                      : "bg-white text-gray-500"
                  }`}
                >
                  {d === "grant" ? "הענקה" : "קיזוז"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">סכום (₪)</label>
            <Input
              type="number" min={0.01} step={0.01}
              value={amount || ""}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">סיבה (תועד ב-audit trail)</label>
          <Input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. פיצוי על ביטול שגוי"
            className="h-9 text-sm"
          />
        </div>

        <Button
          className="w-full bg-[#C5A55A] hover:bg-[#8B6914] text-white"
          onClick={handleSubmit}
          disabled={adjustMut.isPending}
        >
          {adjustMut.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin ml-2" /> מעבד...</>
            : `${direction === "grant" ? "הענק" : "קזז"} ${amount ? `₪${amount.toFixed(2)}` : ""}`}
        </Button>
      </div>

      {lastResult && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm space-y-2">
          <p className="font-bold text-emerald-700">✓ הפעולה בוצעה</p>
          <p className="text-xs text-gray-600">
            משתמש: {lastResult.targetUser?.email ?? lastResult.targetUser?.id}
          </p>
          <p className="text-xs text-gray-600">
            שינוי: {ils(lastResult.amountCents)} →
            יתרה חדשה: {ils(lastResult.newBalanceCents)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Win-back Tab ──────────────────────────────────────────────────────────────

function WinbackTab() {
  const { data, isLoading, isError } = useQuery<WinbackData>({
    queryKey: ["/api/admin/loyalty/winback"],
    staleTime: 60_000,
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorMsg />;

  const { conversion, statusBreakdown, recent, variantFunnel = [] } = data;
  const conversionRate = conversion.sent
    ? ((conversion.converted / conversion.sent) * 100).toFixed(1)
    : "0";

  // Summary matrix: group by trigger
  const triggers = Array.from(new Set(statusBreakdown.map(r => r.trigger)));
  const statuses  = ["pending", "sent", "converted", "suppressed"];

  return (
    <div className="p-4 space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="נשלחו"    value={String(conversion.sent)}      icon={<ArrowUpRight className="w-4 h-4 text-blue-500" />} />
        <KpiCard label="המירו"    value={String(conversion.converted)} icon={<Check className="w-4 h-4 text-emerald-500" />} />
        <KpiCard label="המרה %"   value={`${conversionRate}%`}         icon={<BarChart2 className="w-4 h-4 text-purple-500" />} />
      </div>

      {/* Status matrix by trigger */}
      <SectionCard title="סטטוס לפי טריגר">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-50">
              <th className="text-right py-1.5 font-semibold">טריגר</th>
              {statuses.map(s => <th key={s} className="text-center py-1.5 font-semibold capitalize">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {triggers.map(trigger => (
              <tr key={trigger} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-700 font-medium">{trigger}</td>
                {statuses.map(status => {
                  const cell = statusBreakdown.find(r => r.trigger === trigger && r.status === status);
                  return <td key={status} className="py-2 text-center text-gray-600">{cell?.cnt ?? "—"}</td>;
                })}
              </tr>
            ))}
            {triggers.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-300">אין נתונים</td></tr>
            )}
          </tbody>
        </table>
      </SectionCard>

      {/* Experiment variant funnel */}
      {variantFunnel.length > 0 && (() => {
        const FUNNEL_STEPS = ['notification_sent', 'opened', 'clicked', 'rebook_started', 'completed'] as const;
        const STEP_LABEL: Record<string, string> = {
          notification_sent: 'נשלח', opened: 'נפתח', clicked: 'נלחץ',
          rebook_started: 'התחיל הזמנה', completed: 'הושלם',
        };
        const VARIANT_LABEL: Record<string, string> = { ctrl: 'בקרה', v1: 'V1 דחיפות', v2: 'V2 הוכחה חברתית' };

        // Group by experimentKey
        const expKeys = Array.from(new Set(variantFunnel.map(r => r.experimentKey)));
        return (
          <SectionCard title="ניסויי A/B — משפך ווין-בק">
            {expKeys.map(expKey => {
              const rows = variantFunnel.filter(r => r.experimentKey === expKey);
              const variants = Array.from(new Set(rows.map(r => r.variant)));

              // Count per (variant, event)
              function cnt(variant: string, event: string) {
                return rows.find(r => r.variant === variant && r.event === event)?.cnt ?? 0;
              }

              // Find winner by completed/notification_sent rate
              let winnerVariant = '';
              let bestRate = -1;
              for (const v of variants) {
                const sent = cnt(v, 'notification_sent');
                const done = cnt(v, 'completed');
                const rate = sent > 0 ? done / sent : 0;
                if (rate > bestRate) { bestRate = rate; winnerVariant = v; }
              }

              return (
                <div key={expKey} className="mb-5 last:mb-0">
                  <p className="text-xs font-bold text-gray-700 mb-3">{expKey}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-100">
                          <th className="text-right py-1.5 font-semibold pr-2">וריאנט</th>
                          {FUNNEL_STEPS.map(s => (
                            <th key={s} className="text-center py-1.5 font-semibold">{STEP_LABEL[s]}</th>
                          ))}
                          <th className="text-center py-1.5 font-semibold text-purple-500">המרה %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map(variant => {
                          const sent = cnt(variant, 'notification_sent');
                          const done = cnt(variant, 'completed');
                          const rate = sent > 0 ? ((done / sent) * 100).toFixed(1) : '—';
                          const isWinner = variant === winnerVariant && bestRate > 0;
                          return (
                            <tr key={variant} className={`border-b border-gray-50 last:border-0 ${isWinner ? 'bg-emerald-50/50' : ''}`}>
                              <td className="py-2 pr-2 font-medium text-gray-700 whitespace-nowrap">
                                {VARIANT_LABEL[variant] ?? variant}
                                {isWinner && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                    ★ מנצח
                                  </span>
                                )}
                              </td>
                              {FUNNEL_STEPS.map(step => {
                                const c = cnt(variant, step);
                                const prev = step === 'notification_sent' ? null : cnt(variant, FUNNEL_STEPS[FUNNEL_STEPS.indexOf(step) - 1]);
                                const pct  = prev && prev > 0 ? ` (${((c / prev) * 100).toFixed(0)}%)` : '';
                                return (
                                  <td key={step} className="py-2 text-center text-gray-600">
                                    {c > 0 ? <>{c}<span className="text-gray-300 text-[9px]">{pct}</span></> : '—'}
                                  </td>
                                );
                              })}
                              <td className={`py-2 text-center font-bold ${isWinner ? 'text-emerald-600' : 'text-gray-500'}`}>
                                {rate}{rate !== '—' ? '%' : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        );
      })()}

      {/* Recent entries */}
      <SectionCard title="רשומות אחרונות (50)">
        <div className="space-y-2">
          {recent.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
              <Badge className={`text-[10px] px-2 py-0.5 shrink-0 ${STATUS_COLOR[entry.status] ?? "bg-gray-100 text-gray-500"}`}>
                {entry.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 truncate">{entry.userId}</p>
                <p className="text-[11px] text-gray-400">
                  {entry.trigger} • מתוזמן: {fmtDate(entry.scheduledAt)}
                  {entry.sentAt && ` • נשלח: ${fmtDate(entry.sentAt)}`}
                  {entry.convertedAt && ` • המיר: ${fmtDate(entry.convertedAt)}`}
                </p>
              </div>
              {entry.variant && <span className="text-[10px] text-gray-300 shrink-0">{entry.variant}</span>}
            </div>
          ))}
          {recent.length === 0 && <p className="text-xs text-gray-300 text-center py-4">תור ריק</p>}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Ledger Tab ────────────────────────────────────────────────────────────────

function LedgerTab() {
  const { data, isLoading, isError, refetch } = useQuery<{ entries: LedgerEntry[] }>({
    queryKey: ["/api/admin/loyalty/ledger"],
    staleTime: 30_000,
  });

  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorMsg />;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">100 פעולות אחרונות</p>
        <button onClick={() => refetch()} className="text-xs text-[#C5A55A] hover:underline">רענן</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
        {data.entries.map(entry => (
          <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
              entry.amountIlsCents > 0 ? "bg-emerald-400" :
              entry.eventType === "redeem" ? "bg-[#C5A55A]" : "bg-gray-300"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  {entry.userName ?? entry.userId.slice(0, 12) + "…"}
                </span>
                <span className={`text-xs font-bold ${
                  entry.amountIlsCents > 0 ? "text-emerald-600" : "text-[#C5A55A]"
                }`}>
                  {entry.amountIlsCents > 0 ? "+" : ""}{ils(entry.amountIlsCents)}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                {entry.eventType} • {entry.userEmail ?? entry.userId}
              </p>
              {entry.note && (
                <p className="text-[11px] text-gray-300 truncate">
                  {entry.note.replace(/\[fp:[^\]]+\]/g, "").trim()}
                </p>
              )}
              <p className="text-[10px] text-gray-200 mt-0.5">
                {fmtDatetime(entry.createdAt)} • יתרה: {ils(entry.balanceAfterCents)}
              </p>
            </div>
          </div>
        ))}
        {data.entries.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-8">אין פעולות</p>
        )}
      </div>
    </div>
  );
}

// ── Shared micro-components ───────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12 text-gray-300">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

function ErrorMsg() {
  return (
    <div className="flex items-center gap-2 p-6 text-red-500 text-sm">
      <AlertTriangle className="w-4 h-4" /> שגיאה בטעינת הנתונים
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[11px] text-gray-400">{label}</span></div>
      <p className="text-base font-extrabold text-gray-800">{value}</p>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-bold text-gray-700 mb-3">{title}</p>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminLoyaltyRules() {
  const [tab, setTab] = useState<Tab>("rules");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-4">
          <Coins className="w-5 h-5 text-[#C5A55A]" />
          <h1 className="text-base font-bold text-gray-900">ניהול קרדיטי נאמנות</h1>
          <span className="mr-auto text-[10px] text-gray-300">Admin 6.7</span>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto border-t border-gray-50">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold shrink-0 border-b-2 transition-colors ${
                tab === id
                  ? "border-[#C5A55A] text-[#C5A55A]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pb-12">
        {tab === "rules"       && <RulesTab />}
        {tab === "reporting"   && <ReportingTab />}
        {tab === "adjustments" && <AdjustmentsTab />}
        {tab === "winback"     && <WinbackTab />}
        {tab === "ledger"      && <LedgerTab />}
      </div>
    </div>
  );
}
