/**
 * K9000 + Prestige + ProviderApplication + PetKya JourneyResolvers.
 * CEO NEXT-AUTO §14 continuous refill.
 */
import { describe, it, expect } from 'vitest';
import { resolveK9000Journey } from '../services/marketplace/K9000JourneyResolver';
import { resolvePrestigeJourney } from '../services/marketplace/PrestigeJourneyResolver';
import { resolveProviderApplicationJourney } from '../services/marketplace/ProviderApplicationJourneyResolver';
import { resolvePetKyaJourney } from '../services/marketplace/PetKyaJourneyResolver';

describe('K9000', () => {
  it('vend_pending → waitingOn=SYSTEM, primary VIEW_STATION_SESSION, HIGH', () => {
    const r = resolveK9000Journey({ snapshot: { sessionId: 'K-1', status: 'vend_pending', customerUid: 'sarah', stationId: 'ST-1', amountCents: 1500 }, actorUid: 'sarah' });
    expect(r.waitingOn).toBe('SYSTEM');
    expect(r.primaryAction?.actionType).toBe('VIEW_STATION_SESSION');
    expect(r.attentionPriority).toBe('HIGH');
  });
  it('failed → primary CONTACT_SUPPORT, waitingOn=PETWASH, HIGH', () => {
    const r = resolveK9000Journey({ snapshot: { sessionId: 'K-1', status: 'failed', customerUid: 'sarah', stationId: 'ST-1', amountCents: 1500 }, actorUid: 'sarah' });
    expect(r.primaryAction?.actionType).toBe('CONTACT_SUPPORT');
    expect(r.waitingOn).toBe('PETWASH');
  });
  it('settled → VIEW_RECEIPT, INFO', () => {
    const r = resolveK9000Journey({ snapshot: { sessionId: 'K-1', status: 'settled', customerUid: 'sarah', stationId: 'ST-1', amountCents: 1500 }, actorUid: 'sarah' });
    expect(r.primaryAction?.actionType).toBe('VIEW_RECEIPT');
  });
});

describe('Prestige — CAPABILITY not workspace', () => {
  it('NONE → PRESTIGE_JOIN available', () => {
    const r = resolvePrestigeJourney({ snapshot: { actorUid: 'nir', status: 'NONE' } });
    expect(r.primaryAction?.actionType).toBe('PRESTIGE_JOIN');
  });
  it('ACTIVE → VIEW_PRESTIGE_BENEFITS, waitingOn=NONE', () => {
    const r = resolvePrestigeJourney({ snapshot: { actorUid: 'nir', status: 'ACTIVE', memberId: 'PWP-1' } });
    expect(r.primaryAction?.actionType).toBe('VIEW_PRESTIGE_BENEFITS');
    expect(r.waitingOn).toBe('NONE');
  });
});

describe('ProviderApplication — missing docs surface REQUIRED per-code', () => {
  it('AWAITING_DOCUMENTS with 3 missing → 3 REQUIRED obligations + 3 blockers', () => {
    const r = resolveProviderApplicationJourney({
      snapshot: { applicationId: 'PA-1', status: 'AWAITING_DOCUMENTS', providerUid: 'maya', missingDocuments: ['ID', 'BANK_ACCOUNT', 'INSURANCE'] },
      actorUid: 'maya',
    });
    expect(r.obligations.filter((o) => o.severity === 'REQUIRED')).toHaveLength(3);
    expect(r.blockers).toHaveLength(3);
    expect(r.blockers.every((b) => b.action === 'PROVIDER_APPLICATION_SUBMIT')).toBe(true);
    expect(r.attentionPriority).toBe('URGENT');
    expect(r.primaryAction?.actionType).toBe('UPLOAD_KYC_DOCUMENT');
  });
  it('IN_REVIEW → waitingOn=PETWASH, primary VIEW_APPLICATION_STATUS, no blockers', () => {
    const r = resolveProviderApplicationJourney({
      snapshot: { applicationId: 'PA-1', status: 'IN_REVIEW', providerUid: 'maya', missingDocuments: [] },
      actorUid: 'maya',
    });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.blockers).toEqual([]);
    expect(r.primaryAction?.actionType).toBe('VIEW_APPLICATION_STATUS');
  });
  it('insuranceExpiresAt surfaces as hard-cutoff deadline', () => {
    const r = resolveProviderApplicationJourney({
      snapshot: { applicationId: 'PA-1', status: 'APPROVED', providerUid: 'maya', missingDocuments: [], insuranceExpiresAt: '2027-01-01T00:00:00Z' },
      actorUid: 'maya',
    });
    expect(r.deadlines).toContainEqual({ reasonCode: 'INSURANCE_EXPIRES', dueAt: '2027-01-01T00:00:00Z', hardCutoff: true });
  });
});

describe('PetKya — §21-§22 policy-not-configured discipline', () => {
  it('undecided policy → waitingOn=PETWASH, INFO priority, primary VIEW_PET_PROFILE', () => {
    const r = resolvePetKyaJourney({
      snapshot: { petId: 'P-1', ownerUid: 'sarah', hasCoreCareNotes: true },
      actorUid: 'sarah', policy: {}, now: '2026-08-30T00:00:00Z',
    });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.obligations.some((o) => o.reasonCode === 'POLICY_NOT_CONFIGURED')).toBe(true);
    expect(r.attentionPriority).toBe('INFO');
    expect(r.primaryAction?.actionType).toBe('VIEW_PET_PROFILE');
  });
  it('missing notes → REQUIRED, primary UPDATE_PET_PROFILE, HIGH', () => {
    const r = resolvePetKyaJourney({
      snapshot: { petId: 'P-1', ownerUid: 'sarah', hasCoreCareNotes: false, lastReviewedAt: '2026-01-01T00:00:00Z' },
      actorUid: 'sarah', policy: { reviewIntervalMonths: 6 }, now: '2026-08-30T00:00:00Z',
    });
    expect(r.obligations.some((o) => o.reasonCode === 'PET_NOTES_MISSING' && o.severity === 'REQUIRED')).toBe(true);
    expect(r.primaryAction?.actionType).toBe('UPDATE_PET_PROFILE');
  });
  it('fresh notes within window → INFO, VIEW_PET_PROFILE', () => {
    const r = resolvePetKyaJourney({
      snapshot: { petId: 'P-1', ownerUid: 'sarah', hasCoreCareNotes: true, lastReviewedAt: '2026-08-01T00:00:00Z' },
      actorUid: 'sarah', policy: { reviewIntervalMonths: 6 }, now: '2026-08-30T00:00:00Z',
    });
    expect(r.attentionPriority).toBe('INFO');
    expect(r.primaryAction?.actionType).toBe('VIEW_PET_PROFILE');
  });
  it('stale notes → OPTIONAL REVIEW_PET_PROFILE, MEDIUM', () => {
    const r = resolvePetKyaJourney({
      snapshot: { petId: 'P-1', ownerUid: 'sarah', hasCoreCareNotes: true, lastReviewedAt: '2025-01-01T00:00:00Z' },
      actorUid: 'sarah', policy: { reviewIntervalMonths: 6 }, now: '2026-08-30T00:00:00Z',
    });
    expect(r.obligations.some((o) => o.reasonCode === 'PET_NOTES_STALE' && o.severity === 'OPTIONAL')).toBe(true);
    expect(r.primaryAction?.actionType).toBe('REVIEW_PET_PROFILE');
  });
});
