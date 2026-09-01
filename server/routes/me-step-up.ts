/**
 * /api/me/step-up/issue — auth-rebuild Phase 7 (StepUpService callable).
 *
 * The client obtains a short-lived, purpose-bound step-up proof by
 * proving FRESH authentication. Proof of freshness is a Firebase
 * ID token whose `auth_time` claim is within RECENT_AUTH_MAX_SECONDS
 * of now — meaning the user JUST re-authenticated (password re-entry,
 * WebAuthn passkey → custom token → sign-in, phone OTP → sign-in).
 *
 * Contract:
 *
 *   POST /api/me/step-up/issue
 *   headers: Authorization: Bearer <long-lived session ID token>
 *            (validateFirebaseToken populates req.firebaseUser)
 *   body:    { purpose: STEP_UP_PURPOSE, freshIdToken: '<recently-minted>' }
 *
 *   Success 200:
 *     { proof: '<opaque>', expiresAt: '<ISO>', purpose }
 *   → Client puts `proof` in `X-StepUp-Proof` on the sensitive request.
 *
 *   400 BAD_REQUEST         — malformed body / unknown purpose
 *   401 AUTH_REQUIRED       — validateFirebaseToken failed
 *   401 FRESH_TOKEN_INVALID — freshIdToken didn't verify
 *   401 UID_MISMATCH        — freshIdToken belonged to a different uid
 *   401 RECENCY_INSUFFICIENT — auth_time older than the threshold
 *   500 SERVICE_UNAVAILABLE — STEP_UP_HMAC_SECRET missing / < 32 chars
 *
 * WHY THIS SHAPE:
 *   - The fresh ID token is the ONE proof of "just re-authenticated".
 *     No password / OTP / passkey response is passed to this endpoint;
 *     the actual re-auth already happened at Firebase, and we simply
 *     read the `auth_time` claim of the resulting token.
 *   - `freshIdToken` may equal the header's session token if the
 *     browser has JUST refreshed — we still require auth_time to be
 *     recent, which naturally rejects any stale bearer that happens
 *     to be presented here.
 *   - The endpoint NEVER stores anything. StepUpService HMAC-signs
 *     the proof; verify path is stateless.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { issueStepUpProof, STEP_UP_PURPOSES, type StepUpPurpose } from '../services/StepUpService';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

/** Max age of freshIdToken's `auth_time` for the step-up proof to be issued. */
const RECENT_AUTH_MAX_SECONDS = 5 * 60;

const IssueBody = z.object({
  purpose: z.enum(STEP_UP_PURPOSES),
  freshIdToken: z.string().min(20),
});

router.post('/step-up/issue', validateFirebaseToken, async (req: Request, res: Response) => {
  const callerUid = req.firebaseUser?.uid;
  if (!callerUid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = IssueBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      expected: {
        purpose: `one of ${STEP_UP_PURPOSES.join(' | ')}`,
        freshIdToken: '<recently-minted Firebase ID token>',
      },
    });
  }
  const { purpose, freshIdToken } = parsed.data;

  // 1. Verify the fresh ID token — separate call from the header
  //    validation, checkRevoked=true so a token from a revoked user
  //    can't mint a step-up proof.
  let decoded: any;
  try {
    decoded = await admin.auth().verifyIdToken(freshIdToken, true);
  } catch (err: any) {
    logger.warn('[me/step-up/issue] freshIdToken verify failed', {
      callerUid,
      code: err?.code,
    });
    return res.status(401).json({ error: 'FRESH_TOKEN_INVALID' });
  }

  // 2. The fresh token MUST belong to the currently-signed-in user.
  if (decoded.uid !== callerUid) {
    logger.warn('[me/step-up/issue] uid mismatch between session and freshIdToken', {
      callerUid,
    });
    return res.status(401).json({ error: 'UID_MISMATCH' });
  }

  // 3. auth_time recency — the ONE proof of "just re-authenticated".
  const authTime = Number(decoded.auth_time);
  if (!Number.isFinite(authTime)) {
    return res.status(401).json({ error: 'FRESH_TOKEN_INVALID' });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authTime > RECENT_AUTH_MAX_SECONDS) {
    logger.warn('[me/step-up/issue] auth_time too old', {
      callerUid,
      ageSeconds: nowSec - authTime,
      max: RECENT_AUTH_MAX_SECONDS,
    });
    return res.status(401).json({
      error: 'RECENCY_INSUFFICIENT',
      detail: `Please re-authenticate. Requested proof needs auth_time within ${RECENT_AUTH_MAX_SECONDS}s; got ${nowSec - authTime}s.`,
    });
  }

  // 4. Mint the proof. Fails CLOSED if the HMAC secret is missing.
  const issued = issueStepUpProof(callerUid, purpose as StepUpPurpose);
  if (!issued) {
    return res.status(500).json({ error: 'SERVICE_UNAVAILABLE' });
  }

  logger.info('[me/step-up/issue] proof issued', {
    callerUid,
    purpose,
    freshAuthAgeSeconds: nowSec - authTime,
    expiresAt: issued.expiresAt.toISOString(),
  });

  return res.json({
    proof: issued.token,
    purpose,
    expiresAt: issued.expiresAt.toISOString(),
  });
});

export default router;
