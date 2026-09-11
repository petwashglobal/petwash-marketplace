import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Link } from "wouter";
import { Loader2, Check, ShieldCheck } from "lucide-react";
import { PhoneInput } from "@/components/PhoneInput";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import { PetWashLogo } from "@/components/brand/PetWashLogo";
import { getApiUrl } from "@/lib/apiConfig";
import { apiRequest } from "@/lib/queryClient";
import { resolvePostLogin } from "@/lib/postLoginCoordinator";
import { useToast } from "@/hooks/use-toast";
import { readReturnTo } from "@/auth/returnTo";

/**
 * /complete-profile — "עוד רגע מסיימים את ההצטרפות".
 *
 * Google / Apple / OTP are AUTHENTICATION only; this PetWash™‎-owned screen
 * finishes the membership (CEO spec 2026-09-12):
 *   • name + email pre-filled from the account — asked only if missing
 *   • mobile + OTP (the signed-in phone flow; also reclaims a number held by
 *     an empty phone-only record — lib/phoneClaim)
 *   • ONE explicit consent line: 18+ attestation + Terms + Privacy
 *   • marketing consent separate, unchecked by default
 *   • NO date of birth, gender, address or pet — those are not base-member
 *     fields (provider KYC has its own flow)
 * A returning member with a complete profile never sees this page: the
 * server routes them to their home (and SignUpLuxury greets them on
 * /welcome-back).
 *
 * Text is centred with inline styles on purpose: Tailwind's text-center is
 * dead under html[lang="he"].
 */

interface WhoamiUser {
  id: number | string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneVerified?: boolean;
  role?: string;
  profilePictureUrl?: string;
}
interface WhoamiResponse {
  user: WhoamiUser;
  profileStatus: string;
  requiredFields: string[];
  role: string;
}

type PhoneStep = "idle" | "sending" | "code" | "verifying" | "verified";

export default function CompleteProfile() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const fromParam = readReturnTo(searchString);
  const { toast } = useToast();
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";

  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState("customer");
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [challengeId, setChallengeId] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false); // 18+ + Terms + Privacy — one explicit line
  const [marketingConsent, setMarketingConsent] = useState(false); // marketing — optional, unchecked

  const needs = (field: string) => requiredFields.includes(field);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/auth/whoami"), { credentials: "include" });
        if (!res.ok) {
          toast({ variant: "destructive", title: isHe ? "שגיאה בטעינת הפרופיל" : "Failed to load profile" });
          return;
        }
        const data: WhoamiResponse = await res.json();
        setRole(data.role || "customer");
        setRequiredFields(data.requiredFields || []);
        if (data.user) {
          if (data.user.firstName) setFirstName(data.user.firstName);
          if (data.user.lastName) setLastName(data.user.lastName);
          if (data.user.email) setEmail(data.user.email);
          if (data.user.phone) setPhone(data.user.phone);
          if (data.user.phone && data.user.phoneVerified) { setPhoneVerified(true); setPhoneStep("verified"); }
        }
      } catch {
        toast({ variant: "destructive", title: isHe ? "שגיאה בטעינת הפרופיל" : "Failed to load profile" });
      } finally {
        setInitialLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mobile: the signed-in phone flow (request → OTP → confirm) ─────────────
  const phoneErrorText = (code: string | undefined): string => {
    switch (code) {
      case "REAUTH_REQUIRED":
        return isHe ? "לצורך אבטחה יש להתחבר מחדש ואז לאמת את הנייד." : "For security, please sign in again and then verify your mobile.";
      case "CHANGE_PHONE_DISABLED":
        return isHe ? "אימות הנייד אינו זמין כרגע. נסו שוב בעוד רגע." : "Mobile verification is unavailable right now. Try again shortly.";
      case "PHONE_ALREADY_IN_USE":
        return isHe ? "המספר הזה כבר משויך לחשבון אחר." : "That mobile number already belongs to another account.";
      case "TOO_MANY_REQUESTS":
      case "RATE_LIMITED":
        return isHe ? "נשלחו יותר מדי קודים. נסו שוב בעוד כמה דקות." : "Too many codes sent. Try again in a few minutes.";
      default:
        return isHe ? "לא הצלחנו לשלוח או לאמת את הקוד. נסו שוב." : "We could not send or verify the code. Please try again.";
    }
  };

  async function sendCode() {
    setPhoneError(null);
    if (!phone || phone.replace(/\D/g, "").length < 8) {
      setPhoneError(isHe ? "הזינו מספר נייד תקין" : "Enter a valid mobile number");
      return;
    }
    setPhoneStep("sending");
    try {
      const res = await apiRequest("POST", "/api/user/settings/phone/request-change", { newPhone: phone });
      const d = await res.json().catch(() => ({} as any));
      setChallengeId(d?.verificationChallengeId || "");
      setPhoneStep("code");
    } catch (err: any) {
      setPhoneStep("idle");
      setPhoneError(phoneErrorText(err?.body?.code || err?.body?.error));
    }
  }

  async function confirmCode(code: string) {
    setPhoneError(null);
    setPhoneStep("verifying");
    try {
      await apiRequest("POST", "/api/user/settings/phone/confirm-change", {
        verificationCode: code,
        verificationChallengeId: challengeId || undefined,
      });
      setPhoneVerified(true);
      setPhoneStep("verified");
    } catch (err: any) {
      setPhoneStep("code");
      setPhoneError(err?.body?.code === "INVALID_CODE" || err?.status === 400
        ? (isHe ? "קוד שגוי או שפג תוקפו. נסו שוב או בקשו קוד חדש." : "Wrong or expired code. Try again or request a new one.")
        : phoneErrorText(err?.body?.code || err?.body?.error));
    }
  }

  // ── Continue ────────────────────────────────────────────────────────────────
  const nameOk = (!needs("firstName") || !!firstName.trim()) && (!needs("lastName") || !!lastName.trim());
  const consentNeeded = needs("termsAcceptedAt") || needs("privacyAcceptedAt");
  // Continue only with a VERIFIED mobile and the explicit 18+/Terms/Privacy consent.
  const canContinue =
    nameOk &&
    (!needs("phone") || phoneVerified) &&
    (!consentNeeded || consent) &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        marketingConsent,
        ...(needs("firstName") ? { firstName: firstName.trim() } : {}),
        ...(needs("lastName") ? { lastName: lastName.trim() } : {}),
        ...(consentNeeded
          ? {
              termsAccepted: consent,
              privacyAccepted: consent,
              ageConfirmed18Plus: consent,
            }
          : {}),
      };
      const res = await fetch(getApiUrl("/api/auth/complete-profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: data?.error === "AGE_CONFIRMATION_REQUIRED"
            ? (isHe ? "יש לאשר שאתם בני 18 ומעלה" : "Please confirm you are 18 or older")
            : (isHe ? "שגיאה בשמירת הפרופיל" : "Error saving profile"),
        });
        return;
      }
      // Where next: the interrupted page if any, else the server's decision.
      if (fromParam) { navigate(fromParam); return; }
      const postLogin: any = await resolvePostLogin({});
      navigate(postLogin?.nextUrl || postLogin?.redirectTo || "/pet-parent/home");
    } catch {
      toast({ variant: "destructive", title: isHe ? "שגיאה בשמירת הפרופיל" : "Error saving profile" });
    } finally {
      setSubmitting(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const initial = (firstName || email || "?").slice(0, 1).toUpperCase();
  const title = firstName
    ? (isHe ? `ברוכים הבאים ל־PetWash™‎, ${firstName}` : `Welcome to PetWash™‎, ${firstName}`)
    : (isHe ? "ברוכים הבאים ל־PetWash™‎" : "Welcome to PetWash™‎");
  const subtitle = role === "provider"
    ? (isHe ? "פרטים בסיסיים לפני תחילת ההרשמה כספק" : "Basic details before your provider application")
    : (isHe ? "עוד רגע מסיימים את ההצטרפות" : "One more moment and you're in");

  return (
    <div className="min-h-screen bg-white flex flex-col" dir={isHe ? "rtl" : "ltr"} data-testid="complete-profile">
      <header className="flex items-center justify-between px-5 pt-5">
        <PetWashLogo className="h-9" />
        <div className="w-9 h-9 rounded-full bg-[#0c6b48] text-white flex items-center justify-center font-semibold" aria-hidden>
          {initial}
        </div>
      </header>

      <main className="flex-1 px-5 pb-10 pt-6 max-w-md w-full mx-auto">
        <h1 className="text-[28px] leading-tight font-semibold text-gray-900" style={{ textAlign: isHe ? "right" : "left" }}>
          {title}
        </h1>
        <p className="text-gray-500 mt-1" style={{ textAlign: isHe ? "right" : "left" }}>{subtitle}</p>

        {/* Identity from the sign-in provider — shown, not asked again */}
        {(firstName || email) && !needs("firstName") && !needs("lastName") && (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm" data-testid="complete-profile-identity">
            <div className="font-medium text-gray-900">{[firstName, lastName].filter(Boolean).join(" ")}</div>
            {email && <div className="text-gray-500">{email}</div>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {(needs("firstName") || needs("lastName")) && (
            <section className="grid grid-cols-2 gap-3">
              {needs("firstName") && (
                <label className="block">
                  <span className="text-sm text-gray-700">{isHe ? "שם פרטי" : "First name"}</span>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                    data-testid="complete-profile-first-name" />
                </label>
              )}
              {needs("lastName") && (
                <label className="block">
                  <span className="text-sm text-gray-700">{isHe ? "שם משפחה" : "Last name"}</span>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
                    data-testid="complete-profile-last-name" />
                </label>
              )}
            </section>
          )}

          {needs("phone") && (
            <section data-testid="complete-profile-phone">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{isHe ? "מספר טלפון נייד" : "Mobile number"}</span>
                {phoneVerified && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#0c6b48]" data-testid="complete-profile-phone-verified">
                    <Check className="w-3.5 h-3.5" /> {isHe ? "אומת" : "Verified"}
                  </span>
                )}
              </div>
              {!phoneVerified && (
                <>
                  <div className="mt-2">
                    <PhoneInput value={phone} onChange={(v: string) => { setPhone(v); setPhoneError(null); if (phoneStep === "code") setPhoneStep("idle"); }} language={isHe ? "he" : "en"} defaultCountry="IL" />
                  </div>
                  {phoneStep !== "code" && phoneStep !== "verifying" && (
                    <button type="button" onClick={sendCode} disabled={phoneStep === "sending"}
                      className="mt-3 w-full rounded-full border border-gray-900 py-3 text-sm font-medium text-gray-900 disabled:opacity-50"
                      data-testid="complete-profile-send-code">
                      {phoneStep === "sending" ? (isHe ? "שולח קוד…" : "Sending code…") : (isHe ? "שליחת קוד" : "Send code")}
                    </button>
                  )}
                  {(phoneStep === "code" || phoneStep === "verifying") && (
                    <div className="mt-3">
                      <OtpCodeInput
                        length={6}
                        onComplete={confirmCode}
                        loading={phoneStep === "verifying"}
                        error={phoneError || undefined}
                        language={isHe ? "he" : "en"}
                        title={isHe ? "הזינו את הקוד שנשלח לנייד" : "Enter the code we sent"}
                        subtitle={phone}
                      />
                      <button type="button" onClick={sendCode} className="mt-2 text-xs text-gray-500 underline-offset-4 hover:underline" data-testid="complete-profile-resend">
                        {isHe ? "שלח קוד חדש" : "Send a new code"}
                      </button>
                    </div>
                  )}
                  {phoneError && phoneStep !== "code" && (
                    <p className="mt-2 text-sm text-red-600" data-testid="complete-profile-phone-error">{phoneError}</p>
                  )}
                </>
              )}
            </section>
          )}

          {consentNeeded && (
            <section className="space-y-3" data-testid="complete-profile-consent">
              <label className="flex items-start gap-3 text-sm text-gray-800">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" data-testid="complete-profile-consent-checkbox" />
                <span>
                  {isHe ? "אני בן/בת 18 ומעלה ומסכים/ה ל" : "I am 18 or older and I agree to the "}
                  <Link href="/terms" className="underline underline-offset-2">{isHe ? "תנאי השימוש" : "Terms of Service"}</Link>
                  {isHe ? " ול" : " and the "}
                  <Link href="/privacy" className="underline underline-offset-2">{isHe ? "מדיניות הפרטיות" : "Privacy Policy"}</Link>
                  {isHe ? " של PetWash™‎." : " of PetWash™‎."}
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-gray-600">
                <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1 h-4 w-4" data-testid="complete-profile-marketing-checkbox" />
                <span>{isHe ? "אני רוצה לקבל הטבות, עדכונים ומבצעים — אופציונלי" : "Send me perks, updates and offers — optional"}</span>
              </label>
            </section>
          )}

          <button type="submit" disabled={!canContinue}
            className="w-full rounded-full bg-black text-white py-4 text-base font-medium disabled:opacity-40 active:scale-[0.99] transition"
            data-testid="complete-profile-continue">
            {submitting ? (isHe ? "שומר…" : "Saving…") : (isHe ? "המשך" : "Continue")}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5" /> {isHe ? "מאובטח ומוצפן · הנתונים שלך בטוחים" : "Secure and encrypted · your data is safe"}
          </p>
        </form>
      </main>
    </div>
  );
}
