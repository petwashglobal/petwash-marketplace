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

const isMobileBrowser = () => {
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

  const createServerSession = async (idToken: string) => {
    const sessionRes = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken, expiresInMs: 432000000 }),
    });
    if (!sessionRes.ok) {
      throw new Error('SESSION_CREATION_FAILED');
    }
  };

  const assertAdminAccess = async () => {
    const whoamiRes = await fetch('/api/session/whoami', { credentials: 'include' });
    if (!whoamiRes.ok) {
      throw new Error('SESSION_VERIFICATION_FAILED');
    }
    const whoami = await whoamiRes.json();
    if (!whoami.isSuperAdmin && !isAdminRole(whoami.role)) {
      throw new Error('ACCESS_DENIED');
    }
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
          const isAccessDenied = err?.message === 'ACCESS_DENIED';
          toast({
            title: "Google Sign-In Failed",
            description: isAccessDenied
              ? "This account does not have admin privileges."
              : "Google sign-in failed. Please try again.",
            variant: "destructive",
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
      const isAccessDenied = error?.message === 'ACCESS_DENIED';
      const msg = isFirebaseCredError
        ? 'Invalid email or password'
        : isAccessDenied
          ? 'This account does not have admin privileges.'
          : (typeof error?.message === 'string' && error.message) ||
            'Session could not be created. Please try again.';
      trackAuthError(error, 'admin_email_password').catch(() => {});
      toast({
        title: "Login Failed",
        description: msg,
        variant: "destructive",
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

      const optionsRes = await apiRequest("/webauthn/authenticate/options", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const options = await optionsRes.json();

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

      const verifyRes = await apiRequest("/webauthn/authenticate/verify", {
        method: "POST",
        body: JSON.stringify({
          response: serializedCredential,
          email,
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
        description: "Biometric sign-in failed. Please use email and password.",
        variant: "destructive",
      });
      
      setTimeout(() => setBiometricStatus("idle"), 2000);
    }
  };

  const handleGoogleLogin = async () => {
    triggerHaptic();
    setIsGoogleLoading(true);

    try {
      const { signInWithPopup, signInWithRedirect, GoogleAuthProvider } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");

      const provider = new GoogleAuthProvider();

      if (isMobileBrowser()) {
        // Mobile Safari/iOS blocks popups — use redirect flow instead.
        // Set a flag so the post-redirect useEffect knows to pick up the user
        // via onAuthStateChanged (AuthProvider consumes getRedirectResult first).
        localStorage.setItem('pw_admin_google_redirect_pending', '1');
        await signInWithRedirect(auth, provider);
        // Page will reload; result is handled in the useEffect above
        return;
      }

      // Desktop: popup flow
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
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
        description: "Google sign-in failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen luxury-bg-mesh flex items-center justify-center p-4">
      {/* Main Login Card */}
      <Card className="w-full max-w-md luxury-glass-card luxury-shadow-xl p-8">
        {/* Header — PetWash™ logo */}
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="PetWash"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="luxury-heading-lg luxury-text-gradient mb-2">
            PetWash Admin Platform
          </h1>
          <p className="text-gray-600">
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
                className={`
                  w-full h-12 text-white shadow-lg hover:shadow-xl transition-all
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
              className="w-full h-12 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border border-gray-200 hover:border-gray-300 shadow-sm transition-all font-medium"
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
            <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@petwash.co.il"
                className="luxury-glass-minimal pl-10 h-11 border-purple-200 focus:border-purple-400"
                required
                data-testid="input-email"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="luxury-glass-minimal pl-10 h-11 border-purple-200 focus:border-purple-400"
                required
                data-testid="input-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !email || !password}
            className="luxury-btn-primary w-full h-11"
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

        {/* Footer */}
        <div className="mt-6 text-center">
          <Button variant="ghost" className="text-sm text-gray-600 hover:text-purple-600 transition-colors">
            Forgot password?
          </Button>
        </div>

        {/* Security badge — PR admin-login-immersive: typographic
            treatment replaces LuxuryEmoji glyphs per §0 (no emojis in
            professional surfaces). */}
        <div className="mt-8 flex flex-col items-center gap-2">
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
