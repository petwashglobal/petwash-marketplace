/**
 * Apple Wallet configuration diagnostic — run this in the DEPLOYED environment
 * (e.g. Cloud Run shell) to find out why the prestige .pkpass won't generate,
 * WITHOUT printing any secret value, certificate content, token, or user data.
 *
 *   npx tsx scripts/diagnose-wallet-config.ts
 *
 * It applies the APPLE_WALLET_* → canonical env shim, then reports exactly one
 * failure category (or OK):
 *
 *   1 env_missing        — a required canonical Apple env name is still unset
 *   2 cert_key_not_pem   — WWDR/signer cert or signer key fails PEM parsing
 *   3 signing_issue      — PASS_LINK_SECRET / PRESTIGE_QR_SECRET missing or < 16 chars
 *   4 token_issue        — token signing throws
 *   5 wallet_rejection   — config is valid in-process; only on-device Wallet
 *                          acceptance remains to verify (test on iPhone)
 *
 * Output is names / booleans / lengths only. Exit code = the category number
 * (0 when everything checks out) so ops can branch on it in a shell.
 */

import crypto from 'node:crypto';
import { applyWalletEnvCompat } from '../server/lib/wallet-env-compat';

// Required canonical names for the MODERN prestige path (no defaults).
const REQUIRED_APPLE = ['APPLE_TEAM_IDENTIFIER', 'APPLE_WWDR_PEM', 'APPLE_SIGNER_CERT_PEM', 'APPLE_SIGNER_KEY_PEM'] as const;
const MIN_SECRET_LEN = 16;

export type WalletDiagCategory = 'ok' | 'env_missing' | 'cert_key_not_pem' | 'signing_issue' | 'token_issue';

export interface WalletDiagResult {
  category: WalletDiagCategory;
  code: number;                       // 0 ok, else 1..4
  shimFilled: number;                 // how many names the shim normalized
  envPresent: Record<string, boolean>;
  missingEnv: string[];
  pem: { wwdr: boolean; signerCert: boolean; signerKey: boolean };
  secrets: { passLinkLen: number; prestigeQrLen: number };  // lengths only, never values
  notes: string[];
}

function parsesAsCertificate(pem: string | undefined): boolean {
  if (!pem) return false;
  try { new crypto.X509Certificate(pem); return true; } catch { return false; }
}

function parsesAsPrivateKey(pem: string | undefined, passphrase: string | undefined): boolean {
  if (!pem) return false;
  try { crypto.createPrivateKey(passphrase ? { key: pem, passphrase } : { key: pem }); return true; } catch { return false; }
}

/**
 * Pure diagnostic over an env object. Never reads or returns secret values —
 * only presence booleans, parse results, and string lengths.
 */
export function diagnoseWalletConfig(env: NodeJS.ProcessEnv): Omit<WalletDiagResult, 'shimFilled'> {
  const notes: string[] = [];

  const envPresent: Record<string, boolean> = {};
  for (const name of REQUIRED_APPLE) envPresent[name] = !!env[name];
  envPresent['APPLE_PASS_TYPE_IDENTIFIER'] = !!env['APPLE_PASS_TYPE_IDENTIFIER']; // has a code default
  const missingEnv = REQUIRED_APPLE.filter((n) => !env[n]);

  const passLink = env.PASS_LINK_SECRET || env.PRESTIGE_QR_SECRET || '';
  const prestigeQr = env.PRESTIGE_QR_SECRET || '';
  const secrets = { passLinkLen: passLink.length, prestigeQrLen: prestigeQr.length };

  // Category 1: required env missing.
  if (missingEnv.length > 0) {
    notes.push(`Missing canonical Apple env name(s): ${missingEnv.join(', ')}. If APPLE_WALLET_* secrets exist, the shim should fill these — confirm the source names.`);
    return {
      category: 'env_missing', code: 1, envPresent, missingEnv,
      pem: { wwdr: false, signerCert: false, signerKey: false }, secrets, notes,
    };
  }

  // Category 2: cert/key not PEM.
  const pem = {
    wwdr: parsesAsCertificate(env.APPLE_WWDR_PEM),
    signerCert: parsesAsCertificate(env.APPLE_SIGNER_CERT_PEM),
    signerKey: parsesAsPrivateKey(env.APPLE_SIGNER_KEY_PEM, env.APPLE_SIGNER_KEY_PASSPHRASE || undefined),
  };
  if (!pem.wwdr || !pem.signerCert || !pem.signerKey) {
    const bad = Object.entries(pem).filter(([, ok]) => !ok).map(([k]) => k);
    notes.push(`Not parseable as PEM: ${bad.join(', ')}. The secret value must be PEM text (e.g. -----BEGIN CERTIFICATE-----), not .p12/DER/base64-blob.`);
    return { category: 'cert_key_not_pem', code: 2, envPresent, missingEnv, pem, secrets, notes };
  }

  // Category 3: signing secrets missing / too short.
  if (secrets.passLinkLen < MIN_SECRET_LEN || secrets.prestigeQrLen < MIN_SECRET_LEN) {
    notes.push(`PASS_LINK_SECRET effective length=${secrets.passLinkLen}, PRESTIGE_QR_SECRET length=${secrets.prestigeQrLen}; both must be >= ${MIN_SECRET_LEN}.`);
    return { category: 'signing_issue', code: 3, envPresent, missingEnv, pem, secrets, notes };
  }

  notes.push('Apple env present, certs/key parse as PEM, signing secrets long enough.');
  return { category: 'ok', code: 0, envPresent, missingEnv, pem, secrets, notes };
}

async function main(): Promise<void> {
  const shimFilled = applyWalletEnvCompat();
  const base = diagnoseWalletConfig(process.env);

  // Category 4: token signing actually throws (exercises secret usage end-to-end).
  let tokenOk = base.category === 'ok';
  if (base.category === 'ok') {
    try {
      const { buildPassLinkToken, buildQrRedeemToken } = await import('../server/lib/passTokens');
      buildPassLinkToken('diag-pass', 'diag-user', 1);
      buildQrRedeemToken('diag-pass', 'diag-user', 1);
    } catch (err: any) {
      tokenOk = false;
      base.category = 'token_issue';
      base.code = 4;
      base.notes.push(`Token signing threw: ${err?.message || 'unknown'} (no token content shown).`);
    }
  }

  const result: WalletDiagResult = { ...base, shimFilled };

  console.log('──────────────────────────────────────────────');
  console.log(`WALLET_DIAG: category=${result.category} code=${result.code}`);
  console.log(`shim_normalized_names=${result.shimFilled}`);
  console.log(`apple_env_present=${JSON.stringify(result.envPresent)}`);
  if (result.missingEnv.length) console.log(`apple_env_missing=${result.missingEnv.join(',')}`);
  console.log(`pem_parse=${JSON.stringify(result.pem)}`);
  console.log(`secret_lengths=${JSON.stringify(result.secrets)}`);
  if (result.category === 'ok' && tokenOk) {
    console.log('WALLET_DIAG: config valid in-process. Remaining category 5 (wallet_rejection)');
    console.log('  can only be confirmed on a real iPhone — generate a pass and add it to Wallet.');
  }
  for (const n of result.notes) console.log(`note: ${n}`);
  console.log('──────────────────────────────────────────────');

  process.exit(result.code);
}

// Run only when invoked directly (so the pure function can be imported by tests).
const invokedDirectly = process.argv[1] && process.argv[1].includes('diagnose-wallet-config');
if (invokedDirectly) {
  main().catch((e) => { console.error('WALLET_DIAG: fatal', e?.message); process.exit(99); });
}
