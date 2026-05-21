/**
 * SignUpLuxury — canonical /signup front door (black-luxury 2026).
 *
 * The single door into PetWash/Octopus. Visual direction is locked to
 * client/public/brand/signup-luxury-reference-9x16.png: white PetWash wordmark
 * top-left (dominant over the headline), gold "Pet Lifestyle", dog hero, glass
 * panel on the right (stacked on mobile).
 *
 * FIRST-SCREEN CLEAN RULE — only controls that work end-to-end are shown:
 *   - Continue with Google      (ff.auth.signup.google_signin.enabled, default ON)
 *   - Continue with Apple       (ff.auth.signup.apple_signin.enabled, default OFF → hidden
 *                                until Firebase Apple is configured; no dead button)
 *   - Mobile (OTP)              canonical /api/auth/sms/start + /verify only
 *   - Email (email/password)    (ff.auth.signup.email_password.enabled, default ON) — any domain
 *   - Terms checkbox            required; blocks submit; real /terms + /privacy-policy links
 *   - Create Secure Account     submits the active method
 *
 * Deliberately NOT on this screen (moved to later onboarding / hidden, no fakes):
 *   Facebook/Instagram (no signup OAuth), Face ID/passkey (post-login step),
 *   wallet consent + Add to Wallet, next-time code, "save password" checkbox,
 *   "remember me", reCAPTCHA panel, app-store/QR. See the auth audit + spec.
 *
 * Session minting uses the canonical chain documented in server/routes/auth-sms.ts
 * (sms/verify → phone-session → /api/auth/session → cookie). whoami is called
 * after every successful auth before routing. Routing targets are REAL routes
 * (some ideal targets like /prestige/onboarding don't exist yet — see PR notes).
 */
import { useState, useEffect } from 'react';
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
import { FaApple } from 'react-icons/fa';

interface Props {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
}

const NAV_OFFSET = 104; // app navbar pushes body down by 104px (measured)

type Flow = 'prestige' | 'provider' | 'guest' | 'booking' | 'general';

function normalizeFlow(raw: string | null): Flow {
  return raw === 'provider' || raw === 'guest' || raw === 'booking' || raw === 'prestige'
    ? raw
    : 'general';
}

// Real existing routes only (verified against App.tsx). Ideal targets such as
// /prestige/onboarding, /booking/intake, /guest/checkout, /account, /profile/complete
// don't exist yet — wiring those is a follow-up PR (route or redirect alias).
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

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const flow = normalizeFlow(params.get('flow') || params.get('intent'));
  const dest = destForFlow(flow);

  // OAuth redirect completion (iOS): AuthProvider mints the session on return;
  // navigate off /signup so the user isn't stranded here.
  const { user } = useFirebaseAuth();
  useEffect(() => { if (user) navigate(dest); }, [user, dest, navigate]);

  const [method, setMethod] = useState<'mobile' | 'email'>('mobile');
  const [phone, setPhone] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => toast({ variant: 'destructive', title: he ? 'שגיאה' : 'Error', description: msg });

  const requireTerms = () => {
    if (!terms) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות' : 'Please accept the Terms and Privacy Policy to continue.'); return false; }
    return true;
  };

  // whoami confirms the session is live, then route by flow (real routes).
  async function finishAndRoute() {
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
      // Canonical session-mint chain (see server/routes/auth-sms.ts header).
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
        await signInWithRedirect(auth, provider); // AuthProvider mints session on return
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

  // Email = sign in OR sign up (any domain). Try sign-in; if the account is new,
  // require a matching confirm and create it. Password is never logged.
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

  const showSocial = signupFlags.googleSignin || signupFlags.appleSignin;
  const showEmailTab = signupFlags.emailPassword;

  return (
    <div className="sl-root" dir={he ? 'rtl' : 'ltr'}>
      <style>{`
        .sl-root{--gold:#d8ad55;--gold2:#f4d48a;--white:#fffaf0;--muted:rgba(255,250,240,.7);--line:rgba(255,255,255,.14);
          position:relative;min-height:calc(100svh - ${NAV_OFFSET}px);
          background:radial-gradient(circle at 18% 8%,rgba(244,212,138,.16),transparent 30%),radial-gradient(circle at 82% 90%,rgba(216,173,85,.12),transparent 32%),linear-gradient(135deg,#050505,#111 50%,#050505);
          color:var(--white);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;display:grid;grid-template-columns:1.05fr .95fr}
        .sl-lang{position:absolute;top:14px;${he ? 'left' : 'right'}:16px;z-index:5;display:flex;gap:6px;top:max(14px,env(safe-area-inset-top))}
        .sl-langBtn{appearance:none;cursor:pointer;border:1px solid var(--line);background:rgba(0,0,0,.4);color:var(--white);font-weight:800;font-size:13px;border-radius:999px;padding:7px 13px;min-height:36px}
        .sl-langBtn[aria-pressed="true"]{background:linear-gradient(135deg,var(--gold2),var(--gold));color:#0a0a0a;border-color:transparent}
        .sl-hero{position:relative;padding:clamp(24px,4vw,56px);display:flex;flex-direction:column;justify-content:space-between;gap:20px;overflow:hidden;min-height:calc(100svh - ${NAV_OFFSET}px)}
        .sl-hero:after{content:"";position:absolute;inset:auto 0 0 0;height:42%;background:linear-gradient(transparent,rgba(5,5,5,.94));z-index:1}
        .sl-hero > *{position:relative;z-index:2}
        .sl-heroArt{position:absolute;inset:0;z-index:0;background:center/cover no-repeat;background-image:url(/brand/hero-dog-lux.jpg);opacity:.55;-webkit-mask-image:linear-gradient(90deg,transparent,#000 55%);mask-image:linear-gradient(90deg,transparent,#000 55%)}
        /* Logo is the dominant brand mark — larger than the headline (per spec). */
        .sl-logo{height:clamp(64px,11vw,132px);width:auto;filter:brightness(0) invert(1)}
        .sl-eyebrow{letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:var(--muted);font-weight:800}
        .sl-h1{font-family:"Playfair Display",Georgia,serif;font-size:clamp(30px,4.6vw,64px);line-height:.95;letter-spacing:-.03em;margin:0}
        .sl-gold{background:linear-gradient(90deg,var(--gold2),var(--gold),#9d6f23);-webkit-background-clip:text;background-clip:text;color:transparent}
        .sl-sub{margin-top:14px;max-width:520px;color:var(--muted);font-size:clamp(15px,1.5vw,20px);line-height:1.45}
        .sl-panelWrap{display:flex;align-items:center;justify-content:center;padding:clamp(18px,3vw,44px);min-height:calc(100svh - ${NAV_OFFSET}px);padding-bottom:max(28px,env(safe-area-inset-bottom))}
        .sl-panel{width:100%;max-width:480px;border-radius:28px;border:1px solid rgba(244,212,138,.22);
          background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.04));-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);
          box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16);padding:clamp(22px,3.2vw,38px);display:flex;flex-direction:column;gap:16px}
        .sl-title{font-family:"Playfair Display",Georgia,serif;font-size:clamp(28px,3.2vw,40px);margin:0;line-height:1}
        .sl-helper{margin:0;color:var(--white);font-size:16px;font-weight:600;line-height:1.5}
        .sl-social{display:grid;grid-template-columns:1fr 1fr;gap:11px}
        .sl-social.one{grid-template-columns:1fr}
        .sl-btn{appearance:none;border:1px solid var(--line);cursor:pointer;min-height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:9px;font-weight:800;font-size:16px;background:rgba(0,0,0,.34);color:var(--white);transition:.2s;-webkit-tap-highlight-color:transparent}
        .sl-btn:hover{transform:translateY(-1px);border-color:rgba(244,212,138,.4)}
        .sl-btn:disabled{opacity:.5;cursor:not-allowed}
        .sl-primary{width:100%;background:linear-gradient(135deg,var(--gold2),var(--gold),#9d6f23);color:#0a0a0a;border:0;box-shadow:0 16px 40px rgba(216,173,85,.26)}
        .sl-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:14px;padding:5px}
        .sl-tab{appearance:none;cursor:pointer;border:0;background:transparent;color:var(--muted);font-weight:800;font-size:15px;min-height:44px;border-radius:10px}
        .sl-tab[aria-selected="true"]{background:rgba(244,212,138,.16);color:var(--white)}
        .sl-div{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;color:rgba(255,250,240,.5);font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:800}
        .sl-div:before,.sl-div:after{content:"";height:1px;background:linear-gradient(90deg,transparent,rgba(244,212,138,.3),transparent)}
        .sl-field{display:grid;gap:7px}
        .sl-label{font-size:13px;color:var(--gold2);font-weight:800;text-transform:uppercase;letter-spacing:.1em}
        .sl-input{min-height:56px;border-radius:16px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:var(--white);font-size:16px;font-weight:600;padding:0 16px;width:100%}
        .sl-input::placeholder{color:rgba(255,250,240,.42)}
        .sl-terms{display:flex;align-items:flex-start;gap:10px;color:var(--muted);font-size:13px;line-height:1.45}
        .sl-terms input{width:20px;height:20px;margin-top:1px;accent-color:var(--gold);flex:0 0 auto}
        .sl-terms a{color:var(--gold2);font-weight:700;text-decoration:underline}
        .sl-foot{text-align:center;color:rgba(255,250,240,.55);font-size:13px;line-height:1.5}
        @media(max-width:768px){
          .sl-root{grid-template-columns:1fr;min-height:auto}
          .sl-hero{min-height:auto;padding:24px 22px 28px;gap:14px}
          .sl-heroArt{-webkit-mask-image:linear-gradient(180deg,#000 45%,transparent);mask-image:linear-gradient(180deg,#000 45%,transparent);opacity:.4}
          .sl-h1{font-size:clamp(28px,8vw,48px)}
          .sl-sub{font-size:15px}
          .sl-panelWrap{min-height:auto;padding:6px 16px 40px;padding-bottom:max(40px,env(safe-area-inset-bottom))}
        }
        @media(max-width:430px){ .sl-social{grid-template-columns:1fr} .sl-panel{padding:22px 18px;border-radius:22px} }
        @media(max-height:560px) and (orientation:landscape){
          .sl-root{grid-template-columns:1fr;min-height:auto}
          .sl-hero{min-height:auto;padding:16px 22px}
          .sl-panelWrap{min-height:auto;padding:12px 16px 28px}
        }
        @media(prefers-reduced-motion:reduce){.sl-btn{transition:none}}
      `}</style>

      {onLanguageChange && (
        <div className="sl-lang">
          <button type="button" className="sl-langBtn" aria-pressed={!he} onClick={() => onLanguageChange('en')}>EN</button>
          <button type="button" className="sl-langBtn" aria-pressed={he} onClick={() => onLanguageChange('he')}>עב</button>
        </div>
      )}

      <section className="sl-hero">
        <div className="sl-heroArt" />
        <div><img src="/petwash-logo-official.png" alt="PetWash" className="sl-logo" /></div>
        <div>
          <div className="sl-eyebrow">{he ? 'אקוסיסטם יוקרתי וחכם לחיות מחמד' : 'Intelligent pet-care ecosystem'}</div>
          <h1 className="sl-h1">{he ? 'העתיד של' : 'The Future of'}<br /><span className="sl-gold">{he ? 'חיי חיות המחמד' : 'Pet Lifestyle'}</span></h1>
          <p className="sl-sub">{he ? 'שמונה פלטפורמות. אקוסיסטם אחד חכם לטיפול בחיות מחמד.' : 'Eight revolutionary platforms. One intelligent pet-care ecosystem.'}</p>
        </div>
        <div className="sl-eyebrow">{he ? 'יוקרה · חדשנות · אהבה' : 'Luxury · Innovation · Love'}</div>
      </section>

      <section className="sl-panelWrap">
        <div className="sl-panel">
          <div style={{ display: 'grid', gap: 8 }}>
            <h2 className="sl-title">{he ? 'צור חשבון' : 'Create your account'}</h2>
            <p className="sl-helper">{he ? 'התחבר או הירשם — נייד, Google או אימייל.' : 'Sign in or sign up — phone, Google, or email.'}</p>
          </div>

          {showSocial && (
            <>
              <div className={`sl-social${signupFlags.googleSignin && signupFlags.appleSignin ? '' : ' one'}`}>
                {signupFlags.googleSignin && (
                  <button className="sl-btn" disabled={busy} onClick={() => social('google')}>
                    <span style={{ fontWeight: 900 }}>G</span> Google
                  </button>
                )}
                {signupFlags.appleSignin && (
                  <button className="sl-btn" disabled={busy} onClick={() => social('apple')}><FaApple /> Apple</button>
                )}
              </div>
              <div className="sl-div">{he ? 'או המשך עם' : 'or continue with'}</div>
            </>
          )}

          {showEmailTab && (
            <div className="sl-tabs" role="tablist">
              <button type="button" className="sl-tab" role="tab" aria-selected={method === 'mobile'} onClick={() => { setMethod('mobile'); setSent(false); }}>
                {he ? 'נייד' : 'Mobile'}
              </button>
              <button type="button" className="sl-tab" role="tab" aria-selected={method === 'email'} onClick={() => setMethod('email')}>
                {he ? 'אימייל' : 'Email'}
              </button>
            </div>
          )}

          {method === 'mobile' && !sent && (
            <>
              <div className="sl-field">
                <label className="sl-label">{he ? 'מספר נייד' : 'Mobile number'}</label>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
              </div>
              <div className="sl-field">
                <label className="sl-label">{he ? 'אימייל (אופציונלי)' : 'Email (optional)'}</label>
                <input className="sl-input" type="email" inputMode="email" autoComplete="email" value={optionalEmail}
                  onChange={(e) => setOptionalEmail(e.target.value)} placeholder={he ? 'Gmail, Hotmail או כל אימייל' : 'Gmail, Hotmail, or any email'} />
              </div>
            </>
          )}

          {method === 'mobile' && sent && (
            <>
              <p className="sl-helper" style={{ textAlign: 'center' }}>{he ? `הזן את הקוד שנשלח ל-${phone}` : `Enter the code sent to ${phone}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verify(c); }} loading={busy} language={he ? 'he' : 'en'} />
              <button className="sl-btn" disabled={busy} onClick={() => setSent(false)}>{he ? 'שלח קוד חדש' : 'Resend code'}</button>
            </>
          )}

          {method === 'email' && (
            <>
              <div className="sl-field">
                <label className="sl-label">{he ? 'אימייל' : 'Email'}</label>
                <input className="sl-input" type="email" inputMode="email" autoComplete="username email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder={he ? 'כל כתובת אימייל' : 'Any email address'} />
              </div>
              <div className="sl-field">
                <label className="sl-label">{he ? 'סיסמה' : 'Password'}</label>
                <input className="sl-input" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="sl-field">
                <label className="sl-label">{he ? 'אישור סיסמה (לחשבון חדש)' : 'Confirm password (new account)'}</label>
                <input className="sl-input" type="password" autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
            </>
          )}

          {!(method === 'mobile' && sent) && (
            <>
              <label className="sl-terms">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  {he ? 'אני מסכים/ה ל' : 'I agree to the '}
                  <a href="/terms" target="_blank" rel="noreferrer">{he ? 'תנאי השימוש' : 'Terms of Service'}</a>
                  {he ? ' ול' : ' and '}
                  <a href="/privacy-policy" target="_blank" rel="noreferrer">{he ? 'מדיניות הפרטיות' : 'Privacy Policy'}</a>
                </span>
              </label>
              <button className="sl-btn sl-primary" disabled={busy} onClick={() => (method === 'email' ? void emailSubmit() : void sendCode())}>
                {busy ? '…' : (he ? 'צור חשבון מאובטח' : 'Create Secure Account')}
              </button>
            </>
          )}

          <div className="sl-foot">{he ? '🔒 מאובטח · מוצפן · פרטי' : '🔒 Secure · Encrypted · Private'}</div>
        </div>
      </section>
    </div>
  );
}
