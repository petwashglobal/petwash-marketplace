/**
 * Regression pin — identity resolver contract (auth-rebuild Phase 6.b).
 *
 * Pins the code-shape invariants of server/identity/identityResolver.ts
 * that make soft-merge safe:
 *
 *   1. Loop protection uses a visited-set (not just a length counter).
 *   2. Self-merge (merged_into_uid = id) is refused, not followed.
 *   3. Chain length is capped (MAX_CHAIN constant present).
 *   4. Resolver reads ONLY id + mergedIntoUid — never role/roles/
 *      permissions (which would bypass the capabilities aggregator).
 *   5. Never writes — no `.update(` / `.insert(` / `.delete(`.
 *   6. Best-effort helper `resolveCanonicalUidOrSelf` returns the
 *      INPUT uid on error — never fabricates a canonical uid.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const resolver = readFileSync(join(ROOT, 'server/identity/identityResolver.ts'), 'utf8');
const svc = readFileSync(join(ROOT, 'server/services/SoftMergeService.ts'), 'utf8');

describe('identity resolver contract', () => {
  it('loop protection uses a visited set', () => {
    expect(resolver).toMatch(/const visited\s*=\s*new Set/);
    expect(resolver).toMatch(/visited\.has\(cursor\)/);
    expect(resolver).toMatch(/LOOP_DETECTED/);
  });

  it('self-merge is refused, not followed', () => {
    expect(resolver).toMatch(/SELF_MERGE/);
    expect(resolver).toMatch(/next === cursor/);
  });

  it('chain length is capped', () => {
    expect(resolver).toMatch(/MAX_CHAIN\s*=\s*\d+/);
    expect(resolver).toMatch(/CHAIN_TOO_LONG/);
  });

  it('resolver reads only id + mergedIntoUid (never role/permissions)', () => {
    // The select projection MUST be tight — expanding it here would
    // let a caller trust resolver output for authority decisions,
    // which is exactly what the CEO forbade.
    expect(resolver).toMatch(/\.select\(\{\s*id:\s*users\.id\s*,\s*mergedIntoUid:\s*users\.mergedIntoUid\s*\}\)/);
    expect(resolver.includes('users.role')).toBe(false);
    expect(resolver.includes('users.roles')).toBe(false);
    expect(resolver.includes('users.permissions')).toBe(false);
    expect(resolver.includes('users.accessLevel')).toBe(false);
  });

  it('resolver never writes', () => {
    expect(/\bdb\.update\(/.test(resolver)).toBe(false);
    expect(/\bdb\.insert\(/.test(resolver)).toBe(false);
    expect(/\bdb\.delete\(/.test(resolver)).toBe(false);
  });

  it('best-effort helper never fabricates a canonical uid on error', () => {
    expect(resolver).toMatch(/resolveCanonicalUidOrSelf/);
    // Body must fall back to `inputUid` on !ok, not to any other value.
    expect(resolver).toMatch(/return inputUid;/);
  });
});

describe('SoftMergeService contract', () => {
  it('preview response masks emails and phones', () => {
    expect(svc).toMatch(/function maskEmail/);
    expect(svc).toMatch(/function maskPhone/);
    // The response type must expose masked fields, never raw ones.
    expect(svc).toMatch(/emailMasked:/);
    expect(svc).toMatch(/phoneMasked:/);
  });

  it('preview reports hasIdNumber presence only — never the raw or hashed id', () => {
    expect(svc).toMatch(/hasIdNumber:/);
    // The response type MUST NOT expose a field named idNumber,
    // idNumberEnc, or idNumberHash (a presence boolean is fine).
    // Interface UidProjection.identity is the response contract.
    const identityBlock = svc.match(/identity:\s*\{[\s\S]*?\};/);
    expect(identityBlock).toBeTruthy();
    // Field names on the response object — the LEFT of a ':'.
    expect(/\bidNumber\s*:/.test(identityBlock![0])).toBe(false);
    expect(/\bidNumberEnc\s*:/.test(identityBlock![0])).toBe(false);
    expect(/\bidNumberHash\s*:/.test(identityBlock![0])).toBe(false);
  });

  it('conflict evaluator BLOCKs the impossible cases', () => {
    expect(svc).toMatch(/PRIMARY_NOT_FOUND/);
    expect(svc).toMatch(/SECONDARY_NOT_FOUND/);
    expect(svc).toMatch(/PRIMARY_IS_ALREADY_A_SECONDARY/);
    expect(svc).toMatch(/SECONDARY_ALREADY_MERGED/);
    expect(svc).toMatch(/PRIMARY_BLOCKED/);
  });

  it('validateMergeRequest refuses self-merge', () => {
    expect(svc).toMatch(/primaryUid === secondaryUid/);
    expect(svc).toMatch(/code:\s*['"]SELF_MERGE['"]/);
  });

  it('validateMergeRequest refuses chain (secondary already merged)', () => {
    // The write-side guard must consult the resolver so a merge into
    // a chain surface is refused before the write.
    expect(svc).toMatch(/resolveCanonicalUid/);
  });
});
