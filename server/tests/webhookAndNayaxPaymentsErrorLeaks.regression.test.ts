/**
 * Task 6 — CEO fire order 101-140.
 *
 * (a) WEBHOOK response bodies must not leak raw error.message. Every
 *     webhook receiver in scope is already generic-only — this pin
 *     freezes them so nothing regresses.
 *
 *     Webhooks in scope:
 *       - server/routes/nayax-webhooks.ts
 *       - server/routes/sumit-webhook.ts
 *       - server/routes/maya-voice-webhook.ts
 *       - server/routes/nayax-monyx-events.ts
 *       - server/routes/admin-nayax-events.ts
 *       - server/routes/payments-sumit.ts
 *
 * (b) NAYAX-PAYMENTS client-facing route (RESPONSE-ONLY sanitisation,
 *     matching the approved PR #1783 D12 pattern). No business logic
 *     change: NayaxSparkService.* calls unchanged, request shape
 *     unchanged, response status codes unchanged. Only the 5xx error
 *     BODY has been swapped from raw error.message to a generic string
 *     plus a discriminator code.
 *
 * Internal logger.error contexts (which INTENTIONALLY carry
 * error.message for internal trace) are explicitly permitted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const WEBHOOK_FILES = [
  'routes/nayax-webhooks.ts',
  'routes/sumit-webhook.ts',
  'routes/maya-voice-webhook.ts',
  'routes/nayax-monyx-events.ts',
  'routes/admin-nayax-events.ts',
  'routes/payments-sumit.ts',
];

const PAYMENT_ROUTE = 'routes/nayax-payments.ts';

function extractResponseBodies(src: string): string[] {
  const out: string[] = [];
  const rx = /res\.status\(\d{3}\)\s*\.json\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('Webhook receivers never leak error.message in response bodies', () => {
  for (const rel of WEBHOOK_FILES) {
    it(`${rel}: every res.status(...).json body is generic`, () => {
      const src = R(rel);
      const bodies = extractResponseBodies(src);
      for (const body of bodies) {
        expect(body).not.toMatch(/\berror\.message\b/);
        expect(body).not.toMatch(/\berr\.message\b/);
        expect(body).not.toMatch(/\berror\.stack\b/);
        expect(body).not.toMatch(/\berr\.stack\b/);
        expect(body).not.toMatch(/instanceof\s+Error\s*\?\s*(error|err|e)\.message/);
      }
    });
  }
});

describe('nayax-payments.ts response bodies are generic (D12 response-only)', () => {
  it('every res.status(...).json body is generic', () => {
    const src = R(PAYMENT_ROUTE);
    const bodies = extractResponseBodies(src);
    expect(bodies.length).toBeGreaterThan(5);
    for (const body of bodies) {
      expect(body).not.toMatch(/\berror\.message\b/);
      expect(body).not.toMatch(/\berr\.message\b/);
      expect(body).not.toMatch(/\berror\.stack\b/);
      expect(body).not.toMatch(/\berr\.stack\b/);
      expect(body).not.toMatch(/instanceof\s+Error\s*\?\s*(error|err|e)\.message/);
    }
  });

  it('all 10 new NAYAX_*_500 discriminator codes are present', () => {
    const src = R(PAYMENT_ROUTE);
    for (const c of [
      "'NAYAX_WASH_INIT_500'",
      "'NAYAX_AUTH_500'",
      "'NAYAX_VEND_500'",
      "'NAYAX_SETTLE_500'",
      "'NAYAX_VOID_500'",
      "'NAYAX_MACHINE_STATUS_500'",
      "'NAYAX_LOYALTY_CREATE_500'",
      "'NAYAX_QR_REDEEM_500'",
      "'NAYAX_TX_LOOKUP_500'",
      "'NAYAX_TX_HISTORY_500'",
    ]) expect(src).toContain(c);
  });

  it('logger tags on every touched catch block are preserved', () => {
    const src = R(PAYMENT_ROUTE);
    for (const tag of [
      '[Nayax API] Wash initiation failed',
      '[Nayax API] Authorization failed',
      '[Nayax API] Remote vend failed',
      '[Nayax API] Settlement failed',
      '[Nayax API] Void failed',
      '[Nayax API] Machine status check failed',
      '[Nayax API] Loyalty card creation failed',
      '[Nayax API] QR redemption failed',
      '[Nayax API] Transaction lookup failed',
      '[Nayax API] Customer transaction history failed',
    ]) expect(src).toContain(tag);
  });

  it('D12 firewall: NayaxSparkService call surface untouched (RESPONSE-ONLY)', () => {
    const src = R(PAYMENT_ROUTE);
    // Every business-logic call still present — no signature/argument change.
    for (const symbol of [
      'NayaxSparkService.initiateWashCycle',
      'NayaxSparkService.authorizePayment',
      'NayaxSparkService.executeRemoteVend',
      'NayaxSparkService.settleTransaction',
      'NayaxSparkService.voidTransaction',
      'NayaxSparkService.getMachineStatus',
      'NayaxSparkService.createLoyaltyCard',
      'NayaxSparkService.redeemQrCode',
      'NayaxSparkService.getTransaction',
      'NayaxSparkService.getCustomerTransactions',
    ]) expect(src).toContain(symbol);
  });
});
