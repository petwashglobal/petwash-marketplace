/**
 * CEO FLY MODE II §34 (2026-08-29) — availability authority pins.
 *
 * "Availability authority" means: only the authenticated provider can
 * create/modify/cancel their OWN availability windows. The provider
 * id must be SERVER-derived from the caller's uid (via
 * resolveProvider(uid, platformId)) — NEVER trusted from the request
 * body. A slot's ownership is verified before any mutation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-slots.ts'),
  'utf8',
);

describe('CEO FLY MODE II §34 — availability authority (provider-slots)', () => {
  it('POST / (create slots) requires an authenticated uid', () => {
    const idx = SRC.indexOf("router.post('/'");
    const block = SRC.slice(idx, idx + 400);
    expect(block).toMatch(/const uid = req\.user\?\.uid \|\| req\.firebaseUser\?\.uid/);
    expect(block).toMatch(/return res\.status\(401\)/);
  });

  it('POST / resolves the provider by uid+platformId — NEVER trusts a body providerId', () => {
    // The provider row hydrates from resolveProvider(uid, platformId),
    // and the inserted row's providerId is providerRow.id — a
    // server value. A regression that reads req.body.providerId
    // into the insert would defeat the authority contract.
    expect(SRC).toMatch(/const providerRow = await resolveProvider\(uid, platformId\)/);
    expect(SRC).toMatch(/providerId: providerRow\.id/);
    expect(SRC).not.toMatch(/providerId: req\.body\.providerId/);
    expect(SRC).not.toMatch(/providerId: data\.providerId/);
    expect(SRC).not.toMatch(/providerId: body\.providerId/);
  });

  it('POST / refuses when the caller has no provider profile on that platform', () => {
    expect(SRC).toMatch(/return res\.status\(403\)/);
    expect(SRC).toMatch(/No provider profile found for platform/);
  });

  it('DELETE /:id confirms ownership — provider must own the slot', () => {
    const idx = SRC.indexOf("router.delete('/:id'");
    const block = SRC.slice(idx, idx + 900);
    // Fetch the slot, then hydrate the provider from THE SLOT's
    // platformId — matching against providerRow.id !== slot.providerId
    // means a third-party caller cannot cancel someone else's slot.
    expect(block).toMatch(/resolveProvider\(uid, slot\.platformId\)/);
    expect(block).toMatch(/providerRow\.id !== slot\.providerId/);
    expect(block).toMatch(/You do not own this slot/);
  });

  it('DELETE /:id refuses to cancel a slot with a confirmed booking', () => {
    const idx = SRC.indexOf("router.delete('/:id'");
    const block = SRC.slice(idx, idx + 1200);
    expect(block).toMatch(/slot\.status === 'booked'/);
    expect(block).toMatch(/Cannot cancel a slot that already has a confirmed booking/);
    expect(block).toMatch(/status\(409\)/);
  });

  it('DELETE /:id soft-cancels — preserves audit trail (no hard-delete)', () => {
    const idx = SRC.indexOf("router.delete('/:id'");
    const block = SRC.slice(idx, idx + 1500);
    // Update status='cancelled' instead of db.delete(). A regression
    // that hard-deletes would erase the audit trail.
    expect(block).toMatch(/\.update\(availabilitySlots\)/);
    expect(block).toMatch(/status: 'cancelled'/);
    expect(block).not.toMatch(/\.delete\(availabilitySlots\)/);
  });

  it('slot temporal validity checks — startTime < endTime AND endTime in the future', () => {
    // A body-supplied slot that lies in the past or has reversed
    // times is refused before it can INSERT.
    expect(SRC).toMatch(/startTime >= endTime/);
    expect(SRC).toMatch(/startTime must be before endTime/);
    expect(SRC).toMatch(/endTime <= new Date\(\)/);
    expect(SRC).toMatch(/Slot end time must be in the future/);
  });

  it('overlap check prevents double-booking the same window', () => {
    expect(SRC).toMatch(/const overlaps = await hasOverlap\(providerRow\.id, platformId, startTime, endTime\)/);
    expect(SRC).toMatch(/overlaps an existing availability window/);
  });
});
