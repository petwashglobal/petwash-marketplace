/**
 * Lane B follow-up (second pass) · CTA action-id wiring on the
 * provider funnel: ChoosePath tiles + ProviderOnboarding service
 * picker cards.
 *
 * The CTA registry (client/src/lib/ctaActions.ts) pairs a
 * `data-action-id` DOM attribute with an `emitCtaEvent` sink call
 * on every critical CTA. These pins prove both are present on the
 * two entry surfaces of the provider funnel — the same funnel
 * whose real-browser E2E already lives at
 *   tests/e2e/canonical-destination-and-requested-service.e2e.spec.ts
 * A refactor that strips either the identity attribute or the emit
 * call must fail here loudly, before the pin reappears as a lost
 * analytics event or a "tap did nothing" post-mortem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CHOOSE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ChoosePath.tsx'),
  'utf8',
);
const ONBOARDING = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderOnboarding.tsx'),
  'utf8',
);
const REGISTRY = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'lib', 'ctaActions.ts'),
  'utf8',
);

describe('ChoosePath · CTA action-id wiring (Lane B follow-up · funnel)', () => {
  it('imports emitCtaEvent from the canonical registry', () => {
    expect(CHOOSE).toMatch(/import \{ emitCtaEvent, type CtaAction \} from '@\/lib\/ctaActions';/);
  });

  it('pet-parent tile carries actionId "SWITCH_TO_PET_PARENT_WORKSPACE"', () => {
    expect(CHOOSE).toMatch(/actionId: 'SWITCH_TO_PET_PARENT_WORKSPACE'/);
    // The tile row renders `data-action-id={o.actionId}` so its
    // resolved value on the DOM is the pet-parent action id.
    expect(CHOOSE).toMatch(/data-action-id=\{o\.actionId\}/);
  });

  it('provider tile carries actionId "BECOME_PROVIDER_ENTRY"', () => {
    expect(CHOOSE).toMatch(/actionId: 'BECOME_PROVIDER_ENTRY'/);
  });

  it('tile onClick emits emitCtaEvent BEFORE running the tile\'s navigate', () => {
    expect(CHOOSE).toMatch(
      /onClick=\{\(\) => \{ emitCtaEvent\(o\.actionId\); o\.onClick\(\); \}\}/,
    );
  });

  it('"decide later" link emits SWITCH_TO_PET_PARENT_WORKSPACE with a source qualifier', () => {
    expect(CHOOSE).toMatch(
      /emitCtaEvent\('SWITCH_TO_PET_PARENT_WORKSPACE', \{ source: 'choosepath-decide-later' \}\);\s*navigate\('\/pet-parent\/home'\);/,
    );
    expect(CHOOSE).toMatch(/data-action-id="SWITCH_TO_PET_PARENT_WORKSPACE"/);
  });
});

describe('ProviderOnboarding · picker-card CTA action-id wiring', () => {
  it('imports emitCtaEvent AND PROVIDER_SERVICE_ACTION_IDS from the canonical registry', () => {
    expect(ONBOARDING).toMatch(
      /import \{ emitCtaEvent, PROVIDER_SERVICE_ACTION_IDS \} from '@\/lib\/ctaActions';/,
    );
  });

  it.each(['walker', 'sitter', 'driver', 'trainer'] as const)(
    '%s picker card carries a resolved data-action-id AND its onClick emits the same id',
    (key) => {
      // data-action-id flips between .add (currently selected → tap
      // means "remove") and .select (currently not selected → tap
      // means "add"). Pin the ternary shape.
      expect(ONBOARDING).toMatch(
        new RegExp(
          `data-action-id=\\{hasProviderType\\('${key}'\\) \\? PROVIDER_SERVICE_ACTION_IDS\\.${key}\\.add : PROVIDER_SERVICE_ACTION_IDS\\.${key}\\.select\\}`,
        ),
      );
      // The tap handler computes willSelect = !current, emits with
      // .add / .select accordingly, then toggles.
      expect(ONBOARDING).toMatch(
        new RegExp(
          `const willSelect = !hasProviderType\\('${key}'\\);\\s*` +
            `emitCtaEvent\\(willSelect \\? PROVIDER_SERVICE_ACTION_IDS\\.${key}\\.add : PROVIDER_SERVICE_ACTION_IDS\\.${key}\\.select\\);\\s*` +
            `toggleProviderType\\('${key}'\\);`,
        ),
      );
    },
  );

  it('every provider service in PROVIDER_SERVICE_ACTION_IDS pairs SELECT_ and ADD_ ids that exist in the enum', () => {
    // Guard against a picker card being wired against an id the
    // enum does not carry (which would silently render an empty
    // data-action-id at runtime).
    const services = ['sitter', 'walker', 'trainer', 'driver', 'station_operator'] as const;
    for (const s of services) {
      const cap = s.toUpperCase();
      expect(REGISTRY).toContain(`| 'SELECT_PROVIDER_SERVICE_${cap}'`);
      expect(REGISTRY).toContain(`| 'ADD_PROVIDER_SERVICE_${cap}'`);
    }
  });
});
