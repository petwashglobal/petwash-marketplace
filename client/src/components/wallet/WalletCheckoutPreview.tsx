/**
 * WalletCheckoutPreview — server-driven checkout wallet summary.
 *
 * Shows the exact amounts the server will apply. No frontend math.
 * The API response is the source of truth.
 *
 * Usage:
 *   <WalletCheckoutPreview subtotalCents={5000} divisionCode="walkers" />
 */

import { useQuery } from "@tanstack/react-query";
import { Wallet, AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useFirebaseAuth } from "@/auth/AuthProvider";

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

  const { data: preview, isLoading, isError } = useQuery<WalletPreviewData>({
    queryKey: ["/api/prestige-pass/wallet-preview", subtotalCents, divisionCode],
    queryFn: () =>
      fetch(
        `/api/prestige-pass/wallet-preview?subtotalCents=${subtotalCents}&divisionCode=${divisionCode}`,
        { credentials: "include" }
      ).then((r) => r.json()),
    enabled: !!user && subtotalCents > 0,
    staleTime: 30_000,
  });

  if (!user) return null;
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-400 py-3 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Calculating wallet...</span>
      </div>
    );
  }
  if (isError || !preview) return null;

  const hasWalletApplied = preview.walletAppliedCents > 0;

  return (
    <div className={`rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-4 h-4" style={{ color: GOLD }} />
        <span className="text-sm font-semibold text-gray-700">PetWash Privilege Wallet</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-medium">{ils(preview.subtotalCents)}</span>
        </div>

        <div className="flex justify-between text-gray-500">
          <span>Wallet available</span>
          <span>{ils(preview.walletAvailableCents)}</span>
        </div>

        {hasWalletApplied && (
          <div className="flex justify-between text-emerald-700 font-medium">
            <span>
              Wallet applied
              {preview.cappedByPolicy && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  ({preview.capRule === "50_percent" ? "50% cap" : "100%"})
                </span>
              )}
            </span>
            <span>−{ils(preview.walletAppliedCents)}</span>
          </div>
        )}

        <Separator className="my-1" />

        <div className="flex justify-between font-semibold text-gray-900">
          <span>Cash due</span>
          <span className="text-base">{ils(preview.cashDueCents)}</span>
        </div>
      </div>

      {hasWalletApplied && (
        <p className="text-xs text-gray-400 pt-1">
          ₪{(preview.walletAppliedCents / 100).toFixed(2)} will be reserved from your wallet on confirmation.
        </p>
      )}

      {!hasWalletApplied && preview.walletAvailableCents === 0 && (
        <p className="text-xs text-gray-400 pt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          No wallet balance available. Full amount due by card.
        </p>
      )}

      {preview.pendingBalanceCents > 0 && (
        <p className="text-xs text-amber-600 pt-0.5">
          {ils(preview.pendingBalanceCents)} already reserved from wallet by other bookings.
        </p>
      )}
    </div>
  );
}
