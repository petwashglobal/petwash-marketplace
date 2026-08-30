/**
 * Vertical 1 — Prestige Join through the Action Brain.
 *
 * CEO NEXT-AUTO §36 + Doctrine §41 + Security Correction §1, §7.
 *
 * Locks the shape of the wire:
 *   • Real Prestige loader reads user row + Firebase claims (never body).
 *   • Impact resolver registered server-side (client cannot claim impact).
 *   • Handler NOT registered until a durable idempotency adapter lands
 *     and the existing /api/prestige/join authority is wrapped as a
 *     callable service. Until then the mutation endpoint stays 501.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('CEO §36 — Prestige loader reads server-side state (never body)', () => {
  it('loadPrestigeContext is registered and reads pgStorage + firebase-admin', () => {
    expect(SRC).toMatch(/loadPrestigeContext = async \(actorUid: string\) =>/);
    expect(SRC).toMatch(/pgStorage\.getUser\(actorUid\)/);
    expect(SRC).toMatch(/fbAdminAuth\.getUser\(actorUid\)/);
  });

  it('reads isClubMember OR Firebase claims — mirrors the whoami source', () => {
    expect(SRC).toMatch(
      /isClubMember === true[\s\S]{0,80}claims\.program === 'prestige'[\s\S]{0,80}claims\.loyaltyMember === true/,
    );
  });

  it('reads verified email + mobile from the users row', () => {
    expect(SRC).toMatch(/hasVerifiedEmail:\s*!!\(user as any\)\.emailVerified/);
    expect(SRC).toMatch(/hasVerifiedMobile:\s*!!\(user as any\)\.phoneVerified/);
  });

  it('loader errors return null → endpoint responds 404 (never 500)', () => {
    const idx = SRC.indexOf('loadPrestigeContext = async');
    const end = SRC.indexOf('};', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/catch[\s\S]{0,60}return null/);
  });
});

describe('CEO §1 — PRESTIGE_JOIN impact is server-derived', () => {
  it('impactResolvers Map has an entry for PRESTIGE_JOIN', () => {
    expect(SRC).toMatch(
      /actionBrainImpactResolvers\.set\(['"]PRESTIGE_JOIN['"], async \(\) => \(\{[\s\S]{0,200}legalEffect: true/,
    );
  });

  it('the resolver marks no money charge (Prestige is an entitlement, not a purchase)', () => {
    const idx = SRC.indexOf("set('PRESTIGE_JOIN'");
    const end = SRC.indexOf('}));', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/moneyCents:\s*0/);
    expect(body).toMatch(/affectsOtherParty:\s*false/);
    expect(body).toMatch(/legalEffect:\s*true/);
  });
});

describe('CEO §7 — mutation handler NOT registered until durable store lands', () => {
  it('actionBrainHandlers does NOT have a PRESTIGE_JOIN entry', () => {
    // The handler must not be registered while the store is in-memory.
    // A future PR wraps /api/prestige/join as a callable service +
    // registers a durable adapter; only THEN does the handler slot fill.
    expect(SRC).not.toMatch(/actionBrainHandlers\.set\(['"]PRESTIGE_JOIN['"]/);
  });

  it('the wire is documented as intentional in an inline comment', () => {
    expect(SRC).toMatch(/Handler intentionally NOT registered/);
  });
});
