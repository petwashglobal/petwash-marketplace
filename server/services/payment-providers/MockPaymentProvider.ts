/**
 * MockPaymentProvider — used ONLY in CI / test / mock mode.
 *
 * Activation gate: getPaymentProviderMode() === 'mock'
 * (server/lib/payment-provider-mode.ts).
 *
 * Per Rule H ("no fake success"): every method returns ok:false. This
 * provider exists ONLY so the server can boot and run tests without
 * real payment-vendor credentials. It MUST NEVER be used in production
 * for an actual customer-facing charge.
 *
 * Boundaries:
 *   • No live SUMIT/UPay calls.
 *   • No Stripe fallback.
 *   • No Tranzila fallback.
 *   • No fake success state — every result has ok:false with reason.
 *   • No customer balance mutation. The internal ledger is the source
 *     of truth for wallet/credits/loyalty; mock provider does NOT
 *     touch it (call sites must short-circuit before touching state).
 */

export type MockPaymentReason = 'mock-mode';

export interface MockPaymentResult {
  ok: false;
  reason: MockPaymentReason;
  detail: string;
  provider: 'mock';
}

const refused = (action: string): MockPaymentResult => ({
  ok: false,
  reason: 'mock-mode',
  detail: `${action} refused: PAYMENT_PROVIDER_MODE=mock — no real provider call`,
  provider: 'mock',
});

export class MockPaymentProvider {
  public static readonly providerName = 'mock';

  async charge(): Promise<MockPaymentResult> {
    return refused('charge');
  }

  async authorize(): Promise<MockPaymentResult> {
    return refused('authorize');
  }

  async capture(): Promise<MockPaymentResult> {
    return refused('capture');
  }

  async refund(): Promise<MockPaymentResult> {
    return refused('refund');
  }

  async void(): Promise<MockPaymentResult> {
    return refused('void');
  }

  async payout(): Promise<MockPaymentResult> {
    return refused('payout');
  }

  /**
   * Webhook signature verification in mock mode is always FALSE.
   * A mock provider never claims a webhook is authentic — this prevents
   * a CI environment from being mistaken for a trust path.
   */
  async verifyWebhook(): Promise<false> {
    return false;
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
