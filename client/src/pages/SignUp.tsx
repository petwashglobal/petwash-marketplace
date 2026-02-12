import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Layout } from "@/components/Layout";
import { type Language, t } from "@/lib/i18n";
import { syncUser } from "@/lib/hubspot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AppleWheelDatePicker, AppleWheelSelect, type WheelPickerItem } from '@/components/ui/apple-wheel-picker';
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, MapPin, Fingerprint, Shield, Sparkles, X } from "lucide-react";
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
import { registerPasskey, isPasskeySupported, getBiometricMethodName } from "@/auth/passkey";
import { motion } from "framer-motion";
import { getApiUrl } from '@/lib/apiConfig';
import { PhoneInput } from '@/components/PhoneInput';
import { SecurityCheckpoint } from '@/components/ReCaptcha';

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    dob: "",
    country: "Israel",
    loyaltyProgram: true, // ✅ Pre-ticked by default
    reminders: true, // ✅ Pre-ticked by default
    marketing: true, // ✅ Pre-ticked by default
    pushNotifications: true, // ✅ Pre-ticked by default - mobile push notifications
    acceptedTerms: true, // ✅ Pre-ticked by default
  });
  
  logger.debug("SignUp component rendered", { acceptedTerms: formData.acceptedTerms });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug("Form submit triggered");
    logger.debug("Form data", { 
      email: formData.email, 
      hasPassword: !!formData.password,
      acceptedTerms: formData.acceptedTerms 
    });
    
    // Clear any previous terms error
    setTermsError(false);
    
    if (!captchaToken) {
      toast({
        variant: "destructive",
        title: language === 'he' ? 'נדרש אימות אבטחה' : 'Security verification required',
        description: language === 'he' ? 'אנא השלם את אימות האבטחה לפני ההרשמה' : 'Please complete the security verification before registering'
      });
      return;
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

    setLoading(true);
    logger.debug("Loading state set to true");
    
    try {
      logger.debug("Firebase Auth instance", { exists: !!auth });
      logger.debug("Attempting Firebase createUserWithEmailAndPassword", { email: formData.email });
      
      // Create Firebase Auth user (trim whitespace to prevent validation errors)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password.trim()
      );
      
      const user = userCredential.user;
      logger.info("Firebase user created successfully", { uid: user.uid, email: user.email });
      
      // Update display name (trim whitespace)
      await updateProfile(user, {
        displayName: `${formData.firstName.trim()} ${formData.lastName.trim()}`
      });

      const consentTimestamp = new Date().toISOString();
      const now = new Date().toISOString();
      
      logger.debug("Creating user profile via server API");
      
      // Get Firebase ID token for authenticated API call
      const idToken = await user.getIdToken();
      
      // Create user profile via server API (bypasses Firestore security rules)
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
          captchaToken
        })
      });
      
      if (!profileResponse.ok) {
        const errorData = await profileResponse.json().catch(() => ({}));
        logger.error("Profile creation API failed", { status: profileResponse.status, error: errorData });
        throw new Error(errorData.error || 'Failed to create profile');
      }
      
      logger.info("User profile created via server API");

      // Track sign-up in GA4
      trackSignUp('email', user.uid);

      logger.debug("Syncing to HubSpot");
      
      // Sync to HubSpot (non-blocking, trim all text inputs)
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

      // Send welcome email (non-blocking)
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

      // Track successful signup
      trackEvent({
        action: 'user_signup',
        category: 'authentication',
        label: 'account_created',
        language,
        userId: user.uid,
      });
      
      // GA4 signup_success event
      trackEvent({
        action: 'signup_success',
        category: 'authentication',
        label: 'email_password_signup',
        language,
        userId: user.uid,
      });

      // Show success message
      logger.info("Account created successfully");
      toast({
        title: t('signUp.accountCreatedSuccess', language),
        description: isPasskeySupported() 
          ? t('signUp.almostDone', language)
          : t('signUp.redirectingToDashboard', language),
      });

      // Get Firebase token for passkey registration
      const token = await user.getIdToken();
      setFirebaseToken(token);

      // Show passkey prompt if supported, otherwise redirect
      if (isPasskeySupported()) {
        setShowPasskeyPrompt(true);
      } else {
        setTimeout(() => {
          logger.debug("Navigating to dashboard");
          window.scrollTo(0, 0);
          navigate("/dashboard");
        }, 1500);
      }

    } catch (error: any) {
      logger.error("Signup error", { code: error?.code, message: error?.message });
      
      // Firebase error messages - internationalized for all languages
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

  // Handle creating a passkey
  const handleCreatePasskey = async () => {
    if (!firebaseToken) {
      logger.error("No Firebase token available");
      setShowPasskeyPrompt(false);
      window.scrollTo(0, 0);
      navigate("/dashboard");
      return;
    }

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
        navigate("/dashboard");
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
    navigate("/dashboard");
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
                defaultCountryCode="+972"
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
              <AppleWheelDatePicker
                value={formData.dob}
                onChange={(date) => setFormData(prev => ({ ...prev, dob: date }))}
                label={t('register.dateOfBirth', language)}
                minYear={new Date().getFullYear() - 120}
                maxYear={new Date().getFullYear() - 13}
                monthNames={({
                  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                  he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
                  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
                  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
                  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
                  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                } as Record<string, string[]>)[language] || ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']}
                dayLabel={({ en: 'Day', he: 'יום', ar: 'يوم', ru: 'День', fr: 'Jour', es: 'Día' } as Record<string, string>)[language] || 'Day'}
                monthLabel={({ en: 'Month', he: 'חודש', ar: 'شهر', ru: 'Месяц', fr: 'Mois', es: 'Mes' } as Record<string, string>)[language] || 'Month'}
                yearLabel={({ en: 'Year', he: 'שנה', ar: 'سنة', ru: 'Год', fr: 'Année', es: 'Año' } as Record<string, string>)[language] || 'Year'}
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
              <AppleWheelSelect
                items={[
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
                ].map(c => ({ value: c, label: c }))}
                value={formData.country}
                onValueChange={(val) => setFormData(prev => ({ ...prev, country: val }))}
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="loyaltyProgram"
                  name="loyaltyProgram"
                  checked={formData.loyaltyProgram}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, loyaltyProgram: !!checked }))}
                  data-testid="checkbox-loyaltyProgram"
                />
                <label htmlFor="loyaltyProgram" className="text-sm cursor-pointer">
                  {t('register.loyaltyClub', language)}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reminders"
                  name="reminders"
                  checked={formData.reminders}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminders: !!checked }))}
                  data-testid="checkbox-reminders"
                />
                <label htmlFor="reminders" className="text-sm cursor-pointer">
                  {t('register.washReminders', language)}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketing"
                  name="marketing"
                  checked={formData.marketing}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, marketing: !!checked }))}
                  data-testid="checkbox-marketing"
                />
                <label htmlFor="marketing" className="text-sm cursor-pointer">
                  {t('register.marketingEmails', language)}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pushNotifications"
                  name="pushNotifications"
                  checked={formData.pushNotifications}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pushNotifications: !!checked }))}
                  data-testid="checkbox-pushNotifications"
                />
                <label htmlFor="pushNotifications" className="text-sm cursor-pointer">
                  {t('register.pushNotifications', language)}
                </label>
              </div>

              <div className="pt-2">
                <div className="flex items-center space-x-2">
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
                  <label htmlFor="acceptedTerms" className="text-sm cursor-pointer">
                    {t('register.agreeTerms', language)} <span className="text-red-500">*</span>
                  </label>
                </div>
                {termsError && (
                  <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      {t('signUp.mustAcceptTerms', language)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <SecurityCheckpoint
                onVerified={(token) => setCaptchaToken(token)}
                onFailed={() => setCaptchaToken(null)}
                language={language}
                action="register"
              />
            </div>

            <Button
              id="createBtn"
              type="submit" 
              className="luxury-btn-primary luxury-shadow-xl w-full h-14 text-base font-medium"
              disabled={loading || !formData.acceptedTerms || !captchaToken}
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
                <Link href="/privacy" className="text-purple-600 hover:text-purple-700 font-medium transition-colors" data-testid="link-privacy">
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
