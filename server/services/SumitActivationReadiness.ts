import type { SumitMode } from './SumitPreflightCheck';

export type SumitReadinessSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type SumitReadinessOwner =
  | 'NIR'
  | 'ACCOUNTANT'
  | 'FINANCE'
  | 'ENGINEERING'
  | 'SUMIT'
  | 'LEGAL';

export interface SumitReadinessEnv {
  sumitApiKey: boolean;
  sumitCompanyId: boolean;
  sumitWebhookSecret: boolean;
  accountantEmail: boolean;
  sendgridApiKey: boolean;
}

export interface SumitReadinessBlocker {
  code: string;
  severity: SumitReadinessSeverity;
  owner: SumitReadinessOwner;
  message: string;
  nextAction: string;
}

export interface SumitActivationReadinessInput {
  mode: SumitMode;
  parentFlag: boolean;
  sendFlag: boolean;
  env: SumitReadinessEnv;
  wired: boolean;
  wiredReason?: string | null;
  osekBuckets?: Record<string, number>;
  queue?: Record<string, number>;
  invoiceCounts?: Record<string, number>;
}

export interface SumitActivationReadiness {
  phase:
    | 'PHASE_0_GET_FACTS'
    | 'PHASE_1_CLASSIFY_SUPPLIERS'
    | 'PHASE_2_BIND_SECRETS'
    | 'PHASE_3_FIX_CLIENT_AND_SIMULATOR'
    | 'PHASE_4_DRY_RUN_REVIEW'
    | 'PHASE_5_CANARY_READY'
    | 'PHASE_6_FULL_ON_READY';
  canaryReady: boolean;
  fullLiveReady: boolean;
  apiEnvReady: boolean;
  unknownOsekCount: number;
  failedInvoiceCount: number;
  failedJobCount: number;
  pendingJobCount: number;
  approvalRequired: {
    nir: boolean;
    accountant: boolean;
    finance: boolean;
    engineering: boolean;
    legal: boolean;
  };
  blockers: SumitReadinessBlocker[];
}

const OSEK_UNKNOWN_BUCKETS = ['unknown', 'osek_unknown', ''];
const FAILED_JOB_BUCKETS = ['FAILED', 'failed', 'ERROR', 'error'];
const PENDING_JOB_BUCKETS = ['PENDING', 'pending', 'PROCESSING', 'processing', 'RETRY', 'retry'];

function countBuckets(source: Record<string, number> | undefined, bucketNames: string[]): number {
  if (!source) return 0;
  return bucketNames.reduce((sum, key) => sum + Number(source[key] ?? 0), 0);
}

function apiEnvReady(env: SumitReadinessEnv): boolean {
  return env.sumitApiKey && env.sumitCompanyId && env.sumitWebhookSecret;
}

function addBlocker(
  blockers: SumitReadinessBlocker[],
  blocker: SumitReadinessBlocker,
): void {
  blockers.push(blocker);
}

export function buildSumitActivationReadiness(
  input: SumitActivationReadinessInput,
): SumitActivationReadiness {
  const blockers: SumitReadinessBlocker[] = [];
  const apiReady = apiEnvReady(input.env);
  const unknownOsekCount = countBuckets(input.osekBuckets, OSEK_UNKNOWN_BUCKETS);
  const failedInvoiceCount = Number(input.invoiceCounts?.failed ?? 0);
  const failedJobCount = countBuckets(input.queue, FAILED_JOB_BUCKETS);
  const pendingJobCount = countBuckets(input.queue, PENDING_JOB_BUCKETS);

  if (!input.parentFlag) {
    addBlocker(blockers, {
      code: 'SUMIT_PARENT_FLAG_OFF',
      severity: 'BLOCKED',
      owner: 'ENGINEERING',
      message: 'SUMIT control panel parent feature flag is off.',
      nextAction: 'Enable ff.supplier_invoice_control.enabled only after Nir approves SUMIT readiness review.',
    });
  }

  if (unknownOsekCount > 0) {
    addBlocker(blockers, {
      code: 'SUMIT_UNKNOWN_OSEK_CLASSIFICATION',
      severity: 'HIGH',
      owner: 'FINANCE',
      message: `${unknownOsekCount} suppliers/providers are still missing Israeli osek classification.`,
      nextAction: 'Classify every supplier/provider as patur, murshe, or chevra with evidence before live SUMIT sync.',
    });
  }

  if (!apiReady) {
    addBlocker(blockers, {
      code: 'SUMIT_API_SECRETS_MISSING',
      severity: 'BLOCKED',
      owner: 'ENGINEERING',
      message: 'SUMIT API mode is missing one or more required server-side secrets.',
      nextAction: 'Bind SUMIT_API_KEY, SUMIT_COMPANY_ID, and SUMIT_WEBHOOK_SECRET through Secret Manager only.',
    });
  }

  if (input.mode !== 'api') {
    addBlocker(blockers, {
      code: 'SUMIT_MODE_NOT_API',
      severity: 'HIGH',
      owner: 'NIR',
      message: `SUMIT activation mode is ${input.mode}; real API posting is not enabled.`,
      nextAction: 'Keep dry-run until accountant/Nir approve one controlled canary, then switch sumit.mode to api.',
    });
  }

  if (!input.sendFlag) {
    addBlocker(blockers, {
      code: 'SUMIT_SEND_FLAG_OFF',
      severity: 'HIGH',
      owner: 'NIR',
      message: 'The explicit SUMIT send feature flag is off.',
      nextAction: 'Turn on ff.supplier_invoice_control.sumit_send.enabled only for the approved canary window.',
    });
  }

  if (!input.wired) {
    addBlocker(blockers, {
      code: 'SUMIT_CLIENT_NOT_WIRED',
      severity: 'BLOCKED',
      owner: 'ENGINEERING',
      message: input.wiredReason || 'SUMIT client reports it is not wired for real posting.',
      nextAction: 'Run focused SUMIT tests and local simulator/mock before any production canary.',
    });
  }

  if (failedInvoiceCount > 0) {
    addBlocker(blockers, {
      code: 'SUMIT_FAILED_INVOICES_OPEN',
      severity: 'HIGH',
      owner: 'ACCOUNTANT',
      message: `${failedInvoiceCount} supplier invoice SUMIT sends are marked failed.`,
      nextAction: 'Resolve failed documents with accountant/SUMIT before full live mode.',
    });
  }

  if (failedJobCount > 0) {
    addBlocker(blockers, {
      code: 'SUMIT_FAILED_JOBS_OPEN',
      severity: 'HIGH',
      owner: 'ENGINEERING',
      message: `${failedJobCount} SUMIT async jobs are failed.`,
      nextAction: 'Inspect failed SUMIT jobs and audit events before canary/full live mode.',
    });
  }

  const canaryBlockerCodes = new Set([
    'SUMIT_PARENT_FLAG_OFF',
    'SUMIT_UNKNOWN_OSEK_CLASSIFICATION',
    'SUMIT_API_SECRETS_MISSING',
    'SUMIT_MODE_NOT_API',
    'SUMIT_SEND_FLAG_OFF',
    'SUMIT_CLIENT_NOT_WIRED',
    'SUMIT_FAILED_JOBS_OPEN',
  ]);
  const canaryReady = blockers.every((b) => !canaryBlockerCodes.has(b.code));
  const fullLiveReady = canaryReady && failedInvoiceCount === 0 && pendingJobCount === 0;

  let phase: SumitActivationReadiness['phase'] = 'PHASE_0_GET_FACTS';
  if (!input.parentFlag) {
    phase = 'PHASE_0_GET_FACTS';
  } else if (unknownOsekCount > 0) {
    phase = 'PHASE_1_CLASSIFY_SUPPLIERS';
  } else if (!apiReady) {
    phase = 'PHASE_2_BIND_SECRETS';
  } else if (!input.wired) {
    phase = 'PHASE_3_FIX_CLIENT_AND_SIMULATOR';
  } else if (input.mode !== 'api' || !input.sendFlag) {
    phase = 'PHASE_4_DRY_RUN_REVIEW';
  } else if (fullLiveReady) {
    phase = 'PHASE_6_FULL_ON_READY';
  } else {
    phase = 'PHASE_5_CANARY_READY';
  }

  return {
    phase,
    canaryReady,
    fullLiveReady,
    apiEnvReady: apiReady,
    unknownOsekCount,
    failedInvoiceCount,
    failedJobCount,
    pendingJobCount,
    approvalRequired: {
      nir: blockers.some((b) => b.owner === 'NIR'),
      accountant: blockers.some((b) => b.owner === 'ACCOUNTANT'),
      finance: blockers.some((b) => b.owner === 'FINANCE'),
      engineering: blockers.some((b) => b.owner === 'ENGINEERING' || b.owner === 'SUMIT'),
      legal: blockers.some((b) => b.owner === 'LEGAL'),
    },
    blockers,
  };
}
