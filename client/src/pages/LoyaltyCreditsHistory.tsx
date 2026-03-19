/**
 * LoyaltyCreditsHistory
 * Shows the user's full loyalty-credits ledger: balance, pending expiry,
 * and a chronological list of earned / redeemed / expired events.
 *
 * Route: /loyalty/credits
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight, Coins, TrendingUp, TrendingDown, Clock, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth } from "@/auth/AuthProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyBalance {
  balanceCents: number;
  balanceIls: number;
  pendingExpiryCents: number;
  pendingExpiryAt: string | null;
}

interface LedgerEntry {
  id: number;
  eventType: string;
  amountIlsCents: number;
  balanceAfterCents: number;
  note: string | null;
  bookingId: number | null;
  expiresAt: string | null;
  createdAt: string;
}

interface HistoryResponse {
  entries: LedgerEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatILS(cents: number): string {
  const abs = Math.abs(cents);
  return `₪${(abs / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    earn:              "זכייה",
    redeem:            "מימוש",
    expire:            "פקיעה",
    referral_reward:   "בונוס הפניה",
    streak_reward:     "בונוס רצף",
    winback_reward:    "בונוס חזרה",
    admin_grant:       "הענקת ידנית",
    admin_deduct:      "קיזוז ידני",
    booking_2nd:       "הזמנה שנייה",
    booking_same_provider: "בונוס ספק קבוע",
    booking_walk_streak:   "רצף טיולים",
    booking_sit_streak:    "רצף שמירות",
    winback_reset:         "חזרת לקוח",
  };
  return map[eventType] ?? eventType;
}

interface EventMeta {
  icon: string;
  color: string;
  sign: "positive" | "negative" | "neutral";
}

function eventMeta(eventType: string, amountCents: number): EventMeta {
  if (amountCents > 0) return { icon: "✦", color: "text-emerald-600", sign: "positive" };
  if (eventType === "redeem") return { icon: "🛒", color: "text-[#C5A55A]", sign: "negative" };
  if (eventType === "expire") return { icon: "⏰", color: "text-gray-400", sign: "negative" };
  return { icon: "●", color: "text-gray-400", sign: "neutral" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BalanceCard({ balance }: { balance: LoyaltyBalance }) {
  return (
    <div className="mx-5 mt-5 rounded-3xl overflow-hidden bg-gradient-to-br from-[#C5A55A] to-[#8B6914] text-white shadow-lg shadow-[#C5A55A]/25">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-white/80" />
          <span className="text-sm font-semibold text-white/80">קרדיטים זמינים</span>
        </div>
        <p className="text-4xl font-extrabold tracking-tight">
          ₪{(balance.balanceCents / 100).toFixed(2)}
        </p>
        {balance.pendingExpiryCents > 0 && balance.pendingExpiryAt && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-white/75 bg-white/15 rounded-xl px-3 py-2">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {formatILS(balance.pendingExpiryCents)} פגים ב-{formatDate(balance.pendingExpiryAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: LedgerEntry }) {
  const meta = eventMeta(entry.eventType, entry.amountIlsCents);
  const isPositive = entry.amountIlsCents > 0;
  const displayNote = entry.note?.replace(/\[fp:[^\]]+\]/g, "").trim() || null;

  return (
    <div className="flex items-start gap-3 px-5 py-4">
      {/* Icon dot */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-base
        ${isPositive ? "bg-emerald-50" : entry.eventType === "redeem" ? "bg-[#C5A55A]/10" : "bg-gray-100"}`}>
        {meta.icon}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900">{eventLabel(entry.eventType)}</span>
          <span className={`text-sm font-bold shrink-0 ${
            isPositive ? "text-emerald-600" : entry.eventType === "expire" ? "text-gray-400" : "text-[#C5A55A]"
          }`}>
            {isPositive ? "+" : "-"}{formatILS(entry.amountIlsCents)}
          </span>
        </div>
        {displayNote && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{displayNote}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-gray-300">{formatDate(entry.createdAt)}</span>
          <span className="text-[11px] text-gray-300">יתרה: {formatILS(entry.balanceAfterCents)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Type-filter tab ───────────────────────────────────────────────────────────

type Filter = "all" | "earned" | "redeemed" | "expired";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",      label: "הכל" },
  { id: "earned",   label: "שנצברו" },
  { id: "redeemed", label: "שמומשו" },
  { id: "expired",  label: "שפגו" },
];

function filterEntries(entries: LedgerEntry[], filter: Filter): LedgerEntry[] {
  if (filter === "all") return entries;
  if (filter === "earned")   return entries.filter(e => e.amountIlsCents > 0);
  if (filter === "redeemed") return entries.filter(e => e.eventType === "redeem");
  if (filter === "expired")  return entries.filter(e => e.eventType === "expire");
  return entries;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoyaltyCreditsHistory() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const {
    data: balance,
    isLoading: balanceLoading,
  } = useQuery<LoyaltyBalance>({
    queryKey: ["/api/loyalty-credits/balance"],
    enabled: !!user,
    staleTime: 30_000,
  });

  const {
    data: history,
    isLoading: historyLoading,
    isError,
  } = useQuery<HistoryResponse>({
    queryKey: ["/api/loyalty-credits/history"],
    enabled: !!user,
    staleTime: 30_000,
  });

  const entries = history?.entries ?? [];
  const visible = filterEntries(entries, activeFilter);

  const loading = balanceLoading || historyLoading;

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 p-8">
        <Coins className="w-12 h-12 text-[#C5A55A]" />
        <p className="text-gray-600 text-center">יש להתחבר כדי לראות את הקרדיטים</p>
        <Button onClick={() => setLocation("/signin")} className="bg-[#C5A55A] text-white">
          התחברות
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => setLocation(-1 as any)} className="p-1.5 rounded-full hover:bg-gray-100">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 flex-1 text-center">קרדיטים ומועדון</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── Balance card ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="mx-5 mt-5 h-36 rounded-3xl bg-gray-100 animate-pulse" />
        ) : balance ? (
          <BalanceCard balance={balance} />
        ) : null}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {isError && (
          <div className="mx-5 mt-5 flex items-start gap-2 p-4 bg-red-50 rounded-2xl text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            שגיאה בטעינת ההיסטוריה. נסה שוב.
          </div>
        )}

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-gray-400">נצברו</span>
              </div>
              <p className="text-lg font-bold text-emerald-600">
                {formatILS(entries.filter(e => e.amountIlsCents > 0).reduce((s, e) => s + e.amountIlsCents, 0))}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-[#C5A55A]" />
                <span className="text-xs text-gray-400">מומשו</span>
              </div>
              <p className="text-lg font-bold text-[#C5A55A]">
                {formatILS(Math.abs(entries.filter(e => e.eventType === "redeem").reduce((s, e) => s + e.amountIlsCents, 0)))}
              </p>
            </div>
          </div>
        )}

        {/* ── Filter tabs ────────────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="mx-5 mt-5 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  activeFilter === f.id
                    ? "bg-[#C5A55A] text-white shadow-sm"
                    : "bg-white text-gray-500 border border-gray-100"
                }`}
              >
                {f.label}
                {f.id !== "all" && (
                  <span className={`mr-1 ${activeFilter === f.id ? "text-white/75" : "text-gray-300"}`}>
                    ({filterEntries(entries, f.id).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Ledger list ────────────────────────────────────────────────── */}
        <div className="mt-4 bg-white rounded-3xl mx-5 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> טוען...
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🪙</div>
              <p className="text-sm text-gray-400">
                {activeFilter === "all" ? "עדיין אין פעילות קרדיטים" : "אין פעילות מסוג זה"}
              </p>
              {activeFilter === "all" && (
                <p className="text-xs text-gray-300 mt-1">
                  השלם הזמנות כדי לצבור קרדיטים
                </p>
              )}
            </div>
          ) : (
            visible.map(entry => (
              <EntryRow key={entry.id} entry={entry} />
            ))
          )}
        </div>

        {/* ── Explanation footer ─────────────────────────────────────────── */}
        <div className="mx-5 mt-4 mb-6 p-4 bg-[#C5A55A]/5 rounded-2xl border border-[#C5A55A]/15">
          <p className="text-xs font-bold text-[#7A5C1E] mb-2">איך זה עובד?</p>
          <ul className="text-xs text-[#8B6914] space-y-1.5 list-none">
            <li>✦ צבור קרדיטים על כל הזמנה שהושלמה</li>
            <li>✦ בונוסים על רצפי הזמנות ואצל אותו ספק</li>
            <li>✦ ממש עד 50% מסכום הזמנה (מינימום ₪10)</li>
            <li>✦ קרדיטים תקפים 12 חודשים</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

