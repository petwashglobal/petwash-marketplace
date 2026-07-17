/**
 * PII FIELD CRYPTO — AES-256-GCM field-level encryption for regulated PII
 * (tax IDs, National Insurance numbers, VAT numbers).
 *
 * Extracted so every write path uses ONE identical scheme — before this,
 * contractor-onboarding.ts encrypted its own copy while
 * IsraeliContractorCompliance.ts wrote plaintext into the SAME column
 * (providerTaxCompliance), leaving a mixed plaintext/ciphertext table and a
 * live Israeli Privacy Law 2025 / GDPR exposure.
 *
 * Format (unchanged from the original onboarding helper so existing rows keep
 * decrypting): `enc:<base64 iv>:<base64 authTag>:<base64 ciphertext>`.
 * Key: sha256(DOCUMENT_ENCRYPTION_KEY) — the same key used for document security.
 */
import crypto from "crypto";
import { logger } from "./logger";

const ENC_PREFIX = "enc:";

function deriveKey(): Buffer | null {
  const masterKey = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!masterKey || masterKey.length < 32) return null;
  return crypto.createHash("sha256").update(masterKey).digest(); // 32 bytes
}

/**
 * Encrypt a PII value. In production a missing/short DOCUMENT_ENCRYPTION_KEY
 * throws — we refuse to persist plaintext regulated PII. Outside production it
 * degrades to plaintext with a warning so local/dev flows keep working.
 */
export function encryptPII(plaintext: string): string {
  const key = deriveKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[piiFieldCrypto] DOCUMENT_ENCRYPTION_KEY is required in production. " +
          "Refusing to store plaintext PII (tax ID / National Insurance / VAT).",
      );
    }
    logger.warn("[piiFieldCrypto] DOCUMENT_ENCRYPTION_KEY not set — PII stored unencrypted (non-production only)");
    return plaintext;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** True when a stored value is in encrypted form (vs a legacy plaintext row). */
export function isEncryptedPII(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

/**
 * Decrypt a stored PII value. Legacy plaintext rows (written before encryption
 * landed) pass through unchanged, so reads stay backward-compatible. Returns the
 * input untouched if the key is unavailable and the value isn't encrypted.
 */
export function decryptPII(value: string | null | undefined): string {
  if (!value || !value.startsWith(ENC_PREFIX)) return value ?? "";
  const key = deriveKey();
  if (!key) {
    // Can't decrypt without the key; never surface raw ciphertext to callers.
    logger.error("[piiFieldCrypto] DOCUMENT_ENCRYPTION_KEY unavailable — cannot decrypt PII");
    return "";
  }
  try {
    const [, ivB64, tagB64, ctB64] = value.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err: any) {
    logger.error("[piiFieldCrypto] PII decrypt failed", { error: err?.message });
    return "";
  }
}

/**
 * Redact a PII value for API responses / admin views: last 4 chars only.
 * Handles both encrypted and legacy-plaintext stored forms.
 */
export function maskPII(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const plain = isEncryptedPII(value) ? decryptPII(value) : value;
  if (!plain) return null;
  const last4 = plain.slice(-4);
  return `••••${last4}`;
}
