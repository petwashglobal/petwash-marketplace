import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Briefcase, ChevronDown, ShieldCheck } from "lucide-react";
import { PetWashIcon } from "@/components/PetWashIcon";
import { getApiUrl } from "@/lib/apiConfig";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { SIGNUP_INTENT, type SignupIntent } from "@shared/lib/onboardingIntent";

// Phase D — explicit pick. The previous 10-second auto-customer
// countdown silently assigned `customer` to anyone who paused. Users
// on slow devices, accessibility readers, or who simply paused to
// read got the wrong role with no second chance. The page now waits
// for an explicit click.
//
// 2026-07-03 — this page is POST-LOGIN ONLY. SignUpLuxury is the single
// pre-signup door (#1189); the old dark pre-signup fork here was off-brand
// and is gone. Anonymous visitors are redirected to /signup. The page
// remains only for the authenticated NO_ROLE fork (post-login.ts), now in
// brand style: white, black type, gold accents.

export default function ChooseRole() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useFirebaseAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [showStaff, setShowStaff] = useState(false);
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";

  // Anonymous visitors never see this screen — the single signup door decides.
  useEffect(() => {
    if (!authLoading && !user) navigate("/signup", { replace: true });
  }, [authLoading, user, navigate]);

  // Defensive fallback if /api/auth/choose-role fails — never strand the user.
  const FALLBACK_ROUTE: Record<SignupIntent, string> = {
    [SIGNUP_INTENT.CUSTOMER]: "/signup",
    [SIGNUP_INTENT.PROVIDER]: "/become-provider",
    [SIGNUP_INTENT.STAFF]: "/signup",
  };

  const handleChoice = async (intent: SignupIntent) => {
    if (loading) return;
    setLoading(intent);
    try {
      const res = await fetch(getApiUrl("/api/auth/choose-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ intent }),
      });
      const data = await res.json().catch(() => ({}));
      const destination = data.redirectTo || data.nextUrl || FALLBACK_ROUTE[intent];
      navigate(destination);
    } catch (err) {
      console.error("[ChooseRole] Error:", err);
      navigate(FALLBACK_ROUTE[intent]);
    }
  };

  const busy = !!loading;

  if (authLoading || !user) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-white flex items-center justify-center p-4"
      dir={isHe ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#D4AF37]/40 mb-5">
            <PetWashIcon name="brand_paw" size={30} label="PetWash" />
          </div>
          <h1 className="text-2xl font-light tracking-wide text-[#0a0a0a] mb-2">
            {isHe ? "ברוכים הבאים ל-PetWash™" : "Welcome to PetWash™"}
          </h1>
          <p className="text-gray-500 text-sm">
            {isHe ? "רק שאלה אחת — מה מביא אותך לכאן?" : "Just one quick question — what brings you here?"}
          </p>
        </div>

        {/* Primary — Book services. Explicit pick — no countdown. */}
        <button
          disabled={busy}
          onClick={() => handleChoice(SIGNUP_INTENT.CUSTOMER)}
          className="w-full bg-white border border-gray-200 hover:border-[#D4AF37] rounded-2xl p-5 text-start transition-all shadow-sm hover:shadow-md disabled:opacity-70"
          data-testid="choose-role-customer"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 rounded-xl p-3 border border-[#D4AF37]/30">
              {loading === SIGNUP_INTENT.CUSTOMER
                ? <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" />
                : <PetWashIcon name="product_organic_soap" size={24} label="Book pet services" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg leading-tight text-[#0a0a0a]">
                {isHe ? "הזמנת שירותים לחיית המחמד" : "Book pet services"}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">
                {isHe
                  ? "שטיפה · טיפוח · שמרטפות · טיולים · ועוד"
                  : "Washing · Grooming · Sitting · Walking · and more"}
              </p>
            </div>
          </div>
        </button>

        {/* Secondary — Become a provider */}
        <button
          disabled={busy}
          onClick={() => handleChoice(SIGNUP_INTENT.PROVIDER)}
          className="w-full bg-white border border-gray-200 hover:border-[#D4AF37] rounded-2xl p-5 text-start transition-all shadow-sm hover:shadow-md disabled:opacity-70"
          data-testid="choose-role-provider"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 rounded-xl p-3 border border-[#D4AF37]/30">
              {loading === SIGNUP_INTENT.PROVIDER
                ? <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" />
                : <Briefcase className="h-7 w-7 text-[#D4AF37]" />}
            </div>
            <div>
              <p className="font-semibold text-base text-[#0a0a0a]">
                {isHe ? "אני רוצה להציע שירותים" : "I want to offer services"}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">
                {isHe ? "הפוך לנותן שירות והרוויח עם PetWash™" : "Join our provider network and earn"}
              </p>
            </div>
          </div>
        </button>

        {/* Tertiary — Staff / Admin (collapsed by default) */}
        {!showStaff ? (
          <button
            className="w-full text-center text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
            onClick={() => setShowStaff(true)}
          >
            <span className="inline-flex items-center gap-1">
              {isHe ? "עובד PetWash? לחץ כאן" : "PetWash employee? Click here"}
              <ChevronDown className="h-3 w-3" />
            </span>
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => handleChoice(SIGNUP_INTENT.STAFF)}
            className="w-full bg-white border border-gray-100 hover:border-gray-300 text-gray-600 rounded-2xl p-4 text-start transition-all shadow-sm disabled:opacity-70"
            data-testid="choose-role-staff"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 rounded-xl p-2.5 border border-gray-200">
                {loading === SIGNUP_INTENT.STAFF
                  ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  : <ShieldCheck className="h-5 w-5 text-gray-400" />}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {isHe ? "גישת צוות / ניהול" : "Staff / Admin access"}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {isHe ? "נדרש אישור מנהל" : "Requires manager approval"}
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
