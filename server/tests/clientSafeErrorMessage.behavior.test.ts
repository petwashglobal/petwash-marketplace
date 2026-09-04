/**
 * AGENT-14 privacy lane — BEHAVIORAL test for `clientSafeErrorMessage`.
 *
 * This is NOT a grep pin. It executes the real helper against the real
 * shapes we saw leaking out of production handlers:
 *   - Postgres unique-violation text (leaks a customer email verbatim)
 *   - Firebase Admin / SDK errors (leak env var + service-account names)
 *   - runtime TypeErrors and single-line stack frames (leak file layout)
 *   - verbatim provider payload dumps
 * …and confirms authored domain messages still reach the customer, because
 * blanking those is how a "security fix" quietly breaks the product.
 */

import { describe, it, expect } from 'vitest';
import { clientSafeErrorMessage } from '../lib/sanitizeErrorResponse';

const FALLBACK = 'Could not complete the request.';

describe('clientSafeErrorMessage — blocks internal detail', () => {
  const leaks: Array<[string, string]> = [
    [
      'postgres unique violation (leaks an email)',
      'duplicate key value violates unique constraint "users_email_key" DETAIL: Key (email)=(alice@example.co.il) already exists.',
    ],
    ['postgres missing column', 'column "national_id" of relation "users" does not exist'],
    ['sql text', 'error running query: select * from bookings where id = $1'],
    ['runtime TypeError', "TypeError: Cannot read properties of undefined (reading 'uid')"],
    ['single-line stack frame', 'boom at UnifiedVoucherService.redeem (/app/server/services/uv.ts:88:11)'],
    ['file path leak', 'ENOENT: no such file or directory, open /home/node/app/server/keys/sumit.pem'],
    ['network internals', 'connect ECONNREFUSED 127.0.0.1:5432'],
    ['dns internals', 'getaddrinfo ENOTFOUND ep-cool-db-pooler.eu-central-1.aws.neon.tech'],
    ['secret name leak', 'Missing process.env.SUMIT_API_KEY — cannot sign request'],
    ['credential leak', 'Invalid service account credential for petwash-prod'],
    ['bearer token leak', 'Request failed: authorization Bearer abcdefghijklmnop was rejected'],
    ['firebase id token leak', 'Failed to verify eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMyJ9.body.sig'],
    ['raw provider payload', 'SUMIT rejected: {"Status":250,"UserErrorMessage":"card declined"}'],
    ['phone number in message', 'No member found for 972501234567'],
    ['national id in message', 'ID 039281746 failed the check-digit test'],
    ['multi-line stack', 'Error: nope\n    at foo (bar.ts:1:1)'],
  ];

  for (const [name, message] of leaks) {
    it(`blocks: ${name}`, () => {
      expect(clientSafeErrorMessage(new Error(message), FALLBACK)).toBe(FALLBACK);
    });
  }

  it('blocks an over-long message even when it looks authored', () => {
    const long = 'This booking cannot be confirmed right now. '.repeat(10);
    expect(clientSafeErrorMessage(new Error(long), FALLBACK)).toBe(FALLBACK);
  });

  it('blocks an over-long message even when explicitly marked safe', () => {
    const err = Object.assign(new Error('x'.repeat(500)), { expose: true });
    expect(clientSafeErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });
});

describe('clientSafeErrorMessage — keeps authored domain messages', () => {
  const keeps = [
    'Voucher is EXPIRED',
    'Voucher already redeemed',
    'Insufficient wallet balance',
    'This time slot is no longer available',
    'Address already exists in your address book',
    'Provider is not approved for this service',
    'Invalid file type',
    'Booking cannot be cancelled less than 24 hours before the start',
  ];

  for (const message of keeps) {
    it(`keeps: ${message}`, () => {
      expect(clientSafeErrorMessage(new Error(message), FALLBACK)).toBe(message);
    });
  }

  it('keeps a message on an error explicitly marked clientSafe', () => {
    const err = Object.assign(new Error('Your card was declined by the issuer'), { clientSafe: true });
    expect(clientSafeErrorMessage(err, FALLBACK)).toBe('Your card was declined by the issuer');
  });

  it('trims surrounding whitespace', () => {
    expect(clientSafeErrorMessage(new Error('  Voucher is EXPIRED  '), FALLBACK)).toBe('Voucher is EXPIRED');
  });
});

describe('clientSafeErrorMessage — never throws, always returns a string', () => {
  const junk: unknown[] = [
    undefined,
    null,
    '',
    'a bare string throw',
    0,
    false,
    [],
    {},
    { message: 123 },
    { message: '' },
    { message: '   ' },
    Object.create(null),
  ];

  for (const [i, value] of junk.entries()) {
    it(`falls back for junk input #${i}`, () => {
      expect(clientSafeErrorMessage(value, FALLBACK)).toBe(FALLBACK);
    });
  }

  it('survives a getter that throws', () => {
    const evil = {};
    Object.defineProperty(evil, 'message', {
      get() {
        throw new Error('nope');
      },
    });
    expect(clientSafeErrorMessage(evil, FALLBACK)).toBe(FALLBACK);
  });

  it('survives a cyclic error object', () => {
    const err: any = new Error('Voucher is EXPIRED');
    err.self = err;
    expect(clientSafeErrorMessage(err, FALLBACK)).toBe('Voucher is EXPIRED');
  });
});
