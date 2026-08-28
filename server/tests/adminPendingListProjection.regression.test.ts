/**
 * CEO §41 (2026-08-28) — admin-blind field sweep.
 *
 * The `/admin/applications/pending` list endpoint used to
 * db.select().from(providerApplications) — shipping the full row on
 * every poll. That put bank_iban, bank_account_holder, bank_name,
 * bank_branch_code, israeli_id_encrypted, date_of_birth, selfie
 * URL, government-ID URL, insurance-cert URL onto the wire of a
 * heavily-polled queue widget with no access reason and no audit.
 *
 * Fix: explicit projection matching the pending-review queue —
 * name / role / KYC signals only. A reviewer who needs bank / ID /
 * selfie details opens the /admin/applications/:applicationId
 * detail route, which requires an access reason and writes an audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('/admin/applications/pending — projection (CEO §41)', () => {
  it('has replaced the full db.select() spread with a raw SQL projection', () => {
    // Locate the `/admin/applications/pending` route body and confirm
    // the previous db.select().from(providerApplications) spread has
    // been replaced by a pool.query with an explicit column list.
    const start = SRC.indexOf("router.get('/admin/applications/pending',");
    expect(start).toBeGreaterThan(0);
    const end = SRC.indexOf("router.get('/admin/applications/pending-review'", start);
    const block = SRC.slice(start, end);
    expect(block).not.toMatch(/db\s*\n?\s*\.select\(\)\s*\n?\s*\.from\(providerApplications\)/);
    expect(block).toMatch(/pool\.query</);
    expect(block).toMatch(/`SELECT id, application_id, first_name, last_name, email/);
  });

  it('the SELECT list carries NO plaintext bank / ID / doc-URL fields', () => {
    // Isolate the raw SQL between the SELECT and the FROM clause so
    // comment prose that MENTIONS the banned columns for context
    // (regression rationale) doesn't false-positive.
    const start = SRC.indexOf("router.get('/admin/applications/pending',");
    const end = SRC.indexOf("router.get('/admin/applications/pending-review'", start);
    const block = SRC.slice(start, end);
    const selectStart = block.indexOf('`SELECT ');
    const selectEnd = block.indexOf('FROM provider_applications', selectStart);
    expect(selectStart).toBeGreaterThan(0);
    expect(selectEnd).toBeGreaterThan(selectStart);
    const selectList = block.slice(selectStart, selectEnd);
    for (const banned of [
      'bank_iban',
      'bank_account_holder',
      'bank_name',
      'bank_branch_code',
      'israeli_id_encrypted',
      'selfie_photo_url',
      'government_id_url',
      'insurance_cert_url',
      'business_license_url',
      'date_of_birth',
    ]) {
      // The projected SELECT list must NEVER carry these columns. A
      // refactor that re-adds any of them re-opens the leak.
      expect(selectList).not.toContain(banned);
    }
  });

  it('the response DTO maps snake_case → camelCase for the safe columns only', () => {
    const start = SRC.indexOf("router.get('/admin/applications/pending',");
    const end = SRC.indexOf("router.get('/admin/applications/pending-review'", start);
    const block = SRC.slice(start, end);
    // The response DTO must include the KYC-signal fields the queue
    // widget renders — enough for triage without exposing anything
    // that requires an access reason.
    for (const field of [
      'applicationId: r.application_id',
      'firstName: r.first_name',
      'lastName: r.last_name',
      'email: r.email',
      'phoneNumber: r.phone_number',
      'kycDocumentType: r.kyc_document_type',
      'kycIdLastFour: r.kyc_id_last_four',
      'kycFraudRiskLevel: r.kyc_fraud_risk_level',
    ]) {
      expect(block).toContain(field);
    }
  });

  it('the DTO response shape stays { applications } — polling clients unchanged', () => {
    // Backwards compatible: the queue widget reads `applications`
    // straight out of the JSON body. Do not accidentally rename the
    // top-level key.
    const start = SRC.indexOf("router.get('/admin/applications/pending',");
    const end = SRC.indexOf("router.get('/admin/applications/pending-review'", start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/res\.json\(\{\s*applications\s*\}\);/);
  });
});
