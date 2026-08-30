/**
 * server/routes.ts — Action Brain provider-response wire pin.
 *
 * CEO SPEED MODE §60-§67. All four action types must be registered as
 * handlers (BOOKING_ACCEPT / BOOKING_DECLINE / BOOKING_PROPOSE_CHANGE
 * / BOOKING_ACCEPT_PROPOSED_CHANGE) and every one of them delegates
 * to the shared ProviderBookingResponseService. No handler may write
 * `status = accepted` directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('impact resolvers registered for the four provider-response actions', () => {
  it.each([
    'BOOKING_ACCEPT',
    'BOOKING_DECLINE',
    'BOOKING_PROPOSE_CHANGE',
    'BOOKING_ACCEPT_PROPOSED_CHANGE',
  ])('actionBrainImpactResolvers.set(%s, ...)', (name) => {
    expect(SRC).toMatch(new RegExp(`actionBrainImpactResolvers\\.set\\('${name}'`));
  });
});

describe('handlers registered for the four action types', () => {
  it.each([
    ['BOOKING_ACCEPT',                  'providerAcceptBooking'],
    ['BOOKING_DECLINE',                 'providerDeclineBooking'],
    ['BOOKING_PROPOSE_CHANGE',          'providerProposeChange'],
    ['BOOKING_ACCEPT_PROPOSED_CHANGE',  'customerAcceptProposal'],
  ] as const)('handler %s → service %s', (action, svc) => {
    const idx = SRC.indexOf(`actionBrainHandlers.set('${action}'`);
    expect(idx).toBeGreaterThan(0);
    const end = SRC.indexOf('});', idx);
    const body = SRC.slice(idx, end);
    expect(body).toMatch(
      /await import\('\.\/services\/marketplace\/ProviderBookingResponseService'\)/,
    );
    expect(body).toMatch(new RegExp(svc));
  });
});

describe('handlers NEVER write booking status directly', () => {
  it("no inline UPDATE bookings / status='accepted' in the handler block", () => {
    const idx = SRC.indexOf("actionBrainHandlers.set('BOOKING_ACCEPT'");
    const end = SRC.indexOf("actionBrainHandlers.set('BOOKING_ACCEPT_PROPOSED_CHANGE'", idx);
    const region = SRC.slice(idx, end > 0 ? end : idx + 4000);
    expect(region).not.toMatch(/UPDATE bookings/i);
    expect(region).not.toMatch(/status:\s*'accepted'/i);
    expect(region).not.toMatch(/status:\s*'declined'/i);
  });
});

describe('outcome mapping — every ResponseOutcomeCode has a stable ActionResult', () => {
  it('ACCEPTED / DECLINED / CHANGE_PROPOSED / CHANGE_ACCEPTED / CHANGE_DECLINED emit COMPLETED', () => {
    expect(SRC).toMatch(/case 'ACCEPTED':[\s\S]{0,200}status: 'COMPLETED'[\s\S]{0,120}BOOKING_ACCEPTED/);
    expect(SRC).toMatch(/case 'DECLINED':[\s\S]{0,200}BOOKING_DECLINED/);
    expect(SRC).toMatch(/case 'CHANGE_PROPOSED':[\s\S]{0,200}CHANGE_PROPOSED/);
    expect(SRC).toMatch(/case 'CUSTOMER_APPLIED_PROPOSAL':[\s\S]{0,200}CHANGE_ACCEPTED/);
    expect(SRC).toMatch(/case 'CUSTOMER_DECLINED_PROPOSAL':[\s\S]{0,200}CHANGE_DECLINED/);
  });

  it('SELF_BOOKING_BLOCKED → FAILED SELF_BOOKING_BLOCKED (§11)', () => {
    expect(SRC).toMatch(
      /case 'SELF_BOOKING_BLOCKED':[\s\S]{0,200}status: 'FAILED'[\s\S]{0,120}SELF_BOOKING_BLOCKED/,
    );
  });

  it('DISPATCHER_NOT_ENABLED → FAILED OFFLINE_ACTION_UNAVAILABLE (feature-flag surface)', () => {
    expect(SRC).toMatch(
      /case 'DISPATCHER_NOT_ENABLED':[\s\S]{0,200}OFFLINE_ACTION_UNAVAILABLE/,
    );
  });

  it('UNKNOWN_OUTCOME → PROCESSING LEASE_EXPIRED_RECONCILE_REQUIRED (§43/§47 discipline)', () => {
    expect(SRC).toMatch(
      /default:[\s\S]{0,200}status: 'PROCESSING'[\s\S]{0,120}LEASE_EXPIRED_RECONCILE_REQUIRED/,
    );
  });
});
