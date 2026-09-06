/**
 * JourneyCheckpoint wire on the academy booking flow
 * (post-release 2026-09-04, 7/7 completion of the wire matrix).
 *
 * Fourth booking-side resumable customer journey after sitter, walk,
 * and marketplace. Same shape — the endpoint + hook + service are
 * already covered by the supertest suite in
 * server/tests/journeyCheckpointsRoute.behavior.test.ts. This pin
 * locks the academy-specific wire.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'pages', 'academy', 'BookingFlow.tsx',
  ),
  'utf8',
);

describe('AcademyBookingFlow · JourneyCheckpoint wire (academy_book)', () => {
  it('imports useJourneyCheckpoint from the canonical hook', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*useJourneyCheckpoint\s*\}\s*from\s*["']@\/hooks\/useJourneyCheckpoint["']/,
    );
  });

  it('imports emitCtaEvent from the CTA registry', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*emitCtaEvent\s*\}\s*from\s*["']@\/lib\/ctaActions["']/,
    );
  });

  it('calls the hook with the academy_book domain, enabled only when signed in', () => {
    expect(SRC).toMatch(
      /useJourneyCheckpoint(?:<[^(]+>)?\(['"]academy_book['"],\s*\{[\s\S]{0,120}enabled:\s*!!user/,
    );
  });

  it('save payload carries the academy-specific fields and NEVER payment truth', () => {
    // Verify checkpoint.save is called with resumable intent only.
    expect(SRC).toMatch(
      /checkpoint\.save\(\{[\s\S]{0,400}trainerId,[\s\S]{0,200}serviceDate:[\s\S]{0,200}sessionDuration,[\s\S]{0,200}sessionType,[\s\S]{0,200}specialNotes:\s*notes,[\s\S]{0,200}step,/,
    );
    // Defence-in-depth: forbidden payment-truth keys MUST NOT appear
    // inside the save-payload region.
    const region = SRC.match(/checkpoint\.save\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(region.length).toBeGreaterThan(0);
    for (const forbidden of [
      'chargeId',
      'paidAt',
      'refundId',
      'fiscalDocumentNumber',
      'settlementId',
      'transactionId',
      'redirectUrl',
      'paymentUrl',
      'voucherCode',
      'eGiftId',
      'walletHoldCents',
      'walletCreditAppliedCents',
      'creditsAppliedCents',
      'redemptionSessionId',
      'cashDueCents',
      'financeState',
    ]) {
      expect(region, `academy save payload leaked ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('save skips step "confirmation", isSubmitting, and empty-form cases (no wasted writes)', () => {
    expect(SRC).toMatch(/if\s*\(\s*step\s*===\s*['"]confirmation['"]\s*\)\s*return/);
    expect(SRC).toMatch(/if\s*\(\s*isSubmitting\s*\)\s*return/);
    expect(SRC).toMatch(/if\s*\(\s*!trainerId\s*\|\|\s*!selectedDate\s*\)\s*return/);
  });

  it('hydrate does not overwrite a touched field (only fills untouched slots)', () => {
    // The hydrate effect guards each set with a truthy-check on
    // the CURRENT value so a partial refresh never nukes typed text.
    expect(SRC).toMatch(/if\s*\(\s*!selectedDate\s*&&\s*draft\?\.serviceDate\s*\)/);
    expect(SRC).toMatch(/if\s*\(\s*draft\?\.specialNotes\s*&&\s*!notes\s*\)/);
    expect(SRC).toMatch(/draft\?\.sessionDuration/);
    expect(SRC).toMatch(/draft\?\.sessionType/);
  });

  it('clears the checkpoint on successful booking submit — no stale nag', () => {
    expect(SRC).toMatch(/checkpoint\.clear\(\)/);
  });

  it('confirm button emits BOOK_CONFIRM with the academy_book domain, carries data-action-id', () => {
    expect(SRC).toMatch(
      /emitCtaEvent\(\s*['"]BOOK_CONFIRM['"]\s*,\s*\{\s*domain:\s*['"]academy_book['"]/,
    );
    expect(SRC).toMatch(/data-action-id="BOOK_CONFIRM"/);
  });
});
