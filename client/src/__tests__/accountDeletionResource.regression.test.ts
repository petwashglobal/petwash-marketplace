import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('public account deletion resource', () => {
  it('mounts a public account deletion URL outside auth-only routes', () => {
    const app = read('client/src/App.tsx');
    const routeIndex = app.indexOf('path="/account-deletion"');
    const authIndex = app.indexOf('<RequireAuth');

    expect(app).toContain('AccountDeletionResource');
    expect(routeIndex).toBeGreaterThan(-1);
    expect(authIndex).toBeGreaterThan(-1);
    expect(routeIndex).toBeGreaterThan(authIndex);
    expect(app.slice(routeIndex - 120, routeIndex + 120)).not.toContain('RequireAuth');
  });

  it('publishes Play/App Store deletion instructions without exposing auth tokens', () => {
    const page = read('client/src/pages/AccountDeletionResource.tsx');

    expect(page).toContain('Delete your PetWash account');
    expect(page).toContain('Support@PetWash.co.il');
    expect(page).toContain('/my-account');
    expect(page).toContain('Sign in with Apple');
    expect(page).toContain('Apple token revocation');
    expect(page).toContain('30-day cooling-off');
    expect(page).toContain('90 days');
    expect(page).not.toContain('refreshToken');
    expect(page).not.toContain('accessToken');
  });
});
