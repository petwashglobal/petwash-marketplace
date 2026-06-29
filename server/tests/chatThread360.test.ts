import { describe, it, expect, vi } from 'vitest';

// Full create-path mock: no existing thread → insert echoes the values back.
vi.mock('../db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: (v: any) => ({ returning: async () => [{ id: 1, ...v }] }) }),
  },
  pool: {},
}));

import { getOrCreateThread } from '../services/chatThreadService';

/**
 * 360° conversation matrix — every direction the CEO named must map to a valid
 * entity-linked thread. Each case asserts the right thread_type, the right entity
 * anchor, and the right participants (who can talk to whom).
 */
describe('Communication Hub — 360° conversation coverage', () => {
  it('Booker ↔ Provider → BOOKING thread (customer + provider)', async () => {
    const t = await getOrCreateThread({
      threadType: 'BOOKING', bookingId: 'bk_1', customerUserId: 'cust_1', providerUserId: 'prov_1',
    });
    expect(t.threadType).toBe('BOOKING');
    expect(t.bookingId).toBe('bk_1');
    expect(t.customerUserId).toBe('cust_1');
    expect(t.providerUserId).toBe('prov_1');
  });

  it('Booker → PetWash support → SUPPORT thread (customer + support owner)', async () => {
    const t = await getOrCreateThread({
      threadType: 'SUPPORT', caseId: 'case_1', customerUserId: 'cust_1', supportOwnerId: 'pw_agent',
    });
    expect(t.threadType).toBe('SUPPORT');
    expect(t.caseId).toBe('case_1');
    expect(t.customerUserId).toBe('cust_1');
    expect(t.supportOwnerId).toBe('pw_agent');
  });

  it('Provider → PetWash support → SUPPORT thread (provider + support owner)', async () => {
    const t = await getOrCreateThread({
      threadType: 'SUPPORT', caseId: 'case_2', providerUserId: 'prov_1', supportOwnerId: 'pw_agent',
    });
    expect(t.providerUserId).toBe('prov_1');
    expect(t.supportOwnerId).toBe('pw_agent');
  });

  it('PetWash → user/provider (admin reaches out) → ADMIN thread', async () => {
    const t = await getOrCreateThread({
      threadType: 'ADMIN', caseId: 'case_3', customerUserId: 'cust_1', supportOwnerId: 'pw_admin',
    });
    expect(t.threadType).toBe('ADMIN');
    expect(t.supportOwnerId).toBe('pw_admin');
  });

  it('Franchise questions → FRANCHISE thread (applicant + support)', async () => {
    const t = await getOrCreateThread({
      threadType: 'FRANCHISE', applicationId: 'franch_1', customerUserId: 'lead_1', supportOwnerId: 'pw_franchise',
    });
    expect(t.threadType).toBe('FRANCHISE');
    expect(t.applicationId).toBe('franch_1');
  });

  it('Public general enquiry → SUPPORT thread (anonymous-ish, support owned)', async () => {
    const t = await getOrCreateThread({
      threadType: 'SUPPORT', caseId: 'pub_1', supportOwnerId: 'pw_agent',
    });
    expect(t.threadType).toBe('SUPPORT');
    expect(t.caseId).toBe('pub_1');
  });

  it('K9000 station issue → K9000 thread (station-anchored)', async () => {
    const t = await getOrCreateThread({ threadType: 'K9000', stationId: 'st_kfar_saba', customerUserId: 'cust_1' });
    expect(t.stationId).toBe('st_kfar_saba');
  });

  it('Paw Finder / Shop / Gift / Incident / Provider application all map cleanly', async () => {
    expect((await getOrCreateThread({ threadType: 'PAW_FINDER', caseId: 'pf_1' })).threadType).toBe('PAW_FINDER');
    expect((await getOrCreateThread({ threadType: 'SHOP_ORDER', orderId: 'ord_1' })).orderId).toBe('ord_1');
    expect((await getOrCreateThread({ threadType: 'GIFT', giftId: 'gift_1' })).giftId).toBe('gift_1');
    expect((await getOrCreateThread({ threadType: 'INCIDENT', caseId: 'inc_1' })).threadType).toBe('INCIDENT');
    expect((await getOrCreateThread({ threadType: 'PROVIDER_APPLICATION', applicationId: 'app_1' })).applicationId).toBe('app_1');
  });

  it('CORE RULE holds for every type — missing entity anchor is rejected', async () => {
    await expect(getOrCreateThread({ threadType: 'BOOKING' })).rejects.toThrow(/requires bookingId/);
    await expect(getOrCreateThread({ threadType: 'FRANCHISE' })).rejects.toThrow(/requires applicationId/);
    await expect(getOrCreateThread({ threadType: 'K9000' })).rejects.toThrow(/requires stationId/);
    await expect(getOrCreateThread({ threadType: 'GIFT' })).rejects.toThrow(/requires giftId/);
  });
});
