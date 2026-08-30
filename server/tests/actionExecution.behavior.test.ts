/**
 * executeAction — behavior pins (Action Brain Doctrine §5, §8, §9, §10,
 * §39, §54, §62, §93 + SECURITY CORRECTION 2026-08-30 §1–§7).
 *
 * The heart of the doctrine: what happens between "user tapped
 * Confirm" and "server mutated state". Every gate here MUST derive
 * from server-side facts — a client-controlled `impact` / `reauthProven`
 * would break the whole model.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createInMemoryTestOnlyStore,
  executeAction,
  isReauthFresh,
  type ExecuteActionInput,
} from '../../shared/marketplace/actionExecution';
import type { ActionPreview, ImpactSignals } from '../../shared/marketplace/action';
import { generateIdempotencyKey } from '../../shared/marketplace/action';

function baseInput(
  overrides: Partial<ExecuteActionInput> = {},
  impact: ImpactSignals = { moneyCents: 45000, affectsOtherParty: true },
): ExecuteActionInput {
  return {
    actionType: 'BOOKING_CANCEL_PAID',
    entityId: 'bkg_1',
    idempotencyKey: generateIdempotencyKey(new Date(1_000_000)),
    previewVersion: 'v1',
    authContext: { actorUid: 'sarah' },
    riskLevel: 'L3',
    confirmationLevel: 'EXPLICIT_CONFIRM',
    deriveImpact: async () => impact,
    correlationId: 'corr_1',
    handler: async () => ({
      status: 'SUCCEEDED',
      newState: 'CANCELLED',
      userMessage: { code: 'OK' },
      nextActions: ['SUPPORT_CONTACT_OPEN'],
    }),
    ...overrides,
  };
}

const CLOCK = { now: () => new Date('2026-08-30T12:00:00Z') };

// ── Server-derived security (CEO §1, §2) ─────────────────────────────

describe('security — client cannot declare its own security posture', () => {
  it('ExecuteActionInput has NO impact / reauthProven fields — only server-derived', () => {
    // Type-level enforcement — this test compiles only when the fields
    // aren't part of the input contract. If a refactor reintroduces
    // them, this test file breaks the build.
    const input = baseInput();
    // @ts-expect-error impact is derived server-side, never accepted from input
    input.impact = { moneyCents: 0 };
    // @ts-expect-error reauthProven is derived server-side, never accepted
    input.reauthProven = true;
  });
});

// ── Idempotency (CEO §6 atomic claim) ─────────────────────────────────

describe('idempotency (§8, §6) — atomic claim, no race', () => {
  it('same key + actor + type → replayed:true; handler runs ONLY once', async () => {
    const store = createInMemoryTestOnlyStore();
    const handler = vi.fn(async () => ({
      status: 'SUCCEEDED' as const,
      userMessage: { code: 'OK' as const },
      nextActions: [],
    }));
    const input = baseInput({ handler });

    const first = await executeAction(input, store, CLOCK);
    const second = await executeAction(input, store, CLOCK);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.result.actionId).toBe(first.result.actionId);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('different actor + same key → NOT replayed (actor scoping)', async () => {
    const store = createInMemoryTestOnlyStore();
    const key = generateIdempotencyKey();
    const h1 = vi.fn(async () => ({ status: 'SUCCEEDED' as const, userMessage: { code: 'OK' as const }, nextActions: [] }));
    const h2 = vi.fn(async () => ({ status: 'SUCCEEDED' as const, userMessage: { code: 'OK' as const }, nextActions: [] }));

    await executeAction(baseInput({ authContext: { actorUid: 'sarah' }, idempotencyKey: key, handler: h1 }), store, CLOCK);
    await executeAction(baseInput({ authContext: { actorUid: 'david' }, idempotencyKey: key, handler: h2 }), store, CLOCK);

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });
});

// ── Confirmation-policy match ─────────────────────────────────────────

describe('confirmation-policy match (§5) — server-derived impact', () => {
  it('impact resolves to higher level than catalog claimed → STALE_PREVIEW', async () => {
    const store = createInMemoryTestOnlyStore();
    // Server derives money>0 → resolveConfirmation says REVIEW_SCREEN;
    // catalog says LIGHT_CONFIRM. Executor refuses.
    const input = baseInput({
      riskLevel: 'L2',
      confirmationLevel: 'LIGHT_CONFIRM',
      deriveImpact: async () => ({ moneyCents: 5000 }),
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('STALE');
    expect(result.userMessage.code).toBe('STALE_PREVIEW');
  });

  it('matching level → proceeds', async () => {
    const store = createInMemoryTestOnlyStore();
    const input = baseInput({
      riskLevel: 'L2',
      confirmationLevel: 'REVIEW_SCREEN',
      deriveImpact: async () => ({ moneyCents: 5000 }),
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
  });
});

// ── REAUTH gate — server-derived (CEO §2) ────────────────────────────

describe('reauth gate (§62) — server-derived from authContext.recentReauthAt', () => {
  it('L4 with NO recentReauthAt → REAUTH_REQUIRED (idempotency store not touched)', async () => {
    const store = createInMemoryTestOnlyStore();
    const claim = vi.spyOn(store, 'claim');
    const input = baseInput({
      riskLevel: 'L4',
      confirmationLevel: 'REAUTH_AND_CONFIRM',
      authContext: { actorUid: 'sarah' }, // no recentReauthAt
      deriveImpact: async () => ({}),
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('FAILED');
    expect(result.userMessage.code).toBe('REAUTH_REQUIRED');
    expect(claim).not.toHaveBeenCalled();
  });

  it('L4 with fresh recentReauthAt → proceeds', async () => {
    const store = createInMemoryTestOnlyStore();
    const input = baseInput({
      riskLevel: 'L4',
      confirmationLevel: 'REAUTH_AND_CONFIRM',
      // 1 minute before NOW — inside default 5-minute window.
      authContext: {
        actorUid: 'sarah',
        recentReauthAt: '2026-08-30T11:59:00Z',
      },
      deriveImpact: async () => ({}),
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
  });

  it('L4 with stale recentReauthAt (>5 min) → REAUTH_REQUIRED', async () => {
    const store = createInMemoryTestOnlyStore();
    const input = baseInput({
      riskLevel: 'L4',
      confirmationLevel: 'REAUTH_AND_CONFIRM',
      authContext: {
        actorUid: 'sarah',
        recentReauthAt: '2026-08-30T11:50:00Z', // 10 min old
      },
      deriveImpact: async () => ({}),
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.userMessage.code).toBe('REAUTH_REQUIRED');
  });

  it('per-deployment reauth window override honoured', async () => {
    const store = createInMemoryTestOnlyStore();
    const input = baseInput({
      riskLevel: 'L4',
      confirmationLevel: 'REAUTH_AND_CONFIRM',
      // 20 min old
      authContext: { actorUid: 'sarah', recentReauthAt: '2026-08-30T11:40:00Z' },
      deriveImpact: async () => ({}),
      reauthWindowSeconds: 60 * 60, // 60 min — override allows this reauth
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
  });
});

// ── isReauthFresh helper ─────────────────────────────────────────────

describe('isReauthFresh helper', () => {
  const now = new Date('2026-08-30T12:00:00Z');
  it('no recentReauthAt → false', () => {
    expect(isReauthFresh({ actorUid: 's' }, now)).toBe(false);
  });
  it('within default window → true', () => {
    expect(isReauthFresh({ actorUid: 's', recentReauthAt: '2026-08-30T11:57:00Z' }, now)).toBe(true);
  });
  it('past default window → false', () => {
    expect(isReauthFresh({ actorUid: 's', recentReauthAt: '2026-08-30T11:50:00Z' }, now)).toBe(false);
  });
  it('invalid timestamp → false', () => {
    expect(isReauthFresh({ actorUid: 's', recentReauthAt: 'not-a-date' }, now)).toBe(false);
  });
});

// ── Stale-preview handshake ───────────────────────────────────────────

describe('stale-preview handshake (§10)', () => {
  it('preview version drift → STALE with QUOTE_CHANGED', async () => {
    const fresh: ActionPreview = {
      actionType: 'BOOKING_CANCEL_PAID',
      title: 'Cancel booking',
      summary: 'Refund preview refreshed',
      affectedEntities: [],
      warnings: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      previewVersion: 'v-fresh',
    };
    const store = createInMemoryTestOnlyStore(
      new Map([[`BOOKING_CANCEL_PAID::bkg_1`, fresh]]),
    );
    const input = baseInput({
      previewVersion: 'v-stale',
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('STALE');
    expect(result.userMessage.code).toBe('QUOTE_CHANGED');
  });
});

// ── Handler throw → canonical failure ─────────────────────────────────

describe('handler exceptions map to UNKNOWN (§93)', () => {
  it('thrown error → FAILED with UNKNOWN reason code (never raw error text)', async () => {
    const store = createInMemoryTestOnlyStore();
    const input = baseInput({
      handler: async () => {
        throw new Error('database exploded');
      },
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('FAILED');
    expect(result.userMessage.code).toBe('UNKNOWN');
    expect(JSON.stringify(result.userMessage)).not.toMatch(/database exploded/);
  });
});
