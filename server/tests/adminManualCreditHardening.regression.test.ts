/**
 * 360 audit Batch A2 — #27 + #28: harden the prestige-pass admin manual-credit
 * endpoint (the only path that MINTS wallet credit, i.e. real money value).
 *
 * #27 (auth): the endpoint previously gated ONLY on the shared static
 *   x-admin-secret header. Anyone who learned the secret could mint unlimited
 *   credit attributed to a generic "admin". Fix requires BOTH the secret AND a
 *   Firebase-verified super-admin (isSuperAdminVerified), and attributes the
 *   credit to that verified uid (defense in depth).
 *
 * #28 (idempotency): the endpoint had no idempotency, so a double-click / retry
 *   double-credited. Fix requires a stable idempotencyKey, persisted as the
 *   ledger row's source_id, with a dedup check in adminManualCredit that returns
 *   the original txn on replay instead of crediting again.
 *
 * Source-introspection (the handler + service are DB/auth-runtime-bound, so we
 * assert the wiring is present rather than spinning a DB — same convention as
 * the other *.regression.test.ts guards). This locks the fix against silent
 * regression.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const route = readFileSync(resolve(ROOT, 'server/routes/prestige-pass.ts'), 'utf8');
const engine = readFileSync(resolve(ROOT, 'server/services/WalletEngine.ts'), 'utf8');

// Isolate the /admin/manual-credit handler body so assertions don't match a
// different route elsewhere in the (large) file.
const handlerStart = route.indexOf("router.post('/admin/manual-credit'");
const handler = route.slice(handlerStart, handlerStart + 2000);

describe('admin manual-credit hardening (#27 auth, #28 idempotency)', () => {
  it('imports the verified super-admin gate', () => {
    expect(route).toMatch(/import\s*\{\s*isSuperAdminVerified\s*\}\s*from\s*'\.\.\/middleware\/rbac'/);
  });

  it('#27: requires BOTH the admin secret AND a verified super-admin', () => {
    expect(handler).toMatch(/isValidAdminSecret\(req\)/);
    expect(handler).toMatch(/isSuperAdminVerified\(req\)/);
  });

  it('#27: attributes the credit to the verified Firebase uid (not a generic "admin")', () => {
    expect(handler).toMatch(/firebaseUser[^\n]*\)\?\.uid/);
  });

  it('#28: requires a stable idempotencyKey on the request schema', () => {
    expect(route).toMatch(/idempotencyKey:\s*z\.string\(\)\.min\(8\)\.max\(128\)/);
  });

  it('#28: forwards the key and short-circuits on idempotent replay', () => {
    expect(handler).toMatch(/adminManualCredit\(\{[^}]*idempotencyKey[^}]*\}\)/s);
    expect(handler).toMatch(/if\s*\(idempotent\)/);
  });

  it('#28: adminManualCredit dedups on (wallet, source=admin, idempotencyKey) and stores it as source_id', () => {
    expect(engine).toMatch(/idempotencyKey\?:\s*string/);
    expect(engine).toMatch(/eq\(creditTransactions\.sourceType,\s*'admin'\)/);
    expect(engine).toMatch(/eq\(creditTransactions\.sourceId,\s*params\.idempotencyKey\)/);
    expect(engine).toMatch(/sourceId:\s*params\.idempotencyKey/);
    expect(engine).toMatch(/return\s*\{\s*txnId:\s*existing\.transactionId,\s*idempotent:\s*true\s*\}/);
  });
});
