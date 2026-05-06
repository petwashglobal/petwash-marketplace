/** PR-W34u — admin tooling audit (octopus-brain + israeli-cpi + spam-guard). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const octopus = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'octopus-brain.ts'), 'utf8');
const cpi = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'israeli-cpi.ts'), 'utf8');
const spam = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'spam-guard.ts'), 'utf8');

describe('PR-W34u — admin tooling audit', () => {
  it('octopus-brain emits 3 actions', () => {
    expect(octopus).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    for (const a of ['OCTOPUS_ALERT_RESOLVE', 'OCTOPUS_MANUAL_ANALYZE', 'OCTOPUS_PLATFORM_CERTIFY']) {
      expect(octopus).toMatch(new RegExp(`actionType:\\s*['"]${a}['"]`));
    }
  });
  it('octopus-brain certify logs stampPrefix only (not full stamp)', () => {
    const idx = octopus.indexOf('OCTOPUS_PLATFORM_CERTIFY');
    const block = octopus.slice(idx, idx + 700);
    expect(block).toMatch(/stampPrefix:/);
  });
  it('israeli-cpi emits 2 actions', () => {
    expect(cpi).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    for (const a of ['CPI_INDEX_ADD', 'CPI_SEED']) {
      expect(cpi).toMatch(new RegExp(`actionType:\\s*['"]${a}['"]`));
    }
  });
  it('spam-guard emits 3 actions', () => {
    expect(spam).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    for (const a of ['SPAMGUARD_MANUAL_SWEEP', 'SPAMGUARD_ANALYZE', 'SPAMGUARD_DETECTION_RESOLVE']) {
      expect(spam).toMatch(new RegExp(`actionType:\\s*['"]${a}['"]`));
    }
  });
  it('spam-guard analyze logs contentLength only (no raw content)', () => {
    const idx = spam.indexOf('SPAMGUARD_ANALYZE');
    const block = spam.slice(idx, idx + 700);
    expect(block).toMatch(/contentLength:/);
    expect(block).not.toMatch(/\bcontent:\s*content\b/);
  });
});
