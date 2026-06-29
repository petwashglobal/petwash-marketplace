/**
 * Message-backup circuit-breaker — prevents the "million failed messages" log flood.
 * backupMessage() runs per message sent; a persistent failure (missing bucket /
 * denied SA / no creds) must pause attempts + warn ONCE per cooldown, never log an
 * error for every message. Source-introspection (service binds to GCS/Firestore).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, '..', 'services', 'gcsBackupService.ts'), 'utf8');

describe('Message backup circuit-breaker (anti-flood)', () => {
  it('has a cooldown breaker + single throttled notice (not per-message error)', () => {
    expect(SRC).toMatch(/msgBackupPausedUntil/);
    expect(SRC).toMatch(/MSG_BACKUP_COOLDOWN_MS\s*=\s*30 \* 60 \* 1000/);
    expect(SRC).toMatch(/function pauseMessageBackup/);
    expect(SRC).toMatch(/now - msgBackupLastNoticeAt > MSG_BACKUP_COOLDOWN_MS/); // throttle
  });

  it('backupMessage skips quietly while paused and when GCS is unconfigured', () => {
    expect(SRC).toMatch(/if \(Date\.now\(\) < msgBackupPausedUntil\)\s*\{\s*\n?\s*return \{ success: false, error: 'backup_paused' \}/);
    expect(SRC).toMatch(/if \(!isGcsConfigured\(\)\)\s*\{\s*\n?\s*pauseMessageBackup\('GCS credentials not configured'\)/);
  });

  it('the per-message catch no longer logs an error every time — it opens the breaker', () => {
    // The old unconditional `logger.error('[GCS] Message backup failed'...)` is gone.
    expect(SRC).not.toMatch(/logger\.error\('\[GCS\] Message backup failed'/);
    // The catch routes through the throttled breaker instead.
    expect(SRC).toMatch(/catch \(error: any\)\s*\{[^}]*pauseMessageBackup\(error\?\.message/);
  });
});
