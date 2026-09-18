/**
 * Pay for a training session the trainer has confirmed (CEO 2026-09-18).
 *
 * The trainer confirms first; anything the wallet did not cover is still owed —
 * no money moves until this page sends the customer to the secure card page. The
 * session is marked paid by the server only after the payment is verified.
 *
 * Nothing is charged here: the page asks the server for a hosted payment page
 * and follows it. Every refusal is shown as-is, never as a generic error.
 */
import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2, CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { Button } from '@/components/ui/button';

export default function PayAcademy() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const [state, setState] = useState<'idle' | 'starting' | 'failed'>('idle');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startPayment() {
    if (!bookingId) return;
    setState('starting');
    setError(null);
    try {
      const res = await apiRequest('POST', `/api/academy/bookings/${encodeURIComponent(bookingId)}/pay`, {});
      const body = await res.json().catch(() => ({}));
      if (typeof body?.amountCents === 'number') setAmountCents(body.amountCents);
      if (!res.ok || !body?.paymentUrl) {
        setState('failed');
        setError(body?.error || (isHebrew ? 'לא הצלחנו לפתוח את דף התשלום. לא בוצע חיוב.' : 'We could not open the payment page. Nothing was charged.'));
        return;
      }
      // The card form is hosted by the payment provider — we never see the card.
      window.location.assign(body.paymentUrl);
    } catch {
      setState('failed');
      setError(isHebrew ? 'לא הצלחנו לפתוח את דף התשלום. לא בוצע חיוב.' : 'We could not open the payment page. Nothing was charged.');
    }
  }

  useEffect(() => { void startPayment(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bookingId]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center" dir={isHebrew ? 'rtl' : 'ltr'}>
      <h1 className="text-xl font-bold mb-2" data-testid="pay-academy-title">
        {isHebrew ? 'תשלום עבור המפגש' : 'Pay for your session'}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {isHebrew
          ? 'המאמן/ת אישר/ה. ההזמנה תושלם מיד לאחר התשלום.'
          : 'Your trainer confirmed. The session is paid as soon as the payment goes through.'}
        {amountCents != null && (
          <> {isHebrew ? 'לתשלום:' : 'Amount:'} <strong>₪{(amountCents / 100).toFixed(2)}</strong></>
        )}
      </p>

      {state === 'starting' && (
        <div className="flex items-center justify-center gap-2 text-gray-600" data-testid="pay-academy-starting">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isHebrew ? 'מעבירים אותך לדף התשלום המאובטח…' : 'Taking you to the secure payment page…'}
        </div>
      )}

      {state === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 text-start" data-testid="pay-academy-error">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => void startPayment()} data-testid="pay-academy-retry">
              <CreditCard className="h-4 w-4 me-2" />
              {isHebrew ? 'נסה/י שוב' : 'Try again'}
            </Button>
            <Button variant="outline" onClick={() => setLocation('/bookings')}>
              {isHebrew ? 'להזמנות שלי' : 'My bookings'}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="h-3.5 w-3.5" />
        {isHebrew ? 'התשלום מתבצע בדף מאובטח של חברת הסליקה — פרטי הכרטיס לא נשמרים אצלנו.' : 'Payment happens on the clearing company’s secure page — we never store your card.'}
      </p>
    </div>
  );
}
