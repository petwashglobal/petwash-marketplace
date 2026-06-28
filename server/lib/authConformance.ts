/**
 * THE REFEREE — checks the LIVE codebase against THE AUTH RULEBOOK
 * (shared/auth/authRulebook.ts) and reports every place reality has drifted
 * from the declared truth.
 *
 * Deterministic and fact-based (it reads real source files) — so it can be a
 * hard CI gate (server/tests/authConformance.regression.test.ts) AND power a
 * read-only admin "is auth still correct?" probe. An AI layer may LATER narrate
 * these findings, but the gate itself is deterministic — per the house rule that
 * AI advises, it never silently decides auth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AUTH_RULEBOOK, type RuleCheck } from '@shared/auth/authRulebook';

export interface ConformanceFinding {
  id: string;
  says: string;
  file: string;
  status: 'pass' | 'fail';
  problems: string[];
}

export interface ConformanceReport {
  ok: boolean;
  domain: string;
  version: string;
  total: number;
  passed: number;
  failed: number;
  findings: ConformanceFinding[];
  generatedAt: string;
}

function runCheck(check: RuleCheck, root: string): ConformanceFinding {
  const base: Omit<ConformanceFinding, 'status' | 'problems'> = {
    id: check.id, says: check.says, file: check.file,
  };
  let src: string;
  try {
    src = fs.readFileSync(path.resolve(root, check.file), 'utf8');
  } catch {
    return { ...base, status: 'fail', problems: [`file not found: ${check.file}`] };
  }
  const problems: string[] = [];
  for (const s of check.mustContain ?? []) {
    if (!src.includes(s)) problems.push(`expected but missing → ${s}`);
  }
  for (const s of check.mustNotContain ?? []) {
    if (src.includes(s)) problems.push(`forbidden but present → ${s}`);
  }
  return { ...base, status: problems.length ? 'fail' : 'pass', problems };
}

/** Generic: run a flat list of checks against the working tree. Reused by every
 *  domain Referee (auth, money, …) so the runner itself is single-sourced. */
export function runChecks(checks: RuleCheck[], root: string = process.cwd()): ConformanceFinding[] {
  return checks.map((c) => runCheck(c, root));
}

/** Generic: wrap findings + domain meta into a report. */
export function buildReport(domain: string, version: string, findings: ConformanceFinding[]): ConformanceReport {
  const failed = findings.filter((f) => f.status === 'fail').length;
  return {
    ok: failed === 0,
    domain,
    version,
    total: findings.length,
    passed: findings.length - failed,
    failed,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

/** Run every auth Rulebook check against the working tree. `root` defaults to cwd. */
export function runAuthConformance(root: string = process.cwd()): ConformanceReport {
  const checks: RuleCheck[] = [];
  for (const ch of AUTH_RULEBOOK.channels) checks.push(...ch.checks);
  for (const r of AUTH_RULEBOOK.roles) checks.push(...(r.checks ?? []));
  return buildReport(AUTH_RULEBOOK.domain, AUTH_RULEBOOK.version, runChecks(checks, root));
}

/** Pretty one-line-per-check report for logs / CLI / the CI gate message. */
export function formatConformanceReport(report: ConformanceReport): string {
  const lines = [
    `AUTH RULEBOOK conformance — ${report.domain} v${report.version}`,
    `${report.ok ? '✅ IN CONFORMANCE' : '🔴 DRIFT DETECTED'}  (${report.passed}/${report.total} passed)`,
    '',
  ];
  for (const f of report.findings) {
    lines.push(`${f.status === 'pass' ? '✓' : '✗'} [${f.id}] ${f.says}`);
    for (const p of f.problems) lines.push(`      ↳ ${p}  (${f.file})`);
  }
  return lines.join('\n');
}
