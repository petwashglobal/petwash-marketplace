import { useState } from 'react';
import { useLocation } from 'wouter';
import { PawPrint, Shield, ChevronRight, ChevronLeft } from 'lucide-react';
import { getApiUrl } from '@/lib/apiConfig';
import type { Language } from '@/lib/i18n';

interface ConsentOnboardingProps {
  language?: Language;
}

export default function ConsentOnboarding({ language = 'he' }: ConsentOnboardingProps) {
  const [, navigate] = useLocation();
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRTL = language === 'he' || language === 'ar';

  const text = {
    he: {
      title: 'תנאים ופרטיות',
      subtitle: 'בהמשך אתה מסכים ל',
      terms: 'תנאי השימוש',
      and: ' ו',
      privacy: 'מדיניות הפרטיות',
      period: ' שלנו.',
      marketing: 'אני מסכים לקבל חומרי שיווק מ-Pet Wash™',
      agree: 'הסכם והמשך',
      decline: 'דחה ומחק חשבון',
    },
    en: {
      title: 'Terms and Privacy',
      subtitle: 'By continuing you agree to our',
      terms: 'terms & conditions',
      and: ' and ',
      privacy: 'privacy policy',
      period: '.',
      marketing: 'I consent to Pet Wash™ sending me marketing material.',
      agree: 'AGREE AND CONTINUE',
      decline: 'DECLINE AND DELETE ACCOUNT',
    },
  };

  const t = text[language === 'he' ? 'he' : 'en'];

  const handleAgree = async () => {
    setLoading(true);
    try {
      const consentPayload = {
        termsOfService: true,
        privacyPolicy: true,
        marketing: marketingConsent,
        timestamp: new Date().toISOString(),
        source: 'consent_onboarding',
      };
      localStorage.setItem('petwash_consent_onboarding_complete', 'true');
      localStorage.setItem('petwash_marketing_consent', String(marketingConsent));
      try {
        await fetch(getApiUrl('/api/consent/onboarding'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...consentPayload, corporateGuidelines: true, emailCommunication: marketingConsent }),
        });
      } catch {
        // Non-blocking — localStorage is the primary record
      }
      navigate('/notification-consent');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm(
      language === 'he'
        ? 'אתה בטוח? פעולה זו תמחק את חשבונך לצמיתות.'
        : 'Are you sure? This will permanently delete your account.'
    )) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/account/delete'), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('delete_failed');
    } catch {
      alert(
        language === 'he'
          ? 'שגיאה במחיקת החשבון. אנא נסה שוב.'
          : 'Failed to delete account. Please try again.'
      );
      setLoading(false);
      return;
    }
    localStorage.clear();
    navigate('/');
  };

  return (
    <div
      className="min-h-[100dvh] bg-white flex flex-col items-center justify-between px-6"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px))',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Top Illustration */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div className="relative mb-10">
          {/* Gold circle background */}
          <div
            className="w-48 h-48 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#F5EDD0' }}
          >
            <div
              className="w-36 h-36 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#D4AF37' }}
            >
              <PawPrint className="w-20 h-20 text-white" strokeWidth={1.5} />
            </div>
          </div>
          {/* Shield badge */}
          <div
            className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <Shield className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-5">
          {t.title}
        </h1>

        {/* Subtitle with clickable links */}
        <p className="text-base text-gray-600 text-center leading-relaxed mb-10">
          {t.subtitle}{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
            style={{ color: '#D4AF37' }}
          >
            {t.terms}
          </a>
          {t.and}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
            style={{ color: '#D4AF37' }}
          >
            {t.privacy}
          </a>
          {t.period}
        </p>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Bottom Section */}
      <div className="w-full max-w-sm space-y-5">
        {/* Marketing Consent Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="sr-only"
              data-testid="checkbox-marketing-consent"
            />
            <div
              className="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors"
              style={{
                borderColor: marketingConsent ? '#D4AF37' : '#d1d5db',
                backgroundColor: marketingConsent ? '#D4AF37' : 'white',
              }}
            >
              {marketingConsent && (
                <svg viewBox="0 0 12 10" fill="none" className="w-3.5 h-3.5">
                  <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-700 leading-relaxed">
            {t.marketing}
          </span>
        </label>

        {/* Agree Button */}
        <button
          onClick={handleAgree}
          disabled={loading}
          data-testid="button-agree-and-continue"
          className="w-full h-14 rounded-2xl font-bold text-base tracking-wide text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#D4AF37' }}
        >
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              {t.agree}
              {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </>
          )}
        </button>

        {/* Decline Link */}
        <button
          onClick={handleDecline}
          data-testid="button-decline-and-delete"
          className="w-full text-center text-sm font-bold underline min-h-[44px] flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ color: '#dc2626' }}
        >
          {t.decline}
        </button>
      </div>
    </div>
  );
}
