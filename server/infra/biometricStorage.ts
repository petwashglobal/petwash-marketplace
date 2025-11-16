/**
 * Biometric Storage Infrastructure
 * Manages secure storage and lifecycle rules for biometric identity documents
 * 
 * PRIVACY COMPLIANCE:
 * - Auto-deletion after 24 hours (Israeli Privacy Law 2025)
 * - Encrypted storage with Google Cloud Storage
 * - Audit trail for all uploads and deletions
 */

import { Storage } from "@google-cloud/storage";
import { logger } from "../lib/logger";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "signinpetwash";

const BIOMETRIC_BUCKET_NAME =
  process.env.BIOMETRIC_BUCKET_NAME || `${PROJECT_ID}.firebasestorage.app`;

const BIOMETRIC_PREFIX =
  process.env.BIOMETRIC_PREFIX || "biometric-certificates/";

let storage: Storage | null = null;
let isInitialized = false;

/**
 * Initialize Google Cloud Storage client
 * Uses FIREBASE_SERVICE_ACCOUNT_KEY environment variable
 */
function initializeStorage(): Storage {
  if (storage) {
    return storage;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error(
      "[BiometricStorage] Missing FIREBASE_SERVICE_ACCOUNT_KEY env var"
    );
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    storage = new Storage({
      projectId: PROJECT_ID,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
    });

    logger.info("[BiometricStorage] Google Cloud Storage client initialized");
    return storage;
  } catch (error: any) {
    throw new Error(
      `[BiometricStorage] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${error.message}`
    );
  }
}

/**
 * Ensure biometric storage bucket exists and lifecycle rules are configured
 * Called during server startup
 */
export async function ensureBiometricStorage(): Promise<void> {
  try {
    const storageClient = initializeStorage();
    const bucket = storageClient.bucket(BIOMETRIC_BUCKET_NAME);

    // 1. Verify bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      logger.warn(
        `[BiometricStorage] Bucket "${BIOMETRIC_BUCKET_NAME}" does not exist. ` +
          `Create it in Firebase Console → Storage. ` +
          `Expected name: "${PROJECT_ID}.firebasestorage.app"`
      );
      logger.warn(
        "[BiometricStorage] Biometric certificate uploads will be disabled until bucket is created"
      );
      return;
    }

    logger.info(`[BiometricStorage] Bucket "${BIOMETRIC_BUCKET_NAME}" verified`);

    // 2. Configure lifecycle rule: delete biometric data after 1 day
    const [metadata] = await bucket.getMetadata();
    const existingRules = metadata.lifecycle?.rule || [];

    const newRule = {
      action: { type: "Delete" as const },
      condition: {
        age: 1, // days
        isLive: true,
        matchesPrefix: [BIOMETRIC_PREFIX],
      },
    };

    const hasSameRule = existingRules.some(
      (r: any) =>
        r.action?.type === "Delete" &&
        Number(r.condition?.age) === 1 &&
        Array.isArray(r.condition?.matchesPrefix) &&
        r.condition.matchesPrefix.includes(BIOMETRIC_PREFIX)
    );

    if (!hasSameRule) {
      const updatedRules = [...existingRules, newRule];

      await bucket.setMetadata({
        lifecycle: {
          rule: updatedRules,
        },
      });

      logger.info(
        `[BiometricStorage] ✅ Lifecycle rule configured on ${BIOMETRIC_BUCKET_NAME}: delete "${BIOMETRIC_PREFIX}" objects after 1 day`
      );
    } else {
      logger.info(
        `[BiometricStorage] ✅ Lifecycle rule already configured on ${BIOMETRIC_BUCKET_NAME}`
      );
    }

    isInitialized = true;
  } catch (error: any) {
    logger.error("[BiometricStorage] Failed to initialize:", error);
    
    // Log warning but don't crash the server
    logger.warn(
      "[BiometricStorage] Biometric certificate uploads will be disabled. " +
        "Passkey/Face ID authentication will continue to work normally."
    );
  }
}

/**
 * Helper for uploading a biometric file
 * All biometric uploads should go through this function
 * 
 * @param objectName - Name of the file (without prefix)
 * @param buffer - File content as Buffer
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns Full object path in bucket
 */
export async function uploadBiometricObject(
  objectName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (!isInitialized) {
    throw new Error(
      "[BiometricStorage] Storage not initialized. Biometric uploads are disabled."
    );
  }

  const storageClient = initializeStorage();
  const bucket = storageClient.bucket(BIOMETRIC_BUCKET_NAME);
  const file = bucket.file(`${BIOMETRIC_PREFIX}${objectName}`);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "no-store",
      metadata: {
        uploadedAt: new Date().toISOString(),
        autoDeleteAfter: "24 hours",
      },
    },
  });

  logger.info(
    `[BiometricStorage] ✅ Uploaded biometric object: ${BIOMETRIC_PREFIX}${objectName}`
  );

  return file.name;
}

/**
 * Delete a biometric object (for manual cleanup)
 * 
 * @param objectName - Name of the file (without prefix)
 */
export async function deleteBiometricObject(objectName: string): Promise<void> {
  if (!isInitialized) {
    logger.warn("[BiometricStorage] Storage not initialized, skipping deletion");
    return;
  }

  const storageClient = initializeStorage();
  const bucket = storageClient.bucket(BIOMETRIC_BUCKET_NAME);
  const file = bucket.file(`${BIOMETRIC_PREFIX}${objectName}`);

  try {
    await file.delete();
    logger.info(
      `[BiometricStorage] ✅ Deleted biometric object: ${BIOMETRIC_PREFIX}${objectName}`
    );
  } catch (error: any) {
    if (error.code === 404) {
      logger.warn(
        `[BiometricStorage] Object not found (already deleted): ${BIOMETRIC_PREFIX}${objectName}`
      );
    } else {
      throw error;
    }
  }
}

/**
 * Check if biometric storage is available
 */
export function isBiometricStorageAvailable(): boolean {
  return isInitialized;
}

/**
 * Get biometric storage configuration
 */
export function getBiometricStorageConfig() {
  return {
    bucketName: BIOMETRIC_BUCKET_NAME,
    prefix: BIOMETRIC_PREFIX,
    projectId: PROJECT_ID,
    initialized: isInitialized,
  };
}
