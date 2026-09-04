/**
 * Behavioural test — composeNextBestAction (Journey Brain Phase 4).
 *
 * Real function calls against mocked composeAttentionFeed +
 * listActiveCheckpoints. Pins the selection rules AND the
 * fail-CLOSED contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the two data sources with a fixture we control per test.
const mockFeedItems: any[] = [];
const mockCheckpoints: any[] = [];
const mockSuppressedRows: any[] = [];
let composeFeedThrows = false;
let listCheckpointsThrows = false;

vi.mock('../services/attentionFeed', () => ({
  composeAttentionFeed: vi.fn(async () => {
    if (composeFeedThrows) throw new Error('feed outage');
    return {
      actor: 'pet_parent',
      items: mockFeedItems,
      composedAt: new Date().toISOString(),
    };
  }),
}));

vi.mock('../services/journeyCheckpoints', async () => {
  const actual = await vi.importActual<typeof import('../services/journeyCheckpoints')>(
    '../services/journeyCheckpoints',
  );
  return {
    ...actual,
    listActiveCheckpoints: vi.fn(async () => {
      if (listCheckpointsThrows) throw new Error('checkpoints outage');
      return mockCheckpoints;
    }),
  };
});

vi.mock('../services/nextBestActionFeedback', async () => {
  const actual = await vi.importActual<typeof import('../services/nextBestActionFeedback')>(
    '../services/nextBestActionFeedback',
  );
  return {
    ...actual,
    recentFeedback: vi.fn(async () => mockSuppressedRows.slice()),
  };
});

// Import AFTER mocks so the module binds to the mocked versions.
import { composeNextBestAction } from '../services/nextBestAction';

beforeEach(() => {
  mockFeedItems.length = 0;
  mockCheckpoints.length = 0;
  mockSuppressedRows.length = 0;
  composeFeedThrows = false;
  listCheckpointsThrows = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeFeedItem(priority: 'urgent' | 'due_soon' | 'informational', id = 'x', extras: Record<string, any> = {}) {
  return {
    id,
    actor: 'pet_parent' as const,
    domain: 'booking' as const,
    entityId: id,
    priority,
    title: `t-${id}`,
    reason: `r-${id}`,
    nextAction: 'view' as const,
    destination: `/x/${id}`,
    ...extras,
  };
}

function makeCheckpoint(domain: string, mins: number, id = `chk-${domain}`) {
  const now = Date.now();
  return {
    id,
    userUid: 'usr_a',
    domain,
    payload: { step: 1 },
    expiresAt: new Date(now + 72 * 3600 * 1000),
    createdAt: new Date(now - mins * 60_000),
    updatedAt: new Date(now - mins * 60_000),
  };
}

describe('composeNextBestAction · selection rules', () => {
  it('returns empty projection when userUid is empty (fail-safe)', async () => {
    const r = await composeNextBestAction({} as any, { userUid: '', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toBeNull();
    expect(r.secondaryActions).toEqual([]);
  });

  it('quiet home → primaryAction null, secondaryActions empty', async () => {
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toBeNull();
    expect(r.secondaryActions).toEqual([]);
  });

  it('an urgent attention item ALWAYS beats a resume hint', async () => {
    mockFeedItems.push(makeFeedItem('urgent', 'pay-me'));
    mockCheckpoints.push(makeCheckpoint('sitter_book', 5)); // mid-flow draft
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toMatchObject({ id: 'pay-me', priority: 'urgent' });
    // The resume hint is still surfaced as a secondary action.
    expect(r.secondaryActions.some((x: any) => x.kind === 'resume' && x.domain === 'sitter_book')).toBe(true);
  });

  it('no urgent → most-recent resume hint becomes primary (beats due_soon)', async () => {
    mockFeedItems.push(makeFeedItem('due_soon', 'confirm-me'));
    // Two checkpoints — the more recently updated one wins.
    mockCheckpoints.push(makeCheckpoint('walk_book', 60)); // older
    mockCheckpoints.push(makeCheckpoint('sitter_book', 5)); // newer
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toMatchObject({ kind: 'resume', domain: 'sitter_book' });
    // The due_soon booking is a secondary action.
    expect(r.secondaryActions.some((x: any) => x.id === 'confirm-me')).toBe(true);
  });

  it('no urgent, no resume → the top due_soon attention item is primary', async () => {
    mockFeedItems.push(makeFeedItem('due_soon', 'first'));
    mockFeedItems.push(makeFeedItem('informational', 'later'));
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toMatchObject({ id: 'first', priority: 'due_soon' });
    expect(r.secondaryActions.some((x: any) => x.id === 'later')).toBe(true);
  });

  it('unknown checkpoint domain (future release) is skipped silently — never a dead URL', async () => {
    mockCheckpoints.push(makeCheckpoint('brand_new_domain_from_future_release' as any, 1));
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toBeNull();
    expect(r.secondaryActions).toEqual([]);
  });

  it('resume-action shape carries destination, title, reason, updatedAt, checkpointId — never payment truth', async () => {
    mockCheckpoints.push(makeCheckpoint('marketplace_book', 2, 'chk-abc'));
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: false });
    const primary = r.primaryAction as any;
    expect(primary.kind).toBe('resume');
    expect(primary.destination).toBe('/marketplace');
    expect(primary.title).toBe('Resume your marketplace booking');
    expect(primary.reason).toBe('We saved where you left off — pick up from the same spot.');
    expect(primary.checkpointId).toBe('chk-abc');
    // Never any of these keys on a resume action.
    for (const k of ['chargeId', 'paidAt', 'refundId', 'fiscalDocumentNumber', 'payload']) {
      expect(primary).not.toHaveProperty(k);
    }
  });

  it('HE / EN locale switching flips title + reason', async () => {
    mockCheckpoints.push(makeCheckpoint('walk_book', 1));
    const he = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect((he.primaryAction as any).title).toContain('הזמנת הליכה');
    expect((he.primaryAction as any).reason).toContain('שמרנו את המקום');
    const en = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: false });
    expect((en.primaryAction as any).title).toContain('walk booking');
    expect((en.primaryAction as any).reason).toContain('We saved where you left off');
  });
});

describe('composeNextBestAction · Phase 6 suppression (not_interested cooldown)', () => {
  it('a suppressed attention id (attn:<id>) never becomes primary even if urgent', async () => {
    mockFeedItems.push(makeFeedItem('urgent', 'pay-me'));
    mockFeedItems.push(makeFeedItem('due_soon', 'confirm-me'));
    mockSuppressedRows.push({
      id: 'fb_1',
      userUid: 'usr_a',
      actionKey: 'attn:pay-me',
      verdict: 'not_interested',
      createdAt: new Date(),
    });
    const r = await composeNextBestAction({} as any, {
      userUid: 'usr_a',
      actor: 'pet_parent',
      he: true,
    });
    // Urgent 'pay-me' was suppressed; the next non-suppressed item is due_soon 'confirm-me'.
    expect(r.primaryAction).toMatchObject({ id: 'confirm-me' });
    // The suppressed item never appears in secondaryActions either.
    expect(r.secondaryActions.some((x: any) => x.id === 'pay-me')).toBe(false);
  });

  it('a suppressed resume domain (resume:<domain>) never becomes primary', async () => {
    mockCheckpoints.push(makeCheckpoint('sitter_book', 1)); // suppressed
    mockCheckpoints.push(makeCheckpoint('walk_book', 5));   // still eligible
    mockSuppressedRows.push({
      id: 'fb_2',
      userUid: 'usr_a',
      actionKey: 'resume:sitter_book',
      verdict: 'not_interested',
      createdAt: new Date(),
    });
    const r = await composeNextBestAction({} as any, {
      userUid: 'usr_a',
      actor: 'pet_parent',
      he: true,
    });
    // sitter_book suppressed → the next resume (walk_book) is primary.
    expect(r.primaryAction).toMatchObject({ kind: 'resume', domain: 'walk_book' });
    // sitter_book NEVER appears anywhere in the projection.
    expect(
      r.secondaryActions.some((x: any) => x.kind === 'resume' && x.domain === 'sitter_book'),
    ).toBe(false);
  });

  it('empty suppression set → normal selection rules (no false suppressions)', async () => {
    mockFeedItems.push(makeFeedItem('urgent', 'pay-me'));
    const r = await composeNextBestAction({} as any, {
      userUid: 'usr_a',
      actor: 'pet_parent',
      he: true,
    });
    expect(r.primaryAction).toMatchObject({ id: 'pay-me' });
  });

  it('suppression on unrelated key → does NOT affect the primary', async () => {
    mockFeedItems.push(makeFeedItem('urgent', 'pay-me'));
    mockSuppressedRows.push({
      id: 'fb_x',
      userUid: 'usr_a',
      actionKey: 'attn:some_other_id',
      verdict: 'not_interested',
      createdAt: new Date(),
    });
    const r = await composeNextBestAction({} as any, {
      userUid: 'usr_a',
      actor: 'pet_parent',
      he: true,
    });
    expect(r.primaryAction).toMatchObject({ id: 'pay-me' });
  });
});

describe('composeNextBestAction · fail-CLOSED', () => {
  it('a composeAttentionFeed throw returns empty projection (never a 500 to the caller)', async () => {
    composeFeedThrows = true;
    mockCheckpoints.push(makeCheckpoint('sitter_book', 1));
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    // Empty projection — the composer bails.
    expect(r.primaryAction).toBeNull();
    expect(r.secondaryActions).toEqual([]);
    // composedAt still set — client can still tell "we tried".
    expect(typeof r.composedAt).toBe('string');
  });

  it('a listActiveCheckpoints throw returns empty projection (never a 500 to the caller)', async () => {
    mockFeedItems.push(makeFeedItem('urgent', 'x'));
    listCheckpointsThrows = true;
    const r = await composeNextBestAction({} as any, { userUid: 'usr_a', actor: 'pet_parent', he: true });
    expect(r.primaryAction).toBeNull();
    expect(r.secondaryActions).toEqual([]);
  });
});
