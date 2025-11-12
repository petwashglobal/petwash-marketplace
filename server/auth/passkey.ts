/**
 * BIOMETRIC + PASSKEY LOGIN CHECK
 * WebAuthn Level 2 Implementation for iOS Face ID & Android Fingerprint
 * 
 * Features:
 * - Face ID (iOS Safari)
 * - Touch ID (macOS Safari)
 * - Fingerprint (Android Chrome)
 * - Windows Hello (Chrome/Edge)
 * - Secure hardware-backed authentication
 */

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import crypto from 'crypto';

/**
 * Relying Party configuration
 */
const RP_NAME = 'Pet Wash Ltd';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'petwash.co.il';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://petwash.co.il';

/**
 * User credential data structure
 */
interface UserCredential {
  credId: string; // Base64-encoded credential ID
  publicKey: string; // Base64-encoded public key
  counter: number;
  deviceType: string; // 'platform' (Face ID) or 'cross-platform' (USB key)
  createdAt: Date;
}

/**
 * STEP 1: Begin passkey registration
 * Called when user wants to set up Face ID / fingerprint login
 */
export async function beginRegistration(user: {
  id: string;
  email: string;
  displayName?: string;
}) {
  try {
    logger.info('[Passkey] Beginning registration', {
      userId: user.id,
      email: user.email,
    });
    
    // Get existing credentials for this user
    const credResult = await db.execute(sql`
      SELECT credentials 
      FROM users 
      WHERE firebase_uid = ${user.id}
    `);
    
    const existingCreds: UserCredential[] = credResult.rows[0]?.credentials || [];
    
    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.displayName || user.email,
      
      // Exclude existing credentials (prevent duplicate registrations)
      excludeCredentials: existingCreds.map(cred => ({
        id: Buffer.from(cred.credId, 'base64'),
        type: 'public-key',
        transports: ['internal'], // Face ID / fingerprint
      })),
      
      // Require user verification (biometric check)
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Built-in biometric
        userVerification: 'required',
        requireResidentKey: false,
      },
      
      // Use modern algorithms
      attestationType: 'none', // Privacy-preserving (no device info leaked)
    });
    
    // Store challenge in user session (expires in 5 minutes)
    await db.execute(sql`
      UPDATE users 
      SET 
        passkey_challenge = ${options.challenge},
        passkey_challenge_expires = NOW() + INTERVAL '5 minutes'
      WHERE firebase_uid = ${user.id}
    `);
    
    logger.info('[Passkey] Registration options generated', {
      userId: user.id,
      challengeLength: options.challenge.length,
    });
    
    return options;
  } catch (error: any) {
    logger.error('[Passkey] Registration init failed', {
      userId: user.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * STEP 2: Complete passkey registration
 * Called after user successfully scans Face ID / fingerprint
 */
export async function completeRegistration(
  userId: string,
  registrationResponse: any
): Promise<VerifiedRegistrationResponse> {
  try {
    logger.info('[Passkey] Completing registration', { userId });
    
    // Get challenge from database
    const userResult = await db.execute(sql`
      SELECT passkey_challenge, passkey_challenge_expires
      FROM users
      WHERE firebase_uid = ${userId}
    `);
    
    const userData = userResult.rows[0] as any;
    
    if (!userData || !userData.passkey_challenge) {
      throw new Error('No registration challenge found');
    }
    
    if (new Date(userData.passkey_challenge_expires) < new Date()) {
      throw new Error('Registration challenge expired');
    }
    
    // Verify registration response
    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: userData.passkey_challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }
    
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    
    // Store credential in database
    const newCredential: UserCredential = {
      credId: Buffer.from(credentialID).toString('base64'),
      publicKey: Buffer.from(credentialPublicKey).toString('base64'),
      counter,
      deviceType: 'platform', // Face ID / Touch ID / Fingerprint
      createdAt: new Date(),
    };
    
    await db.execute(sql`
      UPDATE users
      SET 
        credentials = COALESCE(credentials, '[]'::jsonb) || ${JSON.stringify(newCredential)}::jsonb,
        passkey_challenge = NULL,
        passkey_challenge_expires = NULL,
        passkey_enabled = true
      WHERE firebase_uid = ${userId}
    `);
    
    logger.info('[Passkey] Registration complete', {
      userId,
      credentialId: newCredential.credId.substring(0, 20) + '...',
    });
    
    return verification;
  } catch (error: any) {
    logger.error('[Passkey] Registration completion failed', {
      userId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * STEP 3: Begin passkey login
 * Called when user taps "Sign in with Face ID"
 */
export async function beginLogin(userEmail: string) {
  try {
    logger.info('[Passkey] Beginning login', { userEmail });
    
    // Get user and their credentials
    const userResult = await db.execute(sql`
      SELECT firebase_uid, credentials
      FROM users
      WHERE email = ${userEmail}
      AND passkey_enabled = true
    `);
    
    if (!userResult.rows || userResult.rows.length === 0) {
      throw new Error('User not found or passkey not enabled');
    }
    
    const userData = userResult.rows[0] as any;
    const credentials: UserCredential[] = userData.credentials || [];
    
    if (credentials.length === 0) {
      throw new Error('No registered credentials found');
    }
    
    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map(cred => ({
        id: Buffer.from(cred.credId, 'base64'),
        type: 'public-key',
        transports: ['internal'],
      })),
      userVerification: 'required',
    });
    
    // Store challenge
    await db.execute(sql`
      UPDATE users
      SET 
        passkey_challenge = ${options.challenge},
        passkey_challenge_expires = NOW() + INTERVAL '5 minutes'
      WHERE firebase_uid = ${userData.firebase_uid}
    `);
    
    logger.info('[Passkey] Login options generated', {
      userEmail,
      allowedCredentials: credentials.length,
    });
    
    return {
      options,
      userId: userData.firebase_uid,
    };
  } catch (error: any) {
    logger.error('[Passkey] Login init failed', {
      userEmail,
      error: error.message,
    });
    throw error;
  }
}

/**
 * STEP 4: Complete passkey login
 * Called after user successfully scans Face ID / fingerprint
 */
export async function completeLogin(
  userId: string,
  authenticationResponse: any
): Promise<boolean> {
  try {
    logger.info('[Passkey] Completing login', { userId });
    
    // Get user data
    const userResult = await db.execute(sql`
      SELECT passkey_challenge, passkey_challenge_expires, credentials
      FROM users
      WHERE firebase_uid = ${userId}
    `);
    
    const userData = userResult.rows[0] as any;
    
    if (!userData || !userData.passkey_challenge) {
      throw new Error('No login challenge found');
    }
    
    if (new Date(userData.passkey_challenge_expires) < new Date()) {
      throw new Error('Login challenge expired');
    }
    
    // Find matching credential
    const credId = Buffer.from(authenticationResponse.id, 'base64').toString('base64');
    const credential = userData.credentials?.find((c: UserCredential) => c.credId === credId);
    
    if (!credential) {
      throw new Error('Credential not found');
    }
    
    // Verify authentication response
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: userData.passkey_challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(credential.credId, 'base64'),
        credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
        counter: credential.counter,
      },
      requireUserVerification: true,
    });
    
    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }
    
    // Update counter and last login
    const updatedCredentials = userData.credentials.map((c: UserCredential) => 
      c.credId === credential.credId 
        ? { ...c, counter: verification.authenticationInfo.newCounter }
        : c
    );
    
    await db.execute(sql`
      UPDATE users
      SET 
        credentials = ${JSON.stringify(updatedCredentials)},
        passkey_challenge = NULL,
        passkey_challenge_expires = NULL,
        last_login_at = NOW(),
        last_login_method = 'passkey'
      WHERE firebase_uid = ${userId}
    `);
    
    logger.info('[Passkey] Login successful', {
      userId,
      method: 'biometric',
    });
    
    return true;
  } catch (error: any) {
    logger.error('[Passkey] Login completion failed', {
      userId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Get user's registered credentials
 */
export async function getUserCredentials(userId: string): Promise<UserCredential[]> {
  try {
    const result = await db.execute(sql`
      SELECT credentials
      FROM users
      WHERE firebase_uid = ${userId}
    `);
    
    return result.rows[0]?.credentials || [];
  } catch (error: any) {
    logger.error('[Passkey] Failed to get credentials', {
      userId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Remove a specific credential (device)
 */
export async function removeCredential(userId: string, credId: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT credentials
      FROM users
      WHERE firebase_uid = ${userId}
    `);
    
    const credentials: UserCredential[] = result.rows[0]?.credentials || [];
    const updatedCredentials = credentials.filter(c => c.credId !== credId);
    
    await db.execute(sql`
      UPDATE users
      SET 
        credentials = ${JSON.stringify(updatedCredentials)},
        passkey_enabled = ${updatedCredentials.length > 0}
      WHERE firebase_uid = ${userId}
    `);
    
    logger.info('[Passkey] Credential removed', {
      userId,
      remainingCredentials: updatedCredentials.length,
    });
    
    return true;
  } catch (error: any) {
    logger.error('[Passkey] Failed to remove credential', {
      userId,
      error: error.message,
    });
    return false;
  }
}
