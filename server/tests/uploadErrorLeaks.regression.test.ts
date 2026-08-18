/**
 * Upload / document / media routes — response bodies must not leak raw
 * `error.message` / `err.message` / `error.stack` / bucket internals /
 * filesystem paths / multer.message. Every mapped error returns a generic
 * string plus a discriminator `code`.
 *
 * Scope of this pin (Task 5 — CEO fire order 101-140):
 *   - server/routes/health-safety.ts        (9 leaks fixed)
 *   - server/routes/contractor-documents.ts (5 leaks fixed)
 *   - server/routes/luxury-documents.ts     (4 leaks fixed)
 *   - server/routes/sitter-suite.ts         (2 leaks fixed)
 *   - server/routes/avatars.ts              (1 multer.message leak fixed)
 *   - server/routes/documents.ts            (already clean — pinned)
 *   - server/routes/pet-documents.ts        (already clean — pinned)
 *
 * Internal logger.error / logger.warn / audit-log helper calls that carry
 * error.message for internal trace are explicitly permitted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES = [
  'routes/health-safety.ts',
  'routes/contractor-documents.ts',
  'routes/luxury-documents.ts',
  'routes/sitter-suite.ts',
  'routes/avatars.ts',
  'routes/documents.ts',
  'routes/pet-documents.ts',
];

function extractResponseBodies(src: string): string[] {
  const out: string[] = [];
  const rx = /res\.status\(\d{3}\)\s*\.json\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('Upload/document response bodies never leak error.message', () => {
  for (const rel of FILES) {
    it(`${rel}: every res.status(...).json body is generic`, () => {
      const src = R(rel);
      const bodies = extractResponseBodies(src);
      for (const body of bodies) {
        expect(body).not.toMatch(/\berror\.message\b/);
        expect(body).not.toMatch(/\berr\.message\b/);
        expect(body).not.toMatch(/\berror\.stack\b/);
        expect(body).not.toMatch(/\berr\.stack\b/);
        expect(body).not.toMatch(/instanceof\s+Error\s*\?\s*(error|err|e)\.message/);
        // avatars.ts previously exposed multer's err.message on 413 / 400.
        expect(body).not.toMatch(/message:\s*err\.message/);
      }
    });
  }
});

describe('Upload/document response bodies never leak paths or bucket internals', () => {
  for (const rel of FILES) {
    it(`${rel}: no server-internal path/bucket identifiers in responses`, () => {
      const src = R(rel);
      const bodies = extractResponseBodies(src);
      for (const body of bodies) {
        expect(body).not.toMatch(/__dirname/);
        expect(body).not.toMatch(/bucketName/i);
        expect(body).not.toMatch(/\bgcs(Path|Uri|Bucket)\b/);
        expect(body).not.toMatch(/\bs3(Bucket|Path|Uri)\b/);
        expect(body).not.toMatch(/serviceAccount/i);
      }
    });
  }
});

describe('Discriminator codes present on every touched 5xx path', () => {
  it('health-safety.ts declares HS_* codes', () => {
    const src = R('routes/health-safety.ts');
    for (const c of [
      "'HS_REPORT_500'",
      "'HS_LIST_500'",
      "'HS_GET_500'",
      "'HS_STATION_500'",
      "'HS_UPDATE_STATUS_500'",
      "'HS_ASSIGN_500'",
      "'HS_RESOLVE_500'",
      "'HS_PHOTO_500'",
      "'HS_DASHBOARD_500'",
    ]) expect(src).toContain(c);
  });

  it('contractor-documents.ts declares CONTRACTOR_DOC_* codes', () => {
    const src = R('routes/contractor-documents.ts');
    for (const c of [
      '"CONTRACTOR_DOC_UPLOAD_500"',
      '"CONTRACTOR_DOC_LIST_500"',
      '"CONTRACTOR_DOC_VERIFY_500"',
      '"CONTRACTOR_DOC_DELETE_500"',
      '"CONTRACTOR_DOC_LIST2_500"',
    ]) expect(src).toContain(c);
  });

  it('luxury-documents.ts declares LUX_DOC_* codes', () => {
    const src = R('routes/luxury-documents.ts');
    for (const c of [
      "'LUX_DOC_LIST_500'",
      "'LUX_DOC_GET_500'",
      "'LUX_DOC_UPLOAD_500'",
      "'LUX_DOC_DELETE_500'",
    ]) expect(src).toContain(c);
  });

  it('sitter-suite.ts declares SITTER_*_500 codes', () => {
    const src = R('routes/sitter-suite.ts');
    for (const c of [
      "'SITTER_PHOTO_UPLOAD_500'",
      "'SITTER_DOC_UPLOAD_500'",
    ]) expect(src).toContain(c);
  });

  it('avatars.ts INVALID_FILE branch no longer echoes multer message', () => {
    const src = R('routes/avatars.ts');
    expect(src).not.toContain('message: err.message');
    expect(src).toContain("error: 'INVALID_FILE'");
    // The multer LIMIT_* code is a safe machine-readable enum from multer itself.
    expect(src).toContain("isMulterError ? err.code : 'INVALID_FILE'");
  });
});

describe('Upload routes preserve logger traces + business surface', () => {
  it('health-safety.ts retains its [HealthSafety API] logger tags', () => {
    const src = R('routes/health-safety.ts');
    for (const tag of [
      '[HealthSafety API] Failed to report incident',
      '[HealthSafety API] Failed to list incidents',
      '[HealthSafety API] Failed to get incident',
      '[HealthSafety API] Failed to get station incidents',
      '[HealthSafety API] Failed to update incident status',
      '[HealthSafety API] Failed to assign incident',
      '[HealthSafety API] Failed to resolve incident',
      '[HealthSafety API] Failed to upload photo',
      '[HealthSafety API] Failed to get dashboard',
    ]) expect(src).toContain(tag);
  });

  it('avatars.ts still runs multer as upload middleware', () => {
    const src = R('routes/avatars.ts');
    expect(src).toContain('upload.single');
    expect(src).toContain('runUpload');
  });
});
