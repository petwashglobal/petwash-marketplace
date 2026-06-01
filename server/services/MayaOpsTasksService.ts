/**
 * MayaOpsTasksService
 *
 * Creates Google Tasks for PetWash ops items the office manager (Maya) should
 * action — insurance renewals, supplier invoice chase, station contract
 * renewals (Tel Aviv, Ramat Gan), K9000 service intervals, provider KYC doc
 * expiry, SLA breaches that need a human follow-up.
 *
 * Why Google Tasks (not in-app):
 *   - Maya already uses Gmail + Google Calendar daily.
 *   - Google Tasks has native mobile apps + Gmail sidebar widget.
 *   - PetWash never needs to BUILD a to-do UI — Google already did.
 *   - When Maya checks a task off, we can detect that via the Tasks API
 *     and record actioned-by in our own audit log.
 *
 * Why this is a SCAFFOLD, not a finished feature:
 *   - The rules engine that scans for "what needs a task" (insurance,
 *     contracts, invoices, etc.) is intentionally NOT included — that's a
 *     separate cron + rules-table PR.
 *   - The bidirectional sync (Maya checks off → PetWash records) is also
 *     a separate PR (Tasks API has a watch endpoint).
 *   - This file is just the THIN client wrapper so future PRs can call
 *     `enqueueOpsTask({...})` without worrying about Google API plumbing.
 *
 * Operator activation requirements:
 *   1. Ensure GOOGLE_SERVICE_ACCOUNT_JSON is mounted in Cloud Run (already
 *      done; verified by env-audit doc).
 *   2. Grant the service account the Google Tasks API scope. In GCP
 *      Console → IAM → Service Accounts → petwash-api → Domain-wide
 *      delegation. Add scope: https://www.googleapis.com/auth/tasks
 *   3. In Google Workspace Admin → Security → API Controls → Domain-wide
 *      delegation, authorize the service account client_id for the same
 *      scope.
 *   4. Set OPS_TASKS_USER_EMAIL env var to the impersonated user
 *      (office@petwash.co.il). The service acts as that user; the tasks
 *      land in that user's Tasks app.
 *   5. Set MAYA_OPS_TASKS_ENABLED=true to flip the kill-switch ON.
 *
 * Until those steps are done, every enqueueOpsTask() call returns
 * { wired: false, reason: 'MAYA_OPS_TASKS_DISABLED' } and logs a hint.
 * No 500s, no crashes — the rest of PetWash keeps working.
 */

import { logger } from '../lib/logger';

export interface OpsTaskInput {
  /** Short, action-oriented title (e.g. "Renew insurance — policy ABC123 expires Aug 15"). */
  title: string;
  /** Optional long-form notes (links, context, account number, etc.). */
  notes?: string;
  /** Optional due date. Google Tasks shows due-date pill in the UI. */
  due?: Date;
  /** Opaque correlation key — used for dedup so a daily cron doesn't recreate the same task every run. */
  dedupKey: string;
  /** Optional task list name. Defaults to "PetWash Ops". */
  taskList?: string;
}

export interface OpsTaskResult {
  wired: boolean;
  taskId?: string;
  alreadyExists?: boolean;
  reason?: string;
  hint?: string;
}

function isFeatureEnabled(): boolean {
  return process.env.MAYA_OPS_TASKS_ENABLED === 'true';
}

function getImpersonatedUser(): string | null {
  return process.env.OPS_TASKS_USER_EMAIL || null;
}

/**
 * Enqueue an ops task for Maya. Idempotent on dedupKey — calling twice
 * with the same key returns alreadyExists:true instead of duplicating.
 *
 * Returns wired:false (no throw) when the feature isn't activated. Callers
 * should log + continue, NOT block their flow on this.
 */
export async function enqueueOpsTask(input: OpsTaskInput): Promise<OpsTaskResult> {
  if (!isFeatureEnabled()) {
    logger.info('[MayaOpsTasks] enqueueOpsTask skipped — MAYA_OPS_TASKS_ENABLED is not "true"', {
      dedupKey: input.dedupKey, titlePrefix: input.title.substring(0, 60),
    });
    return {
      wired: false,
      reason: 'MAYA_OPS_TASKS_DISABLED',
      hint: 'Set MAYA_OPS_TASKS_ENABLED=true + OPS_TASKS_USER_EMAIL + Google domain-wide delegation. See server/services/MayaOpsTasksService.ts header.',
    };
  }

  const impersonated = getImpersonatedUser();
  if (!impersonated) {
    logger.error('[MayaOpsTasks] enabled flag is ON but OPS_TASKS_USER_EMAIL is not set');
    return {
      wired: false,
      reason: 'OPS_TASKS_USER_EMAIL_MISSING',
      hint: 'Set OPS_TASKS_USER_EMAIL to the Google Workspace user the tasks should land under (e.g. office@petwash.co.il).',
    };
  }

  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credsRaw) {
    logger.error('[MayaOpsTasks] no GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS_JSON');
    return {
      wired: false,
      reason: 'SERVICE_ACCOUNT_NOT_CONFIGURED',
      hint: 'GOOGLE_SERVICE_ACCOUNT_JSON must be mounted to Cloud Run (already done in production deploy mappings).',
    };
  }

  try {
    const { google } = await import('googleapis');
    const credentials = JSON.parse(credsRaw);

    // Domain-wide delegation: service account acts AS the impersonated user.
    // The user's Google Tasks list receives the new task.
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/tasks'],
      subject: impersonated,
    });

    const tasksApi = google.tasks({ version: 'v1', auth });

    // Find or create the named task list.
    const listsResp = await tasksApi.tasklists.list({ maxResults: 100 });
    const listName = input.taskList || 'PetWash Ops';
    let listId = listsResp.data.items?.find(l => l.title === listName)?.id || null;
    if (!listId) {
      const created = await tasksApi.tasklists.insert({ requestBody: { title: listName } });
      listId = created.data.id || null;
      logger.info('[MayaOpsTasks] Created task list', { listName, listId });
    }
    if (!listId) {
      return { wired: false, reason: 'TASKLIST_CREATE_FAILED' };
    }

    // Dedup: scan recent tasks for one whose notes include `[dedup:${dedupKey}]`.
    // Google Tasks API has no native query — list + scan is fine at our scale.
    const existing = await tasksApi.tasks.list({
      tasklist: listId,
      maxResults: 100,
      showCompleted: false,
      showHidden: false,
    });
    const dedupTag = `[dedup:${input.dedupKey}]`;
    const match = existing.data.items?.find(t => (t.notes || '').includes(dedupTag));
    if (match?.id) {
      return { wired: true, taskId: match.id, alreadyExists: true };
    }

    // Create the task. Append the dedup tag to notes so future runs find it.
    const notesWithDedup = `${input.notes || ''}\n\n${dedupTag}`.trim();
    const created = await tasksApi.tasks.insert({
      tasklist: listId,
      requestBody: {
        title: input.title,
        notes: notesWithDedup,
        due: input.due ? input.due.toISOString() : undefined,
      },
    });

    logger.info('[MayaOpsTasks] Created task', {
      taskId: created.data.id, dedupKey: input.dedupKey, listName,
    });
    return { wired: true, taskId: created.data.id || undefined };
  } catch (err: any) {
    logger.error('[MayaOpsTasks] Google Tasks API call failed', {
      message: err?.message, code: err?.code, dedupKey: input.dedupKey,
    });
    return {
      wired: false,
      reason: 'GOOGLE_API_ERROR',
      hint: `Most likely the service account does not have domain-wide delegation for Tasks scope, OR ${impersonated} is not a real Google Workspace user. Detail: ${err?.message || 'unknown'}`,
    };
  }
}

/**
 * Convenience helpers for the common rules. These wrap enqueueOpsTask with
 * sane defaults for title / dedupKey shape. The cron that scans the
 * database and decides WHEN to call these lives in a separate (future) file.
 */

export const opsTasks = {
  insuranceRenewal: (policy: { id: string; name: string; expiresAt: Date }) =>
    enqueueOpsTask({
      title: `Renew insurance — ${policy.name} expires ${policy.expiresAt.toISOString().slice(0, 10)}`,
      notes: `Policy ID: ${policy.id}\nExpiry: ${policy.expiresAt.toISOString()}\nAction: contact broker, sign renewal, upload new policy PDF to admin.`,
      due: policy.expiresAt,
      dedupKey: `insurance-renewal:${policy.id}:${policy.expiresAt.toISOString().slice(0, 10)}`,
    }),

  stationContractRenewal: (station: { id: string; label: string; expiresAt: Date }) =>
    enqueueOpsTask({
      title: `Renew station contract — ${station.label} expires ${station.expiresAt.toISOString().slice(0, 10)}`,
      notes: `Station ID: ${station.id}\nExpiry: ${station.expiresAt.toISOString()}\nAction: review lease terms, negotiate renewal, countersign.`,
      due: station.expiresAt,
      dedupKey: `station-contract:${station.id}:${station.expiresAt.toISOString().slice(0, 10)}`,
    }),

  supplierInvoiceOverdue: (invoice: { id: string; supplierName: string; amountIls: number; daysOverdue: number }) =>
    enqueueOpsTask({
      title: `Chase ${invoice.supplierName} — invoice #${invoice.id} (₪${invoice.amountIls.toFixed(2)}) is ${invoice.daysOverdue}d overdue`,
      notes: `Supplier: ${invoice.supplierName}\nInvoice: #${invoice.id}\nAmount: ₪${invoice.amountIls.toFixed(2)}\nAction: call supplier, confirm payment plan, mark cleared once paid.`,
      dedupKey: `supplier-invoice:${invoice.id}:overdue-${invoice.daysOverdue}d`,
    }),

  kycExpiry: (provider: { id: string; name: string; documentType: string; expiresAt: Date }) =>
    enqueueOpsTask({
      title: `Provider KYC — ${provider.name} ${provider.documentType} expires ${provider.expiresAt.toISOString().slice(0, 10)}`,
      notes: `Provider ID: ${provider.id}\nDocument: ${provider.documentType}\nExpiry: ${provider.expiresAt.toISOString()}\nAction: contact provider, request renewed document, re-verify before expiry.`,
      due: provider.expiresAt,
      dedupKey: `kyc-expiry:${provider.id}:${provider.documentType}:${provider.expiresAt.toISOString().slice(0, 10)}`,
    }),
};
