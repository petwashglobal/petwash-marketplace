/**
 * Prestige home "Your Next Booking" — the wire must exist END TO END.
 *
 * The canonical Prestige home mockup includes a Next Booking element, and
 * PrestigeHome.tsx has rendered it from `nextBooking` since it shipped — but no
 * server code ever SENT that field, and the /api/prestige-pass/summary endpoint
 * the client also polls never existed. The card could literally never appear:
 * a dangling wire on the flagship member screen (found in the CEO's 2026-07-22
 * "everything wired, each button" sweep).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const server = readFileSync(resolve(ROOT, 'server/routes/prestige-pass.ts'), 'utf8');
const client = readFileSync(resolve(ROOT, 'client/src/pages/PrestigeHome.tsx'), 'utf8');

describe('nextBooking — server actually sends what the home renders', () => {
  it('the /me summary queries the next upcoming booking', () => {
    expect(server).toMatch(/SELECT start_time, timezone/);
    expect(server).toMatch(/start_time > now\(\)/);
    // Cancelled/completed/draft bookings must never surface as "next".
    expect(server).toMatch(/NOT IN \('cancelled', 'completed', 'rejected', 'draft', 'expired'\)/);
  });

  it('the response includes the field', () => {
    expect(server).toMatch(/nextBooking,\s*\n\s*balances:/);
  });

  it('a lookup failure cannot break the member summary', () => {
    expect(server).toMatch(/nextBooking lookup failed \(summary unaffected\)/);
  });

  it('the client consumes exactly this field', () => {
    expect(client).toMatch(/\[me, 'nextBooking'\]/);
    expect(client).toMatch(/s\.nextBooking && \(s\.nextBooking\.date \|\| s\.nextBooking\.time\)/);
  });
});
