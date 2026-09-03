/**
 * V2 self-complete + escrow time-based-release hardening — regression pins (2026-07-08).
 *
 * Money-integrity hunt, two HIGH findings, fixed surgically:
 *
 * #1 — V2 provider self-complete. POST /api/provider-dashboard/v2/bookings/:id/complete
 *      transitioned in_progress → 'completed' directly. 'completed' is in the
 *      payout gate's COMPLETED_STATUSES, so a provider could self-serve a booking
 *      into a payout-eligible state with NO customer confirmation. Now it lands in
 *      the dual-approval status 'provider_marked_complete' (like V1). The customer
 *      confirms (→ completed + escrow release) or the auto-approve cron advances it
 *      after 24h so the provider is never trapped unpaid.
 *
 * #2a — Time-based escrow orphan-release. autoReleaseExpiredHolds releases 'held'
 *      escrows 72h after CREATION (escrow is created at payment-init, before the
 *      service). The payout gate was global-shadow (env flag unset) so it released
 *      even never-completed bookings. Flipping the GLOBAL flag would break the
 *      happy path (V1 owner-confirm releases immediately; the 48h refund-window
 *      gate would then throw). Fix: a per-call `enforceGate` opt — the time-based
 *      orphan release forces the gate; explicit owner-confirm / manual / octopus
 *      releases are untouched.
 *
 * #2b — The 24h auto-approve cron never checked disputes, so it could create the
 *      earning + release escrow for a DISPUTED booking. Now it skips any booking
 *      with an open booking_disputes row.
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const V2 = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'provider-dashboard-v2.ts'), 'utf8');
const ESCROW = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'EscrowService.ts'), 'utf8');
const CRON = fs.readFileSync(path.resolve(__dirname, '..', 'cron', 'auto-approve-completions.ts'), 'utf8');

describe('V2 self-complete goes to the dual-approval gate (#1)', () => {
  it("the 'complete' action targets provider_marked_complete, NOT completed", () => {
    expect(V2).toMatch(/complete:\s*'provider_marked_complete'/);
    expect(V2).not.toMatch(/complete:\s*'completed'/);
  });

  it('provider_marked_complete stays visible under the provider ACTIVE tab', () => {
    expect(V2).toMatch(/active:\s*\[[^\]]*'provider_marked_complete'/);
  });

  it("it is NOT put in the 'completed'/earned group", () => {
    expect(V2).not.toMatch(/completed:\s*\[[^\]]*'provider_marked_complete'/);
  });

  it('complete stamps provider_completed_at (what the auto-approve cron keys off)', () => {
    expect(V2).toMatch(/provider_completed_at = \$\$\{p\+\+\}/);
  });
});

describe('Escrow time-based release forces the payout gate (#2a)', () => {
  it('releaseEscrowPayment accepts an enforceGate opt', () => {
    expect(ESCROW).toMatch(/opts\?:\s*\{\s*bypassGate\?:\s*boolean;\s*enforceGate\?:\s*boolean\s*\}/);
  });

  it('enforce is forced when enforceGate is true; env default is FAIL-CLOSED (only "false" opts back into shadow)', () => {
    // Release freeze 2026-09-03 top-up (MONEY-1 CRIT): the default flipped from
    // shadow ("=== \"true\"") to enforce ("!== \"false\""). Any per-call
    // enforceGate:true still forces the gate independent of the env; and the
    // env-driven path now only opts *out* explicitly.
    expect(ESCROW).toMatch(/opts\?\.enforceGate === true \|\| process\.env\.ESCROW_PAYOUT_GATE_ENFORCE !== "false"/);
    // The prior shadow-default shape must not sneak back.
    expect(ESCROW).not.toMatch(/ESCROW_PAYOUT_GATE_ENFORCE === "true"/);
  });

  it('the time-based orphan auto-release passes enforceGate:true', () => {
    expect(ESCROW).toMatch(/releaseEscrowPayment\(escrow\.id,\s*"system_auto_release",\s*\{\s*enforceGate:\s*true\s*\}\)/);
  });

  it('explicit owner-confirm / manual releases are NOT force-gated (no enforceGate on them)', () => {
    // the immediate release paths call the 2-arg form; only the orphan cron adds enforceGate
    expect(ESCROW).toMatch(/system_auto_release",\s*\{\s*enforceGate:\s*true\s*\}/);
  });
});

describe('Auto-approve cron skips disputed bookings (#2b)', () => {
  it('imports bookingDisputes', () => {
    expect(CRON).toMatch(/bookingDisputes/);
  });

  it('queries booking_disputes for an OPEN dispute and continues (skips) when found', () => {
    expect(CRON).toMatch(/\.from\(bookingDisputes\)/);
    expect(CRON).toMatch(/inArray\(bookingDisputes\.status,\s*\['open',\s*'under_review',\s*'pending',\s*'escalated'\]\)/);
    expect(CRON).toMatch(/open dispute; not auto-releasing/);
  });
});
