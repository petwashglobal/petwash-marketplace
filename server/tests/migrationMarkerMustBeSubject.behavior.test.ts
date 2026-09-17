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

/** The guard's own logic, run as the shell actually runs it. */
function guardAccepts(subject: string): boolean {
  const script = `
    case "$1" in
      *"[apply-pending-migrations]"*) exit 0 ;;
      *) exit 1 ;;
    esac`;
  try {
    execFileSync('/bin/sh', ['-c', script, 'guard', subject], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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
  const job = WORKFLOW.slice(WORKFLOW.indexOf('Apply pending SQL migrations'));

  it('runs on push, reads the SUBJECT only, and exits non-zero otherwise', () => {
    expect(job).toContain('Confirm the migration opt-in is real, not prose');
    expect(job).toContain('git log -1 --pretty=%s');
    expect(job).toContain('exit 1');
  });

  it('stands BEFORE the credentials, the secret fetch and the apply step', () => {
    const guard = job.indexOf('Confirm the migration opt-in is real, not prose');
    const auth = job.indexOf('Authenticate to Google Cloud');
    const secret = job.indexOf('Fetch DATABASE_URL from Secret Manager');
    const apply = job.indexOf('npx tsx scripts/apply-pending-migrations.ts');
    expect(guard).toBeGreaterThan(0);
    expect(auth).toBeGreaterThan(guard);
    expect(secret).toBeGreaterThan(guard);
    expect(apply).toBeGreaterThan(guard);
  });

  it('a manual run (workflow_dispatch) is already deliberate and is not blocked', () => {
    const start = job.indexOf('Confirm the migration opt-in is real, not prose');
    // The step's own `if:` is the line straight after its name.
    const guardBlock = job.slice(start, job.indexOf('- name: Setup Node', start));
    expect(guardBlock).toContain("if: github.event_name == 'push'");
  });
});
