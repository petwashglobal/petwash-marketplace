/**
 * 2026-09-13 — welcome / birthday / reminder emails carry EmailService's legacy
 * unsubscribe token, but /unsubscribe → POST /api/marketing/unsubscribe accepted
 * only the uid token (server/lib/unsubToken.ts). Every such click failed as
 * "expired". Round-trip: sign with the legacy generator, unsubscribe via the
 * canonical endpoint's parser.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('legacy EmailService unsubscribe tokens are honoured', () => {
  let EmailService: any;
  beforeAll(async () => {
    process.env.UNSUBSCRIBE_HMAC_SECRET = 'test-unsub-secret-0123456789';
    ({ EmailService } = await import('../emailService'));
  }, 60_000);

  it('a token EmailService signs validates and yields the email; a forged one does not', () => {
    const token = EmailService.generateUnsubscribeToken('Dana@Example.com', 7);
    const ok = EmailService.validateUnsubscribeToken(token);
    expect(ok.isValid).toBe(true);
    expect(String(ok.data.email).toLowerCase()).toBe('dana@example.com');

    const forged = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(EmailService.validateUnsubscribeToken(forged).isValid).toBe(false);
  });

  it('the canonical endpoint falls back to the legacy token and clears consent by email', () => {
    const src = readFileSync(resolve(__dirname, '../routes/marketing-unsubscribe.ts'), 'utf8');
    expect(src).toMatch(/const legacyEmail = await legacyUnsubscribeEmail\(token\)/);
    expect(src).toMatch(/EmailService\.validateUnsubscribeToken\(token\)/);
    expect(src).toMatch(/\.set\(\{ marketingConsent: false \}\)\s*\.where\(sql`lower\(\$\{users\.email\}\) = \$\{legacyEmail\}`\)/);
  });
});
