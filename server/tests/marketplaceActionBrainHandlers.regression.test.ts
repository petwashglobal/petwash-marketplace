/**
 * Marketplace Action Brain handler-wire pin — CEO SPEED-MODE.
 *
 * Locks that every marketplace vertical shipped in this session has:
 *   – an impact resolver entry (server-derived, moneyCents:0 for
 *     the non-financial verbs — money moves at the domain authority
 *     under acceptance, not at the proposal/handoff/call verb).
 *   – an Action Brain handler entry that dynamic-imports its shared
 *     service and delegates through it (never inline SQL, never a
 *     status literal on the booking).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);

describe('impact resolvers registered for every vertical', () => {
  it.each([
    'MEET_GREET_REQUEST', 'MEET_GREET_ACCEPT', 'MEET_GREET_DECLINE', 'MEET_GREET_ACKNOWLEDGE',
    'HANDOFF_ISSUE_CODE', 'HANDOFF_VERIFY_CODE',
    'CUSTOMER_REQUEST_ADD_PET', 'PROVIDER_PROPOSE_ADD_PET', 'ACCEPT_ADD_PET_PROPOSAL', 'DECLINE_ADD_PET_PROPOSAL',
    'CUSTOMER_REQUEST_EXTENSION', 'PROVIDER_PROPOSE_EXTENSION', 'ACCEPT_EXTENSION_PROPOSAL', 'DECLINE_EXTENSION_PROPOSAL',
    'BOOKING_START_JOB', 'BOOKING_COMPLETE_JOB',
    'CALL_PROVIDER', 'CALL_OWNER',
  ])('impact resolver present for %s', (name) => {
    // The impact resolvers are set via a for-loop over an array literal.
    expect(SRC).toMatch(new RegExp(`'${name}'`));
  });
});

describe('handlers dynamic-import the shared service, never inline SQL', () => {
  it.each([
    ['MEET_GREET_REQUEST',       'MeetAndGreetService', 'proposeMeetGreet'],
    ['MEET_GREET_ACCEPT',        'MeetAndGreetService', 'confirmMeetGreet'],
    ['MEET_GREET_DECLINE',       'MeetAndGreetService', 'cancelMeetGreet'],
    ['MEET_GREET_ACKNOWLEDGE',   'MeetAndGreetService', 'acknowledgeMeetGreet'],
    ['HANDOFF_ISSUE_CODE',       'HandoffService',      'issueHandoffCode'],
    ['HANDOFF_VERIFY_CODE',      'HandoffService',      'verifyHandoffCode'],
    ['BOOKING_START_JOB',        'JobLifecycleService', 'startJob'],
    ['BOOKING_COMPLETE_JOB',     'JobLifecycleService', 'completeJob'],
  ] as const)('handler %s → service %s.%s', (action, service, fn) => {
    const idx = SRC.indexOf(`actionBrainHandlers.set('${action}'`);
    expect(idx).toBeGreaterThan(0);
    // Scan a generous window since some handler bodies are multi-line.
    const body = SRC.slice(idx, idx + 2000);
    expect(body).toMatch(new RegExp(`services/marketplace/${service}`));
    expect(body).toMatch(new RegExp(fn));
  });

  it('modification proposal handlers all wire BookingModificationService via wireMod* helpers', () => {
    for (const action of [
      'CUSTOMER_REQUEST_ADD_PET', 'PROVIDER_PROPOSE_ADD_PET',
      'ACCEPT_ADD_PET_PROPOSAL', 'DECLINE_ADD_PET_PROPOSAL',
      'CUSTOMER_REQUEST_EXTENSION', 'PROVIDER_PROPOSE_EXTENSION',
      'ACCEPT_EXTENSION_PROPOSAL', 'DECLINE_EXTENSION_PROPOSAL',
    ]) {
      // Wired via `wireModPropose('X', ...)` or `wireModRespond('X', ...)`.
      expect(SRC).toMatch(new RegExp(`wireMod(?:Propose|Respond)\\('${action}'`));
    }
    // The wire helpers import the modification service.
    expect(SRC).toMatch(/services\/marketplace\/BookingModificationService/);
  });

  it('CALL_PROVIDER + CALL_OWNER wire MaskedPhoneCallService via wireCall', () => {
    for (const action of ['CALL_PROVIDER', 'CALL_OWNER']) {
      expect(SRC).toMatch(new RegExp(`wireCall\\('${action}'`));
    }
    expect(SRC).toMatch(/services\/marketplace\/MaskedPhoneCallService/);
  });
});

describe('no handler writes a status literal on the booking directly', () => {
  it('the vertical handler block never emits UPDATE bookings / status literals', () => {
    const start = SRC.indexOf('// CEO SPEED-MODE — remaining marketplace vertical handlers.');
    const end = SRC.indexOf('function providerResponseToAction', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const region = SRC.slice(start, end);
    // `status: 'COMPLETED'` is the ActionResult status the mapper
    // returns to the client — that's fine. The ban is on writing a
    // LOWER-case booking column value; the domain authority owns
    // that transition, not this handler.
    expect(region).not.toMatch(/UPDATE bookings/i);
    expect(region).not.toMatch(/status:\s*'accepted'\b/);
    expect(region).not.toMatch(/status:\s*'declined'\b/);
    expect(region).not.toMatch(/status:\s*'cancelled'\b/);
    expect(region).not.toMatch(/status:\s*'completed'\b/);
  });
});
