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

/* ────────────────────────────────────────────────────────────────────────────
 * clientSafeErrorMessage — AGENT-14 privacy lane (2026-09-05).
 *
 * `sanitizeErrorResponse` above is the right tool when a handler can afford a
 * fully generic body. Many customer-facing handlers cannot: they deliberately
 * surface short domain messages ("Voucher is EXPIRED", "Address already
 * exists") that the UI renders, and blanking those makes the product useless.
 *
 * Those same handlers are `catch (err: any) { res.json({ error: err.message })}`
 * — so the SAME line that renders a useful domain message will happily render
 * a Postgres "duplicate key value violates unique constraint users_email_key
 * DETAIL: Key (email)=(a@b.com) already exists", a Firebase stack frame, or a
 * verbatim provider payload.
 *
 * This helper keeps the useful half and drops the dangerous half by SHAPE, not
 * by call site, so there is exactly ONE policy to review:
 *
 *   • an error explicitly marked `expose`/`clientSafe` is trusted verbatim
 *   • otherwise the message must look like an authored sentence: short, single
 *     line, no email, no long digit run, no SQL / driver / stack / infra / secret
 *     marker
 *   • anything else collapses to the caller's own fallback string
 *
 * It NEVER throws and it never logs — the caller keeps its existing
 * server-side logging, which is where the full detail must still go.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Max length an authored, user-facing error sentence is allowed to be. */
const CLIENT_SAFE_MAX_LEN = 160;

/**
 * Substrings that mean "this text came from a database, a driver, a runtime
 * stack, an infrastructure layer or a secret store" — never from a product
 * copywriter. Matched case-insensitively against the whole message.
 */
const INTERNAL_MARKERS: readonly string[] = [
  // SQL / ORM / driver
  'select ', 'insert into', 'update set', 'delete from', 'relation "',
  'column "', 'constraint', 'duplicate key', 'violates', 'syntax error at',
  'sqlstate', 'pg_', 'postgres', 'neon', 'drizzle', 'query:', 'detail: key',
  // network / infra
  'econnrefused', 'econnreset', 'etimedout', 'enotfound', 'ehostunreach',
  'socket hang up', 'getaddrinfo', 'http://', 'https://', 'localhost',
  '127.0.0.1', 'cloud run', 'firestore', 'firebase-admin',
  // runtime / stack / filesystem
  'node_modules', '.ts:', '.js:', '/server/', '/home/', '/usr/', 'c:\\',
  'typeerror', 'referenceerror', 'syntaxerror', 'rangeerror',
  'is not a function', 'cannot read propert', 'is not defined',
  'undefined is not', 'null is not',
  // secrets / credentials / env
  'process.env', 'api key', 'apikey', 'api_key', 'secret', 'private key',
  'credential', 'bearer ', 'authorization', 'service account',
  // raw payload dumps
  '{"', '"}', '[object ',
];

/** A stack frame ("at Foo.bar (…)") even when it survived on one line. */
const STACK_FRAME_RE = /\bat\s+[\w$.<>]+\s*\(/;
/** Any email address anywhere in the text. */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/** 7+ consecutive digits — phone, national ID, PAN, account number. */
const LONG_DIGIT_RUN_RE = /\d{7,}/;
/** A JWT / Firebase ID token that leaked into the message text. */
const JWT_RE = /eyJ[A-Za-z0-9_-]{6,}/;

/**
 * Return `err`'s message ONLY when it looks like an authored, user-facing
 * sentence; otherwise return `fallback`.
 *
 * @param err       the caught value (anything — never trusted)
 * @param fallback  the generic message to show the client instead
 */
export function clientSafeErrorMessage(err: unknown, fallback: string): string {
  try {
    if (!err || typeof err !== 'object') return fallback;

    const anyErr = err as Record<string, unknown>;

    // Explicit opt-in: the thrower asserted this text is written for a user.
    const explicitlySafe = anyErr.expose === true || anyErr.clientSafe === true;

    const raw = anyErr.message;
    if (typeof raw !== 'string') return fallback;
    const msg = raw.trim();
    if (!msg) return fallback;

    if (explicitlySafe) return msg.length > CLIENT_SAFE_MAX_LEN ? fallback : msg;

    if (msg.length > CLIENT_SAFE_MAX_LEN) return fallback;
    if (/[\r\n]/.test(msg)) return fallback;
    if (EMAIL_RE.test(msg)) return fallback;
    if (LONG_DIGIT_RUN_RE.test(msg)) return fallback;
    if (STACK_FRAME_RE.test(msg)) return fallback;
    if (JWT_RE.test(msg)) return fallback;

    const lower = msg.toLowerCase();
    for (const marker of INTERNAL_MARKERS) {
      if (lower.includes(marker)) return fallback;
    }

    return msg;
  } catch {
    return fallback;
  }
}
