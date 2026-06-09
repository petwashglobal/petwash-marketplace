import { Router, type Request } from "express";
import { z } from "zod";
import {
  UNIFIED_VERIFICATION_FLAG_NAME,
  UNIFIED_VERIFICATION_CHANGE_EMAIL_FLAG_NAME,
  UNIFIED_VERIFICATION_CLOSE_ACCOUNT_FLAG_NAME,
  UNIFIED_VERIFICATION_DISABLE_2FA_FLAG_NAME,
  UNIFIED_VERIFICATION_ENABLE_2FA_FLAG_NAME,
  UNIFIED_VERIFICATION_EGIFT_REDEEM_FLAG_NAME,
  UNIFIED_VERIFICATION_LOGIN_FLAG_NAME,
  UNIFIED_VERIFICATION_SIGNUP_FLAG_NAME,
  isUnifiedVerificationChangeEmailEnabled,
  isUnifiedVerificationCloseAccountEnabled,
  isUnifiedVerificationDisable2faEnabled,
  isUnifiedVerificationEnable2faEnabled,
  isUnifiedVerificationEgiftRedeemEnabled,
  isUnifiedVerificationEnabled,
  isUnifiedVerificationLoginEnabled,
  isUnifiedVerificationSignupEnabled,
  requireUnifiedVerificationEnabled,
} from "../lib/feature-flags/unifiedVerification";
import {
  UnifiedVerificationError,
  unifiedVerificationPurposeRegistry,
  unifiedVerificationService,
  type VerificationActor,
  type VerificationChannel,
  type VerificationPurpose,
} from "../services/UnifiedVerificationService";
import { logger } from "../lib/logger";

const router = Router();

const channelSchema = z.enum(["sms", "email", "whatsapp", "push"]);
const purposeSchema = z.enum([
  "diagnostic_noop",
  "login",
  "signup",
  "egift_redeem",
  "change_email",
  "enable_2fa",
  "disable_2fa",
  "close_account",
  "payout",
]);

const startSchema = z.object({
  purpose: purposeSchema,
  channel: channelSchema,
  destination: z.string().min(3).max(320),
  payload: z.record(z.string(), z.unknown()).optional(),
  deviceId: z.string().min(1).max(100).optional(),
  traceId: z.string().min(1).max(50).optional(),
});

const verifySchema = z.object({
  challengeId: z.string().min(10).max(100),
  code: z.string().min(4).max(12),
  deviceId: z.string().min(1).max(100).optional(),
  traceId: z.string().min(1).max(50).optional(),
});

function actorFromRequest(req: Request, body: { deviceId?: string; traceId?: string }): VerificationActor {
  const requestUser = (req as any).user;
  const firebaseUser = (req as any).firebaseUser;
  return {
    userId: requestUser?.uid || requestUser?.id || firebaseUser?.uid,
    ip: req.ip || (req.headers["x-forwarded-for"] as string | undefined),
    userAgent: req.headers["user-agent"],
    deviceId: body.deviceId,
    traceId: body.traceId,
  };
}

function handleVerificationError(res: any, error: unknown): void {
  if (error instanceof UnifiedVerificationError) {
    res.status(error.statusCode).json({
      ok: false,
      error: error.message,
      reasonCode: error.reasonCode,
    });
    return;
  }

  logger.error("[verification] unexpected error", {
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({ ok: false, error: "verification_error" });
}

router.get("/status", (_req, res) => {
  const purposes = Object.values(unifiedVerificationPurposeRegistry).map((purpose) => ({
    purpose: purpose.purpose,
    migrated: purpose.migrated,
    sensitive: purpose.sensitive,
    requiresSession: purpose.requiresSession,
    ttlSeconds: purpose.ttlSeconds,
    maxAttempts: purpose.maxAttempts,
  }));

  res.json({
    ok: true,
    enabled: isUnifiedVerificationEnabled(),
    flag: UNIFIED_VERIFICATION_FLAG_NAME,
    flowFlags: {
      login: {
        flag: UNIFIED_VERIFICATION_LOGIN_FLAG_NAME,
        enabled: isUnifiedVerificationLoginEnabled(),
      },
      signup: {
        flag: UNIFIED_VERIFICATION_SIGNUP_FLAG_NAME,
        enabled: isUnifiedVerificationSignupEnabled(),
      },
      egiftRedeem: {
        flag: UNIFIED_VERIFICATION_EGIFT_REDEEM_FLAG_NAME,
        enabled: isUnifiedVerificationEgiftRedeemEnabled(),
      },
      changeEmail: {
        flag: UNIFIED_VERIFICATION_CHANGE_EMAIL_FLAG_NAME,
        enabled: isUnifiedVerificationChangeEmailEnabled(),
      },
      closeAccount: {
        flag: UNIFIED_VERIFICATION_CLOSE_ACCOUNT_FLAG_NAME,
        enabled: isUnifiedVerificationCloseAccountEnabled(),
      },
      enable2fa: {
        flag: UNIFIED_VERIFICATION_ENABLE_2FA_FLAG_NAME,
        enabled: isUnifiedVerificationEnable2faEnabled(),
      },
      disable2fa: {
        flag: UNIFIED_VERIFICATION_DISABLE_2FA_FLAG_NAME,
        enabled: isUnifiedVerificationDisable2faEnabled(),
      },
    },
    purposes,
  });
});

router.post("/start", requireUnifiedVerificationEnabled, async (req, res) => {
  const parsed = startSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "invalid_request", details: parsed.error.errors });
  }

  try {
    const body = parsed.data;
    const result = await unifiedVerificationService.startChallenge({
      purpose: body.purpose as VerificationPurpose,
      channel: body.channel as VerificationChannel,
      destination: body.destination,
      payload: body.payload,
      actor: actorFromRequest(req, body),
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleVerificationError(res, error);
  }
});

router.post("/verify", requireUnifiedVerificationEnabled, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "invalid_request", details: parsed.error.errors });
  }

  try {
    const body = parsed.data;
    const result = await unifiedVerificationService.verifyChallenge({
      challengeId: body.challengeId,
      code: body.code,
      actor: actorFromRequest(req, body),
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleVerificationError(res, error);
  }
});

export default router;
