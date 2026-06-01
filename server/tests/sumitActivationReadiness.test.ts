import { describe, expect, it } from 'vitest';
import {
  buildSumitActivationReadiness,
  type SumitActivationReadinessInput,
} from '../services/SumitActivationReadiness';

function baseInput(): SumitActivationReadinessInput {
  return {
    mode: 'api',
    parentFlag: true,
    sendFlag: true,
    wired: true,
    wiredReason: null,
    env: {
      sumitApiKey: true,
      sumitCompanyId: true,
      sumitWebhookSecret: true,
      accountantEmail: true,
      sendgridApiKey: true,
    },
    osekBuckets: {
      patur: 2,
      murshe: 3,
      chevra: 1,
      unknown: 0,
    },
    queue: {
      DONE: 12,
    },
    invoiceCounts: {
      sent: 2,
      failed: 0,
    },
  };
}

describe('SumitActivationReadiness', () => {
  it('marks the system ready only when all live API canary gates are clean', () => {
    const result = buildSumitActivationReadiness(baseInput());

    expect(result.phase).toBe('PHASE_6_FULL_ON_READY');
    expect(result.apiEnvReady).toBe(true);
    expect(result.canaryReady).toBe(true);
    expect(result.fullLiveReady).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks when suppliers or providers still have unknown osek classification', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      osekBuckets: { patur: 1, unknown: 4 },
    });

    expect(result.phase).toBe('PHASE_1_CLASSIFY_SUPPLIERS');
    expect(result.canaryReady).toBe(false);
    expect(result.unknownOsekCount).toBe(4);
    expect(result.blockers.map((b) => b.code)).toContain('SUMIT_UNKNOWN_OSEK_CLASSIFICATION');
    expect(result.approvalRequired.finance).toBe(true);
  });

  it('blocks API mode when SUMIT server-side secrets are missing', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      env: {
        ...baseInput().env,
        sumitApiKey: false,
      },
    });

    expect(result.phase).toBe('PHASE_2_BIND_SECRETS');
    expect(result.apiEnvReady).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain('SUMIT_API_SECRETS_MISSING');
    expect(result.approvalRequired.engineering).toBe(true);
  });

  it('keeps dry-run as the active phase until Nir enables mode/api and the send flag', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      mode: 'email',
      sendFlag: false,
    });

    expect(result.phase).toBe('PHASE_4_DRY_RUN_REVIEW');
    expect(result.canaryReady).toBe(false);
    expect(result.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining(['SUMIT_MODE_NOT_API', 'SUMIT_SEND_FLAG_OFF']),
    );
    expect(result.approvalRequired.nir).toBe(true);
  });

  it('does not allow canary when the SUMIT client is not wired', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      wired: false,
      wiredReason: 'SumitClient not wired — set SUMIT_ENABLED=true',
    });

    expect(result.phase).toBe('PHASE_3_FIX_CLIENT_AND_SIMULATOR');
    expect(result.canaryReady).toBe(false);
    expect(result.blockers.find((b) => b.code === 'SUMIT_CLIENT_NOT_WIRED')?.message).toContain(
      'SUMIT_ENABLED=true',
    );
  });

  it('separates canary readiness from full-live readiness when failed invoices remain', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      invoiceCounts: { sent: 5, failed: 1 },
    });

    expect(result.phase).toBe('PHASE_5_CANARY_READY');
    expect(result.canaryReady).toBe(true);
    expect(result.fullLiveReady).toBe(false);
    expect(result.approvalRequired.accountant).toBe(true);
    expect(result.blockers.map((b) => b.code)).toContain('SUMIT_FAILED_INVOICES_OPEN');
  });

  it('blocks full live while SUMIT jobs are still pending even if canary gates are clean', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      queue: { DONE: 10, PENDING: 2 },
    });

    expect(result.phase).toBe('PHASE_5_CANARY_READY');
    expect(result.canaryReady).toBe(true);
    expect(result.fullLiveReady).toBe(false);
    expect(result.pendingJobCount).toBe(2);
  });

  it('blocks canary when previous SUMIT jobs failed', () => {
    const result = buildSumitActivationReadiness({
      ...baseInput(),
      queue: { DONE: 10, FAILED: 1 },
    });

    expect(result.canaryReady).toBe(false);
    expect(result.fullLiveReady).toBe(false);
    expect(result.blockers.map((b) => b.code)).toContain('SUMIT_FAILED_JOBS_OPEN');
  });
});
