/**
 * Pet Wash™ Admin Login - Production Fix (October 29, 2025)
 * 
 * ✅ FIXES APPLIED:
 * - Removed all strict password regex validation
 * - Added comprehensive error handling for validation errors
 * - Auto-trim email/password to prevent whitespace issues
 * - User-friendly error messages for all auth scenarios
 * - Cache-busting update to force browser refresh
 */

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { Shield, Lock, Fingerprint, Loader2, Phone } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { signInWithPasskey, isPasskeySupported, getBiometricMethodName, getDeviceType, registerPasskey } from "@/auth/passkey";
import { LuxuryConsentCard } from "@/components/LuxuryConsentCard";

const adminLoginSchema = z.object({
  email: z.string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" })
    .transform((val) => val.trim().toLowerCase()),
  password: z.string()
    .min(1, { message: "Password is required" })
    .transform((val) => val.trim()),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyAvailable] = useState(isPasskeySupported());
  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const { toast} = useToast();

  const form = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handlePasskeySignIn = async () => {
    try {
      setPasskeyLoading(true);
      console.log('[AdminLogin] Starting passkey authentication');
      
      // Check if email is filled in
      const emailValue = form.getValues('email');
      if (!emailValue || emailValue.trim() === '') {
        toast({
          title: "Email Required",
          description: "Please enter your email address first",
          variant: "destructive",
        });
        setPasskeyLoading(false);
        return;
      }
      
      const result = await signInWithPasskey();
      
      if (result.success) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        
        console.log('[AdminLogin] ✅ Passkey login successful, redirecting to /admin/users');
        window.location.href = "/admin/users";
      } else {
        // Check if error is due to no passkey registered
        if (result.error?.includes('No passkeys found') || result.error?.includes('No credentials found')) {
          console.log('[AdminLogin] No passkey found, prompting one-click registration');
          
          // Prompt user to set up passkey with one click
          const shouldRegister = confirm(
            `Set up ${getBiometricMethodName()} for faster login?\n\nYou'll need to sign in with email & password first, then we'll enable ${getBiometricMethodName()}.`
          );
          
          if (shouldRegister) {
            toast({
              title: "Sign In Required",
              description: "Please sign in with email & password to set up biometric login",
            });
          }
        } else {
          // Show the actual error from the backend
          toast({
            title: "Login Failed",
            description: result.error || "Failed to authenticate with passkey",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error('[AdminLogin] Passkey error:', error);
      toast({
        title: "Passkey Login Failed",
        description: error.message || "Failed to authenticate with passkey",
        variant: "destructive",
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const onSubmit = async (data: AdminLoginForm) => {
    setIsLoading(true);
    try {
      console.log('[AdminLogin] Step 1: Validating credentials...');
      
      // Ensure email and password are properly trimmed
      const email = data.email?.trim() || '';
      const password = data.password?.trim() || '';
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      console.log('[AdminLogin] Step 2: Signing in with Firebase...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[AdminLogin] ✅ Firebase sign-in successful:', userCredential.user.uid);
      
      console.log('[AdminLogin] Step 2: Getting ID token...');
      const idToken = await userCredential.user.getIdToken(true);
      console.log('[AdminLogin] ✅ ID token obtained');
      
      console.log('[AdminLogin] Step 3: Creating session cookie...');
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, expiresInMs: 432000000 })
      });
      
      if (!sessionRes.ok) {
        const error = await sessionRes.json();
        throw new Error(error.error || 'Failed to create session');
      }
      
      const sessionData = await sessionRes.json();
      console.log('[AdminLogin] ✅ Session cookie created:', sessionData);
      
      console.log('[AdminLogin] Step 4: Verifying admin access...');
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      
      if (!meRes.ok) {
        const error = await meRes.json();
        console.error('[AdminLogin] ❌ Admin verification failed:', error);
        throw new Error(error.error === 'employee-suspended' 
          ? 'This account is suspended'
          : 'This account does not have admin access'
        );
      }
      
      const meData = await meRes.json();
      console.log('[AdminLogin] ✅ Admin verified:', meData);
      
      if (!meData.ok || !meData.user) {
        throw new Error('Invalid response from server');
      }
      
      if (!meData.user.isActive) {
        throw new Error('This account is suspended');
      }
      
      if (meData.user.role !== 'admin' && meData.user.role !== 'ops') {
        throw new Error('This account does not have admin access');
      }
      
      toast({
        title: "Login Successful",
        description: `Welcome, ${meData.user.firstName}!`,
      });
      
      // ONE-CLICK PASSKEY SETUP: Offer to register Face ID/Touch ID after successful login
      if (passkeyAvailable && isPasskeySupported()) {
        console.log('[AdminLogin] ✅ Login successful, checking if passkey setup is needed');
        
        // Check if user already has a passkey
        const hasPasskeyCheck = await fetch('/api/auth/webauthn/devices', {
          credentials: 'include',
        });
        
        if (hasPasskeyCheck.ok) {
          const { devices } = await hasPasskeyCheck.json();
          
          if (!devices || devices.length === 0) {
            // No passkey registered, offer one-click setup
            const biometricName = getBiometricMethodName();
            const shouldSetup = confirm(
              `🔐 Enable ${biometricName} for Faster Login?\n\n✓ Login instantly next time\n✓ No password needed\n✓ More secure\n\nSet up ${biometricName} now?`
            );
            
            if (shouldSetup) {
              console.log('[AdminLogin] User opted for one-click passkey setup');
              const token = await auth.currentUser?.getIdToken();
              
              if (token) {
                const registerResult = await registerPasskey(token);
                
                if (registerResult.success) {
                  toast({
                    title: `${biometricName} Enabled!`,
                    description: "You can now use biometric login next time",
                  });
                  console.log('[AdminLogin] ✅ Passkey registered successfully');
                } else {
                  console.log('[AdminLogin] Passkey registration declined or failed');
                }
              }
            }
          }
        }
      }
      
      console.log('[AdminLogin] ✅ Redirecting to /admin/users');
      window.location.href = "/admin/users";
    } catch (error: any) {
      console.error('[AdminLogin] ❌ Login error:', error);
      let errorMessage = "Invalid credentials";
      let errorTitle = "Login Failed";
      
      // ✅ Catch Zod/Validation Errors First (October 2025 Fix)
      if (error.name === 'ZodError' || error.message?.includes('validation') || error.message?.includes('pattern')) {
        errorTitle = "Validation Error";
        errorMessage = "Please enter a valid email address and password.";
      }
      // ✅ Firebase Auth Error Handling (October 2025 Best Practices)
      else if (error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        errorMessage = "Invalid email or password. Please check your credentials and try again.";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password. Please check your credentials and try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later or use 'Forgot Password?' to reset.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled. Please contact support.";
      } else if (error.code === "auth/internal-error") {
        // ✅ Most common cause: domain not authorized in Firebase Console
        errorTitle = "Configuration Error";
        errorMessage = "Authentication service is not properly configured. Please contact the administrator.";
        console.error('[AdminLogin] ❌ auth/internal-error - Domain likely not authorized in Firebase Console');
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address";
      } else if (error.message && !error.message.includes('match')) {
        // Only show custom error messages that aren't generic pattern errors
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues("email");
    
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your email address first"
      });
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setPasswordResetSent(true);
      
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for instructions to reset your password"
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      let errorMessage = "Failed to send password reset email";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many requests. Please try again later.";
      }
      
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-[#0c0f14] px-4 pt-8 md:pt-16">
      <div className="w-full max-w-xl">
        <LuxuryConsentCard />
        
        <Card className="w-full max-w-md mx-auto shadow-xl border bg-white">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800">
              Pet Wash™ Admin
            </CardTitle>
            <CardDescription className="text-slate-600 mt-2">
              Secure access to management portal
            </CardDescription>
          </div>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              {/* Passkey button (if supported) */}
              {passkeyAvailable && (
                <div className="mb-4">
                  <Button
                    type="button"
                    onClick={handlePasskeySignIn}
                    disabled={passkeyLoading || isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium h-11"
                  >
                    {passkeyLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5 mr-2" />
                        Sign in with {getBiometricMethodName()}
                      </>
                    )}
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-300" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">Or continue with email</span>
                    </div>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="admin@petwash.co.il"
                        className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          className="h-11 pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                          disabled={isLoading}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={isLoading}
                data-testid="button-admin-login"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  "Access Admin Portal"
                )}
              </Button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-slate-600 hover:text-blue-600 transition-colors"
                data-testid="button-forgot-password"
              >
                Forgot Password?
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or sign in with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={isLoading}
                  data-testid="button-admin-google-login"
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      const provider = new GoogleAuthProvider();
                      const result = await signInWithPopup(auth, provider);
                      const idToken = await result.user.getIdToken();
                      
                      const sessionRes = await fetch('/api/auth/session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken, expiresInMs: 432000000 })
                      });
                      
                      if (!sessionRes.ok) throw new Error('Session failed');
                      
                      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
                      const meData = await meRes.json();
                      
                      if (meData.user?.role !== 'admin' && meData.user?.role !== 'ops') {
                        throw new Error('Not an admin account');
                      }
                      
                      toast({ title: "Success", description: `Welcome, ${meData.user.firstName}!` });
                      window.location.href = "/admin/users";
                    } catch (error: any) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                      setIsLoading(false);
                    }
                  }}
                >
                  <FaGoogle className="w-5 h-5 mr-2" />
                  Continue with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={isLoading}
                  data-testid="button-admin-phone-login"
                  onClick={() => setPhoneMode(true)}
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Phone
                </Button>
              </div>
              
              <p className="text-xs text-slate-500 text-center">
                Authorized personnel only • Secure connection
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
      </div>
    </div>
  );
}