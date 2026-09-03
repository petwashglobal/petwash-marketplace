/**
 * Regression pin — every money-mutating webhook claims through the
 * inbox before doing work (CEO invariant — AUDIT-MONEY-4/5/6 anchor).
 *
 * The failure mode this pin defends against: a webhook handler that
 * updates money-shape state — payment_intents, booking status,
 * loyalty ledger, wallet balance — without first claiming an
 * exclusive lock on its event id via the shared inbox
 * (server/lib/nayaxWebhookDedup.ts). The lock is what turns two
 * concurrent deliveries of the same event id into "one processes,
 * the other sees claim rejected, both 200-OK" instead of
 * "both process, side effects fire twice".
 *
 * The three canonical webhook handlers on the money path all use
 * the pattern today:
 *   - server/routes/nayax-webhooks.ts     (Nayax card + refund)
 *   - server/routes/nayax-cortina.ts      (Nayax Cortina station events)
 *   - server/routes/sumit-webhook.ts      (SUMIT invoice + payment)
 *
 * This pin walks each of those files and refuses:
 *   1. removal of the `claimEvent` / `claimInboxEvent` import from
 *      server/lib/nayaxWebhookDedup;
 *   2. removal of the paired `markCompleted` / `markInboxCompleted`
 *      import (a claim without a complete rots the inbox);
 *   3. removal of the retry-safe `markFailedRetryable` import in the
 *      files that own retry-eligible failure branches.
 *
 * The pin is a shape guard — it does not re-verify each claim call's
 * ordering against side effects (individual regression tests such
 * as nayaxRefundFanout / sumitWebhookInboxDedup do that). Its job is
 * to make sure the shared primitives cannot silently disappear from
 * any of these three files.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const WEBHOOK_FILES = [
  'server/routes/nayax-webhooks.ts',
  'server/routes/nayax-cortina.ts',
  'server/routes/sumit-webhook.ts',
];

describe('CEO invariant — money-mutating webhooks claim through the inbox', () => {
  for (const rel of WEBHOOK_FILES) {
    it(`${rel} imports claim* + markCompleted* from nayaxWebhookDedup`, () => {
      const src = R(rel);
      // Import must come from the canonical helper file — any drift to
      // a private in-file dedup impl breaks the "one shared inbox" story.
      expect(src).toMatch(/from\s+['"]\.\.\/lib\/nayaxWebhookDedup['"]/);
      // Both a claim primitive and its paired mark-complete must be
      // in scope. A claim without a mark-complete leaks the inbox row.
      expect(src).toMatch(/\b(claimEvent|claimInboxEvent)\b/);
      expect(src).toMatch(/\b(markCompleted|markInboxCompleted)\b/);
    });

    it(`${rel} still calls the claim primitive at least once (not just importing)`, () => {
      const src = R(rel);
      // The import must land in a real call site — a dead import that
      // once had a call but has been rewritten to skip the inbox is
      // exactly the regression this line refuses.
      expect(src).toMatch(/(claimEvent|claimInboxEvent)\s*\(/);
    });

    it(`${rel} still calls the mark-complete primitive at least once`, () => {
      const src = R(rel);
      expect(src).toMatch(/(markCompleted|markInboxCompleted)\s*\(/);
    });
  }

  it('nayax-webhooks.ts + sumit-webhook.ts both import markFailedRetryable so a retryable failure keeps the inbox row', () => {
    // These are the two files that carry a retry-eligible processing
    // exception (the Nayax refund handler and the SUMIT activation
    // path). Without markFailedRetryable in scope they would either
    // silently mark completed on failure (double-processing) or leak
    // the row (never re-processed).
    for (const rel of ['server/routes/nayax-webhooks.ts', 'server/routes/sumit-webhook.ts']) {
      const src = R(rel);
      expect(src).toMatch(/\bmarkFailedRetryable\b/);
    }
  });
});
