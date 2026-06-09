import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../lib/logger";
import { otpEvents, verificationChallenges, type VerificationChallenge } from "@shared/schema";

export type VerificationChannel = "sms" | "email" | "whatsapp" | "push";

export type VerificationPurpose =
  | "diagnostic_noop"
  | "login"
  | "signup"
  | "egift_redeem"
  | "change_email"
  | "enable_2fa"
  | "disable_2fa"
  | "close_account"
  | "payout";

export interface VerificationActor {
  userId?: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  traceId?: string;
}

export interface StartVerificationInput {
  purpose: VerificationPurpose;
  channel: VerificationChannel;
  destination: string;
  payload?: Record<string, unknown>;
  actor: VerificationActor;
}

export interface VerifyChallengeInput {
  challengeId: string;
  code: string;
  actor: VerificationActor;
}

export interface PurposeDefinition {
  purpose: VerificationPurpose;
  migrated: boolean;
  sensitive: boolean;
  requiresSession: boolean;
  ttlSeconds: number;
  maxAttempts: number;
  execute: (challenge: VerificationChallenge, actor: VerificationActor) => Promise<Record<string, unknown>>;
}

export class UnifiedVerificationError extends Error {
  constructor(
    public readonly reasonCode: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "UnifiedVerificationError";
  }
}

const unavailableAction = async (): Promise<Record<string, unknown>> => {
  throw new UnifiedVerificationError(
    "PURPOSE_NOT_MIGRATED",
    "This verification purpose is registered but not migrated to the unified runtime.",
    409,
  );
};

export const unifiedVerificationPurposeRegistry: Record<VerificationPurpose, PurposeDefinition> = {
  diagnostic_noop: {
    purpose: "diagnostic_noop",
    migrated: true,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: async (challenge) => ({
      action: "diagnostic_noop",
      challengeId: challenge.challengeId,
    }),
  },
  login: {
    purpose: "login",
    migrated: false,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  signup: {
    purpose: "signup",
    migrated: false,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  egift_redeem: {
    purpose: "egift_redeem",
    migrated: false,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  change_email: {
    purpose: "change_email",
    migrated: false,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  enable_2fa: {
    purpose: "enable_2fa",
    migrated: false,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  disable_2fa: {
    purpose: "disable_2fa",
    migrated: false,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  close_account: {
    purpose: "close_account",
    migrated: false,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
  payout: {
    purpose: "payout",
    migrated: false,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    execute: unavailableAction,
  },
};

export function getPurposeDefinition(purpose: string): PurposeDefinition {
  const definition = unifiedVerificationPurposeRegistry[purpose as VerificationPurpose];
  if (!definition) {
    throw new UnifiedVerificationError("UNKNOWN_PURPOSE", "Unknown verification purpose.", 400);
  }
  return definition;
}

export function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashVerificationCode(challengeId: string, code: string, pepper = process.env.VERIFICATION_CODE_PEPPER || ""): string {
  return crypto.createHash("sha256").update(`${challengeId}:${code}:${pepper}`).digest("hex");
}

export function timingSafeHashEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function assertStartAllowed(definition: PurposeDefinition, actor: VerificationActor): void {
  if (definition.requiresSession && !actor.userId) {
    throw new UnifiedVerificationError(
      "SESSION_REQUIRED",
      "This verification purpose requires an active signed-in session.",
      401,
    );
  }

  if (!definition.migrated) {
    throw new UnifiedVerificationError(
      "PURPOSE_NOT_MIGRATED",
      "This verification purpose is registered but not migrated to the unified runtime.",
      409,
    );
  }

  if (definition.purpose === "diagnostic_noop" && process.env.UNIFIED_VERIFICATION_DIAGNOSTIC_ENABLED !== "true") {
    throw new UnifiedVerificationError(
      "DIAGNOSTIC_DISABLED",
      "Diagnostic verification is disabled.",
      403,
    );
  }
}

function assertActorCanVerify(
  definition: PurposeDefinition,
  challenge: VerificationChallenge,
  actor: VerificationActor,
): void {
  if (definition.requiresSession && !actor.userId) {
    throw new UnifiedVerificationError("SESSION_REQUIRED", "This verification requires a signed-in session.", 401);
  }

  if (challenge.userId && actor.userId !== challenge.userId) {
    throw new UnifiedVerificationError("ACTOR_MISMATCH", "Verification challenge belongs to a different actor.", 403);
  }
}

function publicChallenge(challenge: VerificationChallenge) {
  return {
    challengeId: challenge.challengeId,
    purpose: challenge.purpose,
    channel: challenge.channel,
    destination: challenge.destination,
    status: challenge.status,
    expiresAt: challenge.expiresAt,
    attempts: challenge.attempts,
    maxAttempts: challenge.maxAttempts,
  };
}

async function recordOtpEvent(
  challenge: Pick<VerificationChallenge, "challengeId" | "channel" | "destination" | "purpose" | "userId" | "codeHash" | "expiresAt" | "ip" | "userAgent" | "deviceId" | "traceId">,
  eventType: "OTP_SENT" | "OTP_VERIFIED" | "OTP_FAILED" | "OTP_EXPIRED",
  result?: string,
  attemptsCount = 0,
): Promise<void> {
  if (challenge.channel !== "sms" && challenge.channel !== "whatsapp") return;
  if (!challenge.destination.startsWith("+")) return;

  try {
    await db.insert(otpEvents).values({
      otpId: challenge.challengeId,
      eventType,
      phoneE164: challenge.destination,
      userId: challenge.userId,
      userTypeIntent: challenge.purpose === "signup" ? "PUBLIC" : "PUBLIC",
      otpHash: challenge.codeHash,
      expiresAt: challenge.expiresAt,
      attemptsCount,
      result,
      provider: "unified",
      ip: challenge.ip,
      userAgent: challenge.userAgent,
      deviceId: challenge.deviceId,
      traceId: challenge.traceId,
      verifiedAt: eventType === "OTP_VERIFIED" ? new Date() : undefined,
    });
  } catch (error) {
    logger.warn("[UnifiedVerification] OTP audit insert failed", {
      challengeId: challenge.challengeId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export class UnifiedVerificationService {
  async startChallenge(input: StartVerificationInput) {
    const definition = getPurposeDefinition(input.purpose);
    assertStartAllowed(definition, input.actor);

    const now = new Date();
    const challengeId = crypto.randomUUID();
    const code = generateVerificationCode();
    const expiresAt = new Date(now.getTime() + definition.ttlSeconds * 1000);
    const codeHash = hashVerificationCode(challengeId, code);

    const [challenge] = await db.insert(verificationChallenges).values({
      challengeId,
      userId: input.actor.userId,
      channel: input.channel,
      destination: input.destination,
      purpose: input.purpose,
      payload: input.payload ?? {},
      codeHash,
      maxAttempts: definition.maxAttempts,
      status: "pending",
      expiresAt,
      ip: input.actor.ip,
      userAgent: input.actor.userAgent,
      deviceId: input.actor.deviceId,
      traceId: input.actor.traceId,
    }).returning();

    await recordOtpEvent(challenge, "OTP_SENT", "pending");

    return {
      ok: true,
      challenge: publicChallenge(challenge),
      delivery: {
        queued: false,
        reasonCode: "DELIVERY_NOT_MIGRATED",
      },
      testCode:
        process.env.NODE_ENV !== "production" && process.env.UNIFIED_VERIFICATION_RETURN_CODE_FOR_TESTS === "true"
          ? code
          : undefined,
    };
  }

  async verifyChallenge(input: VerifyChallengeInput) {
    const [challenge] = await db
      .select()
      .from(verificationChallenges)
      .where(eq(verificationChallenges.challengeId, input.challengeId))
      .limit(1);

    if (!challenge) {
      throw new UnifiedVerificationError("CHALLENGE_NOT_FOUND", "Verification challenge not found.", 404);
    }

    const definition = getPurposeDefinition(challenge.purpose);
    assertActorCanVerify(definition, challenge, input.actor);

    if (challenge.status !== "pending") {
      throw new UnifiedVerificationError("CHALLENGE_NOT_PENDING", "Verification challenge is no longer pending.", 409);
    }

    const now = new Date();
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      const [expired] = await db.update(verificationChallenges).set({
        status: "expired",
        updatedAt: now,
      }).where(and(
        eq(verificationChallenges.challengeId, challenge.challengeId),
        eq(verificationChallenges.status, "pending"),
      )).returning();
      await recordOtpEvent(expired ?? challenge, "OTP_EXPIRED", "expired", challenge.attempts);
      throw new UnifiedVerificationError("CHALLENGE_EXPIRED", "Verification challenge expired.", 410);
    }

    const candidateHash = hashVerificationCode(challenge.challengeId, input.code);
    if (!timingSafeHashEqual(candidateHash, challenge.codeHash)) {
      const nextAttempts = challenge.attempts + 1;
      const locked = nextAttempts >= challenge.maxAttempts;
      const [updated] = await db.update(verificationChallenges).set({
        attempts: nextAttempts,
        status: locked ? "locked" : "pending",
        lockedAt: locked ? now : null,
        updatedAt: now,
      }).where(and(
        eq(verificationChallenges.challengeId, challenge.challengeId),
        eq(verificationChallenges.status, "pending"),
      )).returning();
      await recordOtpEvent(updated ?? challenge, "OTP_FAILED", locked ? "max_attempts" : "invalid_code", nextAttempts);
      throw new UnifiedVerificationError(
        locked ? "CHALLENGE_LOCKED" : "INVALID_CODE",
        locked ? "Verification challenge locked." : "Invalid verification code.",
        locked ? 423 : 401,
      );
    }

    const [verified] = await db.update(verificationChallenges).set({
      status: "verified",
      verifiedAt: now,
      updatedAt: now,
    }).where(and(
      eq(verificationChallenges.challengeId, challenge.challengeId),
      eq(verificationChallenges.status, "pending"),
    )).returning();

    if (!verified) {
      throw new UnifiedVerificationError(
        "CHALLENGE_ALREADY_CLAIMED",
        "Verification challenge was already claimed.",
        409,
      );
    }

    const actionResult = await definition.execute(verified, input.actor);
    const [consumed] = await db.update(verificationChallenges).set({
      status: "consumed",
      consumedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(verificationChallenges.challengeId, verified.challengeId)).returning();

    await recordOtpEvent(consumed ?? verified, "OTP_VERIFIED", "success", verified.attempts);

    return {
      ok: true,
      challenge: publicChallenge(consumed ?? verified),
      action: actionResult,
    };
  }
}

export const unifiedVerificationService = new UnifiedVerificationService();
