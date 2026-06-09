import type { NextFunction, Request, Response } from "express";

export const UNIFIED_VERIFICATION_FLAG_NAME = "UNIFIED_VERIFICATION_ENABLED" as const;
export const UNIFIED_VERIFICATION_LOGIN_FLAG_NAME = "UNIFIED_VERIFICATION_LOGIN_ENABLED" as const;
export const UNIFIED_VERIFICATION_SIGNUP_FLAG_NAME = "UNIFIED_VERIFICATION_SIGNUP_ENABLED" as const;
export const UNIFIED_VERIFICATION_EGIFT_REDEEM_FLAG_NAME = "UNIFIED_VERIFICATION_EGIFT_REDEEM_ENABLED" as const;
export const UNIFIED_VERIFICATION_CHANGE_EMAIL_FLAG_NAME = "UNIFIED_VERIFICATION_CHANGE_EMAIL_ENABLED" as const;
export const UNIFIED_VERIFICATION_CLOSE_ACCOUNT_FLAG_NAME = "UNIFIED_VERIFICATION_CLOSE_ACCOUNT_ENABLED" as const;
export const UNIFIED_VERIFICATION_ENABLE_2FA_FLAG_NAME = "UNIFIED_VERIFICATION_ENABLE_2FA_ENABLED" as const;
export const UNIFIED_VERIFICATION_DISABLE_2FA_FLAG_NAME = "UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED" as const;

export function isUnifiedVerificationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env.UNIFIED_VERIFICATION_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationLoginEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_LOGIN_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationSignupEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_SIGNUP_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationEgiftRedeemEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_EGIFT_REDEEM_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationChangeEmailEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_CHANGE_EMAIL_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationCloseAccountEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_CLOSE_ACCOUNT_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationEnable2faEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_ENABLE_2FA_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationDisable2faEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isUnifiedVerificationEnabled(env)
    && (env.UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED || "").toLowerCase().trim() === "true";
}

export function isUnifiedVerificationPurposeEnabled(
  purpose: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (purpose === "login") return isUnifiedVerificationLoginEnabled(env);
  if (purpose === "signup") return isUnifiedVerificationSignupEnabled(env);
  if (purpose === "egift_redeem") return isUnifiedVerificationEgiftRedeemEnabled(env);
  if (purpose === "change_email") return isUnifiedVerificationChangeEmailEnabled(env);
  if (purpose === "close_account") return isUnifiedVerificationCloseAccountEnabled(env);
  if (purpose === "enable_2fa") return isUnifiedVerificationEnable2faEnabled(env);
  if (purpose === "disable_2fa") return isUnifiedVerificationDisable2faEnabled(env);
  if (purpose === "diagnostic_noop") return isUnifiedVerificationEnabled(env);
  return false;
}

export interface UnifiedVerificationDisabledResponse {
  error: string;
  reasonCode: "UNIFIED_VERIFICATION_DISABLED";
}

export function requireUnifiedVerificationEnabled(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isUnifiedVerificationEnabled()) {
    next();
    return;
  }

  const body: UnifiedVerificationDisabledResponse = {
    error: "Unified verification is disabled in this environment.",
    reasonCode: "UNIFIED_VERIFICATION_DISABLED",
  };
  res.status(503).json(body);
}
