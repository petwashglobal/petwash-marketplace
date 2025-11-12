/**
 * Generate provider invite codes for testing
 * Run with: npx tsx server/scripts/generateInviteCodes.ts
 * 
 * CRITICAL: Uses Drizzle ORM / Postgres DB (NOT Firestore)
 * to match the backend API's validation logic
 */

import { db } from "../db";
import { providerInviteCodes } from "@shared/schema";
import { eq } from "drizzle-orm";

// Test invite codes to create
const testInviteCodes = [
  {
    code: "SITTER-TEST2025",
    providerType: "sitter" as const,
    maxUses: 100,
    campaignName: "Test - Sitter Suite",
    notes: "Generated for development testing - unlimited uses"
  },
  {
    code: "WALKER-TEST2025",
    providerType: "walker" as const,
    maxUses: 100,
    campaignName: "Test - Walk My Pet",
    notes: "Generated for development testing - unlimited uses"
  },
  {
    code: "STATION-TEST2025",
    providerType: "station_operator" as const,
    maxUses: 100,
    campaignName: "Test - K9000 Wash Stations",
    notes: "Generated for development testing - unlimited uses"
  },
];

async function generateInviteCodes() {
  console.log("🎫 Generating test invite codes via Drizzle/Postgres...\n");

  try {
    for (const { code, providerType, maxUses, campaignName, notes } of testInviteCodes) {
      // Check if code already exists in Postgres
      const existing = await db
        .select()
        .from(providerInviteCodes)
        .where(eq(providerInviteCodes.inviteCode, code))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ⚠️  Invite code ${code} already exists, skipping...`);
        continue;
      }

      // Create invite code in Postgres via Drizzle
      await db.insert(providerInviteCodes).values({
        inviteCode: code,
        providerType,
        createdByAdminId: "system",
        maxUses,
        currentUses: 0,
        expiresAt: null, // No expiration for test codes
        campaignName,
        referralBonus: null,
        notes,
        isActive: true,
      });

      console.log(`  ✅ Created ${providerType} invite code: ${code}`);
      console.log(`     Campaign: ${campaignName}`);
      console.log(`     Max Uses: ${maxUses}\n`);
    }

    console.log("✨ Invite codes generated successfully!");
    console.log("\n📋 Available Test Codes:");
    console.log("   - SITTER-TEST2025 (for Sitter Suite)");
    console.log("   - WALKER-TEST2025 (for Walk My Pet)");
    console.log("   - STATION-TEST2025 (for K9000 Wash Stations)");
    console.log("\n🎉 Providers can now use these codes to sign up!\n");

  } catch (error) {
    console.error("❌ Error generating invite codes:", error);
    throw error;
  }
}

// Run the script
generateInviteCodes()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
