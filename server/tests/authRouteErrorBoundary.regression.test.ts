/**
 * Post-release 2026-09-03 (backlog P1): AuthRouteErrorBoundary is wired
 * at the /signin, /sign-in, /login, /signin-advanced, and /signup
 * routes so a lazy chunk 404 never white-screens the auth surface.
 * Source-anchored regression pin.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('AuthRouteErrorBoundary — component + wire', () => {
  it('component file exists with the render-time contract', () => {
    const src = read('client/src/components/AuthRouteErrorBoundary.tsx');
    // Boundary class + brand fallback + reload action
    expect(src).toMatch(/class AuthRouteErrorBoundary extends Component/);
    expect(src).toMatch(/getDerivedStateFromError/);
    expect(src).toMatch(/componentDidCatch/);
    expect(src).toMatch(/window\.location\.replace/);
    // Never crashes when reporting — try/catch around the beacon path
    expect(src).toMatch(/navigator\.sendBeacon\('\/api\/errors\/log'/);
    // Data-testid for the smoke to detect fallback render
    expect(src).toMatch(/data-testid="auth-route-error-boundary"/);
  });

  it('detects the stale-chunk shapes and hints at reload', () => {
    const src = read('client/src/components/AuthRouteErrorBoundary.tsx');
    expect(src).toMatch(/Loading chunk\|ChunkLoadError\|Failed to fetch dynamically imported\|reading 'default'/);
  });

  it('App.tsx wraps every /signin, /login, /signup route with the boundary', () => {
    const src = read('client/src/App.tsx');
    // Import present
    expect(src).toMatch(
      /import\s+\{\s*AuthRouteErrorBoundary\s*\}\s+from\s+['"]@\/components\/AuthRouteErrorBoundary['"]/,
    );
    // Every auth surface uses the boundary
    for (const surface of ['signin', 'signup', 'signin-advanced']) {
      const rx = new RegExp(
        `<AuthRouteErrorBoundary\\s+surface="${surface.replace('-', '-')}"`,
      );
      expect(src).toMatch(rx);
    }
    // The boundary wraps ALL three signin aliases (/signin, /sign-in, /login)
    // — three separate <AuthRouteErrorBoundary surface="signin"> instances.
    const signinInstances = (
      src.match(/<AuthRouteErrorBoundary\s+surface="signin">/g) || []
    ).length;
    expect(signinInstances).toBeGreaterThanOrEqual(3);
  });
});
