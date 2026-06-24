/**
 * Shop checkout wiring (360 audit batch E — #1/#3/#9/#10/#12).
 *
 * The shop checkout was wired to APIs that did NOT exist:
 *   - walletService.deductFromWallet / creditWallet (fictional)
 *   - EscrowService.hold / cancel / release (fictional, booking-shaped real API)
 * and createOrder never decremented stock (oversell) nor ran in a transaction.
 *
 * This PR rewires it to the REAL wallet ledger (atomic, idempotent) under an
 * owned-inventory direct-sale model (no provider escrow), and makes order
 * creation atomic with a guarded stock decrement. Source-introspection guards
 * (the route + service are DB-runtime-bound; checkout stays flag-OFF) so the fix
 * can't silently regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const route = readFileSync(resolve(ROOT, 'server/routes/shop.ts'), 'utf8');
const service = readFileSync(resolve(ROOT, 'server/services/ShopService.ts'), 'utf8');

describe('shop checkout — real money rail + atomic stock', () => {
  it('no longer calls the fictional wallet/escrow APIs in code', () => {
    // Comments may mention them historically; code references must be gone.
    expect(route).not.toMatch(/walletService\.deductFromWallet/);
    expect(route).not.toMatch(/walletService\.creditWallet/);
    expect(route).not.toMatch(/EscrowService\.(hold|cancel|release)\(/);
  });

  it('captures payment via the real wallet ledger (idempotent on the cart)', () => {
    expect(route).toMatch(/from '\.\.\/services\/WalletLedger'/);
    expect(route).toMatch(/ledgerDeduct\(\{/);
    expect(route).toMatch(/idempotencyKey:\s*`shop-checkout:\$\{body\.cartId\}`/);
  });

  it('compensates with a refund if order creation fails after capture', () => {
    expect(route).toMatch(/ledgerRefund\(\{/);
    expect(route).toMatch(/idempotencyKey:\s*`shop-refund:\$\{body\.cartId\}`/);
    expect(route).toMatch(/OUT_OF_STOCK/);
  });

  it('maps insufficient funds to 402 (no money moved)', () => {
    expect(route).toMatch(/INSUFFICIENT_FUNDS.*402|402.*INSUFFICIENT_FUNDS/s);
  });

  it('cancel refunds via the ledger, idempotent on the order', () => {
    expect(route).toMatch(/idempotencyKey:\s*`shop-cancel-refund:\$\{orderId\}`/);
  });

  it('createOrder is transactional with a guarded (oversell-proof) stock decrement', () => {
    expect(service).toMatch(/\.transaction\(async/);
    expect(service).toMatch(/stock_quantity = stock_quantity - \$\{qty\}/);
    expect(service).toMatch(/AND stock_quantity >= \$\{qty\}/);
    expect(service).toMatch(/OUT_OF_STOCK/);
  });

  it('cancelOrder restores stock using product_id (the snake_case column)', () => {
    expect(service).toMatch(/const pid = \(item as any\)\.product_id/);
    expect(service).toMatch(/stock_quantity = stock_quantity \+ \$\{qty\} WHERE id = \$\{pid\}/);
  });
});
