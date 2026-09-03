/**
 * Release freeze 2026-09-03 · Security-floor top-up regression pins.
 *
 * Consolidates the CEO-directed reconciliation of PR #2176 (8 doctrine
 * commits) + #2174 (chat-history super_admin typo) against the release
 * HEAD. Each port has one pin here; each pin fails LOUDLY if a future
 * change silently regresses the protection.
 *
 * The wire-through behavior of the logger redactor is exercised as a
 * real behavioural test (calls logger.info with a secret-bearing
 * context, asserts the redactor scrubs it before stdout).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readServerFile(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('release security floor top-up — source pins', () => {
  it('chat-history.ts uses canonical super_admin (typo #2174)', () => {
    const src = readServerFile('server/routes/chat-history.ts');
    // Old typo removed
    expect(src.includes("'superadmin'")).toBe(false);
    // Canonical form present at each check site
    const canonical = (src.match(/'super_admin'/g) || []).length;
    expect(canonical).toBeGreaterThanOrEqual(3);
  });

  it('EscrowService.releaseEscrowPayment defaults payout gate to ENFORCE (MONEY-1)', () => {
    const src = readServerFile('server/services/EscrowService.ts');
    // Fail-CLOSED shape: default is ENFORCE unless env is explicitly "false"
    expect(src).toMatch(/ESCROW_PAYOUT_GATE_ENFORCE\s*!==\s*"false"/);
    // No lingering old fail-OPEN default shape
    expect(src.includes('ESCROW_PAYOUT_GATE_ENFORCE === "true"')).toBe(false);
  });

  it('loyaltyEarn.awardLoyaltyPoints catches Postgres 23505 as duplicate (MONEY-2)', () => {
    const src = readServerFile('server/services/loyaltyEarn.ts');
    expect(src).toMatch(/err\?\.code\s*===\s*'23505'/);
    expect(src).toMatch(/skipped:\s*'duplicate'/);
  });

  it('POST /api/sitter-suite/sitters requires validateFirebaseToken (AUTH-1)', () => {
    const src = readServerFile('server/routes/sitter-suite.ts');
    expect(src).toMatch(
      /router\.post\('\/sitters',\s*validateFirebaseToken,\s*async/,
    );
  });

  it('POST /api/wallet/admin-send requires decoded.email_verified === true (AUTH-2)', () => {
    const src = readServerFile('server/routes/wallet.ts');
    expect(src).toMatch(/decoded\.email_verified\s*===\s*true/);
    expect(src).toMatch(/Verified email required/);
  });

  it('POST /api/k9000/dashboard/send-maintenance-alert requires validated admin (SMS-1)', () => {
    const src = readServerFile('server/routes/k9000Dashboard.ts');
    expect(src).toMatch(
      /router\.post\('\/dashboard\/send-maintenance-alert',\s*validateFirebaseToken,/,
    );
    expect(src).toMatch(/isSuperAdminVerified\(req as any\)/);
  });

  it('POST /api/avatars/generate-from-preset requires validateFirebaseToken (AI-2)', () => {
    const src = readServerFile('server/routes/avatars.ts');
    expect(src).toMatch(
      /router\.post\('\/generate-from-preset',\s*validateFirebaseToken,\s*async/,
    );
  });

  it('gemini safeGenerate ships a default maxOutputTokens (AI-1 / AI-6)', () => {
    const src = readServerFile('server/lib/gemini-client.ts');
    expect(src).toMatch(/DEFAULT_GEMINI_MAX_OUTPUT_TOKENS/);
    expect(src).toMatch(/GEMINI_DEFAULT_MAX_OUTPUT_TOKENS/);
    // Default 2048 or another integer; either way, present in the config call
    expect(src).toMatch(/config:\s*\{\s*maxOutputTokens/);
  });

  it('ServerLogger wires redactLogContext through formatLog (LOG-STRATEGIC)', () => {
    const src = readServerFile('server/lib/logger.ts');
    expect(src).toMatch(/import\s*\{\s*redactLogContext\s*\}\s*from\s*'\.\/redaction'/);
    expect(src).toMatch(/redactLogContext\(context\)/);
  });
});

describe('release security floor top-up — logger redactor behaviour', () => {
  const originalEnv = process.env.APP_ENV;
  let stdoutSpy: any;
  let stderrSpy: any;
  let stdwarnSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stdwarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.APP_ENV = 'production'; // force structured JSON path
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    stdwarnSpy.mockRestore();
    process.env.APP_ENV = originalEnv;
  });

  it('scrubs known secret keys before writing to stdout', async () => {
    const { logger } = await import('../lib/logger');
    logger.info('test event', {
      token: 'ey.super.secret.jwt.value',
      password: 'hunter2',
      cvv: '123',
      apiKey: 'sk_live_abc',
      cookie: 'session=xyz',
    });
    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n');
    expect(output).not.toContain('ey.super.secret.jwt.value');
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('sk_live_abc');
    expect(output).not.toContain('session=xyz');
    expect(output).toContain('[redacted]');
  });

  it('redacts email and phone fields', async () => {
    const { logger } = await import('../lib/logger');
    logger.info('user event', {
      email: 'someone@petwash.co.il',
      phone: '+972501234567',
    });
    const output = stdoutSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n');
    expect(output).not.toContain('someone@petwash.co.il');
    expect(output).not.toContain('+972501234567');
    // Redacted forms still present so the log stays useful
    expect(output).toMatch(/so\*\*\*@petwash\.co\.il/);
    expect(output).toMatch(/\*\*\*567/);
  });

  it('recursively scrubs nested body-like payloads (LOG-1 sms callback shape)', async () => {
    const { logger } = await import('../lib/logger');
    logger.warn('twilio callback', {
      body: {
        MessageSid: 'SMabc',
        MessageStatus: 'delivered',
        To: '+972501234567',
        // Known OTP-shaped keys get scrubbed even when the caller nested the
        // whole body verbatim (LOG-1 defense-in-depth).
        OTP: '123456',
      },
    });
    const output = stdwarnSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n');
    expect(output).not.toContain('+972501234567');
    // Scalar OTP field scrubbed to redacted marker
    expect(output).toContain('[redacted]');
    // Non-sensitive keys survive so the diagnostic remains useful
    expect(output).toContain('SMabc');
    expect(output).toContain('delivered');
  });

  it('never throws when given a cyclic / weird value', async () => {
    const { logger } = await import('../lib/logger');
    const cyclic: any = { name: 'root' };
    cyclic.self = cyclic;
    expect(() => logger.info('cyclic', cyclic)).not.toThrow();
    expect(stdoutSpy).toHaveBeenCalled();
  });
});
