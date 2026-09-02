/**
 * Regression pin — incident postmortem generator prompt budget
 * (AUDIT-AI-12 / #207).
 *
 * POST /admin/system/incidents/:id/postmortem previously:
 *   1. serialised the ENTIRE incident_timeline_entries table for the
 *      incident into the Gemini prompt — for a long-running P1 with
 *      thousands of entries, that's an unbounded per-call token cost;
 *   2. serialised every self_healing_execution row for the incident's
 *      anomaly window into the prompt with no cap;
 *   3. called generateContent without maxOutputTokens.
 *
 * Fix (this slice):
 *   - Timeline is fetched as HEAD + TAIL windows (bounded), with the
 *     total row count reported and a truncation marker rendered
 *     between them so the reader sees what was cut.
 *   - Self-healing rows are top-N by anomaly_score (bounded), rendered
 *     with an explicit "(top N by anomaly score)" caption.
 *   - Gemini call carries a maxOutputTokens cap.
 *
 * This pin refuses regression on all three by walking the source.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'server/routes/prestige-pass.ts'), 'utf8');

describe('AUDIT-AI-12 / #207 — incident postmortem generator', () => {
  it('handler declares TIMELINE_HEAD, TIMELINE_TAIL, TIMELINE_TOTAL_CAP caps', () => {
    expect(src).toMatch(/const TIMELINE_HEAD\s*=\s*\d+/);
    expect(src).toMatch(/const TIMELINE_TAIL\s*=\s*\d+/);
    expect(src).toMatch(/const TIMELINE_TOTAL_CAP\s*=\s*TIMELINE_HEAD\s*\+\s*TIMELINE_TAIL/);
  });

  it('handler fetches HEAD + TAIL windows instead of the whole timeline when over cap', () => {
    expect(src).toMatch(/incident_timeline_entries WHERE incident_id = \$1\s+ORDER BY occurred_at ASC LIMIT \$2/);
    expect(src).toMatch(/incident_timeline_entries WHERE incident_id = \$1\s+ORDER BY occurred_at DESC LIMIT \$2/);
  });

  it('handler renders a truncation marker between head and tail', () => {
    expect(src).toMatch(/intermediate entries omitted from prompt/);
  });

  it('self-healing query is bounded by SH_CAP with anomaly-score priority', () => {
    expect(src).toMatch(/const SH_CAP\s*=\s*\d+/);
    expect(src).toMatch(/ORDER BY e\.anomaly_score DESC NULLS LAST[\s\S]{0,80}LIMIT \$2/);
  });

  it('Gemini generateContent call caps maxOutputTokens', () => {
    // Match the postmortem call site by anchoring on its unique prompt fragment.
    expect(src).toMatch(/incident postmortem[\s\S]{0,4000}?generateContent\(\{[\s\S]{0,600}?maxOutputTokens:\s*\d+/);
  });
});
