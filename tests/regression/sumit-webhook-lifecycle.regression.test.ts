import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'sumit-webhook.ts'),
  'utf8',
);

// Regression pin for SUMIT Phase 2 Item 7 (2026-08-19): non-payment-success
// events were silently dropped after signature verification. We now categorize
// each event and write a per-category audit row so admin dashboards and the
// Item 11 reconciler have something to compare against. Money path is
// unchanged — activation still gates on isPaymentSuccessEvent.

describe('SUMIT webhook lifecycle observability (Item 7)', () => {
  it('has a categorizeSumitEvent classifier with all lifecycle categories', () => {
    for (const cat of [
      'payment.success',
      'payment.failed',
      'document.confirmed',
      'document.failed',
      'subscription.event',
      'recurring.event',
      'refund.event',
      'other',
    ]) {
      expect(SRC).toContain(`'${cat}'`);
    }
    expect(SRC).toMatch(/function categorizeSumitEvent\(eventType: string\): SumitLifecycleCategory/);
  });

  it('writes a per-category audit row for non-payment-success non-other events', () => {
    expect(SRC).toMatch(/eventType: `sumit\.webhook\.\$\{category\}`/);
    expect(SRC).toMatch(/category !== ['"]payment\.success['"] && category !== ['"]other['"]/);
  });

  it('never breaks the money path — activation still gates on isPaymentSuccessEvent', () => {
    // The categorization block only runs AFTER the activation branch, and
    // activation still checks isPaymentSuccessEvent directly.
    expect(SRC).toMatch(/isPaymentSuccessEvent\(eventType\)/);
    expect(SRC).toMatch(/isCommerceFlagEnabled\(COMMERCE_FLAGS\.enabled\)\s*&&\s*isPaymentSuccessEvent\(eventType\)/);
  });

  it('audit failures never turn into a retry storm — always 200', () => {
    // Try/catch swallows audit errors; the tail line always calls
    // res.status(200).json({...}).
    expect(SRC).toMatch(/lifecycle audit failed \(continuing\)/);
    expect(SRC).toMatch(/res\.status\(200\)\.json\(\{[\s\S]*category,?\s*\}\)/);
  });

  it('echoes the category in the response body for admin observability', () => {
    // Response body carries `category` on the same object as `received` / `activation`.
    expect(SRC).toMatch(/received:\s*true,/);
    expect(SRC).toMatch(/activation:\s*activation\?\.outcome/);
    // `category` appears standalone in the res.status(200).json({...}) body.
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).toMatch(/res\.status\(200\)\.json\(\{[\s\S]*?category,?[\s\S]*?\}\)/);
  });
});
