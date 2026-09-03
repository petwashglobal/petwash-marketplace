/**
 * Lane D · source-anchored pins so a client-side refactor cannot
 * silently strip the test-target attributes the real-browser E2E
 * spec depends on. The E2E itself lives at
 *   tests/e2e/canonical-destination-and-requested-service.e2e.spec.ts
 * and runs against a real Chromium. These pins guarantee its
 * assumptions hold at the source level too.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('Lane D · ProviderOnboarding picker cards carry stable test-target attrs', () => {
  const src = read('client/src/pages/ProviderOnboarding.tsx');

  it.each(['walker', 'sitter', 'driver', 'trainer'])(
    '%s card has data-testid, data-selected and aria-pressed',
    (key) => {
      const rx = new RegExp(
        `data-testid="provider-type-${key}"[\\s\\S]{0,300}data-selected=\\{hasProviderType\\('${key}'\\) \\? 'true' : 'false'\\}`,
      );
      expect(src).toMatch(rx);
      expect(src).toMatch(new RegExp(`aria-pressed=\\{hasProviderType\\('${key}'\\)\\}`));
    },
  );
});

describe('Lane D · ChoosePath carries the choosepath-decide-later handle', () => {
  const src = read('client/src/pages/ChoosePath.tsx');

  it('the "decide later" link has a data-testid AND navigates to /pet-parent/home', () => {
    expect(src).toMatch(/data-testid="choosepath-decide-later"/);
    const idx = src.indexOf('data-testid="choosepath-decide-later"');
    expect(idx).toBeGreaterThan(0);
    const region = src.slice(Math.max(0, idx - 200), idx + 200);
    expect(region).toMatch(/navigate\(['"]\/pet-parent\/home['"]\)/);
  });

  it('the "Pet Parent" primary tile has a data-testid tied to the option key', () => {
    // The map builds data-testid={`choosepath-${o.key}`} — for the
    // pet_parent option that resolves to "choosepath-pet_parent".
    expect(src).toMatch(/data-testid=\{`choosepath-\$\{o\.key\}`\}/);
    expect(src).toMatch(/key:\s*['"]pet_parent['"]/);
  });
});
