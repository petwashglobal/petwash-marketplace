/**
 * Home-access enforcement service.
 *
 *  - assertHomeServiceBookable(): a home booking is blocked until all legal
 *    prerequisites are signed (pure gate in shared/home-service-gate.ts).
 *  - recordPropertyAuthorityDeclaration(): stores the signed authority
 *    declaration as evidence (who/when/version/IP/UA).
 *  - releaseAccessDetails(): the ONLY way a provider gets the home address +
 *    access codes — released ONLY after the booking is confirmed, decrypted
 *    on demand, and EVERY view written to home_access_logs.
 */
import { nanoid } from 'nanoid';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { customerProperties, propertyAuthorityDeclarations, homeAccessLogs } from '@shared/schema-home-access';
import { decryptAccess } from '../lib/homeAccessCrypto';
import { resolveHomeBookingGate, type HomeBookingPrereqs, type HomeBookingGateResult } from '@shared/home-service-gate';
import { logger } from '../lib/logger';

export { isHomeService, resolveHomeBookingGate } from '@shared/home-service-gate';

/** Thin wrapper so routes have one call site for the booking gate. */
export function assertHomeServiceBookable(prereqs: HomeBookingPrereqs): HomeBookingGateResult {
  return resolveHomeBookingGate(prereqs);
}

export async function recordPropertyAuthorityDeclaration(params: {
  customerId: string;
  propertyId: string;
  bookingId?: string;
  consentRecordId?: string;
  typedFullName: string;
  documentVersion: string;
  ip?: string;
  userAgent?: string;
}): Promise<string> {
  const declarationId = `pad_${nanoid(16)}`;
  await db.insert(propertyAuthorityDeclarations).values({
    declarationId,
    customerId: params.customerId,
    propertyId: params.propertyId,
    bookingId: params.bookingId ?? null,
    consentRecordId: params.consentRecordId ?? null,
    typedFullName: params.typedFullName,
    documentVersion: params.documentVersion,
    ipAddress: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
  await db.update(customerProperties)
    .set({ authorityDeclarationSigned: true, updatedAt: new Date() })
    .where(eq(customerProperties.propertyId, params.propertyId));
  return declarationId;
}

export interface AccessReleaseResult {
  ok: boolean;
  reason?: string;
  address?: string;
  accessInstructions?: string;
}

/**
 * Release the home address + access instructions to a provider. Refuses unless
 * the booking is confirmed; logs every view to home_access_logs (who/when/why).
 */
export async function releaseAccessDetails(params: {
  bookingId: string;
  propertyId: string;
  providerId: string;
  viewerUserId: string;
  bookingConfirmed: boolean;
  reason?: string;
  ip?: string;
  userAgent?: string;
}): Promise<AccessReleaseResult> {
  if (!params.bookingConfirmed) {
    return { ok: false, reason: 'BOOKING_NOT_CONFIRMED' }; // never release access details early
  }
  const [prop] = await db.select().from(customerProperties)
    .where(eq(customerProperties.propertyId, params.propertyId)).limit(1);
  if (!prop) return { ok: false, reason: 'PROPERTY_NOT_FOUND' };

  // Audit the view BEFORE returning the secret.
  await db.insert(homeAccessLogs).values({
    accessLogId: `hal_${nanoid(16)}`,
    bookingId: params.bookingId,
    propertyId: params.propertyId,
    providerId: params.providerId,
    viewedByUserId: params.viewerUserId,
    reason: params.reason ?? 'service_access',
    ipAddress: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });

  try {
    return {
      ok: true,
      address: prop.addressEncrypted ? decryptAccess(prop.addressEncrypted) : undefined,
      accessInstructions: prop.accessInstructionsEncrypted ? decryptAccess(prop.accessInstructionsEncrypted) : undefined,
    };
  } catch (err: any) {
    logger.error('[homeAccess] decrypt failed', { propertyId: params.propertyId, error: err?.message });
    return { ok: false, reason: 'ACCESS_DECRYPT_FAILED' };
  }
}
