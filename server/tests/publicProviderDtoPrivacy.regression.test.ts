/**
 * Task 33 — CEO fire order 101-140.
 *
 * PUBLIC PROVIDER DTO privacy audit. GET /api/providers/search is
 * mounted behind optionalFirebaseToken (public + signed-in both hit
 * it). The returned per-provider item must never contain email /
 * phone / nationalId / id_document_url / bank / national_insurance
 * fields — anything a public browser must not see.
 *
 * Finding: server/services/providerSearchService.ts DTOs
 * (fetchWalkers / fetchSitters / …) return ONLY display / rating /
 * pricing / geo / availability shape. No PII fields.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'services', 'providerSearchService.ts'),
  'utf8',
);

const PII_FIELDS_FORBIDDEN = [
  'email',
  'phone',
  'phoneNumber',
  'nationalId',
  'idNumber',
  'idDocumentUrl',
  'bankAccount',
  'bankAccountNumber',
  'iban',
  'taxId',
  'nationalInsurance',
  'dateOfBirth',
  'dob',
  'address', // full postal address (not city)
  'street',
];

describe('provider-search DTOs do not include PII', () => {
  // Each `return { ... }` block that produces a per-provider item.
  const RETURN_BLOCK = /return \{[\s\S]{50,4000}?\};/g;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = RETURN_BLOCK.exec(SRC)) !== null) {
    // Heuristic: only return blocks that include `providerId` are
    // per-provider DTO shapes.
    if (m[0].includes('providerId')) blocks.push(m[0]);
  }

  it('finds at least two per-provider return blocks (walkers + sitters)', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  for (const field of PII_FIELDS_FORBIDDEN) {
    it(`no per-provider return block declares ${field}`, () => {
      const rx = new RegExp(`\\b${field}:\\s*`);
      for (const b of blocks) {
        expect(b).not.toMatch(rx);
      }
    });
  }

  it('displayName / avatarUrl / rating / city (public-safe) are present', () => {
    const blob = blocks.join('\n');
    expect(blob).toContain('displayName');
    expect(blob).toContain('avatarUrl');
    expect(blob).toContain('rating');
    expect(blob).toContain('city');
    expect(blob).toContain('providerSlug');
  });
});

describe('/api/providers/search route surface', () => {
  it('mounted route delegates to runProviderSearch (no ad-hoc column projection)', () => {
    const ROUTE = readFileSync(
      resolve(__dirname, '..', 'routes', 'provider-search.ts'),
      'utf8',
    );
    expect(ROUTE).toContain('runProviderSearch(filters, callerUserId)');
    // The route response is `{ ok, ...result }` — no PII splicing.
    expect(ROUTE).toContain('...result');
    expect(ROUTE).not.toMatch(/\bemail\b|\bphone\b|\bnationalId\b/);
  });
});
