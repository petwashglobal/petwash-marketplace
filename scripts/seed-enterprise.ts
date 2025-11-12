/**
 * Pet Wash™ Enterprise Platform - Demo Data Seeding Script
 * Simplified version focusing on essential data for dashboard testing
 */

import { db } from "../server/db";
import {
  countries,
  franchiseTerritories,
  franchisees,
  petWashStations,
  stationBills,
  spareParts,
  stationSpareParts,
  maintenanceWorkOrders,
  subscriptionPlans,
  userSubscriptions,
  stationTelemetry,
  stationAlerts,
  stationPerformanceMetrics,
} from "../shared/schema-enterprise";

async function seedEnterprise() {
  console.log("🚀 Starting Pet Wash™ Enterprise Data Seeding...\n");

  try {
    // =================== 1. COUNTRIES ===================
    console.log("📍 Seeding countries...");
    const [israel, usa, uk] = await db.insert(countries).values([
      {
        code: "IL",
        name: "Israel",
        currency: "ILS",
        currencySymbol: "₪",
        timezone: "Asia/Jerusalem",
        language: "he",
        isActive: true,
      },
      {
        code: "US",
        name: "United States",
        currency: "USD",
        currencySymbol: "$",
        timezone: "America/New_York",
        language: "en",
        isActive: true,
      },
      {
        code: "GB",
        name: "United Kingdom",
        currency: "GBP",
        currencySymbol: "£",
        timezone: "Europe/London",
        language: "en",
        isActive: true,
      },
    ]).returning();
    console.log(`✅ Created 3 countries\n`);

    // =================== 2. TERRITORIES ===================
    console.log("🗺️  Seeding territories...");
    const [telAviv, jerusalem, california, newYork, london] = await db.insert(franchiseTerritories).values([
      { countryId: israel.id, name: "Tel Aviv District", territoryCode: "IL-TA" },
      { countryId: israel.id, name: "Jerusalem District", territoryCode: "IL-JER" },
      { countryId: usa.id, name: "California", territoryCode: "US-CA" },
      { countryId: usa.id, name: "New York", territoryCode: "US-NY" },
      { countryId: uk.id, name: "Greater London", territoryCode: "GB-LON" },
    ]).returning();
    console.log(`✅ Created 5 territories\n`);

    // =================== 3. FRANCHISEES ===================
    console.log("👥 Seeding franchisees...");
    const [franchiseeIL, franchiseeUS, franchiseeUK] = await db.insert(franchisees).values([
      {
        companyName: "David Cohen Pet Services Ltd.",
        contactFirstName: "David",
        contactLastName: "Cohen",
        contactEmail: "david@petwash.co.il",
        contactPhone: "+972-50-123-4567",
        address: "123 Rothschild Blvd",
        city: "Tel Aviv",
        postalCode: "69000",
        countryId: israel.id,
        territoryId: telAviv.id,
        agreementType: "multi_station",
        agreementStartDate: "2024-01-15",
        status: "active",
      },
      {
        companyName: "West Coast Pet Wash LLC",
        contactFirstName: "John",
        contactLastName: "Smith",
        contactEmail: "john@westcoastpetwash.com",
        contactPhone: "+1-415-555-0123",
        address: "456 Market Street",
        city: "San Francisco",
        state: "CA",
        postalCode: "94102",
        countryId: usa.id,
        territoryId: california.id,
        agreementType: "multi_station",
        agreementStartDate: "2024-03-01",
        status: "active",
      },
      {
        companyName: "London Pet Care Ltd.",
        contactFirstName: "Emma",
        contactLastName: "Johnson",
        contactEmail: "emma@londonpetcare.co.uk",
        contactPhone: "+44-20-7123-4567",
        address: "789 Oxford Street",
        city: "London",
        postalCode: "W1D 2HG",
        countryId: uk.id,
        territoryId: london.id,
        agreementType: "multi_station",
        agreementStartDate: "2024-02-10",
        status: "active",
      },
    ]).returning();
    console.log(`✅ Created 3 franchisees\n`);

    // =================== 4. STATIONS ===================
    console.log("🏪 Seeding pet wash stations...");
    const stations = await db.insert(petWashStations).values([
      {
        stationCode: "IL-TA-001",
        stationName: "Pet Wash™ Ramat Aviv",
        identityNumber: "K9-IL-TA-001",
        qrCode: "PW-IL-TA-001-QR",
        franchiseeId: franchiseeIL.id,
        ownershipType: "franchisee",
        territoryId: telAviv.id,
        address: "123 Shaul HaMelech Blvd",
        city: "Tel Aviv",
        postalCode: "69000",
        countryId: israel.id,
        latitude: "32.0853",
        longitude: "34.7818",
        operationalStatus: "active",
        healthStatus: "healthy",
        totalWashesCompleted: 1247,
      },
      {
        stationCode: "IL-TA-002",
        stationName: "Pet Wash™ Dizengoff Center",
        identityNumber: "K9-IL-TA-002",
        qrCode: "PW-IL-TA-002-QR",
        franchiseeId: franchiseeIL.id,
        ownershipType: "franchisee",
        territoryId: telAviv.id,
        address: "50 Dizengoff St",
        city: "Tel Aviv",
        postalCode: "64332",
        countryId: israel.id,
        latitude: "32.0750",
        longitude: "34.7746",
        operationalStatus: "active",
        healthStatus: "warning",
        totalWashesCompleted: 892,
      },
      {
        stationCode: "US-CA-001",
        stationName: "Pet Wash™ SF Marina",
        identityNumber: "K9-US-CA-001",
        qrCode: "PW-US-CA-001-QR",
        franchiseeId: franchiseeUS.id,
        ownershipType: "franchisee",
        territoryId: california.id,
        address: "2500 Marina Blvd",
        city: "San Francisco",
        state: "CA",
        postalCode: "94123",
        countryId: usa.id,
        latitude: "37.8044",
        longitude: "-122.4378",
        operationalStatus: "active",
        healthStatus: "healthy",
        totalWashesCompleted: 2103,
      },
      {
        stationCode: "US-NY-001",
        stationName: "Pet Wash™ Manhattan Central Park",
        identityNumber: "K9-US-NY-001",
        qrCode: "PW-US-NY-001-QR",
        franchiseeId: franchiseeUS.id,
        ownershipType: "franchisee",
        territoryId: newYork.id,
        address: "1234 5th Avenue",
        city: "New York",
        state: "NY",
        postalCode: "10029",
        countryId: usa.id,
        latitude: "40.7829",
        longitude: "-73.9654",
        operationalStatus: "maintenance",
        healthStatus: "critical",
        totalWashesCompleted: 445,
      },
      {
        stationCode: "GB-LON-001",
        stationName: "Pet Wash™ Hyde Park",
        identityNumber: "K9-GB-LON-001",
        qrCode: "PW-GB-LON-001-QR",
        franchiseeId: franchiseeUK.id,
        ownershipType: "franchisee",
        territoryId: london.id,
        address: "Hyde Park Corner",
        city: "London",
        postalCode: "W2 2UH",
        countryId: uk.id,
        latitude: "51.5074",
        longitude: "-0.1278",
        operationalStatus: "active",
        healthStatus: "healthy",
        totalWashesCompleted: 1534,
      },
    ]).returning();
    console.log(`✅ Created ${stations.length} stations\n`);

    // =================== 5. STATION BILLS ===================
    console.log("💰 Seeding station bills...");
    const bills = await db.insert(stationBills).values([
      {
        stationId: stations[0].id,
        billType: "water",
        vendor: "Tel Aviv Water Corp",
        billingPeriod: "monthly",
        periodStart: "2024-10-01",
        periodEnd: "2024-10-31",
        dueDate: "2024-11-15",
        amount: 450.00,
        totalAmount: 450.00,
        currency: "ILS",
        status: "paid",
        paidDate: "2024-11-10",
      },
      {
        stationId: stations[2].id,
        billType: "electricity",
        vendor: "PG&E",
        billingPeriod: "monthly",
        periodStart: "2024-10-01",
        periodEnd: "2024-10-31",
        dueDate: "2024-11-15",
        amount: 320.00,
        totalAmount: 320.00,
        currency: "USD",
        status: "pending",
      },
    ]).returning();
    console.log(`✅ Created ${bills.length} bills\n`);

    // =================== 6. SPARE PARTS ===================
    console.log("🔧 Seeding spare parts...");
    const parts = await db.insert(spareParts).values([
      {
        partNumber: "PW-PUMP-01",
        partName: "High-Pressure Water Pump",
        category: "pump_parts",
        supplier: "AquaFlow Industries",
        unitCost: 450.00,
        currency: "USD",
      },
      {
        partNumber: "PW-FILTER-01",
        partName: "Water Filter Cartridge",
        category: "filters",
        supplier: "PureFlow",
        unitCost: 25.00,
        currency: "USD",
      },
    ]).returning();
    console.log(`✅ Created ${parts.length} spare parts\n`);

    // =================== 7. WORK ORDERS ===================
    console.log("🛠️  Seeding work orders...");
    const workOrders = await db.insert(maintenanceWorkOrders).values([
      {
        workOrderNumber: "WO-2024-001",
        stationId: stations[3].id,
        workType: "corrective_repair",
        priority: "critical",
        title: "Water pump failure",
        description: "Main water pump has failed. Emergency replacement required.",
        status: "in_progress",
        assignedToTechnicianId: "tech-001",
      },
      {
        workOrderNumber: "WO-2024-002",
        stationId: stations[1].id,
        workType: "preventive_maintenance",
        priority: "medium",
        title: "Quarterly filter replacement",
        description: "Replace all water filters as part of preventive maintenance",
        status: "pending",
        assignedToTechnicianId: "tech-002",
      },
    ]).returning();
    console.log(`✅ Created ${workOrders.length} work orders\n`);

    // =================== 8. SUBSCRIPTION PLANS ===================
    console.log("📋 Seeding subscription plans...");
    const plans = await db.insert(subscriptionPlans).values([
      {
        planCode: "BASIC",
        name: "Basic Wash Plan",
        nameHe: "תוכנית רחצה בסיסית",
        price: 39.99,
        currency: "USD",
        billingInterval: "monthly",
        washCreditsPerMonth: 4,
      },
      {
        planCode: "PREMIUM",
        name: "Premium Wash Plan",
        nameHe: "תוכנית רחצה פרימיום",
        price: 69.99,
        currency: "USD",
        billingInterval: "monthly",
        washCreditsPerMonth: 8,
      },
    ]).returning();
    console.log(`✅ Created ${plans.length} subscription plans\n`);

    // =================== 9. IOT TELEMETRY ===================
    console.log("📡 Seeding IoT telemetry...");
    const now = new Date();
    const telemetry = await db.insert(stationTelemetry).values([
      {
        stationId: stations[0].id,
        timestamp: new Date(now.getTime() - 5 * 60000),
        waterTemperature: 38.5,
        waterPressure: 2.2,
        waterFlowRate: 3.8,
        powerConsumption: 2.4,
      },
      {
        stationId: stations[3].id,
        timestamp: new Date(now.getTime() - 2 * 60000),
        waterTemperature: 20.0,
        waterPressure: 0.8,
        waterFlowRate: 1.2,
        powerConsumption: 0.5,
      },
    ]).returning();
    console.log(`✅ Created ${telemetry.length} telemetry readings\n`);

    // =================== 10. ALERTS ===================
    console.log("🚨 Seeding alerts...");
    const alerts = await db.insert(stationAlerts).values([
      {
        stationId: stations[3].id,
        alertType: "pump_failure",
        severity: "critical",
        title: "Critical: Water Pump Failure",
        message: "Main water pump has stopped. Pressure dropped to 0.8 bar.",
        triggeredAt: new Date(now.getTime() - 120 * 60000),
        status: "open",
      },
      {
        stationId: stations[1].id,
        alertType: "temperature_high",
        severity: "warning",
        title: "Warning: Water Temperature Elevated",
        message: "Water temperature at 45.2°C, above normal range",
        triggeredAt: new Date(now.getTime() - 30 * 60000),
        status: "open",
      },
    ]).returning();
    console.log(`✅ Created ${alerts.length} alerts\n`);

    // =================== 11. PERFORMANCE METRICS ===================
    console.log("📊 Seeding performance metrics...");
    const metrics = await db.insert(stationPerformanceMetrics).values([
      {
        stationId: stations[0].id,
        date: "2024-11-15",
        totalSessions: 42,
        totalRevenue: 630.00,
        currency: "ILS",
        averageSessionDuration: 8.5,
        waterUsed: 125.5,
        energyUsed: 18.2,
        customerSatisfactionScore: 4.7,
        uptimePercentage: 99.2,
      },
      {
        stationId: stations[2].id,
        date: "2024-11-15",
        totalSessions: 68,
        totalRevenue: 1020.00,
        currency: "USD",
        averageSessionDuration: 9.2,
        waterUsed: 245.0,
        energyUsed: 32.5,
        customerSatisfactionScore: 4.9,
        uptimePercentage: 100.0,
      },
    ]).returning();
    console.log(`✅ Created ${metrics.length} performance metrics\n`);

    // SUMMARY
    console.log("\n🎉 ENTERPRISE SEEDING COMPLETE!\n");
    console.log("=".repeat(60));
    console.log("📊 Summary:");
    console.log("=".repeat(60));
    console.log(`✅ Countries: 3`);
    console.log(`✅ Territories: 5`);
    console.log(`✅ Franchisees: 3`);
    console.log(`✅ Stations: ${stations.length}`);
    console.log(`✅ Bills: ${bills.length}`);
    console.log(`✅ Spare Parts: ${parts.length}`);
    console.log(`✅ Work Orders: ${workOrders.length}`);
    console.log(`✅ Subscription Plans: ${plans.length}`);
    console.log(`✅ Telemetry Readings: ${telemetry.length}`);
    console.log(`✅ Alerts: ${alerts.length}`);
    console.log(`✅ Performance Metrics: ${metrics.length}`);
    console.log("=".repeat(60));
    console.log("\n📍 Sample Access Points:");
    console.log("   • HQ Dashboard: /enterprise/hq");
    console.log(`   • Franchisee Dashboard: /enterprise/franchisee/${franchiseeIL.id}`);
    console.log("   • Technician View: /enterprise/technician/tech-001");
    console.log("\n✨ Ready for testing and demos!\n");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedEnterprise()
  .then(() => {
    console.log("✅ Seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
