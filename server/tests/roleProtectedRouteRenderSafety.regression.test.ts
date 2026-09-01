/**
 * Client route-guard regression pin — RoleProtectedRoute must NEVER
 * call setLocation() during render. All navigation goes through the
 * wouter <Redirect/> component or a useEffect (Phase 8 fix, CEO D3 §7
 * "no render-time navigation side effects").
 *
 * Previous version at client/src/auth/RoleProtectedRoute.tsx called
 * `setLocation('/signin')` and `setLocation(fallbackPath)` directly in
 * render — React warns about that pattern, and two guards on one page
 * could chain redirects (documented as architecture-audit defect D7).
 *
 * This pin runs as a source-anchored fs check so a regression trips CI
 * without needing to boot the React tree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'auth', 'RoleProtectedRoute.tsx'),
  'utf8',
);

describe('RoleProtectedRoute · render-time navigation regression pin', () => {
  it('imports <Redirect> from wouter (used for navigation)', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*Redirect[^}]*\}\s*from\s*['"]wouter['"]/);
  });

  it('never calls setLocation(...) outside a useEffect', () => {
    // Remove useEffect blocks and comments, then any surviving setLocation
    // call is a render-time nav — the bug we are pinning against.
    let stripped = SRC.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    stripped = stripped.replace(/useEffect\s*\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);?/g, '');
    expect(stripped).not.toMatch(/\bsetLocation\s*\(/);
  });

  it('navigation goes through <Redirect to=…/>', () => {
    expect(SRC).toMatch(/<Redirect\s+to=/);
  });

  it('preserves the intended destination via the canonical ?returnTo= key', () => {
    // Deep-link restoration is a CEO D6 requirement. Guards that redirect
    // to /signin MUST carry the original location as ?returnTo=…
    expect(SRC).toMatch(/returnTo=/);
    expect(SRC).toMatch(/encodeURIComponent\(location\)/);
  });

  it('whoami retry runs inside useEffect (not during render)', () => {
    // Previous version called `refetch()` in the render body when
    // whoamiError && user. That fires on every re-render and is a common
    // infinite-refetch trap. Pin it inside useEffect.
    const stripped = SRC.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Every refetch() call must live inside the useEffect block.
    const useEffectMatches = stripped.match(/useEffect\s*\(([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*\);?/g) ?? [];
    const useEffectBody = useEffectMatches.join('\n');
    const outsideUseEffect = stripped.replace(/useEffect\s*\([\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\);?/g, '');
    expect(useEffectBody).toMatch(/refetch\(\)/);
    expect(outsideUseEffect).not.toMatch(/\brefetch\(\)/);
  });
});
