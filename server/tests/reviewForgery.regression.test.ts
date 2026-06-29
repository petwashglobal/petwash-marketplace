/**
 * Review/rating forgery closed: sitter + walker reviews now require auth, a
 * COMPLETED booking owned by the reviewer with that provider, and one review per
 * booking. Ratings drive search ranking, so forgery is an integrity/security issue.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const sitter = readFileSync(resolve(__dirname, '..', 'routes', 'sitter-suite.ts'), 'utf8');
const walk = readFileSync(resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'), 'utf8');

describe('review forgery closed', () => {
  it('sitter /reviews requires auth + completed-booking ownership + dedup', () => {
    expect(sitter).toMatch(/router\.post\('\/reviews', requireAuth/);
    expect(sitter).toMatch(/booking\.ownerId !== ownerId \|\| booking\.sitterId !== validatedData\.sitterId/);
    expect(sitter).toMatch(/booking\.status !== 'completed'/);
    expect(sitter).toMatch(/already been reviewed/);
  });
  it('walk review requires a completed walk owned by reviewer + dedup', () => {
    expect(walk).toMatch(/walk\.ownerId !== ownerId \|\| walk\.walkerId !== walkerId/);
    expect(walk).toMatch(/walk\.status !== 'completed'/);
    expect(walk).toMatch(/This walk has already been reviewed/);
  });
});
