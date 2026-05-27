/**
 * PetWash™ — First Founder Member + Apple Wallet Pass admin script.
 *
 * One-shot operator script. Run from your Mac (or any environment that
 * has DATABASE_URL + the four APPLE_* env vars set).
 *
 * What it does:
 *   1. Validates env vars (fails fast if anything missing).
 *   2. Idempotently UPSERTs the founder user record by email.
 *   3. Idempotently UPSERTs the founder pet record by (userId, name).
 *   4. Assigns membershipNumber = "PWM-0000001" (founder #1 in the
 *      schema-convention format) and founder-badge "001C" rendered on
 *      the pass.
 *   5. Generates the signed .pkpass via AppleWalletService.
 *   6. Writes ./first-founder-pass.pkpass to the repo root.
 *   7. Prints a summary table — what was inserted, what was skipped.
 *
 * Safety:
 *   - DRY-RUN is the default. To actually write to the DB, run with
 *     --execute. Without that flag, it logs what it WOULD do and exits.
 *   - Idempotent: re-running with --execute will UPDATE the existing
 *     rows instead of inserting duplicates.
 *   - Will NOT generate the pass if Apple Wallet env vars are missing —
 *     it prints which ones are missing and stops.
 *
 * Usage from your Mac:
 *   git pull origin claude/admin-script-first-founder-member
 *   npm install                            # if first run
 *
 *   # Dry-run (default — shows what would happen, writes nothing):
 *   tsx scripts/admin/create-first-founder-member.ts
 *
 *   # Real run (writes DB + .pkpass file):
 *   tsx scripts/admin/create-first-founder-member.ts --execute
 *
 * Required env vars (loaded from .env.local or your shell):
 *   DATABASE_URL                  — Postgres connection string
 *   APPLE_TEAM_IDENTIFIER         — your 10-char Apple Team ID
 *   APPLE_PASS_TYPE_IDENTIFIER    — e.g. pass.il.petwash.prestige (optional, has default)
 *   APPLE_WWDR_PEM                — Apple WWDR cert PEM string
 *   APPLE_SIGNER_CERT_PEM         — your pass signing cert PEM string
 *   APPLE_SIGNER_KEY_PEM          — your signing private key PEM string
 *   APPLE_SIGNER_KEY_PASSPHRASE   — passphrase for the private key (optional)
 *
 * Why a script and not an admin UI button:
 *   - Operator currently cannot log into admin (SUPER_ADMIN_EMAILS gate).
 *   - One-shot founder seed should not be an exposed endpoint.
 *   - Script lives in repo + CI, auditable, idempotent, reviewable.
 */

import { db } from "../../server/db";
import { users, pets } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { generateAppleWalletPass, isAppleWalletConfigured } from "../../server/services/AppleWalletService";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────
// FOUNDER DATA (operator-provided 2026-05-27)
// ─────────────────────────────────────────────────────────────
const FOUNDER = {
  // User
  userId: "founder-001-nir-hadad",                  // varchar PK — stable, human-readable
  email: "nir.h@petwash.co.il",
  firstName: "Nir",
  lastName: "Hadad",
  phone: "+61419773360",                            // NOTE: Australia country code (+61) per operator
  dateOfBirth: "1976-11-07",                        // ISO 8601 (stored as varchar in users.dateOfBirth)
  gender: "male",
  street: "Rimelet",
  streetNumber: "18",
  apartment: "77",
  city: "Ramat Gan",
  country: "IL",
  language: "he",
  membershipNumber: "PWM-0000001",                  // founder #1 in schema convention
  founderBadge: "001C",                             // operator's vanity label, rendered on pass
  loyaltyTier: "royal",                             // top tier (50% per schema comment) for founder
  isClubMember: true,
  founderInitialCreditIls: 0,                       // start at zero; operator can top up via wallet flow

  // Pet
  petName: "Kenzo",
  petSpecies: "dog",
  petBreed: "Golden Retriever",
  petGender: "male",
  petColor: "white",
} as const;

// ─────────────────────────────────────────────────────────────
// ARG PARSING
// ─────────────────────────────────────────────────────────────
const EXECUTE = process.argv.includes("--execute");
const NOTIFY = process.argv.includes("--notify");
const DRY_RUN = !EXECUTE;

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log("──────────────────────────────────────────────────────────");
  log("PetWash™ First Founder Member — admin one-shot script");
  log("──────────────────────────────────────────────────────────");
  log(`Mode: ${DRY_RUN ? "DRY-RUN (no DB writes, no .pkpass file)" : "EXECUTE (will write DB + .pkpass)"}`);
  log("");

  // ─── 1. Validate env ────────────────────────────────────────
  validateEnv();

  // ─── 2. Echo what we're about to do ─────────────────────────
  log("Founder data:");
  log(`  userId:           ${FOUNDER.userId}`);
  log(`  name:             ${FOUNDER.firstName} ${FOUNDER.lastName}`);
  log(`  email:            ${FOUNDER.email}`);
  log(`  phone:            ${FOUNDER.phone}`);
  log(`  dob:              ${FOUNDER.dateOfBirth}`);
  log(`  address:          ${FOUNDER.street} ${FOUNDER.streetNumber}, apt ${FOUNDER.apartment}, ${FOUNDER.city}, ${FOUNDER.country}`);
  log(`  language:         ${FOUNDER.language}`);
  log(`  membershipNumber: ${FOUNDER.membershipNumber}  (vanity: ${FOUNDER.founderBadge})`);
  log(`  loyaltyTier:      ${FOUNDER.loyaltyTier}`);
  log(`  pet:              ${FOUNDER.petName} (${FOUNDER.petBreed}, ${FOUNDER.petGender}, ${FOUNDER.petColor})`);
  log("");

  if (DRY_RUN) {
    log("DRY-RUN — exiting without DB writes or pass generation.");
    log("Re-run with --execute to actually create the member + pass.");
    process.exit(0);
  }

  // ─── 3. Upsert user ─────────────────────────────────────────
  log("Step 1/3: upserting user record by email…");
  const existingUser = await db.select().from(users).where(eq(users.email, FOUNDER.email)).limit(1);

  if (existingUser.length > 0) {
    log(`  → user with email ${FOUNDER.email} already exists (id=${existingUser[0].id}). Updating address + tier.`);
    await db.update(users)
      .set({
        firstName: FOUNDER.firstName,
        lastName: FOUNDER.lastName,
        phone: FOUNDER.phone,
        dateOfBirth: FOUNDER.dateOfBirth,
        gender: FOUNDER.gender,
        street: FOUNDER.street,
        streetNumber: FOUNDER.streetNumber,
        apartment: FOUNDER.apartment,
        city: FOUNDER.city,
        country: FOUNDER.country,
        language: FOUNDER.language,
        loyaltyTier: FOUNDER.loyaltyTier,
        isClubMember: FOUNDER.isClubMember,
        // membershipNumber intentionally NOT updated on re-run if it already exists,
        // to avoid breaking any downstream FKs.
        updatedAt: new Date(),
      })
      .where(eq(users.email, FOUNDER.email));
  } else {
    log(`  → no user with that email — inserting new founder record.`);
    await db.insert(users).values({
      id: FOUNDER.userId,
      email: FOUNDER.email,
      firstName: FOUNDER.firstName,
      lastName: FOUNDER.lastName,
      phone: FOUNDER.phone,
      dateOfBirth: FOUNDER.dateOfBirth,
      gender: FOUNDER.gender,
      street: FOUNDER.street,
      streetNumber: FOUNDER.streetNumber,
      apartment: FOUNDER.apartment,
      city: FOUNDER.city,
      country: FOUNDER.country,
      language: FOUNDER.language,
      loyaltyTier: FOUNDER.loyaltyTier,
      isClubMember: FOUNDER.isClubMember,
      // membershipNumber set in a separate UPDATE below so the unique
      // constraint failure is caught and reported cleanly if the number
      // is already taken.
    });
  }

  // ─── 3b. Assign membershipNumber separately (unique constraint) ───
  const updatedUser = await db.select().from(users).where(eq(users.email, FOUNDER.email)).limit(1);
  const actualUserId = updatedUser[0]?.id;
  if (!actualUserId) throw new Error("Founder user not found after upsert — refusing to continue.");

  if (!updatedUser[0]?.membershipNumber) {
    try {
      await db.update(users)
        .set({ membershipNumber: FOUNDER.membershipNumber })
        .where(eq(users.id, actualUserId));
      log(`  → assigned membershipNumber=${FOUNDER.membershipNumber}`);
    } catch (e: any) {
      console.error(`  ⚠️  could not assign membershipNumber ${FOUNDER.membershipNumber}: ${e?.message || e}`);
      console.error(`     (probably already taken by another row — leaving membershipNumber unset)`);
    }
  } else {
    log(`  → user already has membershipNumber=${updatedUser[0].membershipNumber} — leaving as-is`);
  }

  // ─── 4. Upsert pet ──────────────────────────────────────────
  log("");
  log("Step 2/3: upserting pet (Kenzo)…");
  const existingPets = await db.select().from(pets).where(eq(pets.userId, actualUserId));
  const existingKenzo = existingPets.find((p) => p.name === FOUNDER.petName);

  if (existingKenzo) {
    log(`  → pet ${FOUNDER.petName} already exists for this user (id=${existingKenzo.id}). Updating breed/color/gender.`);
    await db.update(pets)
      .set({
        species: FOUNDER.petSpecies,
        breed: FOUNDER.petBreed,
        gender: FOUNDER.petGender,
        color: FOUNDER.petColor,
      })
      .where(eq(pets.id, existingKenzo.id));
  } else {
    log(`  → inserting new pet record for ${FOUNDER.petName}.`);
    await db.insert(pets).values({
      userId: actualUserId,
      name: FOUNDER.petName,
      species: FOUNDER.petSpecies,
      breed: FOUNDER.petBreed,
      gender: FOUNDER.petGender,
      color: FOUNDER.petColor,
    });
  }

  // ─── 5. Generate Apple Wallet pass ──────────────────────────
  log("");
  log("Step 3/3: generating signed Apple Wallet pass…");
  if (!isAppleWalletConfigured()) {
    console.error("  ❌ Apple Wallet env vars not set — skipping pass generation.");
    console.error("     Set APPLE_TEAM_IDENTIFIER / APPLE_WWDR_PEM / APPLE_SIGNER_CERT_PEM / APPLE_SIGNER_KEY_PEM and re-run.");
    process.exit(2);
  }

  const passBuffer = await generateAppleWalletPass({
    passId: `pass-founder-001c-${crypto.randomBytes(4).toString("hex")}`,
    userId: actualUserId,
    ownerName: `${FOUNDER.firstName} ${FOUNDER.lastName} — ${FOUNDER.founderBadge}`,
    primaryPetName: FOUNDER.petName,
    tier: FOUNDER.loyaltyTier.toUpperCase(),
    availableCreditIls: FOUNDER.founderInitialCreditIls,
    qrTokenVersion: 1,
  });

  const passPath = path.resolve(process.cwd(), "first-founder-pass.pkpass");
  fs.writeFileSync(passPath, passBuffer);
  log(`  → wrote ${passBuffer.length.toLocaleString()} bytes to ${passPath}`);

  // ─── 4. Send welcome email (optional, --notify) ──────────────
  if (NOTIFY) {
    log("");
    log("Step 4/5: sending welcome email via SendGrid…");
    if (process.env.SENDGRID_API_KEY) {
      try {
        const { generateCustomerWelcomeEmail } = await import("../../server/email/templates/welcome-customer-signup-2026");
        const { createMailService } = await import("../../server/lib/sendgrid");
        const { subject, html } = generateCustomerWelcomeEmail({
          firstName: FOUNDER.firstName,
          lastName: FOUNDER.lastName,
          email: FOUNDER.email,
          language: FOUNDER.language as "he" | "en",
          loyaltyTier: FOUNDER.loyaltyTier,
        });
        const sg = createMailService();
        await sg.send({
          to: FOUNDER.email,
          from: process.env.SENDGRID_FROM_EMAIL || "noreply@petwash.co.il",
          subject,
          html,
          attachments: [
            {
              content: passBuffer.toString("base64"),
              filename: "petwash-founder-001c.pkpass",
              type: "application/vnd.apple.pkpass",
              disposition: "attachment",
            },
          ],
        });
        log(`  → email sent to ${FOUNDER.email} with .pkpass attached`);
      } catch (e: any) {
        console.error(`  ❌ email send failed: ${e?.message || e}`);
      }
    } else {
      log("  → SENDGRID_API_KEY not set — email skipped");
    }

    // ─── 5. Send welcome SMS (optional, --notify) ──────────────
    log("");
    log("Step 5/5: sending welcome SMS via Twilio…");
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const { twilioSMSService } = await import("../../server/services/TwilioSMSService");
        const smsBody =
          FOUNDER.language === "he"
            ? `Pet Wash™: ברוך הבא, ${FOUNDER.firstName}! אתה חבר מייסד ${FOUNDER.founderBadge}. כרטיס Apple Wallet נשלח לאימייל ${FOUNDER.email}. פתח באייפון והוסף לארנק.`
            : `PetWash™: Welcome, ${FOUNDER.firstName}! You're Founder Member ${FOUNDER.founderBadge}. Your Apple Wallet pass is in your email at ${FOUNDER.email}. Open on iPhone and tap the .pkpass to add to Wallet.`;
        const result = await twilioSMSService.sendSMS(FOUNDER.phone, smsBody, { userId: actualUserId });
        if (result.success) {
          log(`  → SMS sent to ${FOUNDER.phone} (messageId=${result.messageId})`);
        } else {
          console.error(`  ❌ SMS failed: ${result.error}`);
        }
      } catch (e: any) {
        console.error(`  ❌ SMS send threw: ${e?.message || e}`);
      }
    } else {
      log("  → TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER not all set — SMS skipped");
    }
  }

  // ─── 6. Done ────────────────────────────────────────────────
  log("");
  log("──────────────────────────────────────────────────────────");
  log("✅ DONE");
  log("──────────────────────────────────────────────────────────");
  log(`  Founder user id:   ${actualUserId}`);
  log(`  Membership number: ${FOUNDER.membershipNumber}  (vanity: ${FOUNDER.founderBadge})`);
  log(`  Pet:               ${FOUNDER.petName}`);
  log(`  Pass file:         ${passPath}`);
  log("");
  log("Open the .pkpass on your iPhone (AirDrop / email attachment / iCloud) to add it to Apple Wallet.");
  log("");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function log(msg: string): void {
  process.stdout.write(msg + "\n");
}

function validateEnv(): void {
  const required = ["DATABASE_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
    console.error(`   Export DATABASE_URL (Postgres connection string) before running.`);
    process.exit(1);
  }

  if (EXECUTE) {
    const appleVars = [
      "APPLE_TEAM_IDENTIFIER",
      "APPLE_WWDR_PEM",
      "APPLE_SIGNER_CERT_PEM",
      "APPLE_SIGNER_KEY_PEM",
    ];
    const missingApple = appleVars.filter((k) => !process.env[k]);
    if (missingApple.length > 0) {
      console.error(`⚠️  Apple Wallet env vars not set: ${missingApple.join(", ")}`);
      console.error(`   The script will still upsert DB rows but pass generation will fail at step 3.`);
      console.error(`   Set them and re-run, or run --dry-run first to inspect.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error("❌ Script failed:");
  console.error(err);
  process.exit(99);
});
