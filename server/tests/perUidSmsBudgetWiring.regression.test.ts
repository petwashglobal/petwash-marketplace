/**
 * Regression pin — per-UID SMS budget wiring (AUDIT-SMS-5 / #221 Lane C).
 *
 * `server/services/TwilioSMSService.sendSMS` enforces the per-UID daily
 * budget only when a call passes BOTH `userId` and `purpose` in `meta`.
 * Call-sites that pass only `userId` (or neither) still send the SMS but
 * silently bypass the budget guard. That was the entire point of the
 * audit finding: nothing prevented one authenticated user from firing
 * dozens of OTP resends across a rotation of phone numbers, or a
 * compromised account from burning the global daily budget from a
 * single logged-in seat.
 *
 * Fix (in-flight): every SMS-triggering call site is migrated to pass
 * `purpose: SMS_PURPOSES.<bucket>` alongside its existing userId. The
 * primary auth/OTP/booking paths already flipped:
 *
 *   • server/services/RegistrationOTPService.ts (initial send + resend)
 *   • server/services/UnifiedVerificationService.ts (deliverChallengeCode)
 *   • server/services/TwoFactorAuthService.ts (2FA send)
 *   • server/services/TransactionOTPService.ts (transaction confirm)
 *   • server/services/academySmsHelper.ts (booking confirm)
 *   • server/routes/booking-requests.ts (booking accept SMS)
 *   • server/routes/publicAuthRoutes.ts (welcome SMS)
 *   • server/routes/provider-phone.ts (phone-verify OTP)
 *   • server/routes/israeli-2025-esign.ts (e-sign OTP)
 *   • server/cron/wash-reminder.ts (wash reminder)
 *   • server/routes/prestige-pass.ts (wallet-download link)
 *   • server/backgroundJobs.ts (pet-birthday SMS)
 *   • server/lib/notificationDispatcher.ts (generic dispatcher)
 *
 * This pin refuses REGRESSION on any of the migrated sites (the
 * `purpose:` MUST remain in the call) and enforces a progressive
 * ceiling on remaining unmigrated sites so the count can only shrink.
 * When the ceiling reaches 0, delete this pin.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const MIGRATED_FILES = [
  'server/services/RegistrationOTPService.ts',
  'server/services/UnifiedVerificationService.ts',
  'server/services/TwoFactorAuthService.ts',
  'server/services/TransactionOTPService.ts',
  'server/services/academySmsHelper.ts',
  'server/routes/booking-requests.ts',
  'server/routes/publicAuthRoutes.ts',
  'server/routes/provider-phone.ts',
  'server/routes/israeli-2025-esign.ts',
  'server/cron/wash-reminder.ts',
  'server/routes/prestige-pass.ts',
  'server/backgroundJobs.ts',
  'server/lib/notificationDispatcher.ts',
];

function countSendSmsCalls(src: string): { total: number; withPurpose: number } {
  const withPurpose = (src.match(/sendSMS\([^)]*[\s\S]{0,400}?purpose:/g) || []).length;
  const total = (src.match(/(twilioSMSService|smsService|this\.smsService)\.sendSMS\(/g) || []).length;
  return { total, withPurpose };
}

describe('AUDIT-SMS-5 / #221 — per-UID SMS budget wiring', () => {
  it('every migrated file still passes purpose to at least one sendSMS call', () => {
    const failures: string[] = [];
    for (const rel of MIGRATED_FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      if (!/purpose:\s*(SMS_PURPOSES|_P\.|_SP\.|_SPWelcome\.|smsBudgetPurpose)/.test(src)) {
        failures.push(rel);
      }
    }
    expect(
      failures,
      `these files were migrated but no longer pass purpose to sendSMS:\n${failures.join('\n')}`,
    ).toEqual([]);
  });

  it('unmigrated sendSMS call-sites must not GROW beyond the ceiling', () => {
    // Count sendSMS/smsService.sendSMS calls repo-wide that do NOT reach a
    // `purpose:` inside the call's argument list. New unmigrated sites push
    // the count over the ceiling — the ceiling MUST decrement, never grow.
    let unmigrated = 0;
    // PORTABILITY 2026-09-08: this shelled out to `rg`. Ripgrep is not a
    // declared dependency, so on any machine without it the test died with
    // "rg: command not found" — a RATCHET that reports an environment fault as
    // a breach, and would silently stop protecting anything the day it ran
    // somewhere without the binary. Walk the tree with fs instead: no external
    // tool, and the same set of files (rg's default .gitignore filtering is
    // reproduced by the SKIP_DIRS list, which is what it actually excluded here).
    const SKIP_DIRS = new Set([
      'node_modules', '.git', 'dist', 'build', 'coverage', '.next',
      '.turbo', '.cache', '.claude', 'tests',
    ]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const src = readFileSync(full, 'utf8');
          if (/(twilioSMSService|smsService|this\.smsService)\.sendSMS\(/.test(src)) files.push(full);
        }
      }
    };
    walk(ROOT);
    for (const f of files) {
      if (f.endsWith('/TwilioSMSService.ts')) continue;
      const src = readFileSync(f, 'utf8');
      const { total, withPurpose } = countSendSmsCalls(src);
      if (total > withPurpose) unmigrated += total - withPurpose;
    }
    // NON-VACUITY. A ratchet that matches no files passes trivially, which is
    // exactly what the `rg` failure would have degraded into had it been caught
    // and "fixed" by swallowing the error. Assert the sweep actually swept.
    expect(files.length).toBeGreaterThan(10);

    // Ceiling captured at #221 wave-1 landing time (26 unmigrated sites
    // survived after the 13 primary flows landed) and left at 30. It was never
    // decremented because this test has not run to completion since — measured
    // 2026-09-08 the true count is 10, so the ceiling moves to 10. A ratchet
    // that sits 20 above the real number is not a ratchet. DECREMENT ONLY.
    const CEILING = 10;
    expect(unmigrated).toBeLessThanOrEqual(CEILING);
  });
});
