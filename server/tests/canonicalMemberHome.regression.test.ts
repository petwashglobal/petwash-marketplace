/**
 * Member home was scattered (audit 2026-07-24): the server decider sent members
 * to /home, which on WEB renders the MARKETING page — a signed-in member landed
 * on marketing, not their dashboard. Canonical member home is now /prestige/home
 * (the purpose-built member dashboard, already the native app's home) everywhere.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const decider = R('server/routes/post-login.ts');
const signup = R('client/src/pages/SignUpLuxury.tsx');

describe('canonical member home', () => {
  it('server decider routes members to /prestige/home, not /home', () => {
    expect(decider).toMatch(/return \{ nextUrl: '\/prestige\/home', reason: 'OK', profileStatus: 'complete', role, userStatus \};/);
    // no member-complete branch should fall back to /home
    expect(decider).not.toMatch(/nextUrl: '\/home', reason: 'OK', profileStatus: 'complete'/);
  });
  it('client destForFlow member fallbacks point to /prestige/home', () => {
    expect(signup).toMatch(/case 'prestige': return '\/prestige\/home';/);
    expect(signup).toMatch(/default: return '\/prestige\/home';/);
  });
});
