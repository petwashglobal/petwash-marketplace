/**
 * crossUserIdor — user A must not reach user B's resource.
 *
 * WHY THIS EXISTS
 * ---------------
 * IDOR is the highest-frequency confirmed security defect in this repo's
 * audit history: the walk-payment and chat IDORs, the contract-PII leak, the
 * wallet IDOR, and the `?status=` scope walk where a second `.where()` clause
 * silently OVERWROTE the ownership filter instead of narrowing it.
 *
 * That last one matters for how this helper is written. A route can look
 * authorised — it has a `requireAuth`, it has a `.where(ownerId)` — and still
 * leak, because a later clause replaced the scope. You cannot catch that by
 * reading the middleware list; you catch it by asking as the wrong user and
 * checking what comes back.
 *
 * WHAT COUNTS AS A PASS
 * ---------------------
 * 401 / 403 / 404 are all acceptable (404 is in fact preferable — it does not
 * confirm the id exists). What is NOT acceptable:
 *   - 200 with B's data                      -> straight IDOR
 *   - 200 with an empty/filtered body        -> ACCEPTED, but flagged, because
 *     it often means the handler scoped the query yet still admits the id;
 *     callers can opt into strict mode.
 *   - 500                                    -> flagged: an ownership check
 *     that throws is not an ownership check, and it leaks stack shape.
 *
 * SAFETY
 * ------
 * Read-only by default. `expectNoCrossUserWrite` DOES attempt a write as the
 * wrong user — only ever point it at a stubbed backend or disposable test
 * data, never production.
 */
import { expect, type Page, type APIResponse } from '@playwright/test';

/** Status codes that constitute a correct denial. */
export const DENY_STATUSES = [401, 403, 404, 410] as const;

export interface IdorProbe {
  /** Human label, e.g. 'GET /api/bookings/:id as another customer'. */
  name: string;
  /** Path containing user B's resource id. */
  path: string;
  /** HTTP method. Default GET. */
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Body for write probes. */
  body?: unknown;
  /** Headers identifying user A (the ATTACKER — not the owner). */
  attackerHeaders: Record<string, string>;
  /**
   * A fragment that must NOT appear in the response body — user B's email,
   * national id, phone, booking reference. Case-insensitive substring match
   * against the raw response text.
   */
  mustNotLeak?: string[];
  /**
   * When true, a 200 with an empty body is ALSO a failure. Use for
   * single-resource GETs where the only correct answer is a denial status.
   */
  strict?: boolean;
}

export interface IdorResult {
  status: number;
  denied: boolean;
  bodyText: string;
}

/**
 * Issues one cross-user request and asserts it was denied.
 */
export async function expectCrossUserDenied(
  page: Page,
  probe: IdorProbe,
): Promise<IdorResult> {
  const method = probe.method ?? 'GET';

  const res: APIResponse = await page.request.fetch(probe.path, {
    method,
    headers: probe.attackerHeaders,
    data: probe.body as never,
    failOnStatusCode: false,
  });

  const status = res.status();
  const bodyText = await res.text().catch(() => '');
  const denied = (DENY_STATUSES as readonly number[]).includes(status);

  // A 500 is never a valid ownership check.
  expect(
    status,
    `[idor:${probe.name}] ${method} ${probe.path} returned 500. An ownership ` +
      `check that throws is not an ownership check, and the error shape leaks ` +
      `implementation detail.`,
  ).not.toBe(500);

  // Whatever the status, B's data must never be in the body.
  for (const secret of probe.mustNotLeak ?? []) {
    expect(
      bodyText.toLowerCase(),
      `[idor:${probe.name}] LEAK — ${method} ${probe.path} returned ${status} ` +
        `and the body contains "${secret}", which belongs to another user.`,
    ).not.toContain(secret.toLowerCase());
  }

  if (probe.strict) {
    expect(
      denied,
      `[idor:${probe.name}] ${method} ${probe.path} returned ${status}; a ` +
        `cross-user request for a single resource must be denied ` +
        `(${DENY_STATUSES.join('/')}).`,
    ).toBeTruthy();
  } else if (!denied) {
    // Non-strict: a 200 is tolerated only when the payload is demonstrably empty.
    const looksEmpty =
      bodyText.trim() === '' ||
      /^\s*(\[\s*\]|\{\s*\}|null|\{"data"\s*:\s*(\[\s*\]|null)\s*\})\s*$/i.test(bodyText);
    expect(
      looksEmpty,
      `[idor:${probe.name}] ${method} ${probe.path} returned ${status} with a ` +
        `non-empty body for a resource owned by another user.\n` +
        `First 400 chars: ${bodyText.slice(0, 400)}`,
    ).toBeTruthy();
  }

  return { status, denied, bodyText };
}

/**
 * Write-probe: user A attempts to MUTATE user B's resource.
 *
 * Denial status alone is not enough here — a handler can return 403 after
 * having already written. Pass `verifyUnchanged` to read the resource back as
 * its real owner and confirm nothing moved.
 */
export async function expectNoCrossUserWrite(
  page: Page,
  probe: IdorProbe & {
    /** Reads the resource as its true owner; must show the pre-state. */
    verifyUnchanged?: () => Promise<void>;
  },
): Promise<void> {
  await expectCrossUserDenied(page, { ...probe, strict: true });
  if (probe.verifyUnchanged) {
    try {
      await probe.verifyUnchanged();
    } catch (err) {
      throw new Error(
        `[idor:${probe.name}] the write was REJECTED with a denial status but ` +
          `the resource changed anyway — the ownership check runs after the ` +
          `mutation.\n${String(err)}`,
      );
    }
  }
}

/**
 * Sweeps a list of paths as one attacker persona. Collects every failure and
 * reports them together, so one run enumerates the whole leak surface instead
 * of stopping at the first hit.
 */
export async function sweepCrossUserDenied(
  page: Page,
  probes: IdorProbe[],
): Promise<void> {
  const failures: string[] = [];
  for (const probe of probes) {
    try {
      await expectCrossUserDenied(page, probe);
    } catch (err) {
      failures.push(String(err instanceof Error ? err.message : err));
    }
  }
  expect(
    failures,
    `${failures.length} of ${probes.length} cross-user probes leaked:\n\n` +
      failures.join('\n\n'),
  ).toEqual([]);
}
