/**
 * Unit tests for server/services/coworker/providerCoworker.ts (PR-24).
 *
 * Mocks the readonly-db so each detection function runs against a stub
 * row payload and we can assert the finding shape. The tests deliberately
 * do not exercise real Postgres — that's covered by the SELECT-only guard
 * tests in PR-21.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock readonly-db before importing the module under test.
vi.mock('../services/coworker/readonly-db', () => {
  return {
    sql: (strings: TemplateStringsArray, ..._values: unknown[]) => ({
      __sql: strings.join('?'),
    }),
    readonlyDb: {
      execute: vi.fn(),
    },
  };
});

import { readonlyDb } from '../services/coworker/readonly-db';
import {
  detectStuckPendingReview,
  detectStaleUnderReview,
  detectLongOnHold,
  detectApprovedChecklistDrift,
  detectReadyButPending,
  detectBiometricStallout,
  detectCriminalCheckUntouched,
  detectPoliceCheckExpiring,
  detectInsuranceExpired,
  detectKycDocumentBacklog,
  detectExpiredSignedDocuments,
  detectMissingAuditTrail,
  detectIntakeConversionLag,
  detectInviteCodeDrift,
  runAllRules,
  PROVIDER_DETECTION_RULES,
} from '../services/coworker/providerCoworker';

const mockExecute = readonlyDb.execute as unknown as ReturnType<typeof vi.fn>;

function rowsOnce(rows: unknown[]) {
  mockExecute.mockResolvedValueOnce({ rows, rowCount: rows.length });
}

beforeEach(() => {
  mockExecute.mockReset();
});

describe('providerCoworker — detection functions', () => {
  it('P1 detectStuckPendingReview returns finding with applicationId', async () => {
    rowsOnce([
      {
        id: 42,
        application_id: 'APP-2026-000042',
        user_id: 'firebase-uid-1',
        submitted_at: '2026-04-01T10:00:00Z',
        status: 'pending_review',
      },
    ]);
    const findings = await detectStuckPendingReview();
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('P1');
    expect(findings[0].providerApplicationId).toBe(42);
    expect(findings[0].evidence).toMatchObject({
      applicationId: 'APP-2026-000042',
      userId: 'firebase-uid-1',
      status: 'pending_review',
    });
    expect(findings[0].signal).toContain('pending_review > 7d');
  });

  it('P2 detectStaleUnderReview maps assignment timestamps into evidence', async () => {
    rowsOnce([
      {
        id: 7,
        application_id: 'APP-2026-000007',
        assigned_to: 'admin-uid',
        assigned_at: '2026-04-20T09:00:00Z',
        reviewed_at: null,
        submitted_at: '2026-04-19T09:00:00Z',
      },
    ]);
    const findings = await detectStaleUnderReview();
    expect(findings[0].rule).toBe('P2');
    expect(findings[0].evidence.assignedTo).toBe('admin-uid');
    expect(findings[0].evidence.reviewedAt).toBeNull();
  });

  it('P3 detectLongOnHold has null providerApplicationId because it keys on providerId', async () => {
    rowsOnce([
      {
        id: 99,
        provider_id: 'WALKER-UUID-99',
        status: 'on_hold',
        review_notes: 'awaiting insurance',
        updated_at: '2026-04-01T00:00:00Z',
      },
    ]);
    const findings = await detectLongOnHold();
    expect(findings[0].rule).toBe('P3');
    expect(findings[0].providerApplicationId).toBeNull();
    expect(findings[0].evidence).toMatchObject({
      approvalQueueId: 99,
      providerId: 'WALKER-UUID-99',
    });
  });

  it('P4 detectApprovedChecklistDrift surfaces every checklist boolean', async () => {
    rowsOnce([
      {
        id: 11,
        provider_id: 'SITTER-UUID-11',
        photo_approved: true,
        certificate_approved: true,
        id_verified: true,
        address_verified: false, // drift
        police_check_approved: true,
        insurance_verified: true,
        pricing_approved: true,
      },
    ]);
    const findings = await detectApprovedChecklistDrift();
    expect(findings[0].rule).toBe('P4');
    expect(findings[0].evidence.addressVerified).toBe(false);
    expect(findings[0].evidence.policeCheckApproved).toBe(true);
  });

  it('P5 detectReadyButPending captures all-checked-but-pending row', async () => {
    rowsOnce([
      {
        id: 22,
        provider_id: 'WALKER-UUID-22',
        created_at: '2026-04-01T00:00:00Z',
      },
    ]);
    const findings = await detectReadyButPending();
    expect(findings[0].rule).toBe('P5');
    expect(findings[0].signal).toContain('status=pending');
  });

  it('P6 detectBiometricStallout surfaces verified biometric on draft application', async () => {
    rowsOnce([
      {
        id: 33,
        application_id: 'APP-2026-000033',
        biometric_status: 'verified',
        biometric_verified_at: '2026-04-25T00:00:00Z',
        status: 'draft',
      },
    ]);
    const findings = await detectBiometricStallout();
    expect(findings[0].rule).toBe('P6');
    expect(findings[0].evidence.status).toBe('draft');
  });

  it('P7 detectCriminalCheckUntouched flags requires_review with no admin follow-up', async () => {
    rowsOnce([
      {
        id: 44,
        application_id: 'APP-2026-000044',
        criminal_check_status: 'requires_review',
        criminal_check_completed_at: '2026-04-30T00:00:00Z',
        reviewed_at: null,
      },
    ]);
    const findings = await detectCriminalCheckUntouched();
    expect(findings[0].rule).toBe('P7');
    expect(findings[0].evidence.reviewedAt).toBeNull();
  });

  it('P8 detectPoliceCheckExpiring surfaces approved checks within 30d of expiry', async () => {
    rowsOnce([
      {
        id: 55,
        provider_id: 'WALKER-UUID-55',
        status: 'approved',
        issued_at: '2026-01-01T00:00:00Z',
        expires_at: '2026-05-15T00:00:00Z',
      },
    ]);
    const findings = await detectPoliceCheckExpiring();
    expect(findings[0].rule).toBe('P8');
    expect(findings[0].evidence.expiresAt).toBe('2026-05-15T00:00:00Z');
  });

  it('P9 detectInsuranceExpired flags approved providers with lapsed coverage', async () => {
    rowsOnce([
      {
        id: 66,
        application_id: 'APP-2026-000066',
        insurance_provider: 'Harel',
        insurance_expires_at: '2026-04-01T00:00:00Z',
        status: 'approved',
      },
    ]);
    const findings = await detectInsuranceExpired();
    expect(findings[0].rule).toBe('P9');
    expect(findings[0].evidence.insuranceProvider).toBe('Harel');
  });

  it('P10 detectKycDocumentBacklog surfaces stale received docs', async () => {
    rowsOnce([
      {
        id: 77,
        kyc_case_id: 7,
        doc_type: 'passport',
        uploaded_at: '2026-04-30T00:00:00Z',
        status: 'received',
      },
    ]);
    const findings = await detectKycDocumentBacklog();
    expect(findings[0].rule).toBe('P10');
    expect(findings[0].evidence.docType).toBe('passport');
    expect(findings[0].providerApplicationId).toBeNull();
  });

  it('P11 detectExpiredSignedDocuments flags active docs past expiry', async () => {
    rowsOnce([
      {
        id: 88,
        document_type: 'contract',
        document_title: 'Provider Agreement',
        signed_by: 'Yoni Cohen',
        signed_date: '2025-01-01T00:00:00Z',
        expiry_date: '2026-01-01T00:00:00Z',
        status: 'active',
      },
    ]);
    const findings = await detectExpiredSignedDocuments();
    expect(findings[0].rule).toBe('P11');
    expect(findings[0].evidence.documentType).toBe('contract');
  });

  it('P12 detectMissingAuditTrail flags approvals with no audit row', async () => {
    rowsOnce([
      {
        id: 100,
        application_id: 'APP-2026-000100',
        status: 'approved',
        reviewed_at: '2026-05-01T00:00:00Z',
        reviewed_by: 'admin-uid',
      },
    ]);
    const findings = await detectMissingAuditTrail();
    expect(findings[0].rule).toBe('P12');
    expect(findings[0].providerApplicationId).toBe(100);
    expect(findings[0].signal).toContain('no provider_review_audit row');
  });

  it('P13 detectIntakeConversionLag flags unconverted intake rows', async () => {
    rowsOnce([
      {
        id: 200,
        intake_id: 'INT-2026-000200',
        email: 'a@b.com',
        synced_at: '2026-04-01T00:00:00Z',
      },
    ]);
    const findings = await detectIntakeConversionLag();
    expect(findings[0].rule).toBe('P13');
    expect(findings[0].evidence.intakeId).toBe('INT-2026-000200');
  });

  it('P14 detectInviteCodeDrift flags overuse / expired-but-active codes', async () => {
    rowsOnce([
      {
        invite_code: 'WALKER-A8F3H9K2',
        provider_type: 'walker',
        max_uses: 1,
        current_uses: 5,
        expires_at: null,
        is_active: true,
      },
    ]);
    const findings = await detectInviteCodeDrift();
    expect(findings[0].rule).toBe('P14');
    expect(findings[0].evidence.currentUses).toBe(5);
  });

  it('returns an empty list when the underlying query has no rows', async () => {
    rowsOnce([]);
    const findings = await detectStuckPendingReview();
    expect(findings).toEqual([]);
  });
});

describe('providerCoworker — runAllRules', () => {
  it('aggregates findings across every rule and isolates failures', async () => {
    // 14 rules; mock the first 13 to return one row each, last to throw.
    // Order of execution is parallel, so the queue of mocked responses is
    // consumed in invocation order — we rely on Object.entries order, which
    // mirrors PROVIDER_DETECTION_RULES insertion order.
    const ruleIds = Object.keys(PROVIDER_DETECTION_RULES);
    expect(ruleIds).toHaveLength(14);

    // Provide a generic happy row for the first 13 calls.
    for (let i = 0; i < 13; i++) {
      mockExecute.mockResolvedValueOnce({
        rows: [
          {
            id: i + 1,
            application_id: `APP-${i}`,
            user_id: 'u',
            provider_id: 'p',
            invite_code: 'c',
            provider_type: 'walker',
            max_uses: 1,
            current_uses: 1,
            kyc_case_id: 1,
            doc_type: 'passport',
            uploaded_at: '2026-04-01',
            status: 'x',
            biometric_status: 'verified',
            biometric_verified_at: '2026-04-01',
            criminal_check_status: 'requires_review',
            criminal_check_completed_at: '2026-04-01',
            reviewed_at: null,
            issued_at: null,
            expires_at: '2026-05-15',
            insurance_provider: 'X',
            insurance_expires_at: '2026-04-01',
            document_type: 'contract',
            document_title: 't',
            signed_by: 's',
            signed_date: null,
            expiry_date: '2026-04-01',
            review_notes: null,
            updated_at: null,
            created_at: null,
            assigned_to: null,
            assigned_at: null,
            submitted_at: null,
            reviewed_by: null,
            photo_approved: false,
            certificate_approved: true,
            id_verified: true,
            address_verified: true,
            police_check_approved: true,
            insurance_verified: true,
            pricing_approved: true,
            intake_id: 'INT-1',
            email: 'a@b.com',
            synced_at: '2026-04-01',
            is_active: true,
          },
        ],
        rowCount: 1,
      });
    }
    mockExecute.mockRejectedValueOnce(new Error('boom'));

    const result = await runAllRules();
    expect(result.findings.length).toBeGreaterThanOrEqual(13);
    expect(result.failedRules).toHaveLength(1);
    expect(result.failedRules[0].error).toBe('boom');
  });
});
