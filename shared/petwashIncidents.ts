// FILE: shared/petwashIncidents.ts
// Pet Wash™ - Incident Management
// Tracks safety incidents, pet injuries, customer complaints, and critical events

export type IncidentType =
  | "PET_INJURY"
  | "CUSTOMER_COMPLAINT"
  | "SAFETY_VIOLATION"
  | "PROPERTY_DAMAGE"
  | "DRIVING_ACCIDENT"
  | "AGGRESSION"
  | "NO_SHOW"
  | "OTHER";

export type IncidentSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type IncidentStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "RESOLVED"
  | "CLOSED";

export interface Incident {
  id: string;
  contractorId?: string;
  jobId?: string;
  customerId?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  reportedAt: string;
  resolvedAt?: string | null;
  notes?: string;
}

export function isCritical(incident: Incident): boolean {
  // Critical incidents that should block contractor immediately
  const criticalTypes: IncidentType[] = [
    "PET_INJURY",
    "AGGRESSION",
    "DRIVING_ACCIDENT",
  ];

  if (incident.severity === "CRITICAL") {
    return true;
  }

  if (criticalTypes.includes(incident.type) && incident.severity === "HIGH") {
    return true;
  }

  return false;
}

export function getOpenCriticalCount(
  contractorId: string,
  incidents: Incident[]
): number {
  return incidents.filter(
    (i) =>
      i.contractorId === contractorId &&
      (i.status === "OPEN" || i.status === "INVESTIGATING") &&
      isCritical(i)
  ).length;
}
