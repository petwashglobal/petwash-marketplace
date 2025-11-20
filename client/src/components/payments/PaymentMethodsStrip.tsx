// FILE: client/src/components/payments/PaymentMethodsStrip.tsx
// Modern 2025 style payment methods row for PetWash

import React from "react";

type PaymentMethod =
  | "apple-pay"
  | "google-pay"
  | "visa"
  | "mastercard"
  | "amex"
  | "diners";

const METHODS: { id: PaymentMethod; label: string; logo: string }[] = [
  { id: "apple-pay", label: "Apple Pay", logo: "/assets/payments/apple-pay-color.svg" },
  { id: "google-pay", label: "Google Pay", logo: "/assets/payments/google-pay-color.svg" },
  { id: "visa", label: "Visa", logo: "/assets/payments/visa-color.svg" },
  { id: "mastercard", label: "Mastercard", logo: "/assets/payments/mastercard-color.svg" },
  { id: "amex", label: "American Express", logo: "/assets/payments/amex-color.svg" },
  { id: "diners", label: "Diners Club", logo: "/assets/payments/diners-color.svg" },
];

interface PaymentMethodsStripProps {
  compact?: boolean;
  className?: string;
}

export const PaymentMethodsStrip: React.FC<PaymentMethodsStripProps> = ({
  compact = false,
  className = "",
}) => {
  const baseCard =
    "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:px-4 md:py-2.5 shadow-sm backdrop-blur-sm";

  const compactCard =
    "h-9 md:h-10";

  const fullCard =
    "h-11 md:h-12";

  return (
    <div
      className={
        "flex flex-wrap items-center gap-2 md:gap-3 lg:gap-4 " + className
      }
      data-testid="payment-methods-strip"
    >
      {METHODS.map((m) => (
        <div
          key={m.id}
          className={
            baseCard +
            " " +
            (compact ? compactCard : fullCard)
          }
        >
          <img
            src={m.logo}
            alt={m.label}
            className="h-4 md:h-5 lg:h-6 w-auto object-contain"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};
