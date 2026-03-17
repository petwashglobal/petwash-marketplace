/**
 * WebAuthn/Passkey Service
 * Biometric Authentication (Touch ID / Face ID)
 * 
 * Supports:
 * - Passkey registration
 * - Passkey authentication
 * - Device management
 */

import express from "express";
import admin from "../lib/firebase-admin";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import { requireAuth } from "../customAuth";
import { logger } from "../lib/logger";
import * as Sentry from "@sentry/node";
import { ensureWebAuthnSession, setWebAuthnCsrfToken, verifyWebAuthnCsrfToken } from "../webauthn/csrfProtection";

import { sql } from "drizzle-orm";
import { db as pgDb } from "../db";
import { CURRENT_BIOMETRIC_CONSENT_VERSION } from "../lib/consentConstants";

const router = express.Router();
const db = admin.firestore();

// WebAuthn Configuration
const RP_NAME = "Pet Wash Group";
const RP_ID = process.env.NODE_ENV === "production" ? "petwash.co.il" : (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "localhost");
const ORIGIN = process.env.NODE_ENV === "production"
  ? "https://petwash.co.il"
  : (process.env.BASE_URL || (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : "http://localhost:5000"));

/**
 * POST /webauthn/register/options
 * Generate passkey registration options
 * SECURITY: Sets CSRF token in response header for client to use in verify step
 * NOTE: requireAuth ensures session exists, no need for ensureWebAuthnSession
 */
router.post("/register/options", requireAuth, setWebAuthnCsrfToken, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const userEmail = req.user!.email || "user@petwash.co.il";

    // Verify biometric consent exists and is current (v2025.1)
    const consentResult = await pgDb.execute(sql`
      SELECT accepted, consent_version 
      FROM user_consents 
      WHERE user_id = ${userId} 
      AND consent_type = 'biometric_auth'
      ORDER BY accepted_at DESC 
      LIMIT 1
    `);

    const latestConsent = consentResult.rows[0] as any;
    if (!latestConsent || !latestConsent.accepted || latestConsent.consent_version !== CURRENT_BIOMETRIC_CONSENT_VERSION) {
      return res.status(403).json({ 
        error: "Biometric consent required", 
        code: "CONSENT_REQUIRED",
        requiredVersion: CURRENT_BIOMETRIC_CONSENT_VERSION,
      });
    }

    // Get existing authenticators
    const authenticatorsSnapshot = await db
      .collection("authenticators")
      .where("userId", "==", userId)
      .get();

    const existingAuthenticators = authenticatorsSnapshot.docs.map((doc) => ({
      id: Buffer.from(doc.data().credentialID, "base64"),
      transports: doc.data().transports || [],
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: userEmail,
      attestationType: "direct", // Request hardware attestation proof (Secure Enclave / StrongBox)
      excludeCredentials: existingAuthenticators.map((auth) => ({
        id: auth.id,
        type: "public-key",
        transports: auth.transports,
      })),
      authenticatorSelection: {
        residentKey: "required",        // Key must stay on this device (non-syncable)
        userVerification: "required",   // Enforce Face ID / Touch ID / biometric (NIST AAL2)
        authenticatorAttachment: "platform",
      },
    });

    // Store challenge for verification
    await db.collection("webauthn_challenges").doc(userId).set({
      challenge: options.challenge,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    res.json(options);
  } catch (error: any) {
    logger.error("[WebAuthn] Registration options error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to generate registration options" });
  }
});

/**
 * POST /webauthn/register/verify
 * Verify passkey registration
 * SECURITY: Protected with CSRF token to prevent cross-site passkey enrollment
 * NOTE: requireAuth ensures session exists, no need for ensureWebAuthnSession
 */
router.post("/register/verify", requireAuth, verifyWebAuthnCsrfToken, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { response, deviceName } = req.body;

    // Get stored challenge
    const challengeDoc = await db.collection("webauthn_challenges").doc(userId).get();
    
    if (!challengeDoc.exists) {
      return res.status(400).json({ error: "Challenge not found or expired" });
    }

    const challengeData = challengeDoc.data()!;

    // Check challenge expiry
    if (challengeData.expiresAt?.toDate?.() < new Date() || (challengeData.expiresAt instanceof Date && challengeData.expiresAt < new Date())) {
      await challengeDoc.ref.delete();
      return res.status(400).json({ error: "Challenge expired" });
    }

    const { challenge } = challengeData;

    // Verify registration — requireUserVerification enforces Face ID / Touch ID (NIST AAL2)
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Verification failed" });
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    const { aaguid } = verification.registrationInfo;

    // Store authenticator — include attestation metadata for hardware-bound audit trail
    await db.collection("authenticators").add({
      userId,
      credentialID: Buffer.from(credentialID).toString("base64"),
      credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      deviceName: deviceName || "Unknown Device",
      transports: response.response.transports || [],
      aaguid: aaguid || null,                    // Hardware identifier (Secure Enclave / StrongBox AAGUID)
      attestationType: "direct",
      createdAt: new Date(),
      isRevoked: false,
      lastUsed: null,
    });

    // Clean up challenge
    await challengeDoc.ref.delete();

    logger.info(`[WebAuthn] Passkey registered for user: ${userId}`);

    res.json({ 
      verified: true,
      message: "Passkey registered successfully" 
    });
  } catch (error: any) {
    logger.error("[WebAuthn] Registration verification error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to verify registration" });
  }
});

/**
 * POST /webauthn/authenticate/options
 * Generate passkey authentication options
 * SECURITY: No additional CSRF protection needed - WebAuthn's challenge/response mechanism
 * provides inherent CSRF protection. The challenge is cryptographically random, stored in Firestore,
 * and must be signed by the client's credential. An attacker cannot forge this flow.
 */
router.post("/authenticate/options", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Get user's authenticators
    const authenticatorsSnapshot = await db
      .collection("authenticators")
      .where("userId", "==", userRecord.uid)
      .get();

    if (authenticatorsSnapshot.empty) {
      return res.status(404).json({ error: "No passkeys found for this account" });
    }

    const allowCredentials = authenticatorsSnapshot.docs.map((doc) => ({
      id: Buffer.from(doc.data().credentialID, "base64"),
      type: "public-key" as const,
      transports: doc.data().transports || [],
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: "required", // Enforce Face ID / Touch ID (NIST AAL2)
    });

    // Store challenge
    await db.collection("webauthn_challenges").doc(userRecord.uid).set({
      challenge: options.challenge,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    res.json(options);
  } catch (error: any) {
    logger.error("[WebAuthn] Authentication options error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to generate authentication options" });
  }
});

/**
 * POST /webauthn/authenticate/verify
 * Verify passkey authentication
 * SECURITY: No additional CSRF protection needed - WebAuthn's challenge/response mechanism
 * provides inherent CSRF protection by requiring the client to sign the server-issued challenge.
 * This prevents cross-site authentication attacks.
 */
router.post("/authenticate/verify", async (req, res) => {
  try {
    const { response, email } = req.body;

    // Get user
    const userRecord = await admin.auth().getUserByEmail(email);

    // Get challenge
    const challengeDoc = await db.collection("webauthn_challenges").doc(userRecord.uid).get();
    
    if (!challengeDoc.exists) {
      return res.status(400).json({ error: "Challenge not found or expired" });
    }

    const authChallengeData = challengeDoc.data()!;

    // Check challenge expiry
    if (authChallengeData.expiresAt?.toDate?.() < new Date() || (authChallengeData.expiresAt instanceof Date && authChallengeData.expiresAt < new Date())) {
      await challengeDoc.ref.delete();
      return res.status(400).json({ error: "Challenge expired" });
    }

    const { challenge } = authChallengeData;

    // Get authenticator (credential ID is base64url from client)
    const credentialID = Buffer.from(response.id, "base64url").toString("base64");
    const authenticatorSnapshot = await db
      .collection("authenticators")
      .where("userId", "==", userRecord.uid)
      .where("credentialID", "==", credentialID)
      .limit(1)
      .get();

    if (authenticatorSnapshot.empty) {
      return res.status(404).json({ error: "Authenticator not found" });
    }

    const authenticatorDoc = authenticatorSnapshot.docs[0];
    const authenticator = authenticatorDoc.data();

    // Decode the base64url-encoded credential fields from client
    const decodedResponse = {
      id: response.id,
      rawId: Buffer.from(response.rawId, "base64url"),
      type: response.type,
      response: {
        authenticatorData: Buffer.from(response.response.authenticatorData, "base64url"),
        clientDataJSON: Buffer.from(response.response.clientDataJSON, "base64url"),
        signature: Buffer.from(response.response.signature, "base64url"),
        userHandle: response.response.userHandle 
          ? Buffer.from(response.response.userHandle, "base64url")
          : undefined,
      },
    };

    // Verify authentication — requireUserVerification confirms biometric was presented (NIST AAL2)
    const verification = await verifyAuthenticationResponse({
      response: decodedResponse as any,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      authenticator: {
        credentialID: Buffer.from(authenticator.credentialID, "base64"),
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, "base64"),
        counter: authenticator.counter,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: "Verification failed" });
    }

    // Update counter
    await authenticatorDoc.ref.update({
      counter: verification.authenticationInfo.newCounter,
      lastUsed: new Date(),
    });

    // Clean up challenge
    await challengeDoc.ref.delete();

    // Create Firebase custom token
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    logger.info(`[WebAuthn] Passkey authentication successful: ${email}`);

    res.json({
      verified: true,
      customToken,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      },
    });
  } catch (error: any) {
    logger.error("[WebAuthn] Authentication verification error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to verify authentication" });
  }
});

/**
 * GET /webauthn/devices
 * Get user's registered devices
 */
router.get("/devices", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;

    const snapshot = await db
      .collection("authenticators")
      .where("userId", "==", userId)
      .get();

    const devices = snapshot.docs.map((doc) => ({
      id: doc.id,
      deviceName: doc.data().deviceName,
      createdAt: doc.data().createdAt,
      lastUsed: doc.data().lastUsed,
    }));

    res.json({ devices });
  } catch (error: any) {
    logger.error("[WebAuthn] Get devices error:", error);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

/**
 * DELETE /webauthn/devices/:deviceId
 * Remove a registered device
 */
router.delete("/devices/:deviceId", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { deviceId } = req.params;

    const doc = await db.collection("authenticators").doc(deviceId).get();

    if (!doc.exists || doc.data()!.userId !== userId) {
      return res.status(404).json({ error: "Device not found" });
    }

    await doc.ref.delete();

    res.json({ success: true });
  } catch (error: any) {
    logger.error("[WebAuthn] Delete device error:", error);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

export default router;
