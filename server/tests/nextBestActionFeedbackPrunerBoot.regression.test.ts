/**
 * Boot wire pin — the NextBestActionFeedback pruner cron MUST be
 * started alongside the JourneyCheckpoints pruner in server/index.ts.
 *
 * A cron that isn't started never runs. This pin catches a silent
 * removal in a refactor.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('NextBestActionFeedback pruner · boot wire', () => {
  const bootSrc = read('server/index.ts');
  const cronSrc = read('server/cron/next-best-action-feedback-prune.ts');

  it('server/index.ts imports startNextBestActionFeedbackPrunerCron', () => {
    expect(bootSrc).toMatch(
      /import\(\s*['"]\.\/cron\/next-best-action-feedback-prune['"]\s*\)/,
    );
  });

  it('server/index.ts CALLS startNextBestActionFeedbackPrunerCron()', () => {
    expect(bootSrc).toMatch(/startNextBestActionFeedbackPrunerCron\(\s*\)/);
  });

  it('cron file exports startNextBestActionFeedbackPrunerCron', () => {
    expect(cronSrc).toMatch(/export function startNextBestActionFeedbackPrunerCron/);
  });

  it('cron file honours NBA_FEEDBACK_PRUNER_DISABLED=true kill switch', () => {
    expect(cronSrc).toMatch(/NBA_FEEDBACK_PRUNER_DISABLED\s*=\s*=\s*=?\s*['"]true['"]|NBA_FEEDBACK_PRUNER_DISABLED\s*===\s*['"]true['"]/);
  });

  it('cron file uses .unref() so the timer never keeps the event loop alive', () => {
    expect(cronSrc).toMatch(/timer\.unref\(\s*\)/);
  });

  it('cron file calls pruneOldFeedback from the service', () => {
    expect(cronSrc).toMatch(
      /import\s*\{\s*pruneOldFeedback\s*\}\s*from\s*['"]\.\.\/services\/nextBestActionFeedback['"]/,
    );
    expect(cronSrc).toMatch(/pruneOldFeedback\(pool/);
  });
});
