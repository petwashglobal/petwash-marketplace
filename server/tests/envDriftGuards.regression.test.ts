/**
 * Env-drift guardrails — regression tests for the fail-closed switch on
 * previously-insecure literal fallbacks.
 *
 * These pins:
 *   1. Prove verify-env's classifyEnvironment/assertRequiredEnvOrThrow contract.
 *   2. Prove signQrPayload throws in production when QR_SECRET is unset (no
 *      more 'petwash-qr-default-replace-in-prod').
 *   3. Prove hashWifiBssid throws in production when KYC_SALT is unset (no
 *      more 'default-salt').
 *   4. Prove Apple Wallet auth-token generation throws in production when
 *      MOBILE_LINK_SECRET is unset (no more 'secret' literal).
 *   5. Prove .env.example documents every previously undocumented var read in
 *      server code (NAYAX_TERMINAL_ID_MAIN/SECONDARY, QR_SECRET,
 *      APP_SESSION_SECRET, PASS_TOKEN_SECRET).
 *   6. Prove the client-side broken process.env read in AdminWalletDashboard
 *      is gone (Vite never injects it, so it always evaluated to the
 *      fallback and produced a wrong number).
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  classifyEnvironment,
  assertRequiredEnvOrThrow,
} from '../../scripts/verify-env';
import { signQrPayload } from '../utils/generateQrPayload';

const ROOT = resolve(__dirname, '..', '..');
const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');

describe('verify-env — classification and boot gate', () => {
  it('reports every REQUIRED var as missing when env is empty', () => {
    const { missing } = classifyEnvironment({});
    expect(missing.required).toContain('DATABASE_URL');
    expect(missing.required).toContain('SESSION_SECRET');
    expect(missing.required).toContain('COOKIE_SECRET');
    expect(missing.required).toContain('JWT_SECRET');
    expect(missing.required).toContain('KYC_SALT');
    expect(missing.required).toContain('QR_SECRET');
    expect(missing.required).toContain('MOBILE_LINK_SECRET');
    expect(missing.required).toContain('WALLET_LINK_SECRET');
  });

  it('treats APP_SESSION_SECRET as satisfied by the COOKIE_SECRET alternate', () => {
    const { missing } = classifyEnvironment({ COOKIE_SECRET: 'x'.repeat(64) });
    expect(missing.required).not.toContain('APP_SESSION_SECRET');
  });

  it('assertRequiredEnvOrThrow: throws in production when a required var is unset', () => {
    expect(() =>
      assertRequiredEnvOrThrow({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/Missing REQUIRED env vars in production/);
  });

  it('assertRequiredEnvOrThrow: does NOT throw in development even with vars unset', () => {
    expect(() =>
      assertRequiredEnvOrThrow({ NODE_ENV: 'development' } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});

describe('signQrPayload — fail-closed in production', () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedQrSecret = process.env.QR_SECRET;

  beforeEach(() => {
    delete process.env.QR_SECRET;
  });

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
    if (savedQrSecret !== undefined) process.env.QR_SECRET = savedQrSecret;
    else delete process.env.QR_SECRET;
  });

  it('throws when NODE_ENV=production and QR_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    expect(() => signQrPayload('m1', 'l1', 1234567890, 'nonce')).toThrow(
      /QR_SECRET must be set in production/,
    );
  });

  it('does NOT throw when NODE_ENV=development and QR_SECRET is unset', () => {
    process.env.NODE_ENV = 'development';
    expect(() => signQrPayload('m1', 'l1', 1234567890, 'nonce')).not.toThrow();
  });

  it('uses the configured QR_SECRET when present, producing a stable HMAC', () => {
    process.env.NODE_ENV = 'production';
    process.env.QR_SECRET = 'a-real-secret-value';
    const a = signQrPayload('m1', 'l1', 1234567890, 'nonce');
    const b = signQrPayload('m1', 'l1', 1234567890, 'nonce');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Fail-closed guards — source pins', () => {
  // The following files pull in the DB / Firebase module tree, so we can't
  // reasonably instantiate them in a unit test. Pin the guard shape at the
  // source level — a regression that reverts the throw would fail here.
  it('UserDeviceService.hashWifiBssid throws in production when KYC_SALT is unset', () => {
    const src = readFileSync(
      resolve(ROOT, 'server/services/UserDeviceService.ts'),
      'utf8',
    );
    // The old code did `process.env.KYC_SALT || 'default-salt'`. The new
    // guard must fail-closed in production.
    expect(src).not.toMatch(/KYC_SALT \|\| 'default-salt'/);
    expect(src).toMatch(
      /KYC_SALT must be set in production[\s\S]{0,120}hashWifiBssid/,
    );
  });

  it('appleWallet.generateAuthToken throws in production when MOBILE_LINK_SECRET is unset', () => {
    const src = readFileSync(resolve(ROOT, 'server/appleWallet.ts'), 'utf8');
    // Old: `MOBILE_LINK_SECRET || 'secret'` — a public literal.
    expect(src).not.toMatch(/MOBILE_LINK_SECRET \|\| 'secret'/);
    expect(src).toMatch(/MOBILE_LINK_SECRET must be set in production/);
  });

  it('TwilioSMSService OTP HMAC throws in production without APP_SESSION_SECRET / COOKIE_SECRET', () => {
    const src = readFileSync(
      resolve(ROOT, 'server/services/TwilioSMSService.ts'),
      'utf8',
    );
    // Old literal 'petwash-otp-hmac' must be gone from the OTP paths.
    expect(src).not.toMatch(/\|\| 'petwash-otp-hmac'/);
    expect(src).toMatch(
      /APP_SESSION_SECRET or COOKIE_SECRET must be set in production/,
    );
  });
});

describe('.env.example coverage — newly documented drift entries', () => {
  it('documents NAYAX_TERMINAL_ID_MAIN (read by NayaxSparkService + NayaxMonitoringService)', () => {
    expect(envExample).toMatch(/^NAYAX_TERMINAL_ID_MAIN=/m);
  });

  it('documents NAYAX_TERMINAL_ID_SECONDARY (read by NayaxMonitoringService)', () => {
    expect(envExample).toMatch(/^NAYAX_TERMINAL_ID_SECONDARY=/m);
  });

  it('documents QR_SECRET (dynamic QR signing HMAC)', () => {
    expect(envExample).toMatch(/^QR_SECRET=/m);
  });

  it('documents APP_SESSION_SECRET (OTP HMAC primary source)', () => {
    expect(envExample).toMatch(/^APP_SESSION_SECRET=/m);
  });

  it('documents PASS_TOKEN_SECRET (signed redeem-token HMAC)', () => {
    expect(envExample).toMatch(/^PASS_TOKEN_SECRET=/m);
  });
});

describe('client — no server-only process.env reads in AdminWalletDashboard', () => {
  it('AdminWalletDashboard.tsx does not read process.env.REFUND_AUTO_APPROVE_LIMIT_CENTS', () => {
    const src = readFileSync(
      resolve(ROOT, 'client/src/pages/AdminWalletDashboard.tsx'),
      'utf8',
    );
    // Vite does not inject process.env.* on the client, so any such read is
    // always undefined and silently wrong. The fix replaced the read with a
    // static reference to the server-configured limit.
    expect(src).not.toMatch(/process\.env\.REFUND_AUTO_APPROVE_LIMIT_CENTS/);
  });
});
