import { describe, it, expect } from 'vitest';
import { runPreflight, type PreflightFacts } from '../services/SumitPreflightCheck';

function baseFacts(): PreflightFacts {
  return {
    parentFlag: true,
    sendFlag: true,
    mode: 'email',
    invoice: {
      id: 42,
      status: 'ready_for_accountant',
      riskLevel: 'green',
      sumitStatus: null,
      sumitDocumentId: null,
    },
    supplier: {
      id: 7,
      isApproved: true,
      osekClassification: 'murshe',
    },
    env: {
      sumitApiKey: false,
      sumitCompanyId: false,
      sumitWebhookSecret: false,
      accountantEmail: true,
      sendgridApiKey: true,
    },
  };
}

describe('SumitPreflightCheck — happy path', () => {
  it('passes everything when all gates are open + email mode env present', () => {
    const r = runPreflight(baseFacts());
    expect(r.ready).toBe(true);
    expect(r.blockingReasonHe).toBeNull();
    expect(r.checks.every((c) => c.status === 'pass')).toBe(true);
  });
});

describe('SumitPreflightCheck — flag gates', () => {
  it('blocks when parent flag is off', () => {
    const r = runPreflight({ ...baseFacts(), parentFlag: false });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'parent_flag')?.status).toBe('fail');
  });

  it('blocks when send flag is off', () => {
    const r = runPreflight({ ...baseFacts(), sendFlag: false });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'send_flag')?.status).toBe('fail');
  });

  it('blocks when mode is off', () => {
    const r = runPreflight({ ...baseFacts(), mode: 'off' });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'activation_mode')?.status).toBe('fail');
  });
});

describe('SumitPreflightCheck — invoice gates', () => {
  const f = baseFacts();

  it('blocks when invoice not found', () => {
    const r = runPreflight({ ...f, invoice: null });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'invoice_exists')?.status).toBe('fail');
  });

  it('blocks when invoice status is not ready_for_accountant', () => {
    const r = runPreflight({
      ...f,
      invoice: { ...f.invoice!, status: 'needs_review' },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'invoice_status')?.status).toBe('fail');
  });

  it('blocks when invoice riskLevel is red', () => {
    const r = runPreflight({
      ...f,
      invoice: { ...f.invoice!, riskLevel: 'red' },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'invoice_risk')?.status).toBe('fail');
  });

  it('blocks when invoice already sent (idempotency)', () => {
    const r = runPreflight({
      ...f,
      invoice: { ...f.invoice!, sumitStatus: 'sent', sumitDocumentId: 'email:abc' },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'idempotency')?.status).toBe('fail');
  });

  it('blocks when invoice already confirmed', () => {
    const r = runPreflight({
      ...f,
      invoice: { ...f.invoice!, sumitStatus: 'confirmed', sumitDocumentId: 'doc_42' },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'idempotency')?.status).toBe('fail');
  });

  it('allows retry when prior attempt failed', () => {
    const r = runPreflight({
      ...f,
      invoice: { ...f.invoice!, sumitStatus: 'failed', sumitDocumentId: null },
    });
    expect(r.ready).toBe(true);
  });
});

describe('SumitPreflightCheck — supplier gates', () => {
  const f = baseFacts();

  it('blocks when supplier is null (no supplierId)', () => {
    const r = runPreflight({ ...f, supplier: null });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'supplier_present')?.status).toBe('fail');
  });

  it('blocks when supplier is not approved', () => {
    const r = runPreflight({
      ...f,
      supplier: { ...f.supplier!, isApproved: false },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'supplier_approved')?.status).toBe('fail');
  });

  it('blocks when supplier osek classification is unknown', () => {
    const r = runPreflight({
      ...f,
      supplier: { ...f.supplier!, osekClassification: 'unknown' },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'supplier_classified')?.status).toBe('fail');
  });
});

describe('SumitPreflightCheck — mode-specific env gates', () => {
  it('email mode blocks when ACCOUNTANT_EMAIL missing', () => {
    const f = baseFacts();
    const r = runPreflight({
      ...f,
      env: { ...f.env, accountantEmail: false },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'env_accountant_email')?.status).toBe('fail');
  });

  it('email mode blocks when SENDGRID_API_KEY missing', () => {
    const f = baseFacts();
    const r = runPreflight({
      ...f,
      env: { ...f.env, sendgridApiKey: false },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'env_sendgrid')?.status).toBe('fail');
  });

  it('api mode blocks when SUMIT_API_KEY missing', () => {
    const f = baseFacts();
    const r = runPreflight({
      ...f,
      mode: 'api',
      env: { ...f.env, sumitApiKey: false, sumitCompanyId: true, sumitWebhookSecret: true },
    });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.name === 'env_api_key')?.status).toBe('fail');
  });

  it('api mode requires all three SUMIT env vars', () => {
    const f = baseFacts();
    const r = runPreflight({
      ...f,
      mode: 'api',
      env: { ...f.env, sumitApiKey: true, sumitCompanyId: true, sumitWebhookSecret: true },
    });
    expect(r.ready).toBe(true);
  });

  it('csv_export mode does not require env beyond firebase', () => {
    const f = baseFacts();
    const r = runPreflight({
      ...f,
      mode: 'csv_export',
      env: { ...f.env, accountantEmail: false, sendgridApiKey: false },
    });
    expect(r.ready).toBe(true);
  });
});

describe('SumitPreflightCheck — first-failure summary', () => {
  it('blockingReasonHe is the labelHe of the first failing check', () => {
    const r = runPreflight({ ...baseFacts(), parentFlag: false });
    expect(r.blockingReasonHe).toBe('דגל-ראשי כבוי');
  });
});
