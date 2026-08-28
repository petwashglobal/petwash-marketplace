/**
 * CEO §15 / §46 discipline — handoff PINs (raw code, QR token, HMAC hash,
 * server secret) must NEVER reach any logger call.
 *
 * Cross-repo grep pin so a future PR that adds a helpful debug log with
 * cred.code inside can't slip through review. The scan walks server/
 * and every route/service that touches the handoff surface, and bans
 * an argument shape that carries the plaintext PIN or the stored hash
 * inside a logger.* invocation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

const ROOT = path.resolve(__dirname, '..', '..');

describe('§15/§46 — handoff PINs / hashes / secrets never reach logger.*', () => {
  it('no logger call in server/ takes cred.code / rec.hash / rec.nonce / HANDOFF_HMAC_SECRET', async () => {
    const files = await walk(path.join(ROOT, 'server'));
    // Tolerate the test files themselves — they set the secret via
    // process.env for determinism and don't emit logs.
    const productionFiles = files.filter((f) => !f.includes('/tests/'));

    const banned: string[] = [];
    // Match logger.info( ... cred.code ... ) or logger.warn( ... rec.hash ... )
    // in any arg-list up to the closing }); of the call. The values we
    // ban are the runtime references (never mention of the env-var
    // NAME, which is safe to log inside an error message).
    const bannedTokens = [
      'cred.code',
      'rec.hash',
      'rec.nonce',
      'process.env.HANDOFF_HMAC_SECRET',
      '${getHandoffSecret()',
    ];

    for (const file of productionFiles) {
      const src = await fs.readFile(file, 'utf8').catch(() => '');
      if (!src.includes('logger.')) continue;
      // Extract every logger.<level>( ... ) call (bounded, single-level).
      const calls = [...src.matchAll(/logger\.[a-z]+\(([\s\S]*?)\}\);/g)];
      for (const m of calls) {
        const args = m[1];
        for (const tok of bannedTokens) {
          if (args.includes(tok)) {
            banned.push(`${path.relative(ROOT, file)}: '${tok}' inside logger call`);
          }
        }
      }
    }

    expect(banned, `Sensitive tokens leaked to logger:\n${banned.join('\n')}`).toEqual([]);
  });

  it('handoffCredentials.ts stores HMAC (not plain sha256) with a length guard on compare', async () => {
    const src = await fs.readFile(
      path.join(ROOT, 'server', 'services', 'jobPassport', 'handoffCredentials.ts'),
      'utf8',
    );
    // HMAC swap is live.
    expect(src).toMatch(/crypto\s*\.\s*createHmac\(['"]sha256['"],\s*getHandoffSecret\(\)\)/);
    // Length guard + constant-time compare.
    expect(src).toMatch(/if \(a\.length !== b\.length\) return false/);
    expect(src).toMatch(/crypto\.timingSafeEqual\(Buffer\.from\(a, 'hex'\), Buffer\.from\(b, 'hex'\)\)/);
    // Fail-loud in production when the secret is missing.
    expect(src).toMatch(/NODE_ENV === ['"]production['"][\s\S]*?throw new Error/);
  });
});
