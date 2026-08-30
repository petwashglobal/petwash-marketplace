/**
 * IncidentSeverityClassifier — Program 25.
 */
import { describe, it, expect } from 'vitest';
import { classifyIncident } from '../services/marketplace/IncidentSeverityClassifier';

describe('IncidentSeverityClassifier', () => {
  it('life-safety signal (unconscious) → S1 + CALL_EMERGENCY_VET', () => {
    const out = classifyIncident({ kind: 'PET_ILLNESS_UNKNOWN', ownerReportedUnconscious: true });
    expect(out.severity).toBe('S1_LIFE_SAFETY');
    expect(out.primaryAction).toBe('CALL_EMERGENCY_VET');
    expect(out.requiresImmediateEscalation).toBe(true);
  });

  it('life-safety signal (not breathing) → S1 CALL_EMERGENCY_VET', () => {
    const out = classifyIncident({ kind: 'PET_INJURY_MINOR', ownerReportedNotBreathing: true });
    expect(out.severity).toBe('S1_LIFE_SAFETY');
    expect(out.primaryAction).toBe('CALL_EMERGENCY_VET');
  });

  it('PET_INJURY_MAJOR → S1', () => {
    const out = classifyIncident({ kind: 'PET_INJURY_MAJOR' });
    expect(out.severity).toBe('S1_LIFE_SAFETY');
  });

  it('PET_INJURY_MINOR → S2 CALL_OWNER', () => {
    const out = classifyIncident({ kind: 'PET_INJURY_MINOR' });
    expect(out.severity).toBe('S2_URGENT');
    expect(out.primaryAction).toBe('CALL_OWNER');
  });

  it('PET_MISSING >= 30 minutes → S1', () => {
    const out = classifyIncident({ kind: 'PET_MISSING', petMissingMinutes: 45 });
    expect(out.severity).toBe('S1_LIFE_SAFETY');
  });

  it('PET_MISSING < 30 minutes → S2', () => {
    const out = classifyIncident({ kind: 'PET_MISSING', petMissingMinutes: 10 });
    expect(out.severity).toBe('S2_URGENT');
  });

  it('PROVIDER_LATE_ARRIVAL 45 min → S2, less than 30 min → S3', () => {
    expect(classifyIncident({ kind: 'PROVIDER_LATE_ARRIVAL', providerLateMinutes: 45 }).severity).toBe('S2_URGENT');
    expect(classifyIncident({ kind: 'PROVIDER_LATE_ARRIVAL', providerLateMinutes: 15 }).severity).toBe('S3_STANDARD');
  });

  it('PROVIDER_NO_SHOW → S2 CALL_PROVIDER', () => {
    const out = classifyIncident({ kind: 'PROVIDER_NO_SHOW' });
    expect(out.severity).toBe('S2_URGENT');
    expect(out.primaryAction).toBe('CALL_PROVIDER');
  });

  it('PROPERTY_DAMAGE → S3 REPORT_INCIDENT (not immediate escalation)', () => {
    const out = classifyIncident({ kind: 'PROPERTY_DAMAGE' });
    expect(out.severity).toBe('S3_STANDARD');
    expect(out.requiresImmediateEscalation).toBe(false);
  });

  it('OTHER → S4 OPEN_SUPPORT_CASE', () => {
    const out = classifyIncident({ kind: 'OTHER' });
    expect(out.severity).toBe('S4_INFORMATIONAL');
    expect(out.primaryAction).toBe('OPEN_SUPPORT_CASE');
  });
});
