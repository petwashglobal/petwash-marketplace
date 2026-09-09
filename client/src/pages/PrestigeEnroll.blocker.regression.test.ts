/**
 * PrestigeEnroll — the disabled "Join Prestige" button must say why.
 *
 * Live QA 2026-09-09: an account with a verified email but no mobile saw
 * "Mobile —" and a grey Join button with no explanation. canSubmit requires
 * a phone (bay redemption needs it), so the page now states the blocker and
 * links to the place that fixes it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'PrestigeEnroll.tsx'), 'utf8');

describe('PrestigeEnroll — blocker explanation', () => {
  it('still gates submission on a phone number', () => {
    expect(SRC).toMatch(/const canSubmit = consent && !!firstName && !!lastName && !!email && !!phone;/);
  });

  it('renders a blocker panel when the mobile is missing', () => {
    expect(SRC).toContain('data-testid="prestige-enroll-blocker"');
    expect(SRC).toMatch(/const missingMobile = !phone;/);
    expect(SRC).toContain('Prestige needs a verified mobile number');
  });

  it('links the member to mobile verification, not to a dead end', () => {
    expect(SRC).toMatch(/<Link href="\/activate-account"[^>]*data-testid="prestige-enroll-verify-mobile"/);
    expect(SRC).toMatch(/import \{ Link, Redirect, useLocation \} from 'wouter';/);
  });

  it('explains a missing name and points at My Account', () => {
    expect(SRC).toMatch(/const missingName = !firstName \|\| !lastName;/);
    expect(SRC).toMatch(/<Link href="\/my-account"[^>]*data-testid="prestige-enroll-add-name"/);
  });
});
