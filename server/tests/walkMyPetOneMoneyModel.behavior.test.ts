/**
 * WALK MY PET™ ON THE ONE MONEY MODEL (CEO, 2026-09-17).
 *
 * customer pays = walker's rate + 15% Pet Wash fee · walker gets the whole rate
 * · Pet Wash keeps the fee, VAT inside it.
 *
 * Found on the way, and pinned here:
 *  - the booking engine priced a walk as Pet Wash's OWN sale: 18% VAT on the
 *    whole price (₪100 → ₪118) while the walker got 85%, plus a loyalty
 *    discount that came out of the walker's pay;
 *  - the escrow hold took a flat 15% of the held amount (₪97.75 of ₪115 held
 *    for a walker owed ₪100);
 *  - every emergency walk insert was refused by Postgres (six NOT NULL columns
 *    missing, four columns that do not exist) and stored no payout or fee;
 *  - the emergency screen read field names the server never sent (blank
 *    prices, total included) and received the walker's private contact data;
 *  - the check-out summary rebuilt earnings as total ÷ 1.15 × 0.85.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { getTableConfig } from 'drizzle-orm/pg-core';

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { walkBookings } from '../../shared/schema';
import { calculateWalkFees } from '../utils/walkFeeCalculator';
import { toIsraelLocal, presentEmergencyWalkForOwner } from '../services/EmergencyWalkService';
import { storedWalkMoney } from '../services/WalkSessionService';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('the booking engine prices a walk as the walker’s sale', () => {
  const base = read('services/booking-engines/base/BaseLuxuryBookingEngine.ts');
  const walk = read('services/booking-engines/walk/WalkEliteBookingEngine.ts');

  it('walk and pettrek opt into the marketplace model; the base default stays direct sale (K9000)', () => {
    expect(walk).toMatch(/protected moneyModel\(\): 'marketplace' \{\s*return 'marketplace';/);
    expect(base).toMatch(/protected moneyModel\(\): 'direct_sale' \| 'marketplace' \{\s*return 'direct_sale';/);
    // PetTrek joined 2026-09-18 (CEO: "it's 15%") — it is frozen, so this is
    // the model waiting for whenever it is switched on.
    expect(read('services/booking-engines/pettrek/PetTrekChauffeurBookingEngine.ts'))
      .toMatch(/protected moneyModel\(\): 'marketplace' \{\s*return 'marketplace';/);
    // K9000 is Pet Wash's own sale — it must never opt in.
    expect(read('services/booking-engines/k9000/K9000StationBookingEngine.ts')).not.toContain('moneyModel()');
  });

  it('marketplace quotes use the shared split — no VAT on top, no loyalty discount', () => {
    const i = base.indexOf("if (this.moneyModel() === 'marketplace') {");
    const block = base.slice(i, i + 1400);
    expect(block).toContain('splitMarketplaceJob(');
    expect(block).toContain('loyaltyDiscount: 0');
    expect(block).toContain('totalPrice: split.customerTotalCents / 100');
    expect(block).toContain('providerPayout: split.providerPayoutCents / 100');
    expect(walk).not.toContain('subtotal * 0.85');
  });

  it('escrow holds the whole rate: commission share = fee ÷ total', () => {
    expect(base).toContain('(pricing.platformFee / pricing.totalPrice) * 100');
    const pct = (15 / 115) * 100;
    const held = 11500 - Math.round(11500 * (pct / 100));
    expect(held).toBe(10000);                              // walker owed ₪100
    expect(11500 - Math.round(11500 * 0.15)).toBe(9775);   // what the flat 15% held
  });

  it('the stored fee sits entirely on the owner’s side', () => {
    const route = read('routes/walk-my-pet.ts');
    expect(route).toContain('platformFeeOwner: pricing.platformFee.toFixed(2)');
    expect(route).toContain("platformFeeSitter: '0.00'");
  });
});

describe('emergency walks can be stored at all', () => {
  it('the insert satisfies every NOT NULL column of the real table', async () => {
    const cfg = getTableConfig(walkBookings);
    const pg = new PGlite();
    await pg.exec(`CREATE TABLE ${cfg.name} (${cfg.columns.map((c) =>
      c.getSQLType() === 'serial' ? `"${c.name}" serial PRIMARY KEY`
        : `"${c.name}" ${c.getSQLType()}${c.notNull && !c.hasDefault ? ' NOT NULL' : ''}`).join(', ')})`);
    const db = drizzle(pg);

    // Build exactly what the service writes.
    const src = read('services/EmergencyWalkService.ts');
    const i = src.indexOf('await db.insert(walkBookings).values({');
    const block = src.slice(i, src.indexOf('});', i));
    for (const gone of ['ownerEmail:', 'scheduledTime:', 'estimatedDuration:', 'pickupLocation:', 'paymentStatus:', 'estimatedStartTime,', 'totalChargeWithVATCents']) {
      expect(block, `${gone} is not a walk_bookings column`).not.toContain(gone);
    }
    expect(block).not.toContain('as any');

    const fees = calculateWalkFees(12000); // ₪120 surge-priced rate
    const at = toIsraelLocal(new Date('2026-09-17T09:05:00Z'));
    await db.insert(walkBookings).values({
      bookingId: 'WALK-EMERG-1', ownerId: 'owner', walkerId: 'W1',
      petName: 'Rex', petBreed: 'mix', petWeight: '10', petSpecialNeeds: null,
      scheduledDate: at.date, scheduledStartTime: at.time, durationMinutes: 30,
      pickupLatitude: '32.1782', pickupLongitude: '34.9076', pickupAddress: 'Kfar Saba',
      walkerRate: (fees.basePriceCents / 100).toFixed(2),
      platformFeeOwner: (fees.platformCommissionTotalCents / 100).toFixed(2),
      platformFeeSitter: '0.00',
      totalCost: (fees.totalChargeCents / 100).toFixed(2),
      walkerPayout: (fees.walkerPayoutCents / 100).toFixed(2),
      currency: 'ILS', status: 'confirmed', isEmergencyWalk: true,
      emergencySurgeMultiplier: '1.5', emergencySurgeReason: 'Peak hours', serviceSource: 'walk_my_pet',
    });
    const { rows } = await pg.query<any>('SELECT walker_rate, platform_fee_owner, total_cost, walker_payout, scheduled_date::text AS d, scheduled_start_time AS t FROM walk_bookings');
    expect(rows[0]).toMatchObject({ walker_rate: '120.00', platform_fee_owner: '18.00', total_cost: '138.00', walker_payout: '120.00', d: '2026-09-17', t: '12:05' });
  }, 30000);

  it('Israel local time survives the DST switch', () => {
    expect(toIsraelLocal(new Date('2026-01-15T10:00:00Z'))).toEqual({ date: '2026-01-15', time: '12:00' }); // UTC+2
    expect(toIsraelLocal(new Date('2026-07-15T10:00:00Z'))).toEqual({ date: '2026-07-15', time: '13:00' }); // UTC+3
    expect(toIsraelLocal(new Date('2026-07-15T22:30:00Z'))).toEqual({ date: '2026-07-16', time: '01:30' }); // next day
  });
});

describe('what the customer’s emergency screen receives', () => {
  const shown = presentEmergencyWalkForOwner({
    matchedWalker: {
      walkerId: 'W1', walkerUserId: 'uid-secret', walkerName: 'Dana', walkerEmail: 'dana@private.il',
      walkerPhone: '+972500000000', distanceKm: 1.2, rating: 4.9, completedWalks: 88, estimatedArrivalMinutes: 20,
    },
    pricing: calculateWalkFees(12000),
    surgePricing: { basePriceCents: 8000, surgeMultiplier: 1.5, surgePriceCents: 12000, reason: 'Peak hours' },
  });

  it('every price row the screen reads is filled, total included', () => {
    expect(shown.pricing).toMatchObject({
      basePriceILS: '₪120.00', ownerFeeILS: '₪18.00', walkerDeductionILS: '₪0.00',
      walkerPayoutILS: '₪120.00', vatILS: '₪2.75', totalChargeWithVATILS: '₪138.00',
    });
    expect(shown.surgePricing).toMatchObject({ isSurge: true, surgeReasons: ['Peak hours'], surgePriceILS: '₪120.00' });
  });

  it('never hands the customer the walker’s private contact data', () => {
    const json = JSON.stringify(shown);
    expect(json).not.toContain('dana@private.il');
    expect(json).not.toContain('+972500000000');
    expect(json).not.toContain('uid-secret');
  });

  it('the route sends the presented shape, not the internals', () => {
    const route = read('routes/walk-my-pet.ts');
    expect(route).toContain('matchedWalker: shown.matchedWalker,');
    expect(route).not.toContain('matchedWalker: result.matchedWalker,');
  });
});

describe('completion books what the walk was sold with', () => {
  it('check-out reads the stored split instead of total ÷ 1.15 × 0.85', () => {
    expect(storedWalkMoney({ totalCost: '115.00', walkerPayout: '100.00', walkerRate: '100.00', platformFeeOwner: '15.00', platformFeeSitter: '0.00' }))
      .toEqual({ totalPaid: 115, rate: 100, walkerEarnings: 100, platformFee: 15 });
    const src = read('services/WalkSessionService.ts');
    expect(src).not.toMatch(/\/ 1\.15/);
    expect(src).not.toMatch(/\* 0\.85/);
  });

  it('settlement gets the stored fee; the VAT ledger gets the walk’s own model', () => {
    const route = read('routes/walk-my-pet.ts');
    expect(route).toContain('brokerCommissionAmount: walkFeeIls');
    expect(route).toContain("Math.abs(walkPaidIls - (walkPayoutIls + walkFeeIls)) < 0.01 ? 'gross' : 'net'");
    expect(route).toContain('{ model: walkMoneyModel },');
  });
});
