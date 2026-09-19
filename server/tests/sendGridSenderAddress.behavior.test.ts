/**
 * SendGrid sender address + failure detail (2026-09-19 live delivery test).
 *
 * The first real send through the dispatcher came back HTTP 400 with no cause
 * in the log. Two things are pinned here, both run for real:
 *
 * 1. cleanSenderAddress(): the from-address secret is sanitised like the API
 *    key already was — trailing newline, control chars, "Name <addr>" — and a
 *    non-address falls back to the code default rather than a guaranteed 400.
 * 2. sendGridErrorDetail(): SendGrid's own validation strings (field +
 *    message) reach the log and the caller; keys are redacted; no body → "".
 *
 * Plus source pins: every SENDGRID_FROM_EMAIL read goes through the cleaner.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cleanSenderAddress, describeSenderAddress } from '../lib/sendgrid';
import { sendGridErrorDetail } from '../lib/guarded-sendgrid';

const SERVER = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(SERVER, p), 'utf8');

describe('cleanSenderAddress — the from-address secret is sanitised like the API key', () => {
  it('passes a clean address through', () => {
    expect(cleanSenderAddress('noreply@petwash.co.il', 'x@y.z')).toBe('noreply@petwash.co.il');
  });
  it('strips a trailing newline / whitespace / control characters (the secret-with-newline case)', () => {
    expect(cleanSenderAddress('noreply@petwash.co.il\n', 'x@y.z')).toBe('noreply@petwash.co.il');
    expect(cleanSenderAddress('  noreply@petwash.co.il \r\n', 'x@y.z')).toBe('noreply@petwash.co.il');
    expect(cleanSenderAddress('noreply@petwash.co.il\u0000', 'x@y.z')).toBe('noreply@petwash.co.il');
  });
  it('extracts the address from "Display Name <address>"', () => {
    expect(cleanSenderAddress('PetWash <noreply@petwash.co.il>', 'x@y.z')).toBe('noreply@petwash.co.il');
  });
  it('falls back to the default when unset, empty, or not an address', () => {
    expect(cleanSenderAddress(undefined, 'support@petwash.co.il')).toBe('support@petwash.co.il');
    expect(cleanSenderAddress('', 'support@petwash.co.il')).toBe('support@petwash.co.il');
    expect(cleanSenderAddress('not an email', 'support@petwash.co.il')).toBe('support@petwash.co.il');
    expect(cleanSenderAddress('a@b', 'support@petwash.co.il')).toBe('support@petwash.co.il');
  });
});

describe('describeSenderAddress — shape only, never the value', () => {
  it('names a trailing newline without revealing the local part', () => {
    const d = describeSenderAddress('noreply@petwash.co.il\n');
    expect(d).toMatchObject({ present: true, trailingWhitespace: true, controlChars: true, looksLikeEmail: true, domain: 'petwash.co.il' });
    expect(JSON.stringify(d)).not.toContain('noreply');
  });
  it('reports absent', () => {
    expect(describeSenderAddress(undefined)).toMatchObject({ present: false, looksLikeEmail: false, domain: null });
  });
});

describe('sendGridErrorDetail — SendGrid says why, and the log finally carries it', () => {
  it('joins field + message from the response body', () => {
    const err = { code: 400, response: { body: { errors: [
      { message: 'The from email does not contain a valid address.', field: 'from.email' },
      { message: 'Something else', field: null },
    ] } } };
    expect(sendGridErrorDetail(err)).toBe('from.email: The from email does not contain a valid address. | Something else');
  });
  it('is empty when there is no SendGrid body (network error, mock)', () => {
    expect(sendGridErrorDetail(new Error('ECONNRESET'))).toBe('');
    expect(sendGridErrorDetail(undefined)).toBe('');
  });
  it('redacts anything that looks like an API key', () => {
    const err = { response: { body: { errors: [{ message: 'bad key SG.abcDEF123.xyz' }] } } };
    expect(sendGridErrorDetail(err)).toBe('bad key SG.[redacted]');
  });
});

describe('every SENDGRID_FROM_EMAIL read goes through cleanSenderAddress', () => {
  for (const f of ['lib/notificationDispatcher.ts', 'routes/booking-chat.ts', 'jobs/daily-close-reminder.ts', 'lib/passTokens.ts']) {
    it(f, () => {
      const src = read(f);
      const raw = src.match(/process\.env\.SENDGRID_FROM_EMAIL/g) ?? [];
      const cleaned = src.match(/cleanSenderAddress\(process\.env\.SENDGRID_FROM_EMAIL/g) ?? [];
      // every read except the presence check (`!process.env.SENDGRID_FROM_EMAIL`) is cleaned
      const presenceChecks = src.match(/!process\.env\.SENDGRID_FROM_EMAIL/g) ?? [];
      expect(cleaned.length).toBe(raw.length - presenceChecks.length);
      expect(cleaned.length).toBeGreaterThan(0);
    });
  }
  it('the guarded send returns the detail to its caller and the dispatcher records it', () => {
    expect(read('lib/guarded-sendgrid.ts')).toMatch(/\{ ok: false, reason: 'send_failed', service, detail \}/);
    expect(read('lib/notificationDispatcher.ts')).toMatch(/Email guarded-send \$\{guarded\.reason\}\$\{why\}/);
  });
});
