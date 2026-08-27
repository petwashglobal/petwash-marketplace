/**
 * JobPassport composer — per-platform branch invariants
 * (CEO 2026-08-27 §75 items 5-10).
 *
 * Structural pins on server/services/jobPassport/composer.ts. The
 * composer file is a heavy DB reader; we can't invoke it end-to-end
 * without a live Postgres. Instead we pin the SHAPE of each platform
 * branch so a refactor can't silently:
 *   • infer money from booking.status (§20)
 *   • grant PROVIDER fulfiller kind to SHOP / K9000 / EGIFT (§4-5)
 *   • omit the participant scope check (§10, §33)
 *   • splice raw ids into SHOP's pool.query (SQL-injection guard)
 *   • return non-null for a non-participant viewer (privacy 404 §34)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'jobPassport', 'composer.ts'),
  'utf8',
);

function windowOf(name: string): string {
  const start = SRC.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  // Take up to the next async function OR end of file.
  const nextStart = SRC.indexOf('\nasync function ', start + name.length + 10);
  const end = nextStart > 0 ? nextStart : SRC.length;
  return SRC.slice(start, end);
}

describe('ACADEMY branch — trainer_bookings (§5, §10)', () => {
  const w = windowOf('composeAcademyPassport');

  it('fulfiller kind is PROVIDER (trainer is an approved provider)', () => {
    expect(w).toMatch(/kind:\s*['"]PROVIDER['"]/);
    expect(w).not.toMatch(/kind:\s*['"]MACHINE['"]/);
    expect(w).not.toMatch(/kind:\s*['"]PETWASH_MERCHANT['"]/);
  });

  it('participant scope: owner=userId OR trainer=trainerUserId OR admin', () => {
    expect(w).toMatch(/viewer\.uid\s*===\s*booking\.userId/);
    expect(w).toMatch(/viewer\.uid\s*===\s*booking\.trainerUserId/);
    // Return null for non-participants (privacy 404).
    expect(w).toMatch(/if\s*\(!isOwner\s*&&\s*!isTrainer\s*&&\s*!isAdmin\)\s*return\s+null/);
  });

  it('money is derived from paymentStatus/paidAt — NEVER from booking.bookingStatus', () => {
    expect(w).toMatch(/booking\.paymentStatus/);
    expect(w).toMatch(/booking\.paidAt/);
    // Ban a shortcut that flips PAID off booking.bookingStatus alone.
    const paidFromStatus = w.match(/state:.*['"]PAID['"]/g) ?? [];
    // Every 'PAID' must be gated on the paymentPaid boolean (which
    // reads paymentStatus/paidAt), not the bookingStatus. The one
    // legitimate assignment is the ternary using paymentPaid.
    expect(w).toMatch(/paymentPaid\s*\?\s*['"]PAID['"]/);
  });
});

describe('SHOP branch — shop_orders (§4, raw SQL)', () => {
  const w = windowOf('composeShopPassport');

  it('fulfiller kind is PETWASH_MERCHANT — never PROVIDER', () => {
    expect(w).toMatch(/kind:\s*['"]PETWASH_MERCHANT['"]/);
    expect(w).not.toMatch(/kind:\s*['"]PROVIDER['"]/);
  });

  it('participant scope: owner=user_id OR admin OR merchant-staff', () => {
    expect(w).toMatch(/viewer\.uid\s*===\s*order\.user_id/);
    expect(w).toMatch(/if\s*\(!isOwner\s*&&\s*!isAdmin\s*&&\s*!isMerchantStaff\)\s*return\s+null/);
  });

  it('raw SQL is parameterised — no string interpolation of orderId', () => {
    // The pool.query call must use $1 for the orderId, and the args
    // array must contain [orderId]. A refactor that spliced ${orderId}
    // into the template would be a SQL injection vector.
    expect(w).toMatch(/WHERE id = \$1/);
    expect(w).toMatch(/pool\.query\([\s\S]*?,\s*\[orderId\]/);
    // Ban template interpolation of orderId inside the SQL string.
    expect(w).not.toMatch(/WHERE id = \$\{orderId\}/);
  });

  it('completion method depends on delivery_method — pickup uses STAFF_CONFIRMATION', () => {
    expect(w).toMatch(/order\.delivery_method\s*===\s*['"]pickup['"]/);
    expect(w).toMatch(/['"]STAFF_CONFIRMATION['"]/);
  });
});

describe('K9000 branch — k9000_wash_events (§4, §17)', () => {
  const w = windowOf('composeK9000Passport');

  it('fulfiller kind is MACHINE — never PROVIDER or MERCHANT', () => {
    expect(w).toMatch(/kind:\s*['"]MACHINE['"]/);
    expect(w).not.toMatch(/kind:\s*['"]PROVIDER['"]/);
    expect(w).not.toMatch(/kind:\s*['"]PETWASH_MERCHANT['"]/);
  });

  it('providerPublicId encodes station + bay pair (§40 dual-bay identity)', () => {
    expect(w).toMatch(/providerPublicId:\s*`\$\{event\.stationId[\s\S]*\}\/\$\{event\.baySide/);
  });

  it('verification uses MACHINE_BINDING for both start and completion (§14, §17)', () => {
    expect(w).toMatch(/startMethod:\s*['"]MACHINE_BINDING['"]/);
    expect(w).toMatch(/completionMethod:\s*['"]MACHINE_BINDING['"]/);
  });

  it('no provider payout — showsProviderMoney is always false', () => {
    expect(w).toMatch(/showsProviderMoney:\s*false/);
  });
});

describe('EGIFT branch — egift_guest_orders (§4, §16)', () => {
  const w = windowOf('composeEgiftPassport');

  it('fulfiller kind is PETWASH_MERCHANT — never PROVIDER', () => {
    expect(w).toMatch(/kind:\s*['"]PETWASH_MERCHANT['"]/);
    expect(w).not.toMatch(/kind:\s*['"]PROVIDER['"]/);
  });

  it('sender/recipient participant scope — case-insensitive email match', () => {
    expect(w).toMatch(/senderEmail/);
    expect(w).toMatch(/recipientEmail/);
    expect(w).toMatch(/\.toLowerCase\(\)/);
  });

  it('purchase itself has NO completion method (§16 discipline)', () => {
    // The eGift *purchase* JobPassport reports NONE for both start and
    // completion — a separate JobPassport handles the redemption step.
    expect(w).toMatch(/startMethod:\s*['"]NONE['"]/);
    expect(w).toMatch(/completionMethod:\s*['"]NONE['"]/);
  });
});

describe('dispatch switch — all seven sources land on their own composer', () => {
  it('composeJobPassport switch cases cover every registered source', () => {
    for (const source of [
      'sitter_bookings',
      'walk_bookings',
      'booking_requests',
      'trainer_bookings',
      'shop_orders',
      'k9000_wash_events',
      'egift_guest_orders',
    ]) {
      expect(SRC).toMatch(new RegExp(`case\\s+['"]${source}['"]:`));
    }
  });
});
