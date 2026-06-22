#!/usr/bin/env tsx
/**
 * Grant READ-ONLY ("viewer") admin access to a person — external accountants,
 * observers, etc. A viewer can open every /admin screen but cannot change
 * anything (all writes are blocked server-side by enforceReadOnlyMutations).
 *
 * Nir stays the ONLY super admin (via the SUPER_ADMIN_EMAILS secret). This
 * script never touches super-admin; it only sets the Firebase custom claim
 * role:'viewer' on the target account, preserving any existing claims.
 *
 * Usage:
 *   tsx scripts/grant-viewer-role.ts ido.s@petwash.co.il
 *   tsx scripts/grant-viewer-role.ts accountant@firm.co.il
 *
 * To REVOKE, run with a second arg:
 *   tsx scripts/grant-viewer-role.ts ido.s@petwash.co.il revoke
 *
 * The user must sign OUT and back IN (or wait for token refresh) for the new
 * claim to take effect.
 */
import admin from '../server/lib/firebase-admin';

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const revoke = (process.argv[3] || '').toLowerCase() === 'revoke';

  if (!email) {
    console.error('❌ Usage: tsx scripts/grant-viewer-role.ts <email> [revoke]');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking up Firebase user: ${email}`);
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found: ${userRecord.uid}`);

    const existing = (userRecord.customClaims || {}) as Record<string, any>;

    if (existing.role === 'super_admin') {
      console.error('❌ Refusing to modify a super_admin account. Aborting.');
      process.exit(1);
    }

    let updated: Record<string, any>;
    if (revoke) {
      // Drop the role claim entirely (back to a normal customer account).
      const { role, ...rest } = existing;
      updated = rest;
      console.log(`↩️  Revoking viewer access (removing role claim, was '${existing.role || 'none'}').`);
    } else {
      updated = { ...existing, role: 'viewer' };
      console.log(`🔐 Granting READ-ONLY 'viewer' role (previous role: '${existing.role || 'none'}').`);
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, updated);

    // Read back to confirm.
    const after = await admin.auth().getUser(userRecord.uid);
    console.log(`\n✅ Done. Custom claims now: ${JSON.stringify(after.customClaims || {})}`);
    console.log(`\n⚠️  ${email} must sign OUT and back IN for this to take effect.`);
    console.log(`   Viewer can VIEW all /admin screens but every change returns 403 READ_ONLY_ACCESS.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
