/**
 * PR-DANGER-5 regression pins — compliance authority-documents mass-assign.
 *
 * The pre-fix `PUT /api/compliance/authority-documents/:id` shape at
 * server/routes/compliance.ts:129 was
 *   const updates = req.body;
 *   .set({ ...updates, updatedAt: new Date() })
 * which mass-assigned any column on authority_documents. Any admin /
 * compliance / legal role could rewrite reviewer fields — status,
 * verifiedBy, verifiedAt, complianceLevel, riskCategory, displayBadge —
 * on evidence they had submitted themselves. That is evidence tampering:
 * submitter self-approves + gets the platform's "Verified" badge without
 * a separate reviewer signing off.
 *
 * Fix: two dedicated endpoints — PUT covers submitter-metadata fields
 * only, PATCH /:id/review is reviewer-only + requires a `reason` +
 * server-stamps `verifiedBy` from the authenticated caller +
 * server-stamps `verifiedAt` on status→active transitions. Both write a
 * distinct compliance_audit_trail row so the evidence chain records who
 * did what and why. DELETE also now writes an audit row before removal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'server/routes/compliance.ts'), 'utf8');

describe('PR-DANGER-5 — compliance PUT allowlists submitter-metadata only', () => {
  it('handler no longer mass-assigns req.body', () => {
    // The exact shape that shipped. Regression: cannot reappear.
    const putStart = src.indexOf('router.put("/authority-documents/:id"');
    expect(putStart, 'PUT handler missing').toBeGreaterThan(-1);
    const putHandler = [src.slice(putStart, putStart + 3500)];
    expect(putHandler![0]).not.toMatch(/const updates = req\.body;/);
    expect(putHandler![0]).not.toMatch(/\.\.\.updates,\s*updatedAt/);
  });

  it('uses a strict Zod schema (unknown keys rejected)', () => {
    expect(src).toMatch(/const putAuthorityDocumentSubmitterSchema = z\.object\(\{/);
    // .strict() rejects unknown body keys with 400 unrecognized_keys.
    const schema = src.match(
      /const putAuthorityDocumentSubmitterSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schema, 'submitter schema .strict() shape missing').toBeTruthy();
  });

  it('submitter schema DOES NOT include any reviewer-only field', () => {
    // Regression: reviewer fields must never leak into the PUT allowlist,
    // even if a future refactor consolidates schemas.
    const schema = src.match(
      /const putAuthorityDocumentSubmitterSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schema, 'submitter schema missing').toBeTruthy();
    for (const reviewerField of [
      'status',
      'verifiedBy',
      'verifiedAt',
      'complianceLevel',
      'riskCategory',
      'displayBadge',
      'displayPriority',
    ]) {
      expect(schema![0], `reviewer field '${reviewerField}' leaked into submitter schema`)
        .not.toMatch(new RegExp(`\\b${reviewerField}:`));
    }
  });

  it('writes a compliance_audit_trail row on submitter-metadata update', () => {
    const putStart = src.indexOf('router.put("/authority-documents/:id"');
    expect(putStart, 'PUT handler missing').toBeGreaterThan(-1);
    const putHandler = [src.slice(putStart, putStart + 3500)];
    expect(putHandler![0]).toMatch(/complianceAuditTrail/);
    expect(putHandler![0]).toMatch(/eventType: "document_updated_metadata"/);
    // Both previous and new state must be logged for the diff:
    expect(putHandler![0]).toMatch(/previousState: previous,/);
    expect(putHandler![0]).toMatch(/newState: updated,/);
  });
});

describe('PR-DANGER-5 — new PATCH /:id/review is reviewer-only + audited', () => {
  it('reviewer endpoint exists and uses a strict schema', () => {
    expect(src).toMatch(
      /router\.patch\("\/authority-documents\/:id\/review"/,
    );
    expect(src).toMatch(/const patchAuthorityDocumentReviewSchema = z\.object\(\{/);
    const schema = src.match(
      /const patchAuthorityDocumentReviewSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schema, 'review schema .strict() shape missing').toBeTruthy();
  });

  it('reviewer schema REQUIRES status (enum) + REQUIRES a reason string', () => {
    const schema = src.match(
      /const patchAuthorityDocumentReviewSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schema, 'review schema missing').toBeTruthy();
    // Status is required, from the exact schema-side enum.
    expect(schema![0]).toMatch(
      /status:\s*z\.enum\(\[\s*'active',\s*'expired',\s*'revoked',\s*'pending_renewal'\s*\]\)/,
    );
    // Reason is required (no .optional()) and has a min-length so an
    // empty "" is rejected — the audit trail must carry an actual reason.
    expect(schema![0]).toMatch(/reason:\s*z\.string\(\)\.min\(10\)/);
  });

  it('verifiedBy is server-derived from the authenticated caller (never from body)', () => {
    // Body cannot set verifiedBy — pin the derivation from
    // req.firebaseUser?.uid || req.userId. If a future edit lets the
    // body override verifiedBy, a reviewer could attribute the review
    // to a different person.
    const reviewStart = src.indexOf('router.patch("/authority-documents/:id/review"');
    expect(reviewStart, 'review handler missing').toBeGreaterThan(-1);
    const reviewHandler = [src.slice(reviewStart, reviewStart + 3500)];
    // Schema does NOT declare verifiedBy — the caller cannot set it via
    // the request body:
    const schema = src.match(
      /const patchAuthorityDocumentReviewSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
    );
    expect(schema![0]).not.toMatch(/\bverifiedBy:/);
    // Handler derives it server-side:
    expect(reviewHandler![0]).toMatch(/const reviewerUid = \(req as any\)\.firebaseUser\?\.uid/);
    expect(reviewHandler![0]).toMatch(/verifiedBy: reviewerNumericId/);
  });

  it('verifiedAt is stamped only on transitions into status=active', () => {
    // Revocation / expiry / pending do NOT count as "verified" — the
    // timestamp only fires when the doc moves into active from a
    // non-active previous state.
    const reviewStart = src.indexOf('router.patch("/authority-documents/:id/review"');
    expect(reviewStart, 'review handler missing').toBeGreaterThan(-1);
    const reviewHandler = [src.slice(reviewStart, reviewStart + 3500)];
    expect(reviewHandler![0]).toMatch(
      /if \(reviewFields\.status === 'active' && previous\.status !== 'active'\) \{\s*patch\.verifiedAt = now;/,
    );
  });

  it('writes a distinct compliance_audit_trail row with the reviewer reason', () => {
    const reviewStart = src.indexOf('router.patch("/authority-documents/:id/review"');
    expect(reviewStart, 'review handler missing').toBeGreaterThan(-1);
    const reviewHandler = [src.slice(reviewStart, reviewStart + 3500)];
    expect(reviewHandler![0]).toMatch(/eventType: "document_reviewed"/);
    // The reviewer's reason string is persisted verbatim in the notes
    // field so an auditor can trace WHY the state changed.
    expect(reviewHandler![0]).toMatch(/notes: reason,/);
  });
});

describe('PR-DANGER-5 — DELETE writes an audit row before removal', () => {
  it('logs a document_deleted audit row before deleting the row', () => {
    // The old delete removed the row with no audit trail — the evidence
    // chain would show the create event and no closure. Fix: insert the
    // audit row (with previousState = the row about to be deleted) then
    // delete. If the insert fails, the delete is skipped.
    const deleteStart = src.indexOf('router.delete("/authority-documents/:id"');
    expect(deleteStart, 'DELETE handler missing').toBeGreaterThan(-1);
    const deleteHandler = [src.slice(deleteStart, deleteStart + 2500)];
    expect(deleteHandler![0]).toMatch(/eventType: "document_deleted"/);
    expect(deleteHandler![0]).toMatch(/previousState: previous,/);
    // Ordering: audit insert appears BEFORE the db.delete call in source.
    const auditIdx = deleteHandler![0].indexOf('complianceAuditTrail');
    const deleteIdx = deleteHandler![0].indexOf('db.delete(authorityDocuments)');
    expect(auditIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeLessThan(deleteIdx);
  });
});

describe('PR-DANGER-5 — router still requires admin/compliance/legal role', () => {
  it('router.use auth middleware unchanged (baseline auth preserved)', () => {
    // Belt-and-braces: the file-level auth guard that gates every route
    // must not be accidentally removed while adding the new endpoints.
    expect(src).toMatch(
      /router\.use\(requireAuth,\s*requireRole\('admin',\s*'compliance',\s*'legal'\)\);/,
    );
  });
});
