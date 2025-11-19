/**
 * PET WASH LTD – GLOBAL BACKEND FRAMEWORK 2025
 * Complete Compliance Seed Script
 * 
 * Creates test contractor with full compliance flow:
 * 1. Create contractor
 * 2. Add identity document
 * 3. Add driver profile
 * 4. Add ratings
 * 5. Evaluate compliance
 * 
 * Run with: tsx scripts/seed_compliance.ts
 */

import axios from "axios";

async function seed() {
  console.log("🚀 Pet Wash Global Compliance Seed Script – START\n");

  const api = axios.create({
    baseURL: "http://localhost:5000",
    headers: { "Content-Type": "application/json" },
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
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

seed();
