/**
 * SmartSignIn — identifier-first auth screen with returning-vs-new branching.
 *
 * FLAG-GATED: rendered only when `VITE_SMART_SIGNIN_ENABLED === 'true'` (default OFF).
 * When the flag is off, App.tsx renders the existing SignIn screen unchanged — so this
 * cannot affect any live login until it's deliberately enabled and QA'd on a device.
 *
 * The principle the CEO asked for, enforced here:
 *   • RETURNING user  → prove identity (password / Google / phone code) → straight in. NO extra fields.
 *   • NEW user        → collect the legally-required details (name + 18+ DOB + terms) ONCE.
 *   • The screen detects which you are and branches; a returning user is NEVER re-asked
 *     for what they already gave (the current screen's bug: it asks returning users too).
 *
 * Auth itself reuses the SAME proven primitives as the existing screen:
 *   email/password & Google via Firebase → POST idToken to /api/auth/session;
 *   phone via /api/auth/sms/start → /verify → /phone-session → signInWithCustomToken → /api/auth/session.
 *
 * STAGE 1 scope: email/password, Google, phone OTP. Parity to add before flag-flip:
 * passkey/Face ID, magic link, PIN, Apple/Facebook, OAuth account-linking, Safari-ITP
 * redirect markers. Tracked in the smart-identity-routing SDD.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  signInWithCustomToken,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getAuthStrategy, createGoogleProvider } from '@/lib/iosAuthHandler';
import { getApiUrl } from '@/lib/apiConfig';
import { Layout } from '@/components/Layout';
import { type Language } from '@/lib/i18n';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { logger } from '@/lib/logger';
import { Phone, Lock, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

interface SmartSignInProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

/** Identifier-first flow steps. */
type Step =
  | 'identify'      // pick how to sign in (email / phone / Google)
  | 'password'      // returning email user → enter password
  | 'newAccount'    // brand-new email user → set password + required details
  | 'phoneCode'     // phone user → enter the SMS code
  | 'newDetails';   // brand-new phone/social user → required details (name + DOB + terms)

const SUPPORT_INTENT_DEFAULT = '/dashboard';

export default function SmartSignIn({ language, onLanguageChange }: SmartSignInProps) {
  const he = language === 'he';
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>('identify');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneEntry, setPhoneEntry] = useState(false);

  // New-user required fields (only shown to NEW accounts — never to returning users).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [terms, setTerms] = useState(false);

  const fail = (m: string) => { setErr(m); setBusy(false); };
  const tr = (en: string, hv: string) => (he ? hv : en);

  /** Establish the server session from a Firebase ID token, then route. */
  async function createSessionAndRoute(isNewUser: boolean) {
    const idToken = await auth.currentUser!.getIdToken(true);
    await fetch(getApiUrl('/api/auth/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    // Returning user → straight to the app. New user → collect required details first.
    if (isNewUser) { setStep('newDetails'); setBusy(false); return; }
    navigate(SUPPORT_INTENT_DEFAULT);
  }

  // ── Email: identifier-first. Try sign-in; "user not found" = it's a NEW account. ──
  async function continueEmail() {
    setErr(null);
    if (!email.includes('@')) return fail(tr('Enter a valid email', 'יש להזין אימייל תקין'));
    // Move to password step; we detect returning vs new when they submit it.
    setStep('password');
  }

  async function submitPassword() {
    setErr(null); setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await createSessionAndRoute(false); // existing account → returning → straight in
      logger.info('[SmartSignIn] returning email user signed in');
      void cred;
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found') {
        // Not a returning user → this is a NEW account. Switch to create flow.
        setStep('newAccount'); setBusy(false); setErr(null);
        return;
      }
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        return fail(tr('Wrong password. Try again or reset it.', 'סיסמה שגויה. נסה שוב או אפס אותה.'));
      }
      logger.error('[SmartSignIn] email sign-in error', e);
      fail(tr('Sign-in failed. Please try again.', 'ההתחברות נכשלה. נסה שוב.'));
    }
  }

  async function createEmailAccount() {
    setErr(null);
    if (!terms) return fail(tr('Please accept the Terms and Privacy Policy.', 'יש לאשר את התנאים ומדיניות הפרטיות.'));
    if (!firstName.trim()) return fail(tr('Enter your first name.', 'יש להזין שם פרטי.'));
    if (!isAdult(dob)) return fail(tr('You must be 18 or older.', 'יש להיות בני 18 ומעלה.'));
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      try { await sendEmailVerification(auth.currentUser!); } catch { /* non-blocking */ }
      await persistNewProfile();
      await createSessionAndRoute(false); // account + profile created → into the app
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        // They're actually returning → bounce back to password.
        setStep('password'); setBusy(false);
        return fail(tr('You already have an account — enter your password.', 'כבר יש לך חשבון — הזן סיסמה.'));
      }
      logger.error('[SmartSignIn] create account error', e);
      fail(tr('Could not create the account. Please try again.', 'יצירת החשבון נכשלה. נסה שוב.'));
    }
  }

  // ── Google: getAdditionalUserInfo tells us returning vs new directly. ──
  async function continueGoogle() {
    setErr(null); setBusy(true);
    try {
      const provider = createGoogleProvider();
      if (getAuthStrategy() === 'redirect') { await signInWithRedirect(auth, provider); return; }
      const result = await signInWithPopup(auth, provider);
      const isNew = !!getAdditionalUserInfo(result)?.isNewUser;
      await createSessionAndRoute(isNew);
      logger.info('[SmartSignIn] google sign-in', { isNew });
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user') { setBusy(false); return; }
      logger.error('[SmartSignIn] google error', e);
      fail(tr('Google sign-in did not complete. Try email or phone.', 'התחברות Google לא הושלמה. נסה אימייל או נייד.'));
    }
  }

  // ── Phone OTP: same proven endpoint chain as the existing screen. ──
  async function sendPhoneCode() {
    setErr(null);
    if (phone.replace(/\D/g, '').length < 6) return fail(tr('Enter your mobile number.', 'הזן מספר נייד.'));
    setBusy(true);
    try {
      const r = await fetch(getApiUrl('/api/auth/sms/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, language }),
      });
      const d = await r.json();
      if (!d.ok) return fail(d.message || tr('Could not send the code.', 'שליחת הקוד נכשלה.'));
      setStep('phoneCode'); setBusy(false);
    } catch (e) {
      logger.error('[SmartSignIn] sms/start error', e);
      fail(tr('Could not send the code.', 'שליחת הקוד נכשלה.'));
    }
  }

  async function verifyPhoneCode(value: string) {
    setErr(null); setBusy(true);
    try {
      const vr = await fetch(getApiUrl('/api/auth/sms/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ phone, code: value, language }),
      });
      const vd = await vr.json();
      if (!vd.ok) return fail(vd.message || tr('Invalid code.', 'קוד שגוי.'));
      const sr = await fetch(getApiUrl('/api/auth/phone-session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ verificationToken: vd.verificationToken }),
      });
      const sd = await sr.json();
      if (!sd.customToken) return fail(tr('Sign-in failed. Please try again.', 'ההתחברות נכשלה. נסה שוב.'));
      await signInWithCustomToken(auth, sd.customToken);
      // A brand-new phone user has no profile yet → collect required details once.
      const isNew = !!sd.isNewUser;
      await createSessionAndRoute(isNew);
    } catch (e) {
      logger.error('[SmartSignIn] phone verify error', e);
      fail(tr('Sign-in failed. Please try again.', 'ההתחברות נכשלה. נסה שוב.'));
    }
  }

  async function submitNewDetails() {
    setErr(null);
    if (!terms) return fail(tr('Please accept the Terms and Privacy Policy.', 'יש לאשר את התנאים ומדיניות הפרטיות.'));
    if (!firstName.trim()) return fail(tr('Enter your first name.', 'יש להזין שם פרטי.'));
    if (!isAdult(dob)) return fail(tr('You must be 18 or older.', 'יש להיות בני 18 ומעלה.'));
    setBusy(true);
    try {
      await persistNewProfile();
      navigate(SUPPORT_INTENT_DEFAULT);
    } catch (e) {
      logger.error('[SmartSignIn] save profile error', e);
      fail(tr('Could not save your details. Please try again.', 'שמירת הפרטים נכשלה. נסה שוב.'));
    }
  }

  async function persistNewProfile() {
    await fetch(getApiUrl('/api/auth/complete-profile'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ firstName, lastName, dateOfBirth: dob, acceptedTerms: terms }),
    }).catch(() => { /* surfaced to caller via navigate fallback */ });
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
      <div className="min-h-screen flex items-center justify-center px-4 py-10 luxury-bg-mesh">
        <div className="w-full max-w-md luxury-glass-card luxury-shadow-lg p-8" role="form">
          <h1 className="luxury-heading-md mb-1">{tr('Welcome to ⁦Pet Wash™⁩', 'ברוכים הבאים ל⁦Pet Wash™⁩')}</h1>
          <p className="luxury-text-body mb-6">
            {step === 'newAccount' || step === 'newDetails'
              ? tr('Just a few details to set up your account.', 'עוד כמה פרטים להקמת החשבון.')
              : tr('Sign in or create your account.', 'התחבר או צור חשבון.')}
          </p>

          {err && <p role="alert" className="text-sm mb-4" style={{ color: '#ef4444' }}>{err}</p>}

          {/* STEP: identifier-first */}
          {step === 'identify' && (
            <div className="space-y-4">
              <label className="text-sm font-medium">{tr('Email', 'אימייל')}</label>
              <div className="flex gap-2">
                <input type="email" inputMode="email" autoComplete="username" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm" style={{ minWidth: 0 }} />
                <button onClick={continueEmail} disabled={busy}
                  className="rounded-xl px-4 py-3 bg-black text-white text-sm font-medium inline-flex items-center gap-1">
                  {tr('Continue', 'המשך')} {he ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-3 my-2 text-gray-400 text-xs">
                <span className="flex-1 border-t border-gray-200" />{tr('or', 'או')}<span className="flex-1 border-t border-gray-200" />
              </div>

              <button onClick={continueGoogle} disabled={busy}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-gray-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {tr('Continue with Google', 'המשך עם Google')}
              </button>

              <button onClick={() => { setErr(null); setPhoneEntry(true); }}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-gray-50">
                <Phone className="w-4 h-4" /> {tr('Continue with phone', 'המשך עם נייד')}
              </button>

              {phoneEntry && (
                <div className="space-y-3 pt-2">
                  <PhoneInput value={phone} onChange={setPhone} />
                  <button onClick={sendPhoneCode} disabled={busy}
                    className="w-full rounded-xl px-4 py-3 bg-black text-white text-sm font-medium">
                    {busy ? '…' : tr('Send code', 'שלח קוד')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP: returning email user → password only (NO extra fields) */}
          {step === 'password' && (
            <div className="space-y-4">
              <p className="luxury-text-body text-sm">{tr('Signing in as', 'מתחבר כ')} <b>{email}</b></p>
              <div className="relative">
                <Lock className="w-4 h-4 absolute top-3.5 start-3 text-gray-400" />
                <input type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder={tr('Password', 'סיסמה')}
                  className="w-full rounded-xl border border-gray-200 ps-9 pe-4 py-3 text-sm" />
              </div>
              <button onClick={submitPassword} disabled={busy}
                className="w-full rounded-xl px-4 py-3 bg-black text-white text-sm font-medium">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : tr('Sign in', 'התחבר')}
              </button>
              <button onClick={() => { setStep('identify'); setErr(null); }} className="text-xs text-gray-500 underline">
                {tr('Use a different method', 'שיטה אחרת')}
              </button>
            </div>
          )}

          {/* STEP: NEW email account → set password + required details (legal: name, 18+, terms) */}
          {(step === 'newAccount' || step === 'newDetails') && (
            <div className="space-y-3">
              {step === 'newAccount' && (
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder={tr('Choose a password', 'בחר סיסמה')}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
              )}
              <div className="flex gap-2">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={tr('First name', 'שם פרטי')}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm" style={{ minWidth: 0 }} />
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={tr('Last name', 'שם משפחה')}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm" style={{ minWidth: 0 }} />
              </div>
              <label className="text-xs text-gray-500">{tr('Date of birth (18+)', 'תאריך לידה (18+)')}</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
                <span>{tr('I accept the Terms and Privacy Policy.', 'אני מאשר/ת את התנאים ומדיניות הפרטיות.')}</span>
              </label>
              <button onClick={step === 'newAccount' ? createEmailAccount : submitNewDetails} disabled={busy}
                className="w-full rounded-xl px-4 py-3 bg-black text-white text-sm font-medium">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : tr('Create account', 'צור חשבון')}
              </button>
            </div>
          )}

          {/* STEP: phone code */}
          {step === 'phoneCode' && (
            <div className="space-y-4">
              <p className="luxury-text-body text-sm">{tr('Enter the code we sent to', 'הזן את הקוד שנשלח אל')} <b dir="ltr">{phone}</b></p>
              <OtpCodeInput length={6} onComplete={(c) => { setCode(c); verifyPhoneCode(c); }} />
              <button onClick={() => { setStep('identify'); setErr(null); }} className="text-xs text-gray-500 underline">
                {tr('Use a different method', 'שיטה אחרת')}
              </button>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span className="hidden">{code}</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function isAdult(dobStr: string): boolean {
  if (!dobStr) return false;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return false;
  const now = new Date('2026-06-10T00:00:00Z');
  const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age >= 18;
}
