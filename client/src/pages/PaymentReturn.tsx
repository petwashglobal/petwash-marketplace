/**
 * PaymentReturn — where SUMIT sends the customer back after the hosted checkout.
 *
 * /payment-success and /payment-failed (server route /api/payments/sumit/return
 * re-verifies the charge server-side, then redirects here with ?ref=<orderRef>).
 *
 * IMPORTANT: the page is REASSURANCE ONLY. It never activates anything — the
 * SUMIT webhook is the source of truth and activates the purchase + sends the
 * email asynchronously. So we tell the customer "confirming your payment", not
 * "here is your gift", to avoid implying activation the redirect can't promise.
 */
import { useLocation } from 'wouter';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface PaymentReturnProps {
  language: Language;
  variant: 'success' | 'failed';
}

export default function PaymentReturn({ language, variant }: PaymentReturnProps) {
  const [, setLocation] = useLocation();
  const isHe = language === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const ref = new URLSearchParams(window.location.search).get('ref') || '';
  const ok = variant === 'success';

  const copy = ok
    ? {
        title: isHe ? 'תודה! מאמתים את התשלום' : 'Thank you — confirming your payment',
        body: isHe
          ? 'התשלום התקבל ומאומת באופן מאובטח. ברגע שהוא יאושר, הרכישה תופעל אוטומטית, תופיע בארנק PetWash שלך ותקבל/י אישור במייל. זה לרוב לוקח כמה רגעים.'
          : 'Your payment was received and is being verified securely. Once confirmed, your purchase activates automatically, appears in your PetWash wallet, and you’ll get an email confirmation. This usually takes a few moments.',
        cta: isHe ? 'חזרה לדף הבית' : 'Back to home',
      }
    : {
        title: isHe ? 'התשלום לא הושלם' : 'Payment not completed',
        body: isHe
          ? 'לא הצלחנו לאשר את התשלום. ייתכן שלא חויבת, או שהתשלום לא הושלם. אפשר לנסות שוב, ואם החיוב בכל זאת בוצע — צרו קשר ונסדר את זה.'
          : 'We couldn’t confirm the payment. You may not have been charged, or it wasn’t completed. You can try again — and if you were charged anyway, contact us and we’ll sort it out.',
        cta: isHe ? 'חזרה לדף הבית' : 'Back to home',
      };

  return (
    <div
      dir={dir}
      className="flex flex-col items-center justify-center bg-white px-6 text-center"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
      }}
    >
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: ok ? 'rgba(212,175,55,0.12)' : 'rgba(0,0,0,0.05)' }}>
          {ok ? (
            <CheckCircle2 className="h-11 w-11" style={{ color: '#D4AF37' }} strokeWidth={2} />
          ) : (
            <XCircle className="h-11 w-11 text-neutral-700" strokeWidth={2} />
          )}
        </div>

        <h1 className="mb-3 text-2xl font-semibold text-black">{copy.title}</h1>
        <p className="mb-8 text-[15px] leading-relaxed text-neutral-600">{copy.body}</p>

        <button
          onClick={() => setLocation('/')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
          data-testid="payment-return-home"
        >
          {copy.cta}
          <ArrowRight className={`h-4 w-4 ${isHe ? 'rotate-180' : ''}`} />
        </button>

        <p className="mt-6 text-xs text-neutral-400">
          {isHe ? 'צריכים עזרה?' : 'Need help?'}{' '}
          <a href="mailto:support@petwash.co.il" className="underline">support@petwash.co.il</a>
          {ref ? ` · ${isHe ? 'מספר הזמנה' : 'Ref'}: ${ref}` : ''}
        </p>
      </div>
    </div>
  );
}
