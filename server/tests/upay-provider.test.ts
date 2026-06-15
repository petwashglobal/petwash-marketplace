/**
 * UpayProvider — the UPay online-clearing client scaffold.
 *
 * The key is wired (UPAY_API_KEY). Charge must FAIL CLOSED until the API6
 * msg/encryption spec is implemented — never a fake success (Rule H).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UpayProvider, UPAY_BASE_URL, UPAY_REDIRECT_PATH } from '../services/payment-providers/UpayProvider';

const saved = process.env.UPAY_API_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.UPAY_API_KEY;
  else process.env.UPAY_API_KEY = saved;
});

describe('UpayProvider', () => {
  it('isConfigured reflects UPAY_API_KEY presence', () => {
    const p = new UpayProvider();
    delete process.env.UPAY_API_KEY;
    expect(p.isConfigured()).toBe(false);
    process.env.UPAY_API_KEY = 'test-key';
    expect(p.isConfigured()).toBe(true);
  });

  it('health reports the real endpoint and that charge is NOT ready yet', () => {
    process.env.UPAY_API_KEY = 'test-key';
    const h = new UpayProvider().health();
    expect(h.configured).toBe(true);
    expect(h.chargeReady).toBe(false);
    expect(h.redirectEndpoint).toBe(`${UPAY_BASE_URL}${UPAY_REDIRECT_PATH}`);
    expect(h.reason).toMatch(/API6|spec/i);
  });

  it('createPaymentRedirect FAILS CLOSED (no fake success) when configured but spec pending', async () => {
    process.env.UPAY_API_KEY = 'test-key';
    const r = await new UpayProvider().createPaymentRedirect({
      amount: 59, description: 'wash', returnUrl: 'https://petwash.co.il/thanks',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('spec-pending');
  });

  it('createPaymentRedirect reports not-configured when key absent', async () => {
    delete process.env.UPAY_API_KEY;
    const r = await new UpayProvider().createPaymentRedirect({
      amount: 59, description: 'wash', returnUrl: 'https://petwash.co.il/thanks',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-configured');
  });
});
