import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/languageStore';

/**
 * Marketing-Unsubscribe Landing Page — CAN-SPAM / DMA-13 compliance.
 *
 * Every marketing email in the wild links to `/unsubscribe?token=…`. This
 * page auto-POSTs the token to POST /api/marketing/unsubscribe on mount,
 * shows the outcome, and offers a support link if the token is invalid
 * or expired. Hebrew-first, palette pinned to white / black / gold per
 * PetWash brand rules.
 *
 * Deliberately no auth — the token IS the credential. This matches how
 * every other transactional mailer works (Amazon, Airbnb, banks).
 */
export default function Unsubscribe() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const isRTL = isHebrew || language === 'ar';

  const [state, setState] = useState<'loading' | 'ok' | 'expired' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        if (!cancelled) setState('expired');
        return;
      }
      try {
        const res = await fetch('/api/marketing/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (res.ok) {
          setState('ok');
        } else if (res.status === 401) {
          setState('expired');
        } else {
          setState('error');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const t = {
    heading: {
      loading: isHebrew ? 'מבטל הרשמה…' : 'Unsubscribing…',
      ok:      isHebrew ? 'הוסרת מרשימת התפוצה' : 'You’ve been unsubscribed',
      expired: isHebrew ? 'הקישור אינו תקף' : 'This link has expired',
      error:   isHebrew ? 'קרתה תקלה' : 'Something went wrong',
    },
    body: {
      loading: isHebrew ? 'רק רגע — מעדכן את ההעדפות שלך.' : 'One moment — updating your preferences.',
      ok:      isHebrew
        ? 'לא תקבל/י יותר מיילים שיווקיים מ־Pet Wash™. עדכונים חיוניים על ההזמנות ובטיחות החשבון ימשיכו להישלח.'
        : 'You will no longer receive marketing emails from Pet Wash™. Essential booking and account-security notifications will still be delivered.',
      expired: isHebrew
        ? 'ייתכן שכבר לחצת על הקישור בעבר, או שהקישור הזה ישן מדי. שלחו לנו הודעה ואנחנו נטפל בזה ידנית.'
        : 'You may have already used this link, or it may have expired. Contact support and we’ll take care of it manually.',
      error:   isHebrew
        ? 'לא הצלחנו לעדכן את ההעדפות שלך. נסה שוב בעוד רגע או שלח לנו הודעה.'
        : 'We could not update your preferences right now. Try again in a moment or contact support.',
    },
    support: isHebrew ? 'פנייה לתמיכה' : 'Contact support',
    supportEmail: 'support@petwash.co.il',
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-white flex items-center justify-center px-6 py-16"
      data-testid="unsubscribe-page"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white text-center px-8 py-12"
        style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 24px rgba(0,0,0,0.04)' }}
      >
        <img
          src="/brand/petwash-logo-official.png"
          alt="Pet Wash"
          className="h-10 w-auto object-contain mx-auto mb-6"
          style={{ maxWidth: '60%' }}
        />
        <div
          className="mx-auto mb-6 h-px w-16"
          style={{ background: '#D4AF37' }}
        />
        <h1
          className="text-black tracking-tight mb-3"
          style={{
            fontFamily: `'Playfair Display', 'Cormorant Garamond', Georgia, serif`,
            fontSize: 'clamp(22px, 5.5vw, 28px)',
            fontWeight: 700,
            lineHeight: 1.2,
          }}
          data-testid={`unsubscribe-heading-${state}`}
        >
          {t.heading[state]}
        </h1>
        <p
          className="text-sm text-gray-700 leading-relaxed"
          style={{ maxWidth: '40ch', margin: '0 auto' }}
        >
          {t.body[state]}
        </p>
        {(state === 'expired' || state === 'error') && (
          <a
            href={`mailto:${t.supportEmail}?subject=${encodeURIComponent(isHebrew ? 'ביטול הרשמה למיילים שיווקיים' : 'Unsubscribe from marketing emails')}`}
            className="mt-6 inline-block px-6 h-11 leading-[44px] rounded-2xl bg-black text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            data-testid="unsubscribe-support-link"
          >
            {t.support}
          </a>
        )}
      </div>
    </div>
  );
}
