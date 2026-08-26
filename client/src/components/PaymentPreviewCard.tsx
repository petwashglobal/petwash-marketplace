/**
 * PaymentPreviewCard — the ONE customer-visible "what do I owe?"
 * breakdown (CEO 2026-08-26 §9). Pure renderer over the server's
 * PaymentPreview shape — never computes money client-side.
 *
 * Layout mirrors the CEO spec exactly:
 *   Service price       ₪X
 *   Extras              ₪X
 *   ─────────────
 *   Subtotal            ₪X
 *
 *   Benefits            (one line per benefit, ordered)
 *     Prestige benefit  -₪X
 *     Promo             -₪X
 *     Loyalty credit    -₪X
 *
 *   Stored value        (one line per source, ordered)
 *     eGift             -₪X
 *     Wallet            -₪X   (with policy-cap note when relevant)
 *
 *   ─────────────
 *   Remaining to pay    ₪X   (bold, this is the number)
 *
 *   [Pay ₪X]            (primary CTA — server tells us the number)
 *
 * When the server returns fully_covered / paid, the CTA becomes an
 * honest "You're all set" line and no Pay button renders.
 */

import { useLanguage } from '@/lib/languageStore';
import type { PaymentPreview } from '@shared/lib/paymentPreview';

function shekel(cents: number, he: boolean): string {
  const abs = Math.abs(cents);
  const s = `₪${(abs / 100).toLocaleString(he ? 'he-IL' : 'en-US', { maximumFractionDigits: 2 })}`;
  return cents < 0 ? `-${s}` : s;
}

interface Props {
  preview: PaymentPreview | null | undefined;
  isLoading?: boolean;
  /** When set, replaces the default primary CTA with a caller-owned handler. */
  onPay?: () => void;
}

const BENEFIT_LABEL_FALLBACK: Record<string, { he: string; en: string }> = {
  prestige_basic: { he: 'הטבת Prestige', en: 'Prestige benefit' },
  promo_code:     { he: 'קופון',        en: 'Promo' },
  loyalty_credit: { he: 'נקודות נאמנות',  en: 'Loyalty credit' },
};

const STORED_VALUE_LABEL: Record<string, { he: string; en: string }> = {
  egift:        { he: 'שובר מתנה',        en: 'eGift' },
  promo_wallet: { he: 'ארנק מבצעים',      en: 'Promo wallet' },
  cash_wallet:  { he: 'ארנק',              en: 'Wallet' },
};

export function PaymentPreviewCard({ preview, isLoading, onPay }: Props) {
  const { language } = useLanguage();
  const he = language === 'he';

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm text-[13px] text-gray-400"
        dir={he ? 'rtl' : 'ltr'}
        data-testid="payment-preview-loading"
      >
        {he ? 'מחשבים…' : 'Calculating…'}
      </div>
    );
  }
  if (!preview) return null;

  const p = preview;

  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm text-[13.5px]"
      dir={he ? 'rtl' : 'ltr'}
      data-testid="payment-preview-card"
    >
      <div className="space-y-1">
        <div className="flex justify-between text-gray-500">
          <span>{he ? 'מחיר שירות' : 'Service price'}</span>
          <span>{shekel(p.baseCents, he)}</span>
        </div>
        {p.extrasCents > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>{he ? 'תוספות' : 'Extras'}</span>
            <span>{shekel(p.extrasCents, he)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium text-gray-800 border-t border-gray-100 pt-1 mt-1">
          <span>{he ? 'סכום ביניים' : 'Subtotal'}</span>
          <span>{shekel(p.subtotalCents, he)}</span>
        </div>
      </div>

      {p.benefits.length > 0 && (
        <div className="mt-3 space-y-1" data-testid="payment-preview-benefits">
          {p.benefits.map((b, i) => {
            const fallback = BENEFIT_LABEL_FALLBACK[b.type];
            const label = b.label || (fallback ? (he ? fallback.he : fallback.en) : b.type);
            return (
              <div key={`b-${i}`} className="flex justify-between text-emerald-700">
                <span>{label}</span>
                <span>{shekel(-b.amountCents, he)}</span>
              </div>
            );
          })}
        </div>
      )}

      {p.storedValue.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="payment-preview-stored-value">
          {p.storedValue.map((v, i) => {
            const fallback = STORED_VALUE_LABEL[v.type];
            const label = fallback ? (he ? fallback.he : fallback.en) : v.type;
            const capNote = v.cappedByPolicy && v.capPercent
              ? (he ? ` (עד ${v.capPercent}% מההזמנה)` : ` (up to ${v.capPercent}% of order)`)
              : v.cappedByBalance
                ? (he ? ' (עד היתרה)' : ' (up to balance)')
                : '';
            return (
              <div key={`v-${i}`} className="flex justify-between text-[#7A5A00]">
                <span>{label}<span className="text-[11px] text-gray-400">{capNote}</span></span>
                <span>{shekel(-v.amountCents, he)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex justify-between text-[15px] font-bold text-gray-900 border-t border-gray-200 pt-2">
        <span>{he ? 'נשאר לתשלום' : 'Remaining to pay'}</span>
        <span data-testid="payment-preview-remaining">{shekel(p.amountRemainingCents, he)}</span>
      </div>

      {p.warnings.length > 0 && (
        <ul className="mt-2 text-[11px] text-amber-700 list-disc ps-4">
          {p.warnings.map((w, i) => (<li key={`w-${i}`}>{w}</li>))}
        </ul>
      )}

      {p.paymentState === 'fully_covered' ? (
        <div className="mt-3 text-[13px] font-medium text-emerald-700" data-testid="payment-preview-covered">
          {he ? 'מכוסה במלואו — אין מה לשלם עכשיו.' : "You're covered — nothing to pay now."}
        </div>
      ) : p.paymentState === 'paid' ? (
        <div className="mt-3 text-[13px] font-medium text-gray-500" data-testid="payment-preview-paid">
          {he ? 'שולם.' : 'Paid.'}
        </div>
      ) : p.paymentState === 'not_due_yet' ? (
        <div className="mt-3 text-[13px] font-medium text-gray-500" data-testid="payment-preview-not-due">
          {he ? 'התשלום ייגבה לאחר שהספק יאשר.' : 'Payment starts after the provider accepts.'}
        </div>
      ) : onPay ? (
        <button
          type="button"
          onClick={onPay}
          className="mt-3 w-full rounded-xl px-4 py-3 bg-black text-white text-sm font-semibold"
          data-testid="payment-preview-pay-button"
        >
          {he
            ? `לתשלום ${shekel(p.amountDueNowCents, true)}`
            : `Pay ${shekel(p.amountDueNowCents, false)}`}
        </button>
      ) : null}
    </div>
  );
}

export default PaymentPreviewCard;
