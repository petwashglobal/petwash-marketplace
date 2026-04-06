/**
 * Pet Wash Admin Platform Login
 * Secure administrative access for Pet Wash business management
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
import { SiGoogle } from "react-icons/si";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import LuxuryEmoji from "@/components/luxury/LuxuryEmoji";

const isMobileBrowser = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua);
};

const extractErrorMessage = (error: any): string => {
  if (error?.body?.error) return error.body.error;
  if (error?.body?.message) return error.body.message;
  if (error?.error) return error.error;
  if (error?.message) return error.message;
  return "Please try again";
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

  useEffect(() => {
    const checkWebAuthn = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setSupportsWebAuthn(available);
      }
    };
    checkWebAuthn();

    // Handle Google redirect result (fires after signInWithRedirect on mobile)
    const handleRedirectResult = async () => {
      try {
        const { getRedirectResult } = await import("firebase/auth");
        const { auth } = await import("@/lib/firebase");
        const result = await getRedirectResult(auth);
        if (!result) return;

        setIsGoogleLoading(true);
        const idToken = await result.user.getIdToken();
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken, expiresInMs: 432000000 }),
        });
        if (!sessionRes.ok) {
          const err = await sessionRes.json();
          throw new Error(err.error || 'Session creation failed');
        }

        // Verify admin access before redirecting
        const whoamiRes = await fetch('/api/session/whoami', { credentials: 'include' });
        if (whoamiRes.ok) {
          const whoami = await whoamiRes.json();
          const ADMIN_ROLES = ['admin', 'ops', 'super_admin', 'management', 'staff', 'hr'];
          if (!whoami.isSuperAdmin && !ADMIN_ROLES.includes(whoami.role)) {
            throw new Error('This account does not have admin access.');
          }
        }

        toast({ title: "Welcome back! ✨", description: "Successfully logged in with Google" });
        setLocation("/admin/dashboard");
      } catch (err: any) {
        if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") return;
        const desc = extractErrorMessage(err);
        if (desc !== "Please try again") {
          toast({ title: "Google Sign-In Failed", description: desc, variant: "destructive" });
        }
      } finally {
        setIsGoogleLoading(false);
      }
    };
    handleRedirectResult();
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

      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, expiresInMs: 432000000 }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        throw new Error(err.error || 'Session creation failed');
      }

      // Verify the user actually has admin-level access before redirecting
      const whoamiRes = await fetch('/api/session/whoami', { credentials: 'include' });
      if (whoamiRes.ok) {
        const whoami = await whoamiRes.json();
        const ADMIN_ROLES = ['admin', 'ops', 'super_admin', 'management', 'staff', 'hr'];
        if (!whoami.isSuperAdmin && !ADMIN_ROLES.includes(whoami.role)) {
          throw new Error('This account does not have admin access. Please use the correct login page.');
        }
      }

      toast({
        title: "Welcome back! ✨",
        description: "Successfully logged in",
      });

      setLocation("/admin/dashboard");
    } catch (error: any) {
      const msg = error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found'
        ? 'Invalid email or password'
        : extractErrorMessage(error);
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
        setBiometricStatus("success");
        toast({
          title: "Biometric Authentication Successful! 🎉",
          description: "Welcome back",
        });
        
        setTimeout(() => {
          setLocation("/admin/dashboard");
        }, 800);
      }
    } catch (error: any) {
      setBiometricStatus("error");
      toast({
        title: "Biometric Authentication Failed",
        description: error.message || error.error || "Please try again or use email/password",
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
        // Mobile Safari/iOS blocks popups — use redirect flow instead
        await signInWithRedirect(auth, provider);
        // Page will reload; result is handled in the useEffect above
        return;
      }

      // Desktop: popup flow
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, expiresInMs: 432000000 }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        throw new Error(err.error || 'Session creation failed');
      }

      toast({ title: "Welcome back! ✨", description: "Successfully logged in with Google" });
      setLocation("/admin/dashboard");
    } catch (error: any) {
      if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
        setIsGoogleLoading(false);
        return;
      }
      toast({
        title: "Google Sign-In Failed",
        description: extractErrorMessage(error),
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
        {/* Header - Pet Wash Logo */}
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img 
              src="/brand/petwash-logo-official.png" 
              alt="Pet Wash" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="luxury-heading-lg luxury-text-gradient mb-2">
            Pet Wash Admin Platform
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
                    ✅ Access Granted
                  </motion.div>
                )}
                {biometricStatus === "error" && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    <XCircle className="h-5 w-5" />
                    ❌ Scan Failed. Retry?
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
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full h-12 bg-white text-gray-700 border-2 border-gray-200 hover:border-purple-300 shadow-md hover:shadow-lg transition-all"
              data-testid="button-google-login"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin text-blue-500" />
                  Signing in with Google...
                </>
              ) : (
                <>
                  <SiGoogle className="h-5 w-5 mr-2 text-blue-500" />
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

        {/* Security Badge */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <LuxuryEmoji emoji="🛡️" material="platinum" size="sm" animate={false} />
            <LuxuryEmoji emoji="🔒" material="gold" size="sm" animate={false} />
            <LuxuryEmoji emoji="👑" material="diamond" size="sm" animate={false} />
          </div>
          <p className="text-xs text-gray-500">
            OAuth 2.1 Secured • Crown Jewel Protocol v2025
          </p>
        </div>
      </Card>
    </div>
  );
}
