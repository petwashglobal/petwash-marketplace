/**
 * Provider verification resolver + assigned-provider guard invariants
 * (CEO 2026-08-27 §7, §8, §9, §34, §35, §36).
 *
 * Source-pin regression on server/services/jobPassport/providerVerification.ts.
 * Pins the DISCIPLINE rather than exercising the DB — a follow-up
 * integration test with a real Postgres will exercise the queries.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'jobPassport', 'providerVerification.ts'),
  'utf8',
);

describe('resolvePublicProviderRef — §7, §35, §36', () => {
  it('accepts ONLY the enumerated kinds (walker/sitter/trainer) — never a client-declared kind', () => {
    // The kind is a discriminated union — no wildcard fall-through.
    expect(SRC).toMatch(/PublicProviderKind\s*=\s*['"]walker['"]\s*\|\s*['"]sitter['"]\s*\|\s*['"]trainer['"]/);
    // The resolver dispatches by literal equality on kind — never
    // reads a role/type from the client body.
    expect(SRC).toMatch(/input\.kind\s*===\s*['"]walker['"]/);
    expect(SRC).toMatch(/input\.kind\s*===\s*['"]sitter['"]/);
    expect(SRC).toMatch(/input\.kind\s*===\s*['"]trainer['"]/);
  });

  it('resolves the Firebase UID from the profile row, NEVER from client input', () => {
    // The uid is loaded from the profile query result. Ban any
    // shape that would allow the client to submit a uid directly.
    expect(SRC).toMatch(/uid\s*=\s*w\.userId/);
    expect(SRC).toMatch(/uid\s*=\s*s\.userId/);
    // No client uid intake anywhere.
    expect(SRC).not.toMatch(/uid\s*=\s*input\.uid/);
    expect(SRC).not.toMatch(/uid\s*=\s*input\.providerUid/);
  });

  it('returns a STRUCTURED failure (ok:false + errorCode) — never throws to the caller', () => {
    expect(SRC).toMatch(/errorCode:\s*['"]PUBLIC_REF_NOT_FOUND['"]/);
    expect(SRC).toMatch(/errorCode:\s*['"]LOOKUP_FAILED['"]/);
    // The catch block builds a structured failure — never a string
    // interpolation with error.message that would leak details.
    expect(SRC).toMatch(/catch\s*\(err:\s*any\)\s*\{[\s\S]*?ok:\s*false,\s*errorCode:\s*['"]LOOKUP_FAILED['"]/);
  });

  it('verifiedForService requires ALL three flags: approved + serviceApproved + !suspended', () => {
    // §7 + §36 combined: a provider is verified for the service only
    // when the application is approved AND the service is approved
    // AND they are not currently suspended.
    expect(SRC).toMatch(/verifiedForService:\s*approved\s*&&\s*serviceApproved\s*&&\s*!suspended/);
  });

  it('applicationStatusAtLookup is captured for §35 provenance', () => {
    // Object-literal shorthand: the return object uses
    // `applicationStatusAtLookup,` (bare name).
    expect(SRC).toMatch(/applicationStatusAtLookup,/);
    // It reads from providerApplications.status — not from a
    // mutable display field.
    expect(SRC).toMatch(/providerApplications\.status/);
  });
});

describe('assertAssignedProviderMatchesCaller — §8, §9, §34', () => {
  it('bookingSource is a whitelisted enum — never wildcarded', () => {
    expect(SRC).toMatch(
      /bookingSource:\s*['"]sitter_bookings['"]\s*\|\s*['"]walk_bookings['"]\s*\|\s*['"]trainer_bookings['"]/,
    );
  });

  it('callerUid docstring names it as SERVER-derived, and code never accepts it from a body', () => {
    // The type docstring above the callerUid field explicitly says
    // "NEVER req.body" — a refactor that changes the field's docstring
    // to something weaker must update this test at the same time.
    expect(SRC).toMatch(/NEVER req\.body[\s\S]{0,200}callerUid/);
    // The guard function's window: the callerUid arrives via `input.callerUid`
    // (parameter), never via a re-read of req.body.
    const fnStart = SRC.indexOf('async function assertAssignedProviderMatchesCaller');
    const fnBlock = SRC.slice(fnStart, fnStart + 3000);
    expect(fnBlock).not.toMatch(/req\.body/);
    expect(fnBlock).not.toMatch(/req\.headers/);
    expect(fnBlock).toMatch(/input\.callerUid/);
  });

  it('returns CALLER_NOT_ASSIGNED_PROVIDER with strict equality — never a coercion', () => {
    expect(SRC).toMatch(/assignedUid\s*!==\s*input\.callerUid/);
    expect(SRC).toMatch(/errorCode:\s*['"]CALLER_NOT_ASSIGNED_PROVIDER['"]/);
    // Ban a loose equality that would let uid=null match "null" (JS
    // string).
    expect(SRC).not.toMatch(/assignedUid\s*!=\s*input\.callerUid[^=]/);
  });

  it('BOOKING_NOT_FOUND fires BEFORE the equality check — no side effect on missing rows', () => {
    // Every branch has an early return when the booking row is missing.
    // Anchor on the branch's equality check so the type-union
    // occurrence of the string doesn't false-match.
    const branches = ['sitter_bookings', 'walk_bookings', 'trainer_bookings'];
    for (const branch of branches) {
      const anchor = `input.bookingSource === '${branch}'`;
      const idx = SRC.indexOf(anchor);
      expect(idx, `Branch anchor for ${branch} not found`).toBeGreaterThan(-1);
      const window = SRC.slice(idx, idx + 800);
      expect(window).toMatch(
        /if\s*\(!b\)\s*return\s*\{\s*ok:\s*false,\s*errorCode:\s*['"]BOOKING_NOT_FOUND['"]/,
      );
    }
  });

  it('LOOKUP_FAILED never leaks error.message to the caller', () => {
    const fnStart = SRC.indexOf('async function assertAssignedProviderMatchesCaller');
    const fnBlock = SRC.slice(fnStart, fnStart + 3000);
    // The catch block returns a stable message — a shape that
    // includes ${err.message} would leak DB details.
    expect(fnBlock).toMatch(/errorCode:\s*['"]LOOKUP_FAILED['"],\s*message:\s*['"]lookup failed['"]/);
    expect(fnBlock).not.toMatch(/message:\s*`[^`]*\$\{err/);
  });
});
