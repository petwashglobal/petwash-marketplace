/**
 * Lane C.2 · Journey Brain Phase 2 hygiene (post-release 2026-09-03).
 *
 * The pruner service (`pruneExpiredCheckpoints`) already exists and
 * is fail-soft. This pins that it's actually WIRED into the server
 * boot as a periodic cron, so expired `journey_checkpoints` rows
 * are physically deleted instead of accumulating on disk.
 *
 * Two invariants worth pinning:
 *   1. The cron module exports the expected start function AND
 *      calls `pruneExpiredCheckpoints(pool)` on each tick.
 *   2. `server/index.ts` imports + invokes `startJourneyCheckpointsPrunerCron`
 *      inside the same try/catch block as the other cron jobs, so
 *      a pruner-boot failure never brings the process down.
 *   3. The interval timer is `.unref()`'d so the pruner does not
 *      keep the event loop alive on a clean shutdown.
 *   4. The kill-switch env `JOURNEY_CHECKPOINTS_PRUNER_DISABLED=true`
 *      is honoured — an emergency can turn it off without a deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CRON = fs.readFileSync(
  path.resolve(__dirname, '..', 'cron', 'journey-checkpoints-prune.ts'),
  'utf8',
);
const INDEX = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.ts'),
  'utf8',
);

describe('Lane C.2 · JourneyCheckpoints pruner cron wire', () => {
  it('cron module exports startJourneyCheckpointsPrunerCron', () => {
    expect(CRON).toMatch(/export function startJourneyCheckpointsPrunerCron\(\): void/);
  });

  it('cron ticks call pruneExpiredCheckpoints(pool) — the canonical service', () => {
    expect(CRON).toMatch(
      /import \{ pruneExpiredCheckpoints \} from '\.\.\/services\/journeyCheckpoints';/,
    );
    expect(CRON).toMatch(/const deleted = await pruneExpiredCheckpoints\(pool\);/);
  });

  it('cron guards against a missing database (isDatabaseAvailable check) — no boot noise on cold envs', () => {
    expect(CRON).toMatch(/if \(!isDatabaseAvailable\) return;/);
  });

  it('cron timer is .unref()\'d so a clean shutdown is not blocked', () => {
    expect(CRON).toMatch(/if \(typeof timer\.unref === 'function'\) timer\.unref\(\);/);
  });

  it('cron honours the kill-switch env JOURNEY_CHECKPOINTS_PRUNER_DISABLED=true', () => {
    expect(CRON).toMatch(
      /if \(process\.env\.JOURNEY_CHECKPOINTS_PRUNER_DISABLED === 'true'\) \{[\s\S]*?return;\s*\}/,
    );
  });

  it('cron tick body is wrapped in try/catch (belt-and-braces over the fail-soft service)', () => {
    // The service already fails-soft internally; this outer catch
    // stops a wrapper-level throw (import failure, timer bug) from
    // breaking the scheduler.
    expect(CRON).toMatch(/logger\.warn\('\[JourneyCheckpointsPruner\] tick error \(non-fatal\)'/);
  });

  it('server/index.ts imports + invokes the pruner alongside the other cron jobs', () => {
    // Same try/catch block that inits the other crons so a pruner
    // failure never brings the process down.
    expect(INDEX).toMatch(
      /const \{ startJourneyCheckpointsPrunerCron \} = await import\("\.\/cron\/journey-checkpoints-prune"\);\s*\n\s*startJourneyCheckpointsPrunerCron\(\);/,
    );
    // Wired inside the "[Cron] Initializing automated jobs" block —
    // proximity to startHeartbeatMonitorCron is the adjacency signal
    // that this landed in the RIGHT block (not a stray copy elsewhere).
    expect(INDEX).toMatch(
      /startHeartbeatMonitorCron\(\);[\s\S]{0,600}startJourneyCheckpointsPrunerCron\(\);[\s\S]{0,600}\[Cron\] All cron jobs initialized successfully/,
    );
  });
});
