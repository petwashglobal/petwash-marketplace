/**
 * Backfill: encrypt existing PLAINTEXT users.id_number and clear it.
 * X-ray P1-6 (2026-07-25). The self-service profile endpoint used to write
 * users.id_number in plaintext. Migration 0103 added id_number_enc + id_number_hash
 * and the code now writes only those. This one-off migrates any pre-existing
 * plaintext rows: encrypt → id_number_enc, blind-index → id_number_hash, then NULL
 * the plaintext id_number so no cleartext Teudat Zehut remains at rest.
 *
 * SAFE: only touches rows that still have a plaintext id_number AND no id_number_enc
 * yet; never overwrites an existing ciphertext; never logs the plaintext ID.
 *
 * Run:  npx tsx scripts/backfill-user-idnumber-encryption.ts          (dry-run)
 *       npx tsx scripts/backfill-user-idnumber-encryption.ts --commit (encrypt + clear)
 */
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { encryptField, blindIndex } from '../server/services/secretFieldCrypto';

const COMMIT = process.argv.includes('--commit');

async function main() {
  const rows = await db
    .select({ id: users.id, idNumber: users.idNumber })
    .from(users)
    .where(and(isNotNull(users.idNumber), isNull(users.idNumberEnc)));

  console.log(`[backfill-user-idnumber] ${rows.length} plaintext rows to migrate (${COMMIT ? 'COMMIT' : 'dry-run'})`);
  let done = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const plain = String(r.idNumber || '').trim();
      if (!plain) continue;
      const enc = encryptField(plain);
      const hash = blindIndex(plain);
      if (!hash) { failed++; continue; }
      if (COMMIT) {
        // Encrypt + index, then clear the plaintext column in the same update.
        await db.update(users)
          .set({ idNumberEnc: enc, idNumberHash: hash, idNumber: null })
          .where(eq(users.id, r.id));
      }
      done++;
    } catch (e: any) {
      failed++;
      console.warn(`[backfill-user-idnumber] row ${r.id} failed: ${e?.message}`);
    }
  }
  console.log(`[backfill-user-idnumber] ${COMMIT ? 'migrated' : 'would migrate'} ${done}, failed ${failed}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
