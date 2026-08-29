/**
 * CEO MASTER DIRECTIVE 2026-08-28 §24 §25 §55 §56 §66 §67 §68 —
 * Journey Brain Phase 6 telemetry invariants.
 *
 * Everything the concierge learns about "did the user open / dismiss
 * / act" lives here. The store keeps small structured envelopes.
 * Explicitly not stored: LLM chain-of-thought / arbitrary free text.
 *
 * User can FORGET a preference (§55) — every row for (user, reason)
 * gets deleted. Ledgers / invoices / bookings are untouched (§56).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const MIG = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'migrations', '0136_journey_action_events_2026_08_28.sql'),
  'utf8',
);
const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'shared', 'schema.ts'),
  'utf8',
);
const SVC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'journeyEvents.ts'),
  'utf8',
);
const ROUTE = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'journey.ts'),
  'utf8',
);

describe('journey_action_events migration (CEO §66)', () => {
  it('creates the table with the STRUCTURED envelope only — no free-text field', () => {
    expect(MIG).toMatch(/CREATE TABLE IF NOT EXISTS journey_action_events/);
    for (const col of [
      'event_id',
      'user_uid',
      'actor',
      'reason_code',
      'event_type',
      'action_type',
      'source',
      'entity_ref',
      'metadata',
      'created_at',
    ]) {
      expect(MIG).toContain(col);
    }
    // Deliberately absent: any free-text `note` / `reasoning` field.
    expect(MIG).not.toMatch(/reasoning\s+TEXT/i);
    expect(MIG).not.toMatch(/chain_of_thought/i);
  });

  it('indexes (user, reason, type) + (user, created_at) for the composer + dismiss lookups', () => {
    expect(MIG).toMatch(/journey_action_events_user_reason_idx/);
    expect(MIG).toMatch(/journey_action_events_user_created_idx/);
  });

  it('drizzle schema mirrors the table', () => {
    expect(SCHEMA).toMatch(/export const journeyActionEvents = pgTable\("journey_action_events",/);
    expect(SCHEMA).toContain('reasonCode:');
    expect(SCHEMA).toContain('eventType:');
  });
});

describe('journeyEvents service (CEO §66 §67)', () => {
  it('recordJourneyEvent bounds every string field — no unbounded input reaches the DB', () => {
    // Long strings from a hostile client must NOT expand the row.
    expect(SVC).toMatch(/reasonCode: input\.reasonCode\.slice\(0, 64\),/);
    expect(SVC).toMatch(/actionType: input\.actionType \? input\.actionType\.slice\(0, 32\) : null,/);
    expect(SVC).toMatch(/source: input\.source \? input\.source\.slice\(0, 64\) : null,/);
    expect(SVC).toMatch(/entityRef: input\.entityRef \? input\.entityRef\.slice\(0, 200\) : null,/);
  });

  it('countRecentDismisses windows on 30 days by default (CEO §67 down-rank)', () => {
    expect(SVC).toMatch(/windowMs: number = 30 \* 24 \* 60 \* 60 \* 1000/);
    expect(SVC).toMatch(/eq\(journeyActionEvents\.eventType, 'dismissed'\),/);
  });

  it('forgetReason DELETES every row for (user, reason) — CEO §55', () => {
    expect(SVC).toMatch(/export async function forgetReason\(userUid: string, reasonCode: string\): Promise<void>/);
    expect(SVC).toMatch(/\.delete\(journeyActionEvents\)\s*\n\s*\.where\(and\(\s*\n\s*eq\(journeyActionEvents\.userUid, userUid\),\s*\n\s*eq\(journeyActionEvents\.reasonCode, reasonCode\),/);
  });

  it('exposes the six event types — no more, no less (CEO §66 fixed vocabulary)', () => {
    for (const t of [
      "'shown'",
      "'clicked'",
      "'dismissed'",
      "'not_interested'",
      "'forget_reason'",
      "'completed'",
    ]) {
      expect(SVC).toContain(t);
    }
  });

  it('recordJourneyEvent REFUSES to write without userUid / actor / reasonCode / eventType', () => {
    expect(SVC).toMatch(/if \(!input\.userUid\)    throw new Error\('journeyEvents: userUid required'\);/);
    expect(SVC).toMatch(/if \(!input\.actor\)      throw new Error\('journeyEvents: actor required'\);/);
    expect(SVC).toMatch(/if \(!input\.reasonCode\) throw new Error\('journeyEvents: reasonCode required'\);/);
    expect(SVC).toMatch(/if \(!input\.eventType\)  throw new Error\('journeyEvents: eventType required'\);/);
  });
});

describe('/api/journey/events route (CEO §22 §55 §66)', () => {
  it('POST validates the body with Zod eventType enum', () => {
    expect(ROUTE).toMatch(/const EventBodySchema = z\.object\(\{/);
    expect(ROUTE).toMatch(/eventType: z\.enum\(EVENT_TYPES as \[JourneyEventType, \.\.\.JourneyEventType\[\]\]\),/);
  });

  it('POST derives userUid from the Firebase token — never from the body', () => {
    // Same discipline as the rest of the /api/journey surface.
    // Guard for the specific POST handler.
    const start = ROUTE.indexOf("router.post('/events'");
    const end = ROUTE.indexOf("router.", start + 10);
    const block = ROUTE.slice(start, end);
    expect(block).toMatch(/const uid = callerUid\(req\);/);
    expect(block).not.toMatch(/req\.body\.userUid/);
    expect(block).toMatch(/userUid: uid,/);
  });

  it('DELETE /events/:reasonCode is the forget path — Firebase-authed', () => {
    expect(ROUTE).toMatch(/router\.delete\('\/events\/:reasonCode'/);
    expect(ROUTE).toMatch(/await forgetReason\(uid, reasonCode\);/);
  });
});
