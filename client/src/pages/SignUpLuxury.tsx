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
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  signInWithPopup, signInWithRedirect, signInWithCustomToken,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  getRedirectResult, fetchSignInMethodsForEmail, linkWithCredential,
  GoogleAuthProvider, OAuthProvider, FacebookAuthProvider,
  type AuthCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { humanizeAuthError } from '@/auth/client';
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
import { executeTurnstileInvisible, turnstileFailureMessage } from '@/components/TurnstileWidget';
import {
  isPlatformAuthenticatorAvailable,
  getBiometricMethodName,
  signInWithPasskey,
  signInWithPasskeyConditional,
} from '@/auth/passkey';
import EnableFaceIDCard from '@/components/EnableFaceIDCard';
import {
  FaApple, FaFacebookF, FaInstagram, FaTiktok, FaLock, FaMobileAlt,
  FaShieldAlt,
  FaCog, FaGift, FaCalendarAlt, FaHeartbeat,
  FaEnvelope, FaPhoneAlt, FaPaw, FaFingerprint,
} from 'react-icons/fa';

// Apple sign-in is HIDDEN until the Firebase Apple provider's OAuth code-flow key
// (Team ID + Key ID + .p8) is filled — it's empty today, so tapping Apple returns
// auth/operation-not-allowed ("this method is not enabled"). Hiding the button keeps
// users off a dead option. Flip to true the moment the .p8 key is wired into Firebase
// (workflow set-apple-signin-key.yml). Google/mobile/email are unaffected. (2026-08-08)
const APPLE_SIGNIN_READY = false;

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
    case 'prestige': return '/prestige/home';
    default: return '/prestige/home';
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

  // Consent state — three independent axes so the audit trail is unambiguous:
  //   ageConfirmed18Plus  — explicit "I am 18+" checkbox (mandatory).
  //   agreedTerms          — Terms + Privacy Notice checkbox (mandatory).
  //   acceptedMarketing    — marketing preference (optional; NEVER blocks submit).
  // All three default to false so nothing is pre-ticked. The DOB the user
  // types is the age evidence; this checkbox is the explicit confirmation
  // paired with it — the server enforces BOTH (age >= 18 AND ageConfirmed).
  const [ageConfirmed18Plus, setAgeConfirmed18Plus] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  // Legacy `over18` state retained ONLY for the returning-user LOGIN paths
  // that never re-collect DOB (kept out of the signup gate below).
  const [over18, setOver18] = useState(false);


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
  const rawIntent = wantsProvider ? 'provider' : (params.get('flow') || params.get('intent') || undefined);
  // Normalize client flow aliases to the server's valid intents (ALLOWED_INTENTS:
  // customer|loyalty|provider|staff_request). 'prestige' is the marketing name for
  // the loyalty member — sending it raw made the server fail to match it and
  // silently downgrade to 'customer', which dropped the DOB requirement so the two
  // "join as member" doors behaved differently. (2026-07-27)
  const explicitIntent = rawIntent === 'prestige' ? 'loyalty' : rawIntent;
  const { user } = useFirebaseAuth();
  // Already signed in on /signup → route by the user's ACTUAL role/status via the
  // server post-login decider: returning approved provider → /provider-os, member →
  // /home, mid-application provider → /provider-onboarding, admin → /admin/dashboard.
  // (Was a STATIC flow→dest map that sent a returning provider to /home.) Mirrors
  // SignIn.tsx. ?redirect= still wins; falls back to dest on any error.
  useEffect(() => {
    if (!user) return;
    // A password login (esp. a 2-step challenge) routes itself once its OWN server
    // session is minted — the session cookie is deliberately withheld until then,
    // so auto-navigating here would drop the user on an unauthenticated page and
    // abandon the SMS-code step. Let loginWithPassword/verifyLoginMfa navigate.
    // Don't auto-navigate while the page is MID a multi-step flow — otherwise the
    // global AuthProvider setting `user` (e.g. right after a phone-code sign-in)
    // yanks the user off an in-progress step before it finishes. Each step below
    // owns its own routing when it completes; this effect only routes when NO step
    // is in flight. Guarding just mfaLoginInFlight (the old code) left these
    // unprotected → the phone→email verification step 2 and the Face ID offer were
    // silently abandoned = half-verified accounts. (verification-drift fix 2026-08-07)
    //   sent           = an OTP code screen is showing (phone or email)
    //   emailStep      = phone verified, now collecting/verifying the email (step 2)
    //   showFaceIDOffer= the post-signup "Enable Face ID" card
    //   mfaChallenge   = a 2-step login code
    if (mfaLoginInFlight.current || sent || emailStep || mobileStep || showFaceIDOffer || mfaChallenge) return;
    if (safeRedirect) { navigate(safeRedirect); return; }
    let cancelled = false;
    (async () => {
      try {
        const { resolvePostLogin } = await import('@/lib/postLoginCoordinator');
        const b = explicitIntent ? { intent: explicitIntent } : undefined;
        // Bearer-carry + retry (2026-08-06 trace Finding #1): post-login must not
        // 401 on cookie-timing and silently route a super-admin to the member home.
        const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
        let data: any = await resolvePostLogin({ body: b, idToken });
        if ((!data?.ok || !data?.nextUrl) && auth.currentUser) {
          const fresh = await auth.currentUser.getIdToken(true).catch(() => undefined);
          if (fresh) { const r: any = await resolvePostLogin({ body: b, idToken: fresh }); if (r?.nextUrl) data = r; }
        }
        if (!cancelled) navigate(data?.nextUrl || data?.redirectTo || dest);
      } catch {
        if (!cancelled) navigate(dest);
      }
    })();
    return () => { cancelled = true; };
    // NOTE: sent/emailStep/showFaceIDOffer/mfaChallenge are intentionally NOT in
    // this dep array — they're declared later in the component (TDZ if referenced
    // here). The effect re-runs on `user` change (the trigger that matters), and
    // the guard above reads their CURRENT values from that render's closure, which
    // is exactly what we want: only block when a step is in flight at auth time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, safeRedirect, explicitIntent, dest, navigate]);

  // SOLE-OWNER FIX (2026-08-07): AuthProvider is now the ONLY consumer of
  // getRedirectResult — the same fix already applied to AdminLoginV2 +
  // PrivilegeSignup, finally applied to the MAIN login door. The page-level
  // getRedirectResult here fought AuthProvider (Firebase delivers the redirect
  // result to exactly ONE caller): the loser saw `null` and flashed a FALSE
  // "sign-in did not complete", and both raced to mint the session and route.
  // Now, on a social REDIRECT return (the rare popup-blocked fallback path):
  // AuthProvider consumes the result → onAuthStateChanged → ensureServerSession
  // mints the __session cookie → sets `user` → the guarded user-effect above
  // routes. This effect only clears a stale redirect marker so nothing lingers.
  useEffect(() => {
    try { clearSignupRedirectMarker(); } catch { /* noop */ }
  }, []);

  // AUTH MODE (CEO 2026-07-31 "both mobile AND email AND a password"): the JOIN
  // form collects both contacts + a password up front (real account, not a
  // passwordless demo); the LOGIN form is email + password. One screen, two
  // modes, switchable. Default: /signup → join, /signin|/login → login.
  const isLoginPath = /\/(signin|sign-in|login)/.test(window.location.pathname);
  const [authMode, setAuthMode] = useState<'join' | 'login'>(isLoginPath ? 'login' : 'join');
  // JOIN step 1 is a CHOICE, not a form: Apple / Google / "continue with mobile".
  // The manual mobile+email+password+DOB form stays HIDDEN until the user explicitly
  // picks "continue with mobile" (CEO 2026-08-01) — so social sign-in users are never
  // shown a long form they don't need.
  const [manualMode, setManualMode] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  // Returning-member login is CODE-FIRST (email → one-time code): easiest + no
  // password to remember/leak (CEO 2026-08-06). Password is a secondary path behind
  // a "use a password instead" link on SIGNUP. But for EXISTING users on the LOGIN
  // screen, the CEO (2026-08-08) wants the email + password fields shown together by
  // default (Google/Apple still available above). So default usePassword TRUE on the
  // login path; a "use a one-time code instead" link is still offered for accounts
  // with no password. Signup stays code-first (false).
  const [usePassword, setUsePassword] = useState(isLoginPath);
  // 2026-08-18 PR-AUTH-SECURITY-9 — Remember me toggle:
  // ON  → browserLocalPersistence (session persists across browser restart, current default)
  // OFF → browserSessionPersistence (cleared on browser close — matches a shared / kiosk device)
  // Kept in localStorage so returning users see their last choice on the next visit.
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem('petwash.rememberMe') : null;
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  // 2-STEP LOGIN (CEO 2026-07-31 "one-way or two-way verification"): opt-in at
  // join; when on, login asks for an SMS code AFTER the password. mfaChallenge
  // holds the in-flight login-time challenge (the idToken to prove + a masked
  // phone hint) so the code screen can render.
  const [twoFactor, setTwoFactor] = useState(false);
  // 2-step login is HIDDEN until the bearer-ID-token auth path is gated (a security
  // audit found the server enforces 2FA only at the session-cookie mint, so a
  // password-only attacker could bypass it with an `Authorization: Bearer <idToken>`
  // request — i.e. fake security for its own threat model). Do NOT expose the toggle
  // until that path is closed AND tested; flip to true then. (2026-07-31)
  const TWO_STEP_LOGIN_READY = false;
  const [mfaChallenge, setMfaChallenge] = useState<{ idToken: string; phoneHint: string } | null>(null);
  // True for the whole duration of a password login (incl. a pending 2-step SMS
  // challenge) so the auth-state auto-navigate effect does NOT yank the user off
  // this screen before loginWithPassword has minted the server session itself.
  // Set BEFORE signInWithEmailAndPassword (which fires onAuthStateChanged).
  const mfaLoginInFlight = useRef(false);
  // LOGIN (existing users) defaults to the EMAIL + password view (CEO 2026-08-08);
  // "Sign in with your mobile number instead" switches to the phone field. Signup
  // keeps the mobile-first method choice.
  const [method, setMethod] = useState<'mobile' | 'email'>(isLoginPath ? 'email' : 'mobile');
  // ROVER-STYLE method-first (CEO 2026-07-24 'no sense, make it clear'): the
  // manual form is HIDDEN until the user chooses phone or email. Social is a
  // one-tap path that never shows a phone/email field. 'choose' = show the two
  // chooser buttons only.
  const [contactMode, setContactMode] = useState<'choose' | 'phone' | 'email'>('choose');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // (legacy top `terms` checkbox removed — consent is agreedTerms + over18)
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  // Resend cooldown (2026-08-16). "Resend code" used to silently drop the user
  // back to the entry form without actually resending. Now it calls the real
  // send function; the countdown throttles it so users can't spam-tap the
  // server (server-side rate-limit remains the hard gate — this is UX).
  const [resendCountdown, setResendCountdown] = useState(0);
  // Tick the resend cooldown down once per second. Cleared when hitting 0 or
  // when the component unmounts so no dangling interval. Must live BELOW the
  // useState above — before this fix it sat at ~L189 and read `resendCountdown`
  // in its dep array before the state binding existed, triggering a TDZ
  // ReferenceError on every /signup mount (ErrorBoundary crash 2026-08-20).
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => setResendCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);
  const [smsProviderHealthy, setSmsProviderHealthy] = useState(true);
  // Date of birth — REQUIRED, 18+. Server re-enforces at account creation.
  // MUST default to empty: a pre-seeded "now-25" default stamped a synthetic
  // birthday on every user who never touched the wheel (indistinguishable from
  // deliberate input) — reads as consent to a data point the user never
  // provided, and lies to the age gate. Empty = "not yet supplied", which is
  // honest and forces the picker to be used. The picker still renders a sane
  // initial view when dob==='' (see DOB input at ~L1533); the gate blocks
  // submit until dobValid && isAdult. (2026-08-16 MASTER AUTH rebuild)
  const [dob, setDob] = useState('');
  // Step 2 of dual-verify: after the phone code + account, we verify the email too.
  const [emailStep, setEmailStep] = useState(false);
  // The MIRROR of emailStep: a NEW user who started with email / Google / Apple (which
  // give us the email but no phone) is asked to add + verify their mobile so the account
  // confirms BOTH contacts (CEO 2026-08-08). verify() attaches the phone to the already-
  // signed-in account via /api/auth/verify-signup-mobile instead of minting a new one.
  const [mobileStep, setMobileStep] = useState(false);
  // Passkey / Face ID (returning users): device-bound, the 2026 way to skip codes.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioName, setBioName] = useState('Face ID');
  // Post-signup Face ID offer: device can do Face ID (raw capability), plus the
  // one-time offer overlay state. Kept separate from bioAvailable (which is gated
  // on ALREADY having a passkey — the opposite case from "offer to enrol one").
  const [platformAuthCapable, setPlatformAuthCapable] = useState(false);
  const [showFaceIDOffer, setShowFaceIDOffer] = useState(false);
  const [faceIDEmail, setFaceIDEmail] = useState('');
  // Provider-LINKING state. Set ONLY when a social sign-in hits
  // 'account-exists-with-different-credential' (that email already has a PetWash
  // account via another method). We then let the user sign in with their EXISTING
  // method and linkWithCredential() attaches the new provider → one account, both
  // methods work. Null the rest of the time; nothing else is affected.
  const [linkState, setLinkState] = useState<{
    email: string;
    pendingCred: AuthCredential;
    methods: string[];
    newLabel: string;
  } | null>(null);
  const [linkPassword, setLinkPassword] = useState('');

  // PR-AUTH-FIX-RESET-EMAIL-3 (2026-08-15) — Forgot Password on the LOGIN
  // screen. Pre-fix the customer sign-in page had NO way to trigger a
  // password reset — users with a forgotten password were stuck on
  // "Sign in" with no path forward. Anti-enumeration: the toast is
  // ALWAYS the same generic "if an account exists" text regardless of
  // whether Firebase confirmed the send, so a caller cannot probe
  // account existence via error variance.
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const handleForgotPassword = async () => {
    if (forgotBusy) return; // prevent double-submit
    setInlineError(null);
    const trimmed = (email || '').trim();
    // Cheap RFC-ish shape check — Firebase will reject bad shapes, but
    // rejecting client-side avoids a wasted round-trip AND lets us
    // show a single specific "please enter a valid email" hint. Any
    // OTHER error (rate-limit, unknown, network) becomes the generic
    // anti-enumeration toast — never leaks account existence.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInlineError(he ? 'הזן כתובת אימייל תקינה' : 'Please enter a valid email address');
      return;
    }
    setForgotBusy(true);
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth: fbAuth } = await import('@/lib/firebase');
      await sendPasswordResetEmail(fbAuth, trimmed);
    } catch {
      // Deliberately swallow. Anti-enumeration: the user sees the same
      // generic success message whether the email exists or not.
    } finally {
      setForgotBusy(false);
      setForgotSent(true);
    }
  };

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
        // The signed-out login screen cannot ask the server "does this account
        // have a passkey?" without leaking whether the account exists, so the
        // explicit "Sign in with Face ID" button uses a DEVICE-LOCAL HINT
        // (petwash_passkey_email) — set on registration / first passkey login
        // on this device — to soften discovery. This is NOT authority: the
        // real "your account is enrolled" record lives on the server and is
        // read by Settings/EnableFaceIDCard via getServerPasskeyStatus(). The
        // hint being absent does not mean the account has no passkey; the
        // conditional-mediation autofill below still surfaces synced passkeys
        // silently — the true one-tap return path.
        const passkeyHintOnDevice = (() => {
          try { return !!localStorage.getItem('petwash_passkey_email'); } catch { return false; }
        })();
        setPlatformAuthCapable(avail);
        setBioAvailable(avail && passkeyHintOnDevice);
        if (avail && passkeyHintOnDevice) setBioName(getBiometricMethodName());
        signInWithPasskeyConditional().catch(() => {});
      } catch { /* passkeys unsupported — silent, normal flow continues */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Explicit "Sign in with Face ID" tap. On success the useFirebaseAuth user
  // effect routes via the post-login decider; no consent gate (returning user
  // already accepted terms at original signup). On failure we present an
  // honest fallback message — the device may hold the discovery hint but the
  // server may have no matching credential (user cleared it, switched
  // devices, or the hint predates a passkey reset). "Face ID sign-in failed"
  // reads as a system fault when the real cause is "no matching passkey";
  // point them at the other sign-in options and clear the stale hint so the
  // button no longer misleads on the next page load.
  async function handlePasskeyLogin() {
    setBusy(true);
    setInlineError(null);
    try {
      const r = await signInWithPasskey();
      if (!r.success) {
        const noPasskey = /not.?allowed|no matching|no credential|cancel|timed out/i.test(r.error || '');
        if (noPasskey) {
          try { localStorage.removeItem('petwash_passkey_email'); } catch { /* storage disabled */ }
          setBioAvailable(false);
          fail(he
            ? 'לא נמצא Passkey במכשיר זה — התחברו עם Google, אימייל או מספר נייד.'
            : 'No passkey found on this device — sign in with Google, email or mobile instead.');
        } else {
          fail(r.error || (he ? 'התחברות עם Face ID נכשלה' : 'Face ID sign-in failed'));
        }
      }
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
    // Signup gate — three MANDATORY checks. Marketing is intentionally absent
    // (optional, never a blocker). All three are also re-enforced server-side
    // on the /session handler; the server independently calculates age from
    // the DOB and never trusts the ageConfirmed checkbox on its own.
    if (!dobValid || !isAdult) {
      fail(he ? 'יש להזין תאריך לידה — גיל 18 ומעלה' : 'Please enter your date of birth — you must be 18 or older.');
      return false;
    }
    if (!ageConfirmed18Plus) {
      fail(he ? 'יש לאשר שאתם בני 18 ומעלה' : 'Please confirm that you are 18 years of age or older.');
      return false;
    }
    if (!agreedTerms) {
      fail(he ? 'יש לאשר את תנאי השימוש והפרטיות' : 'Please accept the Terms of Service and Privacy Notice.');
      return false;
    }
    return true;
  };

  // Offer Face ID / passkey enrolment ONCE, right after a SIGNUP, to users whose
  // device supports it and who don't have a passkey yet — this is what makes the
  // "let device decide" return-login real (nothing to autofill until someone has a
  // passkey). FAIL-SAFE: only signup (never nags returning logins), remembers a
  // dismissal, and ANY uncertainty returns false so routing proceeds normally.
  function shouldOfferFaceIDNow(): boolean {
    try {
      if (authMode === 'login') return false;                                   // signup only
      if (!platformAuthCapable) return false;                                    // device can't
      if (localStorage.getItem('petwash_passkey_email')) return false;           // already enrolled
      if (localStorage.getItem('petwash_faceid_offer_dismissed')) return false;  // said no before
      return true;
    } catch { return false; }
  }

  // The actual routing (server post-login decider → nextUrl). Called directly, or
  // deferred by finishAndRoute until the Face ID offer is answered.
  async function routeNow() {
    try { await fetch(getApiUrl('/api/session/whoami'), { credentials: 'include' }); }
    catch (e) { logger.error('[signup] whoami', e); }
    // SMART ROUTING (2026-07-24): ask the server's post-login decider where to
    // go rather than the client's intent guess (destForFlow). The decider knows
    // if the profile still needs a name (→ /complete-profile), if a provider
    // needs KYC (→ /provider-onboarding), or if a loyalty member is ready for
    // home — so a new user is never dumped on a dashboard that bounces them.
    // Intent (provider vs loyalty) is passed so the decider routes the right way.
    const intent = explicitIntent || (flow === 'provider' ? 'provider' : 'loyalty');
    try {
      const { resolvePostLogin } = await import('@/lib/postLoginCoordinator');
      // Carry the Firebase ID token so /api/auth/post-login authenticates via Bearer
      // even if the __session cookie hasn't landed yet (cold start / slow mint). Root
      // cause of "logged in but no dashboard" (2026-08-06 trace, Finding #1): a
      // cookie-timing 401 was silently rewritten to `dest` (/prestige/home), dumping
      // a super-admin on the member home instead of /admin/dashboard.
      const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
      let data: any = await resolvePostLogin({ body: { intent }, idToken });
      // Still no destination? Retry ONCE with a force-refreshed token rather than
      // fall through to the wrong (member-home) dest.
      if ((!data?.ok || !data?.nextUrl) && auth.currentUser) {
        const fresh = await auth.currentUser.getIdToken(true).catch(() => undefined);
        if (fresh) { const r: any = await resolvePostLogin({ body: { intent }, idToken: fresh }); if (r?.nextUrl) data = r; }
      }
      navigate(data?.nextUrl || data?.redirectTo || dest);
    } catch {
      navigate(dest);
    }
  }

  // Single funnel every signup/login success calls. Offers Face ID once (signup
  // only, capable device, no passkey yet) then routes; otherwise routes straight
  // through. Never blocks: the offer's Enable and "Not now" both call routeNow().
  async function finishAndRoute() {
    try {
      if (shouldOfferFaceIDNow()) {
        setFaceIDEmail(auth.currentUser?.email || email || '');
        setShowFaceIDOffer(true);
        return; // routeNow() runs from the card's onEnabled / "Not now" handlers
      }
    } catch { /* any doubt → route normally */ }
    await routeNow();
  }

  async function sendCode() {
    if (!phone) { fail(he ? 'הזן מספר טלפון' : 'Enter your mobile number'); return; }
    // Real 18+ birthday required for signup (login never needs DOB). The mobileStep
    // (adding a phone onto an already-verified social/email account) skips the DOB +
    // terms gates — both were satisfied at the first step.
    if (authMode !== 'login' && !mobileStep && !isAdult) { fail(he ? 'בחרו תאריך לידה — גיל 18 ומעלה' : 'Please set your date of birth — you must be 18 or older.'); return; }
    if (!mobileStep && !requireTerms()) return;
    setInlineError(null);
    setBusy(true);
    try {
      // Real bot protection via Cloudflare Turnstile (invisible).
      // A typed result: `ok:true` → token, `ok:false` → user-facing error.
      // `SITE_KEY_MISSING` means the client build never had a key (dev/staging
      // without the secret) — the server treats Turnstile as best-effort
      // bonus signal in that case, so we still call through. Every OTHER
      // failure code means the widget was configured but failed at runtime
      // (CSP blocked, script blocked, timeout) — the user MUST see it,
      // otherwise signup silently 400s at TURNSTILE_TOKEN_REQUIRED. (Agent-2
      // hunt 2026-08-20 — the exact class of bug that dead-ended prod signup.)
      const ts = await executeTurnstileInvisible('signup_sms_start');
      if (!ts.ok && ts.code !== 'SITE_KEY_MISSING') {
        fail(turnstileFailureMessage(ts.code, he ? 'he' : 'en'));
        return;
      }
      const turnstileToken = ts.ok ? ts.token : null;
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
      // MOBILE STEP-2: the user is ALREADY signed in (Google / Apple / email). ATTACH +
      // verify this phone onto their existing account — do NOT call phone-session (which
      // would mint a separate phone-first account). (CEO 2026-08-08 both-contacts)
      if (mobileStep) {
        const idToken = await auth.currentUser?.getIdToken(true);
        const a = await fetch(getApiUrl('/api/auth/verify-signup-mobile'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken, verificationToken: vd.verificationToken }),
        });
        const ad = await a.json();
        if (!ad.ok) { fail(ad.error || (he ? 'אימות הנייד נכשל' : 'Mobile verification failed')); return; }
        setMobileStep(false);
        await finishAndRoute();
        return;
      }
      const s = await fetch(getApiUrl('/api/auth/phone-session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ verificationToken: vd.verificationToken, dateOfBirth: dob, email }),
      });
      const sd = await s.json();
      // DUPLICATE GUARD: this email already has an account — don't create a second one.
      // Send them to sign in (email), then they can add the phone. (CEO 2026-08-08)
      if (sd.code === 'EMAIL_HAS_ACCOUNT') {
        setAuthMode('login');
        setMethod('email');
        setSent(false);
        fail(sd.error || (he ? 'לאימייל הזה כבר יש חשבון — התחברו כדי להוסיף את מספר הנייד.' : 'This email already has an account — sign in to add your mobile number.'));
        return;
      }
      if (!sd.customToken) {
        // No session token came back (phone-session error / unexpected shape). Do
        // NOT fall through to finishAndRoute() session-less — RequireAuth would then
        // bounce the user to /signin: "I entered my code and it kicked me out."
        // Mirror verifyEmailCode()'s honest-fail guard instead.
        fail(sd.message || (he ? 'האימות נכשל — נסה שוב' : 'Verification could not be completed. Please try again.'));
        return;
      }
      const cred = await signInWithCustomToken(auth, sd.customToken);
      const idToken = await cred.user.getIdToken(true);
      const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        // Send the DOB so the users row is CREATED with it — persistDob's
        // UPDATE ran before the row existed, dropping it (2026-07-24 fix).
        // Marketing consent is granular per MASTER AUTH rebuild (2026-08-16).
        body: JSON.stringify({ idToken, dateOfBirth: dob, ageConfirmed: true, termsAccepted: true, acceptedMarketing }),
      });
      if (!sessionRes.ok) {
        // Hollow server session → app guards would 401-bounce to /signin. Fail
        // honestly rather than route into a session-less app.
        fail(he ? 'ההתחברות לא הושלמה — נסה שוב' : 'Sign-in could not be completed. Please try again.');
        return;
      }
      // Step 2 — NEW accounts only: phone verified + account live, now verify the
      // EMAIL with its own code before we route (both contacts confirmed). Returning
      // users (already verified) skip straight through.
      if (sd.isNewUser && emailValid) {
        setEmailStep(true);
        setMethod('email');
        setSent(true);
        try {
          const step2 = await executeTurnstileInvisible('signup_email_start');
          if (!step2.ok && step2.code !== 'SITE_KEY_MISSING') {
            // Non-blocking step: show the same inline error but don't unwind
            // the mobile-verified state — user can tap "resend" on the email
            // OTP screen once the Turnstile issue is transient.
            fail(turnstileFailureMessage(step2.code, he ? 'he' : 'en'));
          } else {
            const step2Token = step2.ok ? step2.token : null;
            await fetch(getApiUrl('/api/auth/email/start'), {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ email, purpose: 'signup', language, turnstileToken: step2Token }),
            });
            toast({ title: he ? 'קוד נשלח לאימייל 📧' : 'Code sent to your email 📧' });
          }
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
    // Real 18+ birthday required for signup (login never needs DOB).
    if (authMode !== 'login' && !isAdult) { fail(he ? 'בחרו תאריך לידה — גיל 18 ומעלה' : 'Please set your date of birth — you must be 18 or older.'); return; }
    if (!requireTerms()) return;
    setInlineError(null);
    setBusy(true);
    try {
      // Returning-login code-first (2026-08-06): a login must use purpose 'login',
      // not 'signup' — otherwise the returning user's code is scoped wrong and the
      // flow attaches a synthetic signup DOB. Start + verify MUST agree on purpose.
      const emailPurpose = authMode === 'login' ? 'login' : 'signup';
      // Turnstile bot check on the email OTP start (mirrors the SMS start
      // path). SITE_KEY_MISSING = dev/staging without a key → treat as
      // best-effort and continue. Any RUNTIME failure code (LOAD_FAILED,
      // EXECUTE_FAILED, TIMEOUT, TOKEN_EMPTY) surfaces to the user — the
      // server would 400 TURNSTILE_TOKEN_REQUIRED silently otherwise.
      const emailTs = await executeTurnstileInvisible('signup_email_start');
      if (!emailTs.ok && emailTs.code !== 'SITE_KEY_MISSING') {
        fail(turnstileFailureMessage(emailTs.code, he ? 'he' : 'en'));
        return;
      }
      const emailTurnstileToken = emailTs.ok ? emailTs.token : null;
      const r = await fetch(getApiUrl('/api/auth/email/start'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email, purpose: emailPurpose, language, turnstileToken: emailTurnstileToken }),
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
      // Must match the purpose sent at /email/start (login vs signup).
      const emailPurpose = authMode === 'login' ? 'login' : 'signup';
      const v = await fetch(getApiUrl('/api/auth/email/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email, code: c, purpose: emailPurpose }),
      });
      const vd = await v.json();
      if (!vd.ok || !vd.sessionToken) { fail(vd.message || (he ? 'קוד שגוי' : 'Invalid code')); return; }

      // Step 2 path: the user is already signed in via phone — attach + verify the
      // email on their account, then route. (No second account is created.)
      if (emailStep) {
        const idToken = await auth.currentUser?.getIdToken(true);
        const a = await fetch(getApiUrl('/api/auth/verify-signup-email'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          // BOTH contacts now verified → set the password the user chose at join so
          // they can log in with email + password (CEO 2026-07-31). Only sent when
          // a valid password was collected (join flow); OTP-only paths omit it and
          // the server leaves the credential untouched.
          body: JSON.stringify({ idToken, sessionToken: vd.sessionToken, password: passwordValid ? password : undefined, twoFactorEnabled: twoFactor }),
        });
        const ad = await a.json();
        if (!ad.ok) { fail(ad.error || (he ? 'אימות האימייל נכשל' : 'Email verification failed')); return; }
        await finishAndRoute();
        return;
      }
      // On a returning LOGIN, do NOT send the synthetic default DOB (now-25) — it
      // could stamp a bogus birthday over the user's real one. Only the JOIN flow
      // (new-user row creation) carries the DOB.
      const dobForContext = authMode === 'login' ? undefined : dob;
      const s = await fetch(getApiUrl('/api/auth/email-session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ sessionToken: vd.sessionToken, dateOfBirth: dobForContext }),
      });
      const sd = await s.json();
      if (sd.customToken) {
        const cred = await signInWithCustomToken(auth, sd.customToken);
        const idToken = await cred.user.getIdToken(true);
        const sessRes = await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          // On signup the users row is CREATED with the DOB the user typed
          // (persistDob's UPDATE ran before the row existed, dropping it —
          // 2026-07-24 fix). ageConfirmed + termsAccepted ride alongside so
          // the server /session handler can enforce them; marketing is
          // separate and only sent on signup. Returning-login requests omit
          // all four so a returning user's stored values are never overwritten.
          body: JSON.stringify({
            idToken,
            dateOfBirth: dobForContext,
            ...(authMode === 'login'
              ? {}
              : { ageConfirmed: true, termsAccepted: true, acceptedMarketing }),
          }),
        });
        // NEW email signup → also collect + verify the mobile so the account confirms
        // BOTH contacts (CEO 2026-08-08). Returning users route straight in.
        const sessData = await sessRes.json().catch(() => ({} as any));
        if (authMode === 'join' && sessData?.isNewUser) {
          setPhone(''); setSent(false); setMethod('mobile'); setMobileStep(true);
          toast({ title: he ? 'שלב אחרון — אימות מספר הנייד' : 'One last step — verify your mobile' });
          return;
        }
        await finishAndRoute();
        return;
      }
      fail(he ? 'האימות נכשל' : 'Verification failed');
    } catch (e) { logger.error('[signup] verifyEmailCode', e); fail(he ? 'האימות נכשל' : 'Verification failed'); }
    finally { setBusy(false); }
  }

  async function social(which: 'google' | 'apple' | 'facebook') {
    // Google/Apple is the easy button — the user taps ONE thing and the
    // provider authenticates them. Do NOT gate the tap on DOB / 18+ /
    // Terms checkboxes; we don't know who they are yet. After OAuth
    // returns and the server determines they're a NEW / incomplete user,
    // the AccountActivation surface (already served for missingSteps)
    // collects the mandatory data they still owe (mobile / DOB / 18+ /
    // Terms) before the account is marked ACTIVE. Returning fully-
    // compliant users route straight through the post-login decider.
    setInlineError(null);
    setBusy(true);
    try {
      // NATIVE apps (iPhone / Galaxy): use the DIRECT native sheet via
      // @capacitor-firebase/authentication. The web signInWithRedirect path
      // returns null inside the Capacitor webview, so Google/Apple sign-in only
      // works through the native handlers. Falls through to web for the browser.
      // Facebook has no native handler yet (needs FB console keys + SDK config).
      // Inside the app the web redirect dead-ends (returns to petwash.co.il,
      // never back to the app) — fail honestly instead of stranding the user.
      if (isNativePlatform() && which === 'facebook') {
        fail(he
          ? 'התחברות Facebook עדיין לא פעילה באפליקציה — נסה Google, Apple, נייד או אימייל'
          : 'Facebook sign-in is not available in the app yet — please use Google, Apple, mobile or email.');
        return;
      }
      if (isNativePlatform() && (which === 'google' || which === 'apple')) {
        const cred = which === 'google'
          ? await signInWithGoogleNative(auth)
          : await signInWithAppleNative(auth);
        const idToken = await cred.user.getIdToken(true);
        // Social sessions are authenticated but NOT yet consented — the DOB /
        // 18+ / Terms checkboxes are collected AFTER OAuth on the completion
        // surface (AccountActivation for new users). Sending termsAccepted
        // here would fabricate consent the user never ticked.
        const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
        if (!sessionRes.ok) {
          const label = which === 'google' ? 'Google' : 'Apple';
          fail(he ? `התחברות ${label} לא הושלמה — נסה שוב` : `${label} sign-in could not be completed. Please try again.`);
          return;
        }
        // NEW native social user → collect + verify mobile so the account confirms BOTH
        // contacts (CEO 2026-08-08), same as the web path. Returning users route straight.
        const nsd = await sessionRes.json().catch(() => ({} as any));
        if (nsd?.isNewUser) {
          setPhone('');
          setSent(false);
          setMethod('mobile');
          setMobileStep(true);
          toast({ title: he ? 'שלב אחרון — אימות מספר הנייד' : 'One last step — verify your mobile' });
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
      // Mirror the native-social path — the browser has not yet collected
      // DOB / 18+ / Terms, so send only the id token. The AccountActivation
      // surface finishes the account with the missing mandatory data.
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
      // NEW social user: Google/Apple gave us a verified email but no phone. Ask them to
      // add + verify their mobile so the account confirms BOTH contacts (CEO 2026-08-08).
      // Returning users route straight in. (isNewUser comes from /api/auth/session.)
      const ssd = await sessionRes.json().catch(() => ({} as any));
      if (ssd?.isNewUser) {
        setPhone('');
        setSent(false);
        setMethod('mobile');
        setMobileStep(true);
        toast({ title: he ? 'שלב אחרון — אימות מספר הנייד' : 'One last step — verify your mobile' });
        return;
      }
      await finishAndRoute();
    } catch (e: any) {
      // A user closing/canceling the provider sheet is NOT an error — showing a
      // red "did not complete" banner for a deliberate cancel feels broken
      // (CEO 2026-07-30). Covers the web popup code AND the native plugin's
      // cancel rejections (ASWebAuthenticationSession / Apple sheet dismiss).
      const cancelSignal = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase();
      if (cancelSignal.includes('popup-closed-by-user') || cancelSignal.includes('cancel')) return;
      // POPUP BLOCKED → fall back to full-page redirect instead of dead-ending.
      // This is the #1 "Google/Apple does nothing and bounces back to the login
      // page" cause: on desktop + non-iOS browsers the popup strategy is chosen,
      // and popup blockers / strict browsers / embedded webviews silently block
      // signInWithPopup (auth/popup-blocked). Rather than show an error and strand
      // the user, seamlessly retry via signInWithRedirect, which always works.
      // (popup-closed-by-user is a deliberate cancel — already returned above.)
      const popupFailed =
        cancelSignal.includes('popup-blocked') ||
        cancelSignal.includes('cancelled-popup-request') ||
        cancelSignal.includes('operation-not-supported-in-this-environment');
      if (popupFailed && (which === 'google' || which === 'apple' || which === 'facebook')) {
        try {
          logger.warn('[signup] social popup blocked — falling back to redirect', { which });
          try { (window as any).PW_track?.('auth.social_popup_fallback_redirect', { provider: which }); } catch { /* noop */ }
          // `provider` above is scoped to the try block — recreate it here.
          const redirectProvider =
            which === 'google' ? createGoogleProvider() :
            which === 'apple'  ? createAppleProvider()  :
                                 createFacebookProvider();
          setSignupRedirectMarker(which);
          await seedSignupIntentCookie();
          await signInWithRedirect(auth, redirectProvider);
          return; // page navigates away; getRedirectResult() finishes on return
        } catch (redirectErr) {
          logger.error('[signup] social redirect fallback failed', redirectErr);
          // fall through to the normal error banner below
        }
      }
      logger.error('[signup] social', e);
      const label = which === 'google' ? 'Google' : which === 'apple' ? 'Apple' : 'Facebook';
      // Show the SPECIFIC reason (provider not enabled, unauthorized domain, network,
      // etc.) instead of a generic "did not complete" — a swallowed code makes a config
      // gap indistinguishable from a real failure. humanizeAuthError maps the common
      // Firebase + native codes; the code is logged/beaconed above for diagnosis.
      const code = String(e?.code || e?.message || '').trim();
      // PROVIDER LINKING: this email already has a PetWash account via another
      // method. Instead of the dead-end "use your original method", capture the
      // pending new-provider credential + the existing methods and open the link
      // flow. FAIL-SAFE: if extraction throws or yields nothing, fall through to
      // the normal helpful error below — never worse than today.
      if (code === 'auth/account-exists-with-different-credential') {
        try {
          const collidedEmail = String(e?.customData?.email || e?.email || '').trim();
          const pendingCred =
            which === 'google' ? GoogleAuthProvider.credentialFromError(e) :
            which === 'apple'  ? OAuthProvider.credentialFromError(e)  :
                                 FacebookAuthProvider.credentialFromError(e);
          if (collidedEmail && pendingCred) {
            const methods = await fetchSignInMethodsForEmail(auth, collidedEmail);
            setLinkState({ email: collidedEmail, pendingCred, methods, newLabel: which === 'google' ? 'Google' : which === 'apple' ? 'Apple' : 'Facebook' });
            return;
          }
        } catch (linkErr) {
          logger.warn('[signup] link-detect failed — showing generic guidance', { err: (linkErr as any)?.message });
        }
      }
      const reason = humanizeAuthError(code, he ? 'he' : 'en');
      try { (window as any).PW_track?.('auth.social_error', { provider: which, code }); } catch { /* noop */ }
      fail(he
        ? `התחברות ${label}: ${reason}`
        : `${label} sign-in: ${reason}`);
    } finally { setBusy(false); }
  }

  // Finish provider-linking: re-authenticate with the EXISTING method, then
  // linkWithCredential() attaches the pending new provider so BOTH work next time
  // — one account, no duplicate. Then mint the session + route as normal.
  async function completeLink(reauth: () => Promise<void>) {
    if (!linkState) return;
    setInlineError(null);
    setBusy(true);
    try {
      await reauth();                                   // sign in with the existing method
      if (!auth.currentUser) throw new Error('no-user-after-reauth');
      await linkWithCredential(auth.currentUser, linkState.pendingCred);  // attach new provider
      const idToken = await auth.currentUser.getIdToken(true);
      const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) { fail(he ? 'החיבור נכשל — נסו שוב' : 'Linking failed — please try again.'); return; }
      setLinkState(null); setLinkPassword('');
      await finishAndRoute();
    } catch (err: any) {
      const c = String(err?.code || err?.message || '').toLowerCase();
      if (c.includes('wrong-password') || c.includes('invalid-credential')) fail(he ? 'סיסמה שגויה' : 'Incorrect password.');
      else if (c.includes('popup-closed') || c.includes('cancel')) { /* user cancelled the re-auth */ }
      else { logger.error('[signup] link', err); fail(he ? 'החיבור נכשל — נסו שוב' : 'Linking failed — please try again.'); }
    } finally { setBusy(false); }
  }
  function linkViaPassword() {
    return completeLink(async () => { await signInWithEmailAndPassword(auth, linkState!.email, linkPassword); });
  }
  function linkViaProvider() {
    return completeLink(async () => {
      const m = linkState!.methods;
      const prov = m.includes('google.com') ? createGoogleProvider()
                 : m.includes('apple.com') ? createAppleProvider()
                 : createFacebookProvider();
      await signInWithPopup(auth, prov);
    });
  }

  /** Server-mediated OAuth (Instagram / TikTok / etc.). The backend builds the
   *  authorize URL with provider secrets and we redirect the browser there. */
  async function socialExternal(which: 'instagram' | 'tiktok') {
    // Rover-style passive consent (CEO 2026-07-27): no blocking checkbox. The
    // disclosure line under the tiles + this deliberate tap ARE the affirmative
    // action (action-based, NOT a pre-ticked box). Terms are stamped server-side
    // for social logins (routes.ts session handler).
    setInlineError(null);
    setBusy(true);
    try {
      // Same dead-end as Facebook inside the app: a top-level OAuth redirect
      // can't return to the webview. Honest message until a native flow exists.
      if (isNativePlatform()) {
        const nativeLabel = which === 'instagram' ? 'Instagram' : 'TikTok';
        fail(he
          ? `התחברות ${nativeLabel} עדיין לא פעילה באפליקציה — נסה Google, Apple, נייד או אימייל`
          : `${nativeLabel} sign-in is not available in the app yet — please use Google, Apple, mobile or email.`);
        return;
      }
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
    // Real 18+ birthday required for signup (login never needs DOB).
    if (authMode !== 'login' && !isAdult) { fail(he ? 'בחרו תאריך לידה — גיל 18 ומעלה' : 'Please set your date of birth — you must be 18 or older.'); return; }
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
        // On signup send DOB + ageConfirmed + termsAccepted + acceptedMarketing
        // so the server /session handler can validate age + record consent in
        // one call — email+password members were previously re-asked their
        // birthday at /complete-profile because DOB was dropped here
        // (2026-07-27). Returning-login requests omit all consent fields so a
        // stored preference is never overwritten.
        body: JSON.stringify({
          idToken,
          dateOfBirth: dob,
          ...(authMode === 'login'
            ? {}
            : { ageConfirmed: true, termsAccepted: true, acceptedMarketing }),
        }),
      });
      if (!sessionRes.ok) {
        // Surface the real failure instead of dropping the user into the app on a
        // session that will immediately 401-bounce them back here.
        fail(he ? 'יצירת ההתחברות נכשלה — נסה שוב' : 'Could not establish your session. Please try again.');
        return;
      }
      // NEW email+password signup → also collect + verify the mobile so the account
      // confirms BOTH contacts (CEO 2026-08-08). Returning login routes straight in.
      const sd2 = await sessionRes.json().catch(() => ({} as any));
      if (authMode === 'join' && sd2?.isNewUser) {
        setPhone(''); setSent(false); setMethod('mobile'); setMobileStep(true);
        toast({ title: he ? 'שלב אחרון — אימות מספר הנייד' : 'One last step — verify your mobile' });
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
  // Signup consent gate — three independent signals:
  //   dobValid + isAdult        — a real 18+ birthday the user typed.
  //   ageConfirmed18Plus         — explicit "I am 18+" checkbox (mandatory).
  //   agreedTerms                — Terms + Privacy Notice checkbox (mandatory).
  // Marketing is intentionally absent — optional signals must never gate
  // account creation. Server /session re-enforces every one of these AND
  // independently calculates age from DOB before creating an active row.
  const consentOk = dobValid && isAdult && ageConfirmed18Plus && agreedTerms;
  // ONE contact is enough (CEO 2026-07-24 "sign up not easy"): startSignup()
  // already branches phone-first-else-email, and the design intent above is
  // "type whichever they like, we detect which". The old gate demanded phone
  // AND email AND dob together — so filling just email left Continue dead with
  // no reason shown. Now: either contact + 18+ DOB unlocks it; the second
  // contact is collected/verified after, not up front.
  const hasContact = phoneValid || emailValid;
  // MASTER AUTH rebuild (2026-08-16): every signup Send-code / Continue tap
  // requires BOTH a real 18+ DOB AND an active Terms/Privacy tick. `authMode`
  // === 'login' bypasses consentOk (returning users already consented at join).
  const readyForSubmit = !busy && hasContact && (authMode === 'login' ? true : consentOk);

  // ── CEO 2026-07-31 contract: JOIN needs BOTH contacts + a password ──────────
  // A real account, not the passwordless one-contact demo. Password ≥8; confirm
  // must match. See [[signup-contract-both-plus-password-2026-07-31]].
  const passwordValid = password.length >= 8;
  const bothContacts = phoneValid && emailValid;
  // MASTER AUTH rebuild (2026-08-16): join gate includes active consent
  // (agreedTerms) — the previous joinReady let the user submit with a valid
  // DOB but no Terms tick, which the new hard gate no longer permits.
  const joinReady = !busy && bothContacts && passwordValid && consentOk;
  // LOGIN is email + password (returning member). Phone-OTP login still exists via
  // the "use a one-time code" link; social + passkey remain on both modes.
  const loginReady = !busy && emailValid && password.length >= 1;

  const ctaLabel = busy ? '…' : (he ? 'המשך' : 'Continue');

  function startSignup() {
    if (phoneValid) { setMethod('mobile'); void sendCode(); }
    else if (emailValid) { setMethod('email'); void sendEmailCode(); }
  }

  // JOIN (CEO 2026-07-31): both contacts + password validated → start phone-first
  // dual verification (SMS code → then email code). The chosen password rides in
  // component state and is set on the Firebase account server-side once BOTH
  // contacts are verified (verifyEmailCode → verify-signup-email). Name + address
  // are collected right after, in the profile step (complete-profile).
  function startJoin() {
    if (!bothContacts) { fail(he ? 'צריך גם מספר נייד וגם אימייל' : 'A mobile number AND an email are both required'); return; }
    if (!passwordValid) { fail(he ? 'הסיסמה חייבת להיות באורך 8 תווים לפחות' : 'Password must be at least 8 characters'); return; }
    if (!isAdult) { fail(he ? 'יש להיות בגיל 18 ומעלה' : 'You must be 18 or older'); return; }
    setInlineError(null);
    setMethod('mobile');
    void sendCode();
  }

  // LOGIN (CEO 2026-07-31): returning member signs in with email + password (the
  // Firebase email/password credential set at join). Clear message on bad creds,
  // and a nudge to the code path / join for accounts without a password yet.
  async function loginWithPassword() {
    if (!emailValid) { fail(he ? 'הזן כתובת אימייל תקינה' : 'Enter a valid email'); return; }
    if (!password) { fail(he ? 'הזן סיסמה' : 'Enter your password'); return; }
    setInlineError(null);
    setBusy(true);
    // Block the auth-state auto-navigate for the whole login (Firebase sign-in
    // fires onAuthStateChanged immediately; we route ourselves once the session is minted).
    mfaLoginInFlight.current = true;
    try {
      // 2026-08-18 PR-AUTH-SECURITY-9 — honour the Remember-me toggle.
      // Must be called BEFORE signInWithEmailAndPassword so the resulting
      // session is stored at the requested persistence level.
      try {
        const { setPersistence, browserLocalPersistence, browserSessionPersistence } = await import('firebase/auth');
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch { /* fall back to Firebase default (LOCAL) if the module fails to load */ }
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken(true);
      const r = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (r.status === 428) {
        // 2-step login is ON for this account — send the SMS code and switch to the
        // code screen. The same idToken proves identity through the challenge.
        const s = await fetch(getApiUrl('/api/auth/login/2fa/start'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ idToken, language }),
        });
        const sd = await s.json().catch(() => ({} as any));
        if (sd?.needed) {
          setMfaChallenge({ idToken, phoneHint: sd.phoneHint || '' });
          toast({ title: he ? 'קוד נשלח לנייד 📲' : 'Code sent to your phone 📲' });
          return;
        }
        mfaLoginInFlight.current = false;
        fail(he ? 'לא ניתן להתחיל אימות דו-שלבי — נסו שוב' : 'Could not start two-step verification — please try again');
        return;
      }
      if (!r.ok) { mfaLoginInFlight.current = false; fail(he ? 'ההתחברות נכשלה — נסה שוב' : 'Sign-in failed — please try again'); return; }
      mfaLoginInFlight.current = false;
      await finishAndRoute();
    } catch (e: any) {
      mfaLoginInFlight.current = false;
      const code = e?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        fail(he ? 'אימייל או סיסמה שגויים. אין עדיין חשבון? הצטרפו, או התחברו עם קוד חד-פעמי.' : 'Wrong email or password. No account yet? Create one, or use a one-time code.');
      } else if (code === 'auth/too-many-requests') {
        fail(he ? 'יותר מדי ניסיונות — נסו שוב בעוד רגע' : 'Too many attempts — please try again shortly');
      } else {
        fail(humanizeAuthError(code, he ? 'he' : 'en'));
      }
    } finally { setBusy(false); }
  }

  // Verify the login-time SMS code for a 2-step account, then finish the session.
  // On success the server mints a proof (mfaToken) that /api/auth/session accepts.
  async function verifyLoginMfa(code: string) {
    if (!mfaChallenge) return;
    setInlineError(null);
    setBusy(true);
    try {
      const v = await fetch(getApiUrl('/api/auth/login/2fa/verify'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken: mfaChallenge.idToken, code, language }),
      });
      const vd = await v.json().catch(() => ({} as any));
      if (!vd.ok || !vd.mfaToken) { fail(vd.error || (he ? 'קוד שגוי' : 'Invalid code')); return; }
      const r = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ idToken: mfaChallenge.idToken, mfaToken: vd.mfaToken }),
      });
      if (!r.ok) { fail(he ? 'ההתחברות נכשלה — נסה שוב' : 'Sign-in failed — please try again'); return; }
      mfaLoginInFlight.current = false;
      setMfaChallenge(null);
      await finishAndRoute();
    } catch (e) { logger.error('[signup] verifyLoginMfa', e); fail(he ? 'האימות נכשל' : 'Verification failed'); }
    finally { setBusy(false); }
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
    completeFields: he ? 'להמשך: הזינו נייד או אימייל ותאריך לידה (גיל 18 ומעלה).' : 'To continue: enter your mobile or email and your date of birth (18+).',
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
          {/* The hero logo is intentionally hidden: /signup now renders inside the
              standard <Layout> header (logo + shop + social + language), so showing
              the sl-logo here too would double the mark. (CEO 2026-07-27: full
              standard header everywhere.) */}
          <header className="sl-heroHead">
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
            {/* Language switch removed here — the standard <Layout> header already
                owns it; a second in-form switcher was duplicate/confusing. (2026-07-31) */}
          </header>

          {/* Duplicate top consent removed (2026-06-24): it required a SEPARATE
              `terms` checkbox on top of the labeled agreedTerms + over18 below,
              so checking the visible bottom boxes left the CTA disabled = "dead
              buttons" on iPhone. Consent is now the single labeled block lower
              down (agreedTerms + over18 → consentOk). */}

          {/* Single error banner policy (CEO 2026-07-30): the message renders ONCE,
              next to the action the user just tapped (below, by the social tiles /
              form CTA) — the old second copy up here doubled the box on screen. */}
          {sent && inlineError && (
            <p className="sl-inlineError" role="alert">{inlineError}</p>
          )}

          {/* === MOBILE STEP-2 — a NEW email/Google/Apple user adds + verifies their
              phone so the account confirms BOTH contacts (CEO 2026-08-08). === */}
          {mobileStep && !sent && (
            <>
              <p className="sl-helper sl-center">
                {he ? 'כמעט סיימנו — אמתו את מספר הנייד. חשבון חדש מאמת אימייל + נייד.' : 'Almost there — verify your mobile. A new account confirms email + mobile.'}
              </p>
              <div className="sl-field">
                <label className="sl-label">{t.phoneLabel}</label>
                <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
              </div>
              <button className="sl-cta" disabled={busy || !phoneValid} onClick={() => { void sendCode(); }}>
                <FaMobileAlt aria-hidden /> {busy ? '…' : (he ? 'שלחו לי קוד ב-SMS' : 'Text me a one-time code')}
              </button>
            </>
          )}

          {/* === OPEN inputs — no tabs. Phone AND email are both visible; the user
              just types whichever they like and presses Continue (we detect which). === */}
          {!sent && !mfaChallenge && !mobileStep && (
            <>
              {/* Passkey/Face-ID is a RETURNING-user shortcut and lives at the BOTTOM
                  now (CEO 2026-07-17): a brand-new joiner has no passkey yet, so
                  showing it first only 400s and confuses. See the returning-user
                  block after the social options below. */}

              {/* Member/provider CHOICE removed from signup (CEO 2026-07-31, council
                  "defer" pick): everyone signs up once as a member — the fastest,
                  modern path — and "Become a provider" is a separate later CTA.
                  Provider signup still works via a deep link (/signup?flow=provider),
                  which sets `flow` above without an on-screen picker; the native
                  provider app locks flow='provider' by flavor. This also removes the
                  static "member" card that looked like a dead toggle. */}

              {/* Signup consent — three independent axes, none pre-ticked:
                  1) 18+ confirmation (mandatory) — paired with the DOB the
                     user typed; server independently calculates age from DOB
                     and requires BOTH to be true.
                  2) Terms + Privacy Notice acceptance (mandatory) — one
                     acceptance event, recorded together server-side.
                  3) Marketing preference (optional) — separate opt-in, never
                     blocks submit and never touches the terms/privacy audit
                     timestamps.
                  Hidden on returning-user LOGIN (consented at join). */}
              {authMode !== 'login' && (
                <div className="sl-consentBox" dir={he ? 'rtl' : 'ltr'} style={{ margin: '14px 0 10px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px', lineHeight: 1.45 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={ageConfirmed18Plus}
                      onChange={(e) => setAgeConfirmed18Plus(e.target.checked)}
                      required
                      aria-required="true"
                      data-testid="checkbox-ageConfirmed18Plus"
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span>
                      {he
                        ? 'אני מאשר/ת שאני בן/בת 18 ומעלה (חובה).'
                        : 'I confirm that I am 18 years of age or older (required).'}
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      required
                      aria-required="true"
                      data-testid="checkbox-agreedTerms"
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span>
                      {he ? 'קראתי ואני מסכים/ה ל' : 'I have read and agree to the '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>{he ? 'תנאי השימוש' : 'Terms of Service'}</a>
                      {he ? ' ול' : ' and '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>{he ? 'הודעת הפרטיות' : 'Privacy Notice'}</a>
                      {he ? ' (חובה).' : ' (required).'}
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={acceptedMarketing}
                      onChange={(e) => setAcceptedMarketing(e.target.checked)}
                      data-testid="checkbox-acceptedMarketing"
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span style={{ opacity: 0.85 }}>
                      {he
                        ? 'שלחו לי חדשות ומבצעים של PetWash בדוא"ל / SMS (אופציונלי — ניתן לבטל בכל עת).'
                        : 'Send me PetWash news and offers by email/SMS (optional — you can unsubscribe anytime).'}
                    </span>
                  </label>
                </div>
              )}

              {/* Consent/blocked-tap error shown HERE, right between the boxes and the
                  social tiles — the top-of-form inlineError (~400px up) was off-screen
                  when the user tapped Google, so it read as "Gmail gives nothing".
                  (2026-07-27) */}
              {inlineError && (
                <p className="sl-inlineError" role="alert" data-testid="signup-consent-error" style={{ margin: '2px 0 8px', textAlign: he ? 'right' : 'left' }}>{inlineError}</p>
              )}

              {/* DIRECT sign-in = Google + Apple ONLY (CEO 2026-08-01). Everyone else
                  uses the email + mobile fields below — type ANY address (Gmail, Hotmail,
                  Yahoo, anything) and verify by one-time code. No Facebook/Instagram/
                  TikTok/Yahoo/Microsoft buttons: they cluttered the page and didn't work.
                  Buttons are NOT disabled on missing consent — a tap surfaces the
                  "accept terms + 18+" message above and scrolls it into view. */}
              <div className="sl-social4">
                {signupFlags.googleSignin && (
                  <button className="sl-soc" disabled={busy} onClick={() => social('google')}>
                    <GoogleIcon /> <span className="sl-socLabel">{t.cwGoogle}</span>
                  </button>
                )}
                {signupFlags.appleSignin && APPLE_SIGNIN_READY && (
                  <button className="sl-soc sl-soc--apple" disabled={busy} onClick={() => social('apple')}>
                    <FaApple aria-hidden /> <span className="sl-socLabel">{t.cwApple}</span>
                  </button>
                )}
              </div>

              <div className="sl-div">{he ? 'או' : 'or'}</div>

              {/* JOIN step 1 = a CHOICE of FOUR first-class methods (CEO 2026-08-01:
                  "email must be first-class — do not assume Gmail or Apple"). Apple +
                  Google are in the grid above; mobile + email are here. Each reveals a
                  LEAN single-field entry (no long form, no password, no DOB) — the rest
                  is asked afterwards, only if missing. Any email works (Yahoo/Outlook/
                  Walla/business/Gmail) via a one-time code. */}
              {authMode === 'join' && !manualMode && (
                <>
                  <button type="button" className="sl-soc" style={{ width: '100%' }} disabled={busy}
                    onClick={() => { setManualMode(true); setMethod('mobile'); setSent(false); setInlineError(null); }}
                    data-testid="button-continue-mobile">
                    <FaMobileAlt aria-hidden /> <span className="sl-socLabel">{he ? 'המשך עם מספר נייד' : 'Continue with mobile number'}</span>
                  </button>
                  <button type="button" className="sl-soc" style={{ width: '100%' }} disabled={busy}
                    onClick={() => { setManualMode(true); setMethod('email'); setSent(false); setInlineError(null); }}
                    data-testid="button-continue-email">
                    <FaEnvelope aria-hidden /> <span className="sl-socLabel">{he ? 'המשך עם אימייל' : 'Continue with email'}</span>
                  </button>
                  <button type="button" className="sl-switchLink" onClick={() => { setAuthMode('login'); setManualMode(false); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.85, fontSize: '13.5px', cursor: 'pointer', padding: '12px 0 4px', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {he ? 'כבר יש לך חשבון? התחברות' : 'Already have an account? Sign in'}
                  </button>
                </>
              )}

              {/* ===================== JOIN (new account) =====================
                  CEO 2026-07-31: a real account needs BOTH contacts + a password.
                  Mobile + email + password + confirm + 18+ DOB, all required. The
                  phone is verified first (SMS code), then the email (email code),
                  then the password is set — name + address come right after, in the
                  profile step. No more "pick one and skip the rest" demo. */}
              {authMode === 'join' && manualMode && (
                <>
                  {/* Back to the method choice (Apple / Google / mobile). */}
                  <button type="button" className="sl-switchLink" onClick={() => { setManualMode(false); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.75, fontSize: '13px', cursor: 'pointer', padding: '2px 0 6px', width: '100%', textAlign: he ? 'right' : 'left' }}>
                    {he ? '‹ חזרה לאפשרויות ההתחברות' : '‹ Back to sign-in options'}
                  </button>
                  {/* MOBILE method — a single phone field. A one-time SMS code verifies
                      it; name + terms are asked afterwards (only if missing). No password. */}
                  {method === 'mobile' && (
                    <>
                      {signupFlags.smsFallbackAndRealErrors && !smsProviderHealthy && (
                        <p className="sl-inlineError" role="status">
                          {he ? 'SMS אינו זמין כעת — נסו שוב עוד רגע, או המשיכו עם אימייל / Google / Apple.' : 'SMS is temporarily unavailable — try again shortly, or continue with email / Google / Apple.'}
                        </p>
                      )}
                      <div className="sl-field">
                        <label className="sl-label">{t.phoneLabel}</label>
                        <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
                      </div>
                      {/* A NEW account verifies BOTH contacts (CEO 2026-08-08: "one thing
                          not enough for new users"). Collect the email here so the already-
                          wired step-2 (verify mobile → then verify email) fires. Returning
                          users still log in with one method — this is signup only. */}
                      <div className="sl-field">
                        <label className="sl-label">{t.emailLabel}</label>
                        <div className="sl-inputWrap">
                          <FaEnvelope className="sl-inputIcon" aria-hidden />
                          <input className="sl-input sl-input--icon" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                            value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} />
                        </div>
                        <div className="sl-hint">{he ? 'נאמת גם את האימייל — חשבון חדש מאמת נייד + אימייל.' : "We'll verify your email too — a new account confirms mobile + email."}</div>
                      </div>
                    </>
                  )}

                  {/* EMAIL method — ANY email. PRIMARY path is email + a PetWash
                      password the user SETS here (autoComplete="new-password" so
                      iCloud/Google offers to save it → one-tap return, ₪0 per login).
                      Leaving the password blank falls back to a one-time email code,
                      so nobody is ever locked out. */}
                  {method === 'email' && (
                    <>
                      <div className="sl-field">
                        <label className="sl-label">{t.emailLabel}</label>
                        <div className="sl-inputWrap">
                          <FaEnvelope className="sl-inputIcon" aria-hidden />
                          <input className="sl-input sl-input--icon" type="email" inputMode="email" autoComplete="username email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                            value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} />
                        </div>
                        <div className="sl-hint">{he ? 'כל כתובת אימייל — Gmail, Outlook, Yahoo, Walla או עסקית.' : 'Any email — Gmail, Outlook, Yahoo, Walla or business.'}</div>
                      </div>
                      <div className="sl-field">
                        <label className="sl-label">{he ? 'סיסמה' : 'Password'}</label>
                        <div className="sl-inputWrap">
                          <FaLock className="sl-inputIcon" aria-hidden />
                          <input className="sl-input sl-input--icon" type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder={he ? 'בחרו סיסמה (6 תווים לפחות)' : 'Choose a password (min 6 chars)'} />
                        </div>
                        <button type="button" className="sl-pwToggle" onClick={() => setShowPwd((s) => !s)}
                          style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.7, fontSize: '12.5px', cursor: 'pointer', padding: '2px 0', textAlign: he ? 'right' : 'left', width: '100%' }}>
                          {showPwd ? (he ? 'הסתר סיסמה' : 'Hide password') : (he ? 'הצג סיסמה' : 'Show password')}
                        </button>
                        <div className="sl-hint">{he ? 'שמרו אותה ב-iCloud/Google לכניסה מהירה בפעם הבאה. או השאירו ריק וקבלו קוד חד-פעמי.' : 'Save it to iCloud/Google for one-tap return next time — or leave blank to get a one-time code.'}</div>
                      </div>
                    </>
                  )}
                  {/* DATE OF BIRTH (18+). Rendered so we collect a REAL birthday
                      rather than the old hidden default. maxYear = now-18 means the
                      wheel only offers adult years, so any value is a valid 18+ date.
                      Server re-enforces at account creation. */}
                  <div className="sl-field">
                    <AppleWheelDatePicker
                      value={dob}
                      onChange={setDob}
                      maxYear={new Date().getFullYear() - 18}
                      label={he ? 'תאריך לידה (18+)' : 'Date of birth (18+)'}
                      monthNames={he ? ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'] : undefined}
                      dayLabel={he ? 'יום' : 'Day'}
                      monthLabel={he ? 'חודש' : 'Month'}
                      yearLabel={he ? 'שנה' : 'Year'}
                    />
                    <div className="sl-hint">{he ? 'גללו לתאריך הלידה שלכם.' : 'Spin the wheels to your date of birth.'}</div>
                  </div>
                  <button type="button" className="sl-switchLink" onClick={() => { setAuthMode('login'); setManualMode(false); setSent(false); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.8, fontSize: '13px', cursor: 'pointer', padding: '8px 0', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {he ? 'כבר יש לך חשבון? התחבר/י' : 'Already have an account? Sign in'}
                  </button>
                </>
              )}

              {/* ===================== LOGIN (returning member) =====================
                  Email + password (the credential set at join). A returning member
                  with no password yet (old account / social) uses the one-time-code
                  link or the social buttons above. */}
              {authMode === 'login' && method === 'mobile' && (
                <>
                  {/* MOBILE LOGIN (2026-08-08): phone-only members had NO way to sign in —
                      the login screen showed only email/password, locking them out even
                      though the backend fully supports login-by-mobile. sendCode() skips
                      the DOB gate in login mode and verify() routes an existing user. */}
                  <div className="sl-field">
                    <label className="sl-label">{t.phoneLabel}</label>
                    <PhoneInput value={phone} onChange={setPhone} language={language} defaultCountry="IL" />
                  </div>
                  <button type="button" className="sl-switchLink" disabled={busy}
                    onClick={() => { setMethod('email'); setSent(false); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.85, fontSize: '13px', cursor: 'pointer', padding: '6px 0', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {he ? 'התחבר/י עם אימייל במקום' : 'Sign in with email instead'}
                  </button>
                  <button type="button" className="sl-switchLink" onClick={() => { setAuthMode('join'); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.8, fontSize: '13px', cursor: 'pointer', padding: '8px 0', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {he ? 'חדש כאן? צור/צרי חשבון' : 'New here? Create an account'}
                  </button>
                </>
              )}
              {authMode === 'login' && method !== 'mobile' && (
                <>
                  <div className="sl-field">
                    <label className="sl-label">{t.emailLabel}</label>
                    <div className="sl-inputWrap">
                      <FaEnvelope className="sl-inputIcon" aria-hidden />
                      <input className="sl-input sl-input--icon" type="email" inputMode="email" autoComplete="username email webauthn" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} />
                    </div>
                  </div>
                  {/* Password is now the SECONDARY path (behind the toggle below).
                      Code-first: the primary CTA sends a one-time code to the email. */}
                  {usePassword && (
                    <>
                      <div className="sl-field">
                        <label className="sl-label">{t.pwd}</label>
                        <div className="sl-inputWrap">
                          <FaLock className="sl-inputIcon" aria-hidden />
                          <input className="sl-input sl-input--icon" type={showPwd ? 'text' : 'password'} autoComplete="current-password"
                            value={password} onChange={(e) => setPassword(e.target.value)} placeholder={he ? 'הסיסמה שלך' : 'Your password'}
                            onKeyDown={(e) => { if (e.key === 'Enter' && loginReady) { void loginWithPassword(); } }} />
                        </div>
                      </div>
                      <button type="button" className="sl-pwToggle" onClick={() => setShowPwd((s) => !s)}
                        style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.7, fontSize: '12.5px', cursor: 'pointer', padding: '2px 0', textAlign: he ? 'right' : 'left', width: '100%' }}>
                        {showPwd ? (he ? 'הסתר סיסמה' : 'Hide password') : (he ? 'הצג סיסמה' : 'Show password')}
                      </button>
                      {/* 2026-08-18 PR-AUTH-SECURITY-9 — Remember me on this device.
                          When OFF, the Firebase session is cleared on browser close
                          (browserSessionPersistence) — right choice on a shared/kiosk
                          machine. When ON (default), the session persists across
                          restarts (browserLocalPersistence). Choice is remembered
                          per-browser via localStorage so the user does not have to
                          re-tick it on every visit. */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', opacity: 0.85, cursor: 'pointer', padding: '6px 0', flexDirection: he ? 'row-reverse' : 'row' }}
                        data-testid="signin-remember-me-label">
                        <input type="checkbox" checked={rememberMe}
                          onChange={(e) => {
                            const v = e.target.checked;
                            setRememberMe(v);
                            try { window.localStorage.setItem('petwash.rememberMe', v ? '1' : '0'); } catch { /* private-mode / quota */ }
                          }}
                          data-testid="signin-remember-me"
                          style={{ accentColor: '#D4AF37', cursor: 'pointer' }} />
                        <span>{he ? 'זכור אותי במכשיר הזה' : 'Remember me on this device'}</span>
                      </label>
                      {/* Forgot password? (2026-08-16 audit D10). Firebase's
                          sendPasswordResetEmail has its own rate-limiting and
                          NEVER reveals whether the account exists — same generic
                          copy on success and failure, so an unauthenticated
                          attacker can't use this to enumerate accounts. */}
                      <button type="button" className="sl-switchLink" disabled={busy || !emailValid}
                        onClick={async () => {
                          if (!emailValid) {
                            fail(he ? 'הזינו אימייל תקין קודם' : 'Enter a valid email first');
                            return;
                          }
                          try {
                            const { sendPasswordResetEmail } = await import('firebase/auth');
                            const { auth: fbAuth } = await import('@/lib/firebase');
                            await sendPasswordResetEmail(fbAuth, email);
                          } catch { /* Same generic message either way. */ }
                          toast({
                            title: he ? 'איפוס סיסמה נשלח' : 'Password reset sent',
                            description: he
                              ? `אם קיים חשבון עבור ${email}, הודעת איפוס בדרך.`
                              : `If an account exists for ${email}, a reset email is on its way.`,
                          });
                        }}
                        data-testid="button-forgot-password"
                        style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.75, fontSize: '12.5px', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', textAlign: he ? 'right' : 'left', width: '100%' }}>
                        {he ? 'שכחתם סיסמה?' : 'Forgot password?'}
                      </button>
                    </>
                  )}
                  {/* Toggle ONLY switches between code-first and password — it does not
                      send a code (the primary CTA does that). */}
                  <button type="button" className="sl-switchLink" disabled={busy}
                    onClick={() => setUsePassword((p) => !p)}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.85, fontSize: '13px', cursor: 'pointer', padding: '6px 0', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {usePassword
                      ? (he ? 'התחבר/י עם קוד חד-פעמי במקום' : 'Sign in with a one-time code instead')
                      : (he ? 'התחבר/י עם סיסמה במקום' : 'Sign in with a password instead')}
                  </button>
                  {/* Let a phone-only member sign in with their number (2026-08-08). */}
                  <button type="button" className="sl-switchLink" disabled={busy}
                    onClick={() => { setMethod('mobile'); setUsePassword(false); setSent(false); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.85, fontSize: '13px', cursor: 'pointer', padding: '6px 0', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {he ? 'התחבר/י עם מספר נייד במקום' : 'Sign in with your mobile number instead'}
                  </button>
                  <button type="button" className="sl-switchLink" onClick={() => { setAuthMode('join'); setInlineError(null); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.8, fontSize: '13px', cursor: 'pointer', padding: '8px 0', textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
                    {he ? 'חדש כאן? צור/צרי חשבון' : 'New here? Create an account'}
                  </button>
                </>
              )}
            </>
          )}

          {/* === OTP — appears after we send the SMS === */}
          {method === 'mobile' && sent && (
            <>
              <p className="sl-helper sl-center">{he ? `הזן את הקוד שנשלח ל-${phone}` : `Enter the code sent to ${phone}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verify(c); }} loading={busy} language={he ? 'he' : 'en'} />
              {/* Resend actually resends. Old handler was setSent(false) — it
                  bounced the user back to the entry form and made them tap the
                  primary Send button again. Now it calls the real network
                  send; the countdown (server rate-limit is the hard gate) keeps
                  users from spam-tapping into 429s. */}
              <button className="sl-btn" disabled={busy || resendCountdown > 0}
                onClick={() => { setResendCountdown(60); void sendCode(); }}
                data-testid="button-resend-code-mobile">
                {resendCountdown > 0
                  ? (he ? `שלח שוב בעוד ${resendCountdown} שניות` : `Resend in ${resendCountdown}s`)
                  : (he ? 'שלח קוד חדש' : 'Resend code')}
              </button>
            </>
          )}

          {/* === Email OTP — appears after we send the 6-digit email code === */}
          {method === 'email' && sent && (
            <>
              <p className="sl-helper sl-center">{he ? `הזן את הקוד שנשלח ל-${email}` : `Enter the code sent to ${email}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verifyEmailCode(c); }} loading={busy} language={he ? 'he' : 'en'} />
              <button className="sl-btn" disabled={busy || resendCountdown > 0}
                onClick={() => { setResendCountdown(60); void sendEmailCode(); }}
                data-testid="button-resend-code-email">
                {resendCountdown > 0
                  ? (he ? `שלח שוב בעוד ${resendCountdown} שניות` : `Resend in ${resendCountdown}s`)
                  : (he ? 'שלח קוד חדש' : 'Resend code')}
              </button>
            </>
          )}

          {/* === Provider LINKING — this email already has an account via another
                 method. Sign in with it once → the new provider is attached. One
                 account, both methods. Cancel returns to the normal options. === */}
          {linkState && (
            <div className="sl-faceIdOffer">
              <p className="sl-helper sl-center">
                {he
                  ? `לאימייל ${linkState.email} כבר יש חשבון ב-PetWash. היכנסו כדי לחבר את ${linkState.newLabel} לחשבון.`
                  : `${linkState.email} already has a PetWash account. Sign in to connect ${linkState.newLabel} to it.`}
              </p>
              {linkState.methods.includes('password') ? (
                <>
                  <div className="sl-field">
                    <label className="sl-label">{he ? 'הסיסמה שלך' : 'Your password'}</label>
                    <div className="sl-inputWrap">
                      <FaLock className="sl-inputIcon" aria-hidden />
                      <input className="sl-input sl-input--icon" type="password" autoComplete="current-password"
                        value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !busy && linkPassword) void linkViaPassword(); }} />
                    </div>
                  </div>
                  <button className="sl-cta" disabled={busy || !linkPassword} onClick={() => void linkViaPassword()}>
                    {busy ? '…' : (he ? `התחברות וחיבור ${linkState.newLabel}` : `Sign in & connect ${linkState.newLabel}`)}
                  </button>
                </>
              ) : (
                <button className="sl-cta" disabled={busy} onClick={() => void linkViaProvider()}>
                  {busy ? '…' : (() => {
                    const m = linkState.methods;
                    const existing = m.includes('google.com') ? 'Google' : m.includes('apple.com') ? 'Apple' : 'Facebook';
                    return he ? `היכנסו עם ${existing} וחברו את ${linkState.newLabel}` : `Sign in with ${existing} & connect ${linkState.newLabel}`;
                  })()}
                </button>
              )}
              <button type="button" className="sl-switchLink" disabled={busy}
                onClick={() => { setLinkState(null); setLinkPassword(''); }}
                style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.8, fontSize: '13px', cursor: 'pointer', padding: '8px 0', width: '100%', textAlign: 'center' }}>
                {he ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          )}

          {/* === Post-signup Face ID / passkey offer (once, capable device, no
                 passkey yet). Both Enable and "Not now" call routeNow() so the
                 user always continues — the funnel can never dead-end here. === */}
          {showFaceIDOffer && (
            <div className="sl-faceIdOffer">
              <EnableFaceIDCard
                userEmail={faceIDEmail}
                onEnabled={() => { setShowFaceIDOffer(false); void routeNow(); }}
              />
              <button type="button" className="sl-switchLink" disabled={busy}
                onClick={() => { try { localStorage.setItem('petwash_faceid_offer_dismissed', '1'); } catch {} setShowFaceIDOffer(false); void routeNow(); }}
                style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.8, fontSize: '13px', cursor: 'pointer', padding: '10px 0', width: '100%', textAlign: 'center' }}>
                {he ? 'לא עכשיו — המשך' : 'Not now — continue'}
              </button>
            </div>
          )}

          {/* === 2-step LOGIN code — returning member who turned on 2-step === */}
          {mfaChallenge && (
            <>
              <p className="sl-helper sl-center">{he
                ? `הזן את הקוד שנשלח ל-${mfaChallenge.phoneHint || 'הנייד שלך'}`
                : `Enter the code sent to ${mfaChallenge.phoneHint || 'your phone'}`}</p>
              <OtpCodeInput length={6} onComplete={(c) => { void verifyLoginMfa(c); }} loading={busy} language={he ? 'he' : 'en'} />
              {inlineError && <p className="sl-inlineError" role="alert" style={{ textAlign: 'center', marginTop: 8 }}>{inlineError}</p>}
              <button className="sl-btn" disabled={busy} onClick={() => { mfaLoginInFlight.current = false; setMfaChallenge(null); setPassword(''); setInlineError(null); }}>{he ? 'ביטול' : 'Cancel'}</button>
            </>
          )}

          {!sent && !mfaChallenge && !mobileStep && (
            <>
              {/* Primary CTA — JOIN (both contacts + password) or LOGIN (email + password). */}
              {authMode === 'join' ? (
                // Only show the create-account CTA once the manual form is open —
                // on the method-choice screen the buttons above ARE the actions.
                manualMode && (
                <>
                  {/* Send the one-time code for the chosen method (mobile→SMS,
                      email→email code). The name + any missing base fields are asked
                      after the code is verified — no password anywhere. */}
                  <button className="sl-cta"
                    disabled={busy || (method === 'email' ? !emailValid : (!phoneValid || !emailValid)) || !ageConfirmed}
                    onClick={() => {
                      if (method === 'email') {
                        // Password set → create the account with it (saveable). Blank
                        // → fall back to a one-time email code. Never locked out.
                        if (password) { void emailSubmit(); } else { void sendEmailCode(); }
                      } else { void sendCode(); }
                    }}>
                    <FaMobileAlt aria-hidden /> {busy ? '…' : (method === 'email' && password ? (he ? 'יצירת חשבון' : 'Create account') : (he ? 'שליחת קוד אימות' : 'Send verification code'))}
                  </button>
                  {((method === 'email' ? !emailValid : (!phoneValid || !emailValid)) || !ageConfirmed) && (
                    <div className="sl-hint sl-submitHint">
                      {(method === 'email' ? !emailValid : (!phoneValid || !emailValid))
                        ? (method === 'email'
                            ? (he ? 'הזינו כתובת אימייל תקינה כדי לקבל קוד.' : 'Enter a valid email to get a code.')
                            : (!phoneValid
                                ? (he ? 'הזינו מספר נייד תקין.' : 'Enter a valid mobile number.')
                                : (he ? 'הזינו גם אימייל — חשבון חדש מאמת נייד + אימייל.' : 'Add your email too — a new account verifies mobile + email.')))
                        : (!over18
                            ? (he ? 'סמנו: אני בן/בת 18 ומעלה.' : 'Tick the "I am 18 or older" box.')
                            : (he ? 'בחרו תאריך לידה (18+).' : 'Set your date of birth (18+).'))}
                    </div>
                  )}
                </>
                )
              ) : method === 'mobile' ? (
                // MOBILE login (2026-08-08): send an SMS code to the member's number.
                // sendCode() skips the DOB gate in login mode; verify() routes the
                // existing user through phone-session (isNewUser=false).
                <button className="sl-cta" disabled={busy || !phoneValid}
                  onClick={() => { void sendCode(); }}>
                  <FaMobileAlt aria-hidden /> {busy ? '…' : (he ? 'שלחו לי קוד ב-SMS' : 'Text me a one-time code')}
                </button>
              ) : usePassword ? (
                <>
                  <button className="sl-cta" disabled={busy} onClick={() => { void loginWithPassword(); }}>
                    <FaLock aria-hidden /> {busy ? '…' : (he ? 'התחברות' : 'Sign in')}
                  </button>
                  {/* PR-AUTH-FIX-RESET-EMAIL-3: Forgot Password on the login
                      screen. Generic success message regardless of whether an
                      account exists (anti-enumeration). Disabled while in-flight
                      to prevent double-submit. */}
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <button
                      type="button"
                      disabled={forgotBusy}
                      onClick={() => { void handleForgotPassword(); }}
                      data-testid="link-forgot-password"
                      style={{ background: 'none', border: 'none', color: 'inherit', opacity: forgotBusy ? 0.5 : 0.85, fontSize: '13px', textDecoration: 'underline', cursor: forgotBusy ? 'wait' : 'pointer', padding: '4px 0' }}
                    >
                      {forgotBusy
                        ? (he ? 'שולח…' : 'Sending…')
                        : (he ? 'שכחתי את הסיסמה' : 'Forgot password?')}
                    </button>
                  </div>
                  {forgotSent && (
                    <p
                      role="status"
                      data-testid="text-forgot-sent"
                      style={{ textAlign: 'center', fontSize: '13px', color: '#8A6A1B', marginTop: 8 }}
                    >
                      {he
                        ? 'אם קיים חשבון לכתובת שסופקה, נשלח אימייל לאיפוס סיסמה. בדוק את תיבת הדואר.'
                        : 'If an account exists for that address, a password reset email has been sent. Please check your inbox.'}
                    </p>
                  )}
                </>
              ) : (
                // CODE-FIRST primary CTA (returning login): email → one-time code.
                <button className="sl-cta" disabled={busy || !emailValid}
                  onClick={() => { setMethod('email'); void sendEmailCode(); }}>
                  <FaEnvelope aria-hidden /> {busy ? '…' : (he ? 'שלחו לי קוד חד-פעמי' : 'Email me a one-time code')}
                </button>
              )}

              {/* Trust signals + security explanations are kept OFF the simple
                  method-choice screen (CEO 2026-08-01) — they appear once the user
                  is in the manual form or the login screen, not before. */}
              {!(authMode === 'join' && !manualMode) && (
                <>
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
                </>
              )}

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
      /* flex column so .sl-frame's auto margins can vertically center the content
         on tall/large screens (fixes the "stranded at the top with a huge empty
         void below" look on 27"/4K monitors). (big-screen fix 2026-08-07) */
      display:flex; flex-direction:column;
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
      width:100%;
      max-width:1560px;
      /* margin:auto centers the content BOTH horizontally and — because .sl-shell
         is now a flex column — vertically on tall/large screens, so the layout sits
         in the MIDDLE of a 27"/4K screen instead of stranded up top with an empty
         void below. On short screens the auto margins collapse to 0 and the content
         flows/scrolls from the top normally (mobile unaffected). Bottom padding added
         (was 0) so the content never sits flush against the edge. (big-screen fix) */
      margin:auto;
      display:flex; flex-direction:column;
      padding:clamp(20px,4vw,44px) clamp(16px,3vw,40px);
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
    /* object-position:top keeps the DOG'S HEAD in frame — object-fit:cover with a
       1/1.05 box was cropping the top of the head off (CEO 2026-08-01). Anchor the
       crop to the top so ears/head are always visible. */
    .sl-dog{ width:min(58%, 340px); height:auto; aspect-ratio:1/1.05; object-fit:cover; object-position:center top; border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.06) }

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
    .sl-chooser{ display:grid; gap:10px; margin-top:4px }
    .sl-backLink{ background:none; border:0; color:#9a7b2e; font-weight:700; font-size:13px; padding:6px 0; cursor:pointer; text-align:inherit }
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
      /* Light ivory notice card (CEO 2026-07-30: no brown/red boxes — lighter,
         nicer). Warm white on the dark canvas + thin gold border = on-brand;
         black text keeps it readable, the small dot signals attention. */
      margin:0;
      padding:11px 14px;
      border-radius:14px;
      border:1px solid rgba(212,175,55,.5);
      background:rgba(255,250,240,.96);
      color:#1a1a1a;
      font-size:13px;
      font-weight:600;
      line-height:1.4;
      box-shadow:0 4px 16px rgba(0,0,0,.22);
    }
    .sl-inlineError::before{
      content:'';
      display:inline-block;
      width:7px; height:7px;
      border-radius:50%;
      background:#D4AF37;
      margin-inline-end:8px;
      vertical-align:middle;
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
      /* Keep the primary action reachable: on a phone the fields can push the
       * button below the fold, which read as "there is no submit button". Sticky
       * bottom pins it to the viewport while scrolling the form. The gold gradient
       * is fully opaque so nothing bleeds through. */
      position:sticky; bottom:10px; z-index:6;
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
      /* Bring the brand dog back on phones (CEO 2026-08-08) but COMPACT — a small
         photo under the logo, not the old 480px hero that buried the form. */
      .sl-dogWrap{ display:flex; justify-content:center; padding:2px 0 4px }
      .sl-dog{ width:min(30vw, 118px); aspect-ratio:1/1.05; border-radius:14px }
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
      .sl-inputWrap .sl-inputIcon{ ${he ? 'right:14px' : 'left:14px'} }
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
      /* keep the dog visible on the smallest phones, just smaller (CEO 2026-08-08) */
      .sl-dog{ width:min(26vw, 96px) }
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
