/**
 * Guarded SendGrid send helper — single canonical entry point.
 *
 * Issue #153 Mission F (PR-EMAIL-1): foundation only. No call-site
 * migrations in this PR.
 *
 * What this exists to fix:
 *   - 33+ direct `sgMail.send(...)` call sites in this repo bypass the
 *     EmailSpendGuard circuit breaker (server/services/EmailSpendGuard.ts).
 *   - A bug or compromise that triggers a tight email loop today can
 *     burn through SendGrid budget without any pre-send / per-recipient
 *     governance.
 *
 * What this helper does:
 *   1. Calls `emailSpendGuard.check(service, recipient)` BEFORE the send.
 *      If the hourly (80) or daily (500) circuit is open the call is
 *      rejected and the helper returns { ok:false, reason:'circuit_open' }.
 *      No SendGrid API call is made.
 *   2. Calls `sgMail.send(msg)`.
 *   3. On success, calls `emailSpendGuard.record(service, recipient, subject)`
 *      which advances the counters and may fire warn/block alarms.
 *   4. On send failure, logs a structured error WITHOUT the API key,
 *      WITHOUT the full message body, and WITHOUT raw recipient PII
 *      (uses EmailSpendGuard's existing `recipientMasked` semantics by
 *      delegating recipient handling to the guard, but for the error
 *      log we only emit the recipient domain plus a code).
 *      Counters are NOT advanced on failure.
 *
 * Migration path (NOT in this PR):
 *   - PR-EMAIL-2..N: replace each direct `sgMail.send(...)` site with
 *     `sendGuardedEmail({ service, msg })`. Smallest-risk batches first
 *     (cron jobs, alerts, monitoring) before customer-facing sends.
 *   - PR-EMAIL-LAST: add CI detector that fails if a NEW `sgMail.send(`
 *     pattern appears outside this file or an explicit allowlist.
 *
 * SAFETY: this helper is purely additive. Existing call sites are
 * unchanged. There is no behaviour change to any production code path
 * until a future PR migrates a specific site to this helper.
 */

import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import { emailSpendGuard } from '../services/EmailSpendGuard';
import { logger } from './logger';

export type GuardedSendResult =
  | { ok: true; service: string }
  | { ok: false; reason: 'circuit_open'; detail: string; service: string }
  | { ok: false; reason: 'send_failed'; service: string; detail?: string };

/**
 * SendGrid's OWN validation strings from a failed send, for the log and the
 * caller — e.g. "from.email: The from email does not contain a valid address".
 * These name the malformed field; they never contain the API key or a
 * recipient. Anything that looks like a key is still redacted defensively.
 * Empty when the error carries no SendGrid body (network error, mock).
 */
export function sendGridErrorDetail(err: unknown): string {
  const body = (err as { response?: { body?: { errors?: unknown } } })?.response?.body;
  const errors = Array.isArray(body?.errors) ? body!.errors : [];
  const parts: string[] = [];
  for (const e of errors as Array<{ message?: unknown; field?: unknown }>) {
    const msg = typeof e?.message === 'string' ? e.message : '';
    if (!msg) continue;
    const field = typeof e?.field === 'string' && e.field ? `${e.field}: ` : '';
    parts.push(`${field}${msg}`);
  }
  return parts.join(' | ').replace(/SG\.[A-Za-z0-9_.-]+/g, 'SG.[redacted]').slice(0, 300);
}

export interface GuardedSendParams {
  /**
   * Short service tag used by EmailSpendGuard for per-service attribution
   * in counters and alarm emails. Examples: 'booking-confirmation',
   * 'provider-onboarding', 'wallet-withdrawal', 'monitoring-alert',
   * 'cron:daily-close'. Keep it kebab-case and stable across releases —
   * dashboards group by this value.
   */
  service: string;
  /**
   * The same message object that would be passed to `sgMail.send()`.
   * Recipient address (`to`) is required and must be a single string or
   * an object with `email`. Bulk sends with multiple personalizations
   * are not supported by this helper today — those should still go
   * through their own (already-guarded) campaign path.
   */
  msg: MailDataRequired;
}

/**
 * Single canonical entry point for all transactional email sends.
 *
 * Returns a discriminated union — callers can decide how to react to
 * `circuit_open` (typically: log + skip, do not retry) versus
 * `send_failed` (typically: log + bubble up to the caller's retry policy).
 */
export async function sendGuardedEmail(
  params: GuardedSendParams,
): Promise<GuardedSendResult> {
  const { service, msg } = params;
  const recipient = extractRecipient(msg);
  const subject = typeof msg.subject === 'string' ? msg.subject : '';

  // 1. Pre-send circuit-breaker check.
  const decision = emailSpendGuard.check(service, recipient);
  if (!decision.allowed) {
    logger.warn('[guarded-sendgrid] send rejected by circuit breaker', {
      service,
      reason: decision.reason,
      recipientDomain: recipientDomain(recipient),
    });
    return {
      ok: false,
      reason: 'circuit_open',
      detail: decision.reason ?? 'circuit_open',
      service,
    };
  }

  // 2. Actual SendGrid call. Counters are NOT advanced unless this resolves.
  try {
    await sgMail.send(msg);
  } catch (err: unknown) {
    // Defensive logging: never leak API key, message body, or full recipient.
    const errorCode = (err as { code?: number | string })?.code;
    const errorName = (err as { name?: string })?.name;
    // 2026-09-19: the SendGrid validation strings (field + message) are the
    // one thing that turns "400" into a cause. They are not headers and not
    // the body of the mail; keys are still redacted defensively.
    const detail = sendGridErrorDetail(err);
    logger.error('[guarded-sendgrid] sgMail.send failed', {
      service,
      recipientDomain: recipientDomain(recipient),
      errorCode,
      errorName,
      ...(detail ? { sendgridErrors: detail } : {}),
      // Intentionally do NOT include err.response headers or err.message — they
      // can echo the API key on auth failures.
    });
    return detail
      ? { ok: false, reason: 'send_failed', service, detail }
      : { ok: false, reason: 'send_failed', service };
  }

  // 3. Post-send guard accounting.
  await emailSpendGuard.record(service, recipient, subject);
  return { ok: true, service };
}

/**
 * Extract a single recipient address from a SendGrid msg.
 *
 * SendGrid's `to` field can be a string, an EmailData object, or an
 * array of either. We collapse to the first concrete address for guard
 * attribution. This helper does NOT support bulk sends; if you need
 * multi-personalization sends, route them through their own already-
 * guarded path.
 */
function extractRecipient(msg: MailDataRequired): string {
  const to = msg.to as unknown;
  if (typeof to === 'string') return to;
  if (Array.isArray(to)) {
    const first = to[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'email' in first) {
      return String((first as { email: string }).email);
    }
  }
  if (to && typeof to === 'object' && 'email' in to) {
    return String((to as { email: string }).email);
  }
  return '';
}

/**
 * Return only the domain portion of an email address for safe logging.
 * `alice@example.com` → `example.com`. Returns `'unknown'` if the input
 * is not a recognisable email address.
 */
function recipientDomain(recipient: string): string {
  if (!recipient || typeof recipient !== 'string') return 'unknown';
  const at = recipient.lastIndexOf('@');
  if (at < 0 || at === recipient.length - 1) return 'unknown';
  return recipient.slice(at + 1).toLowerCase();
}
