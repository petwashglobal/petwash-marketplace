/**
 * Backup summary email — failures only.
 *
 * The service used to email a full HTML report on EVERY backup run, successes
 * included. Backups run daily, so the inbox filled with "✅ SUCCESS" mail nobody
 * reads. That is not just noise — it is how a real failure hides: on 2026-07-08 a
 * backup reported ✅ while storing 0 documents and it sat unread among the daily
 * green mail (see memory: backup-report-lying).
 *
 * Rule now: silent on success, loud on failure. BACKUP_EMAIL_ON_SUCCESS=true
 * restores the old behaviour when deliberately verifying a rail.
 *
 * The send function isn't exported, so we pin the source AND re-run its exact
 * failure predicate against the shapes the two real call sites pass.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/services/gcsBackupService.ts'), 'utf8');

/** Mirrors the predicate in sendBackupSummaryEmail. */
function isFailure(data: any): boolean {
  return (
    data.status === 'failed' ||
    (data.type === 'firestore' &&
      (((data.firestoreBackup?.totalDocs ?? 0) === 0) ||
        (data.firestoreBackup?.files || []).some((f: any) => f.error)))
  );
}

describe('backup email — suppressed on success', () => {
  it('gates the send behind a failure check', () => {
    expect(src).toMatch(/BACKUP_EMAIL_ON_SUCCESS/);
    expect(src).toMatch(/success email suppressed/i);
  });

  it('a healthy firestore backup does NOT email', () => {
    expect(isFailure({
      type: 'firestore',
      status: 'success',
      firestoreBackup: { totalDocs: 12345, files: [{ collection: 'users', docs: 100 }] },
    })).toBe(false);
  });

  it('a successful code backup does NOT email', () => {
    // Code backups only reach the email on success — failures throw earlier.
    expect(isFailure({ type: 'code', codeBackup: { file: 'x.tar.gz' } })).toBe(false);
  });
});

describe('backup email — always sent on failure', () => {
  it('catches the July incident shape: ✅ status but ZERO documents', () => {
    expect(isFailure({
      type: 'firestore',
      status: 'success',            // the lying status that fooled everyone
      firestoreBackup: { totalDocs: 0, files: [] },
    })).toBe(true);
  });

  it('catches a partial failure (one collection errored)', () => {
    expect(isFailure({
      type: 'firestore',
      status: 'success',
      firestoreBackup: {
        totalDocs: 500,
        files: [{ collection: 'users', docs: 500 }, { collection: 'pets', docs: 0, error: true }],
      },
    })).toBe(true);
  });

  it('catches an explicit failed status', () => {
    expect(isFailure({ type: 'firestore', status: 'failed', firestoreBackup: { totalDocs: 9, files: [] } })).toBe(true);
  });
});
