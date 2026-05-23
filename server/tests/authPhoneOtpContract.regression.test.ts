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

  it('B1. posts to both phone endpoints', () => {
    expect(src).toContain('/api/auth/phone/send-code');
    expect(src).toContain('/api/auth/phone/verify-code');
  });

  it('B2. send-code body uses the `phone:` key', () => {
    // Pin the request body shape: the property sent to the server is
    // `phone`, sourced from the Firebase user.phoneNumber field. The
    // SOURCE property (user.phoneNumber) is correct Firebase API; only
    // the BODY KEY must be `phone`.
    const sendBlock = src.slice(
      src.indexOf('/api/auth/phone/send-code'),
      src.indexOf('/api/auth/phone/send-code') + 160,
    );
    expect(sendBlock).toMatch(/\bphone:\s*user/);
    expect(sendBlock).not.toMatch(/\bphoneNumber:\s*user/);
  });

  it('B3. verify-code body uses the `phone:` key', () => {
    const verifyBlock = src.slice(
      src.indexOf('/api/auth/phone/verify-code'),
      src.indexOf('/api/auth/phone/verify-code') + 180,
    );
    expect(verifyBlock).toMatch(/\bphone:\s*user/);
    expect(verifyBlock).not.toMatch(/\bphoneNumber:\s*user/);
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
