import { describe, it, expect, beforeEach } from 'vitest';

// The suite runs in the 'node' environment, so there is no window. Give the
// module the same minimal storage a browser would, to exercise the real logic
// rather than the storage-unavailable fallback.
const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    clear: () => store.clear(),
  },
};
import {
  surfaceForPath,
  readLastSurface,
  writeLastSurface,
  recordSurfaceForPath,
  intentFromLastSurface,
} from '../lib/lastSurface';

/**
 * CEO, 2026-09-19: "when i log in it take me to admin always".
 *
 * server/routes/post-login.ts routes a super_admin by `intent` and falls back
 * to /admin/dashboard when there is none. An ordinary sign-in never sent one,
 * so the CEO landed on the admin dashboard every time — including right after
 * a session spent in the member or provider view.
 */
describe('login lands you where you were last', () => {
  beforeEach(() => { store.clear(); });

  it.each([
    ['/admin/dashboard', 'admin'],
    ['/admin/crm', 'admin'],
    ['/provider-os', 'provider'],
    ['/provider/pending', 'provider'],
    ['/pet-parent/home', 'customer'],
    ['/my-bookings', 'customer'],
  ])('%s belongs to the %s surface', (path, expected) => {
    expect(surfaceForPath(path)).toBe(expected);
  });

  it.each(['/', '/contact', '/locations', '/apply'])('%s belongs to no surface', (path) => {
    expect(surfaceForPath(path)).toBeNull();
  });

  it('a public page never overwrites the remembered surface', () => {
    writeLastSurface('customer');
    recordSurfaceForPath('/contact');
    expect(readLastSurface()).toBe('customer');
  });

  it('the member view is remembered and becomes the next login intent', () => {
    recordSurfaceForPath('/pet-parent/home');
    expect(intentFromLastSurface()).toBe('customer');
  });

  it('admin is remembered too — someone who lives in admin still lands there', () => {
    recordSurfaceForPath('/admin/dashboard');
    expect(intentFromLastSurface()).toBe('admin');
  });

  it('with nothing remembered it returns undefined, so the server default stands', () => {
    expect(intentFromLastSurface()).toBeUndefined();
  });
});
