/**
 * Regression pin — TwilioSMSService.sendSMS honours the per-UID budget.
 *
 * AUDIT-SMS-5 (#221, CEO Lane C slice 1). Wiring pin: any refactor
 * that removes the budget check from the sendSMS entry point breaks
 * this file loudly, forcing the reviewer to think about UID caps
 * before accepting the change.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const twilio = readFileSync(join(ROOT, 'server/services/TwilioSMSService.ts'), 'utf8');

describe('#221 TwilioSMSService.sendSMS enforces per-UID budget', () => {
  it('imports checkAndBumpUidSmsBudget from the shared helper', () => {
    expect(twilio).toMatch(
      /import\s*\{\s*checkAndBumpUidSmsBudget\s*\}\s*from\s*['"]\.\.\/lib\/perUidSmsBudget['"]/,
    );
  });

  it('sendSMS meta accepts purpose + uidDailyLimit', () => {
    // The signature is the contract: without meta.purpose the wiring
    // cannot fire, so the type must invite callers to pass one.
    expect(twilio).toMatch(/meta\?:\s*\{[^}]*\bpurpose\?\s*:\s*string[^}]*\}/);
    expect(twilio).toMatch(/meta\?:\s*\{[^}]*\buidDailyLimit\?\s*:\s*number[^}]*\}/);
  });

  it('sendSMS body calls checkAndBumpUidSmsBudget under (userId && purpose)', () => {
    // Anchor to the sendSMS method by locating the signature, then look at
    // the body window.
    const idx = twilio.indexOf('async sendSMS(');
    expect(idx).toBeGreaterThan(0);
    const window = twilio.slice(idx, idx + 3000);
    expect(window).toMatch(/if\s*\(\s*meta\?\.userId\s*&&\s*meta\?\.purpose\s*\)/);
    expect(window).toMatch(/checkAndBumpUidSmsBudget\(\s*meta\.userId\s*,\s*\{/);
    expect(window).toMatch(/budget\.allowed/);
  });

  it('sendSMS refuses when the budget denies (either BUDGET_EXCEEDED or _UNAVAILABLE)', () => {
    const idx = twilio.indexOf('async sendSMS(');
    const window = twilio.slice(idx, idx + 3000);
    expect(window).toMatch(/if\s*\(\s*!budget\.allowed\s*\)/);
    expect(window).toMatch(/BUDGET_EXCEEDED/);
  });
});
