/**
 * Apple Wallet env-name compatibility shim.
 *
 * Production GCP Secret Manager exposes the PassKit credentials under the
 * APPLE_WALLET_* prefix, but the application code reads two OTHER name sets:
 *
 *   • modern path  (server/services/AppleWalletService.ts) reads APPLE_*_PEM /
 *     APPLE_*_IDENTIFIER names AT MODULE LOAD (top-level const).
 *   • legacy path  (server/appleWallet.ts) reads APPLE_*_ID / APPLE_*_CERT names.
 *
 * Renaming the production secrets is not allowed, so this shim copies the
 * configured APPLE_WALLET_* values onto the names the code expects. It runs at
 * the very top of server startup, BEFORE any wallet module is imported.
 *
 * Guarantees:
 *   • non-destructive — only fills a target that is currently unset (??=), so an
 *     explicitly-configured canonical name always wins.
 *   • no value exposure — never logs, returns, or stores a secret value; the
 *     summary log reports only how many names were normalized.
 *   • no wallet/QR logic touched — pure env-name aliasing.
 */

/** One source secret → the canonical names that should mirror it. */
const APPLE_WALLET_ALIASES: ReadonlyArray<{ source: string; targets: string[] }> = [
  { source: 'APPLE_WALLET_PASS_TYPE_ID', targets: ['APPLE_PASS_TYPE_IDENTIFIER', 'APPLE_PASS_TYPE_ID'] },
  { source: 'APPLE_WALLET_TEAM_ID',      targets: ['APPLE_TEAM_IDENTIFIER', 'APPLE_TEAM_ID'] },
  { source: 'APPLE_WALLET_WWDR_CERT',    targets: ['APPLE_WWDR_PEM', 'APPLE_WWDR_CERT'] },
  { source: 'APPLE_WALLET_CERT',         targets: ['APPLE_SIGNER_CERT_PEM', 'APPLE_SIGNER_CERT'] },
  { source: 'APPLE_WALLET_KEY',          targets: ['APPLE_SIGNER_KEY_PEM', 'APPLE_SIGNER_KEY'] },
];

/**
 * Mirror APPLE_WALLET_* secrets onto the canonical env names the wallet code
 * reads. Returns the count of names filled (for a value-free startup log).
 * Accepts an env object for testing; defaults to process.env.
 */
export function applyWalletEnvCompat(env: NodeJS.ProcessEnv = process.env): number {
  let filled = 0;
  for (const { source, targets } of APPLE_WALLET_ALIASES) {
    const value = env[source];
    if (value === undefined || value === '') continue;
    for (const target of targets) {
      if (env[target] === undefined || env[target] === '') {
        env[target] = value;
        filled += 1;
      }
    }
  }
  return filled;
}
