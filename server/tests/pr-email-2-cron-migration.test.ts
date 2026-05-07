/**
 * Issue #153 Mission F (PR-EMAIL-2) — cron migration regression pin.
 *
 * Asserts that the safest internal cron call sites have been migrated
 * from direct `sgMail.send(...)` to the guarded helper, and that no
 * future change can silently re-introduce a direct send in these files.
 *
 * Scope of this PR (only):
 *   - server/jobs/daily-close-reminder.ts  (4 sites)
 *   - server/jobs/exception-email.ts       (1 site)
 *
 * Service tags chosen for EmailSpendGuard attribution:
 *   - cron:daily-close-reminder
 *   - cron:daily-close-alert-digest
 *   - cron:daily-close-critical-escalation
 *   - cron:weekly-finance-exec-digest
 *   - cron:exception-email
 *
 * Out of scope (NOT migrated in this PR — separate batches):
 *   - monitoring.ts, services/alerts.ts, lib/alerts.ts            (PR-EMAIL-3)
 *   - KYC2026/KYCSecurityAlerts.ts, services/SmsAbuseDetector.ts  (PR-EMAIL-4)
 *   - routes/provider-onboarding.ts                               (PR-EMAIL-5)
 *   - routes/wallet.ts, routes/ceo-wallet.ts, israeliTaxReport.ts (PR-EMAIL-6)
 *   - routes/booking-chat.ts, routes/send-thank-you.ts,
 *     lib/email-privacy.ts                                        (PR-EMAIL-7)
 *   - email/luxury-email-service.ts                               (already
 *     pairs check + record correctly per earlier audit)
 *   - lib/notificationDispatcher.ts                               (separate
 *     dispatch path, evaluate after customer-facing migration)
 *   - services/gcsBackupService.ts, services/GoogleMessagingService.ts
 *     (specialty paths, evaluate per-case)
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const DAILY = fs.readFileSync(
  path.resolve(__dirname, '..', 'jobs', 'daily-close-reminder.ts'),
  'utf8',
);
const EXC = fs.readFileSync(
  path.resolve(__dirname, '..', 'jobs', 'exception-email.ts'),
  'utf8',
);

describe('PR-EMAIL-2 cron migration — daily-close-reminder.ts', () => {
  it('imports sendGuardedEmail from the canonical helper', () => {
    expect(DAILY).toMatch(
      /import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\.\/lib\/guarded-sendgrid['"]/,
    );
  });

  it('contains NO direct sgMail.send( calls', () => {
    // The literal call form sgMail.send( must not appear; sgMail.setApiKey
    // is fine and intentionally preserved.
    expect(DAILY).not.toMatch(/sgMail\.send\(/);
  });

  it('declares a stable cron: service tag for every migrated send', () => {
    for (const tag of [
      'cron:daily-close-reminder',
      'cron:daily-close-alert-digest',
      'cron:daily-close-critical-escalation',
      'cron:weekly-finance-exec-digest',
    ]) {
      expect(DAILY).toMatch(new RegExp(`service:\\s*['"]${tag}['"]`));
    }
  });

  it('preserves the existing fire-and-log failure behaviour for the weekly digest', () => {
    // The previous code chained .catch on sgMail.send and warned on failure.
    // After migration the same warn fires when sendGuardedEmail returns ok:false.
    expect(DAILY).toMatch(/\[ExecDigest\] Email send failed/);
  });
});

describe('PR-EMAIL-2 cron migration — exception-email.ts', () => {
  it('imports sendGuardedEmail from the canonical helper', () => {
    expect(EXC).toMatch(
      /import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\.\/lib\/guarded-sendgrid['"]/,
    );
  });

  it('contains NO direct sgMail.send( calls', () => {
    expect(EXC).not.toMatch(/sgMail\.send\(/);
  });

  it('uses cron:exception-email as the service tag', () => {
    expect(EXC).toMatch(/service:\s*['"]cron:exception-email['"]/);
  });

  it('still logs a successful send AND a blocked/failed send (does not silently swallow)', () => {
    expect(EXC).toMatch(/\[ExceptionEmail\] Sent successfully/);
    expect(EXC).toMatch(/\[ExceptionEmail\] Send blocked or failed/);
  });
});
