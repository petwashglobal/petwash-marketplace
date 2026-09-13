/**
 * WebAuthn / Passkey HTTP endpoints (v2) — moved out of server/routes.ts
 * (2026-09-13) so their behaviour can be tested end to end. Paths, rate limiter
 * and response shapes are unchanged except where noted below.
 *
 * Passkey both-ends audit, 2026-09-13 — production (Cloud Run petwash-api, 30d):
 *   ZERO requests ever reached register/options, register/verify or login/verify.
 *   GET /api/webauthn/credentials: 14x 500 "FAILED_PRECONDITION: query requires an
 *   index"; GET /api/auth/webauthn/devices: 404 (alias registered after the route
 *   it forwarded to). Fixed here:
 *   1. Every signed-in route authenticated ONLY with the session cookie
 *      (verifySessionCookie on req.cookies.pw_session) — a Firebase-ID-token-only
 *      caller (native shell, a page before the cookie is minted) got 401, and an
 *      expired/revoked cookie THREW into the catch and answered 500. They now use
 *      validateFirebaseToken (Bearer ID token OR session cookie, 401 on failure),
 *      the same gate every other authenticated router uses. Registration
 *      challenges stay bound to that verified uid.
 *   2. Every ceremony OUTCOME writes exactly one server-side record through
 *      logSecurityEvent (Firestore `securityEvents`): enrol success/failure, sign-in
 *      success/failure (with reason), step-up success/failure, remove, rename.
 *      Failures used to be recorded only when the handler THREW — a refused
 *      challenge, a bad signature or a revoked device left no trace at all.
 *   3. Step-up: login/verify with { purpose: 'step_up' } now requires a signed-in
 *      caller and refuses (no custom token) a passkey that belongs to a different
 *      account — the client used to silently switch accounts.
 *   4. The device list serialises timestamps as ISO strings (a raw Firestore
 *      Timestamp rendered "Invalid Date" / threw in date-fns) and answers both
 *      `credentials` and `devices` (Settings.tsx reads `devices`).
 * Unchanged (#2469 guarantees): single-use server-side challenge, origin
 * allowlist, fail-closed when the challenge store is down, and no response ever
 * says whether an account or credential exists.
 */
import type { Express, Request, Response } from 'express';
import { auth as adminAuth, db as firestoreDb } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { webauthnLimiter } from '../middleware/rateLimiter';
import { validateFirebaseToken, optionalFirebaseToken } from '../middleware/firebase-auth';
import { logSecurityEvent, type SecurityEventType } from '../services/securityEvents';
import {
  checkFailedBurst,
  alertPasskeyRevoked,
  alertNewDeviceIfUnusual,
  getClientIP,
  getCityFromIP,
} from '../services/alerts';
import {
  generateRegistrationOptionsForUser,
  verifyAndStoreRegistration,
  generateAuthenticationOptionsForEmail,
  generateDiscoverableAuthenticationOptions,
  verifyAuthentication,
  getUserCredentials,
  deleteUserCredential,
  sendWebAuthnError,
  readCredentialId,
  isValidCredentialId,
} from './service';
import { renameDevice, setDeviceIcon } from './deviceRegistry';
import { webauthnMessages, t, getLanguage } from '../lib/i18n';

async function isEmployee(uid: string): Promise<boolean> {
  const employeeDoc = await firestoreDb.collection('employees').doc(uid).get();
  return employeeDoc.exists;
}

/** Account label for the authenticator sheet: email, else phone, else ''. */
function accountLabel(req: Request): string {
  const u = req.firebaseUser;
  return u?.email || (u?.claims?.phone_number as string | undefined) || '';
}

function record(
  req: Request,
  uid: string | null,
  type: SecurityEventType,
  fields: { credentialId?: string | null; reason?: string | null; meta?: Record<string, any> } = {},
): Promise<void> {
  return logSecurityEvent({
    uid,
    type,
    ip: getClientIP(req),
    userAgent: (req.headers['user-agent'] as string) || 'unknown',
    credentialId: fields.credentialId ?? null,
    reason: fields.reason ?? null,
    meta: fields.meta,
  });
}

/** Firestore Timestamp | {_seconds} | number | string -> ISO string (or null). */
export function toIsoTimestamp(v: any): string | null {
  if (v === null || v === undefined) return null;
  let d: Date | null = null;
  if (typeof v?.toDate === 'function') d = v.toDate();
  else if (typeof v?._seconds === 'number') d = new Date(v._seconds * 1000);
  else if (typeof v === 'number' || typeof v === 'string') d = new Date(v);
  return d && !isNaN(d.getTime()) ? d.toISOString() : null;
}

/** What a member (or admin) may see about a credential — never publicKey / attestation / raw IP. */
export function publicCredentialView(c: any) {
  return {
    id: c.credId,
    credId: c.credId,
    deviceName: c.deviceName || 'Unknown Device',
    deviceIcon: c.deviceIcon || '🔐',
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    platform: c.platform || 'unknown',
    browserName: c.browserName || 'Unknown',
    browserVersion: c.browserVersion || '',
    trustScore: c.trustScore || 50,
    riskLevel: c.riskLevel || 'medium',
    createdAt: toIsoTimestamp(c.createdAt),
    lastUsedAt: toIsoTimestamp(c.lastUsedAt),
    usageCount: c.usageCount || 0,
    isRevoked: c.isRevoked || false,
    revokedAt: toIsoTimestamp(c.revokedAt),
    transports: c.transports || [],
  };
}

// ── handlers ────────────────────────────────────────────────────────────────

async function registerOptionsHandler(req: Request, res: Response) {
  const uid = req.firebaseUser!.uid;
  try {
    const isAdmin = await isEmployee(uid);
    const result = await generateRegistrationOptionsForUser(uid, accountLabel(req), isAdmin, req);

    if (!result.success) {
      await record(req, uid, 'PASSKEY_ENROLL_FAILED', {
        reason: result.reason || 'options_failed',
        meta: { stage: 'options', isAdmin },
      });
      return sendWebAuthnError(res, result.error, 500, 'Failed to generate registration options');
    }

    logger.info('[WebAuthn Register] Options generated', { uid, isAdmin });
    // challengeId: the server-side, single-use challenge handle. The client
    // sends it back to /register/verify. challengeKey is the same value under
    // the name older client bundles already send back.
    res.json({ options: result.options, challengeId: result.challengeId, challengeKey: result.challengeId });
  } catch (error) {
    logger.error('[WebAuthn Register] Options error', error);
    await record(req, uid, 'PASSKEY_ENROLL_FAILED', { reason: 'exception', meta: { stage: 'options' } });
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
}

async function registerVerifyHandler(req: Request, res: Response) {
  const ip = getClientIP(req);
  const uid = req.firebaseUser!.uid;
  const email = req.firebaseUser!.email || '';
  const { response } = req.body || {};
  const challengeId = req.body?.challengeId ?? req.body?.challengeKey;
  const claimedCredentialId = readCredentialId(response);

  try {
    const isAdmin = await isEmployee(uid);

    // The challenge must have been issued to THIS signed-in uid (bound in the store).
    const result = await verifyAndStoreRegistration(response, challengeId, uid, req);

    if (!result.verified) {
      await record(req, uid, 'PASSKEY_ENROLL_FAILED', {
        credentialId: claimedCredentialId,
        reason: result.reason || 'verification_failed',
        meta: { stage: 'verify', isAdmin },
      });
      return sendWebAuthnError(res, result.error, 400, 'Verification failed');
    }

    const city = await getCityFromIP(ip);
    const credentialId = result.credential?.credId || claimedCredentialId;

    await record(req, uid, 'PASSKEY_ENROLL_SUCCESS', {
      credentialId,
      meta: { isAdmin, city, deviceName: result.credential?.deviceName || null },
    });

    await alertNewDeviceIfUnusual(uid, ip, email, city);

    logger.info('[WebAuthn Register] Credential registered', { uid, isAdmin });
    res.json({ ok: true, message: 'Passkey registered successfully' });
  } catch (error) {
    logger.error('[WebAuthn Register] Verification error', error);
    await record(req, uid, 'PASSKEY_ENROLL_FAILED', {
      credentialId: claimedCredentialId,
      reason: 'exception',
      meta: { stage: 'verify' },
    });
    // Never echo internal error text (Firebase / Firestore messages) to the client.
    res.status(400).json({ error: 'Registration failed' });
  }
}

async function loginOptionsHandler(req: Request, res: Response) {
  try {
    const rawEmail = req.body?.email;

    if (rawEmail !== undefined && rawEmail !== null && rawEmail !== '' && typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'Invalid email' });
    }
    const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';

    if (!email) {
      // Discoverable (usernameless) — this is the conditional-UI probe that runs
      // on every signed-out page load. It needs no user: a normal 200 options
      // payload whenever the origin is allowed and the challenge store is up.
      const result = await generateDiscoverableAuthenticationOptions(req);

      if (!result.success) {
        return sendWebAuthnError(res, result.error, 400, 'Failed to generate options');
      }

      return res.json({
        options: result.options,
        challengeId: result.challengeId,
        challengeKey: result.challengeId, // same value; older bundles read this name
        discoverable: true,
      });
    }

    const result = await generateAuthenticationOptionsForEmail(email, req);

    if (!result.success) {
      return sendWebAuthnError(res, result.error, 400, 'No passkeys found');
    }

    logger.info('[WebAuthn Login] Options generated', { hasCredentials: true });
    res.json({
      options: result.options,
      challengeId: result.challengeId,
      challengeKey: result.challengeId,
      discoverable: false,
    });
  } catch (error) {
    logger.error('[WebAuthn Login] Options error', error);
    res.status(500).json({ error: 'Failed to generate options' });
  }
}

async function loginVerifyHandler(req: Request, res: Response) {
  const ip = getClientIP(req);
  const { response } = req.body || {};
  const challengeId = req.body?.challengeId ?? req.body?.challengeKey;
  // Step-up re-auth (client/src/auth/stepUp.ts) runs the same ceremony while
  // signed in. The server — not the client — enforces that the passkey belongs
  // to the signed-in account before handing back a token.
  const isStepUp = req.body?.purpose === 'step_up';
  const callerUid = req.firebaseUser?.uid || null;
  const failType: SecurityEventType = isStepUp ? 'PASSKEY_STEPUP_FAILED' : 'PASSKEY_AUTH_FAILED';
  const successType: SecurityEventType = isStepUp ? 'PASSKEY_STEPUP_SUCCESS' : 'PASSKEY_AUTH_SUCCESS';
  let uid: string | undefined;
  let email: string | undefined;

  try {
    if (isStepUp && !callerUid) {
      await record(req, null, failType, { credentialId: readCredentialId(response), reason: 'not_signed_in' });
      return res.status(401).json({ error: 'Authentication required' });
    }

    // The server-side challenge record (consumed exactly once) decides whether
    // this is a discoverable or an email-scoped ceremony — the client's
    // `discoverable` flag is not trusted for that choice.
    const result = await verifyAuthentication(response, challengeId, req);

    if (!result.verified) {
      // uid only when the SERVER resolved it; never echoed to the client.
      const failedUid = result.uid || (isStepUp ? callerUid : null);
      await record(req, failedUid, failType, {
        credentialId: result.credentialId || readCredentialId(response),
        reason: result.reason || 'verification_failed',
      });
      if (result.uid && result.email) {
        await checkFailedBurst(result.uid, result.email);
      }
      return sendWebAuthnError(res, result.error, 401, 'Authentication failed');
    }

    uid = result.uid;
    email = result.email;
    const isAdmin = result.isAdmin;

    if (!uid) {
      throw new Error('User ID not found');
    }

    if (isStepUp && uid !== callerUid) {
      await record(req, callerUid, failType, {
        credentialId: result.credentialId,
        reason: 'uid_mismatch',
      });
      logger.warn('[WebAuthn StepUp] passkey belongs to a different account — refused', { callerUid });
      return res.status(401).json({ error: 'This passkey belongs to a different account' });
    }

    // Create Firebase custom token for client to exchange.
    //
    // SECURITY 2026-05-24 (CRITICAL fix — investigation finding 4.2):
    //   Do NOT mint a session cookie server-side here (createSessionCookie needs
    //   an ID token, not a custom token). Return the customToken; the client runs
    //     signInWithCustomToken(auth, customToken)
    //       → cred.user.getIdToken(true)
    //         → POST /api/auth/session { idToken } (mints the cookie)
    //   The chain is in client/src/pages/admin/AdminLoginV2.tsx.
    const customToken = await adminAuth.createCustomToken(uid);

    // ── Phase 1 canonical identity wiring — flag-gated, default OFF.
    // Records the passkey provider link on identity_accounts and emits
    // IDENTITY_SHADOW_WOULD_MERGE on collisions. Observation only —
    // never merges. Passkey verify requires prior enrollment, so this
    // is always a return-login for a known uid.
    try {
      const { getFeatureFlag } = await import('../services/SystemConfig');
      const identityUnifiedOn = await getFeatureFlag('ff.returning_user.identity_unified.enabled');
      if (identityUnifiedOn) {
        const { loginOrLink } = await import('../identity/loginOrLink');
        await loginOrLink({
          provider: 'passkey',
          providerAccountId: uid,
          email: email || null,
          emailVerified: !!email, // WebAuthn requires prior verified enrollment
          displayName: null,
        });
      }
    } catch (identityErr) {
      logger.warn('[WebAuthn Login] loginOrLink probe failed (non-blocking)', {
        uid,
        error: identityErr instanceof Error ? identityErr.message : String(identityErr),
      });
    }

    const city = await getCityFromIP(ip);

    await record(req, uid, successType, {
      credentialId: result.credentialId,
      meta: { isAdmin, city },
    });

    await alertNewDeviceIfUnusual(uid, ip, email, city);

    logger.info('[WebAuthn Login] Authentication successful', { uid, isAdmin, stepUp: isStepUp });
    res.json({
      ok: true,
      customToken, // Client can use this to sign in with Firebase
      user: { uid, email, isAdmin },
    });
  } catch (error) {
    logger.error('[WebAuthn Login] Verification error', error);
    await record(req, uid || (isStepUp ? callerUid : null), failType, {
      credentialId: readCredentialId(response),
      reason: 'exception',
    });
    if (uid && email) {
      await checkFailedBurst(uid, email);
    }
    res.status(400).json({ error: 'Authentication failed' });
  }
}

async function listCredentialsHandler(req: Request, res: Response) {
  try {
    const uid = req.firebaseUser!.uid;
    const isAdmin = await isEmployee(uid);
    const credentials = (await getUserCredentials(uid, isAdmin)).map(publicCredentialView);

    // `devices` is the same list under the name Settings.tsx / passkey.ts read.
    res.json({ ok: true, credentials, devices: credentials });
  } catch (error) {
    logger.error('[WebAuthn] Get credentials error', error);
    res.status(500).json({ error: 'Failed to get credentials' });
  }
}

async function renameCredentialHandler(req: Request, res: Response) {
  const credentialId = req.params.credentialId;
  try {
    const uid = req.firebaseUser!.uid;
    if (!isValidCredentialId(credentialId)) {
      return res.status(400).json({ error: 'Invalid credential id' });
    }

    const { newName } = req.body || {};
    if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      return res.status(400).json({ error: 'Device name is required' });
    }
    if (newName.trim().length > 100) {
      return res.status(400).json({ error: 'Device name must be less than 100 characters' });
    }

    const isAdmin = await isEmployee(uid);
    const collectionPath = isAdmin ? 'employees' : 'users';
    const credDoc = await firestoreDb
      .collection(collectionPath)
      .doc(uid)
      .collection('webauthnCredentials')
      .doc(credentialId)
      .get();
    if (!credDoc.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }
    const oldName = credDoc.data()?.deviceName || 'Unknown';

    await renameDevice(uid, isAdmin, credentialId, newName.trim());

    await record(req, uid, 'DEVICE_RENAMED', {
      credentialId,
      meta: { oldName, newName: newName.trim() },
    });

    const lang = getLanguage(req);
    logger.info('[WebAuthn] Device renamed', { uid, credentialId: credentialId.substring(0, 12) });
    res.json({
      ok: true,
      message: t(webauthnMessages.deviceRenamed, lang),
      deviceName: newName.trim(),
    });
  } catch (error) {
    logger.error('[WebAuthn] Rename device error', error);
    res.status(500).json({ error: 'Failed to rename device' });
  }
}

async function setIconHandler(req: Request, res: Response) {
  try {
    const uid = req.firebaseUser!.uid;
    if (!isValidCredentialId(req.params.credentialId)) {
      return res.status(400).json({ error: 'Invalid credential id' });
    }
    const { icon } = req.body || {};
    if (!icon || typeof icon !== 'string') {
      return res.status(400).json({ error: 'Device icon is required' });
    }

    const isAdmin = await isEmployee(uid);
    await setDeviceIcon(uid, isAdmin, req.params.credentialId, icon);

    logger.info('[WebAuthn] Device icon updated', { uid, credentialId: req.params.credentialId.substring(0, 12) });
    res.json({ ok: true, message: 'Device icon updated successfully', icon });
  } catch (error) {
    logger.error('[WebAuthn] Set device icon error', error);
    res.status(500).json({ error: 'Failed to set device icon' });
  }
}

async function deleteCredentialHandler(req: Request, res: Response) {
  const credentialId = req.params.credentialId;
  try {
    const uid = req.firebaseUser!.uid;
    if (!isValidCredentialId(credentialId)) {
      return res.status(400).json({ error: 'Invalid credential id' });
    }

    const isAdmin = await isEmployee(uid);
    const collectionPath = isAdmin ? 'employees' : 'users';
    const credentialsSnapshot = await firestoreDb
      .collection(collectionPath)
      .doc(uid)
      .collection('webauthnCredentials')
      .where('isRevoked', '==', false)
      .get();

    if (credentialsSnapshot.size <= 1) {
      return res.status(400).json({
        error: 'Cannot remove last device',
        code: 'LAST_DEVICE',
      });
    }

    const credDoc = await firestoreDb
      .collection(collectionPath)
      .doc(uid)
      .collection('webauthnCredentials')
      .doc(credentialId)
      .get();
    if (!credDoc.exists || credDoc.data()?.isRevoked) {
      return res.status(404).json({ error: 'Device not found' });
    }
    const deviceLabel = credDoc.data()?.deviceName || 'Unknown Device';

    await deleteUserCredential(uid, credentialId, isAdmin);

    await record(req, uid, 'PASSKEY_REVOKED', {
      credentialId,
      meta: { deviceLabel, revokedBy: 'self' },
    });

    await alertPasskeyRevoked(uid, credentialId, req.firebaseUser!.email || undefined, deviceLabel);

    const lang = getLanguage(req);
    logger.info('[WebAuthn] Credential deleted', { uid, credentialId: credentialId.substring(0, 12) });
    res.json({
      ok: true,
      message: t(webauthnMessages.deviceRemoved, lang),
    });
  } catch (error) {
    logger.error('[WebAuthn] Delete credential error', error);
    res.status(500).json({ error: 'Failed to delete passkey' });
  }
}

/**
 * Mount every /api/webauthn/* route plus the /api/auth/webauthn/devices aliases.
 *
 * SECURITY 2026-05-24 (investigation finding 4.3): the canonical 60/min IP+UID
 * `webauthnLimiter` from middleware/rateLimiter applies to every route (an inline
 * 5/min IP-wide shadow used to lock whole offices out).
 */
export function registerWebAuthnRoutes(app: Express): void {
  app.post('/api/webauthn/register/options', webauthnLimiter, validateFirebaseToken, registerOptionsHandler);
  app.post('/api/webauthn/register/verify', webauthnLimiter, validateFirebaseToken, registerVerifyHandler);
  app.post('/api/webauthn/login/options', webauthnLimiter, loginOptionsHandler);
  // optionalFirebaseToken only identifies the caller for step-up; a normal
  // signed-out login ignores it. The handler self-checks (never trusts absence).
  app.post('/api/webauthn/login/verify', webauthnLimiter, optionalFirebaseToken, loginVerifyHandler);

  // Device management. The /api/auth/webauthn/devices aliases used to rewrite
  // req.url and call next() — but they were registered AFTER the routes they
  // forwarded to, so Express never went back: GET /api/auth/webauthn/devices
  // answered 404 in production. Both paths now mount the same handler.
  app.get('/api/webauthn/credentials', webauthnLimiter, validateFirebaseToken, listCredentialsHandler);
  app.get('/api/auth/webauthn/devices', webauthnLimiter, validateFirebaseToken, listCredentialsHandler);
  app.patch('/api/webauthn/credentials/:credentialId/rename', webauthnLimiter, validateFirebaseToken, renameCredentialHandler);
  app.patch('/api/auth/webauthn/devices/:credentialId/rename', webauthnLimiter, validateFirebaseToken, renameCredentialHandler);
  app.patch('/api/webauthn/credentials/:credentialId/icon', webauthnLimiter, validateFirebaseToken, setIconHandler);
  app.delete('/api/webauthn/credentials/:credentialId', webauthnLimiter, validateFirebaseToken, deleteCredentialHandler);
  app.delete('/api/auth/webauthn/devices/:credentialId', webauthnLimiter, validateFirebaseToken, deleteCredentialHandler);
}
