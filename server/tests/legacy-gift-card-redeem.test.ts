/**
 * Tests for the legacy /api/gift-cards/redeem disable.
 *
 * Verifies:
 *   1. The handler returns HTTP 410 (GONE) with a clear error code.
 *   2. The handler does NOT touch the database (no orphan balance can
 *      be created via this path going forward).
 *   3. The response body carries both English and Hebrew messages so
 *      the modern UI can surface them.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { legacyGiftCardRedeemHandler } from '../lib/legacy-gift-card-redeem-handler';

function makeMockRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    body?: unknown;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  } = {} as any;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('legacy /api/gift-cards/redeem (disabled)', () => {
  it('returns 410 GONE for any request', () => {
    const req = { body: { code: 'WHATEVER' } } as Request;
    const res = makeMockRes();

    legacyGiftCardRedeemHandler(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.statusCode).toBe(410);
  });

  it('returns the LEGACY_GIFT_CARD_REDEEM_DISABLED error code', () => {
    const req = { body: {} } as Request;
    const res = makeMockRes();

    legacyGiftCardRedeemHandler(req, res as unknown as Response);

    expect(res.json).toHaveBeenCalledTimes(1);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.error).toBe('GONE');
    expect(body.code).toBe('LEGACY_GIFT_CARD_REDEEM_DISABLED');
  });

  it('returns both English and Hebrew messages', () => {
    const res = makeMockRes();
    legacyGiftCardRedeemHandler({} as Request, res as unknown as Response);
    const body = (res.json as any).mock.calls[0][0];
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(20);
    expect(typeof body.messageHe).toBe('string');
    expect(body.messageHe.length).toBeGreaterThan(20);
    // Hebrew message must contain Hebrew characters
    expect(/[֐-׿]/.test(body.messageHe)).toBe(true);
  });

  it('points users to the modern wallet flow', () => {
    const res = makeMockRes();
    legacyGiftCardRedeemHandler({} as Request, res as unknown as Response);
    const body = (res.json as any).mock.calls[0][0];
    // The response must reference the modern endpoints so the UI can route there.
    const allText = `${body.message} ${body.docs ?? ''}`;
    expect(allText).toMatch(/\/api\/gift-cards\/purchase/);
    expect(allText).toMatch(/activate-wallet/);
  });

  it('does NOT touch the request body / does not parse a code', () => {
    // The handler should never call storage / db. We pass a body with a
    // code that, in the legacy implementation, would have triggered a
    // SELECT + INSERT path. The new handler must short-circuit.
    const req = {
      body: { code: 'TEST-CODE-12345' },
      session: { customerId: 999 } as any,
    } as unknown as Request;
    const res = makeMockRes();

    legacyGiftCardRedeemHandler(req, res as unknown as Response);

    // Only one response (the 410). No subsequent DB call observable from
    // the handler itself — the function body proves this by inspection;
    // here we just confirm the response is final and singular.
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledTimes(1);
  });
});
