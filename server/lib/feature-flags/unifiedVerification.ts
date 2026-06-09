import type { NextFunction, Request, Response } from "express";

export const UNIFIED_VERIFICATION_FLAG_NAME = "UNIFIED_VERIFICATION_ENABLED" as const;

export function isUnifiedVerificationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env.UNIFIED_VERIFICATION_ENABLED || "").toLowerCase().trim() === "true";
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
