/**
 * PR-DANGER-3 regression pin — admin PATCH /api/admin/customers/:id
 * cannot rewrite loyaltyTier / totalSpent / washBalance through the
 * general update path.
 *
 * Before this PR the allowlist at server/routes.ts:10107-10111 included
 * these three money-side fields:
 *   - `loyaltyTier`   — the discount ladder (bronze → royal at 50% off)
 *   - `totalSpent`    — the lifetime-spend counter that feeds tier auto-
 *                       upgrade rules elsewhere in the codebase
 *   - `washBalance`   — the wash-credit count the K9000 station burns on
 *                       redemption
 *
 * Any admin token could set any of them to any value by adding the field
 * to the PATCH body. The audited wallet-adjustment path (which writes a
 * matching ledger row + auditLog entry) was completely bypassed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'server/routes.ts'), 'utf8');

describe('PR-DANGER-3 — admin customer PATCH allowlist strips money fields', () => {
  // Slice the admin PATCH handler off routes.ts by binding to its exact
  // route signature — then check the allowlist array within a tight window
  // (the array literal is inline). Isolating the block keeps the assertions
  // scoped: unrelated occurrences of `totalSpent` elsewhere in routes.ts
  // (report queries, projections, etc.) MUST NOT trip this test.
  const handler = (() => {
    const startIdx = src.indexOf(`app.patch('/api/admin/customers/:id'`);
    if (startIdx === -1) return null;
    // The allowlist array literal ends within ~600 chars of the route sig.
    return src.slice(startIdx, startIdx + 1500);
  })();

  it('finds the admin customer PATCH handler', () => {
    expect(handler, 'handler start missing').toBeTruthy();
  });

  it('extracts the allowedFields array literal', () => {
    expect(handler!).toMatch(/const allowedFields = \[/);
  });

  it("allowlist does NOT include 'loyaltyTier'", () => {
    const arr = handler!.match(/const allowedFields = \[[\s\S]*?\];/);
    expect(arr, 'allowedFields array missing').toBeTruthy();
    expect(arr![0]).not.toMatch(/'loyaltyTier'/);
  });

  it("allowlist does NOT include 'totalSpent'", () => {
    const arr = handler!.match(/const allowedFields = \[[\s\S]*?\];/);
    expect(arr, 'allowedFields array missing').toBeTruthy();
    expect(arr![0]).not.toMatch(/'totalSpent'/);
  });

  it("allowlist does NOT include 'washBalance'", () => {
    const arr = handler!.match(/const allowedFields = \[[\s\S]*?\];/);
    expect(arr, 'allowedFields array missing').toBeTruthy();
    expect(arr![0]).not.toMatch(/'washBalance'/);
  });

  it("allowlist DOES include the general profile fields an admin still needs", () => {
    // Sanity check we did not over-narrow — legitimate profile edits still
    // work (name/contact/date-of-birth/marketing preference).
    const arr = handler!.match(/const allowedFields = \[[\s\S]*?\];/);
    expect(arr, 'allowedFields array missing').toBeTruthy();
    for (const kept of ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'termsAccepted']) {
      expect(arr![0], `expected allowlist field '${kept}' missing`)
        .toMatch(new RegExp(`'${kept}'`));
    }
  });

  it('routes the reader at the correct audited money-change path', () => {
    // The removal comment must name the correct canonical rail
    // (/api/admin/wallet-adjust) so a future admin who tries to edit a
    // balance finds the audited endpoint by grep instead of re-adding
    // the field to this allowlist.
    expect(handler!).toMatch(/\/api\/admin\/wallet-adjust/);
  });
});
