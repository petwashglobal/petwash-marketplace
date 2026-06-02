/**
 * PetWash Operating-Control Bypass Scanner
 *
 * Dry-run guard for finding legacy high-risk money/compliance paths that may
 * bypass the fail-closed operating-control gateway. It does not delete files,
 * mutate data, call SUMIT, connect banks, or create payments.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export type BypassRiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface BypassRiskRule {
  id: string;
  severity: BypassRiskSeverity;
  description: string;
  pattern: RegExp;
  requiredControl: string;
}

export interface BypassRiskFinding {
  ruleId: string;
  severity: BypassRiskSeverity;
  file: string;
  line: number;
  evidence: string;
  description: string;
  requiredControl: string;
  gatewayMentionedInFile: boolean;
}

export interface BypassScanSummary {
  scannedFiles: number;
  findings: BypassRiskFinding[];
  totals: Record<BypassRiskSeverity, number>;
}

const PROJECT_ROOT = process.cwd();
const DEFAULT_SCAN_ROOTS = ['server/routes', 'server/services'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const GATEWAY_MARKERS = [
  'assertOperatingControl',
  'evaluateOperatingControlGate',
  'PETWASH_OPERATING_CONTROL_BLOCKED',
  'petwashOperatingControlGateway',
];

export const BYPASS_RISK_RULES: BypassRiskRule[] = [
  {
    id: 'DIRECT_PROVIDER_ACTIVE',
    severity: 'CRITICAL',
    description: 'Direct provider activation/status mutation found.',
    pattern: /\b(SET|set\(|\.set\(|\.update\()[\w\s.`"'(),:-]{0,180}\b(provider_status|status)\s*[:=]\s*['"`]active['"`]/i,
    requiredControl: 'Route through PROVIDER_ACTIVATION operating-control gate before any ACTIVE status.',
  },
  {
    id: 'DIRECT_PAYMENT_PAID',
    severity: 'CRITICAL',
    description: 'Direct paid/payment status mutation found.',
    pattern: /\b(SET|set\(|\.set\(|\.update\()[\w\s.`"'(),:-]{0,180}\b(status|payment_status|payout_status)\s*[:=]\s*['"`](paid|paid_out|completed)['"`]/i,
    requiredControl: 'Route through PROVIDER_PAYOUT, SUPPLIER_PAYMENT, CUSTOMER_REFUND, or BANK_MATCH_CLOSE gate.',
  },
  {
    id: 'DIRECT_APPROVAL_STATUS',
    severity: 'HIGH',
    description: 'Direct approved status mutation found.',
    pattern: /\b(SET|set\(|\.set\(|\.update\()[\w\s.`"'(),:-]{0,180}\b(status|review_status|approval_status)\s*[:=]\s*['"`]approved['"`]/i,
    requiredControl: 'Require operating-control approval facts and no self-approval before status becomes approved.',
  },
  {
    id: 'DIRECT_WALLET_BALANCE_MUTATION',
    severity: 'CRITICAL',
    description: 'Direct wallet balance mutation found.',
    pattern: /\b(INSERT\s+INTO|UPDATE|SET|set\(|\.set\(|\.update\()[\w\s.`"'(),+-]{0,220}\b(wallet|wallet_accounts|wallets)[\w\s.`"'(),+-]{0,220}\b(balance|balance_cents|cash_wallet_balance_cents|promo_balance_cents|egift_balance_cents)\b/i,
    requiredControl: 'Route wallet credit create/redeem/expire through the wallet credit operating-control gates.',
  },
  {
    id: 'DIRECT_SUMIT_SEND',
    severity: 'CRITICAL',
    description: 'Direct SUMIT send/posting path found.',
    pattern: /\b(sumit|Sumit)[\w.()'"` -]{0,120}\b(send|createDocument|sync|post|dispatch)\b/i,
    requiredControl: 'Route official documents through SUMIT_OFFICIAL_POSTING with idempotency and accountant status.',
  },
  {
    id: 'DIRECT_BANK_MATCH_CLOSE',
    severity: 'HIGH',
    description: 'Direct bank reconciliation/match close path found.',
    pattern: /\b(SET|set\(|\.set\(|\.update\()[\w\s.`"'(),:-]{0,180}\b(status|reconciliationStatus|reconciliation_status)\s*[:=]\s*['"`](matched|closed)['"`]/i,
    requiredControl: 'Route final bank match/close through BANK_MATCH_CLOSE operating-control gate.',
  },
  {
    id: 'DIRECT_REFUND_APPROVAL',
    severity: 'CRITICAL',
    description: 'Direct refund approval/execution path found.',
    pattern: /\b(SET|set\(|\.set\(|\.update\()[\w\s.`"'(),:-]{0,180}\b(status|approval_status)\s*[:=]\s*['"`]approved['"`][\w\s.`"'(),:-]{0,180}\b(refund|chargeback|credit_note)|\b(refund|chargeback|credit_note)[\w\s.`"'(),:-]{0,180}\b(SET|set\(|\.set\(|\.update\()[\w\s.`"'(),:-]{0,180}\b(status|approval_status)\s*[:=]\s*['"`]approved['"`]/i,
    requiredControl: 'Route refunds through CUSTOMER_REFUND with evidence, thresholds, and SUMIT credit-note check.',
  },
  {
    id: 'DEMO_OR_FAKE_PRODUCTION_PATH',
    severity: 'MEDIUM',
    description: 'Demo/fake/sample marker in server production path.',
    pattern: /\b(fake|demo|sample|mock)\b/i,
    requiredControl: 'Move demo-only logic to tests/scripts or explicitly fail closed in production.',
  },
];

function shouldIgnorePath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  return (
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.test.tsx') ||
    normalized.endsWith('.spec.ts') ||
    normalized.endsWith('.spec.tsx') ||
    normalized.includes('/mocks/') ||
    normalized.includes('/fixtures/')
  );
}

function collectFiles(root: string, out: string[]): void {
  if (!fs.existsSync(root)) return;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      collectFiles(absolute, out);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    const relative = path.relative(PROJECT_ROOT, absolute);
    if (shouldIgnorePath(relative)) continue;
    out.push(absolute);
  }
}

function gatewayMentioned(content: string): boolean {
  return GATEWAY_MARKERS.some((marker) => content.includes(marker));
}

export function scanContentForBypassRisks(
  content: string,
  file: string,
  rules: BypassRiskRule[] = BYPASS_RISK_RULES,
): BypassRiskFinding[] {
  const findings: BypassRiskFinding[] = [];
  const hasGateway = gatewayMentioned(content);
  const lines = content.split(/\r?\n/);

  lines.forEach((lineText, index) => {
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(trimmed)) continue;
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        file,
        line: index + 1,
        evidence: trimmed.slice(0, 220),
        description: rule.description,
        requiredControl: rule.requiredControl,
        gatewayMentionedInFile: hasGateway,
      });
    }
  });

  return findings;
}

export function scanProjectForBypassRisks(scanRoots = DEFAULT_SCAN_ROOTS): BypassScanSummary {
  const files: string[] = [];
  for (const root of scanRoots) collectFiles(path.join(PROJECT_ROOT, root), files);

  const findings = files.flatMap((absolute) => {
    const relative = path.relative(PROJECT_ROOT, absolute);
    const content = fs.readFileSync(absolute, 'utf8');
    return scanContentForBypassRisks(content, relative);
  });

  return {
    scannedFiles: files.length,
    findings,
    totals: {
      CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
      HIGH: findings.filter((f) => f.severity === 'HIGH').length,
      MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
    },
  };
}

function printSummary(summary: BypassScanSummary): void {
  console.log('PetWash operating-control bypass scanner');
  console.log(`Scanned files: ${summary.scannedFiles}`);
  console.log(`Findings: ${summary.findings.length}`);
  console.log(`Critical: ${summary.totals.CRITICAL}`);
  console.log(`High: ${summary.totals.HIGH}`);
  console.log(`Medium: ${summary.totals.MEDIUM}`);
  console.log('');

  for (const finding of summary.findings.slice(0, 80)) {
    const guarded = finding.gatewayMentionedInFile ? 'gateway marker present' : 'NO gateway marker in file';
    console.log(`[${finding.severity}] ${finding.ruleId} ${finding.file}:${finding.line} (${guarded})`);
    console.log(`  ${finding.description}`);
    console.log(`  Evidence: ${finding.evidence}`);
    console.log(`  Required: ${finding.requiredControl}`);
    console.log('');
  }

  if (summary.findings.length > 80) {
    console.log(`... ${summary.findings.length - 80} more finding(s) omitted from console output.`);
  }
}

async function main(): Promise<void> {
  const summary = scanProjectForBypassRisks();
  printSummary(summary);
  if (process.argv.includes('--fail-on-critical') && summary.totals.CRITICAL > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Operating-control bypass scanner failed:', error);
    process.exit(1);
  });
}
