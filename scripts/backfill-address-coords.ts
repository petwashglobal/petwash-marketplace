/**
 * Backfill missing lat/lng on saved addresses using FREE OpenStreetMap Nominatim.
 * 2026-06-18: prerequisite for A2 (require location/proximity before booking). Existing
 * addresses were saved without coordinates; this fills them so the fail-closed proximity
 * check won't block current users.
 *
 * SAFE: read-only except for writing lat/lng back onto rows that lacked them. Never
 * deletes or changes anything else. Throttled to ~1 req/sec per Nominatim policy.
 *
 * Run:  npx tsx scripts/backfill-address-coords.ts          (dry-run: prints, no writes)
 *       npx tsx scripts/backfill-address-coords.ts --commit (writes lat/lng)
 */
import { db } from '../server/db';
import { userAddresses } from '../shared/schema';
import { isNull, or, eq } from 'drizzle-orm';

const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'PetWash/1.0 (support@petwash.co.il)';
const COMMIT = process.argv.includes('--commit');

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '1', countrycodes: 'il' });
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const lat = parseFloat(rows[0].lat), lng = parseFloat(rows[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  console.log(`[backfill] mode=${COMMIT ? 'COMMIT (will write)' : 'DRY-RUN (no writes)'}`);
  const rows = await db
    .select()
    .from(userAddresses)
    .where(or(isNull(userAddresses.lat), isNull(userAddresses.lng)));

  console.log(`[backfill] ${rows.length} addresses missing coordinates`);
  let ok = 0, miss = 0;

  for (const row of rows) {
    const composed = [row.street, row.city, row.postalCode, 'Israel'].filter(Boolean).join(', ') || row.address;
    const point = await geocode(composed);
    if (point) {
      ok++;
      console.log(`  ✓ #${row.id} → ${point.lat},${point.lng}  (${composed})`);
      if (COMMIT) {
        await db.update(userAddresses)
          .set({ lat: point.lat.toString(), lng: point.lng.toString() })
          .where(eq(userAddresses.id, row.id));
      }
    } else {
      miss++;
      console.log(`  ✗ #${row.id} no match  (${composed})`);
    }
    await sleep(1100); // Nominatim: ~1 req/sec
  }

  console.log(`[backfill] done — geocoded ${ok}, no-match ${miss}${COMMIT ? '' : ' (DRY-RUN — re-run with --commit to write)'}`);
  process.exit(0);
}

main().catch((e) => { console.error('[backfill] fatal', e); process.exit(1); });
