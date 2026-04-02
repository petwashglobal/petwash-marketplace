import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile, signInWithCustomToken, getAdditionalUserInfo } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getAuthStrategy, createGoogleProvider, createAppleProvider, createFacebookProvider, getDeviceInfo } from "@/lib/iosAuthHandler";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { syncUser } from "@/lib/hubspot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeDateSelect } from '@/components/ui/native-date-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, MapPin, Fingerprint, Shield, Sparkles, X, Phone, ChevronRight, ArrowLeft, Info } from "lucide-react";
import { FaGoogle, FaApple, FaFacebook } from "react-icons/fa";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useAnalytics } from "@/hooks/useAnalytics";
import { trackSignUp } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerPasskey, isPasskeySupported, getBiometricMethodName } from "@/auth/passkey";
import { motion, AnimatePresence } from "framer-motion";
import { getApiUrl } from '@/lib/apiConfig';
import { PhoneInput } from '@/components/PhoneInput';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { executeReCaptcha, preloadReCaptcha } from '@/components/ReCaptcha';
import { TurnstileWidget, TURNSTILE_CONFIGURED, executeTurnstileInvisible } from '@/components/TurnstileWidget';

interface SignUpProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function SignUp({ language, onLanguageChange }: SignUpProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { trackEvent } = useAnalytics();
  const { user, loading: authLoading } = useFirebaseAuth();
  const [loading, setLoading] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [geoDetected, setGeoDetected] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [stepUpPending, setStepUpPending] = useState(false);
  const [pendingCaptchaToken, setPendingCaptchaToken] = useState<string | null>(null);

  // ── Social / phone signup state ───────────────────────────────────────────
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [signupMode, setSignupMode] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<{ phone: string } | null>(null);
  const [webviewBlocked, setWebviewBlocked] = useState(false);
  const [phoneTermsAccepted, setPhoneTermsAccepted] = useState(false);

  // Detect in-app browsers (Instagram, TikTok) that block OAuth popups
  useEffect(() => {
    const ua = navigator.userAgent;
    const isInstagram = /Instagram/i.test(ua);
    const isTikTok = /BytedanceWebview|musical_ly/i.test(ua);
    const isGenericWebview = /wv|WebView/i.test(ua);
    setWebviewBlocked(isInstagram || isTikTok || isGenericWebview);
  }, []);

  const prefilledEmail = new URLSearchParams(window.location.search).get('email') || '';
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: prefilledEmail,
    phone: "",
    password: "",
    dob: "",
    country: "Israel",
    loyaltyProgram: false,
    reminders: false,
    marketing: false,
    pushNotifications: false,
    acceptedTerms: false,
  });
  
  logger.debug("SignUp component rendered", { acceptedTerms: formData.acceptedTerms });

  // Pre-warm reCAPTCHA on page mount so script is already loaded when user submits
  useEffect(() => { preloadReCaptcha(); }, []);

  // Auto-redirect logged-in users to dashboard
  useEffect(() => {
    if (user && !authLoading) {
      logger.info("User already logged in, auto-redirecting to dashboard");
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  // Auto-detect location on component mount
  useEffect(() => {
    const detectLocation = async () => {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        logger.debug("Geolocation not available");
        return;
      }

      setGeoLoading(true);
      logger.debug("Starting geolocation detection");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            logger.debug("Coordinates obtained", { latitude, longitude });

            // Use reverse geocoding API to get country
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            
            if (response.ok) {
              const data = await response.json();
              const countryName = data.countryName || "Israel";
              
              logger.info("Country detected", { countryName });
              
              setFormData(prev => ({ ...prev, country: countryName }));
              setGeoDetected(true);
              
              toast({
                title: t('signUp.locationDetected', language),
                description: `${t('signUp.countryAutoFilled', language)}: ${countryName}`,
              });
            }
          } catch (error) {
            logger.error("Geocoding error", error);
          } finally {
            setGeoLoading(false);
          }
        },
        (error) => {
          logger.debug("Geolocation permission denied or error", { message: error.message });
          setGeoLoading(false);
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    };

    detectLocation();
  }, []); // Run once on mount

  // Handle language preference when language changes (force light mode for auth pages)
  useEffect(() => {
    document.documentElement.setAttribute('data-auth-page', 'true');
    document.body.setAttribute('data-auth-page', 'true');
    document.documentElement.classList.remove('dark');
    document.documentElement.lang = language;
    // DO NOT change document.dir - layout must stay consistent across all languages
    
    // Save language preference
    localStorage.setItem('petwash_lang', language);
    
    return () => {
      document.documentElement.removeAttribute('data-auth-page');
      document.body.removeAttribute('data-auth-page');
    };
  }, [language]);

  // ── OAuth: Google / Apple / Facebook ─────────────────────────────────────
  const performOAuthSignup = async (provider: 'google' | 'apple' | 'facebook') => {
    const traceId = 'REG-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    console.log('[Auth Trace]', { traceId, method: provider, device: getDeviceInfo().device, timestamp: new Date().toISOString() });
    try {
      setSocialLoading(provider);

      let authProvider: import('firebase/auth').AuthProvider;
      switch (provider) {
        case 'apple':   authProvider = createAppleProvider();    break;
        case 'facebook': authProvider = createFacebookProvider(); break;
        default:        authProvider = createGoogleProvider();   break;
      }

      const strategy = getAuthStrategy();
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth');
      const result = strategy === 'redirect'
        ? await signInWithRedirect(auth, authProvider).then(() => null)
        : await signInWithPopup(auth, authProvider);

      if (!result) return; // redirect flow — page will reload

      const idToken = await result.user.getIdToken();
      const additionalInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalInfo?.isNewUser;

      // Create/refresh server session
      const sessionRes = await fetch(getApiUrl('/api/auth/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken, traceId }),
      });
      if (!sessionRes.ok) {
        await auth.signOut();
        throw new Error(language === 'he' ? 'שגיאה ביצירת הפגישה. אנא נסה שוב.' : 'Session creation failed. Please try again.');
      }

      trackSignUp(provider, result.user.uid);
      trackEvent({ action: 'signup_success', category: 'authentication', label: `${provider}_oauth_signup`, language });

      if (isNewUser) {
        await fetch(getApiUrl('/api/auth/post-login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          credentials: 'include',
          body: JSON.stringify({
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            provider,
            isNewUser: true,
          }),
        }).catch(() => {});
      }

      toast({
        title: language === 'he' ? 'ברוך הבא! 🎉' : 'Welcome! 🎉',
        description: language === 'he' ? 'החשבון שלך נוצר בהצלחה' : 'Your account has been created successfully',
      });
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      logger.error(`[Auth] ${provider} OAuth signup failed:`, err);
      toast({
        variant: 'destructive',
        title: language === 'he' ? `הרשמה עם ${provider === 'apple' ? 'Apple' : provider === 'facebook' ? 'Facebook' : 'Google'} נכשלה` : `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-up failed`,
        description: language === 'he' ? 'נסה שוב או השתמש במספר טלפון.' : 'Please try again or use phone number.',
      });
    } finally {
      setSocialLoading(null);
    }
  };

  // ── External OAuth: TikTok / Instagram ───────────────────────────────────
  const handleExternalOAuth = async (provider: 'tiktok' | 'instagram') => {
    try {
      setSocialLoading(provider);
      const res = await fetch(getApiUrl(`/api/auth/social/${provider}/authorize`));
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({
          variant: 'destructive',
          title: language === 'he' ? 'שירות לא זמין' : 'Service unavailable',
          description: language === 'he' ? `הרשמה עם ${provider} אינה זמינה כרגע` : `Sign up with ${provider} is not available yet`,
        });
      }
    } catch {
      toast({ variant: 'destructive', title: language === 'he' ? 'שגיאה' : 'Error', description: language === 'he' ? 'אירעה שגיאה. נסה שוב.' : 'An error occurred. Please try again.' });
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Phone OTP signup ──────────────────────────────────────────────────────
  const handleSendPhoneCode = async () => {
    if (!phoneNumber || !phoneNumber.startsWith('+') || phoneNumber.length < 8) {
      toast({ variant: 'destructive', title: language === 'he' ? 'מספר טלפון שגוי' : 'Invalid phone number', description: language === 'he' ? 'הזן מספר טלפון בינלאומי תקין (לדוגמה: +972501234567)' : 'Enter a valid international phone number (e.g. +972501234567)' });
      return;
    }
    setPhoneLoading(true);
    try {
      let turnstileToken: string | null = null;
      let freshCaptchaToken: string | null = null;
      turnstileToken = await executeTurnstileInvisible('phone_signup').catch(() => null);
      if (!turnstileToken) {
        freshCaptchaToken = await executeReCaptcha('phone_signup').catch(() => null);
      }

      const res = await fetch(getApiUrl('/api/auth/phone/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: phoneNumber.trim(), language, ...(turnstileToken ? { turnstileToken } : { captchaToken: freshCaptchaToken }) }),
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || result.message || (language === 'he' ? 'שליחת הקוד נכשלה' : 'Failed to send code'));

      setConfirmationResult({ phone: phoneNumber.trim() });
      toast({ title: language === 'he' ? 'קוד נשלח! 📲' : 'Code sent! 📲', description: language === 'he' ? `קוד אימות נשלח ל-${phoneNumber}` : `Verification code sent to ${phoneNumber}` });
    } catch (err: any) {
      logger.error('[PhoneAuth] Send code failed:', err);
      toast({ variant: 'destructive', title: language === 'he' ? 'שגיאה' : 'Error', description: err.message || (language === 'he' ? 'שליחת הקוד נכשלה. נסה שוב.' : 'Failed to send code. Please try again.') });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneCode = async (codeOverride?: string) => {
    const code = codeOverride ?? verificationCode;
    if (!code || code.length < 6) {
      toast({ variant: 'destructive', title: language === 'he' ? 'שגיאה' : 'Error', description: language === 'he' ? 'הזן קוד בן 6 ספרות' : 'Enter the 6-digit code' });
      return;
    }
    if (!confirmationResult?.phone) {
      toast({ variant: 'destructive', title: language === 'he' ? 'שגיאה' : 'Error', description: language === 'he' ? 'שלח קוד תחילה' : 'Send a code first' });
      return;
    }
    setPhoneLoading(true);
    try {
      const verifyRes = await fetch(getApiUrl('/api/auth/phone/verify-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: confirmationResult.phone, code, language }),
      });
      const verifyResult = await verifyRes.json();
      if (!verifyResult.ok) throw new Error(verifyResult.error || (language === 'he' ? 'הקוד שגוי' : 'Invalid code'));

      const sessionRes = await fetch(getApiUrl('/api/auth/phone-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ verificationToken: verifyResult.verificationToken }),
      });
      if (!sessionRes.ok) throw new Error(language === 'he' ? 'יצירת הפגישה נכשלה' : 'Failed to create session');

      const sessionData = await sessionRes.json();
      if (sessionData.customToken) {
        const userCredential = await signInWithCustomToken(auth, sessionData.customToken);
        const idToken = await userCredential.user.getIdToken(true);
        await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken }),
        });
      }

      trackSignUp('phone', sessionData.userId || confirmationResult.phone);
      trackEvent({ action: 'signup_success', category: 'authentication', label: 'phone_otp_signup', language });
      toast({ title: language === 'he' ? 'ברוך הבא! 🎉' : 'Welcome! 🎉', description: language === 'he' ? 'ההרשמה הצליחה' : 'Sign-up successful' });
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err: any) {
      logger.error('[PhoneAuth] Verification failed:', err);
      toast({ variant: 'destructive', title: language === 'he' ? 'אימות נכשל' : 'Verification failed', description: err.message || (language === 'he' ? 'הקוד שגוי או פג תוקף. נסה שוב.' : 'Incorrect or expired code. Please try again.') });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const proceedWithRegistration = async (captchaToken: string, turnstileToken?: string) => {
    const traceId = 'REG-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    setLoading(true);
    logger.debug("Loading state set to true");

    try {
      logger.debug("Firebase Auth instance", { exists: !!auth });
      logger.debug("Attempting Firebase createUserWithEmailAndPassword", { email: formData.email });

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password.trim()
      );

      const user = userCredential.user;
      logger.info("Firebase user created successfully", { uid: user.uid, email: user.email });

      await updateProfile(user, {
        displayName: `${formData.firstName.trim()} ${formData.lastName.trim()}`
      });

      const consentTimestamp = new Date().toISOString();
      const consentVersion = '2026-02-19-v1';
      const consentText = `Pet Wash™ Terms of Service v${consentVersion} + Privacy Policy v${consentVersion}`;
      const consentHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(consentText));
      const consentTextHash = Array.from(new Uint8Array(consentHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      logger.debug("Creating user profile via server API");

      const idToken = await user.getIdToken();

      const profileResponse = await fetch(getApiUrl('/api/users/create-profile'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          dob: formData.dob,
          country: formData.country,
          language,
          loyaltyProgram: formData.loyaltyProgram,
          reminders: formData.reminders,
          marketing: formData.marketing,
          pushNotifications: formData.pushNotifications,
          acceptedTerms: formData.acceptedTerms,
          consentTimestamp,
          consentVersion,
          consentTextHash,
          captchaToken,
          ...(turnstileToken ? { turnstileToken } : {}),
          traceId
        })
      });

      if (!profileResponse.ok) {
        const errorData = await profileResponse.json().catch(() => ({}));
        logger.error("Profile creation API failed", { status: profileResponse.status, error: errorData });
        if (errorData?.errorCode === 'STEP_UP_REQUIRED') {
          try { await user.delete(); } catch {}
          toast({ variant: 'destructive', title: language === 'he' ? 'נדרש אימות נוסף' : 'Additional verification required', description: language === 'he' ? 'הגישה שלך נראית חריגה. נסה להירשם עם מספר הטלפון, או נסה מרשת אחרת.' : 'Your connection looks unusual. Try signing up with your phone number, or switch to a different network.' });
          setLoading(false);
          return;
        }
        try {
          await user.delete();
          logger.info("Firebase user deleted after failed profile creation", { uid: user.uid });
        } catch (deleteErr: any) {
          logger.warn("Failed to clean up Firebase user after profile creation failure", { uid: user.uid, err: deleteErr?.message });
        }
        throw new Error(errorData.error || 'Failed to create profile');
      }

      logger.info("User profile created via server API");

      trackSignUp('email', user.uid);

      logger.debug("Syncing to HubSpot");

      syncUser({
        uid: user.uid,
        email: formData.email.trim(),
        firstname: formData.firstName.trim(),
        lastname: formData.lastName.trim(),
        phone: formData.phone.trim(),
        lang: language,
        dob: formData.dob,
        country: formData.country,
        loyaltyProgram: formData.loyaltyProgram,
        reminders: formData.reminders,
        marketing: formData.marketing,
        consent: formData.acceptedTerms,
        consentTimestamp
      }).catch(err => logger.warn('HubSpot sync queued or failed', err));

      logger.debug("Triggering welcome email");
      fetch(getApiUrl('/api/welcome-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          language
        })
      }).catch(err => logger.warn('Welcome email queued or failed', err));

      trackEvent({
        action: 'user_signup',
        category: 'authentication',
        label: 'account_created',
        language,
        userId: user.uid,
      });

      trackEvent({
        action: 'signup_success',
        category: 'authentication',
        label: 'email_password_signup',
        language,
        userId: user.uid,
      });

      logger.info("Account created successfully");
      toast({
        title: t('signUp.accountCreatedSuccess', language),
        description: isPasskeySupported()
          ? t('signUp.almostDone', language)
          : t('signUp.redirectingToDashboard', language),
      });

      const finalIdToken = await user.getIdToken(true);
      setFirebaseToken(finalIdToken);

      try {
        await fetch(getApiUrl('/api/auth/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken: finalIdToken }),
        });
        logger.info("Session cookie refreshed with final token after signup");
      } catch (refreshErr) {
        logger.warn("Session cookie refresh failed (non-blocking)", refreshErr);
      }

      localStorage.setItem('petwash_consent_onboarding_complete', 'true');
      if (isPasskeySupported()) {
        setShowPasskeyPrompt(true);
      } else {
        logger.debug("Navigating to dashboard");
        window.scrollTo(0, 0);
        navigate("/dashboard");
      }

    } catch (error: any) {
      logger.error("Signup error", { traceId, code: error?.code, message: error?.message });

      let errorMessage: string;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = t('signUp.errorEmailInUse', language);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = t('signUp.errorInvalidEmail', language);
      } else if (error.code === 'auth/weak-password') {
        errorMessage = t('signUp.errorWeakPassword', language);
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = t('signUp.errorNetwork', language);
      } else {
        errorMessage = t('signUp.errorGeneric', language);
      }

      toast({
        variant: "destructive",
        title: t('signUp.errorCreatingAccount', language),
        description: errorMessage
      });
    } finally {
      logger.debug("Setting loading to false");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const traceId = 'REG-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    console.log('[Registration Trace]', { traceId, method: 'email', timestamp: new Date().toISOString() });
    logger.debug("Form submit triggered");
    logger.debug("Form data", { 
      email: formData.email, 
      hasPassword: !!formData.password,
      acceptedTerms: formData.acceptedTerms 
    });
    
    // Clear any previous terms error
    setTermsError(false);
    
    const freshCaptchaToken = await executeReCaptcha('register');
    if (!freshCaptchaToken) {
      logger.warn('[SignUp] executeReCaptcha returned null — will rely on Turnstile for security verification');
    }

    if (!formData.acceptedTerms) {
      logger.warn("Terms not accepted");
      setTermsError(true);
      toast({
        variant: "destructive",
        title: t('signUp.pleaseAcceptTerms', language),
        description: t('signUp.mustAcceptTermsDesc', language)
      });
      return;
    }

    // Validate phone number format (international format required)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!formData.phone || !phoneRegex.test(formData.phone.replace(/[\s\-()]/g, ''))) {
      logger.warn("Invalid phone number");
      toast({
        variant: "destructive",
        title: t('signUp.invalidPhone', language),
        description: t('signUp.phoneFormatDesc', language)
      });
      return;
    }

    // Validate date of birth (must be in the past, minimum 13 years old)
    const dobDate = new Date(formData.dob);
    const today = new Date();
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 13);
    
    if (dobDate >= today) {
      logger.warn("DOB is in the future");
      toast({
        variant: "destructive",
        title: t('signUp.invalidDate', language),
        description: t('signUp.dobMustBePast', language)
      });
      return;
    }
    
    if (dobDate > minAge) {
      logger.warn("User is too young");
      toast({
        variant: "destructive",
        title: t('signUp.ageRequirement', language),
        description: t('signUp.mustBe13', language)
      });
      return;
    }

    // Pre-check reCAPTCHA score BEFORE creating the Firebase user.
    // If the score is suspicious, show Turnstile now so we never have to create and delete
    // a Firebase account as part of the step-up flow.
    const checkScoreRes = await fetch(getApiUrl('/api/recaptcha/check-score'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaToken: freshCaptchaToken, action: 'register' }),
    }).then(r => r.json()).catch(() => ({ valid: true, stepUpRequired: false }));

    if (!checkScoreRes.valid) {
      toast({ variant: 'destructive', title: language === 'he' ? 'אימות אבטחה נכשל' : 'Security check failed', description: language === 'he' ? 'נסה שוב מרשת אחרת.' : 'Please try again from a different network.' });
      return;
    }

    if (checkScoreRes.stepUpRequired) {
      if (TURNSTILE_CONFIGURED) {
        setPendingCaptchaToken(freshCaptchaToken);
        setStepUpPending(true);
        return;
      }
      // Turnstile not configured → show message
      toast({ variant: 'destructive', title: language === 'he' ? 'נדרש אימות נוסף' : 'Additional verification required', description: language === 'he' ? 'הגישה שלך נראית חריגה. נסה להירשם עם מספר הטלפון, או נסה מרשת אחרת.' : 'Your connection looks unusual. Try signing up with your phone number, or switch to a different network.' });
      return;
    }

    await proceedWithRegistration(freshCaptchaToken);
    /* --- The rest of registration is handled inside proceedWithRegistration --- */
  };

  // Handle creating a passkey
  const handleCreatePasskey = async () => {
    if (!firebaseToken) {
      logger.error("No Firebase token available");
      setShowPasskeyPrompt(false);
      window.scrollTo(0, 0);
      navigate('/dashboard');
      return;
    }

    const postConsentTarget = '/dashboard';

    try {
      setPasskeyLoading(true);
      logger.info("Creating passkey after signup");

      const result = await registerPasskey(firebaseToken, `${formData.firstName} ${t('signUp.passkeyNickname', language)} ${getBiometricMethodName()}`);

      if (result.success) {
        toast({
          title: t('signUp.passkeyCreatedSuccess', language),
          description: t('signUp.useItNextTime', language),
        });

        trackEvent({
          action: 'auth_passkey_register_success',
          category: 'authentication',
          label: 'post_signup',
          language,
        });
      } else {
        toast({
          variant: "destructive",
          title: t('signUp.errorCreatingPasskey', language),
          description: result.error || t('signUp.failedToCreate', language),
        });
      }
    } catch (error: any) {
      logger.error("Passkey creation error after signup:", error);
    } finally {
      setPasskeyLoading(false);
      setShowPasskeyPrompt(false);
      setTimeout(() => {
        window.scrollTo(0, 0);
        navigate(postConsentTarget);
      }, 500);
    }
  };

  // Handle skipping passkey creation
  const handleSkipPasskey = () => {
    logger.info("User skipped passkey creation");
    
    trackEvent({
      action: 'auth_passkey_skip',
      category: 'authentication',
      label: 'post_signup',
      language,
    });

    setShowPasskeyPrompt(false);
    window.scrollTo(0, 0);
    navigate('/dashboard');
  };

  return (
    <Layout language={language} onLanguageChange={onLanguageChange || (() => {})}>
      <div className="min-h-screen luxury-bg-mesh">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
          <div className="luxury-glass-card luxury-shadow-xl p-8 space-y-8 relative">
          {/* Close/Back Button */}
          <button
            onClick={() => navigate("/")}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label={t('common.close', language)}
            data-testid="button-close-signup"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-center space-y-4"
          >
            <div className="space-y-2">
              <h1 className="luxury-heading-xl">
                {t('register.createAccount', language)}
              </h1>
              <p className="text-gray-600 text-base">
                {t('register.subtitle', language)}
              </p>
            </div>
          </motion.div>
          
          {/* Social Sign-Up Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="space-y-3"
          >
            {/* Webview warning banner */}
            {webviewBlocked && (
              <Alert className="border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  {language === 'he'
                    ? 'הרשמה עם Google/Apple/Facebook דורשת דפדפן מלא (Safari/Chrome). השתמש בטלפון או אימייל למטה.'
                    : 'Google/Apple/Facebook sign-up requires a full browser (Safari/Chrome). Use phone or email below.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              onClick={() => performOAuthSignup('google')}
              disabled={!!socialLoading || loading}
              className="w-full h-13 !bg-white hover:!bg-gray-50 !text-gray-800 border border-gray-300 shadow-sm font-medium text-base flex items-center justify-center gap-3 rounded-2xl transition-all hover:shadow-md"
              data-testid="button-google-signup"
            >
              {socialLoading === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FaGoogle className="h-5 w-5 text-[#4285F4]" />}
              {language === 'he' ? 'המשך עם Google' : language === 'ar' ? 'تسجيل باستخدام Google' : 'Continue with Google'}
            </Button>

            {/* Apple */}
            <Button
              type="button"
              variant="outline"
              onClick={() => performOAuthSignup('apple')}
              disabled={!!socialLoading || loading}
              className="w-full h-13 !bg-black hover:!bg-gray-900 !text-white border border-black shadow-sm font-medium text-base flex items-center justify-center gap-3 rounded-2xl transition-all hover:shadow-md"
              data-testid="button-apple-signup"
            >
              {socialLoading === 'apple' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FaApple className="h-5 w-5" />}
              {language === 'he' ? 'המשך עם Apple' : 'Continue with Apple'}
            </Button>

            {/* Facebook */}
            <Button
              type="button"
              variant="outline"
              onClick={() => performOAuthSignup('facebook')}
              disabled={!!socialLoading || loading}
              className="w-full h-13 !bg-[#1877F2] hover:!bg-[#166fe5] !text-white border border-[#1877F2] shadow-sm font-medium text-base flex items-center justify-center gap-3 rounded-2xl transition-all hover:shadow-md"
              data-testid="button-facebook-signup"
            >
              {socialLoading === 'facebook' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FaFacebook className="h-5 w-5" />}
              {language === 'he' ? 'המשך עם Facebook' : 'Continue with Facebook'}
            </Button>

            {/* TikTok + Instagram row */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleExternalOAuth('tiktok')}
                disabled={!!socialLoading || loading}
                className="h-11 !bg-black hover:!bg-gray-900 !text-white border border-black font-medium text-sm flex items-center justify-center gap-2 rounded-2xl transition-all"
                data-testid="button-tiktok-signup"
              >
                {socialLoading === 'tiktok' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SiTiktok className="h-4 w-4" />}
                TikTok
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleExternalOAuth('instagram')}
                disabled={!!socialLoading || loading}
                className="h-11 !bg-gradient-to-r !from-purple-500 !via-pink-500 !to-orange-400 hover:opacity-90 !text-white border-0 font-medium text-sm flex items-center justify-center gap-2 rounded-2xl transition-all"
                data-testid="button-instagram-signup"
              >
                {socialLoading === 'instagram' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SiInstagram className="h-4 w-4" />}
                Instagram
              </Button>
            </div>

            {/* Phone OTP toggle */}
            <Button
              type="button"
              variant="outline"
              onClick={() => { setSignupMode(signupMode === 'phone' ? 'email' : 'phone'); setConfirmationResult(null); setVerificationCode(''); }}
              disabled={!!socialLoading || loading}
              className="w-full h-13 !bg-white hover:!bg-gray-50 !text-gray-800 border border-gray-300 shadow-sm font-medium text-base flex items-center justify-center gap-3 rounded-2xl transition-all hover:shadow-md"
              data-testid="button-phone-signup-toggle"
            >
              {signupMode === 'phone' ? <ArrowLeft className="h-5 w-5" /> : <Phone className="h-5 w-5 text-purple-600" />}
              {signupMode === 'phone'
                ? (language === 'he' ? 'חזור לאימייל' : 'Back to email')
                : (language === 'he' ? 'הירשם עם מספר טלפון' : 'Sign up with phone number')}
            </Button>

            {/* Phone OTP section */}
            <AnimatePresence>
              {signupMode === 'phone' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-3 pt-1"
                >
                  <div className="p-4 rounded-2xl border border-purple-100 bg-purple-50/50 space-y-4">
                    <p className="text-sm text-purple-800 font-medium">
                      {language === 'he' ? '📲 הרשמה מהירה עם מספר טלפון' : '📲 Quick sign-up with phone number'}
                    </p>
                    <PhoneInput
                      value={phoneNumber}
                      onChange={setPhoneNumber}
                      language={language}
                      defaultCountry="IL"
                    />
                    {/* Mandatory consent before sending SMS */}
                    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${!phoneTermsAccepted ? 'border-gray-200 bg-white/60' : 'border-green-200 bg-green-50/50'}`}>
                      <Checkbox
                        id="phoneTerms"
                        checked={phoneTermsAccepted}
                        onCheckedChange={(v) => setPhoneTermsAccepted(!!v)}
                        data-testid="checkbox-phone-terms"
                      />
                      <label htmlFor="phoneTerms" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
                        {language === 'he'
                          ? <>קראתי ואני מסכים/ה ל<Link href="/terms" className="text-purple-600 underline">תנאי השימוש</Link> ול<Link href="/privacy-policy" className="text-purple-600 underline">מדיניות הפרטיות</Link> <span className="text-red-500">*</span></>
                          : <>I agree to the <Link href="/terms" className="text-purple-600 underline">Terms of Use</Link> and <Link href="/privacy-policy" className="text-purple-600 underline">Privacy Policy</Link> <span className="text-red-500">*</span></>
                        }
                      </label>
                    </div>
                    {!confirmationResult ? (
                      <Button
                        type="button"
                        onClick={handleSendPhoneCode}
                        disabled={phoneLoading || !phoneTermsAccepted}
                        className="luxury-btn-primary w-full h-12"
                        data-testid="button-send-phone-code"
                      >
                        {phoneLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Phone className="h-5 w-5 mr-2" />}
                        {language === 'he' ? 'שלח קוד אימות' : 'Send verification code'}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500 text-center">
                          {language === 'he' ? `קוד נשלח ל-${confirmationResult.phone}` : `Code sent to ${confirmationResult.phone}`}
                        </p>
                        <OtpCodeInput
                          length={6}
                          value={verificationCode}
                          onChange={setVerificationCode}
                          onComplete={(code) => handleVerifyPhoneCode(code)}
                          disabled={phoneLoading}
                        />
                        <Button
                          type="button"
                          onClick={() => handleVerifyPhoneCode()}
                          disabled={phoneLoading || verificationCode.length < 6}
                          className="luxury-btn-primary w-full h-12"
                          data-testid="button-verify-phone-code"
                        >
                          {phoneLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                          {language === 'he' ? 'אמת ושלח' : 'Verify & continue'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setConfirmationResult(null); setVerificationCode(''); }}
                          className="text-xs text-purple-600 hover:underline w-full text-center"
                        >
                          {language === 'he' ? 'שלח קוד חדש' : 'Resend code'}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400 font-medium">
                {language === 'he' ? 'או הירשם עם אימייל' : 'or sign up with email'}
              </span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          </motion.div>

          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            id="signupForm"
            onSubmit={handleSubmit} 
            className="space-y-4"
            dir={language === 'he' ? 'rtl' : 'ltr'}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-gray-700 font-medium">{t('register.firstName', language)}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="luxury-glass-minimal"
                  data-testid="input-firstName"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-gray-700 font-medium">{t('register.lastName', language)}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="luxury-glass-minimal"
                  data-testid="input-lastName"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">{t('register.email', language)}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="luxury-glass-minimal"
                data-testid="input-email"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-gray-700 font-medium">{t('register.phone', language)}</Label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                language={language}
                defaultCountry="IL"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">{t('register.password', language)}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                className="luxury-glass-minimal"
                data-testid="input-password"
              />
            </div>

            <div data-testid="input-dob">
              <NativeDateSelect
                value={formData.dob}
                onChange={(date) => setFormData(prev => ({ ...prev, dob: date }))}
                label={t('register.dateOfBirth', language)}
                language={language}
                minYear={new Date().getFullYear() - 120}
                maxYear={new Date().getFullYear() - 13}
              />
            </div>

            <div>
              <Label htmlFor="country" className="flex items-center gap-2 text-gray-700 font-medium">
                {t('register.country', language)}
                {geoDetected && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {t('signUp.autoDetected', language)}
                  </span>
                )}
              </Label>
              <Select value={formData.country} onValueChange={(val) => setFormData(prev => ({ ...prev, country: val }))}>
                <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {[
                    'Israel', 'United States', 'United Kingdom', 'Canada', 'Australia',
                    'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium',
                    'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland',
                    'Portugal', 'Greece', 'Ireland', 'Poland', 'Czech Republic', 'Hungary',
                    'Romania', 'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia', 'Estonia',
                    'Latvia', 'Lithuania', 'Cyprus', 'Malta', 'Luxembourg', 'Iceland',
                    'Russia', 'Ukraine', 'Turkey', 'Japan', 'South Korea', 'China',
                    'India', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia',
                    'South Africa', 'Egypt', 'Morocco', 'Tunisia', 'United Arab Emirates',
                    'Saudi Arabia', 'Jordan', 'Thailand', 'Singapore', 'Malaysia',
                    'Philippines', 'Indonesia', 'Vietnam', 'New Zealand'
                  ].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
              <div className="checkbox-wrapper">
                <Checkbox
                  id="loyaltyProgram"
                  name="loyaltyProgram"
                  checked={formData.loyaltyProgram}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, loyaltyProgram: !!checked }))}
                  data-testid="checkbox-loyaltyProgram"
                />
                <label htmlFor="loyaltyProgram">
                  {t('register.loyaltyClub', language)}
                </label>
              </div>

              <div className="checkbox-wrapper">
                <Checkbox
                  id="reminders"
                  name="reminders"
                  checked={formData.reminders}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminders: !!checked }))}
                  data-testid="checkbox-reminders"
                />
                <label htmlFor="reminders">
                  {t('register.washReminders', language)}
                </label>
              </div>

              <div className="checkbox-wrapper">
                <Checkbox
                  id="marketing"
                  name="marketing"
                  checked={formData.marketing}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, marketing: !!checked }))}
                  data-testid="checkbox-marketing"
                />
                <label htmlFor="marketing">
                  {t('register.marketingEmails', language)}
                </label>
              </div>

              <div className="checkbox-wrapper">
                <Checkbox
                  id="pushNotifications"
                  name="pushNotifications"
                  checked={formData.pushNotifications}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pushNotifications: !!checked }))}
                  data-testid="checkbox-pushNotifications"
                />
                <label htmlFor="pushNotifications">
                  {t('register.pushNotifications', language)}
                </label>
              </div>

              <div className={`checkbox-wrapper p-3 rounded-lg transition-colors ${termsError ? 'bg-red-50 border border-red-200' : ''}`}>
                <Checkbox
                  id="acceptedTerms"
                  name="acceptedTerms"
                  checked={formData.acceptedTerms}
                  onCheckedChange={(checked) => {
                    setFormData(prev => ({ ...prev, acceptedTerms: !!checked }));
                    if (checked) setTermsError(false);
                  }}
                  required
                  data-testid="checkbox-acceptedTerms"
                />
                <label htmlFor="acceptedTerms">
                  {t('register.agreeTerms', language)} <span className="text-red-500">*</span>
                </label>
              </div>
              {termsError && (
                <div className="flex items-center gap-1 mt-2 text-red-600 text-sm px-3">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {t('signUp.mustAcceptTerms', language)}
                  </span>
                </div>
              )}
            </div>

            {stepUpPending && (
              <div className="text-center py-2">
                <p className="text-sm text-gray-600 mb-3">
                  {language === 'he' ? 'השלם את אימות האבטחה כדי להמשיך:' : 'Complete the security check to continue:'}
                </p>
                <TurnstileWidget
                  onVerify={(token) => {
                    setStepUpPending(false);
                    const storedCaptcha = pendingCaptchaToken;
                    setPendingCaptchaToken(null);
                    if (storedCaptcha) proceedWithRegistration(storedCaptcha, token);
                  }}
                  onError={() => {
                    setStepUpPending(false);
                    setPendingCaptchaToken(null);
                    toast({ variant: 'destructive', title: language === 'he' ? 'אימות האבטחה נכשל' : 'Security check failed', description: language === 'he' ? 'נסה שוב.' : 'Please try again.' });
                  }}
                />
              </div>
            )}

            <Button
              id="createBtn"
              type="submit" 
              className="luxury-btn-primary luxury-shadow-xl w-full h-14 text-base font-medium"
              disabled={loading || !formData.acceptedTerms || stepUpPending}
              data-testid="button-createAccount"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t('signUp.creatingPremiumAccount', language)}
                </>
              ) : (
                <>
                  {t('register.createPremium', language)}
                  <Sparkles className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            <div className="text-center text-sm pt-4 space-y-2">
              <p>
                <Link href="/terms" className="text-purple-600 hover:text-purple-700 font-medium transition-colors" data-testid="link-terms">
                  {t('signUp.termsOfUse', language)}
                </Link>
                {' • '}
                <Link href="/privacy-policy" className="text-purple-600 hover:text-purple-700 font-medium transition-colors" data-testid="link-privacy">
                  {t('signUp.privacyPolicy', language)}
                </Link>
              </p>
              <p className="text-gray-600">
                {t('signUp.alreadyHaveAccount', language)}{' '}
                <Link href="/signin" className="text-purple-600 hover:text-purple-700 font-medium transition-colors" data-testid="link-signin">
                  {t('signUp.signInLink', language)}
                </Link>
              </p>
            </div>

            {/* Provider/Sitter Application Link */}
            <div className="text-center text-sm pt-4 border-t border-gray-200">
              <p className="text-gray-500 mb-2">
                {t('register.customerSignupNote', language)}
              </p>
              <p className="text-gray-600">
                {t('register.wantToBeSitter', language)}{' '}
                <Link href="/become-provider" className="text-purple-600 hover:text-purple-700 font-medium transition-colors" data-testid="link-become-provider">
                  {t('register.applyAsProvider', language)}
                </Link>
              </p>
            </div>
          </motion.form>
          </div>
          </motion.div>
        </div>

      {/* Passkey Creation Prompt Dialog */}
      <Dialog open={showPasskeyPrompt} onOpenChange={setShowPasskeyPrompt}>
        <DialogContent className="sm:max-w-md luxury-glass-card">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 luxury-shadow-xl">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-center luxury-heading-md">
              {t('signUp.addPasskeyTitle', language)}
            </DialogTitle>
            <DialogDescription className="text-center text-base text-gray-600">
              {`${getBiometricMethodName()} ${t('signUp.useBiometricQuick', language)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-3 luxury-glass-minimal rounded-lg border-purple-200">
              <Fingerprint className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1 text-sm text-purple-800">
                {t('signUp.recommendedPasskey', language)}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={handleCreatePasskey}
              disabled={passkeyLoading}
              className="luxury-btn-primary luxury-shadow-xl w-full h-14 text-base font-medium"
              data-testid="button-create-passkey-after-signup"
            >
              {passkeyLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t('signUp.creating', language)}
                </>
              ) : (
                <>
                  <Fingerprint className="h-5 w-5 mr-2" />
                  {t('signUp.createPasskey', language)}
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleSkipPasskey}
              disabled={passkeyLoading}
              className="luxury-btn-ghost w-full h-12 text-base"
              data-testid="button-skip-passkey"
            >
              {t('signUp.skipForNow', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}
