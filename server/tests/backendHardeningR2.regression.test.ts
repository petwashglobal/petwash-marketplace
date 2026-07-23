/**
 * Backend hardening round 2 — the board's remaining known backend defects
 * (CEO 2026-07-23 "fix back end issues well aware been told"):
 *
 * 1) Nayax raw-body class bug (same as the SendGrid storm #1484): the global
 *    JSON parser must skip EVERY raw-bytes webhook path, and the Monyx events
 *    route must fail CLOSED when raw bytes are unavailable while a secret is
 *    configured (never verify a signature against re-stringified JSON).
 * 2) prestige /join ok-over-dropped-row: a NEW enrollment whose loyalty
 *    profile fails must fail LOUD (returning member keeps non-fatal).
 * 3) H4-legacy: updateLoyalty raw counter gains a per-booking replay guard
 *    inside the same transaction.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const indexTs = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');
const monyx = readFileSync(resolve(ROOT, 'server/routes/nayax-monyx-events.ts'), 'utf8');
const join = readFileSync(resolve(ROOT, 'server/routes/prestige-join.ts'), 'utf8');
const sync = readFileSync(resolve(ROOT, 'server/actions/loyaltySync.ts'), 'utf8');

describe('raw-body webhook exemptions cover every raw-bytes path', () => {
  it('sendgrid + nayax-events + the /nayax/* family skip the global JSON parser', () => {
    expect(indexTs).toMatch(/RAW_BODY_WEBHOOK_PATHS/);
    expect(indexTs).toContain("'/api/webhooks/sendgrid'");
    expect(indexTs).toContain("'/api/webhooks/nayax-events'");
    expect(indexTs).toMatch(/startsWith\('\/api\/webhooks\/nayax\/'\)/);
  });

  it('monyx events fails closed when secret set but raw bytes unavailable', () => {
    expect(monyx).toMatch(/Buffer\.isBuffer\(req\.body\) \? req\.body : null/);
    expect(monyx).toMatch(/raw_body_unavailable/);
    // The old unconditional cast must be gone.
    expect(monyx).not.toMatch(/const rawBody = req\.body as Buffer;/);
  });
});

describe('prestige /join never reports a join that did not happen', () => {
  it('new-enrollment loyalty failure returns 500, existing member continues', () => {
    expect(join).toMatch(/PRESTIGE_JOIN_LOYALTY_FAILED/);
    expect(join).toMatch(/if \(!alreadyEnrolled\) \{/);
    expect(join).toMatch(/existing member — continuing/);
  });
});

describe('legacy loyalty counter replay guard', () => {
  it('same (user, reason, bookingId) award is skipped inside the transaction', () => {
    expect(sync).toMatch(/metadata->>'bookingId' = \$\{String\(metadata\.bookingId\)\}/);
    expect(sync).toMatch(/duplicateReplay = true/);
    expect(sync).toMatch(/duplicate: true/);
    // Guard runs BEFORE the counter update, inside db.transaction.
    const txStart = sync.indexOf('db.transaction');
    const guard = sync.indexOf("metadata->>'bookingId'");
    const counter = sync.indexOf('loyalty_points = GREATEST');
    expect(txStart).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(txStart);
    expect(counter).toBeGreaterThan(guard);
  });
});
