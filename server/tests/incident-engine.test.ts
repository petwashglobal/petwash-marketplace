/**
 * Incident engine tests: taxonomy validity, auto-escalation, payout-freeze
 * decisions, and source-introspection that the service freezes payout on
 * critical incidents and lifts it on resolve.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isValidIncidentType, isCriticalIncident, freezesPayout, effectiveSeverity,
} from '../../shared/incident-engine';

const ROOT = resolve(__dirname, '..', '..');
const src = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('incident taxonomy', () => {
  it('accepts home-service types, rejects unknown', () => {
    expect(isValidIncidentType('lost_pet')).toBe(true);
    expect(isValidIncidentType('theft_allegation')).toBe(true);
    expect(isValidIncidentType('nonsense')).toBe(false);
  });
});

describe('auto-escalation', () => {
  it('CRITICAL severity is always critical', () => {
    expect(isCriticalIncident('feeding_error', 'critical')).toBe(true);
  });
  it('a critical TYPE at HIGH escalates to critical', () => {
    expect(isCriticalIncident('bite', 'high')).toBe(true);
    expect(effectiveSeverity('bite', 'high')).toBe('critical');
  });
  it('a low-risk type at low stays non-critical', () => {
    expect(isCriticalIncident('customer_complaint', 'low')).toBe(false);
    expect(effectiveSeverity('customer_complaint', 'low')).toBe('low');
  });
});

describe('payout freeze', () => {
  it('critical incidents freeze payout', () => {
    expect(freezesPayout('lost_pet', 'high')).toBe(true);
    expect(freezesPayout('theft_allegation', 'medium')).toBe(true);
  });
  it('service-failure types freeze payout', () => {
    expect(freezesPayout('provider_no_show', 'low')).toBe(true);
    expect(freezesPayout('property_damage', 'medium')).toBe(true);
  });
  it('a minor complaint does not freeze payout', () => {
    expect(freezesPayout('customer_complaint', 'low')).toBe(false);
  });
});

describe('service wiring (source-introspection)', () => {
  const svc = src('server/services/incidentService.ts');
  it('opening a payout-blocking incident sets payout_hold', () => {
    expect(svc).toMatch(/payoutHold = freezesPayout/);
    expect(svc).toMatch(/payoutHold,/);
  });
  it('resolving an incident lifts the payout hold', () => {
    expect(svc).toMatch(/status: 'resolved'[\s\S]{0,80}payoutHold: false/);
  });
  it('payout gate can query open blocking incidents', () => {
    expect(svc).toMatch(/hasOpenPayoutBlockingIncident/);
    expect(svc).toMatch(/inArray\(incidentReports\.status, \['open', 'investigating'\]\)/);
  });
});
