/**
 * Payment preview surface honesty — CEO §14-16 + §46 family sweep.
 *
 * The composer must be honest about which surfaces have real
 * per-surface delegates and which still stub. Today's honest state:
 *   REAL: booking_request, sitter, walk, academy (via booking_request
 *         mirror), shop.
 *   STUB: k9000, egift, and the `default` fallthrough.
 *
 * A future PR that:
 *   • Adds a new stub for a real surface (regression — silently masks
 *     a broken preview).
 *   • Adds a real composer for a stub surface but forgets to remove
 *     the surface from this test's stub list (drift).
 *   • Removes a real composer without updating this test (silent
 *     downgrade to stub — customer sees "0" preview).
 * ...will fail here with a clear message pointing at the culprit.
 *
 * Structural pin (reads paymentPreview.ts). A tighter test would
 * invoke composePaymentPreview against a real DB — a follow-up when
 * shared test fixtures land.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'paymentPreview.ts'),
  'utf8',
);

// Extract the composePaymentPreview switch body.
const switchBlock = (() => {
  const start = SRC.indexOf('export async function composePaymentPreview');
  const end = SRC.indexOf('}\n', start + 200);
  return SRC.slice(start, end + 1);
})();

const REAL_SURFACES = ['booking_request', 'sitter', 'walk', 'academy', 'shop'] as const;
const STUB_SURFACES = ['k9000', 'egift'] as const;

describe('paymentPreview composer — surface honesty (§14 + §46)', () => {
  it('every REAL surface routes through a per-surface composer (not the stub fallthrough alone)', () => {
    for (const surface of REAL_SURFACES) {
      // The case appears literally in the switch body AND is paired
      // with either composeBookingRequest or composeShop (never JUST
      // composeStub — that would be a silent downgrade).
      expect(switchBlock).toMatch(new RegExp(`case\\s+['"]${surface}['"]`));
    }
    expect(switchBlock).toMatch(/composeBookingRequest\(input\)/);
    expect(switchBlock).toMatch(/composeShop\(input\)/);
  });

  it('STUB surfaces are explicitly labelled as stub in the switch (not a silent gap)', () => {
    for (const surface of STUB_SURFACES) {
      expect(switchBlock).toMatch(new RegExp(`case\\s+['"]${surface}['"]`));
    }
    // The stub arm's own comment must remain: it names the design note
    // as the follow-up. A PR that removes the comment without landing
    // real composers is hiding the gap.
    expect(switchBlock).toMatch(/These surfaces have their own price paths/);
  });

  it('composeStub returns an EMPTY preview — never invents money', () => {
    // The stub must call emptyPaymentPreview. If a refactor makes the
    // stub return anything else (a mid-range fake, hard-coded ILS 0.01,
    // etc.), a customer sees a false preview. Pin the shape.
    expect(SRC).toMatch(/async function composeStub[^{]*\{[\s\S]*?emptyPaymentPreview\(/);
  });

  it('booking_request / sitter / walk / academy all fall to composeStub when quoteInput is missing (fail-safe)', () => {
    // A missing quoteInput must NOT invent a preview. The stub keeps
    // the client at "no preview available" rather than a lie.
    expect(switchBlock).toMatch(/input\.quoteInput\s*\?\s*composeBookingRequest\(input\)\s*:\s*composeStub\(input\)/);
  });

  it('shop falls to composeStub when shopInput is missing (fail-safe)', () => {
    expect(switchBlock).toMatch(/input\.shopInput\s*\?\s*composeShop\(input\)\s*:\s*composeStub\(input\)/);
  });
});
