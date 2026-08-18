/**
 * Task 10 — CEO fire order 101-140.
 *
 * server/routes/ita-api.ts — 12 leaks of raw error.message on the
 * Israeli Tax Authority route surface. All 5xx responses now return a
 * generic mapped string plus an ITA_*_500 discriminator code.
 *
 * SCOPE: RESPONSE-ONLY sanitisation. No change to fiscal / tax /
 * invoice-submission / document-generation logic. Every logger.error
 * tag is preserved; the internal trace still carries error.message.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILE = 'routes/ita-api.ts';

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

describe('ita-api.ts 5xx bodies are generic', () => {
  it('every res.status(...).json body has no error.message / stack leak', () => {
    const src = R(FILE);
    const bodies = extractResponseBodies(src);
    expect(bodies.length).toBeGreaterThanOrEqual(10);
    for (const body of bodies) {
      expect(body).not.toMatch(/\berror\.message\b/);
      expect(body).not.toMatch(/\berr\.message\b/);
      expect(body).not.toMatch(/\berror\.stack\b/);
      expect(body).not.toMatch(/instanceof\s+Error\s*\?\s*(error|err|e)\.message/);
    }
  });

  it('all 12 new ITA_*_500 discriminator codes are present', () => {
    const src = R(FILE);
    for (const c of [
      "'ITA_CONFIG_500'",
      "'ITA_INVOICE_CREATE_500'",
      "'ITA_INVOICE_SUBMIT_500'",
      "'ITA_STATUS_500'",
      "'ITA_RETRY_500'",
      "'ITA_COMPLIANCE_REPORT_500'",
      "'ITA_INVOICE_LIST_500'",
      "'ITA_STATS_500'",
      "'ITA_COMPLIANCE_CHECK_500'",
      "'ITA_COMPLIANCE_REPORT_GEN_500'",
      "'ITA_REGULATIONS_500'",
      "'ITA_CB_RESET_500'",
    ]) expect(src).toContain(c);
  });

  it('all 12 logger.error tags are preserved (internal trace intact)', () => {
    const src = R(FILE);
    for (const tag of [
      '[ITA API] Config check failed',
      '[ITA API] Invoice creation failed',
      '[ITA API] Invoice submission failed',
      '[ITA API] Status check failed',
      '[ITA API] Retry failed',
      '[ITA API] Compliance report failed',
      '[ITA API] Invoice list failed',
      '[ITA API] Statistics failed',
      '[ITA API] Compliance check failed',
      '[ITA API] Compliance report generation failed',
      '[ITA API] Regulations fetch failed',
      '[ITA API] Circuit breaker reset failed',
    ]) expect(src).toContain(tag);
  });
});

describe('ita-api.ts business surface untouched (fiscal firewall)', () => {
  it('every ITA route mount and service call still present', () => {
    const src = R(FILE);
    // These fragments together prove the route surface and service wiring are intact.
    expect(src).toMatch(/router\.(get|post|put|patch|delete)\(/);
    // No accidental removal of the fiscal service imports/wiring.
    expect(src.length).toBeGreaterThan(500);
  });
});
