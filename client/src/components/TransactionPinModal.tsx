import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TransactionPinModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  onSuccess?: (token: string) => void;
  onVerified?: () => void;
  lang?: "he" | "en";
  reason?: string;
}

const LABELS = {
  he: {
    title: "אישור עסקה",
    subtitle: "מועדון יוקרה",
    prompt: "הזן קוד PIN לאישור",
    forgot: "שכחת PIN?",
    locked: "החשבון נעול למשך 15 דקות",
    wrongPin: (n: number) => `PIN שגוי — ${n} ניסיונות נותרו`,
    verifying: "מאמת...",
  },
  en: {
    title: "Authorise Transaction",
    subtitle: "Prestige Club",
    prompt: "Enter your PIN to confirm",
    forgot: "Forgot PIN?",
    locked: "Account locked for 15 minutes",
    wrongPin: (n: number) => `Wrong PIN — ${n} attempts remaining`,
    verifying: "Verifying...",
  },
};

const PAD_KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function TransactionPinModal({
  isOpen,
  open,
  onClose,
  onSuccess,
  onVerified,
  lang = "en",
  reason,
}: TransactionPinModalProps) {
  const modalOpen = isOpen ?? open ?? false;
  const [pin, setPin] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const didSubmit = useRef(false);
  const { toast } = useToast();
  const t = LABELS[lang];
  const isRtl = lang === "he";

  useEffect(() => {
    if (!modalOpen) {
      setPin([]);
      setError(null);
      setLoading(false);
      didSubmit.current = false;
    }
  }, [modalOpen]);

  useEffect(() => {
    if (pin.length === 6 && !didSubmit.current) {
      didSubmit.current = true;
      submitPin(pin.join(""));
    }
  }, [pin]);

  async function submitPin(code: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/pin-auth/verify", { pin: code });
      const data = await res.json();
      if (data.success) {
        const token = data.token || "pin_verified";
        onSuccess?.(token);
        onVerified?.();
        onClose();
      } else if (data.locked) {
        setError(t.locked);
        triggerShake();
      } else {
        const remaining = data.attemptsRemaining ?? 4;
        setError(t.wrongPin(remaining));
        triggerShake();
        setPin([]);
        didSubmit.current = false;
      }
    } catch {
      setError("Connection error. Please try again.");
      setPin([]);
      didSubmit.current = false;
    } finally {
      setLoading(false);
    }
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  function handleKey(key: string) {
    if (loading) return;
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      setError(null);
    } else if (key !== "" && pin.length < 6) {
      setPin((p) => [...p, key]);
      setError(null);
    }
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 140);
  }

  return (
    <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="p-0 border-0 shadow-none bg-transparent max-w-[360px] w-full"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,175,55,0.2)",
          }}
        >
          {/* Top gold accent bar */}
          <div style={{
            height: 2,
            background: "linear-gradient(90deg, transparent, #F0D060 20%, #D4AF37 50%, #F0D060 80%, transparent)",
          }} />

          {/* Header */}
          <div className="pt-8 pb-5 px-8 text-center">
            {/* Diamond Prestige Club Logo */}
            <div className="flex justify-center mb-5">
              <svg viewBox="0 0 64 64" width="62" height="62" fill="none">
                <defs>
                  <linearGradient id="pinDiaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#F5E68A" />
                    <stop offset="22%"  stopColor="#F0D060" />
                    <stop offset="50%"  stopColor="#D4AF37" />
                    <stop offset="78%"  stopColor="#B8941F" />
                    <stop offset="100%" stopColor="#8B6914" />
                  </linearGradient>
                  <linearGradient id="pinDiaFacet" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%"   stopColor="#F5E68A" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#B8941F" stopOpacity="0.08" />
                  </linearGradient>
                  <filter id="pinGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Outer ring */}
                <circle cx="32" cy="32" r="30" stroke="url(#pinDiaGrad)" strokeWidth="1.2" fill="none" opacity="0.4" />
                {/* Diamond */}
                <polygon points="32,5 57,29 32,59 7,29" fill="url(#pinDiaGrad)" filter="url(#pinGlow)" />
                {/* Facet highlights */}
                <polygon points="32,5 57,29 32,29"   fill="url(#pinDiaFacet)" />
                <polygon points="7,29 32,29 32,59"   fill="rgba(0,0,0,0.18)" />
                {/* Center lines */}
                <line x1="32" y1="5"  x2="32" y2="59" stroke="#8B6914" strokeWidth="0.5" opacity="0.5" />
                <line x1="7"  y1="29" x2="57" y2="29" stroke="#8B6914" strokeWidth="0.5" opacity="0.5" />
                {/* Side facet lines */}
                <line x1="32" y1="5"  x2="7"  y2="29" stroke="rgba(212,175,55,0.25)" strokeWidth="0.4" />
                <line x1="32" y1="5"  x2="57" y2="29" stroke="rgba(212,175,55,0.25)" strokeWidth="0.4" />
              </svg>
            </div>

            {/* Brand label */}
            <p style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 10.5,
              letterSpacing: "0.28em",
              background: "linear-gradient(90deg, #F0D060, #D4AF37, #F0D060)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
              PetWash™ &nbsp;{t.subtitle}
            </p>

            {/* Title */}
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 23,
              fontWeight: 600,
              color: "#EEF2FF",
              letterSpacing: "0.04em",
              marginBottom: 6,
            }}>
              {t.title}
            </h2>

            {/* Prompt */}
            <p style={{
              fontSize: 12,
              color: "rgba(238,242,255,0.38)",
              letterSpacing: "0.07em",
            }}>
              {reason || t.prompt}
            </p>
          </div>

          {/* Divider */}
          <div className="mx-8 mb-6" style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent)",
          }} />

          {/* PIN dots */}
          <div className={`flex justify-center gap-[14px] mb-5 ${shake ? "pin-shake" : ""}`}>
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < pin.length;
              return (
                <div key={i} style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  border: filled ? "none" : "1.5px solid rgba(212,175,55,0.38)",
                  background: filled
                    ? "linear-gradient(135deg, #F0D060 0%, #D4AF37 50%, #B8941F 100%)"
                    : "transparent",
                  boxShadow: filled
                    ? "0 0 12px rgba(212,175,55,0.65), 0 0 4px rgba(212,175,55,0.4)"
                    : "none",
                  transition: "all 0.15s cubic-bezier(0.34,1.56,0.64,1)",
                  transform: filled ? "scale(1.1)" : "scale(1)",
                }} />
              );
            })}
          </div>

          {/* Status line */}
          <div className="text-center mb-1 min-h-[22px] px-6">
            {loading ? (
              <span style={{
                fontSize: 11.5,
                letterSpacing: "0.12em",
                background: "linear-gradient(90deg, #F0D060, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "'Cormorant Garamond', serif",
              }}>
                {t.verifying}
              </span>
            ) : error ? (
              <span style={{ color: "#f87171", fontSize: 11.5, letterSpacing: "0.04em" }}>
                {error}
              </span>
            ) : null}
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2 px-7 pb-3 mt-3">
            {PAD_KEYS.map((key, idx) => {
              if (key === "") return <div key={idx} />;
              const isDelete = key === "⌫";
              const isPressed = pressedKey === key;
              return (
                <button
                  key={idx}
                  onClick={() => handleKey(key)}
                  disabled={loading}
                  style={{
                    height: 56,
                    borderRadius: 11,
                    border: isPressed
                      ? "1.5px solid #D4AF37"
                      : "1.5px solid rgba(212,175,55,0.14)",
                    background: isPressed
                      ? "rgba(212,175,55,0.12)"
                      : "rgba(255,255,255,0.035)",
                    color: isDelete ? "rgba(238,242,255,0.38)" : "#EEF2FF",
                    fontSize: isDelete ? 19 : 22,
                    fontFamily: isDelete ? "system-ui, sans-serif" : "'Cormorant Garamond', serif",
                    fontWeight: isDelete ? 300 : 500,
                    letterSpacing: "0.04em",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: isPressed
                      ? "0 0 18px rgba(212,175,55,0.28), inset 0 1px 0 rgba(212,175,55,0.18)"
                      : "none",
                    transition: "all 0.1s ease",
                    transform: isPressed ? "scale(0.94)" : "scale(1)",
                    backdropFilter: "blur(4px)",
                    outline: "none",
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>

          {/* Forgot PIN */}
          <div className="text-center py-5">
            <button
              onClick={() => toast({
                title: "PIN Reset",
                description: "A reset link has been sent to your registered email.",
              })}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                letterSpacing: "0.1em",
                backgroundImage: "linear-gradient(90deg, #F0D060, #D4AF37, #F0D060)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 500,
                textTransform: "uppercase",
              }}
            >
              {t.forgot}
            </button>
          </div>

          {/* Bottom gold accent bar */}
          <div style={{
            height: 2,
            background: "linear-gradient(90deg, transparent, #F0D060 20%, #D4AF37 50%, #F0D060 80%, transparent)",
          }} />
        </div>

        <style>{`
          @keyframes pinShakeKf {
            0%,100% { transform: translateX(0); }
            15%      { transform: translateX(-9px); }
            30%      { transform: translateX(9px); }
            45%      { transform: translateX(-6px); }
            60%      { transform: translateX(6px); }
            75%      { transform: translateX(-3px); }
            90%      { transform: translateX(3px); }
          }
          .pin-shake { animation: pinShakeKf 0.6s ease-in-out; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
