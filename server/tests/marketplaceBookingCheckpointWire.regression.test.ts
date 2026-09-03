/**
 * Lane C.3 · JourneyCheckpoint wire on the marketplace booking flow
 * (post-release 2026-09-03).
 *
 * Third resumable customer journey after sitter (#2198) and walk
 * (#2201). Same shape — the endpoint + hook + service are already
 * covered by the supertest suite in
 * server/tests/journeyCheckpointsRoute.behavior.test.ts. This pin
 * locks the marketplace-specific wire.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'pages', 'MarketplaceBookingFlow.tsx',
  ),
  'utf8',
);

describe('MarketplaceBookingFlow · JourneyCheckpoint wire (Lane C.3)', () => {
  it('imports useJourneyCheckpoint from the canonical hook', () => {
    expect(SRC).toMatch(
      /import \{ useJourneyCheckpoint \} from ["']@\/hooks\/useJourneyCheckpoint["'];/,
    );
  });

  it('calls the hook with the marketplace_book domain, enabled only when signed in', () => {
    expect(SRC).toMatch(
      /useJourneyCheckpoint<MarketplaceBookCheckpointPayload>\(["']marketplace_book["'], \{\s*\n?\s*enabled: !!user,\s*\n?\s*\}\)/,
    );
  });

  it('hydrate effect respects existing user state — never overwrites a touched field', () => {
    // Guards are `!existing && typeof p.<field> === 'string'` etc.
    expect(SRC).toMatch(/if \(typeof p\.currentStep === 'number' && p\.currentStep >= 1 && p\.currentStep <= 4\)/);
    expect(SRC).toMatch(/if \(selectedService === 'standard' && typeof p\.selectedService === 'string'\)/);
    expect(SRC).toMatch(/if \(!selectedDate && typeof p\.selectedDate === 'string'\)/);
    expect(SRC).toMatch(/if \(!selectedTime && typeof p\.selectedTime === 'string'\)/);
    expect(SRC).toMatch(/if \(selectedPetId === null && typeof p\.selectedPetId === 'number'\)/);
    expect(SRC).toMatch(/if \(!specialInstructions && typeof p\.specialInstructions === 'string'\)/);
    expect(SRC).toMatch(/if \(selectedAddons\.length === 0 && Array\.isArray\(p\.selectedAddons\)\)/);
  });

  it('save effect skips step 5 (payment in-flight) and the empty-form case', () => {
    expect(SRC).toMatch(/if \(currentStep >= 5\) return;/);
    expect(SRC).toMatch(/nothing meaningful yet/);
  });

  it('save payload carries marketplace-specific fields and NEVER payment truth', () => {
    // Verify the payload passed to checkpoint.save includes the
    // resumable intent fields.
    expect(SRC).toMatch(
      /void checkpoint\.save\(\{[\s\S]{0,600}platform:[\s\S]{0,200}providerId:[\s\S]{0,200}currentStep,[\s\S]{0,300}selectedService,[\s\S]{0,300}selectedDate:[\s\S]{0,300}selectedTime,[\s\S]{0,300}selectedPetId,[\s\S]{0,300}specialInstructions,[\s\S]{0,300}selectedAddons,[\s\S]{0,300}updatedAt:/,
    );
    // Defence-in-depth: forbidden payment-truth keys must not appear
    // inside the save-payload region.
    const region = SRC.match(/void checkpoint\.save\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    for (const k of [
      'chargeId', 'paidAt', 'refundId', 'fiscalDocumentNumber',
      'settlementId', 'quoteId', 'checkoutSessionId', 'paymentUrl',
    ]) {
      expect(region).not.toContain(k);
    }
  });

  it('checkoutMutation.onSuccess clears the checkpoint FIRST — even before payment redirect', () => {
    // The clear() call MUST fire before window.location.href = paymentUrl,
    // because the redirect terminates the JS context. Pin the order.
    expect(SRC).toMatch(
      /onSuccess: \(data\) => \{[\s\S]{0,300}void checkpoint\.clear\(\);[\s\S]{0,300}if \(data\.paymentUrl\) \{[\s\S]{0,300}window\.location\.href = data\.paymentUrl;/,
    );
  });
});
