import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { type Language, t } from "@/lib/i18n";
import { syncUser } from "@/lib/hubspot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, MapPin, Fingerprint, Shield } from "lucide-react";
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
    
    // Validate terms
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
      
      logger.debug("Creating Firestore profile");
      
      // Create Firestore user profile with complete business data (trim all text inputs)
      await setDoc(doc(db, "users", user.uid, "profile", "data"), {
        uid: user.uid,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob,
        country: formData.country,
        lang: language,
        loyaltyProgram: formData.loyaltyProgram,
        reminders: formData.reminders,
        marketing: formData.marketing,
        acceptedTerms: formData.acceptedTerms,
        consentTimestamp,
        loyaltyTier: "New Member",
        washes: 0,
        giftCardCredits: 0,
        totalSpent: 0,
        seniorDiscount: false,
        disabilityDiscount: false,
        discounts: {
          senior: false,
          disability: false,
          loyalty: 0,
          custom: []
        },
        verified: false,
        createdAt: now,
        updatedAt: now
      });
      
      logger.info("Firestore profile created");

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
      fetch('/api/welcome-email', {
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
    <div className="auth-page">
      <Header language={language} onLanguageChange={onLanguageChange || (() => {})} />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 auth-card">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              {t('register.createAccount', language)}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {t('register.subtitle', language)}
            </p>
          </div>
          
          <form 
            id="signupForm"
            onSubmit={handleSubmit} 
            className="signupCard bg-white p-8 rounded-lg space-y-4"
            dir={language === 'he' ? 'rtl' : 'ltr'}
            style={{
              background: '#fff',
              border: 'none',
              boxShadow: '0 10px 30px rgba(0,0,0,.06)',
              overflow: 'hidden',
              transform: 'translateZ(0)'
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">{t('register.firstName', language)}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  data-testid="input-firstName"
                />
              </div>
              <div>
                <Label htmlFor="lastName">{t('register.lastName', language)}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  data-testid="input-lastName"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">{t('register.email', language)}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                data-testid="input-email"
              />
            </div>

            <div>
              <Label htmlFor="phone">{t('register.phone', language)}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="+972-50-123-4567"
                pattern="^\+?[1-9]\d{1,14}$"
                title={t('signUp.enterPhoneFormat', language)}
                data-testid="input-phone"
              />
            </div>

            <div>
              <Label htmlFor="password">{t('register.password', language)}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                data-testid="input-password"
              />
            </div>

            <div>
              <Label htmlFor="dob">{t('register.dateOfBirth', language)}</Label>
              <DatePicker
                value={formData.dob}
                onChange={(date) => setFormData(prev => ({ ...prev, dob: date }))}
                placeholder={t('register.dateOfBirth', language)}
                maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 13))}
                minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 120))}
                language={language}
                testId="input-dob"
              />
            </div>

            <div>
              <Label htmlFor="country" className="flex items-center gap-2">
                {t('register.country', language)}
                {geoDetected && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {t('signUp.autoDetected', language)}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="country"
                  name="country"
                  type="text"
                  required
                  value={formData.country}
                  onChange={handleChange}
                  disabled={geoLoading}
                  className={geoDetected ? "border-green-500 dark:border-green-600" : ""}
                  data-testid="input-country"
                />
                {geoLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
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

            <button
              id="createBtn"
              type="submit" 
              className="w-full relative z-[2] px-8 py-4 font-bold text-lg rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
              disabled={loading || !formData.acceptedTerms}
              aria-disabled={loading || !formData.acceptedTerms}
              data-testid="button-createAccount"
              style={{
                background: loading || !formData.acceptedTerms 
                  ? 'linear-gradient(135deg, #999 0%, #666 100%)'
                  : 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #daa520 100%)',
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                boxShadow: loading || !formData.acceptedTerms
                  ? '0 4px 15px rgba(0,0,0,0.2)'
                  : '0 8px 25px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                transform: 'translateZ(0)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('signUp.creatingPremiumAccount', language)}
                  </>
                ) : (
                  <>
                    <span className="font-extrabold tracking-wide" style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}>
                      {t('register.createPremium', language)}
                    </span>
                    <span className="text-xl">✨</span>
                  </>
                )}
              </span>
              {!loading && !(!formData.acceptedTerms) && (
                <span 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                  style={{
                    transform: 'translateX(-100%)',
                    animation: 'shimmer 3s infinite'
                  }}
                />
              )}
              <style>{`
                @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  50% { transform: translateX(100%); }
                  100% { transform: translateX(100%); }
                }
              `}</style>
            </button>

            <div className="text-center text-sm pt-4 space-y-2">
              <p>
                <Link href="/terms" className="text-blue-600 hover:underline" data-testid="link-terms">
                  {t('signUp.termsOfUse', language)}
                </Link>
                {' • '}
                <Link href="/privacy" className="text-blue-600 hover:underline" data-testid="link-privacy">
                  {t('signUp.privacyPolicy', language)}
                </Link>
              </p>
              <p className="text-gray-600">
                {t('signUp.alreadyHaveAccount', language)}{' '}
                <Link href="/signin" className="text-blue-600 hover:underline" data-testid="link-signin">
                  {t('signUp.signInLink', language)}
                </Link>
              </p>
            </div>
          </form>
        </div>

      {/* Passkey Creation Prompt Dialog */}
      <Dialog open={showPasskeyPrompt} onOpenChange={setShowPasskeyPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#f4d03f]">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold" style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}>
              {t('signUp.addPasskeyTitle', language)}
            </DialogTitle>
            <DialogDescription className="text-center text-base" style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}>
              {`${getBiometricMethodName()} ${t('signUp.useBiometricQuick', language)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1 text-sm text-blue-800 dark:text-blue-300">
                {t('signUp.recommendedPasskey', language)}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={handleCreatePasskey}
              disabled={passkeyLoading}
              className="w-full text-white hover:opacity-90 transition-opacity py-6 text-base font-light tracking-wide rounded-xl flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
              data-testid="button-create-passkey-after-signup"
            >
              {passkeyLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('signUp.creating', language)}
                </>
              ) : (
                <>
                  <Fingerprint className="h-5 w-5" />
                  {t('signUp.createPasskey', language)}
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleSkipPasskey}
              disabled={passkeyLoading}
              className="w-full py-6 text-base font-light tracking-wide rounded-xl"
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              }}
              data-testid="button-skip-passkey"
            >
              {t('signUp.skipForNow', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer language={language} />
    </div>
  );
}
