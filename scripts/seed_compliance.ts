/**
 * PET WASH LTD – GLOBAL BACKEND FRAMEWORK 2025
 * Complete Compliance Seed Script with JWT Authentication
 * 
 * Creates test contractor with full compliance flow:
 * 1. Generate test JWT token
 * 2. Create contractor
 * 3. Add identity document
 * 4. Add driver profile
 * 5. Add ratings
 * 6. Evaluate compliance
 * 
 * Run with: tsx scripts/seed_compliance.ts
 */

import axios from "axios";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is not set.");
  console.error("Please set JWT_SECRET in your environment before running this script.");
  process.exit(1);
}

function generateTestToken(userId: string, roles: string[] = ["contractor"]): string {
  return jwt.sign(
    { sub: userId, roles },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

async function seed() {
  console.log("🚀 Pet Wash Global Compliance Seed Script – START\n");

  const testUserId = "test-user-" + Date.now();
  const token = generateTestToken(testUserId, ["admin", "compliance", "hr"]);

  const api = axios.create({
    baseURL: "http://localhost:5000",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  try {
    // -------------------------
    // 1. Create contractor
    // -------------------------
    console.log("👤 Creating contractor...");
    const contractorResponse = await api.post("/api/contractors", {
      fullName: "John PetDriver",
      email: "john@example.com",
      phone: "+1 202-555-7777",
      country: "US",
      roleType: "driver",
    });

    const id = contractorResponse.data.id;
    console.log(`✅ Contractor created: ${id}\n`);

    // -------------------------
    // 2. Add identity document
    // -------------------------
    console.log("📄 Adding identity document...");
    await api.post("/api/identity/document", {
      contractorId: id,
      documentType: "passport",
      documentNumber: "A1234567",
      issuedCountry: "US",
      expiryDate: "2031-05-10",
    });
    console.log("✅ Identity document added\n");

    // -------------------------
    // 3. Add driver profile
    // -------------------------
    console.log("🚗 Creating driver profile...");
    await api.post("/api/drivers", {
      contractorId: id,
      vehicleType: "van",
      licenseNumber: "US-998822",
      licenseExpiry: "2029-03-09",
      areasOfService: "Manhattan,Brooklyn",
    });
    console.log("✅ Driver profile created\n");

    // -------------------------
    // 4. Add ratings
    // -------------------------
    console.log("⭐ Adding ratings...");
    await api.post("/api/ratings", {
      contractorId: id,
      givenByUserId: "11111111-1111-1111-1111-111111111111",
      score: 5,
      category: "professionalism",
      comment: "Excellent",
    });

    await api.post("/api/ratings", {
      contractorId: id,
      givenByUserId: "22222222-2222-2222-2222-222222222222",
      score: 5,
      category: "reliability",
      comment: "Always on time",
    });

    await api.post("/api/ratings", {
      contractorId: id,
      givenByUserId: "33333333-3333-3333-3333-333333333333",
      score: 4,
      category: "communication",
      comment: "Good communication",
    });
    console.log("✅ Ratings added\n");

    // -------------------------
    // 5. Evaluate eligibility
    // -------------------------
    console.log("🧠 Evaluating compliance...");
    const evaluationResponse = await api.post("/api/compliance/evaluate", {
      contractorId: id,
    });

    console.log("\n📊 COMPLIANCE RESULT:");
    console.log("====================");
    console.log(JSON.stringify(evaluationResponse.data, null, 2));
    console.log("\n🎉 Seed complete!");
    console.log(`\nContractor ID: ${id}`);
    console.log("You can view this contractor in the Control Panel or query via API.");
  } catch (error: any) {
    console.error("\n❌ Seed failed:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

seed();
