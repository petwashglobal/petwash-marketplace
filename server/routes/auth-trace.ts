/**
 * auth-trace — CEO MASTER §B41 §1.2 §D2 (2026-08-29).
 *
 * Client-side auth-journey stage recorder. The client generates an
 * opaque `authJourneyId` on the first auth CTA tap and posts stage
 * events here so operations can see WHERE Google sign-in dropped off:
 *
 *   AUTH_METHOD_SELECTED
 *   FIREBASE_POPUP_STARTED / _SUCCEEDED / _CANCELLED / _BLOCKED
 *   FIREBASE_REDIRECT_STARTED / _RETURNED / _RESULT_FOUND / _MISSING
 *   FIREBASE_SUCCESS / _FAILURE
 *   SESSION_EXCHANGE_START / _SUCCESS / _FAILURE
 *   BOOTSTRAP_SUCCESS / _FAILURE
 *   POST_LOGIN_SUCCESS / _FAILURE
 *   NAVIGATION_SUCCESS
 *
 * DISCIPLINE — hard requirements from CEO §D4 §B41:
 *   * NEVER accept: password, OTP, Firebase ID token, OAuth token,
 *     Israeli ID, bank details, email, phone. The endpoint rejects
 *     any payload whose keys look sensitive.
 *   * Accept only safe metadata: journeyId, stage, method, page,
 *     browserFamily, releaseChannel, error class (string category —
 *     never the full message with variables).
 *   * Rate-limit to prevent a hostile client filling logs.
 *   * The endpoint returns 204 always — even if we dropped the event —
 *     so a client tag has no signal to derive whether we recorded it.
 *
 * The current implementation is a WRITE-ONLY receiver: it validates,
 * scrubs, and forwards to the server logger. A durable event store
 * (§D1 funnel dashboard) is a separate lane.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

const STAGE_VALUES = [
  'AUTH_PAGE_OPEN',
  'AUTH_METHOD_SELECTED',
  'FIREBASE_STARTED',
  'FIREBASE_POPUP_STARTED',
  'FIREBASE_POPUP_SUCCEEDED',
  'FIREBASE_POPUP_CANCELLED',
  'FIREBASE_POPUP_BLOCKED',
  'FIREBASE_REDIRECT_STARTED',
  'FIREBASE_REDIRECT_RETURNED',
  'FIREBASE_REDIRECT_RESULT_FOUND',
  'FIREBASE_REDIRECT_RESULT_MISSING',
  'FIREBASE_SUCCESS',
  'FIREBASE_FAILURE',
  'SESSION_EXCHANGE_START',
  'SESSION_EXCHANGE_SUCCESS',
  'SESSION_EXCHANGE_FAILURE',
  'BOOTSTRAP_SUCCESS',
  'BOOTSTRAP_FAILURE',
  'POST_LOGIN_SUCCESS',
  'POST_LOGIN_FAILURE',
  'NAVIGATION_SUCCESS',
] as const;

const METHOD_VALUES = ['google', 'apple', 'phone', 'email', 'passkey'] as const;

const traceEventSchema = z.object({
  journeyId: z.string().regex(/^[0-9a-f]{16}$/, 'journeyId must be 16-hex opaque'),
  stage: z.enum(STAGE_VALUES),
  method: z.enum(METHOD_VALUES).optional(),
  page: z.string().max(120).optional(),
  errorClass: z.string().max(80).optional(),
  browserFamily: z.enum(['chrome', 'safari', 'firefox', 'edge', 'other']).optional(),
  releaseChannel: z.string().max(40).optional(),
});

/**
 * Keys the endpoint categorically REFUSES to log. If any of these
 * appear anywhere in the payload, the event is silently dropped
 * (returned 204, never persisted). This is the CEO §D4 "no secret
 * telemetry" guardrail.
 */
const FORBIDDEN_KEY_RE = /pass|token|otp|id_number|bank|cvv|secret|credential|refresh|bearer|email|phone|mobile/i;

function containsForbiddenKey(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_KEY_RE.test(k)) return true;
  }
  return false;
}

router.post('/trace-event', (req: Request, res: Response) => {
  // Always ack 204 — hostile probes see the same response as valid
  // events. Silently drop anything malformed or forbidden. §D4.
  try {
    const body = req.body;
    if (containsForbiddenKey(body)) {
      res.status(204).end();
      return;
    }
    const parsed = traceEventSchema.safeParse(body);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }
    const evt = parsed.data;
    // Safe metadata only — logger scrubs PII already but we only
    // hand it the fields Zod accepted.
    logger.info('[AuthTrace]', {
      journeyId: evt.journeyId,
      stage: evt.stage,
      method: evt.method,
      page: evt.page,
      errorClass: evt.errorClass,
      browserFamily: evt.browserFamily,
      releaseChannel: evt.releaseChannel,
      at: Date.now(),
    });
    res.status(204).end();
  } catch {
    // Never surface a 5xx here — client MUST NOT retry or panic
    // on telemetry failure.
    res.status(204).end();
  }
});

export default router;
