import { useState, useEffect } from "react";
import { FacebookAuthProvider, OAuthProvider, signInWithRedirect, signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { auth } from "../lib/firebase";
import { loginWithEmailPassword, loginWithGoogle, handleRedirectResult as handleAuthRedirect, humanizeAuthError } from "@/auth/client";
import { type Language, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Smartphone, Fingerprint } from "lucide-react";
import { SiGmail, SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { OAuthConsentDialog } from "@/components/OAuthConsentDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FastSignInProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
}

export default function FastSignIn({ language }: FastSignInProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useFirebaseAuth();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  
  // OAuth consent dialog state
  const [consentDialog, setConsentDialog] = useState<{
    isOpen: boolean;
    provider: string;
    userEmail?: string;
  }>({
    isOpen: false,
    provider: "",
    userEmail: undefined
  });

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // 🔄 Handle redirect results after OAuth (iOS/Safari auto-fallback)
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await handleAuthRedirect();
        if (result) {
          console.log('[FastSignIn] ✅ Redirect auth successful');
          toast({
            title: t('fastSignIn.welcome', language),
            description: t('fastSignIn.signedInSuccess', language),
          });
          navigate("/dashboard");
        }
      } catch (error: any) {
        console.error('[FastSignIn] ❌ Redirect auth failed:', error.code);
        toast({
          title: t('fastSignIn.signInFailed', language),
          description: humanizeAuthError(error.code, language),
          variant: "destructive",
        });
      }
    };
    processRedirect();
  }, [toast, navigate, language]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: t('fastSignIn.error', language),
        description: t('fastSignIn.fillAllFields', language),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 🔐 Use battle-tested 2025 auth client
      await loginWithEmailPassword(email, password);
      console.log('[FastSignIn] ✅ Email/password login successful');
      toast({
        title: t('fastSignIn.welcomeBack', language),
        description: t('fastSignIn.signedInSuccess', language),
      });
      navigate("/dashboard");
    } catch (error: any) {
      console.error('[FastSignIn] ❌ Email/password login failed:', error.code, error.message);
      toast({
        title: t('fastSignIn.signInFailed', language),
        description: humanizeAuthError(error.code, language),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    if (!showVerification) {
      // Send verification code
      if (!phoneNumber) {
        toast({
          title: t('fastSignIn.error', language),
          description: t('fastSignIn.enterPhoneNumber', language),
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      try {
        // Initialize reCAPTCHA
        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
        
        const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
        setConfirmationResult(confirmation);
        setShowVerification(true);
        toast({
          title: t('fastSignIn.codeSent', language),
          description: t('fastSignIn.codePhoneSent', language),
        });
      } catch (error: any) {
        toast({
          title: t('fastSignIn.error', language),
          description: error.message || t('fastSignIn.failedSendCode', language),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Verify code
      if (!verificationCode) {
        toast({
          title: t('fastSignIn.error', language),
          description: t('fastSignIn.enterVerificationCode', language),
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      try {
        await confirmationResult.confirm(verificationCode);
        toast({
          title: t('fastSignIn.welcomeBack', language),
          description: t('fastSignIn.signedInSuccess', language),
        });
        navigate("/dashboard");
      } catch (error: any) {
        toast({
          title: t('fastSignIn.error', language),
          description: error.message || t('fastSignIn.invalidCode', language),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSocialSignIn = async (provider: "google" | "yahoo" | "facebook" | "instagram" | "tiktok" | "microsoft") => {
    setConsentDialog({
      isOpen: true,
      provider,
      userEmail: undefined
    });
  };

  const handleConsentAccept = async () => {
    const provider = consentDialog.provider;
    setConsentDialog({ isOpen: false, provider: "", userEmail: undefined });
    setSocialLoading(provider);
    
    try {
      // 🔐 Google uses battle-tested 2025 auth client (auto iOS/Safari fallback)
      if (provider === "google") {
        await loginWithGoogle();
        console.log('[FastSignIn] ✅ Google OAuth initiated');
        // Don't navigate yet - handleRedirectResult will handle it
        return;
      }
      
      // Other providers use standard Firebase flow
      let authProvider;
      switch (provider) {
        case "yahoo":
          authProvider = new OAuthProvider("yahoo.com");
          break;
        case "facebook":
          authProvider = new FacebookAuthProvider();
          authProvider.addScope('email');
          break;
        case "instagram":
          authProvider = new FacebookAuthProvider();
          authProvider.addScope('instagram_basic');
          break;
        case "tiktok":
          window.location.href = '/api/auth/tiktok/start';
          return;
        case "microsoft":
          authProvider = new OAuthProvider("microsoft.com");
          authProvider.addScope('email');
          break;
      }

      await signInWithRedirect(auth, authProvider);
    } catch (error: any) {
      console.error('[FastSignIn] ❌ Social sign-in failed:', error.code, error.message);
      setSocialLoading(null);
      toast({
        title: t('fastSignIn.signInFailed', language),
        description: humanizeAuthError(error.code, language),
        variant: "destructive",
      });
    }
  };

  const handlePasskeySignIn = () => {
    navigate("/signin");
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800" dir={language === "he" || language === "ar" ? "rtl" : "ltr"}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            {/* Logo */}
            <div className="text-center mb-8">
              <Link href="/">
                <img 
                  src="/brand/petwash-logo-official.png" 
                  alt="Pet Wash™" 
                  className="h-16 mx-auto mb-4 cursor-pointer"
                />
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {t('fastSignIn.title', language)}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {t('fastSignIn.subtitle', language)}
              </p>
            </div>

            {/* Premium Social Sign In - HD Luxury Icons */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                {t('fastSignIn.oneClickSignIn', language)}
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {/* Gmail - Primary */}
                <Button
                  onClick={() => handleSocialSignIn("google")}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-red-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600 transition-all shadow-sm hover:shadow-md"
                  data-testid="button-gmail-signin"
                >
                  {socialLoading === "google" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <SiGmail className="w-6 h-6 mr-3 text-red-600" />
                      <span className="font-semibold">
                        {t('fastSignIn.continueGmail', language)}
                      </span>
                    </>
                  )}
                </Button>

                {/* Yahoo */}
                <Button
                  onClick={() => handleSocialSignIn("yahoo")}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-[#6001D2] hover:bg-[#5001B2] text-white transition-all shadow-sm hover:shadow-md"
                  data-testid="button-yahoo-signin"
                >
                  {socialLoading === "yahoo" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-6 h-6 mr-3" />
                      <span className="font-semibold">
                        {t('fastSignIn.continueYahoo', language)}
                      </span>
                    </>
                  )}
                </Button>

                {/* Microsoft */}
                <Button
                  onClick={() => handleSocialSignIn("microsoft")}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-[#00A4EF] hover:bg-[#0078D4] text-white transition-all shadow-sm hover:shadow-md"
                  data-testid="button-microsoft-signin"
                >
                  {socialLoading === "microsoft" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-6 h-6 mr-3" />
                      <span className="font-semibold">
                        {t('fastSignIn.continueMicrosoft', language)}
                      </span>
                    </>
                  )}
                </Button>

                {/* Facebook */}
                <Button
                  onClick={() => handleSocialSignIn("facebook")}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-[#1877F2] hover:bg-[#166FE5] text-white transition-all shadow-sm hover:shadow-md"
                  data-testid="button-facebook-signin"
                >
                  {socialLoading === "facebook" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <SiFacebook className="w-6 h-6 mr-3" />
                      <span className="font-semibold">
                        {t('fastSignIn.continueFacebook', language)}
                      </span>
                    </>
                  )}
                </Button>

                {/* Instagram */}
                <Button
                  onClick={() => handleSocialSignIn("instagram")}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white transition-all shadow-sm hover:shadow-md"
                  data-testid="button-instagram-signin"
                >
                  {socialLoading === "instagram" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <SiInstagram className="w-6 h-6 mr-3" />
                      <span className="font-semibold">
                        {t('fastSignIn.continueInstagram', language)}
                      </span>
                    </>
                  )}
                </Button>

                {/* TikTok */}
                <Button
                  onClick={() => handleSocialSignIn("tiktok")}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-black hover:bg-gray-900 text-white transition-all shadow-sm hover:shadow-md"
                  data-testid="button-tiktok-signin"
                >
                  {socialLoading === "tiktok" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <SiTiktok className="w-6 h-6 mr-3" />
                      <span className="font-semibold">
                        {t('fastSignIn.continueTikTok', language)}
                      </span>
                    </>
                  )}
                </Button>

                {/* Face ID / Passkey */}
                <Button
                  onClick={handlePasskeySignIn}
                  disabled={!!socialLoading}
                  className="w-full h-14 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white transition-all shadow-sm hover:shadow-md border-2 border-gray-600"
                  data-testid="button-passkey-signin"
                >
                  <Fingerprint className="w-6 h-6 mr-3" />
                  <span className="font-semibold">
                    {t('fastSignIn.continueFaceID', language)}
                  </span>
                </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 text-gray-500 dark:text-gray-400">
                  {t('fastSignIn.or', language)}
                </span>
              </div>
            </div>

            {/* Email / Phone Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="email" data-testid="tab-email">
                    <Mail className="w-4 h-4 mr-2" />
                    {t('fastSignIn.email', language)}
                  </TabsTrigger>
                  <TabsTrigger value="phone" data-testid="tab-phone">
                    <Smartphone className="w-4 h-4 mr-2" />
                    {t('fastSignIn.phone', language)}
                  </TabsTrigger>
                </TabsList>

                {/* Email Sign In */}
                <TabsContent value="email">
                  <form onSubmit={handleEmailSignIn} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('fastSignIn.email', language)}
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="h-12"
                        autoComplete="email"
                        data-testid="input-email"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('fastSignIn.password', language)}
                      </label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12"
                        autoComplete="current-password"
                        data-testid="input-password"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                      data-testid="button-email-signin"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Lock className="w-5 h-5 mr-2" />
                          {t('fastSignIn.signInButton', language)}
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Phone Sign In */}
                <TabsContent value="phone">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('fastSignIn.phoneNumber', language)}
                      </label>
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+972-50-123-4567"
                        className="h-12"
                        autoComplete="tel"
                        data-testid="input-phone"
                        disabled={showVerification}
                      />
                    </div>

                    {showVerification && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('fastSignIn.verificationCode', language)}
                        </label>
                        <Input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="123456"
                          className="h-12"
                          autoComplete="one-time-code"
                          data-testid="input-verification-code"
                        />
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={handlePhoneSignIn}
                      disabled={loading}
                      className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
                      data-testid="button-phone-signin"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Smartphone className="w-5 h-5 mr-2" />
                          {showVerification 
                            ? t('fastSignIn.verifyCode', language)
                            : t('fastSignIn.sendCode', language)
                          }
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Links */}
            <div className="mt-6 text-center space-y-2">
              <p className="text-gray-600 dark:text-gray-400">
                {t('fastSignIn.noAccount', language)}{" "}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
                  {t('fastSignIn.signUpLink', language)}
                </Link>
              </p>
              <Link href="/" className="block text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                {t('fastSignIn.backToHome', language)}
              </Link>
            </div>

            {/* reCAPTCHA container (invisible) */}
            <div id="recaptcha-container"></div>
          </div>
        </div>
      </div>

      {/* OAuth Consent Dialog */}
      <OAuthConsentDialog
        isOpen={consentDialog.isOpen}
        onClose={() => setConsentDialog({ isOpen: false, provider: "", userEmail: undefined })}
        onAccept={handleConsentAccept}
        provider={consentDialog.provider}
        userEmail={consentDialog.userEmail}
        language={language}
      />
    </>
  );
}
