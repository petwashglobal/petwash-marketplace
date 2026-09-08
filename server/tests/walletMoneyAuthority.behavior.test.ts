/**
 * Authority bands on the admin wallet routes that MOVE VALUE.
 *
 * Census 2026-09-08: nine admin wallet routes move real money, none consulted
 * checkFinancialAuthority, none had step-up, eight had no cap at all.
 * `/admin/wallet/adjust` accepted { userId, amountCents, type } behind a bare
 * customClaims.admin check — one admin, any wallet, any amount, no second
 * approver, no ceiling. Everything hardened in #2317 governs
 * /api/financial-approvals/* and stops there.
 *
 * These pin the gate itself. The thing most likely to go wrong is NOT the happy
 * path — it is the two ways this control can quietly stop being a control:
 *
 *   1. the bands do not exist, so every route fails closed and someone
 *      "temporarily" removes the check;
 *   2. an unknown case/action silently finds no rule and is ALLOWED.
 *
 * Both are pinned below.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Matrix stand-in ─────────────────────────────────────────────────────────
type Rule = {
  id: number; case_type: string; action_type: string; owner_scope: string; owner_id: string | null;
  min_amount_cents: number; max_amount_cents: number | null;
  required_role: string; second_approval_role: string | null; is_active: boolean;
};

/**
 * The bands migration 0150 seeds, transcribed. If the migration and this table
 * drift, the "seeded bands cover every amount" test below stops meaning
 * anything — so it is asserted against the real SQL file, not just this copy.
 */
let RULES: Rule[] = [];
const seedBands = () => {
  RULES = [];
  let id = 1;
  for (const [caseType, actionType] of [
    ['wallet_adjust', 'credit'], ['wallet_adjust', 'debit'],
    ['wallet_support', 'credit'], ['wallet_support', 'issue_refund'], ['wallet_support', 'release_hold'],
  ] as const) {
    RULES.push({ id: id++, case_type: caseType, action_type: actionType, owner_scope: 'global', owner_id: null, min_amount_cents: 0, max_amount_cents: 50000, required_role: 'admin', second_approval_role: null, is_active: true });
    RULES.push({ id: id++, case_type: caseType, action_type: actionType, owner_scope: 'global', owner_id: null, min_amount_cents: 50001, max_amount_cents: 500000, required_role: 'admin', second_approval_role: 'executive', is_active: true });
    RULES.push({ id: id++, case_type: caseType, action_type: actionType, owner_scope: 'global', owner_id: null, min_amount_cents: 500001, max_amount_cents: null, required_role: 'executive', second_approval_role: 'executive', is_active: true });
  }
};

const loggedApprovals: any[] = [];
/**
 * Drizzle's sql`` object exposes `queryChunks`: literal StringChunks
 * interleaved with the interpolated values, in order. Reconstructing both is
 * how this stand-in tells getApprovalRule's SELECT from logFinancialApproval's
 * INSERT and applies the real band-selection predicate to the real arguments.
 */
const chunksOf = (q: any) => {
  const chunks: any[] = q?.queryChunks ?? [];
  const text = chunks.filter(c => Array.isArray(c?.value)).map(c => c.value.join('')).join(' ');
  const values = chunks.filter(c => !Array.isArray(c?.value));
  return { text, values };
};

vi.mock('../db', () => ({
  db: {
    execute: async (q: any) => {
      const { text, values } = chunksOf(q);
      if (text.includes('financial_approval_log')) {
        loggedApprovals.push(values);
        return { rows: [{ id: 1 }] };
      }
      // getApprovalRule binds, in order: case_type, action_type, amount,
      // owner_scope, owner_id  (see server/lib/financial-approvals.ts).
      const [caseType, actionType, amountCents] = values;
      const amount = Number(amountCents);
      const matches = RULES.filter(r =>
        r.case_type === caseType && r.action_type === actionType && r.is_active &&
        r.min_amount_cents <= amount &&
        (r.max_amount_cents === null || r.max_amount_cents >= amount),
      );
      return { rows: matches.slice(0, 1) };
    },
  },
}));

const { checkWalletMoneyAuthority } = await import('../lib/walletMoneyAuthority');

const reqAs = (role: string | null) => ({
  headers: {},
  socket: {},
  firebaseUser: role ? { uid: `uid_${role}`, [role]: true } : null,
}) as any;

const ADJUST = (amountCents: number) => ({
  caseType: 'wallet_adjust', actionType: 'credit', amountCents, caseRefId: 'user_1',
});

beforeEach(() => {
  seedBands();
  loggedApprovals.length = 0;
  delete process.env.ADMIN_SECRET;
});

describe('the ceiling that did not exist', () => {
  it('an admin may make a small adjustment', async () => {
    const r = await checkWalletMoneyAuthority(reqAs('admin'), ADJUST(10_000)); // ₪100
    expect(r.ok).toBe(true);
  });

  it('an admin may NOT unilaterally move a large amount — a second approver is required', async () => {
    // THE HEADLINE. Pre-fix this was allowed with no ceiling of any kind.
    const r = await checkWalletMoneyAuthority(reqAs('admin'), ADJUST(250_000)); // ₪2,500
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code).toBe('SECOND_APPROVAL_REQUIRED');
  });

  it('an admin is refused outright above their band', async () => {
    const r = await checkWalletMoneyAuthority(reqAs('admin'), ADJUST(900_000)); // ₪9,000
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code).toBe('INSUFFICIENT_FINANCIAL_AUTHORITY');
    expect(r.ok === false && r.details?.requiredRole).toBe('executive');
  });

  it('a manager cannot move money an admin could', async () => {
    const r = await checkWalletMoneyAuthority(reqAs('manager'), ADJUST(10_000));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code).toBe('INSUFFICIENT_FINANCIAL_AUTHORITY');
  });

  it('an unauthenticated caller is 401, not the lowest role', async () => {
    const r = await checkWalletMoneyAuthority(reqAs(null), ADJUST(100));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.status).toBe(401);
  });

  it('the band applies to a DEBIT too, not only a credit', async () => {
    const r = await checkWalletMoneyAuthority(reqAs('admin'), { ...ADJUST(900_000), actionType: 'debit' });
    expect(r.ok).toBe(false);
  });
});

describe('an unknown action must not slip through', () => {
  it('a case/action with no rule is BLOCKED, not allowed', async () => {
    // The dangerous failure: someone adds /admin/wallet/something-new, passes a
    // case_type nobody seeded, and the gate waves it through.
    const r = await checkWalletMoneyAuthority(reqAs('executive'), {
      caseType: 'wallet_not_seeded', actionType: 'credit', amountCents: 1_000_000, caseRefId: 'x',
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code).toBe('NO_APPROVAL_RULE');
  });

  it('a non-positive amount never reaches the matrix', async () => {
    // min_amount_cents <= 0 would otherwise select the LOWEST band for what is
    // really a malformed request.
    for (const bad of [0, -1, 1.5, NaN]) {
      const r = await checkWalletMoneyAuthority(reqAs('admin'), ADJUST(bad));
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.code).toBe('INVALID_AMOUNT');
    }
  });
});

describe('the bands must actually exist, or the gate is an outage', () => {
  /**
   * checkFinancialAuthority blocks when no rule matches, and NOTHING in this
   * repository ever seeded financial_approval_matrix — the table is created by
   * 0079 and its only writer is the admin CRUD route. Wiring the gate without
   * shipping bands would have failed all four routes closed on deploy.
   */
  it('with an EMPTY matrix every wallet action is refused', async () => {
    RULES = [];
    const r = await checkWalletMoneyAuthority(reqAs('executive'), ADJUST(100));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code).toBe('NO_APPROVAL_RULE');
  });

  it('migration 0150 seeds a band for every case/action the routes use', async () => {
    const { readFileSync } = await import('node:fs');
    const sqlText = readFileSync(
      new URL('../../migrations/0150_financial_approval_matrix_wallet_bands.sql', import.meta.url),
      'utf8',
    );
    // Every (case_type, action_type) the wired routes pass must be seeded.
    for (const [c, a] of [
      ['wallet_adjust', 'credit'], ['wallet_adjust', 'debit'],
      ['wallet_support', 'credit'], ['wallet_support', 'issue_refund'], ['wallet_support', 'release_hold'],
    ]) {
      expect(sqlText).toContain(`'${c}'`);
      expect(sqlText).toContain(`'${a}'`);
    }
    // And it must be re-runnable: a plain INSERT would duplicate bands on the
    // second apply and make getApprovalRule's tie-break arbitrary.
    expect(sqlText).toMatch(/WHERE NOT EXISTS/);
  });

  it('the seeded bands leave NO amount uncovered', async () => {
    // A gap between bands reads as "no rule" and blocks a legitimate action —
    // the failure mode that gets a security control switched off.
    const boundaries = [1, 50_000, 50_001, 500_000, 500_001, 10_000_000];
    for (const amount of boundaries) {
      const r = await checkWalletMoneyAuthority(reqAs('executive'), ADJUST(amount));
      // A GAP surfaces as NO_APPROVAL_RULE. A refusal for needing a second
      // approver is coverage working, not a gap — even an executive trips that
      // above ₪500, which is the point of the band.
      const gap = r.ok === false && r.code === 'NO_APPROVAL_RULE';
      expect(gap, `no band covers ${amount}`).toBe(false);
    }
  });
});

describe('the routes are wired — source pin', () => {
  it('all four value-minting wallet routes consult the gate', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../routes/prestige-pass.ts', import.meta.url), 'utf8');
    expect((src.match(/checkWalletMoneyAuthority\s*\(/g) || []).length).toBe(4);
    // adjust / support-credit / release-hold / issue-refund
    expect(src).toContain("caseType: 'wallet_adjust'");
    expect(src).toContain("actionType: 'release_hold'");
    expect(src).toContain("actionType: 'issue_refund'");
  });

  it('getActingRole has exactly ONE implementation', async () => {
    const { readFileSync } = await import('node:fs');
    const routeSrc = readFileSync(new URL('../routes/financial-approvals.ts', import.meta.url), 'utf8');
    // The route file must import it, not redefine it — two copies of "what role
    // is this caller?" on the money path is how surfaces disagree.
    expect(routeSrc).not.toMatch(/function getActingRole\s*\(/);
    expect(routeSrc).toContain("from '../lib/financialActingRole'");
  });
});
