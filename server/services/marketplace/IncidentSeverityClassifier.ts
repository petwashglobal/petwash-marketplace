/**
 * IncidentSeverityClassifier — CEO PROGRAM 25 (Live Service Incident).
 *
 * Pure evaluator. Given a reported incident (kind + optional injury /
 * health signal), returns:
 *   • the severity level,
 *   • the recommended escalation action slug the client should offer
 *     as the primary next step.
 *
 * The classifier NEVER assumes the pet's condition — it only reflects
 * the incident kind and the reporter's stated signals. It never fires
 * emergency services on its own; that's an explicit user action.
 */

export type IncidentKind =
  | 'PET_INJURY_MINOR'
  | 'PET_INJURY_MAJOR'
  | 'PET_ILLNESS_UNKNOWN'
  | 'PET_MISSING'
  | 'PROVIDER_LATE_ARRIVAL'
  | 'PROVIDER_NO_SHOW'
  | 'ACCESS_ISSUE'
  | 'PROPERTY_DAMAGE'
  | 'AGGRESSION_INCIDENT'
  | 'OTHER';

export type IncidentSeverity = 'S1_LIFE_SAFETY' | 'S2_URGENT' | 'S3_STANDARD' | 'S4_INFORMATIONAL';

export interface IncidentReport {
  kind: IncidentKind;
  petLifeThreatened?: boolean;
  ownerReportedSevereBleeding?: boolean;
  ownerReportedUnconscious?: boolean;
  ownerReportedNotBreathing?: boolean;
  petMissingMinutes?: number;
  providerLateMinutes?: number;
}

export interface ClassifyOutcome {
  severity: IncidentSeverity;
  primaryAction: 'CALL_EMERGENCY_VET' | 'CALL_OWNER' | 'CALL_PROVIDER' | 'OPEN_SUPPORT_CASE' | 'REPORT_INCIDENT';
  requiresImmediateEscalation: boolean;
  reasonCode: string;
}

export function classifyIncident(input: IncidentReport): ClassifyOutcome {
  const lifeSignals = !!(input.petLifeThreatened
    || input.ownerReportedSevereBleeding
    || input.ownerReportedUnconscious
    || input.ownerReportedNotBreathing);

  if (lifeSignals) {
    return {
      severity: 'S1_LIFE_SAFETY',
      primaryAction: 'CALL_EMERGENCY_VET',
      requiresImmediateEscalation: true,
      reasonCode: 'LIFE_SAFETY_SIGNAL',
    };
  }

  switch (input.kind) {
    case 'PET_INJURY_MAJOR':
      return { severity: 'S1_LIFE_SAFETY', primaryAction: 'CALL_EMERGENCY_VET', requiresImmediateEscalation: true, reasonCode: 'PET_INJURY_MAJOR' };
    case 'PET_INJURY_MINOR':
      return { severity: 'S2_URGENT', primaryAction: 'CALL_OWNER', requiresImmediateEscalation: true, reasonCode: 'PET_INJURY_MINOR' };
    case 'PET_ILLNESS_UNKNOWN':
      return { severity: 'S2_URGENT', primaryAction: 'CALL_OWNER', requiresImmediateEscalation: true, reasonCode: 'PET_ILLNESS_UNKNOWN' };
    case 'PET_MISSING': {
      const mins = input.petMissingMinutes ?? 0;
      if (mins >= 30) return { severity: 'S1_LIFE_SAFETY', primaryAction: 'CALL_OWNER', requiresImmediateEscalation: true, reasonCode: 'PET_MISSING_LONG' };
      return { severity: 'S2_URGENT', primaryAction: 'CALL_OWNER', requiresImmediateEscalation: true, reasonCode: 'PET_MISSING_SHORT' };
    }
    case 'AGGRESSION_INCIDENT':
      return { severity: 'S2_URGENT', primaryAction: 'OPEN_SUPPORT_CASE', requiresImmediateEscalation: true, reasonCode: 'AGGRESSION_INCIDENT' };
    case 'PROVIDER_NO_SHOW':
      return { severity: 'S2_URGENT', primaryAction: 'CALL_PROVIDER', requiresImmediateEscalation: true, reasonCode: 'PROVIDER_NO_SHOW' };
    case 'PROVIDER_LATE_ARRIVAL': {
      const mins = input.providerLateMinutes ?? 0;
      if (mins >= 30) return { severity: 'S2_URGENT', primaryAction: 'CALL_PROVIDER', requiresImmediateEscalation: true, reasonCode: 'PROVIDER_VERY_LATE' };
      return { severity: 'S3_STANDARD', primaryAction: 'CALL_PROVIDER', requiresImmediateEscalation: false, reasonCode: 'PROVIDER_LATE' };
    }
    case 'ACCESS_ISSUE':
      return { severity: 'S3_STANDARD', primaryAction: 'CALL_OWNER', requiresImmediateEscalation: false, reasonCode: 'ACCESS_ISSUE' };
    case 'PROPERTY_DAMAGE':
      return { severity: 'S3_STANDARD', primaryAction: 'REPORT_INCIDENT', requiresImmediateEscalation: false, reasonCode: 'PROPERTY_DAMAGE' };
    case 'OTHER':
    default:
      return { severity: 'S4_INFORMATIONAL', primaryAction: 'OPEN_SUPPORT_CASE', requiresImmediateEscalation: false, reasonCode: 'OTHER' };
  }
}
