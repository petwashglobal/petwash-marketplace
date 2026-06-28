/**
 * THE REFEREE (address domain) — checks the live code against THE ADDRESS
 * RULEBOOK. Same single-sourced runner as auth/money. Its job: keep address
 * capture on the FREE OSM provider and tied to the user — fail the build if
 * paid Google Places sneaks back into the shared component.
 */
import { runChecks, buildReport, type ConformanceReport } from './authConformance';
import { ADDRESS_RULEBOOK } from '@shared/address/addressRulebook';
import type { RuleCheck } from '@shared/auth/authRulebook';

export function runAddressConformance(root: string = process.cwd()): ConformanceReport {
  const checks: RuleCheck[] = ADDRESS_RULEBOOK.rules.flatMap((r) => r.checks);
  return buildReport(ADDRESS_RULEBOOK.domain, ADDRESS_RULEBOOK.version, runChecks(checks, root));
}
