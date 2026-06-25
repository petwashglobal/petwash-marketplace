/**
 * Backfill the blind-index id_hash on existing member_discount_applications rows.
 * 2026-06-25: prerequisite for DUPLICATE_ID fraud detection (Smart Admin Panel §8).
 * Rows written before migration 0078 have id_number_enc but no id_hash; this decrypts
 * each, computes the deterministic blind index, and writes it back.
 *
 * SAFE: only sets id_hash on rows that lack it; never changes the encrypted value,
 * never deletes, never logs the plaintext ID.
 *
 * Run:  npx tsx scripts/backfill-discount-id-hash.ts          (dry-run)
 *       npx tsx scripts/backfill-discount-id-hash.ts --commit (writes id_hash)
 */
import { db } from '../server/db';
import { memberDiscountApplications } from '../shared/schema';
import { eq, isNull, and, isNotNull } from 'drizzle-orm';
import { decryptField, blindIndex } from '../server/services/secretFieldCrypto';

const COMMIT = process.argv.includes('--commit');

async function main() {
  const rows = await db
    .select({ id: memberDiscountApplications.id, idNumberEnc: memberDiscountApplications.idNumberEnc })
    .from(memberDiscountApplications)
    .where(and(isNull(memberDiscountApplications.idHash), isNotNull(memberDiscountApplications.idNumberEnc)));

  console.log(`[backfill-id-hash] ${rows.length} rows need id_hash (${COMMIT ? 'COMMIT' : 'dry-run'})`);
  let done = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const plain = decryptField(r.idNumberEnc as string);
      const hash = blindIndex(plain);
      if (!hash) { failed++; continue; }
      if (COMMIT) {
        await db.update(memberDiscountApplications).set({ idHash: hash }).where(eq(memberDiscountApplications.id, r.id));
      }
      done++;
    } catch (e: any) {
      failed++;
      console.warn(`[backfill-id-hash] row ${r.id} failed: ${e?.message}`);
    }
  }
  console.log(`[backfill-id-hash] ${COMMIT ? 'updated' : 'would update'} ${done}, failed ${failed}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
