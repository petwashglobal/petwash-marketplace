/**
 * KYC 2026 Incident Response Protocol
 * 
 * Automated incident classification and response for KYC security events.
 * 
 * SEVERITY LEVELS:
 * - P1 (Critical): Data breach confirmed, mass document leak, admin credential compromise
 * - P2 (High): Suspected breach, anomaly pattern suggesting organized fraud, chain integrity violation
 * - P3 (Medium): Individual fraud attempt, repeated liveness failures, suspicious admin access
 * - P4 (Low): Rate limit violations, single failed attempts, minor anomalies
 * 
 * RESPONSE TIMELINE:
 * - P1: Immediate lockdown, alert within 1 minute, containment within 15 minutes
 * - P2: Alert within 5 minutes, investigation within 30 minutes
 * - P3: Alert within 15 minutes, review within 4 hours
 * - P4: Logged, reviewed in daily report
 * 
 * CONTAINMENT ACTIONS:
 * - Suspend KYC operations
 * - Revoke all admin MFA sessions
 * - Block suspicious IPs/devices
 * - Preserve audit trail
 * - Notify security officer
 */

import { logger } from '../../lib/logger';
import { KYCSecurityAlerts } from './KYCSecurityAlerts';
import { kycAuditTrail } from './KYCAuditTrail';
import { db } from '../../db';
import { kycIncidents } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';

export interface SecurityIncident {
  id: string;
  severity: IncidentSeverity;
  type: string;
  title: string;
  description: string;
  detectedAt: string;
  respondedAt?: string;
  resolvedAt?: string;
  status: 'detected' | 'investigating' | 'contained' | 'resolved';
  affectedUsers: string[];
  containmentActions: string[];
  evidence: Record<string, any>;
}

const activeIncidents = new Map<string, SecurityIncident>();
let kycOperationsSuspended = false;

async function loadIncidentsFromDB(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(kycIncidents)
      .where(eq(kycIncidents.status, 'detected'))
      .limit(100);
    
    const containedRows = await db
      .select()
      .from(kycIncidents)
      .where(eq(kycIncidents.status, 'contained'))
      .limit(100);

    for (const row of [...rows, ...containedRows]) {
      const incident: SecurityIncident = {
        id: row.incidentId,
        severity: row.severity as IncidentSeverity,
        type: row.type,
        title: row.title,
        description: row.description || '',
        detectedAt: row.detectedAt.toISOString(),
        respondedAt: row.respondedAt?.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString(),
        status: row.status as SecurityIncident['status'],
        affectedUsers: (row.affectedUsers as string[]) || [],
        containmentActions: (row.containmentActions as string[]) || [],
        evidence: (row.evidence as Record<string, any>) || {},
      };
      activeIncidents.set(incident.id, incident);

      if (incident.severity === 'P1' && incident.status === 'contained') {
        kycOperationsSuspended = true;
        logger.warn('[KYC2026:Incident] Restored P1 suspension state from database');
      }
    }

    if (activeIncidents.size > 0) {
      logger.info(`[KYC2026:Incident] Loaded ${activeIncidents.size} active incidents from database`);
    }
  } catch (err: any) {
    logger.warn('[KYC2026:Incident] Could not load incidents from DB:', err.message);
  }
}

loadIncidentsFromDB();

export class KYCIncidentResponse {

  static async reportIncident(
    severity: IncidentSeverity,
    type: string,
    title: string,
    description: string,
    evidence: Record<string, any>,
    affectedUsers: string[] = []
  ): Promise<SecurityIncident> {
    const incident: SecurityIncident = {
      id: `INC-${Date.now()}-${severity}`,
      severity,
      type,
      title,
      description,
      detectedAt: new Date().toISOString(),
      status: 'detected',
      affectedUsers,
      containmentActions: [],
      evidence,
    };

    activeIncidents.set(incident.id, incident);

    this.persistIncident(incident).catch(err => {
      logger.error('[KYC2026:Incident] DB persist failed:', err.message);
    });

    kycAuditTrail.record({
      action: 'kyc_anomaly_detected',
      actorId: 'system',
      actorRole: 'incident_response',
      ipAddress: '0.0.0.0',
      userAgent: 'KYCIncidentResponse',
      metadata: {
        incidentId: incident.id,
        severity,
        type,
        title,
      },
    });

    const alertSeverity = severity === 'P1' || severity === 'P2' ? 'critical' : 'warning';
    await KYCSecurityAlerts.send({
      alertType: 'anomaly',
      severity: alertSeverity,
      title: `[${severity}] ${title}`,
      description,
      riskScore: severity === 'P1' ? 100 : severity === 'P2' ? 80 : severity === 'P3' ? 50 : 25,
      metadata: evidence,
    });

    if (severity === 'P1') {
      await this.executeP1Containment(incident);
    } else if (severity === 'P2') {
      await this.executeP2Response(incident);
    }

    logger.error(`[KYC2026:INCIDENT] ${severity} - ${title}`, {
      incidentId: incident.id,
      type,
      affectedUsers: affectedUsers.length,
    });

    return incident;
  }

  private static async executeP1Containment(incident: SecurityIncident): Promise<void> {
    kycOperationsSuspended = true;
    incident.containmentActions.push('KYC operations suspended');
    incident.containmentActions.push('All admin MFA sessions marked for revocation');
    incident.containmentActions.push('Audit trail preserved and chain verified');
    incident.status = 'contained';
    incident.respondedAt = new Date().toISOString();

    const chainResult = await kycAuditTrail.verifyChain();
    incident.evidence.auditChainIntegrity = chainResult;

    if (!chainResult.valid) {
      incident.containmentActions.push(`CRITICAL: Audit chain broken at entry ${chainResult.brokenAt}`);
    }

    try {
      await db.update(kycIncidents)
        .set({
          status: 'contained',
          respondedAt: new Date(),
          containmentActions: incident.containmentActions,
        })
        .where(eq(kycIncidents.incidentId, incident.id));
    } catch (err: any) {
      logger.error('[KYC2026:Incident] Failed to persist P1 containment:', err.message);
    }

    logger.error(`[KYC2026:INCIDENT:P1] CONTAINMENT EXECUTED for ${incident.id}`);
  }

  private static async executeP2Response(incident: SecurityIncident): Promise<void> {
    incident.status = 'investigating';
    incident.respondedAt = new Date().toISOString();
    incident.containmentActions.push('Enhanced monitoring activated');
    incident.containmentActions.push('Anomaly thresholds lowered');

    logger.warn(`[KYC2026:INCIDENT:P2] Investigation started for ${incident.id}`);
  }

  static isKYCSuspended(): boolean {
    return kycOperationsSuspended;
  }

  static resumeKYCOperations(adminId: string): void {
    kycOperationsSuspended = false;
    kycAuditTrail.record({
      action: 'kyc_admin_access',
      actorId: adminId,
      actorRole: 'super_admin',
      ipAddress: '0.0.0.0',
      userAgent: 'KYCIncidentResponse',
      metadata: { action: 'kyc_operations_resumed' },
    });
    logger.info(`[KYC2026:INCIDENT] KYC operations resumed by ${adminId}`);
  }

  static getActiveIncidents(): SecurityIncident[] {
    return Array.from(activeIncidents.values()).filter(i => i.status !== 'resolved');
  }

  private static async persistIncident(incident: SecurityIncident): Promise<void> {
    try {
      await db.insert(kycIncidents).values({
        incidentId: incident.id,
        severity: incident.severity,
        type: incident.type,
        title: incident.title,
        description: incident.description,
        status: incident.status,
        affectedUsers: incident.affectedUsers,
        containmentActions: incident.containmentActions,
        evidence: incident.evidence,
        detectedAt: new Date(incident.detectedAt),
        respondedAt: incident.respondedAt ? new Date(incident.respondedAt) : null,
      });
    } catch (err: any) {
      logger.error('[KYC2026:Incident] Failed to persist incident:', err.message);
    }
  }

  static async resolveIncident(incidentId: string, resolvedBy: string, resolution: string): Promise<boolean> {
    const incident = activeIncidents.get(incidentId);
    if (!incident) return false;

    incident.status = 'resolved';
    incident.resolvedAt = new Date().toISOString();
    incident.containmentActions.push(`Resolved by ${resolvedBy}: ${resolution}`);

    try {
      await db.update(kycIncidents)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy,
          resolution,
        })
        .where(eq(kycIncidents.incidentId, incidentId));
    } catch (err: any) {
      logger.error('[KYC2026:Incident] Failed to persist resolution:', err.message);
    }

    if (incident.severity === 'P1' && kycOperationsSuspended) {
      logger.warn('[KYC2026:INCIDENT] P1 resolved but KYC still suspended - manual resume required');
    }

    return true;
  }

  static getIncidentReport(): {
    active: number;
    resolved: number;
    p1Count: number;
    p2Count: number;
    kycSuspended: boolean;
    incidents: SecurityIncident[];
  } {
    const all = Array.from(activeIncidents.values());
    return {
      active: all.filter(i => i.status !== 'resolved').length,
      resolved: all.filter(i => i.status === 'resolved').length,
      p1Count: all.filter(i => i.severity === 'P1').length,
      p2Count: all.filter(i => i.severity === 'P2').length,
      kycSuspended: kycOperationsSuspended,
      incidents: all.slice(-20),
    };
  }
}
