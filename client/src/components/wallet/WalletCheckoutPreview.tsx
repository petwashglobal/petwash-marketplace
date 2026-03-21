/**
 * WalletCheckoutPreview — server-driven checkout wallet summary.
 *
 * Shows the exact amounts the server will apply. No frontend math.
 * The API response is the source of truth.
 *
 * Debounces subtotalCents by 375 ms so rapidly-changing inputs
 * (duration sliders, date pickers) do not flood the preview endpoint.
 *
 * Usage:
 *   <WalletCheckoutPreview subtotalCents={5000} divisionCode="walkers" />
 */

import { useQuery } from "@tanstack/react-query";
import { Wallet, AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useDebounced } from "@/hooks/useDebounced";
import { useLanguage } from "@/lib/languageStore";

const GOLD = "#C5A55A";

const ils = (cents: number) =>
  (cents / 100).toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
  });

interface WalletPreviewData {
  subtotalCents: number;
  divisionCode: string;
  walletAvailableCents: number;
  walletAppliedCents: number;
  cashDueCents: number;
  pendingWalletImpactCents: number;
  capRule: "50_percent" | "100_percent";
  cappedByPolicy: boolean;
  cappedByBalance: boolean;
  pendingBalanceCents: number;
  breakdown: { promo: number; egift: number; referral: number; cash: number };
}

interface Props {
  subtotalCents: number;
  divisionCode: string;
  className?: string;
}

export function WalletCheckoutPreview({ subtotalCents, divisionCode, className = "" }: Props) {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const isHebrew = language === "he";

  const debouncedCents = useDebounced(subtotalCents, 375);

  const { data: preview, isLoading, isError } = useQuery<WalletPreviewData>({
    queryKey: ["/api/prestige-pass/wallet-preview", debouncedCents, divisionCode],
    queryFn: () =>
      fetch(
        `/api/prestige-pass/wallet-preview?subtotalCents=${debouncedCents}&divisionCode=${divisionCode}`,
        { credentials: "include" }
      ).then((r) => r.json()),
    enabled: !!user && debouncedCents > 0,
    staleTime: 30_000,
  });

  if (!user) return null;
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-400 py-3 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{isHebrew ? "מחשב ארנק..." : "Calculating wallet..."}</span>
      </div>
    );
  }
  if (isError || !preview) return null;

  const hasWalletApplied = preview.walletAppliedCents > 0;

  const t = isHebrew
    ? {
        title: "PetWash Privilege Wallet",
        subtotal: "סכום ביניים",
        available: "יתרה זמינה",
        applied: "מהארנק",
        cap50: "50% תקרה",
        cashDue: "לתשלום במזומן",
        reservedNote: (amt: string) => `${amt} יישמרו מהארנק עם האישור.`,
        noBalance: "אין יתרת ארנק זמינה. הסכום המלא יחויב בכרטיס.",
        pending: (amt: string) => `${amt} כבר שמורים בהזמנות אחרות.`,
      }
    : {
        title: "PetWash Privilege Wallet",
        subtotal: "Subtotal",
        available: "Wallet available",
        applied: "Wallet applied",
        cap50: "50% cap",
        cashDue: "Cash due",
        reservedNote: (amt: string) => `${amt} will be reserved from your wallet on confirmation.`,
        noBalance: "No wallet balance available. Full amount due by card.",
        pending: (amt: string) => `${amt} already reserved from wallet by other bookings.`,
      };

  return (
    <div
      className={`rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 ${className}`}
      dir={isHebrew ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-4 h-4" style={{ color: GOLD }} />
        <span className="text-sm font-semibold text-gray-700">{t.title}</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>{t.subtotal}</span>
          <span className="font-medium">{ils(preview.subtotalCents)}</span>
        </div>

        <div className="flex justify-between text-gray-500">
          <span>{t.available}</span>
          <span>{ils(preview.walletAvailableCents)}</span>
        </div>

        {hasWalletApplied && (
          <div className="flex justify-between text-emerald-700 font-medium">
            <span>
              {t.applied}
              {preview.cappedByPolicy && (
                <span className={`text-xs font-normal text-gray-400 ${isHebrew ? "me-1" : "ms-1"}`}>
                  ({preview.capRule === "50_percent" ? t.cap50 : "100%"})
                </span>
              )}
            </span>
            <span>−{ils(preview.walletAppliedCents)}</span>
          </div>
        )}

        <Separator className="my-1" />

        <div className="flex justify-between font-semibold text-gray-900">
          <span>{t.cashDue}</span>
          <span className="text-base">{ils(preview.cashDueCents)}</span>
        </div>
      </div>

      {hasWalletApplied && (
        <p className="text-xs text-gray-400 pt-1">
          {t.reservedNote(ils(preview.walletAppliedCents))}
        </p>
      )}

      {!hasWalletApplied && preview.walletAvailableCents === 0 && (
        <p className="text-xs text-gray-400 pt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {t.noBalance}
        </p>
      )}

      {preview.pendingBalanceCents > 0 && (
        <p className="text-xs text-amber-600 pt-0.5">
          {t.pending(ils(preview.pendingBalanceCents))}
        </p>
      )}
    </div>
  );
}
