/**
 * PurchaseActivationService — Phase-1 webhook activation tests.
 *
 * Mocks the DB (thin in-memory drizzle-shaped stub), WalletService,
 * SumitClient, the audit writer, and the alerting sink — the same isolation
 * style the other server/tests/sumit*.test.ts files use. No real DB / network.
 *
 * Verifies the CEO invariant: ONE order, ONE payment event, ONE activation,
 * ONE audit ledger — duplicate webhooks are no-ops, unverified payments never
 * activate, and provider/eGift products are left recoverable (never faked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
const addCredits = vi.fn(async () => {});
vi.mock('../services/WalletService', () => ({
  walletService: { addCredits: (...a: any[]) => addCredits(...a) },
}));

const isWired = vi.fn(() => false);
const getTransaction = vi.fn(async () => ({ wired: true, valid: true }));
vi.mock('../services/SumitClient', () => ({
  sumitClient: {
    isWired: () => isWired(),
    getTransaction: (...a: any[]) => getTransaction(...(a as [string])),
  },
}));

const recordAuditEvent = vi.fn(async () => ({ auditId: 'a', hash: 'h' }));
vi.mock('../utils/auditSignature', () => ({
  recordAuditEvent: (...a: any[]) => recordAuditEvent(...a),
}));

const sendAlert = vi.fn(async () => {});
vi.mock('../monitoring', () => ({ sendAlert: (...a: any[]) => sendAlert(...a) }));

// ShopService mock — the SHOP_ORDER activation path dynamically imports it
// and does capture-then-create. These stubs let the tests exercise the
// two failure branches that must NOT strand a captured payment:
//   (a) cart drifted between price+charge and activation
//   (b) createOrder throws (stock race etc.) after capture
const validateCartForCheckout = vi.fn(async () => ({ id: 'CART-1', subtotalCents: 5000 }));
const createOrder = vi.fn(async () => ({ id: 'ORD-1', orderNumber: 'SO-1', items: [], deliveryAddress: null }));
const generateTaxInvoice = vi.fn(async () => {});
const getUserProfile = vi.fn(async () => ({ email: 'buyer@petwash.co.il', displayName: 'Buyer' }));
vi.mock('../services/ShopService', () => ({
  ShopService: class {
    validateCartForCheckout(...a: any[]) { return validateCartForCheckout(...a); }
    createOrder(...a: any[]) { return createOrder(...a); }
    generateTaxInvoice(...a: any[]) { return generateTaxInvoice(...a); }
    getUserProfile(...a: any[]) { return getUserProfile(...a); }
  },
}));

// Email templates + luxury email service are dynamically imported inside
// the SHOP_ORDER branch as best-effort — stub them so the "happy path"
// test doesn't reach for a real SMTP transport.
vi.mock('../email/templates/shop-order-confirmation-2026', () => ({
  shopOrderConfirmation: () => '<html></html>',
}));
vi.mock('../email/luxury-email-service', () => ({
  sendLuxuryEmail: vi.fn(async () => {}),
}));

// In-memory DB state the stub reads/writes.
interface PurchaseRow {
  id: string;
  surface: string;
  surfaceRefId: string;
  buyerUserId: string;
  productType: string;
  amountCents: number;
  status: string;
  transactionId: string | null;
  metadataJson: Record<string, unknown>;
}
const state = {
  purchases: [] as PurchaseRow[],
  events: [] as Array<{ providerName: string | null; providerReference: string | null }>,
  // Which column the next select filters on (set by the mocked eq()).
  lastWhere: null as any,
};

// eq/and/inArray return descriptors the stub interprets.
vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ _t: 'eq', col, val }),
  and: (...parts: any[]) => ({ _t: 'and', parts }),
  inArray: (col: any, vals: any[]) => ({ _t: 'in', col, vals }),
}));

// Column markers — the schema mock returns these; eq() captures them.
vi.mock('@shared/schema', () => ({
  purchases: {
    id: { _col: 'id' },
    surface: { _col: 'surface' },
    surfaceRefId: { _col: 'surfaceRefId' },
    transactionId: { _col: 'transactionId' },
    status: { _col: 'status' },
    _table: 'purchases',
  },
  purchaseEvents: { _table: 'purchaseEvents' },
}));

function matchPurchase(where: any): (p: PurchaseRow) => boolean {
  if (!where) return () => true;
  if (where._t === 'and') {
    const preds = where.parts.map(matchPurchase);
    return (p) => preds.every((fn: any) => fn(p));
  }
  if (where._t === 'eq') {
    const key = where.col?._col as keyof PurchaseRow;
    return (p) => (p as any)[key] === where.val;
  }
  if (where._t === 'in') {
    const key = where.col?._col as keyof PurchaseRow;
    return (p) => where.vals.includes((p as any)[key]);
  }
  return () => true;
}

vi.mock('../db', () => {
  const db = {
    select: (_cols?: any) => ({
      from: (table: any) => ({
        where: (w: any) => ({
          limit: (_n: number) =>
            Promise.resolve(
              table?._table === 'purchases' ? state.purchases.filter(matchPurchase(w)) : [],
            ),
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        if (table?._table === 'purchaseEvents') {
          const dup = state.events.find(
            (e) => e.providerName === vals.providerName && e.providerReference === vals.providerReference,
          );
          if (dup) return Promise.reject({ code: '23505' });
          state.events.push({ providerName: vals.providerName, providerReference: vals.providerReference });
          return Promise.resolve([{ id: 'evt' }]);
        }
        return Promise.resolve([{ id: 'p' }]);
      },
    }),
    update: (table: any) => ({
      set: (vals: any) => ({
        where: (w: any) => {
          let matched: PurchaseRow[] = [];
          if (table?._table === 'purchases') {
            matched = state.purchases.filter(matchPurchase(w));
            matched.forEach((p) => Object.assign(p, vals));
          }
          // The result is awaitable (returns []) AND chainable via .returning()
          // — the conditional status-flip lock reads matched.length.
          const result: any = Promise.resolve([]);
          result.returning = (_cols?: any) => Promise.resolve(matched.map((p) => ({ id: p.id })));
          return result;
        },
      }),
    }),
  };
  return { db };
});

// Import AFTER mocks are registered.
import { activateFromVerifiedPayment } from '../services/PurchaseActivationService';

function seed(p: Partial<PurchaseRow>): PurchaseRow {
  const row: PurchaseRow = {
    id: p.id ?? 'PUR-1',
    surface: p.surface ?? 'wallet_topup',
    surfaceRefId: p.surfaceRefId ?? 'ext-1',
    buyerUserId: p.buyerUserId ?? 'user-1',
    productType: p.productType ?? 'WASH_PACKAGE',
    amountCents: p.amountCents ?? 5000,
    status: p.status ?? 'payment_pending',
    transactionId: p.transactionId ?? null,
    metadataJson: p.metadataJson ?? {},
  };
  state.purchases.push(row);
  return row;
}

beforeEach(() => {
  state.purchases = [];
  state.events = [];
  addCredits.mockClear();
  recordAuditEvent.mockClear();
  sendAlert.mockClear();
  getTransaction.mockClear();
  isWired.mockReset();
  isWired.mockReturnValue(false);
  getTransaction.mockResolvedValue({ wired: true, valid: true });
  validateCartForCheckout.mockReset();
  validateCartForCheckout.mockResolvedValue({ id: 'CART-1', subtotalCents: 5000 });
  createOrder.mockReset();
  createOrder.mockResolvedValue({ id: 'ORD-1', orderNumber: 'SO-1', items: [], deliveryAddress: null });
  generateTaxInvoice.mockClear();
  getUserProfile.mockClear();
});

describe('activateFromVerifiedPayment — idempotency', () => {
  it('processes a payment ONCE; a duplicate webhook (same providerReference) is a no-op', async () => {
    seed({ id: 'PUR-1', surfaceRefId: 'ext-1', productType: 'WASH_PACKAGE', metadataJson: { washCount: 3 } });

    const first = await activateFromVerifiedPayment({ providerReference: 'txn-99', transactionId: 'txn-99', externalRef: 'ext-1' });
    expect(first.outcome).toBe('activated');
    expect(addCredits).toHaveBeenCalledTimes(1);

    const second = await activateFromVerifiedPayment({ providerReference: 'txn-99', transactionId: 'txn-99', externalRef: 'ext-1' });
    expect(second.outcome).toBe('already_processed');
    // The unique-violation lock means activation never runs a second time.
    expect(addCredits).toHaveBeenCalledTimes(1);
  });
});

describe('activateFromVerifiedPayment — safety', () => {
  it('not-found purchase → no activation, no throw, returns not_found', async () => {
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-x', transactionId: 'txn-x', externalRef: 'missing' });
    expect(r.outcome).toBe('not_found');
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('unverified getTransaction (valid:false) → never activates; status not "activated"', async () => {
    isWired.mockReturnValue(true);
    getTransaction.mockResolvedValue({ wired: true, valid: false, reason: 'declined' });
    const row = seed({ id: 'PUR-2', surfaceRefId: 'ext-2', productType: 'WASH_PACKAGE' });

    const r = await activateFromVerifiedPayment({ providerReference: 'txn-2', transactionId: 'txn-2', externalRef: 'ext-2' });
    expect(r.outcome).toBe('unverified');
    expect(addCredits).not.toHaveBeenCalled();
    expect(row.status).not.toBe('activated');
    expect(row.status).toBe('failed');
  });
});

describe('activateProduct — per-type behaviour', () => {
  it('WASH_PACKAGE → addCredits("wash_package", units, sourceId=purchase.id)', async () => {
    seed({ id: 'PUR-3', surface: 'kiosk', surfaceRefId: 'ext-3', productType: 'WASH_PACKAGE', metadataJson: { washCount: 5 } });
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-3', transactionId: 'txn-3', externalRef: 'ext-3' });
    expect(r.outcome).toBe('activated');
    expect(addCredits).toHaveBeenCalledWith('user-1', 'wash_package', 5, 'sumit_purchase', 'PUR-3', expect.any(String));
  });

  it('wallet_topup surface → promo_credit in CENTS, sourceId=purchase.id', async () => {
    seed({ id: 'PUR-4', surface: 'wallet_topup', surfaceRefId: 'ext-4', productType: 'ACCOUNT_CREDIT', amountCents: 12000 });
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-4', transactionId: 'txn-4', externalRef: 'ext-4' });
    expect(r.outcome).toBe('activated');
    expect(addCredits).toHaveBeenCalledWith('user-1', 'promo_credit', 12000, 'sumit_purchase', 'PUR-4', expect.any(String));
  });

  it('EGIFT_CARD → activation_pending, NO addCredits (recipient-bound is a follow-up)', async () => {
    const row = seed({ id: 'PUR-5', surface: 'gift_card', surfaceRefId: 'ext-5', productType: 'EGIFT_CARD' });
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-5', transactionId: 'txn-5', externalRef: 'ext-5' });
    expect(r.outcome).toBe('pending');
    expect(addCredits).not.toHaveBeenCalled();
    expect(row.status).toBe('paid'); // recoverable, NOT activated, NOT faked
    expect(row.metadataJson.activation).toBe('pending');
    expect(sendAlert).toHaveBeenCalled();
  });

  it('provider booking (PET_SITTING_BOOKING) → activation_pending, NO addCredits (provider commerce disabled)', async () => {
    const row = seed({ id: 'PUR-6', surface: 'booking', surfaceRefId: 'ext-6', productType: 'PET_SITTING_BOOKING' });
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-6', transactionId: 'txn-6', externalRef: 'ext-6' });
    expect(r.outcome).toBe('pending');
    expect(addCredits).not.toHaveBeenCalled();
    expect(row.status).toBe('paid');
  });

  it('provider-commerce leak: PET_SITTING_BOOKING relabeled onto surface=wallet_topup → pending, NO addCredits', async () => {
    // A tampered row that pairs a NON-owned productType with the wallet_topup
    // surface must NOT credit the wallet. The owned-product guard rejects it.
    const row = seed({ id: 'PUR-7', surface: 'wallet_topup', surfaceRefId: 'ext-7', productType: 'PET_SITTING_BOOKING', amountCents: 50000 });
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-7', transactionId: 'txn-7', externalRef: 'ext-7' });
    expect(r.outcome).toBe('pending');
    expect(addCredits).not.toHaveBeenCalled();
    expect(row.status).toBe('paid'); // recoverable, never faked, never credited
  });

  it('owned-product guard: ACCOUNT_CREDIT but surface != wallet_topup → pending, NO addCredits', async () => {
    // Requiring BOTH the owned productType AND the wallet_topup surface means
    // neither label alone can launder an amount into spendable credit.
    const row = seed({ id: 'PUR-8', surface: 'booking', surfaceRefId: 'ext-8', productType: 'ACCOUNT_CREDIT', amountCents: 99999 });
    const r = await activateFromVerifiedPayment({ providerReference: 'txn-8', transactionId: 'txn-8', externalRef: 'ext-8' });
    expect(r.outcome).toBe('pending');
    expect(addCredits).not.toHaveBeenCalled();
    expect(row.status).toBe('paid');
  });
});

describe('activateFromVerifiedPayment — durability (lock does not strand an un-credited purchase)', () => {
  it('lock row exists but purchase still payment_pending → re-attempt and credit (crash recovery)', async () => {
    // Simulate a hard crash that committed the idempotency-lock row BEFORE the
    // credit was granted: pre-seed the event, leave the purchase payment_pending.
    seed({ id: 'PUR-9', surface: 'kiosk', surfaceRefId: 'ext-9', productType: 'WASH_PACKAGE', metadataJson: { washCount: 2 } });
    state.events.push({ providerName: 'sumit', providerReference: 'txn-9' });

    const r = await activateFromVerifiedPayment({ providerReference: 'txn-9', transactionId: 'txn-9', externalRef: 'ext-9' });
    // The duplicate lock must NOT permanently block delivery — it re-attempts.
    expect(r.outcome).toBe('activated');
    expect(addCredits).toHaveBeenCalledWith('user-1', 'wash_package', 2, 'sumit_purchase', 'PUR-9', expect.any(String));
  });

  it('lock row exists AND purchase already activated → already_processed, NO re-credit', async () => {
    seed({ id: 'PUR-10', surface: 'kiosk', surfaceRefId: 'ext-10', productType: 'WASH_PACKAGE', status: 'activated', metadataJson: { washCount: 2 } });
    state.events.push({ providerName: 'sumit', providerReference: 'txn-10' });

    const r = await activateFromVerifiedPayment({ providerReference: 'txn-10', transactionId: 'txn-10', externalRef: 'ext-10' });
    expect(r.outcome).toBe('already_processed');
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('two DIFFERENT references for the SAME paid purchase → second is a no-op (purchase-level lock)', async () => {
    seed({ id: 'PUR-11', surface: 'kiosk', surfaceRefId: 'ext-11', productType: 'WASH_PACKAGE', metadataJson: { washCount: 1 } });

    // First delivery: transaction id reference.
    const first = await activateFromVerifiedPayment({ providerReference: 'txn-11', transactionId: 'txn-11', externalRef: 'ext-11' });
    expect(first.outcome).toBe('activated');
    expect(addCredits).toHaveBeenCalledTimes(1);

    // Second delivery of the SAME payment carrying a DIFFERENT reference (event
    // id) — no lock collision, but the purchase-level conditional flip finds it
    // already past payment_pending and refuses to re-credit.
    const second = await activateFromVerifiedPayment({ providerReference: 'evt-11', transactionId: 'txn-11', externalRef: 'ext-11' });
    expect(second.outcome).toBe('already_processed');
    expect(addCredits).toHaveBeenCalledTimes(1);
  });
});

describe('SHOP_ORDER — capture-then-create safety (Lane B §B7-B8)', () => {
  // The shop card charges the card BEFORE the shop_orders row is written.
  // These invariants pin the two failure branches that must NOT strand a
  // captured payment: the charge lands on the customer either way, so the
  // service must either create the order OR flip to activation_pending +
  // alert. It must never silently succeed with a mismatched order and it
  // must never leave the row in a state that hides a paid-but-un-fulfilled
  // charge from ops.

  it('cart drift after capture → activation_pending, NO createOrder, NO invoice, alert fires', async () => {
    // priced+charged 5000, cart now says 6500 — the customer changed the
    // cart between the SUMIT redirect and the callback. The service MUST
    // NOT build an order at the drifted price.
    validateCartForCheckout.mockResolvedValueOnce({ id: 'CART-1', subtotalCents: 6500 });
    const row = seed({
      id: 'PUR-SHOP-DRIFT', surface: 'shop', surfaceRefId: 'ext-shop-1',
      productType: 'SHOP_ORDER', amountCents: 5000,
      metadataJson: { cartId: 'CART-1', subtotalCents: 5000, totalCents: 5000 },
    });

    const r = await activateFromVerifiedPayment({
      providerReference: 'txn-shop-1', transactionId: 'txn-shop-1', externalRef: 'ext-shop-1',
    });
    expect(r.outcome).toBe('pending');
    expect(createOrder).not.toHaveBeenCalled();
    expect(generateTaxInvoice).not.toHaveBeenCalled();
    expect(row.status).toBe('paid'); // recoverable — money captured, order deferred, ops alerted
    expect(row.metadataJson.activation).toBe('pending');
    expect(sendAlert).toHaveBeenCalled();
  });

  it('createOrder throws (OUT_OF_STOCK race) after capture → activation_pending, NO invoice, alert fires', async () => {
    // Stock re-check inside createOrder fails after the money already
    // landed. This is exactly the case markActivationPending exists for.
    createOrder.mockRejectedValueOnce(new Error('OUT_OF_STOCK'));
    const row = seed({
      id: 'PUR-SHOP-OOS', surface: 'shop', surfaceRefId: 'ext-shop-2',
      productType: 'SHOP_ORDER', amountCents: 5000,
      metadataJson: { cartId: 'CART-1', subtotalCents: 5000, totalCents: 5000 },
    });

    const r = await activateFromVerifiedPayment({
      providerReference: 'txn-shop-2', transactionId: 'txn-shop-2', externalRef: 'ext-shop-2',
    });
    expect(r.outcome).toBe('pending');
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(generateTaxInvoice).not.toHaveBeenCalled();
    expect(row.status).toBe('paid');
    expect(row.metadataJson.activation).toBe('pending');
    expect(sendAlert).toHaveBeenCalled();
  });

  it('missing cartId (tampered metadata) → activation_pending, NO ShopService call, NO addCredits', async () => {
    // A shop_order productType without a cartId in metadata cannot be
    // fulfilled — must never fall back to crediting the wallet or
    // silently succeed. Recoverable: money captured, order deferred.
    const row = seed({
      id: 'PUR-SHOP-NOCART', surface: 'shop', surfaceRefId: 'ext-shop-3',
      productType: 'SHOP_ORDER', amountCents: 5000,
      metadataJson: {},
    });

    const r = await activateFromVerifiedPayment({
      providerReference: 'txn-shop-3', transactionId: 'txn-shop-3', externalRef: 'ext-shop-3',
    });
    expect(r.outcome).toBe('pending');
    expect(validateCartForCheckout).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
    expect(row.status).toBe('paid');
  });
});

describe('webhook flag gate', () => {
  it('flag OFF → isCommerceFlagEnabled false → webhook does not activate', async () => {
    const { isCommerceFlagEnabled, COMMERCE_FLAGS } = await import('@shared/purchase-lifecycle/flags');
    const prev = process.env.FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED;
    delete process.env.FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED;
    expect(isCommerceFlagEnabled(COMMERCE_FLAGS.enabled)).toBe(false);
    // With the flag off, the webhook route never calls activateFromVerifiedPayment,
    // so no purchase mutates and no credit is granted.
    expect(addCredits).not.toHaveBeenCalled();
    if (prev !== undefined) process.env.FF_COMMERCE_UNIFIED_PURCHASE_LIFECYCLE_ENABLED = prev;
  });
});
