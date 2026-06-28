/**
 * THE REFEREE (money domain) — checks the live codebase against THE MONEY
 * RULEBOOK (shared/money/moneyRulebook.ts). Reuses the single-sourced runner
 * from authConformance so every domain's gate behaves identically.
 */
import { runChecks, buildReport, type ConformanceReport } from './authConformance';
import { MONEY_RULEBOOK } from '@shared/money/moneyRulebook';
import type { RuleCheck } from '@shared/auth/authRulebook';

export function runMoneyConformance(root: string = process.cwd()): ConformanceReport {
  const checks: RuleCheck[] = MONEY_RULEBOOK.rules.flatMap((r) => r.checks);
  return buildReport(MONEY_RULEBOOK.domain, MONEY_RULEBOOK.version, runChecks(checks, root));
}
