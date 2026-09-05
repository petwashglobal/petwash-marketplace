/**
 * persistenceAfterReload — the single most valuable assertion in this codebase.
 *
 * WHY THIS EXISTS
 * ---------------
 * A recurring defect class in this repo is the "fake mutation": a form or
 * toggle updates React state (and shows a success toast) but the value never
 * reaches the server — or reaches a server handler that does not persist it.
 * The UI looks perfect until the user reloads, at which point their change is
 * silently gone. `optimistic update + swallowed error` produces exactly this.
 *
 * A test that only asserts "the toast appeared" PASSES against that bug.
 * The only assertion that catches it is: mutate -> full reload -> re-assert
 * from a cold render that can only be populated by the server.
 *
 * USAGE
 * -----
 *   await expectPersistsAfterReload(page, {
 *     name: 'display name',
 *     mutate: async () => {
 *       await page.getByLabel(/display name/i).fill('Kenzo');
 *       await page.getByRole('button', { name: /save/i }).click();
 *     },
 *     assert: async () => {
 *       await expect(page.getByLabel(/display name/i)).toHaveValue('Kenzo');
 *     },
 *   });
 *
 * SAFETY
 * ------
 * This helper performs NO network stubbing of its own; the caller decides
 * whether the journey talks to a stubbed backend or a disposable test account.
 * Never point it at production money/PII surfaces.
 */
import { expect, type Page } from '@playwright/test';

export interface PersistenceCheck {
  /** Human label used in assertion messages, e.g. 'pet name'. */
  name: string;
  /** Perform the mutation (fill + submit). Should resolve once the UI settles. */
  mutate: () => Promise<void>;
  /**
   * Re-assert the mutated value is present. Runs TWICE: once immediately
   * after `mutate` (pre-reload) and once after a full reload. Must be
   * idempotent and must read from user-visible DOM, not from a JS variable.
   */
  assert: () => Promise<void>;
  /**
   * URL to return to after reload. Defaults to the page's current URL,
   * which is correct for in-place forms. Supply this when the mutation
   * navigates away (e.g. a wizard that advances to a summary step).
   */
  reloadTo?: string;
  /**
   * When true, the pre-reload assertion is skipped. Use for mutations whose
   * result is only rendered on a later screen.
   */
  skipPreReloadAssert?: boolean;
}

/**
 * Mutate -> assert -> hard reload -> assert again.
 *
 * Throws with an explicit "did not persist" message when the value survives
 * the optimistic render but not the reload, so a failure report names the
 * actual bug rather than a generic locator timeout.
 */
export async function expectPersistsAfterReload(
  page: Page,
  check: PersistenceCheck,
): Promise<void> {
  await check.mutate();

  if (!check.skipPreReloadAssert) {
    try {
      await check.assert();
    } catch (err) {
      throw new Error(
        `[persistence:${check.name}] the mutation did not even render ` +
          `optimistically — the submit likely failed outright.\n${String(err)}`,
      );
    }
  }

  // Hard reload. `waitUntil: 'load'` (not networkidle) — this is an SPA and
  // networkidle hangs on long-poll/WS connections (see the 2026-08-11
  // healthcheck incident where a monitor hung on exactly that).
  const target = check.reloadTo ?? page.url();
  await page.goto(target, { waitUntil: 'load' });

  try {
    await check.assert();
  } catch (err) {
    throw new Error(
      `[persistence:${check.name}] FAKE MUTATION — the value rendered before ` +
        `reload but is GONE after reload at ${target}. The change never ` +
        `reached durable storage (optimistic-only update, swallowed error, ` +
        `or a server handler that accepts the write and discards it).\n${String(err)}`,
    );
  }
}

/**
 * Lower-level variant: asserts a mutation reached the SERVER by replaying a
 * read request after the reload, independent of any client cache.
 *
 * Use when the UI does not surface the value plainly (e.g. a setting that only
 * changes behaviour). `readPath` is fetched with the page's own credentials.
 */
export async function expectPersistedOnServer(
  page: Page,
  opts: {
    name: string;
    mutate: () => Promise<void>;
    readPath: string;
    /** Return true when the server payload reflects the mutation. */
    matches: (body: unknown) => boolean;
  },
): Promise<void> {
  await opts.mutate();
  await page.goto(page.url(), { waitUntil: 'load' });

  const res = await page.request.get(opts.readPath);
  expect(
    res.ok(),
    `[persistence:${opts.name}] read-back ${opts.readPath} returned ${res.status()}`,
  ).toBeTruthy();

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(
      `[persistence:${opts.name}] read-back ${opts.readPath} did not return JSON`,
    );
  }

  expect(
    opts.matches(body),
    `[persistence:${opts.name}] FAKE MUTATION — server read-back at ` +
      `${opts.readPath} does not reflect the change after reload.`,
  ).toBeTruthy();
}
