/**
 * Seed Demo Data for The Sitter Suite™
 * Creates premium sitters, reviews, and bookings for demonstration
 */

import { db } from './db';
import { sitterProfiles, sitterReviews, petProfilesForSitting, sitterBookings } from '@shared/schema';
import { logger } from './lib/logger';

const DEMO_USER_ID = 'demo-user-123'; // Firebase UID for demo

const demoSitters = [
  {
    userId: 'sitter-001',
    firstName: 'Sarah',
    lastName: 'Cohen',
    dateOfBirth: new Date('1990-05-15'),
    email: 'sarah.cohen@example.com',
    phone: '+972-50-123-4567',
    streetAddress: '15 Rothschild Blvd',
    apartment: 'Apt 5',
    city: 'Tel Aviv',
    stateProvince: 'Tel Aviv District',
    postalCode: '6688101',
    country: 'Israel',
    latitude: '32.0642',
    longitude: '34.7723',
    profilePictureUrl: 'https://i.pravatar.cc/400?img=5',
    bio: '🐾 Passionate pet lover with 8 years of experience caring for dogs and cats. I treat every pet like family! My home has a large backyard perfect for playtime and I work from home so your pet gets 24/7 attention.',
    yearsOfExperience: 8,
    detailedExperience: 'Certified pet first aid, experienced with senior pets, puppies, and special needs animals. I provide daily photo updates and maintain a detailed care journal.',
    specializations: ['dogs', 'cats', 'puppies'],
    languagesSpoken: ['Hebrew', 'English', 'Russian'],
    personalAllergies: null,
    smokingStatus: 'non_smoker',
    hasOtherPets: true,
    otherPetsDetails: 'I have a gentle 5-year-old golden retriever named Max who loves making new friends!',
    homeType: 'house',
    yardSize: 'large',
    homePhotos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c'],
    pricePerDayCents: 25000, // ₪250/day
    serviceTypes: ['boarding', 'daycare', 'drop_in'],
    availabilityCalendar: [],
    recurringAvailability: {
      monday: { available: true, hours: '8am-8pm' },
      tuesday: { available: true, hours: '8am-8pm' },
      wednesday: { available: true, hours: '8am-8pm' },
      thursday: { available: true, hours: '8am-8pm' },
      friday: { available: true, hours: '8am-6pm' },
      saturday: { available: false },
      sunday: { available: true, hours: '10am-8pm' },
    },
    housePolicies: {
      maxPetsAtOnce: 3,
      acceptsUnvaccinatedPets: false,
      acceptsPuppies: true,
      acceptsSeniorPets: true,
      acceptsSpecialNeeds: true,
      cancellationPolicy: 'flexible' as const,
      additionalRules: ['Must be house-trained', 'Current vaccination records required'],
    },
    propertyAmenities: {
      hasBackyard: true,
      yardFenced: true,
      yardSizeMeters: 150,
      hasBalcony: false,
      hasPatio: true,
      numberOfBedrooms: 3,
      numberOfBathrooms: 2,
      hasDedicatedPetRoom: true,
      hasPetBed: true,
      hasAirConditioning: true,
      hasHeating: true,
      hasPetDoor: true,
      hasCrate: true,
      crateSize: 'large',
      hasToys: true,
      toyTypes: ['balls', 'chew toys', 'puzzles'],
      hasTrainingAids: false,
      providesFood: true,
      foodBrands: ['Royal Canin', 'Acana'],
      dailyFoodAmount: '2 cups per meal',
      feedingSchedule: '8am, 6pm',
      hasAutomaticFeeder: false,
      hasWaterFountain: true,
      walkFrequency: '3 times daily',
      walkDuration: '30 minutes each',
      hasNearbyPark: true,
      parkDistance: 200,
      hasSwimmingPool: false,
      has24hrSupervision: true,
      hasCCTV: true,
      hasFirstAidKit: true,
      hasEmergencyVet: true,
      emergencyVetDistance: 1.5,
      hasFireExtinguisher: true,
      allowsPetsOnFurniture: true,
      allowsPetsOnBed: false,
      hasOtherAnimals: true,
      otherAnimalsDetails: 'Friendly golden retriever',
    },
    entryInstructions: {
      accessMethod: 'smart_lock' as const,
      smartLockType: 'Yale',
      smartLockCode: '1234',
      smartLockInstructions: 'Enter code, turn handle down',
      buildingEntry: 'Main entrance, ring apt 5',
      parkingInstructions: 'Visitor parking available on street',
      wifiNetwork: 'SarahHome_5G',
      wifiPassword: 'pets2024',
      wifiInstructions: 'Auto-connect available',
      hostMobileForEmergency: '+972-50-123-4567',
      hostPreferredContactMethod: 'whatsapp' as const,
      flexibleCheckIn: true,
      preferredCheckInTime: 'After 2pm',
      preferredCheckOutTime: 'Before 12pm',
      additionalInstructions: 'Please text me when you arrive!',
    },
    houseManual: {
      applianceInstructions: 'Pet food stored in pantry, bowls under sink',
      heatingCoolingInstructions: 'Thermostat preset to 22°C',
      trashSchedule: 'Collection: Sunday & Thursday 7am',
      recyclingInstructions: 'Blue bin for plastic, green for paper',
      nearbyVets: [
        { name: 'Tel Aviv Veterinary Clinic', address: '25 Ben Yehuda St', phone: '+972-3-555-1234', distance: 1.5 },
      ],
      nearbyPetStores: [
        { name: 'PetZone', address: '10 Dizengoff St', distance: 0.8 },
      ],
      nearbyParks: [
        { name: 'Charles Clore Park', address: 'HaTayelet St', distance: 0.2 },
      ],
      emergencyContacts: [
        { name: 'David Cohen (Husband)', relationship: 'spouse', phone: '+972-50-987-6543' },
      ],
      quietHours: '10pm - 7am',
      smokingPolicy: 'no_smoking' as const,
      recommendedActivities: ['Beach walk at Charles Clore Park', 'Dog-friendly cafe on Rothschild'],
    },
    emergencyContactName: 'David Cohen',
    emergencyContactPhone: '+972-50-987-6543',
    emergencyContactRelationship: 'Spouse',
    verificationStatus: 'active',
    backgroundCheckStatus: 'passed',
    backgroundCheckCompletedAt: new Date('2024-01-15'),
    trainingCompletedAt: new Date('2024-01-20'),
    activatedAt: new Date('2024-02-01'),
    selfiePhotoUrl: 'https://i.pravatar.cc/400?img=5',
    idPhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
    biometricMatchStatus: 'matched',
    biometricMatchScore: '98.50',
    biometricVerifiedAt: new Date('2024-01-18'),
    biometricRejectionReason: null,
    termsAcceptedAt: new Date('2024-01-10'),
    privacyPolicyAcceptedAt: new Date('2024-01-10'),
    insuranceCertUrl: 'https://example.com/insurance/sarah-cohen.pdf',
    isActive: true,
    isVerified: true,
    rating: '4.95',
    totalBookings: 127,
    totalEarningsCents: 3175000, // ₪31,750
    responseTimeMinutes: 15,
  },
  {
    userId: 'sitter-002',
    firstName: 'David',
    lastName: 'Levi',
    dateOfBirth: new Date('1985-08-22'),
    email: 'david.levi@example.com',
    phone: '+972-52-234-5678',
    streetAddress: '42 Herzl Street',
    apartment: null,
    city: 'Jerusalem',
    stateProvince: 'Jerusalem District',
    postalCode: '9458131',
    country: 'Israel',
    latitude: '31.7683',
    longitude: '35.2137',
    profilePictureUrl: 'https://i.pravatar.cc/400?img=12',
    bio: '🏡 Professional pet sitter specializing in anxious and rescue pets. Creating calm, safe environments for your furry friends since 2015. Certified in animal behavior and pet CPR.',
    yearsOfExperience: 10,
    detailedExperience: 'Animal behavior certification, experience with rescue animals, anxiety management specialist. Provide structured routines and positive reinforcement training.',
    specializations: ['dogs', 'rescue_animals', 'anxious_pets'],
    languagesSpoken: ['Hebrew', 'English'],
    personalAllergies: null,
    smokingStatus: 'non_smoker',
    hasOtherPets: false,
    otherPetsDetails: null,
    homeType: 'house',
    yardSize: 'medium',
    homePhotos: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9'],
    pricePerDayCents: 28000, // ₪280/day
    serviceTypes: ['boarding', 'daycare'],
    availabilityCalendar: [],
    recurringAvailability: {
      monday: { available: true, hours: 'All day' },
      tuesday: { available: true, hours: 'All day' },
      wednesday: { available: true, hours: 'All day' },
      thursday: { available: true, hours: 'All day' },
      friday: { available: true, hours: '8am-4pm' },
      saturday: { available: false },
      sunday: { available: true, hours: 'All day' },
    },
    housePolicies: {
      maxPetsAtOnce: 2,
      acceptsUnvaccinatedPets: false,
      acceptsPuppies: true,
      acceptsSeniorPets: true,
      acceptsSpecialNeeds: true,
      cancellationPolicy: 'moderate' as const,
      additionalRules: ['Calm temperament preferred', 'Must be comfortable with other animals'],
    },
    propertyAmenities: {
      hasBackyard: true,
      yardFenced: true,
      yardSizeMeters: 80,
      hasBalcony: false,
      hasPatio: false,
      numberOfBedrooms: 2,
      numberOfBathrooms: 1,
      hasDedicatedPetRoom: true,
      hasPetBed: true,
      hasAirConditioning: true,
      hasHeating: true,
      hasPetDoor: false,
      hasCrate: true,
      crateSize: 'medium',
      hasToys: true,
      toyTypes: ['puzzle feeders', 'calming toys'],
      hasTrainingAids: true,
      providesFood: true,
      foodBrands: ['Hills Science Diet', 'Purina Pro Plan'],
      dailyFoodAmount: 'As per owner instructions',
      feedingSchedule: 'Flexible',
      hasAutomaticFeeder: false,
      hasWaterFountain: true,
      walkFrequency: '4 times daily',
      walkDuration: '20-30 minutes',
      hasNearbyPark: true,
      parkDistance: 300,
      hasSwimmingPool: false,
      has24hrSupervision: true,
      hasCCTV: false,
      hasFirstAidKit: true,
      hasEmergencyVet: true,
      emergencyVetDistance: 2.0,
      hasFireExtinguisher: true,
      allowsPetsOnFurniture: false,
      allowsPetsOnBed: false,
      hasOtherAnimals: false,
      otherAnimalsDetails: null,
    },
    entryInstructions: {
      accessMethod: 'key' as const,
      keyLocation: 'Lockbox at front door',
      lockboxCode: '5678',
      lockboxLocation: 'Right of main entrance',
      wifiNetwork: 'LeviHome',
      wifiPassword: 'jerusalem2024',
      hostMobileForEmergency: '+972-52-234-5678',
      hostPreferredContactMethod: 'call' as const,
      flexibleCheckIn: false,
      preferredCheckInTime: '3pm-6pm',
      preferredCheckOutTime: '10am-12pm',
      additionalInstructions: 'Please call before arrival',
    },
    houseManual: {
      smokingPolicy: 'no_smoking' as const,
    },
    emergencyContactName: 'Rachel Levi',
    emergencyContactPhone: '+972-52-876-5432',
    emergencyContactRelationship: 'Sister',
    verificationStatus: 'active',
    backgroundCheckStatus: 'passed',
    backgroundCheckCompletedAt: new Date('2024-01-10'),
    trainingCompletedAt: new Date('2024-01-15'),
    activatedAt: new Date('2024-02-01'),
    selfiePhotoUrl: 'https://i.pravatar.cc/400?img=12',
    idPhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
    biometricMatchStatus: 'matched',
    biometricMatchScore: '96.75',
    biometricVerifiedAt: new Date('2024-01-12'),
    biometricRejectionReason: null,
    termsAcceptedAt: new Date('2024-01-08'),
    privacyPolicyAcceptedAt: new Date('2024-01-08'),
    insuranceCertUrl: 'https://example.com/insurance/david-levi.pdf',
    isActive: true,
    isVerified: true,
    rating: '4.92',
    totalBookings: 95,
    totalEarningsCents: 2660000, // ₪26,600
    responseTimeMinutes: 22,
  },
];

export async function seedSitterDemoData() {
  try {
    logger.info('[Seed] Starting Sitter Suite™ demo data seeding...');

    // Insert sitters
    const insertedSitters = await db.insert(sitterProfiles).values(demoSitters).returning();
    logger.info(`[Seed] Inserted ${insertedSitters.length} sitters`);

    // Create reviews for each sitter
    const reviews = [];
    for (const sitter of insertedSitters) {
      // Add 3-5 reviews per sitter
      const reviewCount = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < reviewCount; i++) {
        reviews.push({
          bookingId: 1, // Mock booking ID
          sitterId: sitter.id,
          ownerId: `owner-${Math.random().toString(36).substr(2, 9)}`,
          rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
          comment: [
            '⭐ Amazing experience! My dog was so happy and well cared for.',
            '💯 Highly professional and caring. Will definitely book again!',
            '🐾 Best pet sitter we\'ve ever had. Detailed updates and photos every day!',
            '❤️ Our cat came home relaxed and happy. Thank you!',
            '🌟 Exceeded all expectations. Truly treats pets like family!',
          ][i] || '⭐ Great service!',
          isVerifiedStay: true,
        });
      }
    }

    await db.insert(sitterReviews).values(reviews);
    logger.info(`[Seed] Inserted ${reviews.length} reviews`);

    // Create demo pet for demo user
    const [demoPet] = await db.insert(petProfilesForSitting).values({
      userId: DEMO_USER_ID,
      name: 'Charlie',
      breed: 'Golden Retriever',
      age: 3,
      weight: '28kg',
      photoUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24',
      specialNeeds: 'Needs daily medication for mild allergies',
      allergies: [
        {
          allergen: 'Chicken',
          severity: 'mild' as const,
          highAlertFlag: false,
          notes: 'Avoid chicken-based treats',
        },
      ],
      medications: 'Antihistamine daily with breakfast',
      vetContactName: 'Dr. Sarah Miller',
      vetContactPhone: '+972-3-555-7890',
      emergencyContactName: 'John Doe',
      emergencyContactPhone: '+972-50-111-2222',
    }).returning();

    logger.info('[Seed] Created demo pet for demo user');

    logger.info('[Seed] ✅ Sitter Suite™ demo data seeded successfully!');
    logger.info(`[Seed] Created ${insertedSitters.length} sitters, ${reviews.length} reviews, and 1 demo pet`);

    return { sitters: insertedSitters, reviews, pet: demoPet };
  } catch (error) {
    logger.error('[Seed] Error seeding demo data:', error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedSitterDemoData()
    .then(() => {
      logger.info('[Seed] Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Seed] Seeding failed:', error);
      process.exit(1);
    });
}
