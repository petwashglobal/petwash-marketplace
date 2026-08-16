/**
 * Task 18 — CEO fire order 101-140 (PR-EMAIL-4).
 *
 * Migrates two direct sgMail.send callers off the raw path and onto
 * the guarded helper (sendGuardedEmail + EmailSpendGuard). This
 * closes two of the 13 bypasses pinned by Task 13's inventory.
 *
 * Files migrated:
 *   - server/services/SmsAbuseDetector.ts    (SMS abuse alert)
 *   - server/services/KYC2026/KYCSecurityAlerts.ts (KYC anomaly alert)
 *
 * NON-GOAL — no change to abuse-detection logic, KYC anomaly rules,
 * dedup windows, kill-switch behaviour, or alert recipient set. Only
 * the email TRANSPORT is swapped.
 *
 * MERGE-ORDER NOTE — Task 13's `sendgridInventory.regression.test.ts`
 * (PR #1795) pins the RAW allowlist to include these two files. If
 * that PR merges before this one, its allowlist entries for
 * SmsAbuseDetector.ts + KYC2026/KYCSecurityAlerts.ts should be
 * removed at rebase time.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('SmsAbuseDetector migrated to guarded helper', () => {
  const SRC = R('services/SmsAbuseDetector.ts');

  it('imports sendGuardedEmail from the canonical helper', () => {
    expect(SRC).toMatch(/import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\.\/lib\/guarded-sendgrid['"]/);
  });

  it('contains NO direct sgMail.send( calls', () => {
    expect(SRC).not.toMatch(/sgMail\.send\(/);
  });

  it('contains NO leftover sgMail import', () => {
    expect(SRC).not.toMatch(/import\s+sgMail\s+from/);
  });

  it('uses the internal:sms-abuse-alert service tag', () => {
    expect(SRC).toMatch(/service:\s*['"]internal:sms-abuse-alert['"]/);
  });

  it('logs blocked/failed path (does not silently swallow)', () => {
    expect(SRC).toContain('[SmsAbuse] Alert email blocked or failed');
    expect(SRC).toContain('[SmsAbuse] Alert email sent');
  });

  it('kill-switch and dedup logic untouched', () => {
    expect(SRC).toContain('sms_abuse:kill');
    expect(SRC).toContain('SMS_KILL_TTL_SECONDS');
    expect(SRC).toContain('EMERGENCY KILL SWITCH ACTIVATED');
  });
});

describe('KYC2026 SecurityAlerts migrated to guarded helper', () => {
  const SRC = R('services/KYC2026/KYCSecurityAlerts.ts');

  it('imports sendGuardedEmail from the canonical helper', () => {
    expect(SRC).toMatch(/import\s*\{\s*sendGuardedEmail\s*\}\s*from\s*['"]\.\.\/\.\.\/lib\/guarded-sendgrid['"]/);
  });

  it('contains NO direct sgMail.send( or getSendGridClient() calls', () => {
    expect(SRC).not.toMatch(/sgMail\.send\(/);
    expect(SRC).not.toMatch(/getSendGridClient\(\)/);
  });

  it('uses the internal:kyc-security-alert service tag', () => {
    expect(SRC).toMatch(/service:\s*['"]internal:kyc-security-alert['"]/);
  });

  it('logs blocked/failed path (does not silently swallow)', () => {
    expect(SRC).toContain('[KYC2026:Alert] Email blocked or failed');
    expect(SRC).toContain('[KYC2026:Alert] Email sent:');
  });

  it('KYC anomaly-alert dedup and severity gate untouched', () => {
    // recentAlerts map + DEDUP_WINDOW_MS still there
    expect(SRC).toContain('DEDUP_WINDOW_MS');
    expect(SRC).toContain('recentAlerts');
    // Severity gate: only critical + warning emit email
    expect(SRC).toMatch(/severity === 'critical' \|\| input\.severity === 'warning'/);
  });
});
