/**
 * CEO FLY MODE II §19 (2026-08-29) — capability aggregator Prestige lookup
 * order.
 *
 * The aggregator MUST query by firebase_uid FIRST, then fall back to
 * verified email. Locks:
 *   - both queries exist in the Prestige branch;
 *   - the UID query appears BEFORE the email query;
 *   - the UID branch short-circuits on hit (early return);
 *   - the "no email" guard is INSIDE the fallback path (a UID hit
 *     doesn't require an email to succeed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'userCapabilities.ts'),
  'utf8',
);

describe('CEO FLY MODE II §19 — Prestige lookup: UID first, email second', () => {
  it('the Prestige branch queries BOTH firebase_uid and email', () => {
    // The Prestige aggregator arm lives inside the Promise.all() block.
    const prestigeIdx = SRC.indexOf('── PRESTIGE');
    const nextArmIdx = SRC.indexOf('── PROVIDER', prestigeIdx);
    expect(prestigeIdx).toBeGreaterThan(0);
    expect(nextArmIdx).toBeGreaterThan(prestigeIdx);
    const arm = SRC.slice(prestigeIdx, nextArmIdx);
    expect(arm).toMatch(/eq\(privilegeMembers\.firebaseUid, userId\)/);
    expect(arm).toMatch(/eq\(privilegeMembers\.email, email\)/);
  });

  it('UID query appears BEFORE email query (order matters)', () => {
    const prestigeIdx = SRC.indexOf('── PRESTIGE');
    const arm = SRC.slice(prestigeIdx, SRC.indexOf('── PROVIDER', prestigeIdx));
    const uidIdx = arm.indexOf('privilegeMembers.firebaseUid');
    const emailIdx = arm.indexOf('privilegeMembers.email');
    expect(uidIdx).toBeGreaterThan(0);
    expect(emailIdx).toBeGreaterThan(0);
    expect(uidIdx).toBeLessThan(emailIdx);
  });

  it('UID hit short-circuits — early return before the email fallback', () => {
    const prestigeIdx = SRC.indexOf('── PRESTIGE');
    const arm = SRC.slice(prestigeIdx, SRC.indexOf('── PROVIDER', prestigeIdx));
    // Between the UID enrolled-set and the email query, there must be
    // a `return;` — otherwise the email fallback overwrites a valid
    // UID hit.
    const setBlockEnd = arm.indexOf('memberId: byUid.memberId ?? null,');
    const emailQueryStart = arm.indexOf('privilegeMembers.email');
    expect(setBlockEnd).toBeGreaterThan(0);
    expect(emailQueryStart).toBeGreaterThan(setBlockEnd);
    const between = arm.slice(setBlockEnd, emailQueryStart);
    expect(between).toMatch(/return;/);
  });

  it('the "no email" guard sits INSIDE the fallback path, not at the top', () => {
    const prestigeIdx = SRC.indexOf('── PRESTIGE');
    const arm = SRC.slice(prestigeIdx, SRC.indexOf('── PROVIDER', prestigeIdx));
    const uidIdx = arm.indexOf('privilegeMembers.firebaseUid');
    const emailIdx = arm.indexOf('privilegeMembers.email');
    const guardIdx = arm.indexOf('if (!email) return');
    // Guard must be AFTER the UID query (so a UID-only caller still
    // resolves) and BEFORE the email query.
    expect(guardIdx).toBeGreaterThan(uidIdx);
    expect(guardIdx).toBeLessThan(emailIdx);
  });

  it('never derives Prestige entitlement from age or any other proxy signal', () => {
    // Regression guard: the pre-2026 bug read age off the DOB and
    // synthesized Prestige enrollment. §19 explicitly bans this.
    const prestigeIdx = SRC.indexOf('── PRESTIGE');
    const arm = SRC.slice(prestigeIdx, SRC.indexOf('── PROVIDER', prestigeIdx));
    // The pre-2026 bug read `.dob` off the users row and called
    // `getAgeInYears()` to derive enrollment. Neither pattern may
    // appear in this arm now.
    expect(arm).not.toMatch(/users\.dob/);
    expect(arm).not.toMatch(/getAgeInYears/);
    expect(arm).not.toMatch(/computeAge/);
    expect(arm).not.toMatch(/ageInYears/);
  });
});
