#!/usr/bin/env tsx
/**
 * Grant PROVIDER capability to a member — an ADDITIVE role on top of their
 * Prestige membership (every account is always a member). A provider can access
 * the provider workspace (/provider-os, /provider/*) and act on jobs.
 *
 * Multi-role model (CEO 2026-07-03): one user_id, a SET of capabilities.
 *   - Member  → everyone, always (just being signed in).
 *   - Provider → this grant (Firebase claim role:'provider'), on top of member.
 *   - Super-admin → the SUPER_ADMIN_EMAILS secret (NOT this script). Because the
 *     role hierarchy makes super-admin ⊇ provider ⊇ member, a super-admin can
 *     already use every world without any provider grant.
 *
 * This never touches super_admin and preserves any existing claims.
 *
 * Usage:
 *   tsx scripts/grant-provider-role.ts nirhadad1@gmail.com
 *   tsx scripts/grant-provider-role.ts someone@example.com revoke
 *
 * The user must sign OUT and back IN (or wait for token refresh) to see it.
 */
import admin from '../server/lib/firebase-admin';

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const revoke = (process.argv[3] || '').toLowerCase() === 'revoke';
  if (!email) {
    console.error('❌ Usage: tsx scripts/grant-provider-role.ts <email> [revoke]');
    process.exit(1);
  }
  try {
    console.log(`🔍 Looking up Firebase user: ${email}`);
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found: ${userRecord.uid}`);

    const existing = (userRecord.customClaims || {}) as Record<string, any>;
    if (existing.role === 'super_admin') {
      console.error('❌ Refusing to modify a super_admin account (they already have provider access via the hierarchy). Aborting.');
      process.exit(1);
    }

    let updated: Record<string, any>;
    if (revoke) {
      const { role, accountType, ...rest } = existing;
      updated = rest; // back to a plain member
      console.log(`↩️  Revoking provider capability (was '${existing.role || 'none'}').`);
    } else {
      // accountType='provider' is what server/routes.ts reads to derive role.
      updated = { ...existing, role: 'provider', accountType: 'provider' };
      console.log(`🔐 Granting PROVIDER capability (previous role: '${existing.role || 'none'}'). Membership is unchanged.`);
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, updated);
    const after = await admin.auth().getUser(userRecord.uid);
    console.log(`\n✅ Done. Custom claims now: ${JSON.stringify(after.customClaims || {})}`);
    console.log(`\n⚠️  ${email} must sign OUT and back IN for this to take effect.`);
    console.log(`   They remain a Prestige member AND can now open the Provider workspace.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}
main();
