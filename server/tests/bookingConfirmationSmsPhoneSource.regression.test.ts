/**
 * Regression pin — booking confirmation SMS phone source (AUDIT-SMS-11 / #224).
 *
 * The /booking-requests/:requestId/confirm handler previously read
 * `ownerPhone` from req.body and only fell back to the users row when
 * the body value was missing. That let an authenticated booking owner
 * point the PetWash-branded booking-confirmation SMS at any phone
 * number they typed into the request — a free, PetWash-billed
 * SMS-send primitive.
 *
 * Fix: the handler now sources `ownerPhone` and `ownerEmail`
 * exclusively from the `users` row keyed by the booking's ownerId.
 * req.body is never read for either field.
 *
 * This pin walks the confirm handler and refuses:
 *   • any `{ ownerPhone } = req.body` / `{ ownerEmail } = req.body`
 *     destructure, and
 *   • any `req.body.ownerPhone` / `req.body.ownerEmail` read.
 * A future contributor who reintroduces the pattern hits a red pin.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'server/routes/booking-requests.ts'), 'utf8');

describe('#224 booking confirmation SMS phone source (AUDIT-SMS-11)', () => {
  it('handler does NOT destructure ownerPhone or ownerEmail from req.body', () => {
    // No `{ ownerPhone, ... } = req.body` or `{ ownerEmail, ... } = req.body`.
    expect(src).not.toMatch(/\{\s*ownerPhone[^}]*\}\s*=\s*req\.body/);
    expect(src).not.toMatch(/\{\s*ownerEmail[^}]*\}\s*=\s*req\.body/);
  });

  it('handler does NOT read req.body.ownerPhone or req.body.ownerEmail', () => {
    expect(src).not.toMatch(/req\.body\.ownerPhone/);
    expect(src).not.toMatch(/req\.body\.ownerEmail/);
  });

  it('handler sources ownerPhone / ownerEmail from the users table', () => {
    // The users.phone and users.email columns must be selected inside
    // this file. Keeps the invariant "SMS destination comes from the
    // owner row, not the request body" enforceable by the pin.
    expect(src).toMatch(/select\(\{\s*email:\s*users\.email,\s*phone:\s*users\.phone\s*\}\)/);
  });

  it('confirmation SMS handler comment documents the AUDIT-SMS-11 fix', () => {
    // Anchor the intent so a well-meaning refactor doesn't silently
    // reintroduce the body read.
    expect(src).toMatch(/AUDIT-SMS-11[\s\S]{0,200}?req\.body/);
  });
});
