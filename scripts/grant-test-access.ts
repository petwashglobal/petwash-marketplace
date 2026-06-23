#!/usr/bin/env tsx
/**
 * Grant TEST access so an account can experience the app as a PRESTIGE member
 * and/or a PROVIDER — for the founder to self-test the real customer/provider
 * UX, without disturbing super-admin.
 *
 * Why this is safe for the super-admin email:
 *   Admin access is keyed to the SUPER_ADMIN_EMAILS allowlist and is re-applied
 *   on every /api/session/whoami call. Setting a prestige/provider CLAIM here
 *   does NOT remove admin for an allowlisted email — it only adds test state.
 *   For a clean "feel like a normal member" test (so the account button does
 *   NOT force /octopus), use a SIBLING email that is NOT in SUPER_ADMIN_EMAILS.
 *
 * This script SPREADS existing claims (never clobbers them) — unlike the
 * prestige-join / loyalty auto-enroll endpoints, which overwrite role:'public'.
 *
 * Usage:
 *   tsx scripts/grant-test-access.ts <email> [prestige] [provider] [tier=platinum]
 *   tsx scripts/grant-test-access.ts nirhadad@gmail.com prestige provider
 *   tsx scripts/grant-test-access.ts nirhadad@gmail.com prestige tier=black
 *
 * Revoke the test claims (keeps the account, drops prestige/provider test flags):
 *   tsx scripts/grant-test-access.ts <email> revoke
 *
 * The user must sign OUT and back IN (or wait for token refresh) for new claims
 * to take effect.
 *
 * NOTE on PROVIDER: this sets a provider claim so the Provider OS (/provider-os)
 * is reachable for testing. It does NOT create a verified provider_applicants
 * row — to exercise the REAL onboarding (incl. an Australian +61 phone), instead
 * navigate directly to /provider-onboarding and submit an application, then
 * approve it in the admin provider-review screen.
 */
import admin from '../server/lib/firebase-admin';

const VALID_TIERS = ['silver', 'gold', 'platinum', 'black'];

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const rest = process.argv.slice(3).map((a) => a.toLowerCase().trim());

  if (!email) {
    console.error('❌ Usage: tsx scripts/grant-test-access.ts <email> [prestige] [provider] [tier=platinum] | revoke');
    process.exit(1);
  }

  const revoke = rest.includes('revoke');
  const wantPrestige = rest.includes('prestige');
  const wantProvider = rest.includes('provider');
  const tierArg = rest.find((a) => a.startsWith('tier='))?.split('=')[1];
  const tier = tierArg && VALID_TIERS.includes(tierArg) ? tierArg : 'platinum';

  if (!revoke && !wantPrestige && !wantProvider) {
    console.error('❌ Specify at least one of: prestige, provider  (or: revoke)');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking up Firebase user: ${email}`);
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found: ${userRecord.uid}`);

    const existing = (userRecord.customClaims || {}) as Record<string, any>;
    const isSuperAdmin = existing.role === 'super_admin';
    let updated: Record<string, any> = { ...existing };

    if (revoke) {
      // Drop only the test flags; keep everything else (incl. any admin claim).
      delete updated.loyaltyMember;
      delete updated.loyaltyTier;
      delete updated.program;
      delete updated.providerTest;
      console.log('↩️  Revoking test flags (prestige + provider test).');
    } else {
      if (wantPrestige) {
        updated.loyaltyMember = true;       // whoami → prestigeStatus:'active'
        updated.loyaltyTier = tier;
        updated.program = 'prestige';
        console.log(`🏆 Granting PRESTIGE member (tier: ${tier}).`);
      }
      if (wantProvider) {
        // Add a provider test flag + role:'provider' ONLY if not super_admin
        // (we never overwrite a super_admin role claim).
        updated.providerTest = true;
        if (!isSuperAdmin) updated.role = 'provider';
        console.log(`🧰 Granting PROVIDER test access${isSuperAdmin ? ' (kept super_admin role)' : " (role:'provider')"}.`);
        console.log('   For the REAL onboarding + Australian +61 phone, use /provider-onboarding and approve in admin.');
      }
    }

    await admin.auth().setCustomUserClaims(userRecord.uid, updated);

    const after = await admin.auth().getUser(userRecord.uid);
    console.log(`\n✅ Done. Custom claims now: ${JSON.stringify(after.customClaims || {})}`);
    if (isSuperAdmin) {
      console.log('ℹ️  This email is a super_admin (SUPER_ADMIN_EMAILS) — admin access is UNCHANGED.');
      console.log('   The account button will still route you to /admin. To test the pure');
      console.log('   member/provider UX, run this on a SIBLING email not in the allowlist.');
    }
    console.log(`\n⚠️  ${email} must sign OUT and back IN for this to take effect.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
