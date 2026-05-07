/**
 * Issue #153 Mission F (PR-EMAIL-1) — guarded SendGrid helper unit tests.
 *
 * Verifies the contract:
 *   1. EmailSpendGuard.check() is invoked BEFORE every send attempt.
 *   2. When the circuit is open, sgMail.send() is NOT called.
 *   3. When sgMail.send() succeeds, EmailSpendGuard.record() is called.
 *   4. When sgMail.send() throws, EmailSpendGuard.record() is NOT called
 *      (counters do not advance on failure).
 *   5. Recipient is correctly extracted from string / object / array
 *      forms of msg.to so guard attribution is consistent.
 *   6. No raw recipient PII or API key surfaces in error logs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sendgrid/mail BEFORE the module under test imports it.
vi.mock('@sendgrid/mail', () => {
  const send = vi.fn();
  return { default: { send }, send };
});

// Mock the EmailSpendGuard so we can assert its protocol without touching
// real circuit-breaker state.
vi.mock('../services/EmailSpendGuard', () => {
  return {
    emailSpendGuard: {
      check: vi.fn(),
      record: vi.fn(),
    },
  };
});

// Mock the logger so error-shape assertions don't depend on real transport.
vi.mock('../lib/logger', () => {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

import sgMail from '@sendgrid/mail';
import { emailSpendGuard } from '../services/EmailSpendGuard';
import { logger } from '../lib/logger';
import { sendGuardedEmail } from '../lib/guarded-sendgrid';

const mockedSend = sgMail.send as unknown as ReturnType<typeof vi.fn>;
const mockedCheck = emailSpendGuard.check as unknown as ReturnType<typeof vi.fn>;
const mockedRecord = emailSpendGuard.record as unknown as ReturnType<typeof vi.fn>;
const mockedLoggerError = logger.error as unknown as ReturnType<typeof vi.fn>;
const mockedLoggerWarn = logger.warn as unknown as ReturnType<typeof vi.fn>;

const baseMsg = {
  to: 'alice@example.com',
  from: 'no-reply@petwash.co.il',
  subject: 'Welcome',
  text: 'Hello',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRecord.mockResolvedValue(undefined);
});

describe('sendGuardedEmail — circuit breaker protocol', () => {
  it('calls check() BEFORE sending and records() AFTER on success', async () => {
    mockedCheck.mockReturnValue({ allowed: true });
    mockedSend.mockResolvedValue(undefined);

    const result = await sendGuardedEmail({ service: 'test-svc', msg: baseMsg });

    expect(result).toEqual({ ok: true, service: 'test-svc' });
    expect(mockedCheck).toHaveBeenCalledOnce();
    expect(mockedCheck).toHaveBeenCalledWith('test-svc', 'alice@example.com');
    expect(mockedSend).toHaveBeenCalledOnce();
    expect(mockedSend).toHaveBeenCalledWith(baseMsg);
    expect(mockedRecord).toHaveBeenCalledOnce();
    expect(mockedRecord).toHaveBeenCalledWith('test-svc', 'alice@example.com', 'Welcome');
  });

  it('does NOT call sgMail.send when the circuit is open', async () => {
    mockedCheck.mockReturnValue({ allowed: false, reason: 'Hourly email budget exceeded (80/80)' });

    const result = await sendGuardedEmail({ service: 'test-svc', msg: baseMsg });

    expect(result).toEqual({
      ok: false,
      reason: 'circuit_open',
      detail: 'Hourly email budget exceeded (80/80)',
      service: 'test-svc',
    });
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedRecord).not.toHaveBeenCalled();
    expect(mockedLoggerWarn).toHaveBeenCalled();
  });

  it('does NOT call record() when sgMail.send throws', async () => {
    mockedCheck.mockReturnValue({ allowed: true });
    mockedSend.mockRejectedValue(Object.assign(new Error('boom'), { code: 401 }));

    const result = await sendGuardedEmail({ service: 'test-svc', msg: baseMsg });

    expect(result).toEqual({ ok: false, reason: 'send_failed', service: 'test-svc' });
    expect(mockedSend).toHaveBeenCalledOnce();
    expect(mockedRecord).not.toHaveBeenCalled();
    expect(mockedLoggerError).toHaveBeenCalled();
  });

  it('error log redacts API key and full message body, exposes only domain + code', async () => {
    mockedCheck.mockReturnValue({ allowed: true });
    mockedSend.mockRejectedValue(
      Object.assign(new Error('Unauthorized: SG.SECRET-KEY-VALUE'), {
        code: 401,
        response: { headers: { authorization: 'Bearer SG.SECRET-KEY-VALUE' } },
      }),
    );

    await sendGuardedEmail({ service: 'test-svc', msg: baseMsg });

    const errCall = mockedLoggerError.mock.calls[0];
    expect(errCall).toBeDefined();
    const payload = errCall[1] as Record<string, unknown>;
    // Must include service + masked domain only.
    expect(payload.service).toBe('test-svc');
    expect(payload.recipientDomain).toBe('example.com');
    expect(payload.errorCode).toBe(401);
    // Must NOT include any of: full recipient, raw error message, response,
    // API key fragments, message body.
    const serialized = JSON.stringify(errCall);
    expect(serialized).not.toContain('SG.SECRET-KEY-VALUE');
    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('Hello');
    expect(serialized).not.toMatch(/\bauthorization\b/i);
  });
});

describe('sendGuardedEmail — recipient extraction', () => {
  beforeEach(() => {
    mockedCheck.mockReturnValue({ allowed: true });
    mockedSend.mockResolvedValue(undefined);
  });

  it('handles to: <string>', async () => {
    await sendGuardedEmail({ service: 's', msg: { ...baseMsg, to: 'bob@petwash.co.il' } });
    expect(mockedCheck).toHaveBeenCalledWith('s', 'bob@petwash.co.il');
  });

  it('handles to: { email }', async () => {
    await sendGuardedEmail({
      service: 's',
      msg: { ...baseMsg, to: { email: 'carol@petwash.co.il', name: 'Carol' } as any },
    });
    expect(mockedCheck).toHaveBeenCalledWith('s', 'carol@petwash.co.il');
  });

  it('handles to: [<string>]', async () => {
    await sendGuardedEmail({ service: 's', msg: { ...baseMsg, to: ['dave@petwash.co.il'] as any } });
    expect(mockedCheck).toHaveBeenCalledWith('s', 'dave@petwash.co.il');
  });

  it('handles to: [{ email }]', async () => {
    await sendGuardedEmail({
      service: 's',
      msg: { ...baseMsg, to: [{ email: 'erin@petwash.co.il' }] as any },
    });
    expect(mockedCheck).toHaveBeenCalledWith('s', 'erin@petwash.co.il');
  });

  it('falls back to empty string for malformed recipient (and still consults guard)', async () => {
    await sendGuardedEmail({ service: 's', msg: { ...baseMsg, to: 42 as any } });
    expect(mockedCheck).toHaveBeenCalledWith('s', '');
  });
});
