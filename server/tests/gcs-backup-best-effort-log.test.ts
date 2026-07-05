/**
 * GCS backup — post-upload logging/email must be best-effort.
 *
 * The weekly code-backup Cloud Scheduler job failed with status 13 (500):
 * the upload SUCCEEDED but the unguarded `await db.collection('backup_logs')
 * .add(...)` threw PERMISSION_DENIED (runtime SA lacks Firestore write), which
 * bubbled out and failed the whole request. The postgres path already guarded
 * this (#1168); the code and firestore paths did not.
 *
 * Source-pin: every success-path backup_logs.add + sendBackupSummaryEmail is
 * wrapped so a landed backup can't be turned into a failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'gcsBackupService.ts'),
  'utf8',
);

describe('gcsBackupService — best-effort post-upload logging (code-backup status-13 fix)', () => {
  it('no success-path backup_logs.add is left unguarded (all wrapped best-effort)', () => {
    // Every "status: 'success'" backup_logs write must be inside a try that
    // logs a "(non-fatal)" warning on failure.
    const nonFatalWarns = SRC.match(/backup_logs write failed \(non-fatal\)/g) || [];
    // postgres + code + firestore = 3 success paths
    expect(nonFatalWarns.length).toBeGreaterThanOrEqual(3);
  });

  it('the code backup guards its log write with a non-fatal warning', () => {
    expect(SRC).toMatch(/Code backup uploaded OK but backup_logs write failed \(non-fatal\)/);
  });

  it('the firestore export guards its log write with a non-fatal warning', () => {
    expect(SRC).toMatch(/Firestore export uploaded OK but backup_logs write failed \(non-fatal\)/);
  });

  it('the summary email is best-effort on code and firestore paths', () => {
    expect(SRC).toMatch(/Code backup summary email failed \(non-fatal\)/);
    expect(SRC).toMatch(/Firestore backup summary email failed \(non-fatal\)/);
  });
});
