/**
 * Regression pin — ACTIVATION PRE-FLIGHT.
 *
 * The rule under test is the one I broke twice on 2026-09-06/07 by reporting
 * production state I had inferred rather than checked:
 *
 *     UNKNOWN IS NOT PASS.
 *
 * A check that could not be performed must block activation exactly as a failure
 * does. Anything softer reads like success in a summary, which is how an
 * unverified assumption ends up authorising irreversible tax documents.
 */
import { describe, it, expect } from 'vitest';
import {
  runPreflight, preflightVerdict, formatPreflight,
  HISTORICAL_BACKFILL_INSTANT, type PreflightInputs,
} from '../services/nayaxActivationPreflight';

const NOW = new Date('2026-09-20T08:00:00Z');

const ok = (over: Partial<PreflightInputs> = {}): PreflightInputs => ({
  wired: { sumit: true, lynx: true, flag: true, cutover: true },
  cutoverAt: new Date('2026-09-21T06:00:00Z'),
  now: NOW,
  expectedMachineIds: ['182443', '182462', '182374', '182403'],
  registeredMachineIds: ['182443', '182462', '182374', '182403'],
  tablesPresent: {
    nayax_sale_issuance_attempts: true,
    nayax_refund_events: true,
    nayax_fiscal_document_links: true,
  },
  claimUniqueIndexPresent: true,
  unresolvedClaims: { pendingLookup: 0, needsReconciliation: 0 },
  continuousFeed: true,
  ...over,
});

const verdict = (i: PreflightInputs) => preflightVerdict(runPreflight(i));
const byId = (i: PreflightInputs, id: string) => runPreflight(i).find((r) => r.id === id)!;

describe('a fully prepared rail is READY', () => {
  it('passes every check', () => {
    const v = verdict(ok());
    expect(v).toEqual({ ready: true, failed: [], unknown: [] });
  });
});

describe('UNKNOWN blocks activation exactly as FAIL does', () => {
  it('an unreachable database blocks, and is not reported as passing', () => {
    const v = verdict(ok({ tablesPresent: null, claimUniqueIndexPresent: null, unresolvedClaims: null }));
    expect(v.ready).toBe(false);
    expect(v.unknown).toEqual(expect.arrayContaining(['schema', 'guard', 'unresolved']));
    expect(v.failed).toEqual([]); // not failures — but still blocking
  });

  it('an unverifiable feed blocks', () => {
    expect(verdict(ok({ continuousFeed: null })).ready).toBe(false);
  });

  it('says so in the report, rather than burying it', () => {
    const text = formatPreflight(runPreflight(ok({ tablesPresent: null })));
    expect(text).toMatch(/NOT READY/);
    expect(text).toMatch(/unverifiable check blocks activation exactly as a failure/);
  });

  it('the schema remedy warns that a skipped migration job proves nothing', () => {
    expect(byId(ok({ tablesPresent: null }), 'schema').remedy)
      .toMatch(/skipped migration job is NOT evidence/i);
  });
});

describe('the cutover cannot re-admit documented history', () => {
  it('rejects a cutover at the historical backfill instant', () => {
    const r = byId(ok({ cutoverAt: HISTORICAL_BACKFILL_INSTANT }), 'cutover');
    expect(r.status).toBe('FAIL');
    expect(r.detail).toMatch(/at or before the historical backfill/);
  });

  it('rejects a cutover BEFORE it — the whole year would be re-admitted', () => {
    expect(byId(ok({ cutoverAt: new Date('2026-01-01T00:00:00Z') }), 'cutover').status).toBe('FAIL');
  });

  it('rejects an unset cutover', () => {
    expect(byId(ok({ cutoverAt: null }), 'cutover').status).toBe('FAIL');
  });

  it('rejects a cutover so far out that nothing would ever issue', () => {
    expect(byId(ok({ cutoverAt: new Date('2027-06-01T00:00:00Z') }), 'cutover').status).toBe('FAIL');
  });

  it('accepts a fresh cutover after the backfill', () => {
    expect(byId(ok(), 'cutover').status).toBe('PASS');
  });
});

describe('the guards themselves must be present', () => {
  it('a missing claim ledger blocks', () => {
    const v = verdict(ok({
      tablesPresent: {
        nayax_sale_issuance_attempts: false,
        nayax_refund_events: true,
        nayax_fiscal_document_links: true,
      },
    }));
    expect(v.ready).toBe(false);
    expect(v.failed).toContain('schema');
  });

  it('a missing unique index blocks — the guard IS that index', () => {
    const r = byId(ok({ claimUniqueIndexPresent: false }), 'guard');
    expect(r.status).toBe('FAIL');
    expect(r.detail).toMatch(/unique index/);
  });

  it('an unregistered bay blocks, and names it', () => {
    const r = byId(ok({ registeredMachineIds: ['182443', '182462'] }), 'terminals');
    expect(r.status).toBe('FAIL');
    expect(r.detail).toMatch(/182374/);
    expect(r.detail).toMatch(/182403/);
  });
});

describe('unfinished business blocks a new run', () => {
  it('an unresolved claim blocks — issuing on top of it buries the question', () => {
    const r = byId(ok({ unresolvedClaims: { pendingLookup: 1, needsReconciliation: 0 } }), 'unresolved');
    expect(r.status).toBe('FAIL');
    expect(r.remedy).toMatch(/Resolve each against SUMIT first/);
  });

  it('a NEEDS_RECONCILIATION row blocks too', () => {
    expect(verdict(ok({ unresolvedClaims: { pendingLookup: 0, needsReconciliation: 3 } })).ready).toBe(false);
  });
});

describe('a manual export is not a feed', () => {
  it('blocks when delivery is not continuous', () => {
    const r = byId(ok({ continuousFeed: false }), 'feed');
    expect(r.status).toBe('FAIL');
    expect(r.detail).toMatch(/manual Excel export is not a feed/);
  });
});

describe('the flag is the switch, not a precondition', () => {
  it('its remedy says to set it LAST', () => {
    expect(byId(ok({ wired: { sumit: true, lynx: true, flag: false, cutover: true } }), 'flag').remedy)
      .toMatch(/LAST/);
  });
});
