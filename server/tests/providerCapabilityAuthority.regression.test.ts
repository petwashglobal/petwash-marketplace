/**
 * Provider capability authority — behavioural pin.
 *
 * `getUserCapabilities()` is the ONE authority for "is this account a
 * provider". Three defects made that answer wrong:
 *
 *  1. APPLICANT_STATUSES was ['draft','pending_review','under_review'] and
 *     did NOT contain 'pending' — the only status the live submit endpoint
 *     (POST /api/provider-onboarding/apply) ever writes. So every real
 *     applicant came back `applicant: false`, indistinguishable from a
 *     customer who never applied. It also missed 'processing',
 *     'pending_resubmission' and 'on_hold'.
 *
 *  2. The provider lookup was `.where(userId).limit(1)` with NO ORDER BY.
 *     provider_applications has no unique index on user_id and the submit
 *     guard only blocked re-apply while a row was in flight, so a user can
 *     hold several rows. Postgres may return ANY of them — provider
 *     authority was literally non-deterministic, and a stale 'approved'
 *     row could outlive a newer rejection.
 *
 *  3. Nothing was fail-closed on an unknown status.
 *
 * The row-selection rule and the status mapping are now pure functions so
 * this pin exercises the real logic, not a string match on the source.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveProviderStates,
  resolveAuthoritativeApplicationStatus,
} from '../lib/userCapabilities';
import {
  PROVIDER_APPLICANT_STATUSES,
  PROVIDER_TERMINAL_STATUSES,
  type ProviderApplicationStatus,
} from '../../shared/lib/userCapabilities';

/** Rows as the aggregator receives them: newest-first. */
const rows = (...statuses: Array<string | null>) => statuses.map((status) => ({ status }));

describe('resolveAuthoritativeApplicationStatus — deterministic row selection', () => {
  it('no rows → no application status', () => {
    expect(resolveAuthoritativeApplicationStatus([])).toBeNull();
  });

  it('single row → that row', () => {
    expect(resolveAuthoritativeApplicationStatus(rows('pending'))).toBe('pending');
    expect(resolveAuthoritativeApplicationStatus(rows('approved'))).toBe('approved');
  });

  it('REJECTED then RE-APPLIED → the live application wins, not the stale rejection', () => {
    // newest-first: the fresh 'pending' is row 0.
    expect(resolveAuthoritativeApplicationStatus(rows('pending', 'rejected'))).toBe('pending');
  });

  it('APPROVED then a NEWER terminal decision → authority does NOT survive the revocation', () => {
    // The pre-fix bare .limit(1) could return the old 'approved' row here,
    // leaving provider.active true forever after a rejection.
    expect(resolveAuthoritativeApplicationStatus(rows('rejected', 'approved'))).toBe('rejected');
    expect(resolveAuthoritativeApplicationStatus(rows('withdrawn', 'approved'))).toBe('withdrawn');
  });

  it('a DRAFT placeholder never demotes a live approved provider', () => {
    // post-login auto-creates a 'draft' row on provider intent; it is newer
    // than the approval but is a placeholder, not a decision.
    expect(resolveAuthoritativeApplicationStatus(rows('draft', 'approved'))).toBe('approved');
    expect(resolveAuthoritativeApplicationStatus(rows('draft', 'draft', 'approved'))).toBe('approved');
  });

  it('only drafts → the newest draft (in-flight, not a provider)', () => {
    expect(resolveAuthoritativeApplicationStatus(rows('draft', 'draft'))).toBe('draft');
  });

  it('null statuses are skipped rather than treated as an application', () => {
    expect(resolveAuthoritativeApplicationStatus(rows(null, 'approved'))).toBe('approved');
    expect(resolveAuthoritativeApplicationStatus(rows(null))).toBeNull();
  });

  it('is deterministic — same input, same answer, every time', () => {
    const input = rows('pending', 'rejected', 'approved');
    const answers = new Set(
      Array.from({ length: 25 }, () => resolveAuthoritativeApplicationStatus(input)),
    );
    expect(answers.size).toBe(1);
  });
});

describe('deriveProviderStates — active/applicant mapping', () => {
  it('ONLY approved grants provider capability', () => {
    const all: ProviderApplicationStatus[] = [
      'draft', 'pending', 'pending_review', 'under_review', 'processing',
      'pending_resubmission', 'on_hold', 'approved', 'rejected', 'withdrawn',
    ];
    const active = all.filter((s) => deriveProviderStates(s).active);
    expect(active).toEqual(['approved']);
  });

  it("a PENDING application makes the user an applicant — the bug that broke every applicant", () => {
    // 'pending' is what POST /api/provider-onboarding/apply writes.
    expect(deriveProviderStates('pending')).toEqual({ active: false, applicant: true });
  });

  it('every in-flight status is an applicant and none of them is active', () => {
    for (const s of PROVIDER_APPLICANT_STATUSES) {
      expect(deriveProviderStates(s), `status ${s}`).toEqual({ active: false, applicant: true });
    }
  });

  it('terminal statuses grant nothing — a REJECTED provider is a plain customer', () => {
    for (const s of PROVIDER_TERMINAL_STATUSES) {
      expect(deriveProviderStates(s), `status ${s}`).toEqual({ active: false, applicant: false });
    }
  });

  it('no application at all grants nothing', () => {
    expect(deriveProviderStates(null)).toEqual({ active: false, applicant: false });
  });

  it('FAIL-CLOSED: an unrecognised status grants nothing', () => {
    expect(deriveProviderStates('supervisor' as ProviderApplicationStatus))
      .toEqual({ active: false, applicant: false });
    expect(deriveProviderStates('' as ProviderApplicationStatus))
      .toEqual({ active: false, applicant: false });
  });

  it('the applicant and terminal sets are disjoint and exclude approved', () => {
    const applicant = new Set<string>(PROVIDER_APPLICANT_STATUSES);
    for (const s of PROVIDER_TERMINAL_STATUSES) expect(applicant.has(s)).toBe(false);
    expect(applicant.has('approved')).toBe(false);
  });
});

describe('the aggregator query stays ordered (source pin)', () => {
  const SRC = require('node:fs').readFileSync(
    require('node:path').resolve(__dirname, '..', 'lib', 'userCapabilities.ts'),
    'utf8',
  ) as string;

  it('orders provider_applications newest-first before choosing a row', () => {
    // Without the ORDER BY the pure functions above are fed an arbitrary
    // row order and every guarantee in this file evaporates.
    expect(SRC).toMatch(
      /\.orderBy\(desc\(providerApplications\.createdAt\), desc\(providerApplications\.id\)\)/,
    );
  });

  it('does not fall back to a bare .limit(1) on provider_applications', () => {
    const block = SRC.slice(SRC.indexOf('── PROVIDER'), SRC.indexOf('── STAFF'));
    expect(block).not.toMatch(/\.from\(providerApplications\)[\s\S]{0,200}?\.limit\(1\)/);
  });

  it('never reads users.role as the provider authority', () => {
    // Strip comments — the file header deliberately NAMES users.role to
    // explain why it is not the authority.
    const code = SRC
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/users\.role/);
  });
});
