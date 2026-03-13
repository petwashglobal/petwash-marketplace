import crypto from "crypto";
import { db } from "../db";
import { userConsents } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const ROLE_CONSENTS: Record<string, string[]> = {
  customer: ["terms", "privacy"],
  loyalty: ["terms", "privacy", "marketing"],
  provider: ["terms", "privacy", "provider_terms", "kyc"],
  staff: ["terms", "privacy", "staff_policy"],
};

const DEFAULT_SNAPSHOT_CONTENT: Record<string, string> = {
  terms: "PetWash™ Terms of Service v1.0 — By using our services you agree to these terms.",
  privacy: "PetWash™ Privacy Policy v1.0 — We protect your personal data under Israeli Privacy Protection Law.",
  marketing: "PetWash™ Marketing Consent v1.0 — Consent to receive promotional offers and loyalty updates.",
  provider_terms: "PetWash™ Provider Terms v1.0 — Additional terms governing service providers on the platform.",
  kyc: "PetWash™ KYC Consent v1.0 — Consent to identity verification under Israeli AML regulations.",
  staff_policy: "PetWash™ Staff Policy v1.0 — Internal policies governing platform staff members.",
};

export async function createConsentSnapshot(params: {
  consentType: string;
  version: string;
  locale: string;
  content: string;
}) {
  const contentHash = sha256(params.content);
  const snapshot = await storage.createConsentSnapshot({
    consentType: params.consentType,
    version: params.version,
    locale: params.locale,
    content: params.content,
    contentHash,
  });
  return snapshot;
}

async function ensureConsentSnapshot(
  consentType: string,
  version: string,
  locale: string
): Promise<{ contentHash: string }> {
  const existing = await storage.getConsentSnapshot(consentType, version, locale);
  if (existing?.contentHash) return existing as { contentHash: string };

  const fallbackContent =
    DEFAULT_SNAPSHOT_CONTENT[consentType] ??
    `PetWash™ ${consentType} v${version} consent document.`;

  const contentHash = sha256(fallbackContent);
  await storage.createConsentSnapshot({
    consentType,
    version,
    locale,
    content: fallbackContent,
    contentHash,
  });

  return { contentHash };
}

export async function recordConsent(params: {
  userId: string;
  consentType: string;
  version: string;
  locale: string;
  method: "checkbox" | "signature" | "otp" | "in_app";
  ip: string;
  userAgent: string;
  deviceId?: string;
  traceId?: string;
}) {
  const { contentHash } = await ensureConsentSnapshot(
    params.consentType,
    params.version,
    params.locale
  );

  const acceptedAt = new Date().toISOString();
  const evidenceHash = sha256(
    contentHash + params.userId + acceptedAt + (params.deviceId ?? "")
  );

  const [record] = await db
    .insert(userConsents)
    .values({
      userId: params.userId,
      consentType: params.consentType,
      consentVersion: params.version,
      consentTextHash: contentHash,
      accepted: true,
      method: params.method,
      ip: params.ip,
      userAgent: params.userAgent,
      deviceId: params.deviceId ?? null,
      locale: params.locale,
      traceId: params.traceId ?? null,
      evidenceHash,
    })
    .returning();

  return record;
}

export async function verifyConsent(
  userId: string,
  consentType: string
): Promise<boolean> {
  const [record] = await db
    .select()
    .from(userConsents)
    .where(
      and(
        eq(userConsents.userId, userId),
        eq(userConsents.consentType, consentType),
        eq(userConsents.accepted, true)
      )
    )
    .limit(1);
  return !!record;
}

export function getRequiredConsents(role: string): string[] {
  return ROLE_CONSENTS[role] ?? ROLE_CONSENTS.customer;
}

export async function checkAllConsentsGiven(
  userId: string,
  role: string
): Promise<{ allGiven: boolean; missing: string[] }> {
  const required = getRequiredConsents(role);
  const missing: string[] = [];

  for (const consentType of required) {
    const given = await verifyConsent(userId, consentType);
    if (!given) {
      missing.push(consentType);
    }
  }

  return { allGiven: missing.length === 0, missing };
}
