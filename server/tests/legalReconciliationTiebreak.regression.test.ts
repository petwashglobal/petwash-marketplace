/**
 * Behavioral pin — DISTINCT ON winner semantics inside migration
 * 0129_legal_reconciliation_view.sql (Lane D task 3).
 *
 * The reconciliation view's user_consents subquery is:
 *
 *   SELECT DISTINCT ON (user_id, consent_type)
 *          user_id, consent_type, consent_version, accepted, locale, accepted_at
 *   FROM user_consents
 *   ORDER BY user_id, consent_type, accepted_at DESC, accepted DESC, id DESC
 *
 * The winner selection matters — swapping any of the tiebreak keys
 * silently changes which row wins on a same-timestamp collision, which
 * can flip "accepted=TRUE wins" to "accepted=FALSE wins" between
 * reads. This test:
 *
 *   1) Re-implements the DISTINCT ON winner rule as a plain TS reducer
 *      exactly matching the SQL's ORDER BY chain.
 *   2) Feeds fake user_consents rows through it and asserts the row
 *      that would survive the SQL's DISTINCT ON matches.
 *   3) Reads migration 0129 as text and pins that the ORDER BY clause
 *      still has ALL FOUR keys in the exact order the reducer uses. If
 *      someone edits the migration to drop or reorder a tiebreak key,
 *      the source-pin fires; if they leave the SQL alone but forget
 *      the intent, the behavioral cases fire.
 *
 * NOT a database test — PG is mocked by construction (fake in-memory
 * rows). Runs under vitest with no live pool.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// ── Fake user_consents row shape (matches the columns the SQL selects). ──
type FakeConsentRow = {
  user_id: string;
  consent_type: string;
  consent_version: string | null;
  accepted: boolean;
  locale: string | null;
  accepted_at: Date;
  id: number;
};

/**
 * TypeScript re-implementation of the SQL:
 *
 *   SELECT DISTINCT ON (user_id, consent_type) ...
 *   ORDER BY user_id, consent_type, accepted_at DESC, accepted DESC, id DESC
 *
 * DISTINCT ON keeps the FIRST row for each (user_id, consent_type)
 * partition per the ORDER BY. So within a partition, the winner is:
 *   • latest accepted_at
 *   • tiebreak: accepted=TRUE beats accepted=FALSE (Postgres bool DESC:
 *     TRUE=1 > FALSE=0)
 *   • tiebreak of last resort: highest id
 *
 * Returns one winner per partition — same shape / count as the SQL.
 */
function distinctOnWinners(rows: FakeConsentRow[]): FakeConsentRow[] {
  const bestPerKey = new Map<string, FakeConsentRow>();
  for (const r of rows) {
    const key = `${r.user_id}::${r.consent_type}`;
    const cur = bestPerKey.get(key);
    if (!cur || compareByOrderBy(r, cur) < 0) {
      bestPerKey.set(key, r);
    }
  }
  return [...bestPerKey.values()];
}

/**
 * Returns < 0 if `a` outranks `b` in the SQL's ORDER BY. Chain (in the
 * SAME order as the migration):
 *   accepted_at DESC → later date first
 *   accepted    DESC → TRUE before FALSE
 *   id          DESC → higher id first
 */
function compareByOrderBy(a: FakeConsentRow, b: FakeConsentRow): number {
  const dt = b.accepted_at.getTime() - a.accepted_at.getTime();
  if (dt !== 0) return dt;
  const acc = (b.accepted ? 1 : 0) - (a.accepted ? 1 : 0);
  if (acc !== 0) return acc;
  return b.id - a.id;
}

// ─────────────────────────────────────────────────────────────────────────

describe('migration 0129 — DISTINCT ON tiebreak on user_consents', () => {
  it('later accepted_at wins over earlier — even when the earlier row is accepted=true', () => {
    const earlier = new Date('2026-01-01T10:00:00Z');
    const later   = new Date('2026-01-02T10:00:00Z');
    const rows: FakeConsentRow[] = [
      { user_id: 'u1', consent_type: 'terms', consent_version: 'v1', accepted: true,  locale: 'he', accepted_at: earlier, id: 10 },
      { user_id: 'u1', consent_type: 'terms', consent_version: 'v1', accepted: false, locale: 'he', accepted_at: later,   id: 11 },
    ];
    const winners = distinctOnWinners(rows);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).toBe(11);
    expect(winners[0].accepted).toBe(false);
    expect(winners[0].accepted_at).toBe(later);
  });

  it('same accepted_at: accepted=true beats accepted=false — the marketing-flip bug the tiebreak prevents', () => {
    const t = new Date('2026-03-15T12:34:56Z');
    const rows: FakeConsentRow[] = [
      { user_id: 'u2', consent_type: 'marketing', consent_version: 'v1', accepted: false, locale: 'he', accepted_at: t, id: 42 },
      { user_id: 'u2', consent_type: 'marketing', consent_version: 'v1', accepted: true,  locale: 'he', accepted_at: t, id: 41 },
    ];
    const winners = distinctOnWinners(rows);
    expect(winners).toHaveLength(1);
    expect(winners[0].accepted).toBe(true);
    // id 41 wins over id 42 here because accepted DESC comes BEFORE id DESC.
    expect(winners[0].id).toBe(41);
  });

  it('same accepted_at + same accepted: highest id wins as last-resort tiebreak', () => {
    const t = new Date('2026-04-01T00:00:00Z');
    const rows: FakeConsentRow[] = [
      { user_id: 'u3', consent_type: 'privacy', consent_version: 'v1', accepted: true, locale: 'he', accepted_at: t, id: 7 },
      { user_id: 'u3', consent_type: 'privacy', consent_version: 'v1', accepted: true, locale: 'he', accepted_at: t, id: 99 },
      { user_id: 'u3', consent_type: 'privacy', consent_version: 'v1', accepted: true, locale: 'he', accepted_at: t, id: 8 },
    ];
    const winners = distinctOnWinners(rows);
    expect(winners).toHaveLength(1);
    expect(winners[0].id).toBe(99);
  });

  it('partitions by (user_id, consent_type) — different users / consent types produce independent winners', () => {
    const t = new Date('2026-05-01T00:00:00Z');
    const rows: FakeConsentRow[] = [
      { user_id: 'u4', consent_type: 'terms',     consent_version: 'v1', accepted: true,  locale: 'he', accepted_at: t, id: 1 },
      { user_id: 'u4', consent_type: 'marketing', consent_version: 'v1', accepted: false, locale: 'he', accepted_at: t, id: 2 },
      { user_id: 'u5', consent_type: 'terms',     consent_version: 'v1', accepted: true,  locale: 'he', accepted_at: t, id: 3 },
    ];
    const winners = distinctOnWinners(rows);
    expect(winners).toHaveLength(3);
    // Sort the winner set for stable assertions.
    const bag = winners
      .map((w) => `${w.user_id}/${w.consent_type}/${w.accepted}/${w.id}`)
      .sort();
    expect(bag).toEqual([
      'u4/marketing/false/2',
      'u4/terms/true/1',
      'u5/terms/true/3',
    ]);
  });

  it('preserves the accepted=TRUE winner even when a later accepted=FALSE row shares only the day', () => {
    // Real-world: user granted marketing_sms on morning of day D, then
    // withdrew that afternoon. The withdrawal is later → withdrawal wins.
    // (This confirms the reducer does NOT prefer accepted=true when the
    // timestamps genuinely differ — the migration's rule is honest.)
    const morning   = new Date('2026-06-10T09:00:00Z');
    const afternoon = new Date('2026-06-10T15:00:00Z');
    const rows: FakeConsentRow[] = [
      { user_id: 'u6', consent_type: 'marketing', consent_version: 'v1', accepted: true,  locale: 'he', accepted_at: morning,   id: 100 },
      { user_id: 'u6', consent_type: 'marketing', consent_version: 'v1', accepted: false, locale: 'he', accepted_at: afternoon, id: 101 },
    ];
    const winners = distinctOnWinners(rows);
    expect(winners).toHaveLength(1);
    expect(winners[0].accepted).toBe(false);
    expect(winners[0].id).toBe(101);
  });
});

// ── Source pin — the migration text still encodes the same tiebreak chain ──
describe('migration 0129 — source pin on the DISTINCT ON ORDER BY', () => {
  const MIG_SRC = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'migrations', '0129_legal_reconciliation_view.sql'),
    'utf8',
  );

  it('DISTINCT ON keys are (user_id, consent_type)', () => {
    expect(MIG_SRC).toMatch(/DISTINCT\s+ON\s*\(\s*user_id\s*,\s*consent_type\s*\)/i);
  });

  it('ORDER BY chain is user_id, consent_type, accepted_at DESC, accepted DESC, id DESC — in that order', () => {
    // Whitespace-tolerant match on the exact five-key chain the reducer
    // above implements. A refactor that reorders these keys, or that
    // drops the `id DESC` last-resort tiebreak, will fail here.
    const re = /ORDER\s+BY\s+user_id\s*,\s*consent_type\s*,\s*accepted_at\s+DESC\s*,\s*accepted\s+DESC\s*,\s*id\s+DESC/i;
    expect(MIG_SRC).toMatch(re);
  });

  it('the DISTINCT ON block is annotated with the Lane D §D2 rationale', () => {
    // Prevents a future edit that "cleans up" the multi-key ORDER BY by
    // trimming what looks like a redundant tiebreak without reading why.
    expect(MIG_SRC).toMatch(/Deterministic tiebreak on same-timestamp rows/);
    expect(MIG_SRC).toMatch(/Lane D §D2/);
  });
});
