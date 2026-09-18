/**
 * "Cannot find name" is code that cannot run (2026-09-19).
 *
 * esbuild does not resolve free identifiers, so a call to a name that does not
 * exist builds cleanly and throws ReferenceError the first time a real request
 * reaches it. Tests that never call that path stay green. Four shipped this way
 * and hid inside the ~2,100-error typecheck baseline:
 *
 *   walk-my-pet.ts            the walk pay route threw on every call (#2624)
 *   LedgerService.ts          opening a hold inserted into an unimported table
 *   publicAuthRoutes.ts       the identity probe threw on EVERY phone login and
 *                             its own catch swallowed it, so it looked healthy
 *   unifiedLocationWeather.ts the Google weather path called a helper nobody
 *                             ever wrote — /api/weather/* answered 500 live
 *
 * The real gate is scripts/typecheck-gate.mjs, which now fails on any TS2304
 * regardless of the baseline. These pins keep the three fixes honest cheaply.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('the ledger imports the table it writes to', () => {
  const src = R('server/services/LedgerService.ts');
  it('ledgerPendingTransfers is imported, not assumed', () => {
    expect(src).toMatch(/import \{[^}]*ledgerPendingTransfers[^}]*\} from '@shared\/schema-ledger-v2'/);
    expect(src).toMatch(/insert\(ledgerPendingTransfers\)/);
  });
});

describe('phone login records identity instead of throwing', () => {
  const src = R('server/routes/publicAuthRoutes.ts');
  it('the identity probe reads the email off the request, not a name that does not exist', () => {
    const block = src.slice(src.indexOf("await loginOrLink({"), src.indexOf("await loginOrLink({") + 600);
    expect(block).toMatch(/req\.body\?\.email/);
    expect(block).not.toMatch(/email: email \|\| null/);
  });
});

describe('the Google weather path has the helper it calls', () => {
  const src = R('server/services/unifiedLocationWeather.ts');
  it('generatePetWashRecommendation exists and is defined before use', () => {
    expect(src).toMatch(/function generatePetWashRecommendation\(/);
    expect(src).toMatch(/const recommendation = generatePetWashRecommendation\(/);
  });

  it('it returns the three fields the response reads', () => {
    const fn = src.slice(src.indexOf('function generatePetWashRecommendation('), src.indexOf('function getWeatherRecommendation('));
    for (const field of ['message', 'priority', 'actionAdvice']) {
      expect(fn, field).toMatch(new RegExp(`${field}:`));
    }
    // wet weather must never be advertised as a good time to wash a dog
    expect(fn).toMatch(/rain\|snow\|storm/);
    expect(fn).toMatch(/Not recommended/);
  });
});

describe('the typecheck gate refuses this class outright', () => {
  const gate = R('scripts/typecheck-gate.mjs');
  it('TS2304 fails the gate even when the total is under baseline', () => {
    expect(gate).toMatch(/error TS2304/);
    expect(gate).toMatch(/cannotFind\.length > 0/);
    const idx = gate.indexOf('const cannotFind');
    const baselineCmp = gate.indexOf('if (count > baseline)');
    expect(idx).toBeLessThan(baselineCmp); // checked before the baseline can forgive it
  });
});

describe('client screens call only what they have', () => {
  it('the provider task inbox uses the canonical status label, not a map that was deleted', () => {
    const src = R('client/src/pages/ProviderTaskInbox.tsx');
    // #1882 moved every screen onto @shared/lib/bookingStatusLabels and deleted
    // the page-local maps; this page kept rendering STATUS_LABEL[...] and threw
    // ReferenceError while drawing a provider's own task list.
    expect(src).toMatch(/import \{ bookingStatusLabel \} from '@shared\/lib\/bookingStatusLabels'/);
    expect(src).toMatch(/const \{ language \} = useLanguage\(\)/);
    expect(src).toMatch(/bookingStatusLabel\(b\.status, language\)/);
    expect(src).not.toMatch(/STATUS_LABEL\[/);
  });

  it('the trainer profile imports the fee split it prices with', () => {
    const src = R('client/src/pages/academy/TrainerProfile.tsx');
    expect(src).toMatch(/import \{ splitMarketplaceJob \} from '@shared\/marketplaceMoney'/);
    const importAt = src.indexOf("from '@shared/marketplaceMoney'");
    expect(importAt).toBeLessThan(src.indexOf('splitMarketplaceJob(Math.round'));
  });
});
