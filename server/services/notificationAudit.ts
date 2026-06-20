/**
 * notificationAudit — append-only log of send attempts (notification_events) and
 * a secure push-token recorder (push_devices). Non-fatal: a logging failure never
 * blocks the actual send. Used to prove §30א consent was checked before marketing.
 */
import crypto from "crypto";
import { db } from "../db";
import { notificationEvents, pushDevices } from "@shared/schema-notification-audit";
import { logger } from "../lib/logger";

export interface NotificationEventInput {
  userId?: string | null;
  petId?: string | null;
  channel: string;                 // sms | email | push | in_app | whatsapp
  category: string;                // essential | care | marketing | booking | support
  templateKey?: string;
  consentChecked?: boolean;
  consentResult?: "allowed" | "blocked_no_consent" | "not_required";
  consentRecordId?: string | null;
  destination?: string | null;     // raw — masked before store
  status: string;                  // queued | sent | delivered | failed | blocked_no_consent | unsubscribed
  providerMessageId?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
}

/** Mask a phone/email so the audit never stores the full destination. */
function maskDestination(d?: string | null): string | null {
  if (!d) return null;
  if (d.includes("@")) {
    const [u, dom] = d.split("@");
    return `${u.slice(0, 2)}***@${dom}`;
  }
  return d.length > 4 ? `****${d.slice(-4)}` : "****";
}

export async function logNotificationEvent(input: NotificationEventInput): Promise<void> {
  try {
    await db.insert(notificationEvents).values({
      userId: input.userId ?? null,
      petId: input.petId ?? null,
      channel: input.channel,
      category: input.category,
      templateKey: input.templateKey ?? null,
      consentChecked: input.consentChecked ?? false,
      consentResult: input.consentResult ?? null,
      consentRecordId: input.consentRecordId ?? null,
      destinationMasked: maskDestination(input.destination),
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      failureReason: input.failureReason ?? null,
      metadata: (input.metadata as any) ?? {},
      sentAt: input.status === "sent" || input.status === "delivered" ? new Date() : null,
    });
  } catch (e) {
    logger.warn("[notificationAudit] logNotificationEvent failed (non-fatal)", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Upsert a push token (hashed + encrypted-at-rest passthrough). Non-fatal. */
export async function recordPushDevice(input: {
  userId: string; token: string; deviceType?: string; deviceName?: string;
  appVersion?: string; locale?: string; timezone?: string; tokenEncrypted?: string;
}): Promise<void> {
  try {
    const hash = crypto.createHash("sha256").update(input.token).digest("hex");
    await db.insert(pushDevices).values({
      userId: input.userId, deviceType: input.deviceType ?? null,
      pushTokenHash: hash, tokenEncrypted: input.tokenEncrypted ?? null,
      deviceName: input.deviceName ?? null, appVersion: input.appVersion ?? null,
      locale: input.locale ?? null, timezone: input.timezone ?? null,
      status: "active", lastSeenAt: new Date(),
    });
  } catch (e) {
    logger.warn("[notificationAudit] recordPushDevice failed (non-fatal)", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
