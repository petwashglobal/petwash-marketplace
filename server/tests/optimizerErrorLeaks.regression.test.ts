/**
 * Task 11 — CEO fire order 101-140.
 *
 * server/routes/optimizer.ts — 5 leaks of raw err.message on 5xx bodies.
 * Now returns { error: 'OPTIMIZER_*_FAILED', code: 'OPTIMIZER_*_500' }.
 *
 * No change to routing/dispatch/pricing logic. logger tags preserved
 * where present.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

function extractResponseBodies(src: string): string[] {
  const out: string[] = [];
  const rx = /res\.status\(\d{3}\)\s*\.json\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

describe('optimizer.ts 5xx bodies never leak err.message', () => {
  it('every res.status(...).json body is generic', () => {
    const src = R('routes/optimizer.ts');
    const bodies = extractResponseBodies(src);
    expect(bodies.length).toBeGreaterThanOrEqual(5);
    for (const body of bodies) {
      expect(body).not.toMatch(/\berror\.message\b/);
      expect(body).not.toMatch(/\berr\.message\b/);
      expect(body).not.toMatch(/\berror\.stack\b/);
      expect(body).not.toMatch(/\berr\.stack\b/);
    }
  });

  it('5 new OPTIMIZER_*_500 discriminator codes present', () => {
    const src = R('routes/optimizer.ts');
    for (const c of [
      "'OPTIMIZER_LIST_500'",
      "'OPTIMIZER_GENERATE_500'",
      "'OPTIMIZER_ACCEPT_500'",
      "'OPTIMIZER_REJECT_500'",
      "'OPTIMIZER_PROMOTE_500'",
    ]) expect(src).toContain(c);
  });

  it('router surface intact', () => {
    const src = R('routes/optimizer.ts');
    expect(src).toMatch(/router\.(get|post|put|patch|delete)\(/);
  });
});
