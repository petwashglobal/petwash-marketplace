import type { Request, Response } from "express";
import { isUnifiedVerificationPayoutEnabled } from "./feature-flags/unifiedVerification";
import {
  UnifiedVerificationError,
  unifiedVerificationService,
  type VerificationActor,
} from "../services/UnifiedVerificationService";

export interface PayoutVerificationInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  operation: string;
  targetId: string;
  amountCents?: number | null;
  payload?: Record<string, unknown>;
}

function actorFromRequest(req: Request, userId: string): VerificationActor {
  return {
    userId,
    ip: req.ip || (req.headers["x-forwarded-for"] as string | undefined),
    userAgent: req.headers["user-agent"],
  };
}

export async function requireUnifiedPayoutVerification(
  req: Request,
  res: Response,
  input: PayoutVerificationInput,
): Promise<boolean> {
  if (!isUnifiedVerificationPayoutEnabled()) return true;

  const actorUserId = input.actorUserId?.trim();
  if (!actorUserId) {
    res.status(401).json({ error: "Payout verification requires an authenticated admin actor." });
    return false;
  }

  const actorEmail = input.actorEmail?.trim();
  if (!actorEmail) {
    res.status(400).json({ error: "Payout verification requires a verified admin email." });
    return false;
  }

  const { verificationChallengeId, verificationCode } = req.body ?? {};
  const actor = actorFromRequest(req, actorUserId);
  const payload = {
    ...(input.payload ?? {}),
    action: "payout",
    operation: input.operation,
    targetId: input.targetId,
    amountCents: input.amountCents ?? undefined,
  };

  try {
    if (!verificationChallengeId || !verificationCode) {
      const challenge = await unifiedVerificationService.startChallenge({
        purpose: "payout",
        channel: "email",
        destination: actorEmail,
        payload,
        actor,
      });

      res.status(202).json({
        requiresVerification: true,
        runtime: "unified_verification",
        verificationChallengeId: challenge.challenge.challengeId,
        expiresAt: challenge.challenge.expiresAt,
        message: "Payout verification code sent to your admin email",
      });
      return false;
    }

    const verificationResult = await unifiedVerificationService.verifyChallenge({
      challengeId: String(verificationChallengeId),
      code: String(verificationCode),
      actor,
    });
    const metadata = (verificationResult.action as any)?.metadata || {};
    if (
      metadata.action !== "payout"
      || metadata.operation !== input.operation
      || metadata.targetId !== input.targetId
    ) {
      res.status(400).json({ error: "Invalid payout verification challenge", code: "INVALID_VERIFICATION_ACTION" });
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof UnifiedVerificationError) {
      res.status(error.statusCode).json({ error: error.message, code: error.reasonCode });
      return false;
    }
    throw error;
  }
}
