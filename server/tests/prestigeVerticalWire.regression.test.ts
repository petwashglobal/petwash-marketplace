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

describe('CEO DEEP-LOGIC §50 — mutation handler now bound to the shared service', () => {
  it('actionBrainHandlers.set("PRESTIGE_JOIN", ...) exists', () => {
    // The extraction landed — both surfaces call enrollPrestige.
    expect(SRC).toMatch(/actionBrainHandlers\.set\('PRESTIGE_JOIN', async \(\{ actorUid, command \}\)/);
  });

  it('the handler imports and delegates to enrollPrestige — no inline SQL', () => {
    const idx = SRC.indexOf("actionBrainHandlers.set('PRESTIGE_JOIN'");
    const end = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(
      /await import\('\.\/services\/marketplace\/PrestigeEnrollmentService'\)/,
    );
    expect(body).toMatch(/await enrollPrestige\(actorUid, input\)/);
    expect(body).not.toMatch(/INSERT INTO privilege_members/);
    expect(body).not.toMatch(/db\.insert\(loyaltyProfiles\)/);
  });

  it('ENROLLED and ALREADY_ACTIVE both surface as COMPLETED with distinct message codes', () => {
    const idx = SRC.indexOf("actionBrainHandlers.set('PRESTIGE_JOIN'");
    const end = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/PRESTIGE_ALREADY_ACTIVE/);
    expect(body).toMatch(/PRESTIGE_ENROLLED/);
    expect(body).toMatch(/status: 'COMPLETED'/);
  });

  it('MISSING_REQUIRED_PROFILE and IDENTITY_CONFLICT surface as FAILED with stable codes', () => {
    const idx = SRC.indexOf("actionBrainHandlers.set('PRESTIGE_JOIN'");
    const end = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(/PRESTIGE_MISSING_REQUIRED_PROFILE/);
    expect(body).toMatch(/PRESTIGE_IDENTITY_RECONCILIATION_REQUIRED/);
  });
});
