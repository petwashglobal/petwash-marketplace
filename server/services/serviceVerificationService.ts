/**
 * Service-handoff verification.
 *
 *  - issueVerificationCode(): mint a 6-digit code for a booking (stored hashed),
 *    delivered to the customer to show the provider at handoff.
 *  - verifyAndCheckIn(): confirm the RIGHT person (code OR last-4-mobile),
 *    require the conduct acknowledgment, and append a hash-chained check_in event.
 *  - checkOut(): append a hash-chained check_out event.
 *  - isCheckinChainIntact(): tamper check over the booking's ledger.
 */
import { nanoid } from 'nanoid';
import { db } from '../db';
import { and, desc, eq } from 'drizzle-orm';
import { bookingVerifications, serviceCheckinEvents } from '@shared/schema-service-verification';
import {
  generateVerificationCode, newSalt, hashCode, verifyCodeHash, chainHash, verifyChain, type ChainRow,
} from '../lib/serviceVerificationCrypto';
import {
  verifyLast4, canAttempt, isCodeFormatValid, CONDUCT_ACK_VERSION, type VerificationMethod,
} from '@shared/service-verification';

export interface IssuedCode { code: string; expiresAt: Date; }

/** Mint (or replace) the verification code for a booking. Returns plaintext ONCE. */
export async function issueVerificationCode(
  bookingId: string, targetUserId?: string, ttlMinutes = 120,
): Promise<IssuedCode> {
  const code = generateVerificationCode();
  const salt = newSalt();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const row = {
    bookingId, codeHash: hashCode(code, salt), codeSalt: salt, method: 'code',
    targetUserId: targetUserId ?? null, expiresAt, verified: false, verifiedAt: null,
    attempts: 0, updatedAt: new Date(),
  };
  await db.insert(bookingVerifications).values(row)
    .onConflictDoUpdate({ target: bookingVerifications.bookingId, set: row });
  return { code, expiresAt };
}

export interface CheckInResult { ok: boolean; reason?: string; eventId?: string; }

export async function verifyAndCheckIn(params: {
  bookingId: string;
  candidate: string;                 // entered code OR last-4 of mobile
  method: VerificationMethod;
  actorId: string;
  conductAck: boolean;
  jurisdiction?: string;             // IL | GR | ...
  registeredPhone?: string | null;   // required for last4_mobile
  at?: Date;
}): Promise<CheckInResult> {
  if (!params.conductAck) return { ok: false, reason: 'CONDUCT_ACK_REQUIRED' };

  const [v] = await db.select().from(bookingVerifications)
    .where(eq(bookingVerifications.bookingId, params.bookingId)).limit(1);
  if (!v) return { ok: false, reason: 'NO_VERIFICATION_ISSUED' };
  if (v.expiresAt < new Date()) return { ok: false, reason: 'CODE_EXPIRED' };
  if (!canAttempt(v.attempts)) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };

  let pass = false;
  if (params.method === 'last4_mobile') {
    pass = verifyLast4(params.candidate, params.registeredPhone);
  } else if (params.method === 'manual_admin') {
    pass = true; // admin override path (caller must enforce admin permission)
  } else {
    pass = isCodeFormatValid(params.candidate) && verifyCodeHash(params.candidate, v.codeSalt, v.codeHash);
  }

  if (!pass) {
    await db.update(bookingVerifications)
      .set({ attempts: v.attempts + 1, updatedAt: new Date() })
      .where(eq(bookingVerifications.bookingId, params.bookingId));
    return { ok: false, reason: 'VERIFICATION_FAILED' };
  }

  await db.update(bookingVerifications)
    .set({ verified: true, verifiedAt: new Date(), method: params.method, updatedAt: new Date() })
    .where(eq(bookingVerifications.bookingId, params.bookingId));

  const eventId = await appendChainEvent({
    bookingId: params.bookingId, eventType: 'check_in', method: params.method,
    actorId: params.actorId, conductAck: true, jurisdiction: params.jurisdiction, at: params.at ?? new Date(),
  });
  return { ok: true, eventId };
}

export async function checkOut(params: {
  bookingId: string; actorId: string; method?: VerificationMethod; at?: Date;
}): Promise<CheckInResult> {
  const eventId = await appendChainEvent({
    bookingId: params.bookingId, eventType: 'check_out', method: params.method ?? 'manual_admin',
    actorId: params.actorId, conductAck: true, at: params.at ?? new Date(),
  });
  return { ok: true, eventId };
}

async function appendChainEvent(e: {
  bookingId: string; eventType: 'check_in' | 'check_out'; method: string;
  actorId: string; conductAck: boolean; jurisdiction?: string; at: Date;
}): Promise<string> {
  const [last] = await db.select().from(serviceCheckinEvents)
    .where(eq(serviceCheckinEvents.bookingId, e.bookingId))
    .orderBy(desc(serviceCheckinEvents.id)).limit(1);
  const prevHash = last?.hash ?? null;
  const atIso = e.at.toISOString();
  const hash = chainHash(prevHash, {
    bookingId: e.bookingId, eventType: e.eventType, method: e.method,
    actorId: e.actorId, conductAck: e.conductAck, at: atIso,
  });
  const eventId = `chk_${nanoid(16)}`;
  await db.insert(serviceCheckinEvents).values({
    eventId, bookingId: e.bookingId, eventType: e.eventType, method: e.method,
    actorId: e.actorId, conductAck: e.conductAck, conductAckVersion: CONDUCT_ACK_VERSION,
    jurisdiction: e.jurisdiction ?? null, prevHash, hash, at: e.at,
  });
  return eventId;
}

/** Tamper check over the booking's check-in/out ledger. */
export async function isCheckinChainIntact(bookingId: string): Promise<{ ok: boolean; brokenAtIndex?: number }> {
  const rows = await db.select().from(serviceCheckinEvents)
    .where(eq(serviceCheckinEvents.bookingId, bookingId))
    .orderBy(serviceCheckinEvents.id);
  const chain: ChainRow[] = rows.map((r) => ({
    bookingId: r.bookingId, eventType: r.eventType as 'check_in' | 'check_out', method: r.method,
    actorId: r.actorId, conductAck: r.conductAck, at: r.at.toISOString(), prevHash: r.prevHash, hash: r.hash,
  }));
  return verifyChain(chain);
}
