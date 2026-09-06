/**
 * The frontend deploy job must actually run.
 *
 * FOUND 2026-09-06. `deploy-frontend` had `needs: deploy-backend` and no
 * explicit `if`, so GitHub defaulted it to success(). A SKIPPED job anywhere
 * in the transitive needs graph skips every downstream job using that default
 * — and `apply-migrations` skips on any deploy that is not a
 * workflow_dispatch or a [migrate] commit, which is almost all of them.
 *
 * So the backend shipped on every merge and the CLIENT NEVER DID. Production
 * served a months-old bundle while every deploy reported green, because the
 * job said "skipped" — which reads as "not needed", not "broken".
 *
 * Two real fixes were sitting merged and undelivered when this was found: the
 * signup `ageConfirmed` crash, and the Turnstile site key. Both were verified
 * present in main and absent from the browser.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

const ROOT = join(__dirname, '..', '..');
const WF_DIR = join(ROOT, '.github/workflows');
const CI = load(readFileSync(join(WF_DIR, 'petwash-ci.yml'), 'utf8')) as any;

const asArray = (v: unknown) => (v == null ? [] : Array.isArray(v) ? v : [v]);

describe('deploy-frontend is not silently skippable', () => {
  const job = CI.jobs['deploy-frontend'];

  it('exists and depends on the backend', () => {
    expect(job).toBeTruthy();
    expect(asArray(job.needs)).toContain('deploy-backend');
  });

  it('has an EXPLICIT if — the default success() is what broke it', () => {
    expect(job.if, 'no `if` means a skipped upstream silently skips this job').toBeTruthy();
  });

  it('tolerates a skipped upstream the way deploy-backend does', () => {
    const cond = String(job.if);
    expect(cond).toContain('always()');
    expect(cond).toContain('!cancelled()');
    // …but still refuses to ship a frontend on top of a failed backend.
    expect(cond).toMatch(/needs\.deploy-backend\.result == 'success'/);
  });

  it('does NOT deploy when the backend failed', () => {
    // always() without a result check would ship the client against a backend
    // that never came up — the opposite mistake.
    expect(String(job.if)).not.toMatch(/always\(\)\s*\}\}/);
  });
});

describe('no OTHER job in any workflow can silently skip', () => {
  /**
   * The generalisation. Any job with no `if` whose transitive needs include a
   * job that CAN skip will quietly stop running the first time that upstream
   * does not fire — and report "skipped", so nobody notices.
   */
  function silentlySkippable(wf: any): string[] {
    const jobs = wf?.jobs;
    if (!jobs || typeof jobs !== 'object') return [];
    const conditional = new Set(
      Object.entries(jobs).filter(([, j]: any) => j && j.if !== undefined).map(([k]) => k),
    );
    const closure = (name: string, seen = new Set<string>()): Set<string> => {
      for (const dep of asArray(jobs[name]?.needs)) {
        if (seen.has(dep as string)) continue;
        seen.add(dep as string);
        closure(dep as string, seen);
      }
      return seen;
    };
    const out: string[] = [];
    for (const [name, j] of Object.entries<any>(jobs)) {
      if (!j || j.if !== undefined) continue;
      const risky = [...closure(name)].filter((d) => conditional.has(d));
      if (risky.length) out.push(`${name} (upstream can skip: ${risky.join(', ')})`);
    }
    return out;
  }

  const files = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f));

  it('scans every workflow file', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it('finds none', () => {
    const offenders: string[] = [];
    for (const f of files) {
      let wf: any;
      try { wf = load(readFileSync(join(WF_DIR, f), 'utf8')); } catch { continue; }
      for (const o of silentlySkippable(wf)) offenders.push(`${f} :: ${o}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('the guard runs in CI', () => {
  it('uses a runtime the self-lint job actually has', () => {
    /**
     * The first version was Node + js-yaml and failed on its very first CI run:
     * gate-workflow-self-lint only checks out the repo — no npm ci, no
     * node_modules. Its sibling steps already use python3 + pyyaml, which is
     * on the runner. A guard that cannot execute is not a guard.
     */
    const job = CI.jobs['gate-workflow-self-lint'];
    const installs = job.steps.some((s: any) =>
      String(s.run ?? '').includes('npm ci') || String(s.uses ?? '').includes('setup-node'));
    const guard = job.steps.find((s: any) =>
      String(s.run ?? '').includes('workflow_silent_skip_scan'));
    expect(guard, 'guard step missing').toBeTruthy();
    if (!installs) {
      expect(String(guard.run), 'job installs nothing, so the guard must not need node_modules')
        .toContain('python3');
    }
  });

  it('the self-lint gate invokes the scanner with --fail', () => {
    const steps = CI.jobs['gate-workflow-self-lint'].steps.map((s: any) => String(s.run ?? ''));
    expect(steps.some((r: string) => r.includes('workflow_silent_skip_scan.py --fail'))).toBe(true);
  });
});
