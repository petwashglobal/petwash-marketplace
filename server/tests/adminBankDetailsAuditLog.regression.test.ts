/**
 * CEO §37 (2026-08-28) — bank / payout view is a sensitive access.
 *
 * The admin application-detail endpoint returns the applicant's full
 * IBAN + account holder name (Israeli Privacy Law adjacent — the
 * provider needs to prove the holder before payout). Every read that
 * ACTUALLY exposed a bank field must be audit-logged so ops can prove
 * who saw what and when. Mirrors the id_document_viewed /
 * selfie_photo_viewed pattern.
 *
 * IBAN itself must NEVER land in the audit payload — only its last 4
 * chars + presence flags. The full value stays in the DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('admin application detail — bank_details_viewed audit (CEO §37 + §41)', () => {
  it('writes a bank_details_viewed audit only when the row actually carried a bank field', () => {
    // Gate on (app.bankIban || app.bankAccountHolder). No unconditional
    // audit — a row with no bank details doesn't need an audit trail
    // for "viewed nothing".
    expect(SRC).toMatch(/const bankHas = !!\(\(app as any\)\.bankIban \|\| \(app as any\)\.bankAccountHolder\);/);
    expect(SRC).toMatch(/eventType:\s*'bank_details_viewed'/);
  });

  it('captures actor + role from the request (matches selfie/id viewer discipline)', () => {
    const start = SRC.indexOf("eventType: 'bank_details_viewed'");
    expect(start).toBeGreaterThan(0);
    const end = SRC.indexOf('}).catch(', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/actorUserId:\s*\(req\.body\?\.adminUid as string\) \|\| null/);
    expect(block).toMatch(/actorRole:\s*\(req\.body\?\.adminRole as string\) \|\| 'support'/);
  });

  it('LOGS ONLY the IBAN last-4 — the full value must NEVER appear in the audit payload', () => {
    // The slice(-4) precompute lands the last-4 in `ibanLast4`; the
    // audit reads that variable. The block itself must NEVER carry a
    // raw `bankIban:` (full-value) payload key or a slice-of-app.bankIban
    // that would let a refactor put the full value in.
    expect(SRC).toMatch(/const ibanLast4 = typeof ibanFull === 'string' \? ibanFull\.slice\(-4\) : null;/);
    const start = SRC.indexOf("eventType: 'bank_details_viewed'");
    const end = SRC.indexOf('}).catch(', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/bankIbanLast4:\s*ibanLast4/);
    // No raw IBAN key in the payload.
    expect(block).not.toMatch(/^\s*bankIban:\s/m);
  });

  it('records presence flags (holder/name) so ops can see WHAT was accessed without seeing the value', () => {
    const start = SRC.indexOf("eventType: 'bank_details_viewed'");
    const end = SRC.indexOf('}).catch(', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/hasAccountHolder:\s*!!\(\(app as any\)\.bankAccountHolder\)/);
    expect(block).toMatch(/hasBankName:\s*!!\(\(app as any\)\.bankName\)/);
    // Names would be identifying — no `bankAccountHolder: ...` raw value.
    expect(block).not.toMatch(/bankAccountHolder:\s*\(app/);
  });

  it('a logging failure NEVER blocks the admin\'s response — the audit is best-effort', () => {
    // The .catch() on writeProviderAudit downgrades to a warn — the
    // admin still gets their detail response.
    expect(SRC).toMatch(/\.catch\(\(err\)\s*=>\s*logger\.warn\('\[Provider Onboarding\] bank_details_viewed audit failed/);
  });

  it('CEO §41 — without a bankAccessReason query param, the response REDACTS bank_iban / holder / name / branch', () => {
    // The gate mirrors the selfie/id viewer pattern: no reason, no
    // plaintext values in the JSON response. The admin can still see
    // presence flags + last-4 for eyeballing the case.
    expect(SRC).toMatch(/const bankAccessReason = typeof req\.query\.bankAccessReason === 'string'/);
    expect(SRC).toMatch(/bankIban:\s*null,/);
    expect(SRC).toMatch(/bankAccountHolder:\s*null,/);
    expect(SRC).toMatch(/bankName:\s*null,/);
    expect(SRC).toMatch(/bankBranchCode:\s*null,/);
    expect(SRC).toMatch(/bankAccessReasonRequired:\s*true,/);
  });

  it('CEO §41 — the redaction merge is APPENDED after the raw row spread (overrides any leaked plaintext)', () => {
    // Order matters: `...app` first (raw row from Postgres), then
    // `...bankProjected` LAST so the null redactions win. A refactor
    // that flipped the order would silently ship the plaintext.
    expect(SRC).toMatch(/application: \{ \.\.\.app,[^}]*\.\.\.bankProjected \}/);
  });

  it('CEO §41 — with a bankAccessReason present, the audit payload includes the reason (traceable forensic step)', () => {
    const start = SRC.indexOf("eventType: 'bank_details_viewed'");
    const end = SRC.indexOf('}).catch(', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/reason:\s*bankAccessReason,/);
  });
});
