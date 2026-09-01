/**
 * sanitizeErrorResponse — AUDIT-LOG-6 (2026-09-01).
 *
 * The pattern `res.status(500).json({ error: error.message })` was
 * repeated across 241 endpoints. Every one of those lines was a
 * potential PII / infrastructure leak: Postgres emits messages like
 * "duplicate key value violates unique constraint 'users_email_key'
 *  DETAIL: Key (email)=(user@x.com) already exists", Firebase Admin
 * emits stack traces that name env vars, and third-party SDKs
 * sometimes echo the request body verbatim.
 *
 * This module gives callers ONE canonical response shape they can
 * migrate to, without needing to think about what's safe:
 *
 *   const safe = sanitizeErrorResponse(err, 'CREATE_BOOKING');
 *   res.status(safe.status).json(safe.body);
 *
 * The RESPONSE body is a fixed generic message + a stable error code
 * the client can render. The LOG line separately captures the
 * unredacted meta for debugging — but the log path goes through the
 * existing ServerLogger redactor (LOG-STRATEGIC), so downstream
 * exporters still get the sanitised view.
 *
 * PROGRESSIVE ROLLOUT — do NOT try to migrate 241 sites at once.
 * server/tests/errorResponseLeak.regression.test.ts holds a ceiling
 * that must only decrement. A new endpoint that adopts this helper
 * lowers the count; a new endpoint that raw-echoes error.message
 * fails the pin.
 */
import type { Response } from 'express';
import { logger } from './logger';

export interface SafeErrorPayload {
  status: number;
  body: {
    error: string;
    code: string;
    /** Optional correlation id the caller can quote to support. */
    ref?: string;
  };
}

const GENERIC_MESSAGE = 'The server could not complete the request.';

/**
 * Turn an arbitrary thrown value into a safe HTTP response body.
 * ALWAYS returns something — never throws. Log the underlying error
 * with structured metadata OUTSIDE this function; do not pass raw
 * error text to the client.
 */
export function sanitizeErrorResponse(
  err: unknown,
  code: string,
  options: { status?: number; ref?: string } = {},
): SafeErrorPayload {
  const status = options.status ?? statusFrom(err) ?? 500;
  return {
    status,
    body: {
      error: GENERIC_MESSAGE,
      code,
      ...(options.ref ? { ref: options.ref } : {}),
    },
  };
}

/**
 * Convenience: sanitize + send + structured log in one call. Use
 * this when the handler has nothing custom to add to the response.
 */
export function sendSanitizedError(
  res: Response,
  err: unknown,
  code: string,
  options: { status?: number; ref?: string; logContext?: Record<string, unknown> } = {},
): void {
  const safe = sanitizeErrorResponse(err, code, options);
  // Log with structured meta — logger's redactor scrubs PII patterns.
  logger.error(`[${code}]`, {
    ...(options.logContext ?? {}),
    // Message is truncated defensively; the redactor drops
    // patterns the logger recognises as PII / secrets.
    errMessage:
      typeof (err as any)?.message === 'string'
        ? (err as any).message.slice(0, 200)
        : undefined,
    errCode: (err as any)?.code,
  });
  res.status(safe.status).json(safe.body);
}

/**
 * Best-effort status inference from thrown objects. Callers that
 * throw `Object.assign(new Error(...), { status: 409 })` get their
 * status preserved; everyone else lands on 500 via the ?? in
 * `sanitizeErrorResponse`.
 */
function statusFrom(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const s = (err as any).status ?? (err as any).statusCode;
  if (typeof s === 'number' && s >= 400 && s < 600) return s;
  return undefined;
}
