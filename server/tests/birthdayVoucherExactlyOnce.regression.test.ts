/**
 * Birthday voucher — exactly once per (uid, birthdayYear).
 * CEO closure sprint (Agent 7), MONEY-CRITICAL sweep.
 *
 * The daily birthday job guarded issuance with
 *   hasBirthdayVoucherThisYear(uid, year)  // query
 *   createBirthdayVoucher(...)             // write
 * — a check-then-act race. Every voucher doc is keyed by a RANDOM code
 * (BDAY-<pet>-<year>-<nanoid>), so two concurrent issuers both saw an empty
 * query and both wrote, landing on DIFFERENT doc ids. Result: two 10%-off
 * vouchers for one birthday. Reachable in practice — the cron is not
 * single-flighted (Cloud Run may hold more than one instance, and Cloud
 * Scheduler retries on a slow response).
 *
 * The duplicate check and the write now share one Firestore transaction, and
 * the guard lives in createBirthdayVoucher so every caller inherits it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'birthdayVoucher.ts'),
  'utf8',
);
const JOB = fs.readFileSync(
  path.resolve(__dirname, '..', 'backgroundJobs.ts'),
  'utf8',
);

describe('createBirthdayVoucher issues at most one voucher per user per year', () => {
  const CREATE = SRC.slice(
    SRC.indexOf('export async function createBirthdayVoucher'),
    SRC.indexOf('export async function hasBirthdayVoucherThisYear'),
  );

  it('the duplicate check and the write share ONE transaction', () => {
    expect(CREATE).toMatch(/db\.runTransaction\(async \(tx\) =>/);
    // The read must go THROUGH the transaction — a plain db query outside tx
    // is not in the read set and gives no contention control.
    expect(CREATE).toMatch(/await tx\.get\(dupQuery\)/);
    // ...and the write must be the transaction's, not a bare .set().
    expect(CREATE).toMatch(/tx\.set\(/);
  });

  it('the write is no longer a bare non-transactional .doc(code).set()', () => {
    expect(CREATE).not.toMatch(/await db\s*\n?\s*\.collection\('birthday_vouchers'\)\s*\n?\s*\.doc\(voucherCode\)\s*\n?\s*\.set\(/);
  });

  it('the duplicate query is scoped to BOTH uid and birthdayYear', () => {
    expect(CREATE).toMatch(/\.where\('uid', '==', uid\)/);
    expect(CREATE).toMatch(/\.where\('birthdayYear', '==', birthdayYear\)/);
  });

  it('a lost race raises the typed error, and the generic catch re-throws it untouched', () => {
    expect(SRC).toMatch(/export class BirthdayVoucherAlreadyIssuedError extends Error/);
    expect(CREATE).toMatch(/throw new BirthdayVoucherAlreadyIssuedError\(/);
    // Must not be swallowed / relabelled as a generic failure.
    expect(SRC).toMatch(/if \(error instanceof BirthdayVoucherAlreadyIssuedError\) throw error;/);
  });
});

describe('the birthday job treats a lost race as a skip, not a failure', () => {
  it('imports the typed error and continues on it', () => {
    expect(JOB).toMatch(/BirthdayVoucherAlreadyIssuedError.*from '\.\/birthdayVoucher'/);
    expect(JOB).toMatch(/if \(createError instanceof BirthdayVoucherAlreadyIssuedError\)/);
  });

  it('any OTHER creation error still propagates — a real fault is not hidden', () => {
    const region = JOB.slice(
      JOB.indexOf('BirthdayVoucherAlreadyIssuedError) {'),
      JOB.indexOf('BirthdayVoucherAlreadyIssuedError) {') + 400,
    );
    expect(region).toMatch(/throw createError;/);
  });

  it('no email is sent on the skipped path (continue precedes the send)', () => {
    const idx = JOB.indexOf('Race lost — voucher already issued');
    expect(idx).toBeGreaterThan(-1);
    const after = JOB.slice(idx, idx + 200);
    expect(after).toMatch(/continue;/);
  });
});
