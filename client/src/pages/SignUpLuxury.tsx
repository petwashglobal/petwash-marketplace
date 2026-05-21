/**
 * SignUpLuxury — black-luxury 2026 signup, STEP 1 (preview).
 *
 * Mounted at /signup-lux as a PREVIEW so the live /signup keeps working while we
 * iterate the cinematic look from device screenshots. Once approved, /signup is
 * pointed here.
 *
 * Visual: matte black, WHITE logo, gold = subtle accents only (per brand call).
 * Staged: Step 1 = social + mobile + email entry ONLY. Consents / wallet / Face ID
 * / remember-me move to a post-account Step 3 (not here).
 *
 * Mobile is fully wired to the canonical /api/auth/sms chain. Google/Apple/Facebook
 * reuse the existing Firebase OAuth providers + session-cookie exchange.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { signInWithPopup, signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createGoogleProvider, createAppleProvider, createFacebookProvider } from '@/lib/iosAuthHandler';
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
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => toast({ variant: 'destructive', title: he ? 'שגיאה' : 'Error', description: msg });

  // ── Mobile: /api/auth/sms/start ─────────────────────────────────────────────
  async function sendCode() {
    if (!phone) return fail(he ? 'הזן מספר טלפון' : 'Enter your mobile number');
    setBusy(true);
    try {
      const r = await fetch(getApiUrl('/api/auth/sms/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, language, flow: 'prestige' }),
      });
      const d = await r.json();
      if (!d.ok) return fail(d.message || (he ? 'שליחת הקוד נכשלה' : 'Could not send code'));
      setSent(true);
      toast({ title: he ? 'קוד נשלח 📲' : 'Code sent 📲' });
    } catch (e) { logger.error('[lux] sendCode', e); fail(he ? 'שגיאת רשת' : 'Network error'); }
    finally { setBusy(false); }
  }

  // ── Mobile: verify → phone-session → custom token → session cookie ──────────
  async function verify(c: string) {
    setBusy(true);
    try {
      const v = await fetch(getApiUrl('/api/auth/sms/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, code: c, language, flow: 'prestige' }),
      });
      const vd = await v.json();
      if (!vd.ok) return fail(vd.message || (he ? 'קוד שגוי' : 'Invalid code'));
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

  // ── Social: reuse Firebase providers + session exchange ─────────────────────
  async function social(which: 'google' | 'apple' | 'facebook') {
    setBusy(true);
    try {
      const provider = which === 'google' ? createGoogleProvider()
        : which === 'apple' ? createAppleProvider() : createFacebookProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      navigate('/member/dashboard');
    } catch (e) { logger.error('[lux] social', e); fail(he ? 'ההתחברות נכשלה' : 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="sl-root" dir={he ? 'rtl' : 'ltr'}>
      <style>{`
        .sl-root{--gold:#d8ad55;--gold2:#f4d48a;--white:#fffaf0;--muted:rgba(255,250,240,.66);--line:rgba(255,255,255,.14);
          min-height:100svh;background:radial-gradient(circle at 18% 8%,rgba(244,212,138,.16),transparent 30%),radial-gradient(circle at 82% 88%,rgba(216,173,85,.12),transparent 32%),linear-gradient(135deg,#050505,#111 50%,#050505);
          color:var(--white);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;display:grid;grid-template-columns:1.05fr .95fr}
        .sl-hero{position:relative;padding:clamp(28px,4vw,56px);display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;min-height:100svh}
        .sl-hero:after{content:"";position:absolute;inset:auto 0 0 0;height:38%;background:linear-gradient(transparent,rgba(5,5,5,.92))}
        .sl-hero > *{position:relative;z-index:2}
        .sl-logoRow{display:flex;align-items:center;gap:12px}
        .sl-logo{height:46px;width:auto;filter:brightness(0) invert(1)}
        .sl-eyebrow{letter-spacing:.24em;text-transform:uppercase;font-size:11px;color:var(--muted);font-weight:800}
        .sl-h1{font-family:"Playfair Display",Georgia,serif;font-size:clamp(48px,7vw,104px);line-height:.9;letter-spacing:-.04em;margin:0}
        .sl-gold{background:linear-gradient(90deg,var(--gold2),var(--gold),#9d6f23);-webkit-background-clip:text;background-clip:text;color:transparent}
        .sl-sub{margin-top:22px;max-width:520px;color:var(--muted);font-size:clamp(15px,1.5vw,20px);line-height:1.4}
        .sl-heroArt{position:absolute;inset:0;z-index:1;background:center/cover no-repeat;opacity:.5;mask-image:linear-gradient(90deg,transparent,#000 55%)}
        .sl-trust{margin-top:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:560px}
        .sl-tCard{border:1px solid var(--line);background:rgba(0,0,0,.3);border-radius:18px;padding:13px}
        .sl-tCard b{color:var(--gold2);font-size:13px;display:block}
        .sl-tCard span{color:var(--muted);font-size:11px;display:block;margin-top:4px;line-height:1.3}
        .sl-panelWrap{display:flex;align-items:center;justify-content:center;padding:clamp(18px,3vw,44px)}
        .sl-panel{width:100%;max-width:460px;border-radius:30px;border:1px solid rgba(244,212,138,.22);
          background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.04));backdrop-filter:blur(26px);
          box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16);padding:clamp(22px,3vw,38px);display:flex;flex-direction:column;gap:18px}
        .sl-title{font-family:"Playfair Display",Georgia,serif;font-size:clamp(28px,3.4vw,40px);margin:0;line-height:1}
        .sl-p{margin:0;color:var(--muted);font-size:14px}
        .sl-social{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .sl-btn{appearance:none;border:1px solid var(--line);cursor:pointer;min-height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:9px;font-weight:800;font-size:14px;background:rgba(0,0,0,.34);color:var(--white);transition:.2s}
        .sl-btn:hover{transform:translateY(-1px);border-color:rgba(244,212,138,.4)}
        .sl-btn:disabled{opacity:.5;cursor:not-allowed}
        .sl-primary{width:100%;background:linear-gradient(135deg,var(--gold2),var(--gold),#9d6f23);color:#0a0a0a;border:0;box-shadow:0 16px 40px rgba(216,173,85,.26)}
        .sl-div{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;color:rgba(255,250,240,.45);font-size:11px;text-transform:uppercase;letter-spacing:.16em;font-weight:800}
        .sl-div:before,.sl-div:after{content:"";height:1px;background:linear-gradient(90deg,transparent,rgba(244,212,138,.3),transparent)}
        .sl-field{display:grid;gap:6px}
        .sl-label{font-size:11px;color:var(--gold2);font-weight:800;text-transform:uppercase;letter-spacing:.13em}
        .sl-input{min-height:52px;border-radius:16px;border:1px solid var(--line);background:rgba(0,0,0,.3);color:var(--white);font-size:15px;font-weight:600;padding:0 15px;width:100%}
        .sl-input::placeholder{color:rgba(255,250,240,.4)}
        .sl-foot{text-align:center;color:rgba(255,250,240,.5);font-size:11px;line-height:1.4}
        @media(max-width:980px){.sl-root{grid-template-columns:1fr}.sl-hero{min-height:42svh}.sl-trust{grid-template-columns:1fr}}
      `}</style>

      <section className="sl-hero">
        {/* Drop the cinematic dog at client/public/brand/hero-dog-lux.jpg to light up the hero. */}
        <div className="sl-heroArt" style={{ backgroundImage: 'url(/brand/hero-dog-lux.jpg)' }} />
        <div className="sl-logoRow">
          <img src="/petwash-logo-official.png" alt="PetWash" className="sl-logo" />
        </div>
        <div>
          <div className="sl-eyebrow">{he ? 'אקוסיסטם יוקרתי לחיות מחמד' : 'Intelligent pet-care ecosystem'}</div>
          <h1 className="sl-h1">{he ? 'העתיד של' : 'The Future of'}<br /><span className="sl-gold">{he ? 'חיי חיות המחמד' : 'Pet Lifestyle'}</span></h1>
          <p className="sl-sub">{he ? 'שמונה פלטפורמות. אקוסיסטם אחד חכם לטיפול בחיות מחמד.' : 'Eight revolutionary platforms. One intelligent pet-care ecosystem.'}</p>
          <div className="sl-trust">
            <div className="sl-tCard"><b>Face ID</b><span>{he ? 'גישה ביומטרית מאובטחת' : 'Secure biometric access'}</span></div>
            <div className="sl-tCard"><b>{he ? 'ארנק' : 'Wallet'}</b><span>{he ? 'כרטיס Apple / Google Wallet' : 'Apple & Google Wallet pass'}</span></div>
            <div className="sl-tCard"><b>{he ? 'אבטחת 2026' : '2026 Security'}</b><span>{he ? 'Passkey · OTP · הגנת הונאה' : 'Passkey · OTP · fraud shield'}</span></div>
          </div>
        </div>
        <div className="sl-eyebrow">{he ? 'יוקרה · חדשנות · אהבה' : 'Luxury · Innovation · Love'}</div>
      </section>

      <section className="sl-panelWrap">
        <div className="sl-panel">
          <div>
            <h2 className="sl-title">{he ? 'צור חשבון' : 'Create your account'}</h2>
            <p className="sl-p">{he ? 'הצטרף לעתיד הטיפול החכם בחיות מחמד' : 'Join the future of intelligent pet care'}</p>
          </div>

          <div className="sl-social">
            <button className="sl-btn" disabled={busy} onClick={() => social('google')}>
              <span style={{ fontWeight: 900 }}>G</span> Google
            </button>
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
                <input className="sl-input" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder={he ? 'Gmail, Hotmail או כל אימייל' : 'Gmail, Hotmail, or any email'} />
              </div>
              <button className="sl-btn sl-primary" disabled={busy} onClick={sendCode}>
                {busy ? '…' : (he ? 'שלח קוד אימות' : 'Send verification code')}
              </button>
            </>
          ) : (
            <>
              <p className="sl-p" style={{ textAlign: 'center' }}>{he ? `קוד נשלח ל-${phone}` : `Code sent to ${phone}`}</p>
              <OtpCodeInput length={6} value={code} onChange={setCode} onComplete={(c) => { void verify(c); }} disabled={busy} />
              <button className="sl-btn sl-primary" disabled={busy || code.length < 6} onClick={() => verify(code)}>
                {busy ? '…' : (he ? 'אמת והמשך' : 'Verify & continue')}
              </button>
              <button className="sl-btn" disabled={busy} onClick={() => { setSent(false); setCode(''); }}>
                {he ? 'שלח קוד חדש' : 'Resend code'}
              </button>
            </>
          )}

          <div className="sl-foot">{he ? 'מאובטח · מוצפן · פרטי' : 'Secure · Encrypted · Private'}</div>
        </div>
      </section>
    </div>
  );
}
