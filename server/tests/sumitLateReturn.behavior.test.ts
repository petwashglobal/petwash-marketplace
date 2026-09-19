/**
 * The late return (2026-09-19): a paid SUMIT checkout whose customer closed
 * the tab is replayed through OUR OWN /return route, exactly as the browser
 * would have called it. This module never fulfils anything itself — it builds
 * the request and reads the route's redirect. Pinned here:
 *   • the route + querystring per surface, from the ref formats the surfaces mint
 *   • what counts as "fulfilled" per surface (the success page, nothing else)
 *   • the request follows no redirect, carries OG-PaymentID, and times out
 *   • a ₪1 card-save is never replayed
 */
import { describe, it, expect } from 'vitest';
import {
  lateReturnTargetFor,
  classifyLateReturnLocation,
  lateReturnBaseUrl,
  replayLateReturn,
} from '../lib/sumitLateReturn';

describe('lateReturnTargetFor — one return route per surface, as beginRedirect registered it', () => {
  it('booking: bkg_<requestId>_<t36> → /api/booking-requests/:requestId/sumit-return', () => {
    const t = lateReturnTargetFor('bkg_BR-2026-abc_m1x9', '4411');
    expect(t).toEqual({
      surface: 'booking',
      path: '/api/booking-requests/BR-2026-abc/sumit-return?ext=bkg_BR-2026-abc_m1x9&OG-PaymentID=4411',
    });
  });

  it('booking: a request id that itself contains underscores keeps everything before the LAST one', () => {
    const t = lateReturnTargetFor('bkg_req_with_underscores_zz', '1');
    expect(t?.path.startsWith('/api/booking-requests/req_with_underscores/sumit-return')).toBe(true);
  });

  it('guest eGift: egiftguest_<uuid> → /api/egift/guest/return?ext=', () => {
    const t = lateReturnTargetFor('egiftguest_0c1d', '77');
    expect(t).toEqual({ surface: 'egift_guest', path: '/api/egift/guest/return?ext=egiftguest_0c1d&OG-PaymentID=77' });
  });

  it('wallet / shop / order ids → /api/payments/sumit/return?ext=', () => {
    expect(lateReturnTargetFor('pw-uid-m2', '5')?.surface).toBe('wallet_purchase');
    expect(lateReturnTargetFor('shop-cart42', '5')?.surface).toBe('wallet_purchase');
    expect(lateReturnTargetFor('ord_9', '5')?.path).toBe('/api/payments/sumit/return?ext=ord_9&OG-PaymentID=5');
  });

  it('a ₪1 card-save is not an order and is never replayed', () => {
    expect(lateReturnTargetFor('savecard_abcdef', '5')).toBeNull();
  });

  it('refuses refs that could break out of the querystring, and empty ids', () => {
    expect(lateReturnTargetFor('bkg_a b_c', '5')).toBeNull();
    expect(lateReturnTargetFor('pw-x/../admin', '5')).toBeNull();
    expect(lateReturnTargetFor('pw-x?y', '5')).toBeNull();
    expect(lateReturnTargetFor('pw-x#y', '5')).toBeNull();
    expect(lateReturnTargetFor('', '5')).toBeNull();
    expect(lateReturnTargetFor('pw-x', '')).toBeNull();
    expect(lateReturnTargetFor('bkg_', '5')).toBeNull();
  });

  it('encodes the ref and the payment id', () => {
    const t = lateReturnTargetFor('pw-a&b', 'p=1');
    expect(t?.path).toBe('/api/payments/sumit/return?ext=pw-a%26b&OG-PaymentID=p%3D1');
  });
});

describe('classifyLateReturnLocation — only the success page means fulfilled', () => {
  it('booking', () => {
    expect(classifyLateReturnLocation('booking', 'https://petwash.co.il/booking/confirmation/BR-1?payment=success')).toBe('fulfilled');
    expect(classifyLateReturnLocation('booking', 'https://petwash.co.il/booking/confirmation/BR-1?payment=failed')).toBe('refused');
    expect(classifyLateReturnLocation('booking', 'https://petwash.co.il/booking/confirmation/BR-1?payment=successful')).toBe('refused');
  });
  it('guest eGift', () => {
    expect(classifyLateReturnLocation('egift_guest', 'https://petwash.co.il/egift?status=success')).toBe('fulfilled');
    expect(classifyLateReturnLocation('egift_guest', 'https://petwash.co.il/egift?status=failed&ref=x')).toBe('refused');
    expect(classifyLateReturnLocation('egift_guest', 'https://petwash.co.il/egift?status=issue_failed&ref=x')).toBe('refused');
  });
  it('wallet: /payment-success, but NOT when the route says fulfilment is still pending', () => {
    expect(classifyLateReturnLocation('wallet_purchase', 'https://petwash.co.il/payment-success?ref=pw-1')).toBe('fulfilled');
    expect(classifyLateReturnLocation('wallet_purchase', 'https://petwash.co.il/payment-success?ref=pw-1&fulfil=pending')).toBe('refused');
    expect(classifyLateReturnLocation('wallet_purchase', 'https://petwash.co.il/payment-failed?ref=pw-1')).toBe('refused');
  });
  it('no location is never fulfilled', () => {
    expect(classifyLateReturnLocation('booking', null)).toBe('refused');
    expect(classifyLateReturnLocation('booking', '')).toBe('refused');
  });
});

describe('lateReturnBaseUrl — this process, on loopback', () => {
  it('defaults to 127.0.0.1 on PORT (Cloud Run) and honours an explicit override', () => {
    expect(lateReturnBaseUrl({ PORT: '8080' } as any)).toBe('http://127.0.0.1:8080');
    expect(lateReturnBaseUrl({} as any)).toBe('http://127.0.0.1:8080');
    expect(lateReturnBaseUrl({ SUMIT_LATE_RETURN_BASE_URL: 'https://petwash.co.il/' } as any)).toBe('https://petwash.co.il');
  });
});

describe('replayLateReturn — the request the browser never made', () => {
  const fakeFetch = (status: number, location: string | null, capture: any) =>
    (async (url: any, init: any) => {
      capture.url = String(url);
      capture.init = init;
      return { status, headers: { get: (k: string) => (k.toLowerCase() === 'location' ? location : null) } } as any;
    }) as unknown as typeof fetch;

  it('GETs the surface route on the given base, follows no redirect, and reads the verdict from Location', async () => {
    const cap: any = {};
    const r = await replayLateReturn(
      { paymentId: '9100', ref: 'bkg_BR-xyz_m1' },
      { fetchImpl: fakeFetch(302, 'https://petwash.co.il/booking/confirmation/BR-xyz?payment=success', cap), baseUrl: 'http://127.0.0.1:9999' },
    );
    expect(r).toEqual({ outcome: 'fulfilled', surface: 'booking', location: 'https://petwash.co.il/booking/confirmation/BR-xyz?payment=success' });
    expect(cap.url).toBe('http://127.0.0.1:9999/api/booking-requests/BR-xyz/sumit-return?ext=bkg_BR-xyz_m1&OG-PaymentID=9100');
    expect(cap.init.method).toBe('GET');
    expect(cap.init.redirect).toBe('manual');
    expect(cap.init.headers['x-petwash-late-return']).toBe('9100');
  });

  it('a failure redirect is refused, with the status and location for the alert', async () => {
    const r = await replayLateReturn(
      { paymentId: '1', ref: 'egiftguest_a' },
      { fetchImpl: fakeFetch(302, 'https://petwash.co.il/egift?status=failed&ref=egiftguest_a', {}), baseUrl: 'http://x' },
    );
    expect(r).toEqual({ outcome: 'refused', surface: 'egift_guest', status: 302, location: 'https://petwash.co.il/egift?status=failed&ref=egiftguest_a' });
  });

  it('a non-redirect answer (500, 404, 200) is refused, never fulfilled', async () => {
    for (const status of [500, 404, 200]) {
      const r = await replayLateReturn({ paymentId: '1', ref: 'pw-a' }, { fetchImpl: fakeFetch(status, null, {}), baseUrl: 'http://x' });
      expect(r.outcome).toBe('refused');
    }
  });

  it('a ref that is not replayable is reported as unsupported and no request is made', async () => {
    let called = false;
    const r = await replayLateReturn(
      { paymentId: '1', ref: 'savecard_x' },
      { fetchImpl: (async () => { called = true; return {} as any; }) as unknown as typeof fetch, baseUrl: 'http://x' },
    );
    expect(r).toEqual({ outcome: 'unsupported', reason: 'ref_not_replayable' });
    expect(called).toBe(false);
  });

  it('a transport error is an error outcome, not a throw', async () => {
    const r = await replayLateReturn(
      { paymentId: '1', ref: 'pw-a' },
      { fetchImpl: (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch, baseUrl: 'http://x' },
    );
    expect(r).toEqual({ outcome: 'error', surface: 'wallet_purchase', reason: 'ECONNREFUSED' });
  });

  it('times out instead of hanging the watch', async () => {
    const hanging = ((_url: any, init: any) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })) as unknown as typeof fetch;
    const r = await replayLateReturn({ paymentId: '1', ref: 'pw-a' }, { fetchImpl: hanging, baseUrl: 'http://x', timeoutMs: 20 });
    expect(r).toEqual({ outcome: 'error', surface: 'wallet_purchase', reason: 'timeout' });
  });
});
