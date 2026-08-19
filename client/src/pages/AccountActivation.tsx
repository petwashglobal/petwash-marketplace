import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Circle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirebaseAuth } from "@/auth/AuthProvider";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ActivationState {
  activationStatus: "draft" | "mobile_verified" | "email_verified" | "active" | "suspended" | "deleted";
  mobileVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  accountActivatedAt: string | null;
  missingSteps: ("mobile" | "email")[];
  isFullyActive: boolean;
}

// ─── Step indicator ────────────────────────────────────────────────────────

function StepItem({
  number,
  label,
  status,
}: {
  number: number;
  label: string;
  status: "complete" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          status === "complete"
            ? "bg-[#1a1a1a]"
            : status === "active"
            ? "border-2 border-[#1a1a1a]"
            : "border border-[#d4d4d4]"
        }`}
      >
        {status === "complete" ? (
          <CheckCircle className="w-4 h-4 text-[#0a0a0a]" />
        ) : (
          <span
            className={`text-xs font-semibold ${
              status === "active" ? "text-[#1a1a1a]" : "text-[#bbb]"
            }`}
          >
            {number}
          </span>
        )}
      </div>
      <span
        className={`text-sm font-medium tracking-wide ${
          status === "complete"
            ? "text-[#1a1a1a]"
            : status === "active"
            ? "text-[#1a1a1a]"
            : "text-[#bbb]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepConnector({ complete }: { complete: boolean }) {
  return (
    <div className="flex items-center ml-4 my-1">
      <div
        className={`w-px h-6 transition-all duration-300 ${
          complete ? "bg-[#1a1a1a]" : "bg-[#e8e8e8]"
        }`}
      />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

// Bilingual copy — signup-friction audit 2026-08-19 SEV-2 #4. The page used
// to hard-code English + `dir="ltr"` on the wrapper, so a Hebrew user who
// completed the entire signup flow in RTL was dumped into a LTR English page
// for the last step. Mirror the pattern used in AccessPending.tsx: read the
// language from localStorage('i18nextLng') and flip both dir + all visible
// strings from a single `t` object.
type Lang = 'he' | 'en';

// Minimal E.164 validation — plus sign, 8–15 digits total, no other chars.
// Matches what /api/auth/sms/start's server-side normalizePhoneServer accepts
// once the client has done its own normalization to E.164 (client util
// normalizePhoneE164). We enforce the strict shape client-side so the user
// gets an inline hint before the request goes out.
const E164_RE = /^\+\d{8,15}$/;

// Light client-side normalization — mirrors server normalizePhoneServer so a
// user who types "054-123-4567" or "541234567" still gets sent as +9725412…
// Do NOT re-implement the full util here; keep it obvious + inline so a
// reviewer can see exactly what's sent to the server.
function normalizePhoneE164Local(raw: string): string {
  const digits = raw.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (/^972\d{8,9}$/.test(digits)) return '+' + digits;
  if (/^0[1-9]\d{7,8}$/.test(digits)) return '+972' + digits.slice(1);
  if (/^5\d{8}$/.test(digits)) return '+972' + digits;
  return digits || raw;
}

export default function AccountActivation() {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const lang: Lang = ((typeof window !== 'undefined' && localStorage.getItem('i18nextLng')) || 'en') === 'he' ? 'he' : 'en';
  const isHe = lang === 'he';

  const t = {
    brand: 'PetWash™',
    kicker: isHe ? 'הפעלת חשבון' : 'Account Activation',
    heading: isHe ? 'השלימו את החשבון שלכם' : 'Complete your account',
    intro: isHe
      ? 'הארנק, ההטבות ומועדון Prestige מופעלים ברגע שהמייל והנייד אומתו. אפשר להשלים בכל סדר.'
      : 'Your wallet, rewards, and Prestige membership activate once both your mobile and email are verified. You can complete them in either order.',
    stepCreate: isHe ? 'יצירת חשבון' : 'Create account',
    stepVerifyMobile: isHe ? 'אימות מספר נייד' : 'Verify mobile number',
    stepVerifyEmail: isHe ? 'אימות דוא"ל' : 'Verify email',
    stepActive: isHe ? 'החשבון פעיל' : 'Account active',
    verifyMobileKicker: isHe ? 'אימות נייד' : 'Verify mobile',
    // For email-first users we ask for the number first, then send the code.
    addPhoneDesc: isHe
      ? 'לא נמצא מספר נייד בחשבון. הזינו מספר בפורמט בינלאומי (למשל +972541234567) כדי לקבל קוד אימות.'
      : 'No mobile number on your account yet. Enter a number in international format (e.g. +972541234567) to receive a verification code.',
    phonePlaceholder: isHe ? '+972541234567' : '+972541234567',
    continue: isHe ? 'המשך' : 'Continue',
    invalidPhone: isHe
      ? 'מספר לא תקין. השתמשו בפורמט בינלאומי (למשל +972541234567).'
      : 'Invalid number. Use international format (e.g. +972541234567).',
    sendCodeDesc: (phone: string) => isHe
      ? `נשלח קוד בן 6 ספרות אל ${phone}.`
      : `We will send a 6-digit code to ${phone}.`,
    sendCodeDescFallback: isHe
      ? 'נשלח קוד בן 6 ספרות למספר הרשום.'
      : 'We will send a 6-digit code to your registered mobile number.',
    sendCode: isHe ? 'שליחת קוד אימות' : 'Send verification code',
    resendIn: (n: number) => isHe ? `שליחה חוזרת בעוד ${n} שניות` : `Resend in ${n}s`,
    codePlaceholder: isHe ? 'הזינו קוד בן 6 ספרות' : 'Enter 6-digit code',
    confirmCode: isHe ? 'אישור הקוד' : 'Confirm code',
    resend: isHe ? 'שליחה חוזרת' : 'Resend code',
    verifyEmailKicker: isHe ? 'אימות דוא"ל' : 'Verify email',
    emailDesc: (email: string) => isHe
      ? `יישלח דוא"ל הפעלה פרימיום אל ${email}. לחצו על הקישור שבתוך המייל כדי להפעיל.`
      : `A premium activation email will be sent to ${email}. Click the link inside to activate.`,
    emailDescFallback: isHe
      ? 'יישלח דוא"ל הפעלה פרימיום לכתובת הרשומה. לחצו על הקישור שבתוך המייל כדי להפעיל.'
      : 'A premium activation email will be sent to your registered email. Click the link inside to activate.',
    emailWaiting: isHe ? 'ממתין להפעלת המייל…' : 'Waiting for email activation…',
    sendEmail: isHe ? 'שליחת דוא"ל הפעלה' : 'Send activation email',
    resumeEmailBanner: isHe
      ? 'הנייד אומת. יש להפעיל את המייל כדי להשלים את החשבון.'
      : 'Mobile verified. Please activate your email to complete your account.',
    resumeMobileBanner: isHe
      ? 'המייל הופעל. יש לאמת את הנייד כדי להשלים את החשבון.'
      : 'Email activated. Please verify your mobile to complete your account.',
    needHelp: isHe ? 'צריכים עזרה?' : 'Need help?',
    activated: isHe ? 'החשבון הופעל' : 'Account activated',
    activatedDesc: isHe
      ? 'ברוכים הבאים ל-PetWash™. החשבון שלכם פעיל במלואו.'
      : 'Welcome to PetWash™. Your account is now fully active.',
    codeSent: isHe ? 'הקוד נשלח' : 'Code sent',
    codeSentDesc: isHe ? 'בדקו את הטלפון לקבלת הקוד.' : 'Check your phone for the verification code.',
    codeSendFailed: isHe ? 'שליחת הקוד נכשלה' : 'Failed to send code',
    codeSendFailedDesc: isHe ? 'נסו שוב.' : 'Please try again.',
    mobileVerified: isHe ? 'הנייד אומת' : 'Mobile verified',
    mobileVerifiedDesc: isHe ? 'מספר הטלפון שלכם אושר.' : 'Your phone number is confirmed.',
    verifyFailed: isHe ? 'האימות נכשל' : 'Verification failed',
    verifyFailedDesc: isHe ? 'הקוד שגוי או פג תוקפו.' : 'The code is incorrect or has expired.',
    emailSent: isHe ? 'דוא"ל הפעלה נשלח' : 'Activation email sent',
    emailSentDesc: isHe ? 'בדקו את תיבת הדואר ולחצו על קישור ההפעלה.' : 'Check your inbox and click the activation link.',
    emailSendFailed: isHe ? 'שליחת המייל נכשלה' : 'Failed to send email',
    emailSendFailedDesc: isHe ? 'נסו שוב בעוד רגע.' : 'Please try again in a moment.',
  };

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  // Signup-friction audit 2026-08-19 SEV-2 #3: email-first signups (Google /
  // Apple / email+password) land here with `user.phoneNumber === null`. The
  // old code posted `phone: user.phoneNumber` (undefined) to
  // /api/auth/sms/start and the server rejected with 'phone_required',
  // surfacing as a generic "Failed to send code" toast with no next action.
  // Capture the phone in local state first for that population, then use it
  // for both /start and /verify + /phone-session so the downstream chain
  // sees the same E.164 string throughout.
  const [capturedPhone, setCapturedPhone] = useState<string>("");
  const [phoneInput, setPhoneInput] = useState<string>("");
  const [phoneInputError, setPhoneInputError] = useState<string | null>(null);
  const [emailPollInterval, setEmailPollInterval] = useState<number | null>(null);
  // Resend cooldown (2026-08-16 audit D5). Server rate-limits already exist;
  // this is the UX surface so users can see the wait instead of spam-tapping
  // into silent 429s. 60s for phone code, 90s for activation email.
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [emailCooldown, setEmailCooldown] = useState(0);
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setInterval(() => setOtpCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [otpCooldown]);
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const t = setInterval(() => setEmailCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [emailCooldown]);

  const userId = user?.uid;

  // ── Fetch activation state ──────────────────────────────────────────────
  // uid is scoped in the queryKey only for cache-invalidation-on-account-switch;
  // the wire request is auth-derived (Bearer / pw_session cookie via apiRequest).
  // The previous `?userId=<uid>` variant let any caller read any user's state.
  const { data: activation, isLoading } = useQuery<ActivationState>({
    queryKey: ["/api/onboarding-verification/activation-status", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/onboarding-verification/activation-status");
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: emailPollInterval ?? false,
  });

  // Seed the captured phone from the Firebase user if it exists — email-first
  // signups will leave this empty and be prompted for the number below.
  useEffect(() => {
    if (!capturedPhone && user?.phoneNumber) setCapturedPhone(user.phoneNumber);
  }, [user?.phoneNumber, capturedPhone]);

  // ── Redirect when fully active ──────────────────────────────────────────
  useEffect(() => {
    if (activation?.isFullyActive) {
      toast({
        title: t.activated,
        description: t.activatedDesc,
      });
      setLocation("/dashboard");
    }
    // t is derived from lang which is stable per render; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activation?.isFullyActive, setLocation, toast]);

  // ── Compute step statuses ───────────────────────────────────────────────
  // Mobile and email are INDEPENDENT — either can be verified first. The
  // page reads back missingSteps from the server on every render so a fresh
  // load, cross-device continuation, or resume-after-close all pick up at
  // exactly the right pair of remaining steps. There is no client-side
  // ordering: whichever the user completes first, the other stays available.
  const mobileComplete = !!activation?.mobileVerifiedAt;
  const emailComplete = !!activation?.emailVerifiedAt;
  const allComplete = activation?.isFullyActive ?? false;

  // ── Send OTP ────────────────────────────────────────────────────────────
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      // Signup-friction audit 2026-08-19 SEV-2 #3: for email-first signups
      // user.phoneNumber is null. Require the captured E.164 first so we
      // never post {phone: undefined} → server 'phone_required' → generic
      // "Failed to send code" dead-end.
      const phone = capturedPhone || user?.phoneNumber || "";
      if (!phone) throw new Error("No phone number on account");
      // Canonical SMS route (audit item 181, D6). Was /api/auth/phone/send-code
      // which is @deprecated per publicAuthRoutes.ts. Same server-side rate
      // limiting + Turnstile guard; same response envelope.
      const res = await apiRequest("POST", "/api/auth/sms/start", {
        phone,
        flow: 'activation',
        language: lang,
      });
      return res.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      toast({ title: t.codeSent, description: t.codeSentDesc });
    },
    onError: () => {
      toast({ title: t.codeSendFailed, description: t.codeSendFailedDesc, variant: "destructive" });
    },
  });

  // ── Verify OTP ──────────────────────────────────────────────────────────
  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      // Canonical SMS verify route (audit item 181, D6). Was
      // /api/auth/phone/verify-code (deprecated). Returns the same
      // verificationToken so the downstream /validate-tokens call is unchanged.
      // Reuse the exact phone we passed to /start so the OTP-store key
      // (server-side normalized E.164) matches on lookup.
      const phone = capturedPhone || user?.phoneNumber || "";
      const res = await apiRequest("POST", "/api/auth/sms/verify", {
        phone,
        code,
        flow: 'activation',
        language: lang,
      });
      const data = await res.json();
      if (!data.success && !data.verified && !data.ok) throw new Error(data.message || "Invalid code");
      // Now persist activation via validate-tokens with userId
      if (userId) {
        await apiRequest("POST", "/api/onboarding-verification/validate-tokens", {
          userId,
          smsToken: data.verificationToken,
        });
      }
      return data;
    },
    onSuccess: () => {
      setOtpCode("");
      queryClient.invalidateQueries({
        queryKey: ["/api/onboarding-verification/activation-status", userId],
      });
      toast({ title: t.mobileVerified, description: t.mobileVerifiedDesc });
    },
    onError: (err: any) => {
      toast({
        title: t.verifyFailed,
        description: err.message || t.verifyFailedDesc,
        variant: "destructive",
      });
    },
  });

  // ── Send activation email ───────────────────────────────────────────────
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const firstName = user?.displayName?.split(" ")[0] || "Member";
      // Signup-friction audit 2026-08-19 SEV-2 #4: `language` was hardcoded
      // to "en" — the server's email-template picker keyed off this field so
      // Hebrew users got an English activation email even after completing
      // the whole flow in Hebrew. Pass the runtime language instead.
      const res = await apiRequest("POST", "/api/onboarding-verification/send-activation-email", {
        userId,
        email: user?.email,
        firstName,
        language: lang,
      });
      return res.json();
    },
    onSuccess: () => {
      // Start polling for email click
      setEmailPollInterval(5000);
      toast({
        title: t.emailSent,
        description: t.emailSentDesc,
      });
    },
    onError: () => {
      toast({
        title: t.emailSendFailed,
        description: t.emailSendFailedDesc,
        variant: "destructive",
      });
    },
  });

  // Stop polling once email is verified
  useEffect(() => {
    if (emailComplete && emailPollInterval) {
      setEmailPollInterval(null);
    }
  }, [emailComplete, emailPollInterval]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir={isHe ? 'rtl' : 'ltr'}>
        <Loader2 className="w-6 h-6 animate-spin text-[#0a0a0a]" />
      </div>
    );
  }

  // Email-first signups (Google / Apple / email+password) never populated
  // user.phoneNumber. Ask for it up front, validate to E.164, and only then
  // unlock the "Send verification code" button below.
  const needsPhoneCapture = !mobileComplete && !capturedPhone;

  return (
    <div className="min-h-screen bg-white" dir={isHe ? 'rtl' : 'ltr'} data-testid="page-activate-account">
      <div className="max-w-lg mx-auto px-6 py-16">

        {/* Brand mark */}
        <div className="mb-12">
          <div className="inline-block bg-[#1a1a1a] px-4 py-2 rounded-sm">
            <span className="text-[#0a0a0a] text-xs font-bold tracking-[3px] uppercase">
              {t.brand}
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-2">
          <p className="text-xs tracking-[3px] uppercase text-[#0a0a0a] font-semibold mb-3">
            {t.kicker}
          </p>
          <h1 className="text-3xl font-light text-[#1a1a1a] tracking-tight mb-3">
            {t.heading}
          </h1>
          <div className="w-12 h-0.5 bg-[#1a1a1a] mb-6" />
          <p className="text-sm text-[#666] leading-relaxed font-light">
            {t.intro}
          </p>
        </div>

        {/* Step progress — mobile + email in PARALLEL. Both are "active" while
            pending, so neither reads as gated on the other. Order in the tree
            is fixed for visual stability, but the buttons below let the user
            complete them in whichever order suits them (or the order they
            resumed from). */}
        <div className="my-10 bg-white border border-[#f0f0f0] rounded-sm p-6">
          <StepItem
            number={1}
            label={t.stepCreate}
            status="complete"
          />
          <StepConnector complete={true} />
          <StepItem
            number={2}
            label={t.stepVerifyMobile}
            status={mobileComplete ? "complete" : "active"}
          />
          <StepConnector complete={mobileComplete && emailComplete} />
          <StepItem
            number={3}
            label={t.stepVerifyEmail}
            status={emailComplete ? "complete" : "active"}
          />
          <StepConnector complete={allComplete} />
          <StepItem
            number={4}
            label={t.stepActive}
            status={allComplete ? "complete" : "pending"}
          />
        </div>

        {/* Mobile verification — always available while pending, regardless
            of email state (order-independent). */}
        {!mobileComplete && (
          <div className="mb-8 border border-[#e8e8e8] rounded-sm p-6" data-testid="section-verify-mobile">
            <p className="text-xs tracking-[2px] uppercase text-[#0a0a0a] font-semibold mb-3">
              {t.verifyMobileKicker}
            </p>

            {needsPhoneCapture ? (
              /* Signup-friction audit 2026-08-19 SEV-2 #3: email-first
                 signups need to add a phone number FIRST. Without this
                 block the user would tap "Send code" against
                 phone=undefined and get a generic "Failed to send code"
                 toast with no next action. */
              <div className="space-y-3" data-testid="section-capture-phone">
                <p className="text-sm text-[#555] font-light leading-relaxed">
                  {t.addPhoneDesc}
                </p>
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder={t.phonePlaceholder}
                  value={phoneInput}
                  onChange={(e) => { setPhoneInput(e.target.value); if (phoneInputError) setPhoneInputError(null); }}
                  className="border-[#1a1a1a] rounded-sm h-11 font-light"
                  dir="ltr"
                  data-testid="input-capture-phone"
                />
                {phoneInputError && (
                  <p className="text-xs text-red-600" data-testid="text-capture-phone-error">
                    {phoneInputError}
                  </p>
                )}
                <Button
                  onClick={() => {
                    const normalized = normalizePhoneE164Local(phoneInput);
                    if (!E164_RE.test(normalized)) {
                      setPhoneInputError(t.invalidPhone);
                      return;
                    }
                    setCapturedPhone(normalized);
                    setPhoneInput(normalized);
                  }}
                  disabled={!phoneInput}
                  data-testid="button-capture-phone-continue"
                  className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white text-xs tracking-[2px] uppercase rounded-sm h-11"
                >
                  {t.continue}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#555] font-light mb-4 leading-relaxed">
                  {capturedPhone ? t.sendCodeDesc(capturedPhone) : t.sendCodeDescFallback}
                </p>
                {!otpSent ? (
                  <Button
                    onClick={() => { setOtpCooldown(60); sendOtpMutation.mutate(); }}
                    disabled={sendOtpMutation.isPending || otpCooldown > 0}
                    data-testid="button-send-otp"
                    className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white text-xs tracking-[2px] uppercase rounded-sm h-11"
                  >
                    {sendOtpMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : otpCooldown > 0 ? (
                      t.resendIn(otpCooldown)
                    ) : (
                      t.sendCode
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t.codePlaceholder}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="border-[#1a1a1a] rounded-sm text-center text-lg tracking-widest h-11 font-light"
                    />
                    <Button
                      onClick={() => verifyOtpMutation.mutate(otpCode)}
                      disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
                      className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white text-xs tracking-[2px] uppercase rounded-sm h-11"
                    >
                      {verifyOtpMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t.confirmCode
                      )}
                    </Button>
                    <button
                      onClick={() => { setOtpCooldown(60); sendOtpMutation.mutate(); }}
                      className="text-xs text-[#999] hover:text-[#666] flex items-center gap-1 mx-auto disabled:opacity-50"
                      disabled={sendOtpMutation.isPending || otpCooldown > 0}
                      data-testid="button-resend-otp"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {otpCooldown > 0 ? t.resendIn(otpCooldown) : t.resend}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Email verification — order-independent. Previously gated on
            mobileComplete, which forced a rigid mobile-first flow and
            stranded users whose email arrived first (e.g. Google/Apple
            signup already provided a verified email, or the SMS provider
            had a transient outage). */}
        {!emailComplete && (
          <div className="mb-8 border border-[#e8e8e8] rounded-sm p-6" data-testid="section-verify-email">
            <p className="text-xs tracking-[2px] uppercase text-[#0a0a0a] font-semibold mb-3">
              {t.verifyEmailKicker}
            </p>
            <p className="text-sm text-[#555] font-light mb-4 leading-relaxed">
              {user?.email ? t.emailDesc(user.email) : t.emailDescFallback}
            </p>

            {emailPollInterval ? (
              <div className="flex items-center gap-3 text-sm text-[#666] font-light">
                <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a]" />
                <span>{t.emailWaiting}</span>
              </div>
            ) : (
              <Button
                onClick={() => { setEmailCooldown(90); sendEmailMutation.mutate(); }}
                disabled={sendEmailMutation.isPending || emailCooldown > 0}
                data-testid="button-send-activation-email"
                className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white text-xs tracking-[2px] uppercase rounded-sm h-11 disabled:bg-[#ddd] disabled:text-[#aaa]"
              >
                {sendEmailMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : emailCooldown > 0 ? (
                  t.resendIn(emailCooldown)
                ) : (
                  t.sendEmail
                )}
              </Button>
            )}
          </div>
        )}

        {/* Resume banners — derived from server-side activation state, so a
            page reload / device switch / cross-tab return picks up at the
            correct remaining step without any client-side session storage.
            missingSteps drives both branches; the pair is intentionally
            exclusive (both-missing shows neither banner — the section cards
            above cover that case). */}
        {mobileComplete && !emailComplete && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-sm mb-6" data-testid="banner-resume-email">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed font-light">
              {t.resumeEmailBanner}
            </p>
          </div>
        )}

        {!mobileComplete && emailComplete && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-sm mb-6" data-testid="banner-resume-mobile">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed font-light">
              {t.resumeMobileBanner}
            </p>
          </div>
        )}

        {/* Support footer */}
        <p className="text-xs text-[#bbb] text-center font-light mt-8">
          {t.needHelp}{" "}
          <a href="mailto:support@petwash.co.il" className="underline hover:text-[#888]">
            support@petwash.co.il
          </a>
        </p>

      </div>
    </div>
  );
}
