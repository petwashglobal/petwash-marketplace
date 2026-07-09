/**
 * Bug-hunt fixes — regression pins (2026-07-09).
 *
 * A 3-agent adversarial money/security hunt found two fixable holes:
 *
 * 1. HIGH — the checkout webhook (/nayax/checkout-payment) deduped via Redis that
 *    FAILED OPEN ("proceeding without dedup" when Redis was down), so a concurrent
 *    Nayax retry could DOUBLE-MINT a wash package. Now it uses the fail-CLOSED
 *    DB dedup (tryClaimWebhookEvent, insert-first on nayax_processed_event_ids)
 *    that the sibling terminal/settlement webhooks already use.
 *
 * 2. LOW-MED — admin wash-package create/update accepted negative/₪0 price and
 *    zero wash count (money-facing, shown on the homepage). Now bounded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const WEBHOOKS = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'nayax-webhooks.ts'),
  'utf8',
);
const ROUTES = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('checkout webhook dedup fails CLOSED (2026-07-09)', () => {
  it('uses the DB-backed tryClaimWebhookEvent for the checkout event', () => {
    expect(WEBHOOKS).toMatch(/eventId: `checkout:\$\{payload\.transactionId\}`/);
  });

  it('no longer proceeds without dedup when the store is down', () => {
    expect(WEBHOOKS).not.toMatch(/Redis dedup unavailable — proceeding without dedup/);
    // fails closed: 503 so Nayax retries, instead of processing an unclaimed event
    expect(WEBHOOKS).toMatch(/dedup_unavailable_retry/);
  });
});

describe('admin wash-package price/washCount are bounded (2026-07-09)', () => {
  it('rejects negative price and sub-1 wash count', () => {
    expect(ROUTES).toMatch(/INVALID_PRICE/);
    expect(ROUTES).toMatch(/INVALID_WASH_COUNT/);
    expect(ROUTES).toMatch(/priceNum < 0/);
  });
});
