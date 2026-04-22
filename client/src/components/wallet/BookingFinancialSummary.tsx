/**
 * BookingFinancialSummary — unified financial block for every booking surface.
 *
 * Replaces all one-off financial summary blocks across:
 *   - BookingConfirmation.tsx
 *   - CustomerBookings.tsx  (expanded view)
 *   - Academy BookingFlow confirmation step
 *
 * Shows: subtotal → fee → total → loyalty → wallet lifecycle
 *
 * RULE: No math here. Every cent value comes from the server.
 */

import type { ReactNode } from "react";
import { Coins, Wallet } from "lucide-react";
import { WalletLifecycleMessage, resolveWalletAmountCents, fmtIls, type FinanceState } from "@/components/wallet/WalletLifecycleMessage";
import { useLanguage } from "@/lib/languageStore";

export interface BookingFinancialSummaryProps {
  subtotalCents?: number;
  serviceFeeCents?: number;
  totalCents: number;
  loyaltyRedeemedCents?: number;
  walletAppliedCents?: number;
  financeState?: FinanceState;
  walletHoldCents?: number;
  walletDebitedCents?: number;
  walletRefundedCents?: number;
  className?: string;
}

interface RowProps {
  label: string;
  value: string;
  bold?: boolean;
  doubleBorder?: boolean;
  accentBg?: string;
  accentText?: string;
  icon?: ReactNode;
}

function Row({ label, value, bold, doubleBorder, accentBg, accentText, icon }: RowProps) {
  const base = "flex justify-between items-center py-3 border-b";
  const border = doubleBorder ? "border-b-2 border-gray-200" : "border-gray-100";
  const bg = accentBg ? `${accentBg} rounded-xl px-2 mt-1` : "";
  const textColor = accentText ?? (bold ? "" : "text-gray-500");

  return (
    <div className={`${base} ${border} ${bg}`}>
      <span className={`flex items-center gap-1.5 text-sm ${bold ? "text-lg font-bold" : `${textColor} font-medium`}`}>
        {icon}
        {label}
      </span>
      <span className={`text-sm ${bold ? "text-lg font-bold" : `font-semibold ${accentText ?? ""}`}`}>
        {value}
      </span>
    </div>
  );
}

export function BookingFinancialSummary({
  subtotalCents,
  serviceFeeCents,
  totalCents,
  loyaltyRedeemedCents = 0,
  walletAppliedCents = 0,
  financeState,
  walletHoldCents = 0,
  walletDebitedCents = 0,
  walletRefundedCents = 0,
  className = "",
}: BookingFinancialSummaryProps) {
  const { language } = useLanguage();
  const isRTL = language === "he" || language === "ar";

  const t = isRTL
    ? { subtotal: "סכום ביניים", fee: "דמי שירות", total: "סה״כ", loyalty: "קרדיטים PetWash Privilege", wallet: "ארנק PetWash" }
    : { subtotal: "Subtotal", fee: "Service fee", total: "Total", loyalty: "PetWash Privilege credits", wallet: "PetWash Wallet" };

  const walletAmountCents = resolveWalletAmountCents({ financeState, walletHoldCents, walletDebitedCents, walletRefundedCents });
  const hasWalletLifecycle = !!financeState && financeState !== "none";

  return (
    <div className={`space-y-0 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      {subtotalCents != null && (
        <Row label={t.subtotal} value={fmtIls(subtotalCents)} />
      )}

      {serviceFeeCents != null && serviceFeeCents > 0 && (
        <Row label={t.fee} value={fmtIls(serviceFeeCents)} />
      )}

      <Row label={t.total} value={fmtIls(totalCents)} bold doubleBorder />

      {loyaltyRedeemedCents > 0 && (
        <Row
          label={t.loyalty}
          value={`-${fmtIls(loyaltyRedeemedCents)}`}
          accentBg="bg-[#C5A55A]/5"
          accentText="text-[#7A5C1E]"
          icon={<Coins className="w-4 h-4 text-[#C5A55A]" />}
        />
      )}

      {walletAppliedCents > 0 && !hasWalletLifecycle && (
        <Row
          label={t.wallet}
          value={`-${fmtIls(walletAppliedCents)}`}
          accentBg="bg-emerald-50"
          accentText="text-emerald-700"
          icon={<Wallet className="w-4 h-4 text-emerald-600" />}
        />
      )}

      {hasWalletLifecycle && (
        <div className="pt-3">
          <WalletLifecycleMessage
            financeState={financeState!}
            amountCents={walletAmountCents}
          />
        </div>
      )}
    </div>
  );
}
