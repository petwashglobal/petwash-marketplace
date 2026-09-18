/**
 * Accepting a walk moves NO money: acceptWalkBookingCore writes the escrow
 * document and returns paymentRail: 'MISSING' — no card charge, no wallet
 * debit, no fiscal document. The screen meanwhile promised a wallet hold on
 * acceptance, a charge after the walk, a saved credit card "charged after the
 * service", and 72-hour escrow protection.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const screen = read('client/src/pages/walk-my-pet/BookingFlow.tsx');

describe('the walk screen states what actually happens', () => {
  it('no wallet-hold or charge-after-walk promise', () => {
    expect(screen).not.toContain('הסכום ייושמר מהארנק שלך עם אישור המוליך/ה, ויחויב לאחר סיום ההליכה');
    expect(screen).toContain('data-testid="walk-payment-truth"');
    expect(screen).toContain('לא מתבצע חיוב באתר ולא נשמר כסף בנאמנות');
  });

  it('no saved-card block and no escrow protection claim', () => {
    expect(screen).not.toContain('כרטיס אשראי שמור');
    expect(screen).not.toContain('החיוב יתבצע רק לאחר סיום השירות');
    expect(screen).not.toContain('escrowMessage');
    expect(screen).toContain('תשלום מקוון עדיין לא זמין להליכות');
  });
});

describe('the accept path still has no rail (so the wording stays true)', () => {
  it("acceptWalkBookingCore returns paymentRail 'MISSING'", () => {
    const core = read('server/services/booking-response/acceptWalkBookingCore.ts');
    expect(core).toMatch(/paymentRail: 'MISSING'/);
  });
});
