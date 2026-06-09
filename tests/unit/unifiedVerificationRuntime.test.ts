import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isUnifiedVerificationLoginEnabled,
  isUnifiedVerificationEnabled,
  isUnifiedVerificationSignupEnabled,
  UNIFIED_VERIFICATION_LOGIN_FLAG_NAME,
  UNIFIED_VERIFICATION_SIGNUP_FLAG_NAME,
  UNIFIED_VERIFICATION_FLAG_NAME,
} from "../../server/lib/feature-flags/unifiedVerification";

const root = resolve(import.meta.dirname, "../..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("unified verification runtime guard", () => {
  it("is default-off and only opens on the explicit flag", () => {
    expect(UNIFIED_VERIFICATION_FLAG_NAME).toBe("UNIFIED_VERIFICATION_ENABLED");
    expect(UNIFIED_VERIFICATION_LOGIN_FLAG_NAME).toBe("UNIFIED_VERIFICATION_LOGIN_ENABLED");
    expect(UNIFIED_VERIFICATION_SIGNUP_FLAG_NAME).toBe("UNIFIED_VERIFICATION_SIGNUP_ENABLED");
    expect(isUnifiedVerificationEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isUnifiedVerificationEnabled({ UNIFIED_VERIFICATION_ENABLED: "false" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isUnifiedVerificationEnabled({ UNIFIED_VERIFICATION_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isUnifiedVerificationLoginEnabled({ UNIFIED_VERIFICATION_LOGIN_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isUnifiedVerificationLoginEnabled({
      UNIFIED_VERIFICATION_ENABLED: "true",
      UNIFIED_VERIFICATION_LOGIN_ENABLED: "true",
    } as NodeJS.ProcessEnv)).toBe(true);
    expect(isUnifiedVerificationSignupEnabled({ UNIFIED_VERIFICATION_SIGNUP_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isUnifiedVerificationSignupEnabled({
      UNIFIED_VERIFICATION_ENABLED: "true",
      UNIFIED_VERIFICATION_SIGNUP_ENABLED: "true",
    } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("mounts the API without replacing existing OTP/auth flows", () => {
    const routes = source("server/routes.ts");

    expect(routes).toContain('import verificationRoutes from "./routes/verification"');
    expect(routes).toContain("app.use('/api/verification', optionalFirebaseToken, apiLimiter, verificationRoutes)");
    expect(routes).toContain("app.use('/api/auth', apiLimiter, authRoutes)");
    expect(routes).toContain("app.use('/api/onboarding-verification', apiLimiter, onboardingVerificationRoutes)");
  });

  it("binds challenges to purpose, actor, single-use status, and hash-at-rest", () => {
    const service = source("server/services/UnifiedVerificationService.ts");

    expect(service).toContain("unifiedVerificationPurposeRegistry");
    expect(service).toContain("issueSmsVerificationToken");
    expect(service).toContain('"change_email"');
    expect(service).toContain("requiresSession: true");
    expect(service).toContain("ACTOR_MISMATCH");
    expect(service).toContain("codeHash");
    expect(service).toContain("hashVerificationCode");
    expect(service).toContain('status: "consumed"');
    expect(service).toContain("PURPOSE_NOT_MIGRATED");
    expect(service).toContain("verifyLatestChallengeForDestination");
    expect(service).toContain("resendChallenge");
    expect(service).toContain("smsEvidence");
  });

  it("bridges the existing sms auth route through unified login only behind the login flag", () => {
    const route = source("server/routes/auth-sms.ts");

    expect(route).toContain("isUnifiedVerificationLoginEnabled");
    expect(route).toContain("unifiedVerificationService.startChallenge");
    expect(route).toContain("purpose: 'login'");
    expect(route).toContain("verifyLatestChallengeForDestination");
    expect(route).toContain("runtime: 'unified_verification'");
    expect(route).toContain("twilioSMSService.sendVerificationCode");
    expect(route).toContain("twilioSMSService.verifyCode");
  });

  it("bridges phone signup OTP send, resend, and verify behind the signup flag", () => {
    const route = source("server/routes/publicAuthRoutes.ts");

    expect(route).toContain("isUnifiedVerificationSignupEnabled");
    expect(route).toContain("unifiedVerificationService.startChallenge");
    expect(route).toContain("purpose: 'signup'");
    expect(route).toContain("unifiedVerificationService.resendChallenge");
    expect(route).toContain("unifiedVerificationService.verifyChallenge");
    expect(route).toContain("registrationOTPService.sendOTP");
    expect(route).toContain("registrationOTPService.resendOTP");
    expect(route).toContain("registrationOTPService.verifyOTP");
  });
});
