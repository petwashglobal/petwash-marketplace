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
  getRedirectResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAuthStrategy, createGoogleProvider, createAppleProvider, createFacebookProvider,
  isNativePlatform, signInWithGoogleNative, signInWithAppleNative } from '@/lib/iosAuthHandler';
import { getApiUrl } from '@/lib/apiConfig';
import { useAppFlavor } from '@/lib/appFlavor';
import { type Language } from '@/lib/i18n';
import { fieldSchemas, vmsg } from '@/lib/validation';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { signupFlags } from '@/lib/authSignupFlags';
// Intent preservation across the OAuth redirect (Safari-ITP safe) — ported from
// the retired SignIn.tsx when it was unified into this screen (2026-06-28). Keeps
// provider/loyalty signup intent through a cross-origin Firebase redirect.
import { seedSignupIntentCookie } from '@/lib/seedIntent';
import { applyIntentFromUrl } from '@/lib/intentParam';
import { setProviderSignupIntent } from '@/lib/becomeProvider';
import { AppleWheelDatePicker } from '@/components/ui/apple-wheel-picker';
import { useSEO, pageSEO } from '@/lib/seo';
import { executeTurnstileInvisible } from '@/components/TurnstileWidget';
import {
  isPlatformAuthenticatorAvailable,
  getBiometricMethodName,
  signInWithPasskey,
  signInWithPasskeyConditional,
} from '@/auth/passkey';
import {
  FaApple, FaFacebookF, FaInstagram, FaTiktok, FaLock,
  FaShieldAlt,
  FaCog, FaGift, FaCalendarAlt, FaHeartbeat,
  FaEnvelope, FaPhoneAlt, FaPaw, FaFingerprint,
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

// Redirect marker — SAME key/format as SignIn.tsx so the two pages + AuthProvider
// coexist (Firebase clears getRedirectResult after the first read). BUGFIX 2026-06-18:
// /signup previously launched signInWithRedirect with NO marker and NO result handler,
// so after Google completed and Safari returned to /signup the page just re-rendered
// the signup form ("pressed Gmail, came back to sign up").
const REDIRECT_MARKER_KEY = 'pw_redirect_provider';
const REDIRECT_MARKER_TTL = 5 * 60 * 1000;
function setSignupRedirectMarker(provider: string): void {
  const data = JSON.stringify({ provider, ts: Date.now() });
  try { sessionStorage.setItem(REDIRECT_MARKER_KEY, data); } catch { /* ignore */ }
  try { localStorage.setItem(REDIRECT_MARKER_KEY, data); } catch { /* ignore */ }
}
function getSignupRedirectMarker(): string | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(REDIRECT_MARKER_KEY);
      if (!raw) continue;
      const { provider, ts } = JSON.parse(raw);
      if (Date.now() - ts > REDIRECT_MARKER_TTL) { store.removeItem(REDIRECT_MARKER_KEY); continue; }
      return provider as string;
    } catch { continue; }
  }
  return null;
}
function clearSignupRedirectMarker(): void {
  try { sessionStorage.removeItem(REDIRECT_MARKER_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(REDIRECT_MARKER_KEY); } catch { /* ignore */ }
}

export default function SignUpLuxury({ language = 'en', onLanguageChange }: Props) {
  // One component serves /signup AND the /signin|/login aliases — pick the
  // matching SEO entry (login is noindex; signup is the indexable door).
  useSEO(/\/(signin|sign-in|login)/.test(window.location.pathname) ? pageSEO.login : pageSEO.signup);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const he = language === 'he';

  // Consent — both UNCHECKED by default (active opt-in is a legal requirement;
  // pre-ticked consent is unlawful under Israeli privacy law). Submit + every
  // social method is blocked until both are ticked. Terms/Privacy are clickable.
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [over18, setOver18] = useState(false);
  // consentOk is defined AFTER isAdult (below) so a valid 18+ DOB can satisfy
  // the age requirement without the redundant checkbox.


  // Capture ?intent=provider|loyalty|staff_request from the URL into the signup
  // intent cookie on arrival, so it survives the OAuth redirect and post-login
  // routing sends the user to the right place. (Ported from SignIn.tsx.)
  useEffect(() => { applyIntentFromUrl(); }, []);

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
  // Flow is stateful so the on-screen intent selector (member / provider) can
  // change it after arrival, not just the URL. Defaults to whatever ?flow=/?intent=
  // the user arrived with (else 'prestige' member).
  const [flow, setFlow] = useState<Flow>(() => normalizeFlow(params.get('flow') || params.get('intent')));
  const wantsProvider = flow === 'provider';

  // NATIVE APP FLAVOR (CEO 2026-07-21 "mobile separate apps"): the two native
  // apps ship this same bundle, but they are different products — the PROVIDER
  // app IS provider signup (flow locked, no intent picker, work-oriented copy,
  // zero loyalty language), and the CUSTOMER app never advertises "become a
  // provider". Web is untouched ('web' flavor → both tiles render as before).
  //
  // Uses the canonical useAppFlavor (build-time VITE_APP_FLAVOR in the real app
  // builds, async bundle-id detection as fallback) instead of a private
  // Capacitor probe — one source of truth with the header/footer/sandbox guards.
  const appFlavor = useAppFlavor();
  const nativeFlavor: 'provider' | 'customer' | null =
    appFlavor === 'web' ? null : appFlavor;
  useEffect(() => {
    if (nativeFlavor === 'provider') setFlow('provider');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeFlavor]);
  // Toggle the provider intent. Routes through the CANONICAL signup-intent path
  // (localStorage signup_intent) that the post-login decider already consumes —
  // identical to arriving via ?flow=provider — so no routing logic is forked.
  function toggleProviderIntent() {
    const on = flow !== 'provider';
    setFlow(on ? 'provider' : 'prestige');
    try { if (on) setProviderSignupIntent(); else localStorage.removeItem('signup_intent'); } catch { /* private mode */ }
  }
  // ?redirect=/shop — return the user where they came from (shop cart, booking…).
  // Internal paths only: must start with a single '/' (blocks //evil.com and
  // proto:// open-redirects).
  // Accept BOTH ?redirect= (AuthGateCard, deep links) AND ?from= (RequireAuth.tsx
  // sends ?from=<page>). Without reading ?from=, every gated-page login dropped
  // the user on /home instead of returning them where they were. (fix 2026-06-28)
  const redirectParam = params.get('redirect') || params.get('from');
  const safeRedirect = redirectParam && /^\/(?!\/)/.test(redirectParam) ? redirectParam : null;
  const dest = safeRedirect ?? destForFlow(flow);

  // Only the EXPLICIT ?flow=/?intent= the user actually arrived with (not the
  // 'prestige' default) — passed to the decider so a deliberate "become provider"
  // deep-link still routes to onboarding.
  const explicitIntent = wantsProvider ? 'provider' : (params.get('flow') || params.get('intent') || undefined);
  const { user } = useFirebaseAuth();
  // Already signed in on /signup → route by the user's ACTUAL role/status via the
  // server post-login decider: returning approved provider → /provider-os, member →
  // /home, mid-application provider → /provider-onboarding, admin → /admin/dashboard.
  // (Was a STATIC flow→dest map that sent a returning provider to /home.) Mirrors
  // SignIn.tsx. ?redirect= still wins; falls back to dest on any error.
  useEffect(() => {
    if (!user) return;
    if (safeRedirect) { navigate(safeRedirect); return; }
    let cancelled = false;
    (async () => {
      try {
        const { resolvePostLogin } = await import('@/lib/postLoginCoordinator');
        const data: any = await resolvePostLogin({ body: explicitIntent ? { intent: explicitIntent } : undefined });
        if (!cancelled) navigate(data?.nextUrl || data?.redirectTo || dest);
      } catch {
        if (!cancelled) navigate(dest);
      }
    })();
    return () => { cancelled = true; };
  }, [user, safeRedirect, explicitIntent, dest, navigate]);

  // BUGFIX 2026-06-18: handle the Google/Apple/Facebook REDIRECT return on /signup
  // (iOS uses signInWithRedirect). Without this, the user completed sign-in on
  // Google but landed back on the signup form. Mirrors SignIn.tsx and coexists with
  // AuthProvider (Firebase clears getRedirectResult after the first read).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (cancelled) return;
        if (!result) {
          // AuthProvider may have consumed the result first. If a redirect was in
          // flight and we ARE signed in, the user-effect above will navigate.
          const expected = getSignupRedirectMarker();
          if (expected) {
            clearSignupRedirectMarker();
            if (!auth.currentUser) {
              // Genuinely lost (Safari ITP cleared cross-origin state) — tell the user
              // instead of silently leaving them on the signup form.
              fail(he ? 'ההרשמה לא הושלמה — נסה שוב' : 'Sign-in did not complete. Please try again.');
            }
          }
          return;
        }
        clearSignupRedirectMarker();
        setBusy(true);
        const idToken = await result.user.getIdToken();
        const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
        if (!sessionRes.ok) {
          fail(he ? 'יצירת ההתחברות נכשלה — נסה שוב' : 'Could not establish your session. Please try again.');
          return;
        }
        await finishAndRoute();
      } catch (e: any) {
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
        logger.error('[signup] redirect result', e);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [method, setMethod] = useState<'mobile' | 'email'>('mobile');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // (legacy top `terms` checkbox removed — consent is agreedTerms + over18)
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [smsProviderHealthy, setSmsProviderHealthy] = useState(true);
  // Date of birth — required, 18+. Server re-enforces at account creation.
  const [dob, setDob] = useState('');
  // Step 2 of dual-verify: after the phone code + account, we verify the email too.
  const [emailStep, setEmailStep] = useState(false);
  // Passkey / Face ID (returning users): device-bound, the 2026 way to skip codes.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioName, setBioName] = useState('Face ID');

  const fail = (msg: string) => setInlineError(msg);

  // On mount: detect a platform authenticator (Face ID / Touch ID / fingerprint)
  // and ARM conditional passkey autofill so a returning user sees their passkey in
  // the email field with no extra tap. Fire-and-forget; never blocks the page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const avail = await isPlatformAuthenticatorAvailable();
        if (cancelled) return;
        setBioAvailable(avail);
        if (avail) setBioName(getBiometricMethodName());
        signInWithPasskeyConditional().catch(() => {});
      } catch { /* passkeys unsupported — silent, normal flow continues */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Explicit "Sign in with Face ID" tap. On success the useFirebaseAuth user
  // effect routes via the post-login decider; no consent gate (returning user
  // already accepted terms at original signup).
  async function handlePasskeyLogin() {
    setBusy(true);
    setInlineError(null);
    try {
      const r = await signInWithPasskey();
      if (!r.success) fail(r.error || (he ? 'התחברות עם Face ID נכשלה' : 'Face ID sign-in failed'));
    } catch (e: any) {
      fail(e?.message || (he ? 'התחברות עם Face ID נכשלה' : 'Face ID sign-in failed'));
    } finally {
      setBusy(false);
    }
  }

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
    if (!consentOk) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות וגיל 18+' : 'Please accept the Terms and Privacy Policy and confirm you are 18+ to continue.'); return false; }
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
          if (signupFlags.emailPassword) {
            setMethod('email');
            fail(d.message || (he ? 'SMS אינו זמין כעת — המשך עם אימייל.' : 'SMS is temporarily unavailable — continue with email.'));
            return;
          }
          // Email is disabled too — never leave the user stuck on a dead SMS tab;
          // point them at the social options that ARE available.
          fail(he ? 'SMS אינו זמין כעת — המשך עם Google או Apple.' : 'SMS is temporarily unavailable — continue with Google or Apple.');
          return;
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
        body: JSON.stringify({ verificationToken: vd.verificationToken, dateOfBirth: dob, email }),
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
      // Step 2 — NEW accounts only: phone verified + account live, now verify the
      // EMAIL with its own code before we route (both contacts confirmed). Returning
      // users (already verified) skip straight through.
      if (sd.isNewUser && emailValid) {
        setEmailStep(true);
        setMethod('email');
        setSent(true);
        try {
          await fetch(getApiUrl('/api/auth/email/start'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ email, purpose: 'signup', language }),
          });
          toast({ title: he ? 'קוד נשלח לאימייל 📧' : 'Code sent to your email 📧' });
        } catch { /* the email OTP screen has a resend */ }
        return;
      }
      await finishAndRoute();
    } catch (e) { logger.error('[signup] verify', e); fail(he ? 'האימות נכשל' : 'Verification failed'); }
    finally { setBusy(false); }
  }

  // ── Passwordless EMAIL 6-digit code (mirror of the mobile OTP flow) ──────────
  async function sendEmailCode() {
    if (!email) { fail(he ? 'הזן כתובת אימייל' : 'Enter your email'); return; }
    if (!fieldSchemas(language).email.safeParse(email.trim()).success) { fail(vmsg('validation.email.invalid', language)); return; }
    if (!requireTerms()) return;
    setInlineError(null);
    setBusy(true);
    try {
      const r = await fetch(getApiUrl('/api/auth/email/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email, purpose: 'signup', language }),
      });
      const d = await r.json();
      if (!d.ok) { fail(d.message || (he ? 'לא ניתן לשלוח קוד כעת' : 'Could not send the code right now')); return; }
      setSent(true);
      toast({ title: he ? 'קוד נשלח לאימייל 📧' : 'Code sent to your email 📧' });
    } catch (e) { logger.error('[signup] sendEmailCode', e); fail(he ? 'שגיאת רשת' : 'Network error'); }
    finally { setBusy(false); }
  }

  async function verifyEmailCode(c: string) {
    setInlineError(null);
    setBusy(true);
    try {
      const v = await fetch(getApiUrl('/api/auth/email/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email, code: c, purpose: 'signup' }),
      });
      const vd = await v.json();
      if (!vd.ok || !vd.sessionToken) { fail(vd.message || (he ? 'קוד שגוי' : 'Invalid code')); return; }

      // Step 2 path: the user is already signed in via phone — attach + verify the
      // email on their account, then route. (No second account is created.)
      if (emailStep) {
        const idToken = await auth.currentUser?.getIdToken(true);
        const a = await fetch(getApiUrl('/api/auth/verify-signup-email'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken, sessionToken: vd.sessionToken }),
        });
        const ad = await a.json();
        if (!ad.ok) { fail(ad.error || (he ? 'אימות האימייל נכשל' : 'Email verification failed')); return; }
        await finishAndRoute();
        return;
      }
      const s = await fetch(getApiUrl('/api/auth/email-session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ sessionToken: vd.sessionToken, dateOfBirth: dob }),
      });
      const sd = await s.json();
      if (sd.customToken) {
        const cred = await signInWithCustomToken(auth, sd.customToken);
        const idToken = await cred.user.getIdToken(true);
        await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
        await finishAndRoute();
        return;
      }
      fail(he ? 'האימות נכשל' : 'Verification failed');
    } catch (e) { logger.error('[signup] verifyEmailCode', e); fail(he ? 'האימות נכשל' : 'Verification failed'); }
    finally { setBusy(false); }
  }

  async function social(which: 'google' | 'apple' | 'facebook') {
    if (!consentOk) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות וגיל 18+' : 'Please accept the Terms and Privacy Policy and confirm you are 18+ to continue.'); return; }
    setInlineError(null);
    setBusy(true);
    try {
      // NATIVE apps (iPhone / Galaxy): use the DIRECT native sheet via
      // @capacitor-firebase/authentication. The web signInWithRedirect path
      // returns null inside the Capacitor webview, so Google/Apple sign-in only
      // works through the native handlers. Falls through to web for the browser.
      if (isNativePlatform() && (which === 'google' || which === 'apple')) {
        const cred = which === 'google'
          ? await signInWithGoogleNative(auth)
          : await signInWithAppleNative(auth);
        const idToken = await cred.user.getIdToken(true);
        const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
        if (!sessionRes.ok) {
          const label = which === 'google' ? 'Google' : 'Apple';
          fail(he ? `התחברות ${label} לא הושלמה — נסה שוב` : `${label} sign-in could not be completed. Please try again.`);
          return;
        }
        await finishAndRoute();
        return;
      }

      const provider =
        which === 'google' ? createGoogleProvider() :
        which === 'apple'  ? createAppleProvider()  :
                             createFacebookProvider();
      if (getAuthStrategy() === 'redirect') {
        // Mark which provider we're redirecting to so the on-mount handler can
        // recover the result when Safari returns the user to /signup.
        setSignupRedirectMarker(which);
        // Persist the signup intent server-side BEFORE the cross-origin redirect —
        // sessionStorage is wiped by Safari ITP on the round-trip, the httpOnly
        // cookie survives so post-login routes provider/loyalty users correctly.
        await seedSignupIntentCookie();
        await signInWithRedirect(auth, provider);
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        // Don't route into the app on a hollow session (guards would 401-bounce).
        const label = which === 'google' ? 'Google' : which === 'apple' ? 'Apple' : 'Facebook';
        fail(he ? `התחברות ${label} לא הושלמה — נסה שוב` : `${label} sign-in could not be completed. Please try again.`);
        return;
      }
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
    if (!consentOk) { fail(he ? 'יש לאשר את התנאים ומדיניות הפרטיות וגיל 18+' : 'Please accept the Terms and Privacy Policy and confirm you are 18+ to continue.'); return; }
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
    if (!fieldSchemas(language).email.safeParse(email.trim()).success) { fail(vmsg('validation.email.invalid', language)); return; }
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
            // Enumeration-safe: an existing account whose password didn't match
            // gets the SAME generic message as a wrong password — never confirm
            // whether an email is registered.
            if (ce?.code === 'auth/email-already-in-use') { fail(he ? 'אימייל או סיסמה שגויים' : 'Email or password is incorrect.'); return; }
            if (ce?.code === 'auth/weak-password') { fail(he ? 'סיסמה חלשה מדי (6 תווים לפחות)' : 'Password too weak (min 6 characters).'); return; }
            throw ce;
          }
        } else if (e?.code === 'auth/wrong-password') {
          fail(he ? 'אימייל או סיסמה שגויים' : 'Email or password is incorrect.'); return;
        } else if (e?.code === 'auth/invalid-email') {
          fail(he ? 'כתובת אימייל לא תקינה' : 'Invalid email address.'); return;
        } else { throw e; }
      }
      const idToken = await cred.user.getIdToken(true);
      const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        // Surface the real failure instead of dropping the user into the app on a
        // session that will immediately 401-bounce them back here.
        fail(he ? 'יצירת ההתחברות נכשלה — נסה שוב' : 'Could not establish your session. Please try again.');
        return;
      }
      await finishAndRoute();
    } catch (e) { logger.error('[signup] email', e); fail(he ? 'ההתחברות נכשלה' : 'Sign-in failed'); }
    finally { setBusy(false); }
  }

  // OPEN, no-tabs flow: the user just types phone and/or email; we detect which
  // on Continue. Phone wins when present (SMS is the Israel-primary path). Both
  // paths are passwordless 6-digit codes — one easy button, no method to pick.
  const emailValid = /\S+@\S+\.\S+/.test(email);
  const phoneValid = phone.replace(/\D/g, '').length > 6;
  // 18+ gate: DOB required, and computed age must be ≥18. The wheel only offers
  // adult years, but we still verify here (and the server re-checks at creation).
  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(dob);
  const age = (() => {
    if (!dobValid) return -1;
    const b = new Date(dob + 'T00:00:00'); const n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    const m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
    return a;
  })();
  const isAdult = age >= 18;
  // AGE GATE (2026-07-24 fix): the DOB wheel AND a separate 'I am 18+' checkbox
  // was redundant and confusing — a customer who entered their birthday still
  // had to tick a box saying they're 18+, and Google sign-in / the phone Send
  // button silently stayed blocked until they did. A VALID 18+ date of birth
  // now satisfies the age requirement on its own; the checkbox remains the
  // path for anyone who hasn't entered a DOB (e.g. pure social signup).
  const ageConfirmed = over18 || isAdult;
  const consentOk = agreedTerms && ageConfirmed;
  // ONE contact is enough (CEO 2026-07-24 "sign up not easy"): startSignup()
  // already branches phone-first-else-email, and the design intent above is
  // "type whichever they like, we detect which". The old gate demanded phone
  // AND email AND dob together — so filling just email left Continue dead with
  // no reason shown. Now: either contact + 18+ DOB unlocks it; the second
  // contact is collected/verified after, not up front.
  const hasContact = phoneValid || emailValid;
  // The Send-code button needs age confirmation via EITHER the '18+' checkbox
  // OR a valid 18+ DOB — not the DOB specifically. Before this (2026-07-24) a
  // provider who ticked the boxes and entered their mobile saw the Send button
  // stay dead because they hadn't ALSO spun the DOB wheel — "no send button
  // exists" (CEO). ageConfirmed = over18 || isAdult.
  const readyForSubmit = !busy && hasContact && ageConfirmed;

  const ctaLabel = busy ? '…' : (he ? 'המשך' : 'Continue');

  function startSignup() {
    if (phoneValid) { setMethod('mobile'); void sendCode(); }
    else if (emailValid) { setMethod('email'); void sendEmailCode(); }
  }

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
    trusted: he ? 'פתוחים עכשיו בכפר סבא' : 'Now open in Kfar Saba',
    rating: he ? 'טיפול טבעי פרימיום · מותג ישראלי' : 'Premium natural care · Israeli brand',
    secure: he ? 'מאובטח · פרטי · מוצפן' : 'SECURE · PRIVATE · ENCRYPTED',
    secureSub: he ? 'הנתונים שלך מוגנים ומוצפנים.' : 'Your data is protected and encrypted.',

    /* One door for everyone (CEO 2026-07-02): returning members sign in HERE —
       same phone/email code, Google, Apple or Face ID — no separate login page.
       PROVIDER APP EXCEPTION (CEO 2026-07-22 "provider is not loyalty"): inside
       the provider app this screen is PROVIDER signup — work-oriented copy,
       zero Prestige/rewards language. */
    create: nativeFlavor === 'provider'
      ? (he ? 'התחברות או יצירת חשבון ספק PetWash' : 'Sign in or create your PetWash provider account')
      : (he ? 'התחברות או יצירת חשבון PetWash' : 'Sign in or create your PetWash account'),
    helper: nativeFlavor === 'provider'
      ? (he
          ? 'עבודות, יומן, הכנסות ותאימות — אפליקציית העבודה שלך ב־PetWash.'
          : 'Jobs, calendar, earnings and compliance — your PetWash work app.')
      : (he
          ? 'הצטרף ל־PetWash Prestige וקבל 5% תגמול על כל רחיצה זכאית במכונת K9000.'
          : 'Join PetWash Prestige and earn 5% rewards on every eligible K9000 wash.'),
    cwGoogle: he ? 'המשך עם Google' : 'Continue with Google',
    cwApple: he ? 'המשך עם Apple' : 'Continue with Apple',
    cwFb: he ? 'המשך עם Facebook' : 'Continue with Facebook',
    cwIg: he ? 'המשך עם Instagram' : 'Continue with Instagram',
    cwTt: he ? 'המשך עם TikTok' : 'Continue with TikTok',
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
    completeFields: he ? 'להמשך: הזינו נייד או אימייל, אשרו את התנאים וסמנו 18+ (או הזינו תאריך לידה).' : 'To continue: enter your mobile or email, accept the terms and confirm 18+ (or enter your date of birth).',
    bank: he ? 'מאובטח ומוצפן' : 'Secure & encrypted',
    enc: he ? 'הצפנת 256-bit' : '256-bit encryption',
    safe: he ? 'הנתונים שלך בטוחים' : 'Your data is safe',

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

          {/* Duplicate top consent removed (2026-06-24): it required a SEPARATE
              `terms` checkbox on top of the labeled agreedTerms + over18 below,
              so checking the visible bottom boxes left the CTA disabled = "dead
              buttons" on iPhone. Consent is now the single labeled block lower
              down (agreedTerms + over18 → consentOk). */}

          {inlineError && (
            <p className="sl-inlineError" role="alert">{inlineError}</p>
          )}

          {/* === OPEN inputs — no tabs. Phone AND email are both visible; the user
              just types whichever they like and presses Continue (we detect which). === */}
          {!sent && (
            <>
              {/* Passkey/Face-ID is a RETURNING-user shortcut and lives at the BOTTOM
                  now (CEO 2026-07-17): a brand-new joiner has no passkey yet, so
                  showing it first only 400s and confuses. See the returning-user
                  block after the social options below. */}

              {/* === Clear intent up front: member and/or provider (non-exclusive).
                  Hidden entirely inside the PROVIDER app — that app IS provider
                  signup (flow locked above), so a member/provider picker there is
                  noise, and the member tile is loyalty language the provider app
                  must not carry. === */}
              {nativeFlavor !== 'provider' && (
              <div className="sl-intent">
                <div className="sl-intentQ">{he ? 'איך תרצו להצטרף?' : 'How would you like to join?'}</div>
                <div className="sl-intentGrid">
                  <div className="sl-intentCard sl-intentCard--on">
                    <FaGift className="sl-intentIcon" aria-hidden />
                    <div className="sl-intentText">
                      <div className="sl-intentName">{he ? 'חבר/ת PetWash Prestige' : 'PetWash Prestige member'}</div>
                      <div className="sl-intentSub">{he ? 'תגמולי VIP · 5% על כל רחיצת K9000' : 'VIP rewards · 5% on every K9000 wash'}</div>
                    </div>
                    <span className="sl-intentTick" aria-hidden>✓</span>
                  </div>
                  {/* The provider tile is hidden inside the CUSTOMER native app —
                      that app is the member product; provider recruitment lives in
                      the provider app and on the web. */}
                  {nativeFlavor !== 'customer' && (
                    <button type="button"
                      className={`sl-intentCard${wantsProvider ? ' sl-intentCard--on' : ''}`}
                      aria-pressed={wantsProvider}
                      onClick={toggleProviderIntent}>
                      <FaPaw className="sl-intentIcon" aria-hidden />
                      <div className="sl-intentText">
                        <div className="sl-intentName">{he ? 'להפוך לספק/ית' : 'Become a provider'}</div>
                        <div className="sl-intentSub">{he ? 'בכפוף לתנאים ואישור' : 'Conditions apply · approval required'}</div>
                      </div>
                      <span className={wantsProvider ? 'sl-intentTick' : 'sl-intentAdd'} aria-hidden>{wantsProvider ? '✓' : '+'}</span>
                    </button>
                  )}
                </div>
                {nativeFlavor !== 'customer' && (
                  <div className="sl-intentHint">{he ? 'אפשר גם וגם — תמיד תהיו חברים, וגם ספקים אם תבחרו.' : 'Either or both — you’re always a member, and a provider too if you choose.'}</div>
                )}
              </div>
              )}

              {/* === REORDER (CEO 2026-07-21 "sign up still not right"): one-tap
                  methods now come FIRST. Measured on the live site: the Google/
                  Apple buttons sat at 1,666px on an 812px phone — two full screens
                  below the fold, behind a DOB wheel and the manual form. The order
                  is now: consents → social tiles → "or" → manual (DOB/phone/email).
                  Consents sit directly above the tiles because social() requires
                  consentOk before it may fire — tapping without them surfaces the
                  "accept terms + 18+" message right next to the boxes. === */}
              <div className="sl-consent" dir={he ? 'rtl' : 'ltr'} style={{ margin: '14px 0 6px', fontSize: '13px', lineHeight: 1.6, textAlign: he ? 'right' : 'left' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ marginTop: '2px', width: '20px', height: '20px', flexShrink: 0, accentColor: '#E6C766' }} />
                  <span>
                    {he ? 'אני מסכים/ה ל' : 'I agree to the '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>{he ? 'תנאי השימוש' : 'Terms of Service'}</a>
                    {he ? ' ול' : ' and '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>{he ? 'מדיניות הפרטיות' : 'Privacy Policy'}</a>
                  </span>
                </label>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', marginTop: '8px' }}>
                  <input type="checkbox" checked={over18} onChange={(e) => setOver18(e.target.checked)} style={{ marginTop: '2px', width: '20px', height: '20px', flexShrink: 0, accentColor: '#E6C766' }} />
                  <span>{he ? 'אני מאשר/ת שאני בן/בת 18 ומעלה' : 'I confirm I am 18 years or older'}</span>
                </label>
              </div>

              {/* All sign-up methods visible (CEO 2026-07-17): no "more options" fold.
                  Buttons are NOT disabled on missing consent — a tap calls social()/
                  socialExternal(), which surface the "accept terms + 18+" message.
                  Disabling silently made them look dead ("Gmail gives nothing"). */}
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
                {signupFlags.facebookSignin && (
                  <button className="sl-soc sl-soc--fb" disabled={busy} onClick={() => social('facebook')}>
                    <span className="sl-fbIcon" aria-hidden><FaFacebookF /></span>
                    <span className="sl-socLabel">{t.cwFb}</span>
                  </button>
                )}
                {signupFlags.instagramSignin && (
                  <button className="sl-soc sl-soc--ig" disabled={busy} onClick={() => socialExternal('instagram')}>
                    <span className="sl-igIcon" aria-hidden><FaInstagram /></span>
                    <span className="sl-socLabel">{t.cwIg}</span>
                  </button>
                )}
                {signupFlags.tiktokSignin && (
                  <button className="sl-soc sl-soc--tt" disabled={busy} onClick={() => socialExternal('tiktok')}>
                    <span className="sl-ttIcon" aria-hidden><FaTiktok /></span>
                    <span className="sl-socLabel">{t.cwTt}</span>
                  </button>
                )}
              </div>

              <div className="sl-div">{he ? 'או הרשמה עם נייד או אימייל' : 'or sign up with phone or email'}</div>

              {/* Date of birth — required, 18+. iOS finger-scroll wheel; only adult
                  years are offered, and age is re-verified on the server at creation. */}
              <div className="sl-field">
                <label className="sl-label">{he ? 'תאריך לידה · גיל 18 ומעלה' : 'Date of birth · 18+'}</label>
                <AppleWheelDatePicker
                  value={dob || `${new Date().getFullYear() - 25}-06-15`}
                  onChange={setDob}
                  minYear={new Date().getFullYear() - 100}
                  maxYear={new Date().getFullYear() - 18}
                  monthNames={he ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'] : undefined}
                  dayLabel={he ? 'יום' : 'Day'}
                  monthLabel={he ? 'חודש' : 'Month'}
                  yearLabel={he ? 'שנה' : 'Year'}
                />
                {!dobValid && <div className="sl-hint">{he ? 'גללו לבחירת תאריך הלידה.' : 'Scroll to set your date of birth.'}</div>}
                {dobValid && !isAdult && <div className="sl-hint sl-submitHint">{he ? 'יש להיות בגיל 18 ומעלה.' : 'You must be 18 or older.'}</div>}
              </div>

              {signupFlags.smsFallbackAndRealErrors && !smsProviderHealthy && (
                <p className="sl-inlineError" role="status">
                  {he ? 'SMS אינו זמין כעת — אפשר להמשיך עם אימייל למטה.' : 'SMS is temporarily unavailable — continue with email below.'}
                </p>
              )}

              <div className="sl-field">
                <label className="sl-label">{t.phoneLabel}</label>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
                <div className="sl-hint">{he ? 'נשלח קוד אימות חד-פעמי ב-SMS — בלי סיסמה. השם והעדפות נאספים אחרי ההצטרפות.' : 'We text you a one-time code — no password. Name & preferences are collected after you join.'}</div>
              </div>

              {signupFlags.emailPassword && (
                <>
                  <div className="sl-div">{he ? 'וגם' : 'and'}</div>
                  <div className="sl-field">
                    <label className="sl-label">{t.emailLabel}</label>
                    <div className="sl-inputWrap">
                      <FaEnvelope className="sl-inputIcon" aria-hidden />
                      <input className="sl-input sl-input--icon" type="email" inputMode="email" autoComplete="username email webauthn" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPh} />
                    </div>
                    <div className="sl-hint">{he ? 'Gmail, Hotmail, Yahoo או כל כתובת אימייל' : 'Gmail, Hotmail, Yahoo or any email works'}</div>
                  </div>
                </>
              )}
            </>
          )}

          {/* === OTP — appears after we send the SMS === */}
          {method === 'mobile' && sent && (
            <>
              <p className="sl-helper sl-center">{he ? `הזן את הקוד שנשלח ל-${phone}` : `Enter the code sent to ${phone}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verify(c); }} loading={busy} language={he ? 'he' : 'en'} />
              {/* Resend only needs the network idle — NOT consent again. The code
                  was already sent (consent was given at first send); re-gating on
                  consent created a dead button if the user later toggled a box. */}
              <button className="sl-btn" disabled={busy} onClick={() => setSent(false)}>{he ? 'שלח קוד חדש' : 'Resend code'}</button>
            </>
          )}

          {/* === Email OTP — appears after we send the 6-digit email code === */}
          {method === 'email' && sent && (
            <>
              <p className="sl-helper sl-center">{he ? `הזן את הקוד שנשלח ל-${email}` : `Enter the code sent to ${email}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verifyEmailCode(c); }} loading={busy} language={he ? 'he' : 'en'} />
              <button className="sl-btn" disabled={busy} onClick={() => setSent(false)}>{he ? 'שלח קוד חדש' : 'Resend code'}</button>
            </>
          )}

          {!sent && (
            <>
              {/* Consent checkboxes moved ABOVE the methods (top of the card) —
                  see the reorder note there. CTA + its consent hint stay here. */}
              <button className="sl-cta" disabled={!readyForSubmit || !consentOk}
                onClick={startSignup}>
                <FaLock aria-hidden /> {ctaLabel}
              </button>
              {!readyForSubmit && <div className="sl-hint sl-submitHint">{t.completeFields}</div>}
              {readyForSubmit && !consentOk && <div className="sl-hint sl-submitHint">{he ? 'יש לאשר את התנאים וגיל 18+' : 'Please accept the terms and confirm you are 18+'}</div>}

              <div className="sl-bank">
                <FaShieldAlt aria-hidden /> <span>{t.bank}</span>
                <span aria-hidden> · </span>
                <span>{t.enc}</span>
                <span aria-hidden> · </span>
                <span>{t.safe}</span>
              </div>

              {/* 2026 Advanced Security — trust signals describing REAL protections
                  already in place (passkey/WebAuthn, invisible bot check, SMS/email
                  OTP). Display-only and honest — not fake controls. */}
              <div className="sl-secRow" aria-label={he ? 'אבטחה מתקדמת 2026' : '2026 advanced security'}>
                <div className="sl-secTitle">{he ? 'אבטחה מתקדמת 2026' : '2026 ADVANCED SECURITY'}</div>
                <div className="sl-secItems">
                  <span className="sl-secItem"><FaShieldAlt aria-hidden /> {he ? 'מוכן ל-Passkey' : 'Passkey ready'}</span>
                  <span className="sl-secItem"><FaShieldAlt aria-hidden /> {he ? 'הגנת בוטים' : 'Bot protection'}</span>
                  <span className="sl-secItem"><FaLock aria-hidden /> {he ? 'אימות OTP' : 'OTP verification'}</span>
                </div>
              </div>

              {/* Social tiles moved to the TOP of the card (one-tap first — see the
                  reorder note there). Passkey stays here at the bottom. */}

              {/* Returning-user passkey/Face-ID — demoted to the bottom (see top note). */}
              {bioAvailable && (
                <>
                  <div className="sl-div">{he ? 'כבר חברים? התחברות מהירה' : 'Already a member? Quick sign-in'}</div>
                  <button type="button" className="sl-bio" disabled={busy} onClick={handlePasskeyLogin}>
                    <FaFingerprint aria-hidden /> {he ? `התחברות עם ${bioName}` : `Sign in with ${bioName}`}
                  </button>
                </>
              )}

              {/* Honest activation note (CEO 2026-07-02 "both need verify"): social
                  sign-ups arrive with a verified email only — full membership
                  activates once the mobile number is verified too (the account
                  engine already withholds 'active' until BOTH are confirmed). */}
              <p className="sl-hint" style={{ textAlign: 'center', marginTop: 6 }}>
                {he
                  ? 'חברות מלאה מופעלת לאחר אימות אימייל וגם נייד.'
                  : 'Full membership activates after both email and mobile are verified.'}
              </p>
            </>
          )}
        </main>
      </div>

      {/* ================= DOWNLOAD APP BANNER ================= */}
      {/* The app-download section (paw + title + two "coming soon" store badges
          + QR) used to sit here. REMOVED 2026-07-18 (CEO): the native app is not
          ready, and pushing it on the signup page cost us signups — it added a
          block of clutter to the one page that has to stay dead simple, and
          advertised a product visitors can't actually get. Sign-up stays a
          browser flow, full stop. When the app genuinely ships, add the badges
          back with real store URLs (the old ones were a placeholder Apple id
          `id1234567890` and a Google Play bundle that didn't match the
          registered app), and put them somewhere other than signup. */}

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
      --gold:#D4AF37; --gold2:#E6C766; --gold3:#B8932F; --white:#fffaf0;
      --muted:rgba(255,250,240,.6); --line:rgba(255,255,255,.10);
      /* Field/box edges: FRESH BRIGHT gold thin line (CEO 2026-07-02 — the old
         .22 alpha over black read as rust/brown). gold2 = the bright champagne. */
      --line2:rgba(230,199,102,.50); --ink:#0a0a0a;
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
    .sl-divPaw span{ height:1px; background:linear-gradient(90deg, transparent, rgba(212,175,55,.45), transparent); flex:1 }
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
    .sl-stars{ color:var(--gold2); font-size:18px; letter-spacing:4px; text-shadow:0 0 12px rgba(212,175,55,.5) }
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
    .sl-lang:hover{ border-color:rgba(212,175,55,.5) }

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
    .sl-soc:hover:not(:disabled){ transform:translateY(-1px); border-color:rgba(212,175,55,.55); box-shadow:0 0 0 3px rgba(212,175,55,.12) }
    .sl-soc:disabled{ cursor:not-allowed }
    .sl-socLabel{ flex:1; min-width:0; text-align:start; overflow-wrap:normal }
    .sl-gIcon{ width:24px; height:24px; flex:0 0 auto }
    .sl-fbIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:#1877F2; display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-fbIcon svg{ font-size:14px }
    .sl-igIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:linear-gradient(135deg, #fdc468 0%, #d83689 50%, #5b4ad0 100%); display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-igIcon svg{ font-size:14px }
    .sl-ttIcon{ width:24px; height:24px; flex:0 0 auto; border-radius:6px; background:#000; display:inline-flex; align-items:center; justify-content:center; color:#fff }
    .sl-ttIcon svg{ font-size:14px }
    /* Apple HIG "Sign in with Apple": solid black button, PURE white mark + label
       (the generic tile tinted the logo cream via --white — CEO 2026-07-02). */
    .sl-soc--apple{ background:#000; border-color:rgba(255,255,255,.32) }
    .sl-soc--apple svg{ font-size:22px; color:#fff }
    .sl-soc--apple .sl-socLabel{ color:#fff }
    .sl-soc--apple:hover:not(:disabled){ border-color:rgba(255,255,255,.55); box-shadow:0 0 0 3px rgba(255,255,255,.10) }
    .sl-div{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; color:var(--muted); font-size:13px; font-weight:600; padding:4px 0 }
    .sl-div:before, .sl-div:after{ content:""; height:1px; background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent) }

    /* Intent selector — full-width, fills the form on every size: 1 column on a
       small iPhone, 2 columns once there is room. No dead space, same on tablet. */
    .sl-intent{ display:flex; flex-direction:column; gap:8px; width:100%; margin-bottom:2px }
    .sl-intentQ{ color:var(--white); font-size:13px; font-weight:800; opacity:.92 }
    /* Always one column: full-width cards read the same on a small iPhone and a
       big tablet, use 100% of the form width, and never cramp/wrap the card text. */
    .sl-intentGrid{ display:grid; grid-template-columns:1fr; gap:10px; width:100% }

    /* Face ID / Touch ID passkey button — white-on-dark secondary, gold-tinted. */
    .sl-bio{ display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
      min-height:56px; border-radius:12px; box-sizing:border-box; cursor:pointer; appearance:none;
      -webkit-appearance:none; font-size:15px; font-weight:700;
      background:rgba(212,175,55,.04); border:1px solid var(--gold2); color:var(--white);
      transition:background .2s, filter .15s }
    .sl-bio:hover:not(:disabled){ background:rgba(212,175,55,.10); filter:brightness(1.04) }
    .sl-bio:disabled{ opacity:.5; cursor:not-allowed }
    .sl-bio svg{ color:var(--gold2); font-size:18px }
    .sl-intentCard{ display:flex; align-items:center; gap:10px; width:100%; text-align:start;
      min-height:64px; padding:12px 14px; border-radius:14px; box-sizing:border-box;
      background:rgba(255,255,255,.04); border:1px solid var(--line); color:var(--white);
      cursor:pointer; appearance:none; -webkit-appearance:none; transition:border-color .2s, background .2s }
    .sl-intentCard--on{ border-color:var(--gold2); background:rgba(212,175,55,.05); box-shadow:0 0 0 1px rgba(230,199,102,.25) }
    .sl-intentIcon{ color:var(--gold2); font-size:20px; flex-shrink:0 }
    .sl-intentText{ flex:1; min-width:0 }
    .sl-intentName{ font-size:14px; font-weight:700; line-height:1.2 }
    .sl-intentSub{ font-size:12px; color:var(--muted); line-height:1.35 }
    .sl-intentTick{ color:var(--gold2); font-size:18px; font-weight:900; flex-shrink:0 }
    .sl-intentAdd{ color:var(--muted); font-size:22px; font-weight:700; flex-shrink:0; line-height:1 }
    .sl-intentHint{ font-size:11.5px; color:var(--muted); line-height:1.4 }

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
    .sl-tab[aria-selected="true"]{ background:rgba(212,175,55,.05); border-color:var(--line2); color:var(--white) }
    .sl-tab:hover{ border-color:rgba(230,199,102,.4) }

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
      border:1px solid var(--line2); background:rgba(0,0,0,.55);
      color:var(--white); font-size:16px; font-weight:500;
      padding:0 16px; outline:none;
      transition:border-color .15s ease, box-shadow .15s ease;
    }
    .sl-input--icon{ ${he ? 'padding-right:42px; padding-left:16px' : 'padding-left:42px; padding-right:16px'} }
    .sl-input::placeholder{ color:rgba(255,250,240,.4); font-weight:400 }
    .sl-input:focus{ border-color:rgba(212,175,55,.55); box-shadow:0 0 0 3px rgba(212,175,55,.18) }
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
      border-color:var(--line2) !important;
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
      border:1px solid rgba(212,175,55,.24);
      border-radius:14px;
      background:rgba(212,175,55,.06);
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
      box-shadow:0 18px 50px rgba(212,175,55,.28);
      transition:transform .15s ease, box-shadow .15s ease, filter .15s ease;
      -webkit-tap-highlight-color:transparent;
    }
    .sl-cta:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.06); box-shadow:0 22px 64px rgba(212,175,55,.5) }
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

    /* 2026 Advanced Security trust row */
    .sl-secRow{
      margin-top:12px; padding:10px 12px; border:1px solid rgba(212,175,55,.22);
      border-radius:12px; background:rgba(212,175,55,.04);
    }
    .sl-secTitle{
      text-align:center; font-size:10px; letter-spacing:.18em; text-transform:uppercase;
      color:var(--gold2); margin-bottom:6px;
    }
    .sl-secItems{ display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap }
    .sl-secItem{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:var(--muted) }
    .sl-secItem svg{ color:var(--gold2); font-size:12px }

    /* DOWNLOAD APP BANNER */
    /* app-download section CSS removed with the section itself (2026-07-18) */

    /* ====== BREAKPOINTS ====== */

    /* ≤ 767px (phones) — single column, compact direct signup.
     * Operator brief 2026-05-26: keep CTA reachable, never let the dog push
     * the form down. Logo stays dominant; dog scales down accordingly. */
    @media(max-width:767px){
      .sl-shell{ min-height:auto; padding-top:0 }
      .sl-frame{ gap:10px; padding:max(6px, env(safe-area-inset-top)) 12px calc(92px + env(safe-area-inset-bottom)) }
      /* MOBILE = the form, not the pitch (CEO 2026-07-21). The hero's headline,
         subtitle and dog photo pushed the signup card ~480px down a phone screen
         — marketing before the thing the visitor came to do. Keep a small logo
         line, hide the rest; desktop keeps the full hero. */
      .sl-hero{ gap:0; padding-top:0 }
      .sl-logo{ width:min(46vw, 205px) }
      .sl-eyebrow{ display:none }
      .sl-h1{ display:none }
      .sl-sub{ display:none }
      .sl-divPaw{ display:none }
      .sl-dogWrap{ display:none }
      .sl-card,.sl-trustCard,.sl-secBadge{ display:none }
      .sl-panel{ padding:16px 14px; border-radius:22px; gap:11px; scroll-margin-top:8px }
      .sl-panelHead{ gap:8px }
      .sl-title{ font-size:clamp(23px,6vw,28px); line-height:1.05; letter-spacing:.02em }
      .sl-helper{ font-size:13.5px; line-height:1.35 }
      .sl-lang{ min-height:40px; padding:8px 12px; border-radius:999px }
      .sl-social4{ grid-template-columns:1fr 1fr; gap:8px }
      .sl-soc{ min-height:50px; border-radius:14px; padding:0 12px; gap:10px; font-size:13px; line-height:1.15 }
      .sl-soc svg,.sl-fbIcon,.sl-igIcon,.sl-ttIcon{ flex:0 0 auto }
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
        border-color:var(--line2) !important;
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
      .sl-card,.sl-trustCard,.sl-secBadge{ display:none }
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
      .sl-soc svg,.sl-fbIcon,.sl-igIcon,.sl-ttIcon{ width:21px; height:21px; flex:0 0 auto }
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
      .sl-soc, .sl-cta, .sl-tab{ transition:none }
    }
  `;
}
