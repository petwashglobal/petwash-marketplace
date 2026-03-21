/**
 * WalletLifecycleMessage — shows the current wallet state for a booking.
 *
 * Used after a booking is created to communicate the lifecycle to the user.
 * Bilingual: Hebrew (default) / English.
 *
 * Usage:
 *   <WalletLifecycleMessage financeState="hold_active" amountCents={5000} />
 */

import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

const ils = (cents: number) =>
  (cents / 100).toLocaleString("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
  });

interface Props {
  financeState: "none" | "hold_active" | "debited" | "released" | "refunded" | string;
  amountCents?: number;
  className?: string;
}

interface MessageConfig {
  icon: typeof Clock;
  color: string;
  bg: string;
  border: string;
  textHe: string;
  textEn: string;
}

function getConfig(state: string, amountCents: number): MessageConfig {
  const amt = amountCents > 0 ? ils(amountCents) : null;

  switch (state) {
    case "hold_active":
      return {
        icon: Clock,
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        textHe: amt ? `${amt} הוקפאו מהארנק — ממתין לאישור ספק.` : "יתרת ארנק הוקפאה — ממתין לאישור ספק.",
        textEn: amt ? `${amt} reserved from your wallet — pending provider confirmation.` : "Wallet balance reserved — pending provider confirmation.",
      };
    case "debited":
      return {
        icon: CheckCircle2,
        color: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-200",
        textHe: amt ? `${amt} חויבו מהארנק.` : "הארנק חויב.",
        textEn: amt ? `${amt} charged from your wallet.` : "Wallet charged.",
      };
    case "released":
      return {
        icon: RefreshCw,
        color: "text-green-700",
        bg: "bg-green-50",
        border: "border-green-200",
        textHe: amt ? `${amt} שוחררו בחזרה לארנק.` : "ההקפאה שוחררה — היתרה שוחזרה.",
        textEn: amt ? `${amt} wallet reservation released — balance restored.` : "Wallet reservation released.",
      };
    case "refunded":
      return {
        icon: RefreshCw,
        color: "text-purple-700",
        bg: "bg-purple-50",
        border: "border-purple-200",
        textHe: amt ? `${amt} הוחזרו לארנק.` : "הסכום הוחזר לארנק.",
        textEn: amt ? `${amt} refunded to your wallet.` : "Amount refunded to your wallet.",
      };
    default:
      return {
        icon: XCircle,
        color: "text-gray-500",
        bg: "bg-gray-50",
        border: "border-gray-100",
        textHe: "אין פעילות ארנק להזמנה זו.",
        textEn: "No wallet activity for this booking.",
      };
  }
}

export function WalletLifecycleMessage({ financeState, amountCents = 0, className = "" }: Props) {
  const { language } = useLanguage();
  const isHebrew = language === "he";

  if (!financeState || financeState === "none") return null;

  const cfg = getConfig(financeState, amountCents);
  const Icon = cfg.icon;
  const text = isHebrew ? cfg.textHe : cfg.textEn;

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
