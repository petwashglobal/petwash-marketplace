/**
 * PetWash™ Admin Platform Login
 * Secure administrative access for PetWash™ business management
 * 
 * Features:
 * - Biometric/Passkey authentication (Touch ID/Face ID)
 * - Google One-Tap SSO
 * - Standard email/password with comprehensive validation
 * - Haptic feedback on button press
 * - Mobile-optimized design
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Mail, Lock, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { trackAuthError } from "@/lib/authErrorTracker";
import { isAdminRole } from "@shared/adminRoles";
// PR-AUTH-1: canonical Google OAuth entry point. iOS detection +
// popup/redirect choice + intent preservation live inside this hook.
// AuthProvider remains the only consumer of getRedirectResult().
import { signInWithGoogle as canonicalSignInWithGoogle } from "@/lib/auth-guardian-2025";
import { getAuthStrategy } from "@/lib/iosAuthHandler";

const isMobileBrowser = () => {
  // Retained for legacy callers; PR-AUTH-1 replaced the OAuth-init use of
  // this with getAuthStrategy() from iosAuthHandler (the canonical iOS
  // detection used by auth-guardian-2025). Phase B will remove the remaining
  // callers (audit doc PR-AUTH-5).
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua);
};

export default function AdminLoginV2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [supportsWebAuthn, setSupportsWebAuthn] = useState(false);
  
  const [biometricStatus, setBiometricStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");

  // Pre-fix this never surfaced what the server actually said — every failure
  // hid behind "Please try again", so an operator hitting INVALID_TOKEN /
  // EMAIL_NOT_VERIFIED / STALE_TOKEN / 500 all saw the same thing. We now
  // attach the server errorCode (and HTTP status if no code) to the thrown
  // Error so the catch can show it.
  const createServerSession = async (idToken: string) => {
    let sessionRes: Response;
    try {
      sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, expiresInMs: 432000000 }),
      });
    } catch (netErr: any) {
      const e = new Error('SESSION_NETWORK_ERROR');
      (e as any).detail = String(netErr?.message || netErr || 'unreachable');
      throw e;
    }
    if (!sessionRes.ok) {
      let body: any = null;
      try { body = await sessionRes.json(); } catch { /* non-JSON */ }
      const e = new Error('SESSION_CREATION_FAILED');
      (e as any).status = sessionRes.status;
      (e as any).code = body?.errorCode || null;
      (e as any).serverMsg = body?.error || null;
      throw e;
    }
  };

  const assertAdminAccess = async () => {
    let whoamiRes: Response;
    try {
      whoamiRes = await fetch('/api/session/whoami', { credentials: 'include' });
    } catch (netErr: any) {
      const e = new Error('WHOAMI_NETWORK_ERROR');
      (e as any).detail = String(netErr?.message || netErr || 'unreachable');
      throw e;
    }
    if (!whoamiRes.ok) {
      const e = new Error('SESSION_VERIFICATION_FAILED');
      (e as any).status = whoamiRes.status;
      throw e;
    }
    const whoami = await whoamiRes.json();
    if (!whoami.isSuperAdmin && !isAdminRole(whoami.role)) {
      const e = new Error('ACCESS_DENIED');
      (e as any).role = whoami.role || '(no role)';
      (e as any).email = whoami.email || '(no email)';
      throw e;
    }
  };

  // Translate an internal error into something the operator can read.
  // Critical because "Please try again" on the admin entry point is useless
  // when the failure is a config issue (INVALID_TOKEN = Firebase Admin SDK
  // not configured, EMAIL_NOT_VERIFIED = missing email verification, etc.).
  const explainError = (err: any): string => {
    if (!err) return 'Unknown error.';
    const tag = err?.message || 'UNKNOWN';
    const code = err?.code || '';
    const status = err?.status ? ` [HTTP ${err.status}]` : '';
    if (tag === 'ACCESS_DENIED') {
      return `This account (${err?.email || 'unknown'}) does not have admin privileges. Role: ${err?.role || 'none'}.`;
    }
    if (tag === 'SESSION_CREATION_FAILED') {
      const codeHint = code ? ` (${code})` : '';
      const srv = err?.serverMsg ? ` — ${err.serverMsg}` : '';
      return `Server rejected the sign-in${codeHint}${status}${srv}.`;
    }
    if (tag === 'SESSION_VERIFICATION_FAILED') return `Session check failed${status}. The session cookie was not accepted on /api/session/whoami.`;
    if (tag === 'SESSION_NETWORK_ERROR' || tag === 'WHOAMI_NETWORK_ERROR') return `Network error reaching the API: ${err?.detail || 'no response'}.`;
    if (tag === 'NO_USER_AFTER_POPUP') return 'Google popup closed without returning a user. Check popup blockers.';
    if (err?.code?.startsWith?.('auth/')) return `Firebase: ${err.code}. ${err?.message || ''}`.trim();
    return `${tag}${status}${err?.detail ? ` — ${err.detail}` : ''}`;
  };

  useEffect(() => {
    const checkWebAuthn = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setSupportsWebAuthn(available);
      }
    };
    checkWebAuthn();

    // Resume Google sign-in after iOS Safari redirect.
    // We cannot rely on getRedirectResult here because AuthProvider (mounted
    // globally) consumes the redirect result first; a second call returns null.
    // Instead, handleGoogleLogin sets a localStorage flag right before
    // signInWithRedirect, and we observe onAuthStateChanged to pick up the
    // post-redirect user. This preserves admin-access enforcement and the
    // navigation to /admin/dashboard that the redirect-result path used to do.
    if (localStorage.getItem('pw_admin_google_redirect_pending') !== '1') return;

    let unsubscribe: (() => void) | undefined;
    let handled = false;
    (async () => {
      const { onAuthStateChanged } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || handled) return;
        handled = true;
        localStorage.removeItem('pw_admin_google_redirect_pending');
        try {
          setIsGoogleLoading(true);
          const idToken = await user.getIdToken();
          await createServerSession(idToken);
          await assertAdminAccess();
          toast({ title: "Welcome back", description: "Successfully logged in with Google" });
          setLocation("/admin/dashboard");
        } catch (err: any) {
          trackAuthError(err, 'admin_google_redirect').catch(() => {});
          toast({
            title: "Google Sign-In Failed",
            description: explainError(err),
            variant: "destructive",
            duration: 10000,
          });
        } finally {
          setIsGoogleLoading(false);
          unsubscribe?.();
        }
      });
    })();
    return () => { unsubscribe?.(); };
  }, []);

  const triggerHaptic = () => {
    if (window.navigator && 'vibrate' in window.navigator) {
      window.navigator.vibrate(10);
    }
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    triggerHaptic();

    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await createServerSession(idToken);
      await assertAdminAccess();

      toast({
        title: "Welcome back",
        description: "Successfully logged in",
      });

      setLocation("/admin/dashboard");
    } catch (error: any) {
      const isFirebaseCredError = error?.code === 'auth/wrong-password'
        || error?.code === 'auth/user-not-found'
        || error?.code === 'auth/invalid-credential';
      const msg = isFirebaseCredError ? 'Invalid email or password' : explainError(error);
      trackAuthError(error, 'admin_email_password').catch(() => {});
      toast({
        title: "Login Failed",
        description: msg,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const base64urlToBase64 = (base64url: string): string => {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }
    return base64;
  };

  const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const handleBiometricLogin = async () => {
    triggerHaptic();
    setBiometricStatus("scanning");
    
    try {
      if (!email) {
        setBiometricStatus("error");
        toast({
          title: "Email Required",
          description: "Please enter your email address first",
          variant: "destructive",
        });
        setTimeout(() => setBiometricStatus("idle"), 2000);
        return;
      }

      // CRITICAL FIX 2026-05-24 (investigation finding 4.1):
      //   Pre-fix called `/webauthn/authenticate/options` — there is no
      //   such route on the server. The dead v1 router at server/routes/
      //   webauthn.ts was DISABLED at routes.ts:11031. The canonical
      //   endpoints are mounted inline at routes.ts:2903 / :2935 under
      //   `/api/webauthn/login/...`. Every biometric tap from the admin
      //   login was therefore 404-ing through the Firebase Hosting
      //   rewrite, which the user described as "scan and maybe he kill
      //   the entry to back end". Fixed.
      const optionsRes = await apiRequest("/api/webauthn/login/options", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const optionsBody = await optionsRes.json();
      // Server may wrap options under { options, challengeKey, discoverable }
      // depending on whether email was provided. Unwrap so the rest of the
      // code (which expects `.challenge`, `.allowCredentials`) keeps working.
      const options = optionsBody.options || optionsBody;

      const credential = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(base64urlToBase64(options.challenge)), c => c.charCodeAt(0)),
          allowCredentials: options.allowCredentials.map((c: any) => ({
            ...c,
            id: Uint8Array.from(atob(base64urlToBase64(c.id)), char => char.charCodeAt(0)),
          })),
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Authentication cancelled");
      }

      const response = credential.response as AuthenticatorAssertionResponse;
      const serializedCredential = {
        id: credential.id,
        rawId: arrayBufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: arrayBufferToBase64url(response.authenticatorData),
          clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
          signature: arrayBufferToBase64url(response.signature),
          userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
        },
      };

      // CRITICAL FIX 2026-05-24 (investigation finding 4.1):
      //   Pre-fix called `/webauthn/authenticate/verify` (404) AND sent
      //   `{response, email}` — the canonical handler at routes.ts:2935
      //   expects only `{response}` (and optional `discoverable: true`
      //   when no email was used for the options call).
      const verifyRes = await apiRequest("/api/webauthn/login/verify", {
        method: "POST",
        body: JSON.stringify({
          response: serializedCredential,
        }),
      });
      const verifyResponse = await verifyRes.json();

      if (verifyResponse.customToken) {
        const { signInWithCustomToken } = await import("firebase/auth");
        const { auth: firebaseAuth } = await import("@/lib/firebase");
        const credential = await signInWithCustomToken(firebaseAuth, verifyResponse.customToken);
        const idToken = await credential.user.getIdToken(true);
        await createServerSession(idToken);
        await assertAdminAccess();

        setBiometricStatus("success");
        toast({
          title: "Biometric authentication successful",
          description: "Welcome back",
        });
        
        setTimeout(() => {
          setLocation("/admin/dashboard");
        }, 800);
      }
    } catch (error: any) {
      setBiometricStatus("error");
      trackAuthError(error, 'admin_biometric').catch(() => {});
      toast({
        title: "Biometric Authentication Failed",
        description: explainError(error) || "Biometric sign-in failed. Please use email and password.",
        variant: "destructive",
        duration: 10000,
      });

      setTimeout(() => setBiometricStatus("idle"), 2000);
    }
  };

  const handleGoogleLogin = async () => {
    triggerHaptic();
    setIsGoogleLoading(true);

    try {
      // PR-AUTH-1: delegate the OAuth call itself to the canonical hook
      // (auth-guardian-2025.signInWithGoogle). It calls getAuthStrategy()
      // internally to decide popup vs redirect, preserves provider intent,
      // and never touches getRedirectResult (AuthProvider is the sole
      // consumer of that). We still own the admin-specific session +
      // role check below — that is not auth, that is authorization.
      const strategy = getAuthStrategy();
      if (strategy === 'redirect') {
        // For iOS Safari: mark that the post-redirect useEffect should pick
        // up the user via onAuthStateChanged. canonicalSignInWithGoogle
        // unloads the page right after this point.
        localStorage.setItem('pw_admin_google_redirect_pending', '1');
        await canonicalSignInWithGoogle();
        // Page unloaded — code below is unreachable on this path.
        return;
      }

      // Desktop: popup flow. canonicalSignInWithGoogle awaits the popup
      // and then we run the admin-specific session + role check inline.
      await canonicalSignInWithGoogle();
      const { auth } = await import("@/lib/firebase");
      if (!auth.currentUser) {
        throw new Error('NO_USER_AFTER_POPUP');
      }
      const idToken = await auth.currentUser.getIdToken();
      await createServerSession(idToken);
      await assertAdminAccess();

      toast({ title: "Welcome back", description: "Successfully logged in with Google" });
      setLocation("/admin/dashboard");
    } catch (error: any) {
      if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
        setIsGoogleLoading(false);
        return;
      }
      trackAuthError(error, 'admin_google').catch(() => {});
      toast({
        title: "Google Sign-In Failed",
        description: explainError(error),
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="luxury-bg-mesh flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-8"
      style={{
        minHeight: '100dvh',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Main Login Card */}
      <Card className="w-full max-w-md luxury-glass-card luxury-shadow-xl p-5 sm:p-7 md:p-8">
        {/* Header — PetWash™ logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="mb-3 sm:mb-4 flex justify-center">
            <img
              src="/brand/petwash-logo-official.png"
              alt="PetWash"
              className="h-12 sm:h-14 md:h-16 w-auto object-contain"
              decoding="async"
            />
          </div>
          <h1 className="luxury-heading-lg luxury-text-gradient mb-1 sm:mb-2 text-2xl sm:text-3xl">
            PetWash Admin Platform
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Secure Business Management
          </p>
        </div>

        {/* Primary CTAs - Biometric & Google SSO */}
        <div className="space-y-3 mb-6">
          {supportsWebAuthn && (
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="w-full"
            >
              <Button
                onClick={handleBiometricLogin}
                disabled={!email || biometricStatus === "scanning"}
                title={!email ? "Type your email below first — Touch ID needs to know which account" : undefined}
                className={`
                  w-full min-h-[48px] sm:h-12 text-white shadow-lg hover:shadow-xl transition-all text-sm sm:text-base
                  ${biometricStatus === 'error' ? 'bg-red-500 hover:bg-red-600' :
                    biometricStatus === 'success' ? 'bg-green-500 hover:bg-green-600' :
                    biometricStatus === 'scanning' ? 'bg-purple-400 animate-pulse' :
                    'luxury-btn-primary'}
                `}
                data-testid="button-biometric-login"
              >
                {biometricStatus === "idle" && (
                  <>
                    <Fingerprint className="h-5 w-5 mr-2" />
                    Sign in with Touch ID / Face ID
                  </>
                )}
                {biometricStatus === "scanning" && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Fingerprint className="h-5 w-5 animate-pulse" />
                    Scanning Biometric...
                  </motion.div>
                )}
                {biometricStatus === "success" && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Access granted
                  </motion.div>
                )}
                {biometricStatus === "error" && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    <XCircle className="h-5 w-5" />
                    Scan failed — retry?
                  </motion.div>
                )}
              </Button>
            </motion.div>
          )}

          <motion.div
            whileTap={{ scale: 0.97 }}
            className="w-full"
          >
            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full min-h-[48px] sm:h-12 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-200 hover:border-gray-300 shadow-sm transition-all font-medium text-sm sm:text-base"
              data-testid="button-google-login"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin text-gray-500" />
                  Signing in with Google…
                </>
              ) : (
                <>
                  {/* Official Google "G" mark — 4-color SVG per Google brand
                      guidelines. Matches the pattern in SignIn.tsx:2351-2356. */}
                  <svg
                    className="h-5 w-5 mr-2 flex-shrink-0"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-purple-100"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-gray-500">or use email</span>
          </div>
        </div>

        {/* Standard Login Form */}
        <form onSubmit={handleStandardLogin} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-gray-700 font-medium text-sm">Email</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@petwash.co.il"
                className="luxury-glass-minimal pl-10 h-12 sm:h-11 border-purple-200 focus:border-purple-400 text-base sm:text-sm"
                required
                data-testid="input-email"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-700 font-medium text-sm">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="luxury-glass-minimal pl-10 h-12 sm:h-11 border-purple-200 focus:border-purple-400 text-base sm:text-sm"
                required
                data-testid="input-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !email || !password}
            title={!email || !password ? 'Type your email and password to enable Sign In' : undefined}
            className="luxury-btn-primary w-full min-h-[48px] sm:h-11 text-sm sm:text-base"
            data-testid="button-login"
          >
            {isLoading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Footer — Forgot password.
            Wired to Firebase sendPasswordResetEmail. The previous build
            shipped a button with no onClick; an operator clicking it saw
            nothing happen, which read as "buttons broken". */}
        <div className="mt-6 text-center">
          <Button
            type="button"
            variant="ghost"
            className="text-sm text-gray-600 hover:text-purple-600 transition-colors"
            onClick={async () => {
              if (!email) {
                toast({
                  title: 'Email required',
                  description: 'Enter your admin email above, then tap Forgot password.',
                  variant: 'destructive',
                });
                return;
              }
              try {
                const { sendPasswordResetEmail } = await import('firebase/auth');
                const { auth: fbAuth } = await import('@/lib/firebase');
                await sendPasswordResetEmail(fbAuth, email);
                toast({
                  title: 'Password reset sent',
                  description: `If an account exists for ${email}, a reset email is on its way.`,
                });
              } catch (err: any) {
                trackAuthError(err, 'admin_password_reset').catch(() => {});
                toast({
                  title: 'Could not send reset email',
                  description: explainError(err),
                  variant: 'destructive',
                  duration: 10000,
                });
              }
            }}
          >
            Forgot password?
          </Button>
        </div>

        {/* Operator diagnostics — quick visibility into backend health from
            the login screen so when sign-in fails the operator can see
            instantly whether the API is reachable, instead of guessing. */}
        <BackendHealthRow />

        {/* Security badge — PR admin-login-immersive: typographic
            treatment replaces LuxuryEmoji glyphs per §0 (no emojis in
            professional surfaces). */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-gray-400">
            <span>Secure</span>
            <span aria-hidden="true">·</span>
            <span>Encrypted</span>
            <span aria-hidden="true">·</span>
            <span>Audit-logged</span>
          </div>
          <p className="text-xs text-gray-500">
            PetWash™ admin access
          </p>
        </div>
      </Card>
    </div>
  );
}

// Pings /api/health on mount and surfaces the result. When the API is down,
// the operator sees it immediately — instead of "Google sign-in failed" with
// no clue that the actual root cause is a backend outage. Two endpoints are
// probed so a config-degraded state (200 from /health but 503 from
// /health/strict) is visible too.
function BackendHealthRow() {
  const [base, setBase] = useState<'ok' | 'down' | 'checking'>('checking');
  const [strict, setStrict] = useState<'ok' | 'degraded' | 'down' | 'checking'>('checking');
  const [whoami, setWhoami] = useState<'session' | 'anon' | 'down' | 'checking'>('checking');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/health', { credentials: 'omit' });
        setBase(r.ok ? 'ok' : 'down');
      } catch { setBase('down'); }
      try {
        const r = await fetch('/api/health/strict', { credentials: 'omit' });
        if (r.ok) setStrict('ok');
        else if (r.status === 503) setStrict('degraded');
        else setStrict('down');
      } catch { setStrict('down'); }
      try {
        const r = await fetch('/api/session/whoami', { credentials: 'include' });
        if (!r.ok) { setWhoami('down'); return; }
        const j = await r.json();
        setWhoami(j?.uid ? 'session' : 'anon');
      } catch { setWhoami('down'); }
    })();
  }, []);

  const dot = (s: string) => (
    s === 'ok' || s === 'session' ? 'bg-emerald-500' :
    s === 'anon' ? 'bg-amber-400' :
    s === 'degraded' ? 'bg-amber-500' :
    s === 'checking' ? 'bg-gray-300 animate-pulse' :
    'bg-red-500'
  );

  return (
    <div className="mt-6 grid grid-cols-3 gap-2 text-[10px] font-medium text-gray-500">
      <div className="flex items-center gap-1.5 justify-center" title="API reachability (/api/health)">
        <span className={`inline-block w-2 h-2 rounded-full ${dot(base)}`} />
        <span className="uppercase tracking-wider">API</span>
      </div>
      <div className="flex items-center gap-1.5 justify-center" title="Strict health (/api/health/strict — env/secret integrity)">
        <span className={`inline-block w-2 h-2 rounded-full ${dot(strict)}`} />
        <span className="uppercase tracking-wider">Config</span>
      </div>
      <div className="flex items-center gap-1.5 justify-center" title="Session (/api/session/whoami)">
        <span className={`inline-block w-2 h-2 rounded-full ${dot(whoami)}`} />
        <span className="uppercase tracking-wider">Session</span>
      </div>
    </div>
  );
}
