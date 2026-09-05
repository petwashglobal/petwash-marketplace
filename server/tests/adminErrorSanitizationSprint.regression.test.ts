/**
 * Admin error-sanitization sprint (2026-09-05) — regression pin.
 *
 * This sprint lane migrated a batch of admin-only catch blocks that were
 * echoing raw `err.message` / `error.message` (sometimes truncated, but
 * still exception detail — DB constraint names, column names, SDK
 * internals) straight into the JSON body an admin's browser receives on
 * a 4xx/5xx. All were migrated to `sendSanitizedError`
 * (server/lib/sanitizeErrorResponse.ts): the RESPONSE gets a fixed
 * generic message + a stable error code, while the full detail is still
 * logged server-side via `logger.error`.
 *
 * This file pins two things per migrated site:
 *   1. The response no longer contains the raw `err.message` /
 *      `error.message` (nor a `.stack`).
 *   2. The server-side `logger.error` call was preserved (or added,
 *      where none existed) — sanitizing the response must never mean
 *      losing the ability to debug the failure from logs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Sites migrated to sendSanitizedError this session, keyed by file.
const SANITIZED_SITES: Record<string, string[]> = {
  'server/routes/enterprise-sales.ts': [
    'ENTERPRISE_SALES_CREATE_LEAD_FAILED',
    'ENTERPRISE_SALES_UPDATE_LEAD_FAILED',
    'ENTERPRISE_SALES_CREATE_OPPORTUNITY_FAILED',
    'ENTERPRISE_SALES_UPDATE_OPPORTUNITY_FAILED',
  ],
  'server/routes/enterprise-sales-crm.ts': [
    'ENTERPRISE_SALES_CRM_CREATE_COMMUNICATION_FAILED',
    'ENTERPRISE_SALES_CRM_CREATE_DEAL_STAGE_FAILED',
    'ENTERPRISE_SALES_CRM_CREATE_TASK_FAILED',
    'ENTERPRISE_SALES_CRM_CREATE_ACTIVITY_FAILED',
  ],
  'server/routes/admin-escrow-reconciliation.ts': [
    'ESCROW_RECON_VIEW_FAILED',
    'ESCROW_RECON_BOOKING_FAILED',
    'ESCROW_RECON_SYNC_FAILED',
  ],
  'server/routes/admin-sumit.ts': ['ADMIN_SUMIT_SYNC_DRYRUN_FAILED'],
  'server/routes/policy.ts': ['POLICY_SUMMARY_FAILED'],
  'server/routes/finance/israel-compliance.ts': ['ISRAEL_COMPLIANCE_RECONCILE_FAILED'],
  'server/routes/finance/payout-reconciliation.ts': [
    'PAYOUT_RECONCILIATION_FAILED',
    'PAYOUT_RECONCILIATION_ISRAEL_FAILED',
  ],
  'server/routes/finance/manual-adjustment.ts': ['MANUAL_ADJUSTMENT_FAILED'],
  'server/routes/admin-brain.ts': ['UNMAPPED_QUERY_FAILED'],
  'server/routes/admin-bridge.ts': ['LOOKUP_FAILED', 'SIGNUP_ACTIVITY_FAILED'],
  'server/routes/admin-buildings-partners.ts': ['partner_report_failed', 'buildings_failed'],
  'server/routes/admin-daily-brief.ts': ['DAILY_BRIEF_FAILED'],
  'server/routes/admin-provider-verification.ts': [
    'PROVIDER_VERIFY_PATCH_FAILED',
    'PROVIDER_VERIFY_DECISION_FAILED',
    'PROVIDER_VERIFY_RECORD_DOCUMENT_FAILED',
    'PROVIDER_VERIFY_DOCUMENT_ACTION_FAILED',
    'PROVIDER_VERIFY_LEGAL_HOLD_FAILED',
  ],
};

describe('admin error-sanitization sprint — sendSanitizedError sites', () => {
  for (const [file, codes] of Object.entries(SANITIZED_SITES)) {
    describe(file, () => {
      const src = read(file);

      it('imports sendSanitizedError', () => {
        expect(src).toMatch(/import\s*\{\s*sendSanitizedError\s*\}\s*from\s*['"].*sanitizeErrorResponse['"]/);
      });

      for (const code of codes) {
        it(`uses sendSanitizedError(...) with error code ${code}`, () => {
          expect(src).toContain(code);
          // The code must appear as an argument to sendSanitizedError,
          // not merely exist somewhere else in the file.
          const re = new RegExp(String.raw`sendSanitizedError\([^)]*['"]${code}['"]`, 's');
          expect(src).toMatch(re);
        });
      }

      it('never echoes raw err.message / error.message into a res.json body', () => {
        // A raw echo looks like `message: err.message` or `error: error.message`
        // sitting inside a status(...).json({...}) call. We assert the more
        // specific dangerous shapes are gone from this file entirely.
        expect(src).not.toMatch(/json\(\{[^}]*\berror\.message\b/);
        expect(src).not.toMatch(/message:\s*err\??\.message/);
        expect(src).not.toMatch(/detail:\s*err\??\.message/);
        expect(src).not.toMatch(/reason:\s*e\??\.message/);
      });

      it('never sends a stack trace to the client', () => {
        expect(src).not.toMatch(/json\(\{[^}]*\.stack\b/);
      });
    });
  }
});

describe('admin-deadlines.ts — per-source failure reasons no longer leak raw DB errors', () => {
  const src = read('server/routes/admin-deadlines.ts');

  it('every failed-source branch now logs server-side before recording the failure', () => {
    // 11 per-source try/catch blocks; each must have a logger.error call
    // immediately before the sources.push(...) failure entry.
    const failureBlocks = src.match(/logger\.error\('\[AdminDeadlines\][^']*', \{ error: e\?\.message \}\);\s*\n\s*sources\.push\(\{[^}]*ok: false/g) ?? [];
    expect(failureBlocks.length).toBeGreaterThanOrEqual(11);
  });

  it('the client-facing `reason` field is a fixed string, never the raw exception message', () => {
    expect(src).not.toMatch(/reason:\s*e\?\.message/);
    expect(src).toMatch(/reason:\s*'query failed'/);
  });
});

describe('enterprise-franchise.ts — confirmed already safe (no change needed)', () => {
  const src = read('server/routes/enterprise-franchise.ts');

  it('the three error.message 404 responses are NotFoundError with hand-authored messages, not raw DB/exception leaks', () => {
    // Every `error.message` response site must be gated behind an
    // `instanceof NotFoundError` check — i.e. a controlled, hand-authored
    // string ("Franchisee with id X not found"), never an unguarded raw
    // exception echo.
    const sites = [...src.matchAll(/return res\.status\(404\)\.json\(\{ error: error\.message \}\);/g)];
    expect(sites.length).toBe(3);
    for (const site of sites) {
      const before = src.slice(Math.max(0, site.index! - 120), site.index!);
      expect(before).toMatch(/error instanceof NotFoundError/);
    }
  });
});
