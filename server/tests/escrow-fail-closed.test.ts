/**
 * Escrow must fail CLOSED — a booking cannot be confirmed without funds held.
 *
 * BaseLuxuryBookingEngine.moveToEscrow's catch block fabricated a fake escrow
 * reference (`ESCROW-<ts>-<id>`) and returned `{ success: true }` when
 * escrowService.createEscrowPayment threw. confirmBooking then saw success and
 * CONFIRMED the booking — with no money actually in escrow (free service).
 *
 * Fix: on escrow failure return `{ success: false }`; the caller already does
 * `if (!escrowResult.success) → status: 'failed'`. Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'booking-engines', 'base', 'BaseLuxuryBookingEngine.ts'),
  'utf8',
);

describe('BaseLuxuryBookingEngine.moveToEscrow — fail closed', () => {
  it('no longer fabricates a fallback escrow reference', () => {
    expect(src).not.toMatch(/const fallbackId = `ESCROW-/);
    expect(src).not.toMatch(/escrowReferenceId: fallbackId/);
  });

  it('returns success:false on escrow failure', () => {
    // Within the catch block, the failure return must be success:false.
    const catchIdx = src.indexOf("logger.error('[Escrow] Failed to move funds to escrow'");
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = src.slice(catchIdx, catchIdx + 600);
    expect(catchBlock).toMatch(/return \{ success: false \}/);
    expect(catchBlock).not.toMatch(/success: true/);
  });

  it('caller still routes a failed escrow to status:failed', () => {
    expect(src).toMatch(/if \(!escrowResult\.success\)/);
    expect(src).toMatch(/status: 'failed'/);
  });
});
