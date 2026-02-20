import { logger } from '../lib/logger';
import { logSecurityEvent } from './securityEventsService';

let incidentModeEnabled = false;
let incidentReason = '';
let incidentActivatedAt: Date | null = null;
let incidentActivatedBy = '';

export function isIncidentMode(): boolean {
  return incidentModeEnabled;
}

export function getIncidentStatus() {
  return {
    enabled: incidentModeEnabled,
    reason: incidentReason,
    activatedAt: incidentActivatedAt?.toISOString() || null,
    activatedBy: incidentActivatedBy,
  };
}

export function activateIncidentMode(reason: string, activatedBy: string): void {
  incidentModeEnabled = true;
  incidentReason = reason;
  incidentActivatedAt = new Date();
  incidentActivatedBy = activatedBy;
  logger.warn(`[INCIDENT MODE] ACTIVATED by ${activatedBy}: ${reason}`);
  logSecurityEvent({
    userId: activatedBy,
    eventType: 'incident_mode_activated',
    riskScore: 100,
    metadata: { reason },
  });
}

export function deactivateIncidentMode(deactivatedBy: string): void {
  logger.warn(`[INCIDENT MODE] DEACTIVATED by ${deactivatedBy} (was active since ${incidentActivatedAt?.toISOString()})`);
  logSecurityEvent({
    userId: deactivatedBy,
    eventType: 'incident_mode_deactivated',
    riskScore: 0,
    metadata: { reason: incidentReason, wasSince: incidentActivatedAt?.toISOString() },
  });
  incidentModeEnabled = false;
  incidentReason = '';
  incidentActivatedAt = null;
  incidentActivatedBy = '';
}
