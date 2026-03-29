import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

interface ActivationState {
  activationStatus: string;
  isFullyActive: boolean;
  missingSteps: string[];
}

export function ActivationBanner() {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  const { data: activation } = useQuery<ActivationState>({
    queryKey: ["/api/onboarding-verification/activation-status", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const res = await fetch(
        `/api/onboarding-verification/activation-status?userId=${user.uid}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user?.uid,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Don't render if no user, no data, or fully active
  if (!user || !activation || activation.isFullyActive) return null;

  const missingCount = activation.missingSteps?.length ?? 0;
  if (missingCount === 0) return null;

  const label =
    missingCount === 2
      ? "Verify your mobile and email to activate your account"
      : activation.missingSteps.includes("mobile")
      ? "Verify your mobile number to complete activation"
      : "Activate your email to complete activation";

  return (
    <div className="w-full bg-[#1a1a1a] text-white px-4 py-2.5 flex items-center justify-between text-xs font-light tracking-wide">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-[#c9a96e] flex-shrink-0" />
        <span>{label}</span>
      </div>
      <button
        onClick={() => setLocation("/activate-account")}
        className="flex items-center gap-1 text-[#c9a96e] hover:text-white transition-colors font-medium tracking-[1px] uppercase text-[10px] flex-shrink-0 ml-4"
      >
        Activate <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
