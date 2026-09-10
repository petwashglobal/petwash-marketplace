/**
 * server/routes/credit-wallet.ts must transform.
 *
 * 2026-09-10: #2373 left a stray "}" after the memberTier import — a syntax
 * error no source-pin test could see. The deploy gate (routes-load smoke)
 * caught it: "Transform failed with 1 error" and the run failed. Had it
 * deployed, the container would have crash-looped at route registration.
 * This pin runs the same transform esbuild/tsx run in production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { transformSync } from 'esbuild';

const FILES = ['server/routes/credit-wallet.ts', 'server/routes/wallet.ts', 'server/lib/memberTier.ts', 'server/appleWallet.ts', 'server/googleWallet.ts'];

describe('wallet modules transform', () => {
  for (const f of FILES) {
    it(`${f} transforms without syntax errors`, () => {
      const src = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
      expect(() => transformSync(src, { loader: 'ts', format: 'esm', sourcefile: f })).not.toThrow();
    });
  }
});
