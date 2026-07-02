/**
 * Pure (DB-free) marketplace incident taxonomy + decisions.
 *
 * Separate from the legacy shared/petwashIncidents.ts (kept for its current
 * consumers) — this is the richer set the home-service / marketplace incident
 * engine uses. Drives auto-escalation and payout freezing.
 */
export const INCIDENT_TYPES = [
  // pet
  'pet_injury', 'pet_illness', 'pet_escape', 'lost_pet', 'bite', 'aggression', 'grooming_injury', 'skin_reaction',
  // people / property
  'human_injury', 'property_damage', 'missing_item', 'theft_allegation',
  // home access
  'key_lost', 'access_code_shared', 'alarm_triggered', 'camera_disclosure_issue', 'neighbour_complaint',
  'building_security_issue', 'home_left_unlocked', 'unauthorised_guest', 'unauthorised_access_claim',
  // care / service
  'medication_error', 'feeding_error', 'provider_no_show', 'missed_visit', 'owner_unreachable', 'emergency_vet',
  // pre-service readiness (Host Stay Journey): critical care details missing
  // before start. Deliberately NOT payout-blocking and NOT critical — this is a
  // "complete the paperwork" nudge case, not a real incident.
  'care_details_incomplete',
  // station / platform
  'station_malfunction', 'payment_failure',
  // trust / conduct
  'privacy_breach', 'document_fraud', 'customer_abuse', 'provider_misconduct', 'customer_complaint', 'other',
] as const;
export type IncidentTypeX = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverityX = (typeof INCIDENT_SEVERITIES)[number];

export function isValidIncidentType(t: string): t is IncidentTypeX {
  return (INCIDENT_TYPES as readonly string[]).includes(t);
}

// Types that are inherently critical when severity is high (or always at critical).
const CRITICAL_TYPES = new Set<string>([
  'pet_injury', 'lost_pet', 'bite', 'human_injury', 'pet_escape',
  'theft_allegation', 'emergency_vet', 'privacy_breach', 'medication_error',
]);

/** Auto-escalation: should this incident be treated as critical? */
export function isCriticalIncident(type: string, severity: IncidentSeverityX): boolean {
  if (severity === 'critical') return true;
  if (severity === 'high' && CRITICAL_TYPES.has(type)) return true;
  return false;
}

// Incidents that should FREEZE provider payout until resolved.
const PAYOUT_BLOCKING_TYPES = new Set<string>([
  ...CRITICAL_TYPES,
  'property_damage', 'missing_item', 'provider_no_show', 'missed_visit',
  'document_fraud', 'provider_misconduct', 'unauthorised_access_claim',
]);

/** Should opening this incident hold the related payout? */
export function freezesPayout(type: string, severity: IncidentSeverityX): boolean {
  return isCriticalIncident(type, severity) || PAYOUT_BLOCKING_TYPES.has(type);
}

/** Effective severity after auto-escalation (critical types at 'high' → 'critical'). */
export function effectiveSeverity(type: string, severity: IncidentSeverityX): IncidentSeverityX {
  return isCriticalIncident(type, severity) ? 'critical' : severity;
}
