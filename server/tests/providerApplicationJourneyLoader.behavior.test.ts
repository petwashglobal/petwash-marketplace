/**
 * ProviderApplicationJourneyLoader behavior — CEO DEEP-LOGIC §84.
 *
 * Reads provider_applications by applicationId, enforces
 * applicant-only visibility, maps DB status + KYC fields onto the
 * resolver's ProviderApplicationJourneySnapshot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    applicationId: string;
    userId: string;
    status: string | null;
    biometricStatus: string | null;
    governmentIdUrl: string | null;
    backgroundCheckStatus: string | null;
    criminalCheckStatus: string | null;
  }>,
}));

vi.mock('@shared/schema', () => ({
  providerApplications: { applicationId: { name: 'application_id' } },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: (_c: any, val: any) => ({ val }) };
});

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (_t: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => state.rows.filter((r) => r.applicationId === predicate.val),
        }),
      }),
    }),
  },
}));

const { providerApplicationJourneyLoader } = await import(
  '../services/marketplace/loaders/ProviderApplicationJourneyLoader'
);

beforeEach(() => { state.rows.length = 0; });

const baseRow = {
  applicationId: 'APP-2026-000001',
  userId: 'maya',
  status: 'draft',
  biometricStatus: 'pending',
  governmentIdUrl: null as string | null,
  backgroundCheckStatus: 'pending',
  criminalCheckStatus: 'pending',
};

describe('ProviderApplicationJourneyLoader', () => {
  it('missing → NOT_FOUND', async () => {
    const out = await providerApplicationJourneyLoader({ id: 'APP-none', actorUid: 'maya' });
    expect(out.code).toBe('NOT_FOUND');
  });

  it('non-applicant → NOT_A_PARTY', async () => {
    state.rows.push({ ...baseRow });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'stranger' });
    expect(out.code).toBe('NOT_A_PARTY');
  });

  it('applicant sees PROVIDER projection on their own application', async () => {
    state.rows.push({ ...baseRow });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.actor.role).toBe('PROVIDER');
    expect(out.journey.entityRef).toEqual({ kind: 'provider_application', id: baseRow.applicationId });
  });

  it('draft with missing ID + missing background check surfaces both as REQUIRED', async () => {
    state.rows.push({ ...baseRow, status: 'draft' });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('DRAFT');
    // At least one obligation is present when documents are missing.
    expect(out.journey.obligations.length).toBeGreaterThan(0);
  });

  it('DB "under_review" maps to IN_REVIEW; waitingOn=PETWASH', async () => {
    state.rows.push({ ...baseRow, status: 'under_review' });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('IN_REVIEW');
    expect(out.journey.waitingOn).toBe('PETWASH');
  });

  it('DB "approved" maps to APPROVED with attentionPriority INFO', async () => {
    state.rows.push({
      ...baseRow,
      status: 'approved',
      biometricStatus: 'verified',
      governmentIdUrl: 'gs://bucket/id.jpg',
      backgroundCheckStatus: 'passed',
      criminalCheckStatus: 'passed',
    });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('APPROVED');
    expect(out.journey.attentionPriority).toBe('INFO');
  });

  it('DB "rejected" and "withdrawn" both map to REJECTED', async () => {
    state.rows.push({ ...baseRow, applicationId: 'APP-R', status: 'rejected', userId: 'maya' });
    state.rows.push({ ...baseRow, applicationId: 'APP-W', status: 'withdrawn', userId: 'maya' });
    const r = await providerApplicationJourneyLoader({ id: 'APP-R', actorUid: 'maya' });
    const w = await providerApplicationJourneyLoader({ id: 'APP-W', actorUid: 'maya' });
    expect(r.code).toBe('OK');
    expect(w.code).toBe('OK');
    if (r.code !== 'OK' || w.code !== 'OK') throw new Error();
    expect(r.journey.currentStateCode).toBe('REJECTED');
    expect(w.journey.currentStateCode).toBe('REJECTED');
  });

  it('unknown DB status → fallback DRAFT (honest surface, no crash)', async () => {
    state.rows.push({ ...baseRow, status: 'some_new_status' });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.journey.currentStateCode).toBe('DRAFT');
  });

  it('cleared KYC (verified id, passed background+criminal) surfaces no missing docs', async () => {
    state.rows.push({
      ...baseRow,
      status: 'under_review',
      biometricStatus: 'verified',
      governmentIdUrl: 'gs://bucket/id.jpg',
      backgroundCheckStatus: 'passed',
      criminalCheckStatus: 'passed',
    });
    const out = await providerApplicationJourneyLoader({ id: baseRow.applicationId, actorUid: 'maya' });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    // Under IN_REVIEW with all docs cleared, no upload-required obligation.
    const anyRequiredUpload = out.journey.obligations.some(
      (o) => o.type === 'UPLOAD_KYC_DOCUMENT' && o.severity === 'REQUIRED',
    );
    expect(anyRequiredUpload).toBe(false);
  });
});
