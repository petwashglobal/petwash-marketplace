/**
 * Provider insurance/health-declaration endpoints (payout-ready gate).
 * Provider submits docs (validated upload, private storage, no PII inline),
 * admin verifies, and isProviderInsuranceCleared() gates activation/payout.
 *
 * Source-introspection (handlers are DB/auth/storage-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-insurance.ts'),
  'utf8',
);
const routes = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('provider insurance endpoints', () => {
  it('submit validates the uploaded file by content (magic number) before storing', () => {
    expect(src).toMatch(/router\.post\('\/provider\/insurance-docs', requireAuth, upload\.single\('file'\), requireValidFileContent/);
  });
  it('stores to the private bucket + hashes the doc, never the body inline', () => {
    expect(src).toMatch(/storage\.bucket\(\)\.file\(fileRef\)\.save/);
    expect(src).toMatch(/createHash\('sha256'\)\.update\(file\.buffer\)/);
  });
  it('admin verify is requireAdmin-gated and validates status', () => {
    expect(src).toMatch(/router\.patch\('\/admin\/provider-insurance\/:id', requireAdmin/);
    expect(src).toMatch(/'pending', 'active', 'expired', 'rejected'/);
  });
  it('clearance gate requires ACTIVE non-expired liability AND a declaration', () => {
    expect(src).toMatch(/export async function isProviderInsuranceCleared/);
    expect(src).toMatch(/hasLiability && hasDeclaration/);
    expect(src).toMatch(/r\.status === 'active'/);
    expect(src).toMatch(/expiresAt/);
  });
  it('does not leak the raw file path to the provider client', () => {
    expect(src).toMatch(/hasFile: Boolean\(fileRef\)/);
  });
  it('is mounted in routes.ts', () => {
    expect(routes).toMatch(/providerInsuranceRoutes/);
  });
});
