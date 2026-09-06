import crypto from "crypto";
import jwt from "jsonwebtoken";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../lib/logger";
import { redactOtpBody } from "../lib/redactOtpBody";
import { phoneLookupHash } from "../lib/phoneHmac";
import { SMS_PURPOSES, type SmsPurpose } from "../lib/perUidSmsBudget";
import { isUnifiedVerificationPurposeEnabled } from "../lib/feature-flags/unifiedVerification";
import { twilioSMSService } from "./TwilioSMSService";
import { sendVerificationEmailCode } from "./VerificationEmailDelivery";
import { otpEvents, smsEvidence, verificationChallenges, type VerificationChallenge } from "@shared/schema";

import { maskDestinationForOwner } from "../../shared/auth/verificationDestination";

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
  | "change_phone"
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

export interface VerifyLatestChallengeInput {
  purpose: VerificationPurpose;
  destination: string;
  code: string;
  actor: VerificationActor;
}

export interface ResendChallengeInput {
  challengeId: string;
  channel?: VerificationChannel;
  actor: VerificationActor;
}

export interface PurposeDefinition {
  purpose: VerificationPurpose;
  migrated: boolean;
  sensitive: boolean;
  requiresSession: boolean;
  ttlSeconds: number;
  maxAttempts: number;
  /**
   * CHANNEL POLICY — the server decides, the UI does not.
   *
   * `allowedChannels` is enforced in assertChannelAllowed(): a client asking
   * for a channel that is not on this list is refused, so a caller can never
   * downgrade a purpose to a weaker or wrong channel by editing a request
   * body. `recommendedChannel` is what the UI should offer FIRST; every other
   * allowed channel is a fallback the customer may choose.
   *
   * Cost note (CEO 2026-09-06): email is effectively free and SMS is not, so
   * `recommendedChannel` is email wherever email is sufficient. It is NOT
   * email where the whole point of the challenge is proving control of a
   * phone number — see `provesDestinationOwnership`.
   */
  allowedChannels: readonly VerificationChannel[];
  recommendedChannel: VerificationChannel;
  /**
   * True when the challenge exists to prove the customer controls the
   * DESTINATION itself (e.g. verifying a new address before it becomes the
   * account's address). For these, sending to any other channel would prove
   * nothing, so the channel set is deliberately narrow.
   */
  provesDestinationOwnership: boolean;
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

export const unifiedVerificationPurposeRegistry: Record<VerificationPurpose, PurposeDefinition> = {
  diagnostic_noop: {
    purpose: "diagnostic_noop",
    migrated: true,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    execute: async (challenge) => ({
      action: "diagnostic_noop",
      challengeId: challenge.challengeId,
    }),
  },
  login: {
    purpose: "login",
    migrated: true,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    /**
     * The phone-session token is minted ONLY for a phone channel.
     *
     * This used to run unconditionally. The token it issues is
     * { phone: <destination>, type: "sms-verified" }, and the consumer at
     * publicAuthRoutes.ts calls fbAdminAuth.updateUser(uid, { phoneNumber })
     * with whatever `phone` says — so an email-channel login challenge minted
     * a token asserting that an EMAIL ADDRESS was a verified phone number.
     *
     * Not exploitable as it stood (the destination is also where the code is
     * delivered, so an attacker can only ever assert a destination they
     * already control, and Firebase rejects a non-E.164 phoneNumber). But the
     * channel and the token's meaning were decoupled, and resendChallenge can
     * switch a challenge's channel — so the next careless change makes it
     * real. Gate it on the channel that actually carried the code.
     */
    execute: async (challenge) => {
      const isPhoneChannel = challenge.channel === "sms" || challenge.channel === "whatsapp";
      if (!isPhoneChannel) {
        return { channel: challenge.channel, emailVerified: challenge.channel === "email" };
      }
      return {
        verificationToken: issueSmsVerificationToken(challenge.destination),
        phone: challenge.destination,
      };
    },
  },
  signup: {
    purpose: "signup",
    migrated: true,
    sensitive: false,
    requiresSession: false,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    // Same reasoning as login above: phoneE164 must only ever carry a phone.
    execute: async (challenge) => {
      const isPhoneChannel = challenge.channel === "sms" || challenge.channel === "whatsapp";
      return {
        metadata: {
          phoneE164: isPhoneChannel ? challenge.destination : undefined,
          emailVerified: challenge.channel === "email" ? challenge.destination : undefined,
          channel: challenge.channel,
          userTypeIntent: userTypeIntentForChallenge(challenge),
          userId: challenge.userId || undefined,
        },
      };
    },
  },
  egift_redeem: {
    purpose: "egift_redeem",
    migrated: true,
    sensitive: false,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    execute: async (challenge) => ({
      metadata: {
        voucherId: (challenge.payload as any)?.voucherId,
        action: "egift_redeem",
        userId: challenge.userId || undefined,
      },
    }),
  },
  change_email: {
    purpose: "change_email",
    migrated: true,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: true,
    execute: async (challenge) => ({
      metadata: {
        newEmail: challenge.destination,
        oldEmail: (challenge.payload as any)?.oldEmail,
        action: "change_email",
        userId: challenge.userId || undefined,
      },
    }),
  },
  enable_2fa: {
    purpose: "enable_2fa",
    migrated: true,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    execute: async (challenge) => ({
      metadata: {
        action: "enable_2fa",
        method: (challenge.payload as any)?.method || "totp",
        userId: challenge.userId || undefined,
      },
    }),
  },
  disable_2fa: {
    purpose: "disable_2fa",
    migrated: true,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    execute: async (challenge) => ({
      metadata: {
        action: "disable_2fa",
        enrollmentId: (challenge.payload as any)?.enrollmentId,
        userId: challenge.userId || undefined,
      },
    }),
  },
  close_account: {
    purpose: "close_account",
    migrated: true,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    execute: async (challenge) => ({
      metadata: {
        action: "close_account",
        userId: challenge.userId || undefined,
        email: challenge.destination,
      },
    }),
  },
  change_phone: {
    purpose: "change_phone",
    migrated: true,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    /**
     * PHONE CHANNELS ONLY, and that is not a preference.
     *
     * The whole point of this challenge is to prove the customer controls the
     * NEW handset before it becomes the account's security phone number. An
     * email code proves control of a mailbox, which says nothing about the
     * number being claimed — so permitting email here would make the
     * verification decorative. Same reasoning that makes change_email
     * email-only, pointed the other way.
     *
     * The `destination` MUST therefore be the new number, never the old one
     * and never the account email.
     */
    allowedChannels: ["sms", "whatsapp"] as const,
    recommendedChannel: "sms",
    provesDestinationOwnership: true,
    /**
     * Returns the proven number for the CALLER to apply. This execute() does
     * not write the identity itself: the canonical identity update, the
     * uniqueness check against other accounts, and the session/security
     * consequences belong to one place, and it is not a verification
     * purpose's side effect.
     */
    execute: async (challenge) => ({
      metadata: {
        action: "change_phone",
        // Already normalised to E.164 by normalizeDestination() on start.
        newPhoneE164: challenge.destination,
        userId: challenge.userId || undefined,
      },
    }),
  },
  payout: {
    purpose: "payout",
    migrated: true,
    sensitive: true,
    requiresSession: true,
    ttlSeconds: 300,
    maxAttempts: 5,
    allowedChannels: ["email", "sms", "whatsapp"] as const,
    recommendedChannel: "email",
    provesDestinationOwnership: false,
    execute: async (challenge) => ({
      metadata: {
        action: "payout",
        operation: (challenge.payload as any)?.operation,
        targetId: (challenge.payload as any)?.targetId,
        amountCents: (challenge.payload as any)?.amountCents,
        userId: challenge.userId || undefined,
      },
    }),
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

  if (!isUnifiedVerificationPurposeEnabled(definition.purpose)) {
    throw new UnifiedVerificationError(
      "PURPOSE_FLAG_DISABLED",
      "This verification purpose is disabled.",
      503,
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

/**
 * The SERVER decides which channel a purpose may use — never the caller.
 *
 * Without this, any client could POST { purpose: "change_email", channel: "sms" }
 * and send the "confirm your new email address" code somewhere that proves
 * nothing about the mailbox. The registry's allowedChannels is the policy;
 * this is where it is enforced.
 */
function assertChannelAllowed(definition: PurposeDefinition, channel: VerificationChannel): void {
  if (!definition.allowedChannels.includes(channel)) {
    throw new UnifiedVerificationError(
      "CHANNEL_NOT_ALLOWED",
      `The ${channel} channel is not permitted for this verification.`,
      400,
    );
  }
}

function normalizeDestination(channel: VerificationChannel, destination: string): string {
  if (channel !== "sms" && channel !== "whatsapp") return destination.trim();
  const trimmed = destination.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return "+" + trimmed.replace(/[^\d]/g, "");
}

function issueSmsVerificationToken(phoneE164: string): string {
  const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET;
  if (!secret) {
    throw new UnifiedVerificationError(
      "SMS_VERIFICATION_SECRET_MISSING",
      "SMS verification secret is not configured.",
      503,
    );
  }

  return jwt.sign(
    { phone: phoneE164, type: "sms-verified", nonce: crypto.randomBytes(8).toString("hex") },
    secret,
    { expiresIn: "5m" },
  );
}

function smsBodyForChallenge(code: string, language: unknown): string {
  const lang = typeof language === "string" ? language : "he";
  const hint = `\n@petwash.co.il #${code}`;
  if (lang === "he") {
    return `PetWash קוד אימות:\n\n${code}\n\nתקף ל-5 דקות.\nאל תשתפו קוד זה.${hint}`;
  }
  return `PetWash verification code:\n\n${code}\n\nExpires in 5 minutes.\nDo not share this code.${hint}`;
}

function userTypeIntentForChallenge(challenge: Pick<VerificationChallenge, "purpose" | "payload">): "PUBLIC" | "PROVIDER" | "STAFF_REQUEST" {
  const intent = (challenge.payload as any)?.userTypeIntent;
  if (challenge.purpose === "signup" && (intent === "PUBLIC" || intent === "PROVIDER" || intent === "STAFF_REQUEST")) {
    return intent;
  }
  return "PUBLIC";
}

function templateIdForChallenge(challenge: Pick<VerificationChallenge, "purpose" | "channel">): string {
  const prefix = challenge.purpose === "signup"
    ? "unified_signup_otp"
    : challenge.purpose === "egift_redeem"
      ? "unified_egift_redeem_otp"
      : "unified_login_otp";
  return challenge.channel === "whatsapp" ? `${prefix}_whatsapp_v1` : `${prefix}_v1`;
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

/**
 * The wire shape of a challenge.
 *
 * `destination` is deliberately ABSENT. It used to be echoed raw, which put a
 * full email address or phone number into the body of every /start and
 * /verify response — the same class #2253 closed for Sentry. The client does
 * not need it: the only question it has to answer on screen is "which inbox
 * do I go and look in?", and `maskedDestination` answers that while leaking
 * materially less. Masking happens HERE, on the server, so a client can never
 * be trusted (or tempted) to mask a raw value itself.
 *
 * `resendAvailableAt` makes the UI countdown server-driven. The 60s cooldown
 * lives in resendChallenge(); a client that guessed at it would either nag the
 * server early or make the customer wait longer than necessary.
 */
const RESEND_COOLDOWN_MS = 60_000;

function publicChallenge(challenge: VerificationChallenge) {
  return {
    challengeId: challenge.challengeId,
    purpose: challenge.purpose,
    channel: challenge.channel,
    maskedDestination: maskDestinationForOwner(challenge.channel, challenge.destination),
    status: challenge.status,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: new Date(challenge.updatedAt.getTime() + RESEND_COOLDOWN_MS),
    attempts: challenge.attempts,
    maxAttempts: challenge.maxAttempts,
  };
}

async function recordOtpEvent(
  challenge: Pick<VerificationChallenge, "challengeId" | "channel" | "destination" | "purpose" | "userId" | "codeHash" | "expiresAt" | "ip" | "userAgent" | "deviceId" | "traceId">,
  eventType: "OTP_SENT" | "OTP_RESENT" | "OTP_VERIFIED" | "OTP_FAILED" | "OTP_EXPIRED",
  result?: string,
  attemptsCount = 0,
  providerMessageId?: string | null,
  provider?: string,
): Promise<void> {
  if (challenge.channel !== "sms" && challenge.channel !== "whatsapp") return;
  if (!challenge.destination.startsWith("+")) return;

  try {
    await db.insert(otpEvents).values({
      otpId: challenge.challengeId,
      eventType,
      phoneE164: challenge.destination,
      userId: challenge.userId,
      userTypeIntent: userTypeIntentForChallenge(challenge as VerificationChallenge),
      otpHash: challenge.codeHash,
      expiresAt: challenge.expiresAt,
      attemptsCount,
      result,
      provider: provider || "unified",
      providerMessageId,
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

async function recordSmsEvidence(
  challenge: Pick<VerificationChallenge, "channel" | "destination" | "userId" | "ip" | "userAgent" | "traceId">,
  renderedText: string,
  status: "sent" | "failed",
  providerMessageId?: string | null,
  failureReason?: string | null,
): Promise<void> {
  if (challenge.channel !== "sms" && challenge.channel !== "whatsapp") return;
  if (!challenge.destination.startsWith("+")) return;

  const provider = challenge.channel === "whatsapp" ? "twilio_whatsapp" : "twilio";
  try {
    await db.insert(smsEvidence).values({
      userId: challenge.userId,
      messageType: "OTP",
      templateId: templateIdForChallenge(challenge as VerificationChallenge),
      templateVersion: "1.0",
      toPhone: challenge.destination,
      // AUDIT-SMS-14 (#225): stamp the HMAC lookup key on write.
      toPhoneHash: phoneLookupHash(challenge.destination),
      // AUDIT-SMS-11 (#222): scrub OTP digits before persisting the SMS body.
      // See server/lib/redactOtpBody.ts — canonical verifier lives in
      // verification_challenges.codeHash; keeping the digits in a second
      // table would make the DB row a working OTP itself.
      renderedText: redactOtpBody(renderedText, "OTP"),
      contentHash: crypto.createHash("sha256").update(renderedText).digest("hex"),
      provider,
      providerMessageId,
      status,
      failureReason,
      ip: challenge.ip,
      userAgent: challenge.userAgent,
      traceId: challenge.traceId,
    });
  } catch (error) {
    logger.warn("[UnifiedVerification] SMS evidence insert failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function deliverChallengeCode(challenge: VerificationChallenge, code: string): Promise<{
  queued: boolean;
  provider?: string;
  providerMessageId?: string;
  reasonCode?: string;
}> {
  if (
    (
      challenge.purpose === "change_email"
      || challenge.purpose === "close_account"
      || challenge.purpose === "enable_2fa"
      || challenge.purpose === "disable_2fa"
      || challenge.purpose === "payout"
      // 2026-06-25: email-code sign-up / sign-in (matched code, recorded live —
      // same UX as the SMS OTP). Easy Rover-style Prestige join.
      || challenge.purpose === "login"
      || challenge.purpose === "signup"
    )
    && challenge.channel === "email"
  ) {
    const sent = await sendVerificationEmailCode({
      to: challenge.destination,
      code,
      purpose: challenge.purpose,
      language: (challenge.payload as any)?.language,
    });
    if (!sent) {
      await db.update(verificationChallenges).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(verificationChallenges.challengeId, challenge.challengeId));
      throw new UnifiedVerificationError(
        "EMAIL_PROVIDER_ERROR",
        "Failed to send verification email.",
        503,
      );
    }
    return { queued: true, provider: "email" };
  }

  if (challenge.purpose !== "login" && challenge.purpose !== "signup" && challenge.purpose !== "egift_redeem") {
    return { queued: false, reasonCode: "DELIVERY_NOT_MIGRATED" };
  }
  if (challenge.channel !== "sms" && challenge.channel !== "whatsapp") {
    return { queued: false, reasonCode: "CHANNEL_NOT_MIGRATED" };
  }

  const renderedText = smsBodyForChallenge(code, (challenge.payload as any)?.language);
  // AUDIT-SMS-5 (#221): map the VerificationPurpose to an SMS-budget purpose
  // so TwilioSMSService.sendSMS can enforce the per-UID daily cap. Non-SMS
  // channels don't need this — the WhatsApp path has its own economics.
  const smsBudgetPurpose: SmsPurpose = challenge.purpose === "enable_2fa" || challenge.purpose === "disable_2fa"
    ? SMS_PURPOSES.VERIFY_MFA
    : challenge.purpose === "change_email"
      ? SMS_PURPOSES.VERIFY_MOBILE
      : SMS_PURPOSES.VERIFY_MOBILE;
  const sendResult = challenge.channel === "whatsapp"
    ? await twilioSMSService.sendWhatsApp(challenge.destination, renderedText)
    : await twilioSMSService.sendSMS(challenge.destination, renderedText, {
        userId: challenge.userId || undefined,
        ip: challenge.ip || undefined,
        ua: challenge.userAgent || undefined,
        purpose: smsBudgetPurpose,
      });

  const provider = challenge.channel === "whatsapp" ? "twilio_whatsapp" : "twilio";
  await recordSmsEvidence(
    challenge,
    renderedText,
    sendResult.success ? "sent" : "failed",
    sendResult.messageId || null,
    sendResult.success ? null : (sendResult.error || "Unknown"),
  );

  if (!sendResult.success) {
    await db.update(verificationChallenges).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(eq(verificationChallenges.challengeId, challenge.challengeId));
    throw new UnifiedVerificationError(
      "SMS_PROVIDER_ERROR",
      sendResult.error || "Failed to send verification code.",
      503,
    );
  }

  return {
    queued: true,
    provider,
    providerMessageId: sendResult.messageId,
  };
}

export class UnifiedVerificationService {
  async startChallenge(input: StartVerificationInput) {
    const definition = getPurposeDefinition(input.purpose);
    assertStartAllowed(definition, input.actor);
    assertChannelAllowed(definition, input.channel);

    const now = new Date();
    const challengeId = crypto.randomUUID();
    const code = generateVerificationCode();
    const expiresAt = new Date(now.getTime() + definition.ttlSeconds * 1000);
    const destination = normalizeDestination(input.channel, input.destination);
    const codeHash = hashVerificationCode(challengeId, code);

    if (
      definition.purpose === "login"
      || definition.purpose === "signup"
      || definition.purpose === "egift_redeem"
      || definition.purpose === "change_email"
      || definition.purpose === "close_account"
      || definition.purpose === "enable_2fa"
      || definition.purpose === "disable_2fa"
      || definition.purpose === "payout"
    ) {
      const [recent] = await db
        .select({ challengeId: verificationChallenges.challengeId })
        .from(verificationChallenges)
        .where(and(
          eq(verificationChallenges.purpose, definition.purpose),
          eq(verificationChallenges.destination, destination),
          eq(verificationChallenges.status, "pending"),
          gte(verificationChallenges.createdAt, new Date(now.getTime() - 60_000)),
        ))
        .orderBy(desc(verificationChallenges.createdAt))
        .limit(1);

      if (recent) {
        throw new UnifiedVerificationError(
          "CHALLENGE_COOLDOWN",
          "Please wait before requesting a new verification code.",
          429,
        );
      }
    }

    const [challenge] = await db.insert(verificationChallenges).values({
      challengeId,
      userId: input.actor.userId,
      channel: input.channel,
      destination,
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

    let delivery: {
      queued: boolean;
      provider?: string;
      providerMessageId?: string;
      reasonCode?: string;
    };
    try {
      delivery = await deliverChallengeCode(challenge, code);
    } catch (error) {
      await recordOtpEvent(challenge, "OTP_FAILED", "delivery_failed", 0);
      throw error;
    }
    await recordOtpEvent(
      challenge,
      "OTP_SENT",
      "pending",
      0,
      delivery.providerMessageId || null,
      delivery.provider,
    );

    return {
      ok: true,
      challenge: publicChallenge(challenge),
      delivery,
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

  async verifyLatestChallengeForDestination(input: VerifyLatestChallengeInput) {
    const [challenge] = await db
      .select()
      .from(verificationChallenges)
      .where(and(
        eq(verificationChallenges.purpose, input.purpose),
        eq(verificationChallenges.destination, normalizeDestination("sms", input.destination)),
        eq(verificationChallenges.status, "pending"),
      ))
      .orderBy(desc(verificationChallenges.createdAt))
      .limit(1);

    if (!challenge) {
      throw new UnifiedVerificationError("CHALLENGE_NOT_FOUND", "Verification challenge not found.", 404);
    }

    return this.verifyChallenge({
      challengeId: challenge.challengeId,
      code: input.code,
      actor: input.actor,
    });
  }

  async resendChallenge(input: ResendChallengeInput) {
    const [challenge] = await db
      .select()
      .from(verificationChallenges)
      .where(eq(verificationChallenges.challengeId, input.challengeId))
      .limit(1);

    if (!challenge) {
      throw new UnifiedVerificationError("CHALLENGE_NOT_FOUND", "Verification challenge not found.", 404);
    }

    const definition = getPurposeDefinition(challenge.purpose);
    assertStartAllowed(definition, input.actor);
    assertActorCanVerify(definition, challenge, input.actor);

    if (challenge.status !== "pending") {
      throw new UnifiedVerificationError("CHALLENGE_NOT_PENDING", "Verification challenge is no longer pending.", 409);
    }

    const now = new Date();
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      await db.update(verificationChallenges).set({
        status: "expired",
        updatedAt: now,
      }).where(eq(verificationChallenges.challengeId, challenge.challengeId));
      throw new UnifiedVerificationError("CHALLENGE_EXPIRED", "Verification challenge expired.", 410);
    }

    if (challenge.updatedAt.getTime() > now.getTime() - RESEND_COOLDOWN_MS) {
      throw new UnifiedVerificationError(
        "CHALLENGE_COOLDOWN",
        "Please wait before requesting a new verification code.",
        429,
      );
    }

    const code = generateVerificationCode();
    /**
     * A resend may switch channel, but only between channels that carry the
     * SAME KIND of destination — sms <-> whatsapp both take the phone number
     * already on the challenge. Going email -> sms would need a phone number
     * nobody has supplied, and would resend to an email address as if it were
     * one. "Use SMS instead" in the UI is therefore a NEW challenge with a new
     * destination, not a resend.
     *
     * The switch is also re-checked against the purpose's allowedChannels, so
     * a resend can never reach a channel that /start itself would refuse.
     */
    let nextChannel = challenge.channel;
    if (input.channel && input.channel !== challenge.channel) {
      const phoneChannels: VerificationChannel[] = ["sms", "whatsapp"];
      const bothPhone = phoneChannels.includes(input.channel)
        && phoneChannels.includes(challenge.channel as VerificationChannel);
      if (!bothPhone) {
        throw new UnifiedVerificationError(
          "CHANNEL_SWITCH_NOT_ALLOWED",
          "Switching to this channel needs a new verification, not a resend.",
          400,
        );
      }
      assertChannelAllowed(definition, input.channel);
      nextChannel = input.channel;
    }
    const [updated] = await db.update(verificationChallenges).set({
      channel: nextChannel,
      codeHash: hashVerificationCode(challenge.challengeId, code),
      attempts: 0,
      updatedAt: now,
    }).where(eq(verificationChallenges.challengeId, challenge.challengeId)).returning();

    const delivery = await deliverChallengeCode(updated, code);
    await recordOtpEvent(
      updated,
      "OTP_RESENT",
      "pending",
      0,
      delivery.providerMessageId || null,
      delivery.provider,
    );

    return {
      ok: true,
      challenge: publicChallenge(updated),
      delivery,
      testCode:
        process.env.NODE_ENV !== "production" && process.env.UNIFIED_VERIFICATION_RETURN_CODE_FOR_TESTS === "true"
          ? code
          : undefined,
    };
  }
}

export const unifiedVerificationService = new UnifiedVerificationService();
