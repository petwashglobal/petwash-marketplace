/**
 * executeAction — behavior pins
 * (Action Brain Doctrine §5, §8, §9, §10, §39, §54, §62, §93).
 *
 * The heart of the doctrine: what happens between "user tapped
 * Confirm" and "server mutated state". A regression that breaks
 * idempotency, stale-preview handling, or the reauth gate ships a bug
 * that the doctrine explicitly forbids.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createInMemoryStore,
  executeAction,
  type ActionStateStore,
  type ExecuteActionInput,
} from '../../shared/marketplace/actionExecution';
import type { ActionPreview } from '../../shared/marketplace/action';
import { generateIdempotencyKey } from '../../shared/marketplace/action';

function baseInput(
  overrides: Partial<ExecuteActionInput> = {},
): ExecuteActionInput {
  return {
    actorUid: 'sarah',
    actionType: 'BOOKING_CANCEL_PAID',
    entityId: 'bkg_1',
    idempotencyKey: generateIdempotencyKey(new Date(1_000_000)),
    previewVersion: 'v1',
    impact: { moneyCents: 45000, affectsOtherParty: true },
    riskLevel: 'L3',
    confirmationLevel: 'EXPLICIT_CONFIRM',
    reauthProven: false,
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

// ── Idempotency ───────────────────────────────────────────────────────

describe('idempotency (§8) — repeated executes replay original', () => {
  it('same key + actor + type → replayed flag true; handler runs ONLY once', async () => {
    const store = createInMemoryStore();
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
    const store = createInMemoryStore();
    const key = generateIdempotencyKey();
    const h1 = vi.fn(async () => ({ status: 'SUCCEEDED' as const, userMessage: { code: 'OK' as const }, nextActions: [] }));
    const h2 = vi.fn(async () => ({ status: 'SUCCEEDED' as const, userMessage: { code: 'OK' as const }, nextActions: [] }));

    await executeAction(baseInput({ actorUid: 'sarah', idempotencyKey: key, handler: h1 }), store, CLOCK);
    await executeAction(baseInput({ actorUid: 'david', idempotencyKey: key, handler: h2 }), store, CLOCK);

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });
});

// ── Confirmation-policy match ─────────────────────────────────────────

describe('confirmation-policy match (§5)', () => {
  it('client-supplied confirmationLevel that disagrees with resolveConfirmation → STALE_PREVIEW', async () => {
    const store = createInMemoryStore();
    // Client claims LIGHT_CONFIRM, but risk+impact says REVIEW_SCREEN.
    const input = baseInput({
      riskLevel: 'L2',
      impact: { moneyCents: 5000 },
      confirmationLevel: 'LIGHT_CONFIRM',
    });
    const { result, replayed } = await executeAction(input, store, CLOCK);
    expect(replayed).toBe(false);
    expect(result.status).toBe('STALE');
    expect(result.userMessage.code).toBe('STALE_PREVIEW');
  });

  it('matching confirmationLevel → proceeds', async () => {
    const store = createInMemoryStore();
    const input = baseInput({
      riskLevel: 'L2',
      impact: { moneyCents: 5000 },
      confirmationLevel: 'REVIEW_SCREEN',
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
  });
});

// ── REAUTH gate ───────────────────────────────────────────────────────

describe('reauth gate (§62)', () => {
  it('L4 REAUTH_AND_CONFIRM without proof → REAUTH_REQUIRED', async () => {
    const store = createInMemoryStore();
    const input = baseInput({
      riskLevel: 'L4',
      impact: {},
      confirmationLevel: 'REAUTH_AND_CONFIRM',
      reauthProven: false,
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('FAILED');
    expect(result.userMessage.code).toBe('REAUTH_REQUIRED');
  });

  it('L4 REAUTH_AND_CONFIRM WITH proof → proceeds', async () => {
    const store = createInMemoryStore();
    const input = baseInput({
      riskLevel: 'L4',
      impact: {},
      confirmationLevel: 'REAUTH_AND_CONFIRM',
      reauthProven: true,
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
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
    const store = createInMemoryStore(
      new Map([[`BOOKING_CANCEL_PAID::bkg_1`, fresh]]),
    );
    const input = baseInput({
      previewVersion: 'v-stale',
      entityForFreshPreview: 'bkg_1',
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('STALE');
    expect(result.userMessage.code).toBe('QUOTE_CHANGED');
  });

  it('preview version matches → proceeds', async () => {
    const fresh: ActionPreview = {
      actionType: 'BOOKING_CANCEL_PAID',
      title: '',
      summary: '',
      affectedEntities: [],
      warnings: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      previewVersion: 'v1',
    };
    const store = createInMemoryStore(
      new Map([[`BOOKING_CANCEL_PAID::bkg_1`, fresh]]),
    );
    const input = baseInput({
      previewVersion: 'v1',
      entityForFreshPreview: 'bkg_1',
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
  });

  it('no fresh preview available → skips stale check', async () => {
    const store = createInMemoryStore();
    const input = baseInput({ previewVersion: 'v-anything', entityForFreshPreview: 'bkg_1' });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('SUCCEEDED');
  });
});

// ── Handler throw → canonical failure ─────────────────────────────────

describe('handler exceptions map to UNKNOWN (§93)', () => {
  it('thrown error → FAILED with UNKNOWN reason code (never raw error text)', async () => {
    const store = createInMemoryStore();
    const input = baseInput({
      handler: async () => {
        throw new Error('database exploded');
      },
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.status).toBe('FAILED');
    expect(result.userMessage.code).toBe('UNKNOWN');
    // Raw error message MUST NOT leak into userMessage.
    expect(JSON.stringify(result.userMessage)).not.toMatch(/database exploded/);
  });
});

// ── ActionResult stamping ─────────────────────────────────────────────

describe('every successful result carries actionId + auditRef + correlationId (§39)', () => {
  it('handler outcome + framework stamp assembled correctly', async () => {
    const store = createInMemoryStore();
    const input = baseInput({
      correlationId: 'corr_abc',
      handler: async () => ({
        status: 'SUCCEEDED',
        newState: 'CANCELLED',
        userMessage: { code: 'OK' },
        nextActions: ['SUPPORT_CONTACT_OPEN'],
      }),
    });
    const { result } = await executeAction(input, store, CLOCK);
    expect(result.actionId).toMatch(/^act_/);
    expect(result.auditRef).toMatch(/^aud_act_/);
    expect(result.correlationId).toBe('corr_abc');
    expect(result.nextActions).toEqual(['SUPPORT_CONTACT_OPEN']);
  });
});
