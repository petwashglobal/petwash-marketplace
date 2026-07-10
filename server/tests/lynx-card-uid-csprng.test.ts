/**
 * Card-UID randomness — security regression pin (2026-07-11).
 *
 * CodeQL (js/insecure-randomness) flagged newCardUid using Math.random() to build
 * a prepaid wash-card UID. A card UID must be UNGUESSABLE, not merely unique —
 * Math.random is predictable and would let UIDs be enumerated. Fixed to a CSPRNG
 * (crypto.randomBytes). This pins that Math.random never returns to that path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'LynxCardService.ts'),
  'utf8',
);

describe('LynxCardService card-UID randomness (2026-07-11)', () => {
  it('uses a CSPRNG (crypto.randomBytes), never Math.random', () => {
    expect(SRC).toMatch(/import \{ randomBytes \} from 'node:crypto'/);
    expect(SRC).toMatch(/const rand = randomBytes\(8\)\.toString\('hex'\)/);
    expect(SRC).not.toMatch(/Math\.random\(\)/);
  });
});
