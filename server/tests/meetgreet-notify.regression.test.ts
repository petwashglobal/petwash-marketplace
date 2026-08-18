/**
 * PR-MEETGREET-NOTIFY-COUNTERPARTY — regression pin for the counterparty
 * notification fires on the schedule + complete Meet & Greet actions.
 *
 * Before: only the 'request' action fired a dispatchNotification to the
 * other party. 'schedule' silently updated the row (customer never told
 * the provider picked a time). 'complete' silently updated the row
 * (customer never told they need to pay — booking stuck at
 * meet_greet_completed).
 *
 * These pins lock the additive fire-and-forget notifications in place.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

describe('Meet & Greet — counterparty notification fires', () => {
  it('schedule action notifies the OTHER party (customer if provider scheduled)', () => {
    // Anchor on the meet_greet_scheduled UPDATE + then look for a dispatchNotification
    // following it inside the same handler branch.
    const idx = SRC.indexOf("status: 'meet_greet_scheduled',");
    expect(idx).toBeGreaterThan(-1);
    // Take the next ~3000 chars — the notification block sits between the
    // UPDATE + the res.json call.
    const window = SRC.slice(idx, idx + 3000);
    expect(window).toMatch(/dispatchNotification\(\{[\s\S]*?type:\s*['"]meet_greet_scheduled['"]/);
    expect(window).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]sms['"]\s*\]/);
    expect(window).toMatch(/ctaUrl:\s*`https:\/\/petwash\.co\.il\/booking\/confirmation\/\$\{requestId\}`/);
  });

  it('complete action notifies the customer with a "pay now" CTA', () => {
    const idx = SRC.indexOf("status: 'meet_greet_completed',");
    expect(idx).toBeGreaterThan(-1);
    const window = SRC.slice(idx, idx + 3000);
    expect(window).toMatch(/dispatchNotification\(\{[\s\S]*?type:\s*['"]meet_greet_completed['"]/);
    expect(window).toMatch(/uid:\s*booking\.ownerId/);
    // Includes 'push' so the customer's phone wakes up — payment is
    // time-sensitive because it's the next state transition.
    expect(window).toMatch(/channels:\s*\[\s*['"]inbox['"]\s*,\s*['"]email['"]\s*,\s*['"]sms['"]\s*,\s*['"]push['"]\s*\]/);
    expect(window).toMatch(/Pay now/);
    expect(window).toMatch(/complete_payment/);
  });

  it('is fire-and-forget on both actions (uses .then().catch(()=>{}) shape)', () => {
    // The pattern is db.select(...).then([u] => dispatch).catch(()=>{})
    // for both — count occurrences in the M&G handler window.
    const mgStart = SRC.indexOf("router.post('/:requestId/meet-greet'");
    const mgEnd = SRC.indexOf("router.post('/:requestId/pay'");
    expect(mgStart).toBeGreaterThan(-1);
    expect(mgEnd).toBeGreaterThan(mgStart);
    const region = SRC.slice(mgStart, mgEnd);
    // Must include at least 3 dispatchNotification calls now (request, schedule, complete)
    const dispatches = region.match(/dispatchNotification\(/g) || [];
    expect(dispatches.length).toBeGreaterThanOrEqual(3);
  });
});
