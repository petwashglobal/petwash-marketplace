/**
 * AGENT-14 privacy lane — BEHAVIORAL tests for PII redaction in logs.
 *
 * These execute the real helpers (not greps) and cover the two defects this
 * lane found:
 *
 *  1. `redactLogContext` only knew a handful of key names and NEVER looked at
 *     string VALUES — so a Postgres "DETAIL: Key (email)=(alice@x.co.il)"
 *     message, a Firebase `eyJ…` token pasted into an error, a national ID or
 *     an IBAN inside `{ body: req.body }` all went to stdout verbatim.
 *
 *  2. `scrubSentryEvent` did not exist: Sentry's beforeSend hook logged the
 *     event and returned it unchanged, so everything above ALSO left the
 *     building for a third-party service.
 */

import { describe, it, expect } from 'vitest';
import { redactLogContext, scrubSensitiveText, redactEmail } from '../lib/redaction';
import { scrubSentryEvent } from '../lib/observability';

describe('scrubSensitiveText — value-level PII scrubbing', () => {
  it('scrubs an email out of a Postgres unique-violation message', () => {
    const pg =
      'duplicate key value violates unique constraint "users_email_key" DETAIL: Key (email)=(alice@example.co.il) already exists.';
    const out = scrubSensitiveText(pg);
    expect(out).not.toContain('alice@example.co.il');
    expect(out).not.toContain('alice');
    expect(out).toContain('users_email_key'); // still debuggable
  });

  it('scrubs a JWT / Firebase ID token', () => {
    const out = scrubSensitiveText(
      'verifyIdToken failed for eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9.eyJzdWIiOiIxMjMifQ.sIgNaTuRe',
    );
    expect(out).toContain('[jwt]');
    expect(out).not.toContain('eyJhbGci');
  });

  it('scrubs a card PAN down to the last 4', () => {
    // Fixture corrected 2026-09-06: 4580123412341234 fails the Luhn checksum,
    // so it is not a number any issuer could have produced. PAN scrubbing is
    // now Luhn-gated (see the dedicated describe block below for why), so the
    // fixture has to be a genuinely well-formed PAN. Same 4580 prefix, valid
    // check digit.
    const out = scrubSensitiveText('charge failed for 4580123412341232');
    expect(out).toBe('charge failed for ****1232');
  });

  it('scrubs an Israeli mobile number in several shapes', () => {
    for (const p of ['+972501234567', '972-50-123-4567', '+972 50 123 4567']) {
      const out = scrubSensitiveText(`SMS to ${p} failed`);
      expect(out, p).not.toContain('1234567');
      expect(out, p).toContain('+972***');
    }
  });

  it('leaves an ordinary log line completely untouched', () => {
    const plain = '[Booking] transition pending -> confirmed for booking 4821 (station 12)';
    expect(scrubSensitiveText(plain)).toBe(plain);
  });

  it('never throws on empty / odd input', () => {
    expect(scrubSensitiveText('')).toBe('');
    expect(typeof scrubSensitiveText('x'.repeat(5000))).toBe('string');
  });
});

describe('redactLogContext — key-based redaction', () => {
  it('drops every hard secret in a realistic request body', () => {
    const out: any = redactLogContext({
      body: {
        password: 'hunter2',
        pin: '1234',
        otp: '839201',
        idToken: 'eyJhbGciOi.abc.def',
        sessionCookie: 'sess-abc',
        csrfToken: 'csrf-abc',
        cvv: '123',
        cardNumber: '4580123412341234',
        nationalId: '039281746',
        idNumber: '039281746',
        iban: 'IL620108000000099999999',
        bankAccount: '12-345-678901',
        routingNumber: '012',
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        recoveryCode: 'aaaa-bbbb',
        resetToken: 'rt_abc',
        qrToken: 'qr_abc',
        signedJws: 'ey.j.w.s',
        secretToken: 'nayax-secret',
      },
    });
    const flat = JSON.stringify(out);
    for (const leak of [
      'hunter2', '1234', '839201', 'sess-abc', 'csrf-abc', '123',
      '039281746', 'IL620108000000099999999', '12-345-678901',
      'JBSWY3DPEHPK3PXP', 'aaaa-bbbb', 'rt_abc', 'qr_abc', 'nayax-secret',
    ]) {
      expect(flat, `leaked ${leak}`).not.toContain(leak);
    }
  });

  it('masks — rather than drops — routine PII so operators can still correlate', () => {
    const out: any = redactLogContext({
      email: 'alice@example.co.il',
      phone: '+972501234567',
      address: 'Uzi Hitman 8, Rosh HaAyin',
      dateOfBirth: '1988-04-02',
    });
    expect(out.email).toBe(redactEmail('alice@example.co.il'));
    expect(out.email).not.toBe('alice@example.co.il');
    expect(out.phone).not.toContain('501234567');
    expect(out.address).not.toContain('Uzi Hitman');
    expect(out.address).toMatch(/^U\*\*\*\(\d+\)$/);
    expect(out.dateOfBirth).not.toContain('1988-04-02');
  });

  it('scrubs PII hiding inside a free-text value under an innocent key', () => {
    const out: any = redactLogContext({
      errorMessage:
        'duplicate key value violates unique constraint "users_email_key" DETAIL: Key (email)=(bob@petwash.co.il) already exists',
      note: 'called 972501234567 twice',
    });
    expect(out.errorMessage).not.toContain('bob@petwash.co.il');
    expect(out.note).not.toContain('501234567');
  });

  it('walks nested objects and arrays', () => {
    const out: any = redactLogContext({
      users: [{ email: 'a@b.com', profile: { nationalId: '039281746' } }],
    });
    expect(JSON.stringify(out)).not.toContain('039281746');
    expect(JSON.stringify(out)).not.toContain('a@b.com');
  });

  it('does not blow up on cycles or exotic values', () => {
    const cyclic: any = { a: 1 };
    cyclic.self = cyclic;
    expect(() => redactLogContext(cyclic)).not.toThrow();
    expect(() => redactLogContext(new Map([['k', 'v']]) as any)).not.toThrow();
    expect(redactLogContext(null)).toBe(null);
    expect(redactLogContext(undefined)).toBe(undefined);
  });

  it('does not mutate the caller object', () => {
    const original = { password: 'hunter2', email: 'a@b.com' };
    redactLogContext(original);
    expect(original.password).toBe('hunter2');
    expect(original.email).toBe('a@b.com');
  });
});

describe('scrubSentryEvent — nothing leaves for Sentry unredacted', () => {
  it('redacts extra, request, user, exception value and breadcrumbs', () => {
    const event: any = {
      message: 'failed for alice@example.co.il',
      extra: { body: { password: 'hunter2', otp: '112233', email: 'alice@example.co.il' } },
      contexts: { custom: { idToken: 'eyJa.b.c' } },
      request: {
        url: 'https://petwash.co.il/api/x?email=alice@example.co.il',
        query_string: 'email=alice@example.co.il',
        data: { nationalId: '039281746' },
        headers: { authorization: 'Bearer abc', cookie: '__session=xyz' },
        cookies: { __session: 'xyz' },
      },
      user: { id: 'u1', email: 'alice@example.co.il', ip_address: '1.2.3.4' },
      exception: {
        values: [
          { value: 'duplicate key ... DETAIL: Key (email)=(alice@example.co.il) already exists' },
        ],
      },
      breadcrumbs: [{ message: 'otp sent to +972501234567', data: { otp: '112233' } }],
    };

    const out = scrubSentryEvent(event);
    const flat = JSON.stringify(out);

    for (const leak of ['hunter2', '112233', 'alice@example.co.il', 'Bearer abc', 'xyz', '039281746', '501234567', '1.2.3.4']) {
      expect(flat, `Sentry event still contains ${leak}`).not.toContain(leak);
    }
    // Still useful: the user id and the constraint name survive.
    expect(out.user.id).toBe('u1');
    expect(flat).toContain('duplicate key');
  });

  it('returns the event even when it is empty or malformed', () => {
    expect(scrubSentryEvent(null)).toBe(null);
    expect(scrubSentryEvent(undefined)).toBe(undefined);
    expect(scrubSentryEvent({})).toEqual({});
  });

  it('strips rather than leaks when scrubbing itself fails', () => {
    const evil: any = { extra: {} };
    Object.defineProperty(evil, 'user', {
      get() { throw new Error('boom'); },
      set() { /* allow the recovery path to clear it */ },
      configurable: true,
    });
    const out = scrubSentryEvent(evil);
    expect(out.extra).toEqual({ scrubError: true });
  });
});

/**
 * PAN detection must not eat operational identifiers (2026-09-06 review of
 * this PR). `\b\d{13,19}\b` alone also matches an epoch-MILLISECOND timestamp
 * (exactly 13 digits), so it rewrote Date.now() values, 14-digit order ids and
 * every `txn-${Date.now()}` id. Not a leak — over-redaction — but it would
 * shred the logs for exactly the money flows those ids exist to trace.
 * A Luhn check now decides: every issued card number satisfies mod-10 by
 * definition, so true detection is unaffected.
 */
describe('PAN scrubbing is Luhn-gated — cards redacted, identifiers kept', () => {
  it('still redacts real card numbers across brands', () => {
    for (const pan of ['4111111111111111', '5555555555554444', '378282246310005', '6011111111111117']) {
      const out = scrubSensitiveText(`charge failed for ${pan}`);
      expect(out, pan).not.toContain(pan);
      expect(out, pan).toContain(`****${pan.slice(-4)}`);
    }
  });

  it('does NOT redact epoch-millisecond timestamps', () => {
    const ts = String(Date.now());
    expect(scrubSensitiveText(`booking created at ${ts}`)).toContain(ts);
  });

  it('does NOT redact txn / idempotency ids built from Date.now()', () => {
    const id = `txn-${Date.now()}`;
    expect(scrubSensitiveText(`wallet mutation ${id} applied`)).toContain(id);
  });

  it('leaves ordinary log lines untouched', () => {
    const line = 'GET /api/stations 200 in 41ms';
    expect(scrubSensitiveText(line)).toBe(line);
  });

  it('DOCUMENTED TRADE-OFF: a card-shaped run that fails Luhn is kept', () => {
    // Accepted deliberately. Every ISSUED card number satisfies Luhn, so this
    // costs no real-PAN coverage; what it keeps is mistyped/truncated input.
    // The alternative — redacting on digit-length alone — destroyed every
    // epoch-ms timestamp and txn id in the logs, which is a certainty on every
    // request rather than a rare edge case. If raw PANs ever start reaching
    // this server (today SUMIT/Nayax take cards on their own hosted pages, so
    // they do not), revisit this and redact card-shaped runs unconditionally.
    const notACard = '4580123412341234'; // one digit off — fails mod-10
    expect(scrubSensitiveText(`value ${notACard}`)).toContain(notACard);
  });
});
