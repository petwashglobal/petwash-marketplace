import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Paw, Briefcase, ChevronDown } from "lucide-react";
import { getApiUrl } from "@/lib/apiConfig";

const AUTO_PROCEED_SECONDS = 10;

export default function ChooseRole() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);
  const [showStaff, setShowStaff] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_PROCEED_SECONDS);
  const lang = localStorage.getItem("i18nextLng") || "he";
  const isHe = lang === "he";

  // Auto-proceed as customer after countdown — 95%+ of new users are customers
  useEffect(() => {
    if (loading) return;
    if (countdown <= 0) {
      handleChoice("customer");
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, loading]);

  const handleChoice = async (intent: "customer" | "provider" | "staff_request") => {
    if (loading) return;
    setLoading(intent);
    try {
      const res = await fetch(getApiUrl("/api/auth/choose-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ intent }),
      });
      const data = await res.json();
      if (data.redirectTo) {
        navigate(data.redirectTo);
      }
    } catch (err) {
      console.error("[ChooseRole] Error:", err);
      setLoading(null);
    }
  };

  const busy = !!loading;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111827] flex items-center justify-center p-4"
      dir={isHe ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/10 mb-4">
            <span className="text-3xl">🐾</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-1">
            {isHe ? "ברוכים הבאים ל-PetWash™" : "Welcome to PetWash™"}
          </h1>
          <p className="text-gray-400 text-sm">
            {isHe ? "אנחנו רק רוצים לדעת — מה מביא אותך לכאן?" : "Just one quick question — what brings you here?"}
          </p>
        </div>

        {/* Primary CTA — Book services */}
        <button
          disabled={busy}
          onClick={() => handleChoice("customer")}
          className="w-full group relative bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-2xl p-5 text-start transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-70"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 bg-black/10 rounded-xl p-3">
              {loading === "customer"
                ? <Loader2 className="h-7 w-7 animate-spin" />
                : <span className="text-2xl">🛁</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg leading-tight">
                {isHe ? "הזמנת שירותים לחיית המחמד" : "Book pet services"}
              </p>
              <p className="text-black/60 text-sm mt-0.5">
                {isHe
                  ? "שטיפה · טיפוח · שמרטפות · טיולים · ועוד"
                  : "Washing · Grooming · Sitting · Walking · and more"}
              </p>
            </div>
            {!loading && (
              <span className="text-xs text-black/40 font-medium shrink-0">
                {isHe ? `${countdown}ש` : `${countdown}s`}
              </span>
            )}
          </div>
          {/* Auto-proceed progress bar */}
          {!loading && (
            <div className="absolute bottom-0 left-0 h-1 bg-black/10 rounded-b-2xl overflow-hidden w-full">
              <div
                className="h-full bg-black/20 transition-all duration-1000 ease-linear"
                style={{ width: `${((AUTO_PROCEED_SECONDS - countdown) / AUTO_PROCEED_SECONDS) * 100}%` }}
              />
            </div>
          )}
        </button>

        {/* Secondary option — Become a provider */}
        <button
          disabled={busy}
          onClick={() => handleChoice("provider")}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-2xl p-5 text-start transition-all disabled:opacity-70"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 bg-white/5 rounded-xl p-3">
              {loading === "provider"
                ? <Loader2 className="h-7 w-7 animate-spin text-white" />
                : <Briefcase className="h-7 w-7 text-amber-400" />}
            </div>
            <div>
              <p className="font-semibold text-base">
                {isHe ? "אני רוצה להציע שירותים" : "I want to offer services"}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">
                {isHe ? "הפך לנותן שירות ורוויח עם PetWash™" : "Join our provider network and earn"}
              </p>
            </div>
          </div>
        </button>

        {/* Tertiary — Staff / Admin (collapsed by default) */}
        {!showStaff ? (
          <button
            className="w-full text-center text-gray-600 hover:text-gray-400 text-sm py-2 transition-colors"
            onClick={() => { setCountdown(999); setShowStaff(true); }}
          >
            <span className="inline-flex items-center gap-1">
              {isHe ? "עובד PetWash? לחץ כאן" : "PetWash employee? Click here"}
              <ChevronDown className="h-3 w-3" />
            </span>
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => handleChoice("staff_request")}
            className="w-full bg-white/5 hover:bg-white/8 border border-white/5 text-gray-400 rounded-2xl p-4 text-start transition-all disabled:opacity-70"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 bg-white/5 rounded-xl p-2.5">
                {loading === "staff_request"
                  ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  : <span className="text-lg">🪪</span>}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {isHe ? "גישת צוות / ניהול" : "Staff / Admin access"}
                </p>
                <p className="text-gray-600 text-xs mt-0.5">
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
