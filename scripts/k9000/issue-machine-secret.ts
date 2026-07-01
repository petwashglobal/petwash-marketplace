/**
 * Issue (or rotate) a per-machine HMAC secret for a K9000 kiosk.
 *
 * Closes the 2026-07-01 secrets audit finding: every kiosk previously shared
 * ONE global MACHINE_SECRET_KEY. This generates a fresh random secret for a
 * SPECIFIC kiosk, encrypts it (AES-256-GCM, DOCUMENT_ENCRYPTION_KEY) and
 * stores it in kiosk_machines.hmac_secret_encrypted. The plaintext secret is
 * printed to stdout EXACTLY ONCE — it is not recoverable afterward (only the
 * encrypted form is stored) — so copy it immediately into the kiosk's
 * firmware/config and nowhere else.
 *
 * A kiosk with no secret issued (hmac_secret_encrypted IS NULL) keeps working
 * exactly as before, falling back to the shared MACHINE_SECRET_KEY — this
 * script is opt-in per kiosk, never required, never breaks existing kiosks.
 *
 * Run:  npx tsx scripts/k9000/issue-machine-secret.ts <kioskId>
 *       npx tsx scripts/k9000/issue-machine-secret.ts K9000-KFARSABA-001 --rotate
 *
 * --rotate is required to overwrite an existing secret (safety: prevents an
 * accidental re-run from silently invalidating a kiosk that's already live).
 */
import { db } from '../../server/db';
import { kioskMachines } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { generateMachineSecret, encryptMachineSecret } from '../../server/lib/k9000MachineSecrets';

async function main() {
  const kioskId = process.argv[2];
  const rotate = process.argv.includes('--rotate');

  if (!kioskId) {
    console.error('Usage: npx tsx scripts/k9000/issue-machine-secret.ts <kioskId> [--rotate]');
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: kioskMachines.id, hmacSecretEncrypted: kioskMachines.hmacSecretEncrypted })
    .from(kioskMachines)
    .where(eq(kioskMachines.kioskId, kioskId))
    .limit(1);

  if (!existing) {
    console.error(`No kiosk registered with kioskId "${kioskId}" in kiosk_machines. Register it first.`);
    process.exit(1);
  }

  if (existing.hmacSecretEncrypted && !rotate) {
    console.error(`Kiosk "${kioskId}" already has a per-machine secret. Pass --rotate to replace it.`);
    process.exit(1);
  }

  const plainSecret = generateMachineSecret();
  const encrypted = encryptMachineSecret(plainSecret);

  await db
    .update(kioskMachines)
    .set({ hmacSecretEncrypted: encrypted, hmacSecretRotatedAt: new Date(), updatedAt: new Date() })
    .where(eq(kioskMachines.kioskId, kioskId));

  console.log(`✅ Secret ${rotate ? 'rotated' : 'issued'} for kiosk "${kioskId}".`);
  console.log('');
  console.log('COPY THIS SECRET NOW — it will not be shown again (only the encrypted form is stored):');
  console.log('');
  console.log(`  ${plainSecret}`);
  console.log('');
  console.log('Program it into the kiosk firmware/config as its HMAC signing key.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to issue machine secret:', err);
  process.exit(1);
});
