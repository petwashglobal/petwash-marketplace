import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendPasswordResetEmail, GoogleAuthProvider, OAuthProvider, linkWithCredential, signInWithPopup, signInWithRedirect, signInWithCustomToken, getAdditionalUserInfo, getRedirectResult } from "firebase/auth";
import type { OAuthCredential } from "firebase/auth";
import { getAuthStrategy, createGoogleProvider, createAppleProvider, createFacebookProvider, getDeviceInfo } from "@/lib/iosAuthHandler";
import { auth } from "../lib/firebase";
import { getApiUrl } from "@/lib/apiConfig";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { useSEO, pageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/PhoneInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PinKeypad } from "@/components/PinKeypad";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import { Loader2, Mail, Info, Fingerprint, Smartphone, ScanFace, Phone, User, Lock, ArrowRight, Sparkles, KeyRound, X, ArrowLeft } from "lucide-react";
import { SiFacebook, SiTiktok, SiInstagram } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { trackSwitchAccount } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { signInWithPasskey, signInWithPasskeyConditional, isPasskeySupported, getBiometricMethodName, isChromeiOS, getBrowserName, isSafariIOS } from "@/auth/passkey";
import { useAutoFaceID, storePasskeyEmail, clearPasskeyEmail, storeLastAuthMethod, getConsecutiveFailures } from "@/hooks/useAutoFaceID";
import { FaceIDLoadingState } from "@/components/FaceIDLoadingState";
import { executeReCaptcha, preloadReCaptcha } from "@/components/ReCaptcha";
import { TurnstileWidget, TURNSTILE_CONFIGURED, executeTurnstileInvisible } from "@/components/TurnstileWidget";
import { trackAuthError } from "@/lib/authErrorTracker";
import { trustDevice, isDeviceTrusted } from "@/lib/deviceTrust";
import { normalizePhoneE164 } from "@/lib/authUtils";
import { motion, AnimatePresence } from "framer-motion";

function getBiometricButtonLabel(language: Language): string {
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) {
    return language === 'he' ? 'התחבר עם טביעת אצבע' : 'Sign in with Fingerprint';
  }
  if (/iPhone|iPad|iPod/.test(ua)) {
    return language === 'he' ? 'התחבר עם Face ID' : 'Sign in with Face ID';
  }
  if (/Macintosh|Mac OS X/.test(ua)) {
    return language === 'he' ? 'התחבר עם Touch ID' : 'Sign in with Touch ID';
  }
  if (/Windows/.test(ua)) {
    return language === 'he' ? 'התחבר עם Windows Hello' : 'Sign in with Windows Hello';
  }
  return language === 'he' ? 'התחבר עם Passkey' : 'Sign in with Passkey';
}

interface SignInProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

// ── Redirect marker helpers ───────────────────────────────────────────────────
// Safari ITP may clear sessionStorage during cross-origin redirects (e.g. Firebase → petwash.co.il).
// Strategy: write the marker to BOTH sessionStorage and localStorage, then read sessionStorage first.
// sessionStorage is preferred (auto-clears on tab close = less data leakage) and localStorage acts
// as the ITP-resistant fallback so the marker always survives the OAuth hop.
const REDIRECT_MARKER_KEY = 'pw_redirect_provider';
const REDIRECT_MARKER_TTL = 5 * 60 * 1000; // 5 minutes

function setRedirectMarker(provider: string): void {
  const data = JSON.stringify({ provider, ts: Date.now() });
  try { sessionStorage.setItem(REDIRECT_MARKER_KEY, data); } catch { /* ignore */ }
  try { localStorage.setItem(REDIRECT_MARKER_KEY, data); } catch { /* ignore */ }
}

function getRedirectMarker(): string | null {
  // Try sessionStorage first (preferred), fall back to localStorage (Safari ITP fallback).
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(REDIRECT_MARKER_KEY);
      if (!raw) continue;
      const { provider, ts } = JSON.parse(raw);
      if (Date.now() - ts > REDIRECT_MARKER_TTL) {
        store.removeItem(REDIRECT_MARKER_KEY);
        continue;
      }
      return provider as string;
    } catch { continue; }
  }
  return null;
}

function clearRedirectMarker(): void {
  try { sessionStorage.removeItem(REDIRECT_MARKER_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(REDIRECT_MARKER_KEY); } catch { /* ignore */ }
}

export default function SignIn({ language, onLanguageChange }: SignInProps) {
  useSEO(pageSEO.login);
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const { trackUserAuth, trackEvent } = useAnalytics();
  const { user, logout } = useFirebaseAuth();
  const [loading, setLoading] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyAvailable] = useState(isPasskeySupported());
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [webviewBlocked, setWebviewBlocked] = useState(false);
  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<{ phone: string } | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  // Account linking: stores credential from a social provider that collided with an existing account.
  // After the user signs in with their existing method, linkWithCredential() is called to merge them.
  const [pendingOAuthCredential, setPendingOAuthCredential] = useState<OAuthCredential | null>(null);
  const [pendingLinkProvider, setPendingLinkProvider] = useState<SocialProvider | null>(null);
  const [magicLinkEmailNeeded, setMagicLinkEmailNeeded] = useState(false);
  const [magicLinkEmailInput, setMagicLinkEmailInput] = useState("");
  const [magicLinkHref, setMagicLinkHref] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [rememberDevice, setRememberDevice] = useState(false);
  const customRedirect = new URLSearchParams(window.location.search).get('redirect') || '';
  const [passwordFailureCount, setPasswordFailureCount] = useState(0);
  const [magicLinkResendCountdown, setMagicLinkResendCountdown] = useState(0);
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const [forcePasswordMode, setForcePasswordMode] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [signInStepUpPending, setSignInStepUpPending] = useState(false);
  const [pendingSignInIdToken, setPendingSignInIdToken] = useState<string | null>(null);
  const [pendingSignInCaptchaToken, setPendingSignInCaptchaToken] = useState<string | null>(null);
  const [pendingSignInUid, setPendingSignInUid] = useState<string | null>(null);
  const [pinError, setPinError] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<string | null>(
    localStorage.getItem('signup_intent') || null
  );
  
  const autoFaceID = useAutoFaceID({
    language,
    enabled: !user && !switchingAccount && passkeyAvailable && !forcePasswordMode && !isDeviceTrusted(),
    onSuccess: () => {
      logger.info("Auto Face ID: Login successful, navigating via post-login role decider");
    },
    onNavigate: () => navigatePostLogin(),
    onFailure: (error) => {
      logger.info("Auto Face ID: Login failed, showing manual form", { error });
      setShowFallbackHint(true);
    }
  });

  const handleSelectIntent = (intent: string) => {
    localStorage.setItem('signup_intent', intent);
    setSelectedIntent(intent);
  };

  const navigatePostLogin = async (fallback = '/home') => {
    try {
      const intent = localStorage.getItem('signup_intent') || undefined;
      const res = await fetch(getApiUrl('/api/auth/post-login'), {
        method: 'POST',
        headers: intent ? { 'Content-Type': 'application/json' } : {},
        credentials: 'include',
        body: intent ? JSON.stringify({ intent }) : undefined,
      });
      const data = await res.json();
      const postLoginPath = data.nextUrl || data.redirectTo || fallback;
      localStorage.removeItem('signup_intent');
      window.scrollTo(0, 0);

      // If post-login says the user is ready (going to /home or /provider/dashboard etc.)
      // and there is a ?from= return URL in the address bar, send them back there instead.
      // This preserves bookings-in-progress: user clicks "Book", gets redirected to sign-in,
      // completes sign-in, and arrives back at the booking page — not a generic home screen.
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('from');
      const isTerminalPath = ['/home', '/provider-os', '/provider/dashboard', '/admin/dashboard', '/franchise/dashboard'].some(
        p => postLoginPath === p || postLoginPath.startsWith(p)
      );
      if (returnUrl && isTerminalPath) {
        try {
          const decoded = decodeURIComponent(returnUrl);
          // Basic safety: only allow relative paths (prevent open redirect)
          if (decoded.startsWith('/') && !decoded.startsWith('//')) {
            navigate(decoded);
            return;
          }
        } catch {}
      }
      navigate(postLoginPath);
    } catch {
      window.scrollTo(0, 0);
      navigate(fallback);
    }
  };
  
  // Pre-warm reCAPTCHA on page mount so script is already loaded when user submits
  useEffect(() => { preloadReCaptcha(); }, []);

  useEffect(() => {
    const hadDarkClass = document.documentElement.classList.contains('dark');
    document.documentElement.setAttribute('data-auth-page', 'true');
    document.body.setAttribute('data-auth-page', 'true');
    document.documentElement.classList.remove('dark');
    
    return () => {
      document.documentElement.removeAttribute('data-auth-page');
      document.body.removeAttribute('data-auth-page');
      if (hadDarkClass) {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  // If redirected from provider-onboarding, auto-set intent so post-login routes correctly
  useEffect(() => {
    if (customRedirect && customRedirect.includes('provider-onboarding') && !selectedIntent) {
      localStorage.setItem('signup_intent', 'provider');
      setSelectedIntent('provider');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (magicLinkResendCountdown > 0) {
      const timer = setTimeout(() => {
        setMagicLinkResendCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [magicLinkResendCountdown]);
  
  useEffect(() => {
    if (user && !switchingAccount && !loading) {
      logger.info('[Auth] User already signed in, redirecting');
      if (customRedirect) { navigate(customRedirect); } else { navigatePostLogin(); }
    }
  }, [user, loading]);

  useEffect(() => {
    const handleOAuthCustomToken = async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthCode = params.get('oauthCode');
      const oauthProvider = params.get('provider');
      
      if (!oauthCode || !oauthProvider) return;
      
      try {
        setLoading(true);
        window.history.replaceState({}, '', '/signin');
        
        const exchangeResponse = await fetch(getApiUrl(`/api/auth/social/token-exchange?code=${encodeURIComponent(oauthCode)}`));
        const exchangeData = await exchangeResponse.json();
        
        if (!exchangeData.customToken) {
          throw new Error('Token exchange failed');
        }
        
        const isNew = exchangeData.isNew || false;
        const userCredential = await signInWithCustomToken(auth, exchangeData.customToken);
        const idToken = await userCredential.user.getIdToken();
        
        const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
        
        if (!sessionResponse.ok) {
          throw new Error('Failed to create session');
        }
        
        if (isNew) {
          try {
            await fetch(getApiUrl('/api/loyalty/auto-enroll'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                userId: userCredential.user.uid,
                email: userCredential.user.email,
                displayName: userCredential.user.displayName,
                provider: oauthProvider,
                role: 'pet_parent',
              }),
            });
          } catch (loyaltyErr) {
            logger.warn('[Auth] Loyalty auto-enroll failed for OAuth user:', loyaltyErr);
          }
        }
        
        storeLastAuthMethod('social');
        const { trackLogin } = await import('@/lib/analytics');
        trackLogin(oauthProvider, userCredential.user.uid);
        
        toast({
          title: t('signin.successTitle', language),
          description: t('signin.redirecting', language),
        });
        
        setTimeout(() => {
          if (customRedirect) { window.scrollTo(0, 0); navigate(customRedirect); }
          else { navigatePostLogin(); }
        }, 1000);
      } catch (error: any) {
        logger.error(`[Auth] ${oauthProvider} OAuth custom token sign-in failed:`, error);
        toast({
          variant: 'destructive',
          title: language === 'he' ? 'התחברות עם Google אינה זמינה' : 'Google sign-in unavailable',
          description: language === 'he'
            ? 'אנא התחבר עם מספר הטלפון שלך.'
            : 'Please sign in with your phone number instead.',
        });
      } finally {
        setLoading(false);
      }
    };
    
    handleOAuthCustomToken();
  }, []);

  // Handle Magic Link return - detect when user clicks magic link from email
  useEffect(() => {
    const handleMagicLinkReturn = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        const email = window.localStorage.getItem('emailForSignIn');
        
        if (!email) {
          // Store the current URL so we can use it when the user submits their email
          // inline (window.prompt is blocked on iOS — we show an inline form instead).
          setMagicLinkHref(window.location.href);
          setMagicLinkEmailNeeded(true);
          return;
        }
        
        try {
          setLoading(true);
          const userCredential = await signInWithEmailLink(auth, email, window.location.href);
          
          window.localStorage.removeItem('emailForSignIn');
          
          const idToken = await userCredential.user.getIdToken();
          const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken }),
          });

          if (!sessionResponse.ok) {
            throw new Error('Failed to create session');
          }
          
          if (userCredential.user.uid && userCredential.user.email) {
            trustDevice(userCredential.user.uid, userCredential.user.email);
            storeLastAuthMethod('magic_link');
          }
          
          const { trackLogin } = await import('@/lib/analytics');
          trackLogin('magic_link', userCredential.user.uid);
          
          trackEvent({
            action: 'magic_link_login_success',
            category: 'authentication',
            label: 'magic_link_verified',
            language,
          });
          
          toast({
            title: t('signin.successTitle', language),
            description: t('signin.redirecting', language),
          });

          navigatePostLogin();
        } catch (error: any) {
          logger.error("Magic link verification error:", error);
          toast({
            variant: "destructive",
            title: t('signin.error_title', language),
            description: error.message || (language === 'he' ? 'אימות קישור קסם נכשל' : 'Magic link verification failed'),
          });
        } finally {
          setLoading(false);
        }
      }
    };
    
    handleMagicLinkReturn();
  }, []);
  
  // Called when user submits their email via the inline magic-link email form
  // (replaces the window.prompt that is blocked on iOS/mobile browsers).
  const handleMagicLinkEmailSubmit = async () => {
    const email = magicLinkEmailInput.trim();
    if (!email || !magicLinkHref) return;
    try {
      setLoading(true);
      window.localStorage.setItem('emailForSignIn', email);
      const userCredential = await signInWithEmailLink(auth, email, magicLinkHref);
      window.localStorage.removeItem('emailForSignIn');
      setMagicLinkEmailNeeded(false);
      setMagicLinkHref('');
      setMagicLinkEmailInput('');
      const idToken = await userCredential.user.getIdToken();
      const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      if (!sessionResponse.ok) throw new Error('Failed to create session');
      if (userCredential.user.uid && userCredential.user.email) {
        trustDevice(userCredential.user.uid, userCredential.user.email);
        storeLastAuthMethod('magic_link');
      }
      const { trackLogin } = await import('@/lib/analytics');
      trackLogin('magic_link', userCredential.user.uid);
      toast({ title: t('signin.successTitle', language), description: t('signin.redirecting', language) });
      navigatePostLogin();
    } catch (error: any) {
      logger.error("Magic link inline email verification error:", error);
      toast({
        variant: 'destructive',
        title: t('signin.error_title', language),
        description: error.message || (language === 'he' ? 'אימות קישור קסם נכשל' : 'Magic link verification failed'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsePasswordInstead = () => {
    logger.info("User manually switched to password mode");
    setForcePasswordMode(true);
    setShowFallbackHint(true);
    trackEvent({
      action: 'auth_fallback_to_password',
      category: 'authentication',
      label: 'manual_switch',
      language,
    });
  };

  
  useEffect(() => {
    if (!passkeyAvailable || user || autoFaceID.isLoading) return;
    
    let active = true;
    logger.info("Initializing Conditional UI for Face ID autofill");
    
    (async () => {
      try {
        const success = await signInWithPasskeyConditional();
        
        if (success && active) {
          logger.info("Conditional UI: Face ID login successful");
          const email = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value;
          if (email) {
            storePasskeyEmail(email);
          }
          
          trackEvent({
            action: 'auth_conditional_passkey_success',
            category: 'authentication',
            label: 'face_id_autofill',
            language,
          });
          
          window.scrollTo(0, 0);
          navigatePostLogin();
        }
      } catch (error) {
        logger.debug("Conditional UI: Passkey autofill not triggered (expected)", { error: error instanceof Error ? error.message : 'unknown' });
      }
    })();
    
    return () => {
      logger.info("Cleaning up Conditional UI");
      active = false;
    };
  }, [passkeyAvailable, user, navigate, trackEvent, language, autoFaceID.isLoading]);

  useEffect(() => {
    if (user && !switchingAccount && !loading) {
      logger.info("User already logged in, auto-redirecting to homepage");
      navigatePostLogin();
    }
  }, [user, switchingAccount, loading, navigate]);

  // Fire-and-forget: report a structured auth failure to /api/auth/client-event
  // so it lands in the auth_events table for admin visibility.
  const logClientEvent = (
    eventType: 'OAUTH_CALLBACK_FAILED' | 'OAUTH_POPUP_FAILED' | 'REDIRECT_RESULT_NULL' | 'SESSION_CREATION_FAILED',
    opts: { provider?: string; reason?: string; traceId?: string } = {}
  ) => {
    fetch(getApiUrl('/api/auth/client-event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, success: false, ...opts }),
    }).catch(() => {});
  };

  // Handle Google redirect result after iOS signInWithRedirect flow
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result) {
          // AuthProvider.tsx also calls getRedirectResult on mount and may have
          // consumed the result first (Firebase clears it from IndexedDB after the
          // first successful read). Check auth.currentUser before deciding whether
          // the redirect genuinely failed or was already handled by AuthProvider.
          const expectedProvider = getRedirectMarker();
          if (expectedProvider) {
            clearRedirectMarker();
            if (auth.currentUser) {
              // AuthProvider already processed the redirect result — user is signed
              // in. Do not show an error toast; the onAuthStateChanged handler in
              // AuthProvider will navigate the user to the correct page.
              logger.info('[Auth] Redirect result consumed by AuthProvider — skipping null-result error toast', { provider: expectedProvider });
            } else {
              // Truly lost — Safari ITP likely cleared the cross-origin state.
              logClientEvent('REDIRECT_RESULT_NULL', { provider: expectedProvider });
              toast({
                variant: 'destructive',
                title: language === 'he' ? 'ההתחברות לא הושלמה' : 'Sign-in not completed',
                description: language === 'he'
                  ? 'לא הצלחנו לאמת את ההתחברות. אנא נסו שוב.'
                  : 'We could not verify your sign-in. Please try again.',
              });
            }
          }
          return;
        }

        const provider = getRedirectMarker() || 'google';
        clearRedirectMarker();

        logger.info(`[Auth] Processing redirect result for provider: ${provider}`);
        setSocialLoading(provider as any);

        const idToken = await result.user.getIdToken();

        await createSessionOrSignOut(idToken);

        const additionalInfo = getAdditionalUserInfo(result);
        if (additionalInfo?.isNewUser) {
          try {
            await fetch(getApiUrl('/api/loyalty/auto-enroll'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
              credentials: 'include',
              body: JSON.stringify({
                userId: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                provider,
                role: 'pet_parent',
              }),
            });
          } catch (e) { logger.warn('[Auth] Loyalty auto-enroll failed (non-blocking):', e); }
        }

        storeLastAuthMethod('social');
        toast({ title: t('signin.successTitle', language), description: t('signin.redirecting', language) });
        const redirect = new URLSearchParams(window.location.search).get('redirect') || '';
        if (redirect) { window.scrollTo(0, 0); navigate(redirect); }
        else { navigatePostLogin(); }
      } catch (err: any) {
        if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
        logger.error('[Auth] Redirect result error:', err);
        const errProvider = getRedirectMarker() || 'unknown';
        clearRedirectMarker();
        logClientEvent('OAUTH_CALLBACK_FAILED', {
          provider: errProvider,
          reason: err?.code || err?.message || 'unknown',
        });
      } finally {
        setSocialLoading(null);
      }
    };
    handleRedirectResult();
  }, []);

  const handleSwitchAccount = async () => {
    try {
      setSwitchingAccount(true);
      const previousUserId = user?.uid || null;
      clearPasskeyEmail();
      trackSwitchAccount(previousUserId);
      await logout();
      
      toast({
        title: t('auth.switchAccount', language),
        description: t('signin.switchingToSignIn', language),
      });
      
      setFormData({ email: "", password: "" });
      setMagicLinkMode(false);
      setMagicLinkSent(false);
      
      logger.info("Account switched successfully", { previousUserId });
    } catch (error) {
      logger.error("Switch account error:", error);
      toast({
        variant: "destructive",
        title: t('auth.logoutError', language),
      });
    } finally {
      setSwitchingAccount(false);
    }
  };

  const handlePasskeySignIn = async () => {
    try {
      setPasskeyLoading(true);
      logger.info("Passkey sign-in initiated", { browser: getBrowserName() });

      const passkeyStartTime = performance.now();

      // On iOS Safari, conditional mediation triggers the native one-tap Face ID
      // prompt rather than the QR-code modal — always prefer it when available.
      // If it returns false (user dismissed, no passkey, or not supported), we fall
      // through to the standard modal flow below.
      if (isSafariIOS()) {
        try {
          const conditionalOk = await signInWithPasskeyConditional();
          if (conditionalOk) {
            logger.info("Conditional Face ID sign-in succeeded (Safari iOS)");
            trackEvent({
              action: 'auth_conditional_passkey_success',
              category: 'authentication',
              label: 'face_id_button_safari',
              language,
            });
            window.scrollTo(0, 0);
            navigatePostLogin();
            return;
          }
        } catch (conditionalErr) {
          // Conditional UI was aborted / not triggered — fall through to modal
          logger.debug("Conditional Face ID did not complete, falling back to modal", {
            error: conditionalErr instanceof Error ? conditionalErr.message : 'unknown',
          });
        }
      }

      const result = await signInWithPasskey();
      
      if (result.success) {
        const email = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value;
        if (email) {
          storePasskeyEmail(email);
        }
        
        trackEvent({
          action: 'auth_passkey_login_success',
          category: 'authentication',
          label: getBiometricMethodName(),
          language,
        });

        const { trackPasskeyToDashboard } = await import('@/lib/rum');
        trackPasskeyToDashboard(passkeyStartTime);

        window.scrollTo(0, 0);
        navigatePostLogin();
      } else {
        const noPasskeysFound = result.error?.toLowerCase().includes('no passkeys found') || 
          result.error?.toLowerCase().includes('no credentials found');

        if (noPasskeysFound) {
          logger.info("Passkey sign-in: No passkeys registered for this account", { error: result.error });
        } else {
          let errorDescription = result.error || t('signin.failed', language);
          if (isChromeiOS()) {
            errorDescription = language === 'he'
              ? `${result.error || "נכשל להתחבר"}. טיפ: נסה Safari לחווית Face ID טובה יותר.`
              : `${result.error || "Failed to sign in"}. Tip: Try Safari for better Face ID experience.`;
          }
          
          toast({
            variant: "destructive",
            title: language === 'he' ? 'שגיאה בהתחברות' : 'Sign-in error',
            description: errorDescription,
          });
        }

        trackEvent({
          action: 'auth_passkey_error',
          category: 'authentication',
          label: `${result.error || 'unknown_error'}_${getBrowserName()}`,
          language,
        });
      }
    } catch (error: any) {
      logger.error("Passkey sign-in error:", error);
      
      let errorDescription = error.message || t('signin.failed', language);
      
      if (isChromeiOS()) {
        errorDescription = language === 'he'
          ? `${error.message || "נכשל להתחבר"}. נסה לפתוח את האפליקציה ב-Safari.`
          : `${error.message || "Failed to sign in"}. Try opening this app in Safari.`;
      }
      
      toast({
        variant: "destructive",
        title: t('signin.error_title', language),
        description: errorDescription,
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  // PIN Login Handler - December 2025
  // NOTE: PIN login on SignIn page requires a trusted device token
  // Users must first authenticate with full credentials, then set up PIN in Settings
  const handlePinLogin = async (pin: string) => {
    if (!formData.email) {
      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'הזן כתובת אימייל תחילה' : 'Please enter your email first',
      });
      setPinError(language === 'he' ? 'הזן אימייל' : 'Enter email first');
      return;
    }

    // Check for server-issued trust token (generated via /api/pin-auth/generate-trust-token)
    const deviceTrustToken = localStorage.getItem('petwash_device_trust_token');
    if (!deviceTrustToken) {
      toast({
        variant: "destructive",
        title: language === 'he' ? 'מכשיר לא מהימן' : 'Device not trusted',
        description: language === 'he' 
          ? 'יש להתחבר תחילה עם סיסמה או Face ID כדי להפעיל קוד PIN'
          : 'Please sign in with password or Face ID first to enable PIN login',
      });
      setPinError(language === 'he' ? 'מכשיר לא מהימן' : 'Device not trusted');
      setPinMode(false);
      return;
    }

    try {
      setPinLoading(true);
      setPinError("");

      const response = await fetch(getApiUrl('/api/pin-auth/trusted-device-verify'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Device-Trust-Token': deviceTrustToken,
        },
        body: JSON.stringify({
          email: formData.email,
          pin,
          deviceId: localStorage.getItem('petwash_device_id') || `web-${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Sign in with custom token from backend
        await signInWithCustomToken(auth, data.token);
        
        trackEvent({
          action: 'pin_login_success',
          category: 'authentication',
          label: 'pin_code',
          language,
        });

        toast({
          title: language === 'he' ? 'התחברות הצליחה!' : 'Signed in!',
        });

        window.scrollTo(0, 0);
        navigatePostLogin();
      } else {
        setPinError(data.error || (language === 'he' ? 'קוד PIN שגוי' : 'Invalid PIN'));
        toast({
          variant: "destructive",
          title: language === 'he' ? 'שגיאה' : 'Error',
          description: data.error || (language === 'he' ? 'קוד PIN שגוי' : 'Invalid PIN'),
        });

        if (response.status === 401) {
          localStorage.removeItem('petwash_device_trust_token');
        }

        trackEvent({
          action: 'pin_login_error',
          category: 'authentication',
          label: data.error || 'invalid_pin',
          language,
        });
      }
    } catch (error: any) {
      logger.error("PIN login error:", error);
      setPinError(language === 'he' ? 'שגיאת התחברות' : 'Login error');
      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: error.message || (language === 'he' ? 'נכשל להתחבר' : 'Failed to sign in'),
      });
    } finally {
      setPinLoading(false);
    }
  };

  // PIN login requires a server-issued trust token (from /api/pin-auth/generate-trust-token)
  // This is separate from the client-side deviceTrust.ts which tracks 30-day device memory
  const isPinLoginAvailable = !!localStorage.getItem('petwash_device_trust_token');

  type SocialProvider = 'google' | 'apple' | 'facebook';
  type OAuthProvider = 'tiktok' | 'instagram';

  /**
   * Creates the backend session cookie after Firebase client auth succeeds.
   * If session creation fails, signs out the Firebase client immediately to
   * prevent split-brain state (Firebase says "logged in", backend says 401).
   * Throws on failure so callers can show a clear error to the user.
   */
  const createSessionOrSignOut = async (idToken: string, traceId?: string): Promise<void> => {
    const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken, ...(traceId ? { traceId } : {}) }),
    });
    if (!sessionResponse.ok) {
      logger.error(`[Auth] Session creation failed (${sessionResponse.status}) — signing out Firebase client to prevent split-brain state`);
      // Log before signOut — signOut may redirect and interrupt a subsequent fetch.
      logClientEvent('SESSION_CREATION_FAILED', {
        reason: `HTTP_${sessionResponse.status}`,
        traceId,
      });
      await auth.signOut();
      throw new Error(language === 'he' ? 'שגיאה ביצירת הפגישה. אנא נסה שוב.' : 'Session creation failed. Please try again.');
    }

    // Verify the cookie actually landed — guards against SameSite/domain mis-
    // configuration where the server returns 200 but the browser silently drops
    // the Set-Cookie. If /api/simple-auth/me returns 401, the session is hollow.
    try {
      const meResponse = await fetch(getApiUrl('/api/simple-auth/me'), {
        credentials: 'include',
      });
      if (meResponse.status === 401) {
        logger.error('[Auth] Session cookie did not land (me=401) — signing out to prevent split-brain state');
        logClientEvent('SESSION_CREATION_FAILED', {
          reason: 'COOKIE_NOT_RECEIVED',
          traceId,
        });
        await auth.signOut();
        throw new Error(language === 'he' ? 'הפגישה לא הוגדרה כראוי. אנא נסה שוב.' : 'Session could not be established. Please try again.');
      }
    } catch (meErr: any) {
      // Network failure on the verification call — do not block login.
      // We already confirmed the session POST succeeded; this is best-effort.
      if (meErr?.message?.includes('Session could not')) throw meErr;
      logger.warn('[Auth] Session verification call failed (non-blocking):', meErr);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    await performOAuthLogin(provider);
  };

  const handleExternalOAuth = async (provider: OAuthProvider) => {
    try {
      setSocialLoading(provider as any);
      const response = await fetch(getApiUrl(`/api/auth/social/${provider}/authorize`));
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({
          variant: 'destructive',
          title: language === 'he' ? 'שירות לא זמין' : 'Service unavailable',
          description: language === 'he' ? `התחברות עם ${provider} אינה זמינה כרגע` : `Sign in with ${provider} is not available yet`,
        });
      }
    } catch (err) {
      logger.error(`[Auth] ${provider} OAuth init failed:`, err);
      toast({
        variant: 'destructive',
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'אירעה שגיאה. אנא נסו שוב.' : 'An error occurred. Please try again.',
      });
    } finally {
      setSocialLoading(null);
    }
  };

  const performOAuthLogin = async (provider: SocialProvider) => {
    const traceId = 'AUTH-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    console.log('[Auth Trace]', { traceId, method: provider, device: getDeviceInfo().device, browser: getDeviceInfo().browser, timestamp: new Date().toISOString() });
    sessionStorage.setItem('pw_auth_trace', traceId);
    try {
      setSocialLoading(provider);
      
      let authProvider: import('firebase/auth').AuthProvider;
      switch (provider) {
        case 'apple':
          authProvider = createAppleProvider();
          break;
        case 'facebook':
          authProvider = createFacebookProvider();
          break;
        case 'google':
        default:
          authProvider = createGoogleProvider();
          break;
      }
      
      const deviceInfo = getDeviceInfo();
      logger.info('[Auth] Device info:', deviceInfo);
      
      const isReplitWebview = /Replit-Bonsai/i.test(navigator.userAgent);
      const isGenericWebview = /wv|WebView/i.test(navigator.userAgent) && !isReplitWebview;
      const isGmailInApp = /GSA\//i.test(navigator.userAgent);
      const isInstagramInApp = /Instagram/i.test(navigator.userAgent);
      const isTikTokInApp = /BytedanceWebview|musical_ly/i.test(navigator.userAgent);
      const isInAppBrowser = isGmailInApp || isInstagramInApp || isTikTokInApp || isGenericWebview;
      
      if (isReplitWebview) {
        logger.info(`[Auth] Replit webview detected - social login not supported, switching to phone mode`);
        setWebviewBlocked(true);
        setPhoneMode(true);
        setSocialLoading(null);
        return;
      }

      if (isInAppBrowser && provider === 'google') {
        logger.info(`[Auth] In-app browser detected - Google popup not supported, prompting to open in Safari`);
        setSocialLoading(null);
        toast({
          title: language === 'he' ? 'פתחו ב-Safari' : 'Open in Safari',
          description: language === 'he'
            ? 'להתחברות עם Google, פתחו את petwash.co.il בדפדפן Safari'
            : 'To sign in with Google, open petwash.co.il in Safari browser',
        });
        setPhoneMode(true);
        return;
      }

      let userCredential: import('firebase/auth').UserCredential | null = null;

      // Single canonical strategy resolver: iPhone → redirect, everything else → popup.
      // IMPORTANT: signInWithRedirect / signInWithPopup must be the immediate next call
      // after getAuthStrategy() — no awaits in between or Safari blocks the popup.
      const authStrategy = getAuthStrategy();
      if (authStrategy === 'redirect') {
        logger.info(`[Auth] iPhone detected — using redirect for ${provider}`);
        setRedirectMarker(provider);
        await signInWithRedirect(auth, authProvider);
        setSocialLoading(null);
        return;
      }

      logger.info(`[Auth] Using popup auth for ${provider} (strategy=popup, webview=${isGenericWebview})`);
      userCredential = await signInWithPopup(auth, authProvider);

      const additionalInfo = getAdditionalUserInfo(userCredential);
      const isNewUser = additionalInfo?.isNewUser || false;
      
      let grantedScopes: string[] = [];
      try {
        if (provider === 'google') {
          grantedScopes = GoogleAuthProvider.credentialFromResult(userCredential)?.accessToken ? ['email', 'profile'] : [];
        } else {
          grantedScopes = ['email', 'profile'];
        }
      } catch (scopeError) {
        logger.warn('Could not set OAuth scopes:', scopeError);
      }
      
      const idToken = await userCredential.user.getIdToken();
      await createSessionOrSignOut(idToken, traceId);

      if (isNewUser) {
        logger.info(`[Auth] New user via ${provider} - auto-enrolling in loyalty program`);
        try {
          await fetch(getApiUrl('/api/loyalty/auto-enroll'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              userId: userCredential.user.uid,
              email: userCredential.user.email,
              displayName: userCredential.user.displayName,
              provider,
              role: 'pet_parent',
            }),
          });
        } catch (loyaltyErr) {
          logger.warn('[Auth] Loyalty auto-enroll failed (non-blocking):', loyaltyErr);
        }
      }
      
      const consentRecord = {
        provider,
        timestamp: new Date().toISOString(),
        scopes: grantedScopes,
        userAgent: navigator.userAgent,
      };
      
      localStorage.setItem(`petwash_oauth_consent_${provider}`, JSON.stringify({
        ...consentRecord,
        userId: userCredential.user.uid,
        email: userCredential.user.email,
      }));
      
      try {
        const consentResponse = await fetch(getApiUrl('/api/consent/oauth'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(consentRecord),
        });
        
        if (!consentResponse.ok) {
          throw new Error(`Consent audit failed: ${consentResponse.status}`);
        }
      } catch (auditError) {
        logger.error('Failed to log OAuth consent audit:', auditError);
      }

      if (rememberDevice && userCredential.user.uid && userCredential.user.email) {
        trustDevice(userCredential.user.uid, userCredential.user.email);
        logger.info('Device trusted after social login');
      }
      
      storeLastAuthMethod('social');
      
      const { trackLogin } = await import('@/lib/analytics');
      trackLogin(provider, userCredential.user.uid);
      
      trackEvent({
        action: `${provider}_login`,
        category: 'authentication',
        label: `${provider}_success`,
        language,
      });
      
      toast({
        title: t('signin.successTitle', language),
        description: t('signin.redirecting', language),
      });

      if (customRedirect) { window.scrollTo(0, 0); navigate(customRedirect); }
      else { navigatePostLogin(); }
    } catch (error: any) {
      logger.error('[Auth Trace] Failed', { traceId, error: error?.code || error?.message });
      logger.error("Social login error:", error);
      
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }

      // Account collision: an account with this email already exists under a different sign-in method.
      // REAL FIX: extract the OAuth credential from the error, store it as pendingOAuthCredential,
      // pre-fill the user's email, and ask them to sign in with their existing method.
      // After they successfully sign in, linkWithCredential() merges both methods into ONE account.
      if (error.code === 'auth/account-exists-with-different-credential') {
        const collidingEmail: string = error.customData?.email || error.email || '';

        // Extract the OAuth credential so we can link it after the user signs in
        let extractedCred: OAuthCredential | null = null;
        try {
          if (provider === 'google') {
            extractedCred = GoogleAuthProvider.credentialFromError(error);
          } else {
            extractedCred = OAuthProvider.credentialFromError(error);
          }
        } catch (credErr) {
          logger.warn('[AccountLink] Could not extract credential from error', credErr);
        }

        if (extractedCred) {
          setPendingOAuthCredential(extractedCred);
          setPendingLinkProvider(provider);
        }
        if (collidingEmail) {
          setFormData(prev => ({ ...prev, email: collidingEmail }));
        }
        setPhoneMode(false);
        setMagicLinkMode(false);

        const providerLabel = provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Facebook';
        const linkMsg: Record<string, string> = {
          en: collidingEmail
            ? `You already have a PetWash account for ${collidingEmail}. Sign in with your password below — we'll automatically connect your ${providerLabel} account so you can use both.`
            : `You already have a PetWash account with this email. Sign in with your password to connect your ${providerLabel} account.`,
          he: collidingEmail
            ? `כבר יש לך חשבון PetWash עבור ${collidingEmail}. התחברו עם הסיסמה למטה — נחבר אוטומטית את חשבון ${providerLabel} שלכם כדי שתוכלו להשתמש בשניהם.`
            : `כבר יש לך חשבון PetWash עם האימייל הזה. התחברו עם הסיסמה כדי לחבר את חשבון ${providerLabel}.`,
          ar: collidingEmail
            ? `لديك حساب PetWash لـ ${collidingEmail}. سجّل الدخول بكلمة المرور أدناه وسنربط حسابك على ${providerLabel} تلقائياً.`
            : `لديك حساب PetWash بهذا البريد. سجّل الدخول بكلمة المرور لربط حساب ${providerLabel}.`,
        };

        toast({
          title: language === 'he' ? 'חבר את החשבונות' : language === 'ar' ? 'ربط الحسابات' : `Connect your ${providerLabel} account`,
          description: linkMsg[language] || linkMsg.en,
          duration: 10000,
        });
        trackEvent({ action: `${provider}_account_collision`, category: 'authentication', label: collidingEmail ? 'email_known' : 'email_unknown', language });
        setSocialLoading(null);
        return;
      }

      // Log non-user-cancelled popup/OAuth errors to auth_events for admin visibility.
      logClientEvent('OAUTH_POPUP_FAILED', {
        provider,
        reason: error?.code || error?.message || 'unknown',
        traceId,
      });
      
      const socialErrTitle: Record<string, string> = {
        en: 'Sign-in error', he: 'שגיאה בהתחברות', ar: 'خطأ في تسجيل الدخول',
        es: 'Error de inicio de sesión', fr: 'Erreur de connexion', ru: 'Ошибка входа',
      };
      const socialErrors: Record<string, Record<string, string>> = {
        'auth/popup-blocked': {
          en: 'Pop-up was blocked by your browser. Please allow pop-ups and try again.',
          he: 'החלון נחסם על ידי הדפדפן. אנא אפשרו חלונות קופצים ונסו שוב.',
          ar: 'تم حظر النافذة المنبثقة بواسطة المتصفح. يرجى السماح بها والمحاولة مرة أخرى.',
          es: 'La ventana emergente fue bloqueada por el navegador. Permita las ventanas emergentes e inténtelo de nuevo.',
          fr: 'Le pop-up a été bloqué par le navigateur. Veuillez autoriser les pop-ups et réessayer.',
          ru: 'Всплывающее окно заблокировано браузером. Разрешите всплывающие окна и попробуйте снова.',
        },
        'auth/unauthorized-domain': {
          en: 'This domain is not authorized for Google sign-in. Contact support.',
          he: 'דומיין זה אינו מורשה להתחברות עם Google. פנו לתמיכה.',
          ar: 'هذا النطاق غير مصرح به لتسجيل الدخول عبر Google. اتصل بالدعم.',
          es: 'Este dominio no está autorizado para iniciar sesión con Google. Contacte soporte.',
          fr: 'Ce domaine n\'est pas autorisé pour la connexion Google. Contactez le support.',
          ru: 'Этот домен не авторизован для входа через Google. Обратитесь в поддержку.',
        },
        'auth/network-request-failed': {
          en: /Replit-Bonsai/i.test(navigator.userAgent)
            ? 'Social login is not supported in the app preview. Tap "Open in browser" at the top right.'
            : 'Network error. Please check your connection and try again.',
          he: /Replit-Bonsai/i.test(navigator.userAgent)
            ? 'התחברות חברתית אינה נתמכת בתצוגה המקדימה. לחצו על "Open in browser" בפינה הימנית העליונה.'
            : 'שגיאת רשת. בדקו את החיבור שלכם ונסו שוב.',
          ar: 'خطأ في الشبكة. يرجى التحقق من اتصالك والمحاولة مرة أخرى.',
          es: 'Error de red. Verifique su conexión e inténtelo de nuevo.',
          fr: 'Erreur réseau. Vérifiez votre connexion et réessayez.',
          ru: 'Ошибка сети. Проверьте подключение и попробуйте снова.',
        },
        'auth/internal-error': {
          en: 'An internal error occurred. Please try again later.',
          he: 'אירעה שגיאה פנימית. אנא נסו שוב מאוחר יותר.',
          ar: 'حدث خطأ داخلي. يرجى المحاولة لاحقًا.',
          es: 'Ocurrió un error interno. Inténtelo más tarde.',
          fr: 'Une erreur interne s\'est produite. Veuillez réessayer plus tard.',
          ru: 'Произошла внутренняя ошибка. Попробуйте позже.',
        },
        'auth/account-exists-with-different-credential': {
          en: 'An account already exists with the same email but different sign-in method.',
          he: 'כבר קיים חשבון עם אותו אימייל אך שיטת התחברות שונה.',
          ar: 'يوجد حساب بنفس البريد الإلكتروني ولكن بطريقة تسجيل دخول مختلفة.',
          es: 'Ya existe una cuenta con el mismo correo pero un método de inicio de sesión diferente.',
          fr: 'Un compte existe déjà avec le même e-mail mais une méthode de connexion différente.',
          ru: 'Аккаунт с таким email уже существует, но с другим методом входа.',
        },
        'auth/user-cancelled': {
          en: 'Sign-in was cancelled. Please try again.',
          he: 'ההתחברות בוטלה. אנא נסו שוב.',
          ar: 'تم إلغاء تسجيل الدخول. يرجى المحاولة مرة أخرى.',
          es: 'El inicio de sesión fue cancelado. Inténtelo de nuevo.',
          fr: 'La connexion a été annulée. Veuillez réessayer.',
          ru: 'Вход был отменён. Попробуйте снова.',
        },
        'auth/cancelled-popup-request': {
          en: 'The sign-in window was closed. Please try again.',
          he: 'חלון ההתחברות נסגר. אנא נסו שוב.',
          ar: 'تم إغلاق نافذة تسجيل الدخول. يرجى المحاولة مرة أخرى.',
          es: 'La ventana de inicio de sesión se cerró. Inténtelo de nuevo.',
          fr: 'La fenêtre de connexion a été fermée. Veuillez réessayer.',
          ru: 'Окно входа было закрыто. Попробуйте снова.',
        },
        'auth/too-many-requests': {
          en: 'Too many attempts. Please wait a few minutes before trying again.',
          he: 'יותר מדי ניסיונות. אנא המתינו כמה דקות לפני הניסיון הבא.',
          ar: 'محاولات كثيرة جداً. يرجى الانتظار بضع دقائق قبل المحاولة مرة أخرى.',
          es: 'Demasiados intentos. Espere unos minutos antes de intentarlo de nuevo.',
          fr: 'Trop de tentatives. Veuillez attendre quelques minutes avant de réessayer.',
          ru: 'Слишком много попыток. Подождите несколько минут перед повторной попыткой.',
        },
      };
      const defaultSocialErr: Record<string, string> = {
        en: 'Sign-in with Google failed. Please try again.',
        he: 'ההתחברות עם Google נכשלה. אנא נסו שוב.',
        ar: 'فشل تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.',
        es: 'El inicio de sesión con Google falló. Inténtelo de nuevo.',
        fr: 'La connexion avec Google a échoué. Veuillez réessayer.',
        ru: 'Вход через Google не удался. Попробуйте снова.',
      };

      const errMsg = socialErrors[error.code]?.[language] || socialErrors[error.code]?.en || defaultSocialErr[language] || defaultSocialErr.en;
      
      toast({
        variant: "destructive",
        title: socialErrTitle[language] || socialErrTitle.en,
        description: errMsg,
      });

      trackEvent({
        action: `${provider}_login_error`,
        category: 'authentication',
        label: error.code || 'unknown_error',
        language,
      });
    } finally {
      setSocialLoading(null);
    }
  };

  const phoneErrTitle: Record<string, string> = {
    en: 'Error', he: 'שגיאה', ar: 'خطأ', es: 'Error', fr: 'Erreur', ru: 'Ошибка',
  };
  const phoneInvalidNum: Record<string, string> = {
    en: 'Please enter a valid phone number',
    he: 'הזינו מספר טלפון תקין',
    ar: 'يرجى إدخال رقم هاتف صالح',
    es: 'Ingrese un número de teléfono válido',
    fr: 'Veuillez entrer un numéro de téléphone valide',
    ru: 'Введите действительный номер телефона',
  };
  const phoneCodeSentTitle: Record<string, string> = {
    en: 'Code Sent', he: 'קוד נשלח', ar: 'تم إرسال الرمز', es: 'Código Enviado', fr: 'Code Envoyé', ru: 'Код Отправлен',
  };
  const phoneCodeSentDesc: Record<string, string> = {
    en: 'Check your SMS messages',
    he: 'בדקו את הודעות ה-SMS שלכם',
    ar: 'تحقق من رسائل SMS الخاصة بك',
    es: 'Revise sus mensajes SMS',
    fr: 'Vérifiez vos messages SMS',
    ru: 'Проверьте ваши SMS сообщения',
  };
  const phoneCodeFail: Record<string, string> = {
    en: 'Failed to send verification code. Please try again.',
    he: 'שליחת קוד האימות נכשלה. אנא נסו שוב.',
    ar: 'فشل في إرسال رمز التحقق. يرجى المحاولة مرة أخرى.',
    es: 'Error al enviar el código de verificación. Inténtelo de nuevo.',
    fr: 'Échec de l\'envoi du code de vérification. Veuillez réessayer.',
    ru: 'Не удалось отправить код подтверждения. Попробуйте снова.',
  };
  const phoneVerifyFail: Record<string, string> = {
    en: 'Verification failed. Please check your code and try again.',
    he: 'האימות נכשל. בדקו את הקוד ונסו שוב.',
    ar: 'فشل التحقق. يرجى التحقق من الرمز والمحاولة مرة أخرى.',
    es: 'La verificación falló. Revise el código e inténtelo de nuevo.',
    fr: 'La vérification a échoué. Vérifiez le code et réessayez.',
    ru: 'Верификация не удалась. Проверьте код и попробуйте снова.',
  };
  const phoneEnter6Digit: Record<string, string> = {
    en: 'Enter 6-digit verification code',
    he: 'הזינו קוד אימות בן 6 ספרות',
    ar: 'أدخل رمز التحقق المكون من 6 أرقام',
    es: 'Ingrese el código de verificación de 6 dígitos',
    fr: 'Entrez le code de vérification à 6 chiffres',
    ru: 'Введите 6-значный код подтверждения',
  };
  const phoneSendFirst: Record<string, string> = {
    en: 'Send verification code first',
    he: 'שלחו קוד אימות קודם',
    ar: 'أرسل رمز التحقق أولاً',
    es: 'Envíe el código de verificación primero',
    fr: 'Envoyez d\'abord le code de vérification',
    ru: 'Сначала отправьте код подтверждения',
  };

  // Phone Auth Handlers - Twilio SMS Verification
  const handleSendPhoneCode = async () => {
    // Normalize Israeli local format (05X → +9725X) before validation
    let normalizedPhone = normalizePhoneE164(phoneNumber);
    if (normalizedPhone !== phoneNumber.trim()) {
      setPhoneNumber(normalizedPhone);
    }
    if (!normalizedPhone || normalizedPhone.length < 8) {
      toast({
        variant: "destructive",
        title: phoneErrTitle[language] || phoneErrTitle.en,
        description: phoneInvalidNum[language] || phoneInvalidNum.en,
      });
      return;
    }

    setPhoneLoading(true);
    try {
      const formattedPhone = normalizedPhone;

      logger.info('[PhoneAuth] Sending code to:', formattedPhone);

      // ── Best-effort captcha (non-blocking) ───────────────────────────────────
      // Security for phone OTP is: rate limiting + phone lockout + daily SMS cap + the OTP itself.
      // Captcha is bonus signal. Backend never blocks on captcha failure for phone send-code.
      let turnstileToken: string | null = null;
      let freshCaptchaToken: string | null = null;

      turnstileToken = await executeTurnstileInvisible('phone_login');
      if (turnstileToken) {
        logger.info('[PhoneAuth] Turnstile token obtained', { tokenLength: turnstileToken.length, phone: formattedPhone.slice(-4) });
      } else {
        logger.warn('[PhoneAuth] Turnstile unavailable, trying reCAPTCHA', { phone: formattedPhone.slice(-4) });
        freshCaptchaToken = await executeReCaptcha('phone_login').catch(() => null);
        if (freshCaptchaToken) {
          logger.info('[PhoneAuth] reCAPTCHA token obtained', { tokenLength: freshCaptchaToken.length, phone: formattedPhone.slice(-4) });
        } else {
          logger.warn('[PhoneAuth] Both Turnstile and reCAPTCHA unavailable — proceeding without captcha token (rate-limit protection active)');
        }
      }

      const response = await fetch(getApiUrl('/api/auth/phone/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: formattedPhone,
          language,
          ...(turnstileToken ? { turnstileToken } : { captchaToken: freshCaptchaToken }),
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || result.message || (phoneCodeFail[language] || phoneCodeFail.en));
      }

      setConfirmationResult({ phone: formattedPhone });

      toast({
        title: phoneCodeSentTitle[language] || phoneCodeSentTitle.en,
        description: phoneCodeSentDesc[language] || phoneCodeSentDesc.en,
      });

      trackEvent({
        action: 'phone_code_sent',
        category: 'authentication',
        label: 'phone_sms_sent',
        language,
      });
    } catch (error: any) {
      logger.error('[PhoneAuth] Failed to send code:', error);

      toast({
        variant: "destructive",
        title: phoneErrTitle[language] || phoneErrTitle.en,
        description: error.message || (phoneCodeFail[language] || phoneCodeFail.en),
      });

      trackEvent({
        action: 'phone_code_error',
        category: 'authentication',
        label: 'twilio_error',
        language,
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneCode = async (codeOverride?: string) => {
    const code = codeOverride ?? verificationCode;
    if (!code || code.length < 6) {
      toast({
        variant: "destructive",
        title: phoneErrTitle[language] || phoneErrTitle.en,
        description: phoneEnter6Digit[language] || phoneEnter6Digit.en,
      });
      return;
    }

    if (!confirmationResult?.phone) {
      toast({
        variant: "destructive",
        title: phoneErrTitle[language] || phoneErrTitle.en,
        description: phoneSendFirst[language] || phoneSendFirst.en,
      });
      return;
    }

    setPhoneLoading(true);
    try {
      // Verify code with Twilio
      const verifyResponse = await fetch(getApiUrl('/api/auth/phone/verify-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          phone: confirmationResult.phone, 
          code,
          language 
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.ok) {
        throw new Error(verifyResult.error || 'Verification failed');
      }

      // Create phone session using verification token
      const sessionResponse = await fetch(getApiUrl('/api/auth/phone-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verificationToken: verifyResult.verificationToken }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }

      const sessionData = await sessionResponse.json();

      if (sessionData.customToken) {
        logger.info('[PhoneAuth] Signing into Firebase with custom token');
        const userCredential = await signInWithCustomToken(auth, sessionData.customToken);
        const idToken = await userCredential.user.getIdToken(true);
        logger.info('[PhoneAuth] Firebase client auth state set successfully');
        await createSessionOrSignOut(idToken);
        logger.info('[PhoneAuth] Server session cookie set');
      }

      if (sessionData.userId) {
        trustDevice(sessionData.userId, confirmationResult.phone);
        storeLastAuthMethod('social');
        logger.info('Device trusted after phone login');
      }
      
      const { trackLogin } = await import('@/lib/analytics');
      trackLogin('phone', sessionData.userId || confirmationResult.phone);

      trackEvent({
        action: 'phone_login_success',
        category: 'authentication',
        label: 'phone_verified',
        language,
      });

      toast({
        title: t('signin.successTitle', language),
        description: t('signin.redirecting', language),
      });

      setPhoneMode(false);
      setPhoneNumber('');
      setVerificationCode('');
      setConfirmationResult(null);

      window.scrollTo(0, 0);
      navigatePostLogin();
    } catch (error: any) {
      logger.error('[PhoneAuth] Verification failed:', error);

      toast({
        variant: "destructive",
        title: phoneErrTitle[language] || phoneErrTitle.en,
        description: error.message || (phoneVerifyFail[language] || phoneVerifyFail.en),
      });

      trackEvent({
        action: 'phone_verify_error',
        category: 'authentication',
        label: 'twilio_error',
        language,
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Best-effort reCAPTCHA — non-blocking.
      // Security is maintained by Firebase identity verification (server verifies
      // the ID token) + server-side rate limiting. If reCAPTCHA is unavailable
      // (missing site key, ad blocker, network issue) we proceed without it rather
      // than permanently locking out real users. The server accepts a null/missing
      // captchaToken for authenticated Firebase sessions.
      const captchaToken = await executeReCaptcha('login').catch(() => null);
      if (!captchaToken) {
        logger.warn('[SignIn] executeReCaptcha unavailable — proceeding without captcha token (Firebase auth + rate limiting remain active)');
      }
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      
      const idToken = await userCredential.user.getIdToken();
      const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, captchaToken, signInMethod: 'email' }),
      });

      if (!sessionResponse.ok) {
        const errBody = await sessionResponse.json().catch(() => ({}));
        if (errBody?.errorCode === 'STEP_UP_REQUIRED') {
          if (TURNSTILE_CONFIGURED) {
            setPendingSignInIdToken(idToken);
            setPendingSignInCaptchaToken(captchaToken);
            setPendingSignInUid(userCredential.user.uid);
            setSignInStepUpPending(true);
          } else {
            toast({ variant: 'destructive', title: language === 'he' ? 'נדרש אימות נוסף' : 'Additional verification required', description: language === 'he' ? 'הגישה שלך נראית חריגה. נסה להתחבר עם מספר הטלפון, או נסה מרשת אחרת.' : 'Your connection looks unusual. Try signing in with your phone number, or switch to a different network.' });
          }
          setLoading(false);
          return;
        }
        throw new Error('Failed to create session');
      }

      // ── Account linking: if a social OAuth credential is pending, link it now ──
      // This makes Google/Apple/Facebook sign-in work for users who originally
      // signed up with email/password — one account, multiple login methods.
      if (pendingOAuthCredential) {
        try {
          await linkWithCredential(userCredential.user, pendingOAuthCredential);
          const linkedProviderLabel = pendingLinkProvider === 'google' ? 'Google' : pendingLinkProvider === 'apple' ? 'Apple' : 'Facebook';
          toast({
            title: language === 'he' ? `חשבון ${linkedProviderLabel} חובר בהצלחה` : `${linkedProviderLabel} connected`,
            description: language === 'he'
              ? `מעכשיו תוכלו להתחבר עם ${linkedProviderLabel} או עם הסיסמה שלכם.`
              : `You can now sign in with either ${linkedProviderLabel} or your password.`,
          });
          logger.info(`[AccountLink] Successfully linked ${pendingLinkProvider} to ${userCredential.user.uid}`);
          trackEvent({ action: `account_linked_${pendingLinkProvider}`, category: 'authentication', label: 'link_success', language });
        } catch (linkErr: any) {
          // Linking can fail if the credential was already linked — this is harmless
          logger.warn('[AccountLink] linkWithCredential failed (may already be linked):', linkErr?.code);
        }
        setPendingOAuthCredential(null);
        setPendingLinkProvider(null);
      }

      if (rememberDevice && userCredential.user.uid && userCredential.user.email) {
        trustDevice(userCredential.user.uid, userCredential.user.email);
        logger.info('Device trusted after email/password login');
      }
      
      storeLastAuthMethod('password');
      
      const { trackLogin } = await import('@/lib/analytics');
      trackLogin('email', userCredential.user.uid);
      
      trackEvent({
        action: 'email_login',
        category: 'authentication',
        label: 'email_success',
        language,
      });

      toast({
        title: t('signin.successTitle', language),
        description: t('signin.redirecting', language),
      });

      setPasswordFailureCount(0);
      
      window.scrollTo(0, 0);
      navigatePostLogin();
    } catch (error: any) {
      logger.error("Email/password sign-in error:", error);
      
      setPasswordFailureCount(prev => prev + 1);
      
      let errorMessage = t('signin.failed', language);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        const noAccountMsg: Record<string, string> = {
          en: 'No account found with this email. Redirecting to sign up...',
          he: 'לא נמצא חשבון עם כתובת דואר אלקטרוני זו. מעביר להרשמה...',
          ar: 'لم يتم العثور على حساب بهذا البريد الإلكتروني. جاري التحويل للتسجيل...',
          es: 'No se encontró una cuenta con este correo. Redirigiendo al registro...',
          fr: 'Aucun compte trouvé avec cet email. Redirection vers l\'inscription...',
          ru: 'Аккаунт с этим email не найден. Перенаправление на регистрацию...',
        };
        toast({
          title: t('signin.error', language),
          description: noAccountMsg[language] || noAccountMsg.en,
        });
        setTimeout(() => {
          navigate(`/signup?email=${encodeURIComponent(formData.email)}`);
        }, 1500);
        return;
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = t('signin.invalidCredentials', language);
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = t('signin.tooManyAttempts', language);
      }
      
      toast({
        variant: "destructive",
        title: t('signin.error', language),
        description: errorMessage,
      });

      trackEvent({
        action: 'email_login_error',
        category: 'authentication',
        label: error.code || 'unknown_error',
        language,
      });

      trackAuthError({
        errorCode: error.code,
        errorMessage: error.message,
        authMethod: 'email',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTurnstileSignInVerify = async (turnstileToken: string) => {
    if (!pendingSignInIdToken || !pendingSignInCaptchaToken) return;
    const storedIdToken = pendingSignInIdToken;
    const storedCaptchaToken = pendingSignInCaptchaToken;
    const storedUid = pendingSignInUid;
    setSignInStepUpPending(false);
    setPendingSignInIdToken(null);
    setPendingSignInCaptchaToken(null);
    setPendingSignInUid(null);
    setLoading(true);
    try {
      const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken: storedIdToken, captchaToken: storedCaptchaToken, turnstileToken, signInMethod: 'email' }),
      });
      if (!sessionResponse.ok) {
        toast({ variant: 'destructive', title: language === 'he' ? 'אימות נכשל' : 'Verification failed', description: language === 'he' ? 'נסה שוב.' : 'Please try again.' });
        return;
      }
      if (rememberDevice && storedUid && formData.email) {
        trustDevice(storedUid, formData.email);
      }
      storeLastAuthMethod('password');
      const { trackLogin } = await import('@/lib/analytics');
      if (storedUid) trackLogin('email', storedUid);
      toast({ title: t('signin.successTitle', language), description: t('signin.redirecting', language) });
      setPasswordFailureCount(0);
      window.scrollTo(0, 0);
      navigatePostLogin();
    } catch (err: any) {
      logger.error('[SignIn] Turnstile session retry failed', { error: err.message });
      toast({ variant: 'destructive', title: language === 'he' ? 'שגיאה בהתחברות' : 'Sign in error', description: language === 'he' ? 'נסה שוב.' : 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (magicLinkResendCountdown > 0) {
      toast({
        variant: "destructive",
        title: t('signin.pleaseWait', language),
        description: t('signin.waitBeforeResend', language).replace('{seconds}', magicLinkResendCountdown.toString()),
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const actionCodeSettings = {
        url: window.location.origin + '/signin',
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, formData.email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', formData.email);
      
      setMagicLinkSent(true);
      setMagicLinkResendCountdown(60);
      
      toast({
        title: t('signin.magicLinkSent', language),
        description: t('signin.checkEmailClick', language),
      });

      trackEvent({
        action: 'magic_link_sent',
        category: 'authentication',
        label: 'magic_link_success',
        language,
      });
    } catch (error: any) {
      logger.error("Magic link error:", error);
      
      toast({
        variant: "destructive",
        title: t('signin.error_title', language),
        description: error.message || t('signin.failedSendLink', language),
      });

      trackEvent({
        action: 'magic_link_error',
        category: 'authentication',
        label: error.code || 'unknown_error',
        language,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, formData.email);
      
      setPasswordResetSent(true);
      
      toast({
        title: t('signin.resetEmailSent', language),
        description: t('signin.checkEmailInstructions', language),
      });

      trackEvent({
        action: 'password_reset_sent',
        category: 'authentication',
        label: 'password_reset_success',
        language,
      });
    } catch (error: any) {
      logger.error("Password reset error:", error);
      
      toast({
        variant: "destructive",
        title: t('signin.error_title', language),
        description: error.message || t('signin.failedSendEmail', language),
      });

      trackEvent({
        action: 'password_reset_error',
        category: 'authentication',
        label: error.code || 'unknown_error',
        language,
      });
    } finally {
      setLoading(false);
    }
  };

  // Show auto Face ID loading state
  if (autoFaceID.isLoading && !forcePasswordMode) {
    return <FaceIDLoadingState state={autoFaceID.state} message={autoFaceID.message} language={language} onUsePasswordInstead={handleUsePasswordInstead} />;
  }

  // Show already logged in state
  if (user && !switchingAccount) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c9a96e, #d4af37)' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-[#1A1A1A]">
              {t('auth.signedInAs', language)}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => navigatePostLogin()}
              className="text-white rounded-full px-8"
              style={{ background: 'linear-gradient(90deg, #c9a96e, #d4af37)' }}
              data-testid="button-go-to-dashboard"
            >
              {t('auth.goToDashboard', language)}
            </Button>
            <Button
              onClick={handleSwitchAccount}
              variant="ghost"
              className="text-black hover:bg-white rounded-full px-8"
              data-testid="button-switch-account"
            >
              {t('auth.switchAccount', language)}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white">
        <div className="flex flex-col items-center px-4 sm:px-6 md:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg lg:max-w-xl"
        >
          <div className="bg-white space-y-6 relative border border-neutral-900 shadow-[0_4px_24px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="bg-black px-6 sm:px-10 lg:px-12 pt-5 pb-4 flex items-center justify-between">
            <div />
            <div className="flex-1 text-center">
              <h1 className="text-lg sm:text-xl font-light tracking-[0.2em] text-white uppercase" style={{ fontFamily: "'Cormorant Garamond','Playfair Display',serif" }}>
                <span dir="ltr">PetWash™</span>
              </h1>
            </div>
            <button
              onClick={() => navigatePostLogin()}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              aria-label={t('common.close', language)}
              data-testid="button-close-signin"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
          <div className="px-6 sm:px-10 lg:px-12 pb-6 sm:pb-10 lg:pb-12 space-y-6 relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center space-y-1 pt-2"
          >
            <h2 className="text-xl sm:text-2xl font-light tracking-wide text-neutral-900 uppercase" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", letterSpacing: '0.12em' }}>
              {t('signin.welcomeBack', language)}
            </h2>
            <p className="text-neutral-600 text-xs tracking-wider uppercase" style={{ letterSpacing: '0.1em' }}>
              {t('signin.signInContinue', language)}
            </p>
          </motion.div>

          {magicLinkEmailNeeded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 border border-neutral-200 p-6 bg-white"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-neutral-800 uppercase tracking-wider">
                  {language === 'he' ? 'אמת את כתובת האימייל שלך' : 'Confirm your email address'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {language === 'he'
                    ? 'הזן את כתובת האימייל שממנה שלחת את קישור הכניסה'
                    : 'Enter the email address you used to request the magic link'}
                </p>
              </div>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={language === 'he' ? 'כתובת אימייל' : 'Email address'}
                value={magicLinkEmailInput}
                onChange={(e) => setMagicLinkEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMagicLinkEmailSubmit(); }}
                className="h-12 text-sm rounded-none border border-neutral-300 bg-white focus:border-neutral-900 focus:ring-0"
                dir="ltr"
                disabled={loading}
              />
              <Button
                type="button"
                onClick={handleMagicLinkEmailSubmit}
                disabled={loading || !magicLinkEmailInput.trim()}
                className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase border-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'he' ? 'אמת והתחבר' : 'Verify & Sign In')}
              </Button>
              <button
                type="button"
                onClick={() => { setMagicLinkEmailNeeded(false); setMagicLinkHref(''); setMagicLinkEmailInput(''); }}
                className="w-full text-xs text-neutral-500 hover:text-neutral-800 tracking-wider uppercase py-1"
              >
                {language === 'he' ? 'ביטול' : 'Cancel'}
              </button>
            </motion.div>
          )}

          {!selectedIntent && !user && !magicLinkEmailNeeded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-3"
            >
              <p className="text-center text-xs text-neutral-500 tracking-wider uppercase mb-4">
                {language === 'he' ? 'משתמשים חדשים — בחרו כיצד תרצו להשתמש בפלטפורמה' : 'New users — choose how you\'d like to use the platform'}
              </p>
              <button
                onClick={() => handleSelectIntent('customer')}
                className="w-full text-left p-4 border border-neutral-200 hover:border-neutral-400 bg-white hover:shadow-sm transition-all flex items-center gap-4"
                data-testid="intent-customer"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{language === 'he' ? 'הזמנת שירותים' : 'Book Services'}</p>
                  <p className="text-xs text-neutral-500">{language === 'he' ? 'שטיפה, טיפוח, שמרטפות, הולכת כלבים' : 'Washing, grooming, pet sitting, dog walking'}</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectIntent('loyalty')}
                className="w-full text-left p-4 border border-neutral-200 hover:border-neutral-400 bg-white hover:shadow-sm transition-all flex items-center gap-4"
                data-testid="intent-loyalty"
              >
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{language === 'he' ? 'הצטרפות למועדון' : 'Join Rewards Club'}</p>
                  <p className="text-xs text-neutral-500">{language === 'he' ? 'נקודות, הטבות, מתנות' : 'Points, perks, rewards'}</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectIntent('provider')}
                className="w-full text-left p-4 border border-neutral-200 hover:border-neutral-400 bg-white hover:shadow-sm transition-all flex items-center gap-4"
                data-testid="intent-provider"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{language === 'he' ? 'הפוך לנותן שירות' : 'Become a Provider'}</p>
                  <p className="text-xs text-neutral-500">{language === 'he' ? 'הרוויחו כשמרטף/ית, מטייל/ת, מפעיל/ת' : 'Earn as sitter, walker, or operator'}</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectIntent('staff')}
                className="w-full text-left p-4 border border-neutral-200 hover:border-neutral-400 bg-white hover:shadow-sm transition-all flex items-center gap-4"
                data-testid="intent-staff"
              >
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{language === 'he' ? 'צוות / ניהול' : 'Staff / Admin Access'}</p>
                  <p className="text-xs text-neutral-500">{language === 'he' ? 'גישת עובדים (דורש אישור)' : 'Employee access (requires approval)'}</p>
                </div>
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-1 border-t border-neutral-200" />
                <span className="px-3 text-xs text-neutral-500 tracking-wider uppercase">
                  {language === 'he' ? 'או' : 'or'}
                </span>
                <div className="flex-1 border-t border-neutral-200" />
              </div>
              <button
                onClick={() => handleSelectIntent('customer')}
                className="w-full text-center py-3 text-sm text-neutral-600 hover:text-neutral-900 tracking-wide transition-colors underline underline-offset-4"
                data-testid="intent-existing-user"
              >
                {language === 'he' ? 'כבר רשום? התחבר לחשבון קיים' : 'Already have an account? Sign in'}
              </button>

              {/* Social sign-in buttons visible immediately for returning users */}
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-neutral-200" />
                <span className="px-3 text-xs text-neutral-400 tracking-wider uppercase">
                  {language === 'he' ? 'כניסה מהירה' : 'Quick sign-in'}
                </span>
                <div className="flex-1 border-t border-neutral-200" />
              </div>
              <Button
                onClick={() => { handleSelectIntent('customer'); handleSocialLogin('google'); }}
                disabled={!!socialLoading}
                variant="outline"
                className="w-full h-12 text-sm font-medium border border-neutral-200 bg-white hover:bg-white text-neutral-800 rounded-none tracking-wider uppercase transition-all"
                data-testid="button-gmail-signin-quick"
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4 me-3 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>{t('signin.continueGmail', language)}</span>
                  </>
                )}
              </Button>
              <Button
                onClick={() => { handleSelectIntent('customer'); handleSocialLogin('apple'); }}
                disabled={!!socialLoading}
                variant="outline"
                className="w-full h-12 text-sm font-medium border border-neutral-300 bg-white hover:bg-white text-neutral-900 rounded-none tracking-wider uppercase transition-all"
                data-testid="button-apple-signin-quick"
              >
                {socialLoading === 'apple' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4 me-3 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.539 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                    </svg>
                    <span>{language === 'he' ? 'המשך עם Apple' : 'Continue with Apple'}</span>
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {selectedIntent && !user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between"
            >
              <button
                onClick={() => { setSelectedIntent(null); localStorage.removeItem('signup_intent'); }}
                className="text-xs text-neutral-600 hover:text-neutral-900 tracking-wider uppercase transition-colors flex items-center gap-1"
                data-testid="button-change-intent"
              >
                <ArrowLeft className="w-3 h-3" />
                {language === 'he' ? 'שנה בחירה' : 'Change selection'}
              </button>
              <span className="text-xs text-neutral-400 tracking-wider uppercase">
                {selectedIntent === 'customer' ? (language === 'he' ? 'הזמנת שירותים' : 'Book Services') :
                 selectedIntent === 'loyalty' ? (language === 'he' ? 'מועדון לקוחות' : 'Rewards Club') :
                 selectedIntent === 'provider' ? (language === 'he' ? 'נותן שירות' : 'Provider') :
                 (language === 'he' ? 'צוות' : 'Staff')}
              </span>
            </motion.div>
          )}

          {selectedIntent && webviewBlocked && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3"
            >
              <Alert className="border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  {language === 'he' 
                    ? 'התחברות עם Gmail/Apple/Facebook דורשת דפדפן מלא (Safari/Chrome). השתמשו בהתחברות עם מספר טלפון למטה.'
                    : 'Gmail/Apple/Facebook login requires a full browser (Safari/Chrome). Use phone number login below.'}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {selectedIntent && (<motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-3"
          >
            <Button
              onClick={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-white hover:bg-white text-neutral-800 rounded-none tracking-wider uppercase transition-all"
              data-testid="button-gmail-signin"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4 me-3 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>{t('signin.continueGmail', language)}</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => handleSocialLogin('apple')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-300 bg-white hover:bg-white text-neutral-900 rounded-none tracking-wider uppercase transition-all"
              data-testid="button-apple-signin"
            >
              {socialLoading === 'apple' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4 me-3 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.539 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                  </svg>
                  <span>{language === 'he' ? 'המשך עם Apple' : 'Continue with Apple'}</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => handleSocialLogin('facebook')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-none tracking-wider uppercase transition-all"
              data-testid="button-facebook-signin"
            >
              {socialLoading === 'facebook' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <SiFacebook className="w-4 h-4 me-3" />
                  <span>{language === 'he' ? 'המשך עם Facebook' : 'Continue with Facebook'}</span>
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 h-12 flex items-center justify-center gap-2 text-xs font-medium border border-neutral-200 bg-white text-neutral-400 rounded-none tracking-wider uppercase cursor-not-allowed"
                data-testid="button-tiktok-coming-soon"
              >
                <SiTiktok className="w-3.5 h-3.5" />
                <span>TikTok</span>
                <span className="text-[9px] bg-neutral-200 text-neutral-500 px-1 py-0.5 rounded">{language === 'he' ? 'בקרוב' : 'Soon'}</span>
              </button>
              <button
                disabled
                className="flex-1 h-12 flex items-center justify-center gap-2 text-xs font-medium border border-neutral-200 bg-white text-neutral-400 rounded-none tracking-wider uppercase cursor-not-allowed"
                data-testid="button-instagram-coming-soon"
              >
                <SiInstagram className="w-3.5 h-3.5" />
                <span>Instagram</span>
                <span className="text-[9px] bg-neutral-200 text-neutral-500 px-1 py-0.5 rounded">{language === 'he' ? 'בקרוב' : 'Soon'}</span>
              </button>
            </div>

            {passkeyAvailable && (
              <Button
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="w-full h-13 text-sm font-medium text-white rounded-none tracking-wider uppercase transition-all border-0"
                style={{ background: 'linear-gradient(135deg, #B8941F, #D4AF37)' }}
                data-testid="button-passkey-signin"
              >
                {passkeyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {/Android/.test(navigator.userAgent) ? (
                      <Fingerprint className="w-4 h-4 me-3" />
                    ) : (
                      <ScanFace className="w-4 h-4 me-3" />
                    )}
                    {getBiometricButtonLabel(language)}
                  </>
                )}
              </Button>
            )}

            {isPinLoginAvailable && (
              <Button
                onClick={() => setPinMode(true)}
                variant="outline"
                className="w-full h-13 text-sm font-medium border border-neutral-200 bg-white hover:bg-white text-neutral-700 rounded-none tracking-wider uppercase transition-all"
                data-testid="button-pin-signin"
              >
                <KeyRound className="w-4 h-4 me-3 text-neutral-500" />
                {language === 'he' ? 'התחבר עם קוד PIN' : 'Sign in with PIN'}
              </Button>
            )}

            <Button
              onClick={() => setPhoneMode(true)}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-white hover:bg-white text-neutral-700 rounded-none tracking-wider uppercase transition-all"
              data-testid="button-phone-signin"
            >
              <Phone className="w-4 h-4 me-3 text-neutral-500" />
              <span>{language === 'he' ? 'התחבר עם טלפון' : 'Sign in with Phone'}</span>
            </Button>

          </motion.div>)}

          {selectedIntent && (<motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-white text-neutral-500 uppercase tracking-widest">
                {t('signin.or', language)}
              </span>
            </div>
          </motion.div>)}

          {selectedIntent && pinMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-5"
            >
              <div>
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="username webauthn"
                  className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all"
                  data-testid="input-pin-email"
                />
              </div>
              
              <div className="bg-white border border-neutral-200 p-6">
                <h3 className="text-center text-sm font-medium mb-4 text-neutral-800 uppercase tracking-wider">
                  {language === 'he' ? 'הזן קוד PIN' : 'Enter your PIN'}
                </h3>
                <PinKeypad 
                  onComplete={handlePinLogin}
                  onCancel={() => {
                    setPinMode(false);
                    setPinError("");
                  }}
                  language={language as 'en' | 'he'}
                  loading={pinLoading}
                  error={pinError}
                />
              </div>

              <Button
                type="button"
                onClick={() => {
                  setPinMode(false);
                  setPinError("");
                }}
                variant="ghost"
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-white rounded-none transition-all tracking-wider uppercase"
                data-testid="button-back-from-pin"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                {language === 'he' ? 'חזור להתחברות רגילה' : 'Back to regular sign in'}
              </Button>
            </motion.div>
          )}

          {selectedIntent && phoneMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-5"
            >
              <div className="bg-white border border-neutral-200 p-6 space-y-4">
                <h3 className="text-center text-sm font-medium text-neutral-800 uppercase tracking-wider">
                  {language === 'he' ? 'התחבר עם טלפון' : 'Sign in with Phone'}
                </h3>
                
                {!confirmationResult ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-neutral-500 uppercase tracking-wider">
                        {language === 'he' ? 'מספר טלפון' : 'Phone Number'}
                      </Label>
                      <PhoneInput
                        value={phoneNumber}
                        onChange={setPhoneNumber}
                        language={language}
                        defaultCountry="IL"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={phoneLoading || !phoneNumber}
                      className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0"
                      data-testid="button-send-phone-code"
                    >
                      {phoneLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {language === 'he' ? 'שלח קוד אימות' : 'Send Verification Code'}
                          {language === 'he'
                            ? <ArrowLeft className="w-4 h-4 ms-2" />
                            : <ArrowRight className="w-4 h-4 ms-2" />}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <OtpCodeInput
                      length={6}
                      onComplete={(code) => handleVerifyPhoneCode(code)}
                      title={language === 'he' ? 'קוד אימות' : 'Verification Code'}
                      subtitle={language === 'he' ? 'הזן את הקוד בן 6 הספרות שנשלח ל-SMS' : 'Enter the 6-digit code sent to your phone'}
                      loading={phoneLoading}
                      language={language === 'he' ? 'he' : 'en'}
                    />
                    <button
                      type="button"
                      onClick={() => { setConfirmationResult(null); setVerificationCode(''); }}
                      className="w-full text-xs text-neutral-600 hover:text-neutral-900 tracking-wider uppercase py-2 transition-colors"
                      data-testid="button-resend-code"
                    >
                      {language === 'he' ? 'שלח קוד חדש' : 'Resend Code'}
                    </button>
                  </>
                )}
              </div>

              <Button
                type="button"
                onClick={() => {
                  setPhoneMode(false);
                  setPhoneNumber('');
                  setVerificationCode('');
                  setConfirmationResult(null);
                }}
                variant="ghost"
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-white rounded-none transition-all tracking-wider uppercase"
                data-testid="button-back-from-phone"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                {language === 'he' ? 'חזור להתחברות רגילה' : 'Back to regular sign in'}
              </Button>
            </motion.div>
          )}

          {/* Account linking banner — shown when a social OAuth credential is waiting to be linked */}
          {pendingOAuthCredential && pendingLinkProvider && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-none border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-snug"
              dir={language === 'he' || language === 'ar' ? 'rtl' : 'ltr'}
            >
              <p className="font-semibold mb-0.5">
                {language === 'he'
                  ? `חיבור חשבון ${pendingLinkProvider === 'google' ? 'Google' : pendingLinkProvider === 'apple' ? 'Apple' : 'Facebook'}`
                  : `Connect your ${pendingLinkProvider === 'google' ? 'Google' : pendingLinkProvider === 'apple' ? 'Apple' : 'Facebook'} account`}
              </p>
              <p>
                {language === 'he'
                  ? 'הזינו את הסיסמה שלכם למטה. לאחר מכן שתי שיטות ההתחברות יעבדו על אותו החשבון.'
                  : 'Enter your password below. Both sign-in methods will then work on the same account.'}
              </p>
              <button
                type="button"
                onClick={() => { setPendingOAuthCredential(null); setPendingLinkProvider(null); }}
                className="mt-1 text-xs text-amber-700 underline"
              >
                {language === 'he' ? 'בטל' : 'Cancel'}
              </button>
            </motion.div>
          )}

          {selectedIntent && !magicLinkMode && !showPasswordReset && !pinMode && !phoneMode && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              onSubmit={handleEmailPasswordSignIn}
              className="space-y-4"
            >
              <div>
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="username webauthn"
                  className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder={t('signin.passwordPlaceholder', language)}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  autoComplete="current-password"
                  className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all"
                  data-testid="input-password"
                />
              </div>

              {passkeyAvailable && (
                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={passkeyLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors group"
                  data-testid="button-faceid-inline"
                >
                  {passkeyLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-full border-2 border-neutral-300 group-hover:border-neutral-500 flex items-center justify-center transition-colors">
                        {/Android/.test(navigator.userAgent) ? (
                          <Fingerprint className="w-5 h-5" />
                        ) : (
                          <ScanFace className="w-5 h-5" />
                        )}
                      </div>
                      <span className="tracking-wide">
                        {language === 'he' ? 'כניסה חכמה באמצעות זיהוי פנים' : 'Smart login with Face ID'}
                      </span>
                    </>
                  )}
                </button>
              )}
              
              {signInStepUpPending && (
                <div className="text-center py-2">
                  <p className="text-xs text-neutral-500 mb-2 tracking-wide">
                    {language === 'he' ? 'אמת שאינך רובוט כדי להמשיך:' : 'Complete the security check to continue:'}
                  </p>
                  <TurnstileWidget
                    onVerify={handleTurnstileSignInVerify}
                    onError={() => {
                      setSignInStepUpPending(false);
                      toast({ variant: 'destructive', title: language === 'he' ? 'אימות האבטחה נכשל' : 'Security check failed', description: language === 'he' ? 'נסה שוב.' : 'Please try again.' });
                    }}
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || signInStepUpPending}
                className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-email-signin"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t('signin.signInButton', language)}
                    {language === 'he'
                      ? <ArrowLeft className="w-4 h-4 ms-2" />
                      : <ArrowRight className="w-4 h-4 ms-2" />}
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="remember-device"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-3.5 h-3.5 rounded-none border-neutral-300 text-neutral-900 focus:ring-neutral-400 cursor-pointer"
                  data-testid="checkbox-remember-device"
                />
                <label htmlFor="remember-device" className="text-xs text-neutral-500 cursor-pointer select-none tracking-wide">
                  {language === 'he' ? 'זכור מכשיר זה ל-30 יום' : 'Remember this device for 30 days'}
                </label>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-neutral-500 hover:text-neutral-900 tracking-wider uppercase transition-colors"
                  data-testid="link-forgot-password"
                >
                  {t('signin.forgotPassword', language)}
                </button>
                <Link href="/signup" className="text-neutral-500 hover:text-neutral-900 tracking-wider uppercase transition-colors" data-testid="link-signup">
                  {t('signin.signUpLink', language)}
                </Link>
              </div>
            </motion.form>
          )}

          {selectedIntent && magicLinkMode && !showPasswordReset && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              onSubmit={handleMagicLinkSignIn}
              className="space-y-4"
            >
              <div>
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={magicLinkSent}
                  className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all disabled:opacity-50"
                  data-testid="input-magic-link-email"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || magicLinkSent || magicLinkResendCountdown > 0}
                className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0"
                data-testid="button-send-magic-link"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : magicLinkResendCountdown > 0 ? (
                  <>
                    {t('signin.waitSeconds', language).replace('{seconds}', magicLinkResendCountdown.toString())}
                  </>
                ) : magicLinkSent ? (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t('signin.resend', language)}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t('signin.sendMagicLink', language)}
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setMagicLinkMode(false);
                  setMagicLinkSent(false);
                }}
                variant="ghost"
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-white rounded-none tracking-wider uppercase transition-all"
                data-testid="button-back-to-password"
              >
                {t('signin.backToPassword', language)}
              </Button>
            </motion.form>
          )}

          {selectedIntent && showPasswordReset && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              onSubmit={handlePasswordReset}
              className="space-y-4"
            >
              <div>
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={passwordResetSent}
                  className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all disabled:opacity-50"
                  data-testid="input-reset-email"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || passwordResetSent}
                className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0"
                data-testid="button-reset-password"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t('signin.resetPassword', language)}
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setShowPasswordReset(false);
                  setPasswordResetSent(false);
                }}
                variant="ghost"
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-white rounded-none tracking-wider uppercase transition-all"
                data-testid="button-back-to-signin"
              >
                {t('signin.backToSignIn', language)}
              </Button>
            </motion.form>
          )}

          {selectedIntent && !magicLinkMode && !showPasswordReset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-center"
            >
              <button
                onClick={() => setMagicLinkMode(true)}
                className="text-xs text-neutral-600 hover:text-neutral-900 tracking-wider uppercase transition-colors"
                data-testid="link-magic-link"
              >
                {t('signin.preferMagicLink', language)}
              </button>
            </motion.div>
          )}

          </div>
          </div>
        </motion.div>
      </div>
      <div id="recaptcha-container-signin" />
      </div>
    </Layout>
  );
}
