/**
 * SignUpLuxury — canonical /signup front door (black-luxury 2026, full mockup).
 *
 * Matches the locked owner mockup: two-column premium layout. Left column is
 * the hero — PetWash wordmark, "The Future of Pet Lifestyle", hero dog photo,
 * premium experience badges (AI Care / VIP Rewards / Smart Booking / Health
 * Tracking), rating, trust-row of customer avatars, security badge. Right
 * column is the glass panel — "Create Your Account", social buttons
 * (Google / Apple / Facebook / Instagram), Mobile / Email / Other Email tabs,
 * phone + email fields, next-time entry-code, 2026 Advanced Security row
 * (Passkey Ready / reCAPTCHA v3 / OTP Verification), four consent checkboxes
 * (Biometric / Save Password / Remember Me / Wallet Consent), Apple Wallet +
 * Google Wallet buttons, Terms, reCAPTCHA badge, Create Secure Account CTA,
 * bank-level security row, Download Our App banner (App Store + Play + QR).
 *
 * Auth wiring that actually works (do not break):
 *   - Google OAuth   — ff.auth.signup.google_signin.enabled (default ON)
 *   - Apple OAuth    — ff.auth.signup.apple_signin.enabled (default OFF →
 *                       button is rendered as "Coming soon" so the design
 *                       stays whole, click is disabled until the backend is
 *                       configured; never a dead-button)
 *   - Facebook / Instagram — design tiles, "Coming soon" badge, disabled.
 *                       We do NOT have web OAuth for these.
 *   - Mobile OTP     — canonical /api/auth/sms/start + /verify chain
 *   - Email / pwd    — ff.auth.signup.email_password.enabled (default ON),
 *                       any domain, sign-in OR sign-up.
 *
 * Consent checkboxes + next-time code + wallet intent are captured here and
 * persisted to localStorage under `petwash_signup_prefs`. The post-signup
 * onboarding flow picks them up — no fake server endpoint is invented.
 *
 * Session minting uses the canonical chain in server/routes/auth-sms.ts
 * (sms/verify → phone-session → /api/auth/session → cookie). whoami fires
 * after every successful auth before routing.
 */
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  signInWithPopup, signInWithRedirect, signInWithCustomToken,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAuthStrategy, createGoogleProvider, createAppleProvider } from '@/lib/iosAuthHandler';
import { getApiUrl } from '@/lib/apiConfig';
import { type Language } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { signupFlags } from '@/lib/authSignupFlags';
import {
  FaApple, FaFacebookF, FaInstagram, FaFingerprint, FaLock, FaWallet,
  FaShieldAlt, FaAppStoreIos, FaGooglePlay,
} from 'react-icons/fa';

interface Props {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
}

type Flow = 'prestige' | 'provider' | 'guest' | 'booking' | 'general';

function normalizeFlow(raw: string | null): Flow {
  return raw === 'provider' || raw === 'guest' || raw === 'booking' || raw === 'prestige'
    ? raw
    : 'general';
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

type SignupPrefs = {
  entryCode: string;
  biometric: boolean;
  savePassword: boolean;
  rememberMe: boolean;
  walletConsent: boolean;
  walletIntent: 'apple' | 'google' | null;
};

function persistPrefs(prefs: SignupPrefs) {
  try { localStorage.setItem('petwash_signup_prefs', JSON.stringify(prefs)); } catch { /* quota / private mode */ }
}

export default function SignUpLuxury({ language = 'en', onLanguageChange }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const he = language === 'he';

  const params = useMemo(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );
  const flow = normalizeFlow(params.get('flow') || params.get('intent'));
  const dest = destForFlow(flow);

  // OAuth redirect completion: AuthProvider mints the session; navigate off /signup.
  const { user } = useFirebaseAuth();
  useEffect(() => { if (user) navigate(dest); }, [user, dest, navigate]);

  const [method, setMethod] = useState<'mobile' | 'email' | 'other'>('mobile');
  const [phone, setPhone] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [biometric, setBiometric] = useState(false);
  const [savePassword, setSavePassword] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [walletConsent, setWalletConsent] = useState(false);
  const [walletIntent, setWalletIntent] = useState<'apple' | 'google' | null>(null);
  const [terms, setTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => toast({ variant: 'destructive', title: he ? 'שגיאה' : 'Error', description: msg });

  const requireTerms = () => {
    if (!terms) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות' : 'Please accept the Terms and Privacy Policy to continue.'); return false; }
    return true;
  };

  const snapshotPrefs = () => persistPrefs({
    entryCode, biometric, savePassword, rememberMe, walletConsent, walletIntent,
  });

  async function finishAndRoute() {
    snapshotPrefs();
    try { await fetch(getApiUrl('/api/session/whoami'), { credentials: 'include' }); }
    catch (e) { logger.error('[signup] whoami', e); }
    navigate(dest);
  }

  async function sendCode() {
    if (!phone) { fail(he ? 'הזן מספר טלפון' : 'Enter your mobile number'); return; }
    if (!requireTerms()) return;
    setBusy(true);
    try {
      const r = await fetch(getApiUrl('/api/auth/sms/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, language, flow }),
      });
      const d = await r.json();
      if (!d.ok) { fail(d.message || (he ? 'SMS אינו זמין כעת — נסה אימייל או Google' : 'SMS is temporarily unavailable. Please use email or Google.')); return; }
      setSent(true);
      toast({ title: he ? 'קוד נשלח 📲' : 'Code sent 📲' });
    } catch (e) { logger.error('[signup] sendCode', e); fail(he ? 'שגיאת רשת' : 'Network error'); }
    finally { setBusy(false); }
  }

  async function verify(c: string) {
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

  async function social(which: 'google' | 'apple') {
    if (!requireTerms()) return;
    setBusy(true);
    try {
      const provider = which === 'google' ? createGoogleProvider() : createAppleProvider();
      if (getAuthStrategy() === 'redirect') {
        snapshotPrefs();
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
      fail(which === 'google'
        ? (he ? 'התחברות Google לא הושלמה — נסה נייד או אימייל' : 'Google sign-in did not complete. Please try mobile or email.')
        : (he ? 'התחברות Apple לא הושלמה — נסה נייד או אימייל' : 'Apple sign-in did not complete. Please try mobile or email.'));
    } finally { setBusy(false); }
  }

  async function emailSubmit() {
    if (!email || !password) { fail(he ? 'הזן אימייל וסיסמה' : 'Enter your email and password'); return; }
    if (!requireTerms()) return;
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

  const t = {
    eyebrow: he ? 'אקוסיסטם יוקרתי וחכם לחיות מחמד' : 'The intelligent pet-care ecosystem',
    h1a: he ? 'העתיד של' : 'The Future of',
    h1b: he ? 'חיי חיות המחמד' : 'Pet Lifestyle',
    sub: he ? 'שמונה פלטפורמות. אקוסיסטם אחד חכם לטיפול בחיות מחמד — בוטיק, חכם, ובהפתעה.' : 'Eight platforms. One intelligent pet-care ecosystem — boutique, smart, beautifully surprising.',
    badges: he
      ? ['טיפול חכם מבוסס AI', 'תגמולי VIP', 'הזמנה חכמה', 'מעקב בריאות']
      : ['AI-Powered Care', 'VIP Rewards', 'Smart Booking', 'Health Tracking'],
    trust: he ? 'מהימן על-ידי הורי חיות מחמד בעולם' : 'Trusted by pet parents worldwide',
    secure: he ? '🛡 הצפנה ברמת בנק · GDPR · ISO 27001' : '🛡 Bank-level encryption · GDPR · ISO 27001',
    create: he ? 'צור את החשבון שלך' : 'Create your account',
    helper: he ? 'הצטרף לאקוסיסטם — נייד, Google או אימייל.' : 'Join the ecosystem — phone, Google, or email.',
    or: he ? 'או המשך עם' : 'or continue with',
    soon: he ? 'בקרוב' : 'Soon',
    tabMobile: he ? 'נייד' : 'Mobile',
    tabEmail: he ? 'אימייל' : 'Email',
    tabOther: he ? 'אימייל אחר' : 'Other Email',
    phoneLabel: he ? 'מספר נייד' : 'Mobile number',
    emailOpt: he ? 'אימייל (אופציונלי)' : 'Email Address (Optional)',
    emailAny: he ? 'Gmail, Hotmail או כל אימייל' : 'Gmail, Hotmail, Yahoo, or any email',
    emailLabel: he ? 'אימייל' : 'Email',
    pwd: he ? 'סיסמה' : 'Password',
    pwd2: he ? 'אישור סיסמה (לחשבון חדש)' : 'Confirm password (new account)',
    entry: he ? 'קוד כניסה מהיר (6 ספרות)' : 'Next-Time Entry Code (6 digits)',
    entryHint: he ? 'נשמר במכשיר — מקצר את ההתחברות בפעם הבאה' : 'Saved on this device — shortcut for next sign-in',
    advSecurity: he ? 'אבטחה מתקדמת 2026' : '2026 Advanced Security',
    passkey: he ? 'מוכן ל-Passkey' : 'Passkey Ready',
    recaptcha: 'reCAPTCHA v3',
    otp: he ? 'אימות OTP' : 'OTP Verification',
    biometric: he ? 'הסכמה לזיהוי ביומטרי / Face ID' : 'Biometric / Face ID Consent',
    savePwd: he ? 'שמור סיסמה במכשיר' : 'Save password on this device',
    remember: he ? 'זכור אותי' : 'Remember me',
    walletConsent: he ? 'הסכמה לארנק נייד (Apple/Google Wallet)' : 'Mobile Wallet Consent (Apple / Google)',
    addApple: he ? 'הוסף לארנק Apple' : 'Add to Apple Wallet',
    addGoogle: he ? 'הוסף לארנק Google' : 'Add to Google Wallet',
    walletNote: he ? '* יופעל לאחר ההרשמה' : '* Activates right after signup',
    iAgree: he ? 'אני מסכים/ה ל' : 'I agree to the ',
    termsLink: he ? 'תנאי השימוש' : 'Terms of Service',
    andTo: he ? ' ול' : ' and ',
    privLink: he ? 'מדיניות הפרטיות' : 'Privacy Policy',
    cta: he ? 'צור חשבון מאובטח' : 'Create Secure Account',
    bank: he ? '🔒 הצפנה ברמת בנק · GDPR · ISO 27001' : '🔒 Bank-level encryption · GDPR · ISO 27001',
    download: he ? 'הורד את האפליקציה שלנו' : 'Download Our App',
    downloadSub: he ? 'הניסיון המלא בכף ידך' : 'The full experience in your pocket',
    appStore: 'App Store',
    googlePlay: 'Google Play',
    qrCaption: he ? 'סרוק להורדה' : 'Scan to download',
    ratingLabel: he ? 'מ-12,400+ ביקורות' : 'from 12,400+ reviews',
  };

  return (
    <div className="sl-root" dir={he ? 'rtl' : 'ltr'}>
      <style>{styles(he)}</style>

      {onLanguageChange && (
        <div className="sl-lang">
          <button type="button" className="sl-langBtn" aria-pressed={!he} onClick={() => onLanguageChange('en')}>EN</button>
          <button type="button" className="sl-langBtn" aria-pressed={he} onClick={() => onLanguageChange('he')}>עב</button>
        </div>
      )}

      {/* ========== LEFT COLUMN — HERO ========== */}
      <section className="sl-hero">
        <div className="sl-heroArt" />

        <div className="sl-logoWrap">
          <img src="/brand/petwash-logo-white.png" alt="PetWash" className="sl-logo" width={600} height={240} decoding="async" />
        </div>

        <div className="sl-heroBody">
          <div className="sl-eyebrow">{t.eyebrow}</div>
          <h1 className="sl-h1">
            {t.h1a}<br />
            <span className="sl-gold">{t.h1b}</span>
          </h1>
          <p className="sl-sub">{t.sub}</p>

          <div className="sl-badges">
            {t.badges.map((label, i) => (
              <div key={label} className="sl-badge">
                <span className="sl-badgeIcon" aria-hidden>{['🤖','👑','📅','💚'][i]}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="sl-rating">
            <span className="sl-stars" aria-hidden>★★★★★</span>
            <span className="sl-ratingVal">4.9</span>
            <span className="sl-ratingFrom">{t.ratingLabel}</span>
          </div>

          <div className="sl-trust">
            <div className="sl-trustHead">{t.trust}</div>
            <div className="sl-avatars" aria-hidden>
              {['#F4D48A','#E8B04A','#C5A55A','#9D6F23','#6E4A1A'].map((bg, i) => (
                <span key={i} className="sl-avatar" style={{ background: `linear-gradient(135deg, ${bg}, #000)` }}>
                  {['NH','AL','MK','RS','TY'][i]}
                </span>
              ))}
              <span className="sl-avatarMore">+12K</span>
            </div>
          </div>
        </div>

        <div className="sl-secureBadge">{t.secure}</div>
      </section>

      {/* ========== RIGHT COLUMN — PANEL ========== */}
      <section className="sl-panelWrap">
        <div className="sl-panel">
          <div className="sl-panelHead">
            <h2 className="sl-title">{t.create}</h2>
            <p className="sl-helper">{t.helper}</p>
          </div>

          {/* Social row — 2x2 grid on small, 4x1 on roomy */}
          <div className="sl-social4">
            {signupFlags.googleSignin && (
              <button className="sl-soc sl-soc--g" disabled={busy} onClick={() => social('google')} aria-label="Continue with Google">
                <svg className="sl-gIcon" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Google
              </button>
            )}

            {/* Apple — render even when flag-off, but mark "Coming soon" so the design stays whole */}
            <button
              className={`sl-soc sl-soc--apple${signupFlags.appleSignin ? '' : ' sl-soc--soon'}`}
              disabled={busy || !signupFlags.appleSignin}
              onClick={() => signupFlags.appleSignin && social('apple')}
              aria-label="Continue with Apple"
            >
              <FaApple aria-hidden /> Apple
              {!signupFlags.appleSignin && <span className="sl-soonPill">{t.soon}</span>}
            </button>

            <button className="sl-soc sl-soc--fb sl-soc--soon" disabled aria-label="Continue with Facebook (coming soon)">
              <FaFacebookF aria-hidden /> Facebook
              <span className="sl-soonPill">{t.soon}</span>
            </button>

            <button className="sl-soc sl-soc--ig sl-soc--soon" disabled aria-label="Continue with Instagram (coming soon)">
              <FaInstagram aria-hidden /> Instagram
              <span className="sl-soonPill">{t.soon}</span>
            </button>
          </div>

          <div className="sl-div">{t.or}</div>

          {/* Method tabs */}
          <div className="sl-tabs" role="tablist">
            <button type="button" className="sl-tab" role="tab" aria-selected={method === 'mobile'} onClick={() => { setMethod('mobile'); setSent(false); }}>
              {t.tabMobile}
            </button>
            {signupFlags.emailPassword && (
              <button type="button" className="sl-tab" role="tab" aria-selected={method === 'email'} onClick={() => setMethod('email')}>
                {t.tabEmail}
              </button>
            )}
            {signupFlags.emailPassword && (
              <button type="button" className="sl-tab" role="tab" aria-selected={method === 'other'} onClick={() => setMethod('other')}>
                {t.tabOther}
              </button>
            )}
          </div>

          {/* Mobile path */}
          {method === 'mobile' && !sent && (
            <>
              <div className="sl-field">
                <label className="sl-label">{t.phoneLabel}</label>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
              </div>
              <div className="sl-field">
                <label className="sl-label">{t.emailOpt}</label>
                <input className="sl-input" type="email" inputMode="email" autoComplete="email"
                  value={optionalEmail} onChange={(e) => setOptionalEmail(e.target.value)} placeholder={t.emailAny} />
              </div>
            </>
          )}

          {method === 'mobile' && sent && (
            <>
              <p className="sl-helper sl-center">{he ? `הזן את הקוד שנשלח ל-${phone}` : `Enter the code sent to ${phone}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verify(c); }} loading={busy} language={he ? 'he' : 'en'} />
              <button className="sl-btn" disabled={busy} onClick={() => setSent(false)}>{he ? 'שלח קוד חדש' : 'Resend code'}</button>
            </>
          )}

          {(method === 'email' || method === 'other') && (
            <>
              <div className="sl-field">
                <label className="sl-label">{t.emailLabel}</label>
                <input className="sl-input" type="email" inputMode="email" autoComplete="username email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={method === 'other' ? (he ? 'Outlook, Yahoo, ProtonMail, אחר…' : 'Outlook, Yahoo, ProtonMail, other…') : t.emailAny} />
              </div>
              <div className="sl-field">
                <label className="sl-label">{t.pwd}</label>
                <input className="sl-input" type="password" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="sl-field">
                <label className="sl-label">{t.pwd2}</label>
                <input className="sl-input" type="password" autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
            </>
          )}

          {/* Next-time entry code — captured pre-signup, persisted post */}
          {!(method === 'mobile' && sent) && (
            <div className="sl-field">
              <label className="sl-label">{t.entry}</label>
              <input
                className="sl-input sl-entry"
                type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="• • • • • •"
                aria-describedby="sl-entry-hint"
              />
              <div id="sl-entry-hint" className="sl-hint">{t.entryHint}</div>
            </div>
          )}

          {/* 2026 Advanced Security row */}
          <div className="sl-secRow" aria-label={t.advSecurity}>
            <div className="sl-secHead">{t.advSecurity}</div>
            <div className="sl-secCells">
              <div className="sl-secCell"><FaFingerprint aria-hidden /> <span>{t.passkey}</span></div>
              <div className="sl-secCell"><FaShieldAlt aria-hidden /> <span>{t.recaptcha}</span></div>
              <div className="sl-secCell"><FaLock aria-hidden /> <span>{t.otp}</span></div>
            </div>
          </div>

          {/* Consent checkboxes */}
          {!(method === 'mobile' && sent) && (
            <div className="sl-consent">
              <label className="sl-chk">
                <input type="checkbox" checked={biometric} onChange={(e) => setBiometric(e.target.checked)} />
                <FaFingerprint className="sl-chkIcon" aria-hidden />
                <span>{t.biometric}</span>
              </label>
              <label className="sl-chk">
                <input type="checkbox" checked={savePassword} onChange={(e) => setSavePassword(e.target.checked)} />
                <FaLock className="sl-chkIcon" aria-hidden />
                <span>{t.savePwd}</span>
              </label>
              <label className="sl-chk">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <FaShieldAlt className="sl-chkIcon" aria-hidden />
                <span>{t.remember}</span>
              </label>
              <label className="sl-chk">
                <input type="checkbox" checked={walletConsent} onChange={(e) => setWalletConsent(e.target.checked)} />
                <FaWallet className="sl-chkIcon" aria-hidden />
                <span>{t.walletConsent}</span>
              </label>
            </div>
          )}

          {/* Wallet CTAs — visual now, real activation post-signup */}
          {!(method === 'mobile' && sent) && (
            <>
              <div className="sl-wallets">
                <button
                  type="button"
                  className={`sl-wbtn sl-wbtn--apple${walletIntent === 'apple' ? ' is-on' : ''}`}
                  disabled={!walletConsent}
                  aria-pressed={walletIntent === 'apple'}
                  onClick={() => setWalletIntent(walletIntent === 'apple' ? null : 'apple')}
                >
                  <FaApple aria-hidden />
                  <span className="sl-wbtnTxt">
                    <small>{he ? 'הוסף ל-' : 'Add to'}</small>
                    <strong>Apple Wallet</strong>
                  </span>
                </button>
                <button
                  type="button"
                  className={`sl-wbtn sl-wbtn--google${walletIntent === 'google' ? ' is-on' : ''}`}
                  disabled={!walletConsent}
                  aria-pressed={walletIntent === 'google'}
                  onClick={() => setWalletIntent(walletIntent === 'google' ? null : 'google')}
                >
                  <FaGooglePlay aria-hidden />
                  <span className="sl-wbtnTxt">
                    <small>{he ? 'הוסף ל-' : 'Add to'}</small>
                    <strong>Google Wallet</strong>
                  </span>
                </button>
              </div>
              <div className="sl-walletNote">{t.walletNote}</div>
            </>
          )}

          {/* Terms */}
          {!(method === 'mobile' && sent) && (
            <label className="sl-terms">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                {t.iAgree}
                <a href="/terms" target="_blank" rel="noreferrer">{t.termsLink}</a>
                {t.andTo}
                <a href="/privacy-policy" target="_blank" rel="noreferrer">{t.privLink}</a>
              </span>
            </label>
          )}

          {/* reCAPTCHA badge (visual — actual verification is server-side / invisible v3) */}
          {!(method === 'mobile' && sent) && (
            <div className="sl-recap" aria-label="reCAPTCHA v3 protected">
              <FaShieldAlt aria-hidden />
              <span>{he ? 'מוגן על-ידי' : 'Protected by'} <strong>reCAPTCHA v3</strong></span>
            </div>
          )}

          {/* CTA */}
          {!(method === 'mobile' && sent) && (
            <button
              className="sl-btn sl-primary"
              disabled={busy}
              onClick={() => ((method === 'email' || method === 'other') ? void emailSubmit() : void sendCode())}
            >
              {busy ? '…' : t.cta}
            </button>
          )}

          {/* Bank-level security row */}
          <div className="sl-bank">{t.bank}</div>
        </div>

        {/* Download Our App banner */}
        <div className="sl-dl">
          <div className="sl-dlText">
            <div className="sl-dlTitle">{t.download}</div>
            <div className="sl-dlSub">{t.downloadSub}</div>
            <div className="sl-dlBtns">
              <a className="sl-store" href="https://apps.apple.com/il/app/petwash/id1234567890" target="_blank" rel="noreferrer">
                <FaAppStoreIos aria-hidden />
                <span className="sl-storeTxt"><small>{he ? 'הורד מ-' : 'Download on the'}</small><strong>{t.appStore}</strong></span>
              </a>
              <a className="sl-store" href="https://play.google.com/store/apps/details?id=co.il.petwash" target="_blank" rel="noreferrer">
                <FaGooglePlay aria-hidden />
                <span className="sl-storeTxt"><small>{he ? 'הורד מ-' : 'Get it on'}</small><strong>{t.googlePlay}</strong></span>
              </a>
            </div>
          </div>
          <div className="sl-qr" aria-hidden>
            <QrSquare />
            <div className="sl-qrCap">{t.qrCaption}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Tiny inline QR-look placeholder. Real QR generation lives in the post-signup
// app banner if/when we want a tracked download URL — purely visual here.
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

/** All styles live here so the component file stays portable. */
function styles(he: boolean) {
  return `
    .sl-root{
      --gold:#d8ad55; --gold2:#f4d48a; --white:#fffaf0;
      --muted:rgba(255,250,240,.7); --line:rgba(255,255,255,.14);
      position:relative; min-height:100dvh;
      background:
        radial-gradient(circle at 18% 8%, rgba(244,212,138,.16), transparent 30%),
        radial-gradient(circle at 82% 90%, rgba(216,173,85,.12), transparent 32%),
        linear-gradient(135deg, #050505, #111 50%, #050505);
      color:var(--white);
      font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      display:flex; flex-direction:column;
    }
    @supports not (height:100dvh){ .sl-root{ min-height:100vh } }

    .sl-lang{ position:absolute; top:max(14px, env(safe-area-inset-top)); ${he ? 'left' : 'right'}:16px; z-index:6; display:flex; gap:6px }
    .sl-langBtn{ appearance:none; cursor:pointer; border:1px solid var(--line); background:rgba(0,0,0,.4); color:var(--white); font-weight:800; font-size:13px; border-radius:999px; padding:7px 13px; min-height:36px }
    .sl-langBtn[aria-pressed="true"]{ background:linear-gradient(135deg, var(--gold2), var(--gold)); color:#0a0a0a; border-color:transparent }

    /* HERO LEFT */
    .sl-hero{
      position:relative; z-index:0; overflow:hidden;
      padding:clamp(28px,6vw,52px) clamp(20px,5vw,52px);
      display:flex; flex-direction:column; gap:18px; min-height:44dvh;
    }
    .sl-hero:after{
      content:""; position:absolute; inset:auto 0 0 0; height:42%;
      background:linear-gradient(transparent, rgba(5,5,5,.94)); z-index:1;
    }
    .sl-hero > *{ position:relative; z-index:2 }
    .sl-heroArt{
      position:absolute; inset:0; z-index:0;
      background:center/cover no-repeat; background-image:url(/brand/hero-dog-lux.jpg);
      opacity:.55; filter:contrast(1.08) saturate(1.12);
      -webkit-mask-image:linear-gradient(180deg, transparent 18%, #000 70%);
      mask-image:linear-gradient(180deg, transparent 18%, #000 70%);
    }
    .sl-logoWrap{ width:fit-content }
    .sl-logo{ height:clamp(48px,13vw,104px); width:auto; display:block }

    .sl-heroBody{ display:flex; flex-direction:column; gap:14px; max-width:620px }
    .sl-eyebrow{ letter-spacing:.22em; text-transform:uppercase; font-size:12px; color:var(--muted); font-weight:800 }
    .sl-h1{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(30px,4.6vw,64px); line-height:.95; letter-spacing:-.03em; margin:0 }
    .sl-gold{ background:linear-gradient(90deg, var(--gold2), var(--gold), #9d6f23); -webkit-background-clip:text; background-clip:text; color:transparent }
    .sl-sub{ margin:0; color:var(--muted); font-size:clamp(15px,1.5vw,20px); line-height:1.5; max-width:560px }

    .sl-badges{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; margin-top:2px }
    .sl-badge{
      display:flex; align-items:center; gap:10px;
      padding:10px 12px; border-radius:14px;
      border:1px solid rgba(244,212,138,.22);
      background:linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
      color:var(--white); font-weight:700; font-size:13px;
      backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
    }
    .sl-badgeIcon{ font-size:18px; line-height:1 }

    .sl-rating{ display:flex; align-items:center; gap:10px; margin-top:4px; color:var(--white) }
    .sl-stars{ color:var(--gold2); font-size:18px; letter-spacing:2px; text-shadow:0 0 12px rgba(244,212,138,.5) }
    .sl-ratingVal{ font-weight:900; font-size:18px }
    .sl-ratingFrom{ color:var(--muted); font-size:13px; font-weight:700 }

    .sl-trust{ display:flex; flex-direction:column; gap:8px; margin-top:4px }
    .sl-trustHead{ color:var(--muted); font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:800 }
    .sl-avatars{ display:flex; align-items:center; ${he ? 'gap:6px' : 'gap:0'} }
    .sl-avatar{
      width:34px; height:34px; border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center;
      color:#fff; font-weight:900; font-size:12px;
      border:2px solid #0a0a0a; box-shadow:0 2px 8px rgba(0,0,0,.45);
      margin-${he ? 'right' : 'left'}:-8px;
    }
    .sl-avatar:first-child{ margin-${he ? 'right' : 'left'}:0 }
    .sl-avatarMore{
      margin-${he ? 'right' : 'left'}:8px; padding:4px 10px; border-radius:999px;
      background:linear-gradient(135deg, var(--gold2), var(--gold));
      color:#0a0a0a; font-weight:900; font-size:12px;
    }

    .sl-secureBadge{
      align-self:flex-start; margin-top:auto;
      padding:8px 12px; border-radius:999px;
      border:1px solid rgba(244,212,138,.24);
      background:rgba(0,0,0,.4); color:var(--gold2);
      font-weight:800; font-size:12px; letter-spacing:.06em;
    }

    /* PANEL RIGHT */
    .sl-panelWrap{
      position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; gap:24px;
      padding:clamp(16px,5vw,28px) clamp(16px,5vw,28px) max(32px, env(safe-area-inset-bottom));
    }
    .sl-panel{
      width:100%; max-width:520px; border-radius:28px;
      border:1px solid rgba(244,212,138,.22);
      background:linear-gradient(145deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
      -webkit-backdrop-filter:blur(24px); backdrop-filter:blur(24px);
      box-shadow:0 30px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.16);
      padding:clamp(22px,3.2vw,34px); display:flex; flex-direction:column; gap:16px;
    }
    .sl-panelHead{ display:grid; gap:6px }
    .sl-title{ font-family:"Playfair Display", Georgia, serif; font-size:clamp(26px,3.2vw,38px); margin:0; line-height:1 }
    .sl-helper{ margin:0; color:var(--white); font-size:15px; font-weight:600; line-height:1.5 }
    .sl-helper.sl-center{ text-align:center }

    /* Social 2x2 */
    .sl-social4{ display:grid; grid-template-columns:1fr 1fr; gap:10px }
    .sl-soc{
      appearance:none; cursor:pointer; min-height:54px; border-radius:14px;
      border:1px solid var(--line); background:rgba(0,0,0,.34); color:var(--white);
      display:flex; align-items:center; justify-content:center; gap:10px;
      font-weight:800; font-size:15px; padding:0 12px;
      transition:transform .15s ease, border-color .15s ease; position:relative;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-soc:hover:not(:disabled){ transform:translateY(-1px); border-color:rgba(244,212,138,.4) }
    .sl-soc:disabled{ cursor:not-allowed }
    .sl-soc--soon{ opacity:.78 }
    .sl-soc--fb{ background:linear-gradient(135deg, rgba(24,119,242,.16), rgba(24,119,242,.06)); border-color:rgba(24,119,242,.32); color:#bcd3ff }
    .sl-soc--ig{ background:linear-gradient(135deg, rgba(255,86,159,.18), rgba(120,76,255,.08)); border-color:rgba(255,86,159,.32); color:#ffd1ea }
    .sl-soc--apple{ background:linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.02)) }
    .sl-gIcon{ width:20px; height:20px; flex:0 0 auto }
    .sl-soonPill{
      position:absolute; top:6px; ${he ? 'left' : 'right'}:8px;
      font-size:10px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;
      padding:2px 8px; border-radius:999px;
      background:linear-gradient(135deg, var(--gold2), var(--gold)); color:#0a0a0a;
    }

    .sl-div{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; color:rgba(255,250,240,.55); font-size:12px; text-transform:uppercase; letter-spacing:.14em; font-weight:800 }
    .sl-div:before, .sl-div:after{ content:""; height:1px; background:linear-gradient(90deg, transparent, rgba(244,212,138,.3), transparent) }

    .sl-tabs{ display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; background:rgba(0,0,0,.3); border:1px solid var(--line); border-radius:14px; padding:5px }
    .sl-tab{ appearance:none; cursor:pointer; border:0; background:transparent; color:var(--muted); font-weight:800; font-size:14px; min-height:42px; border-radius:10px; padding:0 6px }
    .sl-tab[aria-selected="true"]{ background:rgba(244,212,138,.16); color:var(--white) }

    .sl-field{ display:grid; gap:7px }
    .sl-label{ font-size:12px; color:var(--gold2); font-weight:800; text-transform:uppercase; letter-spacing:.1em }
    .sl-input{
      min-height:54px; border-radius:14px; border:1px solid var(--line);
      background:rgba(0,0,0,.3); color:var(--white); font-size:16px; font-weight:600;
      padding:0 16px; width:100%; outline:none;
    }
    .sl-input::placeholder{ color:rgba(255,250,240,.42) }
    .sl-input:focus{ border-color:rgba(244,212,138,.55); box-shadow:0 0 0 3px rgba(244,212,138,.18) }
    .sl-entry{ letter-spacing:.6em; text-align:center; font-size:22px; font-weight:800 }
    .sl-hint{ font-size:12px; color:var(--muted); margin-top:-2px }

    .sl-secRow{
      border:1px solid rgba(244,212,138,.22); border-radius:14px;
      background:linear-gradient(145deg, rgba(255,255,255,.04), rgba(0,0,0,.18));
      padding:12px; display:grid; gap:10px;
    }
    .sl-secHead{ color:var(--gold2); font-weight:800; font-size:12px; letter-spacing:.12em; text-transform:uppercase }
    .sl-secCells{ display:grid; grid-template-columns:repeat(3, 1fr); gap:8px }
    .sl-secCell{
      display:flex; align-items:center; justify-content:center; gap:8px;
      padding:9px 8px; border-radius:10px; border:1px solid var(--line);
      background:rgba(0,0,0,.32); color:var(--white); font-weight:700; font-size:12px; text-align:center;
    }
    .sl-secCell svg{ color:var(--gold2); flex:0 0 auto }

    .sl-consent{ display:grid; gap:8px }
    .sl-chk{
      display:grid; grid-template-columns:auto auto 1fr; align-items:center; gap:10px;
      padding:10px 12px; border-radius:12px;
      border:1px solid var(--line); background:rgba(0,0,0,.26);
      color:var(--white); font-size:13.5px; font-weight:600; line-height:1.3;
    }
    .sl-chk input{ width:20px; height:20px; accent-color:var(--gold); flex:0 0 auto }
    .sl-chkIcon{ color:var(--gold2); width:16px; height:16px }

    .sl-wallets{ display:grid; grid-template-columns:1fr 1fr; gap:10px }
    .sl-wbtn{
      appearance:none; cursor:pointer; min-height:56px; border-radius:14px;
      display:flex; align-items:center; justify-content:center; gap:10px; padding:0 14px;
      border:1px solid var(--line); color:#fff; font-weight:800;
      transition:transform .15s ease, border-color .15s ease;
    }
    .sl-wbtn:disabled{ opacity:.48; cursor:not-allowed }
    .sl-wbtn:not(:disabled):hover{ transform:translateY(-1px); border-color:rgba(244,212,138,.4) }
    .sl-wbtn--apple{ background:linear-gradient(135deg, #0a0a0a, #1d1d1f) }
    .sl-wbtn--google{ background:linear-gradient(135deg, #1a1a1a, #2b2b2b) }
    .sl-wbtn.is-on{ border-color:var(--gold2); box-shadow:0 0 0 3px rgba(244,212,138,.22) }
    .sl-wbtn svg{ font-size:22px; flex:0 0 auto }
    .sl-wbtnTxt{ display:flex; flex-direction:column; align-items:flex-start; line-height:1.05 }
    .sl-wbtnTxt small{ font-size:10px; opacity:.75; font-weight:700; letter-spacing:.06em; text-transform:uppercase }
    .sl-wbtnTxt strong{ font-size:14px; font-weight:900 }
    .sl-walletNote{ color:var(--muted); font-size:11.5px; text-align:center; margin-top:-4px }

    .sl-terms{ display:flex; align-items:flex-start; gap:10px; color:var(--muted); font-size:13px; line-height:1.45 }
    .sl-terms input{ width:20px; height:20px; margin-top:1px; accent-color:var(--gold); flex:0 0 auto }
    .sl-terms a{ color:var(--gold2); font-weight:700; text-decoration:underline }

    .sl-recap{
      display:flex; align-items:center; justify-content:center; gap:8px;
      padding:8px 12px; border-radius:10px;
      border:1px solid var(--line); background:rgba(0,0,0,.28);
      color:var(--muted); font-size:12px; font-weight:700;
    }
    .sl-recap svg{ color:#4285F4 }
    .sl-recap strong{ color:var(--white); font-weight:900; letter-spacing:.02em }

    .sl-btn{
      appearance:none; border:1px solid var(--line); cursor:pointer;
      min-height:56px; border-radius:16px; display:flex; align-items:center; justify-content:center; gap:9px;
      font-weight:800; font-size:16px; background:rgba(0,0,0,.34); color:var(--white);
      transition:.2s; -webkit-tap-highlight-color:transparent;
    }
    .sl-btn:hover{ transform:translateY(-1px); border-color:rgba(244,212,138,.4) }
    .sl-btn:disabled{ opacity:.5; cursor:not-allowed }
    .sl-primary{ width:100%; background:linear-gradient(135deg, var(--gold2), var(--gold), #9d6f23); color:#0a0a0a; border:0; box-shadow:0 16px 40px rgba(216,173,85,.26); font-size:17px }

    .sl-bank{ text-align:center; color:rgba(255,250,240,.55); font-size:12.5px; line-height:1.5; letter-spacing:.04em }

    /* DOWNLOAD APP BANNER */
    .sl-dl{
      width:100%; max-width:520px;
      border-radius:24px; padding:18px;
      border:1px solid rgba(244,212,138,.22);
      background:linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
      -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px);
      display:grid; grid-template-columns:1fr auto; gap:14px; align-items:center;
      box-shadow:0 18px 60px rgba(0,0,0,.45);
    }
    .sl-dlText{ display:flex; flex-direction:column; gap:6px }
    .sl-dlTitle{ font-family:"Playfair Display", Georgia, serif; font-size:20px; color:var(--white) }
    .sl-dlSub{ color:var(--muted); font-size:12.5px }
    .sl-dlBtns{ display:flex; gap:8px; margin-top:6px; flex-wrap:wrap }
    .sl-store{
      display:flex; align-items:center; gap:9px;
      padding:9px 13px; border-radius:11px;
      background:#0a0a0a; border:1px solid rgba(255,255,255,.12);
      color:#fff; text-decoration:none; min-height:46px;
    }
    .sl-store:hover{ border-color:rgba(244,212,138,.36) }
    .sl-store svg{ font-size:22px; flex:0 0 auto }
    .sl-storeTxt{ display:flex; flex-direction:column; line-height:1.05; align-items:flex-start }
    .sl-storeTxt small{ font-size:9.5px; opacity:.78; font-weight:700; letter-spacing:.06em; text-transform:uppercase }
    .sl-storeTxt strong{ font-size:13px; font-weight:900 }

    .sl-qr{ display:flex; flex-direction:column; align-items:center; gap:6px }
    .sl-qrSvg{ width:84px; height:84px; border-radius:10px; box-shadow:0 8px 22px rgba(0,0,0,.45) }
    .sl-qrCap{ color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase }

    /* SMALL PHONES */
    @media(max-width:430px){
      .sl-social4{ grid-template-columns:1fr 1fr }
      .sl-panel{ padding:22px 18px; border-radius:22px }
      .sl-badges{ grid-template-columns:1fr 1fr }
      .sl-secCells{ grid-template-columns:1fr }
      .sl-wallets{ grid-template-columns:1fr }
      .sl-dl{ grid-template-columns:1fr; text-align:center }
      .sl-qr{ margin:0 auto }
      .sl-dlBtns{ justify-content:center }
    }

    /* TABLET PORTRAIT */
    @media(min-width:768px) and (max-width:979px){
      .sl-hero{ min-height:50dvh; padding:clamp(40px,6vw,68px); gap:22px }
      .sl-logo{ height:clamp(72px,9vw,116px) }
      .sl-h1{ font-size:clamp(46px,7vw,62px) }
      .sl-sub{ font-size:clamp(17px,2vw,21px); max-width:600px }
      .sl-panel{ max-width:560px }
      .sl-dl{ max-width:560px }
      .sl-panelWrap{ padding:clamp(28px,5vw,44px) clamp(24px,5vw,40px) max(36px, env(safe-area-inset-bottom)) }
    }

    /* DESKTOP — two columns */
    @media(min-width:980px){
      .sl-root{ display:grid; grid-template-columns:1.02fr .98fr }
      .sl-hero{ min-height:100dvh; justify-content:space-between; gap:22px; padding:clamp(36px,4vw,64px) }
      .sl-hero:after{ display:none }
      .sl-heroArt{ -webkit-mask-image:linear-gradient(90deg, transparent, #000 60%); mask-image:linear-gradient(90deg, transparent, #000 60%); opacity:.5 }
      .sl-h1{ font-size:clamp(40px,4.6vw,64px) }
      .sl-logo{ height:clamp(80px,7vw,132px) }
      .sl-panelWrap{ align-items:center; justify-content:center; min-height:100dvh; padding:clamp(24px,3vw,44px) }
    }

    @media(max-height:560px) and (orientation:landscape){
      .sl-hero{ min-height:auto; padding:16px 22px }
    }
    @media(prefers-reduced-motion:reduce){ .sl-btn, .sl-soc, .sl-wbtn{ transition:none } }
  `;
}
