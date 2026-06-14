/**
 * Email silent-blackout visibility.
 *
 * Before this fix, a missing/malformed SENDGRID_API_KEY let the app boot fine
 * while every send did `return true` and sent nothing — a silent production
 * blackout (no booking confirmations, receipts, or gift cards). Worse, the
 * spend-guard alarm is itself an email, so during a blackout the alarm could
 * not reach anyone (circular blind spot).
 *
 * This fix makes failure LOUD without changing money/auth logic:
 *   1. sendgrid.ts logs a CRITICAL error at boot if email is disabled in prod.
 *   2. EmailService.send() in production reports once (critical audit) and
 *      returns FALSE — a dropped email is a failure, not a silent success.
 *   3. EmailSpendGuard.fireAlarm emits a non-email signal (logger + audit)
 *      BEFORE the email callback, so alarms survive an email outage.
 *
 * Source-introspection tests so the guards can't silently regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const sendgridSrc = fs.readFileSync(path.join(SERVER, 'lib', 'sendgrid.ts'), 'utf8');
const emailSrc = fs.readFileSync(path.join(SERVER, 'emailService.ts'), 'utf8');
const guardSrc = fs.readFileSync(path.join(SERVER, 'services', 'EmailSpendGuard.ts'), 'utf8');

describe('sendgrid.ts — loud production guard', () => {
  it('emits a CRITICAL boot error when email is disabled in production', () => {
    expect(sendgridSrc).toMatch(/!initialized && process\.env\.NODE_ENV === 'production'/);
    expect(sendgridSrc).toMatch(/EMAIL DISABLED IN PRODUCTION/);
  });
});

describe('EmailService.send() — no silent success in production', () => {
  // Slice the send() body so we only inspect that path.
  const start = emailSrc.indexOf('static async send(');
  const slice = emailSrc.slice(start, start + 2200);

  it('reports a critical audit event the first time a prod send is dropped', () => {
    expect(slice).toMatch(/process\.env\.NODE_ENV === 'production'/);
    expect(slice).toContain('EMAIL_DISABLED_IN_PRODUCTION');
    expect(slice).toContain('prodBlackoutReported');
  });

  it('returns FALSE in production when SendGrid is not configured (not a fake success)', () => {
    // Within the not-configured branch, the production path must return false.
    const branchStart = slice.indexOf('if (!isSendGridConfigured())');
    const branch = slice.slice(branchStart, branchStart + 1300);
    expect(branch).toMatch(/PRODUCTION EMAIL BLACKOUT/);
    expect(branch).toMatch(/return false;/);
    // ...and the dev path keeps the no-op convenience (return true).
    expect(branch).toMatch(/return true;/);
  });
});

describe('EmailSpendGuard.fireAlarm — non-email alarm channel first', () => {
  const start = guardSrc.indexOf('private async fireAlarm(');
  const slice = guardSrc.slice(start, start + 1200);

  it('logs + audits the alarm BEFORE the email callback (survives an email outage)', () => {
    const auditIdx = slice.indexOf('EMAIL_SPEND_GUARD_ALARM');
    const callbackIdx = slice.indexOf('if (!this.alarmCallback) return;');
    expect(auditIdx).toBeGreaterThan(-1);
    expect(callbackIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeLessThan(callbackIdx);
  });

  it('marks circuit-open as critical severity', () => {
    expect(slice).toMatch(/isCircuitOpen \? 'critical' : 'warning'/);
  });
});
