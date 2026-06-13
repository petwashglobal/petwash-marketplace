/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║  SIGNUP — PREMIUM RESPONSIVE REBUILD (operator brief 2026-05-26)  ║
 * ╠════════════════════════════════════════════════════════════════════╣
 * ║                                                                    ║
 * ║  Operator brief on 2026-05-26 supersedes the previous 2026-05-25  ║
 * ║  lock. New binding rules:                                          ║
 * ║                                                                    ║
 * ║   1. PetWash logo MUST be visually dominant — larger than the      ║
 * ║      "The Future of Pet Lifestyle" headline.                       ║
 * ║   2. Hero dog photo must SUPPORT the brand, not dominate.          ║
 * ║      On phones it scales down (and may shrink further on very      ║
 * ║      small screens) so it never pushes the CTA out of reach.       ║
 * ║   3. CTA "Send Verification Code" / "Create Secure Account" must   ║
 * ║      be reachable without a duplicate hero CTA competing for taps. ║
 * ║   4. Tap targets ≥44 px (Apple HIG) — already the case for         ║
 * ║      every interactive element here, do not regress.               ║
 * ║   5. Use 100dvh + env(safe-area-inset-*) so the page survives      ║
 * ║      iOS Safari toolbar + home indicator without dead bands.       ║
 * ║   6. Two-column on ≥1024 px (iPad landscape, desktop). Single      ║
 * ║      column on phones; iPad portrait uses a balanced two-column     ║
 * ║      layout so the form is visible.                                ║
 * ║   7. RTL parity — every layout primitive switches sides on `he`.   ║
 * ║                                                                    ║
 * ║  Previous lock history (kept for context):                         ║
 * ║   - PR #458 (REVERTED in PR #459): hid dog on small mobile. The    ║
 * ║     2026-05-26 brief explicitly permits scaling the dog DOWN       ║
 * ║     (and hiding it on <480 px) so the CTA stays reachable.         ║
 * ║                                                                    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 *
 * SignUpLuxury — canonical /signup front door (black-luxury 2026, full
 * mockup). Locked to the owner's design brief: pure-black background, gold
 * accent, two-column on landscape iPad + desktop, and a compact direct
 * signup form on phones.
 *
 * Responsive contract:
 *   ≤767px (phones)         → single column, compact direct signup
 *   768–1023px (iPad portrait) → two columns, single step, full form
 *   ≥1024px (iPad landscape, desktop) → two columns, single step,
 *                                       sticky left, max-width 1440px
 *
 * Auth wiring (real, do not break):
 *   - Google OAuth (ff.auth.signup.google_signin.enabled, default ON)
 *   - Apple OAuth  (ff.auth.signup.apple_signin.enabled, default OFF →
 *                   hidden until actually enabled)
 *   - Facebook OAuth / Instagram server-mediated OAuth
 *   - Mobile OTP (canonical /api/auth/sms/start + /verify)
 *   - Email / password (any domain, sign-in or sign-up)
 *
 * Signup is intentionally narrow: choose an auth method, accept terms, and
 * create/verify the account. Wallet passes, biometrics, remember-me, and
 * device password preferences belong after the account is verified.
 */
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  signInWithPopup, signInWithRedirect, signInWithCustomToken,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAuthStrategy, createGoogleProvider, createAppleProvider, createFacebookProvider } from '@/lib/iosAuthHandler';
import { getApiUrl } from '@/lib/apiConfig';
import { type Language } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { signupFlags } from '@/lib/authSignupFlags';
import { executeTurnstileInvisible } from '@/components/TurnstileWidget';
import {
  FaApple, FaFacebookF, FaInstagram, FaLock,
  FaShieldAlt, FaAppStoreIos, FaGooglePlay,
  FaCog, FaGift, FaCalendarAlt, FaHeartbeat,
  FaEnvelope, FaPhoneAlt, FaPaw,
} from 'react-icons/fa';

interface Props {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
}

type Flow = 'prestige' | 'provider' | 'guest' | 'booking' | 'general';

function normalizeFlow(raw: string | null): Flow {
  return raw === 'provider' || raw === 'guest' || raw === 'booking' || raw === 'prestige'
    ? raw : 'general';
}

function destForFlow(flow: Flow): string {
  switch (flow) {
    case 'provider': return '/provider-onboarding';
    case 'guest': return '/egift';
    case 'booking': return '/booking';
    case 'prestige': return '/dashboard';
    default: return '/dashboard';
  }
}

export default function SignUpLuxury({ language = 'en', onLanguageChange }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const he = language === 'he';

  useEffect(() => {
    const root = document.getElementById('root');
    document.documentElement.setAttribute('data-pw-page', 'signup');
    document.body.setAttribute('data-pw-page', 'signup');
    root?.setAttribute('data-pw-page', 'signup');

    return () => {
      document.documentElement.removeAttribute('data-pw-page');
      document.body.removeAttribute('data-pw-page');
      root?.removeAttribute('data-pw-page');
    };
  }, []);

  const params = useMemo(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );
  const flow = normalizeFlow(params.get('flow') || params.get('intent'));
  // ?redirect=/shop — return the user where they came from (shop cart, booking…).
  // Internal paths only: must start with a single '/' (blocks //evil.com and
  // proto:// open-redirects).
  const redirectParam = params.get('redirect');
  const safeRedirect = redirectParam && /^\/(?!\/)/.test(redirectParam) ? redirectParam : null;
  const dest = safeRedirect ?? destForFlow(flow);

  const { user } = useFirebaseAuth();
  useEffect(() => { if (user) navigate(dest); }, [user, dest, navigate]);

  const [method, setMethod] = useState<'mobile' | 'email' | 'other'>('mobile');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [smsProviderHealthy, setSmsProviderHealthy] = useState(true);

  const fail = (msg: string) => setInlineError(msg);

  useEffect(() => {
    if (!signupFlags.smsFallbackAndRealErrors || !signupFlags.emailPassword) return;

    let cancelled = false;
    fetch(getApiUrl('/api/auth/sms/status'), { credentials: 'include' })
      .then((res) => res.json())
      .then((status) => {
        if (cancelled || status?.smsProviderHealthy !== false) return;
        setSmsProviderHealthy(false);
        setMethod((current) => current === 'mobile' ? 'email' : current);
      })
      .catch((err) => {
        logger.warn('[signup] sms status unavailable', { error: err?.message });
      });

    return () => { cancelled = true; };
  }, []);

  const requireTerms = () => {
    if (!terms) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות' : 'Please accept the Terms and Privacy Policy to continue.'); return false; }
    return true;
  };

  async function finishAndRoute() {
    try { await fetch(getApiUrl('/api/session/whoami'), { credentials: 'include' }); }
    catch (e) { logger.error('[signup] whoami', e); }
    navigate(dest);
  }

  async function sendCode() {
    if (!phone) { fail(he ? 'הזן מספר טלפון' : 'Enter your mobile number'); return; }
    if (!requireTerms()) return;
    setInlineError(null);
    setBusy(true);
    try {
      // Real bot protection via Cloudflare Turnstile (invisible).
      // Returns null when VITE_TURNSTILE_SITE_KEY is unset (dev/staging
      // without the secret) — the server treats Turnstile as best-effort
      // bonus signal, never blocking, so a missing token is safe.
      const turnstileToken = await executeTurnstileInvisible('signup_sms_start').catch(() => null);
      const r = await fetch(getApiUrl('/api/auth/sms/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, language, flow, turnstileToken }),
      });
      const d = await r.json();
      if (!d.ok) {
        if (signupFlags.smsFallbackAndRealErrors) {
          setSmsProviderHealthy(false);
          if (signupFlags.emailPassword) setMethod('email');
        }
        fail(d.message || (he ? 'SMS אינו זמין כעת — המשך עם אימייל.' : 'SMS is temporarily unavailable — continue with email.'));
        return;
      }
      setSent(true);
      toast({ title: he ? 'קוד נשלח 📲' : 'Code sent 📲' });
    } catch (e) { logger.error('[signup] sendCode', e); fail(he ? 'שגיאת רשת' : 'Network error'); }
    finally { setBusy(false); }
  }

  async function verify(c: string) {
    setInlineError(null);
    setBusy(true);
    try {
      const v = await fetch(getApiUrl('/api/auth/sms/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, code: c, language, flow }),
      });
      const vd = await v.json();
      if (!vd.ok) { fail(vd.message || (he ? 'קוד שגוי' : 'Invalid code')); return; }
      const s = await fetch(getApiUrl('/api/auth/phone-session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ verificationToken: vd.verificationToken }),
      });
      const sd = await s.json();
      if (sd.customToken) {
        const cred = await signInWithCustomToken(auth, sd.customToken);
        const idToken = await cred.user.getIdToken(true);
        await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
      }
      await finishAndRoute();
    } catch (e) { logger.error('[signup] verify', e); fail(he ? 'האימות נכשל' : 'Verification failed'); }
    finally { setBusy(false); }
  }

  async function social(which: 'google' | 'apple' | 'facebook') {
    if (!terms) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות' : 'Please accept the Terms and Privacy Policy to continue.'); return; }
    setInlineError(null);
    setBusy(true);
    try {
      const provider =
        which === 'google' ? createGoogleProvider() :
        which === 'apple'  ? createAppleProvider()  :
                             createFacebookProvider();
      if (getAuthStrategy() === 'redirect') {
        await signInWithRedirect(auth, provider);
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      await finishAndRoute();
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user') return;
      logger.error('[signup] social', e);
      const label = which === 'google' ? 'Google' : which === 'apple' ? 'Apple' : 'Facebook';
      fail(he
        ? `התחברות ${label} לא הושלמה — נסה נייד או אימייל`
        : `${label} sign-in did not complete. Please try mobile or email.`);
    } finally { setBusy(false); }
  }

  /** Server-mediated OAuth (Instagram / TikTok / etc.). The backend builds the
   *  authorize URL with provider secrets and we redirect the browser there. */
  async function socialExternal(which: 'instagram' | 'tiktok') {
    if (!terms) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות' : 'Please accept the Terms and Privacy Policy to continue.'); return; }
    setInlineError(null);
    setBusy(true);
    try {
      const r = await fetch(getApiUrl(`/api/auth/social/${which}/authorize`), { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (d?.authUrl) { window.location.href = d.authUrl; return; }
      const label = which === 'instagram' ? 'Instagram' : 'TikTok';
      fail(he ? `${label} עדיין לא פעיל — נסה Google, נייד או אימייל` : `${label} sign-in is not active yet — please try Google, mobile or email.`);
    } catch (e) {
      logger.error('[signup] socialExternal', e);
      fail(he ? 'שגיאת רשת' : 'Network error');
    } finally { setBusy(false); }
  }

  async function emailSubmit() {
    if (!email || !password) { fail(he ? 'הזן אימייל וסיסמה' : 'Enter your email and password'); return; }
    if (!requireTerms()) return;
    setInlineError(null);
    setBusy(true);
    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } catch (e: any) {
        const newUser = e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential';
        if (newUser) {
          if (password !== confirm) { fail(he ? 'אשר את הסיסמה כדי ליצור חשבון חדש' : 'Confirm your password to create a new account.'); return; }
          try {
            cred = await createUserWithEmailAndPassword(auth, email, password);
            try { await sendEmailVerification(cred.user); } catch { /* non-blocking */ }
          } catch (ce: any) {
            if (ce?.code === 'auth/email-already-in-use') { fail(he ? 'החשבון קיים — בדוק את הסיסמה' : 'Account exists — please check your password.'); return; }
            if (ce?.code === 'auth/weak-password') { fail(he ? 'סיסמה חלשה מדי (6 תווים לפחות)' : 'Password too weak (min 6 characters).'); return; }
            throw ce;
          }
        } else if (e?.code === 'auth/wrong-password') {
          fail(he ? 'סיסמה שגויה' : 'Wrong password.'); return;
        } else if (e?.code === 'auth/invalid-email') {
          fail(he ? 'כתובת אימייל לא תקינה' : 'Invalid email address.'); return;
        } else { throw e; }
      }
      const idToken = await cred.user.getIdToken(true);
      await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      await finishAndRoute();
    } catch (e) { logger.error('[signup] email', e); fail(he ? 'ההתחברות נכשלה' : 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  const readyForSubmit = terms && !busy && (
    method === 'mobile'
      ? phone.length > 4
      : email.length > 3 && password.length > 0
  );

  // CTA label adapts to the actual action.
  const ctaLabel = busy ? '…' : (
    method === 'mobile' ? (he ? 'שלח קוד אימות' : 'Send Verification Code') : (he ? 'צור חשבון מאובטח' : 'Create Secure Account')
  );

  const t = {
    eyebrow: he ? 'אקוסיסטם חכם לטיפול בחיות מחמד' : 'INTELLIGENT PET-CARE ECOSYSTEM',
    h1a: he ? 'העתיד של' : 'The Future of',
    h1b: he ? 'חיי חיות המחמד' : 'Pet Lifestyle',
    sub1: he ? 'שמונה פלטפורמות מהפכניות.' : 'Eight Revolutionary Platforms.',
    sub2: he ? 'אקוסיסטם חכם אחד לטיפול בחיות מחמד.' : 'One Intelligent Pet-Care Ecosystem.',
    premium: he ? 'חוויית פרמיום' : 'PREMIUM EXPERIENCE',
    premiumSub: he ? 'חכם. מאובטח. חלק.' : 'Intelligent. Secure. Seamless.',
    badges: he
      ? [{ t: 'טיפול חכם בכוח AI', I: FaCog }, { t: 'תגמולי VIP', I: FaGift }, { t: 'הזמנה חכמה', I: FaCalendarAlt }, { t: 'מעקב בריאות', I: FaHeartbeat }]
      : [{ t: 'AI Powered Pet Care', I: FaCog }, { t: 'VIP Rewards', I: FaGift }, { t: 'Smart Booking', I: FaCalendarAlt }, { t: 'Health Tracking', I: FaHeartbeat }],
    trusted: he ? 'נפתחים בקרוב בכפר סבא' : 'Opening soon in Kfar Saba',
    rating: he ? 'טיפול טבעי פרימיום · מותג ישראלי' : 'Premium natural care · Israeli brand',
    secure: he ? 'מאובטח · פרטי · מוצפן' : 'SECURE · PRIVATE · ENCRYPTED',
    secureSub: he ? 'הנתונים שלך מוגנים ומוצפנים.' : 'Your data is protected and encrypted.',

    create: he ? 'צור את החשבון שלך' : 'Create Your Account',
    helper: he ? 'הצטרף לעתיד של טיפול חכם בחיות מחמד' : 'Join the future of intelligent pet care',
    cwGoogle: he ? 'המשך עם Google' : 'Continue with Google',
    cwApple: he ? 'המשך עם Apple' : 'Continue with Apple',
    cwFb: he ? 'המשך עם Facebook' : 'Continue with Facebook',
    cwIg: he ? 'המשך עם Instagram' : 'Continue with Instagram',
    soon: he ? 'בקרוב' : 'SOON',
    or: he ? 'או הירשם עם' : 'or sign up with',
    tabMobile: he ? 'נייד' : 'Mobile',
    tabEmail: he ? 'אימייל' : 'Email',
    tabOther: he ? 'אימייל אחר' : 'Other Email',
    phoneLabel: he ? 'מספר נייד' : 'Mobile Number',
    phonePh: he ? 'הזן את מספר הנייד' : 'Enter your mobile number',
    emailPh: 'name@email.com',
    emailLabel: he ? 'אימייל' : 'Email',
    pwd: he ? 'סיסמה' : 'Password',
    pwd2: he ? 'אישור סיסמה (לחשבון חדש)' : 'Confirm password (new account)',

    iAgree: he ? 'אני מסכים/ה ל' : 'I agree to the ',
    termsLink: he ? 'תנאי השימוש' : 'Terms of Service',
    andTo: he ? ' ול' : ' and ',
    privLink: he ? 'מדיניות הפרטיות' : 'Privacy Policy',

    cta: he ? 'צור חשבון מאובטח' : 'Create Secure Account',
    completeFields: he ? 'אשר תנאים והזן פרטים כדי להמשיך.' : 'Accept the terms and enter your details to continue.',
    bank: he ? 'מאובטח ומוצפן' : 'Secure & encrypted',
    enc: he ? 'הצפנת 256-bit' : '256-bit encryption',
    safe: he ? 'הנתונים שלך בטוחים' : 'Your data is safe',

    dlTitle: he ? 'הורד את האפליקציה שלנו' : 'Download Our App',
    dlSub: he ? 'גש לכל הפיצ׳רים בנייד' : 'Access all features on the go',
    storeApple: 'App Store',
    storeAppleLine: he ? 'הורד מ-' : 'Download on the',
    storeGoogle: 'Google Play',
    storeGoogleLine: 'GET IT ON',
    comingSoon: he ? 'בקרוב' : 'Coming soon',
  };

  return (
    <div id="petwash-signup-page" className="sl-shell" dir={he ? 'rtl' : 'ltr'}>
      <style>{styles(he)}</style>

      {/* Centered max-width frame so 27" iMacs don't stretch */}
      <div className="sl-frame">

        {/* ================= LEFT COLUMN (HERO) ================= */}
        <aside className="sl-hero">
          <header className="sl-heroHead">
            <img src="/brand/petwash-logo-white-tight.png" alt="PetWash" className="sl-logo" width={365} height={123} decoding="async" />
            <div className="sl-eyebrow">{t.eyebrow}</div>
          </header>

          <h1 className="sl-h1">
            {t.h1a}<br />
            <span className="sl-gold">{t.h1b}</span>
          </h1>

          <p className="sl-sub">{t.sub1}<br />{t.sub2}</p>

          <div className="sl-divPaw" aria-hidden>
            <span /><FaPaw /><span />
          </div>

          <div className="sl-dogWrap">
            <img src="/brand/hero-dog-lux.jpg" alt="" className="sl-dog" loading="eager" decoding="async" aria-hidden />
          </div>

          <section className="sl-card">
            <div className="sl-cardHead">
              <div className="sl-cardTitle">{t.premium}</div>
              <div className="sl-cardSub">{t.premiumSub}</div>
            </div>
            <div className="sl-badges">
              {t.badges.map(({ t: label, I }) => (
                <div key={label} className="sl-badge">
                  <I className="sl-badgeIcon" aria-hidden />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Honest pre-launch card — removed fabricated +25K users, ★★★★★ and
              "4.9/5" rating (no real ratings exist pre-launch; fake reviews are a
              consumer-protection violation). */}
          <section className="sl-card sl-trustCard">
            <div className="sl-cardTitle">{t.trusted}</div>
            <div className="sl-ratingTxt">{t.rating}</div>
          </section>

          <div className="sl-secBadge">
            <FaShieldAlt aria-hidden />
            <div>
              <div className="sl-secBadgeTitle">{t.secure}</div>
              <div className="sl-secBadgeSub">{t.secureSub}</div>
            </div>
          </div>
        </aside>

        {/* ================= RIGHT COLUMN (FORM) ================= */}
        <main className="sl-panel" role="main">
          <header className="sl-panelHead">
            <div>
              <h2 className="sl-title">{t.create}</h2>
              <p className="sl-helper">{t.helper}</p>
            </div>
            {onLanguageChange && (
              <button
                type="button"
                className="sl-lang"
                onClick={() => onLanguageChange(he ? 'en' : 'he')}
                aria-label="Switch language"
              >
                🌐 {he ? 'עברית' : 'English'} ▾
              </button>
            )}
          </header>

          {!sent && (
            <label className="sl-terms sl-terms--quick">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                {t.iAgree}
                <a href="/terms" target="_blank" rel="noreferrer">{t.termsLink}</a>
                {t.andTo}
                <a href="/privacy-policy" target="_blank" rel="noreferrer">{t.privLink}</a>
              </span>
            </label>
          )}

          {inlineError && (
            <p className="sl-inlineError" role="alert">{inlineError}</p>
          )}

          {/* === Method tabs === */}
          {!sent && (
            <div className="sl-tabs" role="tablist">
              <button type="button" className="sl-tab" role="tab" aria-selected={method === 'mobile'} onClick={() => { setMethod('mobile'); setSent(false); }}>
                <FaPhoneAlt aria-hidden /> {t.tabMobile}
              </button>
              {signupFlags.emailPassword && (
                <button type="button" className="sl-tab" role="tab" aria-selected={method === 'email'} onClick={() => setMethod('email')}>
                  <FaEnvelope aria-hidden /> {t.tabEmail}
                </button>
              )}
              {signupFlags.emailPassword && (
                <button type="button" className="sl-tab" role="tab" aria-selected={method === 'other'} onClick={() => setMethod('other')}>
                  <FaEnvelope aria-hidden /> {t.tabOther}
                </button>
              )}
            </div>
          )}

          {/* === Auth method inputs === */}
          {method === 'mobile' && !sent && (
            <>
              {signupFlags.smsFallbackAndRealErrors && !smsProviderHealthy && (
                <p className="sl-inlineError" role="status">
                  {he ? 'SMS אינו זמין כעת — אפשר להמשיך עם אימייל.' : 'SMS is temporarily unavailable — continue with email.'}
                </p>
              )}
              <div className="sl-field">
                <label className="sl-label">{t.phoneLabel}</label>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
              </div>
            </>
          )}

          {(method === 'email' || method === 'other') && !sent && (
            <>
              <div className="sl-field">
                <label className="sl-label">{t.emailLabel}</label>
                <div className="sl-inputWrap">
                  <FaEnvelope className="sl-inputIcon" aria-hidden />
                  <input className="sl-input sl-input--icon" type="email" inputMode="email" autoComplete="username email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={method === 'other' ? (he ? 'Outlook, Yahoo, ProtonMail, אחר…' : 'Outlook, Yahoo, ProtonMail, other…') : t.emailPh} />
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label">{t.pwd}</label>
                <div className="sl-inputWrap">
                  <FaLock className="sl-inputIcon" aria-hidden />
                  <input className="sl-input sl-input--icon" type="password" autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label">{t.pwd2}</label>
                <div className="sl-inputWrap">
                  <FaLock className="sl-inputIcon" aria-hidden />
                  <input className="sl-input sl-input--icon" type="password" autoComplete="new-password"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
            </>
          )}

          {/* === OTP — appears after we send the SMS === */}
          {method === 'mobile' && sent && (
            <>
              <p className="sl-helper sl-center">{he ? `הזן את הקוד שנשלח ל-${phone}` : `Enter the code sent to ${phone}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verify(c); }} loading={busy} language={he ? 'he' : 'en'} />
              <button className="sl-btn" disabled={busy} onClick={() => setSent(false)}>{he ? 'שלח קוד חדש' : 'Resend code'}</button>
            </>
          )}

          {!sent && (
            <>
              <button className="sl-cta" disabled={!readyForSubmit}
                onClick={() => ((method === 'email' || method === 'other') ? void emailSubmit() : void sendCode())}>
                <FaLock aria-hidden /> {ctaLabel}
              </button>
              {!readyForSubmit && <div className="sl-hint sl-submitHint">{t.completeFields}</div>}

              <div className="sl-bank">
                <FaShieldAlt aria-hidden /> <span>{t.bank}</span>
                <span aria-hidden> · </span>
                <span>{t.enc}</span>
                <span aria-hidden> · </span>
                <span>{t.safe}</span>
              </div>

              <div className="sl-div">{t.or}</div>

              {/* === Social tiles — real auth alternatives, below phone-first signup. === */}
              <div className="sl-social4">
                {signupFlags.googleSignin && (
                  <button className="sl-soc" disabled={busy} onClick={() => social('google')}>
                    <GoogleIcon /> <span className="sl-socLabel">{t.cwGoogle}</span>
                  </button>
                )}

                {signupFlags.appleSignin && (
                  <button className="sl-soc sl-soc--apple" disabled={busy} onClick={() => social('apple')}>
                    <FaApple aria-hidden /> <span className="sl-socLabel">{t.cwApple}</span>
                  </button>
                )}

                <button className="sl-soc sl-soc--fb" disabled={busy} onClick={() => social('facebook')}>
                  <span className="sl-fbIcon" aria-hidden><FaFacebookF /></span>
                  <span className="sl-socLabel">{t.cwFb}</span>
                </button>

                <button className="sl-soc sl-soc--ig" disabled={busy} onClick={() => socialExternal('instagram')}>
                  <span className="sl-igIcon" aria-hidden><FaInstagram /></span>
                  <span className="sl-socLabel">{t.cwIg}</span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ================= DOWNLOAD APP BANNER ================= */}
      <section className="sl-dl">
        <div className="sl-dlLeft">
          <span className="sl-dlPaw" aria-hidden><FaPaw /></span>
          <div>
            <div className="sl-dlTitle">{t.dlTitle}</div>
            <div className="sl-dlSub">{t.dlSub}</div>
          </div>
        </div>
        <div className="sl-dlRight">
          {/* App-store badges intentionally disabled until the native app is
              actually published. The Apple URL still carried the placeholder
              `id1234567890` (broken App Store page) and the Google Play bundle
              id `co.il.petwash` did not match the registered Expo scaffold
              `il.co.petwash.staff`. Both badges now render as disabled spans
              with a "בקרוב / Coming soon" label so visitors get honest UX
              instead of broken store links. When the app ships, swap the
              spans back to <a> with the real URLs. */}
          <span className="sl-store" aria-disabled="true" style={{ cursor: 'not-allowed', opacity: 0.6 }} title={t.comingSoon ?? 'בקרוב'}>
            <FaAppStoreIos aria-hidden />
            <span><small>{t.storeAppleLine}</small><strong>{t.storeApple}</strong></span>
          </span>
          <span className="sl-store" aria-disabled="true" style={{ cursor: 'not-allowed', opacity: 0.6 }} title={t.comingSoon ?? 'בקרוב'}>
            <FaGooglePlay aria-hidden />
            <span><small>{t.storeGoogleLine}</small><strong>{t.storeGoogle}</strong></span>
          </span>
          <div className="sl-qr" aria-hidden>
            <QrSquare />
          </div>
        </div>
      </section>

    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function GoogleIcon() {
  return (
    <svg className="sl-gIcon" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function QrSquare() {
  const cells = [
    '1111111011111110', '1000001011001010', '1011101010111010',
    '1011101011010110', '1011101011001010', '1000001010100110',
    '1111111010101010', '0000000010111100', '1100110110010010',
    '1011011000111110', '0010011011000110', '0001110110111010',
    '1111111011010010', '1000001011111010', '1011101010001100',
    '1011101011100110',
  ];
  return (
    <svg className="sl-qrSvg" viewBox="0 0 16 16" role="img" aria-label="QR code">
      <rect width="16" height="16" fill="#fffaf0" />
      {cells.map((row, y) => row.split('').map((c, x) => (
        c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0a0a" /> : null
      )))}
    </svg>
  );
}

// ============================================================
// Styles
// ============================================================

function styles(he: boolean) {
  return `
    /* ── Page-scoped overrides ────────────────────────────────────────────
     * The global html/body bg in client/index.html:101-104 is white.
     * That shows through as "white empty space" on iOS Safari overscroll
     * and on short content. The signup page is a dark luxury surface, so
     * we override body bg to black while this component is mounted and
     * disable overscroll bounce so the dark canvas never breaks.
     * The style tag unmounts with the page, restoring the global rule.
     */
    html, body, #root {
      background:#000 !important;
      background-color:#000 !important;
      overscroll-behavior:none;
      margin:0 !important;
    }
    body[data-pw-page="signup"] {
      padding-top:0 !important;
      padding-bottom:0 !important;
      min-height:100dvh;
      overflow-x:hidden;
    }

    body > #root > #petwash-signup-page.sl-shell,
    #petwash-signup-page.sl-shell {
      background:#000 !important;
      background-color:#000 !important;
    }

    .sl-shell{
      --gold:#b0841c; --gold2:#d9bd72; --gold3:#8f6a16; --white:#fffaf0;
      --muted:rgba(255,250,240,.6); --line:rgba(255,255,255,.10);
      --line2:rgba(176,132,28,.22); --ink:#0a0a0a;
      position:relative; min-height:100dvh; background:#000 !important;
      background-color:#000 !important;
      color:var(--white);
      font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      /* iOS notch + bottom home indicator. Top inset is added once at the
       * shell so it applies before any internal scroll. */
      padding-top:0;
      padding-left:env(safe-area-inset-left);
      padding-right:env(safe-area-inset-right);
    }
    @supports not (height:100dvh){ .sl-shell{ min-height:100vh } }

    /* Frame caps the layout at 1440px and centers it on big screens. */
    .sl-frame{
      max-width:1440px; margin:0 auto;
      display:flex; flex-direction:column;
      padding:clamp(20px,4vw,40px) clamp(16px,3vw,40px) 0;
      gap:clamp(20px,3vw,32px);
    }

    /* HERO LEFT — logo dominant, headline subordinate, dog supports */
    .sl-hero{ display:flex; flex-direction:column; gap:18px; align-items:center; text-align:center }
    .sl-heroHead{ display:flex; flex-direction:column; gap:12px; align-items:center; text-align:center; width:100% }
    /* Logo is width-driven so it stays the dominant first-read brand mark. */
    .sl-logo{ width:clamp(320px,38vw,520px); max-width:100%; height:auto; display:block; object-fit:contain }
    .sl-eyebrow{ color:var(--muted); font-size:11px; letter-spacing:.32em; font-weight:800; text-transform:uppercase }
    /* Headline is intentionally smaller than the logo above. */
    .sl-h1{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(28px,3.1vw,44px); line-height:1.06; letter-spacing:-.01em; margin:0; font-weight:600; text-align:center }
    .sl-gold{ background:linear-gradient(180deg, #ead8a5 0%, var(--gold2) 18%, var(--gold) 62%, var(--gold3) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; display:inline-block; padding-bottom:.08em }
    .sl-sub{ margin:0 auto; color:var(--muted); font-size:clamp(14px,1.4vw,17px); line-height:1.5; max-width:520px; text-align:center }

    .sl-divPaw{ display:flex; align-items:center; gap:10px; color:var(--gold); margin:2px 0 }
    .sl-divPaw span{ height:1px; background:linear-gradient(90deg, transparent, rgba(176,132,28,.45), transparent); flex:1 }
    .sl-divPaw svg{ width:14px; height:14px }

    /* Dog can be large and emotional, but it supports the brand identity. */
    .sl-dogWrap{ display:flex; justify-content:center; padding:4px 0 }
    .sl-dog{ width:min(58%, 340px); height:auto; aspect-ratio:1/1.05; object-fit:cover; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.06) }

    .sl-card{
      border:1px solid var(--line);
      background:linear-gradient(160deg, rgba(255,255,255,.04), rgba(0,0,0,.55));
      border-radius:18px; padding:18px;
      display:flex; flex-direction:column; gap:14px;
    }
    .sl-cardHead{ text-align:center; display:flex; flex-direction:column; gap:4px }
    .sl-cardTitle{ color:var(--gold2); font-size:11.5px; letter-spacing:.32em; text-transform:uppercase; font-weight:900 }
    .sl-cardSub{ color:var(--white); font-size:14px; opacity:.95 }

    .sl-badges{ display:grid; grid-template-columns:repeat(4, 1fr); gap:8px }
    .sl-badge{
      display:flex; flex-direction:column; align-items:center; gap:8px;
      padding:14px 8px; border-radius:14px;
      background:rgba(0,0,0,.45); border:1px solid var(--line);
      font-weight:700; font-size:11.5px; text-align:center; color:var(--white); line-height:1.25;
      min-height:88px; justify-content:center;
    }
    .sl-badgeIcon{ font-size:24px; color:var(--gold2) }

    .sl-trustCard{ align-items:center; text-align:center }
    .sl-avatars{ display:flex; align-items:center; ${he ? 'gap:6px' : 'gap:0'}; justify-content:center; flex-wrap:wrap }
    .sl-avatar{
      width:34px; height:34px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      color:#fff; font-weight:900; font-size:11px;
      border:2px solid #0a0a0a; box-shadow:0 4px 12px rgba(0,0,0,.5);
      margin-${he ? 'right' : 'left'}:-8px;
    }
    .sl-avatar:first-child{ margin-${he ? 'right' : 'left'}:0 }
    .sl-avatarMore{
      margin-${he ? 'right' : 'left'}:10px; padding:5px 10px; border-radius:999px;
      background:linear-gradient(135deg, var(--gold2), var(--gold));
      color:#0a0a0a; font-weight:900; font-size:11px;
    }
    .sl-stars{ color:var(--gold2); font-size:18px; letter-spacing:4px; text-shadow:0 0 12px rgba(176,132,28,.5) }
    .sl-ratingTxt{ color:var(--white); font-weight:800; font-size:14px }

    .sl-secBadge{
      display:flex; align-items:center; gap:12px;
      padding:14px 16px; border-radius:14px;
      background:rgba(0,0,0,.55); border:1px solid var(--line);
    }
    .sl-secBadge > svg{ color:var(--gold2); font-size:22px; flex:0 0 auto }
    .sl-secBadgeTitle{ font-size:11.5px; letter-spacing:.24em; font-weight:900; color:var(--white); text-transform:uppercase }
    .sl-secBadgeSub{ color:var(--muted); font-size:12.5px; margin-top:2px }

    /* PANEL RIGHT */
    .sl-panel{
      display:flex; flex-direction:column; gap:14px;
      border:1px solid var(--line);
      background:linear-gradient(180deg, rgba(20,20,20,.95), rgba(8,8,8,.95)) !important;
      background-color:#090909 !important;
      border-radius:24px; padding:clamp(20px,3vw,32px);
    }
    .sl-panelHead{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap }
    .sl-title{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(28px,3.6vw,42px); margin:0; line-height:1.05; font-weight:600 }
    .sl-helper{ margin:4px 0 0; color:var(--muted); font-size:15px; line-height:1.5 }
    .sl-helper.sl-center{ text-align:center }
    .sl-lang{
      appearance:none; cursor:pointer;
      border:1px solid var(--line); background:rgba(0,0,0,.5);
      color:var(--white); font-weight:700; font-size:13px;
      border-radius:999px; padding:10px 16px; min-height:44px;
    }
    .sl-lang:hover{ border-color:rgba(176,132,28,.5) }

    /* Social tiles 2x2 */
    .sl-social4{ display:grid; grid-template-columns:1fr 1fr; gap:10px }
    .sl-soc{
      appearance:none; cursor:pointer; position:relative;
      min-height:60px; border-radius:14px;
      border:1px solid var(--line); background:rgba(0,0,0,.55);
      color:var(--white); display:flex; align-items:center; gap:12px; padding:0 16px;
      font-weight:700; font-size:14px; line-height:1.2;
      transition:transform .15s ease, border-color .15s ease, box-shadow .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-soc:hover:not(:disabled){ transform:translateY(-1px); border-color:rgba(176,132,28,.45); box-shadow:0 0 0 3px rgba(176,132,28,.10) }
    .sl-soc:disabled{ cursor:not-allowed }
    .sl-socLabel{ flex:1; min-width:0; text-align:start; overflow-wrap:normal }
    .sl-gIcon{ width:24px; height:24px; flex:0 0 auto }
    .sl-fbIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:#1877F2; display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-fbIcon svg{ font-size:14px }
    .sl-igIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:linear-gradient(135deg, #fdc468 0%, #d83689 50%, #5b4ad0 100%); display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-igIcon svg{ font-size:14px }
    .sl-soc--apple svg{ font-size:22px }
    .sl-div{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; color:var(--muted); font-size:13px; font-weight:600; padding:4px 0 }
    .sl-div:before, .sl-div:after{ content:""; height:1px; background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent) }

    /* Method tabs */
    .sl-tabs{ display:grid; grid-template-columns:repeat(3, 1fr); gap:8px }
    .sl-tab{
      appearance:none; cursor:pointer; min-height:54px;
      background:rgba(0,0,0,.55); border:1px solid var(--line);
      color:var(--muted); font-weight:700; font-size:13.5px;
      border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px;
      padding:0 8px; transition:background .15s ease, border-color .15s ease, color .15s ease;
    }
    .sl-tab svg{ font-size:16px }
    .sl-tab[aria-selected="true"]{ background:rgba(176,132,28,.12); border-color:rgba(176,132,28,.4); color:var(--white) }
    .sl-tab:hover{ border-color:rgba(176,132,28,.35) }

    /* Fields */
    .sl-field{ display:grid; gap:8px }
    .sl-label{ font-size:13.5px; color:var(--white); font-weight:700; letter-spacing:.01em }
    .sl-labelWithInfo{ display:flex; align-items:center; gap:6px }
    .sl-infoIcon{ color:var(--muted); font-size:12px }
    .sl-inputWrap{ position:relative; display:flex }
    .sl-inputIcon{
      position:absolute; top:50%; transform:translateY(-50%);
      ${he ? 'right:14px' : 'left:14px'}; color:var(--muted); font-size:16px; pointer-events:none;
    }
    .sl-input{
      width:100%; min-height:54px; border-radius:12px;
      border:1px solid var(--line); background:rgba(0,0,0,.55);
      color:var(--white); font-size:16px; font-weight:500;
      padding:0 16px; outline:none;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    .sl-input--icon{ ${he ? 'padding-right:42px; padding-left:16px' : 'padding-left:42px; padding-right:16px'} }
    .sl-input::placeholder{ color:rgba(255,250,240,.4); font-weight:400 }
    .sl-input:focus{ border-color:rgba(176,132,28,.55); box-shadow:0 0 0 3px rgba(176,132,28,.18) }
    .sl-hint{ color:var(--muted); font-size:12.5px; line-height:1.4 }
    .sl-inlineError{
      margin:0;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(255,90,90,.4);
      background:rgba(150,20,20,.22);
      color:#ffd7d7;
      font-size:13px;
      font-weight:700;
      line-height:1.35;
    }
    .sl-submitHint{ text-align:center; margin-top:-3px }
    .sl-field .intl-phone-wrapper{
      min-height:54px;
      border-radius:12px !important;
      padding:9px 14px !important;
      background:rgba(0,0,0,.55) !important;
      border-color:var(--line) !important;
      color:var(--white) !important;
    }
    .sl-field .intl-phone-wrapper .PhoneInput{ gap:10px }
    .sl-field .intl-phone-wrapper .PhoneInputCountry{ margin-right:8px }
    .sl-field .intl-phone-wrapper .PhoneInputInput{
      min-width:0;
      font-size:16px;
      background:transparent !important;
      color:var(--white) !important;
    }
    .sl-field .intl-phone-wrapper .PhoneInputInput::placeholder{ color:rgba(255,250,240,.42) !important }
    .sl-field .intl-phone-wrapper .PhoneInputCountrySelect{ color:var(--white) !important }
    .sl-field .intl-phone-wrapper .PhoneInputCountrySelectArrow{ color:var(--gold2) !important; opacity:.9 }

    /* Terms — entire row is the tap target (label wraps the checkbox + text).
     * Checkbox visible size is 24 px and min-height:44 px gives an easy tap. */
    .sl-terms{
      display:flex; align-items:flex-start; gap:12px; cursor:pointer;
      color:var(--muted); font-size:13px; line-height:1.5;
      min-height:44px; padding:6px 0;
    }
    .sl-terms input{ width:24px; height:24px; accent-color:var(--gold); flex:0 0 auto; margin-top:1px }
    .sl-terms a{ color:var(--gold2); font-weight:700; text-decoration:underline }
    .sl-terms--quick{
      margin:-2px 0 0;
      padding:10px 12px;
      border:1px solid rgba(176,132,28,.24);
      border-radius:14px;
      background:rgba(176,132,28,.06);
    }

    /* CTA — premium gold gradient (luxury house brand). Min-height 58px keeps
     * it well above the 44 px tap-target floor on every device. */
    .sl-cta{
      appearance:none; cursor:pointer; width:100%; min-height:58px;
      border-radius:14px; border:0;
      background:linear-gradient(180deg, #ead8a5 0%, var(--gold2) 16%, var(--gold) 58%, var(--gold3) 100%);
      color:#0a0a0a;
      display:flex; align-items:center; justify-content:center; gap:10px;
      font-weight:900; font-size:16px; letter-spacing:.02em;
      box-shadow:0 18px 50px rgba(176,132,28,.28);
      transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-cta:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.06); box-shadow:0 22px 64px rgba(176,132,28,.5) }
    .sl-cta:disabled{ opacity:.5; cursor:not-allowed }
    .sl-cta svg{ font-size:18px }
    .sl-btn{
      appearance:none; cursor:pointer; width:100%; min-height:48px;
      border-radius:12px; border:1px solid var(--line);
      background:rgba(0,0,0,.4); color:var(--white);
      font-weight:700; font-size:14px;
    }

    .sl-bank{
      display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;
      color:var(--muted); font-size:12.5px; padding-top:4px;
    }
    .sl-bank svg{ color:var(--gold2); font-size:13px }

    /* DOWNLOAD APP BANNER */
    .sl-dl{
      max-width:1440px; margin:clamp(24px,3vw,40px) auto 0;
      padding:clamp(18px,2.5vw,24px) clamp(16px,3vw,32px);
      border-top:1px solid var(--line);
      display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap;
    }
    .sl-dlLeft{ display:flex; align-items:center; gap:14px; min-width:0 }
    .sl-dlPaw{
      width:54px; height:54px; border-radius:50%;
      background:rgba(255,255,255,.06); border:1px solid var(--line);
      display:inline-flex; align-items:center; justify-content:center;
      color:var(--gold2); font-size:22px; flex:0 0 auto;
    }
    .sl-dlTitle{ font-family:"Playfair Display", Georgia, serif; font-size:22px; color:var(--white) }
    .sl-dlSub{ color:var(--muted); font-size:13px; margin-top:2px }
    .sl-dlRight{ display:flex; align-items:center; gap:10px; flex-wrap:wrap }
    .sl-store{
      display:flex; align-items:center; gap:10px;
      padding:10px 16px; border-radius:12px;
      background:#0a0a0a; border:1px solid rgba(255,255,255,.14);
      color:#fff; text-decoration:none; min-height:54px;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    .sl-store:hover{ border-color:rgba(176,132,28,.4); box-shadow:0 0 0 3px rgba(176,132,28,.1) }
    .sl-store svg{ font-size:26px; flex:0 0 auto }
    .sl-store span{ display:flex; flex-direction:column; line-height:1.05; align-items:flex-start }
    .sl-store small{ font-size:10px; opacity:.78; font-weight:700; letter-spacing:.06em; text-transform:uppercase }
    .sl-store strong{ font-size:14.5px; font-weight:900 }
    .sl-qr{ width:54px; height:54px }
    .sl-qrSvg{ width:54px; height:54px; border-radius:6px }

    /* ====== BREAKPOINTS ====== */

    /* ≤ 767px (phones) — single column, compact direct signup.
     * Operator brief 2026-05-26: keep CTA reachable, never let the dog push
     * the form down. Logo stays dominant; dog scales down accordingly. */
    @media(max-width:767px){
      .sl-shell{ min-height:auto; padding-top:0 }
      .sl-frame{ gap:10px; padding:max(6px, env(safe-area-inset-top)) 12px calc(92px + env(safe-area-inset-bottom)) }
      .sl-hero{ gap:6px; padding-top:0 }
      .sl-logo{ width:min(86vw, 382px) }
      .sl-eyebrow{ font-size:9px; letter-spacing:.20em; margin-top:0 }
      .sl-h1{ font-size:clamp(23px,6vw,28px); line-height:1.04; max-width:352px }
      .sl-sub{ font-size:clamp(13px,3.4vw,15px); line-height:1.32; max-width:344px }
      .sl-divPaw{ display:none }
      .sl-dogWrap{ padding:0 }
      .sl-dog{ width:min(42vw, 162px); border-radius:16px; box-shadow:0 14px 38px rgba(0,0,0,.42); object-position:center top }
      .sl-card,.sl-trustCard,.sl-secBadge{ display:none }
      .sl-panel{ padding:16px 14px; border-radius:22px; gap:11px; scroll-margin-top:8px }
      .sl-panelHead{ gap:8px }
      .sl-title{ font-size:clamp(23px,6vw,28px); line-height:1.05; letter-spacing:.02em }
      .sl-helper{ font-size:13.5px; line-height:1.35 }
      .sl-lang{ min-height:40px; padding:8px 12px; border-radius:999px }
      .sl-social4{ grid-template-columns:1fr 1fr; gap:8px }
      .sl-soc{ min-height:50px; border-radius:14px; padding:0 12px; gap:10px; font-size:13px; line-height:1.15 }
      .sl-soc svg,.sl-fbIcon,.sl-igIcon{ flex:0 0 auto }
      .sl-div{ margin:2px 0; font-size:12px }
      .sl-tabs{ grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px }
      .sl-tab{ min-height:46px; border-radius:14px; padding:8px 8px; font-size:13px; line-height:1.15 }
      .sl-label{ font-size:13px }
      .sl-input{ min-height:50px; border-radius:14px; font-size:16px }
      .sl-inputWrap .sl-inputIcon{ left:14px }
      .sl-field .intl-phone-wrapper{
        min-height:50px;
        border-radius:14px !important;
        padding:8px 12px !important;
        background:rgba(0,0,0,.55) !important;
        border-color:var(--line) !important;
        color:var(--white) !important;
      }
      .sl-field .intl-phone-wrapper .PhoneInput{ gap:10px }
      .sl-field .intl-phone-wrapper .PhoneInputCountry{ margin-right:8px }
      .sl-field .intl-phone-wrapper .PhoneInputInput{
        min-width:0;
        font-size:16px;
        background:transparent !important;
        color:var(--white) !important;
      }
      .sl-field .intl-phone-wrapper .PhoneInputInput::placeholder{ color:rgba(255,250,240,.42) !important }
      .sl-field .intl-phone-wrapper .PhoneInputCountrySelect{ color:var(--white) !important }
      .sl-field .intl-phone-wrapper .PhoneInputCountrySelectArrow{ color:var(--gold2) !important; opacity:.9 }
      .sl-badges{ grid-template-columns:1fr 1fr; gap:8px }
      .sl-badge{ min-height:54px; padding:10px 8px }
      .sl-terms{ align-items:flex-start; font-size:12.5px; line-height:1.35 }
      .sl-dl{ display:none }
    }

    /* ≤ 420px (very small phones, iPhone SE) — keep the dog visible but
     * compact. The logo still owns the hierarchy; the CTA remains reachable. */
    @media(max-width:420px){
      .sl-frame{ padding-top:max(4px, env(safe-area-inset-top)) }
      .sl-logo{ width:min(84vw, 352px) }
      .sl-h1{ font-size:clamp(21px,5.7vw,26px) }
      .sl-sub{ font-size:13px }
      .sl-dog{ width:min(38vw, 142px) }
    }

    @media(max-width:380px){
      .sl-dogWrap{ display:none }
    }

    /* 768-1023 (tablet portrait, iPad mini portrait) — two columns so iPad
     * does not bury the signup form under an oversized hero. */
    @media(min-width:768px) and (max-width:1023px){
      .sl-frame{
        display:grid;
        grid-template-columns:minmax(360px,.9fr) minmax(360px,1.1fr);
        gap:14px;
        align-items:start;
        padding:14px 14px 40px;
      }
      .sl-hero{ position:sticky; top:14px; gap:12px }
      .sl-logo{ width:min(48vw, 420px); min-width:360px; max-width:100% }
      .sl-eyebrow{ font-size:10px; letter-spacing:.24em }
      .sl-h1{ font-size:clamp(26px,3.4vw,34px); line-height:1.08 }
      .sl-sub{ font-size:clamp(14px,2vw,17px); line-height:1.35 }
      .sl-dog{ width:min(32vw, 260px) }
      .sl-title{ font-size:clamp(27px,3.7vw,34px); line-height:1.05 }
      .sl-panel{ padding:22px; border-radius:26px }
    }

    /* ≥ 1024px (iPad landscape, desktop) — two columns, sticky left.
     * The hero is sticky so the brand stays visible while the form scrolls. */
    @media(min-width:1024px){
      .sl-frame{
        display:grid; grid-template-columns:1fr 1.05fr;
        gap:clamp(32px,4vw,56px);
        align-items:start;
        padding-top:clamp(20px,2.6vw,40px);
      }
      .sl-hero{ position:sticky; top:18px; gap:18px }
      .sl-logo{ width:clamp(360px,28vw,520px) }
      .sl-h1{ font-size:clamp(32px,2.6vw,44px) }
      .sl-dog{ width:min(56%, 360px) }
      .sl-panel{ padding:clamp(28px,2.6vw,38px) }
    }

    /* Rotated phones and compact webviews — use every pixel. This overrides
     * tablet/desktop breakpoints when height is the limiting dimension. */
    @media(max-height:500px) and (orientation:landscape){
      .sl-shell{ min-height:auto; padding-top:0 }
      .sl-frame{
        display:grid;
        grid-template-columns:minmax(240px,.74fr) minmax(320px,1.26fr);
        gap:10px;
        align-items:start;
        padding:max(6px, env(safe-area-inset-top)) 10px calc(72px + env(safe-area-inset-bottom));
      }
      .sl-hero{
        position:static;
        top:auto;
        gap:5px;
        padding-top:0;
        min-width:0;
      }
      .sl-logo{ width:min(42vw, 280px); min-width:0; max-width:100% }
      .sl-eyebrow{ font-size:8px; letter-spacing:.18em; margin-top:0 }
      .sl-h1{ font-size:clamp(18px,3.1vw,24px); line-height:1.02; max-width:300px }
      .sl-sub{ font-size:11px; line-height:1.25; max-width:300px }
      .sl-divPaw{ display:none }
      .sl-dogWrap{ padding:0 }
      .sl-dog{ width:min(19vw, 96px); border-radius:12px; box-shadow:0 10px 28px rgba(0,0,0,.42) }
      .sl-card,.sl-trustCard,.sl-secBadge,.sl-dl{ display:none }
      .sl-panel{
        padding:12px;
        border-radius:18px;
        gap:9px;
        min-width:0;
      }
      .sl-panelHead{ display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:10px }
      .sl-title{ font-size:clamp(20px,3.2vw,25px); line-height:1.02 }
      .sl-helper{ font-size:12px; line-height:1.25 }
      .sl-lang{ min-height:34px; padding:6px 10px; font-size:12px }
      .sl-social4{ grid-template-columns:1fr 1fr; gap:7px }
      .sl-soc{ min-height:42px; border-radius:12px; padding:0 10px; gap:8px; font-size:12px; line-height:1.05 }
      .sl-soc svg,.sl-fbIcon,.sl-igIcon{ width:21px; height:21px; flex:0 0 auto }
      .sl-div{ display:none }
      .sl-tabs{ gap:7px }
      .sl-tab{ min-height:40px; border-radius:12px; font-size:12px; padding:6px }
      .sl-field{ gap:6px }
      .sl-label{ font-size:12px }
      .sl-input{ min-height:42px; border-radius:12px; font-size:15px }
      .sl-field .intl-phone-wrapper{ min-height:42px; border-radius:12px !important; padding:6px 10px !important }
      .sl-terms{ min-height:38px; padding:7px 9px; font-size:11px; line-height:1.25 }
      .sl-terms input{ width:21px; height:21px }
    }

    /* Hover affordances (mouse-only) */
    @media(hover:hover){
      .sl-input:hover{ border-color:rgba(255,255,255,.2) }
    }

    @media(prefers-reduced-motion:reduce){
      .sl-soc, .sl-cta, .sl-store, .sl-tab{ transition:none }
    }
  `;
}
