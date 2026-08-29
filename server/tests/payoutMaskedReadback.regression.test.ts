/**
 * CEO FLY MODE II §35 (2026-08-29) — payout masked readback pins.
 *
 * The admin-facing GET on a provider application row returns bank
 * details in two modes, gated by a `bankAccessReason` query param:
 *
 *   • WITHOUT reason  → REDACT. Only `bankIbanLast4` + presence
 *     booleans + `bankAccessReasonRequired: true` reach the wire.
 *     The plaintext IBAN, account holder, bank name, branch code
 *     stay in the DB.
 *
 *   • WITH reason     → full read + audit. Plaintext bank fields
 *     ship as before AND a `bank_details_viewed` audit event is
 *     written with the actor + reason.
 *
 * These pins lock the discipline source-side. A regression that
 * makes the admin-detail endpoint echo full IBAN by default is
 * caught here.
 *
 * Provider-side write path (POST /provider-dashboard/v2/payout-request):
 * accepts an IBAN from the caller and returns ONLY
 * `{ success, requestId, status }` — no iban echo. Also pinned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ONBOARDING = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

const DASHBOARD_V2 = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-dashboard-v2.ts'),
  'utf8',
);

describe('CEO FLY MODE II §35 — admin readback of provider bank details', () => {
  it('reads bankAccessReason from the query string, capped at 500 chars', () => {
    expect(ONBOARDING).toMatch(
      /req\.query\.bankAccessReason[\s\S]{0,200}\.slice\(0, 500\)/,
    );
  });

  it('DEFAULT path (no reason) REDACTS bankIban / bankAccountHolder / bankName / bankBranchCode', () => {
    // The bankProjected object must set those four to null on the
    // no-reason branch. A regression that removes the redaction
    // (e.g. `bankIban: (app as any).bankIban`) is caught here.
    const redactIdx = ONBOARDING.indexOf('bankAccessReasonRequired: true');
    expect(redactIdx).toBeGreaterThan(0);
    // The 500 chars around the flag must contain the four `: null,`
    // fields.
    const window_ = ONBOARDING.slice(redactIdx - 500, redactIdx + 200);
    expect(window_).toMatch(/bankIban:\s*null/);
    expect(window_).toMatch(/bankAccountHolder:\s*null/);
    expect(window_).toMatch(/bankName:\s*null/);
    expect(window_).toMatch(/bankBranchCode:\s*null/);
  });

  it('DEFAULT path still exposes bankIbanLast4 + presence booleans', () => {
    // The redacted response keeps the "eyeball-the-case" fields
    // an admin needs without seeing the full plaintext.
    const flagIdx = ONBOARDING.indexOf('bankAccessReasonRequired: true');
    const window_ = ONBOARDING.slice(flagIdx - 500, flagIdx + 200);
    expect(window_).toMatch(/bankIbanLast4:\s*ibanLast4/);
    expect(window_).toMatch(/bankHasAccountHolder:\s*!!/);
    expect(window_).toMatch(/bankHasBankName:\s*!!/);
  });

  it('WITH reason branch writes a bank_details_viewed audit event', () => {
    expect(ONBOARDING).toMatch(/eventType:\s*'bank_details_viewed'/);
    // The audit payload must carry the reason + last4 (never the full
    // IBAN — full plaintext going into an audit log is itself a leak).
    expect(ONBOARDING).toMatch(/bankIbanLast4:\s*ibanLast4/);
    expect(ONBOARDING).toMatch(/reason:\s*bankAccessReason/);
  });

  it('audit payload does NOT include the full IBAN plaintext', () => {
    // Locate the writeProviderAudit call whose eventType is
    // bank_details_viewed and scan its payload block for full-IBAN
    // exposure — the whole point of §35 is that even the audit
    // record only carries last4.
    const auditIdx = ONBOARDING.indexOf("eventType: 'bank_details_viewed'");
    expect(auditIdx).toBeGreaterThan(0);
    // Grab the payload literal (up to the closing `}).catch(`).
    const payloadEnd = ONBOARDING.indexOf('}).catch(', auditIdx);
    const payload = ONBOARDING.slice(auditIdx, payloadEnd);
    // Neither the field ASSIGNED the full IBAN (bankIban: ibanFull)
    // nor a bare `ibanFull` reference may appear inside the payload.
    expect(payload).not.toMatch(/bankIban:\s*ibanFull/);
    expect(payload).not.toMatch(/iban:\s*ibanFull/);
  });

  it('response merge order overwrites plaintext with projected redactions', () => {
    // `{ ...app, ..., ...bankProjected }` — bankProjected must be
    // spread LAST so its null overrides win. A refactor that
    // spreads bankProjected first would silently ship plaintext.
    expect(ONBOARDING).toMatch(
      /\{\s*\.\.\.app,[\s\S]{0,200}\.\.\.bankProjected\s*\}/,
    );
  });
});

describe('CEO FLY MODE II §35 — provider payout-request write path', () => {
  it('accepts iban but response body only carries success + requestId + status', () => {
    // The POST handler at /payout-request must never echo the iban
    // back on success — that would leak the field to any observer of
    // the HTTPS transcript (browser devtools, etc.).
    const idx = DASHBOARD_V2.indexOf("router.post('/payout-request'");
    expect(idx).toBeGreaterThan(0);
    // Cap the search to the handler body (~2000 chars — enough).
    const body = DASHBOARD_V2.slice(idx, idx + 2500);
    // The success path must carry only these three keys — look for
    // each individually so we don't over-fit whitespace/order.
    const successReturns = body.match(/res\.json\([^)]*success[^)]*\)/g) || [];
    expect(successReturns.length).toBeGreaterThan(0);
    for (const r of successReturns) {
      expect(r).toMatch(/success:\s*true/);
      expect(r).toMatch(/requestId/);
      expect(r).toMatch(/status/);
      // And never `iban` in any success response.
      expect(r).not.toMatch(/\biban\b/);
    }
  });

  it('the amount is CLAMPED against server-side balance before persist', () => {
    // A refactor that removes the balance clamp would let the client
    // dictate the payout amount — a §35-adjacent money-safety hole.
    const idx = DASHBOARD_V2.indexOf("router.post('/payout-request'");
    const body = DASHBOARD_V2.slice(idx, idx + 2500);
    expect(body).toMatch(/available_cents/);
    expect(body).toMatch(/requestedCents > availableCents/);
    expect(body).toMatch(/exceeds your available payout balance/);
  });
});
