/**
 * Behavioural test — nextBestActionFeedback service
 * (Journey Brain Phase 6 · post-release 2026-09-04).
 *
 * Real function calls against a mocked pg Pool. Pins:
 *
 *   1. isValidVerdict — closed enum, exact 4 accepted values.
 *   2. deriveActionKey — AttentionItem → `attn:<id>`;
 *      ResumeAction → `resume:<domain>`; garbage → null; NEVER
 *      leaks a payment-truth id even if the caller passes one.
 *   3. recordFeedback — happy path returns { id }; rejects empty
 *      uid, empty action key, over-length key, and invalid verdict.
 *   4. recentFeedback — happy path returns rows, filters by
 *      verdict, clamps lookback into [1, 90] days, fails-CLOSED
 *      to [] on pool throw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isValidVerdict,
  deriveActionKey,
  recordFeedback,
  recentFeedback,
  type FeedbackVerdict,
} from '../services/nextBestActionFeedback';

function makePoolQuery(rows: any[], throws = false) {
  return vi.fn(async () => {
    if (throws) throw new Error('simulated pg error');
    return { rows } as any;
  });
}

describe('nextBestActionFeedback · verdict enum', () => {
  it('accepts the exact 4 verdicts and rejects everything else', () => {
    expect(isValidVerdict('act')).toBe(true);
    expect(isValidVerdict('dismiss')).toBe(true);
    expect(isValidVerdict('not_interested')).toBe(true);
    expect(isValidVerdict('fewer_like_this')).toBe(true);
    expect(isValidVerdict('foo')).toBe(false);
    expect(isValidVerdict('')).toBe(false);
    expect(isValidVerdict(null)).toBe(false);
    expect(isValidVerdict(undefined)).toBe(false);
    expect(isValidVerdict(0)).toBe(false);
  });
});

describe('nextBestActionFeedback · deriveActionKey', () => {
  it('AttentionItem-shaped input → attn:<id>', () => {
    expect(deriveActionKey({ id: 'atn_1' })).toBe('attn:atn_1');
  });

  it('ResumeAction-shaped input → resume:<domain>', () => {
    expect(deriveActionKey({ kind: 'resume', domain: 'sitter_book' })).toBe(
      'resume:sitter_book',
    );
  });

  it('resume beats attn when both kind and id present (deterministic)', () => {
    expect(
      deriveActionKey({ kind: 'resume', domain: 'walk_book', id: 'atn_ignored' }),
    ).toBe('resume:walk_book');
  });

  it('garbage → null', () => {
    expect(deriveActionKey({} as any)).toBeNull();
    expect(deriveActionKey({ kind: 'resume' } as any)).toBeNull();
    expect(deriveActionKey({ kind: 'resume', domain: '' } as any)).toBeNull();
    expect(deriveActionKey(null as any)).toBeNull();
  });

  it('NEVER leaks a payment-truth id even if the caller passes one alongside', () => {
    // Even if the caller (bug) hands us chargeId or paidAt, the key
    // is derived from `id` (or `resume:<domain>`) — never from any
    // payment-truth field. The function only knows the two shapes.
    const key = deriveActionKey({
      id: 'atn_1',
      // @ts-expect-error — deliberately probing the leak surface
      chargeId: 'chg_leaky',
      // @ts-expect-error
      paidAt: '2026-09-04T00:00:00Z',
    });
    expect(key).toBe('attn:atn_1');
    expect(key).not.toMatch(/chg_leaky|paidAt/);
  });
});

describe('nextBestActionFeedback · recordFeedback', () => {
  it('happy path returns { id }', async () => {
    const pool = { query: makePoolQuery([{ id: 'fb_1' }]) } as any;
    const out = await recordFeedback(pool, {
      userUid: 'usr_1',
      actionKey: 'attn:atn_1',
      verdict: 'dismiss',
    });
    expect(out).toEqual({ id: 'fb_1' });
    expect(pool.query).toHaveBeenCalledOnce();
  });

  it('throws MISSING_USER_UID on empty uid', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    await expect(
      recordFeedback(pool, {
        userUid: '',
        actionKey: 'attn:atn_1',
        verdict: 'dismiss',
      }),
    ).rejects.toThrow('MISSING_USER_UID');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('throws MISSING_ACTION_KEY on empty key', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    await expect(
      recordFeedback(pool, { userUid: 'u', actionKey: '', verdict: 'act' }),
    ).rejects.toThrow('MISSING_ACTION_KEY');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('throws ACTION_KEY_TOO_LONG when key > 200 chars', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    await expect(
      recordFeedback(pool, {
        userUid: 'u',
        actionKey: 'x'.repeat(201),
        verdict: 'dismiss',
      }),
    ).rejects.toThrow('ACTION_KEY_TOO_LONG');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('throws INVALID_VERDICT on unknown verdict', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    await expect(
      recordFeedback(pool, {
        userUid: 'u',
        actionKey: 'attn:x',
        verdict: 'hackerman' as unknown as FeedbackVerdict,
      }),
    ).rejects.toThrow('INVALID_VERDICT');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('throws INSERT_FAILED when the pool returns no id', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    await expect(
      recordFeedback(pool, {
        userUid: 'u',
        actionKey: 'attn:x',
        verdict: 'act',
      }),
    ).rejects.toThrow('INSERT_FAILED');
  });
});

describe('nextBestActionFeedback · recentFeedback', () => {
  const nowDate = new Date('2026-09-04T00:00:00Z');

  it('happy path returns typed rows sorted DESC', async () => {
    const pool = {
      query: makePoolQuery([
        {
          id: 'fb_1',
          user_uid: 'usr_1',
          action_key: 'attn:atn_1',
          verdict: 'dismiss',
          created_at: nowDate,
        },
        {
          id: 'fb_2',
          user_uid: 'usr_1',
          action_key: 'resume:sitter_book',
          verdict: 'not_interested',
          created_at: nowDate,
        },
      ]),
    } as any;
    const rows = await recentFeedback(pool, {
      userUid: 'usr_1',
      lookbackDays: 30,
    });
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({
      id: 'fb_1',
      userUid: 'usr_1',
      actionKey: 'attn:atn_1',
      verdict: 'dismiss',
    });
  });

  it('returns [] for empty uid — never queries', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    const rows = await recentFeedback(pool, { userUid: '' });
    expect(rows).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns [] when the verdict filter is empty (nothing to match)', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    const rows = await recentFeedback(pool, {
      userUid: 'usr_1',
      verdicts: ['bogus' as unknown as FeedbackVerdict],
    });
    expect(rows).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('clamps lookbackDays into [1, 90]', async () => {
    const pool = { query: makePoolQuery([]) } as any;
    await recentFeedback(pool, { userUid: 'u', lookbackDays: -5 });
    await recentFeedback(pool, { userUid: 'u', lookbackDays: 9999 });
    const call1Args = pool.query.mock.calls[0][1];
    const call2Args = pool.query.mock.calls[1][1];
    expect(call1Args[1]).toBe(1);
    expect(call2Args[1]).toBe(90);
  });

  it('fails-CLOSED to [] on pool throw', async () => {
    const pool = { query: makePoolQuery([], true) } as any;
    const rows = await recentFeedback(pool, { userUid: 'usr_1' });
    expect(rows).toEqual([]);
  });
});
