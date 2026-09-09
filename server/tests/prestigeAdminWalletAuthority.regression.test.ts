/**
 * The /admin/wallet authority census — prestige-pass.ts (2026-09-10).
 *
 * `server/routes/prestige-pass.ts` carries 295 `/admin/wallet/*` routes: the
 * banded money movers, plus policy (kill switches, approval chains, payout
 * release policies, finance roles), config and reporting. It is ~17k lines,
 * mounted with `optionalFirebaseToken` — AUTHENTICATION, not authorization —
 * so authority is established after the mount, never by it.
 *
 * THE BUG THIS PINS. 25 of those handlers gated on
 *
 *     const adminUser = await firebaseAuth.getUser(uid).catch(() => null);
 *     if (!(adminUser?.customClaims as any)?.admin) return res.status(403)...
 *
 * Nothing in this codebase has written that boolean claim since
 * `grantAdminClaim()` was deleted on 2026-06-12 (server/lib/adminCheck.ts).
 * Every writer sets a `role` STRING — 'super_admin', 'admin', 'provider' —
 * and `revokeAdminClaim()` deletes `admin` outright. So the field was
 * undefined for every caller and the gate refused EVERYONE, the verified
 * super admin included.
 *
 * Same phantom-field class as the session isAdmin flag of #240 (pinned in
 * prestigeAdminRouteGate/prestigePassAdminGate): a gate that reads like
 * "admins only" and means "nobody, ever". Seven of the 25 were the
 * value-moving routes #2321/#2324/#2334 had just fitted with approval bands —
 * bands sitting behind a gate that never opened.
 *
 * WHY THE CLASSES BELOW ARE NOT SEPARATELY GUARDED. #2317 made policy
 * mutation on /api/financial-approvals narrower than policy use, because
 * `requireFinancialAdmin` there admits `franchise_owner`. This router has no
 * such problem: `router.use('/admin', …)` demands `isSuperAdminVerified` —
 * SUPER_ADMIN_EMAILS + Firebase email_verified — which is strictly stronger
 * than admin/executive and excludes franchise_owner entirely. Bolting a
 * requirePolicyAdmin-alike onto these routes would only widen them. What is
 * worth pinning is that the umbrella keeps covering every route, that the
 * machine credential never reaches this surface, and that no handler
 * re-introduces an authority field nothing writes.
 */
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');

/**
 * Strip comments so a pin can never pass on its own explanation — with a real
 * scanner, not a regex.
 *
 * A `/\*[\s\S]*?\*\/` pass over THIS file is not merely imprecise, it is
 * wrong. One line comment in the router reads "… must run BEFORE any
 * /admin/wallet/* route handler …". The `/*` inside it opens a block comment as
 * far as a regex is concerned, and everything up to the next `*\/` — 33 route
 * declarations, the banded money block among them — vanishes before the parser
 * sees it. The pin then reports those routes as absent, or finds nothing to
 * object to and passes. Regex literals bite the same way: a naive quote tracker
 * reads the `'` in the remediation-plan generator's `.replace(/'/g, "''")` as
 * the start of a string and loses the 76 routes that follow.
 *
 * So: walk the characters, tracking string, template, regex and comment state,
 * and blank out only genuine comment text. Newlines are always preserved,
 * because every route body below is sliced between two line numbers — and
 * `the stripper loses no route declaration` re-checks that against the raw
 * file on every run.
 */
function code(path: string): string {
  const src = readFileSync(resolve(ROOT, path), 'utf8');
  let out = '';
  let i = 0;
  let quote: string | null = null;
  let prev = '';
  // A '/' opens a regex only where a value may begin — after an operator,
  // an opening bracket or a separator; anywhere else it is division.
  const regexMayStart = () => prev === '' || '(,=:[!&|?{};+-*%~^<>'.includes(prev);

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (quote) {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; prev = c; i++; continue; }

    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && next === '*') {
      const close = src.indexOf('*/', i + 2);
      const stop = close === -1 ? src.length : close + 2;
      for (; i < stop; i++) out += src[i] === '\n' ? '\n' : ' ';
      continue;
    }
    if (c === '/' && regexMayStart()) {
      let j = i + 1;
      let inClass = false;
      for (; j < src.length && src[j] !== '\n'; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
      }
      if (j < src.length && src[j] === '/') {
        out += src.slice(i, j + 1); i = j + 1; prev = '/'; continue;
      }
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

const SRC = code('server/routes/prestige-pass.ts');
const LINES = SRC.split('\n');

type Route = { line: number; verb: string; path: string; index: number; body: string };

const DECL = /^router\.(get|post|patch|put|delete)\(\s*'([^']+)'/;

function allRoutes(): Route[] {
  const marks: Array<{ line: number; verb: string; path: string; i: number }> = [];
  LINES.forEach((l, i) => {
    const m = l.match(DECL);
    if (m) marks.push({ line: i + 1, verb: m[1].toUpperCase(), path: m[2], i });
  });
  return marks.map((m, k) => ({
    line: m.line,
    verb: m.verb,
    path: m.path,
    index: SRC.indexOf(`router.${m.verb.toLowerCase()}('${m.path}'`),
    body: LINES.slice(m.i, marks[k + 1] ? marks[k + 1].i : LINES.length).join('\n'),
  }));
}

/** The literal set the umbrella gate lets a shared secret through on. */
function machineRoutes(): string[] {
  const at = SRC.indexOf('const MACHINE_CREDENTIAL_ROUTES');
  expect(at, 'the machine allowlist is gone — the gate shape changed').toBeGreaterThan(-1);
  const block = SRC.slice(at, SRC.indexOf(']);', at));
  return [...block.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]);
}

const ROUTES = allRoutes();
const WALLET = ROUTES.filter((r) => r.path.startsWith('/admin/wallet'));

/**
 * Policy = anything that changes WHO MAY DO WHAT: a threshold, a limit, a
 * role, an approval chain, a routing rule, a kill switch, a schedule that
 * releases money on its own.
 */
const POLICY =
  /kill-switch|polic(?:y|ies)|approval-chain|payout-schedule|dispute-routing-rule|finance-role|threshold|escalation-adjust|workload-adjustment|rebalance|reassign|approval-matrix|auto-escalate|governance-pack-subscription/i;

/** The value movers. Each must keep consulting the approval matrix. */
const MONEY_ROUTES = [
  'POST /admin/wallet/release',
  'POST /admin/wallet/refund',
  'POST /admin/wallet/adjust',
  'POST /admin/wallet/support/release-hold',
  'POST /admin/wallet/support/issue-refund',
  'POST /admin/wallet/support/credit',
  'POST /admin/wallet/payout-entries/mark-paid',
  'POST /admin/wallet/disputes/:caseRef/apply-resolution',
];

describe('the parser sees the real router', () => {
  it('the stripper loses no route declaration — it only removes commentary', () => {
    // The whole pin rests on this. Every "offenders === []" below would pass
    // vacuously on a file the stripper had eaten.
    const raw = readFileSync(resolve(ROOT, 'server/routes/prestige-pass.ts'), 'utf8');
    const count = (text: string) =>
      text.split('\n').filter((l) => DECL.test(l)).length;
    expect(SRC.split('\n').length, 'line count must survive').toBe(raw.split('\n').length);
    expect(ROUTES.length, 'declarations must survive').toBe(count(raw));
  });

  // A regex that matches nothing passes every other assertion in this file.
  it('finds the whole route surface, not a silent zero', () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(380);
    expect(WALLET.length).toBeGreaterThanOrEqual(280);
  });

  it('finds all four route classes on the wallet surface', () => {
    const policy = WALLET.filter((r) => POLICY.test(r.path));
    const read = WALLET.filter((r) => r.verb === 'GET');
    expect(policy.length, 'policy routes').toBeGreaterThanOrEqual(40);
    expect(read.length, 'read routes').toBeGreaterThanOrEqual(100);
    expect(WALLET.length - read.length, 'mutating routes').toBeGreaterThanOrEqual(100);
  });
});

describe('THE PIN: no handler gates on an authority field nothing writes', () => {
  it('no /admin/wallet handler reads a boolean `admin` custom claim', () => {
    const offenders = WALLET.filter((r) => /customClaims[\s\S]{0,20}\?\.admin\b/.test(r.body)).map(
      (r) => `${r.verb} ${r.path} (line ${r.line})`,
    );
    expect(
      offenders,
      'nothing has written a boolean `admin` claim since grantAdminClaim() was deleted ' +
        '(2026-06-12) — this gate refuses everyone, super admin included. ' +
        'Use isSuperAdminVerified(req).',
    ).toEqual([]);
  });

  it('the router file reads that phantom claim nowhere at all', () => {
    expect(SRC).not.toMatch(/customClaims[\s\S]{0,20}\?\.admin\b/);
  });

  it('ROOT CAUSE: no claim writer in server/ sets a boolean `admin` claim', () => {
    // If one ever did, the phantom stops being a phantom and this pin should be
    // revisited deliberately rather than silently.
    for (const f of [
      'server/routes.ts',
      'server/lib/syncFirebaseClaims.ts',
      'server/lib/adminCheck.ts',
      'server/routes/loyalty.ts',
      'server/routes/mobile-auth.ts',
      'server/routes/social-oauth.ts',
    ]) {
      expect(code(f), `${f} writes a boolean admin claim`).not.toMatch(
        /setCustomUserClaims\([\s\S]{0,400}?\badmin:\s*true/,
      );
    }
  });

  it('grantAdminClaim stays deleted — it was a free-floating privilege grant', () => {
    expect(code('server/lib/adminCheck.ts')).not.toMatch(/export .*function grantAdminClaim/);
  });
});

describe('every /admin/wallet route sits behind the umbrella gate', () => {
  const gateIdx = SRC.indexOf("router.use('/admin',");

  it('the umbrella gate exists and demands super-admin RBAC', () => {
    expect(gateIdx).toBeGreaterThan(-1);
    expect(SRC).toMatch(/if \(isSuperAdminVerified\(req as any\)\) return next\(\);/);
    expect(SRC).toContain("code: 'ADMIN_REQUIRED'");
  });

  it('it is registered before EVERY /admin route, not merely the first', () => {
    // Express matches middleware in registration order. One route hoisted above
    // the gate is unguarded, and the surface is too long to eyeball.
    const above = ROUTES.filter((r) => r.path.startsWith('/admin') && r.index < gateIdx).map(
      (r) => `${r.verb} ${r.path}`,
    );
    expect(above, 'declared before the gate — the gate does not run for these').toEqual([]);
  });

  it('no wallet route escapes the /admin prefix the gate matches', () => {
    const escaped = WALLET.filter((r) => !r.path.startsWith('/admin/')).map((r) => r.path);
    expect(escaped).toEqual([]);
  });
});

describe('the machine credential never reaches the money or policy surface', () => {
  it('MACHINE_CREDENTIAL_ROUTES lists only the four legacy routes', () => {
    expect(machineRoutes().sort()).toEqual(
      ['/manual-credit', '/reissue', '/send-demo-receipts', '/send-founder-pass'].sort(),
    );
  });

  it('no shared-secret route is a wallet, policy or kill-switch route', () => {
    for (const p of machineRoutes()) {
      expect(p.startsWith('/wallet'), `${p} would hand a shared secret the wallet surface`).toBe(
        false,
      );
      expect(POLICY.test(p), `${p} would hand a shared secret policy authority`).toBe(false);
    }
  });
});

describe('the value movers keep their approval band', () => {
  it('every money route consults the approval matrix', () => {
    const missing = MONEY_ROUTES.filter((sig) => {
      const r = WALLET.find((x) => `${x.verb} ${x.path}` === sig);
      return !r || !/authoriseWalletMoneyAction/.test(r.body);
    });
    expect(missing, 'a value-moving route lost its band or was renamed').toEqual([]);
  });

  it('and each still establishes authority for itself, not just via the umbrella', () => {
    const bare = MONEY_ROUTES.filter((sig) => {
      const r = WALLET.find((x) => `${x.verb} ${x.path}` === sig)!;
      return !/isSuperAdminVerified\(req\)|requireFinanceRole\(req/.test(r.body);
    });
    expect(bare, 'defence in depth: the mount is optional-auth').toEqual([]);
  });
});

describe('policy routes resolve to super-admin, never to franchise_owner', () => {
  const policyRoutes = WALLET.filter((r) => POLICY.test(r.path));

  it('every policy route is under the umbrella prefix', () => {
    expect(policyRoutes.every((r) => r.path.startsWith('/admin/'))).toBe(true);
  });

  it('no policy route weakens itself with a franchise-scoped guard', () => {
    // #2317: requireFinancialAdmin admits franchise_owner, so a person subject
    // to approval rules could rewrite the rules governing their own authority.
    const weak = policyRoutes
      .filter((r) => /requireFinancialAdmin|franchise_owner/.test(r.body))
      .map((r) => `${r.verb} ${r.path}`);
    expect(weak).toEqual([]);
  });

  it('no policy route takes its owner scope from the request body', () => {
    // The #2317 bypass: owner_scope/owner_id off the wire let a caller aim a
    // policy write at someone else's scope.
    const fromBody = policyRoutes
      .filter((r) => /req\.body[\s\S]{0,200}?owner_(?:scope|id)|owner_(?:scope|id)[\s\S]{0,80}?req\.body/.test(r.body))
      .map((r) => `${r.verb} ${r.path}`);
    expect(fromBody).toEqual([]);
  });
});

/**
 * The source pins above say the phantom is gone. This says why it had to go:
 * the two gate shapes, driven through a real Express app, against the claims
 * Firebase actually holds for a PetWash super admin.
 */
describe('BEHAVIOUR: the phantom gate refused the one identity that can pass', () => {
  /** What server/routes.ts:1555 writes for an allowlisted, verified admin. */
  const REAL_SUPER_ADMIN_CLAIMS = { role: 'super_admin', accountType: 'internal' };

  const firebaseAuthStub = {
    getUser: async () => ({ customClaims: REAL_SUPER_ADMIN_CLAIMS }),
  };

  function buildApp(isSuperAdminVerified: (req: any) => boolean) {
    const app = express();
    app.use(express.json());
    // The umbrella gate, as mounted in prestige-pass.ts.
    app.use('/admin', (req: any, res: any, next: any) =>
      isSuperAdminVerified(req) ? next() : res.status(403).json({ code: 'ADMIN_REQUIRED' }),
    );

    // BEFORE — the shape all 25 handlers used.
    app.post('/admin/wallet/adjust-old', async (req: any, res: any) => {
      const uid = req.firebaseUser?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      const adminUser = await firebaseAuthStub.getUser().catch(() => null);
      if (!(adminUser?.customClaims as any)?.admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      return res.json({ reached: true });
    });

    // AFTER — the router's canonical authority.
    app.post('/admin/wallet/adjust-new', async (req: any, res: any) => {
      const uid = req.firebaseUser?.uid;
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });
      if (!isSuperAdminVerified(req)) return res.status(403).json({ error: 'Admin access required' });
      return res.json({ reached: true });
    });
    return app;
  }

  /** Stands in for optionalFirebaseToken having decoded a token. */
  function asSuperAdmin(app: express.Express) {
    const wrapper = express();
    wrapper.use((req: any, _res, next) => {
      req.firebaseUser = { uid: 'nir-uid', email: 'nir@petwash.co.il', email_verified: true };
      next();
    });
    wrapper.use(app);
    return wrapper;
  }

  it('THE DEFECT: a verified super admin was refused — nothing writes a boolean `admin` claim', async () => {
    const res = await request(asSuperAdmin(buildApp(() => true)))
      .post('/admin/wallet/adjust-old')
      .send({ userId: 'u1', amountCents: 500, reason: 'goodwill', type: 'credit' });
    expect(res.status).toBe(403);
    expect(res.body.reached).toBeUndefined();
  });

  it('the fixed shape lets that same super admin through', async () => {
    const res = await request(asSuperAdmin(buildApp(() => true)))
      .post('/admin/wallet/adjust-new')
      .send({ userId: 'u1', amountCents: 500, reason: 'goodwill', type: 'credit' });
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });

  it('and refuses everyone else — the fix widens nothing', async () => {
    const res = await request(asSuperAdmin(buildApp(() => false)))
      .post('/admin/wallet/adjust-new')
      .send({ userId: 'u1', amountCents: 500, reason: 'goodwill', type: 'credit' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_REQUIRED');
  });
});
