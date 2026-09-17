/**
 * A paid guest gift card reaches the person it was bought for (2026-09-17).
 *
 * /api/egift/guest/return issued the voucher and emailed ONLY the buyer's
 * receipt. The recipient never learned the code, while /egift told the buyer
 * "We emailed the gift to your recipient". Now the return handler sends the
 * gift email (code = voucher serial, link to /claim?code=…), and a delivery
 * failure — including mail not being configured — raises an admin alert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const h = vi.hoisted(() => ({
  order: null as any,
  mailConfigured: true,
  mailThrows: false,
  sent: [] as any[],
  alerts: [] as any[],
}));

vi.mock('../db', () => {
  const chain: any = {
    select: () => chain, from: () => chain, where: () => chain,
    limit: async () => (h.order ? [h.order] : []),
    update: () => ({ set: (v: any) => ({ where: async () => { Object.assign(h.order, v); } }) }),
  };
  return { db: chain };
});
vi.mock('../services/SumitClient', () => ({
  sumitClient: { getTransaction: async () => ({ wired: true, valid: true, amountCents: 25000, raw: {} }) },
}));
vi.mock('../lib/sumitExternalRef', () => ({ sumitExternalRefMismatch: () => false, readSumitExternalRef: () => null }));
vi.mock('../lib/sumitPaymentReturn', () => ({
  readSumitPaymentIdFromReturn: (q: any) => q['OG-PaymentID'] ?? null,
  claimSumitPayment: async () => ({ ok: true }),
  claimAllowsFulfil: () => true,
}));
vi.mock('../services/unifiedVoucherService', () => ({
  issueVoucher: async () => ({ id: 'UV-20260917-ABCDEF0123', serialNumber: 'PWV-2026-0123456789ABCDEF0123' }),
}));
vi.mock('../services/IsraeliDigitalReceiptService', () => ({
  IsraeliDigitalReceiptService: { generateReceipt: async () => ({}) },
}));
vi.mock('../services/egiftEmailService', () => ({
  sendEGiftConfirmationEmail: async (cfg: any) => {
    if (h.mailThrows) throw new Error('sendgrid down');
    h.sent.push(cfg);
  },
}));
vi.mock('../lib/sendgrid', () => ({ isSendGridConfigured: () => h.mailConfigured }));
vi.mock('../services/AlertEngine', () => ({ createOrUpdateAlert: async (a: any) => { h.alerts.push(a); } }));
vi.mock('../lib/verifyTurnstile', () => ({ verifyTurnstileToken: async () => ({ success: true }) }));
vi.mock('../middleware/rateLimiter', () => ({ paymentLimiter: (_q: any, _s: any, n: any) => n() }));
vi.mock('../middleware/auditLog', () => ({ auditMiddleware: () => (_q: any, _s: any, n: any) => n() }));

import router from '../routes/egift-guest';

const app = express();
app.use('/api/egift', router);

describe('guest eGift return — the recipient gets the gift', () => {
  beforeEach(() => {
    h.order = {
      externalId: 'eg_1', status: 'pending', amountIlsCents: 25000,
      senderEmail: 'buyer@example.com', senderName: 'Dana',
      recipientEmail: 'friend@example.com', recipientName: 'Yoni', recipientPhone: null,
      message: 'Happy birthday',
    };
    h.mailConfigured = true; h.mailThrows = false; h.sent = []; h.alerts = [];
  });

  it('emails the recipient the code and a claim link, then reports success', async () => {
    const res = await request(app).get('/api/egift/guest/return?ext=eg_1&OG-PaymentID=T1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/egift\?status=success$/);
    expect(h.order.status).toBe('issued');
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({
      recipientEmail: 'friend@example.com',
      senderEmail: 'buyer@example.com',
      value: 250,
      publicCode: 'PWV-2026-0123456789ABCDEF0123',
      expiresInMonths: 60,
    });
    expect(h.sent[0].claimUrl).toMatch(/\/claim\?code=PWV-2026-0123456789ABCDEF0123$/);
    expect(h.alerts).toHaveLength(0);
  });

  it('a failed send raises a critical alert and still keeps the paid voucher', async () => {
    h.mailThrows = true;
    const res = await request(app).get('/api/egift/guest/return?ext=eg_1&OG-PaymentID=T1');
    expect(res.headers.location).toMatch(/status=success/);
    expect(h.order.status).toBe('issued');
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0]).toMatchObject({ category: 'egift', severity: 'critical', dedupeKey: 'egift_guest_delivery:eg_1' });
  });

  it('mail not configured counts as a failed delivery (no silent skip)', async () => {
    h.mailConfigured = false;
    await request(app).get('/api/egift/guest/return?ext=eg_1&OG-PaymentID=T1');
    expect(h.sent).toHaveLength(0);
    expect(h.alerts).toHaveLength(1);
  });
});
