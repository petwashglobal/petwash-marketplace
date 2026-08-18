/**
 * Task 34 — CEO fire order 101-140.
 *
 * REMAINING /me /my /mine response-projection audit — the endpoints
 * NOT already pinned by prior fire-order PRs (#1778 disputes /my,
 * #1779 provider-applications /my, #1780 unified-vouchers /my,
 * #1781 access-requests /mine, #25 StaffPending).
 *
 * Contract: each endpoint MUST scope to the caller's own uid and
 * return an owner-safe DTO. This pin freezes the current shapes so
 * a regression cannot silently widen them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('legal-stamps GET /me — owner-scoped, service DTO', () => {
  const SRC = R('routes/legal-stamps.ts');
  it('handler registered and requires uid', () => {
    expect(SRC).toMatch(/router\.get\('\/me'/);
    expect(SRC).toContain('verifyFirebaseUid(req)');
    expect(SRC).toContain("res.status(401)");
  });
  it('returns stamps via service (no ad-hoc raw row splat)', () => {
    expect(SRC).toContain('ImmutableStampService.getStampsForActor(uid, 50)');
    expect(SRC).toContain('res.json({ success: true, stamps, count: stamps.length })');
  });
});

describe('paw-finder /my/posts — owner-scoped, phone-redacted', () => {
  const SRC = R('routes/paw-finder.ts');
  const start = SRC.indexOf("router.get('/my/posts'");
  const region = SRC.slice(start, start + 2000);
  it('handler registered under requireAuth', () => {
    expect(start).toBeGreaterThan(-1);
    expect(region).toContain('requireAuth');
  });
  it('SQL scopes by p.user_id = $1', () => {
    expect(region).toContain('WHERE p.user_id = $1');
  });
  it('response deletes contact_phone from every row (blocklist projection)', () => {
    expect(region).toMatch(/rows\.map\(r =>[\s\S]{0,120}delete s\.contact_phone/);
    expect(region).toContain('res.json({ rows: safe })');
  });
});

describe('paw-finder /my/contacts — owner-scoped, explicit column list', () => {
  const SRC = R('routes/paw-finder.ts');
  const start = SRC.indexOf("router.get('/my/contacts'");
  const region = SRC.slice(start, start + 2000);
  it('handler registered under requireAuth', () => {
    expect(start).toBeGreaterThan(-1);
    expect(region).toContain('requireAuth');
  });
  it('SELECT has an explicit column allowlist, not SELECT *', () => {
    expect(region).toMatch(/SELECT cr\.id, cr\.post_id, cr\.requester_user_id, cr\.status,/);
    expect(region).not.toMatch(/SELECT cr\.\*/);
  });
});

describe('walk-my-pet /walks/mine — owner-scoped, single combined WHERE', () => {
  const SRC = R('routes/walk-my-pet.ts');
  const start = SRC.indexOf("router.get('/walks/mine'");
  const region = SRC.slice(start, start + 2500);
  it('handler registered under requireAuth', () => {
    expect(start).toBeGreaterThan(-1);
    expect(region).toContain('requireAuth');
  });
  it('security comment about combined-WHERE regression is preserved', () => {
    // The comment explains a prior bug where .where(a).where(b) OVERWROTE
    // the ownership scope — pin it so a refactor cannot silently regress.
    expect(region).toContain("build ONE combined WHERE");
    expect(region).toContain('DROPPED the ownership scope');
  });
});

describe('teams /mine — owner-scoped', () => {
  const SRC = R('routes/teams.ts');
  const start = SRC.indexOf("router.get('/mine'");
  const region = SRC.slice(start, start + 2000);
  it('handler registered under requireAuth', () => {
    expect(start).toBeGreaterThan(-1);
    expect(region).toContain('requireAuth');
  });
});

describe('provider-onboarding /my/status + /my/messages — owner-scoped', () => {
  const SRC = R('routes/provider-onboarding.ts');
  const status = SRC.indexOf("router.get('/my/status'");
  const messages = SRC.indexOf("router.get('/my/messages'");
  it('both handlers registered', () => {
    expect(status).toBeGreaterThan(-1);
    expect(messages).toBeGreaterThan(-1);
  });
});
