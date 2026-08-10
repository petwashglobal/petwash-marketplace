/**
 * MyPurchases
 * The buyer's own purchase history — wallet top-ups, eGift cards, wash packages,
 * shop orders — read from the canonical `purchases` table via GET /api/user/purchases.
 *
 * Until now this table (the true system-of-record for every sale) had no
 * user-facing list: a member could only see purchases indirectly through their
 * wallet balance or one receipt at a time. This page closes that gap. (2026-08-10)
 *
 * Route: /my-purchases
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight, Receipt, Loader2, AlertTriangle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth } from "@/auth/AuthProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PurchaseItem {
  id: string;
  surface: string;
  productType: string;
  amountCents: number;
  vatCents: number;
  currency: string;
  status: string;
  paymentMethod: string;
  receiptNumber: string | null;
  transactionId: string | null;
  isGift: boolean;
  createdAt: string;
}

interface PurchasesResponse {
  purchases: PurchaseItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatILS(cents: number, currency = "ILS"): string {
  const symbol = currency === "ILS" ? "₪" : "";
  return `${symbol}${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

// Friendly Hebrew label for what was bought, derived from surface + productType.
function purchaseLabel(p: PurchaseItem): string {
  const bySurface: Record<string, string> = {
    wallet_topup: "טעינת ארנק",
    gift_card:    "כרטיס מתנה",
    booking:      "הזמנת שירות",
    shop:         "חנות",
    kiosk:        "עמדת שטיפה",
    franchise_fee:"דמי זכיינות",
  };
  return bySurface[p.surface] || p.productType || p.surface;
}

function purchaseEmoji(surface: string): string {
  const map: Record<string, string> = {
    wallet_topup: "💳",
    gift_card:    "🎁",
    booking:      "📅",
    shop:         "🛍️",
    kiosk:        "🚿",
    franchise_fee:"🏢",
  };
  return map[surface] || "🧾";
}

// Status → pill styling + Hebrew label. Only positive/final states read as "done".
function statusMeta(status: string): { label: string; cls: string } {
  const s = status.toLowerCase();
  if (s === "completed" || s === "paid" || s === "fulfilled" || s === "activated" || s === "succeeded") {
    return { label: "שולם", cls: "bg-emerald-50 text-emerald-700" };
  }
  if (s === "payment_pending" || s === "pending" || s === "processing") {
    return { label: "בהמתנה", cls: "bg-amber-50 text-amber-700" };
  }
  if (s === "refunded" || s === "credited") {
    return { label: "זוכה", cls: "bg-blue-50 text-blue-700" };
  }
  if (s === "failed" || s === "cancelled" || s === "canceled" || s === "voided") {
    return { label: "נכשל", cls: "bg-red-50 text-red-600" };
  }
  return { label: status, cls: "bg-gray-100 text-gray-500" };
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PurchaseRow({ p }: { p: PurchaseItem }) {
  const meta = statusMeta(p.status);
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="w-9 h-9 rounded-full bg-[#D9B84C]/10 flex items-center justify-center shrink-0 mt-0.5 text-base">
        {purchaseEmoji(p.surface)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 truncate">
            {purchaseLabel(p)}
            {p.isGift && <Gift className="w-3.5 h-3.5 text-[#B8932F] shrink-0" />}
          </span>
          <span className="text-sm font-bold text-gray-900 shrink-0">
            {formatILS(p.amountCents, p.currency)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
          <span className="text-[11px] text-gray-300">{formatDate(p.createdAt)}</span>
          {p.receiptNumber && (
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
              <Receipt className="w-3 h-3" /> {p.receiptNumber}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

type Filter = "all" | "wallet_topup" | "gift_card" | "booking";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",          label: "הכל" },
  { id: "wallet_topup", label: "ארנק" },
  { id: "gift_card",    label: "מתנות" },
  { id: "booking",      label: "שירותים" },
];

function applyFilter(items: PurchaseItem[], f: Filter): PurchaseItem[] {
  if (f === "all") return items;
  return items.filter((p) => p.surface === f);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyPurchases() {
  const [, setLocation] = useLocation();
  const { user } = useFirebaseAuth();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const { data, isLoading, isError } = useQuery<PurchasesResponse>({
    queryKey: ["/api/user/purchases"],
    enabled: !!user,
    staleTime: 30_000,
  });

  const items = data?.purchases ?? [];
  const visible = applyFilter(items, activeFilter);
  const totalPaidCents = items
    .filter((p) => ["completed", "paid", "fulfilled", "activated", "succeeded"].includes(p.status.toLowerCase()))
    .reduce((s, p) => s + p.amountCents, 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 p-8">
        <Receipt className="w-12 h-12 text-[#0a0a0a]" />
        <p className="text-gray-600 text-center">יש להתחבר כדי לראות את הרכישות</p>
        <Button onClick={() => setLocation("/signin")} className="bg-[#D9B84C] text-[#0a0a0a]">
          התחברות
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => setLocation(-1 as any)} className="p-1.5 rounded-full hover:bg-gray-50">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 flex-1 text-center">הרכישות שלי</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Total spent */}
        {!isLoading && items.length > 0 && (
          <div className="mx-5 mt-5 rounded-3xl overflow-hidden bg-gradient-to-br from-[#D9B84C] to-[#8B6914] text-white shadow-lg shadow-[#D9B84C]/25">
            <div className="p-5">
              <span className="text-sm font-semibold text-white/80">סך רכישות ששולמו</span>
              <p className="text-4xl font-extrabold tracking-tight mt-2">₪{(totalPaidCents / 100).toFixed(2)}</p>
              <p className="text-xs text-white/70 mt-1">{items.length} רכישות בסך הכל</p>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mx-5 mt-5 flex items-start gap-2 p-4 bg-red-50 rounded-2xl text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            שגיאה בטעינת הרכישות. נסה שוב.
          </div>
        )}

        {/* Filters */}
        {items.length > 0 && (
          <div className="mx-5 mt-5 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  activeFilter === f.id
                    ? "bg-[#D9B84C] text-[#0a0a0a] shadow-sm"
                    : "bg-gray-50 text-gray-500 border border-gray-100"
                }`}
              >
                {f.label}
                {f.id !== "all" && (
                  <span className="mr-1 text-gray-300">({applyFilter(items, f.id).length})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="mt-4 bg-white rounded-3xl mx-5 shadow-sm divide-y divide-gray-50 overflow-hidden border border-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> טוען...
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🧾</div>
              <p className="text-sm text-gray-400">
                {activeFilter === "all" ? "עדיין אין רכישות" : "אין רכישות מסוג זה"}
              </p>
              {activeFilter === "all" && (
                <p className="text-xs text-gray-300 mt-1">טעינת ארנק, כרטיס מתנה או הזמנה יופיעו כאן</p>
              )}
            </div>
          ) : (
            visible.map((p) => <PurchaseRow key={p.id} p={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
