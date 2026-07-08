/**
 * Backup report honesty — regression pins (2026-07-08).
 *
 * A daily Firestore export emailed a report titled with a green ✅ while its body
 * said "Total Documents: 0" and all 11 collections FAILED. Two code bugs made a
 * total backup failure look like a success:
 *
 *   1. sendBackupSummaryEmail hardcoded the subject to "✅ … Backup Summary" no
 *      matter what happened.
 *   2. performFirestoreExport caught each collection's failure, pushed
 *      { error:true }, then STILL returned success:true and logged
 *      status:'success' — and it discarded the real per-collection error.
 *
 * Fixes pinned here: subject reflects reality (✅ only when it truly succeeded,
 * 🚨 on 0 documents, ❌ on any failed collection); overall success requires no
 * failed collection AND totalDocs > 0; the real per-collection error is captured;
 * and a security alert fires on any failure.
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'gcsBackupService.ts'), 'utf8');

describe('backup report honesty (2026-07-08)', () => {
  it('the email subject is NOT a hardcoded ✅ — it branches on real status', () => {
    expect(SRC).toMatch(/🚨 ⁦Pet Wash™⁩ Backup FAILED — 0 DOCUMENTS/);
    expect(SRC).toMatch(/❌ ⁦Pet Wash™⁩ Backup FAILED \(some collections\)/);
    expect(SRC).toMatch(/✅ ⁦Pet Wash™⁩ Backup SUCCESS/);
  });

  it('overall success requires no failed collection AND at least one document', () => {
    expect(SRC).toMatch(/const ok = failed\.length === 0 && !zeroDocs/);
    expect(SRC).toMatch(/const zeroDocs = totalDocs === 0/);
  });

  it('backup_logs records the REAL status, not a literal success', () => {
    expect(SRC).toMatch(/status: overallStatus/);
    // the old always-success firestore log must be gone
    expect(SRC).not.toMatch(/type: 'firestore',\s*\n\s*status: 'success',/);
  });

  it('the return value is honest (success: ok, not success: true)', () => {
    expect(SRC).toMatch(/return \{\s*\n\s*success: ok,/);
  });

  it('a security alert fires on any failure', () => {
    expect(SRC).toMatch(/if \(!ok\) \{[\s\S]*?sendSecurityAlert\(/);
  });

  it('the real per-collection error is captured (not discarded as bare error:true)', () => {
    expect(SRC).toMatch(/results\.push\(\{ collection: collectionName, error: true, errorMessage \}\)/);
  });

  it('read-back verification: re-downloads and doc-count checks each object', () => {
    expect(SRC).toMatch(/const \[readBack\] = await file\.download\(\)/);
    expect(SRC).toMatch(/if \(verifiedCount !== documents\.length\)/);
  });

  it('a read-back COUNT MISMATCH is fatal, but "cannot re-read" (create-only SA) is NOT', () => {
    // corruption throws READBACK_MISMATCH and is re-thrown (fatal)
    expect(SRC).toMatch(/READBACK_MISMATCH/);
    expect(SRC).toMatch(/if \(\/READBACK_MISMATCH\/\.test\(verifyErr\?\.message \|\| ''\)\) throw verifyErr/);
    // a plain download/permission failure is logged and continues (non-fatal)
    expect(SRC).toMatch(/read-back verify skipped/);
  });

  it('ROOT-CAUSE FIX: backup files use a per-run stamp so writes never overwrite (create-only SA)', () => {
    expect(SRC).toMatch(/const runStamp = Date\.now\(\)/);
    expect(SRC).toMatch(/const fileName = `\$\{collectionName\}_\$\{date\}_\$\{runStamp\}\.json`/);
  });

  it('the report shows the read-back verified count (using the real verified flag)', () => {
    expect(SRC).toMatch(/Read-back Verified/);
    expect(SRC).toMatch(/files\.filter\(f => f\.verified\)\.length/);
  });
});
