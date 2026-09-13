/**
 * 2026-09-13 — the monthly auto "VAT declaration" cron is OFF by default.
 * It derived a VAT position from Firestore (not the SUMIT reporting file) and
 * emailed "payment due to the tax authority / refund eligible". VAT position and
 * period are the bookkeeper's determination (role boundary 2026-09-06).
 * Also pins that nothing auto-submits to the Tax Authority.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('monthly VAT auto-declaration', () => {
  it('the cron returns before generating unless VAT_DECLARATION_AUTOGEN_ENABLED === "true"', () => {
    const src = R('server/backgroundJobs.ts');
    const at = src.indexOf("cron.schedule('30 10 1 * *'");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, at + 700);
    const gateAt = body.indexOf("process.env.VAT_DECLARATION_AUTOGEN_ENABLED !== 'true'");
    const runAt = body.indexOf('generateMonthlyVATDeclaration()');
    expect(gateAt).toBeGreaterThan(-1);
    expect(runAt).toBeGreaterThan(gateAt);
    expect(body.slice(gateAt, runAt)).toMatch(/return;/);
  });

  it('nothing in server/ calls submitToTaxAuthority (no automatic filing path)', () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (f === 'node_modules' || f === 'tests') continue;
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(ts|js)$/.test(f)) {
          const s = readFileSync(p, 'utf8');
          if (/submitToTaxAuthority\(/.test(s.replace(/static async submitToTaxAuthority\(/g, ''))) hits.push(p);
        }
      }
    };
    walk(resolve(ROOT, 'server'));
    expect(hits).toEqual([]);
  });
});
