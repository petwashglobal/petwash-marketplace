/**
 * Fiscal watchdog — scheduled production execution.
 *
 * Runs the Nayax↔SUMIT (A↔C) control against the claim ledger, records the run
 * durably in fiscal_watchdog_runs, and emails the recipient group when it
 * matters. Uses only infrastructure that already exists: the pool, the guarded
 * SendGrid rail, and the same in-process timer pattern as health-watchdog.ts.
 *
 * ── SEND POLICY ─────────────────────────────────────────────────────────────
 * Every run is RECORDED. Not every run is SENT:
 *   • any critical finding → immediate email
 *   • a stale source       → immediate email (a pass on old data is not a pass)
 *   • the monthly run      → always emailed, findings or not
 *   • a clean daily run    → recorded, not emailed
 * That last line is deliberate. Four inboxes receiving a daily "all clear" is
 * how a real CRITICAL gets skimmed past.
 *
 * Disable with FISCAL_WATCHDOG_DISABLED=true.
 */
import { runFiscalWatchdog, recordAndDistribute } from '../services/FiscalWatchdogService';
import { logger } from '../lib/logger';

const DAILY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_MS = 5 * 60 * 1000;   // 5 min after boot — never during startup

let started = false;

async function tick(kind: 'daily' | 'monthly'): Promise<void> {
  try {
    // A monthly run reconciles the month that has just ENDED, not the current
    // one — a period still in progress can never be closed.
    let period: string | null = null;
    if (kind === 'monthly') {
      const d = new Date();
      d.setUTCDate(0); // last day of the previous month
      period = d.toISOString().slice(0, 7);
    }
    const run = await runFiscalWatchdog({ runKind: kind, period });
    if (!run) return;
    await recordAndDistribute(run);
  } catch (e) {
    // A watchdog that crashes silently is worse than none: say so.
    logger.error('[FiscalWatchdog] tick failed', { kind, err: (e as Error).message });
  }
}

export function startFiscalWatchdog(): void {
  if (started) return;
  if ((process.env.FISCAL_WATCHDOG_DISABLED || '').toLowerCase() === 'true') {
    logger.info('[FiscalWatchdog] disabled by FISCAL_WATCHDOG_DISABLED');
    return;
  }
  started = true;

  setTimeout(() => { void tick('daily'); }, FIRST_RUN_MS).unref?.();
  setInterval(() => {
    // On the 1st of the month the daily run is upgraded to the monthly report.
    const isFirst = new Date().getUTCDate() === 1;
    void tick(isFirst ? 'monthly' : 'daily');
  }, DAILY_MS).unref?.();

  logger.info('[FiscalWatchdog] started — daily A↔C control, monthly report on the 1st, '
    + 'recorded to fiscal_watchdog_runs, emailed on critical/stale/monthly.');
}
