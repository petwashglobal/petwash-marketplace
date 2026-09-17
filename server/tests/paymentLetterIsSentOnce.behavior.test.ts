import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17 (CEO: "great, go hard"): Pet Wash's payment letter replaces
 * SUMIT's stock "חיוב שבוצע בהצלחה" mail on signed-in flows.
 */
const sent: any[] = [];
let userRow: any = { email: 'nir@example.com', firstName: 'ניר', language: 'he' };
vi.mock('../db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => (userRow ? [userRow] : []) }) }) }) },
}));
vi.mock('../email/luxury-email-service', () => ({ sendLuxuryEmail: vi.fn(async (m: any) => { sent.push(m); return true; }) }));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const RAW = { Data: { Payment: { PaymentMethod: { CreditCard_LastDigits: '4935' } } } };

type Mod = typeof import('../services/paymentLetter');
let mod: Mod;
// Import once, with room: under a loaded parallel run the first import of the
// schema graph alone can pass vitest's 5s default.
beforeAll(async () => { mod = await import('../services/paymentLetter'); }, 60_000);

describe('sendPaymentLetter', () => {
  beforeEach(() => { sent.length = 0; userRow = { email: 'nir@example.com', firstName: 'ניר', language: 'he' }; });

  it('sends the Hebrew letter with the card digits and the transactions link', async () => {
    const { sendPaymentLetter, bookingItemLabel } = mod;
    const r = await sendPaymentLetter({ userId: 'u1', amountIls: 56.35, itemDescription: bookingItemLabel('walking'), reference: 'BR-1', sumitRaw: RAW });
    expect(r).toBe('sent');
    expect(sent[0].to).toBe('nir@example.com');
    expect(sent[0].subject).toBe('התשלום התקבל · ₪56.35');
    expect(sent[0].html).toContain('•••• 4935');
    expect(sent[0].html).toContain('Walk My Pet · טיול כלב');
    expect(sent[0].html).toContain('/account/transactions');
    expect(sent[0].html).toContain('התשלומים והמסמכים שלי');
  });
  it('English customer → English letter', async () => {
    userRow = { email: 'a@b.co', firstName: 'Ann', language: 'en' };
    const { sendPaymentLetter, purchaseItemLabel } = mod;
    await sendPaymentLetter({ userId: 'u2', amountIls: 120, itemDescription: purchaseItemLabel('WASH_PACKAGE'), reference: 'x' });
    expect(sent[0].subject).toBe('Payment received · ₪120.00');
    expect(sent[0].html).toContain('Wash package');
  });
  it('no email on file / zero amount → skipped, never throws', async () => {
    const { sendPaymentLetter } = mod;
    userRow = null;
    expect(await sendPaymentLetter({ userId: 'u3', amountIls: 10, itemDescription: { he: 'x', en: 'x' }, reference: 'r' })).toBe('skipped');
    expect(await sendPaymentLetter({ userId: 'u3', amountIls: 0, itemDescription: { he: 'x', en: 'x' }, reference: 'r' })).toBe('skipped');
    expect(sent).toHaveLength(0);
  });
  it('reads the last four digits from either SUMIT field', async () => {
    const { readSumitCardLast4 } = mod;
    expect(readSumitCardLast4(RAW)).toBe('4935');
    expect(readSumitCardLast4({ Data: { Payment: { PaymentMethod: { CreditCard_CardMask: 'XXXXXXXXXXXX1234' } } } })).toBe('1234');
    expect(readSumitCardLast4(null)).toBeNull();
  });
});

describe('wiring: one email per payment', () => {
  it('SUMIT’s own mail is switched off only where our letter replaces it', () => {
    const client = R('server/services/SumitClient.ts');
    expect(client).toContain('...(input.notifyCustomer === false ? { UpdateCustomerOnSuccess: false } : {}),');
    expect(R('server/services/SumitBookingPayment.ts')).toContain('notifyCustomer: false,');
    expect(R('server/routes/payments-sumit.ts')).toContain('notifyCustomer: false,');
    expect(R('server/routes/shop.ts')).toContain('notifyCustomer: false,');
    // guest eGift and save-card keep SUMIT's mail — it is the customer's copy of the document
    expect(R('server/routes/egift-guest.ts')).not.toContain('notifyCustomer');
    expect(R('server/routes/save-card.ts')).not.toContain('notifyCustomer');
  });
  it('payments return sends only on the first verification', () => {
    const src = R('server/routes/payments-sumit.ts');
    expect(src).toContain("const firstVerification = claim === 'claimed';");
    expect(src).toContain('if (firstVerification && ext) {');
    expect(src).toContain('await sendPaymentLetter({');
  });
  it('booking return sends only after winning the confirm flip', () => {
    const src = R('server/routes/booking-requests.ts');
    const flipLost = src.indexOf('if (flipped.length === 0) {');
    const letter = src.indexOf("void import('../services/paymentLetter')");
    expect(flipLost).toBeGreaterThan(0);
    expect(letter).toBeGreaterThan(flipLost);
  });
});
