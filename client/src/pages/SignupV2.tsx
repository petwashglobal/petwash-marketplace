/**
 * SignupV2 — rebuilt signup surface (Track B of the 2026 rebuild brief).
 *
 * Single purpose: phone → terms → OTP. Stage-white, ink-black, one accent.
 * No marketing copy, no badges, no biometric/wallet/remember toggles, no
 * pre-ticked consent, single CTA, inline errors, locale-aware country default.
 *
 * Wired to the SAME real backend as the legacy signup (no second auth system):
 *   POST /api/auth/sms/start  → /api/auth/sms/verify → /api/auth/phone-session
 *   → Firebase custom token   → /api/auth/session    → /dashboard
 *
 * Shipped behind a flag (default OFF). Enable for testing via ?signup_v2=1 or
 * VITE_SIGNUP_V2=1. The legacy /signup is untouched until QA + counsel sign-off.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { signInWithCustomToken, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getApiUrl } from '@/lib/apiConfig';
import { getAuthStrategy, createGoogleProvider, createAppleProvider } from '@/lib/iosAuthHandler';
import { executeTurnstileInvisible } from '@/components/TurnstileWidget';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

type Lang = 'he' | 'en' | 'ar' | 'es' | 'fr' | 'ru';

interface Country {
  code: string;
  flag: string;
  re: RegExp;
  example: string;
}

// Phone patterns — same approach as the reference. National part; leading 0 ok.
const COUNTRIES: Country[] = [
  { code: '+972', flag: '🇮🇱', re: /^0?5\d{8}$/, example: '50 123 4567' },
  { code: '+1', flag: '🇺🇸', re: /^\d{10}$/, example: '415 555 0100' },
  { code: '+44', flag: '🇬🇧', re: /^0?7\d{9}$/, example: '7700 900000' },
  { code: '+61', flag: '🇦🇺', re: /^0?4\d{8}$/, example: '412 345 678' },
];

const clean = (v: string) => (v || '').replace(/[\s\-()]/g, '');

export default function SignupV2({ language = 'he' }: { language?: Lang }) {
  const he = language === 'he';
  const dir = he || language === 'ar' ? 'rtl' : 'ltr';
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const flow = params.get('flow') || params.get('intent') || 'signup';

  const [cc, setCc] = useState('+972'); // locale-aware default: Israel
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false); // unchecked by default — always
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = COUNTRIES.find((c) => c.code === cc) ?? COUNTRIES[0];
  const phoneValid = country.re.test(clean(phone));
  const canContinue = phoneValid && terms && !busy;
  const fullPhone = cc + clean(phone).replace(/^0/, '');

  const t = (h: string, e: string) => (he ? h : e);
  const fail = (m: string) => setError(m);

  async function finishAndRoute() {
    try {
      await fetch(getApiUrl('/api/session/whoami'), { credentials: 'include' });
    } catch (e) {
      logger.error('[signup-v2] whoami', e);
    }
    navigate('/dashboard');
  }

  async function sendCode() {
    if (!canContinue) return;
    setBusy(true);
    setError(null);
    try {
      const turnstileToken = await executeTurnstileInvisible('signup_sms_start').catch(() => null);
      const r = await fetch(getApiUrl('/api/auth/sms/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: fullPhone, language, flow, turnstileToken }),
      });
      const d = await r.json();
      if (!d.ok) {
        fail(d.message || t('כרגע לא ניתן לשלוח SMS — נסו Google או Apple', 'SMS unavailable right now — try Google or Apple.'));
        return;
      }
      setSent(true);
      toast({ title: t('קוד נשלח 📲', 'Code sent 📲') });
    } catch (e) {
      logger.error('[signup-v2] sendCode', e);
      fail(t('שגיאת רשת', 'Network error'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    setBusy(true);
    setError(null);
    try {
      const v = await fetch(getApiUrl('/api/auth/sms/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: fullPhone, code, language, flow }),
      });
      const vd = await v.json();
      if (!vd.ok) {
        fail(vd.message || t('קוד שגוי', 'Invalid code'));
        return;
      }
      const s = await fetch(getApiUrl('/api/auth/phone-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verificationToken: vd.verificationToken }),
      });
      const sd = await s.json();
      if (sd.customToken) {
        const cred = await signInWithCustomToken(auth, sd.customToken);
        const idToken = await cred.user.getIdToken(true);
        await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
      }
      await finishAndRoute();
    } catch (e) {
      logger.error('[signup-v2] verify', e);
      fail(t('האימות נכשל', 'Verification failed'));
    } finally {
      setBusy(false);
    }
  }

  async function social(which: 'google' | 'apple') {
    if (!terms) {
      fail(t('יש לאשר את התנאים ומדיניות הפרטיות', 'Please accept the Terms and Privacy Policy.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const provider = which === 'google' ? createGoogleProvider() : createAppleProvider();
      if (getAuthStrategy() === 'redirect') {
        await signInWithRedirect(auth, provider);
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      await finishAndRoute();
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user') return;
      logger.error('[signup-v2] social', e);
      fail(
        which === 'google'
          ? t('התחברות Google לא הושלמה', 'Google sign-in did not complete.')
          : t('התחברות Apple לא הושלמה', 'Apple sign-in did not complete.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} style={S.bg}>
      <main style={S.page} aria-labelledby="su-title">
        <div style={S.mark}>
          PetWash<span style={S.tm}>™</span>
        </div>

        {!sent ? (
          <>
            <h1 id="su-title" style={S.h1}>
              {t('פתיחת חשבון', 'Create your account')}
            </h1>
            <p style={S.sub}>
              {t('הזינו מספר טלפון. נשלח קוד חד-פעמי.', "Enter your phone number. We'll send a one-time code.")}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
              noValidate
            >
              <div style={S.field}>
                <label style={S.label} htmlFor="su-phone">
                  {t('מספר טלפון', 'Phone number')}
                </label>
                <div style={S.phoneRow}>
                  <select
                    aria-label={t('קידומת מדינה', 'Country code')}
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    style={S.input}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    id="su-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder={country.example}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setError(null);
                    }}
                    style={S.input}
                  />
                </div>
                <div style={error ? { ...S.hint, ...S.hintErr } : S.hint}>
                  {error ?? t(`לדוגמה: ${country.example}`, `e.g. ${country.example}`)}
                </div>
              </div>

              <label style={S.terms}>
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={S.cb} />
                <span>
                  {t('אני מאשר/ת את ', 'I agree to the ')}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={S.link}>
                    {t('תנאי השימוש', 'Terms of Service')}
                  </a>
                  {t(' ו', ' and ')}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={S.link}>
                    {t('מדיניות הפרטיות', 'Privacy Policy')}
                  </a>
                  .
                </span>
              </label>

              <button type="submit" disabled={!canContinue} style={canContinue ? S.cta : { ...S.cta, ...S.ctaOff }}>
                {busy ? t('שולח…', 'Sending…') : t('המשך', 'Continue')}
              </button>

              <p style={S.signin}>
                {t('כבר יש חשבון? ', 'Already have an account? ')}
                <a href="/sign-in" style={S.link}>
                  {t('כניסה', 'Sign in')}
                </a>
              </p>
            </form>

            <div style={S.divider}>{t('או', 'or')}</div>

            <div style={S.social}>
              <button type="button" onClick={() => void social('google')} disabled={busy} style={S.socialBtn}>
                {t('המשך עם Google', 'Continue with Google')}
              </button>
              <button type="button" onClick={() => void social('apple')} disabled={busy} style={S.socialBtn}>
                {t('המשך עם Apple', 'Continue with Apple')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 style={S.h1}>{t('הזינו את הקוד', 'Enter the code')}</h1>
            <p style={S.sub}>{t(`שלחנו קוד אל ${fullPhone}`, `We sent a code to ${fullPhone}`)}</p>
            <OtpCodeInput length={6} onComplete={(c) => void verify(c)} loading={busy} language={he ? 'he' : 'en'} />
            {error && <div style={{ ...S.hint, ...S.hintErr, marginTop: 12 }}>{error}</div>}
            <button type="button" onClick={() => { setSent(false); setError(null); }} style={{ ...S.cta, ...S.ctaGhost, marginTop: 20 }}>
              {t('שינוי מספר', 'Change number')}
            </button>
          </>
        )}

        <p style={S.legal}>
          {t('מוגן באמצעות reCAPTCHA. ', 'Protected by reCAPTCHA. ')}
          <a href="/privacy" style={S.legalLink}>
            {t('מדיניות הפרטיות', 'Privacy Policy')}
          </a>
        </p>
      </main>
    </div>
  );
}

// Stage-white, ink-black, one accent. No gradients, no gold, no decoration.
const INK = '#0a0a0a';
const S: Record<string, CSSProperties> = {
  bg: { background: '#ffffff', color: INK, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", Helvetica, Arial, sans-serif' },
  page: { maxWidth: 440, margin: '0 auto', padding: '32px 24px 48px', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  mark: { fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', marginBottom: 40 },
  tm: { fontSize: 11, verticalAlign: 'super', opacity: 0.6, marginInlineStart: 2 },
  h1: { fontSize: 28, lineHeight: 1.2, letterSpacing: '-0.02em', fontWeight: 600, margin: '0 0 8px' },
  sub: { fontSize: 15, color: '#444', margin: '0 0 32px' },
  field: { marginBottom: 24 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 },
  phoneRow: { display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 },
  input: { height: 48, border: '1px solid #e5e5e5', borderRadius: 10, background: '#fff', color: INK, fontSize: 16, padding: '0 12px', outline: 'none', width: '100%' },
  hint: { fontSize: 12, color: '#8a8a8a', marginTop: 6 },
  hintErr: { color: '#b00020' },
  terms: { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#444', margin: '24px 0 16px' },
  cb: { width: 20, height: 20, minWidth: 20, accentColor: INK, marginTop: 1 },
  link: { color: INK, textDecoration: 'underline', textUnderlineOffset: 2 },
  cta: { width: '100%', height: 52, borderRadius: 10, border: 0, background: INK, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  ctaOff: { opacity: 0.35, cursor: 'not-allowed' },
  ctaGhost: { background: '#fff', color: INK, border: '1px solid #e5e5e5' },
  signin: { textAlign: 'center', marginTop: 24, fontSize: 14, color: '#444' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, color: '#8a8a8a', fontSize: 12, margin: '40px 0 24px' },
  social: { display: 'grid', gap: 10 },
  socialBtn: { height: 48, border: '1px solid #e5e5e5', background: '#fff', color: INK, fontSize: 15, borderRadius: 10, cursor: 'pointer' },
  legal: { marginTop: 'auto', paddingTop: 40, fontSize: 12, color: '#8a8a8a', textAlign: 'center' },
  legalLink: { color: '#8a8a8a', textDecoration: 'underline', textUnderlineOffset: 2 },
};
