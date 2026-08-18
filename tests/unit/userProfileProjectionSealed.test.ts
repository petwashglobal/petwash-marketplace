/**
 * PR-DANGER-8 regression pin — user-profile GET uses an explicit column
 * projection, not `SELECT *`.
 *
 * The pre-fix shape at server/routes/user-profile.ts:81:
 *   const [user] = await db.select().from(users).where(eq(users.id, uid))
 * loaded EVERY column on the users table into server memory. The hand-
 * typed DTO literal at res.json below cherry-picked safe fields, so
 * nothing dangerous leaked TODAY — but the arrangement was fragile:
 *   1) Any future PII column added to the users schema (bank IBAN,
 *      national ID hash, tax record, health flag) auto-loaded and sat
 *      in memory ready to leak the first time someone forgot to update
 *      the response literal.
 *   2) A future refactor that spreads `user` into the response (`{ ...user
 *      }`) would blanket-leak every column at once.
 *   3) A logger.debug that stringifies `user` in a diagnostic would
 *      log the encrypted PII columns.
 * Fix: project up-front to only the fields the handler actually reads.
 * New PII columns never reach this code path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = fs.readFileSync(path.join(root, 'server/routes/user-profile.ts'), 'utf8');

describe('PR-DANGER-8 — GET /profile user query uses explicit projection', () => {
  it('no longer uses the bare `db.select().from(users).where(eq(users.id, uid))` shape', () => {
    // Regression: the exact anti-pattern that shipped. Pin its absence.
    expect(src).not.toMatch(
      /db\.select\(\)\.from\(users\)\.where\(eq\(users\.id,\s*uid\)\)/,
    );
  });

  it('uses db.select({...}) with a projection object', () => {
    // The projection is an object literal — Drizzle only loads the
    // fields named inside it. Anchor on the specific query shape.
    expect(src).toMatch(
      /db[\s\S]{0,20}\.select\(\{[\s\S]*?firstName:\s*users\.firstName[\s\S]*?\}\)[\s\S]{0,80}\.from\(users\)/,
    );
  });

  it('projection includes every field the response object reads', () => {
    // If a contributor adds a new field to the res.json literal but
    // forgets to add it to the projection, the field silently reads
    // `undefined` from the projected `user`. Pin every response field
    // that reads from `user.*` so the projection stays complete.
    const requiredProjectionKeys = [
      'firstName', 'lastName',
      'email', 'phone',
      'address', 'street', 'streetNumber', 'apartment', 'city', 'postalCode', 'country',
      'latitude', 'longitude',
      'addressIsTemporary', 'temporaryAddress', 'temporaryLat', 'temporaryLng', 'temporaryPostal',
      'dateOfBirth', 'profileImageUrl', 'language',
      'gender', 'carPlate', 'carPlate2',
      'emergencyContactName', 'emergencyContactPhone',
      'marketingConsent', 'twoFactorEnabled',
    ];
    // Bind on the projection literal — the .select({...}) block starts
    // with `firstName: users.firstName` and closes with `twoFactorEnabled:
    // users.twoFactorEnabled,\n      })`. Slice safely.
    const projectionStart = src.indexOf('firstName:');
    const projectionEnd = src.indexOf('})', projectionStart);
    expect(projectionStart).toBeGreaterThan(-1);
    expect(projectionEnd).toBeGreaterThan(projectionStart);
    const projection = src.slice(projectionStart, projectionEnd);
    for (const key of requiredProjectionKeys) {
      expect(projection, `projection missing required key '${key}'`)
        .toMatch(new RegExp(`\\b${key}:\\s*users\\.`));
    }
  });

  it('projection deliberately EXCLUDES encrypted PII / financial columns', () => {
    // These are exactly the fields a `SELECT *` would have loaded that
    // must never reach this handler's memory. If a contributor adds any
    // of them to the projection object, they must justify why in review.
    const projectionStart = src.indexOf('firstName:');
    const projectionEnd = src.indexOf('})', projectionStart);
    const projection = src.slice(projectionStart, projectionEnd);
    for (const banned of [
      'idNumber',        // legacy plaintext national ID
      'idNumberEnc',     // AES-256-GCM encrypted national ID
      'idNumberHash',    // HMAC national-ID blind index
      'password',        // password hash (belt-and-braces — schema level)
      'firebaseUid',     // identity binding — never round-tripped
      'termsAcceptedAt', // audit event, not profile field
      'privacyAcceptedAt',
      'termsVersion',
      'privacyVersion',
    ]) {
      expect(projection, `banned field '${banned}' leaked into projection`)
        .not.toMatch(new RegExp(`\\b${banned}:`));
    }
  });
});
