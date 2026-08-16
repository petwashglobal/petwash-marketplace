/**
 * Backfill SUMIT customers for existing PetWash members.
 *
 * Phase 2 of the SUMIT full-service adoption plan (CEO 2026-08-16 — see
 * docs/design/2026-08-16-sumit-full-service-adoption.md).
 *
 * SAFETY:
 * - DRY RUN by default. Nothing writes to SUMIT unless --commit is passed.
 * - Requires SUMIT_CUSTOMER_SYNC_ENABLED=true to actually make HTTP calls.
 *   Without the flag, syncForUser returns {status:'flag_off'} and the
 *   script logs what it WOULD sync but takes no action.
 * - Uses SearchMode:"Automatic" on SUMIT side → re-runs cannot duplicate.
 * - Batches with a small delay so we don't burst the SUMIT API.
 *
 * USAGE:
 *   tsx scripts/backfill-sumit-customers.ts                         # DRY RUN
 *   SUMIT_CUSTOMER_SYNC_ENABLED=true tsx scripts/backfill-sumit-customers.ts --commit
 *   tsx scripts/backfill-sumit-customers.ts --limit=50 --commit
 *   tsx scripts/backfill-sumit-customers.ts --limit=1 --uid=abc123 --commit
 */
import { db } from '../server/db';
import { users, sumitCustomers } from '../shared/schema';
import { eq, isNotNull, notInArray, sql } from 'drizzle-orm';
import { logger } from '../server/lib/logger';
import { syncForUser } from '../server/services/SumitCustomerService';
import { maskUid, maskName, maskEmail, maskPhone } from '../server/lib/piiMask';

interface Args {
  commit: boolean;
  limit: number;
  uid?: string;
  delayMs: number;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { commit: false, limit: 500, delayMs: 250, verbose: false };
  for (const a of argv.slice(2)) {
    if (a === '--commit') args.commit = true;
    else if (a === '--verbose') args.verbose = true;      // per-row output (still masked)
    else if (a.startsWith('--limit=')) args.limit = Math.max(1, parseInt(a.split('=')[1] || '500', 10));
    else if (a.startsWith('--uid=')) args.uid = a.split('=')[1];
    else if (a.startsWith('--delay=')) args.delayMs = Math.max(0, parseInt(a.split('=')[1] || '250', 10));
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  console.log('─────────────────────────────────────────────────────────');
  console.log('SUMIT customer backfill');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  mode:       ${args.commit ? 'COMMIT (writes to SUMIT if flag on)' : 'DRY RUN (no writes)'}`);
  console.log(`  flag:       SUMIT_CUSTOMER_SYNC_ENABLED = ${process.env.SUMIT_CUSTOMER_SYNC_ENABLED ?? '(unset — inert)'}`);
  console.log(`  limit:      ${args.limit}`);
  console.log(`  uid:        ${args.uid ?? '(all unsynced members)'}`);
  console.log(`  delayMs:    ${args.delayMs}`);
  console.log('─────────────────────────────────────────────────────────');

  // Load members that (a) have at least one verified contact and (b) don't
  // yet have a sumit_customers mapping row.
  const already = await db.select({ userId: sumitCustomers.userId }).from(sumitCustomers);
  const syncedUids = new Set(already.map((r) => r.userId));

  let query = db.select({
    id: users.id,
    email: users.email,
    phone: users.phone,
    firstName: users.firstName,
    lastName: users.lastName,
    emailVerifiedAt: users.emailVerifiedAt,
    mobileVerifiedAt: users.mobileVerifiedAt,
  })
    .from(users)
    .where(sql`(${users.emailVerifiedAt} IS NOT NULL OR ${users.mobileVerifiedAt} IS NOT NULL)`)
    .limit(args.limit + syncedUids.size); // over-fetch since we filter post-hoc

  const candidates = await query;
  const targets = args.uid
    ? candidates.filter((u) => u.id === args.uid)
    : candidates.filter((u) => !syncedUids.has(u.id)).slice(0, args.limit);

  console.log(`  total_candidates:       ${candidates.length}`);
  console.log(`  already_synced_skipped: ${candidates.length - targets.length - (args.uid ? candidates.filter((u) => u.id !== args.uid).length : 0)}`);
  console.log(`  to_process_this_run:    ${targets.length}`);
  console.log('─────────────────────────────────────────────────────────');

  let ok = 0;
  let existing = 0;
  let notWired = 0;
  let flagOff = 0;
  let errored = 0;

  for (const u of targets) {
    const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'PetWash Member';
    // PII MASKING (CEO 2026-08-16 SUMIT lane): never dump full uid/name/
    // email/phone into routine Cloud Run logs. --verbose still masks — it
    // just shows per-row lines vs. summary-only.
    const safeUid = maskUid(u.id);
    if (!args.commit) {
      if (args.verbose) {
        console.log(
          `  [DRY] uid=${safeUid} name=${maskName(displayName)} email=${maskEmail(u.email)} phone=${maskPhone(u.phone)}`,
        );
      }
      continue;
    }
    try {
      const res = await syncForUser(
        u.id,
        { name: displayName, email: u.email ?? undefined, phone: u.phone ?? undefined },
        'backfill',
      );
      switch (res.status) {
        case 'created':
          if (args.verbose) console.log(`  ✅ created  uid=${safeUid}`);
          ok++;
          break;
        case 'existing':
          if (args.verbose) console.log(`  ↺ existing  uid=${safeUid}`);
          existing++;
          break;
        case 'not_wired':
          if (args.verbose) console.log(`  ⏸ not_wired uid=${safeUid}  (SUMIT_ENABLED off or creds missing)`);
          notWired++;
          break;
        case 'flag_off':
          if (args.verbose) console.log(`  ⏸ flag_off  uid=${safeUid}  (SUMIT_CUSTOMER_SYNC_ENABLED not 'true')`);
          flagOff++;
          break;
        case 'error':
          // Always print errors (masked) — they're the actionable rows.
          console.log(`  ❌ error     uid=${safeUid}  reason=${res.reason}`);
          errored++;
          break;
      }
    } catch (err: any) {
      console.log(`  ❌ threw     uid=${safeUid}  err=${err?.message}`);
      errored++;
    }
    if (args.delayMs > 0) await new Promise((r) => setTimeout(r, args.delayMs));
  }

  console.log('─────────────────────────────────────────────────────────');
  console.log('SUMMARY');
  if (!args.commit) {
    console.log(`  DRY RUN — nothing written. ${targets.length} members would be synced.`);
    console.log(`  To commit: rerun with --commit (and set SUMIT_CUSTOMER_SYNC_ENABLED=true).`);
  } else {
    console.log(`  created:   ${ok}`);
    console.log(`  existing:  ${existing}`);
    console.log(`  not_wired: ${notWired}`);
    console.log(`  flag_off:  ${flagOff}`);
    console.log(`  errored:   ${errored}`);
  }
  console.log('─────────────────────────────────────────────────────────');

  process.exit(0);
}

main().catch((err) => {
  logger.error('[backfill-sumit-customers] fatal', { error: err?.message });
  console.error(err);
  process.exit(1);
});
