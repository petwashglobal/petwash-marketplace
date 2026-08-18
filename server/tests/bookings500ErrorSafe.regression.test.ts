/**
 * PR-BOOKINGS-500-ERROR-SAFE — fire-order item 109 (bookings.ts scope).
 *
 * All 6 catch blocks in server/routes/bookings.ts returned
 * `{ error: error.message }` on 500, leaking raw exception text
 * (potentially DB constraint / SQL / stack) to the customer.
 * Replaced with generic mapped errors per action; the exception
 * still goes to console.error internally for support/triage.
 *
 * This PR is the FIRST focused batch of item 109 (customer-facing
 * booking API). Other high-priority files (credit-wallet.ts,
 * provider-applications, wallet.ts) still hold error.message
 * responses and will each become their own small PR.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/bookings.ts';

describe('PR-BOOKINGS-500-ERROR-SAFE', () => {
  const src = readFileSync(resolve(ROOT, ROUTE), 'utf8');

  it('A1. no 5xx response echoes error.message any more', () => {
    // Grep every `res.status(5xx).json(...)` and confirm error.message
    // is absent from the payload. Uses a wider window so the check
    // finds the offense on the same line OR the next line.
    const offenders: string[] = [];
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/res\.status\(\s*5\d\d\s*\)\.json/.test(line)) {
        const chunk = line + (lines[i + 1] ?? '');
        if (/error:\s*error\.message|error:\s*err\.message/.test(chunk)) {
          offenders.push(`line ${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('A2. all six catch blocks use a specific generic error', () => {
    // Positive: pin that each verb-specific replacement is present so
    // a future refactor doesn't silently regress to a generic string
    // that reveals which action failed less usefully than it should.
    const expected = [
      "'Failed to create booking'",
      "'Failed to fetch bookings'",
      "'Failed to fetch booking'",
      "'Failed to confirm booking'",
      "'Failed to complete booking'",
      "'Failed to cancel booking'",
    ];
    for (const s of expected) {
      expect(src.includes(s)).toBe(true);
    }
  });

  it('A3. exception is still logged internally (console.error preserved)', () => {
    // A production trace still needs the underlying error text. The
    // fix must not drop it — only stop it from reaching the client.
    for (const tag of ['[Bookings] Error creating:', '[Bookings] Error fetching:', '[Bookings] Error fetching booking:', '[Bookings] Error confirming:', '[Bookings] Error completing:', '[Bookings] Error cancelling:']) {
      expect(src.includes(tag)).toBe(true);
    }
  });
});
