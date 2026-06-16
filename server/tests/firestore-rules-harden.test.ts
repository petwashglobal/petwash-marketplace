/**
 * Firestore rules hardening. A security sweep found:
 *  - escrow_payments (MONEY) checked owner fields buyerId/sellerId that the
 *    server never writes (it writes customerId/providerId) — the owner check
 *    matched nothing, AND `create: if isAuthenticated()` let any signed-in user
 *    forge an escrow doc.
 *  - 9 collections had a bare `allow create: if isAuthenticated()` with no owner
 *    binding (loyalty points, fraud logs, notifications, etc.).
 * None of these collections are written by the client (verified) — they go via
 * the Admin SDK, which bypasses rules — so binding create to owner/admin is safe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const rules = fs.readFileSync(path.resolve(__dirname, '..', '..', 'firestore.rules'), 'utf8');

const block = (name: string) => {
  const start = rules.indexOf(`match /${name}/`);
  if (start < 0) throw new Error(`no rules block for ${name}`);
  // slice to the next top-level "match /" within the same indentation
  const next = rules.indexOf('match /', start + 10);
  return rules.slice(start, next < 0 ? undefined : next);
};

describe('firestore rules are hardened', () => {
  it('no collection has a bare, unbound create rule', () => {
    expect(rules).not.toMatch(/allow create: if isAuthenticated\(\);/);
  });

  it('escrow_payments owner check uses customerId/providerId (the fields the server writes)', () => {
    const b = block('escrow_payments');
    expect(b).toMatch(/resource\.data\.customerId/);
    expect(b).toMatch(/resource\.data\.providerId/);
    // the dead owner fields must not be REFERENCED in a rule (comment prose is fine)
    expect(b).not.toMatch(/resource\.data\.buyerId|resource\.data\.sellerId/);
    expect(b).toMatch(/allow create: if isAdmin\(\);/);
  });

  it('server-written money/audit collections are admin-only on create', () => {
    for (const c of ['loyalty_transactions', 'fraud_detection_logs', 'wallet_telemetry', 'station_heartbeats', 'referrals']) {
      expect(block(c)).toMatch(/allow create: if isAdmin\(\);/);
    }
  });

  it('per-user collections bind create to the document owner', () => {
    for (const c of ['wallet_device_registrations', 'loyalty_members', 'ai_feature_requests']) {
      expect(block(c)).toMatch(/allow create: if isAuthenticated\(\) && request\.auth\.uid == request\.resource\.data\.userId;/);
    }
  });
});
