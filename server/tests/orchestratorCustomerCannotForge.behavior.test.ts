/**
 * Behavioural test — server/routes/petwatch-orchestrator.ts (2026-09-18).
 *
 * The router got `validateFirebaseToken` in an earlier sweep, which stopped
 * ANONYMOUS callers. It did not stop a SIGNED-IN CUSTOMER: an ordinary account
 * with a Firebase token could still POST every back-office event and have the
 * business record it as fact —
 *
 *   /kyc-submit, /kyb-submit   → a compliance record for any userId, any ID
 *                                number, status 'auto_approved' if asked
 *   /onboarding-approved       → a provider "approved" row + welcome email
 *   /esign-complete            → a signed-agreement record + signer email
 *   /contract-generated        → a contract record + party email
 *   /booking-confirmed, /calendar/booking → calendar entries + branded PetWash
 *                                email to any address the caller supplies
 *   /generate-statement        → amounts + VAT for a named recipient, into the
 *                                E-Statements sheet
 *
 * None of these has a legitimate client caller: the product's own flows call
 * the orchestrator SERVICE in-process. So the gate is verified-admin, with the
 * two money-shaped endpoints (/job-complete, /generate-statement) allowing an
 * approved provider as well, and /health staying public for uptime probes.
 *
 * Real supertest against the real router; auth/capability middleware faked so
 * the ROUTE's own gate is what is exercised.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let injectUid: string | null = 'customer-1';
let injectEmail = 'customer@example.com';
let injectIsAdmin = false;
let injectIsProvider = false;

vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, res: any, next: any) => {
    if (!injectUid) return res.status(401).json({ error: 'Authentication required' });
    req.user = { uid: injectUid, email: injectEmail };
    req.firebaseUser = { uid: injectUid, email: injectEmail, email_verified: true };
    return next();
  },
}));

vi.mock('../middleware/rbac', () => ({
  isSuperAdminVerified: () => injectIsAdmin,
  // Mirrors the real middleware: verified super-admin passes, everyone else 403.
  requireAdmin: (req: any, res: any, next: any) => {
    if (!req.firebaseUser?.email) return res.status(401).json({ error: 'Authentication required' });
    if (!injectIsAdmin) return res.status(403).json({ error: 'Admin access required' });
    return next();
  },
}));

vi.mock('../lib/userCapabilities', () => ({
  getUserCapabilities: async () => ({ provider: injectIsProvider }),
}));
vi.mock('../../shared/lib/userCapabilities', () => ({
  hasProviderCapability: (caps: any) => !!caps?.provider,
}));

const handled: string[] = [];
/** The routes queue their work with setImmediate; let the loop turn. */
const settle = () => new Promise<void>((r) => setImmediate(() => setImmediate(r)));
const orchestratorStub = new Proxy({}, {
  get: (_t, name: string) => async (..._args: any[]) => {
    handled.push(name);
    return { ok: true, invoiceNumber: 'INV-TEST' };
  },
});
vi.mock('../services/PetWashOperationsOrchestrator', () => ({
  petWashOrchestrator: orchestratorStub,
}));

const sheetWrites: string[] = [];
vi.mock('../services/googleSheetsIntegration', () => ({
  GoogleSheetsService: {
    appendToSheet: async (sheet: string) => { sheetWrites.push(sheet); },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
vi.mock('../lib/sanitizeErrorResponse', () => ({
  sendSanitizedError: (res: any, _e: any, code: string, opts: any) =>
    res.status(opts?.status ?? 400).json({ error: code }),
}));

async function app() {
  const mod = await import('../routes/petwatch-orchestrator');
  const a = express();
  a.use(express.json());
  a.use('/api/orchestrator', mod.default);
  return a;
}

/** A well-formed body for each route, so a refusal can only be the gate. */
const BODIES: Record<string, any> = {
  '/calendar/booking': {
    bookingRef: 'BK-1', platform: 'sitter_suite', serviceType: 'boarding',
    date: '2026-10-01', time: '10:00', firstName: 'Victim',
    email: 'victim@example.com', phone: '0500000000',
  },
  '/generate-statement': {
    period: '2026-09', recipientName: 'Victim', recipientEmail: 'victim@example.com',
    transactions: [{ date: '2026-09-01', description: 'x', amountILS: 100 }],
    type: 'provider',
  },
  '/kyc-submit': { userId: 'someone-else', fullName: 'Victim', status: 'auto_approved' },
  '/kyb-submit': {
    businessId: 'B-1', businessName: 'Acme', contactName: 'Victim',
    contactEmail: 'victim@example.com', status: 'approved',
  },
  '/booking-confirmed': {
    bookingId: '1', bookingRef: 'BK-1', customerEmail: 'victim@example.com',
    scheduledDate: '2026-10-01',
  },
  '/esign-complete': {
    submissionId: 'DOC-1', signerName: 'Victim', signerEmail: 'victim@example.com',
    documentType: 'provider_agreement',
  },
  '/onboarding-approved': {
    applicationId: 'A-1', platform: 'sitter_suite', firstName: 'Victim',
    lastName: 'User', email: 'victim@example.com',
  },
  '/contract-generated': {
    contractId: 'C-1', contractNumber: 'CN-1', contractType: 'contractor_agreement',
    partyName: 'Victim', partyEmail: 'victim@example.com',
  },
};
const BACK_OFFICE = Object.keys(BODIES).filter(p => p !== '/generate-statement');

beforeEach(() => {
  injectUid = 'customer-1';
  injectEmail = 'customer@example.com';
  injectIsAdmin = false;
  injectIsProvider = false;
  handled.length = 0;
  sheetWrites.length = 0;
});

describe('a signed-in customer cannot forge back-office records', () => {
  it.each(BACK_OFFICE)('%s refuses an ordinary account', async (path) => {
    const res = await request(await app()).post(`/api/orchestrator${path}`).send(BODIES[path]);
    expect(res.status).toBe(403);
    await settle();
    expect(handled, `${path} still reached the orchestrator`).toEqual([]);
  });

  it('being an approved PROVIDER is not enough for a back-office event', async () => {
    injectIsProvider = true;
    for (const path of BACK_OFFICE) {
      const res = await request(await app()).post(`/api/orchestrator${path}`).send(BODIES[path]);
      expect(res.status, path).toBe(403);
    }
    await settle();
    expect(handled).toEqual([]);
  });

  it('a verified admin still gets through', async () => {
    injectIsAdmin = true;
    for (const path of BACK_OFFICE) {
      const res = await request(await app()).post(`/api/orchestrator${path}`).send(BODIES[path]);
      expect(res.status, path).toBeLessThan(400);
    }
    await settle();
    expect(handled.length).toBe(BACK_OFFICE.length);
  });
});

describe('the money-shaped endpoints allow a provider, not a customer', () => {
  it('a customer cannot write a statement into the E-Statements sheet', async () => {
    const res = await request(await app())
      .post('/api/orchestrator/generate-statement').send(BODIES['/generate-statement']);
    expect(res.status).toBe(403);
    expect(sheetWrites).toEqual([]);
  });

  it('an approved provider can', async () => {
    injectIsProvider = true;
    const res = await request(await app())
      .post('/api/orchestrator/generate-statement').send(BODIES['/generate-statement']);
    expect(res.status).toBe(200);
    expect(sheetWrites).toEqual(['E-Statements']);
  });

  it('a customer cannot mint a tax document with /job-complete', async () => {
    const res = await request(await app()).post('/api/orchestrator/job-complete').send({
      bookingRef: 'BK-1', platform: 'sitter_suite', serviceType: 'boarding',
      customerName: 'Victim', customerEmail: 'victim@example.com',
      providerName: 'Someone', amountILS: 1,
    });
    expect(res.status).toBe(403);
    await settle();
    expect(handled).toEqual([]);
  });
});

describe('the uptime probe stays public', () => {
  it('/health answers without a token', async () => {
    injectUid = null;
    const res = await request(await app()).get('/api/orchestrator/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
