/**
 * Issue #153 Mission F (PR-EMAIL-3) — monitoring + internal alerts migration pin.
 *
 * Asserts that monitoring/alerts internal email sends have been migrated
 * from direct `sgMail.send(...)` to the guarded helper, and that no
 * future change can silently re-introduce a direct send in these files.
 *
 * Scope of this PR (only):
 *   - server/monitoring.ts          (2 sites — system alerts + Nayax daily report)
 *   - server/services/alerts.ts     (1 site — security alerts)
 *   - server/lib/alerts.ts          (1 site — AlertManager ops alerts)
 *
 * Service tags chosen for EmailSpendGuard attribution (kebab-case,
 * stable across releases, prefixed by source domain):
 *   - monitoring:system-alert            (generic monitoring alert)
 *   - monitoring:nayax-daily-report      (daily report — email transport
 *                                         only; Nayax integration runtime
 *                                         NOT changed by this PR)
 *   - internal:security-alert            (security incident notifications)
 *   - internal:ops-alert                 (AlertManager alert path)
 *
 * Out of scope (NOT migrated in this PR — separate batches per the plan):
 *   - KYC2026/KYCSecurityAlerts.ts, services/SmsAbuseDetector.ts  (PR-EMAIL-4)
 *   - routes/provider-onboarding.ts                               (PR-EMAIL-5)
 *   - routes/wallet.ts, routes/ceo-wallet.ts, israeliTaxReport.ts (PR-EMAIL-6)
 *   - routes/booking-chat.ts, routes/send-thank-you.ts,
 *     lib/email-privacy.ts                                        (PR-EMAIL-7)
 *   - email/luxury-email-service.ts (already pairs check + record)
 *   - lib/notificationDispatcher.ts and the GoogleMessagingService /
 *     gcsBackupService specialty paths (evaluated per-case)
 *   - PR-EMAIL-CI detector workflow (lands LAST)
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const MON = fs.readFileSync(path.resolve(__dirname, '..', 'monitoring.ts'), 'utf8');
const SVC_ALERTS = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'alerts.ts'),
  'utf8',
);
const LIB_ALERTS = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'alerts.ts'),
  'utf8',
);

describe('PR-EMAIL-3 — monitoring.ts migration', () => {
  it('imports sendGuardedEmail from the canonical helper', () => {
    expect(MON).toMatch(
      /import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\/lib\/guarded-sendgrid['"]/,
    );
  });

  it('contains NO direct sgMail.send( calls', () => {
    expect(MON).not.toMatch(/sgMail\.send\(/);
  });

  it('declares both monitoring service tags', () => {
    expect(MON).toMatch(/service:\s*['"]monitoring:system-alert['"]/);
    expect(MON).toMatch(/service:\s*['"]monitoring:nayax-daily-report['"]/);
  });

  it('preserves NAYAX REPORT log lines (no copy/template change)', () => {
    expect(MON).toMatch(/\[NAYAX REPORT\] Daily report sent successfully/);
  });

  it('logs blocked/failed paths instead of silently swallowing', () => {
    expect(MON).toMatch(/\[ALERT\] Email blocked or failed/);
    expect(MON).toMatch(/\[NAYAX REPORT\] Daily report email blocked or failed/);
  });
});

describe('PR-EMAIL-3 — services/alerts.ts migration', () => {
  it('imports sendGuardedEmail', () => {
    expect(SVC_ALERTS).toMatch(
      /import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\.\/lib\/guarded-sendgrid['"]/,
    );
  });

  it('contains NO direct sgMail.send( calls', () => {
    expect(SVC_ALERTS).not.toMatch(/sgMail\.send\(/);
  });

  it('uses internal:security-alert service tag', () => {
    expect(SVC_ALERTS).toMatch(/service:\s*['"]internal:security-alert['"]/);
  });

  it('preserves the success and failure log lines', () => {
    expect(SVC_ALERTS).toMatch(/\[Alerts\] Security alert sent/);
    expect(SVC_ALERTS).toMatch(/\[Alerts\] Security alert send blocked or failed/);
  });
});

describe('PR-EMAIL-3 — lib/alerts.ts migration', () => {
  it('imports sendGuardedEmail', () => {
    expect(LIB_ALERTS).toMatch(
      /import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\/guarded-sendgrid['"]/,
    );
  });

  it('contains NO direct sgMail.send( calls', () => {
    expect(LIB_ALERTS).not.toMatch(/sgMail\.send\(/);
  });

  it('uses internal:ops-alert service tag', () => {
    expect(LIB_ALERTS).toMatch(/service:\s*['"]internal:ops-alert['"]/);
  });

  it('preserves the existing success and failure log lines', () => {
    expect(LIB_ALERTS).toMatch(/Email alert sent/);
    expect(LIB_ALERTS).toMatch(/Email alert blocked or failed/);
  });
});
