import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, getRedirectResult } from "firebase/auth";
import { signInWithBestMethod, isIOS, createGoogleProvider, getDeviceInfo } from "@/lib/iosAuthHandler";
import { auth } from "../lib/firebase";
import { getApiUrl } from "@/lib/apiConfig";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { useSEO, pageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PinKeypad } from "@/components/PinKeypad";
import { Loader2, Mail, Info, Fingerprint, Smartphone, ScanFace, Phone, User, Lock, ArrowRight, Sparkles, KeyRound, X, ArrowLeft } from "lucide-react";
import { SiGmail } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { trackSwitchAccount } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { signInWithPasskey, signInWithPasskeyConditional, isPasskeySupported, getBiometricMethodName, isChromeiOS, getBrowserName } from "@/auth/passkey";
import { useAutoFaceID, storePasskeyEmail, clearPasskeyEmail, storeLastAuthMethod, getConsecutiveFailures } from "@/hooks/useAutoFaceID";
import { FaceIDLoadingState } from "@/components/FaceIDLoadingState";
import { ReCaptcha } from "@/components/ReCaptcha";
import { trackAuthError } from "@/lib/authErrorTracker";
import { trustDevice, isDeviceTrusted } from "@/lib/deviceTrust";
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

export default function SignIn({ language, onLanguageChange }: SignInProps) {
  useSEO(pageSEO.login);
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const { trackUserAuth, trackEvent } = useAnalytics();
  const { user, logout, enableDevMode } = useFirebaseAuth();
  const [loading, setLoading] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyAvailable] = useState(isPasskeySupported());
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [rememberDevice, setRememberDevice] = useState(false);
  const [passwordFailureCount, setPasswordFailureCount] = useState(0);
  const [magicLinkResendCountdown, setMagicLinkResendCountdown] = useState(0);
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const [forcePasswordMode, setForcePasswordMode] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  
  const autoFaceID = useAutoFaceID({
    language,
    enabled: !user && !switchingAccount && passkeyAvailable && !forcePasswordMode && !isDeviceTrusted(),
    onSuccess: () => {
      logger.info("Auto Face ID: Login successful, redirecting to dashboard");
    },
    onFailure: (error) => {
      logger.info("Auto Face ID: Login failed, showing manual form", { error });
      setShowFallbackHint(true);
    }
  });
  
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
  
  useEffect(() => {
    if (magicLinkResendCountdown > 0) {
      const timer = setTimeout(() => {
        setMagicLinkResendCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [magicLinkResendCountdown]);
  
  // Handle iOS redirect result on page load
  useEffect(() => {
    const handleRedirectSignIn = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          logger.info('[iOS Auth] Redirect sign-in successful', { email: result.user.email });
          
          const idToken = await result.user.getIdToken();
          const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken }),
          });

          if (!sessionResponse.ok) {
            throw new Error('Failed to create session');
          }
          
          if (rememberDevice && result.user.uid && result.user.email) {
            trustDevice(result.user.uid, result.user.email);
          }
          
          const { trackLogin } = await import('@/lib/analytics');
          trackLogin('google', result.user.uid);
          
          toast({
            title: t('signin.successTitle', language),
            description: t('signin.redirecting', language),
          });

          setTimeout(() => {
            window.scrollTo(0, 0);
            navigate("/");
          }, 1000);
        }
      } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
          logger.error('[iOS Auth] Redirect result error:', error);
        }
      }
    };
    
    handleRedirectSignIn();
  }, []);

  // Handle Magic Link return - detect when user clicks magic link from email
  useEffect(() => {
    const handleMagicLinkReturn = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        
        if (!email) {
          email = window.prompt(language === 'he' ? 'אנא הזן את כתובת האימייל שלך לאימות:' : 'Please provide your email for confirmation:');
        }
        
        if (!email) return;
        
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

          setTimeout(() => {
            window.scrollTo(0, 0);
            navigate("/");
          }, 1000);
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
          navigate("/");
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
      navigate("/");
    }
  }, [user, switchingAccount, loading, navigate]);

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
        navigate("/");
      } else {
        let errorDescription = result.error || t('signin.failed', language);
        
        if (isChromeiOS()) {
          errorDescription = language === 'he'
            ? `${result.error || "נכשל להתחבר"}. טיפ: נסה Safari לחווית Face ID טובה יותר.`
            : `${result.error || "Failed to sign in"}. Tip: Try Safari for better Face ID experience.`;
        }
        
        toast({
          variant: "destructive",
          title: t('signin.error', language),
          description: errorDescription,
        });

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
        navigate("/");
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

  const handleSocialLogin = async (provider: 'google') => {
    await performOAuthLogin(provider);
  };

  const performOAuthLogin = async (provider: 'google') => {
    try {
      setSocialLoading(provider);
      
      const authProvider = createGoogleProvider();
      
      // Log device info for debugging
      const deviceInfo = getDeviceInfo();
      logger.info('[Auth] Device info:', deviceInfo);
      
      // Use iOS-compatible auth method (redirect for iOS, popup for others)
      const userCredential = await signInWithBestMethod(auth, authProvider);
      
      // If redirect method was used, userCredential will be null
      // The redirect result will be handled by the useEffect on page load
      if (!userCredential) {
        logger.info('[iOS Auth] Redirect initiated, waiting for return...');
        return; // Early return - auth will complete after redirect
      }
      
      let grantedScopes: string[] = [];
      try {
        grantedScopes = GoogleAuthProvider.credentialFromResult(userCredential)?.accessToken ? ['email', 'profile'] : [];
      } catch (scopeError) {
        logger.warn('Could not set OAuth scopes:', scopeError);
      }
      
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

      setTimeout(() => {
        window.scrollTo(0, 0);
        navigate("/");
      }, 1000);
    } catch (error: any) {
      logger.error("Social login error:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
      
      if (error.code === 'auth/popup-blocked') {
        toast({
          variant: "destructive",
          title: t('signin.popupBlocked', language),
          description: t('signin.allowPopups', language),
        });
        return;
      }
      
      toast({
        variant: "destructive",
        title: t('signin.error', language),
        description: error.message || t('signin.failed', language),
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

  // Phone Auth Handlers - Twilio SMS Verification
  const handleSendPhoneCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'הזן מספר טלפון תקין' : 'Please enter a valid phone number',
      });
      return;
    }

    setPhoneLoading(true);
    try {
      // Format phone number with Israel country code if not present
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.startsWith('0') 
          ? `+972${formattedPhone.substring(1)}` 
          : `+972${formattedPhone}`;
      }

      logger.info('[PhoneAuth] Sending code to:', formattedPhone);
      
      const response = await fetch(getApiUrl('/api/auth/phone/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: formattedPhone, language }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || result.message || 'Failed to send code');
      }

      setConfirmationResult({ phone: formattedPhone } as any);

      toast({
        title: language === 'he' ? 'קוד נשלח' : 'Code Sent',
        description: language === 'he' ? 'בדוק את הודעות ה-SMS שלך' : 'Check your SMS messages',
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
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: error.message || (language === 'he' ? 'נכשל לשלוח קוד' : 'Failed to send code'),
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

  const handleVerifyPhoneCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'הזן קוד אימות בן 6 ספרות' : 'Enter 6-digit verification code',
      });
      return;
    }

    if (!confirmationResult?.phone) {
      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'שלח קוד אימות קודם' : 'Send verification code first',
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
          code: verificationCode,
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

      setTimeout(() => {
        window.scrollTo(0, 0);
        navigate("/");
      }, 1000);
    } catch (error: any) {
      logger.error('[PhoneAuth] Verification failed:', error);

      toast({
        variant: "destructive",
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: error.message || (language === 'he' ? 'אימות נכשל' : 'Verification failed'),
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
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      
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
      
      setTimeout(() => {
        window.scrollTo(0, 0);
        navigate("/");
      }, 1000);
    } catch (error: any) {
      logger.error("Email/password sign-in error:", error);
      
      setPasswordFailureCount(prev => prev + 1);
      
      let errorMessage = t('signin.failed', language);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
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
          <div className="w-16 h-16 bg-black rounded-full mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-black">
              {t('auth.signedInAs', language)}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/")}
              className="bg-black hover:bg-gray-800 text-white rounded-full px-8"
              data-testid="button-go-to-dashboard"
            >
              {t('auth.goToDashboard', language)}
            </Button>
            <Button
              onClick={handleSwitchAccount}
              variant="ghost"
              className="text-black hover:bg-gray-100 rounded-full px-8"
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
      <div className="min-h-screen luxury-bg-mesh">
        <div className="flex items-center justify-center px-4 sm:px-6 md:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-md"
        >
          <div className="luxury-glass-card p-8 space-y-8 relative border-t-4 border-t-[#0f3460] shadow-[0_8px_40px_rgba(15,52,96,0.12),0_2px_8px_rgba(0,0,0,0.06)]">
          {/* Close/Back Button */}
          <button
            onClick={() => navigate("/")}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label={t('common.close', language)}
            data-testid="button-close-signin"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6, delay: 0.2 }}
              className="w-20 h-20 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-3xl mx-auto flex items-center justify-center shadow-[0_8px_32px_rgba(15,52,96,0.4)]"
            >
              <Sparkles className="w-10 h-10 text-amber-400" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#1a1a2e] via-[#0f3460] to-[#533483] bg-clip-text text-transparent">
                {t('signin.welcomeBack', language)}
              </h1>
              <p className="text-gray-600 text-base sm:text-lg">
                {t('signin.signInContinue', language)}
              </p>
            </div>
          </motion.div>

          {/* Social Login Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-3"
          >
            <Button
              onClick={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-14 sm:h-16 lg:h-14 text-base font-semibold border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-900 rounded-2xl shadow-sm hover:shadow-md transition-all"
              data-testid="button-gmail-signin"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <SiGmail className="w-5 h-5 sm:w-6 sm:h-6 mr-3 text-red-500" />
                  <span className="text-gray-800">{t('signin.continueGmail', language)}</span>
                </>
              )}
            </Button>

            {passkeyAvailable && (
              <Button
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="w-full h-14 sm:h-16 lg:h-14 text-base font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] hover:from-[#0f3460] hover:to-[#1a1a2e] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0"
                data-testid="button-passkey-signin"
              >
                {passkeyLoading ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <>
                    {/Android/.test(navigator.userAgent) ? (
                      <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                    ) : (
                      <ScanFace className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                    )}
                    {getBiometricButtonLabel(language)}
                  </>
                )}
              </Button>
            )}

            {/* PIN Login Option - Only available for trusted devices */}
            {isPinLoginAvailable && (
              <Button
                onClick={() => setPinMode(true)}
                variant="outline"
                className="w-full h-14 sm:h-16 lg:h-14 text-base font-semibold border-2 border-[#533483]/30 bg-[#533483]/5 hover:bg-[#533483]/10 text-[#533483] rounded-2xl shadow-sm hover:shadow-md transition-all"
                data-testid="button-pin-signin"
              >
                <KeyRound className="w-5 h-5 sm:w-6 sm:h-6 mr-3 text-[#533483]" />
                {language === 'he' ? 'התחבר עם קוד PIN' : 'Sign in with PIN'}
              </Button>
            )}

            {/* Phone Login Option */}
            <Button
              onClick={() => setPhoneMode(true)}
              variant="outline"
              className="w-full h-14 sm:h-16 lg:h-14 text-base font-semibold border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 text-emerald-800 rounded-2xl shadow-sm hover:shadow-md transition-all"
              data-testid="button-phone-signin"
            >
              <Phone className="w-5 h-5 sm:w-6 sm:h-6 mr-3 text-emerald-600" />
              <span className="text-emerald-800">{language === 'he' ? 'התחבר עם טלפון' : 'Sign in with Phone'}</span>
            </Button>

            {/* Dev Mode Button - For Testing Only */}
            {import.meta.env.DEV && (
              <Button
                onClick={() => {
                  enableDevMode();
                  toast({
                    title: language === 'he' ? 'מצב פיתוח מופעל' : 'Dev Mode Enabled',
                    description: language === 'he' ? 'משתמש בדיקה מחובר' : 'Test user logged in',
                  });
                  setTimeout(() => navigate("/"), 500);
                }}
                className="w-full h-14 text-base font-medium bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                data-testid="button-dev-mode"
              >
                <User className="w-5 h-5 mr-3" />
                {language === 'he' ? '🔧 מצב פיתוח (ללא התחברות)' : '🔧 Dev Mode (Skip Login)'}
              </Button>
            )}
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#0f3460]/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">
                {t('signin.or', language)}
              </span>
            </div>
          </motion.div>

          {/* PIN Login Mode */}
          {pinMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                  className="h-14 text-base rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-[#0f3460] focus:bg-white focus:ring-2 focus:ring-[#0f3460]/20 text-gray-900 placeholder:text-gray-400 transition-all"
                  data-testid="input-pin-email"
                />
              </div>
              
              <div className="bg-gray-50/80 border border-gray-200 p-6 rounded-2xl">
                <h3 className="text-center text-lg font-medium mb-4 text-gray-900">
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
                className="w-full h-12 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                data-testid="button-back-from-pin"
              >
                {language === 'he' ? 'חזור להתחברות רגילה' : 'Back to regular sign in'}
              </Button>
            </motion.div>
          )}

          {/* Phone Login Mode */}
          {phoneMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="space-y-6"
            >
              <div className="bg-gray-50/80 border border-gray-200 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-center text-lg font-medium text-gray-900">
                  {language === 'he' ? 'התחבר עם טלפון' : 'Sign in with Phone'}
                </h3>
                
                {!confirmationResult ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">
                        {language === 'he' ? 'מספר טלפון' : 'Phone Number'}
                      </Label>
                      <Input
                        type="tel"
                        placeholder={language === 'he' ? '050-1234567' : '050-1234567'}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="h-14 text-base rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-gray-900 placeholder:text-gray-400 transition-all"
                        dir="ltr"
                        data-testid="input-phone-number"
                      />
                      <p className="text-xs text-gray-500">
                        {language === 'he' ? 'הזן מספר טלפון ישראלי (עם או בלי קידומת 972+)' : 'Enter Israeli phone number (with or without +972)'}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleSendPhoneCode}
                      disabled={phoneLoading || !phoneNumber}
                      className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0"
                      data-testid="button-send-phone-code"
                    >
                      {phoneLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {language === 'he' ? 'שלח קוד אימות' : 'Send Verification Code'}
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">
                        {language === 'he' ? 'קוד אימות' : 'Verification Code'}
                      </Label>
                      <Input
                        type="text"
                        placeholder="123456"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-14 text-base text-center rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-gray-900 placeholder:text-gray-400 tracking-widest font-mono transition-all"
                        maxLength={6}
                        dir="ltr"
                        data-testid="input-verification-code"
                      />
                      <p className="text-xs text-gray-500 text-center">
                        {language === 'he' ? 'הזן את הקוד בן 6 הספרות שנשלח ל-SMS' : 'Enter the 6-digit code sent to your phone'}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleVerifyPhoneCode}
                      disabled={phoneLoading || verificationCode.length < 6}
                      className="w-full h-14 text-base font-semibold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0"
                      data-testid="button-verify-phone-code"
                    >
                      {phoneLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {language === 'he' ? 'אמת והתחבר' : 'Verify & Sign In'}
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => {
                        setConfirmationResult(null);
                        setVerificationCode('');
                      }}
                      variant="ghost"
                      className="w-full h-10 text-sm text-gray-500"
                      data-testid="button-resend-code"
                    >
                      {language === 'he' ? 'שלח קוד חדש' : 'Resend Code'}
                    </Button>
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
                  if (recaptchaVerifierRef.current) {
                    recaptchaVerifierRef.current.clear();
                    recaptchaVerifierRef.current = null;
                  }
                }}
                variant="ghost"
                className="w-full h-12 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                data-testid="button-back-from-phone"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {language === 'he' ? 'חזור להתחברות רגילה' : 'Back to regular sign in'}
              </Button>
            </motion.div>
          )}

          {/* Email/Password Form */}
          {!magicLinkMode && !showPasswordReset && !pinMode && !phoneMode && (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              onSubmit={handleEmailPasswordSignIn}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                  className="h-14 sm:h-16 lg:h-14 text-base sm:text-lg lg:text-base rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-[#0f3460] focus:bg-white focus:ring-2 focus:ring-[#0f3460]/20 text-gray-900 placeholder:text-gray-400 transition-all"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder={t('signin.passwordPlaceholder', language)}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  autoComplete="current-password"
                  className="h-14 sm:h-16 lg:h-14 text-base sm:text-lg lg:text-base rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-[#0f3460] focus:bg-white focus:ring-2 focus:ring-[#0f3460]/20 text-gray-900 placeholder:text-gray-400 transition-all"
                  data-testid="input-password"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 sm:h-16 lg:h-14 text-base sm:text-lg lg:text-base font-semibold bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] hover:from-[#0f3460] hover:via-[#16213e] hover:to-[#1a1a2e] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0"
                data-testid="button-email-signin"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <>
                    {t('signin.signInButton', language)}
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 ml-3" />
                  </>
                )}
              </Button>

              {/* Remember This Device */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="remember-device"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#0f3460] focus:ring-[#0f3460]/20 cursor-pointer"
                  data-testid="checkbox-remember-device"
                />
                <label htmlFor="remember-device" className="text-sm text-gray-600 cursor-pointer select-none">
                  {language === 'he' ? 'זכור מכשיר זה ל-30 יום' : 'Remember this device for 30 days'}
                </label>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-[#0f3460] hover:text-[#533483] font-medium transition-colors"
                  data-testid="link-forgot-password"
                >
                  {t('signin.forgotPassword', language)}
                </button>
                <Link href="/signup" className="text-[#0f3460] hover:text-[#533483] font-medium transition-colors" data-testid="link-signup">
                  {t('signin.signUpLink', language)}
                </Link>
              </div>
            </motion.form>
          )}

          {/* Magic Link Mode */}
          {magicLinkMode && !showPasswordReset && (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              onSubmit={handleMagicLinkSignIn}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={magicLinkSent}
                  className="h-14 text-base rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-[#0f3460] focus:bg-white focus:ring-2 focus:ring-[#0f3460]/20 text-gray-900 placeholder:text-gray-400 transition-all disabled:opacity-60"
                  data-testid="input-magic-link-email"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || magicLinkSent || magicLinkResendCountdown > 0}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] hover:from-[#0f3460] hover:via-[#16213e] hover:to-[#1a1a2e] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0"
                data-testid="button-send-magic-link"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : magicLinkResendCountdown > 0 ? (
                  <>
                    {t('signin.waitSeconds', language).replace('{seconds}', magicLinkResendCountdown.toString())}
                  </>
                ) : magicLinkSent ? (
                  <>
                    <Mail className="w-5 h-5 mr-3" />
                    {t('signin.resend', language)}
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-3" />
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
                className="w-full h-12 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                data-testid="button-back-to-password"
              >
                {t('signin.backToPassword', language)}
              </Button>
            </motion.form>
          )}

          {/* Password Reset Mode */}
          {showPasswordReset && (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              onSubmit={handlePasswordReset}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={passwordResetSent}
                  className="h-14 text-base rounded-2xl border-2 border-gray-200 bg-gray-50/50 focus:border-[#0f3460] focus:bg-white focus:ring-2 focus:ring-[#0f3460]/20 text-gray-900 placeholder:text-gray-400 transition-all disabled:opacity-60"
                  data-testid="input-reset-email"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || passwordResetSent}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] hover:from-[#0f3460] hover:via-[#16213e] hover:to-[#1a1a2e] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all border-0"
                data-testid="button-reset-password"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
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
                className="w-full h-12 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                data-testid="button-back-to-signin"
              >
                {t('signin.backToSignIn', language)}
              </Button>
            </motion.form>
          )}

          {/* Additional Options */}
          {!magicLinkMode && !showPasswordReset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-center"
            >
              <button
                onClick={() => setMagicLinkMode(true)}
                className="text-sm text-[#0f3460] hover:text-[#533483] font-medium transition-colors"
                data-testid="link-magic-link"
              >
                {t('signin.preferMagicLink', language)}
              </button>
            </motion.div>
          )}
          </div>
        </motion.div>
      </div>
      <ReCaptcha language={language} />
      {/* Firebase Phone Auth reCAPTCHA container - must be present in DOM */}
      <div id="recaptcha-container-signin" />
      </div>
    </Layout>
  );
}
