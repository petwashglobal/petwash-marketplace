/**
 * Task 13 — CEO fire order 101-140 (item 119).
 *
 * SENDGRID INVENTORY. This test freezes the current set of files that
 * transport email through SendGrid, so any new dispatch site is
 * detected instantly.
 *
 * Two lanes:
 *
 * A. GUARDED lane — files that go through sendGuardedEmail() (the
 *    EmailSpendGuard + circuit-breaker helper). Preferred for all new
 *    dispatches.
 *
 * B. RAW lane — files that still call sgMail.send() directly. Locked
 *    to the known set below. Any addition must go through this test
 *    (so it is at minimum reviewed and can be justified case-by-case),
 *    and the migration path for each is tracked in
 *    pr-email-3-monitoring-alerts.test.ts's "Out of scope" comment.
 *
 * NON-GOAL — this pin does NOT change any email content, template,
 * sender, recipient, or delivery path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(__dirname, '..');

function grepFilesRelToRoot(pattern: string, ext = '**/*.ts'): string[] {
  // Use ripgrep for speed & consistency with the human dev experience.
  // Fallback: shell grep -rlE.
  try {
    const out = execSync(
      `grep -rlE ${JSON.stringify(pattern)} ${ROOT}/ --include="*.ts"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.includes('/tests/') && !l.endsWith('.test.ts') && !l.endsWith('.spec.ts'))
      .map(l => l.replace(ROOT + '/', ''))
      .sort();
  } catch {
    return [];
  }
}

/**
 * B. RAW lane — the KNOWN set of files that call sgMail.send() directly.
 *
 * Add a file here ONLY after a code review that justifies bypassing
 * the guarded helper. Prefer migration to sendGuardedEmail().
 */
const RAW_SEND_ALLOWLIST = [
  // The helper itself is where sgMail.send() is expected to be called.
  'lib/guarded-sendgrid.ts',
  // Spend-guard bookkeeping module (single indirection).
  'services/EmailSpendGuard.ts',
  // Historic direct callers — migration tracked in
  // pr-email-3-monitoring-alerts.test.ts "Out of scope" comment.
  'email/luxury-email-service.ts',
  'israeliTaxReport.ts',
  'lib/notificationDispatcher.ts',
  'routes/booking-chat.ts',
  'routes/ceo-wallet.ts',
  'routes/provider-onboarding.ts',
  'routes/wallet.ts',
  'services/GoogleMessagingService.ts',
  'services/KYC2026/KYCSecurityAlerts.ts',
  'services/SmsAbuseDetector.ts',
  'services/gcsBackupService.ts',
].sort();

describe('SendGrid inventory — direct sgMail.send callers are locked to a known set', () => {
  it('the actual set of raw sgMail.send() callers has not drifted', () => {
    const actual = grepFilesRelToRoot('sgMail\\.send\\(');
    expect(actual).toEqual(RAW_SEND_ALLOWLIST);
  });
});

/**
 * A. GUARDED lane — the KNOWN set of files that use createMailService()
 * (typically as part of the guarded flow, or paired with EmailSpendGuard
 * check/record calls in email/luxury-email-service.ts).
 *
 * These files ARE allowed to send email but must go through the
 * conventional helper factories.
 */
const CREATE_MAILSERVICE_ALLOWLIST = [
  'email/luxury-email-service.ts',
  'email/new-login-alert.ts',
  'emailService.ts',
  'lib/sendgrid.ts',
  'services/BookingConfirmationEmailService.ts',
  'services/ComplianceControlTower.ts',
  'services/IsraeliDigitalReceiptService.ts',
  'services/NotificationRetryService.ts',
  'services/PetWashNotificationEngine.ts',
  'services/ProviderIntakeService.ts',
  'services/egiftEmailService.ts',
].sort();

describe('SendGrid inventory — createMailService callers are locked to a known set', () => {
  it('the actual set of createMailService() callers has not drifted', () => {
    const actual = grepFilesRelToRoot('createMailService\\b');
    expect(actual).toEqual(CREATE_MAILSERVICE_ALLOWLIST);
  });
});

describe('SendGrid transport surface — canonical helpers are intact', () => {
  it('lib/sendgrid.ts still exports createMailService', () => {
    const src = readFileSync(resolve(ROOT, 'lib/sendgrid.ts'), 'utf8');
    expect(src).toMatch(/export\s+(function|const|async function)\s+createMailService\b/);
  });

  it('lib/guarded-sendgrid.ts still exports sendGuardedEmail', () => {
    const src = readFileSync(resolve(ROOT, 'lib/guarded-sendgrid.ts'), 'utf8');
    expect(src).toMatch(/export\s+(async\s+)?(function|const)\s+sendGuardedEmail\b/);
  });

  it('EmailSpendGuard still exposes check / record entrypoints', () => {
    const src = readFileSync(
      resolve(ROOT, 'services/EmailSpendGuard.ts'),
      'utf8',
    );
    expect(src).toMatch(/EmailSpendGuard/);
    expect(src).toMatch(/\brecord\b/);
    expect(src).toMatch(/Call\s+BEFORE\s+every\s+sgMail\.send\(\)\s+call/);
  });
});
