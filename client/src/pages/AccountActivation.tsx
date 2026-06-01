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
          <CheckCircle className="w-4 h-4 text-[#c9a96e]" />
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

export default function AccountActivation() {
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [emailPollInterval, setEmailPollInterval] = useState<number | null>(null);

  const userId = user?.uid;

  // ── Fetch activation state ──────────────────────────────────────────────
  const { data: activation, isLoading } = useQuery<ActivationState>({
    queryKey: ["/api/onboarding-verification/activation-status", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const res = await fetch(
        `/api/onboarding-verification/activation-status?userId=${userId}`
      );
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: emailPollInterval ?? false,
  });

  // ── Redirect when fully active ──────────────────────────────────────────
  useEffect(() => {
    if (activation?.isFullyActive) {
      toast({
        title: "Account activated",
        description: "Welcome to PetWash™. Your account is now fully active.",
      });
      setLocation("/dashboard");
    }
  }, [activation?.isFullyActive, setLocation, toast]);

  // ── Compute step statuses ───────────────────────────────────────────────
  const mobileComplete = !!activation?.mobileVerifiedAt;
  const emailComplete = !!activation?.emailVerifiedAt;
  const allComplete = activation?.isFullyActive ?? false;

  const currentStep = allComplete
    ? 4
    : mobileComplete && !emailComplete
    ? 3
    : !mobileComplete && emailComplete
    ? 2
    : !mobileComplete
    ? 2
    : 4;

  // ── Send OTP ────────────────────────────────────────────────────────────
  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      if (!user?.phoneNumber && !user?.email) throw new Error("No phone number on account");
      const res = await apiRequest("POST", "/api/auth/phone/send-code", {
        phone: user.phoneNumber,
      });
      return res.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      toast({ title: "Code sent", description: "Check your phone for the verification code." });
    },
    onError: () => {
      toast({ title: "Failed to send code", description: "Please try again.", variant: "destructive" });
    },
  });

  // ── Verify OTP ──────────────────────────────────────────────────────────
  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/auth/phone/verify-code", {
        phone: user?.phoneNumber,
        code,
      });
      const data = await res.json();
      if (!data.success && !data.verified) throw new Error(data.message || "Invalid code");
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
      toast({ title: "Mobile verified", description: "Your phone number is confirmed." });
    },
    onError: (err: any) => {
      toast({
        title: "Verification failed",
        description: err.message || "The code is incorrect or has expired.",
        variant: "destructive",
      });
    },
  });

  // ── Send activation email ───────────────────────────────────────────────
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const firstName = user?.displayName?.split(" ")[0] || "Member";
      const res = await apiRequest("POST", "/api/onboarding-verification/send-activation-email", {
        userId,
        email: user?.email,
        firstName,
        language: "en",
      });
      return res.json();
    },
    onSuccess: () => {
      // Start polling for email click
      setEmailPollInterval(5000);
      toast({
        title: "Activation email sent",
        description: "Check your inbox and click the activation link.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send email",
        description: "Please try again in a moment.",
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#c9a96e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" dir="ltr">
      <div className="max-w-lg mx-auto px-6 py-16">

        {/* Brand mark */}
        <div className="mb-12">
          <div className="inline-block bg-[#1a1a1a] px-4 py-2 rounded-sm">
            <span className="text-[#c9a96e] text-xs font-bold tracking-[3px] uppercase">
              PetWash™
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-2">
          <p className="text-xs tracking-[3px] uppercase text-[#c9a96e] font-semibold mb-3">
            Account Activation
          </p>
          <h1 className="text-3xl font-light text-[#1a1a1a] tracking-tight mb-3">
            Complete your account
          </h1>
          <div className="w-12 h-0.5 bg-[#1a1a1a] mb-6" />
          <p className="text-sm text-[#666] leading-relaxed font-light">
            Your wallet, rewards, and Prestige membership activate once
            both steps below are complete.
          </p>
        </div>

        {/* Step progress */}
        <div className="my-10 bg-white border border-[#f0f0f0] rounded-sm p-6">
          <StepItem
            number={1}
            label="Create account"
            status="complete"
          />
          <StepConnector complete={true} />
          <StepItem
            number={2}
            label="Verify mobile number"
            status={mobileComplete ? "complete" : "active"}
          />
          <StepConnector complete={mobileComplete} />
          <StepItem
            number={3}
            label="Activate email"
            status={emailComplete ? "complete" : mobileComplete ? "active" : "pending"}
          />
          <StepConnector complete={allComplete} />
          <StepItem
            number={4}
            label="Account active"
            status={allComplete ? "complete" : "pending"}
          />
        </div>

        {/* STEP 2 — Mobile verification */}
        {!mobileComplete && (
          <div className="mb-8 border border-[#e8e8e8] rounded-sm p-6">
            <p className="text-xs tracking-[2px] uppercase text-[#c9a96e] font-semibold mb-3">
              Step 2 — Verify mobile
            </p>
            <p className="text-sm text-[#555] font-light mb-4 leading-relaxed">
              We will send a 6-digit code to{" "}
              <span className="font-medium text-[#1a1a1a]">
                {user?.phoneNumber || "your registered mobile number"}
              </span>
              .
            </p>
            {!otpSent ? (
              <Button
                onClick={() => sendOtpMutation.mutate()}
                disabled={sendOtpMutation.isPending}
                className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white text-xs tracking-[2px] uppercase rounded-sm h-11"
              >
                {sendOtpMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send verification code"
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
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
                    "Confirm code"
                  )}
                </Button>
                <button
                  onClick={() => sendOtpMutation.mutate()}
                  className="text-xs text-[#999] hover:text-[#666] flex items-center gap-1 mx-auto"
                  disabled={sendOtpMutation.isPending}
                >
                  <RefreshCw className="w-3 h-3" /> Resend code
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Email activation */}
        {!emailComplete && (
          <div className={`mb-8 border rounded-sm p-6 ${mobileComplete ? "border-[#e8e8e8]" : "border-[#f0f0f0] opacity-60"}`}>
            <p className="text-xs tracking-[2px] uppercase text-[#c9a96e] font-semibold mb-3">
              Step 3 — Activate email
            </p>
            <p className="text-sm text-[#555] font-light mb-4 leading-relaxed">
              A premium activation email will be sent to{" "}
              <span className="font-medium text-[#1a1a1a]">
                {user?.email || "your registered email"}
              </span>
              . Click the link inside to activate.
            </p>

            {emailPollInterval ? (
              <div className="flex items-center gap-3 text-sm text-[#666] font-light">
                <Loader2 className="w-4 h-4 animate-spin text-[#c9a96e]" />
                <span>Waiting for email activation…</span>
              </div>
            ) : (
              <Button
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending || !mobileComplete}
                className="w-full bg-[#1a1a1a] hover:bg-[#333] text-white text-xs tracking-[2px] uppercase rounded-sm h-11 disabled:bg-[#ddd] disabled:text-[#aaa]"
              >
                {sendEmailMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send activation email"
                )}
              </Button>
            )}
          </div>
        )}

        {/* Missing step banners */}
        {mobileComplete && !emailComplete && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-sm mb-6">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed font-light">
              Mobile verified. Please activate your email to complete your account.
            </p>
          </div>
        )}

        {!mobileComplete && emailComplete && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-sm mb-6">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed font-light">
              Email activated. Please verify your mobile to complete your account.
            </p>
          </div>
        )}

        {/* Support footer */}
        <p className="text-xs text-[#bbb] text-center font-light mt-8">
          Need help?{" "}
          <a href="mailto:support@petwash.co.il" className="underline hover:text-[#888]">
            support@petwash.co.il
          </a>
        </p>

      </div>
    </div>
  );
}
