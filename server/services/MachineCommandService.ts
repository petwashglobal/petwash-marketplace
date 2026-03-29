/**
 * MachineCommandService — K9000 IoT Command Reliability Layer
 *
 * Every activation command sent to a K9000 wash station controller must
 * be persisted and tracked through its full lifecycle:
 *
 *   pending ──► sent ──► acknowledged ──► completed
 *                    ╰──► expired (timeout, no ACK)
 *                              ╰──► retry (if retryCount < maxRetries)
 *                                       ╰──► failed (retries exhausted)
 *                                                 ╰──► compensation (if START_PUMP)
 *
 * CORE SAFETY RULE: Payment success ≠ machine success.
 * Machine success requires an explicit ACK from the controller.
 * If START_PUMP is never ACKed after all retries, compensationTriggeredAt
 * is set so the ops team / refund automation can act.
 *
 * Idempotency: every command carries a stable commandId.  The machine MUST
 * ignore re-delivered commandIds it has already executed.  This means
 * START_PUMP retries are safe — they will not start a second wash cycle.
 */

import { db } from '../db';
import { machineCommands, bayEvents } from '@shared/schema';
import type { MachineCommand } from '@shared/schema';
import { eq, and, inArray, lt, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { eventPublisher } from './EventPublisher';
import { DomainEventType } from '@shared/events';

// ─── Timeouts (ms) before a command is considered timed-out ─────────────────
const COMMAND_TIMEOUT_MS: Record<string, number> = {
  START_PUMP:  10_000,
  STOP_PUMP:   10_000,
  EXTEND_TIME: 10_000,
  HEARTBEAT:    5_000,
  STATUS_PING:  5_000,
};

// ─── Maximum retry attempts per command type ─────────────────────────────────
// START_PUMP: 2 retries (3 total) — deduplicated on machine by commandId
// STOP_PUMP / EXTEND_TIME: 3 retries (4 total) — safe to retry freely
// Probes: liberal retries are fine
const COMMAND_MAX_RETRIES: Record<string, number> = {
  START_PUMP:  2,
  STOP_PUMP:   3,
  EXTEND_TIME: 3,
  HEARTBEAT:   5,
  STATUS_PING: 3,
};

// ─── Interval for the background timeout scanner (ms) ────────────────────────
const SCANNER_INTERVAL_MS = 15_000;

let _scannerHandle: ReturnType<typeof setInterval> | null = null;

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────

export interface DispatchInput {
  commandType: string;
  stationId:   string;
  bayId?:      string;
  sessionId?:  string;
  side?:       string;   // 'left' | 'right'
  payload:     Record<string, unknown>;
  machineClientIp?: string;
  correlationId?:   string;
  source?:          string;  // petwash_wallet | nayax | admin | server
}

export interface DispatchResult {
  commandId:   string;   // e.g. CMD-1234567890-abcdefgh
  commandDbId: string;   // UUID primary key in machine_commands
  status:      string;   // 'pending' on return (sent async)
}

/**
 * Create a command record and fire it to the machine asynchronously.
 * Returns immediately after writing the DB record — the HTTP dispatch
 * and timeout scheduling happen in the background.
 */
export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  const commandId = `CMD-${Date.now()}-${nanoid(8)}`;
  const now       = new Date();
  const timeoutMs = COMMAND_TIMEOUT_MS[input.commandType] ?? 10_000;
  const timeoutAt = new Date(now.getTime() + timeoutMs);
  const maxRetries = COMMAND_MAX_RETRIES[input.commandType] ?? 2;

  const [cmd] = await db
    .insert(machineCommands)
    .values({
      commandId,
      stationId:       input.stationId,
      bayId:           input.bayId      ?? null,
      sessionId:       input.sessionId  ?? null,
      side:            input.side       ?? null,
      commandType:     input.commandType,
      payload:         input.payload,
      status:          'pending',
      retryCount:      0,
      maxRetries,
      timeoutAt,
      machineClientIp: input.machineClientIp ?? null,
      correlationId:   input.correlationId   ?? null,
      source:          input.source          ?? 'petwash_server',
    })
    .returning();

  logger.info('[MachineCmd] Command queued', {
    commandId,
    commandType: input.commandType,
    stationId:   input.stationId,
    side:        input.side,
    sessionId:   input.sessionId,
    correlationId: input.correlationId,
  });

  // Fire-and-forget: HTTP dispatch runs in background
  _sendToMachine(cmd).catch((err: Error) => {
    logger.warn('[MachineCmd] _sendToMachine threw unexpectedly', {
      commandId,
      error: err.message,
    });
  });

  return { commandId, commandDbId: cmd.id, status: 'pending' };
}

/**
 * Mark a command as acknowledged.
 * Called by the ACK endpoint when the machine sends back confirmation.
 * Returns false if the command was already acknowledged or does not exist.
 */
export async function acknowledge(commandId: string): Promise<{
  ok: boolean;
  cmd?: MachineCommand;
  reason?: string;
}> {
  const [cmd] = await db
    .select()
    .from(machineCommands)
    .where(eq(machineCommands.commandId, commandId))
    .limit(1);

  if (!cmd) {
    return { ok: false, reason: 'command_not_found' };
  }

  // Idempotent — already acknowledged
  if (cmd.status === 'acknowledged' || cmd.status === 'completed') {
    return { ok: true, cmd };
  }

  // Expired commands can still be ACKed (machine may have been slow)
  // We accept the ACK but keep failedAt if it was already set.
  const now = new Date();
  const [updated] = await db
    .update(machineCommands)
    .set({
      status:        'acknowledged',
      acknowledgedAt: now,
    })
    .where(eq(machineCommands.commandId, commandId))
    .returning();

  logger.info('[MachineCmd] Command acknowledged ✅', {
    commandId,
    commandType: cmd.commandType,
    sessionId:   cmd.sessionId,
    stationId:   cmd.stationId,
    latencyMs:   cmd.sentAt ? now.getTime() - new Date(cmd.sentAt).getTime() : null,
  });

  // Log bay event
  await _logBayEvent(updated, 'command_acknowledged', {
    commandType: cmd.commandType,
    latencyMs:   cmd.sentAt ? now.getTime() - new Date(cmd.sentAt).getTime() : null,
  });

  return { ok: true, cmd: updated };
}

/**
 * Fetch the last N commands for a station (Octopus visibility endpoint).
 * Returns commands newest-first plus a summary of recent failures and ACK stats.
 */
export async function getStationCommands(
  stationId: string,
  limit = 50,
): Promise<{
  commands: MachineCommand[];
  summary: {
    lastCommandType:    string | null;
    lastCommandStatus:  string | null;
    lastAckTime:        Date | null;
    timeoutCount:       number;
    failedCount:        number;
    pendingCount:       number;
  };
}> {
  const commands = await db
    .select()
    .from(machineCommands)
    .where(eq(machineCommands.stationId, stationId))
    .orderBy(desc(machineCommands.createdAt))
    .limit(limit);

  const timeoutCount = commands.filter((c) => c.status === 'expired').length;
  const failedCount  = commands.filter((c) => c.status === 'failed').length;
  const pendingCount = commands.filter((c) => c.status === 'pending' || c.status === 'sent').length;
  const lastAck      = commands.find((c) => c.acknowledgedAt);

  return {
    commands,
    summary: {
      lastCommandType:   commands[0]?.commandType  ?? null,
      lastCommandStatus: commands[0]?.status       ?? null,
      lastAckTime:       lastAck?.acknowledgedAt   ?? null,
      timeoutCount,
      failedCount,
      pendingCount,
    },
  };
}

/**
 * Start the background scanner that checks for timed-out commands every 15 s.
 * Must be called once at server startup (via setImmediate so it's non-blocking).
 * Safe to call multiple times — second call is a no-op.
 */
export function startCommandTimeoutScanner(): void {
  if (_scannerHandle) return;   // already running

  logger.info('[MachineCmd] Timeout scanner started', {
    intervalMs: SCANNER_INTERVAL_MS,
  });

  _scannerHandle = setInterval(() => {
    _scanTimeouts().catch((err: Error) => {
      logger.error('[MachineCmd] Timeout scanner error', { error: err.message });
    });
  }, SCANNER_INTERVAL_MS);

  // Run once immediately to recover any orphaned commands from before restart
  _scanTimeouts().catch((err: Error) => {
    logger.error('[MachineCmd] Initial timeout scan error', { error: err.message });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function _sendToMachine(cmd: MachineCommand): Promise<void> {
  if (!cmd.machineClientIp) {
    // Dev mode — no physical machine.  Mark sent so the timeout scanner
    // exercises the full ACK/timeout path in testing environments.
    logger.info('[MachineCmd] No machine IP — dev mode, marking sent without HTTP', {
      commandId: cmd.commandId,
      commandType: cmd.commandType,
    });
    await _markSent(cmd.id);
    return;
  }

  const url = `http://${cmd.machineClientIp}/api/command`;
  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        commandId:   cmd.commandId,    // machine deduplicates on this
        commandType: cmd.commandType,
        payload:     cmd.payload,
        side:        cmd.side,
        bayId:       cmd.bayId,
        sessionId:   cmd.sessionId,
        timeoutAt:   cmd.timeoutAt,
      }),
      signal: AbortSignal.timeout(3_000),
    });

    await _markSent(cmd.id);

    await _logBayEvent(cmd, 'command_sent', { httpStatus: resp.status });

    logger.info('[MachineCmd] command_sent', {
      commandId:   cmd.commandId,
      commandType: cmd.commandType,
      httpStatus:  resp.status,
    });
  } catch (err: any) {
    // HTTP failed (timeout, ECONNREFUSED, etc.)
    // Still mark as 'sent' so the timeout scanner can handle the no-ACK path.
    // Marking 'failed' here would prevent the retry path from running.
    await _markSent(cmd.id);

    logger.warn('[MachineCmd] HTTP dispatch error — marking sent for timeout tracking', {
      commandId:   cmd.commandId,
      commandType: cmd.commandType,
      error:       err.message,
    });
  }
}

async function _markSent(dbId: string): Promise<void> {
  await db
    .update(machineCommands)
    .set({ status: 'sent', sentAt: new Date() })
    .where(eq(machineCommands.id, dbId));
}

/**
 * Periodic scan: find commands that have been 'pending' or 'sent' past their
 * timeoutAt deadline and either retry or mark them failed with compensation.
 */
async function _scanTimeouts(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(machineCommands)
    .where(
      and(
        inArray(machineCommands.status, ['pending', 'sent']),
        lt(machineCommands.timeoutAt, now),
      ),
    );

  if (expired.length === 0) return;

  logger.warn('[MachineCmd] Timeout scanner found expired commands', {
    count: expired.length,
  });

  for (const cmd of expired) {
    try {
      await _handleTimeout(cmd);
    } catch (err: any) {
      logger.error('[MachineCmd] Error handling timed-out command', {
        commandId: cmd.commandId,
        error: err.message,
      });
    }
  }
}

async function _handleTimeout(cmd: MachineCommand): Promise<void> {
  const now = new Date();

  logger.warn('[MachineCmd] Command timed out', {
    commandId:   cmd.commandId,
    commandType: cmd.commandType,
    retryCount:  cmd.retryCount,
    maxRetries:  cmd.maxRetries,
    sessionId:   cmd.sessionId,
    stationId:   cmd.stationId,
  });

  await _logBayEvent(cmd, 'command_timed_out', {
    commandType: cmd.commandType,
    retryCount:  cmd.retryCount,
    maxRetries:  cmd.maxRetries,
  });

  const canRetry = cmd.retryCount < cmd.maxRetries;

  if (canRetry) {
    // Reschedule: increment retryCount, reset timeoutAt, re-send to machine
    const timeoutMs = COMMAND_TIMEOUT_MS[cmd.commandType] ?? 10_000;
    const newTimeoutAt = new Date(now.getTime() + timeoutMs);

    const [updated] = await db
      .update(machineCommands)
      .set({
        status:     'pending',
        retryCount: cmd.retryCount + 1,
        timeoutAt:  newTimeoutAt,
        sentAt:     null,
      })
      .where(eq(machineCommands.id, cmd.id))
      .returning();

    logger.info('[MachineCmd] Retrying command', {
      commandId:  cmd.commandId,
      attempt:    cmd.retryCount + 1,
      maxRetries: cmd.maxRetries,
    });

    // Re-dispatch to machine (non-blocking)
    _sendToMachine(updated).catch((err: Error) => {
      logger.warn('[MachineCmd] Retry dispatch failed', {
        commandId: cmd.commandId,
        error: err.message,
      });
    });

  } else {
    // Terminal failure — max retries exhausted
    const isStartPump      = cmd.commandType === 'START_PUMP';
    const needsCompensation = isStartPump && !!cmd.sessionId;

    const [updated] = await db
      .update(machineCommands)
      .set({
        status:                  'failed',
        failedAt:                now,
        compensationTriggeredAt: needsCompensation ? now : null,
      })
      .where(eq(machineCommands.id, cmd.id))
      .returning();

    await _logBayEvent(updated, 'command_failed', {
      commandType:        cmd.commandType,
      retryCount:         cmd.retryCount,
      needsCompensation,
    });

    logger.error('[MachineCmd] Command failed — all retries exhausted', {
      commandId:          cmd.commandId,
      commandType:        cmd.commandType,
      sessionId:          cmd.sessionId,
      needsCompensation,
    });

    if (needsCompensation) {
      // Log a dedicated compensation_required bay event so the ops team and
      // any future refund automation can pick it up.
      await _logBayEvent(updated, 'compensation_required', {
        reason:    'start_pump_ack_timeout_after_payment',
        commandId: cmd.commandId,
        sessionId: cmd.sessionId,
      });

      logger.error('[MachineCmd] ⚠️  COMPENSATION REQUIRED — START_PUMP never ACKed after payment', {
        commandId: cmd.commandId,
        sessionId: cmd.sessionId,
        stationId: cmd.stationId,
        side:      cmd.side,
      });
    }

    // ── Publish domain event so notification handlers and analytics can react ─
    if (cmd.commandType === 'START_PUMP') {
      eventPublisher.publishEvent(
        DomainEventType.WASH_FAILED,
        {
          washId:               cmd.sessionId ?? cmd.commandId,
          stationId:            cmd.stationId ?? '',
          bayId:                cmd.bayId ?? undefined,
          reason:               'pump_ack_timeout_after_all_retries',
          compensationRequired: needsCompensation,
        },
        {
          userId:      (cmd.payload as any)?.userId ?? undefined,
          aggregateId: cmd.stationId ?? undefined,
        },
      ).catch((e: any) => {
        logger.warn('[MachineCmd] wash.failed event publish failed', { error: e?.message });
      });
    }
  }
}

/**
 * Write a bay event entry for command lifecycle tracking.
 * Silently skips if the command has no bayId or stationId (station-level cmds).
 */
async function _logBayEvent(
  cmd: MachineCommand,
  eventType: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!cmd.bayId || !cmd.stationId || !cmd.side) return;

  try {
    await db.insert(bayEvents).values({
      bayId:     cmd.bayId,
      stationId: cmd.stationId,
      side:      cmd.side as 'left' | 'right',
      eventType,
      sessionId: cmd.sessionId ?? null,
      source:    'petwash_server',
      metadata:  JSON.stringify({
        commandId:   cmd.commandId,
        commandType: cmd.commandType,
        ...extra,
      }),
      occurredAt: new Date(),
    });
  } catch (err: any) {
    logger.warn('[MachineCmd] Could not write bay event', {
      eventType,
      commandId: cmd.commandId,
      error: err.message,
    });
  }
}
