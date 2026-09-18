/**
 * Academy has no online card rail: the server holds the wallet credit, debits
 * it on trainer-confirm, and leaves paymentStatus 'pending' for the rest
 * (academy.ts logs "Booking confirmed with NO wallet capture"). The screen
 * showed ₪345 and said "you will be charged once the trainer approves", so a
 * customer with ₪100 credit believed ₪345 was being collected; ₪245 never was.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const screen = read('client/src/pages/academy/BookingFlow.tsx');

describe('the academy screen says what is actually collected', () => {
  it('states the rest is not collected on the site', () => {
    expect(screen).toContain('data-testid="academy-what-is-collected"');
    expect(screen).toContain('אינה נגבית באתר בשלב זה');
    expect(screen).toContain('ממתין לתשלום');
  });

  it('no longer promises a charge after the trainer approves', () => {
    expect(screen).not.toContain('חיוב יבוצע רק לאחר שהמאמן/ת יאשר/תאשר את הפגישה');
    expect(screen).not.toContain('הסכום ייושמר מהארנק שלך עם אישור המאמן/ת, ויחויב לאחר סיום השיעור');
  });
});

describe('the server still behaves that way (so the wording stays true)', () => {
  const src = read('server/routes/academy.ts');

  it('only the wallet hold is captured; the rest stays pending', () => {
    expect(src).toContain("paymentStatus: walletFunded ? 'completed' : 'pending'");
    expect(src).toContain('amountCents: booking.walletHoldCents,');
    expect(src).toMatch(/NO wallet capture/);
  });
});
