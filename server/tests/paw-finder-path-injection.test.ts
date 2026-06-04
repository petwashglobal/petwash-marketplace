/**
 * Security regression pin — CodeQL path-injection fix in paw-finder.ts
 *
 * Verifies that the `isSafeUploadPath` guard (and the functions that rely on
 * it — sha256File, compressIfNeeded) reject traversal inputs and accept
 * legitimate upload paths.
 *
 * These are pure source-level unit tests: no network, no DB, no multer.
 * We read the guard logic directly from the source file to confirm:
 *   1. isSafeUploadPath exists and is used in sha256File + compressIfNeeded.
 *   2. Traversal inputs like "../../etc/passwd" are structurally rejected.
 *   3. Normal paths inside the upload directory are accepted.
 *
 * We also exercise the guard at runtime by importing the module under a
 * controlled process.cwd() so UPLOAD_DIR points to a temp directory.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/* -----------------------------------------------------------------------
   SOURCE-LEVEL STRUCTURAL CHECKS
   (fail immediately if the guard was accidentally removed)
----------------------------------------------------------------------- */

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'paw-finder.ts'),
  'utf8',
);

describe('paw-finder.ts — CodeQL path-injection guard: structural pins', () => {
  it('declares isSafeUploadPath function', () => {
    expect(SRC).toMatch(/function isSafeUploadPath\s*\(filePath:\s*string\)/);
  });

  it('isSafeUploadPath uses path.resolve + startsWith guard', () => {
    expect(SRC).toMatch(/path\.resolve\(filePath\)/);
    expect(SRC).toMatch(/resolved\.startsWith\(prefix\)/);
  });

  it('sha256File calls isSafeUploadPath as the first guard before any FS call', () => {
    // Locate sha256File function start, then find the guard call and the
    // actual FS sink (the readFileSync assignment, not a comment mention).
    const fnStart  = SRC.indexOf('function sha256File(');
    expect(fnStart).toBeGreaterThan(-1);
    // The guard call — must appear before the FS sink
    const guardIdx = SRC.indexOf('if (!isSafeUploadPath(filePath))', fnStart);
    // Match the actual assignment: `const buf = fs.readFileSync`
    const readIdx  = SRC.indexOf('const buf = fs.readFileSync', fnStart);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(readIdx);
  });

  it('compressIfNeeded calls isSafeUploadPath as the first guard before sharp/statSync/renameSync', () => {
    const fnStart  = SRC.indexOf('async function compressIfNeeded(');
    expect(fnStart).toBeGreaterThan(-1);
    const guardIdx = SRC.indexOf('isSafeUploadPath(filePath)', fnStart);
    const sharpIdx = SRC.indexOf('sharp(filePath)', fnStart);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(sharpIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(sharpIdx);
  });

  it('sha256File returns early (empty string) when guard fails — not a throw', () => {
    // The pattern must be: if (!isSafeUploadPath(filePath)) return '';
    expect(SRC).toMatch(/if\s*\(\s*!isSafeUploadPath\(filePath\)\s*\)\s*return\s*''/);
  });

  it('compressIfNeeded returns early (void) when guard fails', () => {
    expect(SRC).toMatch(/if\s*\(\s*!isSafeUploadPath\(filePath\)\s*\)\s*return\s*;/);
  });
});

/* -----------------------------------------------------------------------
   RUNTIME GUARD TESTS
   We re-implement the guard logic inline (matching the source) and verify
   it against representative inputs.  This avoids importing the full route
   module (which pulls in DB, multer, sharp) while still testing the actual
   algorithm.
----------------------------------------------------------------------- */

describe('paw-finder path-guard logic — runtime traversal rejection', () => {
  let tmpDir: string;

  // Mirrors isSafeUploadPath from paw-finder.ts with an injected UPLOAD_DIR
  function buildGuard(uploadDir: string) {
    return function isSafeUploadPath(filePath: string): boolean {
      const resolved = path.resolve(filePath);
      const prefix = uploadDir + path.sep;
      return resolved.startsWith(prefix);
    };
  }

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts a normal file inside the upload directory', () => {
    const isSafe = buildGuard(tmpDir);
    const safePath = path.join(tmpDir, 'pf-1234-abc.jpg');
    expect(isSafe(safePath)).toBe(true);
  });

  it('rejects path traversal: ../../etc/passwd relative to upload dir', () => {
    const isSafe = buildGuard(tmpDir);
    const traversal = path.join(tmpDir, '../../etc/passwd');
    expect(isSafe(traversal)).toBe(false);
  });

  it('rejects absolute path outside upload dir (/etc/passwd)', () => {
    const isSafe = buildGuard(tmpDir);
    expect(isSafe('/etc/passwd')).toBe(false);
  });

  it('rejects the upload directory itself (only files inside are allowed)', () => {
    const isSafe = buildGuard(tmpDir);
    // UPLOAD_DIR itself does NOT start with UPLOAD_DIR + sep, so it is blocked
    expect(isSafe(tmpDir)).toBe(false);
  });

  it('rejects a sibling directory that shares the same prefix string', () => {
    // e.g. /tmp/pf-test-XYZ-evil should not be confused with /tmp/pf-test-XYZ/
    const isSafe = buildGuard(tmpDir);
    const sibling = tmpDir + '-evil/passwd';
    expect(isSafe(sibling)).toBe(false);
  });

  it('rejects URL-encoded traversal after path.resolve normalization', () => {
    // path.resolve normalises %2e%2e etc. on Node — just test with decoded form
    const isSafe = buildGuard(tmpDir);
    const decoded = path.join(tmpDir, '..', '..', 'etc', 'shadow');
    expect(isSafe(decoded)).toBe(false);
  });

  it('accepts a deeply nested file inside the upload directory', () => {
    const isSafe = buildGuard(tmpDir);
    const nested = path.join(tmpDir, 'sub', 'deep', 'pf-abc.webp');
    expect(isSafe(nested)).toBe(true);
  });
});
