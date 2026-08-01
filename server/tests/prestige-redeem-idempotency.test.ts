/**
 * Prestige-pass wallet deductions must be idempotent (2026-08-01).
 *
 * Redeem audit R1/R6: both prestige spend endpoints called applyDeduction WITHOUT a
 * stable idempotency key, so a double-submit (retry, double-tap, replay) debited the
 * wallet TWICE for one booking — a real double-charge. deductFromWallet only dedups
 * when an idempotencyKey is supplied.
 *
 *   R1 /redeem-online: now derives `prestige:redeem-online:${userId}:${bookingId}`.
 *   R6 /staff/charge : now prefers the client's per-ring-up token when supplied
 *                      (falls back to the old timestamped key only if absent).
 *
 * Source-pinned so a future edit that drops the key fails the money gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'prestige-pass.ts'),
  'utf8',
);

describe('prestige-pass deduction idempotency', () => {
  it('R1: /redeem-online passes a stable per-user-per-booking idempotency key', () => {
    expect(src).toMatch(/idempotencyKey:\s*`prestige:redeem-online:\$\{userId\}:\$\{bookingId\}`/);
  });

  it('R6: /staff/charge accepts and prefers a client-supplied idempotency key', () => {
    // Schema accepts the optional client token...
    expect(src).toMatch(/idempotencyKey:\s*z\.string\(\)\.min\(8\)\.max\(128\)\.optional\(\)/);
    // ...and the charge prefers it over the timestamped fallback.
    expect(src).toMatch(/clientIdemKey \? `STAFF-\$\{staffUserId\}-\$\{clientIdemKey\}`/);
  });
});
