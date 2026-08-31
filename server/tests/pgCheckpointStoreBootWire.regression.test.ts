/**
 * Regression pin — PgCheckpointStore must be wired as the runtime
 * default (task #195). Without this call the JourneyCheckpoint
 * store stays in-memory and the AttentionFeed abandoned-journey
 * probe silently returns [] in production.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROUTES = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('PgCheckpointStore boot wire (task #195)', () => {
  it('routes.ts imports setDefaultCheckpointStore + PgCheckpointStore', () => {
    expect(ROUTES).toContain("import('./services/marketplace/JourneyCheckpointService')");
    expect(ROUTES).toContain("import('./services/marketplace/PgCheckpointStore')");
  });

  it('routes.ts calls setDefaultCheckpointStore(new PgCheckpointStore())', () => {
    expect(ROUTES).toContain('setDefaultCheckpointStore(new PgCheckpointStore())');
  });

  it('the wire runs AFTER registerJourneyLoaders (so it does not race the dispatch table)', () => {
    const loaderIdx = ROUTES.indexOf('registerJourneyLoaders();');
    const wireIdx = ROUTES.indexOf('setDefaultCheckpointStore(new PgCheckpointStore())');
    expect(loaderIdx).toBeGreaterThan(0);
    expect(wireIdx).toBeGreaterThan(loaderIdx);
  });

  it('log line names task #195 so a boot-time greppable trail is visible in Cloud Run', () => {
    expect(ROUTES).toContain('task #195');
    expect(ROUTES).toContain('JourneyCheckpoint store swapped to PgCheckpointStore');
  });
});
