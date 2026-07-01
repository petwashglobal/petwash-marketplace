/**
 * Incident engine.
 *
 *  - openIncident(): records an incident; CRITICAL types auto-escalate and
 *    FREEZE the related payout (payout_hold) until resolved.
 *  - addEvidence(): append photos/notes.
 *  - resolveIncident(): close it (and lift the payout hold).
 *  - recordEmergencyVetAuthorization(): customer pre-authorises urgent vet contact.
 *  - hasOpenPayoutBlockingIncident(): the check the payout gate calls.
 */
import { nanoid } from 'nanoid';
import { db } from '../db';
import { and, eq, inArray } from 'drizzle-orm';
import { incidentReports, emergencyVetAuthorizations } from '@shared/schema-incidents';
import {
  isValidIncidentType, isCriticalIncident, freezesPayout, effectiveSeverity, type IncidentSeverityX,
} from '@shared/incident-engine';
import { generateCaseId, categoryForIncidentType } from '../lib/caseIdGenerator';
import { logger } from '../lib/logger';

export interface OpenIncidentInput {
  type: string;
  severity: IncidentSeverityX;
  description?: string;
  memberId?: string; petId?: string; providerId?: string; bookingId?: string;
  stationId?: string; washSessionId?: string; paymentId?: string;
  photoUrls?: string[];
  reportedBy?: string;
}

export interface OpenIncidentResult { incidentId: string; severity: IncidentSeverityX; payoutHold: boolean; critical: boolean; }

export async function openIncident(input: OpenIncidentInput): Promise<OpenIncidentResult> {
  const type = isValidIncidentType(input.type) ? input.type : 'other';
  const sev = effectiveSeverity(type, input.severity);     // auto-escalate
  const critical = isCriticalIncident(type, input.severity);
  const payoutHold = freezesPayout(type, input.severity);
  // Human-readable, date-visible, category-visible case ID (2026-07-01) —
  // e.g. CARE-20260701-000044 — replaces the previous opaque inc_<nanoid>.
  const incidentId = await generateCaseId(categoryForIncidentType(type));

  await db.insert(incidentReports).values({
    incidentId, incidentType: type, severity: sev, status: 'open',
    description: input.description ?? null,
    memberId: input.memberId ?? null, petId: input.petId ?? null, providerId: input.providerId ?? null,
    bookingId: input.bookingId ?? null, stationId: input.stationId ?? null,
    washSessionId: input.washSessionId ?? null, paymentId: input.paymentId ?? null,
    photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
    payoutHold, reportedBy: input.reportedBy ?? null,
  });

  if (critical) {
    logger.warn('[Incident] CRITICAL incident opened — payout frozen', { incidentId, type, bookingId: input.bookingId, providerId: input.providerId });
  }
  return { incidentId, severity: sev, payoutHold, critical };
}

export async function addEvidence(incidentId: string, photoUrls: string[], note?: string): Promise<void> {
  const [row] = await db.select().from(incidentReports).where(eq(incidentReports.incidentId, incidentId)).limit(1);
  if (!row) throw new Error('INCIDENT_NOT_FOUND');
  const existing = row.photoUrls ? (JSON.parse(row.photoUrls) as string[]) : [];
  await db.update(incidentReports)
    .set({ photoUrls: JSON.stringify([...existing, ...photoUrls]), notes: note ? `${row.notes ?? ''}\n${note}`.trim() : row.notes, updatedAt: new Date() })
    .where(eq(incidentReports.incidentId, incidentId));
}

export async function resolveIncident(incidentId: string, resolution: string, adminOwner: string): Promise<void> {
  await db.update(incidentReports)
    .set({ status: 'resolved', resolution, adminOwner, payoutHold: false, resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(incidentReports.incidentId, incidentId));
}

export async function recordEmergencyVetAuthorization(params: {
  customerId: string; bookingId?: string; petId?: string; authorized: boolean;
  vetContact?: string; costAcknowledged: boolean; consentRecordId?: string;
  documentVersion: string; ip?: string; userAgent?: string;
}): Promise<string> {
  const authorizationId = `eva_${nanoid(16)}`;
  await db.insert(emergencyVetAuthorizations).values({
    authorizationId, customerId: params.customerId, bookingId: params.bookingId ?? null, petId: params.petId ?? null,
    authorized: params.authorized, vetContact: params.vetContact ?? null,
    costResponsibilityAcknowledged: params.costAcknowledged, consentRecordId: params.consentRecordId ?? null,
    documentVersion: params.documentVersion, ipAddress: params.ip ?? null, userAgent: params.userAgent ?? null,
  });
  return authorizationId;
}

/** Payout gate calls this: is there an unresolved incident holding this booking/provider's payout? */
export async function hasOpenPayoutBlockingIncident(opts: { bookingId?: string; providerId?: string }): Promise<boolean> {
  const conds = [eq(incidentReports.payoutHold, true), inArray(incidentReports.status, ['open', 'investigating'])];
  if (opts.bookingId) conds.push(eq(incidentReports.bookingId, opts.bookingId));
  else if (opts.providerId) conds.push(eq(incidentReports.providerId, opts.providerId));
  else return false;
  const rows = await db.select({ id: incidentReports.id }).from(incidentReports).where(and(...conds)).limit(1);
  return rows.length > 0;
}
