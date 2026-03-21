/**
 * WalletLifecycleMessage — shows the current wallet state for a booking.
 *
 * Phase 2.4 canonical wording (exact strings, bilingual):
 *   reserved  → ₪X נשמרו מהארנק שלך   / ₪X reserved from your wallet
 *   charged   → ₪X חויבו מהארנק שלך   / ₪X charged from your wallet
 *   released  → ₪X שוחררו חזרה לארנק שלך / ₪X released back to your wallet
 *   refunded  → ₪X הוחזרו לארנק שלך   / ₪X refunded to your wallet
 */

import { CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

export const fmtIls = (cents: number) =>
  (cents / 100).toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
  });

export type FinanceState = "none" | "hold_active" | "debited" | "released" | "refunded" | string;

interface Props {
  financeState: FinanceState;
  amountCents?: number;
  className?: string;
}

interface Config {
  icon: typeof Clock;
  color: string;
  bg: string;
  border: string;
  textHe: (amt: string | null) => string;
  textEn: (amt: string | null) => string;
}

const CONFIGS: Record<string, Config> = {
  hold_active: {
    icon: Clock,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textHe: (amt) => amt ? `${amt} נשמרו מהארנק שלך` : "יתרת ארנק שמורה — ממתין לאישור ספק",
    textEn: (amt) => amt ? `${amt} reserved from your wallet` : "Wallet balance reserved — pending provider confirmation",
  },
  debited: {
    icon: CheckCircle2,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    textHe: (amt) => amt ? `${amt} חויבו מהארנק שלך` : "הארנק חויב",
    textEn: (amt) => amt ? `${amt} charged from your wallet` : "Wallet charged",
  },
  released: {
    icon: RefreshCw,
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    textHe: (amt) => amt ? `${amt} שוחררו חזרה לארנק שלך` : "ההקפאה שוחררה — היתרה שוחזרה",
    textEn: (amt) => amt ? `${amt} released back to your wallet` : "Wallet reservation released",
  },
  refunded: {
    icon: RefreshCw,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    textHe: (amt) => amt ? `${amt} הוחזרו לארנק שלך` : "הסכום הוחזר לארנק",
    textEn: (amt) => amt ? `${amt} refunded to your wallet` : "Amount refunded to your wallet",
  },
};

export function WalletLifecycleMessage({ financeState, amountCents = 0, className = "" }: Props) {
  const { language } = useLanguage();
  const isHebrew = language === "he";

  if (!financeState || financeState === "none") return null;

  const cfg = CONFIGS[financeState];
  if (!cfg) return null;

  const amt = amountCents > 0 ? fmtIls(amountCents) : null;
  const Icon = cfg.icon;
  const text = isHebrew ? cfg.textHe(amt) : cfg.textEn(amt);

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${cfg.bg} ${cfg.border} ${className}`}
      dir={isHebrew ? "rtl" : "ltr"}
    >
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
      <p className={`text-sm ${cfg.color}`}>{text}</p>
    </div>
  );
}

/** Resolve the correct amountCents for a given financeState */
export function resolveWalletAmountCents(opts: {
  financeState?: string;
  walletHoldCents?: number;
  walletDebitedCents?: number;
  walletRefundedCents?: number;
}): number {
  const { financeState, walletHoldCents = 0, walletDebitedCents = 0, walletRefundedCents = 0 } = opts;
  if (financeState === "debited") return walletDebitedCents;
  if (financeState === "refunded") return walletRefundedCents;
  return walletHoldCents;
}
