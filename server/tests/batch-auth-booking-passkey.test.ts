/**
 * Batch fixes:
 *  A — WebAuthn/passkey routes must be CSRF-exempt (enrollment was 403'ing →
 *      "Face ID doesn't work"). WebAuthn is CSRF-safe by design (server-issued
 *      challenge + origin-bound assertion).
 *  D — SitterAdvancedBookingEngine must expose quotePrice() + confirmBooking()
 *      that sitter-suite.ts calls; confirmBooking must hold funds in the REAL
 *      escrowService (payment is captured before it; missing method = charged
 *      customer + no escrow = money leak).
 *
 * Source-introspection (CSRF + engine are framework/DB-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const indexSrc = fs.readFileSync(path.resolve(__dirname, '..', 'index.ts'), 'utf8');
const engineSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'SitterAdvancedBookingEngine.ts'),
  'utf8',
);

describe('A — WebAuthn/passkey CSRF exemption', () => {
  it('skipCsrfProtection exempts /api/webauthn/* ', () => {
    expect(indexSrc).toMatch(/\/\^\\\/api\\\/webauthn\\\//);
  });
});

describe('D — Sitter engine has the methods sitter-suite calls', () => {
  it('exposes quotePrice() delegating to calculatePrice()', () => {
    expect(engineSrc).toMatch(/async quotePrice\(/);
    expect(engineSrc).toMatch(/return this\.calculatePrice\(/);
  });
  it('exposes confirmBooking() that holds funds in the real escrowService', () => {
    expect(engineSrc).toMatch(/async confirmBooking\(/);
    expect(engineSrc).toMatch(/escrowService\.createEscrowPayment\(/);
  });
  it('imports the real escrowService (not the mock moveToEscrow)', () => {
    expect(engineSrc).toMatch(/import escrowService from '\.\/EscrowService'/);
  });
  it('confirmBooking is idempotent by bookingId', () => {
    expect(engineSrc).toMatch(/idempotencyKey: `sitter:\$\{bookingId\}`/);
  });
});
