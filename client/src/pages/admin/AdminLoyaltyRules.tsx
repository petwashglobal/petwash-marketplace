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
  Trophy, PauseCircle, PlayCircle, Zap, ShieldCheck, ShieldOff,
  Lock, Unlock, Timer,
} from "lucide-react";
import { QueueHealthCard } from "@/components/loyalty/QueueHealthCard";
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
  armed:          boolean;
  dailySendCap:   number | null;
  updatedAt:      string;
}

interface StatsData {
  period: string;
  summary: { totalEarnedCents: number; totalRedeemedCents: number; activeUsers: number };
  eventTotals: { eventType: string; txCount: number; totalCents: number; userCount: number }[];
  ruleClaims:  { ruleKey: string; claims: number }[];
  variantFunnel: { experimentKey: string; variant: string; event: string; cnt: number }[];
}

interface ChannelStat   { channel: string; today_sent: number; total_sent: number }
interface ChannelConv   { channel: string; sent: number; clicked: number; completed: number }
interface RevenueRow    { channel: string; conversions: number; revenue_ils: number }

interface WinbackData {
  statusBreakdown: { trigger: string; status: string; cnt: number }[];
  recent: { id: number; userId: string; trigger: string; status: string;
            scheduledAt: string; sentAt: string | null; convertedAt: string | null; variant: string | null }[];
  conversion:        { sent: number; converted: number; suppressed: number };
  variantFunnel:     { experimentKey: string; variant: string; channel: string; event: string; cnt: number }[];
  channelStats:      ChannelStat[];
  channelConversion: ChannelConv[];
  revenueByChannel:  RevenueRow[];
  controlSkipped:    number;
}

interface DecisionRow {
  id:                  number;
  experimentKey:       string;
  winnerVariant:       string | null;
  pausedVariants:      string[];
  decidedAt:           string;
  decidedBy:           string;
  confidencePct:       string | null;
  upliftPct:           string | null;
  promotedAt:          string | null;
  promotionLocked:     boolean;
  notes:               string | null;
  updatedAt:           string;
  runtimeDays:         number | null;
  autoPromoteEligible: boolean;
}

interface DecisionsData {
  decisions: DecisionRow[];
  funnel:    { experimentKey: string; variant: string; event: string; cnt: number }[];
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
      armed:          r.armed,
      dailySendCap:   r.dailySendCap ?? undefined,
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
              <div className="px-4 pb-3 flex flex-wrap gap-3 text-[11px] text-gray-400 items-center">
                {rule.armed
                  ? <Badge className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 border-0 gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" /> מחומש
                    </Badge>
                  : <Badge className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-400 border-0 gap-0.5">
                      <ShieldOff className="w-2.5 h-2.5" /> לא מחומש
                    </Badge>
                }
                {rule.dailySendCap   && <span>תקרה/יום: {rule.dailySendCap}</span>}
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
                {/* Phase 6.11 rollout guardrails */}
                <div className="col-span-2 border-t border-gray-50 pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-600">מחומש לשליחות</p>
                    <p className="text-[10px] text-gray-400">המעבד שולח רק אם מחומש</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditValues(v => ({ ...v, armed: !v.armed }))}
                    className="text-gray-400 hover:text-emerald-500 transition-colors"
                  >
                    {editValues.armed
                      ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                      : <ToggleLeft  className="w-7 h-7 text-gray-300" />}
                  </button>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-gray-400 mb-1 block">תקרת שליחות יומית</label>
                  <Input
                    type="number" min={1} placeholder="ללא הגבלה"
                    value={editValues.dailySendCap ?? ""}
                    onChange={e => setEditValues(v => ({ ...v, dailySendCap: e.target.value ? parseInt(e.target.value) : null }))}
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

// ── Experiment Decisions Panel ────────────────────────────────────────────────

const VARIANT_LABEL: Record<string, string> = {
  ctrl: 'בקרה (control)',
  v1:   'V1 — דחיפות',
  v2:   'V2 — הוכחה חברתית',
};
const WINNER_CONFIDENCE = 95;
const MIN_SAMPLE        = 100;

function ConfidenceBar({ value }: { value: number }) {
  const capped  = Math.min(Math.max(value, 0), 100);
  const reached = capped >= WINNER_CONFIDENCE;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-blue-400'}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${reached ? 'text-emerald-600' : 'text-gray-500'}`}>
        {capped.toFixed(1)}%
      </span>
    </div>
  );
}

function ExperimentDecisionsPanel() {
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const QK              = ['/api/admin/loyalty/experiment-decisions'] as const;

  const { data, isLoading, isError } = useQuery<DecisionsData>({
    queryKey: QK,
    staleTime: 30_000,
  });

  const evaluateMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/loyalty/experiment-decisions/evaluate', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: 'הערכה הושלמה', description: 'נתוני הניסוי עודכנו.' });
    },
    onError: () => toast({ title: 'שגיאה', description: 'ההערכה נכשלה.', variant: 'destructive' }),
  });

  const promoteMut = useMutation({
    mutationFn: (experimentKey: string) =>
      apiRequest('POST', '/api/admin/loyalty/experiment-decisions/promote', { experimentKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: 'וריאנט מנצח הוצב!', description: 'כל שליחות עתידיות ישתמשו בוריאנט זה.' });
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e?.message ?? 'קידום נכשל.', variant: 'destructive' }),
  });

  const pauseMut = useMutation({
    mutationFn: ({ experimentKey, variant, paused }: { experimentKey: string; variant: string; paused: boolean }) =>
      apiRequest('POST', '/api/admin/loyalty/experiment-decisions/pause-variant', { experimentKey, variant, paused }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: 'עודכן', description: 'מצב הוריאנט שונה.' });
    },
    onError: () => toast({ title: 'שגיאה', description: 'שינוי מצב נכשל.', variant: 'destructive' }),
  });

  const lockMut = useMutation({
    mutationFn: ({ experimentKey, locked }: { experimentKey: string; locked: boolean }) =>
      apiRequest('POST', '/api/admin/loyalty/experiment-decisions/lock', { experimentKey, locked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast({ title: 'עודכן', description: 'מצב נעילת קידום אוטומטי שונה.' });
    },
    onError: () => toast({ title: 'שגיאה', description: 'שינוי נעילה נכשל.', variant: 'destructive' }),
  });

  if (isLoading) return <div className="py-4 text-center text-xs text-gray-400">טוען החלטות…</div>;
  if (isError || !data) return <div className="py-4 text-center text-xs text-red-400">שגיאה בטעינת החלטות</div>;

  const { decisions, funnel } = data;

  // Helper: count events per (expKey, variant, event)
  function funnelCnt(expKey: string, variant: string, event: string) {
    return funnel.find(r => r.experimentKey === expKey && r.variant === variant && r.event === event)?.cnt ?? 0;
  }

  const EXP_KEYS = ['winback_14d', 'winback_30d', 'winback_60d'];

  return (
    <SectionCard
      title="ניסויי A/B — החלטות סטטיסטיות"
      action={
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 gap-1"
          onClick={() => evaluateMut.mutate()}
          disabled={evaluateMut.isPending}
        >
          {evaluateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          הפעל הערכה
        </Button>
      }
    >
      <div className="space-y-6">
        {EXP_KEYS.map(expKey => {
          const decision  = decisions.find(d => d.experimentKey === expKey);
          const variants  = ['ctrl', 'v1', 'v2'];

          const ctrlSent          = funnelCnt(expKey, 'ctrl', 'notification_sent');
          const hasData           = ctrlSent > 0;
          const isPromoted        = !!decision?.promotedAt;
          const isLocked          = !!decision?.promotionLocked;
          const runtimeDays       = decision?.runtimeDays ?? null;
          const confidencePct     = decision?.confidencePct ? parseFloat(decision.confidencePct) : null;
          const autoPromoteEligible = !!decision?.autoPromoteEligible;
          const isAutoPromoted    = decision?.decidedBy === 'auto-promote' && isPromoted;

          return (
            <div key={expKey}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-700">{expKey}</p>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {isLocked && !isPromoted && (
                    <Badge className="bg-red-50 text-red-500 border-red-100 text-[10px] gap-1">
                      <Lock className="w-2.5 h-2.5" /> נעול
                    </Badge>
                  )}
                  {isPromoted ? (
                    <Badge className={`border-0 text-[10px] gap-1 ${isAutoPromoted ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      <Trophy className="w-2.5 h-2.5" />
                      {VARIANT_LABEL[decision!.winnerVariant ?? ''] ?? decision!.winnerVariant}
                      {isAutoPromoted ? ' — קידום אוטומטי' : ' — מוצב'}
                    </Badge>
                  ) : autoPromoteEligible ? (
                    <Badge className="bg-violet-50 text-violet-600 border-violet-200 text-[10px] gap-1">
                      <Zap className="w-2.5 h-2.5" />
                      זכאי לקידום אוטומטי
                    </Badge>
                  ) : decision?.winnerVariant ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1">
                      <Trophy className="w-2.5 h-2.5" />
                      מנצח זוהה — ממתין לקידום
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-50 text-gray-400 border-0 text-[10px]">בתהליך</Badge>
                  )}
                </div>
              </div>

              {/* Phase 6.14: Auto-promote eligibility progress (only shown when winner exists + not yet promoted) */}
              {decision?.winnerVariant && !isPromoted && (
                <div className="mb-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">קריטריוני קידום אוטומטי</p>

                  {/* Confidence bar: need 97% */}
                  <div>
                    <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                      <span>ביטחון סטטיסטי</span>
                      <span>
                        {confidencePct !== null ? `${confidencePct.toFixed(1)}%` : '—'} / 97%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${(confidencePct ?? 0) >= 97 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(((confidencePct ?? 0) / 97) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Runtime bar: need 14 days */}
                  <div>
                    <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                      <span><Timer className="w-2.5 h-2.5 inline ml-0.5" />זמן ריצה</span>
                      <span>
                        {runtimeDays !== null ? `${runtimeDays} ימים` : '—'} / 14 ימים
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${(runtimeDays ?? 0) >= 14 ? 'bg-emerald-500' : 'bg-blue-400'}`}
                        style={{ width: `${Math.min(((runtimeDays ?? 0) / 14) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!hasData ? (
                <p className="text-xs text-gray-300 italic">אין נתוני ניסוי עדיין</p>
              ) : (
                <div className="space-y-3">
                  {/* Per-variant confidence rows */}
                  {variants.map(variant => {
                    const sent      = funnelCnt(expKey, variant, 'notification_sent');
                    const completed = funnelCnt(expKey, variant, 'completed');
                    const convRate  = sent > 0 ? ((completed / sent) * 100).toFixed(1) : '—';
                    const isPaused  = (decision?.pausedVariants ?? []).includes(variant);
                    const isWinner  = decision?.winnerVariant === variant;

                    // Confidence from decision row (only meaningful for best challenger)
                    const confidencePct = isWinner && decision?.confidencePct
                      ? parseFloat(decision.confidencePct)
                      : variant === 'ctrl' ? null
                      : null;

                    const sampleOk = sent >= MIN_SAMPLE;

                    return (
                      <div
                        key={variant}
                        className={`rounded-xl p-3 border ${
                          isWinner && !isPromoted ? 'border-amber-200 bg-amber-50/40' :
                          isPaused              ? 'border-red-100 bg-red-50/20' :
                                                  'border-gray-100 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">
                              {VARIANT_LABEL[variant] ?? variant}
                            </span>
                            {isWinner && <Trophy className="w-3 h-3 text-amber-500" />}
                            {isPaused && (
                              <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                                מושהה
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            <span>{sent} נשלחו</span>
                            <span>·</span>
                            <span className={`font-bold ${isWinner ? 'text-amber-600' : 'text-gray-600'}`}>
                              {convRate}{convRate !== '—' ? '%' : ''} המרה
                            </span>
                            {!sampleOk && (
                              <span className="text-orange-400">(דגימה קטנה)</span>
                            )}
                          </div>
                        </div>

                        {/* Confidence bar — only for challengers */}
                        {variant !== 'ctrl' && confidencePct !== null && (
                          <ConfidenceBar value={confidencePct} />
                        )}
                        {variant !== 'ctrl' && confidencePct === null && sampleOk && (
                          <div className="text-[10px] text-gray-300 italic">
                            הפעל הערכה לחישוב רמת ביטחון
                          </div>
                        )}

                        {/* Pause / unpause toggle (not for ctrl, not if already promoted) */}
                        {variant !== 'ctrl' && !isPromoted && (
                          <div className="mt-2 flex justify-end">
                            <button
                              className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${
                                isPaused
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-red-500 hover:text-red-600'
                              }`}
                              disabled={pauseMut.isPending}
                              onClick={() => pauseMut.mutate({ experimentKey: expKey, variant, paused: !isPaused })}
                            >
                              {isPaused
                                ? <><PlayCircle className="w-3 h-3" /> הפעל מחדש</>
                                : <><PauseCircle className="w-3 h-3" /> השהה</>
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Winner promotion button + lock toggle */}
                  {decision?.winnerVariant && !isPromoted && (
                    <div className="pt-1 space-y-2">
                      <Button
                        size="sm"
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs h-8 gap-1.5"
                        onClick={() => promoteMut.mutate(expKey)}
                        disabled={promoteMut.isPending}
                      >
                        {promoteMut.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trophy className="w-3.5 h-3.5" />
                        }
                        קדם את {VARIANT_LABEL[decision.winnerVariant] ?? decision.winnerVariant} כוריאנט ברירת מחדל
                      </Button>
                      {decision.confidencePct && decision.upliftPct && (
                        <p className="text-[10px] text-center text-gray-400">
                          ביטחון {parseFloat(decision.confidencePct).toFixed(1)}% ·{' '}
                          עלייה {parseFloat(decision.upliftPct) > 0 ? '+' : ''}{parseFloat(decision.upliftPct).toFixed(1)}% vs בקרה
                        </p>
                      )}
                      {/* Phase 6.14: Lock / unlock auto-promotion */}
                      <button
                        className={`flex items-center justify-center gap-1 w-full text-[10px] font-medium py-1.5 rounded-lg border transition-colors ${
                          isLocked
                            ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            : 'border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50'
                        }`}
                        disabled={lockMut.isPending}
                        onClick={() => lockMut.mutate({ experimentKey: expKey, locked: !isLocked })}
                      >
                        {lockMut.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : isLocked
                            ? <><Unlock className="w-3 h-3" /> בטל נעילת קידום אוטומטי</>
                            : <><Lock className="w-3 h-3" /> נעל קידום אוטומטי</>
                        }
                      </button>
                    </div>
                  )}

                  {isPromoted && (
                    <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                      isAutoPromoted
                        ? 'text-violet-700 bg-violet-50'
                        : 'text-emerald-600 bg-emerald-50'
                    }`}>
                      {isAutoPromoted
                        ? <Zap className="w-3.5 h-3.5 shrink-0" />
                        : <Check className="w-3.5 h-3.5 shrink-0" />
                      }
                      <span>
                        {VARIANT_LABEL[decision!.winnerVariant!] ?? decision!.winnerVariant} מוצב ופעיל
                        {isAutoPromoted ? ' — קודם אוטומטית' : ''} —
                        כל שליחות חדשות ישתמשו בוריאנט זה.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
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
      {/* Phase 6.11 — Queue health + proof-run panel */}
      <QueueHealthCard />

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

      {/* Phase 6.13 — Control Group Indicator */}
      {(data.controlSkipped ?? 0) > 0 && (
        <div className="flex items-center gap-2.5 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-600 font-bold text-[10px] flex-shrink-0">10%</span>
          <div>
            <span className="font-semibold text-violet-700">קבוצת בקרה פעילה</span>
            <span className="text-violet-500 mr-1.5">— {data.controlSkipped} משתמשים לא קיבלו winback (מדידת lift אמיתי)</span>
          </div>
        </div>
      )}

      {/* Phase 6.12 — Channel Performance Table */}
      {(data.channelConversion?.length > 0 || data.channelStats?.length > 0) && (
        <SectionCard title="ביצועים לפי ערוץ">
          {/* Cost & daily usage panel */}
          {data.channelStats?.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {['sms', 'whatsapp'].map(ch => {
                const stat = data.channelStats.find(s => s.channel === ch);
                const cap  = ch === 'sms' ? 50 : 30;
                // Estimated cost: SMS ~$0.045, WhatsApp ~$0.065 per message
                const costPerMsg = ch === 'sms' ? 0.045 : 0.065;
                const todayCost  = ((stat?.today_sent ?? 0) * costPerMsg).toFixed(2);
                const totalCost  = ((stat?.total_sent  ?? 0) * costPerMsg).toFixed(2);
                return (
                  <div key={ch} className="border border-gray-100 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 capitalize">{ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>
                      <span className="text-[10px] text-gray-400">תקרה: {cap}/יום</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(stat?.today_sent ?? 0) >= cap ? 'bg-red-400' : 'bg-blue-400'}`}
                        style={{ width: `${Math.min(((stat?.today_sent ?? 0) / cap) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-gray-500">
                      <span>היום</span>   <span className="text-right font-mono text-gray-700">{stat?.today_sent ?? 0} / {cap}</span>
                      <span>סה״כ</span>   <span className="text-right font-mono text-gray-700">{stat?.total_sent  ?? 0}</span>
                      <span>עלות היום</span> <span className="text-right font-mono text-gray-700">${todayCost}</span>
                      <span>עלות כוללת</span> <span className="text-right font-mono text-gray-700">${totalCost}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Channel conversion table: sent / clicked / completed / CVR */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-right py-1.5 font-semibold">ערוץ</th>
                <th className="text-center py-1.5 font-semibold">נשלח</th>
                <th className="text-center py-1.5 font-semibold">נלחץ</th>
                <th className="text-center py-1.5 font-semibold">הושלם</th>
                <th className="text-center py-1.5 font-semibold text-purple-500">CTR%</th>
                <th className="text-center py-1.5 font-semibold text-emerald-600">המרה%</th>
              </tr>
            </thead>
            <tbody>
              {(['inapp', 'sms', 'whatsapp'] as const).map(ch => {
                const row = data.channelConversion?.find(r => r.channel === ch);
                const sent    = row?.sent      ?? 0;
                const clicked = row?.clicked   ?? 0;
                const done    = row?.completed ?? 0;
                const ctr     = sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}%` : '—';
                const cvr     = sent > 0 ? `${((done   / sent) * 100).toFixed(1)}%` : '—';
                const LABEL: Record<string, string> = { inapp: 'In-App', sms: 'SMS', whatsapp: 'WhatsApp' };
                const DOT: Record<string, string> = {
                  inapp: 'bg-blue-400', sms: 'bg-amber-400', whatsapp: 'bg-emerald-400',
                };
                return (
                  <tr key={ch} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-2 font-medium text-gray-700 flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${DOT[ch]}`} />
                      {LABEL[ch]}
                    </td>
                    <td className="py-2 text-center text-gray-600">{sent  || '—'}</td>
                    <td className="py-2 text-center text-gray-600">{clicked || '—'}</td>
                    <td className="py-2 text-center text-gray-600">{done   || '—'}</td>
                    <td className="py-2 text-center text-blue-600 font-mono">{ctr}</td>
                    <td className="py-2 text-center text-emerald-600 font-mono font-bold">{cvr}</td>
                  </tr>
                );
              })}
              {!data.channelConversion?.length && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-300 text-xs">אין נתוני ערוץ עדיין</td></tr>
              )}
            </tbody>
          </table>
        </SectionCard>
      )}

      {/* Phase 6.13 — Revenue vs Cost ROI Table */}
      {(data.revenueByChannel?.length > 0 || data.channelStats?.length > 0) && (() => {
        const COST_PER_MSG: Record<string, number> = { inapp: 0, sms: 0.045, whatsapp: 0.065 };
        const CHANNELS = ['inapp', 'sms', 'whatsapp'] as const;
        const LABEL: Record<string, string> = { inapp: 'In-App', sms: 'SMS', whatsapp: 'WhatsApp' };
        const DOT: Record<string, string> = {
          inapp: 'bg-blue-400', sms: 'bg-amber-400', whatsapp: 'bg-emerald-400',
        };

        const rows = CHANNELS.map(ch => {
          const rev  = data.revenueByChannel?.find(r => r.channel === ch);
          const stat = data.channelStats?.find(s => s.channel === ch);
          const conversions = rev?.conversions  ?? 0;
          const revenue     = rev?.revenue_ils  ?? 0;
          const totalSent   = stat?.total_sent  ?? 0;
          const cost        = totalSent * COST_PER_MSG[ch];
          const profit      = revenue - cost;
          const roi         = cost > 0 ? ((profit / cost) * 100).toFixed(0) : revenue > 0 ? '∞' : '—';
          return { ch, conversions, revenue, cost, profit, roi };
        });

        const hasAnyData = rows.some(r => r.conversions > 0 || r.cost > 0);
        if (!hasAnyData) return null;

        const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
        const totalCost    = rows.reduce((s, r) => s + r.cost, 0);
        const totalProfit  = totalRevenue - totalCost;

        return (
          <SectionCard title="הכנסות מול עלויות (ROI)">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-right py-1.5 font-semibold">ערוץ</th>
                  <th className="text-center py-1.5 font-semibold">המרות</th>
                  <th className="text-center py-1.5 font-semibold text-emerald-600">הכנסה ₪</th>
                  <th className="text-center py-1.5 font-semibold text-red-400">עלות $</th>
                  <th className="text-center py-1.5 font-semibold text-blue-600">רווח</th>
                  <th className="text-center py-1.5 font-semibold text-purple-500">ROI%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ ch, conversions, revenue, cost, profit, roi }) => (
                  <tr key={ch} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-2 font-medium text-gray-700 flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${DOT[ch]}`} />
                      {LABEL[ch]}
                    </td>
                    <td className="py-2 text-center text-gray-600 font-mono">{conversions || '—'}</td>
                    <td className="py-2 text-center text-emerald-600 font-mono font-medium">
                      {revenue > 0 ? `₪${revenue.toFixed(0)}` : '—'}
                    </td>
                    <td className="py-2 text-center text-red-400 font-mono">
                      {cost > 0 ? `$${cost.toFixed(2)}` : ch === 'inapp' ? 'חינם' : '—'}
                    </td>
                    <td className={`py-2 text-center font-mono font-bold ${profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {revenue > 0 || cost > 0 ? `₪${profit.toFixed(0)}` : '—'}
                    </td>
                    <td className={`py-2 text-center font-bold ${roi === '∞' ? 'text-emerald-500' : roi === '—' ? 'text-gray-300' : Number(roi) >= 0 ? 'text-purple-600' : 'text-red-500'}`}>
                      {roi !== '—' && roi !== '∞' ? `${roi}%` : roi}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 border-t border-gray-200 font-bold text-gray-700">
                  <td className="py-2 pr-2 text-xs">סה״כ</td>
                  <td className="py-2 text-center text-xs font-mono">
                    {rows.reduce((s, r) => s + r.conversions, 0) || '—'}
                  </td>
                  <td className="py-2 text-center text-xs font-mono text-emerald-700">
                    {totalRevenue > 0 ? `₪${totalRevenue.toFixed(0)}` : '—'}
                  </td>
                  <td className="py-2 text-center text-xs font-mono text-red-500">
                    {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '—'}
                  </td>
                  <td className={`py-2 text-center text-xs font-mono ${totalProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                    {totalRevenue > 0 || totalCost > 0 ? `₪${totalProfit.toFixed(0)}` : '—'}
                  </td>
                  <td className="py-2 text-center text-xs font-bold text-purple-700">
                    {totalCost > 0 ? `${((totalProfit / totalCost) * 100).toFixed(0)}%` : totalRevenue > 0 ? '∞' : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-gray-300 text-right">
              עלויות מוערכות: SMS $0.045 / הודעה · WhatsApp $0.065 / הודעה · In-App חינם
            </p>
          </SectionCard>
        );
      })()}

      {/* Statistical decisions + action panel */}
      <ExperimentDecisionsPanel />

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

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-700">{title}</p>
        {action}
      </div>
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
