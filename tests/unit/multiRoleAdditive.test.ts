/**
 * PR-AUTH-MULTIROLE-5 regression pins — additive capabilities.
 *
 * The MASTER AUTH contract has one identity per human and additive
 * capabilities on top: customer/loyalty/provider/staff. Two shapes must
 * never come back, and this test pins their absence + the presence of
 * their replacements.
 *
 *   M6 — client-supplied `intent` (from a request body or a cookie
 *        seeded by a public endpoint) must not drive `users.role`. Intent
 *        is a routing signal; role is an authority. A signed-in body
 *        saying `intent=provider` cannot pass the account into a
 *        provider role assignment.
 *
 *   M8 — approving a provider / staff / loyalty capability must not
 *        replace the base customer identity. A user who was a customer
 *        + loyalty member and gets approved as a provider must remain a
 *        customer + loyalty + provider. The scalar `users.role` column
 *        is legacy — the additive truth lives in the per-capability
 *        tables read by server/lib/userCapabilities.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-AUTH-MULTIROLE-5 — M6: request-body intent never drives users.role', () => {
  const postLogin = read('server/routes/post-login.ts');

  it('postLoginDecider intent branch writes role="customer" — not intentToRole(safeIntent)', () => {
    // The signup-intent handler must NEVER translate the client-supplied
    // intent into a role write. Base account is customer; provider/staff
    // capabilities are additive and live in per-capability tables.
    // Pin the exact string so an accidental reintroduction of the old
    // `role: assignedRole` shape fails loudly.
    expect(postLogin).not.toMatch(/const assignedRole = intentToRole\(safeIntent\);/);
    // The safeIntent branch persists signupIntent for routing but writes
    // role: 'customer' explicitly:
    const safeIntentBranch = postLogin.match(
      /\} else if \(safeIntent\) \{[\s\S]*?userRole = 'customer';/,
    );
    expect(safeIntentBranch, 'safeIntent branch missing').toBeTruthy();
    expect(safeIntentBranch![0]).toMatch(/role: 'customer',/);
    expect(safeIntentBranch![0]).toMatch(/signupIntent: safeIntent,/);
    expect(safeIntentBranch![0]).not.toMatch(/role: assignedRole/);
    expect(safeIntentBranch![0]).not.toMatch(/role: intentToRole\(/);
  });

  it('chooseRole handler hard-codes role="customer" — intent no longer picks the role', () => {
    // The explicit /api/auth/choose-role handler is the OTHER intent-driven
    // sink. Same fix: intent is a routing signal, not a role assignment.
    const chooseRoleBody = postLogin.match(
      /export async function chooseRole\(req: Request, res: Response\) \{[\s\S]*?const assignedRole = 'customer';/,
    );
    expect(chooseRoleBody, 'chooseRole assignedRole line missing').toBeTruthy();
    // The bad shape must not reappear anywhere in the handler:
    const handler = postLogin.slice(
      postLogin.indexOf('export async function chooseRole'),
      postLogin.indexOf('\n}\n', postLogin.indexOf('export async function chooseRole')),
    );
    expect(handler).not.toMatch(/const assignedRole = intentToRole\(/);
    expect(handler).not.toMatch(/role: intentToRole\(/);
  });

  it('intentToRole helper is retired — the two callers are gone, only a comment marker remains', () => {
    // Callers gone: grep the file for the CALL shape, not the string
    // (the file keeps a comment marker with the helper name for grep
    // continuity across PRs).
    expect(postLogin).not.toMatch(/intentToRole\(safeIntent\)/);
    expect(postLogin).not.toMatch(/intentToRole\(intent\)/);
  });
});

describe('PR-AUTH-MULTIROLE-5 — M8: capability approvals do not replace users.role', () => {
  const prestigeJoin = read('server/routes/prestige-join.ts');
  const accessRequests = read('server/routes/access-requests.ts');

  it('prestige-join no longer writes role="loyalty" — enrollment is additive', () => {
    // Loyalty enrollment used to promote users.role='loyalty' from
    // customer/public — that overwrote the base customer identity and
    // silently downgraded the account's other capabilities. The
    // membership of record lives in loyalty_profiles + privilege_members;
    // the users row keeps its isClubMember/loyaltyTier/loyaltyPoints
    // updates only.
    expect(prestigeJoin).not.toMatch(/role: 'loyalty'/);
    expect(prestigeJoin).not.toMatch(/rolePatch/);
    expect(prestigeJoin).not.toMatch(/promotableRoles/);
    // Additive fields still written:
    expect(prestigeJoin).toMatch(/isClubMember: true,/);
    expect(prestigeJoin).toMatch(/loyaltyTier: 'bronze'/);
  });

  it('access-requests staff approval no longer writes role="staff" — capability is additive', () => {
    // Staff approval used to promote users.role='staff', clobbering
    // customer/loyalty/provider. Staff capability now derives from
    // staff_access_requests.status='approved' (still written above the
    // updateUser call). The staff-side settings that are genuinely per-
    // account (accessLevel/approvedBy/staffApprovedAt/mfaRequired) stay.
    const approveBlock = accessRequests.match(
      /await storage\.updateUser\(updated\.userId, \{[\s\S]*?\} as any\);/,
    );
    expect(approveBlock, 'staff approval updateUser call missing').toBeTruthy();
    expect(approveBlock![0]).not.toMatch(/role: 'staff'/);
    expect(approveBlock![0]).toMatch(/accessLevel: 4,/);
    expect(approveBlock![0]).toMatch(/staffApprovedAt: now,/);
    expect(approveBlock![0]).toMatch(/mfaRequired: true,/);
  });
});

describe('PR-AUTH-MULTIROLE-5 — capabilities aggregator is the additive authority', () => {
  const caps = read('server/lib/userCapabilities.ts');

  it('exports computeCapabilities returning the five-capability shape', () => {
    expect(caps).toMatch(/export async function computeCapabilities\(userId: string\): Promise<UserCapabilities>/);
    expect(caps).toMatch(/customer: boolean;/);
    expect(caps).toMatch(/loyalty: boolean;/);
    expect(caps).toMatch(/provider: boolean;/);
    expect(caps).toMatch(/staff: boolean;/);
    expect(caps).toMatch(/admin: boolean;/);
  });

  it('base customer capability is ALWAYS true (never conditional)', () => {
    // Regression: the base account identity is customer by definition.
    // A future refactor that flips this to a derived boolean would let
    // provider/staff-only accounts exist, which is the shape the CEO
    // explicitly ruled out.
    expect(caps).toMatch(/customer: true,/);
  });

  it('reads from per-capability tables — NOT from users.role', () => {
    // The whole point of the aggregator is to bypass the legacy scalar.
    // If a future edit sneaks a `users.role` read into this helper, the
    // capability lookup would drift back toward the M8 replacement bug.
    expect(caps).toMatch(/\.from\(providerApplications\)/);
    expect(caps).toMatch(/\.from\(staffAccessRequests\)/);
    expect(caps).toMatch(/\.from\(loyaltyProfiles\)/);
    expect(caps).toMatch(/\.from\(adminUsers\)/);
    // No direct users.role read (the docstring mentions the string as part
    // of the anti-pattern explanation, so we ban only the code accessor
    // shapes: a select projection like `role: users.role` or a where clause
    // like `users.role,`).
    expect(caps).not.toMatch(/role: users\.role/);
    expect(caps).not.toMatch(/users\.role,\s*[a-zA-Z]/);
  });

  it('fails closed: on any per-source query error the capability drops to false', () => {
    // A Postgres blip must not silently grant a capability. Every
    // per-capability lookup runs inside try/catch and logs a warning;
    // the default booleans (false) survive.
    const catches = caps.match(/\} catch \(e: any\) \{\s*logger\.warn\('\[Capabilities\][^']+'/g);
    expect(catches, 'per-capability catch blocks missing').toBeTruthy();
    expect(catches!.length).toBeGreaterThanOrEqual(4); // loyalty + provider + staff + admin
  });

  it('admin capability comes from adminUsers row OR SUPER_ADMIN_EMAILS allowlist — never a body field', () => {
    expect(caps).toMatch(/isSuperAdminEmail\(email\)/);
    expect(caps).toMatch(/SUPER_ADMIN_EMAILS/);
    expect(caps).toMatch(/adminUsers\.email/);
  });
});
