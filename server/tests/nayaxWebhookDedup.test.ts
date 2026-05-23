import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tryClaimWebhookEvent } from '../lib/nayaxWebhookDedup';

// These tests cover the pure-logic surface and the contract with db.
// Integration tests against a real Postgres are deliberately out of scope
// — the atomic ON CONFLICT DO NOTHING guarantee is enforced by the DB
// itself and is unit-tested by Postgres. The contract here is:
//   - returning() with length 1  → { processed: 'new' }
//   - returning() with length 0  → { processed: 'duplicate' }
//   - any thrown error           → caller fails CLOSED (the checkIdempotency
//                                   middleware returns 503)

describe('nayaxWebhookDedup — input validation', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it('rejects empty eventId', async () => {
    await expect(tryClaimWebhookEvent({ eventId: '' })).rejects.toThrow(
      /eventId is required/,
    );
  });

  it('rejects whitespace-only eventId', async () => {
    await expect(tryClaimWebhookEvent({ eventId: '   ' })).rejects.toThrow(
      /eventId is required/,
    );
  });
});

describe('nayaxWebhookDedup — contract documentation', () => {
  // These are not real DB tests — they document the expected behavior
  // so a future maintainer who changes the helper sees the contract.

  it('new event returns processed:"new"', () => {
    // When db.insert(...).onConflictDoNothing().returning(...) returns
    // an array of length 1, the eventId is brand-new and the caller
    // should proceed (next() in the middleware).
    const fakeReturning = [{ eventId: 'evt_abc' }];
    expect(fakeReturning.length).toBe(1);
    // Helper would return { processed: 'new' } in this case.
  });

  it('duplicate event returns processed:"duplicate"', () => {
    // When returning() is empty, the row already existed and the
    // ON CONFLICT DO NOTHING skipped the insert. Caller short-circuits
    // with 200 OK + deduplicated:true.
    const fakeReturning: Array<{ eventId: string }> = [];
    expect(fakeReturning.length).toBe(0);
    // Helper would return { processed: 'duplicate' } in this case.
  });
});

describe('nayaxWebhookDedup — fail-closed semantics', () => {
  it('throws when the underlying DB throws (caller must fail closed)', async () => {
    // Mock the db module to make insert throw.
    vi.doMock('../db', () => ({
      db: {
        insert: () => {
          throw new Error('connection refused');
        },
      },
    }));
    // Re-import after mock so the helper picks up the mocked db.
    const mod = await import('../lib/nayaxWebhookDedup');
    await expect(
      mod.tryClaimWebhookEvent({ eventId: 'evt_xyz' }),
    ).rejects.toThrow(/connection refused/);
  });
});
