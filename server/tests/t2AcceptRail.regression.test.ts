/**
 * T2 accept-rail batch (marketplace 360 audit, 2026-07-30). The live provider
 * accept path (provider-os V2) now: lands in 'accepted' (payment confirms),
 * guards races, moves wallet holds, frees slot locks, notifies off-app, and
 * syncs every legacy mirror — and the customer finally has a PAY button.
 * Pins match CALL SITES, not comment phrases.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('T2 — provider accept rail', () => {
  const v2 = () => R('server/routes/provider-dashboard-v2.ts');

  it("V2 accept lands in 'accepted' — only the payment webhook writes 'confirmed'", () => {
    expect(v2()).toMatch(/accept:\s+'accepted',/);
    expect(v2()).not.toMatch(/accept:\s+'confirmed',/);
  });

  it('V2 update re-checks status atomically and 409s on a lost race', () => {
    expect(v2()).toMatch(/AND status = ANY\(\$\$\{p \+ 2\}::booking_request_status\[\]\)/);
    expect(v2()).toMatch(/code: 'RACE_CONDITION'/);
  });

  it('V2 accept refuses overlapping bookings (double-booking guard)', () => {
    expect(v2()).toMatch(/code: 'PROVIDER_DOUBLE_BOOKING'/);
    expect(v2()).toMatch(/status = ANY\(\$3::booking_request_status\[\]\)/);
  });

  it('V2 decline/cancel releases the slot lock — canonical AND legacy keys', () => {
    expect(v2()).toMatch(/releaseSlotLock\(db, requestIdStr\)/);
    expect(v2()).toMatch(/releaseSlotLock\(db, String\(legacyId\)\)/);
  });

  it('V2 moves the customer wallet hold (debit on accept, release on decline)', () => {
    expect(v2()).toMatch(/walletService\.debitBookingFromHold\(/);
    expect(v2()).toMatch(/walletService\.releaseBookingHold\(/);
  });

  it('V2 accept/decline reaches the customer off-app with a pay-to-confirm CTA', () => {
    expect(v2()).toMatch(/dispatchNotification\(\{\s*\n\s*uid: ownerId/);
    expect(v2()).toMatch(/booking\/confirmation\/\$\{requestId \?\? bookingId\}/);
  });
});

describe('T2 — bridge, webhook, timeout, dispatcher, chat', () => {
  it('payment webhook confirms the legacy mirror only after verified money', () => {
    expect(R('server/routes/nayax-webhooks.ts')).toMatch(/applyBridgePaymentConfirmed\(\(booking as any\)\.quoteBreakdown\)/);
  });

  it('accept-timeout declines the legacy mirror and frees BOTH lock keys', () => {
    const t = R('server/jobs/booking-accept-timeout.ts');
    expect(t).toMatch(/applyBridgeDecision\(booking\.quoteBreakdown, 'decline'\)/);
    expect(t).toMatch(/releaseSlotLock\(db, String\(legacyRefId\)\)/);
  });

  it('accept-timeout customer notice uses real dispatcher fields (uid/bodyHtml)', () => {
    const t = R('server/jobs/booking-accept-timeout.ts');
    expect(t).toMatch(/uid:\s+booking\.ownerId/);
    expect(t).not.toMatch(/userId:\s+booking\.ownerId,\n\s+type/);
  });

  it('dispatchNotification resolves email/phone from the users row when absent', () => {
    const d = R('server/lib/notificationDispatcher.ts');
    expect(d).toMatch(/or\(eq\(users\.id, uid\), eq\(users\.firebaseUid, uid\)\)/);
  });

  it('booking-chat resolves canonical booking_requests rows', () => {
    const c = R('server/routes/booking-chat.ts');
    expect(c).toMatch(/from\(bookingRequests\)\.where\(eq\(bookingRequests\.requestId, bookingId\)\)/);
  });

  it('customer confirmation page has the pay button wired to /pay', () => {
    const b = R('client/src/pages/BookingConfirmation.tsx');
    expect(b).toMatch(/data-testid="booking-pay-now"/);
    expect(b).toMatch(/\/api\/booking-requests\/\$\{requestId\}\/pay/);
  });

  it('contact-path pricing uses the real provider rate and never invents one', () => {
    const br = R('server/routes/booking-requests.ts');
    expect(br).toMatch(/eq\(sitterProfiles\.userId, data\.providerId\)/);
    expect(br).toMatch(/code: 'PROVIDER_RATE_MISSING'/);
    expect(br).toMatch(/code: 'PROVIDER_PROFILE_MISMATCH'/);
    expect(br).not.toMatch(/subtotalCents = 15000 \* totalDays/);
  });
});
