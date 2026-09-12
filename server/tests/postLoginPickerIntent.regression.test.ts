/**
 * Post-login /mode picker vs stored signupIntent (2026-09-12).
 *
 * An approved provider who had signed up through /become-provider carried
 * signupIntent='provider' forever; post-login used that stored hint as the
 * SESSION routing intent, so every login went straight to /provider-os and
 * the /mode picker (every approved provider is also a Pet Parent — CEO
 * role-mode model 2026-08-26) never showed. Now the stored hint only steers
 * routing while the application is NOT approved; an explicit per-session
 * `intent` still wins.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'routes', 'post-login.ts'), 'utf8');

describe('post-login picker intent', () => {
  it('drops the stored signupIntent once the provider application is approved', () => {
    expect(src).toContain("const providerApproved = providerApp?.status === 'approved';");
    expect(src).toContain("const storedIntent = providerApproved ? null : ((u as any)?.signupIntent || null);");
    expect(src).toContain("const routingIntent = (typeof intent === 'string' && intent) || storedIntent;");
    expect(src).not.toContain("(typeof intent === 'string' && intent) || (u as any)?.signupIntent || null");
  });
  it('an approved provider with no session intent still lands on the /mode picker', () => {
    expect(src).toContain("return { nextUrl: '/mode', reason: 'MULTI_ROLE_PICK', profileStatus: 'approved', role, userStatus };");
  });
});
