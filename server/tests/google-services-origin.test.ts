/**
 * Tests for the Google Places proxy origin allowlist
 *
 * Verifies that:
 *  1. In production (isDev=false) Replit domains are rejected.
 *  2. In production petwash.co.il domains are accepted.
 *  3. Random external origins are always rejected.
 *  4. In development (isDev=true) Replit domains are accepted.
 *
 * These tests import the real `buildPlacesAllowlist` and `isAllowedHostname`
 * functions exported from google-services.ts so that any change to the
 * production allowlist logic is automatically reflected here.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPlacesAllowlist,
  isAllowedHostname,
} from '../routes/google-services';

// ---------------------------------------------------------------------------
// Helper: check whether a given Origin/Referer URL is allowed against the
// provided allowlist — mirrors the hostname-extraction logic in
// isAllowedPlacesOrigin inside google-services.ts.
// ---------------------------------------------------------------------------
function checkOrigin(originUrl: string, allowlist: string[]): boolean {
  let hostname: string;
  try {
    hostname = new URL(originUrl).hostname;
  } catch {
    return false;
  }
  return isAllowedHostname(hostname, allowlist);
}

// ---------------------------------------------------------------------------
// Suite: production allowlist (isDev = false)
// ---------------------------------------------------------------------------
describe('buildPlacesAllowlist — production (isDev=false)', () => {
  const allowlist = buildPlacesAllowlist(false);

  it('rejects any *.replit.dev origin', () => {
    const origins = [
      'https://anything.replit.dev',
      'https://f46fb046-7dd0-4090-af9e-1be17d9de48e-00-15el1m8qkuf16.picard.replit.dev',
      'https://my-project.replit.dev',
    ];
    for (const origin of origins) {
      expect(checkOrigin(origin, allowlist), `should reject ${origin}`).toBe(false);
    }
  });

  it('rejects any *.repl.co origin', () => {
    expect(checkOrigin('https://anything.repl.co', allowlist)).toBe(false);
  });

  it('rejects localhost in production', () => {
    expect(checkOrigin('http://localhost:5000', allowlist)).toBe(false);
    expect(checkOrigin('http://127.0.0.1:3000', allowlist)).toBe(false);
  });

  it('rejects random external origins', () => {
    const origins = [
      'https://evil.com',
      'https://attacker.io',
      'https://petwash.co.il.evil.com', // subdomain spoofing attempt
      'https://fake-petwash.co.il',      // different TLD prefix
    ];
    for (const origin of origins) {
      expect(checkOrigin(origin, allowlist), `should reject ${origin}`).toBe(false);
    }
  });

  it('allows https://petwash.co.il', () => {
    expect(checkOrigin('https://petwash.co.il', allowlist)).toBe(true);
  });

  it('allows https://www.petwash.co.il', () => {
    expect(checkOrigin('https://www.petwash.co.il', allowlist)).toBe(true);
  });

  it('allows https://auth.petwash.co.il', () => {
    expect(checkOrigin('https://auth.petwash.co.il', allowlist)).toBe(true);
  });

  it('allows any *.petwash.co.il subdomain (e.g. app.petwash.co.il)', () => {
    expect(checkOrigin('https://app.petwash.co.il', allowlist)).toBe(true);
  });

  it('allows Firebase Hosting web.app / firebaseapp.com domains', () => {
    expect(checkOrigin('https://signinpetwash.web.app', allowlist)).toBe(true);
    expect(checkOrigin('https://signinpetwash.firebaseapp.com', allowlist)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: development allowlist (isDev = true)
// ---------------------------------------------------------------------------
describe('buildPlacesAllowlist — development (isDev=true)', () => {
  const allowlist = buildPlacesAllowlist(true);

  it('allows *.replit.dev in development', () => {
    expect(checkOrigin('https://my-project.replit.dev', allowlist)).toBe(true);
  });

  it('allows *.repl.co in development', () => {
    expect(checkOrigin('https://my-project.repl.co', allowlist)).toBe(true);
  });

  it('allows localhost in development', () => {
    expect(checkOrigin('http://localhost:5000', allowlist)).toBe(true);
  });

  it('still rejects random external origins in development', () => {
    expect(checkOrigin('https://evil.com', allowlist)).toBe(false);
  });
});

