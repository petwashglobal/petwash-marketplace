/**
 * Regression pin — client/src/pages/AccountSecurity.tsx contract.
 *
 * The one page that lets a user manage their linked providers and
 * signed-in devices. Pins the invariants that make it safe:
 *
 *   1. Uses the canonical stepUp helper (never rolls its own reauth).
 *   2. Never stores the step-up proof — proof lives in a local const
 *      inside the handler, sent inline on X-StepUp-Proof header, then
 *      goes out of scope.
 *   3. Destructive endpoints (unlink, revoke-all) MUST include the
 *      X-StepUp-Proof header on their fetch.
 *   4. LAST_LINK check happens BEFORE the reauth prompt — a user
 *      can't be asked to re-auth just to hit a 409.
 *   5. Route mounted at /account/security, protected by <RequireAuth>.
 *   6. data-testid attributes exist for the Playwright cycle test.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const page = readFileSync(join(ROOT, 'client/src/pages/AccountSecurity.tsx'), 'utf8');
const app = readFileSync(join(ROOT, 'client/src/App.tsx'), 'utf8');

describe('AccountSecurity page contract', () => {
  it('uses the canonical stepUp helper (never rolls its own reauth)', () => {
    expect(page).toMatch(/from ['"]@\/auth\/stepUp['"]/);
    expect(page).toMatch(/requestStepUpProofWithPassword/);
    expect(page).toMatch(/requestStepUpProofWithPasskey/);
    // Must NOT reach into Firebase reauth directly — that path lives
    // inside stepUp.ts and is under its own pin.
    expect(/from ['"]firebase\/auth['"]/.test(page)).toBe(false);
    expect(/reauthenticateWithCredential\(/.test(page)).toBe(false);
  });

  it('never stores the step-up proof', () => {
    expect(/localStorage\.setItem\([^)]*proof/.test(page)).toBe(false);
    expect(/sessionStorage\.setItem\([^)]*proof/.test(page)).toBe(false);
    // Also no top-level module state for the proof.
    expect(/^let\s+.*proof/m.test(page)).toBe(false);
  });

  it('unlink includes X-StepUp-Proof on the fetch', () => {
    const unlinkBody = page.match(/async function handleUnlinkProvider[\s\S]*?\n {2}\}/);
    expect(unlinkBody, 'handleUnlinkProvider must exist').toBeTruthy();
    expect(unlinkBody![0]).toMatch(/['"]\/api\/identity\/link\/unlink['"]/);
    expect(unlinkBody![0]).toMatch(/['"]X-StepUp-Proof['"]\s*:\s*proof/);
  });

  it('revoke-all includes X-StepUp-Proof on the fetch', () => {
    const revokeAllBody = page.match(/async function handleRevokeAll[\s\S]*?\n {2}\}/);
    expect(revokeAllBody, 'handleRevokeAll must exist').toBeTruthy();
    expect(revokeAllBody![0]).toMatch(/['"]\/api\/me\/sessions\/revoke-all['"]/);
    expect(revokeAllBody![0]).toMatch(/['"]X-StepUp-Proof['"]\s*:\s*proof/);
  });

  it('LAST_LINK guard runs BEFORE the reauth prompt', () => {
    // The `if ((links ?? []).length <= 1)` check must appear BEFORE
    // the `obtainProof(...)` call in handleUnlinkProvider.
    const unlinkBody = page.match(/async function handleUnlinkProvider[\s\S]*?\n {2}\}/);
    expect(unlinkBody).toBeTruthy();
    const src = unlinkBody![0];
    const guardIdx = src.indexOf('length <= 1');
    const proofIdx = src.indexOf('obtainProof(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(proofIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(proofIdx);
  });

  it('single-device revoke is NOT step-up gated (unchanged from Phase 9)', () => {
    // handleRevokeSession only hits /api/me/sessions/:rowId/revoke
    // — this MUST NOT need step-up (matches server contract).
    const revokeBody = page.match(/async function handleRevokeSession[\s\S]*?\n {2}\}/);
    expect(revokeBody).toBeTruthy();
    expect(revokeBody![0].includes('obtainProof(')).toBe(false);
    expect(revokeBody![0].includes('X-StepUp-Proof')).toBe(false);
  });

  it('route is mounted at /account/security behind RequireAuth', () => {
    // The Route block wraps AccountSecurity in <RequireAuth>.
    expect(app).toMatch(
      /<Route path=["']\/account\/security["']>[\s\S]*?<RequireAuth>[\s\S]*?<AccountSecurity[\s\S]*?<\/RequireAuth>/,
    );
    // Lazy import.
    expect(app).toMatch(/const AccountSecurity\s*=\s*lazy\(\(\)\s*=>\s*import\(["']@\/pages\/AccountSecurity["']\)\)/);
  });

  it('exposes data-testid hooks for the Playwright cycle test', () => {
    const needed = [
      'account-security-page',
      'linked-providers-list',
      'active-sessions-list',
      'button-sessions-revoke-all',
    ];
    for (const id of needed) {
      expect(page.includes(`data-testid="${id}"`), `missing data-testid ${id}`).toBe(true);
    }
  });
});
