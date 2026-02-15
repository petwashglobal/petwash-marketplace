import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, getAdditionalUserInfo } from "firebase/auth";
import { signInWithBestMethod, isIOS, createGoogleProvider, createAppleProvider, createFacebookProvider, getDeviceInfo } from "@/lib/iosAuthHandler";
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
import { SiGmail, SiApple, SiFacebook, SiTiktok, SiInstagram } from "react-icons/si";
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
  
  // Handle post-redirect navigation
  // Auth-guardian-2025.ts is the SOLE handler for getRedirectResult (runs on import in main.tsx).
  // This effect only checks the sessionStorage flag that auth-guardian sets after processing.
  useEffect(() => {
    if (sessionStorage.getItem('pw_redirect_handled') === 'true') {
      sessionStorage.removeItem('pw_redirect_handled');
      logger.info('[Auth] Redirect handled by auth-guardian, navigating to dashboard');
      navigate('/dashboard');
    }
  }, []);

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
        
        const redirectPath = isNew ? '/onboarding' : '/dashboard';
        setTimeout(() => {
          window.scrollTo(0, 0);
          navigate(redirectPath);
        }, 1000);
      } catch (error: any) {
        logger.error(`[Auth] ${oauthProvider} OAuth custom token sign-in failed:`, error);
        toast({
          variant: 'destructive',
          title: language === 'he' ? 'שגיאה בהתחברות' : 'Sign-in error',
          description: language === 'he' ? 'ההתחברות נכשלה. אנא נסו שוב.' : 'Sign-in failed. Please try again.',
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
            navigate("/dashboard");
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
          navigate("/dashboard");
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
      navigate("/dashboard");
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
        navigate("/dashboard");
      } else {
        let errorDescription = result.error || t('signin.failed', language);
        
        if (result.error === 'NO_EMAIL') {
          errorDescription = language === 'he'
            ? 'הזינו את כתובת האימייל שלכם כדי להתחבר עם Face ID'
            : 'Enter your email address to sign in with Face ID';
        } else if (isChromeiOS()) {
          errorDescription = language === 'he'
            ? `${result.error || "נכשל להתחבר"}. טיפ: נסה Safari לחווית Face ID טובה יותר.`
            : `${result.error || "Failed to sign in"}. Tip: Try Safari for better Face ID experience.`;
        }
        
        toast({
          variant: "destructive",
          title: language === 'he' ? 'שגיאה בהתחברות' : 'Sign-in error',
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
        navigate("/dashboard");
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
      
      const isEmbeddedWebview = /Replit-Bonsai|wv|WebView/i.test(navigator.userAgent);
      const isIOSDevice = isIOS();
      
      let userCredential: import('firebase/auth').UserCredential | null = null;
      
      if (isEmbeddedWebview || isIOSDevice) {
        logger.info(`[Auth] iOS/webview detected, using redirect auth for ${provider}`);
        await signInWithBestMethod(auth, authProvider, 'redirect');
        return;
      }
      
      try {
        userCredential = await signInWithPopup(auth, authProvider);
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
          logger.info(`[Auth] Popup blocked/closed for ${provider}, falling back to redirect`);
          await signInWithBestMethod(auth, authProvider, 'redirect');
          return;
        } else {
          throw popupErr;
        }
      }
      
      if (!userCredential) {
        logger.info('[Auth] Redirect initiated, waiting for return...');
        return;
      }

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
      const sessionResponse = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }

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

      const redirectPath = isNewUser ? '/onboarding' : '/dashboard';
      setTimeout(() => {
        window.scrollTo(0, 0);
        navigate(redirectPath);
      }, 1000);
    } catch (error: any) {
      logger.error("Social login error:", error);
      
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }
      
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
          en: 'Network error. Please check your connection and try again.',
          he: 'שגיאת רשת. בדקו את החיבור שלכם ונסו שוב.',
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
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        variant: "destructive",
        title: phoneErrTitle[language] || phoneErrTitle.en,
        description: phoneInvalidNum[language] || phoneInvalidNum.en,
      });
      return;
    }

    setPhoneLoading(true);
    try {
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
        throw new Error(result.error || result.message || (phoneCodeFail[language] || phoneCodeFail.en));
      }

      setConfirmationResult({ phone: formattedPhone } as any);

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

  const handleVerifyPhoneCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
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
        // Force a small delay to ensure cookie is set before navigation
        navigate("/dashboard");
      }, 1200);
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
        // Force a small delay to ensure cookie is set before navigation
        navigate("/dashboard");
      }, 1200);
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
              onClick={() => navigate("/dashboard")}
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
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center px-4 sm:px-6 md:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg lg:max-w-xl"
        >
          <div className="bg-white p-6 sm:p-10 lg:p-12 space-y-6 relative border border-neutral-200 rounded-sm shadow-[0_2px_20px_rgba(0,0,0,0.06)]">
          <button
            onClick={() => navigate("/dashboard")}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 transition-colors z-10"
            aria-label={t('common.close', language)}
            data-testid="button-close-signin"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center space-y-3 pt-2"
          >
            <div className="w-[1px] h-8 bg-neutral-300 mx-auto mb-4" />
            <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-neutral-900 uppercase" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", letterSpacing: '0.15em' }}>
              {t('signin.welcomeBack', language)}
            </h1>
            <p className="text-neutral-500 text-sm tracking-wider uppercase" style={{ letterSpacing: '0.12em' }}>
              {t('signin.signInContinue', language)}
            </p>
            <div className="w-12 h-[1px] bg-neutral-300 mx-auto mt-3" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-3"
          >
            <Button
              onClick={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-none tracking-wider uppercase transition-all"
              data-testid="button-gmail-signin"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <SiGmail className="w-4 h-4 mr-3 text-red-500" />
                  <span>{t('signin.continueGmail', language)}</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => handleSocialLogin('apple')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all"
              data-testid="button-apple-signin"
            >
              {socialLoading === 'apple' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <SiApple className="w-4 h-4 mr-3" />
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
                  <SiFacebook className="w-4 h-4 mr-3" />
                  <span>{language === 'he' ? 'המשך עם Facebook' : 'Continue with Facebook'}</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => handleExternalOAuth('tiktok')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-black hover:bg-neutral-900 text-white rounded-none tracking-wider uppercase transition-all"
              data-testid="button-tiktok-signin"
            >
              {socialLoading === 'tiktok' as any ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <SiTiktok className="w-4 h-4 mr-3" />
                  <span>{language === 'he' ? 'המשך עם TikTok' : 'Continue with TikTok'}</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => handleExternalOAuth('instagram')}
              disabled={!!socialLoading}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 text-white rounded-none tracking-wider uppercase transition-all"
              style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
              data-testid="button-instagram-signin"
            >
              {socialLoading === 'instagram' as any ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <SiInstagram className="w-4 h-4 mr-3" />
                  <span>{language === 'he' ? 'המשך עם Instagram' : 'Continue with Instagram'}</span>
                </>
              )}
            </Button>

            {passkeyAvailable && (
              <Button
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="w-full h-13 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0"
                data-testid="button-passkey-signin"
              >
                {passkeyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {/Android/.test(navigator.userAgent) ? (
                      <Fingerprint className="w-4 h-4 mr-3" />
                    ) : (
                      <ScanFace className="w-4 h-4 mr-3" />
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
                className="w-full h-13 text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 rounded-none tracking-wider uppercase transition-all"
                data-testid="button-pin-signin"
              >
                <KeyRound className="w-4 h-4 mr-3 text-neutral-500" />
                {language === 'he' ? 'התחבר עם קוד PIN' : 'Sign in with PIN'}
              </Button>
            )}

            <Button
              onClick={() => setPhoneMode(true)}
              variant="outline"
              className="w-full h-13 text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 rounded-none tracking-wider uppercase transition-all"
              data-testid="button-phone-signin"
            >
              <Phone className="w-4 h-4 mr-3 text-neutral-500" />
              <span>{language === 'he' ? 'התחבר עם טלפון' : 'Sign in with Phone'}</span>
            </Button>

            {import.meta.env.DEV && (
              <Button
                onClick={() => {
                  enableDevMode();
                  toast({
                    title: language === 'he' ? 'מצב פיתוח מופעל' : 'Dev Mode Enabled',
                    description: language === 'he' ? 'משתמש בדיקה מחובר' : 'Test user logged in',
                  });
                  setTimeout(() => navigate("/dashboard"), 500);
                }}
                className="w-full h-13 text-sm font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-none border border-neutral-200 tracking-wider uppercase"
                data-testid="button-dev-mode"
              >
                <User className="w-4 h-4 mr-3" />
                {language === 'he' ? 'מצב פיתוח (ללא התחברות)' : 'Dev Mode (Skip Login)'}
              </Button>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-white text-neutral-400 uppercase tracking-widest">
                {t('signin.or', language)}
              </span>
            </div>
          </motion.div>

          {pinMode && (
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
                  autoComplete="email"
                  className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all"
                  data-testid="input-pin-email"
                />
              </div>
              
              <div className="bg-neutral-50 border border-neutral-200 p-6">
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
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-none transition-all tracking-wider uppercase"
                data-testid="button-back-from-pin"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                {language === 'he' ? 'חזור להתחברות רגילה' : 'Back to regular sign in'}
              </Button>
            </motion.div>
          )}

          {phoneMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-5"
            >
              <div className="bg-neutral-50 border border-neutral-200 p-6 space-y-4">
                <h3 className="text-center text-sm font-medium text-neutral-800 uppercase tracking-wider">
                  {language === 'he' ? 'התחבר עם טלפון' : 'Sign in with Phone'}
                </h3>
                
                {!confirmationResult ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-neutral-500 uppercase tracking-wider">
                        {language === 'he' ? 'מספר טלפון' : 'Phone Number'}
                      </Label>
                      <Input
                        type="tel"
                        placeholder="050-1234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="h-12 text-sm rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 transition-all"
                        dir="ltr"
                        data-testid="input-phone-number"
                      />
                      <p className="text-[11px] text-neutral-400 tracking-wide">
                        {language === 'he' ? 'הזן מספר טלפון ישראלי (עם או בלי קידומת 972+)' : 'Enter Israeli phone number (with or without +972)'}
                      </p>
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
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-neutral-500 uppercase tracking-wider">
                        {language === 'he' ? 'קוד אימות' : 'Verification Code'}
                      </Label>
                      <Input
                        type="text"
                        placeholder="123456"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-12 text-sm text-center rounded-none border border-neutral-200 bg-white focus:border-neutral-900 focus:ring-0 text-neutral-900 placeholder:text-neutral-400 tracking-[0.3em] font-mono transition-all"
                        maxLength={6}
                        dir="ltr"
                        data-testid="input-verification-code"
                      />
                      <p className="text-[11px] text-neutral-400 text-center tracking-wide">
                        {language === 'he' ? 'הזן את הקוד בן 6 הספרות שנשלח ל-SMS' : 'Enter the 6-digit code sent to your phone'}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleVerifyPhoneCode}
                      disabled={phoneLoading || verificationCode.length < 6}
                      className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0"
                      data-testid="button-verify-phone-code"
                    >
                      {phoneLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {language === 'he' ? 'אמת והתחבר' : 'Verify & Sign In'}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmationResult(null);
                        setVerificationCode('');
                      }}
                      className="w-full text-xs text-neutral-400 hover:text-neutral-700 tracking-wider uppercase py-2 transition-colors"
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
                  if (recaptchaVerifierRef.current) {
                    recaptchaVerifierRef.current.clear();
                    recaptchaVerifierRef.current = null;
                  }
                }}
                variant="ghost"
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-none transition-all tracking-wider uppercase"
                data-testid="button-back-from-phone"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                {language === 'he' ? 'חזור להתחברות רגילה' : 'Back to regular sign in'}
              </Button>
            </motion.div>
          )}

          {!magicLinkMode && !showPasswordReset && !pinMode && !phoneMode && (
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
                  autoComplete="email"
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
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-sm font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-none tracking-wider uppercase transition-all border-0"
                data-testid="button-email-signin"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t('signin.signInButton', language)}
                    <ArrowRight className="w-4 h-4 ml-2" />
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

          {magicLinkMode && !showPasswordReset && (
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
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-none tracking-wider uppercase transition-all"
                data-testid="button-back-to-password"
              >
                {t('signin.backToPassword', language)}
              </Button>
            </motion.form>
          )}

          {showPasswordReset && (
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
                className="w-full h-11 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-none tracking-wider uppercase transition-all"
                data-testid="button-back-to-signin"
              >
                {t('signin.backToSignIn', language)}
              </Button>
            </motion.form>
          )}

          {!magicLinkMode && !showPasswordReset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-center"
            >
              <button
                onClick={() => setMagicLinkMode(true)}
                className="text-xs text-neutral-400 hover:text-neutral-700 tracking-wider uppercase transition-colors"
                data-testid="link-magic-link"
              >
                {t('signin.preferMagicLink', language)}
              </button>
            </motion.div>
          )}

          <div className="pt-2 flex items-center justify-center">
            <ReCaptcha language={language} />
          </div>
          </div>
        </motion.div>
      </div>
      <div id="recaptcha-container-signin" />
      </div>
    </Layout>
  );
}
