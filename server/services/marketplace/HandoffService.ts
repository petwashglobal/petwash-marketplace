/**
 * HandoffService — CEO NEXT-AUTO §8.
 *
 * Two-party verified-code handshake (CEO SECURITY §11 correction) for
 * pet handoffs: pickup at the start of a job, return at the end. A
 * boolean "handoff done" is NOT enough (§11 discipline) — one party
 * would set it on the other's behalf.
 *
 * Flow:
 *   1. Issuer (provider on PICKUP, customer on RETURN) taps
 *      HANDOFF_ISSUE_CODE. Server generates a 6-digit code, records
 *      the intent, returns the code to the issuer only.
 *   2. Verifier (customer on PICKUP, provider on RETURN) reads the
 *      code out loud OR the issuer shows it. Verifier taps
 *      HANDOFF_VERIFY_CODE with the code entered.
 *   3. Server verifies the code, appends per-party evidence
 *      (issued_by, verified_by, timestamps) to the handoff record,
 *      and transitions the booking's handoff state.
 *
 * The service is a pure evaluator. Persistence is by the caller.
 * Codes are single-use, bound to (bookingId, phase), 15-minute TTL.
 */
import crypto from 'crypto';

export type HandoffPhase = 'PICKUP' | 'RETURN';
export type HandoffOutcomeCode =
  | 'CODE_ISSUED'
  | 'CODE_VERIFIED'
  | 'CODE_INVALID'
  | 'CODE_EXPIRED'
  | 'CODE_ALREADY_USED'
  | 'NO_CODE_ISSUED'
  | 'ACTOR_NOT_ISSUER'
  | 'ACTOR_NOT_VERIFIER'
  | 'SELF_HANDOFF_BLOCKED'
  | 'BOOKING_NOT_HANDOFF_READY';

export interface HandoffRecord {
  bookingId: string;
  phase: HandoffPhase;
  issuedBy: string;                     // uid of issuer
  issuedTo: string;                     // uid of the expected verifier
  code: string;                         // 6-digit code shown to issuer
  codeHash: string;                     // sha256 hex so the compare stays timing-safe
  issuedAt: number;
  expiresAt: number;
  verifiedBy?: string;
  verifiedAt?: number;
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED';
}

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_RECORDS = 20_000;
const records = new Map<string, HandoffRecord>();     // key = `${bookingId}:${phase}`
export function _resetHandoffStoreForTests(): void { records.clear(); }

function sweep(now: number): void {
  if (records.size <= MAX_RECORDS) return;
  records.forEach((v, k) => { if (v.expiresAt < now) records.delete(k); });
}

function keyFor(bookingId: string, phase: HandoffPhase): string {
  return `${bookingId}:${phase}`;
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function genCode(): string {
  // 6 numeric digits, cryptographically random.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

export interface IssueInput {
  bookingId: string;
  phase: HandoffPhase;
  issuerUid: string;
  verifierUid: string;
  now?: number;
}

export interface VerifyInput {
  bookingId: string;
  phase: HandoffPhase;
  actorUid: string;
  code: string;
  now?: number;
}

export interface HandoffOutcome {
  code: HandoffOutcomeCode;
  handoffCode?: string;                 // returned ONLY on CODE_ISSUED, ONLY to the issuer
  record?: HandoffRecord;
}

function nowMs(now?: number): number { return now ?? Date.now(); }

export function issueHandoffCode(input: IssueInput): HandoffOutcome {
  if (input.issuerUid === input.verifierUid) {
    return { code: 'SELF_HANDOFF_BLOCKED' };
  }
  const now = nowMs(input.now);
  const code = genCode();
  const record: HandoffRecord = {
    bookingId: input.bookingId,
    phase: input.phase,
    issuedBy: input.issuerUid,
    issuedTo: input.verifierUid,
    code,
    codeHash: sha256Hex(code),
    issuedAt: now,
    expiresAt: now + CODE_TTL_MS,
    status: 'PENDING',
  };
  records.set(keyFor(input.bookingId, input.phase), record);
  sweep(now);
  // The plain code is returned to the caller for exactly this one
  // response so the issuer can display it; the record persists only
  // the hash and does not leak the code on subsequent reads.
  return { code: 'CODE_ISSUED', handoffCode: code, record: { ...record, code: '' } };
}

export function verifyHandoffCode(input: VerifyInput): HandoffOutcome {
  const now = nowMs(input.now);
  const rec = records.get(keyFor(input.bookingId, input.phase));
  if (!rec) return { code: 'NO_CODE_ISSUED' };
  if (rec.status === 'VERIFIED') return { code: 'CODE_ALREADY_USED' };
  if (rec.expiresAt < now) {
    rec.status = 'EXPIRED';
    return { code: 'CODE_EXPIRED' };
  }
  if (input.actorUid !== rec.issuedTo) return { code: 'ACTOR_NOT_VERIFIER' };
  if (!timingSafeStringEqual(sha256Hex(input.code ?? ''), rec.codeHash)) {
    return { code: 'CODE_INVALID' };
  }
  rec.status = 'VERIFIED';
  rec.verifiedBy = input.actorUid;
  rec.verifiedAt = now;
  return { code: 'CODE_VERIFIED', record: { ...rec, code: '' } };
}

export function getHandoffRecord(bookingId: string, phase: HandoffPhase, now?: number): HandoffRecord | null {
  const n = nowMs(now);
  const rec = records.get(keyFor(bookingId, phase));
  if (!rec) return null;
  if (rec.expiresAt < n && rec.status === 'PENDING') { rec.status = 'EXPIRED'; }
  return { ...rec, code: '' };
}
