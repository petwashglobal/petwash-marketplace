/**
 * LoyaltyWalletCard — compact balance card for dashboard/profile embeds.
 * Uses /api/loyalty-credits/summary to avoid an extra network call when
 * the parent has already fetched summary data.
 *
 * Props:
 *   data   — summary data if parent already fetched it (avoids double-fetch)
 *   compact — show a smaller 1-row version (for booking list headers etc.)
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Coins, Clock, ChevronLeft } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

interface BalanceSummary {
  cents:              number;
  ils:                string;
  pendingExpiryCents: number;
  pendingExpiryAt:    string | null;
}

interface SummaryData {
  balance: BalanceSummary;
}

interface Props {
  data?:    SummaryData;
  compact?: boolean;
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  } catch { return iso; }
}

export function LoyaltyWalletCard({ data: propData, compact = false }: Props) {
  const { user } = useFirebaseAuth();

  const { data: fetchedData, isLoading } = useQuery<SummaryData>({
    queryKey: ["/api/loyalty-credits/summary"],
    enabled:  !!user && !propData,
    staleTime: 60_000,
  });

  const data = propData ?? fetchedData;
  const balance = data?.balance;

  if (!user) return null;

  if (compact) {
    return (
      <Link href="/loyalty/credits">
        <a className="inline-flex items-center gap-2 bg-[#C5A55A]/10 rounded-xl px-3 py-1.5 text-sm font-semibold text-[#7A5C1E] hover:bg-[#C5A55A]/20 transition-colors">
          <Coins className="w-4 h-4 text-[#C5A55A]" />
          {isLoading ? "…" : balance ? `₪${balance.ils}` : "₪0.00"}
        </a>
      </Link>
    );
  }

  return (
    <Link href="/loyalty/credits">
      <a className="block rounded-3xl overflow-hidden shadow-md shadow-[#C5A55A]/20 hover:shadow-lg hover:shadow-[#C5A55A]/30 transition-all">
        <div className="bg-gradient-to-br from-[#C5A55A] to-[#8B6914] p-5 text-white">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-white/80" />
              <span className="text-xs font-semibold text-white/80 tracking-wide">קרדיטי נאמנות</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </div>

          {/* Balance */}
          {isLoading ? (
            <div className="h-10 w-24 bg-white/20 animate-pulse rounded-xl" />
          ) : (
            <p className="text-4xl font-extrabold tracking-tight">
              ₪{balance?.ils ?? "0.00"}
            </p>
          )}
          <p className="text-xs text-white/70 mt-1">זמין למימוש בהזמנה הבאה</p>

          {/* Expiry warning */}
          {balance && balance.pendingExpiryCents > 0 && balance.pendingExpiryAt && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-white/80 bg-white/15 rounded-xl px-3 py-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              ₪{(balance.pendingExpiryCents / 100).toFixed(2)} יפגו ב-{formatExpiry(balance.pendingExpiryAt)}
            </div>
          )}

          {/* CTA */}
          <p className="text-[11px] text-white/50 mt-4">לחץ לצפייה בהיסטוריה המלאה</p>
        </div>
      </a>
    </Link>
  );
}

export default LoyaltyWalletCard;
