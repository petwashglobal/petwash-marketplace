/**
 * ProviderMoneyCard — the "your money" card on the Provider home.
 *
 * Renders the four canonical earnings buckets from
 * /api/provider/earnings-truth (CEO 2026-08-26 §17, §31):
 *   Expected · Pending · Available · Paid
 *
 * The card NEVER computes money client-side. Every value comes from
 * the server composer. When the endpoint is empty (new provider) the
 * card hides itself so we don't render a wall of zeros.
 */

import { useLocation } from 'wouter';
import { useLanguage } from '@/lib/languageStore';
import { useProviderEarningsTruth } from '@/hooks/useProviderEarningsTruth';

function shekel(cents: number): string {
  return `₪${(cents / 100).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

export function ProviderMoneyCard() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const { earnings, isLoading } = useProviderEarningsTruth();

  if (isLoading) return null;
  if (!earnings) return null;
  const total =
    earnings.expectedCents + earnings.pendingCents +
    earnings.availableCents + earnings.paidCents;
  if (total === 0) return null;

  const buckets: { key: string; label: string; cents: number; tone: string; testid: string }[] = [
    { key: 'available', label: he ? 'זמין למשיכה' : 'Available', cents: earnings.availableCents, tone: 'text-emerald-700', testid: 'provider-money-available' },
    { key: 'pending',   label: he ? 'בהמתנה לשחרור' : 'Pending',   cents: earnings.pendingCents,   tone: 'text-amber-700',   testid: 'provider-money-pending' },
    { key: 'expected',  label: he ? 'צפוי'          : 'Expected',  cents: earnings.expectedCents,  tone: 'text-gray-700',    testid: 'provider-money-expected' },
    { key: 'paid',      label: he ? 'שולם עד היום'   : 'Paid'    ,  cents: earnings.paidCents,      tone: 'text-gray-500',    testid: 'provider-money-paid' },
  ];

  return (
    <section
      className="px-4 pt-3"
      dir={he ? 'rtl' : 'ltr'}
      data-testid="provider-money-card"
    >
      <button
        type="button"
        onClick={() => navigate('/provider/earnings')}
        className="w-full text-start rounded-2xl border border-gray-100 bg-white shadow-sm p-4 hover:border-gray-300"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">{he ? 'הכסף שלך' : 'Your money'}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {he ? 'צפוי · בהמתנה · זמין · שולם' : 'Expected · Pending · Available · Paid'}
            </p>
          </div>
          <div className="text-[13.5px] font-bold text-gray-900">
            {he ? 'הכל' : 'All'}: {shekel(total)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {buckets.map((b) => (
            <div
              key={b.key}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
              data-testid={b.testid}
            >
              <div className="text-[11px] text-gray-500">{b.label}</div>
              <div className={`text-[16px] font-bold ${b.tone}`}>{shekel(b.cents)}</div>
            </div>
          ))}
        </div>
      </button>
    </section>
  );
}

export default ProviderMoneyCard;
