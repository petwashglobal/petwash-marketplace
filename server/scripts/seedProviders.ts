/**
 * Seed script to populate sample providers (sitters, walkers, drivers)
 * Run with: npx tsx server/scripts/seedProviders.ts
 */

import admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Sample sitter profiles
const sampleSitters = [
  {
    id: "sitter-maya-cohen",
    name: "Maya Cohen",
    bio: "Passionate pet lover with 8 years of experience caring for dogs, cats, and small animals. Certified in pet first aid.",
    photoUrl: "https://i.pravatar.cc/400?img=1",
    location: "Tel Aviv, Israel",
    dailyRate: 180,
    averageRating: 4.9,
    totalReviews: 127,
    yearsExperience: 8,
    specialties: ["Dogs", "Cats", "Small Animals", "Medication Administration"],
    availability: true,
    active: true,
    maxPets: 3,
    homeType: "Apartment with balcony",
    certifications: ["Pet First Aid", "CPR Certified"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "sitter-david-levi",
    name: "David Levi",
    bio: "Experienced with large breeds and senior pets. I have a spacious home with a fenced yard perfect for active dogs.",
    photoUrl: "https://i.pravatar.cc/400?img=12",
    location: "Jerusalem, Israel",
    dailyRate: 150,
    averageRating: 4.8,
    totalReviews: 89,
    yearsExperience: 5,
    specialties: ["Large Dogs", "Senior Pets", "Behavioral Training"],
    availability: true,
    active: true,
    maxPets: 4,
    homeType: "House with yard",
    certifications: ["Dog Training Certificate"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "sitter-sarah-mizrahi",
    name: "Sarah Mizrahi",
    bio: "Cat specialist and bird care expert. My calm, quiet home is perfect for anxious or special-needs pets.",
    photoUrl: "https://i.pravatar.cc/400?img=5",
    location: "Haifa, Israel",
    dailyRate: 120,
    averageRating: 5.0,
    totalReviews: 64,
    yearsExperience: 6,
    specialties: ["Cats", "Birds", "Exotic Pets", "Special Needs"],
    availability: false,
    active: true,
    maxPets: 2,
    homeType: "Quiet apartment",
    certifications: ["Feline Behavior Specialist"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "sitter-yoni-abraham",
    name: "Yoni Abraham",
    bio: "Veterinary technician with 10+ years experience. I can handle pets with medical needs and provide excellent care.",
    photoUrl: "https://i.pravatar.cc/400?img=15",
    location: "Netanya, Israel",
    dailyRate: 220,
    averageRating: 4.9,
    totalReviews: 152,
    yearsExperience: 10,
    specialties: ["Medical Care", "Post-Surgery Recovery", "All Breeds"],
    availability: true,
    active: true,
    maxPets: 5,
    homeType: "House with clinic access",
    certifications: ["Veterinary Technician", "Pet First Aid", "CPR"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample walker profiles
const sampleWalkers = [
  {
    id: "walker-avi-shapira",
    name: "Avi Shapira",
    bio: "Professional dog walker and runner. I love taking dogs on active adventures and beach walks!",
    photoUrl: "https://i.pravatar.cc/400?img=8",
    location: "Tel Aviv, Israel",
    hourlyRate: 60,
    averageRating: 4.8,
    totalReviews: 203,
    yearsExperience: 4,
    specialties: ["Active Dogs", "Beach Walks", "Group Walks"],
    availability: true,
    active: true,
    maxDogsPerWalk: 4,
    serviceAreas: ["Tel Aviv", "Ramat Aviv", "Jaffa"],
    gpsEnabled: true,
    certifications: ["Pet First Aid"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "walker-rachel-katz",
    name: "Rachel Katz",
    bio: "Gentle walker specializing in senior dogs and small breeds. Patient and caring service with photo updates.",
    photoUrl: "https://i.pravatar.cc/400?img=9",
    location: "Jerusalem, Israel",
    hourlyRate: 50,
    averageRating: 5.0,
    totalReviews: 142,
    yearsExperience: 3,
    specialties: ["Senior Dogs", "Small Breeds", "Gentle Walks"],
    availability: true,
    active: true,
    maxDogsPerWalk: 2,
    serviceAreas: ["Jerusalem", "Rechavia", "Talpiot"],
    gpsEnabled: true,
    certifications: ["Pet First Aid"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "walker-noam-ben-david",
    name: "Noam Ben-David",
    bio: "High-energy walker for active breeds. Trail hiking, jogging, and park adventures available!",
    photoUrl: "https://i.pravatar.cc/400?img=13",
    location: "Haifa, Israel",
    hourlyRate: 70,
    averageRating: 4.9,
    totalReviews: 178,
    yearsExperience: 5,
    specialties: ["Active Breeds", "Trail Hiking", "Running"],
    availability: true,
    active: true,
    maxDogsPerWalk: 3,
    serviceAreas: ["Haifa", "Carmel", "Nesher"],
    gpsEnabled: true,
    certifications: ["Pet First Aid", "CPR"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample driver profiles
const sampleDrivers = [
  {
    id: "driver-dan-cohen",
    name: "Dan Cohen",
    bio: "Safe, reliable pet transport with climate-controlled SUV. Perfect for vet visits and airport transfers.",
    photoUrl: "https://i.pravatar.cc/400?img=14",
    location: "Tel Aviv, Israel",
    perKmRate: 8,
    averageRating: 4.9,
    totalReviews: 89,
    yearsExperience: 3,
    vehicleType: "SUV",
    vehicleMake: "Toyota RAV4",
    vehicleYear: 2022,
    maxPets: 3,
    climateControl: true,
    petSafetyEquipment: ["Seat belts", "Carriers", "Water bowls"],
    specialties: ["Airport Transfers", "Vet Visits", "Long Distance"],
    availability: true,
    active: true,
    currentlyAvailable: true,
    serviceAreas: ["Tel Aviv", "Central Israel", "Ben Gurion Airport"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "driver-lior-israeli",
    name: "Lior Israeli",
    bio: "Experienced pet transporter with spacious van. Can handle multiple pets and long-distance trips.",
    photoUrl: "https://i.pravatar.cc/400?img=11",
    location: "Jerusalem, Israel",
    perKmRate: 10,
    averageRating: 4.8,
    totalReviews: 64,
    yearsExperience: 5,
    vehicleType: "Van",
    vehicleMake: "Mercedes Sprinter",
    vehicleYear: 2021,
    maxPets: 6,
    climateControl: true,
    petSafetyEquipment: ["Crates", "Seat belts", "Ramps", "First aid kit"],
    specialties: ["Multi-Pet Transport", "Long Distance", "Moving Assistance"],
    availability: true,
    active: true,
    currentlyAvailable: false,
    serviceAreas: ["Jerusalem", "Dead Sea", "Eilat"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "driver-tamar-levy",
    name: "Tamar Levy",
    bio: "Luxury pet transport service. Gentle handling, real-time updates, and premium comfort for your pets.",
    photoUrl: "https://i.pravatar.cc/400?img=6",
    location: "Herzliya, Israel",
    perKmRate: 12,
    averageRating: 5.0,
    totalReviews: 112,
    yearsExperience: 4,
    vehicleType: "Luxury Sedan",
    vehicleMake: "Tesla Model Y",
    vehicleYear: 2023,
    maxPets: 2,
    climateControl: true,
    petSafetyEquipment: ["Premium carriers", "Luxury bedding", "Treats", "Water station"],
    specialties: ["Luxury Service", "VIP Clients", "Show Dogs"],
    availability: true,
    active: true,
    currentlyAvailable: true,
    serviceAreas: ["Herzliya", "Tel Aviv", "Netanya", "Caesarea"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seedProviders() {
  console.log("🌱 Starting provider seed process...\n");

  try {
    // Seed sitters
    console.log("📝 Seeding sitter profiles...");
    for (const sitter of sampleSitters) {
      // Create sitter-specific profile
      await db.collection("sitter_profiles").doc(sitter.id).set(sitter);
      
      // Create unified provider record for bookings/notifications/chat
      await db.collection("providers").doc(sitter.id).set({
        id: sitter.id,
        name: sitter.name,
        photo: sitter.photoUrl,
        bio: sitter.bio,
        location: sitter.location,
        platform: "sitter-suite",
        averageRating: sitter.averageRating,
        totalReviews: sitter.totalReviews,
        active: sitter.active,
        createdAt: sitter.createdAt,
        updatedAt: sitter.updatedAt,
      });
      
      console.log(`  ✅ Created sitter: ${sitter.name}`);
    }

    // Seed walkers
    console.log("\n📝 Seeding walker profiles...");
    for (const walker of sampleWalkers) {
      // Create walker-specific profile
      await db.collection("walker_profiles").doc(walker.id).set(walker);
      
      // Create unified provider record for bookings/notifications/chat
      await db.collection("providers").doc(walker.id).set({
        id: walker.id,
        name: walker.name,
        photo: walker.photoUrl,
        bio: walker.bio,
        location: walker.location,
        platform: "walk-my-pet",
        averageRating: walker.averageRating,
        totalReviews: walker.totalReviews,
        active: walker.active,
        createdAt: walker.createdAt,
        updatedAt: walker.updatedAt,
      });
      
      console.log(`  ✅ Created walker: ${walker.name}`);
    }

    // Seed drivers
    console.log("\n📝 Seeding driver profiles...");
    for (const driver of sampleDrivers) {
      // Create driver-specific profile
      await db.collection("driver_profiles").doc(driver.id).set(driver);
      
      // Create unified provider record for bookings/notifications/chat
      await db.collection("providers").doc(driver.id).set({
        id: driver.id,
        name: driver.name,
        photo: driver.photoUrl,
        bio: driver.bio,
        location: driver.location,
        platform: "pettrek",
        averageRating: driver.averageRating,
        totalReviews: driver.totalReviews,
        active: driver.active,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      });
      
      console.log(`  ✅ Created driver: ${driver.name}`);
    }

    console.log("\n✨ Seed process complete!");
    console.log(`   - ${sampleSitters.length} sitters created`);
    console.log(`   - ${sampleWalkers.length} walkers created`);
    console.log(`   - ${sampleDrivers.length} drivers created`);
    console.log("\n🎉 You can now browse and book providers in the app!");

  } catch (error) {
    console.error("❌ Error seeding providers:", error);
    throw error;
  }
}

// Run the seed script
seedProviders()
  .then(() => {
    console.log("\n✅ Seed script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seed script failed:", error);
    process.exit(1);
  });
