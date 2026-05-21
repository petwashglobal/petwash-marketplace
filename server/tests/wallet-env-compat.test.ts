/**
 * PR-WALLET-ENV-COMPAT-A — guard for the Apple Wallet env-name shim.
 *
 * Uses a FAKE env object with non-secret placeholder strings. No real secret
 * values appear here or in CI output.
 */

import { describe, it, expect } from 'vitest';
import { applyWalletEnvCompat } from '../lib/wallet-env-compat';

// Canonical names the wallet code reads (modern + legacy paths).
const MODERN = ['APPLE_PASS_TYPE_IDENTIFIER', 'APPLE_TEAM_IDENTIFIER', 'APPLE_WWDR_PEM', 'APPLE_SIGNER_CERT_PEM', 'APPLE_SIGNER_KEY_PEM'];
const LEGACY = ['APPLE_PASS_TYPE_ID', 'APPLE_TEAM_ID', 'APPLE_WWDR_CERT', 'APPLE_SIGNER_CERT', 'APPLE_SIGNER_KEY'];

function productionLikeEnv(): NodeJS.ProcessEnv {
  return {
    APPLE_WALLET_PASS_TYPE_ID: 'pass.test.placeholder',
    APPLE_WALLET_TEAM_ID: 'TEAMTEST00',
    APPLE_WALLET_WWDR_CERT: 'placeholder-wwdr',
    APPLE_WALLET_CERT: 'placeholder-cert',
    APPLE_WALLET_KEY: 'placeholder-key',
  } as NodeJS.ProcessEnv;
}

describe('applyWalletEnvCompat', () => {
  it('fills both modern and legacy canonical names from APPLE_WALLET_* sources', () => {
    const env = productionLikeEnv();
    applyWalletEnvCompat(env);
    for (const name of [...MODERN, ...LEGACY]) {
      expect(env[name], `${name} should be populated`).toBeTruthy();
    }
    expect(env.APPLE_PASS_TYPE_IDENTIFIER).toBe('pass.test.placeholder');
    expect(env.APPLE_SIGNER_KEY_PEM).toBe('placeholder-key');
    expect(env.APPLE_WWDR_CERT).toBe('placeholder-wwdr');
  });

  it('is non-destructive: never overwrites an explicitly-set canonical name', () => {
    const env = productionLikeEnv();
    env.APPLE_TEAM_IDENTIFIER = 'EXPLICIT123';
    applyWalletEnvCompat(env);
    expect(env.APPLE_TEAM_IDENTIFIER).toBe('EXPLICIT123');
    // The legacy sibling, left unset, still gets filled from the source.
    expect(env.APPLE_TEAM_ID).toBe('TEAMTEST00');
  });

  it('does nothing and does not throw when no APPLE_WALLET_* names exist', () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(() => applyWalletEnvCompat(env)).not.toThrow();
    expect(applyWalletEnvCompat(env)).toBe(0);
    for (const name of [...MODERN, ...LEGACY]) {
      expect(env[name]).toBeUndefined();
    }
  });

  it('treats empty-string sources as unset (no blank canonical values)', () => {
    const env = { APPLE_WALLET_TEAM_ID: '' } as NodeJS.ProcessEnv;
    applyWalletEnvCompat(env);
    expect(env.APPLE_TEAM_IDENTIFIER).toBeUndefined();
  });

  it('does not leak any secret value into its return (returns a count)', () => {
    const env = productionLikeEnv();
    const result = applyWalletEnvCompat(env);
    expect(typeof result).toBe('number');
    expect(result).toBe(MODERN.length + LEGACY.length);
  });
});
