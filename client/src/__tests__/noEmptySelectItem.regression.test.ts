/**
 * Regression pin — Radix Select crash guard (2026-07-25).
 *
 * A <SelectItem value=""> throws at render ("must have a value prop that is not
 * an empty string") and takes down the whole page via AppErrorBoundary. It crashed
 * /admin/customers in prod (CustomerManagement.tsx). This scans every client TSX
 * for a Radix SelectItem with an empty-string value so the class can't return.
 * (Native <option value=""> is fine — only Radix SelectItem is forbidden.)
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') out.push(...walk(p)); }
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// Matches <SelectItem ... value="">  or value={''} / value={""} — Radix only.
const EMPTY_SELECTITEM = /<SelectItem\b[^>]*\bvalue=(?:""|\{\s*(?:''|"")\s*\})/;

describe('no Radix SelectItem with an empty-string value', () => {
  it('every .tsx is clean', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, 'utf8');
      if (EMPTY_SELECTITEM.test(src)) offenders.push(file.replace(ROOT, 'client/src'));
    }
    expect(offenders, `Radix <SelectItem value=""> crashes the page. Use a sentinel like "all". Offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
