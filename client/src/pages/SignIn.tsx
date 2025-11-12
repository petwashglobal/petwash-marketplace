import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendPasswordResetEmail, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, signInWithPopup, signInWithCustomToken, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Info, Fingerprint, Smartphone, ScanFace, Phone, User, Lock, ArrowRight, Sparkles } from "lucide-react";
import { FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa";
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
import { trustDevice, isDeviceTrusted, getTrustDaysRemaining } from "@/lib/deviceTrust";
import { motion, AnimatePresence } from "framer-motion";

interface SignInProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function SignIn({ language, onLanguageChange }: SignInProps) {
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

  // [Previous useEffect hooks for TikTok callback, conditional UI, auto-redirect, etc.]
  useEffect(() => {
    const handleTikTokCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tiktokToken = urlParams.get('tiktokToken');
      const oauthError = urlParams.get('oauthError');

      if (oauthError) {
        const errorMessages: Record<string, { en: string; he: string }> = {
          'cancelled': { en: 'Sign-in was cancelled', he: 'ההתחברות בוטלה' },
          'csrf_failed': { en: 'Security verification failed. Please try again.', he: 'אימות אבטחה נכשל. נסה שוב.' },
          'exchange_failed': { en: 'Failed to complete sign-in with TikTok', he: 'נכשל להתחבר עם TikTok' },
          'config_missing': { en: 'TikTok login is not configured. Please contact support.', he: 'התחברות TikTok לא מוגדרת. צור קשר עם התמיכה.' },
          'default': { en: 'An error occurred during sign-in', he: 'אירעה שגיאה בהתחברות' }
        };

        const errorMsg = errorMessages[oauthError] || errorMessages['default'];
        toast({
          variant: "destructive",
          title: t('signin.error', language),
          description: language === 'he' ? errorMsg.he : errorMsg.en,
        });

        trackEvent({
          action: 'tiktok_oauth_error',
          category: 'authentication',
          label: oauthError,
          language,
        });

        window.history.replaceState({}, document.title, '/signin');
        return;
      }

      if (tiktokToken) {
        try {
          setLoading(true);
          logger.info("TikTok OAuth callback detected, signing in with custom token");

          const userCredential = await signInWithCustomToken(auth, tiktokToken);
          const idToken = await userCredential.user.getIdToken();
          const sessionResponse = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken }),
          });

          if (!sessionResponse.ok) {
            throw new Error('Failed to create session');
          }

          const { trackLogin } = await import('@/lib/analytics');
          trackLogin('tiktok', userCredential.user.uid);
          
          trackEvent({
            action: 'tiktok_login',
            category: 'authentication',
            label: 'tiktok_success',
            language,
          });
          
          toast({
            title: t('signin.successTitle', language),
            description: t('signin.redirecting', language),
          });

          window.history.replaceState({}, document.title, '/signin');
          setTimeout(() => {
            window.scrollTo(0, 0);
            navigate("/");
          }, 1000);
        } catch (error: any) {
          logger.error("TikTok sign-in error:", error);
          toast({
            variant: "destructive",
            title: t('signin.error', language),
            description: error.message || t('signin.failedTikTok', language)
          });
          
          trackEvent({
            action: 'tiktok_oauth_error',
            category: 'authentication',
            label: error.code || 'unknown_error',
            language,
          });
          
          window.history.replaceState({}, document.title, '/signin');
        } finally {
          setLoading(false);
        }
      }
    };

    handleTikTokCallback();
  }, [language, navigate, toast, trackEvent]);
  
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

  const handleSocialLogin = async (provider: 'google' | 'yahoo' | 'microsoft' | 'facebook' | 'instagram' | 'tiktok') => {
    await performOAuthLogin(provider);
  };

  const performOAuthLogin = async (provider: 'google' | 'yahoo' | 'microsoft' | 'facebook' | 'instagram' | 'tiktok') => {
    try {
      setSocialLoading(provider);
      
      let authProvider;
      switch (provider) {
        case 'google':
          authProvider = new GoogleAuthProvider();
          authProvider.addScope('email');
          authProvider.addScope('profile');
          break;
        case 'yahoo':
          authProvider = new OAuthProvider("yahoo.com");
          break;
        case 'microsoft':
          authProvider = new OAuthProvider("microsoft.com");
          authProvider.addScope('email');
          break;
        case 'facebook':
          authProvider = new FacebookAuthProvider();
          break;
        case 'instagram':
          authProvider = new FacebookAuthProvider();
          authProvider.addScope('instagram_basic');
          break;
        case 'tiktok':
          window.location.href = '/api/auth/tiktok/start';
          return;
      }

      const userCredential = await signInWithPopup(auth, authProvider);
      
      let grantedScopes: string[] = [];
      try {
        if (provider === 'google') {
          grantedScopes = ['email', 'profile'];
        } else if (provider === 'yahoo' || provider === 'microsoft') {
          grantedScopes = ['email'];
        } else if (provider === 'facebook' || provider === 'instagram') {
          grantedScopes = ['email', 'public_profile'];
        }
      } catch (scopeError) {
        logger.warn('Could not set OAuth scopes:', scopeError);
      }
      
      const idToken = await userCredential.user.getIdToken();
      const sessionResponse = await fetch('/api/auth/session', {
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
        const consentResponse = await fetch('/api/consent/oauth', {
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

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      
      const idToken = await userCredential.user.getIdToken();
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }

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
    return <FaceIDLoadingState language={language} onCancel={handleUsePasswordInstead} />;
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
    <div className="min-h-screen bg-white">
      <Header language={language} onLanguageChange={onLanguageChange} />
      
      <div className="flex items-center justify-center px-4 sm:px-6 md:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-md space-y-8"
        >
          {/* Logo */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="w-20 h-20 bg-black rounded-3xl mx-auto flex items-center justify-center"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-4xl font-bold text-black tracking-tight">
                {t('signin.welcomeBack', language)}
              </h1>
              <p className="text-gray-500 text-base sm:text-lg md:text-lg lg:text-base">
                {t('signin.signInContinue', language)}
              </p>
            </div>
          </div>

          {/* Social Login Buttons - 7-Star Luxury with HD Icons */}
          <div className="space-y-3">
            {/* Gmail - Primary */}
            <Button
              onClick={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              className="w-full bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-red-300 rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14 shadow-sm hover:shadow-md"
              data-testid="button-gmail-signin"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <SiGmail className="w-5 h-5 sm:w-6 sm:h-6 mr-3 text-red-600" />
                  {t('signin.continueGmail', language)}
                </>
              )}
            </Button>

            {/* Yahoo */}
            <Button
              onClick={() => handleSocialLogin('yahoo')}
              disabled={!!socialLoading}
              className="w-full bg-[#6001D2] hover:bg-[#5001B2] text-white rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14 shadow-sm hover:shadow-md"
              data-testid="button-yahoo-signin"
            >
              {socialLoading === 'yahoo' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                  {t('signin.continueYahoo', language)}
                </>
              )}
            </Button>

            {/* Microsoft */}
            <Button
              onClick={() => handleSocialLogin('microsoft')}
              disabled={!!socialLoading}
              className="w-full bg-[#00A4EF] hover:bg-[#0078D4] text-white rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14 shadow-sm hover:shadow-md"
              data-testid="button-microsoft-signin"
            >
              {socialLoading === 'microsoft' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                  {t('signin.continueMicrosoft', language)}
                </>
              )}
            </Button>

            {/* Facebook */}
            <Button
              onClick={() => handleSocialLogin('facebook')}
              disabled={!!socialLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14 shadow-sm hover:shadow-md"
              data-testid="button-facebook-signin"
            >
              {socialLoading === 'facebook' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <FaFacebook className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                  {t('signin.continueFacebook', language)}
                </>
              )}
            </Button>

            {/* Instagram */}
            <Button
              onClick={() => handleSocialLogin('instagram')}
              disabled={!!socialLoading}
              className="w-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 text-white rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14 shadow-sm hover:shadow-md"
              data-testid="button-instagram-signin"
            >
              {socialLoading === 'instagram' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <FaInstagram className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                  {t('signin.continueInstagram', language)}
                </>
              )}
            </Button>

            {/* TikTok */}
            <Button
              onClick={() => handleSocialLogin('tiktok')}
              disabled={!!socialLoading}
              className="w-full bg-black hover:bg-gray-900 text-white rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14 shadow-sm hover:shadow-md"
              data-testid="button-tiktok-signin"
            >
              {socialLoading === 'tiktok' ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <>
                  <FaTiktok className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                  {t('signin.continueTikTok', language)}
                </>
              )}
            </Button>

            {passkeyAvailable && (
              <Button
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="w-full bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white rounded-2xl h-14 text-base font-medium transition-all duration-200 sm:h-16 md:h-16 lg:h-14"
                data-testid="button-passkey-signin"
              >
                {passkeyLoading ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <>
                    <ScanFace className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                    {t('signin.continueFaceID', language)}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">
                {t('signin.or', language)}
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          {!magicLinkMode && !showPasswordReset && (
            <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                  className="h-14 sm:h-16 md:h-16 lg:h-14 rounded-2xl border-2 border-gray-200 text-base sm:text-lg md:text-lg lg:text-base bg-white text-black placeholder:text-gray-400"
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
                  className="h-14 sm:h-16 md:h-16 lg:h-14 rounded-2xl border-2 border-gray-200 text-base sm:text-lg md:text-lg lg:text-base bg-white text-black placeholder:text-gray-400"
                  data-testid="input-password"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-black hover:bg-gray-800 text-white rounded-2xl h-14 sm:h-16 md:h-16 lg:h-14 text-base sm:text-lg md:text-lg lg:text-base font-medium transition-all duration-200"
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

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-gray-600 hover:text-black transition-colors"
                  data-testid="link-forgot-password"
                >
                  {t('signin.forgotPassword', language)}
                </button>
                <Link href="/signup" className="text-black hover:text-gray-600 font-medium transition-colors" data-testid="link-signup">
                  {t('signin.signUpLink', language)}
                </Link>
              </div>
            </form>
          )}

          {/* Magic Link Mode */}
          {magicLinkMode && !showPasswordReset && (
            <form onSubmit={handleMagicLinkSignIn} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={magicLinkSent}
                  className="h-14 rounded-2xl border-2 border-gray-200 text-base bg-white text-black placeholder:text-gray-400"
                  data-testid="input-magic-link-email"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || magicLinkSent || magicLinkResendCountdown > 0}
                className="w-full bg-black hover:bg-gray-800 text-white rounded-2xl h-14 text-base font-medium transition-all duration-200"
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
                className="w-full text-black hover:bg-gray-100 rounded-2xl h-12"
                data-testid="button-back-to-password"
              >
                {t('signin.backToPassword', language)}
              </Button>
            </form>
          )}

          {/* Password Reset Mode */}
          {showPasswordReset && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t('signin.emailPlaceholder', language)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={passwordResetSent}
                  className="h-14 rounded-2xl border-2 border-gray-200 text-base bg-white text-black placeholder:text-gray-400"
                  data-testid="input-reset-email"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || passwordResetSent}
                className="w-full bg-black hover:bg-gray-800 text-white rounded-2xl h-14 text-base font-medium transition-all duration-200"
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
                className="w-full text-black hover:bg-gray-100 rounded-2xl h-12"
                data-testid="button-back-to-signin"
              >
                {t('signin.backToSignIn', language)}
              </Button>
            </form>
          )}

          {/* Additional Options */}
          {!magicLinkMode && !showPasswordReset && (
            <div className="text-center">
              <button
                onClick={() => setMagicLinkMode(true)}
                className="text-sm text-gray-600 hover:text-black transition-colors"
                data-testid="link-magic-link"
              >
                {t('signin.preferMagicLink', language)}
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <Footer language={language} />
      <ReCaptcha language={language} />
    </div>
  );
}
