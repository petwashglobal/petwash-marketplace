/**
 * Backfill: populate phone_hash / to_phone_hash on historical rows.
 * AUDIT-SMS-14 (#225) slice 3.
 *
 * Migrations 0140 + 0141 added HMAC lookup columns for phones on
 *   users.phone_hash              (from users.phone)
 *   otp_events.phone_hash         (from otp_events.phone_e164)
 *   sms_evidence.to_phone_hash    (from sms_evidence.to_phone)
 *
 * Application writes from #225 slice 1 + 2 stamp the hash on every
 * new insert. This script fills in every ROW WRITTEN BEFORE THAT
 * LANDED. It is safe to run against production and safe to re-run:
 * only rows where the raw phone is non-null AND the hash column is
 * still null are touched.
 *
 * Run:
 *   npx tsx scripts/backfill-phone-hash.ts             (dry-run, no writes)
 *   npx tsx scripts/backfill-phone-hash.ts --commit    (actually update)
 *   npx tsx scripts/backfill-phone-hash.ts --commit --table users
 *   npx tsx scripts/backfill-phone-hash.ts --commit --batch 1000
 *
 * The batch size defaults to 500 to keep each UPDATE small and give
 * Postgres a chance to autovacuum in between.
 *
 * PHONE_HMAC_SECRET (or DOCUMENT_ENCRYPTION_KEY as the anchor
 * fallback) MUST be present in the environment — the script refuses
 * to run without it so a partial backfill under a rotating secret
 * cannot happen.
 */
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../server/db';
import { users, otpEvents, smsEvidence } from '../shared/schema';
import { phoneLookupHash } from '../server/lib/phoneHmac';

const COMMIT = process.argv.includes('--commit');
const argTable = ((): 'all' | 'users' | 'otp_events' | 'sms_evidence' => {
  const i = process.argv.indexOf('--table');
  const v = i >= 0 ? process.argv[i + 1] : 'all';
  if (v === 'users' || v === 'otp_events' || v === 'sms_evidence') return v;
  return 'all';
})();
const BATCH: number = (() => {
  const i = process.argv.indexOf('--batch');
  const v = i >= 0 ? parseInt(process.argv[i + 1], 10) : 500;
  return Number.isFinite(v) && v > 0 && v <= 5000 ? v : 500;
})();

function assertSecret() {
  if (process.env.PHONE_HMAC_SECRET || process.env.DOCUMENT_ENCRYPTION_KEY) return;
  console.error(
    '[backfill-phone-hash] refusing to run: PHONE_HMAC_SECRET (or DOCUMENT_ENCRYPTION_KEY) is not set. ' +
      'A partial backfill under a rotating secret would leave orphan hashes.',
  );
  process.exit(1);
}

interface TableStats { table: string; scanned: number; migrated: number; failed: number }

async function backfillUsers(): Promise<TableStats> {
  const stats: TableStats = { table: 'users', scanned: 0, migrated: 0, failed: 0 };
  let cursor: string | null = null;
  while (true) {
    const where = cursor
      ? and(isNotNull(users.phone), isNull(users.phoneHash), sql`${users.id} > ${cursor}`)
      : and(isNotNull(users.phone), isNull(users.phoneHash));
    const rows = await db
      .select({ id: users.id, phone: users.phone })
      .from(users)
      .where(where)
      .orderBy(users.id)
      .limit(BATCH);
    if (rows.length === 0) break;
    stats.scanned += rows.length;
    for (const r of rows) {
      const hash = phoneLookupHash(r.phone);
      if (!hash) { stats.failed++; continue; }
      if (COMMIT) {
        await db.update(users).set({ phoneHash: hash }).where(eq(users.id, r.id));
      }
      stats.migrated++;
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  return stats;
}

async function backfillOtpEvents(): Promise<TableStats> {
  const stats: TableStats = { table: 'otp_events', scanned: 0, migrated: 0, failed: 0 };
  let cursor = 0;
  while (true) {
    const where = cursor
      ? and(isNotNull(otpEvents.phoneE164), isNull(otpEvents.phoneHash), sql`${otpEvents.id} > ${cursor}`)
      : and(isNotNull(otpEvents.phoneE164), isNull(otpEvents.phoneHash));
    const rows = await db
      .select({ id: otpEvents.id, phone: otpEvents.phoneE164 })
      .from(otpEvents)
      .where(where)
      .orderBy(otpEvents.id)
      .limit(BATCH);
    if (rows.length === 0) break;
    stats.scanned += rows.length;
    for (const r of rows) {
      const hash = phoneLookupHash(r.phone);
      if (!hash) { stats.failed++; continue; }
      if (COMMIT) {
        await db.update(otpEvents).set({ phoneHash: hash }).where(eq(otpEvents.id, r.id));
      }
      stats.migrated++;
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  return stats;
}

async function backfillSmsEvidence(): Promise<TableStats> {
  const stats: TableStats = { table: 'sms_evidence', scanned: 0, migrated: 0, failed: 0 };
  let cursor = 0;
  while (true) {
    const where = cursor
      ? and(isNotNull(smsEvidence.toPhone), isNull(smsEvidence.toPhoneHash), sql`${smsEvidence.id} > ${cursor}`)
      : and(isNotNull(smsEvidence.toPhone), isNull(smsEvidence.toPhoneHash));
    const rows = await db
      .select({ id: smsEvidence.id, phone: smsEvidence.toPhone })
      .from(smsEvidence)
      .where(where)
      .orderBy(smsEvidence.id)
      .limit(BATCH);
    if (rows.length === 0) break;
    stats.scanned += rows.length;
    for (const r of rows) {
      const hash = phoneLookupHash(r.phone);
      if (!hash) { stats.failed++; continue; }
      if (COMMIT) {
        await db.update(smsEvidence).set({ toPhoneHash: hash }).where(eq(smsEvidence.id, r.id));
      }
      stats.migrated++;
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  return stats;
}

async function main() {
  assertSecret();
  console.log(
    `[backfill-phone-hash] mode=${COMMIT ? 'COMMIT' : 'dry-run'} table=${argTable} batch=${BATCH}`,
  );
  const runs: TableStats[] = [];
  if (argTable === 'all' || argTable === 'users') runs.push(await backfillUsers());
  if (argTable === 'all' || argTable === 'otp_events') runs.push(await backfillOtpEvents());
  if (argTable === 'all' || argTable === 'sms_evidence') runs.push(await backfillSmsEvidence());
  for (const s of runs) {
    console.log(
      `[backfill-phone-hash] ${s.table}: scanned=${s.scanned} ` +
        `${COMMIT ? 'migrated' : 'would-migrate'}=${s.migrated} failed=${s.failed}`,
    );
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
