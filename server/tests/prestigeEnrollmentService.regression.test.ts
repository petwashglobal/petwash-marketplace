/**
 * PrestigeEnrollmentService — canonical authority pin.
 *
 * CEO DEEP-LOGIC §49-§57. The enrollment logic must live in ONE
 * function that both the HTTP route and the Action Brain handler
 * call. These source-anchored pins prevent the two paths from
 * drifting again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SVC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'marketplace', 'PrestigeEnrollmentService.ts'),
  'utf8',
);
const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'prestige-join.ts'),
  'utf8',
);

describe('CEO §50 — one authority, called by both surfaces', () => {
  it('service exports enrollPrestige(actorUid, input)', () => {
    expect(SVC).toMatch(
      /export async function enrollPrestige\(\s*actorUid: string,\s*input: PrestigeEnrollmentInput,\s*\): Promise<PrestigeEnrollmentResult>/,
    );
  });

  it('the HTTP route delegates to the service — no inline loyalty_profiles / privilege_members writes', () => {
    expect(ROUTE).toMatch(
      /import \{ enrollPrestige \} from '\.\.\/services\/marketplace\/PrestigeEnrollmentService'/,
    );
    expect(ROUTE).toMatch(/const result = await enrollPrestige\(userId, parsed\.data\)/);
    // Old inline steps must be gone from the HTTP shell.
    expect(ROUTE).not.toMatch(/db\.insert\(loyaltyProfiles\)/);
    expect(ROUTE).not.toMatch(/INSERT INTO privilege_members/);
  });
});

describe('CEO §51 — enrollment uses the AUTHENTICATED actorUid, never mints a new identity', () => {
  it('the HTTP handler reads uid from req.firebaseUser, never from req.body', () => {
    const idx = ROUTE.indexOf("router.post('/join'");
    const end = ROUTE.indexOf('});', idx);
    const body = ROUTE.slice(idx, end);
    expect(body).toMatch(/const userId = \(req as any\)\.firebaseUser\?\.uid/);
    // req.body only supplies enrollment fields (name / email / phone /
    // tier / language). Uid never comes from there.
    expect(body).not.toMatch(/parsed\.data\.userId/);
    expect(body).not.toMatch(/req\.body\.uid/);
  });
});

describe('CEO §56 — idempotent ALREADY_ACTIVE', () => {
  it("existing loyalty_profiles row → status: 'ALREADY_ACTIVE'", () => {
    expect(SVC).toMatch(
      /alreadyEnrolled\s*\?\s*'ALREADY_ACTIVE'\s*:\s*'ENROLLED'/,
    );
  });

  it('welcome points NOT re-granted on ALREADY_ACTIVE', () => {
    // The users-row sync only bumps loyalty_points when
    // !alreadyEnrolled.
    expect(SVC).toMatch(
      /\.\.\.\(alreadyEnrolled \? \{\} : \{ loyaltyPoints: sql`\$\{users\.loyaltyPoints\} \+ \$\{WELCOME_POINTS\}` \}\)/,
    );
  });
});

describe('CEO §59 — Provider / admin capabilities preserved (claims are MERGED)', () => {
  it('setCustomUserClaims spreads existingClaims first, then preserves accountType + role', () => {
    expect(SVC).toMatch(
      /\.\.\.existingClaims,[\s\S]{0,200}accountType: preservedAccountType,[\s\S]{0,80}role: preservedRole,/,
    );
    // A blind write of `accountType: 'pet_parent'` without the spread
    // would erase Provider / admin — banned.
    const claimsIdx = SVC.indexOf('setCustomUserClaims');
    const end = SVC.indexOf('}\n', claimsIdx);
    expect(SVC.slice(claimsIdx, end)).not.toMatch(
      /setCustomUserClaims\(actorUid, \{\s*accountType:/,
    );
  });
});

describe('CEO §57 — explicit failure states, no silent defaults', () => {
  it.each([
    'MISSING_REQUIRED_PROFILE',
    'IDENTITY_CONFLICT',
    'LOYALTY_STORE_FAILED',
    'PRIVILEGE_STORE_FAILED',
  ])('%s appears in the PrestigeEnrollmentFailure union', (state) => {
    expect(SVC).toMatch(new RegExp(`status: '${state}'`));
  });

  it('the HTTP route maps each failure to a stable HTTP status', () => {
    expect(ROUTE).toMatch(/MISSING_REQUIRED_PROFILE[\s\S]{0,120}status\(400\)/);
    expect(ROUTE).toMatch(/IDENTITY_CONFLICT[\s\S]{0,120}status\(409\)/);
    expect(ROUTE).toMatch(/LOYALTY_STORE_FAILED[\s\S]{0,200}PRESTIGE_JOIN_LOYALTY_FAILED/);
    expect(ROUTE).toMatch(/PRIVILEGE_STORE_FAILED[\s\S]{0,200}PRESTIGE_JOIN_FAILED/);
  });
});

describe('service is pure of req/res + PII logging', () => {
  it('does not import express types', () => {
    expect(SVC).not.toMatch(/from ['"]express['"]/);
  });

  it('logs uid only as the last-6 tail (§58 privacy)', () => {
    // Every error / warn line uses actorUid.slice(-6), never the full uid.
    const logs = SVC.match(/logger\.(info|warn|error)\([\s\S]{0,300}?\)/g) ?? [];
    for (const line of logs) {
      if (/actorUid/.test(line)) {
        expect(line).toMatch(/actorUid\.slice\(-6\)/);
      }
    }
  });
});
