/**
 * SignUpLuxury — black-luxury 2026 signup, STEP 1 (preview at /signup-lux).
 *
 * Live /signup is untouched. Visual: matte black, WHITE logo, gold accents only.
 * Staged: Step 1 = social + mobile + email entry only.
 *
 * Hardened for devices (can't be browser-tested from CI, so done defensively):
 *  - OAuth uses getAuthStrategy() → signInWithRedirect on iOS (Safari blocks popups),
 *    signInWithPopup on desktop. AuthProvider handles the redirect return.
 *  - Inputs are 16px (prevents iOS Safari zoom-on-focus).
 *  - min-height (not fixed 100svh) + scroll so nothing clips on small screens.
 *  - Breakpoints for small phone / tablet / landscape; larger fonts + ≥54px touch
 *    targets for older users; an extra readable helper line.
 *  - RTL via dir; he/en strings (Arabic/Russian/French deferred per launch plan).
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { signInWithPopup, signInWithRedirect, signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAuthStrategy, createGoogleProvider, createAppleProvider, createFacebookProvider } from '@/lib/iosAuthHandler';
import { getApiUrl } from '@/lib/apiConfig';
import { type Language } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { FaApple, FaFacebook } from 'react-icons/fa';
import { SiInstagram } from 'react-icons/si';

interface Props {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function SignUpLuxury({ language = 'en' }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const he = language === 'he';

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => toast({ variant: 'destructive', title: he ? 'שגיאה' : 'Error', description: msg });

  async function sendCode() {
    if (!phone) { fail(he ? 'הזן מספר טלפון' : 'Enter your mobile number'); return; }
    setBusy(true);
    try {
      const r = await fetch(getApiUrl('/api/auth/sms/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, language, flow: 'prestige' }),
      });
      const d = await r.json();
      if (!d.ok) { fail(d.message || (he ? 'שליחת הקוד נכשלה' : 'Could not send code')); return; }
      setSent(true);
      toast({ title: he ? 'קוד נשלח 📲' : 'Code sent 📲' });
    } catch (e) { logger.error('[lux] sendCode', e); fail(he ? 'שגיאת רשת' : 'Network error'); }
    finally { setBusy(false); }
  }

  async function verify(c: string) {
    setBusy(true);
    try {
      const v = await fetch(getApiUrl('/api/auth/sms/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, code: c, language, flow: 'prestige' }),
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
      navigate(vd.redirect || '/member/dashboard');
    } catch (e) { logger.error('[lux] verify', e); fail(he ? 'האימות נכשל' : 'Verification failed'); }
    finally { setBusy(false); }
  }

  // iOS Safari blocks popups → use redirect there (AuthProvider handles the return).
  async function social(which: 'google' | 'apple' | 'facebook') {
    setBusy(true);
    try {
      const provider = which === 'google' ? createGoogleProvider()
        : which === 'apple' ? createAppleProvider() : createFacebookProvider();
      if (getAuthStrategy() === 'redirect') {
        await signInWithRedirect(auth, provider); // page navigates away; AuthProvider mints session on return
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      navigate('/member/dashboard');
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user') return;
      logger.error('[lux] social', e); fail(he ? 'ההתחברות נכשלה' : 'Sign-in failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="sl-root" dir={he ? 'rtl' : 'ltr'}>
      <style>{`
        .sl-root{--gold:#d8ad55;--gold2:#f4d48a;--white:#fffaf0;--muted:rgba(255,250,240,.7);--line:rgba(255,255,255,.14);
          min-height:100svh;background:radial-gradient(circle at 18% 8%,rgba(244,212,138,.16),transparent 30%),radial-gradient(circle at 82% 90%,rgba(216,173,85,.12),transparent 32%),linear-gradient(135deg,#050505,#111 50%,#050505);
          color:var(--white);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;display:grid;grid-template-columns:1.05fr .95fr}
        /* HERO */
        .sl-hero{position:relative;padding:clamp(24px,4vw,56px);display:flex;flex-direction:column;justify-content:space-between;gap:24px;overflow:hidden;min-height:100svh}
        .sl-hero:after{content:"";position:absolute;inset:auto 0 0 0;height:40%;background:linear-gradient(transparent,rgba(5,5,5,.94));z-index:1}
        .sl-hero > *{position:relative;z-index:2}
        .sl-heroArt{position:absolute;inset:0;z-index:0;background:center/cover no-repeat;background-image:url(/brand/hero-dog-lux.jpg);opacity:.55;-webkit-mask-image:linear-gradient(90deg,transparent,#000 55%);mask-image:linear-gradient(90deg,transparent,#000 55%)}
        .sl-logo{height:48px;width:auto;filter:brightness(0) invert(1)}
        .sl-eyebrow{letter-spacing:.22em;text-transform:uppercase;font-size:12px;color:var(--muted);font-weight:800}
        .sl-h1{font-family:"Playfair Display",Georgia,serif;font-size:clamp(44px,6.5vw,100px);line-height:.92;letter-spacing:-.04em;margin:0}
        .sl-gold{background:linear-gradient(90deg,var(--gold2),var(--gold),#9d6f23);-webkit-background-clip:text;background-clip:text;color:transparent}
        .sl-sub{margin-top:18px;max-width:520px;color:var(--muted);font-size:clamp(16px,1.5vw,20px);line-height:1.45}
        .sl-trust{margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:560px}
        .sl-tCard{border:1px solid var(--line);background:rgba(0,0,0,.34);border-radius:18px;padding:14px}
        .sl-tCard b{color:var(--gold2);font-size:14px;display:block}
        .sl-tCard span{color:var(--muted);font-size:12px;display:block;margin-top:5px;line-height:1.35}
        /* PANEL */
        .sl-panelWrap{display:flex;align-items:center;justify-content:center;padding:clamp(18px,3vw,44px);min-height:100svh}
        .sl-panel{width:100%;max-width:480px;border-radius:28px;border:1px solid rgba(244,212,138,.22);
          background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.04));-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);
          box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16);padding:clamp(24px,3.4vw,40px);display:flex;flex-direction:column;gap:18px}
        .sl-title{font-family:"Playfair Display",Georgia,serif;font-size:clamp(30px,3.4vw,42px);margin:0;line-height:1}
        .sl-p{margin:0;color:var(--muted);font-size:16px;line-height:1.5}
        /* Larger, high-contrast helper line for older users */
        .sl-helper{margin:0;color:var(--white);font-size:17px;font-weight:600;line-height:1.5}
        .sl-social{display:grid;grid-template-columns:1fr 1fr;gap:11px}
        .sl-btn{appearance:none;border:1px solid var(--line);cursor:pointer;min-height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:9px;font-weight:800;font-size:16px;background:rgba(0,0,0,.34);color:var(--white);transition:.2s;-webkit-tap-highlight-color:transparent}
        .sl-btn:hover{transform:translateY(-1px);border-color:rgba(244,212,138,.4)}
        .sl-btn:active{transform:translateY(0)}
        .sl-btn:disabled{opacity:.5;cursor:not-allowed}
        .sl-primary{width:100%;background:linear-gradient(135deg,var(--gold2),var(--gold),#9d6f23);color:#0a0a0a;border:0;box-shadow:0 16px 40px rgba(216,173,85,.26)}
        .sl-div{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;color:rgba(255,250,240,.5);font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:800}
        .sl-div:before,.sl-div:after{content:"";height:1px;background:linear-gradient(90deg,transparent,rgba(244,212,138,.3),transparent)}
        .sl-field{display:grid;gap:7px}
        .sl-label{font-size:13px;color:var(--gold2);font-weight:800;text-transform:uppercase;letter-spacing:.1em}
        /* font-size:16px on inputs prevents iOS Safari auto-zoom on focus */
        .sl-input{min-height:56px;border-radius:16px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:var(--white);font-size:16px;font-weight:600;padding:0 16px;width:100%}
        .sl-input::placeholder{color:rgba(255,250,240,.42)}
        .sl-foot{text-align:center;color:rgba(255,250,240,.55);font-size:13px;line-height:1.5}
        /* TABLET / STACK */
        @media(max-width:980px){
          .sl-root{grid-template-columns:1fr;min-height:auto}
          .sl-hero{min-height:auto;padding:28px 24px 36px}
          .sl-heroArt{-webkit-mask-image:linear-gradient(180deg,#000 40%,transparent);mask-image:linear-gradient(180deg,#000 40%,transparent);opacity:.45}
          .sl-panelWrap{min-height:auto;padding:8px 16px 40px}
          .sl-h1{font-size:clamp(40px,11vw,72px)}
        }
        /* SMALL PHONE */
        @media(max-width:430px){
          .sl-social{grid-template-columns:1fr}
          .sl-panel{padding:22px 18px;border-radius:22px}
          .sl-h1{font-size:clamp(36px,12vw,56px)}
          .sl-sub,.sl-p{font-size:16px}
        }
        /* LANDSCAPE / short height: shrink hero, let it scroll */
        @media(max-height:560px) and (orientation:landscape){
          .sl-root{grid-template-columns:1fr;min-height:auto}
          .sl-hero{min-height:auto;padding:20px 24px}
          .sl-trust{display:none}
          .sl-panelWrap{min-height:auto;padding:16px}
        }
        @media(prefers-reduced-motion:reduce){.sl-btn{transition:none}}
      `}</style>

      <section className="sl-hero">
        <div className="sl-heroArt" />
        <div><img src="/petwash-logo-official.png" alt="PetWash" className="sl-logo" /></div>
        <div>
          <div className="sl-eyebrow">{he ? 'אקוסיסטם יוקרתי וחכם לחיות מחמד' : 'Intelligent pet-care ecosystem'}</div>
          <h1 className="sl-h1">{he ? 'העתיד של' : 'The Future of'}<br /><span className="sl-gold">{he ? 'חיי חיות המחמד' : 'Pet Lifestyle'}</span></h1>
          <p className="sl-sub">{he ? 'שמונה פלטפורמות. אקוסיסטם אחד חכם לטיפול בחיות מחמד.' : 'Eight revolutionary platforms. One intelligent pet-care ecosystem.'}</p>
          <div className="sl-trust">
            <div className="sl-tCard"><b>Face ID</b><span>{he ? 'גישה ביומטרית מאובטחת' : 'Secure biometric access'}</span></div>
            <div className="sl-tCard"><b>{he ? 'ארנק' : 'Wallet'}</b><span>{he ? 'Apple / Google Wallet' : 'Apple & Google Wallet'}</span></div>
            <div className="sl-tCard"><b>{he ? 'אבטחת 2026' : '2026 Security'}</b><span>{he ? 'Passkey · OTP · הגנה' : 'Passkey · OTP · fraud shield'}</span></div>
          </div>
        </div>
        <div className="sl-eyebrow">{he ? 'יוקרה · חדשנות · אהבה' : 'Luxury · Innovation · Love'}</div>
      </section>

      <section className="sl-panelWrap">
        <div className="sl-panel">
          <div style={{ display: 'grid', gap: 8 }}>
            <h2 className="sl-title">{he ? 'צור חשבון' : 'Create your account'}</h2>
            <p className="sl-helper">{he ? 'הירשם בקלות עם הטלפון, האימייל או חשבון קיים.' : 'Sign up easily with your phone, email, or an existing account.'}</p>
          </div>

          <div className="sl-social">
            <button className="sl-btn" disabled={busy} onClick={() => social('google')}><span style={{ fontWeight: 900 }}>G</span> Google</button>
            <button className="sl-btn" disabled={busy} onClick={() => social('apple')}><FaApple /> Apple</button>
            <button className="sl-btn" disabled={busy} onClick={() => social('facebook')}><FaFacebook /> Facebook</button>
            <button className="sl-btn" disabled={busy} onClick={() => navigate('/signup')}><SiInstagram /> Instagram</button>
          </div>

          <div className="sl-div">{he ? 'או הירשם עם' : 'or sign up with'}</div>

          {!sent ? (
            <>
              <div className="sl-field">
                <label className="sl-label">{he ? 'מספר נייד' : 'Mobile number'}</label>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
              </div>
              <div className="sl-field">
                <label className="sl-label">{he ? 'אימייל (אופציונלי)' : 'Email (optional)'}</label>
                <input className="sl-input" type="email" inputMode="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder={he ? 'Gmail, Hotmail או כל אימייל' : 'Gmail, Hotmail, or any email'} />
              </div>
              <button className="sl-btn sl-primary" disabled={busy} onClick={sendCode}>
                {busy ? '…' : (he ? 'שלח קוד אימות' : 'Send verification code')}
              </button>
            </>
          ) : (
            <>
              <p className="sl-helper" style={{ textAlign: 'center' }}>{he ? `הזן את הקוד שנשלח ל-${phone}` : `Enter the code sent to ${phone}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verify(c); }} loading={busy} language={he ? 'he' : 'en'} />
              <button className="sl-btn" disabled={busy} onClick={() => setSent(false)}>
                {he ? 'שלח קוד חדש' : 'Resend code'}
              </button>
            </>
          )}

          <div className="sl-foot">{he ? '🔒 מאובטח · מוצפן · פרטי' : '🔒 Secure · Encrypted · Private'}</div>
        </div>
      </section>
    </div>
  );
}
