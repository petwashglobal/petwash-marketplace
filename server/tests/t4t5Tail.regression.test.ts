/**
 * T4/T5 tail batch (marketplace 360 audit, 2026-07-30): meet&greet enum
 * repair, cross-rail slot lock, review email finally sends, address snapshot
 * enrichment, ledger VAT aligned to the CPA commission-only model.
 * Pins match call sites, not comment phrases.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('T4 — meet & greet enum + cross-rail lock', () => {
  it('the pg enum + migration know meet_greet_requested', () => {
    expect(R('shared/schema.ts')).toMatch(/'meet_greet_requested',/);
    expect(existsSync(resolve(__dirname, '..', '..', 'migrations/0108_booking_meetgreet_enum_and_address_access.sql'))).toBe(true);
    expect(R('migrations/0108_booking_meetgreet_enum_and_address_access.sql')).toMatch(/ADD VALUE IF NOT EXISTS 'meet_greet_requested'/);
  });

  it('V2 inbox groups + accept allow meet_greet_requested (no more provider lock-out)', () => {
    const v2 = R('server/routes/provider-dashboard-v2.ts');
    expect(v2).toMatch(/new_request:\s+\['pending', 'meet_greet_requested'/);
    expect(v2).toMatch(/accept:\s+\['pending', 'accepted', 'meet_greet_requested', 'meet_greet_scheduled', 'meet_greet_completed'\]/);
  });

  it('marketplace-checkout engine joins the shared slot-lock namespace', () => {
    const svc = R('server/services/BookingLifecycleService.ts');
    expect(svc).toMatch(/acquireSlotLock\(db, \{\s*\n\s*providerId: input\.providerId/);
  });
});

describe('T5 — review email, address snapshot, ledger VAT truth', () => {
  it('the review email has real callers on BOTH completion paths', () => {
    expect(R('server/routes/booking-requests.ts')).toMatch(/sendServiceCompletedReview\(\{\s*\n\s*requestId,/);
    expect(R('server/cron/auto-approve-completions.ts')).toMatch(/sendServiceCompletedReview\(\{/);
    expect(R('server/email/sendServiceCompletedReview.ts')).toMatch(/buildServiceCompletedEmail\(\{/);
  });

  it('canonical create enriches the address snapshot from user_addresses when the body has none', () => {
    const br = R('server/routes/booking-requests.ts');
    expect(br).toMatch(/from\(userAddresses\)/);
    expect(br).toMatch(/customerFloor:\s+\(addrSrc\.floor \?\? savedAccessFields\.floor\)/);
  });

  it('bridged bookings carry the address snapshot too', () => {
    const bridge = R('server/services/legacyBookingBridge.ts');
    expect(bridge).toMatch(/from\(userAddresses\)/);
    expect(bridge).toMatch(/\.\.\.addressSnapshot,/);
  });

  it('booking ledger VAT is commission-only and the provider payout is never VAT-docked', () => {
    const w = R('server/services/bookingLedgerWriter.ts');
    expect(w).toMatch(/const vatCents\s+= Math\.round\(platformFeeCents \* \(VAT_RATE \/ \(1 \+ VAT_RATE\)\)\)/);
    expect(w).toMatch(/const providerPayoutCents = providerGrossCents;/);
    expect(w).not.toMatch(/grossCents \* \(VAT_RATE/);
    expect(w).not.toMatch(/providerGrossCents - providerVatCents/);
  });

  it('/confirm contact details fall back to the users row', () => {
    expect(R('server/routes/booking-requests.ts')).toMatch(/ownerPhone = ownerPhone \|\| ownerRow\?\.phone/);
  });

  it('webhook provider push is not gated on email/phone presence', () => {
    const w = R('server/routes/nayax-webhooks.ts');
    expect(w).not.toMatch(/if \(provider\?\.email \|\| provider\?\.phone\) \{\s*\n\s*await dispatchNotifications/);
  });
});
