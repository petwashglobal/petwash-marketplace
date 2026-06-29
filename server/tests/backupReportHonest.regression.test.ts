/**
 * The backup-report dashboard must NEVER return fabricated "healthy" stats. On a
 * GCS config/read error it returns an honest unknown/unavailable state (503), not
 * invented file counts with newestBackup=today (false disaster-recovery assurance).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'luxury-documents.ts'), 'utf8');

describe('backup report honesty', () => {
  it('no longer fabricates healthy backup numbers on error', () => {
    expect(SRC).not.toMatch(/totalFiles: 52/);
    expect(SRC).not.toMatch(/mockData: true/);
  });
  it('returns an explicit unknown/unavailable state', () => {
    expect(SRC).toMatch(/status: 'unknown'/);
    expect(SRC).toMatch(/Do not assume backups exist/);
    expect(SRC).toMatch(/res\.status\(503\)/);
  });
});
