/**
 * customerLister — PetTrek coverage source-pin.
 *
 * Closes a silent gap: the /account/transactions lister emitted six of
 * the seven verticals CustomerTransactionRow.platform declares — SHOP,
 * K9000, EGIFT, SITTER_SUITE, WALK_MY_PET, ACADEMY, WALLET — but PETTREK
 * was declared and never emitted. A customer with only PetTrek trips
 * saw an empty transaction history despite money moving.
 *
 * Discipline pinned:
 *
 *   1. The source union declares 'pettrek_trips'.
 *   2. A try/catch block reads pettrekTrips by customerId — the query
 *      surface must scope by customerId (not tripId, providerId, or
 *      status), matching the ownership model on every other branch.
 *      A cross-uid leak here would leak trip fares to the wrong user.
 *   3. paymentState resolves off pettrek_trips.paymentStatus, which the
 *      schema pins as 'pending' | 'paid' | 'refunded'. A refactor that
 *      collapses those into an on/off boolean silently loses the
 *      REFUNDED case and stops the /my-transactions REFUNDED chip
 *      lighting up.
 *   4. finalFare wins over estimatedFare — matches the fiscal-passport
 *      composer's rule at composer.ts:715 so the list total and the
 *      detail total never disagree.
 *   5. correlationId = `pettrek:${tripId}` — feeds the escrow-reversal
 *      fan-out via correlationKindToSourceType.
 *   6. platform = 'PETTREK' — an ACADEMY typo would silently mis-tag
 *      trips as academy sessions on the render.
 *
 * Also pins the two DTO source-union sides in sync (server + client)
 * so a rename lands on both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const LISTER_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'fiscalPassport', 'customerLister.ts'),
  'utf8',
);
const CLIENT_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'MyTransactions.tsx'),
  'utf8',
);

describe('customerLister — PetTrek branch', () => {
  it('imports pettrekTrips from shared/schema', () => {
    expect(LISTER_SRC).toMatch(/pettrekTrips,\s*\n\s*\}\s*from\s+['"]@shared\/schema['"]/);
  });

  it("declares 'pettrek_trips' in the CustomerTransactionRow.source union", () => {
    expect(LISTER_SRC).toMatch(/source:[\s\S]*?\|\s*'pettrek_trips'/);
  });

  it('reads pettrekTrips scoped by customerId — never leaks cross-uid', () => {
    // The ONLY column the lister may join on is customerId. A refactor
    // that swaps to providerId or drops the where clause opens a data
    // leak per §71.
    expect(LISTER_SRC).toMatch(/\.from\(pettrekTrips\)[\s\S]*?\.where\(eq\(pettrekTrips\.customerId,\s*input\.customerUid\)\)/);
  });

  it("resolves paymentState from paymentStatus — pending | paid | refunded", () => {
    // The three-way switch is what lights the REFUNDED chip on
    // /my-transactions. Collapsing to a boolean silently drops it.
    expect(LISTER_SRC).toMatch(/const paidState = String\(t\.paymentStatus \?\? ''\)/);
    expect(LISTER_SRC).toMatch(/paid = paidState === 'paid'/);
    expect(LISTER_SRC).toMatch(/refunded = paidState === 'refunded'/);
    expect(LISTER_SRC).toMatch(/paymentState:\s*paid \? 'PAID' : refunded \? 'REFUNDED' : 'PAYMENT_REQUIRED'/);
  });

  it('finalFare wins over estimatedFare — matches composer.ts:715', () => {
    expect(LISTER_SRC).toMatch(/Number\(t\.finalFare\s*\?\?\s*t\.estimatedFare\s*\?\?\s*0\)/);
  });

  it("emits correlationId='pettrek:${tripId}' — feeds the fan-out mapper", () => {
    expect(LISTER_SRC).toMatch(/correlationId:\s*`pettrek:\$\{t\.id\}`/);
  });

  it("tags the platform as PETTREK — never ACADEMY / SITTER_SUITE", () => {
    // A rename or typo would silently mis-render trips.
    expect(LISTER_SRC).toMatch(/platform:\s*'PETTREK'/);
  });

  it('fails safe on missing table (fresh env) via swallow()', () => {
    // A fresh env where pettrek_trips doesn't exist must NOT 500 the
    // customer's transaction history.
    expect(LISTER_SRC).toMatch(/swallow\('pettrek_trips',\s*err\)/);
  });
});

describe('DTO source unions — server + client stay in sync', () => {
  it("the client's Source union includes 'pettrek_trips'", () => {
    // Without this, TypeScript widens the field to string on the client
    // AND the client's BOOKING_SOURCES set silently no longer aligns
    // with the server payload.
    expect(CLIENT_SRC).toMatch(/type Source =[\s\S]*?\|\s*'pettrek_trips'/);
  });

  it("the client's BOOKING_SOURCES set includes 'pettrek_trips' — deep-link works", () => {
    expect(CLIENT_SRC).toMatch(/BOOKING_SOURCES = new Set\(\[[^\]]*'pettrek_trips'/);
  });
});
