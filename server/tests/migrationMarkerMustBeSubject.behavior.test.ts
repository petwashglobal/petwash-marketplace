/**
 * THE MIGRATION OPT-IN WAS TRIPPABLE BY WRITING ABOUT IT (2026-09-17).
 *
 * The deploy job applies migrations to the production database when the head
 * commit "carries the marker" `[apply-pending-migrations]`. It tested that with
 * `contains(github.event.head_commit.message, ...)`, and head_commit.message is
 * the WHOLE message — subject and body.
 *
 * So PR #2512, whose body said, in plain words:
 *     "NOT tagged [apply-pending-migrations]: 0161 rewrites customer
 *      entitlement rows, so it applies only when someone deliberately runs it"
 * opted itself in and applied 0161 to production on merge. The sentence
 * explaining that the commit was not opting in WAS the opt-in.
 *
 * A safeguard you can trip by describing it is not a safeguard. The job now
 * re-reads the SUBJECT LINE alone and fails closed when the marker is only
 * prose.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const WORKFLOW = readFileSync(join(__dirname, '../../.github/workflows/petwash-ci.yml'), 'utf8');

/**
 * The guard's own logic, run through a real shell — it decides `optin`, which
 * every database-touching step is gated on.
 */
function guardAccepts(subject: string): boolean {
  const script = `
    case "$1" in
      *"[apply-pending-migrations]"*) echo true ;;
      *) echo false ;;
    esac`;
  return execFileSync('/bin/sh', ['-c', script, 'guard', subject], { encoding: 'utf8' }).trim() === 'true';
}

describe('what the guard lets through', () => {
  it('accepts a real opt-in: the marker in the subject', () => {
    expect(guardAccepts('feat(community): edit your listing (#2504) [apply-pending-migrations]')).toBe(true);
  });

  it('REFUSES the exact subject that applied 0161 by accident', () => {
    // #2512's subject. The marker lived only in the body.
    expect(guardAccepts('fix(money): a paid gift card died four years before our Terms said it could (#2512)')).toBe(false);
  });

  it('refuses an ordinary commit', () => {
    expect(guardAccepts('fix(auth): passkey prompt was off screen')).toBe(false);
  });
});

describe('the guard is wired into the job, before anything touches the database', () => {
  const job = WORKFLOW.slice(WORKFLOW.indexOf('  apply-migrations:'), WORKFLOW.indexOf('  deploy-backend:'));

  it('reads the SUBJECT line only', () => {
    expect(job).toContain('Confirm the migration opt-in is real, not prose');
    expect(job).toContain('git log -1 --pretty=%s');
  });

  it('EVERY step that reaches credentials or the database is gated on the opt-in', () => {
    for (const step of [
      'Setup Node', 'Install deps', 'Authenticate to Google Cloud',
      'Set up gcloud CLI', 'Fetch DATABASE_URL from Secret Manager',
      'Apply pending SQL migrations',
    ]) {
      const i = job.indexOf(`- name: ${step}`);
      expect(i, `${step} must exist in the job`).toBeGreaterThan(0);
      expect(job.slice(i, i + 200), `${step} must be gated on the opt-in`)
        .toContain("if: steps.optin.outputs.optin == 'true'");
    }
  });

  it('a wrong opt-in SKIPS — it must not fail, because a failed job blocks the deploy', () => {
    const start = job.indexOf('Confirm the migration opt-in is real, not prose');
    const guardBlock = job.slice(start, job.indexOf('- name: Setup Node', start));
    expect(guardBlock).toContain("optin=false");
    expect(guardBlock).not.toContain('exit 1');
  });

  it('a manual run (workflow_dispatch) is already deliberate and opts in', () => {
    const start = job.indexOf('Confirm the migration opt-in is real, not prose');
    const guardBlock = job.slice(start, job.indexOf('- name: Setup Node', start));
    expect(guardBlock).toContain("workflow_dispatch");
    expect(guardBlock).toContain('optin=true');
  });
});
