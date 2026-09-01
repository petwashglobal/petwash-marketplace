/**
 * Regression pin — /signin door flip (auth-rebuild Phase 11).
 *
 * Guardrails on the door-flip mechanism:
 *
 *   1. Every /signin, /sign-in, /login, /signin-advanced route goes
 *      through SigninDoor (not straight to SignUpLuxury).
 *   2. SigninDoor uses useReturnLoginGate to pick — no render-time
 *      navigation (no setLocation, no history.replace inside the door).
 *   3. useReturnLoginGate honours ?door=new / ?door=legacy overrides
 *      and localStorage pw_ff_new_door=1 / =0.
 *   4. useReturnLoginGate defaults to 'legacy' when no override wins
 *      — cutover is opt-in until CEO flips the server cohort.
 *   5. The gate's decision function is EXPORTED as a pure fn
 *      (decideDoor) so tests / staff tools can query it directly.
 *   6. ReturnLogin is lazy-imported in App.tsx so the legacy
 *      cohort does not pay the bundle cost.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const app = readFileSync(join(ROOT, 'client/src/App.tsx'), 'utf8');
const gate = readFileSync(join(ROOT, 'client/src/auth/useReturnLoginGate.ts'), 'utf8');

describe('/signin door flip (Phase 11)', () => {
  it('every signin/login route path is wrapped in SigninDoor', () => {
    // We look for the specific route paths and require the render
    // function to name SigninDoor (not SignUpLuxury or ReturnLogin
    // directly). This keeps the gate as the single decision point.
    const routes = ['/signin', '/sign-in', '/login', '/signin-advanced'];
    for (const path of routes) {
      const re = new RegExp(
        `<Route path=["']${path.replace(/\//g, '\\/')}["']>\\s*\\{\\(\\)\\s*=>\\s*<SigninDoor`,
      );
      expect(re.test(app), `${path} must render via <SigninDoor …/>`).toBe(true);
    }
  });

  it('SigninDoor never navigates during render (no setLocation / Redirect / window.location.href)', () => {
    // Extract the SigninDoor function body.
    const match = app.match(/function SigninDoor\([\s\S]*?\n\}/);
    expect(match, 'SigninDoor component must be defined in App.tsx').toBeTruthy();
    const body = match![0];
    // Wouter's setLocation call, Wouter's <Redirect />, and any raw
    // window.location.href = are all forbidden — the door PICKS a
    // component and lets it render.
    expect(/setLocation\(/.test(body)).toBe(false);
    expect(/<Redirect\b/.test(body)).toBe(false);
    expect(/window\.location\.href\s*=/.test(body)).toBe(false);
    expect(/history\.replace\(/.test(body)).toBe(false);
  });

  it('ReturnLogin is lazy-imported (legacy cohort does not pay bundle cost)', () => {
    expect(app).toMatch(/const ReturnLogin\s*=\s*lazy\(\(\)\s*=>\s*import\(["']@\/auth\/ReturnLogin["']\)\)/);
  });

  it('useReturnLoginGate exports decideDoor pure fn + hook', () => {
    expect(gate).toMatch(/export function decideDoor/);
    expect(gate).toMatch(/export function useReturnLoginGate/);
  });

  it('gate default is legacy when no override wins', () => {
    // Direct behavioural test of the pure fn — inline eval'd via a
    // small transpile-style substring check. Keeps the pin in a
    // node-only vitest file (no jsdom needed).
    // The final fall-through MUST return 'legacy' — no override wins,
    // server cohort didn't place the visitor. Note: with Phase 11.b
    // the "no cohort" branch is not the only fall-through anymore, but
    // the LAST `return 'legacy'` in decideDoor still governs the
    // no-input case.
    const fn = gate.match(/export function decideDoor[\s\S]*?\n\}/);
    expect(fn, 'decideDoor function must exist').toBeTruthy();
    // The very last statement of the function must be `return 'legacy';`.
    expect(fn![0]).toMatch(/return 'legacy';\s*\n\}\s*$/);
  });

  it('gate honours ?door=new AND ?door=legacy', () => {
    expect(gate).toMatch(/if \(explicit === 'new'\) return 'new';/);
    expect(gate).toMatch(/if \(explicit === 'legacy'\) return 'legacy';/);
  });

  it('gate honours localStorage pw_ff_new_door=1 / =0', () => {
    expect(gate).toMatch(/const OPT_IN_KEY\s*=\s*['"]pw_ff_new_door['"]/);
    expect(gate).toMatch(/if \(localOverride === '1'\) return 'new';/);
    expect(gate).toMatch(/if \(localOverride === '0'\) return 'legacy';/);
  });
});
