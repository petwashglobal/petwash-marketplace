/**
 * DocuSeal webhook must be authenticated.
 *
 * POST /api/esign/webhook had NO auth ("no auth required") — anyone could POST a
 * fake `submission.completed` to mark a document signed and trigger
 * handleEsignComplete. Fixed: require DOCUSEAL_WEBHOOK_SECRET (header
 * x-docuseal-secret or ?secret=), timing-safe compare, fail-closed in prod.
 *
 * Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'esign.ts'),
  'utf8',
);

describe('DocuSeal webhook — authenticated', () => {
  // Slice the webhook handler.
  const start = src.indexOf("router.post('/webhook'");
  const body = src.slice(start, start + 1400);

  it('reads a configured secret + the provided header/query secret', () => {
    expect(body).toMatch(/process\.env\.DOCUSEAL_WEBHOOK_SECRET/);
    expect(body).toMatch(/x-docuseal-secret/);
    expect(body).toMatch(/req\.query\.secret/);
  });

  it('compares with a timing-safe equal and rejects (401) on mismatch', () => {
    expect(body).toMatch(/crypto\.timingSafeEqual/);
    expect(body).toMatch(/status\(401\)/);
  });

  it('fails closed (503) in production when the secret is unset', () => {
    expect(body).toMatch(/NODE_ENV === 'production'/);
    expect(body).toMatch(/status\(503\)/);
  });

  it('no longer claims "no auth required"', () => {
    expect(body).not.toMatch(/no auth required/);
  });
});
