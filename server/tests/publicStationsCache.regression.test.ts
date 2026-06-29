/**
 * Public stations directory is server-cached (Redis, 120s) to avoid the
 * Israel→Frankfurt DB hop on every hot load. Must degrade gracefully (Redis down
 * → falls through to DB) and only cache the public, marketing-safe projection.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'public-stations.ts'), 'utf8');

describe('public stations server cache', () => {
  it('reads from redis cache before the DB and writes back with a TTL', () => {
    expect(SRC).toMatch(/STATIONS_CACHE_TTL_SECONDS = 120/);
    expect(SRC).toMatch(/const cached = await redis\.get/);
    expect(SRC).toMatch(/return res\.json\(\{ stations: cached \}\)/);
    expect(SRC).toMatch(/await redis\.set\(CACHE_KEY, stations, STATIONS_CACHE_TTL_SECONDS\)/);
  });
  it('cache sits in front of the existing query (DB path still present as fallback)', () => {
    expect(SRC).toMatch(/\.from\(petWashStations\)/);
    expect(SRC.indexOf('const cached = await redis.get')).toBeLessThan(SRC.indexOf('.from(petWashStations)'));
  });
});
