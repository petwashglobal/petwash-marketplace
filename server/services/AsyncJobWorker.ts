/**
 * PetWash™ AsyncJobWorker — Google Hardening Pack Section 3 (Retry Queue)
 * =========================================================================
 * Polls pw_async_jobs for pending Google secondary jobs and executes them
 * with exponential backoff. Designed to run as a lightweight in-process
 * background worker alongside the Express server.
 *
 * POLICY (Section 4.1 — Google-optional flows):
 *   All Google secondary actions (Drive upload, Sheets export, Calendar event)
 *   are queued in pw_async_jobs and executed here — never inline in a payment
 *   or tax-document flow. If Google is down, jobs stay PENDING and are retried.
 *
 * JOB TYPES:
 *   ARCHIVE_TAX_DOCUMENT_TO_DRIVE   — upload PDF to Drive, write back file ID
 *   EXPORT_RECONCILIATION_TO_SHEETS — append daily recon row to Sheets
 *   EXPORT_BOOKING_TO_SHEETS        — append booking summary row to Sheets
 *   CREATE_CALENDAR_EVENT           — mirror booking to Google Calendar
 *   SEND_GMAIL_FALLBACK             — fallback email via Gmail if SendGrid failed
 *
 * BACKOFF: 2^attempts minutes (1 min, 2 min, 4 min, 8 min … up to max_attempts)
 * MAX ATTEMPTS: 10 per job (then FAILED — human review required)
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { archiveTaxDocumentToDrive } from './DriveArchivalService';

type JobType =
  | 'ARCHIVE_TAX_DOCUMENT_TO_DRIVE'
  | 'EXPORT_RECONCILIATION_TO_SHEETS'
  | 'EXPORT_BOOKING_TO_SHEETS'
  | 'CREATE_CALENDAR_EVENT'
  | 'SEND_GMAIL_FALLBACK';

interface AsyncJob {
  id: string;
  job_type: JobType;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  attempts: number;
  max_attempts: number;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const BATCH_SIZE = 10;

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

/**
 * Enqueue a new Google secondary job.
 * Call this from any service that needs to trigger a Google-side action
 * without blocking the main payment/tax-document flow.
 */
export async function enqueueGoogleJob(params: {
  jobType: JobType;
  entityType: string;
  entityId: string;
  payload?: Record<string, any>;
  delaySeconds?: number;
}): Promise<void> {
  const nextRunAt = new Date(Date.now() + (params.delaySeconds ?? 0) * 1000);
  try {
    await db.execute(sql`
      INSERT INTO pw_async_jobs (job_type, entity_type, entity_id, payload, next_run_at)
      VALUES (
        ${params.jobType},
        ${params.entityType},
        ${params.entityId},
        ${JSON.stringify(params.payload ?? {})},
        ${nextRunAt.toISOString()}
      )
    `);
    logger.debug('[AsyncJobWorker] Job enqueued', {
      jobType: params.jobType, entityId: params.entityId,
    });
  } catch (err: any) {
    // Log but never throw — enqueueing failure must not block caller
    logger.error('[AsyncJobWorker] Failed to enqueue job', {
      jobType: params.jobType, entityId: params.entityId, err: err.message,
    });
  }
}

/**
 * Claim and return a batch of ready jobs, locking them to this worker instance.
 * Uses a FOR UPDATE SKIP LOCKED pattern so multiple worker instances (if any)
 * don't double-process the same job.
 */
async function claimJobs(): Promise<AsyncJob[]> {
  const workerId = `worker-${process.pid}`;
  const now = new Date().toISOString();

  const result = await db.execute<AsyncJob>(sql`
    UPDATE pw_async_jobs
    SET status     = 'PROCESSING',
        locked_at  = NOW(),
        locked_by  = ${workerId},
        updated_at = NOW()
    WHERE id IN (
      SELECT id FROM pw_async_jobs
      WHERE status IN ('PENDING', 'FAILED')
        AND next_run_at <= ${now}
        AND attempts < max_attempts
      ORDER BY next_run_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, job_type, entity_type, entity_id, payload, attempts, max_attempts
  `);

  return (result.rows ?? []) as unknown as AsyncJob[];
}

/** Execute a single job based on its type. Returns true on success. */
async function executeJob(job: AsyncJob): Promise<boolean> {
  switch (job.job_type) {
    case 'ARCHIVE_TAX_DOCUMENT_TO_DRIVE': {
      const result = await archiveTaxDocumentToDrive(job.entity_id);
      return result.success;
    }

    case 'EXPORT_RECONCILIATION_TO_SHEETS': {
      try {
        const { GoogleSheetsService } = await import('./googleSheetsIntegration');
        if (typeof (GoogleSheetsService as any).logReconciliationReport === 'function') {
          await (GoogleSheetsService as any).logReconciliationReport(job.payload);
        } else {
          logger.warn('[AsyncJobWorker] logReconciliationReport not implemented yet', { jobId: job.id });
        }
        return true;
      } catch (err: any) {
        logger.error('[AsyncJobWorker] EXPORT_RECONCILIATION_TO_SHEETS failed', { err: err.message });
        return false;
      }
    }

    case 'EXPORT_BOOKING_TO_SHEETS': {
      try {
        const { GoogleSheetsService } = await import('./googleSheetsIntegration');
        if (typeof (GoogleSheetsService as any).logBooking === 'function') {
          await (GoogleSheetsService as any).logBooking(job.payload);
        } else {
          logger.warn('[AsyncJobWorker] logBooking not implemented yet', { jobId: job.id });
        }
        return true;
      } catch (err: any) {
        logger.error('[AsyncJobWorker] EXPORT_BOOKING_TO_SHEETS failed', { err: err.message });
        return false;
      }
    }

    case 'CREATE_CALENDAR_EVENT': {
      try {
        const { calendarIntegrationService, type: _t } = await import('./CalendarIntegrationService') as any;
        const available = await calendarIntegrationService.isAvailable();
        if (!available) {
          logger.warn('[AsyncJobWorker] CREATE_CALENDAR_EVENT — Google Calendar not available (missing Replit connector or service account); skipping', {
            jobId: job.id, entityId: job.entity_id,
          });
          // Return true so the job is not retried indefinitely when Calendar is unconfigured.
          // When Calendar becomes available, new bookings will queue new jobs.
          return true;
        }
        const p = job.payload;
        await calendarIntegrationService.createBookingEvent({
          platform:     String(p.platform     || 'petwash'),
          bookingId:    String(p.bookingId    || job.entity_id),
          title:        String(p.title        || 'Pet Wash Booking'),
          description:  String(p.description  || ''),
          startTime:    new Date(p.startTime  as string),
          endTime:      new Date(p.endTime    as string),
          location:     p.location     ? String(p.location)     : undefined,
          customerName: p.customerName ? String(p.customerName) : undefined,
          providerName: p.providerName ? String(p.providerName) : undefined,
          petName:      p.petName      ? String(p.petName)      : undefined,
        });
        logger.info('[AsyncJobWorker] CREATE_CALENDAR_EVENT succeeded', { jobId: job.id, entityId: job.entity_id });
        return true;
      } catch (err: any) {
        logger.error('[AsyncJobWorker] CREATE_CALENDAR_EVENT failed', { err: err.message, jobId: job.id });
        return false;
      }
    }

    case 'SEND_GMAIL_FALLBACK': {
      try {
        const { sendViaGmail } = await import('../routes/gmail');
        await sendViaGmail({
          to:      job.payload.to as string,
          subject: job.payload.subject as string,
          html:    job.payload.html as string,
        });
        return true;
      } catch (err: any) {
        logger.error('[AsyncJobWorker] SEND_GMAIL_FALLBACK failed', { err: err.message });
        return false;
      }
    }

    default:
      logger.warn('[AsyncJobWorker] Unknown job type', { jobType: job.job_type });
      return true; // Mark as done to avoid infinite loops on bad job types
  }
}

/** Mark a job as DONE. */
async function markDone(jobId: string): Promise<void> {
  await db.execute(sql`
    UPDATE pw_async_jobs
    SET status = 'DONE', locked_at = NULL, locked_by = NULL, updated_at = NOW()
    WHERE id = ${jobId}
  `);
}

/** Mark a job as PENDING for retry, with exponential backoff. */
async function markForRetry(jobId: string, attempts: number, errorMsg: string): Promise<void> {
  const backoffMinutes = Math.pow(2, attempts); // 2, 4, 8, 16 … minutes
  const nextRunAt = new Date(Date.now() + backoffMinutes * 60_000);
  await db.execute(sql`
    UPDATE pw_async_jobs
    SET status     = 'PENDING',
        attempts   = ${attempts + 1},
        next_run_at = ${nextRunAt.toISOString()},
        last_error  = ${errorMsg.slice(0, 500)},
        locked_at   = NULL,
        locked_by   = NULL,
        updated_at  = NOW()
    WHERE id = ${jobId}
  `);
}

/** Mark a job as permanently FAILED (exceeded max_attempts). */
async function markFailed(jobId: string, errorMsg: string): Promise<void> {
  await db.execute(sql`
    UPDATE pw_async_jobs
    SET status    = 'FAILED',
        last_error = ${errorMsg.slice(0, 500)},
        locked_at  = NULL,
        locked_by  = NULL,
        updated_at = NOW()
    WHERE id = ${jobId}
  `);
  logger.error('[AsyncJobWorker] Job permanently FAILED — requires human review', { jobId });
}

/** Run one processing cycle: claim → execute → mark. */
async function runOnce(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const jobs = await claimJobs();
    if (jobs.length === 0) return;

    logger.debug('[AsyncJobWorker] Processing batch', { count: jobs.length });

    await Promise.allSettled(
      jobs.map(async (job) => {
        try {
          const success = await executeJob(job);
          if (success) {
            await markDone(job.id);
          } else {
            const nextAttempt = job.attempts + 1;
            if (nextAttempt >= job.max_attempts) {
              await markFailed(job.id, 'Job returned false');
            } else {
              await markForRetry(job.id, job.attempts, 'Job returned false');
            }
          }
        } catch (err: any) {
          const nextAttempt = job.attempts + 1;
          if (nextAttempt >= job.max_attempts) {
            await markFailed(job.id, err.message ?? 'UNKNOWN');
          } else {
            await markForRetry(job.id, job.attempts, err.message ?? 'UNKNOWN');
          }
        }
      }),
    );
  } catch (err: any) {
    logger.error('[AsyncJobWorker] Cycle error', { err: err.message });
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the in-process async job worker.
 * Call once at server startup, after the DB is ready.
 */
export function startAsyncJobWorker(): void {
  if (workerTimer) return; // Already started

  logger.info('[AsyncJobWorker] Starting — polling every 30s for Google secondary jobs');
  workerTimer = setInterval(runOnce, POLL_INTERVAL_MS);

  // Run immediately on startup to process any stale PENDING jobs
  runOnce().catch((err) =>
    logger.error('[AsyncJobWorker] Initial cycle failed', { err: err?.message }),
  );
}

/** Stop the worker (used in graceful shutdown / tests). */
export function stopAsyncJobWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info('[AsyncJobWorker] Stopped');
  }
}
