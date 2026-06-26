/**
 * JoinWaitlistForm — reusable demand-capture form. Posts to POST /api/waitlist
 * (public; works for guests and logged-in users). "No dead pages" — every
 * coming-soon / notify-me surface uses this so interest becomes a real record.
 *
 * Brand: white + black + gold #D4AF37. Country-aware phone (PhoneInput).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneInput, isValidE164 } from '@/components/PhoneInput';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { CheckCircle2, Lock } from 'lucide-react';
import type { WaitlistPlatform } from '@shared/schema-waitlist';

const GOLD = '#D4AF37';

interface InterestOption { value: string; en: string; he: string }

interface Props {
  platformKey: WaitlistPlatform;
  interestOptions?: InterestOption[];
  /** Pre-set interest (e.g. a specific out-of-stock product). */
  defaultInterest?: string;
  sourcePage?: string;
  campaignSource?: string;
  className?: string;
}

export function JoinWaitlistForm({ platformKey, interestOptions, defaultInterest, sourcePage, campaignSource, className }: Props) {
  const { language } = useLanguage();
  const isHe = language === 'he';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [interest, setInterest] = useState(defaultInterest || (interestOptions?.[0]?.value ?? ''));
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = !!fullName.trim() && emailValid && (!phone || isValidE164(phone)) && consent && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      await apiRequest('POST', '/api/waitlist', {
        platformKey,
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: phone || undefined,
        city: city.trim() || undefined,
        language,
        interestType: interest || undefined,
        message: message.trim() || undefined,
        sourcePage: sourcePage || (typeof window !== 'undefined' ? window.location.pathname : undefined),
        campaignSource,
        consentToContact: true,
        marketingConsent: false,
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || (isHe ? 'משהו השתבש, נסה/י שוב.' : 'Something went wrong, please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={`rounded-2xl border p-6 text-center ${className || ''}`} style={{ borderColor: GOLD, background: 'rgba(212,175,55,0.05)' }} dir={isHe ? 'rtl' : 'ltr'}>
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: GOLD }} />
        <p className="text-lg font-semibold text-black">{isHe ? 'נרשמת לרשימה' : "You're on the list"}</p>
        <p className="mt-1 text-sm text-black/60">
          {isHe ? 'נעדכן אותך ברגע שנהיה זמינים באזור שלך.' : "We'll be in touch the moment we're available in your area."}
        </p>
      </div>
    );
  }

  const inputCls = 'w-full rounded-xl border border-black/15 px-3 py-2.5 text-[16px] outline-none focus:border-black/40 bg-white';

  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-5 text-start ${className || ''}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="space-y-3">
        <input className={inputCls} placeholder={isHe ? 'שם מלא' : 'Full name'} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className={inputCls} type="email" placeholder={isHe ? 'אימייל' : 'Email'} value={email} onChange={(e) => setEmail(e.target.value)} />
        <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
        <input className={inputCls} placeholder={isHe ? 'עיר' : 'City'} value={city} onChange={(e) => setCity(e.target.value)} />
        {interestOptions && interestOptions.length > 0 && (
          <select className={inputCls} value={interest} onChange={(e) => setInterest(e.target.value)}>
            {interestOptions.map((o) => (
              <option key={o.value} value={o.value}>{isHe ? o.he : o.en}</option>
            ))}
          </select>
        )}
        <textarea className={`${inputCls} resize-none`} rows={2} placeholder={isHe ? 'הודעה (לא חובה)' : 'Message (optional)'} value={message} onChange={(e) => setMessage(e.target.value)} />

        <label className="flex items-start gap-2 text-sm text-black/70">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{isHe ? 'אני מאשר/ת ש-PetWash תיצור איתי קשר בנוגע לשירות זה.' : 'I agree that PetWash may contact me about this service.'}</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={submit} disabled={!canSubmit} className="h-12 w-full rounded-full text-base font-semibold text-black hover:opacity-90 disabled:opacity-50" style={{ background: GOLD }}>
          {submitting ? (isHe ? 'שולח…' : 'Joining…') : (isHe ? 'הצטרפות לרשימת ההמתנה' : 'Join Waitlist')}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-black/45">
          <Lock className="h-3.5 w-3.5" />
          {isHe ? 'הפרטים לעולם לא משותפים ללא הסכמתך.' : 'Details are never shared without consent.'}
        </p>
      </div>
    </div>
  );
}
