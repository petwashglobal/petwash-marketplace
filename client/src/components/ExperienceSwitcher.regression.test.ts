/**
 * The workspace switcher: what it routes to, and that it remembers the choice.
 *
 * Two defects found 2026-09-19, both in a control that has been live for a
 * while:
 *
 * 1. The Pet Parent tile routed to /prestige/home — contradicting its OWN
 *    docblock four lines above, which says Prestige is not a workspace but a
 *    membership badge inside the Pet Parent home. Lane A (#2190) made
 *    /pet-parent/home the one customer workspace and the post-login decider
 *    has sent people there since; only this tile still pushed them elsewhere.
 * 2. It never called POST /api/me/active-role. That endpoint has existed since
 *    the 2026-09-01 auth rebuild — capability-verified, audited, fixed
 *    allowlist — and NOTHING called it. The switcher was "pure navigation", so
 *    the workspace a person chose was forgotten at the end of the session.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, 'ExperienceSwitcher.tsx'), 'utf8');
/** Code with comments stripped — a pin must not pass on its own prose. */
const code = src.split('\n').filter((l) => {
  const t = l.trim();
  return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
}).join('\n');

describe('the Pet Parent tile opens the canonical customer workspace', () => {
  it('routes to /pet-parent/home', () => {
    expect(code).toMatch(/member:\s*\{\s*route:\s*'\/pet-parent\/home'/);
  });

  it('and NOT to the Prestige surface', () => {
    // Prestige is an entitlement rendered inside the workspace. A tile that
    // opens it is the split-universe regression Lane A closed.
    expect(code).not.toMatch(/member:\s*\{\s*route:\s*'\/prestige/);
  });
});

describe('the choice is remembered', () => {
  it('switching posts the role to /api/me/active-role', () => {
    expect(code).toMatch(/apiRequest\('POST',\s*'\/api\/me\/active-role'/);
  });

  it('it posts the ROLE name, not the dashboard name', () => {
    // The endpoint accepts customer|provider|staff|admin and 400s on anything
    // else; whoami calls the same dashboard 'member'. Posting the dashboard
    // name straight through would fail for the most common role.
    expect(code).toMatch(/DASHBOARDS\[workspace\]\.role/);
  });

  it('a failed save still navigates — the preference is not the gate', () => {
    // The destination is gated server-side by RoleProtectedRoute. Refusing to
    // move because a PREFERENCE did not save would be worse than not
    // remembering it.
    const fn = code.slice(code.indexOf('const switchTo'));
    const c = fn.indexOf('catch');
    const nav = fn.indexOf('navigate(route)');
    expect(c).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(c);
    expect(fn).toMatch(/finally\s*\{/);
  });
});

describe('it still hides itself when there is nothing to switch', () => {
  it('one workspace renders nothing', () => {
    expect(code).toMatch(/if \(tiles\.length <= 1\) return null/);
  });

  it('staff and admin collapse to one tile — they open the same screen', () => {
    expect(code).toMatch(/w === 'staff' && arr\.includes\('admin'\)/);
  });
});
