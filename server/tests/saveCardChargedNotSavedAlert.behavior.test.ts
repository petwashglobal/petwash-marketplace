/**
 * /save-card/return — a taken ₪1 with no saved card must not be silent.
 *
 * Review addition (2026-09-06) to the Redis-handoff lane.
 *
 * The customer only reaches /save-card/return by being redirected back from
 * SUMIT's hosted page, which means the ₪1 verification charge has ALREADY
 * been taken by the time any failure branch runs. This codebase has no
 * automated refund rail, so every fail-closed exit here leaves a real
 * customer out of pocket with nothing saved.
 *
 * Redirecting to ?card=failed is honest but loses the event: a log line was
 * the only record that someone had been charged for nothing. The route now
 * fires the same ops alert the codebase already uses for a failed sitter
 * settlement and a lost franchise lead, so it can be refunded by hand.
 *
 * The one deliberate exception is a REPLAY of an already-consumed handoff:
 * the first caller consumed it, no second charge occurred, so alerting there
 * would page someone for a duplicate callback rather than a lost ₪1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'save-card.ts'),
  'utf8',
);

/** Just the /save-card/return handler, so /start exits can't satisfy these. */
const RETURN_HANDLER = (() => {
  const start = SRC.indexOf("router.get('/save-card/return'");
  expect(start).toBeGreaterThan(-1);
  const end = SRC.indexOf('\n});\n', start);
  return SRC.slice(start, end);
})();

describe('save-card return — charged-but-not-saved raises an alert', () => {
  it('every post-charge failure exit routes through failAfterCharge', () => {
    // A bare redirect to card=failed/unsaved would be a silent loss. The only
    // permitted one is the replay branch (asserted separately below).
    const bareRedirects = [...RETURN_HANDLER.matchAll(
      /return res\.redirect\(`\$\{base\}\/my-wallet\?card=(failed|unsaved)`\)/g,
    )];
    expect(
      bareRedirects.length,
      'only the replay branch may redirect without alerting',
    ).toBe(1);
  });

  it('the one permitted bare redirect is the consumed-handoff replay', () => {
    const idx = RETURN_HANDLER.indexOf('already consumed');
    expect(idx).toBeGreaterThan(-1);
    const after = RETURN_HANDLER.slice(idx, idx + 400);
    expect(after).toMatch(/return res\.redirect\(`\$\{base\}\/my-wallet\?card=failed`\)/);
  });

  it('the alert names a reason and the correlating ids', () => {
    expect(SRC).toMatch(/reason=\$\{reason\}/);
    expect(SRC).toMatch(/txnId=\$\{ctx\.txnId/);
    expect(SRC).toMatch(/uid=\$\{ctx\.uid/);
  });

  it('it says a manual refund is required — there is no automated rail', () => {
    expect(SRC).toMatch(/refund manually/i);
  });

  it('an alert failure can never change the customer redirect', () => {
    // sendAlert is awaited inside its own try/catch, and the redirect happens
    // after it regardless. A monitoring outage must not strand the customer.
    expect(SRC).toMatch(/catch \{ \/\* alert must never change the customer's redirect \*\/ \}/);
    const helper = SRC.slice(SRC.indexOf('async function failAfterCharge'));
    expect(helper.slice(0, helper.indexOf('\n}\n'))).toMatch(/res\.redirect\(`\$\{base\}\/my-wallet\?card=\$\{outcome\}`\)/);
  });

  it('the alert carries no card data — this route never handles a PAN', () => {
    const helper = SRC.slice(
      SRC.indexOf('async function failAfterCharge'),
      SRC.indexOf("router.get('/save-card/return'"),
    );
    for (const forbidden of ['cardNumber', 'pan', 'cvv', 'token']) {
      expect(helper.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
