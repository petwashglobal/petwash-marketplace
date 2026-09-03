/**
 * Regression pin — critical limiters use the Redis-backed store.
 *
 * AUDIT-SMS-10 (#223b, CEO Lane E slice 2). Locks in the specific
 * limiters we've migrated so far. Adding a new limiter to the migrated
 * list here fails the test until the source is also updated — the pin
 * ratchets: cannot regress a migrated limiter to MemoryStore, cannot
 * silently claim a new one is Redis-backed without wiring it.
 *
 * Not a whole-file pin — the file still has un-migrated limiters
 * (apiLimiter, kycLimiter, bookingLimiter, ...) whose migration is
 * gated on ops confirming Redis stability in a canary window.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'server/middleware/rateLimiter.ts'), 'utf8');

/**
 * Grabs the object-literal body passed to `rateLimit({ ... })` for the
 * limiter whose export identifier matches `exportName`.
 */
function limiterBlock(exportName: string): string {
  const anchor = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*rateLimit\\(\\s*\\{`,
  );
  const start = src.search(anchor);
  if (start < 0) throw new Error(`limiter export not found: ${exportName}`);
  const openIdx = src.indexOf('{', start);
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  throw new Error(`limiter block did not close: ${exportName}`);
}

const REDIS_BACKED = [
  ['aiChatLimiter', 'ai_chat_min'],
  ['aiChatHourlyLimiter', 'ai_chat_hour'],
  ['authLimiter', 'auth'],
  ['otpLimiter', 'otp'],
  ['webauthnLimiter', 'webauthn'],
] as const;

describe('#223b rate-limiter Redis wiring — migrated limiters', () => {
  it('module imports the Redis store factory', () => {
    expect(src).toMatch(
      /import\s*\{\s*redisRateLimitStore\s*\}\s*from\s*['"]\.\/rateLimiterRedisStore['"]/,
    );
  });

  it.each(REDIS_BACKED)(
    '%s uses redisRateLimitStore(%o)',
    (exportName, prefix) => {
      const block = limiterBlock(exportName);
      const storeLine = new RegExp(
        `store\\s*:\\s*redisRateLimitStore\\(\\s*['"]${prefix}['"]\\s*\\)`,
      );
      expect(block).toMatch(storeLine);
    },
  );
});
