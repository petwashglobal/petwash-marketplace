/**
 * PR-DANGER-6 regression pins — station PATCH allowlist.
 *
 * The pre-fix `PUT /api/admin/stations/:id` at
 * server/routes/stations.ts:229 did
 *   const updates = req.body;
 *   const updateDoc: any = { ...updates, updatedBy, updatedAt };
 *   delete updateDoc.id; delete updateDoc.createdBy; delete updateDoc.createdAt;
 *   await db.collection('stations').doc(id).set(updateDoc, { merge: true });
 * — a Firestore-side mass-assign. The three `delete` lines removed only
 * the obvious immutables; every other field the caller supplied was
 * merged into the station doc, including:
 *   * nayax.terminalId / deviceId / merchantId — payment-capture identity
 *   * utilities.insurance / .electricity / .water / .council — owner
 *     contract data
 *   * status ('active'/'paused'/'decommissioned') — silent switch to
 *     'paused' during rush hour is a real revenue loss
 *   * any arbitrary key Firestore accepts (Firestore has no schema at
 *     the storage layer).
 *
 * Fix: `stationGeneralPatchSchema = z.object({...}).strict()` declares
 * the safe general-metadata fields ONLY. Every money / security /
 * hardware / owner / status field is deliberately absent, and .strict()
 * rejects unknown keys with 400 so the admin who tried to set them
 * sees the field name and can route through the correct audited
 * endpoint (out of scope — flagged for PR-DANGER-6-followup).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'server/routes/stations.ts'), 'utf8');

describe('PR-DANGER-6 — stationGeneralPatchSchema is present and strict', () => {
  const schemaMatch = src.match(
    /const stationGeneralPatchSchema = z\.object\(\{[\s\S]*?\}\)\.strict\(\);/,
  );

  it('the schema is declared with .strict()', () => {
    expect(schemaMatch, 'stationGeneralPatchSchema missing').toBeTruthy();
  });

  it('allowlist includes the SAFE general-metadata fields', () => {
    expect(schemaMatch, 'schema missing').toBeTruthy();
    for (const kept of ['name', 'brand', 'serialNumber', 'address', 'geo', 'photos', 'thresholds']) {
      expect(schemaMatch![0], `expected allowlist field '${kept}' missing`)
        .toMatch(new RegExp(`\\b${kept}\\b`));
    }
  });

  it('allowlist does NOT include any money / security / hardware / owner / status field', () => {
    expect(schemaMatch, 'schema missing').toBeTruthy();
    // Each of these belongs on a dedicated audited endpoint. Pin each
    // banned key so a future refactor cannot silently reintroduce one.
    for (const banned of [
      'nayax',        // payment identity → dedicated /payment-identity endpoint
      'utilities',    // owner contract data → dedicated /utilities endpoint
      'status',       // operational state → dedicated /status endpoint
      'createdBy',    // immutable audit field
      'createdAt',    // immutable audit field
      // Extra defence — arbitrary hardware / security fields Firestore
      // would accept by default. If a future refactor adds them to the
      // Zod schema without a matching dedicated endpoint + audit row,
      // this test fires immediately.
      'apiKey',
      'stationKey',
      'webhookSecret',
      'apiCredentials',
      'ownerId',
      'operatorId',
      'franchiseId',
      'pricing',
      'pricePerWash',
      'serviceRates',
    ]) {
      expect(schemaMatch![0], `banned field '${banned}' leaked into general PATCH schema`)
        .not.toMatch(new RegExp(`^\\s*${banned}\\s*:`, 'm'));
    }
  });
});

describe('PR-DANGER-6 — PUT /:id handler routes through the strict schema', () => {
  // Isolate the PUT handler by binding to its exact signature; the
  // handler body is ~80 lines, use a 3500-char slice.
  const putStart = src.indexOf(`router.put('/:id', requireAdmin,`);
  const putHandler = putStart >= 0 ? src.slice(putStart, putStart + 3500) : '';

  it('finds the PUT /:id handler', () => {
    expect(putStart, 'PUT /:id handler missing').toBeGreaterThan(-1);
  });

  it('no longer mass-assigns req.body', () => {
    // Regression: the exact pre-fix shape cannot return.
    expect(putHandler).not.toMatch(/const updates = req\.body;/);
    // The old delete-based defense (three lines removing id/createdBy/
    // createdAt) is also gone — the schema now guarantees those keys
    // cannot even reach the handler body.
    expect(putHandler).not.toMatch(/delete updateDoc\.createdBy;/);
    expect(putHandler).not.toMatch(/delete updateDoc\.createdAt;/);
  });

  it('uses safeParse (400 on validation error, not 500)', () => {
    // `.parse` would throw and the catch would render 500 — the caller
    // deserves a 400 with the offending key names surfaced from
    // Zod's unrecognized_keys error.
    expect(putHandler).toMatch(/stationGeneralPatchSchema\.safeParse\(req\.body\)/);
    expect(putHandler).toMatch(/return res\.status\(400\)\.json\(\{ error: 'Validation error'/);
  });

  it('spreads the VALIDATED data into the Firestore update, never req.body', () => {
    // After safeParse succeeds, `parsed.data` is used — a future
    // refactor that spreads `req.body` here again would re-open the
    // mass-assign door.
    expect(putHandler).toMatch(/const updates = parsed\.data;/);
    // The spread is over the validated `updates`, adding server-owned
    // updatedBy + updatedAt. Nothing else.
    expect(putHandler).toMatch(/\.\.\.updates,\s*[\r\n]+\s*updatedBy: adminUid,\s*[\r\n]+\s*updatedAt: now,/);
  });
});
