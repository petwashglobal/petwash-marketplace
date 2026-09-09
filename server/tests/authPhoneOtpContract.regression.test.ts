/**
 * PR-AUTH-FIX-CONTRACT-1 — phone-OTP request-body contract regression.
 *
 * Bug being pinned (forensic auth audit, confirmed on main 2026-05-11):
 *   client/src/pages/AccountActivation.tsx posted the OTP body with the
 *   key `phoneNumber`, but the server endpoints
 *     POST /api/auth/phone/send-code
 *     POST /api/auth/phone/verify-code
 *   destructure `phone` from req.body and return HTTP 400
 *   ("Phone number is required") when `phone` is absent. Result: mobile
 *   OTP signup was silently broken — every send/verify returned 400.
 *
 * Canonical key is `phone` (the server owns the contract; rate-limit,
 * per-phone lockout, daily-cap and SMS logic all key on `phone`).
 *
 * This suite pins BOTH sides so the client and server can never drift
 * apart again:
 *   A. server still reads `req.body.phone` for both endpoints
 *   B. the client caller sends `phone` (never `phoneNumber`)
 *   C. no client file anywhere posts `phoneNumber` to these endpoints
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const SERVER_ROUTE = 'server/routes/publicAuthRoutes.ts';
const CLIENT_CALLER = 'client/src/pages/AccountActivation.tsx';

// ─────────────────────────────────────────────────────────────────────────
// A. Server contract — both endpoints read `phone` from the body
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-CONTRACT-1 — A. server reads `phone`', () => {
  const src = read(SERVER_ROUTE);

  it('A1. send-code + verify-code routes are defined', () => {
    expect(src).toContain('/api/auth/phone/send-code');
    expect(src).toContain('/api/auth/phone/verify-code');
  });

  it('A2. handlers destructure `phone` (not `phoneNumber`) from req.body', () => {
    // Both handlers begin by pulling `phone` out of the body. Pin the
    // exact destructure so a future refactor cannot quietly rename it.
    const destructures = src.match(/const\s*\{\s*phone\b[^}]*\}\s*=\s*req\.body/g) || [];
    // send-code and verify-code each have one such destructure.
    expect(destructures.length).toBeGreaterThanOrEqual(2);
  });

  it('A3. server does NOT read `req.body.phoneNumber` for these endpoints', () => {
    expect(/req\.body\.phoneNumber\b/.test(src)).toBe(false);
    expect(/const\s*\{\s*phoneNumber\b[^}]*\}\s*=\s*req\.body/.test(src)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. Client caller — sends `phone` in the body to both endpoints
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-CONTRACT-1 — B. client sends `phone`', () => {
  it('B0. the client caller file exists', () => {
    expect(existsSync(resolve(ROOT, CLIENT_CALLER))).toBe(true);
  });

  const src = read(CLIENT_CALLER);

  // RETARGETED 2026-09-08. B2/B3 sliced 160/180 characters after the first
  // occurrence of '/api/auth/phone/send-code' and looked for `phone: user`.
  // The client has since migrated to the canonical /api/auth/sms/start and
  // /api/auth/sms/verify (the phone/* pair is @deprecated in
  // publicAuthRoutes.ts), so the only surviving match was the COMMENT naming
  // the old route — the window landed on prose and the pins went red while
  // the contract they guard (body key `phone`, never `phoneNumber`) held.
  //
  // The contract is what matters, not which route carries it, so assert it
  // against whichever OTP endpoints this caller actually posts to.
  const OTP_POSTS = [...src.matchAll(
    /apiRequest\(\s*["']POST["']\s*,\s*["'](\/api\/auth\/(?:sms\/(?:start|verify)|phone\/(?:send-code|verify-code)))["']\s*,\s*\{([\s\S]{0,220}?)\}\s*\)/g,
  )];

  it('B1. posts to the canonical OTP endpoints', () => {
    const routes = OTP_POSTS.map((m) => m[1]);
    expect(routes).toContain('/api/auth/sms/start');
    expect(routes).toContain('/api/auth/sms/verify');
  });

  it('B2/B3. every OTP body uses the `phone` key, never `phoneNumber`', () => {
    expect(OTP_POSTS.length).toBeGreaterThanOrEqual(2);
    for (const m of OTP_POSTS) {
      const [, route, body] = m;
      // `phone,` shorthand or `phone:` explicit — both send the key `phone`.
      expect(body, `body for ${route}`).toMatch(/(^|[\s{,])phone\s*[,:]/);
      expect(body, `body for ${route}`).not.toMatch(/\bphoneNumber\s*[,:]/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Guard — no client file posts `phoneNumber` to these endpoints
// ─────────────────────────────────────────────────────────────────────────
describe('PR-AUTH-FIX-CONTRACT-1 — C. no re-introduction anywhere in client', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const entry of readdirSync(cur, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;
        const full = resolve(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
      }
    }
    return out;
  }

  it('C1. no client file sends a `phoneNumber:` body to send-code / verify-code', () => {
    const clientDir = resolve(ROOT, 'client', 'src');
    if (!existsSync(clientDir)) return;
    const offenders: string[] = [];
    for (const file of walk(clientDir)) {
      const src = readFileSync(file, 'utf8');
      if (
        !src.includes('/api/auth/phone/send-code') &&
        !src.includes('/api/auth/phone/verify-code')
      ) {
        continue;
      }
      // A caller of these endpoints must not carry a `phoneNumber:` body key.
      if (/\bphoneNumber:\s*/.test(src)) {
        offenders.push(file.replace(ROOT + '/', ''));
      }
    }
    expect(offenders, `files re-introducing phoneNumber body key: ${offenders.join(', ')}`).toEqual([]);
  });
});
