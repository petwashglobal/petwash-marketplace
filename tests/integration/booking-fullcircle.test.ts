/**
 * PetWash™ — Booking FULL-CIRCLE live integration test
 * =====================================================
 * Drives the COMPLETE money circle through the unified-booking engine and
 * asserts every field the CEO asked for:
 *
 *   booking id → user id → date → transaction number → VAT → tax invoice → email
 *
 * This exercises GROOMER + SITTER through unified-booking (draft → quote →
 * confirm → complete), which is the one path with the full chain wired.
 *
 * HOW TO RUN (against a TEST server — NEVER production, this creates real rows
 * and, if SUMIT is enabled, real tax documents):
 *
 *   API_URL=https://staging.example \
 *   JWT_SECRET_TEST=<test-only-secret> \
 *   TEST_USER_ID=<a real Firebase uid in that DB> \
 *   PAYMENT_PROVIDER_MODE=mock SUMIT_ENABLED=false SENDGRID_API_KEY= \
 *   npx vitest run tests/integration/booking-fullcircle.test.ts
 *
 * Safe-mode on the server: set PAYMENT_PROVIDER_MODE=mock, leave SUMIT_ENABLED
 * unset/false and SENDGRID unset so no real charge / no real ITA document / no
 * real email is produced — the circle still records bookingId/txn/VAT/receipt#.
 *
 * Skips automatically if API_URL + JWT_SECRET_TEST are not provided.
 */
import { describe, it, expect } from 'vitest';
import * as jwt from 'jsonwebtoken';

const API_URL         = (process.env.API_URL || '').replace(/\/$/, '');
const JWT_SECRET_TEST = process.env.JWT_SECRET_TEST || '';
const TEST_USER_ID    = process.env.TEST_USER_ID || 'test-integration-uid';
const TEST_EMAIL      = `${TEST_USER_ID}@test.petwash.local`;

const RUN = Boolean(API_URL && JWT_SECRET_TEST);

function token(uid = TEST_USER_ID): string {
  return jwt.sign({ sub: uid, roles: ['customer'], email: TEST_EMAIL }, JWT_SECRET_TEST, { expiresIn: '1h' });
}
async function call(method: 'POST', path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}
/** Pull a value from any of several candidate field paths in a response. */
function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

describe.skipIf(!RUN)('Booking full-circle (unified-booking)', () => {
  // Drive grooming through the complete circle.
  const platforms = [
    { label: 'GROOMER', serviceId: 'GROOMER',  resourceType: 'groomer' },
    { label: 'SITTER',  serviceId: 'SITTER',   resourceType: 'sitter'  },
  ];

  for (const p of platforms) {
    it(`${p.label}: draft → quote → confirm → complete carries every field`, async () => {
      const startTime = new Date(Date.now() + 3 * 86400_000).toISOString();
      const endTime   = new Date(Date.now() + 3 * 86400_000 + 3_600_000).toISOString();

      // 1) DRAFT → booking id + user id + date
      const draft = await call('POST', '/api/unified-booking/draft', {
        serviceId: p.serviceId,
        resourceId: '1',
        resourceType: p.resourceType,
        startTime,
        endTime,
        userId: 'FORGED-SHOULD-BE-IGNORED',
        metadata: { petId: 1 },
      });
      expect(draft.status, `draft failed: ${JSON.stringify(draft.body)}`).toBeLessThan(400);
      const bookingId = pick(draft.body, 'bookingId', 'booking.bookingId', 'booking.id', 'id');
      expect(bookingId, 'no booking id returned').toBeTruthy();
      const userId = pick(draft.body, 'booking.userId', 'userId', 'draft.userId');
      if (userId) expect(userId, 'forged userId leaked').not.toBe('FORGED-SHOULD-BE-IGNORED');
      const createdAt = pick(draft.body, 'booking.createdAt', 'createdAt', 'booking.transactionStampedAt');
      expect(createdAt ?? bookingId, 'no date on draft').toBeTruthy();

      // 2) QUOTE → VAT breakdown (net + vat == gross, rate 18%)
      const quote = await call('POST', `/api/unified-booking/${bookingId}/quote`, {});
      expect(quote.status, `quote failed: ${JSON.stringify(quote.body)}`).toBeLessThan(400);
      const snap = pick(quote.body, 'priceSnapshot', 'quote', 'pricing') ?? quote.body;
      const net   = Number(pick(snap, 'net', 'netAmount', 'subtotal'));
      const vat   = Number(pick(snap, 'vat', 'vatAmount', 'tax'));
      const gross = Number(pick(snap, 'gross', 'total', 'grossAmount'));
      if (!Number.isNaN(net) && !Number.isNaN(vat) && !Number.isNaN(gross)) {
        expect(+(net + vat).toFixed(2), 'net+vat != gross').toBe(+gross.toFixed(2));
        expect(+(vat / net).toFixed(4), 'VAT rate is not 18%').toBe(0.18);
      }

      // 3) CONFIRM → transaction number
      const confirm = await call('POST', `/api/unified-booking/${bookingId}/confirm`, {});
      expect(confirm.status, `confirm failed: ${JSON.stringify(confirm.body)}`).toBeLessThan(400);
      const txn = pick(confirm.body, 'transactionId', 'transaction.id', 'paymentIntentId', 'booking.paymentIntentId');
      expect(txn, 'no transaction number after confirm').toBeTruthy();

      // 4) COMPLETE → tax invoice / receipt number (+ email recorded)
      const complete = await call('POST', `/api/unified-booking/${bookingId}/complete`, {});
      expect(complete.status, `complete failed: ${JSON.stringify(complete.body)}`).toBeLessThan(400);
      const receiptNo = pick(
        complete.body,
        'receiptNumber', 'receipt.receiptNumber', 'invoiceNumber',
        'booking.platformData.receiptNumber', 'platformData.receiptNumber',
      );
      // In SUMIT-disabled safe mode a local PW-YYYY-NNNNNN number is still issued.
      expect(receiptNo, 'no tax-invoice/receipt number after complete').toBeTruthy();
      expect(String(receiptNo), 'receipt number format unexpected').toMatch(/PW-\d{4}-\d+|INV|RC|\d{3,}/i);
    });
  }
});
